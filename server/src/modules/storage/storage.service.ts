import { Injectable } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'

@Injectable()
export class StorageService {
  private storage: S3Storage

  constructor() {
    // 初始化火山引擎CDN存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morina-ai',
      region: 'cn-guangzhou', // 华南1（广州）
    })
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
   * 上传图片
   */
  async uploadImage(imageBuffer: Buffer, fileName: string): Promise<string> {
    return this.uploadFile(imageBuffer, fileName, 'image/png')
  }

  /**
   * 上传视频
   */
  async uploadVideo(videoBuffer: Buffer, fileName: string): Promise<string> {
    return this.uploadFile(videoBuffer, fileName, 'video/mp4')
  }

  /**
   * 上传音频
   */
  async uploadAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
    return this.uploadFile(audioBuffer, fileName, 'audio/mp3')
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
    return this.uploadImage(buffer, fileName)
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
