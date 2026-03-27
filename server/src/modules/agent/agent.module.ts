import { Module } from '@nestjs/common'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { ToolsRegistry } from './tools.registry'
import { SearchTool } from './tools/search.tool'
import { SendMessageTool } from './tools/send-message.tool'
import { CreateDocumentTool } from './tools/create-document.tool'
import { QueryDataTool } from './tools/query-data.tool'

@Module({
  controllers: [AgentController],
  providers: [
    AgentService,
    ToolsRegistry,
    SearchTool,
    SendMessageTool,
    CreateDocumentTool,
    QueryDataTool
  ],
  exports: [AgentService]
})
export class AgentModule {}
