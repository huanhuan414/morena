import { Injectable, Logger } from '@nestjs/common'
import { Config } from 'coze-coding-dev-sdk'
import { TOSClient } from 'coze-coding-dev-sdk'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)
  private tosClient: TOSClient
  private readonly bucketName = process.env.TOS_BUCKET_NAME || 'avatar-assets'

  constructor() {
    // 初始化 TOS 客户端
    const config = new Config()
    this.tosClient = new TOSClient(config)
  }

  /**
   * 上传订单截图
   */
  async uploadOrderScreenshot(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `order-screenshots/${uuidv4()}${path.extname(file.originalname)}`

    const url = await this.uploadToTOS(file, fileName)

    return { url }
  }

  /**
   * 上传分身头像
   */
  async uploadAvatarImage(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `avatar-images/${uuidv4()}${path.extname(file.originalname)}`

    const url = await this.uploadToTOS(file, fileName)

    return { url }
  }

  /**
   * 上传通用图片
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `general-images/${uuidv4()}${path.extname(file.originalname)}`

    const url = await this.uploadToTOS(file, fileName)

    return { url }
  }

  /**
   * 上传到 TOS
   */
  private async uploadToTOS(file: Express.Multer.File, fileName: string): Promise<string> {
    try {
      // 获取文件内容
      const fileBuffer = file.buffer

      // 使用 TOS 上传
      const uploadResult = await this.tosClient.uploadFile({
        bucket: this.bucketName,
        key: fileName,
        body: fileBuffer,
        contentType: file.mimetype
      })

      // 生成公开访问URL
      const url = `https://${this.bucketName}.${process.env.TOS_REGION || 'cn-beijing'}.volces.com/${fileName}`

      this.logger.log(`文件上传成功: ${fileName}`)
      return url
    } catch (error) {
      this.logger.error('TOS上传失败:', error)
      throw new Error('文件上传失败')
    }
  }
}
