import { Injectable, Logger } from '@nestjs/common'
import { VolcengineService } from './volcengine.service'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)

  constructor(private readonly volcengineService: VolcengineService) {
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
   * 上传视频
   */
  async uploadVideo(file: Express.Multer.File): Promise<{ url: string }> {
    return this.volcengineService.uploadVideo(file)
  }

  /**
   * 上传音频
   */
  async uploadAudio(file: Express.Multer.File): Promise<{ url: string }> {
    return this.volcengineService.uploadAudio(file)
  }
}
