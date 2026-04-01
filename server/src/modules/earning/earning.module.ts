import { Module } from '@nestjs/common'
import { EarningController } from './earning.controller'
import { EarningService } from './earning.service'

@Module({
  controllers: [EarningController],
  providers: [EarningService],
  exports: [EarningService]
})
export class EarningModule {}
