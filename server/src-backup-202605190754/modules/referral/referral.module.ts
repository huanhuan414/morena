// @ts-nocheck
import { Module } from '@nestjs/common'
import { ReferralController } from './referral.controller'
import { ReferralService } from './referral.service'
import { EarningModule } from '../earning/earning.module'

@Module({
  imports: [EarningModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService]
})
export class ReferralModule {}
