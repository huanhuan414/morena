// @ts-nocheck
import { Module } from '@nestjs/common'
import { EarningController } from '../earning/earning.controller'
import { EarningService } from '../earning/earning.service'

@Module({
  controllers: [EarningController],
  providers: [
    EarningService,
    { provide: 'EARNING_SERVICE', useClass: EarningService }
  ],
  exports: [EarningService, 'EARNING_SERVICE']
})
export class EarningsModule {}
