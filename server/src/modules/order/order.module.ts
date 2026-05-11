// @ts-nocheck
import { Module, forwardRef } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderDispatchModule } from '../order-dispatch/order-dispatch.module';
import { EarningModule } from '../earning/earning.module';
import { NotificationModule } from '../notification/notification.module';
import { OrderProcessingModule } from '../order-processing/order-processing.module';
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service';

@Module({
  imports: [OrderDispatchModule, EarningModule, NotificationModule, forwardRef(() => OrderProcessingModule)],
  controllers: [OrderController],
  providers: [
    OrderService,
    ReverseGeocodingService,
    { provide: 'ORDER_SERVICE', useClass: OrderService },
  ],
  exports: [OrderService]
})
export class OrderModule {}