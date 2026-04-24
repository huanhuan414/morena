import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'

// 🔴 修复：Multer 配置，支持大文件上传（视频）
const multerOptions = {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB 限制
  },
}

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上传订单截图
   */
  @Post('order-screenshot')
  @UseInterceptors(FileInterceptor('file', multerOptions))
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
  @UseInterceptors(FileInterceptor('file', multerOptions))
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
  @UseInterceptors(FileInterceptor('file', multerOptions))
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

  /**
   * 🔴 上传视频
   */
  @Post('video')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    console.log('[UploadController] 接收到视频上传请求')
    console.log('[UploadController] 文件信息:', {
      originalname: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      hasBuffer: !!file?.buffer
    })

    if (!file) {
      console.error('[UploadController] 未接收到文件')
      return {
        code: 400,
        message: '未接收到文件',
        error: 'File not found'
      }
    }

    try {
      const result = await this.uploadService.uploadVideo(file)
      return {
        code: 200,
        message: '上传成功',
        data: result
      }
    } catch (error) {
      console.error('[UploadController] 视频上传失败:', error)
      return {
        code: 500,
        message: error.message || '上传失败',
        error: error.message
      }
    }
  }

  /**
   * 🔴 上传音频
   */
  @Post('audio')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    try {
      const result = await this.uploadService.uploadAudio(file)
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
