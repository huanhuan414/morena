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
      encoding: '7bit'
    }
    return this.uploadImage(file)
  }

  /**
   * 上传视频 - 优先使用 veImageX
   */
  async uploadVideo(videoBuffer: Buffer, fileName: string): Promise<string> {
    // 创建 Multer.File 对象
    const file: Express.Multer.File = {
      buffer: videoBuffer,
      originalname: fileName,
      mimetype: 'video/mp4',
      size: videoBuffer.length,
      fieldname: 'file',
      encoding: '7bit'
    }
    try {
      // 优先使用 veImageX 上传
      const result = await this.volcengineService.uploadVideo(file)
      this.logger.log(`[StorageService] 使用 veImageX 上传视频成功: ${result.url}`)
      return result.url
    } catch (error) {
      this.logger.warn('[StorageService] veImageX 视频上传失败，降级到对象存储:', error)
      // 降级到对象存储
      const key = await this.storage.uploadFile({
        fileContent: videoBuffer,
        fileName: `videos/${fileName}`,
        contentType: 'video/mp4'
      })
      return key
    }
  }

  /**
   * 上传音频 - 使用对象存储
   */
  async uploadAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
    const key = await this.storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `audio/${fileName}`,
      contentType: 'audio/mp3'
    })
    return key
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
