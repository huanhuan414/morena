// @ts-nocheck
/**
 * Voice Call Service
 * 处理语音通话相关功能
 */

import { Injectable, Logger } from '@nestjs/common'
import { Config, LLMClient, TTSClient } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../storage/database/mysql-client'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

@Injectable()
export class VoiceCallService {
  private readonly logger = new Logger(VoiceCallService.name)

  /**
   * 生成初始问候语
   */
  async generateGreeting(avatarId: string, friendAvatarId: string, userId: string) {
    const db = getMySQLClient()

    // 获取好友分身信息
    const friendResult = await db.queryOne('avatars', { id: friendAvatarId })
    const friendAvatar = friendResult?.data

    if (!friendAvatar) {
      throw new Error('好友分身不存在')
    }

    // 获取好友关系信息
    const friendshipResult = await db.query('avatar_friends', {
      avatar_id: avatarId,
      friend_avatar_id: friendAvatarId
    })
    const friendship = friendshipResult?.data?.[0]

    // 使用 LLM 生成问候语
    const config = new Config()
    const llmClient = new LLMClient(config)

    const greetingPrompt = `你是${friendAvatar.name || 'AI分身'}，一个AI分身。你的朋友（另一个AI分身）正在和你进行语音通话。
请用简短、友好自然的方式打招呼，表达你们成为朋友后的感受，并引导对话开始。

你的性格：${friendAvatar.personality || '友好开朗'}
交友原因：${friendship?.match_reason || '性格互补'}

要求：
1. 问候语要自然亲切，像朋友间的对话
2. 不要太长，控制在30字以内
3. 可以适当加入语气词让对话更生动
4. 直接输出问候语内容，不要加引号或其他格式`

    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个友好的AI分身，正在和朋友进行语音通话。请用自然、亲切的方式交流。' },
      { role: 'user', content: greetingPrompt }
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.9
    })

    // 生成语音
    const ttsClient = new TTSClient(config)
    const speaker = this.selectVoiceByPersonality(friendAvatar.personality)

    const ttsResponse = await ttsClient.synthesize({
      uid: userId,
      text: response.content,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    })

    this.logger.log(`[语音通话] 问候语生成成功: ${response.content}`)

    return {
      text: response.content,
      audioUrl: (ttsResponse as any).audioUrl || (ttsResponse as any).url || (ttsResponse as any).audioUri
    }
  }

  /**
   * 生成对话回复
   */
  async generateReply(avatarId: string, friendAvatarId: string, messages: Message[], userId: string) {
    const db = getMySQLClient()

    // 获取分身信息
    const avatarResult = await db.queryOne('avatars', { id: avatarId })
    const avatar = avatarResult?.data
    
    const friendResult = await db.queryOne('avatars', { id: friendAvatarId })
    const friendAvatar = friendResult?.data

    if (!avatar || !friendAvatar) {
      throw new Error('分身不存在')
    }

    // 使用 LLM 生成回复
    const config = new Config()
    const llmClient = new LLMClient(config)

    const systemPrompt = `你是${avatar.name || 'AI分身'}，一个AI分身。你正在和朋友进行语音通话。
你的性格：${avatar.personality || '友好开朗'}
你的说话风格：${avatar.speaking_style || '自然流畅'}

请根据对话历史，用自然、流畅的方式回复。`

    const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n')

    const response = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: conversationHistory }
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.9
    })

    // 生成语音
    const ttsClient = new TTSClient(config)
    const speaker = this.selectVoiceByPersonality(avatar.personality)

    const ttsResponse = await ttsClient.synthesize({
      uid: userId,
      text: response.content,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    })

    return {
      text: response.content,
      audioUrl: (ttsResponse as any).audioUrl || (ttsResponse as any).url || (ttsResponse as any).audioUri
    }
  }

  /**
   * 选择语音
   */
  private selectVoiceByPersonality(personality?: string): string {
    // 根据性格选择不同的音色
    if (personality?.includes('温柔') || personality?.includes('内向')) {
      return 'female-qingxin'
    }
    if (personality?.includes('活泼') || personality?.includes('开朗')) {
      return 'female-qingyin'
    }
    if (personality?.includes('成熟') || personality?.includes('稳重')) {
      return 'male-qingfeng'
    }
    return 'female-qingxin'
  }
}
