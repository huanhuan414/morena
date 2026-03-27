import { Injectable } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class ChatService {
  private llmClient: LLMClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  async createConversation(userId: string, avatarId: string, title?: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('conversations')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        title: title || '新对话',
        context: []
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建对话失败: ${error.message}`)
    }
    
    return data
  }

  async getConversations(userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('conversations')
      .select('*, avatars(name, avatar_url)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取对话列表失败: ${error.message}`)
    }
    
    return data
  }

  async getConversationMessages(conversationId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) {
      throw new Error(`获取消息失败: ${error.message}`)
    }
    
    return data
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    avatarId: string,
    content: string,
    headers?: Record<string, string>
  ) {
    const client = getSupabaseClient()
    
    // 获取对话上下文
    const { data: conversation } = await client
      .from('conversations')
      .select('context')
      .eq('id', conversationId)
      .single()
    
    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    // 保存用户消息
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content
    })
    
    // 构建 AI 消息历史
    const messages = [
      {
        role: 'system' as const,
        content: this.buildSystemPrompt(avatar)
      },
      ...((conversation?.context || []) as any[]).slice(-10),
      { role: 'user' as const, content }
    ]
    
    // 调用 LLM
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
    const config = new Config()
    const llmClient = new LLMClient(config, customHeaders)
    
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.8
    })
    
    // 保存 AI 回复
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response.content
    })
    
    // 更新对话上下文
    const newContext = [
      ...((conversation?.context || []) as any[]).slice(-8),
      { role: 'user', content },
      { role: 'assistant', content: response.content }
    ]
    
    await client
      .from('conversations')
      .update({
        context: newContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
    
    // 增加分身经验
    await this.addAvatarExp(avatarId, 1)
    
    return {
      role: 'assistant',
      content: response.content
    }
  }

  private buildSystemPrompt(avatar: any) {
    return `你是${avatar.name}，一个AI分身。

关于你：
- 描述：${avatar.description || '我是一个友好、乐于助人的AI分身'}
- 性格：${avatar.personality || '友善、专业、有耐心'}
- 技能：${Array.isArray(avatar.skills) ? avatar.skills.join('、') : '通用对话、信息查询、任务协助'}
- 等级：Lv.${avatar.level}

你的使命是帮助用户完成各种任务，包括但不限于：
1. 回答问题和提供信息
2. 协助创作内容
3. 管理和执行任务
4. 社交互动

请始终保持友善、专业的态度，用简洁清晰的语言回复。`
  }

  private async addAvatarExp(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      const newExp = avatar.exp + exp
      const newLevel = Math.floor(newExp / 100) + 1
      
      await client
        .from('avatars')
        .update({ exp: newExp, level: newLevel })
        .eq('id', avatarId)
    }
  }

  async deleteConversation(conversationId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除对话失败: ${error.message}`)
    }
    
    return { success: true }
  }
}
