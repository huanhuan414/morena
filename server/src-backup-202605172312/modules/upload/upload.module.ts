import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { UploadController } from './upload.controller'
import { UploadService } from './upload.service'
import { VolcengineService } from './volcengine.service'
import { StorageModule } from '../storage/storage.module'
import * as multer from 'multer'

@Module({
  imports: [
    StorageModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB（支持视频上传）
      },
      fileFilter: (req, file, callback) => {
        // 🔴 修复：根据MIME类型判断文件格式，不依赖文件扩展名
        // 允许图片、视频和音频
        const allowedMimes = [
          // 图片
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          // 视频
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
          'video/x-ms-wmv',
          // 音频
          'audio/mpeg',
          'audio/wav',
          'audio/wave',
          'audio/ogg',
          'audio/x-wav',
          'audio/webm',
          // 🔴 添加：允许application/octet-stream类型（某些情况下会被误判）
          'application/octet-stream'
        ]
        console.log(`[MulterFileFilter] 检查文件: ${file.originalname}, MIME: ${file.mimetype}`)
        if (allowedMimes.includes(file.mimetype)) {
          // 🔴 修复：如果文件名不包含扩展名，根据MIME类型添加扩展名
          if (!file.originalname || !file.originalname.includes('.')) {
            const mimeToExt: Record<string, string> = {
              'image/jpeg': 'jpg',
              'image/jpg': 'jpg',
              'image/png': 'png',
              'image/gif': 'gif',
              'image/webp': 'webp',
              'image/bmp': 'bmp',
              'video/mp4': 'mp4',
              'video/mpeg': 'mpeg',
              'video/quicktime': 'mov',
              'video/x-msvideo': 'avi',
              'video/x-ms-wmv': 'wmv',
              'audio/mpeg': 'mp3',
              'audio/wav': 'wav',
              'audio/wave': 'wav',
              'audio/ogg': 'ogg',
              'audio/x-wav': 'wav',
              'audio/webm': 'webm',
            }
            const ext = mimeToExt[file.mimetype] || 'png';
            file.originalname = `image_${Date.now()}.${ext}`;
            console.log(`[MulterFileFilter] 修正文件名: ${file.originalname}`)
          }
          callback(null, true)
        } else {
          console.log(`[MulterFileFilter] 不支持的MIME类型: ${file.mimetype}`)
          callback(new Error('只支持图片、视频和音频格式（jpg, png, gif, webp, mp4, mov, avi, mp3, wav, ogg）'), false)
        }
      }
    })
  ],
  controllers: [UploadController],
  providers: [UploadService, VolcengineService],
  exports: [UploadService]
})
export class UploadModule {}
