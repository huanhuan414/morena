// @ts-nocheck
import { Module } from '@nestjs/common'
import { OrderResultsController } from './order-results.controller'
import { OrderResultsService } from './order-results.service'

@Module({
  controllers: [OrderResultsController],
  providers: [
    OrderResultsService,
    { provide: 'ORDER_RESULTS_SERVICE', useClass: OrderResultsService }
  ],
  exports: [OrderResultsService, 'ORDER_RESULTS_SERVICE']
})
export class OrderResultsModule {}
