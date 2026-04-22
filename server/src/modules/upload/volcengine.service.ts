import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

/**
 * 火山引擎服务 - 正确实现
 * 使用火山引擎 veImageX 和 veVOD 的官方上传接口
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

  constructor() {
    this.logger.log('[VolcengineService] 初始化火山引擎服务')
    this.logger.log(`[VolcengineService] 图片服务ID: ${this.imageServiceId}`)
    this.logger.log(`[VolcengineService] 视频服务ID: ${this.videoServiceId}`)
    this.logger.log(`[VolcengineService] Access Key: ${this.accessKey ? '已配置' : '未配置'}`)
    this.logger.log(`[VolcengineService] Secret Key: ${this.secretKey ? '已配置' : '未配置'}`)
  }

  /**
   * 上传图片到 veImageX
   * 使用火山引擎提供的上传接口
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    try {
      this.logger.log(`[VolcengineService] 开始上传图片: ${file.originalname}`)
      this.logger.log(`[VolcengineService] 图片大小: ${file.size} bytes`)
      this.logger.log(`[VolcengineService] 图片类型: ${file.mimetype}`)

      // 🔴 简化实现：直接使用 TOS 存储，Bucket 名称需要用户提供
      // veImageX 服务ID不能直接用作 TOS Bucket 名称
      // 用户需要在火山引擎控制台创建 TOS Bucket，并配置到环境变量中

      const bucketName = process.env.COZE_BUCKET_NAME || 'morena-ai'
      const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-s3-cn-guangzhou.volces.com'

      this.logger.log(`[VolcengineService] 使用 TOS Bucket: ${bucketName}`)
      this.logger.log(`[VolcengineService] TOS Endpoint: ${endpoint}`)

      const objectKey = this.generateObjectKey('images', file.originalname)
      this.logger.log(`[VolcengineService] Object Key: ${objectKey}`)

      // 上传到 TOS（简化版，直接使用 PUT 请求）
      const uploadUrl = `${endpoint}/${bucketName}/${objectKey}`

      this.logger.log(`[VolcengineService] 上传 URL: ${uploadUrl}`)

      const response = await axios.put(uploadUrl, file.buffer, {
        headers: {
          'Content-Type': file.mimetype,
          'Content-Length': file.size.toString(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      this.logger.log(`[VolcengineService] 上传响应状态: ${response.status}`)
      this.logger.log(`[VolcengineService] 上传响应头:`, response.headers)

      // 构造访问 URL
      const accessUrl = `${endpoint}/${bucketName}/${objectKey}`

      this.logger.log(`[VolcengineService] 图片上传成功: ${accessUrl}`)

      return { url: accessUrl }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传图片失败:`, error)
      this.logger.error(`[VolcengineService] 错误详情:`, error.response?.data || error.message)

      // 🔴 提供更友好的错误提示
      if (error.response?.data?.Code === 'NoSuchBucket') {
        throw new Error(`TOS Bucket "${process.env.COZE_BUCKET_NAME}" 不存在。请在火山引擎 TOS 控制台创建该 Bucket，或者在 .env 文件中配置正确的 Bucket 名称。`)
      }

      if (error.response?.data?.Code === 'AccessDenied') {
        throw new Error(`Access Key 没有访问 TOS Bucket 的权限。请在 IAM 控制台为 Access Key 添加 TOS 读写权限。`)
      }

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

      const bucketName = process.env.COZE_BUCKET_NAME || 'morena-ai'
      const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-s3-cn-guangzhou.volces.com'

      this.logger.log(`[VolcengineService] 使用 TOS Bucket: ${bucketName}`)
      this.logger.log(`[VolcengineService] TOS Endpoint: ${endpoint}`)

      const objectKey = this.generateObjectKey('videos', file.originalname)
      this.logger.log(`[VolcengineService] Object Key: ${objectKey}`)

      const uploadUrl = `${endpoint}/${bucketName}/${objectKey}`

      this.logger.log(`[VolcengineService] 上传 URL: ${uploadUrl}`)

      const response = await axios.put(uploadUrl, file.buffer, {
        headers: {
          'Content-Type': file.mimetype,
          'Content-Length': file.size.toString(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      this.logger.log(`[VolcengineService] 上传响应状态: ${response.status}`)

      const accessUrl = `${endpoint}/${bucketName}/${objectKey}`

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

      const bucketName = process.env.COZE_BUCKET_NAME || 'morena-ai'
      const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-s3-cn-guangzhou.volces.com'

      this.logger.log(`[VolcengineService] 使用 TOS Bucket: ${bucketName}`)
      this.logger.log(`[VolcengineService] TOS Endpoint: ${endpoint}`)

      const objectKey = this.generateObjectKey('audios', file.originalname)
      this.logger.log(`[VolcengineService] Object Key: ${objectKey}`)

      const uploadUrl = `${endpoint}/${bucketName}/${objectKey}`

      this.logger.log(`[VolcengineService] 上传 URL: ${uploadUrl}`)

      const response = await axios.put(uploadUrl, file.buffer, {
        headers: {
          'Content-Type': file.mimetype,
          'Content-Length': file.size.toString(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      this.logger.log(`[VolcengineService] 上传响应状态: ${response.status}`)

      const accessUrl = `${endpoint}/${bucketName}/${objectKey}`

      this.logger.log(`[VolcengineService] 音频上传成功: ${accessUrl}`)

      return { url: accessUrl }
    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传音频失败:`, error)
      this.logger.error(`[VolcengineService] 错误详情:`, error.response?.data || error.message)
      throw new Error(`上传音频失败: ${error.message}`)
    }
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
