import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderDispatchModule } from '../order-dispatch/order-dispatch.module';
import { EarningModule } from '../earning/earning.module';
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service';

@Module({
  imports: [OrderDispatchModule, EarningModule],
  controllers: [OrderController],
  providers: [OrderService, ReverseGeocodingService]
})
export class OrderModule {}
