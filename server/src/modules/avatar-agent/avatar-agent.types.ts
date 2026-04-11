/**
 * Avatar Agent 类型定义
 */

export interface AvatarContext {
  userId: string
  history?: ConversationMessage[]
  currentTask?: string
  metadata?: Record<string, any>
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export interface AvatarThought {
  id: string
  avatarId: string
  content: string
  intent: {
    type: string
    toolName?: string
    params?: Record<string, any>
    skillType?: string
    confidence: number
  }
  requiresTool: boolean
  reasoning?: string
  createdAt: string
}

export interface AvatarActionResult {
  success: boolean
  data?: any
  error?: string
  toolName?: string
  executionTime?: number
}

export interface AvatarResponse {
  content: string
  metadata: {
    thought: AvatarThought
    toolResults?: AvatarActionResult[]
    confidence: number
    tokensUsed?: number
    feedback_score?: number
  }
  reasoning?: string
}

export interface Memory {
  id: string
  avatarId: string
  memoryType: 'conversation' | 'learning' | 'preference' | 'experience'
  content: string
  embedding?: number[]
  metadata: Record<string, any>
  accessCount: number
  lastAccessedAt?: string
  createdAt: string
  updatedAt?: string
}

export interface MemoryConfig {
  maxRetrieval?: number
  similarityThreshold?: number
  timeDecay?: number
  typeWeights?: {
    conversation: number
    preference: number
    experience: number
  }
  allowedTypes?: string[]
}

export interface ConversationData {
  userMessage: string
  assistantResponse: string
  thought: AvatarThought
  metadata?: Record<string, any>
}

export interface Preference {
  type: string
  description: string
  value: any
}

export interface Experience {
  description: string
  taskType: string
  success: boolean
  outcome: any
  source?: string
}

export interface AvatarAgentConfig {
  id: string
  avatarId: string
  systemPrompt: string
  rolePrompt?: string
  temperature: number
  maxTokens: number
  enabledTools: string[]
  knowledgeBases: any[]
  reasoningMode: 'react' | 'chain_of_thought' | 'few_shot'
  learningEnabled: boolean
  memoryConfig: MemoryConfig
  createdAt: string
  updatedAt: string
}

export interface Interaction {
  userId: string
  message: string
  response: string
  feedback?: number
  timestamp: string
}
