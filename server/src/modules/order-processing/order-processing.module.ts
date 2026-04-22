import { Module } from '@nestjs/common'
import { OrderProcessingController } from './order-processing.controller'
import { OrderProcessingService } from './order-processing.service'
import { LinkValidationService } from './link-validation.service'
import { ContentGenerationModule } from '../content-generation/content-generation.module'
import { AvatarAgentModule } from '../avatar-agent/avatar-agent.module'
import { TikHubModule } from '../tikhub/tikhub.module'

@Module({
  imports: [ContentGenerationModule, AvatarAgentModule, TikHubModule],
  controllers: [OrderProcessingController],
  providers: [OrderProcessingService, LinkValidationService],
  exports: [OrderProcessingService]
})
export class OrderProcessingModule {}
