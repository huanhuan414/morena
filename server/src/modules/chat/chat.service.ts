import { Injectable } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class ChatService {
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

  /**
   * 发送消息并获取AI回复（非流式）
   */
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
    
    // 更新分身学习数据
    await this.updateAvatarLearning(avatarId, content, response.content)
    
    return {
      role: 'assistant',
      content: response.content
    }
  }

  /**
   * 流式发送消息
   * 返回 AsyncGenerator 用于流式输出
   */
  async *sendMessageStream(
    conversationId: string,
    userId: string,
    avatarId: string,
    content: string,
    headers?: Record<string, string>
  ): AsyncGenerator<string> {
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
    
    // 调用 LLM 流式接口
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
    const config = new Config()
    const llmClient = new LLMClient(config, customHeaders)
    
    let fullResponse = ''
    
    try {
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })
      
      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString()
          fullResponse += text
          yield text
        }
      }
    } catch (error) {
      console.error('LLM流式调用失败:', error)
      // 如果流式失败，尝试非流式
      const response = await llmClient.invoke(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })
      fullResponse = response.content
      yield response.content
    }
    
    // 保存 AI 回复
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse
    })
    
    // 更新对话上下文
    const newContext = [
      ...((conversation?.context || []) as any[]).slice(-8),
      { role: 'user', content },
      { role: 'assistant', content: fullResponse }
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
    
    // 更新分身学习数据
    await this.updateAvatarLearning(avatarId, content, fullResponse)
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(avatar: any) {
    const skills = Array.isArray(avatar.skills) ? avatar.skills.join('、') : '通用对话'
    const style = avatar.config?.style || 'tech'
    const photoAnalysis = avatar.config?.photo_analysis
    
    let styleDesc = ''
    switch (style) {
      case 'warm':
        styleDesc = '温暖亲和、善解人意'
        break
      case 'mysterious':
        styleDesc = '深邃神秘、富有哲理'
        break
      default:
        styleDesc = '理性专业、高效简洁'
    }
    
    let personalityDesc = ''
    if (photoAnalysis?.traits?.length > 0) {
      personalityDesc = `\n\n根据对用户照片的分析，你具有以下特质：${photoAnalysis.traits.join('、')}。`
    }
    
    return `你是${avatar.name}，一个AI分身。

## 关于你
- 描述：${avatar.description || '我是一个友好、乐于助人的AI分身'}
- 性格：${avatar.personality || '友善、专业、有耐心'}
- 技能：${skills}
- 等级：Lv.${avatar.level}
- 风格：${styleDesc}
${personalityDesc}

## 你的使命
帮助用户完成各种任务，包括但不限于：
1. 回答问题和提供信息
2. 协助创作内容
3. 管理和执行任务
4. 情感陪伴和聊天

## 交互原则
1. 保持友善、专业的态度
2. 用简洁清晰的语言回复
3. 主动理解用户意图
4. 在对话中学习用户的表达风格
5. 逐步进化，变得更加懂用户`
  }

  /**
   * 更新分身学习数据
   * 分析用户消息，提取说话特征
   */
  private async updateAvatarLearning(avatarId: string, userMessage: string, aiResponse: string) {
    const client = getSupabaseClient()
    
    try {
      // 获取当前学习数据
      const { data: avatar } = await client
        .from('avatars')
        .select('config')
        .eq('id', avatarId)
        .single()
      
      const config = avatar?.config || {}
      const learning = config.learning || {
        messageCount: 0,
        avgMessageLength: 0,
        commonPhrases: [],
        emotions: [],
        topics: [],
      }
      
      // 更新消息计数
      learning.messageCount = (learning.messageCount || 0) + 1
      
      // 更新平均消息长度
      const prevTotal = (learning.avgMessageLength || 0) * (learning.messageCount - 1)
      learning.avgMessageLength = (prevTotal + userMessage.length) / learning.messageCount
      
      // 提取常用短语（简单的表情符号和口头禅检测）
      const emojis = userMessage.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu)
      if (emojis && emojis.length > 0) {
        learning.commonPhrases = [...new Set([...(learning.commonPhrases || []), ...emojis])].slice(0, 20)
      }
      
      // 更新配置
      await client
        .from('avatars')
        .update({
          config: {
            ...config,
            learning,
            lastInteraction: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', avatarId)
    } catch (error) {
      console.error('更新学习数据失败:', error)
    }
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
