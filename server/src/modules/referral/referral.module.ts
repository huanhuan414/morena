// @ts-nocheck
import { Module, OnModuleInit } from '@nestjs/common'
import { ReferralController } from './referral.controller'
import { ReferralService } from './referral.service'
import { ReferralMigrationService } from './referral-migration.service'
import { ReferralScheduleService } from './referral-schedule.service'
import { EarningModule } from '../earning/earning.module'
import { UploadModule } from '../upload/upload.module'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [EarningModule, UploadModule, NotificationModule],
  controllers: [ReferralController],
  providers: [ReferralService, ReferralMigrationService, ReferralScheduleService],
  exports: [ReferralService]
})
export class ReferralModule implements OnModuleInit {
  constructor(private readonly migrationService: ReferralMigrationService) {}

  async onModuleInit() {
    try {
      await this.migrationService.initReferralTables()
      console.log('[ReferralModule] 邀请裂变活动表结构初始化成功')
    } catch (error) {
      console.error('[ReferralModule] 邀请裂变活动表结构初始化失败:', error)
    }
  }
}
