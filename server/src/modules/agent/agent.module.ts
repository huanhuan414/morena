import { Module } from '@nestjs/common'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { AgentGateway } from './agent.gateway'
import { ProgressCacheService } from './progress-cache.service'

@Module({
  controllers: [AgentController],
  providers: [AgentService, AgentGateway, ProgressCacheService],
  exports: [AgentService, AgentGateway, ProgressCacheService]
})
export class AgentModule {}
