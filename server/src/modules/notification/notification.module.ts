// @ts-nocheck
import { Module } from '@nestjs/common'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'
import { WechatSubscribeMessageService } from './wechat-subscribe-message.service'

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, WechatSubscribeMessageService],
  exports: [NotificationService, WechatSubscribeMessageService]
})
export class NotificationModule {}
