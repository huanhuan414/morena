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
    }
  ): Promise<AgentExecutionResult> {
    // 初始化上下文
    const context = await this.initContext(userId, avatarId, taskDescription, options)
    
    // 执行 ReAct 循环
    return await this.runReActLoop(context)
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
        finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
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

    const prompt = `你是一个智能Agent，能够使用工具完成任务。

可用工具：
${toolsDescription}

任务：${context.taskDescription}

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
