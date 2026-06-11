import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { WechatPayService } from './wechat-pay.service';
import { OrderModule } from '../order/order.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [forwardRef(() => OrderModule), forwardRef(() => ReferralModule)],
  controllers: [PaymentController],
  providers: [WechatPayService],
  exports: [WechatPayService],
})
export class PaymentModule {}
