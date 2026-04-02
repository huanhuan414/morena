import { Module } from '@nestjs/common'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { AgentGateway } from './agent.gateway'
import { ProgressCacheService } from './progress-cache.service'
import { AvatarModule } from '../avatar/avatar.module'

@Module({
  imports: [AvatarModule],
  controllers: [AgentController],
  providers: [AgentService, AgentGateway, ProgressCacheService],
  exports: [AgentService, AgentGateway, ProgressCacheService]
})
export class AgentModule {}
