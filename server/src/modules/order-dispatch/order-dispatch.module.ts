import { Module, forwardRef } from '@nestjs/common'
import { OrderDispatchController } from './order-dispatch.controller'
import { OrderDispatchService } from './order-dispatch.service'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [forwardRef(() => NotificationModule)],
  controllers: [OrderDispatchController],
  providers: [OrderDispatchService],
  exports: [OrderDispatchService]
})
export class OrderDispatchModule {}
