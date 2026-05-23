// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class AvatarMemoryService {
  async addMemory(avatarId: number, memoryData: any) {
    const db = getMySQLClient()
    const id = Date.now().toString()
    const result = await db.insert('avatar_memories', {
      id,
      avatar_id: avatarId,
      memory_type: memoryData.type || 'general',
      memory_content: memoryData.content || '',
      importance: memoryData.importance || 5,
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0, id }
  }

  async getMemories(avatarId: number, options?: { limit?: number; type?: string }) {
    const db = getMySQLClient()
    const filter: any = { avatar_id: avatarId }
    if (options?.type) {
      filter.memory_type = options.type
    }
    const result = await db.select('avatar_memories', filter, {
      limit: options?.limit || 100
    })
    return result.data || []
  }

  async deleteMemory(memoryId: number) {
    const db = getMySQLClient()
    const result = await db.delete('avatar_memories', { id: memoryId })
    return { success: (result as any).affectedRows > 0 }
  }

  async updateMemory(memoryId: number, updateData: any) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatar_memories', { id: memoryId }, updateData)
    return { success: (result as any).affectedRows > 0 }
  }

  async retrieveRelevantMemories(avatarId: number, query: string) {
    const db = getMySQLClient()
    const result = await db.select('avatar_memories', { avatar_id: avatarId }, { limit: 10 })
    return result.data || []
  }

  async storeConversation(avatarId: number, conversationData: any) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_conversations', {
      id: Date.now().toString(),
      avatar_id: avatarId,
      user_id: conversationData.userId,
      message: conversationData.message,
      response: conversationData.response,
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async storeThought(avatarId: number, thoughtData: any) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_thoughts', {
      id: Date.now().toString(),
      avatar_id: avatarId,
      thought_content: thoughtData.content,
      thought_type: thoughtData.type || 'general',
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }
}
