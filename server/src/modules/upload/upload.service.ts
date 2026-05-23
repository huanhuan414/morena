import { Injectable, Logger, Inject } from '@nestjs/common'
import { VolcengineService } from './volcengine.service'
import { StorageService } from '../storage/storage.service'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as crypto from 'crypto'
import * as path from 'path'

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
    const filePath = (file as any).path as string | undefined
    try {
      const content = filePath
        ? fs.createReadStream(filePath)
        : (file.buffer && file.buffer.length > 0 ? file.buffer : null)
      if (!content) throw new Error('文件内容为空')

      const ext = (() => {
        const raw = path.extname(file.originalname || '').slice(0, 10)
        return raw && raw.length <= 10 ? raw : ''
      })()
      const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext || '.mp4'}`

      const url = await this.storageService.uploadVideo(
        content,
        safeName
      )
      this.logger.log(`[UploadService] 视频上传成功: ${url.substring(0, 60)}`)
      return { url }
    } catch (error: any) {
      this.logger.error('[UploadService] 视频上传失败:', error)
      throw new Error(`视频上传失败: ${error.message}`)
    } finally {
      if (filePath) {
        try {
          await fsPromises.unlink(filePath)
        } catch {
          return
        }
      }
    }
  }

  /**
   * 上传音频 - 使用对象存储（veImageX不支持音频）
   */
  async uploadAudio(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[UploadService] 上传音频到对象存储: ${file.originalname}`)
    const filePath = (file as any).path as string | undefined
    try {
      const content = filePath
        ? fs.createReadStream(filePath)
        : (file.buffer && file.buffer.length > 0 ? file.buffer : null)
      if (!content) throw new Error('文件内容为空')

      const ext = (() => {
        const raw = path.extname(file.originalname || '').slice(0, 10)
        return raw && raw.length <= 10 ? raw : ''
      })()
      const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext || '.mp3'}`

      const url = await this.storageService.uploadAudio(
        content,
        safeName
      )
      this.logger.log(`[UploadService] 音频上传成功: ${url.substring(0, 60)}`)
      return { url }
    } catch (error) {
      this.logger.error('[UploadService] 音频上传失败:', error)
      throw error
    } finally {
      if (filePath) {
        try {
          await fsPromises.unlink(filePath)
        } catch {
          return
        }
      }
    }
  }
}
