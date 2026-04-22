import { Module, forwardRef } from '@nestjs/common'
import { OrderDispatchController } from './order-dispatch.controller'
import { OrderDispatchService } from './order-dispatch.service'
import { NotificationModule } from '../notification/notification.module'
import { SubscriptionModule } from '../subscription/subscription.module'
import { SmsModule } from '../sms/sms.module'
import { ContentGenerationModule } from '../content-generation/content-generation.module'
import { OrderProcessingModule } from '../order-processing/order-processing.module'

@Module({
  imports: [
    forwardRef(() => NotificationModule),
    forwardRef(() => SubscriptionModule),
    SmsModule,
    ContentGenerationModule,
    OrderProcessingModule
  ],
  controllers: [OrderDispatchController],
  providers: [OrderDispatchService],
  exports: [OrderDispatchService]
})
export class OrderDispatchModule {}
