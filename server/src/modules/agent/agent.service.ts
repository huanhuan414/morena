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
import { LearningService } from '../avatar/learning.service'

// 导入所有工具
import {
  CreateTaskTool,
  UpdateTaskTool,
  DeleteTaskTool,
  ListTasksTool,
  CreateOrderTool,
  CreatePostTool,
  UpdateAvatarTool,
  ListAvatarsTool,
  AssignOrderTool,
  AddFriendTool,
  ListUserFriendsTool,
  ListFriendsTool,
  GetSubscriptionTool,
  SubscribeTool
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
import {
  GenerateShortDramaScriptTool,
  GenerateStoryboardTool,
  ProduceShortDramaTool
} from './tools/shortdrama.tools'
import {
  GenerateMultiEpisodeDramaTool,
  GenerateDramaVoiceoverTool,
  EditShortDramaVideoTool,
  GenerateSubtitleTool,
  RecommendBGMTool
} from './tools/shortdrama-extended.tools'

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
  conversationId?: string
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
    private readonly progressCache: ProgressCacheService,
    private readonly learningService: LearningService
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    
    // 注册所有工具
    this.registerTools()
  }

  /**
   * 推送任务进度（通过 WebSocket + 缓存）
   */
  private emitProgress(
    userId: string,
    type: string,
    message: string,
    data?: any,
    percentage?: number
  ) {
    const taskContext = this.currentTaskMap.get(userId)
    const taskId = taskContext?.taskId || `task-${Date.now()}`

    const progress = {
      taskId,
      userId,
      type,
      action: type, // 兼容前端，action 和 type 相同
      message,
      status: data?.status || 'running',
      percentage: percentage || data?.percentage || 0, // 进度百分比
      data,
      timestamp: Date.now()
    }

    // 通过 WebSocket 推送
    if (this.gateway) {
      this.gateway.emitProgress(userId, progress)
    }

    // 同时保存到缓存（用于轮询）
    this.progressCache.addProgress(userId, progress)

    // 同步更新 assistant 消息的 metadata（用于任务中断后恢复）
    if (taskContext?.conversationId) {
      this.updateAssistantMessageProgress(taskContext.conversationId, userId, taskId, message, percentage)
    }
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
    // 新增工具
    this.tools.set('app_list_avatars', new ListAvatarsTool())
    this.tools.set('app_assign_order', new AssignOrderTool())
    this.tools.set('app_add_friend', new AddFriendTool())
    this.tools.set('app_list_user_friends', new ListUserFriendsTool())
    this.tools.set('app_list_avatar_friends', new ListFriendsTool())
    this.tools.set('app_get_subscription', new GetSubscriptionTool())
    this.tools.set('app_subscribe', new SubscribeTool())

    // 内容创作工具
    this.tools.set('write_article', new WriteArticleTool())
    this.tools.set('write_wechat_mp_article', new WriteWechatMpArticleTool())
    this.tools.set('write_xiaohongshu_note', new WriteXiaohongshuNoteTool())
    this.tools.set('generate_image', new GenerateImageTool())
    this.tools.set('generate_video', new GenerateVideoTool())

    // 短剧制作工具
    this.tools.set('generate_shortdrama_script', new GenerateShortDramaScriptTool())
    this.tools.set('generate_storyboard', new GenerateStoryboardTool())
    this.tools.set('produce_shortdrama', new ProduceShortDramaTool())
    this.tools.set('generate_multi_episode_drama', new GenerateMultiEpisodeDramaTool())
    this.tools.set('generate_drama_voiceover', new GenerateDramaVoiceoverTool())
    this.tools.set('edit_shortdrama_video', new EditShortDramaVideoTool())
    this.tools.set('generate_subtitle', new GenerateSubtitleTool())
    this.tools.set('recommend_bgm', new RecommendBGMTool())

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
   * 根据分身技能获取可用工具
   * @param avatarId 分身 ID
   * @returns 分身可用的工具列表
   */
  async getAvatarTools(avatarId: string): Promise<ToolDefinition[]> {
    try {
      console.log(`[AgentService] 获取分身工具，分身ID: ${avatarId}`)

      // 获取分身的技能列表
      const { data: avatarSkills, error } = await getSupabaseClient()
        .from('avatar_skills')
        .select('skill_type, metadata')
        .eq('avatar_id', avatarId)

      console.log(`[AgentService] 查询分身技能结果:`, {
        error: !!error,
        count: avatarSkills?.length || 0,
        skills: avatarSkills?.map(s => ({ skill_type: s.skill_type, metadata: s.metadata }))
      })

      // 定义基础工具（所有分身都能使用的内部功能）
      const basicTools: string[] = [
        'app_create_task',
        'app_update_task',
        'app_delete_task',
        'app_list_tasks',
        'app_update_avatar',
        'app_list_avatars',
        'app_assign_order',
        'app_add_friend',
        'app_list_user_friends',
        'app_list_avatar_friends',
        'app_subscribe',
        'app_get_subscription',
        'check_platform_config',
        // 内容创作工具（所有分身都能直接使用）
        'write_article',                  // 撰写文章
        'write_wechat_mp_article',        // 撰写公众号爆款图文
        'write_xiaohongshu_note',         // 撰写小红书笔记
        'generate_image',                 // 生成图片
        'generate_video',                 // 生成视频
        // 核心创作工具（所有分身都能直接使用）
        'produce_shortdrama',              // 制作短剧成品
        'generate_shortdrama_script',      // 生成短剧剧本
        'generate_storyboard',             // 生成分镜头脚本
        'generate_multi_episode_drama',    // 生成多集短剧
        'generate_drama_voiceover',        // 生成短剧配音
        'edit_shortdrama_video',           // 剪辑短剧视频
        'generate_subtitle',               // 生成字幕
        'recommend_bgm'                    // 推荐配乐
      ]

      // 如果没有技能，只返回基础工具
      if (error || !avatarSkills || avatarSkills.length === 0) {
        console.log(`[AgentService] ⚠️ 分身没有技能，只返回基础工具`)
        return this.getToolsByNames(basicTools)
      }

      // 获取所有 tool_name 和 skill_id
      const toolNames: string[] = []
      const skillIds: string[] = []

      for (const item of avatarSkills) {
        // 首先使用 skill_type
        if (item.skill_type) {
          toolNames.push(item.skill_type)
        }
        // 然后从 metadata 中获取 skill_id
        if (item.metadata?.skill_id) {
          skillIds.push(item.metadata.skill_id)
        }
      }

      console.log(`[AgentService] 提取的工具名称:`, toolNames)
      console.log(`[AgentService] 提取的技能ID:`, skillIds)

      // 如果有 skill_id，需要从 skills 表中获取 tool_name
      if (skillIds.length > 0) {
        const { data: skills } = await getSupabaseClient()
          .from('skills')
          .select('tool_name')
          .in('id', skillIds)

        if (skills) {
          for (const skill of skills) {
            if (skill.tool_name) {
              toolNames.push(skill.tool_name)
            }
          }
        }
      }

      // 如果技能中没有工具名称，只返回基础工具
      if (toolNames.length === 0) {
        console.log(`[AgentService] ⚠️ 技能列表为空，只返回基础工具`)
        return this.getToolsByNames(basicTools)
      }

      // 返回分身拥有的工具 + 基础工具（任务管理、分身管理等）
      const allToolNames = [...new Set([...basicTools, ...toolNames])]

      console.log(`[AgentService] 最终工具列表:`, allToolNames)

      const result = allToolNames
        .map(toolName => {
          const tool = this.tools.get(toolName)
          return tool ? tool.definition : null
        })
        .filter((t): t is ToolDefinition => t !== null)

      console.log(`[AgentService] 返回工具数量: ${result.length}`)
      return result
    } catch (error) {
      console.error('[AgentService] 获取分身工具失败:', error)
      // 出错时只返回基础工具，而不是所有工具
      const basicTools = [
        'app_create_task',
        'app_update_task',
        'app_delete_task',
        'app_list_tasks',
        'app_update_avatar',
        'app_list_avatars',
        'app_assign_order',
        'app_add_friend',
        'app_list_user_friends',
        'app_list_avatar_friends',
        'app_subscribe',
        'app_get_subscription',
        'check_platform_config'
      ]
      return this.getToolsByNames(basicTools)
    }
  }

  /**
   * 根据工具名称列表获取工具定义
   * @param toolNames 工具名称列表
   * @returns 工具定义列表
   */
  private getToolsByNames(toolNames: string[]): ToolDefinition[] {
    return toolNames
      .map(toolName => {
        const tool = this.tools.get(toolName)
        return tool ? tool.definition : null
      })
      .filter((t): t is ToolDefinition => t !== null)
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
            // 有文章内容，返回简洁提示
            finalAnswer = `✅ ${data.title}`
          } else if (data.image_urls?.length) {
            // 有图片，返回简洁提示
            finalAnswer = `✅ 图片已生成`
          } else {
            finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
          }
        } else {
          finalAnswer = `需要配置${PLATFORM_CONFIG_TEMPLATES[configPlatform!]?.platform_name || '平台'}后才能继续执行任务。`
        }
      } else {
        // 🔴 修复：保留原始媒体数据，不调用 LLM 总结
        // 检查步骤中是否有媒体内容生成
        const mediaStep = steps.find(s => {
          const data = s.observation?.data
          return data?.video_clips || data?.video_url || data?.image_urls || data?.characters || data?.scenes
        })

        if (mediaStep?.observation?.data) {
          const data = mediaStep.observation.data
          // 构建包含完整媒体数据的响应
          finalAnswer = JSON.stringify({
            message: data.message || '内容已生成',
            title: data.title || null,
            script: data.script || null,
            storyboard: data.storyboard || null,
            characters: data.characters || [],
            scenes: data.scenes || [],
            video_clips: data.video_clips || [],
            video_url: data.video_url || null,
            image_urls: data.image_urls || [],
            production_stats: data.production_stats || null
          })
          console.log('[Agent] 检测到媒体内容生成，保留完整数据:', Object.keys(data))
        } else {
          // 没有媒体内容，调用 LLM 总结
          finalAnswer = await this.summarizeExecution(context, steps)
        }
      }
    }

    // 保存对话记录
    if (options?.conversationId) {
      // 清理 finalAnswer 中的调试信息（如图片链接等）
      const cleanedFinalAnswer = this.cleanDebugInfo(finalAnswer)

      // 获取任务上下文
      const taskContext = this.currentTaskMap.get(userId)
      const taskId = taskContext?.taskId || `task-${Date.now()}`

      // 创建初始消息并更新为完成状态
      await this.createInitialAssistantMessage(
        options.conversationId,
        userId,
        avatarId,
        taskDescription,
        taskId
      )

      await this.updateAssistantMessage(
        options.conversationId,
        userId,
        avatarId,
        taskDescription,
        cleanedFinalAnswer,
        { success: !requiresConfig, finalAnswer, steps, requiresConfig, configPlatform, configFields },
        taskId
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
      startTime: Date.now(),
      conversationId: options?.conversationId
    })

    // 清除之前的进度缓存
    this.progressCache.clearProgress(userId)

    // 如果有 conversationId，创建初始的 assistant 消息
    if (options?.conversationId) {
      await this.createInitialAssistantMessage(
        options.conversationId,
        userId,
        avatarId,
        taskDescription,
        taskId
      )
    }

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
        status: 'completed',
        success: result.success,
        requiresConfig: result.requiresConfig
      })

      // 保存对话记录
      if (options?.conversationId) {
        // 清理 finalAnswer 中的调试信息（如图片链接等）
        const cleanedFinalAnswer = this.cleanDebugInfo(result.finalAnswer)

        await this.updateAssistantMessage(
          options.conversationId,
          userId,
          avatarId,
          taskDescription,
          cleanedFinalAnswer,
          result,
          taskId
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
      startTime: Date.now(),
      conversationId: options?.conversationId
    })

    // 如果有 conversationId，创建初始的 assistant 消息（用于保存任务状态）
    if (options?.conversationId) {
      await this.createInitialAssistantMessage(
        options.conversationId,
        userId,
        avatarId,
        taskDescription,
        taskId
      )
    }

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
        status: 'completed',
        success: result.success,
        requiresConfig: result.requiresConfig
      })

      // 保存任务结果到缓存
      this.progressCache.updateTaskStatus(userId, taskId, 'completed', result)

      // 保存对话记录（更新已存在的 assistant 消息）
      if (options?.conversationId) {
        await this.updateAssistantMessage(
          options.conversationId,
          userId,
          avatarId,
          taskDescription,
          result.finalAnswer,
          result,
          taskId
        )
      }

      return result
    } catch (error) {
      // 保存错误信息
      this.progressCache.updateTaskStatus(userId, taskId, 'failed', null, error.message)
      this.emitProgress(userId, 'error', error.message, { status: 'failed' })

      // 更新 assistant 消息为失败状态
      if (options?.conversationId) {
        await this.updateAssistantMessage(
          options.conversationId,
          userId,
          avatarId,
          taskDescription,
          `任务执行失败: ${error.message}`,
          {
            success: false,
            finalAnswer: `任务执行失败: ${error.message}`,
            steps: [],
            requiresConfig: false
          } as AgentExecutionResult,
          taskId
        )
      }

      throw error
    } finally {
      // 清理任务上下文
      this.currentTaskMap.delete(userId)
    }
  }

  /**
   * 创建初始的 assistant 消息（用于保存任务状态）
   * 在任务开始时调用，确保即使任务中断也能恢复进度
   */
  private async createInitialAssistantMessage(
    conversationId: string,
    userId: string,
    avatarId: string,
    taskDescription: string,
    taskId: string
  ): Promise<void> {
    const client = getSupabaseClient()

    // 保存用户消息
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: taskDescription
    })

    // 创建初始的 assistant 消息（content 为空，metadata 包含任务状态）
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      metadata: {
        task_state: {
          taskId,
          taskDescription,
          status: 'running',
          startTime: Date.now(),
          endTime: null,
          progressHistory: []
        }
      }
    })
  }

  /**
   * 更新 assistant 消息的进度信息
   * 在任务执行过程中调用，同步更新消息 metadata 中的进度历史
   */
  private async updateAssistantMessageProgress(
    conversationId: string,
    userId: string,
    taskId: string,
    message: string,
    percentage?: number
  ): Promise<void> {
    try {
      const client = getSupabaseClient()

      // 获取当前的进度历史
      const progressHistory = this.progressCache.getProgress(userId, taskId)

      // 获取最新的 assistant 消息
      const { data: messages } = await client
        .from('messages')
        .select('id, metadata')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1)

      if (messages && messages.length > 0) {
        const lastMessage = messages[0]

        // 更新消息的 metadata
        await client
          .from('messages')
          .update({
            metadata: {
              ...lastMessage.metadata,
              task_state: {
                ...lastMessage.metadata?.task_state,
                status: 'running',
                progressHistory: progressHistory.length > 0 ? progressHistory : undefined,
                lastProgressMessage: message,
                lastProgressPercentage: percentage
              }
            }
          })
          .eq('id', lastMessage.id)
      }
    } catch (error) {
      console.error('[AgentService] 更新 assistant 消息进度失败:', error)
      // 不抛出错误，避免影响任务执行
    }
  }

  /**
   * 更新 assistant 消息（任务完成后调用）
   * 补充 content 和 metadata 中的完整信息
   */
  private async updateAssistantMessage(
    conversationId: string,
    userId: string,
    avatarId: string,
    userMessage: string,
    aiMessage: string,
    agentResult: AgentExecutionResult,
    taskId: string
  ): Promise<void> {
    const client = getSupabaseClient()

    // 提取媒体内容
    const media: Array<{
      type: 'image' | 'video' | 'article' | 'shortdrama_info'
      url?: string
      key?: string  // 添加 key 字段，用于重新生成签名链接
      title?: string
      content?: string
      coverImage?: string
      // 🔴 新增：短剧相关字段
      duration?: number
      script?: string
      storyboard?: string
      characters?: any[]
      scenes?: any[]
      video_clips?: any[]
      edited_video_url?: string
      bgm_recommendations?: any[]
      production_stats?: any
      message?: string
    }> = []

    // 🔴 修复：避免重复提取，先从 finalAnswer JSON 中提取所有媒体（包括短剧特有信息）
    // 这样可以一次性提取所有数据，避免后续从 steps 中重复提取
    const extractedFromFinalAnswer = new Set<string>() // 用于记录已提取的 URL，避免重复

    try {
      if (aiMessage && typeof aiMessage === 'string' && aiMessage.trim().startsWith('{')) {
        const finalAnswerJson = JSON.parse(aiMessage.trim())

        // 提取 video_clips 并添加到 media
        if (finalAnswerJson.video_clips && Array.isArray(finalAnswerJson.video_clips)) {
          console.log('[媒体提取] 从 finalAnswer JSON 中提取视频剪辑:', finalAnswerJson.video_clips.length)
          finalAnswerJson.video_clips.forEach((clip: any) => {
            if (clip.url) {
              extractedFromFinalAnswer.add(clip.url) // 记录已提取的 URL
              media.push({
                type: 'video',
                url: clip.url,
                key: clip.key || undefined,
                title: `镜头 ${clip.clip_number || ''}`
              })
            }
          })
        }

        // 🔴 提取成品视频 URL
        if (finalAnswerJson.edited_video_url) {
          console.log('[媒体提取] 从 finalAnswer JSON 中提取成品视频 URL:', finalAnswerJson.edited_video_url)
          extractedFromFinalAnswer.add(finalAnswerJson.edited_video_url)
          media.push({
            type: 'video',
            url: finalAnswerJson.edited_video_url,
            key: 'edited_video',
            title: '成品视频'
          })
        }

        // 提取单视频 URL
        if (finalAnswerJson.video_url) {
          console.log('[媒体提取] 从 finalAnswer JSON 中提取视频 URL:', finalAnswerJson.video_url)
          extractedFromFinalAnswer.add(finalAnswerJson.video_url)
          media.push({
            type: 'video',
            url: finalAnswerJson.video_url,
            key: finalAnswerJson.video_key || undefined
          })
        }

        // 提取角色形象
        if (finalAnswerJson.characters && Array.isArray(finalAnswerJson.characters)) {
          console.log('[媒体提取] 从 finalAnswer JSON 中提取角色形象:', finalAnswerJson.characters.length)
          finalAnswerJson.characters.forEach((char: any) => {
            if (char.url) {
              extractedFromFinalAnswer.add(char.url)
              media.push({
                type: 'image',
                url: char.url,
                key: char.key || undefined,
                title: char.character || ''
              })
            }
          })
        }

        // 提取场景设计
        if (finalAnswerJson.scenes && Array.isArray(finalAnswerJson.scenes)) {
          console.log('[媒体提取] 从 finalAnswer JSON 中提取场景设计:', finalAnswerJson.scenes.length)
          finalAnswerJson.scenes.forEach((scene: any) => {
            if (scene.url) {
              extractedFromFinalAnswer.add(scene.url)
              media.push({
                type: 'image',
                url: scene.url,
                key: scene.key || undefined,
                title: scene.scene || ''
              })
            }
          })
        }

        // 提取图片数组
        if (finalAnswerJson.image_urls && Array.isArray(finalAnswerJson.image_urls)) {
          console.log('[媒体提取] 从 finalAnswer JSON 中提取图片数组:', finalAnswerJson.image_urls.length)
          finalAnswerJson.image_urls.forEach((url: string) => {
            if (url) {
              extractedFromFinalAnswer.add(url)
              media.push({ type: 'image', url })
            }
          })
        }

        // 🔴 修复：将短剧数据作为一个特殊的媒体项插入（避免 TypeScript 编译错误）
        if (finalAnswerJson.title || finalAnswerJson.script || finalAnswerJson.bgm_recommendations) {
          console.log('[媒体提取] 插入短剧信息媒体项')
          media.unshift({
            type: 'shortdrama_info',
            title: finalAnswerJson.title,
            duration: finalAnswerJson.duration,
            script: finalAnswerJson.script,
            storyboard: finalAnswerJson.storyboard,
            characters: finalAnswerJson.characters,
            scenes: finalAnswerJson.scenes,
            video_clips: finalAnswerJson.video_clips,
            edited_video_url: finalAnswerJson.edited_video_url,
            bgm_recommendations: finalAnswerJson.bgm_recommendations,
            production_stats: finalAnswerJson.production_stats,
            message: finalAnswerJson.message
          })
        }
      }
    } catch (error) {
      console.log('[媒体提取] finalAnswer 不是 JSON 格式，使用常规提取方式')
    }

    // 🔴 修复：从 steps 中提取媒体内容时，避免重复提取已经在 finalAnswer 中提取过的内容
    agentResult.steps.forEach(step => {
      if (step.observation?.data) {
        const data = step.observation.data

        // 图片 - 支持单个 url 和 image_urls 数组两种格式
        if (data.url && typeof data.url === 'string') {
          // 🔴 修复：检查是否已经提取过
          if (!extractedFromFinalAnswer.has(data.url)) {
            console.log('[媒体提取] 提取单个图片 URL:', data.url, 'key:', data.key)
            const mediaItem: any = { type: 'image', url: data.url }
            if (data.key) {
              mediaItem.key = data.key
            }
            console.log('[媒体提取] 准备添加的 mediaItem:', mediaItem)
            media.push(mediaItem)
            extractedFromFinalAnswer.add(data.url) // 记录已提取
          }
        }
        if (data.image_urls && Array.isArray(data.image_urls)) {
          // URL数组
          console.log('[媒体提取] 提取图片数组:', data.image_urls)
          data.image_urls.forEach((url: string) => {
            if (url && typeof url === 'string' && !extractedFromFinalAnswer.has(url)) {
              media.push({ type: 'image', url })
              extractedFromFinalAnswer.add(url)
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

        // 🔴 修复：视频剪辑数组 - 检查是否已经提取过
        if (data.video_clips && Array.isArray(data.video_clips)) {
          console.log('[媒体提取] 检查视频剪辑数组，已从 finalAnswer 提取:', extractedFromFinalAnswer.size)
          data.video_clips.forEach((clip: any) => {
            if (clip.url && !extractedFromFinalAnswer.has(clip.url)) {
              console.log('[媒体提取] 从 steps 中提取视频剪辑:', clip.url)
              media.push({
                type: 'video',
                url: clip.url,
                key: clip.key || undefined,
                title: clip.clip_number ? `镜头 ${clip.clip_number}` : undefined
              })
              extractedFromFinalAnswer.add(clip.url) // 记录已提取
            }
          })
        }

        // 🔴 修复：单个视频 - 检查是否已经提取过
        if (data.video_url && !extractedFromFinalAnswer.has(data.video_url)) {
          console.log('[媒体提取] 从 steps 中提取视频 URL:', data.video_url, 'key:', data.video_key || data.key)
          media.push({
            type: 'video',
            url: data.video_url,
            key: data.video_key || data.key  // 保存 key 用于重新生成签名链接
          })
          extractedFromFinalAnswer.add(data.video_url) // 记录已提取
          console.log('[媒体提取] 已添加视频到 media 列表，当前 media 数量:', media.length)
        }

        // 封面图（单独展示）
        if (data.cover_image_url && !data.content && !extractedFromFinalAnswer.has(data.cover_image_url)) {
          console.log('[媒体提取] 提取封面图 URL:', data.cover_image_url)
          media.push({ type: 'image', url: data.cover_image_url })
          extractedFromFinalAnswer.add(data.cover_image_url)
        }
      }
    })

    console.log('[媒体提取] 最终提取的媒体列表:', media)

    // 获取当前任务上下文
    const taskContext = this.currentTaskMap.get(userId)

    // 获取进度缓存的所有进度历史（用于恢复任务进度）
    const progressHistory = this.progressCache.getProgress(userId, taskId)

    // 获取最新的 assistant 消息（包含 metadata）
    const { data: messages } = await client
      .from('messages')
      .select('id, metadata')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)

    if (messages && messages.length > 0) {
      const lastMessage = messages[0]

      console.log('[AgentService updateAssistantMessage] 准备更新消息:', {
        messageId: lastMessage.id,
        原有metadata: (lastMessage as any).metadata,
        新mediaCount: media.length,
        新media: media,
        新agentResultStepsCount: agentResult?.steps?.length || 0
      })

      // 检查 agentResult 是否有效，如果无效则不更新（保留原有数据）
      const hasValidAgentResult = agentResult && agentResult.steps && agentResult.steps.length > 0
      const hasValidMedia = media && media.length > 0

      console.log('[AgentService updateAssistantMessage] 数据有效性检查:', {
        hasValidAgentResult,
        hasValidMedia,
        mediaList: media,
        mediaTypes: media.map(m => m.type),
        mediaCount: media.length
      })

      // 只在有有效数据时才更新，避免覆盖原有数据
      const updateData: any = {
        content: aiMessage
      }

      if (hasValidAgentResult || hasValidMedia) {
        // 保留原有的 metadata，只更新必要的字段
        const existingMetadata = (lastMessage as any).metadata || {}
        updateData.metadata = {
          ...existingMetadata,
          // 🔴 修复：任务完成后，清除 task_state，避免前端一直显示"正在思考"
          // 如果任务已完成，就不需要保留 task_state 了
          ...(existingMetadata.task_state ? {} : {}), // 移除 task_state
          agent_result: hasValidAgentResult ? agentResult : existingMetadata.agent_result,
          media: hasValidMedia ? media : existingMetadata.media
        }

        // 如果 metadata 中还有 task_state，显式删除它
        if (updateData.metadata.task_state) {
          delete updateData.metadata.task_state
        }

        console.log('[AgentService updateAssistantMessage] 准备更新的 metadata.media:', {
          mediaCount: updateData.metadata.media?.length || 0,
          mediaTypes: updateData.metadata.media?.map(m => m.type) || [],
          media: updateData.metadata.media
        })

        console.log('[AgentService updateAssistantMessage] 最终更新的 metadata:', updateData.metadata)
      } else {
        console.log('[AgentService updateAssistantMessage] 没有有效数据，只更新 content')
      }

      console.log('[AgentService updateAssistantMessage] 更新消息:', {
        messageId: lastMessage.id,
        hasValidAgentResult,
        hasValidMedia,
        stepsCount: agentResult?.steps?.length || 0,
        mediaCount: media?.length || 0
      })

      await client
        .from('messages')
        .update(updateData)
        .eq('id', lastMessage.id)
    }

    // 更新对话上下文
    const { data: conversation } = await client
      .from('conversations')
      .select('context')
      .eq('id', conversationId)
      .single()

    // 确保 currentContext 是数组
    let currentContext: ConversationMessage[] = []
    if (conversation?.context) {
      const ctx = conversation.context
      // 处理 Supabase 返回的 map 格式（如 map[key: value]）
      if (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) {
        // 检查是否是 map 格式（只有一个属性）
        const keys = Object.keys(ctx)
        if (keys.length === 1 && keys[0].startsWith('friend_id:')) {
          // 这是 friend_id 格式，忽略，使用空数组
          currentContext = []
        } else {
          // 假设是标准的 JSON 数组格式
          currentContext = ctx as any
        }
      } else if (Array.isArray(ctx)) {
        currentContext = ctx
      }
    }

    // 添加新的对话上下文
    currentContext.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiMessage }
    )

    // 只保留最近 20 条消息
    if (currentContext.length > 20) {
      currentContext = currentContext.slice(-20)
    }

    // 更新对话上下文
    await client
      .from('conversations')
      .update({ context: currentContext })
      .eq('id', conversationId)
  }

  /**
   * 清理消息中的调试信息
   * 移除工具返回的调试信息（如"图片链接如下：https://..."）
   */
  private cleanDebugInfo(content: string): string {
    if (!content || typeof content !== 'string') return content

    let cleaned = content

    // 🔴 优先处理：移除"Image: [URL]"格式（包含中英文）- 匹配整行
    // 使用更简单的正则：匹配 Image: 开头，后跟任何内容直到行尾
    cleaned = cleaned.replace(/^Image[图片]?\s*[:：].*$/gim, '')

    // 🔴 优先处理：移除"Video: [URL]"格式（包含中英文）- 匹配整行
    cleaned = cleaned.replace(/^Video[视频]?\s*[:：].*$/gim, '')

    // 🔴 优先处理：移除"图片：[URL]"和"图片:[URL]"格式 - 匹配整行
    cleaned = cleaned.replace(/^图片\s*[:：].*$/gim, '')

    // 🔴 优先处理：移除"视频：[URL]"和"视频:[URL]"格式 - 匹配整行
    cleaned = cleaned.replace(/^视频\s*[:：].*$/gim, '')

    // 移除 Coze 临时文件代理链接（包含 file_path 参数的链接）
    cleaned = cleaned.replace(/https?:\/\/code\.coze\.cn\/api\/sandbox\/[^\s\n]+/gi, '')

    // 移除所有 TOS 对象存储链接（ark-content-generation-v2）
    // 匹配模式：https://ark-content-generation-v2-*.tos-cn-*.volces.com/...
    cleaned = cleaned.replace(/https?:\/\/ark-content-generation-v2[\w-]+\.tos-cn-[\w-]+\.volces\.com\/[^\s\n]*/gi, '')

    // 移除"已为您生成.*链接如下："模式（包含后续的多个链接）
    cleaned = cleaned.replace(/已为您?生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

    // 移除"已为你生成.*链接如下："模式（包含后续的多个链接）
    cleaned = cleaned.replace(/已为你生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

    // 移除"图片链接如下："模式（移除行内的URL）
    cleaned = cleaned.replace(/图片链接如下[::：]\s*\d*[\.、]?\s*https?:\/\/[^\s\n]+/gi, '')

    // 移除"视频链接如下："模式
    cleaned = cleaned.replace(/视频链接如下[::：]\s*\d*[\.、]?\s*https?:\/\/[^\s\n]+/gi, '')

    // 移除"已为你生成.*配图"模式（包含后续的链接信息）
    cleaned = cleaned.replace(/已为你生成.*配图[，,]\s*图片链接如下[::：]\s*https?:\/\/[^\s\n]+/gi, '')

    // 移除独立的链接行（单独一行的URL）
    cleaned = cleaned.replace(/^\s*\d+[\.、]\s*https?:\/\/[^\s\n]+$/gm, '')

    // 移除"链接如下："引导的多链接列表
    cleaned = cleaned.replace(/链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

    // 移除多余的空行
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

    return cleaned.trim()
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

    // 获取分身信息
    const { data: avatarInfo } = await client
      .from('avatars')
      .select('name, description, personality, level, avatar_url')
      .eq('id', avatarId)
      .single()

    console.log('[AgentService] 获取分身信息:', { avatarId, avatarInfo })

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
        // 确保 context 是数组格式
        const ctx = conversation.context
        if (Array.isArray(ctx)) {
          conversationHistory = ctx as ConversationMessage[]
        } else if (typeof ctx === 'string') {
          // 如果是 JSON 字符串，尝试解析
          try {
            conversationHistory = JSON.parse(ctx) as ConversationMessage[]
          } catch (e) {
            console.error('[Agent] 解析对话历史失败:', e)
            conversationHistory = []
          }
        } else {
          console.warn('[Agent] conversation.context 格式不正确:', typeof ctx)
          conversationHistory = []
        }
      }
    }

    // 获取分身的工具列表（基于技能）
    const availableTools = await this.getAvatarTools(avatarId)

    return {
      userId,
      avatarId,
      avatarInfo: avatarInfo || undefined,
      conversationId: options?.conversationId,
      taskId: options?.taskId,
      taskDescription,
      availableTools,
      platformConfigs: platformMap,
      avatarSkills: (avatarSkills || []) as AvatarSkill[],
      executionHistory: [],
      conversationHistory,
      maxSteps: 50, // 增加最大步数，支持复杂多步任务
      currentStep: 0
    }
  }

  /**
   * 执行 ReAct 循环
   * Reasoning -> Acting -> Observing -> 循环或结束
   */
  private async runReActLoop(context: AgentContext, userId: string): Promise<AgentExecutionResult> {
    // 【前置检查】技能检测 - 如果缺少技能，直接返回答案，不执行任何操作
    const skillCheckResult = this.checkRequiredSkills(context.taskDescription, context.availableTools)
    if (skillCheckResult.missing.length > 0) {
      const missingSkillNames = skillCheckResult.missing.map(s => this.getToolDisplayNameChinese(s.toolName)).join('、')
      const finalAnswer = `检测到您的分身缺少以下技能：${missingSkillNames}

请前往技能广场添加这些技能后，再重新发送相同指令，我会帮您完成${context.taskDescription}主题短剧成品的生成任务。`

      console.log(`[AgentService] 检测到缺少技能: ${missingSkillNames}，直接返回答案`)

      // 保存错误信息到缓存
      const taskId = context.taskId || `task-${Date.now()}`
      this.progressCache.updateTaskStatus(userId, taskId, 'failed', null, finalAnswer)

      // 推送错误事件
      this.emitProgress(userId, 'error', finalAnswer, { status: 'failed' })

      return {
        success: false,
        finalAnswer,
        steps: [],
        requiresConfig: false
      }
    }

    const steps: ReActStep[] = []
    let finalAnswer = ''
    let requiresConfig = false
    let configPlatform: PlatformType | undefined
    let configFields: any[] = []

    while (context.currentStep < context.maxSteps) {
      context.currentStep++

      // 计算当前进度百分比（简单估算：思考阶段 0-20%，执行阶段 20-80%，完成 100%）
      const progressPercentage = Math.min(20 + ((context.currentStep - 1) / context.maxSteps) * 60, 80)

      // Step 1: 思考 (Reasoning)
      this.emitProgress(
        userId,
        'thinking',
        `正在思考第 ${context.currentStep} 步...`,
        {},
        progressPercentage
      )
      const thought = await this.think(context, steps)

      // 🔴 修复：不要在思考阶段就返回 final_answer，强制执行工具
      // 检查是否已经有最终答案
      if (thought.includes('Final Answer:') || thought.includes('最终答案:')) {
        const potentialFinalAnswer = this.extractFinalAnswer(thought)

        // 🔴 修复：检查是否包含短剧相关关键词（镜头、画面等）但没有视频数据
        // 🔴 修复：添加更严格的判断条件，避免将普通文本误判为短剧
        const hasDramaKeywords = /镜头|画面|场景|角色|视频|剧本|短剧/gi.test(potentialFinalAnswer)
        const hasMedia = this.hasMediaContent(potentialFinalAnswer)
        const hasVideo = this.hasVideoContent(potentialFinalAnswer)  // 🔴 新增：专门检查视频

        // 🔴 修复：只有当明确是短剧任务（任务描述包含"短剧"、"制作视频"等）时，才强制调用工具
        // 如果只是普通文本包含"镜头"等关键词，不强制调用
        const isDramaTask = /短剧|制作视频|生成视频|视频成品|真人短剧/i.test(context.taskDescription)

        if (hasDramaKeywords && !hasVideo && isDramaTask) {
          // 🔴 修复：如果包含短剧关键词但缺少视频数据，且明确是短剧任务，说明 LLM 只是生成了文本，没有调用工具
          console.log('[AgentService] 警告：检测到短剧任务，但生成的内容没有视频数据，强制调用 produce_shortdrama...')

          // 🔴 修复：不重新赋值 thought，而是直接执行工具调用逻辑
          // 根据任务描述构建参数
          const toolInput = this.extractShortdramaParams(context.taskDescription, potentialFinalAnswer)
          console.log('[AgentService] 强制调用 produce_shortdrama 工具:', toolInput)

          // 🔴 修复：直接调用工具
          const toolResult = await this.executeTool('produce_shortdrama', toolInput, context)

          // 🔴 修复：将工具结果作为 observation
          const observation = `Observation: ${JSON.stringify(toolResult)}`
          steps.push({
            step_index: steps.length,
            thought,
            action: 'produce_shortdrama',
            action_input: toolInput,
            observation
          })

          // 🔴 修复：检查工具结果，判断是否完成
          if (toolResult.success && toolResult.data) {
            // 🔴 修复：将工具结果转换为 final_answer
            finalAnswer = JSON.stringify(toolResult.data)
            // 完成思考，进度到 90%
            this.emitProgress(userId, 'complete', '思考完成，生成答案中...', {}, 90)
            break
          } else {
            // 🔴 修复：如果工具执行失败，立即返回错误信息
            console.error('[AgentService] 工具执行失败:', toolResult.error)
            finalAnswer = `抱歉，${toolResult.error || '短剧制作失败'}`
            // 标记为失败状态
            this.emitProgress(userId, 'failed', '任务执行失败', {}, 100)
            break
          }
        } else if (hasVideo) {
          // 如果包含视频数据，说明工具已经执行完成，可以返回
          finalAnswer = potentialFinalAnswer
          // 完成思考，进度到 90%
          this.emitProgress(userId, 'complete', '思考完成，生成答案中...', {}, 90)
          break
        } else {
          // 如果只是普通文本（不是短剧任务），可以返回
          finalAnswer = potentialFinalAnswer
          // 完成思考，进度到 90%
          this.emitProgress(userId, 'complete', '思考完成，生成答案中...', {}, 90)
          break
        }
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

      // 推送执行中状态（进度在 20-80% 之间）
      const actionProgress = Math.min(progressPercentage + 10, 80)
      this.emitProgress(
        userId,
        'action',
        `正在执行: ${toolDisplayName}`,
        {
          action: actionInfo.action,
          displayName: toolDisplayName,
          params: actionInfo.action_input,
          status: 'running'
        },
        actionProgress
      )

      // Step 3: 执行工具 (Acting)
      const toolResult = await this.executeTool(
        actionInfo.action,
        actionInfo.action_input,
        context
      )

      step.observation = toolResult

      // 推送执行结果（工具可能返回自己的进度）
      const toolPercentage = (toolResult as any).percentage || (actionProgress + 10)
      this.emitProgress(
        userId,
        'observation',
        toolResult.success ? '执行成功' : '执行失败',
        {
          action: actionInfo.action,
          displayName: toolDisplayName,
          success: toolResult.success,
          status: toolResult.success ? 'completed' : 'failed',
          message: toolResult.data?.message || toolResult.error,
          data: toolResult.data
        },
        toolPercentage
      )

      // 🔴 关键修复：如果工具执行失败，且是关键步骤（如生成视频），则停止循环并返回失败
      if (!toolResult.success) {
        console.error(`[AgentService] 工具执行失败，停止任务: ${actionInfo.action}`, toolResult.error)
        finalAnswer = toolResult.error || `工具执行失败: ${toolDisplayName}`
        break
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
        break
      }

      steps.push(step)

      // 记录日志
      await this.logStep(context, step, toolResult)

      // Step 4: 观察 (Observation) - 更新上下文
      context.executionHistory = steps

      // 检查是否是技能缺失错误
      if (!toolResult.success && toolResult.error?.includes('您的分身尚未添加该功能')) {
        // 直接返回技能缺失错误，不继续执行
        finalAnswer = toolResult.error
        console.log(`[Agent] 检测到技能缺失错误，直接返回: ${finalAnswer}`)
        break
      }
    }

    // 如果没有生成最终答案，基于步骤生成
    if (!finalAnswer) {
      if (requiresConfig) {
        // 检查是否有已生成的内容
        const generatedContent = steps.find(s => s.observation?.data?.content || s.observation?.data?.image_urls)
        if (generatedContent?.observation?.data) {
          const data = generatedContent.observation.data
          if (data.title && data.content) {
            // 有文章内容，返回简洁提示
            finalAnswer = `✅ ${data.title}`
          } else if (data.image_urls?.length) {
            // 有图片，返回简洁提示
            finalAnswer = `✅ 图片已生成`
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

    // 构建分身身份信息
    let avatarInfoText = ''
    if (context.avatarInfo) {
      avatarInfoText = `
【分身身份信息】
- 名字：${context.avatarInfo.name}
- 描述：${context.avatarInfo.description || '无'}
- 性格：${context.avatarInfo.personality || '无'}
- 等级：${context.avatarInfo.level || 1}

重要提示：你是一个AI分身，名字叫"${context.avatarInfo.name}"。用户正在与你进行对话。当用户询问你的身份或是否是分身时，请明确告知用户你的名字和身份，不要说"我没有创建任何分身"之类的错误回答。
`
      console.log('[AgentService] 分身身份信息已生成:', avatarInfoText)
    } else {
      console.log('[AgentService] 警告：context.avatarInfo 为空，分身无法识别自己的身份')
    }

    // 智能任务理解提示（不包含技能检测，因为已经在前面处理了）
    const taskUnderstandingHint = this.getTaskUnderstandingHint(context.taskDescription, history, context)

    const prompt = `你是一个智能Agent，能够使用工具完成任务。

${avatarInfoText}

可用工具：
${toolsDescription}

${conversationHistoryText ? `对话历史：\n${conversationHistoryText}\n` : ''}

当前任务：${context.taskDescription}

${taskUnderstandingHint}

${historyText ? `执行历史：\n${historyText}\n` : ''}

【重要规则】
1. **多步指令识别（CRITICAL）**：用户的指令可能包含多个子任务，使用"，"、"、"或"并"、"然后"等词分隔。
   - 示例："找50个分身，做50张海报" 包含两个任务：【找分身】和【做海报】
   - 示例："帮我生成海报，发布到小红书" 包含两个任务：【生成海报】和【发布小红书】
   - 示例："生成营销方案，并生成5张海报，然后找50个分身分发" 包含三个任务：【生成营销方案】、【生成5张海报】、【找50个分身分发】
   - **必须先分析指令中的所有子任务，然后按顺序逐个执行，不能遗漏任何子任务**
   - **执行完所有子任务后，才能返回 Final Answer**
   - **如果在执行过程中已经生成了部分内容，不要提前返回，必须继续执行剩余的子任务**
   - 如果包含"查看分身"、"找分身"、"添加好友"等内部功能操作，优先执行这些操作

2. 只有当用户明确要求"生成图片"、"画图"、"设计图片"、"生成视频"、"写文章"、"发布内容"、"生成短剧"、"制作短剧"等创作类任务时，才调用对应的工具。
3. 对于普通对话、问候、咨询、关注、点赞等社交互动，直接用Final Answer回复，不要调用任何工具。
4. 如果用户只是说"关注"、"点赞"、"分享"等，这是普通社交行为，不需要调用工具，直接回复即可。
5. 不要随意调用generate_image、generate_video或produce_shortdrama工具，除非用户明确要求创作图片、视频或短剧。
6. 【短剧工具使用规则】
   - 当用户要求"生成短剧"、"制作短剧"、"真人短剧"、"短剧成品"时，必须使用 produce_shortdrama 工具
   - 当用户要求"多集短剧"、"连续短剧"、"系列短剧"时，必须使用 generate_multi_episode_drama 工具
   - 当用户明确要求"只要剧本"、"剧本文字"时，才使用 generate_shortdrama_script 工具
   - 短剧工具会自动生成剧本、角色形象、场景设计和视频，不需要分步调用多个工具

7. 【公众号文章生成和发布规则（CRITICAL）】
   - 当使用 write_wechat_mp_article 工具生成公众号文章后：
     - **如果用户没有明确要求发布**：在 Final Answer 中明确告知"文章已生成，你可以在上方查看完整内容"，并提供如何发布的指引
     - **不要说"已成功保存到公众号草稿箱"**，因为实际上并没有调用发布接口
     - **明确告知用户**：
       1. 文章已生成（包含标题、正文、封面图）
       2. 文章显示在当前对话中（在上方）
       3. 如何发布到公众号：需要绑定微信公众号授权后，可以使用"发布到公众号"功能
     - **示例回复**："✅ 公众号文章已生成！你可以在上方查看完整内容（包含标题、正文和封面图）。如需发布到微信公众号，请先绑定公众号授权，然后发送'发布到公众号'即可。"
   - **如果用户明确要求"发布到公众号"**：才使用 publish_wechat_mp 工具将文章发布到公众号

【多步指令执行规则】
- 当识别到多步指令时，必须按顺序执行所有子任务
- 每完成一个子任务后，继续思考下一步要做什么
- 不要在完成第一个子任务后就返回 Final Answer
- 不要因为已经生成了部分内容就认为任务完成
- 只有所有子任务都执行完成后，才能返回 Final Answer

【小程序内部功能】
当用户指令涉及以下关键词时，必须优先调用对应的小程序内部功能工具：
- "分配订单"、"派单"、"接单"（不包含"查看"或"寻找"时） → 使用 app_assign_order 工具
- "找分身"、"寻找分身"（作为独立任务时）→ 使用 app_list_avatars 工具查看分身列表
- **注意**：在多步指令中，"找X个分身"通常是任务的后续步骤，不要单独执行，要等待前面的任务完成后再执行
- "添加好友"、"交朋友"、"扩列" → 使用 app_add_friend 工具
- "我的好友"、"我有多少好友"、"查看好友"、"好友列表" → 使用 app_list_user_friends 工具（查询用户的好友）
- "分身的好友"、"分身有多少好友" → 使用 app_list_avatar_friends 工具（查询分身的好友）
- "订阅"、"升级"、"开通套餐" → 使用 app_subscribe 或 app_get_subscription 工具
- "创建任务"、"发布任务" → 使用 app_create_task 工具
- "查看订单"、"我的订单" → 使用 app_list_tasks 工具

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
   * 注意：技能缺失检测已在 think 方法前置处理，此处不包含技能检测逻辑
   */
  private getTaskUnderstandingHint(task: string, history: ReActStep[], context: AgentContext): string {
    const hints: string[] = []
    const lowerTask = task.toLowerCase()

    // 【多步指令检测】 - 优先检测包含分隔符的复合指令
    // 支持的分隔符：中文逗号、顿号、英文逗号、"并"、"然后"、"接下来"、"之后"、"同时"、"以及"、"还有"、"再"
    const hasMultiStepTask = /[，、,并然后接下来之后同时以及还有再]\s*(找|生成|做|画|创作|写|发布|添加|分配|发)/.test(task)
    if (hasMultiStepTask) {
      // 按多种分隔符拆分
      const subTasks = task.split(/[，、,并然后接下来之后同时以及还有再]/)
        .map(t => t.trim())
        .filter(t => t.length > 0)

      // 检查是否有"找分身分发"模式
      const hasFindAndDistribute = subTasks.some(t =>
        /找.*分身.*分发|找.*人.*分发|分配.*分身|派.*分身/.test(t)
      )

      let executionStrategy = `【执行策略】必须按顺序逐个执行每个子任务，不能遗漏任何子任务。`

      if (hasFindAndDistribute) {
        executionStrategy += `
【关键提示】检测到"找分身分发"任务：
- 这应该使用 app_assign_order 工具（分配订单/找分身）
- 该工具会根据订单需求、分身等级、优先级等智能匹配最合适的分身
- 系统会自动为匹配的分身创建订单执行记录
- 不要使用 app_list_avatars 工具（那是查看分身列表）
- app_assign_order 工具参数示例：
  {
    "title": "订单标题（从前面任务中提取）",
    "description": "订单详细描述（结合营销方案内容）",
    "required_count": 50,
    "priority_level": "high"
  }`
      }

      hints.push(`【多步指令识别】检测到 ${subTasks.length} 个子任务：\n${subTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`)
      hints.push(executionStrategy)
      hints.push(`【重要提示】如果子任务中包含"找分身"、"寻找分身"，这是后续步骤，不要单独提前执行。`)
      return hints.join('\n\n') // 多步任务直接返回，不继续匹配其他规则
    }

    // 优先级最高：小程序内部功能任务（使用 if-else 确保只匹配一个）
    // 注意：找分身/分配订单任务需要明确是"分配"场景，否则默认为查看分身列表
    if (lowerTask.match(/分配.*订单|派单|接单|分配任务|派任务/) && !lowerTask.match(/查看|寻找|找分身列表|我的分身/)) {
      hints.push(`【任务解析】这是一个订单分配/派单任务：
请使用 app_assign_order 工具为订单分配合适的分身。
参数示例：{ "title": "任务标题", "description": "任务描述", "required_count": 需要的分身数量 }
执行步骤：
1. 首先调用 app_assign_order 创建订单并分配分身
2. 如果还需要其他操作（如生成海报），继续执行后续步骤`)
      return hints.join('\n\n')
    }
    // "找分身"、"寻找分身"等关键词优先映射到查看分身列表，而不是分配订单
    else if (lowerTask.match(/找.*分身|寻找.*分身|我的.*分身|分身.*列表|列表.*分身|分身.*信息|当前.*分身|分身.*详情/)) {
      hints.push(`【任务解析】这是一个查看分身列表任务：
请使用 app_list_avatars 工具获取用户的分身列表。
参数示例：{ "limit": 50, "filter_hosted": false }`)
      return hints.join('\n\n')
    }
    else if (lowerTask.match(/添加好友|交朋友|扩列/)) {
      hints.push(`【任务解析】这是一个添加好友任务：
请使用 app_add_friend 工具为分身添加好友。
参数示例：{ "avatar_id": "当前分身ID", "match_count": 需要添加的数量 }`)
      return hints.join('\n\n')
    }
    else if (lowerTask.match(/查看.*好友|我的.*好友|好友列表|好友.*信息/)) {
      hints.push(`【任务解析】这是一个查看好友列表任务：
请使用 app_list_friends 工具获取指定分身的好友列表。
参数示例：{ "limit": 50 }`)
      return hints.join('\n\n')
    }
    else if (lowerTask.match(/订阅|升级|开通|购买套餐|套餐/)) {
      hints.push(`【任务解析】这是一个订阅套餐任务：
请先使用 app_get_subscription 工具查看当前订阅状态，然后根据用户需求使用 app_subscribe 工具订阅套餐。`)
      return hints.join('\n\n')
    }

    // 2. 图片生成任务
    if (lowerTask.match(/生成.*图|画.*图|设计.*图|做.*图|创作.*图|生成图片|画张图|做个图|海报/)) {
      hints.push(`【任务解析】这是一个图片生成任务：
请直接使用 generate_image 工具生成图片，不要使用其他工具。
参数示例：{ "prompt": "图片详细描述", "style": "realistic" }
style 可选值：realistic（写实）、artistic（艺术）、anime（动漫）、3d（3D效果）、logo（Logo设计）`)
      return hints.join('\n\n')
    }
    // 3. 视频生成任务
    else if (lowerTask.match(/生成.*视频|做.*视频|创作.*视频|生成视频|做个视频/)) {
      hints.push(`【任务解析】这是一个视频生成任务：
请直接使用 generate_video 工具生成视频，不要使用其他工具。
参数示例：{ "prompt": "视频内容描述", "duration": 5, "ratio": "9:16" }`)
      return hints.join('\n\n')
    }
    // 4. 社交互动/普通对话（优先检测，避免误判）
    else if (lowerTask.match(/^关注|点赞|收藏|分享|转发|评论|回复|你好|在吗|嗨|hi|hello|谢谢|感谢|再见|拜拜/) ||
             lowerTask.match(/帮我关注|帮我点赞|帮我收藏|帮我分享/) ||
             lowerTask.match(/^.{0,20}$/) && !lowerTask.match(/生成|创作|设计|写|画|发布|找|分配|添加|订阅|升级|查看|分身|信息|好友/)) {
      hints.push(`【任务解析】这是一个普通对话或社交互动：
请直接用 Final Answer 回复用户，不要调用任何工具。
- 如果用户说"关注"，回复"好的，已为你关注该话题/用户"
- 如果用户说"点赞"，回复"好的，已为你点赞"
- 如果用户只是问候，友好地回复问候
- 不要调用 generate_image、generate_video 等工具`)
      return hints.join('\n\n')
    }
    // 5. 微信公众号任务
    else if (lowerTask.includes('公众号') || lowerTask.includes('微信文章') || lowerTask.includes('微信图文')) {
      hints.push(`【任务解析】这是一个微信公众号内容创作任务：
1. 首先使用 write_wechat_mp_article 工具生成公众号爆款图文内容
2. 然后使用 publish_wechat_mp 工具尝试发布到公众号
3. 如果 publish_wechat_mp 返回 requires_config=true，说明用户未配置公众号，需要提示用户配置`)
      return hints.join('\n\n')
    }
    // 6. 小红书任务
    else if (lowerTask.includes('小红书') || lowerTask.includes('红书笔记')) {
      hints.push(`【任务解析】这是一个小红书内容创作任务：
1. 首先使用 write_xiaohongshu_note 工具生成小红书笔记内容
2. 然后使用 publish_xiaohongshu 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置小红书账号`)
      return hints.join('\n\n')
    }
    // 7. 微博任务
    else if (lowerTask.includes('微博') && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个微博内容创作任务：
1. 首先使用 write_article 工具生成微博内容（简短、话题性强）
2. 然后使用 publish_weibo 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置微博账号`)
      return hints.join('\n\n')
    }
    // 8. 抖音任务
    else if ((lowerTask.includes('抖音') || lowerTask.includes('tiktok')) && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个抖音内容创作任务：
1. 首先生成视频内容（使用 generate_video 或提供视频脚本）
2. 然后使用 publish_douyin 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置抖音账号`)
      return hints.join('\n\n')
    }
    // 9. B站任务
    else if ((lowerTask.includes('b站') || lowerTask.includes('哔哩') || lowerTask.includes('bilibili')) && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个B站内容创作任务：
1. 首先生成视频或文章内容
2. 然后使用 publish_bilibili 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置B站账号`)
      return hints.join('\n\n')
    }
    // 10. 微信视频号任务
    else if (lowerTask.includes('视频号') && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个微信视频号内容创作任务：
1. 首先生成视频内容
2. 然后使用 publish_wechat_video 工具尝试发布
3. 如果发布工具返回 requires_config=true，说明用户未配置视频号`)
      return hints.join('\n\n')
    }
    // 11. 今日头条任务
    else if ((lowerTask.includes('头条') || lowerTask.includes('今日头条')) && (lowerTask.includes('发') || lowerTask.includes('写') || lowerTask.includes('创作') || lowerTask.includes('生成'))) {
      hints.push(`【任务解析】这是一个今日头条内容创作任务：
1. 首先使用 write_article 工具生成头条文章内容
2. 注意：今日头条暂未集成，请告知用户当前支持的平台：微信公众号、小红书、微博、抖音、B站、微信视频号`)
      return hints.join('\n\n')
    }
    // 12. 通用文章写作
    else if (lowerTask.match(/写.*文章|撰写.*文|生成.*文|创作.*文/) && !lowerTask.includes('公众号') && !lowerTask.includes('小红书')) {
      hints.push(`【任务解析】这是一个通用文章写作任务：
请使用 write_article 工具生成文章内容。`)
      return hints.join('\n\n')
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
    // 确保是数组
    if (!history || !Array.isArray(history) || history.length === 0) return ''
    
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
    // 检查工具是否在分身可用工具列表中
    const isToolAvailable = context.availableTools.some(tool => tool.name === toolName)

    // 强制日志输出
    console.log(`[Agent] 执行工具检查 - 工具名: ${toolName}`)
    console.log(`[Agent] 可用工具列表:`, context.availableTools.map(t => t.name))
    console.log(`[Agent] 工具是否可用: ${isToolAvailable}`)

    if (!isToolAvailable) {
      console.warn(`[Agent] ⛔ 工具 ${toolName} 不在分身的可用工具列表中，拒绝执行`)

      // 获取技能的中文名称
      const skillDisplayName = await this.getSkillDisplayName(toolName)

      return {
        success: false,
        error: `您的分身尚未添加该功能，请前往技能广场添加"${skillDisplayName}"技能`
      }
    }

    const tool = this.tools.get(toolName)

    if (!tool) {
      return { success: false, error: `工具 ${toolName} 不存在` }
    }

    const toolContext: ToolContext = {
      userId: context.userId,
      avatarId: context.avatarId,
      taskId: context.taskId,
      headers: undefined,
      onProgress: (message: string, step?: number, subStep?: string) => {
        // 通过 progressCache 更新进度
        if (!context.taskId) {
          console.warn('[AgentService] taskId 为空，无法更新进度')
          return
        }

        const progress = {
          taskId: context.taskId,
          userId: context.userId,
          type: 'substep',
          message,
          data: { step, subStep },
          timestamp: Date.now(),
          status: 'running' as const  // 🔴 新增：默认为 running
        }
        this.progressCache.updateProgress(context.userId, progress)

        // 如果有 conversationId，同步更新 assistant 消息的 metadata
        if (context.conversationId) {
          this.updateAssistantMessageProgress(
            context.conversationId,
            context.userId,
            context.taskId,
            message
          ).catch(err => {
            console.error('[AgentService] 更新 assistant 消息进度失败:', err)
          })
        }
      }
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
   * 获取技能的中文名称
   * 根据 tool_name 从 skills 表中获取对应的中文显示名称
   */
  private async getSkillDisplayName(toolName: string): Promise<string> {
    try {
      const { data } = await getSupabaseClient()
        .from('skills')
        .select('name')
        .eq('tool_name', toolName)
        .single()

      return data?.name || toolName
    } catch (error) {
      console.warn(`[Agent] 获取技能 ${toolName} 的中文名称失败:`, error)
      return toolName
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
   * 🔴 修复：检查最终答案是否包含媒体数据（图片、视频等）
   * 如果只是文本描述，则继续执行工具
   */
  private hasMediaContent(finalAnswer: string): boolean {
    // 尝试解析 final_answer 是否是 JSON 格式
    try {
      const parsed = JSON.parse(finalAnswer)
      // 检查是否包含 video_clips、image_urls、video_url、edited_video_url 等媒体字段
      const mediaFields = ['video_clips', 'image_urls', 'video_url', 'edited_video_url', 'images', 'videos', 'characters', 'scenes']
      return mediaFields.some(field => {
        const value = parsed[field]
        return Array.isArray(value) && value.length > 0
      })
    } catch (e) {
      // 如果不是 JSON，检查文本中是否包含 URL（简单的启发式检查）
      const urlPattern = /https?:\/\/[^\s]+\.(mp4|mov|avi|jpg|jpeg|png|gif)/gi
      return urlPattern.test(finalAnswer)
    }
  }

  /**
   * 🔴 修复：检查最终答案是否包含视频数据
   * 对于短剧相关的内容，必须检查是否有视频（不仅仅是图片）
   */
  private hasVideoContent(finalAnswer: string): boolean {
    try {
      const parsed = JSON.parse(finalAnswer)
      // 检查视频相关字段
      const videoFields = ['video_clips', 'videos', 'video_url', 'edited_video_url']

      // 检查是否有视频数组（且不为空）
      const hasVideoArray = videoFields.some(field => {
        const value = parsed[field]
        if (Array.isArray(value) && value.length > 0) {
          // 对于 video_clips，确保至少有一个有效的视频 URL
          if (field === 'video_clips') {
            return value.some((clip: any) => clip.url && typeof clip.url === 'string' && clip.url.length > 0)
          }
          return true
        }
        return false
      })

      // 检查是否有视频 URL 字符串
      const hasVideoString = videoFields.some(field => {
        const value = parsed[field]
        return typeof value === 'string' && value.length > 0
      })

      return hasVideoArray || hasVideoString
    } catch (e) {
      // 如果不是 JSON，检查文本中是否包含视频 URL
      const videoUrlPattern = /https?:\/\/[^\s]+\.(mp4|mov|avi)/gi
      return videoUrlPattern.test(finalAnswer)
    }
  }

  /**
   * 🔴 修复：从任务描述中提取短剧参数
   */
  private extractShortdramaParams(taskDescription: string, finalAnswer?: string): any {
    const params: any = {
      theme: taskDescription,
      duration: 1,
      include_video: true,
      key_scenes_count: 6,
      ratio: '16:9',
      generate_audio: true
    }

    // 从任务描述中提取时长（分钟）
    const durationMatch = taskDescription.match(/(\d+)\s*分钟/)
    if (durationMatch) {
      params.duration = parseInt(durationMatch[1])
    }

    // 从任务描述中提取宽高比
    if (taskDescription.includes('横屏') || taskDescription.includes('16:9')) {
      params.ratio = '16:9'
    } else if (taskDescription.includes('竖屏') || taskDescription.includes('9:16')) {
      params.ratio = '9:16'
    }

    // 从任务描述中提取镜头时长（秒）
    const clipDurationMatch = taskDescription.match(/每镜头(\d+)\s*秒/)
    if (clipDurationMatch) {
      params.video_duration = parseInt(clipDurationMatch[1])
    }

    // 从任务描述中提取镜头数量
    const clipCountMatch = taskDescription.match(/(\d+)\s*个?镜头/)
    if (clipCountMatch) {
      params.key_scenes_count = parseInt(clipCountMatch[1])
    }

    console.log('[AgentService] 提取短剧参数:', params)
    return params
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
    // 过滤步骤信息，移除 message 和 next_action_hint 等调试信息
    const filteredSteps = steps.map(s => {
      const filteredObservation = s.observation ? { ...s.observation } : s.observation
      if (filteredObservation?.data) {
        // 移除调试信息字段，只保留关键业务数据
        const { message, next_action_hint, ...businessData } = filteredObservation.data
        filteredObservation.data = businessData
      }
      return {
        step_index: s.step_index,
        thought: s.thought,
        action: s.action,
        observation: filteredObservation
      }
    })

    const stepsSummary = filteredSteps.map(s =>
      `步骤${s.step_index}: ${s.thought}\n行动: ${s.action || '无'}\n结果: ${JSON.stringify(s.observation).substring(0, 200)}`
    ).join('\n\n')

    const response = await this.llmClient.invoke([
      {
        role: 'user',
        content: `任务：${context.taskDescription}\n\n执行记录：\n${stepsSummary}\n\n请用简洁的语言总结任务执行结果。
要求：
1. 只总结最终生成的结果（如：文章、图片、视频等）
2. 不要提及中间过程、工具调用细节、数量统计等调试信息
3. 如果生成了图片，直接说"已生成图片"，不要说"已生成3张图片"
4. 如果生成了文章，直接说"文章已生成"，不要说"文章已生成，共1000字"
5. 使用简洁、自然的语言，就像一个普通人在回复朋友一样`
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

  /**
   * 检查任务需要的技能
   * 返回缺失的技能列表
   */
  private checkRequiredSkills(task: string, availableTools: any[]): { required: Array<{ toolName: string; skillName: string }>; missing: Array<{ toolName: string; skillName: string }> } {
    const required: Array<{ toolName: string; skillName: string }> = []
    const missing: Array<{ toolName: string; skillName: string }> = []

    const lowerTask = task.toLowerCase()

    // 【优先检测短剧相关需求】
    // 短剧成品制作（优先级最高）
    if (lowerTask.match(/短剧.*成品|真人短剧|短剧成品|制作短剧|生成短剧|短剧制作/)) {
      required.push({ toolName: 'produce_shortdrama', skillName: '完整短剧制作' })
    }
    // 多集连续短剧
    else if (lowerTask.match(/多集.*短剧|连续短剧|系列短剧|短剧集/)) {
      required.push({ toolName: 'generate_multi_episode_drama', skillName: '多集连续短剧' })
    }
    // 短剧剧本
    else if (lowerTask.match(/短剧.*剧本|剧本.*短剧/)) {
      required.push({ toolName: 'generate_shortdrama_script', skillName: '短剧剧本生成' })
    }
    // 短剧配音
    else if (lowerTask.match(/短剧.*配音|配音.*短剧/)) {
      required.push({ toolName: 'generate_drama_voiceover', skillName: '短剧配音' })
    }
    // 短剧视频剪辑
    else if (lowerTask.match(/短剧.*剪辑|剪辑.*短剧/)) {
      required.push({ toolName: 'edit_shortdrama_video', skillName: '视频剪辑' })
    }
    // 短剧字幕
    else if (lowerTask.match(/短剧.*字幕|字幕.*短剧/)) {
      required.push({ toolName: 'generate_subtitle', skillName: '字幕生成' })
    }
    // 短剧配乐
    else if (lowerTask.match(/短剧.*配乐|配乐.*短剧|短剧.*背景音乐/)) {
      required.push({ toolName: 'recommend_bgm', skillName: '配乐推荐' })
    }
    // 检测各种操作类型（普通视频生成，不是短剧）
    else if (lowerTask.match(/生成.*视频|做.*视频|制作.*视频|视频生成/)) {
      required.push({ toolName: 'generate_video', skillName: '视频生成' })
    }

    // 检测各种操作类型
    if (lowerTask.match(/生成.*图|画.*图|设计.*图|做.*图|创作.*图|生成图片|画张图|做个图|海报/)) {
      required.push({ toolName: 'generate_image', skillName: '图像生成' })
    }

    if (lowerTask.match(/写.*文章|创作.*文章|写公众号|写内容/)) {
      required.push({ toolName: 'write_article', skillName: '文章创作' })
    }

    if (lowerTask.match(/写.*小红书|小红书.*笔记/)) {
      required.push({ toolName: 'write_xiaohongshu_note', skillName: '小红书笔记' })
    }

    if (lowerTask.match(/写.*公众号|公众号.*文章/)) {
      required.push({ toolName: 'write_wechat_mp_article', skillName: '公众号文章' })
    }

    if (lowerTask.match(/发.*公众号|发布.*公众号/)) {
      required.push({ toolName: 'publish_wechat_mp', skillName: '公众号发布' })
    }

    if (lowerTask.match(/发.*小红书|发布.*小红书/)) {
      required.push({ toolName: 'publish_xiaohongshu', skillName: '小红书发布' })
    }

    if (lowerTask.match(/发.*抖音|发布.*抖音/)) {
      required.push({ toolName: 'publish_douyin', skillName: '抖音发布' })
    }

    if (lowerTask.match(/发.*B站|发布.*B站|发.*Bilibili/)) {
      required.push({ toolName: 'publish_bilibili', skillName: 'B站发布' })
    }

    if (lowerTask.match(/发.*视频号|发布.*视频号/)) {
      required.push({ toolName: 'publish_wechat_video', skillName: '视频号发布' })
    }

    // 检查哪些技能在可用工具列表中缺失
    for (const skill of required) {
      const isAvailable = availableTools.some(tool => tool.name === skill.toolName)
      if (!isAvailable) {
        missing.push(skill)
      }
    }

    return { required, missing }
  }

  /**
   * 获取工具的中文名称（简化版，用于技能检查提示）
   */
  private getToolDisplayNameChinese(toolName: string): string {
    const toolNameMap: Record<string, string> = {
      // 短剧相关
      'produce_shortdrama': '完整短剧制作',
      'generate_multi_episode_drama': '多集连续短剧',
      'generate_shortdrama_script': '短剧剧本生成',
      'generate_drama_voiceover': '短剧配音',
      'edit_shortdrama_video': '视频剪辑',
      'generate_subtitle': '字幕生成',
      'recommend_bgm': '配乐推荐',
      // 内容创作
      'generate_image': '图像生成',
      'generate_video': '视频生成',
      'write_article': '文章创作',
      'write_xiaohongshu_note': '小红书笔记',
      'write_wechat_mp_article': '公众号文章',
      // 平台发布
      'publish_wechat_mp': '公众号发布',
      'publish_xiaohongshu': '小红书发布',
      'publish_douyin': '抖音发布',
      'publish_bilibili': 'B站发布',
      'publish_wechat_video': '视频号发布'
    }

    return toolNameMap[toolName] || toolName
  }

  /**
   * 检测未知技能需求
   * 当用户需求超出现有技能范围时，给出友好提示
   */
  private detectUnknownSkillRequirements(task: string, availableTools: any[]): string | null {
    const lowerTask = task.toLowerCase()

    // 获取所有可用工具的名称
    const availableToolNames = availableTools.map(t => t.name.toLowerCase())

    // 检测常见的未知需求类型
    const unknownRequirements: Array<{ pattern: RegExp; description: string; suggestion: string }> = [
      // 翻译类
      {
        pattern: /翻译|translate|中译英|英译中|日译中/,
        description: '翻译功能',
        suggestion: '目前技能广场暂未提供翻译功能。您可以：\n1. 使用其他翻译工具（如百度翻译、Google翻译）\n2. 或者尝试换一种方式描述您的需求'
      },
      // 代码生成类
      {
        pattern: /写代码|编程|code|生成代码|开发|写程序|写脚本/,
        description: '代码生成功能',
        suggestion: '目前技能广场暂未提供代码生成功能。您可以：\n1. 描述具体的需求，看是否可以用其他方式实现\n2. 联系我们反馈需求'
      },
      // 数据分析类
      {
        pattern: /分析.*数据|数据分析|统计.*数据|数据处理|数据挖掘/,
        description: '数据分析功能',
        suggestion: '目前技能广场暂未提供数据分析功能。您可以：\n1. 提供具体的数据和分析需求\n2. 使用专业数据分析工具'
      },
      // AI 对话类（非内容创作）
      {
        pattern: /聊天|对话|问答|咨询|问.*问题|解答/,
        description: 'AI 对话功能',
        suggestion: '我是专门用于内容创作和平台发布的 AI 分身。我可以帮您：\n1. 生成图片和视频\n2. 写文章、笔记\n3. 发布到各大平台\n4. 添加好友、管理订单'
      },
      // 音频处理类
      {
        pattern: /音频|音乐|语音|配音|录音|TTS|ASR/,
        description: '音频处理功能',
        suggestion: '目前技能广场暂未提供音频处理功能。您可以：\n1. 描述具体需求\n2. 使用专业音频工具'
      },
      // 文件处理类
      {
        pattern: /转换.*格式|格式转换|压缩.*文件|文件压缩|OCR|识别.*文字/,
        description: '文件处理功能',
        suggestion: '目前技能广场暂未提供文件处理功能。您可以：\n1. 使用在线转换工具\n2. 描述具体需求'
      },
      // 财务类
      {
        pattern: /理财|投资|股票|基金|期货|外汇|财务分析|记账/,
        description: '财务理财功能',
        suggestion: '目前技能广场暂未提供财务理财功能。请您：\n1. 咨询专业理财顾问\n2. 使用专业理财工具'
      },
      // 医疗健康类
      {
        pattern: /医疗|健康|诊断|治疗|症状|疾病|看病|体检/,
        description: '医疗健康功能',
        suggestion: '我不是医疗助手，无法提供医疗建议。请您：\n1. 咨询专业医生\n2. 前往正规医疗机构'
      },
      // 法律类
      {
        pattern: /法律|律师|合同|起诉|诉讼|维权|法律咨询/,
        description: '法律咨询功能',
        suggestion: '我不是法律助手，无法提供法律建议。请您：\n1. 咨询专业律师\n2. 寻求法律援助'
      }
    ]

    // 检测是否匹配任何未知需求
    for (const req of unknownRequirements) {
      if (req.pattern.test(lowerTask)) {
        return `【功能暂未开放】检测到您需要使用${req.description}

${req.suggestion}

【我的能力范围】
我可以帮您完成以下任务：
- 🎨 生成图片、视频（图像生成、视频生成）
- 📝 创作内容（文章创作、小红书笔记、公众号文章）
- 📤 发布内容（小红书、公众号、抖音、B站、视频号）
- 👥 社交互动（添加好友、查看好友）
- 📋 订单管理（分配订单、查看订单）
- 🎁 订阅管理（查看订阅、升级套餐）

您可以尝试换个说法，或者告诉我更具体的需求。`
      }
    }

    // 如果用户的需求包含明确的动词，但找不到对应工具
    const actionVerbs = ['生成', '制作', '创建', '设计', '处理', '计算', '分析', '转换']
    const hasActionVerb = actionVerbs.some(verb => lowerTask.includes(verb))

    // 检查是否是简单的问答（不需要工具）
    if (hasActionVerb && !this.matchesAvailableTaskTypes(lowerTask)) {
      return `【无法识别的功能】抱歉，我暂时无法理解您的需求。

请尝试用更具体的方式描述您想要做的事情。

【我可以帮您】
- 生成图片："生成一张风景画"
- 生成视频："制作一个10秒的短视频"
- 写文章："写一篇关于XX的文章"
- 发布内容："发布这篇内容到小红书"
- 添加好友："帮我添加50个好友"
- 分配订单："分配订单给分身"

如果您的需求不在上述范围内，欢迎反馈给我们！`
    }

    return null
  }

  /**
   * 检查任务是否匹配可用的任务类型
   */
  private matchesAvailableTaskTypes(task: string): boolean {
    const taskTypes = [
      // 图像生成
      /生成.*图|画.*图|设计.*图|海报/,
      // 视频生成
      /生成.*视频|制作.*视频|视频创作/,
      // 文章创作
      /写.*文章|创作.*文章|写内容/,
      // 发布内容
      /发布|发.*到|推送/,
      // 社交互动
      /添加好友|查看好友|分身列表/,
      // 订单管理
      /分配.*订单|派单|接单|查看订单/,
      // 订阅管理
      /订阅|升级|开通套餐/,
      // 普通对话
      /你好|你是谁|介绍一下/
    ]

    return taskTypes.some(regex => regex.test(task))
  }
}

