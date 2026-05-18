import { Module, forwardRef } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { ContentGenerationController } from './content-generation.controller'
import { AvatarAgentModule } from '../avatar-agent/avatar-agent.module'
import { OrderModule } from '../order/order.module'
import { VolcengineService } from '../upload/volcengine.service'
import { StorageService } from '../storage/storage.service'

@Module({
  imports: [AvatarAgentModule, forwardRef(() => OrderModule)],
  controllers: [ContentGenerationController],
  providers: [ContentGenerationService, VolcengineService, StorageService],
  exports: [ContentGenerationService]
})
export class ContentGenerationModule {}
