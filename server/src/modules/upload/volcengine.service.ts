import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as crypto from 'crypto'
import { StorageService } from '../storage/storage.service'

/**
 * 火山引擎服务
 * 使用TOS上传文件
 */
@Injectable()
export class VolcengineService {
  private readonly logger = new Logger(VolcengineService.name)

  private readonly accessKey = process.env.VOLC_ACCESS_KEY || 'AKLTN2U0ZjBlZjU3YzFlNGYwYmI1YTJkYjlkNzY0NzcwNDU'
  private readonly secretKey = Buffer.from(
    process.env.VOLC_SECRET_KEY || 'TnpGa1lUVm1NR1prTnpRMk5EWmpNV0UyWmpkaU0yRmtNV1ZsTkRjeE1tSQ==',
    'base64'
  ).toString()
  private readonly bucketName = process.env.COZE_BUCKET_NAME || 'morena-ai'
  private readonly endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com'
  private readonly region = 'cn-guangzhou'

  constructor(private readonly storageService: StorageService) {
    this.logger.log('[VolcengineService] 初始化火山引擎服务')
    this.logger.log(`[VolcengineService] TOS Bucket: ${this.bucketName}`)
    this.logger.log(`[VolcengineService] TOS Endpoint: ${this.endpoint}`)
  }

  /**
   * 上传图片
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    try {
      this.logger.log(`[VolcengineService] 开始上传图片: ${file.originalname}`)
      this.logger.log(`[VolcengineService] 图片大小: ${file.size} bytes`)

      const key = await this.uploadToTOS(file.buffer, this.generateKey(file.originalname), file.mimetype)

      const url = this.buildFileUrl(key)

      this.logger.log(`[VolcengineService] 图片上传成功: ${url}`)

      return { url }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传图片失败:`, error)
      throw new Error(`上传图片失败: ${error.message}`)
    }
  }

  /**
   * 上传视频
   */
  async uploadVideo(file: Express.Multer.File): Promise<{ url: string }> {
    try {
      this.logger.log(`[VolcengineService] 开始上传视频: ${file.originalname}`)
      this.logger.log(`[VolcengineService] 视频大小: ${file.size} bytes`)

      const key = await this.uploadToTOS(file.buffer, this.generateKey(file.originalname), file.mimetype)

      const url = this.buildFileUrl(key)

      this.logger.log(`[VolcengineService] 视频上传成功: ${url}`)

      return { url }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传视频失败:`, error)
      throw new Error(`上传视频失败: ${error.message}`)
    }
  }

  /**
   * 上传音频
   */
  async uploadAudio(file: Express.Multer.File): Promise<{ url: string }> {
    try {
      this.logger.log(`[VolcengineService] 开始上传音频: ${file.originalname}`)
      this.logger.log(`[VolcengineService] 音频大小: ${file.size} bytes`)

      const key = await this.uploadToTOS(file.buffer, this.generateKey(file.originalname), file.mimetype)

      const url = this.buildFileUrl(key)

      this.logger.log(`[VolcengineService] 音频上传成功: ${url}`)

      return { url }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传音频失败:`, error)
      throw new Error(`上传音频失败: ${error.message}`)
    }
  }

  /**
   * 上传到TOS
   */
  private async uploadToTOS(buffer: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const url = `${this.endpoint}/${this.bucketName}/${key}`

      this.logger.log(`[VolcengineService] 上传到TOS: ${url}`)

      // 使用简单PUT请求（不需要签名，如果Bucket配置为公共读）
      const response = await axios.put(url, buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      this.logger.log(`[VolcengineService] TOS上传响应状态: ${response.status}`)

      return key
    } catch (error: any) {
      this.logger.error(`[VolcengineService] TOS上传失败:`, error)
      this.logger.error(`[VolcengineService] 错误详情:`, error.response?.data)

      // 提供友好的错误提示
      if (error.response?.data?.Code === 'AccessDenied') {
        throw new Error(`Access Denied: Bucket ${this.bucketName} 不允许匿名写入。请在火山引擎TOS控制台配置Bucket权限为"公共读"，或为Access Key添加TOS写入权限。`)
      }

      if (error.response?.data?.Code === 'NoSuchBucket') {
        throw new Error(`Bucket ${this.bucketName} 不存在。请在火山引擎TOS控制台创建该Bucket。`)
      }

      throw new Error(`TOS上传失败: ${error.message}`)
    }
  }

  /**
   * 构建文件URL
   */
  private buildFileUrl(key: string): string {
    return `${this.endpoint}/${this.bucketName}/${key}`
  }

  /**
   * 生成文件Key
   */
  private generateKey(filename: string): string {
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : ''
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `${timestamp}_${random}${ext}`
  }
}
