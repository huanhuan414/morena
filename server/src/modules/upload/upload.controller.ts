import { Inject, Controller, Post, Get, Param, UseInterceptors, UploadedFile, Body } from '@nestjs/common'
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
  constructor(@Inject(UploadService) private readonly uploadService: UploadService) {}

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
   * 🔴 上传音频（用于语音识别）
   */
  @Post('audio')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    console.log('[UploadController] 接收到音频上传请求')
    console.log('[UploadController] 文件信息:', {
      originalname: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      hasBuffer: !!file?.buffer
    })

    if (!file) {
      return {
        code: 400,
        message: '未接收到文件'
      }
    }

    try {
      const result = await this.uploadService.uploadAudio(file)
      return {
        code: 200,
        message: '上传成功',
        data: result
      }
    } catch (error) {
      console.error('[UploadController] 音频上传失败:', error)
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
   * 上传压缩包并解析图片/视频
   * 支持 taskId 参数，前端可传入用于轮询进度
   */
  @Post('zip')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadZip(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    console.log('[UploadController] 接收到压缩包上传请求')
    console.log('[UploadController] 文件信息:', {
      originalname: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      hasBuffer: !!file?.buffer,
      taskId: body?.taskId,
    })

    if (!file) {
      return { code: 400, message: '未接收到文件' }
    }

    const taskId = body?.taskId || ''
    try {
      const result = await this.uploadService.uploadZip(file, taskId)
      return {
        code: 200,
        message: `解析完成：${result.images.length}张图片, ${result.videos.length}个视频`,
        data: result,
      }
    } catch (error) {
      console.error('[UploadController] 压缩包上传失败:', error)
      return {
        code: 500,
        message: error.message || '上传失败',
        error: error.message,
      }
    }
  }

  /**
   * 查询ZIP上传处理进度
   */
  @Get('zip-progress/:taskId')
  async getZipProgress(@Param('taskId') taskId: string) {
    if (!taskId) {
      return { code: 400, message: '缺少taskId', data: null }
    }
    const progress = await this.uploadService.getZipProgress(taskId)
    if (!progress) {
      return { code: 404, message: '未找到进度信息（可能已过期或任务未开始）', data: null }
    }
    return { code: 200, message: 'ok', data: progress }
  }

  /**
   * 🔴 通用文件上传接口
   * 根据文件类型自动选择上传服务
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log('[UploadController] 接收到通用文件上传请求')
    console.log('[UploadController] 文件信息:', {
      originalname: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      hasBuffer: !!file?.buffer
    })

    if (!file) {
      return {
        code: 400,
        message: '未接收到文件',
        error: 'File not found'
      }
    }

    try {
      // 根据 mimetype 判断文件类型
      const mimetype = file.mimetype || ''
      let result: any

      if (mimetype.startsWith('image/')) {
        result = await this.uploadService.uploadImage(file)
      } else if (mimetype.startsWith('audio/')) {
        result = await this.uploadService.uploadAudio(file)
      } else if (mimetype.startsWith('video/')) {
        result = await this.uploadService.uploadVideo(file)
      } else {
        // 其他文件类型当作图片处理
        result = await this.uploadService.uploadImage(file)
      }

      return {
        code: 200,
        message: '上传成功',
        data: result
      }
    } catch (error) {
      console.error('[UploadController] 文件上传失败:', error)
      return {
        code: 500,
        message: error.message || '上传失败',
        error: error.message
      }
    }
  }
}
