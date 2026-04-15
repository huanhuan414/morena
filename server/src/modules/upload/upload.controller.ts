import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上传订单截图
   */
  @Post('order-screenshot')
  @UseInterceptors(FileInterceptor('file'))
  async uploadOrderScreenshot(@UploadedFile() file: Express.Multer.File) {
    try {
      const result = await this.uploadService.uploadOrderScreenshot(file)
      return {
        code: 200,
        message: '上传成功',
        data: result
      }
    } catch (error) {
      return {
        code: 500,
        message: error.message || '上传失败',
        error: error.message
      }
    }
  }

  /**
   * 上传分身头像
   */
  @Post('avatar-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatarImage(@UploadedFile() file: Express.Multer.File) {
    try {
      const result = await this.uploadService.uploadAvatarImage(file)
      return {
        code: 200,
        message: '上传成功',
        data: result
      }
    } catch (error) {
      return {
        code: 500,
        message: error.message || '上传失败',
        error: error.message
      }
    }
  }

  /**
   * 上传通用图片
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    try {
      const result = await this.uploadService.uploadImage(file)
      return {
        code: 200,
        message: '上传成功',
        data: result
      }
    } catch (error) {
      return {
        code: 500,
        message: error.message || '上传失败',
        error: error.message
      }
    }
  }
}
