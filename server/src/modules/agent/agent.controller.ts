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
import { ProgressCacheService } from './progress-cache.service'

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly progressCache: ProgressCacheService
  ) {}

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
   * 获取任务进度
   */
  @Get('progress')
  async getProgress(
    @Headers('x-user-id') userId: string,
    @Query('taskId') taskId?: string
  ) {
    const progress = this.progressCache.getProgress(userId, taskId)
    const latestProgress = this.progressCache.getLatestProgress(userId, taskId)
    
    return {
      code: 200,
      data: {
        progress,
        latest: latestProgress,
        count: progress.length
      },
      message: '获取成功'
    }
  }

  /**
   * 获取任务结果
   */
  @Get('result/:taskId')
  async getTaskResult(
    @Headers('x-user-id') userId: string,
    @Param('taskId') taskId: string
  ) {
    const result = this.progressCache.getTaskResult(userId, taskId)
    
    if (!result) {
      return {
        code: 404,
        data: null,
        message: '任务不存在或已过期'
      }
    }
    
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 执行 Agent 任务（异步模式，立即返回 taskId）
   * 解决 HTTP 请求超时问题
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
    // 生成任务ID
    const taskId = body.task_id || `task-${Date.now()}`
    
    // 创建任务记录
    this.progressCache.createTask(userId, taskId)
    
    // 异步执行任务（不等待结果）
    this.agentService.executeTaskAsync(
      userId,
      body.avatar_id,
      body.task_description,
      {
        conversationId: body.conversation_id,
        taskId,
        conversationHistory: body.conversation_history as any
      }
    ).catch(err => {
      console.error(`[AgentController] 任务执行失败: ${taskId}`, err)
      this.progressCache.updateTaskStatus(userId, taskId, 'failed', null, err.message)
    })
    
    // 立即返回 taskId
    return {
      code: 200,
      data: {
        taskId,
        status: 'pending'
      },
      message: '任务已提交，请通过轮询获取进度和结果'
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

  /**
   * 发布内容到平台
   * 统一的发布接口，支持多平台
   */
  @Post('publish/:platform')
  async publishContent(
    @Headers('x-user-id') userId: string,
    @Param('platform') platform: PlatformType,
    @Body() body: {
      title?: string
      content?: string
      cover_url?: string
      images?: string[]
      tags?: string[]
    }
  ) {
    const result = await this.agentService.publishContent(userId, platform, body)
    
    return {
      code: result.success ? 200 : 400,
      data: result.data,
      message: result.message || (result.success ? '发布成功' : '发布失败')
    }
  }
}
