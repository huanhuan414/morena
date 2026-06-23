// @ts-nocheck
import { Module, forwardRef } from '@nestjs/common'
import { OrderProcessingController } from './order-processing.controller'
import { OrderProcessingService } from './order-processing.service'
import { LinkValidationService } from './link-validation.service'
import { ContentGenerationModule } from '../content-generation/content-generation.module'
import { AvatarAgentModule } from '../avatar-agent/avatar-agent.module'
import { TikHubModule } from '../tikhub/tikhub.module'
import { OrderModule } from '../order/order.module'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [ContentGenerationModule, AvatarAgentModule, TikHubModule, forwardRef(() => OrderModule), NotificationModule],
  controllers: [OrderProcessingController],
  providers: [OrderProcessingService, LinkValidationService],
  exports: [OrderProcessingService]
})
export class OrderProcessingModule {}
