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
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        // 只允许图片
        const allowedMimes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp'
        ]
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true)
        } else {
          callback(new Error('只支持图片格式（jpg, png, gif, webp）'), false)
        }
      }
    })
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService]
})
export class UploadModule {}
