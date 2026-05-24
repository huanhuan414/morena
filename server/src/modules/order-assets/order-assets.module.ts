import { Module } from '@nestjs/common'
import { OrderAssetsController } from './order-assets.controller'
import { OrderAssetsService } from './order-assets.service'
import { UploadModule } from '../upload/upload.module'

@Module({
  imports: [UploadModule],
  controllers: [OrderAssetsController],
  providers: [OrderAssetsService],
  exports: [OrderAssetsService],
})
export class OrderAssetsModule {}
