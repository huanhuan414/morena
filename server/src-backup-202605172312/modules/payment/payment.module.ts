import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { WechatPayService } from './wechat-pay.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [forwardRef(() => OrderModule)],
  controllers: [PaymentController],
  providers: [WechatPayService],
  exports: [WechatPayService],
})
export class PaymentModule {}
