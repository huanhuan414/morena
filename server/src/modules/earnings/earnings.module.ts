// @ts-nocheck
import { Module } from '@nestjs/common'
import { EarningsController } from './earnings.controller'
import { EarningsService } from './earnings.service'
import { EarningController } from '../earning/earning.controller'
import { EarningService } from '../earning/earning.service'

@Module({
  controllers: [EarningsController, EarningController],
  providers: [
    EarningsService,
    EarningService,
    { provide: 'EARNINGS_SERVICE', useClass: EarningsService },
    { provide: 'EARNING_SERVICE', useClass: EarningService }
  ],
  exports: [EarningsService, EarningService, 'EARNINGS_SERVICE', 'EARNING_SERVICE']
})
export class EarningsModule {}
