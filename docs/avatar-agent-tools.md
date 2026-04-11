# 分身 Agent：问题映射到解决方案的实现

## 概述

分身 Agent 的核心能力是"问题映射到解决方案"，即能够理解用户的问题，并调用相应的工具来解决问题。这个能力通过以下几个层次的协作实现：

1. **大模型推理层**：理解问题，提取意图
2. **意图解析层**：识别是否需要工具，需要什么工具
3. **工具注册层**：管理和提供所有可用的工具
4. **工具执行层**：实际执行工具并返回结果
5. **响应生成层**：基于工具结果生成自然语言回复

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    用户输入问题                           │
│                  "帮我写一篇关于AI的文章"                   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              大模型推理层 (AvatarAgentService)            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. 构建推理上下文                                   │ │
│  │     - 系统角色                                       │ │
│  │     - 角色设定                                       │ │
│  │     - 可用工具列表 ← 关键：包含所有工具描述            │ │
│  │     - 对话历史                                       │ │
│  │     - 相关记忆                                       │ │
│  │     - 用户消息                                       │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. 提示词示例：                                     │ │
│  │     "请分析用户的意图，并按以下格式回复："             │ │
│  │     "Thought: [你的思考过程]"                        │ │
│  │     "Intent Type: [意图类型]"                       │ │
│  │     "Requires Tool: [true/false]"                  │ │
│  │     "Tool Name: [工具名称]"                         │ │
│  │     "Parameters: [JSON格式的参数]"                  │ │
│  │     "Confidence: [置信度 0-1]"                      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│            大模型输出结构化意图 (AvatarThought)            │
│  {                                                       │
│    "id": "thought-123",                                  │
│    "intent": {                                          │
│      "type": "write_article",                           │
│      "toolName": "write_article",                       │
│      "params": {                                        │
│        "topic": "AI",                                   │
│        "genre": "exposition",                           │
│        "length": 1000                                   │
│      },                                                 │
│      "confidence": 0.95                                 │
│    },                                                   │
│    "requiresTool": true                                 │
│  }                                                       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         工具注册层 (AvatarToolRegistry)                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  工具注册表:                                         │ │
│  │  - write_article ← 找到对应的工具                   │ │
│  │  - generate_image                                   │ │
│  │  - query_user_profile                               │ │
│  │  - query_orders                                     │ │
│  │  - ...                                              │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  工具元数据:                                         │ │
│  │  {                                                  │ │
│  │    name: "write_article",                          │ │
│  │    displayName: "写文章",                           │ │
│  │    description: "根据主题和要求生成文章内容",         │ │
│  │    category: "content",                             │ │
│  │    paramsSchema: {                                  │ │
│  │      topic: { type: "string", required: true },    │ │
│  │      genre: { type: "string", default: "exposition" }, │
│  │      length: { type: "number", default: 1000 }     │ │
│  │    }                                                │ │
│  │  }                                                  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│      工具执行层 (AvatarToolRegistry.executeTool)         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. 参数验证                                         │ │
│  │     - 检查必填参数                                   │ │
│  │     - 检查参数类型                                   │ │
│  │     - 检查枚举值                                     │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. 执行工具                                         │ │
│  │     - 调用 WriteArticleTool.execute()               │ │
│  │     - 传递上下文 (avatarId, userId)                 │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3. 返回结果                                         │ │
│  │     {                                                │ │
│  │       success: true,                                │ │
│  │       toolName: "write_article",                    │ │
│  │       data: {                                        │ │
│  │         title: "关于AI的文章",                       │ │
│  │         content: "..."                              │ │
│  │       },                                             │ │
│  │       executionTime: 1234                           │ │
│  │     }                                                │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│            响应生成层 (generateResponse)                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │  生成自然语言回复:                                   │ │
│  │  "好的，我为您写了一篇关于AI的说明文：\n\n"           │ │
│  │  "【关于AI的文章】\n"                               │ │
│  │  "这是一篇关于AI的说明文..."                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      最终输出                             │
│                  文章内容 + 自然语言说明                   │
└─────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. AvatarToolRegistry（工具注册表）

**位置**：`server/src/modules/avatar-agent/tools/tool-registry.ts`

**职责**：
- 注册和管理所有可用的工具
- 提供工具的查找和调用接口
- 验证工具参数
- 生成工具描述（供大模型使用）

**关键方法**：

```typescript
// 注册工具
registerTool(tool: AvatarTool): void

// 获取工具
getTool(name: string): AvatarTool | undefined

// 执行工具
async executeTool(
  toolName: string,
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult>

// 验证参数
validateToolParams(
  toolName: string,
  params: Record<string, any>
): { valid: boolean; errors: string[] }

// 获取工具描述（供大模型使用）
getToolsDescription(): string
```

### 2. AvatarTool（工具接口）

**位置**：`server/src/modules/avatar-agent/tools/tool.interface.ts`

**职责**：定义工具的标准接口

```typescript
export interface AvatarTool {
  name: string                    // 工具唯一标识
  displayName: string             // 工具显示名称
  description: string             // 工具描述（给大模型看）
  category: 'content' | 'data' | 'social' | 'task' | 'system'
  paramsSchema: {                 // 参数定义
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
```

### 3. 工具实现类

目前已实现的工具包括：

#### 内容创作工具
- **WriteArticleTool**：写文章
- **GenerateImageTool**：生成图片
- **SummarizeTool**：总结内容

#### 数据查询工具
- **QueryUserProfileTool**：查询用户信息
- **QueryOrdersTool**：查询订单
- **QueryFriendsTool**：查询好友列表

#### 社交互动工具
- **SendMessageTool**：发送消息
- **CreateMomentTool**：发布朋友圈
- **AddCommentTool**：添加评论

#### 任务管理工具
- **CreateTaskTool**：创建任务
- **UpdateTaskStatusTool**：更新任务状态
- **QueryTasksTool**：查询任务列表
- **AssignTaskTool**：分配任务

#### 用户管理工具
- **ChangePasswordTool**：修改密码
- **UpdateProfileTool**：更新个人资料
- **UploadAvatarTool**：上传头像
- **BindPhoneTool**：绑定手机号
- **DeleteAccountTool**：删除账号

## 完整流程示例

### 示例 1：写文章

**用户输入**：
```
帮我写一篇关于人工智能的说明文，字数1000字
```

**Step 1: 构建推理上下文**
```typescript
【系统角色】
你是一个智能助手，能够帮助用户完成各种任务。

【角色设定】
你擅长内容创作，能够根据用户需求生成高质量的文章。

【可用工具】
工具名称: write_article
显示名称: 写文章
分类: content
描述: 根据主题和要求生成文章内容
参数:
  - topic: 文章主题（必填）
  - genre: 文章体裁：narrative-记叙文, argumentative-议论文, exposition-说明文, essay-散文（可选）
  - length: 文章字数（可选）
  - style: 写作风格（可选）

...（其他工具）

【工具使用指南】
当用户请求需要使用工具时，请：
1. 识别用户意图，判断是否需要工具
2. 如果需要工具，从【可用工具】中选择最合适的工具
3. 填写工具所需的参数

【对话历史】
（历史对话）

【用户消息】
帮我写一篇关于人工智能的说明文，字数1000字
```

**Step 2: 大模型输出意图**
```
Thought: 用户想要写一篇关于人工智能的说明文，要求字数1000字。这需要使用写文章工具。
Intent Type: content_creation
Requires Tool: true
Tool Name: write_article
Parameters: {"topic":"人工智能","genre":"exposition","length":1000}
Confidence: 0.98
```

**Step 3: 执行工具**
```typescript
// 参数验证
{
  valid: true,
  errors: []
}

// 执行 WriteArticleTool.execute()
{
  success: true,
  toolName: "write_article",
  data: {
    title: "关于人工智能的说明文",
    content: "这是一篇关于人工智能的说明文...",
    metadata: {
      topic: "人工智能",
      genre: "exposition",
      length: 1000
    }
  },
  executionTime: 2345
}
```

**Step 4: 生成响应**
```typescript
{
  content: "好的，我为您写了一篇关于人工智能的说明文：\n\n【关于人工智能的说明文】\n这是一篇关于人工智能的说明文...",
  metadata: {
    toolUsed: "write_article",
    executionTime: 2345
  }
}
```

### 示例 2：查询订单

**用户输入**：
```
帮我查看一下我有哪些订单
```

**Step 1: 大模型识别意图**
```
Thought: 用户想要查看订单列表，需要使用查询订单工具。
Intent Type: data_query
Requires Tool: true
Tool Name: query_orders
Parameters: {"userId":"user123"}
Confidence: 0.95
```

**Step 2: 执行工具**
```typescript
QueryOrdersTool.execute({
  userId: "user123"
}, context)
```

**Step 3: 返回订单数据**
```typescript
{
  success: true,
  data: {
    orders: [
      { id: "ord-001", status: "completed", amount: 99.00 },
      { id: "ord-002", status: "active", amount: 199.00 }
    ],
    total: 2
  }
}
```

**Step 4: 生成自然语言回复**
```
您一共有 2 个订单：
1. 订单 ord-001 - 已完成 - ¥99.00
2. 订单 ord-002 - 进行中 - ¥199.00
```

### 示例 3：修改密码

**用户输入**：
```
帮我修改一下账号密码，旧密码是123456，新密码是abcdef
```

**Step 1: 大模型识别意图**
```
Thought: 用户想要修改密码，需要使用修改密码工具。
Intent Type: system
Requires Tool: true
Tool Name: change_password
Parameters: {"userId":"user123","oldPassword":"123456","newPassword":"abcdef"}
Confidence: 0.98
```

**Step 2: 执行工具**
```typescript
ChangePasswordTool.execute({
  userId: "user123",
  oldPassword: "123456",
  newPassword: "abcdef"
}, context)
```

**Step 3: 返回结果**
```typescript
{
  success: true,
  toolName: "change_password",
  data: {
    message: "密码修改成功",
    userId: "user123"
  },
  executionTime: 456
}
```

**Step 4: 生成自然语言回复**
```
密码修改成功！请记住您的新密码，下次登录时使用新密码。
```

## 扩展工具系统

### 添加新工具

1. **创建工具类**：

```typescript
// server/src/modules/avatar-agent/tools/my-custom-tool.ts
import { Injectable } from '@nestjs/common'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

@Injectable()
export class MyCustomTool implements AvatarTool {
  name = 'my_custom_tool'
  displayName = '我的自定义工具'
  description = '工具描述'
  category = 'system' as const

  paramsSchema = {
    param1: {
      type: 'string',
      description: '参数1描述',
      required: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    // 实现工具逻辑
    return {
      success: true,
      toolName: this.name,
      data: { result: '工具执行结果' }
    }
  }
}
```

2. **注册工具**：

```typescript
// server/src/modules/avatar-agent/tools/tool-registry.ts
import { MyCustomTool } from './my-custom-tool'

constructor(
  private readonly myCustomTool: MyCustomTool
  // ...其他工具
) {
  this.registerTool(this.myCustomTool)
  // ...
}
```

3. **在 Module 中提供**：

```typescript
// server/src/modules/avatar-agent/avatar-agent.module.ts
import { MyCustomTool } from './tools/my-custom-tool'

@Module({
  providers: [
    // ...
    MyCustomTool
  ]
})
```

### 工具分类

工具按类别组织，便于管理：

- **content**：内容创作（写文章、生成图片、总结等）
- **data**：数据查询（用户信息、订单、好友等）
- **social**：社交互动（发消息、朋友圈、评论等）
- **task**：任务管理（创建、更新、查询任务等）
- **system**：系统功能（工具调用、配置管理等）

## 高级特性

### 1. 参数验证

工具注册表会自动验证参数：

```typescript
const validation = toolRegistry.validateToolParams('write_article', {
  topic: 'AI'  // 缺少 genre 参数（如果是必填）
})

// {
//   valid: false,
//   errors: ['缺少必填参数: genre']
// }
```

### 2. 工具链

可以在一个推理过程中调用多个工具：

```
Thought: 用户想要生成一张图片并发布到朋友圈
1. 使用 generate_image 生成图片
2. 使用 create_moment 发布到朋友圈
```

### 3. 上下文传递

工具执行时可以访问上下文信息：

```typescript
interface ToolContext {
  avatarId: string    // 分身ID
  userId: string      // 用户ID
  conversationId?: string  // 对话ID
  metadata?: Record<string, any>
}
```

### 4. 学习与优化

工具执行结果会被学习系统记录，用于：

- 更新工具熟练度
- 优化意图识别
- 改进参数提取

```typescript
// 学习系统会记录
await learningService.learnFromResult(avatarId, thought, actionResult)
```

## 总结

分身 Agent 的"问题映射到解决方案"能力是一个多层次、模块化的系统：

1. **理解层**：大模型理解用户问题
2. **推理层**：提取结构化意图
3. **注册层**：管理和提供工具
4. **执行层**：验证并执行工具
5. **响应层**：生成自然语言回复

这个架构的优势：
- **可扩展**：添加新工具只需实现接口并注册
- **可维护**：工具与推理逻辑解耦
- **可测试**：每个工具可独立测试
- **智能化**：大模型负责意图理解，工具负责具体执行
- **可学习**：执行结果反馈给学习系统，持续优化

通过这个系统，分身 Agent 能够理解复杂的问题，并调用合适的工具来解决问题，真正实现了"问题映射到解决方案"的智能能力。
