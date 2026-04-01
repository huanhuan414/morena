import { Module } from '@nestjs/common'
import { OrderDispatchController } from './order-dispatch.controller'
import { OrderDispatchService } from './order-dispatch.service'

@Module({
  controllers: [OrderDispatchController],
  providers: [OrderDispatchService],
  exports: [OrderDispatchService]
})
export class OrderDispatchModule {}
