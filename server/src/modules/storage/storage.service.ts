import { Injectable, Logger } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'
import { VolcengineService } from '../upload/volcengine.service'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class StorageService {
  private storage: S3Storage
  private volcengineService: VolcengineService
  private readonly logger = new Logger(StorageService.name)

  private isMockEnabled(): boolean {
    return process.env.NODE_ENV !== 'production' && process.env.STORAGE_MOCK === '1'
  }

  private saveLocalBuffer(buffer: Buffer, subDir: string, fileName: string): string {
    const projectRoot = process.cwd().includes('server') ? path.join(process.cwd(), '..') : process.cwd()
    const uploadsRoot = path.join(projectRoot, 'uploads', subDir)
    fs.mkdirSync(uploadsRoot, { recursive: true })
    const safe = fileName && fileName.trim().length > 0 ? fileName : `${Date.now()}`
    const fullPath = path.join(uploadsRoot, safe)
    fs.writeFileSync(fullPath, buffer)
    const base = process.env.LOCAL_UPLOAD_BASE_URL || 'http://127.0.0.1:3000'
    return `${base}/uploads/${subDir}/${encodeURIComponent(safe)}`
  }

  constructor() {
    // 初始化火山引擎CDN存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morena-ai',
      region: 'cn-guangzhou', // 华南1（广州）
    })

    // 创建 VolcengineService 实例（不通过依赖注入，避免循环依赖）
    this.volcengineService = new VolcengineService()
  }

  /**
   * 上传文件到火山引擎CDN
   * @param fileContent 文件内容（Buffer）
   * @param fileName 文件名
   * @param contentType MIME类型
   * @returns 文件key
   */
  async uploadFile(
    fileContent: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    const key = await this.storage.uploadFile({
      fileContent,
      fileName: `uploads/${fileName}`,
      contentType
    })
    return key
  }

  /**
   * 上传图片 - 优先使用 veImageX
   * @param file 文件对象
   * @returns 图片URL
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (this.isMockEnabled()) {
      const ext = (file.originalname || '').split('.').pop() || 'png'
      const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`
      return this.saveLocalBuffer(file.buffer, 'images', name)
    }
    try {
      // 优先使用 veImageX 上传
      const result = await this.volcengineService.uploadImage(file)
      this.logger.log(`[StorageService] 使用 veImageX 上传图片成功: ${result.url}`)
      return result.url
    } catch (error) {
      this.logger.warn('[StorageService] veImageX 上传失败，降级到对象存储:', error)
      // 降级到对象存储
      const key = await this.storage.uploadFile({
        fileContent: file.buffer,
        fileName: `images/${Date.now()}_${file.originalname}`,
        contentType: file.mimetype || 'image/jpeg'
      })
      // 生成临时URL
      return await this.storage.generatePresignedUrl({ key, expireTime: 86400 * 365 * 10 })
    }
  }

  /**
   * 上传图片（使用Buffer）
   * @param imageBuffer 图片Buffer
   * @param fileName 文件名
   * @returns 图片URL
   */
  async uploadImageFromBuffer(imageBuffer: Buffer, fileName: string): Promise<string> {
    // 创建 Multer.File 对象
    const file: Express.Multer.File = {
      buffer: imageBuffer,
      originalname: fileName,
      mimetype: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
      size: imageBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: fileName,
      path: ''
    }
    return this.uploadImage(file)
  }

  /**
   * 上传视频 - 使用对象存储（veImageX不支持视频上传）
   */
  async uploadVideo(videoContent: Buffer | Readable, fileName: string): Promise<string> {
    const sizeHint = Buffer.isBuffer(videoContent) ? `, 大小: ${videoContent.length} bytes` : ''
    this.logger.log(`[StorageService] 上传视频到对象存储: ${fileName}${sizeHint}`)

    try {
      if (this.isMockEnabled()) {
        if (!Buffer.isBuffer(videoContent)) {
          throw new Error('STORAGE_MOCK=1 时仅支持 Buffer 上传')
        }
        return this.saveLocalBuffer(videoContent, 'videos', fileName)
      }
      // 🔴 修复：添加更详细的日志和错误处理
      this.logger.log(`[StorageService] 开始上传文件到 TOS...`)
      this.logger.log(`[StorageService] endpoint: ${process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com'}`)
      this.logger.log(`[StorageService] bucket: ${process.env.COZE_BUCKET_NAME || 'morena-ai'}`)

      const key = Buffer.isBuffer(videoContent)
        ? await this.storage.uploadFile({
          fileContent: videoContent,
          fileName: `videos/${fileName}`,
          contentType: 'video/mp4'
        })
        : await this.storage.streamUploadFile({
          stream: videoContent,
          fileName: `videos/${fileName}`,
          contentType: 'video/mp4'
        })

      this.logger.log(`[StorageService] 文件上传成功, key: ${key}`)

      // 生成预签名URL - 10年有效期，确保内容不会过期
      const url = await this.storage.generatePresignedUrl({ key, expireTime: 86400 * 365 * 10 })
      this.logger.log(`[StorageService] 视频上传成功: ${url.substring(0, 80)}...`)
      return url
    } catch (error: any) {
      this.logger.error('[StorageService] 视频上传失败:', error)
      this.logger.error('[StorageService] 错误详情:', error.message)
      if (error.$response) {
        this.logger.error('[StorageService] 原始响应:', error.$response)
      }
      throw new Error(`视频上传到CDN失败: ${error.message}`)
    }
  }

  /**
   * 上传音频 - 使用对象存储（veImageX不支持音频上传）
   */
  async uploadAudio(audioContent: Buffer | Readable, fileName: string): Promise<string> {
    this.logger.log(`[StorageService] 上传音频到对象存储: ${fileName}`)
    try {
      if (this.isMockEnabled()) {
        if (!Buffer.isBuffer(audioContent)) {
          throw new Error('STORAGE_MOCK=1 时仅支持 Buffer 上传')
        }
        return this.saveLocalBuffer(audioContent, 'audio', fileName)
      }
      const key = Buffer.isBuffer(audioContent)
        ? await this.storage.uploadFile({
          fileContent: audioContent,
          fileName: `audio/${fileName}`,
          contentType: 'audio/mp3'
        })
        : await this.storage.streamUploadFile({
          stream: audioContent,
          fileName: `audio/${fileName}`,
          contentType: 'audio/mp3'
        })
      // 生成临时URL
      const url = await this.storage.generatePresignedUrl({ key, expireTime: 86400 * 365 * 10 })
      return url
    } catch (error) {
      this.logger.error('[StorageService] 音频上传失败:', error)
      throw error
    }
  }

  /**
   * 从URL下载并上传到火山引擎
   */
  async uploadFromUrl(url: string): Promise<string> {
    const key = await this.storage.uploadFromUrl({ url })
    return key
  }

  /**
   * 生成文件访问URL
   * @param key 文件key
   * @param expireTime 过期时间（秒），默认1天
   */
  async getFileUrl(key: string, expireTime: number = 86400): Promise<string> {
    return this.storage.generatePresignedUrl({ key, expireTime })
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<boolean> {
    return this.storage.deleteFile({ fileKey: key })
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key: string): Promise<boolean> {
    return this.storage.fileExists({ fileKey: key })
  }

  /**
   * 列出文件
   */
  async listFiles(prefix?: string, maxKeys: number = 100) {
    return this.storage.listFiles({ prefix, maxKeys })
  }

  /**
   * 上传Base64图片
   */
  async uploadBase64Image(base64Data: string, fileName: string): Promise<string> {
    // 移除data:image/xxx;base64,前缀
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64String, 'base64')
    return this.uploadImageFromBuffer(buffer, fileName)
  }

  /**
   * 批量生成文件URL
   */
  async batchGetFileUrls(keys: string[], expireTime: number = 86400): Promise<Record<string, string>> {
    const urls: Record<string, string> = {}
    for (const key of keys) {
      urls[key] = await this.getFileUrl(key, expireTime)
    }
    return urls
  }
}
