import { Module, forwardRef } from '@nestjs/common'
import { OrderAssetsController } from './order-assets.controller'
import { OrderAssetsService } from './order-assets.service'
import { UploadModule } from '../upload/upload.module'
import { ContentGenerationModule } from '../content-generation/content-generation.module'

@Module({
  imports: [UploadModule, forwardRef(() => ContentGenerationModule)],
  controllers: [OrderAssetsController],
  providers: [OrderAssetsService],
  exports: [OrderAssetsService],
})
export class OrderAssetsModule {}
