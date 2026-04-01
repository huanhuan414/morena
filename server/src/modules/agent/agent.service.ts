/**
 * OpenClaw Agent 核心服务
 * 实现 ReAct (Reasoning + Acting) 模式的自主任务执行系统
 */

import { Injectable } from '@nestjs/common'
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

@Injectable()
export class AgentService {
  private tools: Map<string, ITool> = new Map()
  private llmClient: LLMClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    
    // 注册所有工具
    this.registerTools()
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
    // 初始化上下文
    const context = await this.initContext(userId, avatarId, taskDescription, options)
    
    // 执行 ReAct 循环
    const result = await this.runReActLoop(context)
    
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
    
    // 保存用户消息
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage
    })
    
    // 保存 AI 回复
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: aiMessage,
      metadata: { agent_result: agentResult }
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
  private async runReActLoop(context: AgentContext): Promise<AgentExecutionResult> {
    const steps: ReActStep[] = []
    let finalAnswer = ''
    let requiresConfig = false
    let configPlatform: PlatformType | undefined
    let configFields: any[] = []

    while (context.currentStep < context.maxSteps) {
      context.currentStep++
      
      // Step 1: 思考 (Reasoning)
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

      // Step 3: 执行工具 (Acting)
      const toolResult = await this.executeTool(
        actionInfo.action,
        actionInfo.action_input,
        context
      )

      step.observation = toolResult

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

请思考下一步应该做什么。
- 如果需要使用工具，按以下格式回复：
  Thought: [你的思考]
  Action: [工具名称]
  Action Input: [JSON格式的参数]

- 如果任务已完成，按以下格式回复：
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
   * 帮助 Agent 正确理解复合任务
   */
  private getTaskUnderstandingHint(task: string, history: ReActStep[]): string {
    const hints: string[] = []
    
    // 公众号相关任务
    if (task.includes('公众号') && (task.includes('图文') || task.includes('文章') || task.includes('爆款'))) {
      hints.push(`【任务解析】这是一个公众号内容创作任务：
1. 首先使用 write_wechat_mp_article 工具生成公众号爆款图文内容
2. 然后使用 publish_wechat_mp 工具尝试发布到公众号
3. 如果 publish_wechat_mp 返回 requires_config=true，说明用户未配置公众号，需要提示用户配置`)
    }
    
    // 小红书相关任务
    if (task.includes('小红书') && (task.includes('笔记') || task.includes('图文'))) {
      hints.push(`【任务解析】这是一个小红书内容创作任务：
1. 首先使用 write_xiaohongshu_note 工具生成小红书笔记内容
2. 然后使用 publish_xiaohongshu 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置小红书账号`)
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
    return history.map(h => 
      `步骤${h.step_index}:\n思考: ${h.thought}\n行动: ${h.action}\n结果: ${JSON.stringify(h.observation).substring(0, 300)}`
    ).join('\n\n')
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
}
