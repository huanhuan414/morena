/**
 * Avatar Tool Interface
 * 分身工具接口定义
 */

export interface AvatarTool {
  name: string
  displayName: string
  description: string
  category: 'content' | 'data' | 'social' | 'task' | 'system' | 'content_creation' | 'platform_publish'
  paramsSchema: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description: string
      required?: boolean
      default?: any
      enum?: any[]
      items?: {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      }
    }
  }
  execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult>
}

export interface ToolContext {
  avatarId: string
  userId: string
  conversationId?: string
  metadata?: Record<string, any>
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  executionTime?: number
  toolName?: string
  // 用于平台发布工具的扩展字段
  requires_config?: boolean
  config_platform?: string
  config_fields?: any
  wechat_error?: any
}
