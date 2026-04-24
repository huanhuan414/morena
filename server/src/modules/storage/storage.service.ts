import { Injectable, Logger } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'
import { VolcengineService } from '../upload/volcengine.service'

@Injectable()
export class StorageService {
  private storage: S3Storage
  private volcengineService: VolcengineService
  private readonly logger = new Logger(StorageService.name)

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
      return await this.storage.generatePresignedUrl({ key, expireTime: 86400 * 30 })
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
  async uploadVideo(videoBuffer: Buffer, fileName: string): Promise<string> {
    this.logger.log(`[StorageService] 上传视频到对象存储: ${fileName}, 大小: ${videoBuffer.length} bytes`)

    try {
      // 🔴 修复：添加更详细的日志和错误处理
      this.logger.log(`[StorageService] 开始上传文件到 TOS...`)
      this.logger.log(`[StorageService] endpoint: ${process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com'}`)
      this.logger.log(`[StorageService] bucket: ${process.env.COZE_BUCKET_NAME || 'morena-ai'}`)

      const key = await this.storage.uploadFile({
        fileContent: videoBuffer,
        fileName: `videos/${fileName}`,
        contentType: 'video/mp4'
      })

      this.logger.log(`[StorageService] 文件上传成功, key: ${key}`)

      // 生成临时URL
      this.logger.log(`[StorageService] 开始生成预签名URL...`)
      const url = await this.storage.generatePresignedUrl({ key, expireTime: 86400 * 30 })
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
  async uploadAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
    this.logger.log(`[StorageService] 上传音频到对象存储: ${fileName}`)
    try {
      const key = await this.storage.uploadFile({
        fileContent: audioBuffer,
        fileName: `audio/${fileName}`,
        contentType: 'audio/mp3'
      })
      // 生成临时URL
      const url = await this.storage.generatePresignedUrl({ key, expireTime: 86400 * 30 })
      this.logger.log(`[StorageService] 音频上传成功: ${url}`)
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
