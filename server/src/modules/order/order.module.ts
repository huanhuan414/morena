import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderDispatchModule } from '../order-dispatch/order-dispatch.module';

@Module({
  imports: [OrderDispatchModule],
  controllers: [OrderController],
  providers: [OrderService]
})
export class OrderModule {}
