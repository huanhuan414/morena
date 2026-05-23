/**
 * Avatar Tool Registry
 * 分身工具注册和管理系统
 */

import { Injectable, Logger } from '@nestjs/common'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

// 导入所有工具实现
import {
  WriteArticleTool,
  GenerateImageTool,
  SummarizeTool
} from './content-tools'
import {
  WriteWechatMpArticleTool,
  WriteXiaohongshuNoteTool,
  WriteWechatMomentsTool
} from './content-creation-tools'
import {
  GenerateImageTool as ContentGenerateImageTool,
  GenerateVideoTool
} from './content-generation-tools'
import {
  PublishWechatMpTool
} from './platform-publish-tools'
import {
  QueryUserProfileTool,
  QueryOrdersTool
} from './data-tools'
import {
  AvatarSendMessageTool,
  AvatarCreateMomentTool
} from './social-tools'
import {
  CreateTaskTool,
  UpdateTaskTool,
  QueryTasksTool
} from './task-tools'
import {
  ChangePasswordTool
} from './user-management-tools'
import {
  QueryAvatarFriendsTool,
  AddAvatarFriendTool,
  RemoveAvatarFriendTool
} from './avatar-management-tools'

@Injectable()
export class AvatarToolRegistry {
  private readonly logger = new Logger(AvatarToolRegistry.name)
  private tools: Map<string, AvatarTool> = new Map()

  constructor(
    // 注入所有工具
    private readonly writeArticleTool: WriteArticleTool,
    private readonly generateImageTool: GenerateImageTool,
    private readonly summarizeTool: SummarizeTool,
    // 内容创作工具
    private readonly writeWechatMpArticleTool: WriteWechatMpArticleTool,
    private readonly writeXiaohongshuNoteTool: WriteXiaohongshuNoteTool,
    private readonly writeWechatMomentsTool: WriteWechatMomentsTool,
    // 内容生成工具
    private readonly contentGenerateImageTool: ContentGenerateImageTool,
    private readonly generateVideoTool: GenerateVideoTool,
    // 平台发布工具
    private readonly publishWechatMpTool: PublishWechatMpTool,
    // 数据查询工具
    private readonly queryUserProfileTool: QueryUserProfileTool,
    private readonly queryOrdersTool: QueryOrdersTool,
    // 社交互动工具
    private readonly sendMessageTool: AvatarSendMessageTool,
    private readonly createMomentTool: AvatarCreateMomentTool,
    // 任务管理工具
    private readonly createTaskTool: CreateTaskTool,
    private readonly updateTaskTool: UpdateTaskTool,
    private readonly queryTasksTool: QueryTasksTool,
    // 用户管理工具
    private readonly changePasswordTool: ChangePasswordTool,
    // 分身管理工具
    private readonly queryAvatarFriendsTool: QueryAvatarFriendsTool,
    private readonly addAvatarFriendTool: AddAvatarFriendTool,
    private readonly removeAvatarFriendTool: RemoveAvatarFriendTool
  ) {
    this.registerAllTools()
  }

  /**
   * 注册所有工具
   */
  private registerAllTools() {
    // 内容创作工具
    this.registerTool(this.writeArticleTool, 'WriteArticleTool')
    this.registerTool(this.generateImageTool, 'GenerateImageTool')
    this.registerTool(this.summarizeTool, 'SummarizeTool')
    this.registerTool(this.writeWechatMpArticleTool, 'WriteWechatMpArticleTool')
    this.registerTool(this.writeXiaohongshuNoteTool, 'WriteXiaohongshuNoteTool')
    this.registerTool(this.writeWechatMomentsTool, 'WriteWechatMomentsTool')

    // 内容生成工具
    this.registerTool(this.contentGenerateImageTool, 'ContentGenerateImageTool')
    this.registerTool(this.generateVideoTool, 'GenerateVideoTool')

    // 平台发布工具
    this.registerTool(this.publishWechatMpTool, 'PublishWechatMpTool')

    // 数据查询工具
    this.registerTool(this.queryUserProfileTool, 'QueryUserProfileTool')
    this.registerTool(this.queryOrdersTool, 'QueryOrdersTool')

    // 社交互动工具
    this.registerTool(this.sendMessageTool, 'AvatarSendMessageTool')
    this.registerTool(this.createMomentTool, 'AvatarCreateMomentTool')

    // 任务管理工具
    this.registerTool(this.createTaskTool, 'CreateTaskTool')
    this.registerTool(this.updateTaskTool, 'UpdateTaskTool')
    this.registerTool(this.queryTasksTool, 'QueryTasksTool')

    // 用户管理工具
    this.registerTool(this.changePasswordTool, 'ChangePasswordTool')

    // 分身管理工具
    this.registerTool(this.queryAvatarFriendsTool, 'QueryAvatarFriendsTool')
    this.registerTool(this.addAvatarFriendTool, 'AddAvatarFriendTool')
    this.registerTool(this.removeAvatarFriendTool, 'RemoveAvatarFriendTool')

    this.logger.log(`已注册 ${this.tools.size} 个工具`)
  }

  /**
   * 注册单个工具
   */
  private registerTool(tool: AvatarTool | undefined, toolName: string = 'unknown') {
    if (!tool) {
      this.logger.warn(`工具 ${toolName} 未定义或未注入，跳过注册`)
      return
    }
    if (this.tools.has(tool.name)) {
      this.logger.warn(`工具 ${tool.name} 已存在，将被覆盖`)
    }
    this.tools.set(tool.name, tool)
  }

  /**
   * 获取所有工具
   */
  getAllTools(): AvatarTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 获取指定工具
   */
  getTool(name: string): AvatarTool | undefined {
    return this.tools.get(name)
  }

  /**
   * 执行工具
   */
  async executeTool(name: string, params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `工具 ${name} 不存在` }
    }

    try {
      return await tool.execute(params, context)
    } catch (error: any) {
      this.logger.error(`执行工具 ${name} 失败`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: string): AvatarTool[] {
    return this.getAllTools().filter(tool => tool.category === category)
  }

  /**
   * 获取工具的 Schema
   */
  getToolSchema(name: string) {
    const tool = this.tools.get(name)
    if (!tool) return null
    return {
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      params: tool.paramsSchema
    }
  }
}
