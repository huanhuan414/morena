import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { WechatPayService } from './wechat-pay.service';

@Module({
  controllers: [PaymentController],
  providers: [WechatPayService],
  exports: [WechatPayService],
})
export class PaymentModule {}
