/**
 * Agent 控制器
 * 提供 Agent 相关的 API 接口
 */

import { Controller, Get, Post, Delete, Body, Param, Headers, Query, Sse, Req } from '@nestjs/common'
import { Request } from 'express'
import { Observable, from, of } from 'rxjs'
import { map, catchError } from 'rxjs/operators'
import { AgentService } from './agent.service'
import { PlatformType } from './agent.types'

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * 获取所有可用工具
   */
  @Get('tools')
  async getTools() {
    const tools = this.agentService.getAvailableTools()
    return {
      code: 200,
      data: tools,
      message: '获取成功'
    }
  }

  /**
   * 执行 Agent 任务（SSE 流式输出）
   */
  @Sse('execute/stream')
  executeTaskStream(
    @Req() req: Request,
    @Headers('x-user-id') userId: string
  ): Observable<MessageEvent> {
    // 从 query 参数获取数据
    const body = req.query as any
    
    return from(this.agentService.executeTaskWithProgress(
      userId,
      body.avatar_id,
      body.task_description,
      {
        conversationId: body.conversation_id,
        taskId: body.task_id
      }
    )).pipe(
      map((event) => ({
        data: JSON.stringify(event)
      } as MessageEvent)),
      catchError((err) => {
        return of({
          data: JSON.stringify({
            type: 'error',
            error: err.message
          })
        } as MessageEvent)
      })
    )
  }

  /**
   * 执行 Agent 任务（普通接口，兼容旧版本）
   */
  @Post('execute')
  async executeTask(
    @Headers('x-user-id') userId: string,
    @Body() body: {
      avatar_id: string
      task_description: string
      conversation_id?: string
      task_id?: string
      conversation_history?: Array<{ role: string; content: string }>
    }
  ) {
    const result = await this.agentService.executeTask(
      userId,
      body.avatar_id,
      body.task_description,
      {
        conversationId: body.conversation_id,
        taskId: body.task_id,
        conversationHistory: body.conversation_history as any
      }
    )

    return {
      code: 200,
      data: result,
      message: result.requiresConfig ? '需要配置平台' : '执行完成'
    }
  }

  /**
   * 检查平台配置状态
   */
  @Get('platform-config/:platform')
  async checkPlatformConfig(
    @Headers('x-user-id') userId: string,
    @Param('platform') platform: PlatformType
  ) {
    const result = await this.agentService.checkPlatformConfig(userId, platform)
    
    return {
      code: 200,
      data: result,
      message: '查询成功'
    }
  }

  /**
   * 获取用户的所有平台配置
   */
  @Get('platform-configs')
  async getUserPlatformConfigs(@Headers('x-user-id') userId: string) {
    const configs = await this.agentService.getUserPlatformConfigs(userId)
    
    // 隐藏敏感信息
    const safeConfigs = configs.map(config => ({
      ...config,
      config_data: Object.keys(config.config_data).reduce((acc, key) => {
        acc[key] = '******'
        return acc
      }, {} as Record<string, string>)
    }))

    return {
      code: 200,
      data: safeConfigs,
      message: '获取成功'
    }
  }

  /**
   * 保存平台配置
   */
  @Post('platform-config/:platform')
  async savePlatformConfig(
    @Headers('x-user-id') userId: string,
    @Param('platform') platform: PlatformType,
    @Body() configData: Record<string, any>
  ) {
    const result = await this.agentService.savePlatformConfig(userId, platform, configData)
    
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 删除平台配置
   */
  @Delete('platform-config/:platform')
  async deletePlatformConfig(
    @Headers('x-user-id') userId: string,
    @Param('platform') platform: PlatformType
  ) {
    await this.agentService.deletePlatformConfig(userId, platform)
    
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }

  /**
   * 获取分身技能列表
   */
  @Get('skills/:avatarId')
  async getAvatarSkills(@Param('avatarId') avatarId: string) {
    const skills = await this.agentService.getAvatarSkills(avatarId)
    
    return {
      code: 200,
      data: skills,
      message: '获取成功'
    }
  }

  /**
   * 为分身添加技能
   */
  @Post('skills/:avatarId')
  async addAvatarSkill(
    @Param('avatarId') avatarId: string,
    @Body() body: { skill_type: string; metadata?: Record<string, any> }
  ) {
    const result = await this.agentService.addAvatarSkill(
      avatarId,
      body.skill_type,
      body.metadata
    )
    
    return {
      code: 200,
      data: null,
      message: '技能添加成功'
    }
  }
}
