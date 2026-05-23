// @ts-nocheck
import { Module } from '@nestjs/common'
import { EarningController } from './earning.controller'
import { EarningService } from './earning.service'
import { EarningsModule } from '../earnings/earnings.module'

@Module({
  imports: [EarningsModule],
  controllers: [EarningController],
  providers: [EarningService],
  exports: [EarningService]
})
export class EarningModule {}
