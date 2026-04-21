/**
 * OpenClaw Agent 类型定义
 * 实现 ReAct (Reasoning + Acting) 模式的自主任务执行系统
 */

// 平台类型
export type PlatformType =
  | 'wechat'         // 微信公众号
  | 'xiaohongshu'    // 小红书
  | 'bilibili'       // B站
  | 'weibo'          // 微博
  | 'douyin'         // 抖音

// 工具分类
export type ToolCategory = 
  | 'app_function'      // 小程序功能
  | 'content_creation'  // 内容创作
  | 'platform_publish'  // 平台发布
  | 'data_analysis'     // 数据分析

// 步骤类型
export type StepType = 
  | 'think'    // 思考
  | 'action'   // 行动
  | 'observe'  // 观察
  | 'result'   // 结果

// 平台配置状态
export type PlatformConfigStatus = 
  | 'active'       // 已配置且有效
  | 'expired'      // 已过期
  | 'unconfigured' // 未配置

// 工具定义接口
export interface ToolDefinition {
  name: string
  displayName: string
  description: string
  category: ToolCategory
  paramsSchema: Record<string, any>
  requiresPlatform?: PlatformType
}

// 工具执行结果
export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  requires_config?: boolean
  config_platform?: PlatformType
  config_fields?: ConfigField[]
}

// 配置字段定义
export interface ConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'textarea'
  required: boolean
  placeholder?: string
  description?: string
}

// 平台配置
export interface PlatformConfig {
  id: string
  user_id: string
  platform_type: PlatformType
  config_data: Record<string, any>
  status: PlatformConfigStatus
  last_used_at?: string
  created_at: string
  updated_at: string
}

// 分身技能
export interface AvatarSkill {
  id: string
  avatar_id: string
  skill_type: string
  skill_level: number
  usage_count: number
  last_used_at?: string
  metadata: Record<string, any>
  created_at: string
}

// Agent任务日志
export interface AgentTaskLog {
  id: string
  task_id: string
  avatar_id: string
  step_index: number
  step_type: StepType
  content: string
  tool_name?: string
  tool_params?: Record<string, any>
  tool_result?: Record<string, any>
  requires_config?: boolean
  config_platform?: PlatformType
  created_at: string
}

// ReAct循环步骤
export interface ReActStep {
  step_index: number
  thought: string           // 思考内容
  action?: string           // 行动名称
  action_input?: any        // 行动参数
  observation?: any         // 观察结果
  requires_config?: boolean // 是否需要配置
  config_platform?: PlatformType
  config_fields?: ConfigField[]
}

// Agent执行上下文
export interface AgentContext {
  userId: string
  avatarId: string
  avatarInfo?: {
    name: string
    description: string
    personality: string
    level: number
    avatar_url: string
  }
  conversationId?: string
  taskId?: string
  taskDescription: string
  availableTools: ToolDefinition[]
  platformConfigs: Map<PlatformType, PlatformConfig>
  avatarSkills: AvatarSkill[]
  executionHistory: ReActStep[]
  conversationHistory: ConversationMessage[] // 新增：对话历史
  uploadedImages?: string[] // 新增：用户上传的图片URL列表
  uploadedVideos?: string[] // 新增：用户上传的视频URL列表
  maxSteps: number
  currentStep: number
}

// 对话消息类型
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
}

// Agent执行结果
export interface AgentExecutionResult {
  success: boolean
  finalAnswer: string
  steps: ReActStep[]
  requiresConfig: boolean
  configPlatform?: PlatformType
  configFields?: ConfigField[]
  taskId?: string
  createdResources?: any[]
}

// 平台配置需求
export interface PlatformConfigRequirement {
  platform: PlatformType
  platform_name: string
  fields: ConfigField[]
  instructions: string
  help_url?: string
}

// 平台配置模板
export const PLATFORM_CONFIG_TEMPLATES: Record<PlatformType, PlatformConfigRequirement> = {
  wechat: {
    platform: 'wechat',
    platform_name: '微信公众号',
    fields: [
      { name: 'app_id', label: 'AppID', type: 'text', required: true, placeholder: '请输入公众号AppID' },
      { name: 'app_secret', label: 'AppSecret', type: 'password', required: true, placeholder: '请输入公众号AppSecret' },
    ],
    instructions: '请前往分身账号配置页面绑定公众号账号',
    help_url: 'https://mp.weixin.qq.com'
  },
  xiaohongshu: {
    platform: 'xiaohongshu',
    platform_name: '小红书',
    fields: [
      { name: 'account_url', label: '分享链接', type: 'text', required: true, placeholder: '请输入小红书个人主页分享链接' },
    ],
    instructions: '请前往分身账号配置页面绑定小红书账号',
    help_url: 'https://www.xiaohongshu.com'
  },
  bilibili: {
    platform: 'bilibili',
    platform_name: 'B站',
    fields: [
      { name: 'account_name', label: '账号名称', type: 'text', required: true, placeholder: '请输入B站账号名称' },
    ],
    instructions: '请前往分身账号配置页面绑定B站账号',
    help_url: 'https://www.bilibili.com'
  },
  weibo: {
    platform: 'weibo',
    platform_name: '微博',
    fields: [
      { name: 'account_name', label: '账号名称', type: 'text', required: true, placeholder: '请输入微博账号名称' },
    ],
    instructions: '请前往分身账号配置页面绑定微博账号',
    help_url: 'https://weibo.com'
  },
  douyin: {
    platform: 'douyin',
    platform_name: '抖音',
    fields: [
      { name: 'unique_id', label: '抖音号', type: 'text', required: true, placeholder: '请输入抖音号' },
    ],
    instructions: '请前往分身账号配置页面绑定抖音账号',
    help_url: 'https://creator.douyin.com'
  }
}
