// @ts-nocheck
import { Module, forwardRef } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderDispatchModule } from '../order-dispatch/order-dispatch.module';
import { EarningModule } from '../earning/earning.module';
import { NotificationModule } from '../notification/notification.module';
import { OrderProcessingModule } from '../order-processing/order-processing.module';
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service';
import { PaymentModule } from '../payment/payment.module';
import { ContentGenerationModule } from '../content-generation/content-generation.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule, OrderDispatchModule, EarningModule, NotificationModule, forwardRef(() => OrderProcessingModule), forwardRef(() => PaymentModule), forwardRef(() => ContentGenerationModule)],
  controllers: [OrderController],
  providers: [
    OrderService,
    ReverseGeocodingService,
    { provide: 'ORDER_SERVICE', useClass: OrderService },
  ],
  exports: [OrderService, 'ORDER_SERVICE']
})
export class OrderModule {}