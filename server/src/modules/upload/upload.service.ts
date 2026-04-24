import { Injectable, Logger } from '@nestjs/common'
import { VolcengineService } from './volcengine.service'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)

  constructor(
    private readonly volcengineService: VolcengineService,
    private readonly storageService: StorageService
  ) {
    this.logger.log('初始化上传服务')
  }

  /**
   * 上传订单截图
   */
  async uploadOrderScreenshot(file: Express.Multer.File): Promise<{ url: string }> {
    return this.volcengineService.uploadImage(file)
  }

  /**
   * 上传分身头像
   */
  async uploadAvatarImage(file: Express.Multer.File): Promise<{ url: string }> {
    return this.volcengineService.uploadImage(file)
  }

  /**
   * 上传通用图片
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    return this.volcengineService.uploadImage(file)
  }

  /**
   * 上传视频 - 使用对象存储（veImageX不支持视频）
   */
  async uploadVideo(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[UploadService] 上传视频到对象存储: ${file.originalname}, 大小: ${file.size} bytes`)
    try {
      // 🔴 修复：添加文件有效性检查
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('文件内容为空')
      }

      const url = await this.storageService.uploadVideo(
        file.buffer,
        file.originalname
      )
      this.logger.log(`[UploadService] 视频上传成功: ${url.substring(0, 60)}`)
      return { url }
    } catch (error: any) {
      this.logger.error('[UploadService] 视频上传失败:', error)
      throw new Error(`视频上传失败: ${error.message}`)
    }
  }

  /**
   * 上传音频 - 使用对象存储（veImageX不支持音频）
   */
  async uploadAudio(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[UploadService] 上传音频到对象存储: ${file.originalname}`)
    try {
      const url = await this.storageService.uploadAudio(
        file.buffer,
        file.originalname
      )
      this.logger.log(`[UploadService] 音频上传成功: ${url.substring(0, 60)}`)
      return { url }
    } catch (error) {
      this.logger.error('[UploadService] 音频上传失败:', error)
      throw error
    }
  }
}
