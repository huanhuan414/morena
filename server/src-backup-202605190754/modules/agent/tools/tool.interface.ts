/**
 * 工具接口定义
 * 所有工具必须实现此接口
 */

import { ToolResult, ToolCategory, PlatformType } from '../agent.types'

export interface ToolContext {
  userId: string
  avatarId: string
  taskId?: string
  headers?: Record<string, string>
  onProgress?: (message: string, step?: number, subStep?: string) => void
  uploadedImages?: string[] // 新增：用户上传的图片URL列表
  uploadedVideos?: string[] // 新增：用户上传的视频URL列表
}

export interface ToolDefinition {
  name: string
  displayName: string
  description: string
  category: ToolCategory
  paramsSchema: Record<string, any>
  requiresPlatform?: PlatformType
}

export interface ITool {
  // 工具定义
  readonly definition: ToolDefinition
  
  // 执行工具
  execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult>
  
  // 参数验证（可选）
  validateParams?(params: Record<string, any>): { valid: boolean; errors?: string[] }
  
  // 获取配置需求（如果需要平台配置）
  getConfigRequirements?(): {
    platform: string
    fields: Array<{
      name: string
      label: string
      type: 'text' | 'password' | 'textarea'
      required: boolean
      placeholder?: string
    }>
  }
}
