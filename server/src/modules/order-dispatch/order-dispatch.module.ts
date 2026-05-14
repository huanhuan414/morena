// @ts-nocheck
import { OrderTimeoutService } from './order-timeout.service'
import { OrderEventService } from './order-event.service'
import { Module, forwardRef } from '@nestjs/common'
import { OrderDispatchController } from './order-dispatch.controller'
import { OrderDispatchService } from './order-dispatch.service'
import { NotificationModule } from '../notification/notification.module'
import { SubscriptionModule } from '../subscription/subscription.module'
import { SmsModule } from '../sms/sms.module'
import { ContentGenerationModule } from '../content-generation/content-generation.module'
import { OrderProcessingModule } from '../order-processing/order-processing.module'
import { OrderModule } from '../order/order.module'

@Module({
  imports: [
    forwardRef(() => NotificationModule),
    forwardRef(() => SubscriptionModule),
    SmsModule,
    ContentGenerationModule,
    OrderProcessingModule,
    forwardRef(() => OrderModule)
  ],
  controllers: [OrderDispatchController],
  providers: [
    OrderDispatchService,
    OrderTimeoutService,
    OrderEventService,
    { provide: 'ORDER_DISPATCH_SERVICE', useClass: OrderDispatchService }
  ],
  exports: [OrderDispatchService, OrderEventService, 'ORDER_DISPATCH_SERVICE']
})
export class OrderDispatchModule {}
