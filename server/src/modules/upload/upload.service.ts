import { Injectable, Logger } from '@nestjs/common'
import { Config, S3Storage } from 'coze-coding-dev-sdk'
import { nanoid } from 'nanoid'
import * as path from 'path'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)
  private s3Client: S3Storage
  private readonly bucketName = process.env.COZE_BUCKET_NAME || 'morina-ai'

  constructor(private readonly storageService: StorageService) {
    // 初始化 S3 客户端
    this.logger.log('初始化 S3 客户端...')
    this.logger.log(`TOS Endpoint: ${process.env.COZE_BUCKET_ENDPOINT_URL}`)
    this.logger.log(`TOS Bucket: ${this.bucketName}`)
    this.logger.log(`Access Key: ${process.env.VOLC_ACCESS_KEY ? '已配置' : '未配置'}`)

    try {
      // 🔴 修复：使用与 StorageService 相同的简单配置
      this.s3Client = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: process.env.VOLC_ACCESS_KEY || '',
        secretKey: process.env.VOLC_SECRET_KEY || '',
        bucketName: this.bucketName,
        region: 'cn-beijing',
      })
      this.logger.log('S3 客户端初始化成功')
    } catch (error) {
      this.logger.error('S3 客户端初始化失败:', error)
      this.logger.error('错误详情:', JSON.stringify(error))
    }
  }

  /**
   * 上传订单截图
   */
  async uploadOrderScreenshot(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `order-screenshots/${nanoid()}${path.extname(file.originalname)}`

    try {
      // 上传文件并获取实际的文件名（S3Storage 可能会修改文件名）
      const actualFileName = await this.uploadToS3(file, fileName)

      // 生成签名 URL
      const signedUrl = await this.storageService.getFileUrl(actualFileName, 86400 * 30) // 30天有效期

      return { url: signedUrl }
    } catch (s3Error) {
      this.logger.error('S3上传失败，尝试使用本地存储:', s3Error)
      const localUrl = await this.uploadToLocal(file, fileName)
      return { url: localUrl }
    }
  }

  /**
   * 上传分身头像
   */
  async uploadAvatarImage(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `avatar-images/${nanoid()}${path.extname(file.originalname)}`

    try {
      // 上传文件并获取实际的文件名（S3Storage 可能会修改文件名）
      const actualFileName = await this.uploadToS3(file, fileName)

      // 生成签名 URL
      const signedUrl = await this.storageService.getFileUrl(actualFileName, 86400 * 30) // 30天有效期

      return { url: signedUrl }
    } catch (s3Error) {
      this.logger.error('S3上传失败，尝试使用本地存储:', s3Error)
      const localUrl = await this.uploadToLocal(file, fileName)
      return { url: localUrl }
    }
  }

  /**
   * 上传通用图片
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `general-images/${nanoid()}${path.extname(file.originalname)}`

    try {
      // 尝试上传文件并获取实际的文件名（S3Storage 可能会修改文件名）
      const actualFileName = await this.uploadToS3(file, fileName)

      // 生成签名 URL
      const signedUrl = await this.storageService.getFileUrl(actualFileName, 86400 * 30) // 30天有效期

      return { url: signedUrl }
    } catch (s3Error) {
      this.logger.error('S3上传失败，尝试使用本地存储:', s3Error)

      // 🔴 Fallback: 使用本地文件存储
      const localUrl = await this.uploadToLocal(file, fileName)
      console.log('图片已保存到本地:', localUrl)

      return { url: localUrl }
    }
  }

  /**
   * 🔴 上传视频
   */
  async uploadVideo(file: Express.Multer.File): Promise<{ url: string }> {
    const fileName = `videos/${nanoid()}${path.extname(file.originalname)}`

    try {
      // 尝试上传文件并获取实际的文件名（S3Storage 可能会修改文件名）
      const actualFileName = await this.uploadToS3(file, fileName)

      // 生成签名 URL
      const signedUrl = await this.storageService.getFileUrl(actualFileName, 86400 * 30) // 30天有效期

      return { url: signedUrl }
    } catch (s3Error) {
      this.logger.error('S3上传失败，尝试使用本地存储:', s3Error)

      // 🔴 Fallback: 使用本地文件存储
      const localUrl = await this.uploadToLocal(file, fileName)
      console.log('视频已保存到本地:', localUrl)

      return { url: localUrl }
    }
  }

  /**
   * 上传到 S3
   * @returns 返回实际上传后的文件名（key）
   */
  private async uploadToS3(file: Express.Multer.File, fileName: string): Promise<string> {
    try {
      this.logger.log(`准备上传文件: ${fileName}, 大小: ${file.size} bytes`)
      this.logger.log(`文件类型: ${file.mimetype}`)

      // 🔴 尝试使用 StorageService 上传
      const actualFileName = await this.storageService.uploadFile(
        file.buffer,
        fileName,
        file.mimetype
      )

      this.logger.log(`文件上传成功: ${actualFileName}`)
      return actualFileName
    } catch (error: any) {
      this.logger.error('S3上传失败:', error)
      this.logger.error('错误详情:', JSON.stringify(error))

      // 🔴 尝试查看原始响应
      if (error.$response) {
        const responseBody = error.$response?.body?.toString()
        this.logger.error('原始响应:', responseBody)

        // 🔴 解析 TOS 错误信息
        if (responseBody && responseBody.includes('NoSuchBucket')) {
          throw new Error(`Bucket "${this.bucketName}" 不存在，请在 TOS 控制台检查 Bucket 配置`)
        }
      }

      // 🔴 检查 HTTP 状态码
      if (error.$metadata?.httpStatusCode === 404) {
        throw new Error(`资源不存在：${this.bucketName}。请检查 Bucket 名称和 Access Key 权限`)
      }

      throw new Error(`文件上传失败: ${error.message}`)
    }
  }

  /**
   * 🔴 备用方案：使用本地文件存储
   * 当 S3 上传失败时使用
   */
  private async uploadToLocal(file: Express.Multer.File, fileName: string): Promise<string> {
    const fs = require('fs')
    const path = require('path')

    try {
      // 🔴 修复：确保保存到项目根目录的 uploads 文件夹
      // 项目根目录：/workspace/projects
      const projectRoot = process.cwd().includes('server') ? path.join(process.cwd(), '..') : process.cwd()
      const filePath = path.join(projectRoot, 'uploads', fileName)
      const dir = path.dirname(filePath)

      this.logger.log(`准备保存文件到: ${filePath}`)
      this.logger.log(`项目根目录: ${projectRoot}`)
      this.logger.log(`当前工作目录: ${process.cwd()}`)

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        this.logger.log(`创建目录: ${dir}`)
      }

      // 保存文件
      fs.writeFileSync(filePath, file.buffer)
      this.logger.log(`文件已保存到本地: ${filePath}`)

      // 返回本地文件路径
      return `http://localhost:3000/uploads/${fileName}`
    } catch (error: any) {
      this.logger.error('本地保存失败:', error)
      throw new Error(`本地保存失败: ${error.message}`)
    }
  }
}
