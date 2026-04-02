import { Module } from '@nestjs/common'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { AgentGateway } from './agent.gateway'

@Module({
  controllers: [AgentController],
  providers: [AgentService, AgentGateway],
  exports: [AgentService, AgentGateway]
})
export class AgentModule {}
