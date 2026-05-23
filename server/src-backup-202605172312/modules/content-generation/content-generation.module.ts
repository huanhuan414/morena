import { Module, forwardRef } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { ContentGenerationController } from './content-generation.controller'
import { AvatarAgentModule } from '../avatar-agent/avatar-agent.module'
import { OrderModule } from '../order/order.module'

@Module({
  imports: [AvatarAgentModule, forwardRef(() => OrderModule)],
  controllers: [ContentGenerationController],
  providers: [ContentGenerationService],
  exports: [ContentGenerationService]
})
export class ContentGenerationModule {}
