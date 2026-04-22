import { Module, forwardRef } from '@nestjs/common'
import { OrderProcessingController } from './order-processing.controller'
import { OrderProcessingService } from './order-processing.service'
import { ContentGenerationModule } from '../content-generation/content-generation.module'

@Module({
  imports: [forwardRef(() => ContentGenerationModule)],
  controllers: [OrderProcessingController],
  providers: [OrderProcessingService],
  exports: [OrderProcessingService]
})
export class OrderProcessingModule {}
