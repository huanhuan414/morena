import { Injectable, Logger } from '@nestjs/common'
import { Config, S3Storage } from 'coze-coding-dev-sdk'
import { nanoid } from 'nanoid'
import * as path from 'path'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)
  private s3Client: S3Storage
  private readonly bucketName = process.env.TOS_BUCKET_NAME || 'avatar-assets'

  constructor() {
    // 初始化 S3 客户端
    const config = new Config()
    this.s3Client = new S3Storage({
      endpointUrl: process.env.TOS_ENDPOINT || 'https://tos-cn-beijing.volces.com',
      accessKey: process.env.TOS_ACCESS_KEY || '',
      secretKey: process.env.TOS_SECRET_KEY || '',
      bucketName: this.bucketName,
      region: process.env.TOS_REGION || 'cn-beijing'
    })
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
      // 使用 S3Storage 上传
      const uploadedFileUrl = await this.s3Client.uploadFile({
        fileContent: file.buffer,
        fileName: fileName,
        contentType: file.mimetype,
        bucket: this.bucketName
      })

      this.logger.log(`文件上传成功: ${fileName}`)
      return uploadedFileUrl
    } catch (error) {
      this.logger.error('S3上传失败:', error)
      throw new Error('文件上传失败')
    }
  }
}
