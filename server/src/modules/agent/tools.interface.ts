/**
 * AI Agent 工具定义
 * 定义 Agent 可以调用的所有工具
 */

export interface Tool {
  name: string
  description: string
  parameters: Record<string, {
    type: string
    description: string
    required: boolean
  }>
  execute: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
  userId: string
  avatarId: string
  conversationId: string
  headers?: Record<string, string>
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  message: string
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
