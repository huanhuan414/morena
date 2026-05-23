// @ts-nocheck
import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getMySQLClient, deleteRow } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class ChatService {

  async createConversation(userId: string, avatarId: string, title?: string) {
    const db = getMySQLClient()

    if (!avatarId) {
      avatarId = 'default-avatar'
    }

    const id = crypto.randomUUID()
    await db.insert('conversations', {
      id,
      user_id: userId,
      avatar_id: avatarId,
      title: title || '新对话',
      context: JSON.stringify([]),
      updated_at: new Date(),
      created_at: new Date()
    })

    return await db.queryOne('conversations', { id })
  }

  async getConversations(userId: string) {
    const db = getMySQLClient()
    
    const result = await db.query('conversations', { user_id: userId }, {
      orderBy: 'updated_at',
      orderDirection: 'desc'
    })
    
    return result?.data || []
  }

  async getMessages(conversationId: string) {
    const db = getMySQLClient()
    
    const result = await db.query('messages', { conversation_id: conversationId }, {
      orderBy: 'created_at',
      orderDirection: 'asc'
    })
    
    return result?.data || []
  }

  async addMessage(conversationId: string, message: {
    role: string
    content: string
    metadata?: Record<string, any>
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('messages', {
      id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      created_at: new Date()
    })
    
    // 更新对话更新时间
    await db.updateWhere('conversations', { id: conversationId }, {
      updated_at: new Date()
    })
    
    return await db.queryOne('conversations', { id })
  }

  async deleteConversation(userId: string, conversationId: string) {
    const db = getMySQLClient()
    
    const conversation = await db.queryOne('conversations', { 
      id: conversationId, 
      user_id: userId 
    })
    
    if (!conversation) {
      throw new Error('对话不存在或无权删除')
    }
    
    await deleteRow('messages', { conversation_id: conversationId })
    await deleteRow('conversations', { id: conversationId })
    
    return { success: true }
  }

  async updateConversationTitle(userId: string, conversationId: string, title: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('conversations', { id: conversationId, user_id: userId }, {
      title,
      updated_at: new Date()
    })
    
    return await db.queryOne('conversations', { id: conversationId })
  }

  async clearConversation(conversationId: string) {
    await deleteRow('messages', { conversation_id: conversationId })
    return { success: true }
  }
}
