// @ts-nocheck
/**
 * Avatar Agent Service
 * 分身 Agent 推理引擎
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { AvatarMemoryService } from './avatar-memory.service'
import { AvatarLearningService } from './avatar-learning.service'
import { AvatarToolRegistry } from './tools/tool-registry'
import { ToolContext } from './tools/tool.interface'

@Injectable()
export class AvatarAgentService {
  private readonly logger = new Logger(AvatarAgentService.name)
  private llmClient: LLMClient

  constructor(
    @Inject(AvatarMemoryService) private readonly memoryService: AvatarMemoryService,
    @Inject(forwardRef(() => AvatarLearningService))
    private readonly learningService: AvatarLearningService,
    @Inject(AvatarToolRegistry) private readonly toolRegistry: AvatarToolRegistry
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  /**
   * 分身推理核心方法
   */
  async think(
    avatarId: string,
    userMessage: string,
    context?: any
  ): Promise<any> {
    try {
      // 1. 加载分身配置
      const config = await this.loadAvatarConfig(avatarId)

      // 2. 检索相关记忆
      const relevantMemories = await this.memoryService.retrieveRelevantMemories(
        avatarId,
        userMessage,
        10
      )

      // 3. 构建推理上下文
      const reasoningContext = await this.buildReasoningContext(
        avatarId,
        userMessage,
        context,
        relevantMemories,
        config
      )

      // 4. 执行推理
      const thought = await this.executeReasoning(
        avatarId,
        reasoningContext,
        config
      )

      // 5. 存储推理过程
      await this.memoryService.storeThought(avatarId, thought)

      return thought
    } catch (error) {
      this.logger.error('Error in think method:', error)
      return {
        id: `thought-${Date.now()}`,
        avatarId,
        content: '推理过程中发生错误',
        intent: {
          type: 'error',
          confidence: 0
        },
        requiresTool: false,
        createdAt: new Date().toISOString()
      }
    }
  }

  /**
   * 加载分身配置
   */
  private async loadAvatarConfig(avatarId: string): Promise<any> {
    try {
      const db = getMySQLClient()

      // 查询分身配置
      const agentConfig = await db.queryOne('avatar_agent_configs', { avatar_id: avatarId })

      // 查询分身属性
      const avatar = await db.queryOne('avatars', { id: avatarId })

      if (!agentConfig?.data) {
        return this.getDefaultConfig(avatarId, avatar?.data)
      }

      return {
        id: agentConfig.data.id,
        avatarId: agentConfig.data.avatar_id,
        name: avatar?.data?.name || '分身',
        personality: avatar?.data?.personality || '友好开朗',
        memoryConfig: agentConfig.data.memory_config ? JSON.parse(agentConfig.data.memory_config) : {},
        toolConfig: agentConfig.data.tool_config ? JSON.parse(agentConfig.data.tool_config) : {}
      }
    } catch (error) {
      this.logger.error('Error loading avatar config:', error)
      return this.getDefaultConfig(avatarId, null)
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(avatarId: string, avatar: any): any {
    return {
      id: `default-${avatarId}`,
      avatarId,
      name: avatar?.name || '分身',
      personality: avatar?.personality || '友好开朗',
      memoryConfig: {
        maxMemories: 100,
        relevanceThreshold: 0.7
      },
      toolConfig: {}
    }
  }

  /**
   * 构建推理上下文
   */
  private async buildReasoningContext(
    avatarId: string,
    userMessage: string,
    context: any,
    relevantMemories: any[],
    config: any
  ): Promise<string> {
    const memoryContext = relevantMemories.length > 0
      ? `\n相关记忆:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`
      : ''

    const historyContext = context?.history
      ? `\n对话历史:\n${context.history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}`
      : ''

    return `
你是${config.name}，一个AI分身。
性格: ${config.personality}
${memoryContext}
${historyContext}
用户: ${userMessage}
`.trim()
  }

  /**
   * 执行推理
   */
  private async executeReasoning(
    avatarId: string,
    reasoningContext: string,
    config: any
  ): Promise<any> {
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个智能AI分身。请分析用户消息并给出回应。' },
        { role: 'user', content: reasoningContext }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      return {
        id: `thought-${Date.now()}`,
        avatarId,
        content: response.content,
        intent: {
          type: 'chat',
          confidence: 0.9
        },
        requiresTool: false,
        createdAt: new Date().toISOString()
      }
    } catch (error) {
      this.logger.error('Error executing reasoning:', error)
      return {
        id: `thought-${Date.now()}`,
        avatarId,
        content: '抱歉，我遇到了一些问题。',
        intent: {
          type: 'error',
          confidence: 0
        },
        requiresTool: false,
        createdAt: new Date().toISOString()
      }
    }
  }

  /**
   * 生成响应
   */
  private async generateResponse(
    avatarId: string,
    thought: any,
    actionResult?: any
  ): Promise<any> {
    let content = thought.content

    if (actionResult?.data) {
      content = `已完成操作: ${JSON.stringify(actionResult.data)}`
    }

    return {
      content,
      metadata: {
        thought,
        confidence: thought.intent.confidence
      }
    }
  }

  /**
   * 对话处理（完整流程）
   */
  async chat(
    avatarId: string,
    userId: string,
    message: string,
    conversationHistory?: any[]
  ): Promise<any> {
    try {
      // 1. 理解意图
      const thought = await this.think(avatarId, message, {
        userId,
        history: conversationHistory
      })

      // 2. 生成响应
      let response: any

      if (thought.requiresTool && thought.intent.toolName) {
        const actionResult = await this.act(avatarId, thought, {
          userId,
          history: conversationHistory
        })
        response = await this.generateResponse(avatarId, thought, actionResult)

        if (actionResult.success) {
          await this.learningService.learnFromResult(avatarId, thought, actionResult)
        }
      } else {
        response = await this.generateResponse(avatarId, thought)

        await this.learningService.learnFromResult(avatarId, thought, {
          success: true,
          toolName: 'none',
          data: { message: response.content }
        })
      }

      // 3. 存储记忆
      await this.memoryService.storeConversation(avatarId, userId, {
        userMessage: message,
        assistantResponse: response.content,
        thought
      })

      // 4. 更新技能熟练度
      await this.learningService.updateSkillLevel(avatarId, thought, response)

      return response
    } catch (error) {
      this.logger.error('Error in chat method:', error)
      return {
        content: '抱歉，我遇到了一些问题，请稍后再试。',
        metadata: {
          thought: {
            id: 'error',
            avatarId,
            content: '',
            intent: { type: 'error', confidence: 0 },
            requiresTool: false,
            createdAt: new Date().toISOString()
          },
          confidence: 0
        }
      }
    }
  }

  /**
   * 执行动作
   */
  async act(
    avatarId: string,
    thought: any,
    context?: any
  ): Promise<any> {
    try {
      if (!thought.requiresTool || !thought.intent.toolName) {
        return {
          success: true,
          toolName: 'none',
          data: { message: '无需执行工具' }
        }
      }

      const toolName = thought.intent.toolName
      const params = thought.intent.params || {}

      this.logger.log(`Executing tool ${toolName} for avatar ${avatarId}`)

      // TODO: 实现工具执行逻辑
      return {
        success: true,
        toolName,
        data: { message: '工具执行成功' }
      }
    } catch (error) {
      this.logger.error('Error in act method:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}
