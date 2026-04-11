/**
 * Avatar Tool Interface
 * 分身工具接口定义
 */

export interface AvatarTool {
  name: string
  displayName: string
  description: string
  category: 'content' | 'data' | 'social' | 'task' | 'system'
  paramsSchema: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description: string
      required?: boolean
      default?: any
      enum?: any[]
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
}
