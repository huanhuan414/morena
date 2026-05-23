/**
 * AI Agent 工具定义
 * 定义 Agent 可以调用的所有工具
 */

// 旧版参数格式（兼容）
export type ToolParameters = Record<string, {
  type: string
  description: string
  required?: boolean
}> | {
  type: 'object'
  properties: Record<string, {
    type: string
    description: string
    default?: any
  }>
  required: string[]
}

export interface ITool {
  name: string
  description: string
  parameters: ToolParameters
  execute: (params: Record<string, any>, context: ToolExecutionContext) => Promise<ToolResult>
}

// 兼容旧接口
export type Tool = ITool

export interface ToolContext {
  userId: string
  avatarId: string
  conversationId: string
  headers?: Record<string, string>
}

export interface ToolExecutionContext extends ToolContext {
  taskId: string
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  message: string
  percentage?: number // 任务进度百分比（可选，用于推送执行进度）
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  tool: string
  parameters: Record<string, any>
  thought?: string  // AI 的思考过程
}

/**
 * Agent 执行步骤
 */
export interface AgentStep {
  step: number
  thought: string      // AI 的思考
  action: string       // 执行的动作
  tool?: string        // 调用的工具
  parameters?: any     // 工具参数
  observation?: string // 观察到的结果
  result?: ToolResult  // 工具执行结果
  timestamp: string
}

/**
 * Agent 执行结果
 */
export interface AgentExecutionResult {
  success: boolean
  steps: AgentStep[]
  finalAnswer: string
  toolsUsed: string[]
  duration: number
  error?: string
}
