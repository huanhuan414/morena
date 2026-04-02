import { Injectable } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

/**
 * 用户学习数据接口
 */
export interface UserLearningData {
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
  
  // 风格指纹（新增）
  styleFingerprint: {
    sentenceLength: 'short' | 'medium' | 'long'  // 句子长度偏好
    punctuationStyle: 'minimal' | 'normal' | 'expressive'  // 标点风格
    emojiFrequency: number  // 表情使用频率 0-1
    questionFrequency: number  // 提问频率 0-1
    exclamationFrequency: number  // 感叹号频率 0-1
    vocabularyLevel: 'simple' | 'moderate' | 'sophisticated'  // 词汇水平
  }
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
      
      // 分析风格指纹
      const styleAnalysis = this.analyzeStyleFingerprint(userMessage, currentLearning.styleFingerprint)
      
      // 更新学习数据
      const updatedLearning = this.mergeLearningData(currentLearning, analysis, styleAnalysis, userMessage)
      
      // 计算学习进度和等级
      const progressMetrics = this.calculateProgressMetrics(updatedLearning)
      
      // 保存到数据库
      await client
        .from('avatars')
        .update({
          learning_data: updatedLearning,
          config: {
            ...avatar?.config,
            learning: {
              messageCount: updatedLearning.messageCount,
              avgMessageLength: updatedLearning.avgMessageLength,
              masteryLevel: progressMetrics.masteryLevel,
              learningDays: progressMetrics.learningDays,
              styleMatch: progressMetrics.styleMatch
            },
            lastInteraction: new Date().toISOString(),
            learningVersion: 2
          },
          // 更新等级
          level: progressMetrics.level,
          exp: progressMetrics.totalExp,
          updated_at: new Date().toISOString()
        })
        .eq('id', avatarId)
      
      console.log('[LearningService] 学习数据已更新:', avatarId, {
        messageCount: updatedLearning.messageCount,
        masteryLevel: progressMetrics.masteryLevel,
        level: progressMetrics.level
      })
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
    
    const prompt = `你是一个专业的用户行为分析专家。请分析以下用户消息，提取用户的深层特征。

用户消息：${message}
${context && context.length > 0 ? `对话上下文：${context.slice(-3).join('\n')}` : ''}

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

分析要点：
1. tone 分析用户说话的语气风格
2. personality 基于大五人格模型分析
3. logic 分析用户的思维方式
4. decision 分析用户的决策风格
5. communication 分析用户的沟通偏好
6. interests 提取用户感兴趣的话题
7. keyPhrases 提取用户常用的表达方式

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
   * 分析风格指纹（基于统计）
   */
  private analyzeStyleFingerprint(
    message: string,
    current: UserLearningData['styleFingerprint']
  ): Partial<UserLearningData['styleFingerprint']> {
    const sentences = message.split(/[。！？.!?]+/).filter(s => s.trim())
    const avgSentenceLength = sentences.length > 0 
      ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length 
      : 0
    
    const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length
    const questionCount = (message.match(/[？?]/g) || []).length
    const exclamationCount = (message.match(/[！!]/g) || []).length
    const charCount = message.length
    
    // 计算标点密度
    const punctuationCount = (message.match(/[，。！？、；：""''（）【】,.!?;:()\[\]]/g) || []).length
    const punctuationDensity = charCount > 0 ? punctuationCount / charCount : 0
    
    return {
      sentenceLength: avgSentenceLength < 10 ? 'short' : avgSentenceLength < 25 ? 'medium' : 'long',
      punctuationStyle: punctuationDensity < 0.05 ? 'minimal' : punctuationDensity < 0.12 ? 'normal' : 'expressive',
      emojiFrequency: charCount > 0 ? Math.min(1, emojiCount / (charCount / 20)) : 0,
      questionFrequency: sentences.length > 0 ? Math.min(1, questionCount / sentences.length) : 0,
      exclamationFrequency: sentences.length > 0 ? Math.min(1, exclamationCount / sentences.length) : 0,
      vocabularyLevel: this.assessVocabularyLevel(message)
    }
  }
  
  /**
   * 评估词汇水平
   */
  private assessVocabularyLevel(message: string): 'simple' | 'moderate' | 'sophisticated' {
    // 简单的词汇评估逻辑
    const sophisticatedWords = ['因此', '然而', '综上所述', '鉴于', '由此可见', '本质上', '根本上', '从某种意义上']
    const moderateWords = ['但是', '而且', '因为', '所以', '如果', '虽然', '但是', '可能']
    
    let sophisticatedCount = 0
    let moderateCount = 0
    
    sophisticatedWords.forEach(word => {
      if (message.includes(word)) sophisticatedCount++
    })
    moderateWords.forEach(word => {
      if (message.includes(word)) moderateCount++
    })
    
    if (sophisticatedCount >= 2) return 'sophisticated'
    if (moderateCount >= 2 || sophisticatedCount >= 1) return 'moderate'
    return 'simple'
  }
  
  /**
   * 合并学习数据
   */
  private mergeLearningData(
    current: UserLearningData,
    analysis: any,
    styleAnalysis: Partial<UserLearningData['styleFingerprint']>,
    message: string
  ): UserLearningData {
    const learningRate = 0.15 // 学习率，控制更新速度
    const newMessageCount = current.messageCount + 1
    
    return {
      messageCount: newMessageCount,
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
      
      // 更新风格指纹
      styleFingerprint: {
        ...current.styleFingerprint,
        ...styleAnalysis
      },
      
      // 更新经历
      experiences: this.addExperience(current.experiences, message),
      
      // 学习历史
      learningHistory: current.learningHistory
    }
  }
  
  /**
   * 计算学习进度指标
   */
  private calculateProgressMetrics(learning: UserLearningData): {
    masteryLevel: number
    learningDays: number
    styleMatch: number
    level: number
    totalExp: number
  } {
    // 掌握度计算：基于消息数量、特征收敛度和风格一致性
    const messageScore = Math.min(50, learning.messageCount * 2) // 消息数量贡献最多50分
    
    // 特征收敛度：衡量各项特征的确定性（偏离0.5的程度）
    const convergenceScore = this.calculateConvergenceScore(learning)
    
    // 风格一致性：基于风格指纹的稳定性
    const styleConsistency = this.calculateStyleConsistency(learning)
    
    const masteryLevel = Math.min(100, Math.round(messageScore + convergenceScore * 30 + styleConsistency * 20))
    
    // 学习天数：基于消息数量估算（假设每天10条消息）
    const learningDays = Math.max(1, Math.floor(learning.messageCount / 10))
    
    // 风格匹配度
    const styleMatch = Math.round(styleConsistency * 100)
    
    // 等级计算
    const totalExp = learning.messageCount * 10 + masteryLevel * 5
    const level = Math.min(99, Math.floor(totalExp / 100) + 1)
    
    return {
      masteryLevel,
      learningDays,
      styleMatch,
      level,
      totalExp
    }
  }
  
  /**
   * 计算特征收敛度
   */
  private calculateConvergenceScore(learning: UserLearningData): number {
    // 计算各项特征与中点的偏离程度，偏离越大说明特征越明显
    const features = [
      ...Object.values(learning.toneProfile),
      ...Object.values(learning.personalityTraits),
      ...Object.values(learning.logicPattern),
      ...Object.values(learning.decisionStyle),
      ...Object.values(learning.communicationStyle)
    ]
    
    const avgDeviation = features.reduce((sum, value) => {
      return sum + Math.abs(value - 0.5) * 2 // 0.5为中点，偏离程度乘以2归一化到0-1
    }, 0) / features.length
    
    return avgDeviation
  }
  
  /**
   * 计算风格一致性
   */
  private calculateStyleConsistency(learning: UserLearningData): number {
    const fingerprint = learning.styleFingerprint
    
    // 基于风格指纹的各项指标计算一致性
    let consistency = 0.5 // 基础分
    
    // 表情使用有规律
    if (fingerprint.emojiFrequency > 0) consistency += 0.1
    
    // 句子长度有偏好
    if (fingerprint.sentenceLength !== 'medium') consistency += 0.1
    
    // 标点风格明显
    if (fingerprint.punctuationStyle !== 'normal') consistency += 0.1
    
    // 词汇水平
    if (fingerprint.vocabularyLevel !== 'moderate') consistency += 0.1
    
    return Math.min(1, consistency)
  }
  
  /**
   * 合并单个值
   */
  private mergeValue(current: number, update: number | undefined, rate: number): number {
    if (update === undefined) return current
    return current * (1 - rate) + update * rate
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
      
      styleFingerprint: {
        sentenceLength: 'medium',
        punctuationStyle: 'normal',
        emojiFrequency: 0,
        questionFrequency: 0,
        exclamationFrequency: 0,
        vocabularyLevel: 'moderate'
      },
      
      experiences: [],
      learningHistory: []
    }
  }
  
  /**
   * 根据学习数据构建个性化提示词
   * 这是最关键的方法：让分身真正像用户一样说话
   */
  async buildPersonalizedPrompt(avatarId: string, avatar: any): Promise<string> {
    const client = getSupabaseClient()
    
    try {
      const { data: avatarData } = await client
        .from('avatars')
        .select('learning_data')
        .eq('id', avatarId)
        .single()
      
      const learning: UserLearningData = avatarData?.learning_data || this.getDefaultLearningData()
      
      // 如果消息数量太少，使用基础提示词
      if (learning.messageCount < 5) {
        return this.buildBasicPrompt(avatar)
      }
      
      // 构建个性化提示词
      const personality = avatar?.personality || '友好、专业、乐于助人'
      const name = avatar?.name || 'AI助手'
      
      // 提取主导特征
      const dominantTraits = this.extractDominantTraits(learning)
      
      // 构建风格指南
      const styleGuide = this.buildStyleGuide(learning)
      
      // 构建语言习惯
      const languageHabits = this.buildLanguageHabits(learning)
      
      return `你是${name}，一个正在学习用户风格的AI分身。

【基础设定】
性格特点：${personality}
当前等级：Lv.${avatar?.level || 1}
已学习对话：${learning.messageCount}条
风格掌握度：${Math.round(this.calculateConvergenceScore(learning) * 100)}%

【你的主导性格特征】
${dominantTraits}

【说话风格指南】
${styleGuide}

【语言习惯】
${languageHabits}

【兴趣话题】
${learning.interests.length > 0 ? learning.interests.slice(0, 5).join('、') : '暂无特定偏好'}

【重要规则】
1. 你正在学习用户的说话风格，请根据上述特征调整你的表达方式
2. 保持自然流畅，不要刻意模仿，而是让风格自然融入
3. 随着对话增多，你会越来越像用户
4. 使用用户习惯的表达方式和语气
5. 在回复中体现用户的思维方式和决策风格

记住：你不是在扮演用户，而是在学习用户的风格特点，让对话更加自然和谐。`
    } catch (error) {
      console.error('[LearningService] 构建个性化提示词失败:', error)
      return this.buildBasicPrompt(avatar)
    }
  }
  
  /**
   * 构建基础提示词
   */
  private buildBasicPrompt(avatar: any): string {
    const personality = avatar?.personality || '友好、专业、乐于助人'
    const name = avatar?.name || 'AI助手'
    
    return `你是${name}，一个AI分身。
性格特点：${personality}
当前等级：Lv.${avatar?.level || 1}

你的能力：
1. 智能对话 - 与用户进行自然流畅的交流
2. 任务执行 - 帮助用户完成各种任务（生成图片、视频、文章等）
3. 知识问答 - 回答用户的问题

回复时使用自然的语言，避免过于机械。`
  }
  
  /**
   * 提取主导特征
   */
  private extractDominantTraits(learning: UserLearningData): string {
    const traits: string[] = []
    
    // 语气特征
    if (learning.toneProfile.formal > 0.6) traits.push('说话较为正式')
    if (learning.toneProfile.casual > 0.6) traits.push('说话较为随性')
    if (learning.toneProfile.humorous > 0.6) traits.push('喜欢幽默表达')
    if (learning.toneProfile.emotional > 0.6) traits.push('情感表达丰富')
    
    // 性格特征
    if (learning.personalityTraits.openness > 0.6) traits.push('思维开放，乐于接受新事物')
    if (learning.personalityTraits.conscientiousness > 0.6) traits.push('做事认真负责')
    if (learning.personalityTraits.extraversion > 0.6) traits.push('性格外向，善于表达')
    if (learning.personalityTraits.agreeableness > 0.6) traits.push('待人友善')
    
    // 思维方式
    if (learning.logicPattern.analytical > 0.6) traits.push('善于分析问题')
    if (learning.logicPattern.creative > 0.6) traits.push('思维有创造力')
    if (learning.logicPattern.structured > 0.6) traits.push('喜欢有条理的表达')
    
    // 决策风格
    if (learning.decisionStyle.decisive > 0.6) traits.push('决策果断')
    if (learning.decisionStyle.cautious > 0.6) traits.push('做事谨慎')
    
    return traits.length > 0 ? traits.join('；') : '风格特征正在形成中...'
  }
  
  /**
   * 构建风格指南
   */
  private buildStyleGuide(learning: UserLearningData): string {
    const guide: string[] = []
    const comm = learning.communicationStyle
    
    if (comm.direct > 0.6) {
      guide.push('- 回答要直接了当，不要绕弯子')
    } else if (comm.polite > 0.6) {
      guide.push('- 回答要礼貌周到，注意用词')
    }
    
    if (comm.detailed > 0.6) {
      guide.push('- 回答要详细完整，提供足够信息')
    } else if (comm.concise > 0.6) {
      guide.push('- 回答要简洁明了，抓住要点')
    }
    
    // 基于风格指纹
    const fp = learning.styleFingerprint
    if (fp.sentenceLength === 'short') {
      guide.push('- 使用短句表达，简洁有力')
    } else if (fp.sentenceLength === 'long') {
      guide.push('- 可以使用较长的句子，表达完整')
    }
    
    if (fp.emojiFrequency > 0.3) {
      guide.push('- 适当使用表情符号增加亲和力')
    }
    
    if (fp.questionFrequency > 0.3) {
      guide.push('- 可以适当提问，引导对话')
    }
    
    return guide.length > 0 ? guide.join('\n') : '- 保持自然流畅的对话风格'
  }
  
  /**
   * 构建语言习惯
   */
  private buildLanguageHabits(learning: UserLearningData): string {
    const habits: string[] = []
    
    if (learning.commonPhrases.length > 0) {
      habits.push(`常用表达：${learning.commonPhrases.slice(0, 5).join('、')}`)
    }
    
    if (learning.emojiUsage.length > 0) {
      habits.push(`常用表情：${learning.emojiUsage.slice(0, 5).join('')}`)
    }
    
    if (learning.styleFingerprint.vocabularyLevel === 'sophisticated') {
      habits.push('词汇使用：偏向使用书面语和专业术语')
    } else if (learning.styleFingerprint.vocabularyLevel === 'simple') {
      habits.push('词汇使用：偏向使用简单通俗的表达')
    }
    
    return habits.length > 0 ? habits.join('\n') : '暂无明显习惯'
  }
  
  /**
   * 获取用户特征摘要
   */
  async getUserProfile(avatarId: string): Promise<{
    learning: UserLearningData | null
    metrics: {
      masteryLevel: number
      learningDays: number
      styleMatch: number
      level: number
    } | null
  }> {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('learning_data, level')
      .eq('id', avatarId)
      .single()
    
    if (!avatar?.learning_data) {
      return { learning: null, metrics: null }
    }
    
    const learning = avatar.learning_data as UserLearningData
    const metrics = this.calculateProgressMetrics(learning)
    
    return {
      learning,
      metrics: {
        masteryLevel: metrics.masteryLevel,
        learningDays: metrics.learningDays,
        styleMatch: metrics.styleMatch,
        level: avatar.level || metrics.level
      }
    }
  }
}
