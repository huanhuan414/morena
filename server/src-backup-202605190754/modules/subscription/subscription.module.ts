import { Module } from '@nestjs/common'
import { SubscriptionController } from './subscription.controller'
import { SubscriptionService } from './subscription.service'
import { WechatPayService } from '../payment/wechat-pay.service'
import { PaymentModule } from '../payment/payment.module'

@Module({
  imports: [PaymentModule],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
