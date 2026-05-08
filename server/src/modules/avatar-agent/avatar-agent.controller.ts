// @ts-nocheck
/**
 * Avatar Agent Controller
 * 分身 Agent API 接口
 */

import { Controller, Get, Post, Put, Body, Param, Headers, Query } from '@nestjs/common'
import { AvatarAgentService } from './avatar-agent.service'
import { AvatarMemoryService } from './avatar-memory.service'
import { AvatarLearningService } from './avatar-learning.service'
import { ConversationMessage } from './avatar-agent.types'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Controller('avatar-agent')
export class AvatarAgentController {
  constructor(
    private readonly agentService: AvatarAgentService,
    private readonly memoryService: AvatarMemoryService,
    private readonly learningService: AvatarLearningService
  ) {}

  /**
   * 对话接口
   */
  @Post(':avatarId/chat')
  async chat(
    @Param('avatarId') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: {
      message: string
      conversationHistory?: ConversationMessage[]
    }
  ) {
    try {
      const response = await this.agentService.chat(
        avatarId,
        userId,
        body.message,
        body.conversationHistory
      )

      return {
        code: 200,
        data: response,
        message: '成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '对话失败'
      }
    }
  }

  /**
   * 推理接口
   */
  @Post(':avatarId/think')
  async think(
    @Param('avatarId') avatarId: string,
    @Body() body: {
      message: string
      userId: string
      conversationId?: string
      conversationHistory?: ConversationMessage[]
    }
  ) {
    try {
      const thought = await this.agentService.think(avatarId, body.message, {
        userId: body.userId,
        conversationId: body.conversationId,
        history: body.conversationHistory
      })

      return {
        code: 200,
        data: thought,
        message: '推理成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '推理失败'
      }
    }
  }

  /**
   * 获取分身配置
   */
  @Get(':avatarId/config')
  async getConfig(@Param('avatarId') avatarId: string) {
    try {
      const config = await this.agentService['loadAvatarConfig'](avatarId)

      return {
        code: 200,
        data: config,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取配置失败'
      }
    }
  }

  /**
   * 更新分身配置
   */
  @Put(':avatarId/config')
  async updateConfig(
    @Param('avatarId') avatarId: string,
    @Body() body: {
      systemPrompt?: string
      rolePrompt?: string
      temperature?: number
      maxTokens?: number
      enabledTools?: string[]
      reasoningMode?: 'react' | 'chain_of_thought' | 'few_shot'
      learningEnabled?: boolean
      memoryConfig?: any
    }
  ) {
    try {
      await this.agentService.updateAvatarConfig(avatarId, body)

      return {
        code: 200,
        data: null,
        message: '配置更新成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '配置更新失败'
      }
    }
  }

  /**
   * 初始化分身配置
   */
  @Post(':avatarId/initialize')
  async initializeConfig(
    @Param('avatarId') avatarId: string,
    @Body() body: {
      systemPrompt?: string
      rolePrompt?: string
      personality?: string
    }
  ) {
    try {
      await this.agentService.initializeAvatarConfig(avatarId, body)

      return {
        code: 200,
        data: null,
        message: '配置初始化成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '配置初始化失败'
      }
    }
  }

  /**
   * 获取记忆
   */
  @Get(':avatarId/memories')
  async getMemories(
    @Param('avatarId') avatarId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string
  ) {
    try {
      const memories = await this.memoryService.retrieveRelevantMemories(
        avatarId,
        '',
        {
          maxRetrieval: limit ? parseInt(limit) : 10,
          allowedTypes: type ? [type] : undefined
        }
      )

      return {
        code: 200,
        data: {
          memories,
          count: memories.length
        },
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取记忆失败'
      }
    }
  }

  /**
   * 获取用户偏好
   */
  @Get(':avatarId/preferences/:userId')
  async getUserPreferences(
    @Param('avatarId') avatarId: string,
    @Param('userId') userId: string
  ) {
    try {
      const preferences = await this.memoryService.getUserPreferences(
        avatarId,
        userId
      )

      return {
        code: 200,
        data: preferences,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取用户偏好失败'
      }
    }
  }

  /**
   * 获取分身经验
   */
  @Get(':avatarId/experiences')
  async getExperiences(
    @Param('avatarId') avatarId: string,
    @Query('taskType') taskType?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const experiences = await this.memoryService.getAvatarExperiences(
        avatarId,
        {
          taskType,
          limit: limit ? parseInt(limit) : 10
        }
      )

      return {
        code: 200,
        data: experiences,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取经验失败'
      }
    }
  }

  /**
   * 记录反馈
   */
  @Post(':avatarId/feedback')
  async recordFeedback(
    @Param('avatarId') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: {
      messageId: string
      feedbackScore: number
      feedbackText?: string
    }
  ) {
    try {
      await this.learningService.recordFeedback(
        avatarId,
        userId,
        body.messageId,
        body.feedbackScore,
        body.feedbackText
      )

      return {
        code: 200,
        data: null,
        message: '反馈记录成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '反馈记录失败'
      }
    }
  }

  /**
   * 获取学习统计
   */
  @Get(':avatarId/learning-stats')
  async getLearningStats(@Param('avatarId') avatarId: string) {
    try {
      const stats = await this.learningService.getLearningStats(avatarId)

      return {
        code: 200,
        data: stats,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取学习统计失败'
      }
    }
  }

  /**
   * 获取分身能力概览
   */
  @Get(':avatarId/capabilities')
  async getCapabilities(@Param('avatarId') avatarId: string) {
    try {
      // 获取记忆统计
      const memories = await this.memoryService.retrieveRelevantMemories(
        avatarId,
        '',
        { maxRetrieval: 50 }
      )

      const memoryByType = memories.reduce((acc: any, m: any) => {
        acc[m.type] = (acc[m.type] || 0) + 1
        return acc
      }, {})

      // 获取技能
      const skillsResult = await getMySQLClient().query('avatar_skills', undefined, {
        conditions: { avatar_id: avatarId },
        orderBy: 'skill_level',
        ascending: false,
        limit: 10
      })
      const skills = (skillsResult as any)?.data || []

      // 获取学习统计
      const learningStats = await this.learningService.getLearningStats(avatarId)

      // 获取最近的思考过程（从 avatar_memories 表中查询 memory_type = 'learning' 的记录）
      const memoriesResult = await getMySQLClient().query('avatar_memories', undefined, {
        columns: 'id, content, metadata, created_at',
        conditions: { avatar_id: avatarId, memory_type: 'learning' },
        orderBy: 'created_at',
        ascending: false,
        limit: 5
      })
      const recentThoughts = (memoriesResult as any)?.data || []

      // 格式化思考过程
      const formattedThoughts = recentThoughts?.map((thought: any) => ({
        id: thought.id,
        action: thought.content || '思考中...',
        intent: thought.metadata?.intent?.type || 'unknown',
        createdAt: thought.created_at
      })) || []

      return {
        code: 200,
        data: {
          memory: {
            total: memories.length,
            byType: memoryByType,
            recentMemories: memories.slice(0, 5)
          },
          skills: skills || [],
          learning: learningStats,
          thoughts: formattedThoughts
        },
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取能力概览失败'
      }
    }
  }

  /**
   * 知识蒸馏
   */
  @Post(':avatarId/distill/:sourceAvatarId')
  async knowledgeDistillation(
    @Param('avatarId') avatarId: string,
    @Param('sourceAvatarId') sourceAvatarId: string
  ) {
    try {
      await this.learningService.knowledgeDistillation(sourceAvatarId, avatarId)

      return {
        code: 200,
        data: null,
        message: '知识蒸馏成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '知识蒸馏失败'
      }
    }
  }

  /**
   * 个性化学习
   */
  @Post(':avatarId/personalize/:userId')
  async personalize(
    @Param('avatarId') avatarId: string,
    @Param('userId') userId: string,
    @Body() body: {
      interactions: any[]
    }
  ) {
    try {
      await this.learningService.personalize(avatarId, userId, body.interactions)

      return {
        code: 200,
        data: null,
        message: '个性化学习成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '个性化学习失败'
      }
    }
  }
}
