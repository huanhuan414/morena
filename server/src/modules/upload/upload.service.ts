import { Injectable, Logger } from '@nestjs/common'
import { Config, S3Storage } from 'coze-coding-dev-sdk'
import { nanoid } from 'nanoid'
import * as path from 'path'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)
  private s3Client: S3Storage
  private readonly bucketName = process.env.COZE_BUCKET_NAME || 'morina-ai'

  constructor() {
    // 初始化 S3 客户端
    this.logger.log('初始化 S3 客户端...')
    this.logger.log(`TOS Endpoint: ${process.env.COZE_BUCKET_ENDPOINT_URL}`)
    this.logger.log(`TOS Bucket: ${this.bucketName}`)
    this.logger.log(`Access Key: ${process.env.VOLC_ACCESS_KEY ? '已配置' : '未配置'}`)

    try {
      this.s3Client = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: process.env.VOLC_ACCESS_KEY || '',
        secretKey: process.env.VOLC_SECRET_KEY || '',
        bucketName: this.bucketName,
        region: 'cn-beijing'
      })
      this.logger.log('S3 客户端初始化成功')
    } catch (error) {
      this.logger.error('S3 客户端初始化失败:', error)
    }
  }

  /**
   * 上传订单截图
   */
  async uploadOrderScreenshot(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `order-screenshots/${nanoid()}${path.extname(file.originalname)}`

    const url = await this.uploadToS3(file, fileName)

    return { url }
  }

  /**
   * 上传分身头像
   */
  async uploadAvatarImage(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `avatar-images/${nanoid()}${path.extname(file.originalname)}`

    const url = await this.uploadToS3(file, fileName)

    return { url }
  }

  /**
   * 上传通用图片
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `general-images/${nanoid()}${path.extname(file.originalname)}`

    const url = await this.uploadToS3(file, fileName)

    return { url }
  }

  /**
   * 上传到 S3
   */
  private async uploadToS3(file: Express.Multer.File, fileName: string): Promise<string> {
    try {
      this.logger.log(`准备上传文件: ${fileName}, 大小: ${file.size} bytes`)
      this.logger.log(`文件类型: ${file.mimetype}`)

      // 使用 S3Storage 上传
      const uploadResult = await this.s3Client.uploadFile({
        fileContent: file.buffer,
        fileName: fileName,
        contentType: file.mimetype,
        bucket: this.bucketName
      })

      this.logger.log(`文件上传结果:`, JSON.stringify(uploadResult))

      // 处理不同的返回格式
      let url = ''
      if (typeof uploadResult === 'string') {
        url = uploadResult
      } else if (uploadResult && uploadResult.url) {
        url = uploadResult.url
      } else if (uploadResult && uploadResult.location) {
        url = uploadResult.location
      } else if (uploadResult && uploadResult.data) {
        url = uploadResult.data
      } else {
        // 如果返回的是对象，直接返回整个对象
        url = JSON.stringify(uploadResult)
      }

      this.logger.log(`提取到的URL: ${url}`)
      return url
    } catch (error) {
      this.logger.error('S3上传失败:', error)
      this.logger.error('错误详情:', JSON.stringify(error))
      throw new Error(`文件上传失败: ${error.message}`)
    }
  }
}
