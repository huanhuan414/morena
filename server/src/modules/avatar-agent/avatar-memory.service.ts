/**
 * Avatar Memory Service
 * 分身记忆管理服务
 */

import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import {
  Memory,
  MemoryConfig,
  ConversationData,
  Preference,
  Experience
} from './avatar-agent.types'

@Injectable()
export class AvatarMemoryService {
  private readonly logger = new Logger(AvatarMemoryService.name)

  constructor() {
    // 延迟初始化 embedding 客户端
  }

  private embeddingClient: any = null

  private async getEmbeddingClient() {
    // TODO: 实现嵌入客户端
    // 目前返回 null，使用简单的文本匹配
    return null
  }

  /**
   * 生成文本嵌入
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    const client = await this.getEmbeddingClient()
    if (!client) return null

    try {
      const result = await (client as any).embed ? (client as any).embed(text) : null
      return result
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error)
      return null
    }
  }

  /**
   * 存储对话记忆
   */
  async storeConversation(
    avatarId: string,
    userId: string,
    data: ConversationData
  ): Promise<void> {
    try {
      // 生成嵌入
      const embedding = await this.generateEmbedding(
        `${data.userMessage}\n${data.assistantResponse}`
      )

      // 存储记忆
      const { error } = await getSupabaseClient()
        .from('avatar_memories')
        .insert({
          avatar_id: avatarId,
          memory_type: 'conversation',
          content: data.assistantResponse,
          embedding: embedding,
          metadata: {
            user_id: userId,
            user_message: data.userMessage,
            thought: data.thought,
            timestamp: new Date().toISOString()
          }
        })

      if (error) {
        this.logger.error('Failed to store conversation memory:', error)
      } else {
        this.logger.log(`Stored conversation memory for avatar ${avatarId}`)
      }
    } catch (error) {
      this.logger.error('Error storing conversation memory:', error)
    }
  }

  /**
   * 检索相关记忆（基于向量相似度）
   */
  async retrieveRelevantMemories(
    avatarId: string,
    query: string,
    config: MemoryConfig = {}
  ): Promise<Memory[]> {
    try {
      const client = getSupabaseClient()

      // 如果有嵌入功能，使用向量搜索
      const embedding = await this.generateEmbedding(query)
      if (embedding) {
        // 获取所有该分身的记忆
        const { data: memories, error } = await client
          .from('avatar_memories')
          .select('*')
          .eq('avatar_id', avatarId)
          .order('access_count', { ascending: false })
          .limit(config.maxRetrieval || 10)

        if (error) throw error

        // 计算相似度并过滤
        const processedMemories = (memories || [])
          .map(mem => {
            const memEmbedding = mem.embedding as number[] | null
            let similarity = 0
            if (memEmbedding) {
              similarity = this.cosineSimilarity(embedding, memEmbedding)
            }
            return {
              id: mem.id,
              avatarId: mem.avatar_id,
              memoryType: mem.memory_type,
              content: mem.content,
              embedding: memEmbedding,
              metadata: mem.metadata,
              accessCount: mem.access_count,
              lastAccessedAt: mem.last_accessed_at,
              createdAt: mem.created_at,
              updatedAt: mem.updated_at,
              similarity // 临时字段
            }
          })
          .filter(mem => {
            // 类型过滤
            if (config.allowedTypes && !config.allowedTypes.includes(mem.memoryType)) {
              return false
            }
            // 相似度阈值过滤
            const threshold = config.similarityThreshold || 0.7
            return (mem as any).similarity >= threshold
          })
          .sort((a, b) => (b as any).similarity - (a as any).similarity)
          .slice(0, config.maxRetrieval || 5)

        // 移除 similarity 字段并确保类型正确
        const filteredMemories = processedMemories.map((mem: any) => ({
          id: mem.id,
          avatarId: mem.avatarId,
          memoryType: mem.memoryType,
          content: mem.content,
          embedding: mem.embedding,
          metadata: mem.metadata,
          accessCount: mem.accessCount,
          lastAccessedAt: mem.lastAccessedAt,
          createdAt: mem.createdAt,
          updatedAt: mem.updatedAt
        })) as unknown as Memory[]

        // 更新访问计数
        for (const mem of processedMemories) {
          await client
            .from('avatar_memories')
            .update({
              access_count: mem.accessCount + 1,
              last_accessed_at: new Date().toISOString()
            })
            .eq('id', mem.id)
        }

        return filteredMemories
      }

      // 降级：使用关键词匹配
      const { data: memories, error } = await client
        .from('avatar_memories')
        .select('*')
        .eq('avatar_id', avatarId)
        .ilike('content', `%${query}%`)
        .limit(config.maxRetrieval || 5)

      if (error) throw error

      const resultMemories = (memories || []).map((mem: any) => ({
        id: mem.id,
        avatarId: mem.avatar_id,
        memoryType: mem.memory_type,
        content: mem.content,
        embedding: null,
        metadata: mem.metadata,
        accessCount: mem.access_count,
        lastAccessedAt: mem.last_accessed_at,
        createdAt: mem.created_at,
        updatedAt: mem.updated_at
      })) as unknown as Memory[]

      return resultMemories
    } catch (error) {
      this.logger.error('Error retrieving memories:', error)
      return []
    }
  }

  /**
   * 存储偏好记忆
   */
  async storePreference(
    avatarId: string,
    userId: string,
    preference: Preference
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(preference.description)

      const { error } = await getSupabaseClient()
        .from('avatar_memories')
        .insert({
          avatar_id: avatarId,
          memory_type: 'preference',
          content: preference.description,
          embedding: embedding,
          metadata: {
            user_id: userId,
            preference_type: preference.type,
            value: preference.value,
            timestamp: new Date().toISOString()
          }
        })

      if (error) {
        this.logger.error('Failed to store preference:', error)
      }
    } catch (error) {
      this.logger.error('Error storing preference:', error)
    }
  }

  /**
   * 存储经验记忆
   */
  async storeExperience(
    avatarId: string,
    experience: Experience
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(experience.description)

      const { error } = await getSupabaseClient()
        .from('avatar_memories')
        .insert({
          avatar_id: avatarId,
          memory_type: 'experience',
          content: experience.description,
          embedding: embedding,
          metadata: {
            task_type: experience.taskType,
            success: experience.success,
            outcome: experience.outcome,
            timestamp: new Date().toISOString()
          }
        })

      if (error) {
        this.logger.error('Failed to store experience:', error)
      } else {
        this.logger.log(`Stored experience for avatar ${avatarId}`)
      }
    } catch (error) {
      this.logger.error('Error storing experience:', error)
    }
  }

  /**
   * 存储思考过程
   */
  async storeThought(avatarId: string, thought: any): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(thought.content || '')

      const { error } = await getSupabaseClient()
        .from('avatar_memories')
        .insert({
          avatar_id: avatarId,
          memory_type: 'learning',
          content: thought.content || '',
          embedding: embedding,
          metadata: {
            thought_type: 'reasoning',
            intent: thought.intent,
            requires_tool: thought.requiresTool,
            timestamp: new Date().toISOString()
          }
        })

      if (error) {
        this.logger.error('Failed to store thought:', error)
      }
    } catch (error) {
      this.logger.error('Error storing thought:', error)
    }
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 获取用户偏好（从记忆中提取）
   */
  async getUserPreferences(
    avatarId: string,
    userId: string
  ): Promise<Preference[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('avatar_memories')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('memory_type', 'preference')
        .contains('metadata', `{"user_id":"${userId}"}`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      return (data || []).map(mem => ({
        type: mem.metadata?.preference_type || 'unknown',
        description: mem.content,
        value: mem.metadata?.value
      }))
    } catch (error) {
      this.logger.error('Error getting user preferences:', error)
      return []
    }
  }

  /**
   * 获取分身经验
   */
  async getAvatarExperiences(
    avatarId: string,
    options?: {
      taskType?: string
      minSuccessRate?: number
      limit?: number
    }
  ): Promise<Experience[]> {
    try {
      const client = getSupabaseClient()
      let query = client
        .from('avatar_memories')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('memory_type', 'experience')

      if (options?.taskType) {
        query = query.contains('metadata', `{"task_type":"${options.taskType}"}`)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      let experiences = (data || []).map(mem => ({
        description: mem.content,
        taskType: mem.metadata?.task_type || 'unknown',
        success: mem.metadata?.success || false,
        outcome: mem.metadata?.outcome
      }))

      // 过滤成功率
      if (options?.minSuccessRate) {
        const successCount = experiences.filter(e => e.success).length
        const successRate = successCount / experiences.length
        if (successRate < options.minSuccessRate) {
          experiences = []
        }
      }

      return experiences
    } catch (error) {
      this.logger.error('Error getting avatar experiences:', error)
      return []
    }
  }
}
