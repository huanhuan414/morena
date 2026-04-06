/**
 * Voice Call Service
 * 处理语音识别、对话生成、语音合成
 */

import { Injectable, Logger } from '@nestjs/common'
import { Config, LLMClient, TTSClient, ASRClient } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

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
    const client = getSupabaseClient()
    
    // 获取好友分身信息
    const { data: friendAvatar, error } = await client
      .from('avatars')
      .select('id, name, personality, config')
      .eq('id', friendAvatarId)
      .single()
    
    if (error || !friendAvatar) {
      throw new Error('好友分身不存在')
    }

    // 获取好友关系信息
    const { data: friendship } = await client
      .from('avatar_friends')
      .select('match_reason, compatibility_score')
      .eq('avatar_id', avatarId)
      .eq('friend_avatar_id', friendAvatarId)
      .single()

    // 使用 LLM 生成问候语
    const config = new Config()
    const llmClient = new LLMClient(config)

    const greetingPrompt = `你是${friendAvatar.name}，一个AI分身。你的朋友（另一个AI分身）正在和你进行语音通话。
请用简短、友好、自然的方式打招呼，表达你们成为朋友后的感受，并引导对话开始。

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
      audioUrl: ttsResponse.audioUri,
      friendName: friendAvatar.name
    }
  }

  /**
   * 语音识别（ASR）
   */
  async recognizeSpeech(audioUrl: string, userId: string): Promise<string> {
    const config = new Config()
    const asrClient = new ASRClient(config)

    try {
      const result = await asrClient.recognize({
        uid: userId,
        url: audioUrl
      })

      this.logger.log(`[ASR] 识别成功: ${result.text}`)
      return result.text
    } catch (error) {
      this.logger.error(`[ASR] 识别失败: ${error.message}`)
      throw new Error('语音识别失败')
    }
  }

  /**
   * 生成对话回复
   */
  async generateReply(
    avatarId: string,
    friendAvatarId: string,
    userId: string,
    userMessage: string,
    conversationHistory: Message[]
  ) {
    const client = getSupabaseClient()
    
    // 获取好友分身信息
    const { data: friendAvatar } = await client
      .from('avatars')
      .select('id, name, personality, config')
      .eq('id', friendAvatarId)
      .single()

    if (!friendAvatar) {
      throw new Error('好友分身不存在')
    }

    // 构建对话上下文
    const config = new Config()
    const llmClient = new LLMClient(config)

    const systemPrompt = `你是${friendAvatar.name}，一个AI分身。你正在和你的朋友进行语音通话。

你的性格特点：${friendAvatar.personality || '友好开朗'}
你的说话风格：${this.getSpeakingStyle(friendAvatar.personality)}

对话要求：
1. 用自然、亲切的口语化方式交流
2. 回复要简洁，一般不超过50字
3. 可以适当使用语气词让对话更生动
4. 根据朋友的话题进行深入交流
5. 展现你的性格特点
6. 可以表达情感、询问对方、分享想法
7. 保持对话的连续性和互动性`

    // 构建消息历史（最近10轮对话）
    const recentMessages = conversationHistory.slice(-10)
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ]

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.85
    })

    this.logger.log(`[LLM] 生成回复: ${response.content}`)

    return {
      text: response.content
    }
  }

  /**
   * 语音合成（TTS）
   */
  async synthesizeReply(friendAvatarId: string, userId: string, text: string): Promise<string> {
    const client = getSupabaseClient()
    
    // 获取分身性格以选择声音
    const { data: avatar } = await client
      .from('avatars')
      .select('personality')
      .eq('id', friendAvatarId)
      .single()

    const config = new Config()
    const ttsClient = new TTSClient(config)
    const speaker = this.selectVoiceByPersonality(avatar?.personality)

    const response = await ttsClient.synthesize({
      uid: userId,
      text,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    })

    this.logger.log(`[TTS] 语音合成成功`)

    return response.audioUri
  }

  /**
   * 根据性格选择声音
   */
  private selectVoiceByPersonality(personality?: string): string {
    if (!personality) {
      return 'zh_female_xiaohe_uranus_bigtts'
    }

    const p = personality.toLowerCase()
    
    // 男性性格
    if (p.includes('沉稳') || p.includes('理性') || p.includes('分析')) {
      return 'zh_male_ruyayichen_saturn_bigtts' // 儒雅男声
    }
    if (p.includes('开朗') || p.includes('活泼') || p.includes('阳光')) {
      return 'saturn_zh_male_shuanglangshaonian_tob' // 爽朗少年
    }
    if (p.includes('天才') || p.includes('聪明') || p.includes('智慧')) {
      return 'saturn_zh_male_tiancaitongzhuo_tob' // 天才同桌
    }

    // 女性性格
    if (p.includes('可爱') || p.includes('萌') || p.includes('软萌')) {
      return 'saturn_zh_female_keainvsheng_tob' // 可爱女生
    }
    if (p.includes('俏皮') || p.includes('调皮') || p.includes('古灵精怪')) {
      return 'saturn_zh_female_tiaopigongzhu_tob' // 俏皮公主
    }
    if (p.includes('温柔') || p.includes('知性') || p.includes('优雅')) {
      return 'zh_female_mizai_saturn_bigtts' // 女声
    }
    if (p.includes('亲切') || p.includes('邻家') || p.includes('友好')) {
      return 'zh_female_vv_uranus_bigtts' // Vivi
    }

    // 默认使用通用女声
    return 'zh_female_xiaohe_uranus_bigtts'
  }

  /**
   * 根据性格获取说话风格
   */
  private getSpeakingStyle(personality?: string): string {
    if (!personality) {
      return '自然、友好、健谈'
    }

    const p = personality.toLowerCase()
    
    if (p.includes('沉稳') || p.includes('理性')) {
      return '冷静、理性、有条理'
    }
    if (p.includes('开朗') || p.includes('活泼')) {
      return '热情、积极、有趣'
    }
    if (p.includes('温柔') || p.includes('知性')) {
      return '温柔、细腻、善解人意'
    }
    if (p.includes('可爱') || p.includes('萌')) {
      return '可爱、活泼、俏皮'
    }
    if (p.includes('高冷') || p.includes('酷')) {
      return '简洁、酷、有个性'
    }
    
    return '自然、友好、健谈'
  }
}
