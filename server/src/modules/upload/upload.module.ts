import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { UploadController } from './upload.controller'
import { UploadService } from './upload.service'
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
          'audio/webm'
        ]
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true)
        } else {
          callback(new Error('只支持图片、视频和音频格式（jpg, png, gif, webp, mp4, mov, avi, mp3, wav, ogg）'), false)
        }
      }
    })
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService]
})
export class UploadModule {}
