import { Injectable, Logger } from '@nestjs/common'
import * as crypto from 'crypto'
import axios from 'axios'

/**
 * 火山引擎服务 - 简化版
 * 使用火山引擎 TOS 进行文件上传
 */
@Injectable()
export class VolcengineService {
  private readonly logger = new Logger(VolcengineService.name)

  // 配置参数
  private readonly accessKey = process.env.VOLC_ACCESS_KEY || 'AKLTN2U0ZjBlZjU3YzFlNGYwYmI1YTJkYjlkNzY0NzcwNDU'
  private readonly secretKey = Buffer.from(
    process.env.VOLC_SECRET_KEY || 'TnpGa1lUVm1NR1prTnpRMk5EWmpNV0UyWmpkaU0yRmtNV1ZsTkRjeE1tSQ==',
    'base64'
  ).toString()
  private readonly imageServiceId = process.env.VOLC_IMAGE_SERVICE_ID || '699z2ac540'
  private readonly videoServiceId = process.env.VOLC_VIDEO_SERVICE_ID || '4rj1sb5o2t'
  private readonly region = 'cn-north-1' // 华北区域
  private readonly endpoint = 'tos-s3-cn-north-1.volces.com'

  constructor() {
    this.logger.log('[VolcengineService] 初始化火山引擎服务')
    this.logger.log(`[VolcengineService] 图片服务ID: ${this.imageServiceId}`)
    this.logger.log(`[VolcengineService] 视频服务ID: ${this.videoServiceId}`)
    this.logger.log(`[VolcengineService] Access Key: ${this.accessKey ? '已配置' : '未配置'}`)
    this.logger.log(`[VolcengineService] Secret Key: ${this.secretKey ? '已配置' : '未配置'}`)
    this.logger.log(`[VolcengineService] Region: ${this.region}`)
    this.logger.log(`[VolcengineService] Endpoint: ${this.endpoint}`)
  }

  /**
   * 上传图片到 veImageX
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    try {
      this.logger.log(`[VolcengineService] 开始上传图片: ${file.originalname}`)
      this.logger.log(`[VolcengineService] 图片大小: ${file.size} bytes`)
      this.logger.log(`[VolcengineService] 图片类型: ${file.mimetype}`)

      const objectKey = this.generateObjectKey('images', file.originalname)
      this.logger.log(`[VolcengineService] Object Key: ${objectKey}`)

      // 上传到 TOS
      await this.uploadToTOS(this.imageServiceId, objectKey, file.buffer, file.mimetype)

      // 构造访问 URL
      const accessUrl = `https://${this.endpoint}/${this.imageServiceId}/${objectKey}`

      this.logger.log(`[VolcengineService] 图片上传成功: ${accessUrl}`)

      return { url: accessUrl }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传图片失败:`, error)
      this.logger.error(`[VolcengineService] 错误详情:`, error.response?.data || error.message)
      throw new Error(`上传图片失败: ${error.message}`)
    }
  }

  /**
   * 上传视频到 veVOD
   */
  async uploadVideo(file: Express.Multer.File): Promise<{ url: string }> {
    try {
      this.logger.log(`[VolcengineService] 开始上传视频: ${file.originalname}`)
      this.logger.log(`[VolcengineService] 视频大小: ${file.size} bytes`)
      this.logger.log(`[VolcengineService] 视频类型: ${file.mimetype}`)

      const objectKey = this.generateObjectKey('videos', file.originalname)
      this.logger.log(`[VolcengineService] Object Key: ${objectKey}`)

      // 上传到 TOS
      await this.uploadToTOS(this.videoServiceId, objectKey, file.buffer, file.mimetype)

      // 构造访问 URL
      const accessUrl = `https://${this.endpoint}/${this.videoServiceId}/${objectKey}`

      this.logger.log(`[VolcengineService] 视频上传成功: ${accessUrl}`)

      return { url: accessUrl }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传视频失败:`, error)
      this.logger.error(`[VolcengineService] 错误详情:`, error.response?.data || error.message)
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
      this.logger.log(`[VolcengineService] 音频类型: ${file.mimetype}`)

      const objectKey = this.generateObjectKey('audios', file.originalname)
      this.logger.log(`[VolcengineService] Object Key: ${objectKey}`)

      // 上传到 TOS（使用视频服务的 bucket）
      await this.uploadToTOS(this.videoServiceId, objectKey, file.buffer, file.mimetype)

      // 构造访问 URL
      const accessUrl = `https://${this.endpoint}/${this.videoServiceId}/${objectKey}`

      this.logger.log(`[VolcengineService] 音频上传成功: ${accessUrl}`)

      return { url: accessUrl }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传音频失败:`, error)
      this.logger.error(`[VolcengineService] 错误详情:`, error.response?.data || error.message)
      throw new Error(`上传音频失败: ${error.message}`)
    }
  }

  /**
   * 上传到 TOS
   */
  private async uploadToTOS(bucket: string, objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
    const url = `https://${this.endpoint}/${bucket}/${objectKey}`

    // 生成签名
    const date = new Date().toISOString().replace(/[-:]/g, '')
    const signature = this.generateV2Signature('PUT', bucket, objectKey, date)

    try {
      await axios.put(url, buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'X-Date': date,
          'Authorization': signature,
        },
      })

      this.logger.log(`[VolcengineService] TOS 上传成功: ${bucket}/${objectKey}`)
    } catch (error: any) {
      this.logger.error(`[VolcengineService] TOS 上传失败: ${bucket}/${objectKey}`, error)
      this.logger.error(`[VolcengineService] HTTP 状态码:`, error.response?.status)
      this.logger.error(`[VolcengineService] 响应数据:`, error.response?.data)
      throw error
    }
  }

  /**
   * 生成 V2 签名
   */
  private generateV2Signature(method: string, bucket: string, objectKey: string, date: string): string {
    const uri = `/${bucket}/${objectKey}`

    // 构造规范化请求
    const canonicalRequest = [
      method,
      '',
      uri,
      '',
      'content-length:' + (method === 'PUT' ? '{ContentLength}' : ''),
      'content-type:',
      'x-date:' + date,
      '',
      'content-length;content-type;x-date'
    ].join('\n')

    // 构造待签名字符串
    const credentialScope = `${date.slice(0, 8)}/${this.region}/tos/request`
    const stringToSign = `HMAC-SHA256\n${date}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`

    // 计算签名密钥
    const kDate = crypto.createHmac('sha256', this.secretKey).update(date).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update('tos').digest()
    const kSigning = crypto.createHmac('sha256', kService).update('request').digest()

    // 计算签名
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    // 构造 Authorization 头
    return `HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=content-length;content-type;x-date, Signature=${signature}`
  }

  /**
   * 生成对象 Key
   */
  private generateObjectKey(prefix: string, filename: string): string {
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : ''
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `${prefix}/${timestamp}_${random}${ext}`
  }
}
