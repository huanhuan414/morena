import { Controller, Post, Body, Headers, Param, Get, Req } from '@nestjs/common'
import { AgentService } from './agent.service'
import { ToolsRegistry } from './tools.registry'

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolsRegistry: ToolsRegistry
  ) {}

  /**
   * 执行任务
   */
  @Post('execute/:taskId')
  async executeTask(
    @Param('taskId') taskId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { avatar_id: string; conversation_id: string; description: string },
    @Req() req: any
  ) {
    const headers = req.headers
    
    const result = await this.agentService.executeTask(
      taskId,
      userId,
      body.avatar_id,
      body.conversation_id,
      body.description,
      headers
    )
    
    return {
      code: 200,
      data: result,
      message: result.success ? '任务执行完成' : '任务执行失败'
    }
  }

  /**
   * 获取可用工具列表
   */
  @Get('tools')
  async getTools() {
    const tools = this.toolsRegistry.getToolsDefinition()
    
    return {
      code: 200,
      data: tools,
      message: '获取成功'
    }
  }
}
