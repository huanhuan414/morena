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
  WriteXiaohongshuNoteTool
} from './content-creation-tools'
import {
  GenerateImageTool as ContentGenerateImageTool,
  GenerateVideoTool
} from './content-generation-tools'
import {
  PublishWechatMpTool,
  PublishXiaohongshuTool,
  PublishWechatVideoTool
} from './platform-publish-tools'
import {
  QueryUserProfileTool,
  QueryOrdersTool,
  QueryFriendsTool
} from './data-tools'
import {
  SendMessageTool,
  CreateMomentTool,
  AddCommentTool
} from './social-tools'
import {
  CreateTaskTool,
  UpdateTaskStatusTool,
  QueryTasksTool,
  AssignTaskTool
} from './task-tools'
import {
  ChangePasswordTool,
  UpdateProfileTool,
  UploadAvatarTool,
  BindPhoneTool,
  DeleteAccountTool
} from './user-management-tools'
import {
  QueryAvatarFriendsTool,
  AddAvatarFriendTool,
  RemoveAvatarFriendTool,
  QueryAvatarProfileTool
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
    // 内容创作工具（从旧系统迁移）
    private readonly writeWechatMpArticleTool: WriteWechatMpArticleTool,
    private readonly writeXiaohongshuNoteTool: WriteXiaohongshuNoteTool,
    // 内容生成工具（从旧系统迁移）
    private readonly contentGenerateImageTool: ContentGenerateImageTool,
    private readonly generateVideoTool: GenerateVideoTool,
    // 平台发布工具（从旧系统迁移）
    private readonly publishWechatMpTool: PublishWechatMpTool,
    private readonly publishXiaohongshuTool: PublishXiaohongshuTool,
    private readonly publishWechatVideoTool: PublishWechatVideoTool,
    // 数据查询工具
    private readonly queryUserProfileTool: QueryUserProfileTool,
    private readonly queryOrdersTool: QueryOrdersTool,
    private readonly queryFriendsTool: QueryFriendsTool,
    // 社交互动工具
    private readonly sendMessageTool: SendMessageTool,
    private readonly createMomentTool: CreateMomentTool,
    private readonly addCommentTool: AddCommentTool,
    // 任务管理工具
    private readonly createTaskTool: CreateTaskTool,
    private readonly updateTaskStatusTool: UpdateTaskStatusTool,
    private readonly queryTasksTool: QueryTasksTool,
    private readonly assignTaskTool: AssignTaskTool,
    // 用户管理工具
    private readonly changePasswordTool: ChangePasswordTool,
    private readonly updateProfileTool: UpdateProfileTool,
    private readonly uploadAvatarTool: UploadAvatarTool,
    private readonly bindPhoneTool: BindPhoneTool,
    private readonly deleteAccountTool: DeleteAccountTool,
    // 分身管理工具
    private readonly queryAvatarFriendsTool: QueryAvatarFriendsTool,
    private readonly addAvatarFriendTool: AddAvatarFriendTool,
    private readonly removeAvatarFriendTool: RemoveAvatarFriendTool,
    private readonly queryAvatarProfileTool: QueryAvatarProfileTool
  ) {
    this.registerAllTools()
  }

  /**
   * 注册所有工具
   */
  private registerAllTools() {
    // 原有内容创作工具
    this.registerTool(this.writeArticleTool)
    this.registerTool(this.generateImageTool)
    this.registerTool(this.summarizeTool)

    // 内容创作工具（从旧系统迁移）
    this.registerTool(this.writeWechatMpArticleTool)
    this.registerTool(this.writeXiaohongshuNoteTool)

    // 内容生成工具（从旧系统迁移）
    this.registerTool(this.contentGenerateImageTool)
    this.registerTool(this.generateVideoTool)

    // 平台发布工具（从旧系统迁移）
    this.registerTool(this.publishWechatMpTool)
    this.registerTool(this.publishXiaohongshuTool)
    this.registerTool(this.publishWechatVideoTool)

    // 数据查询工具
    this.registerTool(this.queryUserProfileTool)
    this.registerTool(this.queryOrdersTool)
    this.registerTool(this.queryFriendsTool)

    // 社交互动工具
    this.registerTool(this.sendMessageTool)
    this.registerTool(this.createMomentTool)
    this.registerTool(this.addCommentTool)

    // 任务管理工具
    this.registerTool(this.createTaskTool)
    this.registerTool(this.updateTaskStatusTool)
    this.registerTool(this.queryTasksTool)
    this.registerTool(this.assignTaskTool)

    // 用户管理工具
    this.registerTool(this.changePasswordTool)
    this.registerTool(this.updateProfileTool)
    this.registerTool(this.uploadAvatarTool)
    this.registerTool(this.bindPhoneTool)
    this.registerTool(this.deleteAccountTool)

    // 分身管理工具
    this.registerTool(this.queryAvatarFriendsTool)
    this.registerTool(this.addAvatarFriendTool)
    this.registerTool(this.removeAvatarFriendTool)
    this.registerTool(this.queryAvatarProfileTool)

    this.logger.log(`已注册 ${this.tools.size} 个工具`)
  }

  /**
   * 注册单个工具
   */
  registerTool(tool: AvatarTool) {
    this.tools.set(tool.name, tool)
    this.logger.log(`已注册工具: ${tool.name} (${tool.category})`)
  }

  /**
   * 获取工具
   */
  getTool(name: string): AvatarTool | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有工具
   */
  getAllTools(): AvatarTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: string): AvatarTool[] {
    return this.getAllTools().filter(tool => tool.category === category)
  }

  /**
   * 检查工具是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 验证工具参数
   */
  validateToolParams(toolName: string, params: Record<string, any>): {
    valid: boolean
    errors: string[]
  } {
    const tool = this.getTool(toolName)
    if (!tool) {
      return {
        valid: false,
        errors: [`工具 ${toolName} 不存在`]
      }
    }

    const errors: string[] = []

    for (const [paramName, schema] of Object.entries(tool.paramsSchema)) {
      // 检查必填参数
      if (schema.required && !params[paramName]) {
        errors.push(`缺少必填参数: ${paramName}`)
        continue
      }

      // 检查枚举值
      if (schema.enum && params[paramName] && !schema.enum.includes(params[paramName])) {
        errors.push(`参数 ${paramName} 的值无效，可选值为: ${schema.enum.join(', ')}`)
      }

      // 检查类型
      if (params[paramName]) {
        const actualType = Array.isArray(params[paramName]) ? 'array' : typeof params[paramName]
        if (actualType !== schema.type) {
          errors.push(`参数 ${paramName} 类型错误，期望 ${schema.type}，实际 ${actualType}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      // 验证工具是否存在
      const tool = this.getTool(toolName)
      if (!tool) {
        return {
          success: false,
          toolName,
          error: `工具 ${toolName} 不存在`
        }
      }

      // 验证参数
      const validation = this.validateToolParams(toolName, params)
      if (!validation.valid) {
        return {
          success: false,
          toolName,
          error: `参数验证失败: ${validation.errors.join('; ')}`
        }
      }

      this.logger.log(`执行工具: ${toolName}`, params)

      // 执行工具
      const result = await tool.execute(params, context)

      this.logger.log(`工具执行完成: ${toolName}, 成功: ${result.success}`)

      return result
    } catch (error) {
      this.logger.error(`工具执行异常: ${toolName}`, error)
      return {
        success: false,
        toolName,
        error: error.message
      }
    }
  }

  /**
   * 获取工具列表描述（用于大模型）
   */
  getToolsDescription(): string {
    const tools = this.getAllTools()
    const descriptions = tools.map(tool => {
      const params = Object.entries(tool.paramsSchema)
        .map(([name, schema]) => {
          const required = schema.required ? '（必填）' : '（可选）'
          const enumValues = schema.enum ? `可选值: ${schema.enum.join(', ')}` : ''
          return `  - ${name}: ${schema.description}${required} ${enumValues}`
        })
        .join('\n')

      return `
工具名称: ${tool.name}
显示名称: ${tool.displayName}
分类: ${tool.category}
描述: ${tool.description}
参数:
${params}
`
    })

    return `可用工具列表:\n${descriptions.join('\n')}`
  }

  /**
   * 获取工具名称列表
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }
}
