# 分身 Agent 架构设计文档

## 一、数据库表设计

### 1. 分身长期记忆表（avatar_memories）
存储分身的长期记忆，使用向量存储支持语义搜索

```sql
CREATE TABLE avatar_memories (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id VARCHAR(36) NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  memory_type VARCHAR(50) NOT NULL, -- 'conversation', 'learning', 'preference', 'experience'
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- 向量存储
  metadata JSONB DEFAULT '{}',
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_memory_type (memory_type),
  INDEX idx_embedding USING ivfflat (embedding vector_cosine_ops)
);

COMMENT ON TABLE avatar_memories IS '分身长期记忆表';
COMMENT ON COLUMN avatar_memories.memory_type IS '记忆类型：conversation-对话, learning-学习, preference-偏好, experience-经验';
COMMENT ON COLUMN avatar_memories.embedding IS '向量嵌入，用于语义搜索';
```

### 2. 分身对话上下文表（avatar_contexts）
存储每个分身的对话上下文

```sql
CREATE TABLE avatar_contexts (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id VARCHAR(36) NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  context_type VARCHAR(50) NOT NULL, -- 'current', 'recent', 'important'
  context_data JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_context_type (context_type),
  INDEX idx_priority (priority)
);

COMMENT ON TABLE avatar_contexts IS '分身对话上下文表';
```

### 3. 分身技能配置表（avatar_agent_configs）
存储每个分身的 Agent 配置

```sql
CREATE TABLE avatar_agent_configs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id VARCHAR(36) NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL,
  role_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  enabled_tools JSONB DEFAULT '[]', -- 启用的工具列表
  knowledge_bases JSONB DEFAULT '[]', -- 关联的知识库
  reasoning_mode VARCHAR(50) DEFAULT 'react', -- 'react', 'chain_of_thought', 'few_shot'
  learning_enabled BOOLEAN DEFAULT true,
  memory_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(avatar_id),
  INDEX idx_avatar_id (avatar_id)
);

COMMENT ON TABLE avatar_agent_configs IS '分身 Agent 配置表';
COMMENT ON COLUMN avatar_agent_configs.system_prompt IS '系统提示词，定义分身的角色和任务';
COMMENT ON COLUMN avatar_agent_configs.reasoning_mode IS '推理模式：react-推理行动, chain_of_thought-思维链, few_shot-少样本学习';
```

### 4. 分身技能表（avatar_skills）
存储分身的技能配置

```sql
CREATE TABLE avatar_skills (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id VARCHAR(36) NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  skill_type VARCHAR(50) NOT NULL, -- 'writing', 'image_gen', 'video_gen', 'publishing', 'customer_service'
  skill_name VARCHAR(100) NOT NULL,
  skill_level INTEGER DEFAULT 1, -- 1-10
  proficiency DECIMAL(5,2) DEFAULT 0.0, -- 0-1, 熟练度
  training_data JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(avatar_id, skill_type),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_skill_type (skill_type),
  INDEX idx_skill_level (skill_level)
);

COMMENT ON TABLE avatar_skills IS '分身技能表';
COMMENT ON COLUMN avatar_skills.proficiency IS '熟练度：0-1，基于使用效果自动调整';
```

### 5. 分身学习记录表（avatar_learning_records）
记录分身的学习过程

```sql
CREATE TABLE avatar_learning_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id VARCHAR(36) NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  learning_type VARCHAR(50) NOT NULL, -- 'feedback', 'observation', 'interaction', 'task_completion'
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  feedback_score INTEGER, -- 1-5
  learned_knowledge TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_learning_type (learning_type),
  INDEX idx_created_at (created_at)
);

COMMENT ON TABLE avatar_learning_records IS '分身学习记录表';
```

## 二、核心服务设计

### 1. AvatarAgentService（分身 Agent 服务）

```typescript
// server/src/modules/avatar-agent/avatar-agent.service.ts

@Injectable()
export class AvatarAgentService {
  private llmClient: LLMClient
  private embeddingClient: EmbeddingClient
  private vectorStore: VectorStore

  constructor(
    @Inject(forwardRef(() => AvatarAgentGateway))
    private readonly gateway: AvatarAgentGateway,
    private readonly memoryService: AvatarMemoryService,
    private readonly toolService: AvatarToolService,
    private readonly learningService: AvatarLearningService
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    this.embeddingClient = new EmbeddingClient(config)
    this.vectorStore = new VectorStore(config)
  }

  /**
   * 分身推理核心方法
   */
  async think(
    avatarId: string,
    userMessage: string,
    context?: AvatarContext
  ): Promise<AvatarThought> {
    // 1. 加载分身配置
    const config = await this.loadAvatarConfig(avatarId)
    
    // 2. 检索相关记忆
    const relevantMemories = await this.memoryService.retrieveRelevantMemories(
      avatarId,
      userMessage,
      config.memory_config
    )
    
    // 3. 构建推理上下文
    const reasoningContext = await this.buildReasoningContext(
      avatarId,
      userMessage,
      context,
      relevantMemories,
      config
    )
    
    // 4. 执行推理
    const thought = await this.executeReasoning(
      avatarId,
      reasoningContext,
      config
    )
    
    // 5. 存储推理过程
    await this.memoryService.storeThought(avatarId, thought)
    
    return thought
  }

  /**
   * 执行动作
   */
  async act(
    avatarId: string,
    thought: AvatarThought
  ): Promise<AvatarActionResult> {
    // 1. 解析意图
    const intent = this.parseIntent(thought)
    
    // 2. 选择工具
    const tool = await this.toolService.selectTool(avatarId, intent)
    
    // 3. 执行工具
    const result = await this.toolService.executeTool(avatarId, tool, intent.params)
    
    // 4. 学习结果
    if (config.learning_enabled) {
      await this.learningService.learnFromResult(avatarId, thought, result)
    }
    
    return result
  }

  /**
   * 对话处理（完整流程）
   */
  async chat(
    avatarId: string,
    userId: string,
    message: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<AvatarResponse> {
    // 1. 理解意图
    const thought = await this.think(avatarId, message, {
      userId,
      history: conversationHistory
    })
    
    // 2. 生成响应
    let response: AvatarResponse
    
    if (thought.requiresTool) {
      // 需要调用工具
      const actionResult = await this.act(avatarId, thought)
      response = await this.generateResponse(avatarId, thought, actionResult)
    } else {
      // 直接回复
      response = await this.generateResponse(avatarId, thought)
    }
    
    // 3. 存储记忆
    await this.memoryService.storeConversation(avatarId, userId, {
      userMessage: message,
      assistantResponse: response.content,
      thought,
      metadata: response.metadata
    })
    
    // 4. 更新技能熟练度
    await this.learningService.updateSkillProficiency(avatarId, thought, response)
    
    return response
  }
}
```

### 2. AvatarMemoryService（记忆管理服务）

```typescript
@Injectable()
export class AvatarMemoryService {
  /**
   * 存储对话记忆
   */
  async storeConversation(
    avatarId: string,
    userId: string,
    data: ConversationData
  ): Promise<void> {
    // 1. 生成嵌入
    const embedding = await this.embeddingClient.embed(
      `${data.userMessage}\n${data.assistantResponse}`
    )
    
    // 2. 存储到向量数据库
    await this.vectorStore.insert({
      avatar_id: avatarId,
      memory_type: 'conversation',
      content: data.assistantResponse,
      embedding,
      metadata: {
        user_id: userId,
        user_message: data.userMessage,
        timestamp: new Date().toISOString()
      }
    })
    
    // 3. 更新短期记忆
    await this.updateShortTermMemory(avatarId, data)
  }

  /**
   * 检索相关记忆（语义搜索）
   */
  async retrieveRelevantMemories(
    avatarId: string,
    query: string,
    config: MemoryConfig
  ): Promise<Memory[]> {
    // 1. 生成查询嵌入
    const queryEmbedding = await this.embeddingClient.embed(query)
    
    // 2. 向量搜索
    const results = await this.vectorStore.search({
      avatar_id: avatarId,
      embedding: queryEmbedding,
      limit: config.max_retrieval || 5,
      threshold: config.similarity_threshold || 0.7
    })
    
    // 3. 按类型过滤
    return results.filter(r => 
      config.allowed_types?.includes(r.memory_type) ?? true
    )
  }

  /**
   * 存储偏好记忆
   */
  async storePreference(
    avatarId: string,
    userId: string,
    preference: Preference
  ): Promise<void> {
    await this.vectorStore.insert({
      avatar_id: avatarId,
      memory_type: 'preference',
      content: preference.description,
      embedding: await this.embeddingClient.embed(preference.description),
      metadata: {
        user_id: userId,
        preference_type: preference.type,
        value: preference.value
      }
    })
  }

  /**
   * 存储经验记忆
   */
  async storeExperience(
    avatarId: string,
    experience: Experience
  ): Promise<void> {
    await this.vectorStore.insert({
      avatar_id: avatarId,
      memory_type: 'experience',
      content: experience.description,
      embedding: await this.embeddingClient.embed(experience.description),
      metadata: {
        task_type: experience.task_type,
        success: experience.success,
        outcome: experience.outcome
      }
    })
  }
}
```

### 3. AvatarToolService（工具服务）

```typescript
@Injectable()
export class AvatarToolService {
  private availableTools: Map<string, AvatarTool> = new Map()

  constructor() {
    this.registerBuiltInTools()
  }

  /**
   * 注册内置工具
   */
  private registerBuiltInTools(): void {
    // 内容创作工具
    this.registerTool(new WriteArticleTool())
    this.registerTool(new GenerateImageTool())
    this.registerTool(new GenerateVideoTool())
    
    // 发布工具
    this.registerTool(new PublishWechatMpTool())
    this.registerTool(new PublishXiaohongshuTool())
    
    // 数据查询工具
    this.registerTool(new QueryUserInfoTool())
    this.registerTool(new QueryOrderTool())
    
    // 客服工具
    this.registerTool(new HandleComplaintTool())
    this.registerTool(new ProcessRefundTool())
  }

  /**
   * 选择工具（基于意图）
   */
  async selectTool(
    avatarId: string,
    intent: Intent
  ): Promise<AvatarTool> {
    // 1. 获取分身启用的工具
    const config = await this.loadAvatarConfig(avatarId)
    const enabledToolNames = config.enabled_tools
    
    // 2. 根据意图匹配工具
    const matchedTool = this.availableTools.get(intent.toolName)
    
    if (!matchedTool) {
      throw new Error(`Tool not found: ${intent.toolName}`)
    }
    
    // 3. 检查工具是否启用
    if (!enabledToolNames.includes(intent.toolName)) {
      throw new Error(`Tool not enabled for avatar: ${intent.toolName}`)
    }
    
    return matchedTool
  }

  /**
   * 执行工具
   */
  async executeTool(
    avatarId: string,
    tool: AvatarTool,
    params: Record<string, any>
  ): Promise<ToolResult> {
    try {
      // 1. 执行工具
      const result = await tool.execute(params, { avatarId })
      
      // 2. 记录使用
      await this.recordToolUsage(avatarId, tool.name, params, result)
      
      return result
    } catch (error) {
      // 3. 错误处理
      return {
        success: false,
        error: error.message
      }
    }
  }
}
```

### 4. AvatarLearningService（学习服务）

```typescript
@Injectable()
export class AvatarLearningService {
  /**
   * 从结果中学习
   */
  async learnFromResult(
    avatarId: string,
    thought: AvatarThought,
    result: AvatarActionResult
  ): Promise<void> {
    // 1. 记录学习数据
    await this.learningRepository.create({
      avatar_id: avatarId,
      learning_type: 'task_completion',
      input_data: {
        thought: thought.content,
        intent: thought.intent
      },
      output_data: result,
      feedback_score: result.success ? 5 : 1
    })
    
    // 2. 如果成功，存储为经验
    if (result.success) {
      await this.memoryService.storeExperience(avatarId, {
        description: `成功执行任务: ${thought.content}`,
        task_type: thought.intent.type,
        success: true,
        outcome: result.data
      })
    }
  }

  /**
   * 更新技能熟练度
   */
  async updateSkillProficiency(
    avatarId: string,
    thought: AvatarThought,
    response: AvatarResponse
  ): Promise<void> {
    const skillType = thought.intent.skill_type
    if (!skillType) return

    const skill = await this.skillRepository.findOne({
      where: {
        avatar_id: avatarId,
        skill_type: skillType
      }
    })

    if (!skill) return

    // 基于反馈更新熟练度
    const currentProficiency = skill.proficiency
    const feedback = response.metadata?.feedback_score || 3 // 1-5

    // 简单的加权平均
    const newProficiency = (currentProficiency * 0.9) + ((feedback / 5) * 0.1)

    await this.skillRepository.update(skill.id, {
      proficiency: newProficiency,
      usage_count: skill.usage_count + 1,
      last_used_at: new Date()
    })
  }

  /**
   * 个性化学习
   */
  async personalize(
    avatarId: string,
    userId: string,
    interactions: Interaction[]
  ): Promise<void> {
    // 1. 分析用户偏好
    const preferences = this.analyzeUserPreferences(interactions)
    
    // 2. 存储偏好记忆
    for (const pref of preferences) {
      await this.memoryService.storePreference(avatarId, userId, pref)
    }
    
    // 3. 调整分身配置
    await this.adjustAvatarConfig(avatarId, preferences)
  }

  /**
   * 知识蒸馏（从其他分身学习）
   */
  async knowledgeDistillation(
    sourceAvatarId: string,
    targetAvatarId: string
  ): Promise<void> {
    // 1. 提取源分身的有效经验
    const experiences = await this.memoryService.retrieveExperiences(
      sourceAvatarId,
      { min_success_rate: 0.8 }
    )
    
    // 2. 迁移到目标分身
    for (const exp of experiences) {
      await this.memoryService.storeExperience(targetAvatarId, {
        ...exp,
        source: 'distillation'
      })
    }
  }
}
```

## 三、API 设计

### 1. 分身推理接口

```typescript
// POST /api/avatar-agent/:avatarId/think
interface ThinkRequest {
  message: string
  userId: string
  context?: {
    conversationHistory?: ConversationMessage[]
    currentTask?: string
  }
}

interface ThinkResponse {
  thought: {
    content: string
    intent: {
      type: string
      toolName?: string
      params?: Record<string, any>
    }
    requiresTool: boolean
  }
  relevantMemories: Memory[]
}
```

### 2. 分身对话接口

```typescript
// POST /api/avatar-agent/:avatarId/chat
interface ChatRequest {
  userId: string
  message: string
  conversationId?: string
  stream?: boolean
}

interface ChatResponse {
  response: {
    content: string
    metadata: {
      thought: AvatarThought
      toolResults?: ToolResult[]
      confidence: number
    }
  }
}
```

### 3. 分身配置接口

```typescript
// PUT /api/avatar-agent/:avatarId/config
interface ConfigRequest {
  systemPrompt?: string
  temperature?: number
  enabledTools?: string[]
  reasoningMode?: 'react' | 'chain_of_thought' | 'few_shot'
  learningEnabled?: boolean
}
```

### 4. 记忆管理接口

```typescript
// GET /api/avatar-agent/:avatarId/memories
interface GetMemoriesRequest {
  type?: 'conversation' | 'preference' | 'experience'
  limit?: number
  userId?: string
}

// POST /api/avatar-agent/:avatarId/memories
interface StoreMemoryRequest {
  type: 'preference' | 'experience'
  content: string
  metadata?: Record<string, any>
}
```

## 四、实现步骤

### 阶段 1：基础架构（2-3 周）
1. 创建数据库表
2. 实现 AvatarMemoryService（基础 CRUD）
3. 集成向量数据库（支持嵌入和搜索）
4. 实现基础的记忆存储和检索

### 阶段 2：推理引擎（3-4 周）
1. 实现 AvatarAgentService 核心逻辑
2. 实现 ReAct 推理模式
3. 集成大模型调用
4. 实现工具选择和执行

### 阶段 3：学习系统（2-3 周）
1. 实现 AvatarLearningService
2. 实现反馈学习
3. 实现偏好学习
4. 实现经验积累

### 阶段 4：个性化优化（2-3 周）
1. 实现分身个性化配置
2. 实现技能熟练度系统
3. 实现知识蒸馏
4. 优化记忆检索算法

### 阶段 5：性能优化（1-2 周）
1. 实现记忆缓存
2. 优化向量搜索性能
3. 实现批处理
4. 监控和日志

## 五、关键技术点

### 1. 向量存储
推荐使用：
- **pgvector**（PostgreSQL 扩展）- 已有数据库，无需额外服务
- **Pinecone** - 专门的向量数据库
- **Weaviate** - 开源向量数据库

### 2. 嵌入模型
推荐使用：
- **OpenAI text-embedding-3-small** - 性价比高
- **Cohere embed-multilingual-v3** - 多语言支持
- **M3E** - 中文优化

### 3. 记忆检索策略
```typescript
interface RetrievalStrategy {
  // 混合检索：向量搜索 + 关键词过滤
  hybrid: boolean
  
  // 时间衰减：新记忆权重更高
  timeDecay: number
  
  // 类型权重：不同类型记忆的优先级
  typeWeights: {
    conversation: number
    preference: number
    experience: number
  }
  
  // 多样性：避免重复返回相似记忆
  diversityThreshold: number
}
```

### 4. 分身个性化
```typescript
interface AvatarPersonality {
  // 回复风格
  responseStyle: 'formal' | 'casual' | 'humorous' | 'professional'
  
  // 语言偏好
  language: 'zh-CN' | 'en-US' | 'mixed'
  
  // 专业领域
  expertise: string[]
  
  // 交互模式
  interactionMode: 'proactive' | 'reactive' | 'adaptive'
  
  // 创造力水平
  creativity: number // 0-1
  
  // 严格程度
  strictness: number // 0-1
}
```

## 六、示例场景

### 场景 1：客服分身
```typescript
// 创建客服分身
const customerServiceAvatar = await createAvatar({
  name: '小客服',
  personality: '专业、耐心、友好',
  systemPrompt: `你是一个专业的客服代表，负责解答用户问题。
  - 使用礼貌和友好的语气
  - 优先解决用户问题
  - 记住用户的偏好和历史问题
  - 遇到无法解决的问题时，主动寻求帮助`,
  
  enabledTools: [
    'handle_complaint',
    'process_refund',
    'query_order',
    'query_user_info'
  ],
  
  skills: [
    { type: 'customer_service', level: 8, proficiency: 0.9 }
  ]
})

// 用户对话
const response = await avatarAgent.chat(
  customerServiceAvatar.id,
  userId,
  '我的订单还没收到，能帮我查一下吗？'
)

// 分身会：
// 1. 检索用户的订单历史记忆
// 2. 调用 query_order 工具查询订单状态
// 3. 根据订单信息生成个性化回复
// 4. 记住用户关心订单进度
```

### 场景 2：营销分身
```typescript
// 创建营销分身
const marketingAvatar = await createAvatar({
  name: '营销专家',
  personality: '热情、专业、有说服力',
  systemPrompt: `你是一个营销专家，负责推广产品和活动。
  - 使用吸引人的语言
  - 突出产品卖点
  - 了解用户需求，个性化推荐
  - 记住用户的兴趣和偏好`,
  
  enabledTools: [
    'write_article',
    'generate_image',
    'publish_wechat_mp',
    'publish_xiaohongshu'
  ],
  
  skills: [
    { type: 'writing', level: 7, proficiency: 0.85 },
    { type: 'image_gen', level: 6, proficiency: 0.8 }
  ]
})

// 用户对话
const response = await avatarAgent.chat(
  marketingAvatar.id,
  userId,
  '帮我写一篇推广新产品的文章'
)

// 分身会：
// 1. 检索用户的营销风格偏好
// 2. 调用 write_article 工具生成文章
// 3. 调用 generate_image 工具生成配图
// 4. 根据用户反馈优化内容
```

## 七、成本估算

### 基础成本
- 向量存储：$50-100/月（100K 记忆）
- 嵌入 API：$0.1/1K 次
- 大模型调用：$0.002/1K tokens

### 单分身成本
- 对话：~$0.01/次
- 记忆存储：~$0.001/条
- 学习：~$0.005/次

### 100 个分身
- 每日 1000 次对话：~$300/月
- 记忆存储：~$100/月
- 总计：~$400-500/月

## 八、扩展性考虑

### 1. 水平扩展
- 每个分身独立服务实例
- 负载均衡
- 分布式缓存

### 2. 垂直扩展
- GPU 加速（嵌入生成）
- 分布式向量搜索
- 模型量化

### 3. 多租户
- 分身隔离
- 资源配额
- 成本分摊
