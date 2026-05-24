import { Injectable, Logger, Inject } from '@nestjs/common'
import { VolcengineService } from './volcengine.service'
import { StorageService } from '../storage/storage.service'
import AdmZip from 'adm-zip'

/** 支持的图片扩展名 */
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
/** 支持的视频扩展名 */
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.3gp']

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)

  constructor(@Inject(VolcengineService) private readonly volcengineService: VolcengineService,
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

  /**
   * 上传压缩包并解析其中的图片和视频文件
   * 过滤掉其他类型文件，将图片和视频分别上传到对象存储
   */
  async uploadZip(file: Express.Multer.File): Promise<{
    images: Array<{ url: string; filename: string; size: number; mimeType: string }>
    videos: Array<{ url: string; filename: string; size: number; mimeType: string }>
    skipped: string[]
  }> {
    this.logger.log(`[UploadService] 解压压缩包: ${file.originalname}, 大小: ${file.size} bytes`)

    const source = file.buffer || (file.path ? undefined : undefined)
    if (!file.buffer || file.buffer.length === 0) {
      // 如果 buffer 为空，尝试从 path 读取（diskStorage 场景）
      if (file.path) {
        const fs = await import('fs')
        file.buffer = fs.readFileSync(file.path)
      } else {
        throw new Error('压缩包内容为空')
      }
    }

    const zip = new AdmZip(file.buffer)
    const entries = zip.getEntries()

    const images: Array<{ url: string; filename: string; size: number; mimeType: string }> = []
    const videos: Array<{ url: string; filename: string; size: number; mimeType: string }> = []
    const skipped: string[] = []

    for (const entry of entries) {
      // 跳过目录和隐藏文件
      if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('/__MACOSX') || entry.entryName.includes('/.')) {
        continue
      }

      const filename = entry.entryName.split('/').pop() || entry.entryName
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))

      if (IMAGE_EXTS.includes(ext)) {
        try {
          const buffer = entry.getData()
          const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
          const url = await this.storageService.uploadImageFromBuffer(buffer, `zip_${Date.now()}_${filename}`)
          images.push({ url, filename, size: buffer.length, mimeType })
          this.logger.log(`[UploadService] ZIP中图片上传成功: ${filename} -> ${url.substring(0, 60)}`)
        } catch (e) {
          this.logger.error(`[UploadService] ZIP中图片上传失败: ${filename}`, e)
          skipped.push(filename)
        }
      } else if (VIDEO_EXTS.includes(ext)) {
        try {
          const buffer = entry.getData()
          const mimeType = ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4'
          const url = await this.storageService.uploadVideo(buffer, `zip_${Date.now()}_${filename}`)
          videos.push({ url, filename, size: buffer.length, mimeType })
          this.logger.log(`[UploadService] ZIP中视频上传成功: ${filename} -> ${url.substring(0, 60)}`)
        } catch (e) {
          this.logger.error(`[UploadService] ZIP中视频上传失败: ${filename}`, e)
          skipped.push(filename)
        }
      } else {
        // 其他文件类型，忽略
        skipped.push(filename)
      }
    }

    this.logger.log(`[UploadService] ZIP解析完成: ${images.length}张图片, ${videos.length}个视频, 跳过${skipped.length}个文件`)
    return { images, videos, skipped }
  }
}
