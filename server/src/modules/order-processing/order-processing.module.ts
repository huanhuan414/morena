import { Module } from '@nestjs/common'
import { OrderProcessingController } from './order-processing.controller'
import { OrderProcessingService } from './order-processing.service'
import { ContentGenerationModule } from '../content-generation/content-generation.module'
import { AvatarAgentModule } from '../avatar-agent/avatar-agent.module'

@Module({
  imports: [ContentGenerationModule, AvatarAgentModule],
  controllers: [OrderProcessingController],
  providers: [OrderProcessingService],
  exports: [OrderProcessingService]
})
export class OrderProcessingModule {}
