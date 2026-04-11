/**
 * Avatar Agent Service
 * 分身 Agent 推理引擎
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import {
  AvatarThought,
  AvatarActionResult,
  AvatarResponse,
  AvatarContext,
  AvatarAgentConfig,
  ConversationMessage,
  MemoryConfig
} from './avatar-agent.types'
import { AvatarMemoryService } from './avatar-memory.service'
import { AvatarLearningService } from './avatar-learning.service'

@Injectable()
export class AvatarAgentService {
  private readonly logger = new Logger(AvatarAgentService.name)
  private llmClient: LLMClient

  constructor(
    private readonly memoryService: AvatarMemoryService,
    @Inject(forwardRef(() => AvatarLearningService))
    private readonly learningService: AvatarLearningService
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
    context?: AvatarContext
  ): Promise<AvatarThought> {
    try {
      // 1. 加载分身配置
      const config = await this.loadAvatarConfig(avatarId)

      // 2. 检索相关记忆
      const relevantMemories = await this.memoryService.retrieveRelevantMemories(
        avatarId,
        userMessage,
        config.memoryConfig
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
   * 执行动作
   */
  async act(
    avatarId: string,
    thought: AvatarThought,
    context?: AvatarContext
  ): Promise<AvatarActionResult> {
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
      // 目前先返回模拟结果
      const result = await this.executeToolByName(avatarId, toolName, params, context)

      return result
    } catch (error) {
      this.logger.error('Error in act method:', error)
      return {
        success: false,
        error: error.message
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
    conversationHistory?: ConversationMessage[]
  ): Promise<AvatarResponse> {
    try {
      // 1. 理解意图
      const thought = await this.think(avatarId, message, {
        userId,
        history: conversationHistory
      })

      // 2. 生成响应
      let response: AvatarResponse

      if (thought.requiresTool && thought.intent.toolName) {
        // 需要调用工具
        const actionResult = await this.act(avatarId, thought, {
          userId,
          history: conversationHistory
        })

        // 基于工具结果生成回复
        response = await this.generateResponse(avatarId, thought, actionResult)

        // 学习结果
        if (actionResult.success) {
          await this.learningService.learnFromResult(avatarId, thought, actionResult)
        }
      } else {
        // 直接回复
        response = await this.generateResponse(avatarId, thought)
      }

      // 3. 存储记忆
      await this.memoryService.storeConversation(avatarId, userId, {
        userMessage: message,
        assistantResponse: response.content,
        thought,
        metadata: response.metadata
      })

      // 4. 更新技能熟练度
      await this.learningService.updateSkillProficiency(avatarId, thought, response)

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
   * 加载分身配置
   */
  private async loadAvatarConfig(avatarId: string): Promise<AvatarAgentConfig> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('avatar_agent_configs')
        .select('*')
        .eq('avatar_id', avatarId)
        .single()

      if (error || !data) {
        // 使用默认配置
        return this.getDefaultConfig(avatarId)
      }

      return {
        id: data.id,
        avatarId: data.avatar_id,
        systemPrompt: data.system_prompt,
        rolePrompt: data.role_prompt,
        temperature: parseFloat(data.temperature),
        maxTokens: data.max_tokens,
        enabledTools: data.enabled_tools || [],
        knowledgeBases: data.knowledge_bases || [],
        reasoningMode: data.reasoning_mode,
        learningEnabled: data.learning_enabled,
        memoryConfig: data.memory_config || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    } catch (error) {
      this.logger.warn('Failed to load avatar config, using default:', error)
      return this.getDefaultConfig(avatarId)
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(avatarId: string): AvatarAgentConfig {
    return {
      id: 'default',
      avatarId,
      systemPrompt: `你是一个智能分身助手，负责回答用户问题。
- 使用友好和专业的语气
- 优先理解用户意图
- 根据用户需求提供帮助
- 记住用户的偏好和历史对话`,
      rolePrompt: undefined,
      temperature: 0.7,
      maxTokens: 2000,
      enabledTools: [],
      knowledgeBases: [],
      reasoningMode: 'react',
      learningEnabled: true,
      memoryConfig: {
        maxRetrieval: 5,
        similarityThreshold: 0.7,
        typeWeights: {
          conversation: 1.0,
          preference: 0.8,
          experience: 0.6
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 构建推理上下文
   */
  private async buildReasoningContext(
    avatarId: string,
    userMessage: string,
    context?: AvatarContext,
    relevantMemories?: any[],
    config?: AvatarAgentConfig
  ): Promise<string> {
    const parts = []

    // 系统提示词
    if (config?.systemPrompt) {
      parts.push(`【系统角色】\n${config.systemPrompt}`)
    }

    // 角色提示词
    if (config?.rolePrompt) {
      parts.push(`【角色设定】\n${config.rolePrompt}`)
    }

    // 对话历史
    if (context?.history && context.history.length > 0) {
      const historyText = context.history
        .slice(-5) // 只保留最近 5 条
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n')
      parts.push(`【对话历史】\n${historyText}`)
    }

    // 相关记忆
    if (relevantMemories && relevantMemories.length > 0) {
      const memoryText = relevantMemories
        .map(mem => `- ${mem.content}`)
        .join('\n')
      parts.push(`【相关记忆】\n${memoryText}`)
    }

    // 当前用户消息
    parts.push(`【用户消息】\n${userMessage}`)

    return parts.join('\n\n')
  }

  /**
   * 执行推理
   */
  private async executeReasoning(
    avatarId: string,
    context: string,
    config: AvatarAgentConfig
  ): Promise<AvatarThought> {
    try {
      const prompt = `${context}

请分析用户的意图，并按以下格式回复：
Thought: [你的思考过程]
Intent Type: [意图类型]
Requires Tool: [true/false]
Tool Name: [工具名称，如果需要工具的话]
Parameters: [JSON格式的参数，如果需要工具的话]
Confidence: [置信度 0-1]`

      const response = await this.llmClient.invoke(
        [{ role: 'user', content: prompt }],
        {
          model: 'doubao-seed-1-8-251228',
          temperature: config.temperature
        }
      )

      // 解析响应
      const thought = this.parseReasoningResponse(avatarId, response.content)

      return thought
    } catch (error) {
      this.logger.error('Error executing reasoning:', error)
      return {
        id: `thought-${Date.now()}`,
        avatarId,
        content: '推理失败',
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
   * 解析推理响应
   */
  private parseReasoningResponse(avatarId: string, content: string): AvatarThought {
    const thought: AvatarThought = {
      id: `thought-${Date.now()}`,
      avatarId,
      content: '',
      intent: {
        type: 'unknown',
        confidence: 0.5
      },
      requiresTool: false,
      createdAt: new Date().toISOString()
    }

    // 解析各个字段
    const thoughtMatch = content.match(/Thought:\s*(.+)/i)
    if (thoughtMatch) {
      thought.content = thoughtMatch[1].trim()
    }

    const intentMatch = content.match(/Intent Type:\s*(.+)/i)
    if (intentMatch) {
      thought.intent.type = intentMatch[1].trim()
    }

    const requiresToolMatch = content.match(/Requires Tool:\s*(.+)/i)
    if (requiresToolMatch) {
      thought.requiresTool = requiresToolMatch[1].trim().toLowerCase() === 'true'
    }

    const toolNameMatch = content.match(/Tool Name:\s*(.+)/i)
    if (toolNameMatch) {
      thought.intent.toolName = toolNameMatch[1].trim()
    }

    const paramsMatch = content.match(/Parameters:\s*(.+)/is)
    if (paramsMatch) {
      try {
        thought.intent.params = JSON.parse(paramsMatch[1].trim())
      } catch (e) {
        this.logger.warn('Failed to parse parameters:', e)
      }
    }

    const confidenceMatch = content.match(/Confidence:\s*(.+)/i)
    if (confidenceMatch) {
      thought.intent.confidence = parseFloat(confidenceMatch[1].trim())
    }

    return thought
  }

  /**
   * 生成响应
   */
  private async generateResponse(
    avatarId: string,
    thought: AvatarThought,
    actionResult?: AvatarActionResult
  ): Promise<AvatarResponse> {
    try {
      const config = await this.loadAvatarConfig(avatarId)

      let prompt = `${config.systemPrompt}\n\n`

      // 如果有工具结果，整合到上下文中
      if (actionResult) {
        prompt += `【思考过程】\n${thought.content}\n\n`
        prompt += `【工具执行结果】\n`
        prompt += actionResult.success
          ? `工具 ${actionResult.toolName} 执行成功：\n${JSON.stringify(actionResult.data, null, 2)}`
          : `工具 ${actionResult.toolName} 执行失败：${actionResult.error}`
        prompt += '\n\n'
      } else {
        prompt += `【思考过程】\n${thought.content}\n\n`
      }

      prompt += `【任务】\n根据以上信息，生成一个自然、友好的回复。`

      const response = await this.llmClient.invoke(
        [{ role: 'user', content: prompt }],
        {
          model: 'doubao-seed-1-8-251228',
          temperature: config.temperature,
          maxTokens: config.maxTokens
        }
      )

      return {
        content: response.content,
        metadata: {
          thought,
          toolResults: actionResult ? [actionResult] : [],
          confidence: thought.intent.confidence
        }
      }
    } catch (error) {
      this.logger.error('Error generating response:', error)
      return {
        content: thought.content || '抱歉，我无法生成合适的回复。',
        metadata: {
          thought,
          confidence: 0
        }
      }
    }
  }

  /**
   * 按名称执行工具
   */
  private async executeToolByName(
    avatarId: string,
    toolName: string,
    params: Record<string, any>,
    context?: AvatarContext
  ): Promise<AvatarActionResult> {
    try {
      this.logger.log(`Executing tool: ${toolName} with params:`, params)

      // TODO: 实现实际的工具调用逻辑
      // 目前返回模拟结果
      await new Promise(resolve => setTimeout(resolve, 500))

      return {
        success: true,
        toolName,
        data: {
          message: `工具 ${toolName} 执行成功`,
          result: params
        },
        executionTime: 500
      }
    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}:`, error)
      return {
        success: false,
        toolName,
        error: error.message
      }
    }
  }

  /**
   * 更新分身配置
   */
  async updateAvatarConfig(
    avatarId: string,
    updates: Partial<Omit<AvatarAgentConfig, 'id' | 'avatarId' | 'createdAt'>>
  ): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('avatar_agent_configs')
        .upsert({
          avatar_id: avatarId,
          ...updates,
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      this.logger.log(`Updated config for avatar ${avatarId}`)
    } catch (error) {
      this.logger.error('Error updating avatar config:', error)
      throw error
    }
  }

  /**
   * 初始化分身配置
   */
  async initializeAvatarConfig(
    avatarId: string,
    options?: {
      systemPrompt?: string
      rolePrompt?: string
      personality?: string
    }
  ): Promise<void> {
    const defaultConfig = this.getDefaultConfig(avatarId)

    const config = {
      ...defaultConfig,
      systemPrompt: options?.systemPrompt || defaultConfig.systemPrompt,
      rolePrompt: options?.rolePrompt || defaultConfig.rolePrompt
    }

    await this.updateAvatarConfig(avatarId, config)
  }
}
