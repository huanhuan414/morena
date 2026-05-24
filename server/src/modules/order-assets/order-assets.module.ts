import { Module } from '@nestjs/common'
import { OrderAssetsController } from './order-assets.controller'
import { OrderAssetsService } from './order-assets.service'

@Module({
  imports: [],
  controllers: [OrderAssetsController],
  providers: [OrderAssetsService],
  exports: [OrderAssetsService],
})
export class OrderAssetsModule {}
