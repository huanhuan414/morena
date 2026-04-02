/**
 * OpenClaw Agent 核心服务
 * 实现 ReAct (Reasoning + Acting) 模式的自主任务执行系统
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import {
  AgentContext,
  AgentExecutionResult,
  AgentTaskLog,
  AvatarSkill,
  PlatformConfig,
  PlatformType,
  ReActStep,
  ToolDefinition,
  ToolResult,
  PLATFORM_CONFIG_TEMPLATES
} from './agent.types'
import { ITool, ToolContext } from './tools/tool.interface'
import { AgentGateway } from './agent.gateway'
import { ProgressCacheService } from './progress-cache.service'

// 导入所有工具
import {
  CreateTaskTool,
  UpdateTaskTool,
  DeleteTaskTool,
  ListTasksTool,
  CreateOrderTool,
  CreatePostTool,
  UpdateAvatarTool
} from './tools/app-function.tools'
import {
  WriteArticleTool,
  WriteWechatMpArticleTool,
  WriteXiaohongshuNoteTool,
  GenerateImageTool,
  GenerateVideoTool
} from './tools/content-creation.tools'
import {
  CheckPlatformConfigTool,
  PublishWechatMpTool,
  PublishXiaohongshuTool,
  PublishBilibiliTool,
  PublishWeiboTool,
  PublishDouyinTool,
  PublishWechatVideoTool
} from './tools/platform-publish.tools'

// 对话消息类型
interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
}

// 当前任务上下文（用于生成 taskId）
interface TaskContext {
  taskId: string
  startTime: number
}

@Injectable()
export class AgentService {
  private tools: Map<string, ITool> = new Map()
  private llmClient: LLMClient
  
  // 当前任务上下文
  private currentTaskMap: Map<string, TaskContext> = new Map()

  constructor(
    @Inject(forwardRef(() => AgentGateway))
    private readonly gateway: AgentGateway,
    private readonly progressCache: ProgressCacheService
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    
    // 注册所有工具
    this.registerTools()
  }

  /**
   * 推送任务进度（通过 WebSocket + 缓存）
   */
  private emitProgress(userId: string, type: string, message: string, data?: any) {
    const taskContext = this.currentTaskMap.get(userId)
    const taskId = taskContext?.taskId || `task-${Date.now()}`
    
    const progress = {
      taskId,
      userId,
      type,
      message,
      data,
      timestamp: Date.now()
    }
    
    // 通过 WebSocket 推送
    if (this.gateway) {
      this.gateway.emitProgress(userId, progress)
    }
    
    // 同时保存到缓存（用于轮询）
    this.progressCache.addProgress(userId, progress)
  }

  /**
   * 注册所有工具
   */
  private registerTools() {
    // 小程序功能工具
    this.tools.set('app_create_task', new CreateTaskTool())
    this.tools.set('app_update_task', new UpdateTaskTool())
    this.tools.set('app_delete_task', new DeleteTaskTool())
    this.tools.set('app_list_tasks', new ListTasksTool())
    this.tools.set('app_create_order', new CreateOrderTool())
    this.tools.set('app_create_post', new CreatePostTool())
    this.tools.set('app_update_avatar', new UpdateAvatarTool())

    // 内容创作工具
    this.tools.set('write_article', new WriteArticleTool())
    this.tools.set('write_wechat_mp_article', new WriteWechatMpArticleTool())
    this.tools.set('write_xiaohongshu_note', new WriteXiaohongshuNoteTool())
    this.tools.set('generate_image', new GenerateImageTool())
    this.tools.set('generate_video', new GenerateVideoTool())

    // 平台发布工具
    this.tools.set('check_platform_config', new CheckPlatformConfigTool())
    this.tools.set('publish_wechat_mp', new PublishWechatMpTool())
    this.tools.set('publish_xiaohongshu', new PublishXiaohongshuTool())
    this.tools.set('publish_bilibili', new PublishBilibiliTool())
    this.tools.set('publish_weibo', new PublishWeiboTool())
    this.tools.set('publish_douyin', new PublishDouyinTool())
    this.tools.set('publish_wechat_video', new PublishWechatVideoTool())
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition)
  }

  /**
   * 执行 Agent 任务（带进度回调）
   * 通过 AsyncGenerator 实现流式输出
   */
  async *executeTaskWithProgress(
    userId: string,
    avatarId: string,
    taskDescription: string,
    options?: {
      conversationId?: string
      taskId?: string
      headers?: Record<string, string>
    }
  ): AsyncGenerator<any> {
    // 发送开始事件
    yield {
      type: 'start',
      message: '开始分析任务...',
      timestamp: Date.now()
    }

    // 初始化上下文
    yield { type: 'progress', message: '初始化执行环境...', step: 'init' }
    const context = await this.initContext(userId, avatarId, taskDescription, options)
    
    // 执行 ReAct 循环（带进度）
    const steps: ReActStep[] = []
    let finalAnswer = ''
    let requiresConfig = false
    let configPlatform: PlatformType | undefined
    let configFields: any[] = []

    while (context.currentStep < context.maxSteps) {
      context.currentStep++
      
      // Step 1: 思考
      yield { 
        type: 'thinking', 
        message: `正在思考第 ${context.currentStep} 步...`,
        step: context.currentStep
      }
      
      const thought = await this.think(context, steps)
      
      // 检查是否已经有最终答案
      if (thought.includes('Final Answer:') || thought.includes('最终答案:')) {
        finalAnswer = this.extractFinalAnswer(thought)
        yield { 
          type: 'complete', 
          message: '任务完成！',
          thought: thought.substring(0, 200)
        }
        break
      }

      // Step 2: 决定行动
      const actionInfo = this.parseAction(thought)
      
      if (!actionInfo) {
        finalAnswer = await this.generateDirectAnswer(context)
        break
      }

      // 获取工具显示名称
      const toolDef = this.tools.get(actionInfo.action)?.definition
      const toolDisplayName = toolDef?.displayName || actionInfo.action

      yield { 
        type: 'action', 
        action: actionInfo.action,
        displayName: toolDisplayName,
        message: `正在执行: ${toolDisplayName}`,
        params: actionInfo.action_input,
        step: context.currentStep
      }

      const step: ReActStep = {
        step_index: context.currentStep,
        thought,
        action: actionInfo.action,
        action_input: actionInfo.action_input
      }

      // Step 3: 执行工具
      const toolResult = await this.executeTool(
        actionInfo.action,
        actionInfo.action_input,
        context
      )

      step.observation = toolResult

      // 发送执行结果
      yield { 
        type: 'observation', 
        action: actionInfo.action,
        displayName: toolDisplayName,
        success: toolResult.success,
        message: toolResult.success 
          ? toolResult.data?.message || '执行成功'
          : toolResult.error || '执行失败',
        data: toolResult.data,
        requires_config: toolResult.requires_config,
        config_platform: toolResult.config_platform,
        config_fields: toolResult.config_fields
      }

      // 检查是否需要配置
      if (toolResult.requires_config) {
        requiresConfig = true
        configPlatform = toolResult.config_platform
        configFields = toolResult.config_fields || PLATFORM_CONFIG_TEMPLATES[toolResult.config_platform!]?.fields || []
        step.requires_config = true
        step.config_platform = configPlatform
        step.config_fields = configFields
        
        steps.push(step)
        
        // 如果前面的步骤已经生成了内容（如文章、图片），提取出来作为最终答案的一部分
        const generatedContent = steps.find(s => s.observation?.data?.content || s.observation?.data?.image_urls)
        let contentMessage = ''
        if (generatedContent?.observation?.data) {
          const data = generatedContent.observation.data
          if (data.title) {
            contentMessage = `\n\n📝 已生成内容：「${data.title}」${data.word_count ? `，共${data.word_count}字` : ''}${data.cover_image_url ? '，含封面图' : ''}`
          }
        }
        
        yield { 
          type: 'config_required',
          platform: configPlatform,
          platformName: PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name,
          fields: configFields,
          message: `需要配置 ${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'} 后才能发布${contentMessage}`,
          generatedContent: generatedContent?.observation?.data
        }
        break
      }

      steps.push(step)
      context.executionHistory = steps
    }

    // 生成最终答案
    if (!finalAnswer) {
      if (requiresConfig) {
        // 检查是否有已生成的内容
        const generatedContent = steps.find(s => s.observation?.data?.content || s.observation?.data?.image_urls)
        if (generatedContent?.observation?.data) {
          const data = generatedContent.observation.data
          if (data.title && data.content) {
            // 有文章内容，返回文章摘要
            finalAnswer = `✅ 内容已生成完成！\n\n📝 标题：${data.title}\n📊 字数：${data.word_count || data.content.length}字${data.cover_image_url ? '\n🖼️ 封面图：已生成' : ''}\n\n⚠️ 如需发布到平台，请先配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}授权信息。`
          } else if (data.image_urls?.length) {
            finalAnswer = `✅ 已生成 ${data.image_urls.length} 张图片！\n\n⚠️ 如需发布到平台，请先配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}授权信息。`
          } else {
            finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
          }
        } else {
          finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
        }
      } else {
        finalAnswer = await this.summarizeExecution(context, steps)
      }
    }

    // 保存对话记录
    if (options?.conversationId) {
      await this.saveConversationHistory(
        options.conversationId,
        taskDescription,
        finalAnswer,
        { success: !requiresConfig, finalAnswer, steps, requiresConfig, configPlatform, configFields }
      )
    }

    // 发送最终结果
    yield { 
      type: 'result',
      success: !requiresConfig,
      finalAnswer,
      steps,
      requiresConfig,
      configPlatform,
      configFields
    }
  }

  /**
   * 执行 Agent 任务
   * 主入口：接收用户指令，自主完成复杂任务
   */
  async executeTask(
    userId: string,
    avatarId: string,
    taskDescription: string,
    options?: {
      conversationId?: string
      taskId?: string
      headers?: Record<string, string>
      conversationHistory?: ConversationMessage[] // 新增：对话历史
    }
  ): Promise<AgentExecutionResult> {
    // 设置任务上下文
    const taskId = options?.taskId || `task-${Date.now()}`
    this.currentTaskMap.set(userId, {
      taskId,
      startTime: Date.now()
    })
    
    // 清除之前的进度缓存
    this.progressCache.clearProgress(userId)
    
    try {
      // 推送开始事件
      this.emitProgress(userId, 'start', '开始分析任务...')
      
      // 初始化上下文
      this.emitProgress(userId, 'progress', '初始化执行环境...')
      const context = await this.initContext(userId, avatarId, taskDescription, options)
      
      // 执行 ReAct 循环
      const result = await this.runReActLoop(context, userId)
      
      // 推送完成事件
      this.emitProgress(userId, 'complete', '任务执行完成', { 
        success: result.success,
        requiresConfig: result.requiresConfig 
      })
      
      // 保存对话记录
      if (options?.conversationId) {
        await this.saveConversationHistory(
          options.conversationId,
          taskDescription,
          result.finalAnswer,
          result
        )
      }
      
      return result
    } finally {
      // 清理任务上下文
      this.currentTaskMap.delete(userId)
    }
  }

  /**
   * 异步执行 Agent 任务
   * 用于解决 HTTP 请求超时问题
   * 任务在后台执行，结果通过缓存获取
   */
  async executeTaskAsync(
    userId: string,
    avatarId: string,
    taskDescription: string,
    options?: {
      conversationId?: string
      taskId?: string
      headers?: Record<string, string>
      conversationHistory?: ConversationMessage[]
    }
  ): Promise<AgentExecutionResult> {
    const taskId = options?.taskId || `task-${Date.now()}`
    
    // 更新任务状态为 running
    this.progressCache.updateTaskStatus(userId, taskId, 'running')
    
    // 设置任务上下文
    this.currentTaskMap.set(userId, {
      taskId,
      startTime: Date.now()
    })
    
    try {
      // 推送开始事件
      this.emitProgress(userId, 'start', '开始分析任务...')
      
      // 初始化上下文
      this.emitProgress(userId, 'progress', '初始化执行环境...')
      const context = await this.initContext(userId, avatarId, taskDescription, options)
      
      // 执行 ReAct 循环
      const result = await this.runReActLoop(context, userId)
      
      // 推送完成事件
      this.emitProgress(userId, 'complete', '任务执行完成', { 
        success: result.success,
        requiresConfig: result.requiresConfig 
      })
      
      // 保存任务结果到缓存
      this.progressCache.updateTaskStatus(userId, taskId, 'completed', result)
      
      // 保存对话记录
      if (options?.conversationId) {
        await this.saveConversationHistory(
          options.conversationId,
          taskDescription,
          result.finalAnswer,
          result
        )
      }
      
      return result
    } catch (error) {
      // 保存错误信息
      this.progressCache.updateTaskStatus(userId, taskId, 'failed', null, error.message)
      this.emitProgress(userId, 'error', error.message)
      throw error
    } finally {
      // 清理任务上下文
      this.currentTaskMap.delete(userId)
    }
  }

  /**
   * 保存对话历史
   */
  private async saveConversationHistory(
    conversationId: string,
    userMessage: string,
    aiMessage: string,
    agentResult: AgentExecutionResult
  ): Promise<void> {
    const client = getSupabaseClient()
    
    // 提取媒体内容
    const media: Array<{
      type: 'image' | 'video' | 'article'
      url?: string
      title?: string
      content?: string
      coverImage?: string
    }> = []
    
    agentResult.steps.forEach(step => {
      if (step.observation?.data) {
        const data = step.observation.data
        
        // 图片
        if (data.image_urls && Array.isArray(data.image_urls)) {
          data.image_urls.forEach((url: string) => {
            if (url && typeof url === 'string') {
              media.push({ type: 'image', url })
            }
          })
        }
        
        // 文章
        if (data.content && data.title) {
          media.push({
            type: 'article',
            title: data.title,
            content: data.content,
            coverImage: data.cover_image_url
          })
        }
        
        // 视频
        if (data.video_url) {
          media.push({ type: 'video', url: data.video_url })
        }
        
        // 封面图（单独展示）
        if (data.cover_image_url && !data.content) {
          media.push({ type: 'image', url: data.cover_image_url })
        }
      }
    })
    
    // 保存用户消息
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage
    })
    
    // 保存 AI 回复（包含提取后的 media 数组）
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: aiMessage,
      metadata: { 
        agent_result: agentResult,
        media: media.length > 0 ? media : undefined
      }
    })
    
    // 更新对话上下文
    const { data: conversation } = await client
      .from('conversations')
      .select('context')
      .eq('id', conversationId)
      .single()
    
    const currentContext = (conversation?.context || []) as ConversationMessage[]
    const newContext = [
      ...currentContext.slice(-18), // 保留最近 10 轮对话
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiMessage }
    ]
    
    await client
      .from('conversations')
      .update({
        context: newContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
  }

  /**
   * 初始化执行上下文
   */
  private async initContext(
    userId: string,
    avatarId: string,
    taskDescription: string,
    options?: {
      conversationId?: string
      taskId?: string
      headers?: Record<string, string>
      conversationHistory?: ConversationMessage[]
    }
  ): Promise<AgentContext> {
    const client = getSupabaseClient()

    // 获取用户的平台配置
    const { data: platformConfigs } = await client
      .from('platform_configs')
      .select('*')
      .eq('user_id', userId)

    const platformMap = new Map<PlatformType, PlatformConfig>()
    ;(platformConfigs || []).forEach(config => {
      platformMap.set(config.platform_type as PlatformType, config)
    })

    // 获取分身的技能
    const { data: avatarSkills } = await client
      .from('avatar_skills')
      .select('*')
      .eq('avatar_id', avatarId)

    // 获取对话历史
    let conversationHistory: ConversationMessage[] = options?.conversationHistory || []
    
    // 如果有 conversationId 但没有传入历史，从数据库获取
    if (options?.conversationId && conversationHistory.length === 0) {
      const { data: conversation } = await client
        .from('conversations')
        .select('context')
        .eq('id', options.conversationId)
        .single()
      
      if (conversation?.context) {
        conversationHistory = conversation.context as ConversationMessage[]
      }
    }

    return {
      userId,
      avatarId,
      conversationId: options?.conversationId,
      taskId: options?.taskId,
      taskDescription,
      availableTools: this.getAvailableTools(),
      platformConfigs: platformMap,
      avatarSkills: (avatarSkills || []) as AvatarSkill[],
      executionHistory: [],
      conversationHistory,
      maxSteps: 10,
      currentStep: 0
    }
  }

  /**
   * 执行 ReAct 循环
   * Reasoning -> Acting -> Observing -> 循环或结束
   */
  private async runReActLoop(context: AgentContext, userId: string): Promise<AgentExecutionResult> {
    const steps: ReActStep[] = []
    let finalAnswer = ''
    let requiresConfig = false
    let configPlatform: PlatformType | undefined
    let configFields: any[] = []

    while (context.currentStep < context.maxSteps) {
      context.currentStep++
      
      // Step 1: 思考 (Reasoning)
      this.emitProgress(userId, 'thinking', `正在思考第 ${context.currentStep} 步...`)
      const thought = await this.think(context, steps)
      
      // 检查是否已经有最终答案
      if (thought.includes('Final Answer:') || thought.includes('最终答案:')) {
        finalAnswer = this.extractFinalAnswer(thought)
        break
      }

      // Step 2: 决定行动 (Action Selection)
      const actionInfo = this.parseAction(thought)
      
      if (!actionInfo) {
        // 无法解析行动，直接生成回答
        finalAnswer = await this.generateDirectAnswer(context)
        break
      }

      const step: ReActStep = {
        step_index: context.currentStep,
        thought,
        action: actionInfo.action,
        action_input: actionInfo.action_input
      }

      // 获取工具显示名称
      const toolDef = this.tools.get(actionInfo.action)?.definition
      const toolDisplayName = toolDef?.displayName || actionInfo.action

      // 推送执行中状态
      this.emitProgress(userId, 'action', `正在执行: ${toolDisplayName}`, {
        action: actionInfo.action,
        displayName: toolDisplayName,
        params: actionInfo.action_input
      })

      // Step 3: 执行工具 (Acting)
      const toolResult = await this.executeTool(
        actionInfo.action,
        actionInfo.action_input,
        context
      )

      step.observation = toolResult

      // 推送执行结果
      this.emitProgress(userId, 'observation', toolResult.success ? '执行成功' : '执行失败', {
        action: actionInfo.action,
        displayName: toolDisplayName,
        success: toolResult.success,
        message: toolResult.data?.message || toolResult.error,
        data: toolResult.data
      })

      // 检查是否需要配置
      if (toolResult.requires_config) {
        requiresConfig = true
        configPlatform = toolResult.config_platform
        configFields = toolResult.config_fields || PLATFORM_CONFIG_TEMPLATES[toolResult.config_platform!]?.fields || []
        step.requires_config = true
        step.config_platform = configPlatform
        step.config_fields = configFields
        
        steps.push(step)
        break
      }

      steps.push(step)

      // 记录日志
      await this.logStep(context, step, toolResult)

      // Step 4: 观察 (Observation) - 更新上下文
      context.executionHistory = steps
    }

    // 如果没有生成最终答案，基于步骤生成
    if (!finalAnswer) {
      if (requiresConfig) {
        // 检查是否有已生成的内容
        const generatedContent = steps.find(s => s.observation?.data?.content || s.observation?.data?.image_urls)
        if (generatedContent?.observation?.data) {
          const data = generatedContent.observation.data
          if (data.title && data.content) {
            // 有文章内容，返回文章摘要
            finalAnswer = `✅ 内容已生成完成！\n\n📝 标题：${data.title}\n📊 字数：${data.word_count || data.content.length}字${data.cover_image_url ? '\n🖼️ 封面图：已生成' : ''}\n\n⚠️ 如需发布到平台，请先配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}授权信息。`
          } else if (data.image_urls?.length) {
            finalAnswer = `✅ 已生成 ${data.image_urls.length} 张图片！\n\n⚠️ 如需发布到平台，请先配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}授权信息。`
          } else {
            finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
          }
        } else {
          finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
        }
      } else {
        finalAnswer = await this.summarizeExecution(context, steps)
      }
    }

    return {
      success: !requiresConfig,
      finalAnswer,
      steps,
      requiresConfig: requiresConfig,
      configPlatform,
      configFields,
      taskId: context.taskId
    }
  }

  /**
   * 思考阶段：分析当前状态，决定下一步行动
   */
  private async think(context: AgentContext, history: ReActStep[]): Promise<string> {
    const toolsDescription = this.formatToolsForPrompt(context.availableTools)
    const historyText = this.formatHistory(history)
    const conversationHistoryText = this.formatConversationHistory(context.conversationHistory)

    // 智能任务理解提示
    const taskUnderstandingHint = this.getTaskUnderstandingHint(context.taskDescription, history)

    const prompt = `你是一个智能Agent，能够使用工具完成任务。

可用工具：
${toolsDescription}

${conversationHistoryText ? `对话历史：\n${conversationHistoryText}\n` : ''}

当前任务：${context.taskDescription}

${taskUnderstandingHint}

${historyText ? `执行历史：\n${historyText}\n` : ''}

【重要规则】
1. 只有当用户明确要求"生成图片"、"画图"、"设计图片"、"生成视频"、"写文章"、"发布内容"等创作类任务时，才调用对应的工具。
2. 对于普通对话、问候、咨询、关注、点赞等社交互动，直接用Final Answer回复，不要调用任何工具。
3. 如果用户只是说"关注"、"点赞"、"分享"等，这是普通社交行为，不需要调用工具，直接回复即可。
4. 不要随意调用generate_image或generate_video工具，除非用户明确要求创作图片或视频。

请思考下一步应该做什么。
- 如果需要使用工具，按以下格式回复：
  Thought: [你的思考]
  Action: [工具名称]
  Action Input: [JSON格式的参数]

- 如果任务已完成或不需要调用工具，按以下格式回复：
  Thought: [你的思考]
  Final Answer: [最终答案]

只回复Thought、Action和Action Input（或Final Answer），不要有其他内容。`

    const response = await this.llmClient.invoke([
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3
    })

    return response.content.trim()
  }

  /**
   * 获取任务理解提示
   * 帮助 Agent 正确理解各种任务类型
   */
  private getTaskUnderstandingHint(task: string, history: ReActStep[]): string {
    const hints: string[] = []
    const lowerTask = task.toLowerCase()
    
    // 1. 图片生成任务（最高优先级）
    if (lowerTask.match(/生成.*图|画.*图|设计.*图|做.*图|创作.*图|生成图片|画张图|做个图/)) {
      hints.push(`【任务解析】这是一个图片生成任务：
请直接使用 generate_image 工具生成图片，不要使用其他工具。
参数示例：{ "prompt": "图片详细描述", "style": "realistic" }
style 可选值：realistic（写实）、artistic（艺术）、anime（动漫）、3d（3D效果）、logo（Logo设计）`)
    }
    // 2. 视频生成任务
    else if (lowerTask.match(/生成.*视频|做.*视频|创作.*视频|生成视频|做个视频/)) {
      hints.push(`【任务解析】这是一个视频生成任务：
请直接使用 generate_video 工具生成视频，不要使用其他工具。
参数示例：{ "prompt": "视频内容描述", "duration": 5, "ratio": "9:16" }`)
    }
    // 3. 社交互动/普通对话（优先检测，避免误判）
    else if (lowerTask.match(/^关注|点赞|收藏|分享|转发|评论|回复|你好|在吗|嗨|hi|hello|谢谢|感谢|再见|拜拜/) ||
             lowerTask.match(/帮我关注|帮我点赞|帮我收藏|帮我分享/) ||
             lowerTask.match(/^.{0,20}$/) && !lowerTask.match(/生成|创作|设计|写|画|发布/)) {
      hints.push(`【任务解析】这是一个普通对话或社交互动：
请直接用 Final Answer 回复用户，不要调用任何工具。
- 如果用户说"关注"，回复"好的，已为你关注该话题/用户"
- 如果用户说"点赞"，回复"好的，已为你点赞"
- 如果用户只是问候，友好地回复问候
- 不要调用 generate_image、generate_video 等工具`)
    }
    // 4. 微信公众号任务
    else if (lowerTask.includes('公众号') || lowerTask.includes('微信文章') || lowerTask.includes('微信图文')) {
      hints.push(`【任务解析】这是一个微信公众号内容创作任务：
1. 首先使用 write_wechat_mp_article 工具生成公众号爆款图文内容
2. 然后使用 publish_wechat_mp 工具尝试发布到公众号
3. 如果 publish_wechat_mp 返回 requires_config=true，说明用户未配置公众号，需要提示用户配置`)
    }
    // 4. 小红书任务
    else if (lowerTask.includes('小红书') || lowerTask.includes('红书笔记')) {
      hints.push(`【任务解析】这是一个小红书内容创作任务：
1. 首先使用 write_xiaohongshu_note 工具生成小红书笔记内容
2. 然后使用 publish_xiaohongshu 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置小红书账号`)
    }
    // 5. 微博任务
    else if (lowerTask.includes('微博') && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个微博内容创作任务：
1. 首先使用 write_article 工具生成微博内容（简短、话题性强）
2. 然后使用 publish_weibo 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置微博账号`)
    }
    // 6. 抖音任务
    else if ((lowerTask.includes('抖音') || lowerTask.includes('tiktok')) && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个抖音内容创作任务：
1. 首先生成视频内容（使用 generate_video 或提供视频脚本）
2. 然后使用 publish_douyin 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置抖音账号`)
    }
    // 7. B站任务
    else if ((lowerTask.includes('b站') || lowerTask.includes('哔哩') || lowerTask.includes('bilibili')) && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个B站内容创作任务：
1. 首先生成视频或文章内容
2. 然后使用 publish_bilibili 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置B站账号`)
    }
    // 8. 微信视频号任务
    else if (lowerTask.includes('视频号') && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个微信视频号内容创作任务：
1. 首先生成视频内容
2. 然后使用 publish_wechat_video 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置视频号`)
    }
    // 9. 今日头条任务
    else if ((lowerTask.includes('头条') || lowerTask.includes('今日头条')) && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个今日头条内容创作任务：
1. 首先使用 write_article 工具生成头条文章内容
2. 注意：今日头条暂未集成，请告知用户当前支持的平台：微信公众号、小红书、微博、抖音、B站、微信视频号`)
    }
    // 10. 通用文章写作
    else if (lowerTask.match(/写.*文章|撰写.*文|生成.*文|创作.*文/) && !lowerTask.includes('公众号') && !lowerTask.includes('小红书')) {
      hints.push(`【任务解析】这是一个通用文章写作任务：
请使用 write_article 工具生成文章内容。`)
    }
    
    // 如果已经有执行历史，提示继续
    if (history.length > 0) {
      const lastStep = history[history.length - 1]
      if (lastStep.observation?.next_action_hint) {
        hints.push(`【下一步建议】${lastStep.observation.next_action_hint}`)
      }
    }
    
    return hints.length > 0 ? hints.join('\n\n') : ''
  }

  /**
   * 格式化对话历史
   */
  private formatConversationHistory(history: ConversationMessage[]): string {
    if (!history || history.length === 0) return ''
    
    return history
      .slice(-10) // 最近 5 轮对话
      .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
      .join('\n')
  }

  /**
   * 执行工具
   */
  private async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: AgentContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    
    if (!tool) {
      return { success: false, error: `工具 ${toolName} 不存在` }
    }

    const toolContext: ToolContext = {
      userId: context.userId,
      avatarId: context.avatarId,
      taskId: context.taskId,
      headers: undefined
    }

    // 对于发布工具，自动从历史记录中提取内容
    // 解决 LLM 无法传递完整长内容的问题
    if (toolName.startsWith('publish_') && context.executionHistory?.length > 0) {
      // 查找最近的生成内容
      const lastGeneratedContent = [...context.executionHistory].reverse().find(step => 
        step.observation?.data?.content && step.observation?.data?.title
      )
      
      if (lastGeneratedContent?.observation?.data) {
        const generatedData = lastGeneratedContent.observation.data
        
        // 如果 params.content 为空或长度太短，使用历史记录中的完整内容
        if (!params.content || params.content.length < 100) {
          console.log(`[Agent] 自动填充发布内容，原 content 长度: ${params.content?.length || 0}，新长度: ${generatedData.content?.length || 0}`)
          params = {
            ...params,
            title: params.title || generatedData.title,
            content: generatedData.content,
            cover_url: params.cover_url || generatedData.cover_image_url
          }
        }
      }
    }

    try {
      const result = await tool.execute(params || {}, toolContext)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  /**
   * 解析行动信息
   */
  private parseAction(thought: string): { action: string; action_input: any } | null {
    const actionMatch = thought.match(/Action:\s*(\w+)/i)
    const inputMatch = thought.match(/Action Input:\s*([\s\S]+?)(?=Thought:|Action:|Final Answer:|$)/i)

    if (actionMatch) {
      let actionInput = {}
      if (inputMatch) {
        try {
          actionInput = JSON.parse(inputMatch[1].trim())
        } catch {
          // 如果不是JSON，尝试作为字符串参数
          actionInput = { input: inputMatch[1].trim() }
        }
      }
      return {
        action: actionMatch[1],
        action_input: actionInput
      }
    }

    return null
  }

  /**
   * 提取最终答案
   */
  private extractFinalAnswer(thought: string): string {
    const match = thought.match(/Final Answer:\s*([\s\S]+)/i)
    return match ? match[1].trim() : thought
  }

  /**
   * 生成直接回答（当无法解析行动时）
   */
  private async generateDirectAnswer(context: AgentContext): Promise<string> {
    const response = await this.llmClient.invoke([
      {
        role: 'user',
        content: `请直接回答以下问题，不要使用工具：\n\n${context.taskDescription}`
      }
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7
    })

    return response.content.trim()
  }

  /**
   * 总结执行结果
   */
  private async summarizeExecution(context: AgentContext, steps: ReActStep[]): Promise<string> {
    const stepsSummary = steps.map(s => 
      `步骤${s.step_index}: ${s.thought}\n行动: ${s.action || '无'}\n结果: ${JSON.stringify(s.observation).substring(0, 200)}`
    ).join('\n\n')

    const response = await this.llmClient.invoke([
      {
        role: 'user',
        content: `任务：${context.taskDescription}\n\n执行记录：\n${stepsSummary}\n\n请用简洁的语言总结任务执行结果。`
      }
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.5
    })

    return response.content.trim()
  }

  /**
   * 格式化工具列表
   */
  private formatToolsForPrompt(tools: ToolDefinition[]): string {
    return tools.map(t => 
      `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.paramsSchema)}`
    ).join('\n')
  }

  /**
   * 格式化执行历史
   */
  private formatHistory(history: ReActStep[]): string {
    return history.map(h => {
      // 智能格式化结果，保留重要字段完整
      let resultStr: string
      if (h.observation?.data) {
        const data = h.observation.data
        // 对于内容创作工具，保留完整内容
        if (data.title || data.content) {
          resultStr = JSON.stringify({
            success: h.observation.success,
            data: {
              title: data.title,
              // 保留完整内容，但标记长度
              content: data.content,
              content_length: data.content?.length || 0,
              cover_image_url: data.cover_image_url,
              word_count: data.word_count,
              message: data.message,
              next_action_hint: data.next_action_hint
            }
          })
        } else {
          // 其他类型数据，保留完整信息
          resultStr = JSON.stringify(h.observation)
        }
      } else {
        resultStr = JSON.stringify(h.observation)
      }
      
      return `步骤${h.step_index}:\n思考: ${h.thought}\n行动: ${h.action}\n结果: ${resultStr}`
    }).join('\n\n')
  }

  /**
   * 记录执行步骤日志
   */
  private async logStep(
    context: AgentContext,
    step: ReActStep,
    result: ToolResult
  ): Promise<void> {
    if (!context.taskId) return

    const client = getSupabaseClient()
    
    await client.from('agent_task_logs').insert({
      task_id: context.taskId,
      avatar_id: context.avatarId,
      step_index: step.step_index,
      step_type: 'action',
      content: step.thought,
      tool_name: step.action,
      tool_params: step.action_input,
      tool_result: result,
      requires_config: result.requires_config || false,
      config_platform: result.config_platform
    })
  }

  /**
   * 检查平台配置
   */
  async checkPlatformConfig(userId: string, platform: PlatformType): Promise<{
    configured: boolean
    config?: PlatformConfig
    requiredFields?: any[]
  }> {
    const client = getSupabaseClient()

    const { data } = await client
      .from('platform_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('platform_type', platform)
      .maybeSingle()

    if (!data || data.status !== 'active') {
      return {
        configured: false,
        requiredFields: PLATFORM_CONFIG_TEMPLATES[platform]?.fields
      }
    }

    return {
      configured: true,
      config: data as PlatformConfig
    }
  }

  /**
   * 验证平台配置
   * 在保存前验证配置是否正确
   */
  async validatePlatformConfig(
    platform: PlatformType,
    configData: Record<string, any>
  ): Promise<{ valid: boolean; error?: string; message?: string }> {
    console.log(`验证平台配置: ${platform}`, Object.keys(configData))

    try {
      switch (platform) {
        case 'wechat_mp':
          return await this.validateWechatMpConfig(configData)
        case 'xiaohongshu':
          return await this.validateXiaohongshuConfig(configData)
        case 'bilibili':
          return await this.validateBilibiliConfig(configData)
        case 'weibo':
          return await this.validateWeiboConfig(configData)
        case 'douyin':
          return await this.validateDouyinConfig(configData)
        case 'wechat_video':
          return await this.validateWechatVideoConfig(configData)
        default:
          return { valid: false, error: '不支持的平台类型' }
      }
    } catch (err: any) {
      console.error('验证配置失败:', err)
      return { valid: false, error: `验证失败: ${err.message}` }
    }
  }

  /**
   * 验证微信公众号配置
   */
  private async validateWechatMpConfig(configData: Record<string, any>): Promise<{ valid: boolean; error?: string; message?: string }> {
    const { app_id, app_secret } = configData

    if (!app_id || !app_secret) {
      return { valid: false, error: '请填写AppID和AppSecret' }
    }

    if (!app_id.startsWith('wx')) {
      return { valid: false, error: 'AppID格式错误，应以wx开头' }
    }

    if (app_secret.length !== 32) {
      return { valid: false, error: 'AppSecret格式错误，应为32位字符' }
    }

    // 调用微信API验证
    try {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${app_id}&secret=${app_secret}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.errcode) {
        const errorMessages: Record<number, string> = {
          40001: 'AppSecret错误或不属于该公众号，请检查AppSecret是否正确',
          40013: 'AppID不合法，请检查AppID是否正确',
          40164: '服务器IP未加入白名单，请在公众平台后台配置IP白名单',
          41004: '缺少AppSecret参数',
          48001: 'api功能未授权，请确认公众号已开通相关权限',
        }
        const msg = errorMessages[data.errcode] || `微信API错误: ${data.errmsg} (${data.errcode})`
        return { valid: false, error: msg }
      }

      if (data.access_token) {
        return { valid: true, message: '配置验证成功，AppID和AppSecret正确' }
      }

      return { valid: false, error: '验证失败，请检查配置' }
    } catch (err: any) {
      return { valid: false, error: `API调用失败: ${err.message}` }
    }
  }

  /**
   * 验证小红书配置
   */
  private async validateXiaohongshuConfig(configData: Record<string, any>): Promise<{ valid: boolean; error?: string; message?: string }> {
    const { cookie } = configData

    if (!cookie || cookie.length < 50) {
      return { valid: false, error: 'Cookie格式不正确，请确保复制了完整的Cookie' }
    }

    // 小红书没有官方API，只能做基本的格式验证
    // 检查Cookie中是否包含必要的字段
    if (!cookie.includes('web_session') && !cookie.includes('webId')) {
      return { valid: false, error: 'Cookie可能无效，请确保已登录小红书并正确复制Cookie' }
    }

    return { valid: true, message: 'Cookie格式验证通过（实际有效性需发布时验证）' }
  }

  /**
   * 验证B站配置
   */
  private async validateBilibiliConfig(configData: Record<string, any>): Promise<{ valid: boolean; error?: string; message?: string }> {
    const { sessdata, bili_jct } = configData

    if (!sessdata) {
      return { valid: false, error: '请填写SESSDATA' }
    }

    if (!bili_jct) {
      return { valid: false, error: '请填写bili_jct' }
    }

    // B站没有官方API，只能做基本的格式验证
    if (sessdata.length < 20) {
      return { valid: false, error: 'SESSDATA格式不正确' }
    }

    if (bili_jct.length !== 32) {
      return { valid: false, error: 'bili_jct格式不正确，应为32位' }
    }

    return { valid: true, message: '配置格式验证通过（实际有效性需发布时验证）' }
  }

  /**
   * 验证微博配置
   */
  private async validateWeiboConfig(configData: Record<string, any>): Promise<{ valid: boolean; error?: string; message?: string }> {
    const { cookie } = configData

    if (!cookie || cookie.length < 50) {
      return { valid: false, error: 'Cookie格式不正确，请确保复制了完整的Cookie' }
    }

    // 微博没有官方API，只能做基本的格式验证
    if (!cookie.includes('SUB') && !cookie.includes('ALF')) {
      return { valid: false, error: 'Cookie可能无效，请确保已登录微博并正确复制Cookie' }
    }

    return { valid: true, message: 'Cookie格式验证通过（实际有效性需发布时验证）' }
  }

  /**
   * 验证抖音配置
   */
  private async validateDouyinConfig(configData: Record<string, any>): Promise<{ valid: boolean; error?: string; message?: string }> {
    const { cookie } = configData

    if (!cookie || cookie.length < 50) {
      return { valid: false, error: 'Cookie格式不正确，请确保复制了完整的Cookie' }
    }

    // 抖音没有官方API，只能做基本的格式验证
    if (!cookie.includes('sessionid') && !cookie.includes('passport_csrf_token')) {
      return { valid: false, error: 'Cookie可能无效，请确保已登录抖音创作者平台并正确复制Cookie' }
    }

    return { valid: true, message: 'Cookie格式验证通过（实际有效性需发布时验证）' }
  }

  /**
   * 验证视频号配置
   */
  private async validateWechatVideoConfig(configData: Record<string, any>): Promise<{ valid: boolean; error?: string; message?: string }> {
    const { app_id, app_secret } = configData

    if (!app_id || !app_secret) {
      return { valid: false, error: '请填写AppID和AppSecret' }
    }

    // 视频号API目前在内测阶段，暂时只能做格式验证
    return { valid: true, message: '配置格式验证通过。视频号API目前在内测阶段，需要申请开通后才能使用自动发布功能。' }
  }

  /**
   * 保存平台配置
   */
  async savePlatformConfig(
    userId: string,
    platform: PlatformType,
    configData: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    const client = getSupabaseClient()

    const { error } = await client
      .from('platform_configs')
      .upsert({
        user_id: userId,
        platform_type: platform,
        config_data: configData,
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform_type'
      })

    if (error) {
      return { success: false, message: `保存失败: ${error.message}` }
    }

    return { success: true, message: '配置保存成功' }
  }

  /**
   * 获取用户的平台配置列表
   */
  async getUserPlatformConfigs(userId: string): Promise<PlatformConfig[]> {
    const client = getSupabaseClient()

    const { data } = await client
      .from('platform_configs')
      .select('*')
      .eq('user_id', userId)

    return (data || []) as PlatformConfig[]
  }

  /**
   * 删除平台配置
   */
  async deletePlatformConfig(userId: string, platform: PlatformType): Promise<{ success: boolean }> {
    const client = getSupabaseClient()

    await client
      .from('platform_configs')
      .delete()
      .eq('user_id', userId)
      .eq('platform_type', platform)

    return { success: true }
  }

  /**
   * 为分身添加技能
   */
  async addAvatarSkill(
    avatarId: string,
    skillType: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean }> {
    const client = getSupabaseClient()

    await client
      .from('avatar_skills')
      .upsert({
        avatar_id: avatarId,
        skill_type: skillType,
        skill_level: 1,
        usage_count: 0,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      }, {
        onConflict: 'avatar_id,skill_type'
      })

    return { success: true }
  }

  /**
   * 获取分身的技能列表
   */
  async getAvatarSkills(avatarId: string): Promise<AvatarSkill[]> {
    const client = getSupabaseClient()

    const { data } = await client
      .from('avatar_skills')
      .select('*')
      .eq('avatar_id', avatarId)

    return (data || []) as AvatarSkill[]
  }

  /**
   * 发布内容到平台
   * 统一的发布接口，调用对应的发布工具
   */
  async publishContent(
    userId: string,
    platform: PlatformType,
    content: {
      title?: string
      content?: string
      cover_url?: string
      images?: string[]
      tags?: string[]
    }
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const client = getSupabaseClient()
    
    // 检查平台配置
    const { data: config, error: configError } = await client
      .from('platform_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('platform_type', platform)
      .maybeSingle()

    if (configError || !config || config.status !== 'active') {
      const template = PLATFORM_CONFIG_TEMPLATES[platform]
      return {
        success: false,
        message: `请先配置${template?.platform_name || platform}`
      }
    }

    // 根据平台选择对应的发布工具
    let toolName: string
    let params: Record<string, any> = {}

    switch (platform) {
      case 'wechat_mp':
        toolName = 'publish_wechat_mp'
        params = {
          title: content.title,
          content: content.content,
          cover_url: content.cover_url
        }
        break
      
      case 'xiaohongshu':
        toolName = 'publish_xiaohongshu'
        params = {
          title: content.title,
          content: content.content,
          images: content.images,
          tags: content.tags
        }
        break
      
      case 'weibo':
        toolName = 'publish_weibo'
        params = {
          content: content.content,
          images: content.images
        }
        break
      
      case 'bilibili':
        toolName = 'publish_bilibili'
        params = {
          type: 'article',
          title: content.title,
          content: content.content,
          cover_url: content.cover_url,
          tags: content.tags
        }
        break
      
      case 'douyin':
        toolName = 'publish_douyin'
        params = {
          title: content.title,
          video_url: content.content, // 抖音需要视频URL
          cover_url: content.cover_url,
          tags: content.tags
        }
        break
      
      case 'wechat_video':
        toolName = 'publish_wechat_video'
        params = {
          title: content.title,
          video_url: content.content, // 视频号需要视频URL
          cover_url: content.cover_url
        }
        break
      
      default:
        return { success: false, message: '不支持的平台' }
    }

    // 执行发布工具
    const tool = this.tools.get(toolName)
    if (!tool) {
      return { success: false, message: '发布工具不可用' }
    }

    const toolContext: ToolContext = {
      userId,
      avatarId: '',
      taskId: `publish-${Date.now()}`
    }

    try {
      console.log(`[AgentService] 发布到 ${platform}:`, params)
      const result = await tool.execute(params, toolContext)
      
      return {
        success: result.success,
        data: result.data,
        message: result.success 
          ? result.data?.message || '发布成功'
          : result.error || '发布失败'
      }
    } catch (err: any) {
      console.error(`[AgentService] 发布失败:`, err)
      return { success: false, message: err.message || '发布失败' }
    }
  }
}
