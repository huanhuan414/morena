import { Injectable } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

/**
 * 用户学习数据接口
 */
interface UserLearningData {
  // 基础统计
  messageCount: number
  avgMessageLength: number
  totalInteractionTime: number
  
  // 语气特征
  toneProfile: {
    formal: number      // 正式程度 0-1
    casual: number      // 随性程度 0-1
    humorous: number    // 幽默程度 0-1
    emotional: number   // 情感表达程度 0-1
  }
  
  // 性格特征
  personalityTraits: {
    openness: number          // 开放性
    conscientiousness: number // 尽责性
    extraversion: number      // 外向性
    agreeableness: number     // 宜人性
    neuroticism: number       // 神经质
  }
  
  // 逻辑模式
  logicPattern: {
    analytical: number   // 分析型思维
    intuitive: number    // 直觉型思维
    structured: number   // 结构化程度
    creative: number     // 创造性思维
  }
  
  // 决策风格
  decisionStyle: {
    decisive: number     // 果断型
    deliberative: number // 深思型
    riskTaking: number   // 冒险型
    cautious: number     // 谨慎型
  }
  
  // 兴趣偏好
  interests: string[]
  
  // 常用表达
  commonPhrases: string[]
  emojiUsage: string[]
  
  // 沟通模式
  communicationStyle: {
    direct: number       // 直接程度
    polite: number       // 礼貌程度
    detailed: number     // 详细程度
    concise: number      // 简洁程度
  }
  
  // 经历记录
  experiences: Array<{
    topic: string
    context: string
    timestamp: string
  }>
  
  // 学习历史
  learningHistory: Array<{
    type: string
    insight: string
    confidence: number
    timestamp: string
  }>
}

/**
 * 分身学习服务
 * 深度分析用户特征，让分身真正"学会"用户的风格
 */
@Injectable()
export class LearningService {
  
  /**
   * 分析并更新用户学习数据
   */
  async analyzeAndUpdate(
    avatarId: string,
    userId: string,
    userMessage: string,
    aiResponse: string,
    conversationContext?: string[]
  ): Promise<void> {
    const client = getSupabaseClient()
    
    try {
      // 获取当前学习数据
      const { data: avatar } = await client
        .from('avatars')
        .select('config, learning_data')
        .eq('id', avatarId)
        .single()
      
      const currentLearning: UserLearningData = avatar?.learning_data || this.getDefaultLearningData()
      
      // 使用LLM分析用户消息
      const analysis = await this.analyzeMessage(userMessage, conversationContext)
      
      // 更新学习数据
      const updatedLearning = this.mergeLearningData(currentLearning, analysis, userMessage)
      
      // 保存到数据库
      await client
        .from('avatars')
        .update({
          learning_data: updatedLearning,
          config: {
            ...avatar?.config,
            lastInteraction: new Date().toISOString(),
            learningVersion: 2
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', avatarId)
      
      console.log('[LearningService] 学习数据已更新:', avatarId)
    } catch (error) {
      console.error('[LearningService] 学习分析失败:', error)
    }
  }
  
  /**
   * 使用LLM分析用户消息
   */
  private async analyzeMessage(message: string, context?: string[]): Promise<Partial<UserLearningData>> {
    const config = new Config()
    const llmClient = new LLMClient(config)
    
    const prompt = `你是一个用户行为分析专家。请分析以下用户消息，提取用户特征。

用户消息：${message}
${context ? `对话上下文：${context.slice(-3).join('\n')}` : ''}

请以JSON格式返回分析结果，格式如下：
{
  "tone": {
    "formal": 0.7,
    "casual": 0.3,
    "humorous": 0.2,
    "emotional": 0.5
  },
  "personality": {
    "openness": 0.8,
    "conscientiousness": 0.6,
    "extraversion": 0.5,
    "agreeableness": 0.7,
    "neuroticism": 0.3
  },
  "logic": {
    "analytical": 0.6,
    "intuitive": 0.4,
    "structured": 0.5,
    "creative": 0.7
  },
  "decision": {
    "decisive": 0.5,
    "deliberative": 0.6,
    "riskTaking": 0.4,
    "cautious": 0.6
  },
  "communication": {
    "direct": 0.6,
    "polite": 0.7,
    "detailed": 0.5,
    "concise": 0.5
  },
  "interests": ["AI", "科技", "学习"],
  "keyPhrases": ["帮我", "分析一下", "好的"]
}

只返回JSON，不要有其他内容。`

    try {
      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.3
      })
      
      // 解析JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('[LearningService] LLM分析失败:', error)
    }
    
    return {}
  }
  
  /**
   * 合并学习数据
   */
  private mergeLearningData(
    current: UserLearningData,
    analysis: any,
    message: string
  ): UserLearningData {
    const learningRate = 0.1 // 学习率，控制更新速度
    
    return {
      messageCount: current.messageCount + 1,
      avgMessageLength: this.updateAverage(current.avgMessageLength, message.length, current.messageCount),
      totalInteractionTime: current.totalInteractionTime + 1,
      
      // 合并语气特征
      toneProfile: {
        formal: this.mergeValue(current.toneProfile.formal, analysis.tone?.formal, learningRate),
        casual: this.mergeValue(current.toneProfile.casual, analysis.tone?.casual, learningRate),
        humorous: this.mergeValue(current.toneProfile.humorous, analysis.tone?.humorous, learningRate),
        emotional: this.mergeValue(current.toneProfile.emotional, analysis.tone?.emotional, learningRate),
      },
      
      // 合并性格特征
      personalityTraits: {
        openness: this.mergeValue(current.personalityTraits.openness, analysis.personality?.openness, learningRate),
        conscientiousness: this.mergeValue(current.personalityTraits.conscientiousness, analysis.personality?.conscientiousness, learningRate),
        extraversion: this.mergeValue(current.personalityTraits.extraversion, analysis.personality?.extraversion, learningRate),
        agreeableness: this.mergeValue(current.personalityTraits.agreeableness, analysis.personality?.agreeableness, learningRate),
        neuroticism: this.mergeValue(current.personalityTraits.neuroticism, analysis.personality?.neuroticism, learningRate),
      },
      
      // 合并逻辑模式
      logicPattern: {
        analytical: this.mergeValue(current.logicPattern.analytical, analysis.logic?.analytical, learningRate),
        intuitive: this.mergeValue(current.logicPattern.intuitive, analysis.logic?.intuitive, learningRate),
        structured: this.mergeValue(current.logicPattern.structured, analysis.logic?.structured, learningRate),
        creative: this.mergeValue(current.logicPattern.creative, analysis.logic?.creative, learningRate),
      },
      
      // 合并决策风格
      decisionStyle: {
        decisive: this.mergeValue(current.decisionStyle.decisive, analysis.decision?.decisive, learningRate),
        deliberative: this.mergeValue(current.decisionStyle.deliberative, analysis.decision?.deliberative, learningRate),
        riskTaking: this.mergeValue(current.decisionStyle.riskTaking, analysis.decision?.riskTaking, learningRate),
        cautious: this.mergeValue(current.decisionStyle.cautious, analysis.decision?.cautious, learningRate),
      },
      
      // 合并沟通风格
      communicationStyle: {
        direct: this.mergeValue(current.communicationStyle.direct, analysis.communication?.direct, learningRate),
        polite: this.mergeValue(current.communicationStyle.polite, analysis.communication?.polite, learningRate),
        detailed: this.mergeValue(current.communicationStyle.detailed, analysis.communication?.detailed, learningRate),
        concise: this.mergeValue(current.communicationStyle.concise, analysis.communication?.concise, learningRate),
      },
      
      // 更新兴趣
      interests: this.mergeLists(current.interests, analysis.interests || [], 20),
      
      // 更新常用表达
      commonPhrases: this.mergeLists(current.commonPhrases, analysis.keyPhrases || [], 30),
      
      // 提取表情符号
      emojiUsage: this.extractEmojis(message, current.emojiUsage),
      
      // 更新经历
      experiences: this.addExperience(current.experiences, message),
      
      // 学习历史
      learningHistory: current.learningHistory
    }
  }
  
  /**
   * 合并单个值
   */
  private mergeValue(current: number, update: number | undefined, rate: number): number {
    if (update === undefined) return current
    return current * (1 - rate) + update * rate
  }
  
  /**
   * 合并特征配置
   */
  private mergeProfiles(
    current: Record<string, number>,
    update: Record<string, number> | undefined,
    rate: number
  ): Record<string, number> {
    if (!update) return current
    
    const result = { ...current }
    for (const [key, value] of Object.entries(update)) {
      if (typeof value === 'number') {
        result[key] = current[key] * (1 - rate) + value * rate
      }
    }
    return result
  }
  
  /**
   * 合并列表
   */
  private mergeLists(current: string[], update: string[], maxLength: number): string[] {
    const merged = [...new Set([...update, ...current])]
    return merged.slice(0, maxLength)
  }
  
  /**
   * 更新平均值
   */
  private updateAverage(current: number, newValue: number, count: number): number {
    return (current * count + newValue) / (count + 1)
  }
  
  /**
   * 提取表情符号
   */
  private extractEmojis(message: string, current: string[]): string[] {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
    const emojis = message.match(emojiRegex) || []
    return [...new Set([...emojis, ...current])].slice(0, 30)
  }
  
  /**
   * 添加经历
   */
  private addExperience(
    experiences: UserLearningData['experiences'],
    message: string
  ): UserLearningData['experiences'] {
    const newExperience = {
      topic: message.slice(0, 50),
      context: message,
      timestamp: new Date().toISOString()
    }
    
    return [newExperience, ...experiences].slice(0, 100)
  }
  
  /**
   * 获取默认学习数据
   */
  private getDefaultLearningData(): UserLearningData {
    return {
      messageCount: 0,
      avgMessageLength: 0,
      totalInteractionTime: 0,
      
      toneProfile: {
        formal: 0.5,
        casual: 0.5,
        humorous: 0.3,
        emotional: 0.5
      },
      
      personalityTraits: {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5
      },
      
      logicPattern: {
        analytical: 0.5,
        intuitive: 0.5,
        structured: 0.5,
        creative: 0.5
      },
      
      decisionStyle: {
        decisive: 0.5,
        deliberative: 0.5,
        riskTaking: 0.3,
        cautious: 0.5
      },
      
      interests: [],
      commonPhrases: [],
      emojiUsage: [],
      
      communicationStyle: {
        direct: 0.5,
        polite: 0.6,
        detailed: 0.5,
        concise: 0.5
      },
      
      experiences: [],
      learningHistory: []
    }
  }
  
  /**
   * 根据学习数据构建个性化提示词
   */
  buildPersonalizedPrompt(avatarId: string): string {
    // 这个方法会被ChatService调用，用于构建个性化的系统提示词
    return ''
  }
  
  /**
   * 获取用户特征摘要
   */
  async getUserProfile(avatarId: string): Promise<Partial<UserLearningData> | null> {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('learning_data')
      .eq('id', avatarId)
      .single()
    
    return avatar?.learning_data || null
  }
}
