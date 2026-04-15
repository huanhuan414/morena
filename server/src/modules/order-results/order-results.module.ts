import { Module } from '@nestjs/common'
import { OrderResultsController } from './order-results.controller'
import { OrderResultsService } from './order-results.service'

@Module({
  controllers: [OrderResultsController],
  providers: [OrderResultsService],
  exports: [OrderResultsService]
})
export class OrderResultsModule {}
