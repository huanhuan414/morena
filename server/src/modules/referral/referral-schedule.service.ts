import { Injectable, Logger } from '@nestjs/common'

/**
 * 邀请裂变活动定时任务服务
 *
 * 注意：返佣记录永久保留，不需要清理过期数据
 */
@Injectable()
export class ReferralScheduleService {
  private readonly logger = new Logger(ReferralScheduleService.name)
}