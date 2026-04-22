import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { NotificationService } from '../notification/notification.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { SmsService } from '../sms/sms.service'
import { ContentGenerationService } from '../content-generation/content-generation.service'
import { OrderProcessingService } from '../order-processing/order-processing.service'
import { LLMClient, Config } from 'coze-coding-dev-sdk'

export interface OrderAnalysis {
  // 订单核心需求
  coreRequirement: string        // 核心需求描述
  targetAudience: string[]       // 目标受众群体
  requiredSkills: string[]       // 必需技能
  preferredPlatforms: string[]   // 偏好平台
  toneStyle: string[]            // 语气风格
  contentType: string[]          // 内容类型
  urgencyLevel: 'high' | 'medium' | 'low'  // 紧急程度
  complexityLevel: number         // 复杂度 1-10
  estimatedBudget: string         // 预估预算等级
  keywords: string[]             // 关键词提取
  // 语义分析结果
  semanticTags: string[]          // 语义标签
  category: string               // 订单类别
  specialRequirements: string[]  // 特殊要求
  // 预期效果目标（新增）
  expectedResults: {
    reachTarget?: number          // 曝光目标（如 100000 = 10万）
    engagementTarget?: number     // 互动目标（如 1000 = 点赞1000）
    qualityTarget?: string        // 质量目标（卓越/优秀/良好/合格）
    customTargets?: string[]      // 自定义目标（如 "转化率5%"）
  }
}

export interface AvatarProfile {
  // 基础信息
  id: string
  name: string
  avatar_url: string
  user_id: string
  // 画像信息
  personality: string             // 性格描述
  skills: string[]               // 技能列表
  speakingStyle: string[]         // 说话风格
  expertise: string[]            // 专业领域
  targetAudience: string[]       // 目标受众
  // 能力指标
  level: number
  completionRate: number
  completedOrders: number
  totalOrders: number
  avgRating: number
  totalEarnings: number
  is_hosted: boolean
  // 平台配置
  platforms: string[]
  // 活跃度
  lastActiveAt: string
  hostedTasksCount: number       // 托管任务数
}

export interface AvatarScore {
  id: string
  name: string
  avatar_url: string
  score: number
  completionRate: number
  level: number
  totalOrders: number
  completedOrders: number
  skillMatchScore: number
  platformMatchScore: number
  reason: string[]
  is_hosted: boolean
  // 深度分析结果
  avatarProfile?: AvatarProfile
  orderAnalysis?: OrderAnalysis
  semanticSimilarity?: number
  personalityFit?: number
  experienceMatch?: number
  estimatedEffect?: {
    reach: string
    engagement: string
    quality: string
    time: string
  }
}

export interface DispatchResult {
  orderId: string
  avatarId: string
  avatarName: string
  score: number
  reason: string[]
}

// 平台名称映射：中文名称 -> 平台代码
const PLATFORM_NAME_MAP: Record<string, string> = {
  '公众号': 'wechat_mp',
  '微信公号': 'wechat_mp',
  '微信公众平台': 'wechat_mp',
  '朋友圈': 'wechat_moments',
  '微信朋友圈': 'wechat_moments',
  '抖音': 'douyin',
  '抖音号': 'douyin',
  '抖音平台': 'douyin',
  '视频号': 'wechat_video',
  '微信视频号': 'wechat_video',
  '小红书': 'xiaohongshu',
  '小红书平台': 'xiaohongshu',
  'B站': 'bilibili',
  '哔哩哔哩': 'bilibili',
  '微博': 'weibo',
  '新浪微博': 'weibo'
}

@Injectable()
export class OrderDispatchService {
  private llmClient: LLMClient

  constructor(
    private readonly notificationService: NotificationService,
    private readonly subscriptionService: SubscriptionService,
    private readonly smsService: SmsService,
    private readonly contentGenerationService: ContentGenerationService,
    private readonly orderProcessingService: OrderProcessingService
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  /**
   * 规范化平台名称：将中文名称转换为平台代码
   */
  private normalizePlatformName(platformName: string): string {
    // 如果已经是平台代码，直接返回
    const knownCodes = ['wechat_mp', 'wechat_moments', 'douyin', 'wechat_video', 'xiaohongshu', 'bilibili', 'weibo']
    if (knownCodes.includes(platformName)) {
      return platformName
    }
    // 使用映射表转换中文名称
    return PLATFORM_NAME_MAP[platformName] || platformName
  }

  /**
   * 深度理解订单需求
   * 使用 LLM 进行语义分析和需求提取
   */
  async analyzeOrderRequirements(order: any): Promise<OrderAnalysis> {
    const requirements = order.requirements || {}
    const title = order.title || ''
    const description = order.description || ''

    // 构建分析提示词
    const analysisPrompt = `你是一个专业的订单需求分析师。请深度分析以下订单信息，提取关键需求：

订单标题：${title}
订单描述：${description}
指定平台：${requirements.platforms?.join(', ') || '不限'}
指定技能：${requirements.required_skills?.join(', ') || '无'}
目标受众：${requirements.target_audience || '未指定'}
预算：${order.budget || '未指定'}

请从以下维度进行深度分析：
1. 核心需求是什么？（一句话概括）
2. 目标受众是哪些群体？
3. 需要哪些核心技能？
4. 偏好什么平台？
5. 需要什么语气风格？
6. 内容类型是什么？
7. 紧急程度如何？
8. 复杂度评分（1-10）？
9. 预估预算等级？
10. 提取10个关键词
11. 生成语义标签
12. 判断订单类别
13. 有哪些特殊要求？

请以JSON格式返回，格式如下：
{
  "coreRequirement": "核心需求描述",
  "targetAudience": ["群体1", "群体2"],
  "requiredSkills": ["技能1", "技能2"],
  "preferredPlatforms": ["平台1", "平台2"],
  "toneStyle": ["风格1", "风格2"],
  "contentType": ["类型1", "类型2"],
  "urgencyLevel": "high/medium/low",
  "complexityLevel": 5,
  "estimatedBudget": "低/中/高",
  "keywords": ["关键词1", "关键词2"],
  "semanticTags": ["标签1", "标签2"],
  "category": "类别",
  "specialRequirements": ["要求1", "要求2"]
}`

    try {
      // 添加超时保护
      const responsePromise = this.llmClient.invoke([
        { role: 'user', content: analysisPrompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.3
      })

      // 设置30秒超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LLM调用超时')), 30000)
      })

      const response = await Promise.race([responsePromise, timeoutPromise]) as any

      // 解析 LLM 返回的 JSON
      const content = response.content.trim()
      let analysis: Partial<OrderAnalysis> = {}

      try {
        // 尝试提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        console.log('[订单分析] JSON解析失败，使用基础分析')
      }

      // 如果解析失败，使用基础分析
      const expectedResultsText = requirements?.expectedResults || ''
      return {
        coreRequirement: analysis.coreRequirement || `完成${title}`,
        targetAudience: analysis.targetAudience || this.extractKeywords(description, 3),
        requiredSkills: analysis.requiredSkills || requirements?.required_skills || [],
        // 优先使用订单的 platforms 字段（原始平台代码），而不是 LLM 返回的中文名称
        preferredPlatforms: order.platforms || requirements?.platforms || analysis.preferredPlatforms || [],
        toneStyle: analysis.toneStyle || [],
        contentType: analysis.contentType || [],
        urgencyLevel: analysis.urgencyLevel || 'medium',
        complexityLevel: analysis.complexityLevel || 5,
        estimatedBudget: analysis.estimatedBudget || 'medium',
        keywords: analysis.keywords || this.extractKeywords(title + ' ' + description, 10),
        semanticTags: analysis.semanticTags || [],
        category: analysis.category || 'general',
        specialRequirements: analysis.specialRequirements || [],
        expectedResults: this.parseExpectedResults(expectedResultsText)
      }
    } catch (error) {
      console.error('[订单分析] LLM分析失败:', error)
      // LLM 失败时使用规则基础分析
      return this.basicOrderAnalysis(order)
    }
  }

  /**
   * 基础订单分析（LLM不可用时的备选方案）
   */
  private basicOrderAnalysis(order: any): OrderAnalysis {
    const requirements = order.requirements || {}
    const title = order.title || ''
    const description = order.description || ''
    const fullText = (title + ' ' + description).toLowerCase()
    
    // 关键词提取
    const skillKeywords = ['写作', '文案', '设计', '视频', '剪辑', '拍摄', '摄影', '推广', '营销', '运营', '客服', '咨询', '翻译', '编程', '开发']
    const platformKeywords = ['小红书', '抖音', 'B站', '微博', '微信', '知乎', '今日头条', '快手', '百度']
    const toneKeywords = ['专业', '活泼', '幽默', '严肃', '温馨', '时尚', '商务', '轻松']
    
    const foundSkills = skillKeywords.filter(s => fullText.includes(s))
    const foundPlatforms = platformKeywords.filter(p => fullText.includes(p))
    const foundTones = toneKeywords.filter(t => fullText.includes(t))
    
    // 解析预期效果
    const expectedResultsText = requirements.expectedResults || ''
    const parsedExpectedResults = this.parseExpectedResults(expectedResultsText)
    
    return {
      coreRequirement: title,
      targetAudience: this.extractKeywords(description, 3),
      requiredSkills: requirements.required_skills?.length > 0 ? requirements.required_skills : foundSkills.length > 0 ? foundSkills : ['综合能力'],
      preferredPlatforms: requirements.platforms?.length > 0 ? requirements.platforms : foundPlatforms.length > 0 ? foundPlatforms : [],
      toneStyle: foundTones,
      contentType: this.detectContentType(fullText),
      urgencyLevel: fullText.includes('紧急') || fullText.includes('加急') ? 'high' : 'low',
      complexityLevel: description.length > 200 ? 7 : description.length > 100 ? 5 : 3,
      estimatedBudget: order.budget > 1000 ? '高' : order.budget > 500 ? '中' : '低',
      keywords: this.extractKeywords(title + ' ' + description, 10),
      semanticTags: this.generateSemanticTags(fullText),
      category: this.detectCategory(fullText),
      specialRequirements: [],
      expectedResults: parsedExpectedResults
    }
  }

  /**
   * 解析预期效果文本，提取量化指标
   * 例如："阅读量10万+，点赞1000+" -> { reachTarget: 100000, engagementTarget: 1000 }
   */
  private parseExpectedResults(text: string): OrderAnalysis['expectedResults'] {
    const result: OrderAnalysis['expectedResults'] = {}
    
    if (!text) return result
    
    // 曝光目标（阅读量、播放量、曝光量）
    const reachPatterns = [
      /阅读[量]?(\d+)[万]?/i,
      /播放[量]?(\d+)[万]?/i,
      /曝光[量]?(\d+)[万]?/i,
      /展现[量]?(\d+)[万]?/i,
      /浏览[量]?(\d+)[万]?/i
    ]
    for (const pattern of reachPatterns) {
      const match = text.match(pattern)
      if (match) {
        let value = parseInt(match[1])
        // 如果匹配到"万"字，乘以10000
        if (text.includes('万')) value *= 10000
        result.reachTarget = value
        break
      }
    }
    
    // 互动目标（点赞、评论、转发、收藏）
    const engagementPatterns = [
      /点赞(\d+)[万+]?/i,
      /评论(\d+)[万+]?/i,
      /转发(\d+)[万+]?/i,
      /收藏(\d+)[万+]?/i
    ]
    for (const pattern of engagementPatterns) {
      const match = text.match(pattern)
      if (match) {
        let value = parseInt(match[1])
        if (text.includes('万')) value *= 10000
        result.engagementTarget = value
        break
      }
    }
    
    // 质量目标
    if (text.includes('卓越') || text.includes('顶级')) {
      result.qualityTarget = '卓越'
    } else if (text.includes('优秀')) {
      result.qualityTarget = '优秀'
    } else if (text.includes('良好')) {
      result.qualityTarget = '良好'
    } else if (text.includes('合格')) {
      result.qualityTarget = '合格'
    }
    
    // 自定义目标（提取其他数字指标）
    const customTargets: string[] = []
    const conversionMatch = text.match(/转化率(\d+)%/)
    if (conversionMatch) {
      customTargets.push(`转化率${conversionMatch[1]}%`)
    }
    const followerMatch = text.match(/粉丝[+]?(\d+)[万]?/)
    if (followerMatch) {
      customTargets.push(`粉丝+${followerMatch[1]}${text.includes('万') ? '万' : ''}`)
    }
    if (customTargets.length > 0) {
      result.customTargets = customTargets
    }
    
    console.log(`[预期效果解析] ${text} -> reach=${result.reachTarget}, engagement=${result.engagementTarget}, quality=${result.qualityTarget}`)
    
    return result
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string, count: number): string[] {
    // 简单规则提取
    const stopWords = ['的', '了', '是', '在', '和', '与', '或', '等', '以及', '包括', '可以', '需要', '要求', '具备', '有', '能', '会']
    const words = text.split(/[\s,\.!。!，、？?\n]+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !stopWords.includes(w))
    
    // 去重并取前N个
    const unique = [...new Set(words)]
    return unique.slice(0, count)
  }

  /**
   * 检测内容类型
   */
  private detectContentType(text: string): string[] {
    const types: string[] = []
    if (text.includes('视频') || text.includes('短视频') || text.includes('剪辑')) types.push('视频内容')
    if (text.includes('图文') || text.includes('图片') || text.includes('海报')) types.push('图文内容')
    if (text.includes('文章') || text.includes('文案') || text.includes('写作')) types.push('文章撰写')
    if (text.includes('直播')) types.push('直播')
    if (text.includes('客服') || text.includes('咨询')) types.push('客服咨询')
    if (types.length === 0) types.push('综合内容')
    return types
  }

  /**
   * 生成语义标签
   */
  private generateSemanticTags(text: string): string[] {
    const tags: string[] = []
    if (text.includes('美妆') || text.includes('护肤') || text.includes('穿搭')) tags.push('时尚美妆')
    if (text.includes('美食') || text.includes('餐饮') || text.includes('食谱')) tags.push('美食生活')
    if (text.includes('科技') || text.includes('数码') || text.includes('手机')) tags.push('科技数码')
    if (text.includes('旅游') || text.includes('旅行') || text.includes('出行')) tags.push('旅游出行')
    if (text.includes('教育') || text.includes('培训') || text.includes('学习')) tags.push('教育培训')
    if (text.includes('金融') || text.includes('投资') || text.includes('理财')) tags.push('金融财经')
    if (text.includes('游戏') || text.includes('电竞')) tags.push('游戏电竞')
    if (tags.length === 0) tags.push('综合话题')
    return tags
  }

  /**
   * 检测订单类别
   */
  private detectCategory(text: string): string {
    if (text.includes('营销') || text.includes('推广') || text.includes('引流')) return '营销推广'
    if (text.includes('内容') || text.includes('创作') || text.includes('发布')) return '内容创作'
    if (text.includes('运营') || text.includes('维护')) return '账号运营'
    if (text.includes('客服') || text.includes('售后')) return '客户服务'
    if (text.includes('数据') || text.includes('分析')) return '数据分析'
    return '综合服务'
  }

  /**
   * 深度分析分身画像
   */
  async analyzeAvatarProfile(avatar: any): Promise<AvatarProfile> {
    const skills = avatar.skills || []
    const personality = avatar.personality || ''
    const name = avatar.name || ''
    
    // 构建分身分析提示词
    const analysisPrompt = `分析以下AI分身的画像特征：

分身名称：${name}
性格描述：${personality}
技能列表：${skills.join(', ')}
等级：${avatar.level || 1}
完成率：${avatar.completion_rate || 100}%
已完成订单：${avatar.completed_orders || 0}

请分析：
1. 这个分身最适合什么类型的内容创作？
2. 它的核心优势是什么？
3. 它的目标受众是哪些？
4. 它的说话风格特点？
5. 它擅长哪些专业领域？

请以JSON格式返回：
{
  "expertise": ["领域1", "领域2"],
  "coreStrengths": ["优势1", "优势2"],
  "targetAudience": ["受众1", "受众2"],
  "speakingStyle": ["风格1", "风格2"]
}`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: analysisPrompt }
      ], { 
        model: 'doubao-seed-1-8-251228',
        temperature: 0.3 
      })
      
      const content = response.content.trim()
      let analysis: any = {}
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        console.log('[分身分析] JSON解析失败，使用基础分析')
      }
      
      return {
        id: avatar.id,
        name: avatar.name,
        avatar_url: avatar.avatar_url || '',
        user_id: avatar.user_id,
        personality: avatar.personality || '',
        skills: avatar.skills || [],
        speakingStyle: analysis.speakingStyle || this.inferSpeakingStyle(skills),
        expertise: analysis.expertise || this.inferExpertise(skills),
        targetAudience: analysis.targetAudience || [],
        level: avatar.level || 1,
        completionRate: avatar.completion_rate || 100,
        completedOrders: avatar.completed_orders || 0,
        totalOrders: avatar.total_orders || 0,
        avgRating: avatar.avg_rating || 4.5,
        totalEarnings: avatar.total_earnings || 0,
        is_hosted: avatar.is_hosted || false,
        platforms: avatar.platforms || [],
        lastActiveAt: avatar.last_active_at || avatar.updated_at,
        hostedTasksCount: avatar.hosted_tasks_count || 0
      }
    } catch (error) {
      console.error('[分身分析] LLM分析失败:', error)
      // 使用基础分析
      return {
        id: avatar.id,
        name: avatar.name,
        avatar_url: avatar.avatar_url || '',
        user_id: avatar.user_id,
        personality: avatar.personality || '',
        skills: avatar.skills || [],
        speakingStyle: this.inferSpeakingStyle(skills),
        expertise: this.inferExpertise(skills),
        targetAudience: [],
        level: avatar.level || 1,
        completionRate: avatar.completion_rate || 100,
        completedOrders: avatar.completed_orders || 0,
        totalOrders: avatar.total_orders || 0,
        avgRating: avatar.avg_rating || 4.5,
        totalEarnings: avatar.total_earnings || 0,
        is_hosted: avatar.is_hosted || false,
        platforms: avatar.platforms || [],
        lastActiveAt: avatar.last_active_at || avatar.updated_at,
        hostedTasksCount: avatar.hosted_tasks_count || 0
      }
    }
  }

  /**
   * 推断说话风格
   */
  private inferSpeakingStyle(skills: string[]): string[] {
    const styles: string[] = []
    if (skills.some(s => s.includes('幽默') || s.includes('搞笑'))) styles.push('幽默风趣')
    if (skills.some(s => s.includes('专业') || s.includes('商务'))) styles.push('专业严谨')
    if (skills.some(s => s.includes('温馨') || s.includes('情感'))) styles.push('温馨亲切')
    if (styles.length === 0) styles.push('自然流畅')
    return styles
  }

  /**
   * 推断专业领域
   */
  private inferExpertise(skills: string[]): string[] {
    const expertise: string[] = []
    const mappings: Record<string, string[]> = {
      '美妆': ['时尚美妆'], '护肤': ['时尚美妆'], '穿搭': ['时尚美妆'],
      '美食': ['美食生活'], '烹饪': ['美食生活'], '食谱': ['美食生活'],
      '科技': ['科技数码'], '数码': ['科技数码'], '手机': ['科技数码'],
      '旅游': ['旅游出行'], '旅行': ['旅游出行'],
      '教育': ['教育培训'], '培训': ['教育培训'], '学习': ['教育培训'],
      '金融': ['金融财经'], '投资': ['金融财经'], '理财': ['金融财经'],
      '游戏': ['游戏电竞'], '电竞': ['游戏电竞']
    }
    
    skills.forEach(skill => {
      for (const [key, value] of Object.entries(mappings)) {
        if (skill.includes(key) && !expertise.includes(value[0])) {
          expertise.push(value[0])
        }
      }
    })
    
    if (expertise.length === 0) expertise.push('综合领域')
    return expertise
  }

  /**
   * 计算两个地理坐标之间的距离（单位：公里）
   * 使用 Haversine 公式
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return Infinity // 如果任一位置信息缺失，返回无限大
    }

    const R = 6371 // 地球半径，单位：公里
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * 将角度转换为弧度
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * 计算地理位置权重
   * 距离越近，权重越高（0-20分）
   */
  private calculateLocationWeight(
    avatarLat: number,
    avatarLon: number,
    orderLat: number,
    orderLon: number
  ): { score: number; distance: number } {
    const distance = this.calculateDistance(avatarLat, avatarLon, orderLat, orderLon)

    // 如果任一位置信息缺失，不给权重
    if (distance === Infinity) {
      return { score: 0, distance: Infinity }
    }

    let score = 0

    // 距离权重计算（单位：公里）
    if (distance <= 5) {
      score = 20 // 5公里以内，最高权重
    } else if (distance <= 10) {
      score = 18 // 10公里以内
    } else if (distance <= 20) {
      score = 15 // 20公里以内
    } else if (distance <= 50) {
      score = 12 // 50公里以内
    } else if (distance <= 100) {
      score = 8 // 100公里以内
    } else if (distance <= 200) {
      score = 5 // 200公里以内
    } else if (distance <= 500) {
      score = 2 // 500公里以内
    } else {
      score = 0 // 500公里以上，无权重
    }

    return { score, distance }
  }

  /**
   * 安全地将值转换为字符串
   */
  private safeToString(value: any): string {
    if (typeof value === 'string') return value
    if (value === null || value === undefined) return ''
    return String(value)
  }

  /**
   * 计算语义相似度
   */
  private calculateSemanticSimilarity(
    orderAnalysis: OrderAnalysis,
    avatarProfile: AvatarProfile
  ): { score: number; reasons: string[] } {
    let score = 0
    const reasons: string[] = []

    // 1. 语义标签匹配 (最高 30 分)
    const orderTags = orderAnalysis.semanticTags || []
    const avatarExpertise = avatarProfile.expertise || []
    const avatarSkills = avatarProfile.skills || []

    let tagMatchCount = 0
    orderTags.forEach(tag => {
      const tagLower = this.safeToString(tag).toLowerCase()
      if (avatarExpertise.some(e => {
        const eLower = this.safeToString(e).toLowerCase()
        return eLower.includes(tagLower) || tagLower.includes(eLower)
      })) {
        tagMatchCount++
        reasons.push(`专业领域匹配: ${tag}`)
      }
    })
    const tagScore = Math.min((tagMatchCount / Math.max(orderTags.length, 1)) * 30, 30)
    score += tagScore

    // 2. 技能匹配 (最高 30 分)
    const orderSkills = orderAnalysis.requiredSkills || []
    const allAvatarSkills = [...avatarSkills, ...avatarExpertise]

    let skillMatchCount = 0
    orderSkills.forEach(skill => {
      const skillLower = this.safeToString(skill).toLowerCase()
      if (allAvatarSkills.some(s => {
        const sLower = this.safeToString(s).toLowerCase()
        return sLower.includes(skillLower) || skillLower.includes(sLower)
      })) {
        skillMatchCount++
      }
    })
    const skillScore = orderSkills.length > 0
      ? Math.min((skillMatchCount / orderSkills.length) * 30, 30)
      : 20 // 无明确技能要求时给基础分
    score += skillScore

    // 3. 说话风格匹配 (最高 20 分)
    const orderTones = orderAnalysis.toneStyle || []
    const avatarStyles = avatarProfile.speakingStyle || []

    let toneMatchCount = 0
    orderTones.forEach(tone => {
      const toneLower = this.safeToString(tone).toLowerCase()
      if (avatarStyles.some(s => {
        const sLower = this.safeToString(s).toLowerCase()
        return sLower.includes(toneLower) || toneLower.includes(sLower)
      })) {
        toneMatchCount++
      }
    })
    const toneScore = orderTones.length > 0
      ? Math.min((toneMatchCount / orderTones.length) * 20, 20)
      : 15 // 无明确风格要求时给基础分
    score += toneScore

    // 4. 内容类型匹配 (最高 20 分)
    const orderTypes = orderAnalysis.contentType || []
    let typeMatchCount = 0
    orderTypes.forEach(type => {
      const typeLower = this.safeToString(type).toLowerCase()
      if (allAvatarSkills.some(s => {
        const sLower = this.safeToString(s).toLowerCase()
        return sLower.includes(typeLower) || typeLower.includes(sLower)
      })) {
        typeMatchCount++
      }
    })
    const typeScore = orderTypes.length > 0
      ? Math.min((typeMatchCount / orderTypes.length) * 20, 20)
      : 15
    score += typeScore

    return { score: Math.round(score * 10) / 10, reasons }
  }

  /**
   * 评估分身-订单匹配度
   */
  async evaluateAvatarOrderFit(
    avatar: any,
    order: any,
    orderAnalysis: OrderAnalysis,
    platformConfigMap: Map<string, any[]>
  ): Promise<AvatarScore & { user_id: string }> {
    // 深度分析分身画像
    const avatarProfile = await this.analyzeAvatarProfile(avatar)
    
    // 计算各项评分
    const { score: semanticScore, reasons: semanticReasons } = this.calculateSemanticSimilarity(
      orderAnalysis,
      avatarProfile
    )
    
    // 基础能力评分 (最高 40 分)
    const completionRate = avatar.completion_rate || 100
    const level = avatar.level || 1
    const completedOrders = avatar.completed_orders || 0
    const baseScore = completionRate * 0.4 // 完成率权重 40%
    
    // 等级经验评分 (最高 30 分)
    const levelScore = Math.min(level * 5, 100) * 0.3
    const expScore = Math.min(completedOrders * 2, 100) * 0.2
    
    // 活跃度评分 (最高 20 分)
    const now = new Date()
    const lastActive = avatar.last_active_at ? new Date(avatar.last_active_at) : new Date(avatar.updated_at || now)
    const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60)
    let activityScore = 100
    if (hoursSinceActive > 24) activityScore = 80
    if (hoursSinceActive > 72) activityScore = 60
    if (hoursSinceActive > 168) activityScore = 40
    
    // 平台匹配评分 (最高 20 分)
    const orderPlatforms = orderAnalysis.preferredPlatforms || []
    const userPlatformConfigs = platformConfigMap?.get(avatar.user_id) || []
    const avatarPlatforms = userPlatformConfigs.map(c => c.platform_type) || []
    
    let platformScore = 50
    if (orderPlatforms.length > 0) {
      const matchedPlatforms = orderPlatforms.filter(p => avatarPlatforms.includes(p))
      platformScore = (matchedPlatforms.length / orderPlatforms.length) * 100
      if (matchedPlatforms.length > 0) {
        semanticReasons.push(`平台配置: ${matchedPlatforms.join(', ')}`)
      }
    }
    platformScore = platformScore * 0.2 // 平台权重 20%
    
    // 复杂度匹配 (最高 10 分)
    let complexityBonus = 0
    if (orderAnalysis.complexityLevel <= 3 && level >= 3) {
      complexityBonus = 10
      semanticReasons.push('复杂度匹配度高')
    } else if (orderAnalysis.complexityLevel >= 7 && level >= 5) {
      complexityBonus = 10
      semanticReasons.push('具备高复杂度任务能力')
    } else if (orderAnalysis.complexityLevel >= 7 && level < 5) {
      complexityBonus = -5 // 复杂度太高但等级不够
      semanticReasons.push('任务复杂度较高')
    }
    
    // 托管加分归一化 (转换为0-10的范围)
    const hostingBonusNormalized = avatar.is_hosted ? 10 : 0

    // 复杂度加成归一化 (确保在-5到10之间)
    const complexityBonusClamped = Math.max(-5, Math.min(complexityBonus, 10))

    // 地理位置权重 (最高 20 分)
    const { score: locationScore, distance: locationDistance } = this.calculateLocationWeight(
      avatar.latitude,
      avatar.longitude,
      order.latitude,
      order.longitude
    )

    // 订阅权重 (最高 100 分)
    let subscriptionScore = 0
    let subscriptionLevel = 'free'
    try {
      const subscription = await this.subscriptionService.getAvatarSubscription(avatar.id)
      if (subscription && subscription.can_receive_orders) {
        subscriptionScore = subscription.order_priority || 0
        subscriptionLevel = subscription.subscription_level
        semanticReasons.push(`订阅等级: ${subscriptionLevel} (优先级 +${subscriptionScore})`)
      } else {
        semanticReasons.push('免费用户：无法接单，请升级订阅')
      }
    } catch (error) {
      console.error('[订单分配] 获取分身订阅信息失败:', error)
    }

    // 综合评分 (所有权重加起来不超过100 + 订阅权重)
    const totalScore =
      semanticScore * 0.35 +    // 语义相似度 35%
      baseScore * 0.25 +        // 基础能力 25%
      levelScore * 0.15 +       // 等级 15%
      expScore * 0.1 +         // 经验 10%
      activityScore * 0.1 +     // 活跃度 10%
      hostingBonusNormalized +  // 托管加分 0-10
      platformScore +           // 平台匹配 0-20
      locationScore +           // 地理位置 0-20
      complexityBonusClamped +  // 复杂度加成 -5~10
      subscriptionScore         // 订阅权重 0-100
    
    // 生成详细匹配理由
    const matchReasons = this.generateMatchReasons(
      avatarProfile,
      orderAnalysis,
      {
        semanticScore,
        completionRate,
        level,
        completedOrders,
        activityScore,
        platformScore,
        hostingBonus: hostingBonusNormalized,
        locationScore,
        locationDistance
      }
    )
    
    // 计算预估效果
    const estimatedEffect = this.calculateEstimatedEffect(
      avatarProfile,
      orderAnalysis,
      totalScore
    )
    
    return {
      user_id: avatar.user_id,
      id: avatar.id,
      name: avatar.name,
      avatar_url: avatar.avatar_url || '',
      score: Math.round(totalScore * 100) / 100,
      completionRate,
      level,
      totalOrders: avatar.total_orders || 0,
      completedOrders,
      skillMatchScore: semanticScore,
      platformMatchScore: platformScore,
      reason: matchReasons,
      is_hosted: avatar.is_hosted || false,
      avatarProfile,
      orderAnalysis,
      semanticSimilarity: semanticScore,
      personalityFit: 100 - (100 - activityScore) / 2,
      experienceMatch: Math.min(completedOrders * 5, 100),
      estimatedEffect
    }
  }

  /**
   * 生成匹配理由
   */
  private generateMatchReasons(
    avatarProfile: AvatarProfile,
    orderAnalysis: OrderAnalysis,
    scores: {
      semanticScore: number
      completionRate: number
      level: number
      completedOrders: number
      activityScore: number
      platformScore: number
      hostingBonus: number
      locationScore: number
      locationDistance: number
    }
  ): string[] {
    const reasons: string[] = []

    // 语义匹配理由
    if (scores.semanticScore >= 70) {
      reasons.push(`语义匹配度 ${scores.semanticScore.toFixed(0)}% - 专业领域高度契合`)
    } else if (scores.semanticScore >= 50) {
      reasons.push(`语义匹配度 ${scores.semanticScore.toFixed(0)}% - 具备相关经验`)
    }

    // 能力指标理由
    if (scores.completionRate >= 98) {
      reasons.push(`完成率 ${scores.completionRate}% - 近乎完美`)
    } else if (scores.completionRate >= 90) {
      reasons.push(`完成率 ${scores.completionRate}% - 非常可靠`)
    }

    if (scores.level >= 5) {
      reasons.push(`等级 Lv.${scores.level} - 资深经验`)
    } else if (scores.level >= 3) {
      reasons.push(`等级 Lv.${scores.level} - 经验丰富`)
    }

    if (scores.completedOrders >= 50) {
      reasons.push(`已完成 ${scores.completedOrders} 单 - 老练专业`)
    } else if (scores.completedOrders >= 20) {
      reasons.push(`已完成 ${scores.completedOrders} 单 - 熟练可靠`)
    }

    // 活跃度理由
    if (scores.activityScore >= 90) {
      reasons.push('近期活跃 - 响应迅速')
    } else if (scores.activityScore >= 70) {
      reasons.push('保持活跃 - 状态良好')
    }

    // 托管加分理由
    if (scores.hostingBonus > 0) {
      reasons.push('开启托管 - 全天候自动服务')
    }

    // 地理位置理由
    if (scores.locationScore > 0 && scores.locationDistance !== Infinity) {
      if (scores.locationDistance <= 5) {
        reasons.push(`距离 ${scores.locationDistance.toFixed(1)}km - 就近快速响应`)
      } else if (scores.locationDistance <= 20) {
        reasons.push(`距离 ${scores.locationDistance.toFixed(1)}km - 地理位置便利`)
      } else if (scores.locationDistance <= 100) {
        reasons.push(`距离 ${scores.locationDistance.toFixed(1)}km - 地理位置适中`)
      } else {
        reasons.push(`距离 ${scores.locationDistance.toFixed(1)}km`)
      }
    }

    // 平台配置理由
    const platforms = orderAnalysis.preferredPlatforms || []
    if (platforms.length > 0 && scores.platformScore >= 80) {
      reasons.push(`平台配置完善 - 可多平台分发`)
    }
    
    // 技能专长理由
    const expertise = avatarProfile.expertise || []
    const requiredSkills = orderAnalysis.requiredSkills || []
    const matchedSkills = expertise.filter(e => 
      requiredSkills.some(r => 
        e.toLowerCase().includes(r.toLowerCase()) || 
        r.toLowerCase().includes(e.toLowerCase())
      )
    )
    if (matchedSkills.length > 0) {
      reasons.push(`专业技能: ${matchedSkills.slice(0, 2).join(', ')}`)
    }
    
    // 性格风格理由
    const styles = avatarProfile.speakingStyle || []
    if (styles.length > 0) {
      reasons.push(`风格特点: ${styles[0]}`)
    }
    
    return reasons.slice(0, 6) // 最多6条理由
  }

  /**
   * 计算预估效果
   */
  private calculateEstimatedEffect(
    avatarProfile: AvatarProfile,
    orderAnalysis: OrderAnalysis,
    totalScore: number
  ): { reach: string; engagement: string; quality: string; time: string } {
    // 预估曝光
    let reach = '中等'
    if (totalScore >= 85) reach = '优秀'
    else if (totalScore >= 70) reach = '良好'
    
    // 预估互动率
    let engagement = '中等'
    if (avatarProfile.avgRating >= 4.8) engagement = '优秀'
    else if (avatarProfile.avgRating >= 4.5) engagement = '良好'
    else if (avatarProfile.avgRating >= 4.0) engagement = '一般'
    
    // 预估质量
    let quality = '良好'
    if (totalScore >= 85 && avatarProfile.completionRate >= 98) quality = '卓越'
    else if (totalScore >= 70 && avatarProfile.completionRate >= 95) quality = '优秀'
    else if (totalScore >= 60) quality = '合格'
    
    // 预估完成时间
    let time = '1-3天'
    if (orderAnalysis.urgencyLevel === 'high') {
      time = avatarProfile.is_hosted ? '4-8小时' : '12-24小时'
    } else if (orderAnalysis.complexityLevel >= 7) {
      time = '3-5天'
    } else if (orderAnalysis.complexityLevel <= 3) {
      time = avatarProfile.is_hosted ? '2-4小时' : '8-12小时'
    }
    
    return { reach, engagement, quality, time }
  }

  /**
   * 获取分身的账号数据和历史效果数据
   */
  private async getAvatarPerformanceData(avatarIds: string[]): Promise<Map<string, any>> {
    const client = getSupabaseClient()

    const avatarDataMap = new Map<string, any>()

    // 获取分身账号数据
    const { data: accounts } = await client
      .from('avatar_accounts')
      .select('*')
      .in('avatar_id', avatarIds)

    // 获取分身历史效果数据（最近30天）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: orderResults } = await client
      .from('order_results')
      .select('*')
      .in('avatar_id', avatarIds)
      .gte('created_at', thirtyDaysAgo.toISOString())

    // 聚合每个分身的数据
    avatarIds.forEach(avatarId => {
      const avatarAccounts = accounts?.filter(a => a.avatar_id === avatarId) || []
      const avatarResults = orderResults?.filter(r => r.avatar_id === avatarId) || []

      // 汇总各平台账号数据
      const platformData = {}
      let totalFollowers = 0
      let totalExposure = 0
      let totalWorks = 0
      let avgEngagementRate = 0

      avatarAccounts.forEach(account => {
        platformData[account.platform] = {
          followers: account.followers,
          totalExposure: account.total_exposure,
          totalWorks: account.total_works,
          avgLikesPerWork: account.avg_likes_per_work,
          avgCommentsPerWork: account.avg_comments_per_work,
          avgSharesPerWork: account.avg_shares_per_work,
          engagementRate: parseFloat(account.engagement_rate || 0),
        }
        totalFollowers += account.followers
        totalExposure += account.total_exposure
        totalWorks += account.total_works
        avgEngagementRate += parseFloat(account.engagement_rate || 0)
      })

      avgEngagementRate = avatarAccounts.length > 0 ? avgEngagementRate / avatarAccounts.length : 0

      // 汇总历史效果数据
      let totalActualExposure = 0
      let totalActualLikes = 0
      let totalActualComments = 0
      let avgQualityScore = 0
      let avgCompletionTime = 0

      avatarResults.forEach(result => {
        totalActualExposure += result.actual_exposure
        totalActualLikes += result.actual_likes
        totalActualComments += result.actual_comments
        avgQualityScore += result.quality_score
        avgCompletionTime += parseFloat(result.completion_time_hours || 0)
      })

      avgQualityScore = avatarResults.length > 0 ? avgQualityScore / avatarResults.length : 0
      avgCompletionTime = avatarResults.length > 0 ? avgCompletionTime / avatarResults.length : 0

      avatarDataMap.set(avatarId, {
        accounts: platformData,
        totalFollowers,
        totalExposure,
        totalWorks,
        avgEngagementRate,
        historicalData: {
          totalActualExposure,
          totalActualLikes,
          totalActualComments,
          avgQualityScore,
          avgCompletionTime,
          completedOrders: avatarResults.length,
        },
        // 估算每个分身单次能带来的效果（基于历史数据的平均值）
        estimatedCapacity: {
          exposure: avatarResults.length > 0 ? totalActualExposure / avatarResults.length : (totalExposure / (totalWorks || 1)),
          engagement: avatarResults.length > 0 ? (totalActualLikes + totalActualComments) / avatarResults.length : (totalExposure * avgEngagementRate / 100),
        }
      })
    })

    return avatarDataMap
  }

  /**
   * 传统推荐数量计算算法（无预期效果时使用）
   */
  private calculateTraditionalCount(
    complexity: number,
    urgency: string,
    platforms: number,
    totalAvailableAvatars: number
  ): number {
    let count = 1

    // 复杂度
    if (complexity >= 8) count = 3
    else if (complexity >= 6) count = 2

    // 紧急程度
    if (urgency === 'high') count = Math.max(count, 3)
    else if (urgency === 'medium') count = Math.max(count, 2)

    // 平台覆盖
    if (platforms > count) count = Math.min(platforms, 3)

    return Math.min(Math.max(count, 1), Math.min(totalAvailableAvatars, 5))
  }

  /**
   * 根据订单预期效果目标计算所需推荐分身数量
   * 
   * 核心原则：确保能达到订单的预期效果！
   * - 金额只用于合理分配收益，不是不保证分身赚钱
   * - 多个预期效果目标综合计算，取最大值
   * 
   * 预期效果维度：
   * 1. 曝光目标（reachTarget）：阅读量/播放量/曝光量
   * 2. 互动目标（engagementTarget）：点赞/评论/转发
   * 3. 质量目标（qualityTarget）：卓越/优秀/良好/合格
   * 4. 自定义目标（customTargets）：转化率、粉丝等
   */
  private calculateRecommendedAvatarCount(
    orderAnalysis: OrderAnalysis,
    totalAvailableAvatars: number,
    orderAmount: number
  ): number {
    const complexity = orderAnalysis.complexityLevel || 5
    const urgency = orderAnalysis.urgencyLevel || 'medium'
    const platforms = orderAnalysis.preferredPlatforms?.length || 1
    const expected = orderAnalysis.expectedResults || {}

    console.log(`[推荐数量] 订单分析 - 预期效果:`, expected)

    // ========== 如果没有预期效果，使用传统算法 ==========
    if (!expected.reachTarget && !expected.engagementTarget) {
      console.log(`[推荐数量] 无明确预期效果，使用传统算法`)
      return this.calculateTraditionalCount(complexity, urgency, platforms, totalAvailableAvatars)
    }

    // ========== 有预期效果，基于分身能力倒推 ==========
    // 1. 曝光目标倒推
    let avatarsForReach = 1
    const reachTarget = expected.reachTarget || 0
    if (reachTarget > 0) {
      // 假设单个分身平均能带来5-20万曝光（基于历史数据估算）
      // 这里使用保守估计：10万曝光/分身
      avatarsForReach = Math.ceil(reachTarget / 100000)
      console.log(`[推荐数量] 曝光目标=${reachTarget} -> 需要${avatarsForReach}个分身（假设每个分身10万曝光）`)
    }

    // 2. 互动目标倒推
    let avatarsForEngagement = 1
    const engagementTarget = expected.engagementTarget || 0
    if (engagementTarget > 0) {
      // 假设单个分身平均能带来1000-5000互动（基于历史数据估算）
      // 这里使用保守估计：2000互动/分身
      avatarsForEngagement = Math.ceil(engagementTarget / 2000)
      console.log(`[推荐数量] 互动目标=${engagementTarget} -> 需要${avatarsForEngagement}个分身（假设每个分身2000互动）`)
    }

    // 3. 自定义目标分析
    let avatarsForCustom = 1
    if (expected.customTargets && expected.customTargets.length > 0) {
      const hasConversion = expected.customTargets.some(t => t.includes('转化率'))
      if (hasConversion) {
        avatarsForCustom = 2  // 转化率要求需要高质量分身
      }
      console.log(`[推荐数量] 自定义目标=${expected.customTargets} -> 需要${avatarsForCustom}个分身`)
    }

    // ========== 综合计算 ==========
    // 取所有效果目标的最大值（确保每个目标都能满足）
    let neededByEffect = Math.max(
      avatarsForReach,
      avatarsForEngagement,
      avatarsForCustom
    )

    // 考虑平台覆盖需求
    if (platforms > neededByEffect) {
      neededByEffect = Math.min(platforms, 3)  // 最多3个分身覆盖平台
    }

    console.log(`[推荐数量] 效果需求汇总: ${neededByEffect}个分身`)

    // ========== 最终结果 ==========
    const finalCount = Math.min(
      Math.max(neededByEffect, 1),  // 至少1个
      Math.min(totalAvailableAvatars, 10)  // 最多10个，且不超过可用分身
    )

    // 计算每个分身预期收益
    const distributableAmount = orderAmount * 0.8
    const estimatedIncomePerAvatar = distributableAmount / finalCount

    console.log(`[推荐数量] 最终推荐: ${finalCount}个分身`)
    console.log(`[推荐数量] 订单金额: ${orderAmount}元，平台抽成20%后: ${distributableAmount.toFixed(0)}元`)
    console.log(`[推荐数量] 预计每个分身收益: ${estimatedIncomePerAvatar.toFixed(0)}元`)

    return finalCount
  }

  /**
   * 智能订单分配算法
   * 根据订单需求和分身能力进行多维度匹配
   */
  async dispatchOrder(orderId: string): Promise<DispatchResult | null> {
    const client = getSupabaseClient()
    
    // 1. 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (!order) {
      throw new Error('订单不存在')
    }

    // 如果订单已有分配，不重复分配
    if (order.avatar_id) {
      console.log('[分身调度] 订单已分配，跳过')
      return null
    }
    
    // 2. 获取所有活跃分身
    const { data: avatars } = await client
      .from('avatars')
      .select('*')
      .eq('status', 'active')
    
    if (!avatars || avatars.length === 0) {
      console.log('[分身调度] 暂无活跃分身，订单保持待接单状态')
      return null
    }
    
    // 3. 获取用户信息和通知偏好
    const userIds = [...new Set(avatars.map(a => a.user_id))]
    const { data: users } = await client
      .from('users')
      .select('id, phone, notification_settings')
      .in('id', userIds)
    
    const userMap = new Map(users?.map(u => [u.id, u]) || [])
    
    // 4. 深度分析订单需求
    const orderAnalysis = await this.analyzeOrderRequirements(order)
    
    // 5. 获取平台配置
    const { data: platformConfigs } = await client
      .from('platform_configs')
      .select('*')
      .in('user_id', userIds)
    
    const platformConfigMap = new Map<string, any[]>()
    platformConfigs?.forEach(config => {
      const existing = platformConfigMap.get(config.user_id) || []
      existing.push(config)
      platformConfigMap.set(config.user_id, existing)
    })
    
    // 6. 深度评估每个分身
    const scoredAvatars: (AvatarScore & { user_id: string })[] = []
    for (const avatar of avatars) {
      const score = await this.evaluateAvatarOrderFit(
        avatar, order, orderAnalysis, platformConfigMap
      )
      scoredAvatars.push(score)
    }
    
    // 7. 过滤出开启托管或有可用通知的分身
    const eligibleAvatars = scoredAvatars.filter(avatar => {
      // 如果开启托管，直接可用
      if (avatar.is_hosted) return true
      // 如果用户有手机号且允许通知，也可用（需要人工确认）
      const user = userMap.get(avatar.user_id)
      return user?.phone && user?.notification_settings?.order_dispatch !== false
    })
    
    if (eligibleAvatars.length === 0) {
      console.log('[分身调度] 没有符合条件的分身，订单保持待接单状态')
      return null
    }
    
    // 6. 按评分排序
    eligibleAvatars.sort((a, b) => b.score - a.score)
    
    // 7. 选择评分最高的分身
    const selectedAvatar = eligibleAvatars[0]
    const avatarUser = userMap.get(selectedAvatar.user_id)
    
    // 8. 根据托管状态决定是否自动分配
    if (selectedAvatar.is_hosted) {
      // 自动分配
      await this.assignOrderToAvatar(orderId, selectedAvatar.id)
      
      // 发送应用内通知
      await this.notificationService.createNotification(selectedAvatar.user_id, {
        type: 'system',
        title: '订单自动分配',
        content: `您的分身"${selectedAvatar.name}"已自动接取订单：${order.title}`,
        data: { orderId, avatarId: selectedAvatar.id }
      })
      
    } else {
      // 发送确认请求
      await this.sendDispatchRequest(orderId, selectedAvatar, avatarUser, order)
    }
    
    // 9. 返回分配结果
    return {
      orderId,
      avatarId: selectedAvatar.id,
      avatarName: selectedAvatar.name,
      score: selectedAvatar.score,
      reason: selectedAvatar.reason
    }
  }

  /**
   * 自动分配订单给分身
   */
  private async assignOrderToAvatar(orderId: string, avatarId: string) {
    const client = getSupabaseClient()
    
    // 更新订单状态
    await client
      .from('orders')
      .update({
        avatar_id: avatarId,
        status: 'in_progress',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
    
    // 更新分身订单计数
    const { data: avatar } = await client
      .from('avatars')
      .select('total_orders')
      .eq('id', avatarId)
      .single()
    
    await client
      .from('avatars')
      .update({
        total_orders: (avatar?.total_orders || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
    
    // 创建执行步骤
    await this.createExecutionSteps(orderId, avatarId)
  }

  /**
   * 发送分配确认请求
   */
  private async sendDispatchRequest(
    orderId: string, 
    avatar: AvatarScore & { user_id: string }, 
    user: any,
    order: any
  ) {
    const client = getSupabaseClient()
    
    // 创建待确认的分配记录
    await client
      .from('order_dispatch_requests')
      .insert({
        order_id: orderId,
        avatar_id: avatar.id,
        user_id: avatar.user_id,
        status: 'pending',
        score: avatar.score,
        match_reasons: avatar.reason,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时过期
      })
    
    // 发送通知
    await this.notificationService.createNotification(avatar.user_id, {
      type: 'system',
      title: '订单分配请求',
      content: `有新的订单等待您确认：${order.title}`,
      data: { orderId, avatarId: avatar.id, type: 'dispatch_request' }
    })

    // 如果有手机号，发送短信通知
    if (user?.phone) {
      try {
        await this.smsService.sendOrderDispatchNotification(user.phone, avatar.name, orderId)
        console.log(`[分身调度] 已发送短信通知到 ${user.phone}`)
      } catch (error) {
        console.error(`[分身调度] 短信通知发送失败:`, error)
      }
    }
  }

  /**
   * 手动分配订单给指定分身
   */
  async dispatchToAvatar(orderId: string, avatarId: string): Promise<any> {
    const client = getSupabaseClient()

    // 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) {
      throw new Error('订单不存在')
    }

    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('*, user_id, name')
      .eq('id', avatarId)
      .single()

    if (!avatar) {
      throw new Error('分身不存在')
    }

    // 检查是否已经分配给该分身
    const { data: existingRequest } = await client
      .from('order_dispatch_requests')
      .select('*')
      .eq('order_id', orderId)
      .eq('avatar_id', avatarId)
      .single()

    if (existingRequest) {
      throw new Error('该分身已经收到此订单')
    }

    // 获取用户信息
    const { data: user } = await client
      .from('users')
      .select('phone')
      .eq('id', avatar.user_id)
      .single()

    // 创建待确认的分配记录
    console.log(`[dispatchToAvatar] 开始创建分配记录，order_id=${orderId}, avatar_id=${avatarId}`)
    const { data: request, error } = await client.rpc('create_dispatch_request', {
      p_order_id: orderId,
      p_avatar_id: avatarId,
      p_user_id: avatar.user_id,
      p_score: 85,
      p_match_reasons: ['手动分配'],
      p_expires_hours: 24
    })

    if (error) {
      console.error(`[dispatchToAvatar] 创建分配记录失败:`, error)
      throw new Error('创建分配记录失败: ' + error.message)
    }

    console.log(`[dispatchToAvatar] 分配记录创建成功:`, request)

    // 发送应用内通知
    await this.notificationService.createNotification(avatar.user_id, {
      type: 'system',
      title: '订单分配请求',
      content: `有新的订单等待您确认：${order.title}`,
      data: { orderId, avatarId, type: 'dispatch_request' }
    })

    // 发送短信通知
    if (user?.phone) {
      try {
        await this.smsService.sendOrderDispatchNotification(user.phone, avatar.name, orderId)
        console.log(`[分身调度] 已发送短信通知到 ${user.phone}`)
      } catch (error) {
        console.error(`[分身调度] 短信通知发送失败:`, error)
      }
    }

    return request
  }

  /**
   * 获取用户待确认订单列表
   */
  async getUserPendingRequests(userId: string): Promise<any[]> {
    const client = getSupabaseClient()

    try {
      // 1. 先查询该用户的所有分身
      const { data: avatars, error: avatarsError } = await client
        .from('avatars')
        .select('id')
        .eq('user_id', userId)

      if (avatarsError) {
        console.error('[getUserPendingRequests] 查询分身失败:', avatarsError)
        return []
      }

      if (!avatars || avatars.length === 0) {
        return []
      }

      const avatarIds = avatars.map(a => a.id)

      // 2. 查询这些分身的待确认订单请求（不关联 orders）
      const { data: requests, error: requestsError } = await client
        .from('order_dispatch_requests')
        .select('*')
        .in('avatar_id', avatarIds)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (requestsError) {
        console.error('[getUserPendingRequests] 查询订单请求失败:', requestsError)
        return []
      }

      if (!requests || requests.length === 0) {
        return []
      }

      // 3. 关联分身信息和订单信息
      const requestsWithDetails = await Promise.all(
        requests.map(async (request: any) => {
          // 查询分身信息 - 使用可能返回多条记录的方式
          const { data: avatar, error: avatarError } = await client
            .from('avatars')
            .select('id, name, avatar_url, level, completion_rate, avg_rating, is_hosted')
            .eq('id', request.avatar_id)
            .limit(1)

          // 查询订单信息 - 使用可能返回多条记录的方式
          const { data: order, error: orderError } = await client
            .from('orders')
            .select('id, title, description, budget, content_type, platforms, target_audience, deadline, created_at')
            .eq('id', request.order_id)
            .limit(1)

          const avatarData = avatar && avatar.length > 0 ? avatar[0] : null
          const orderData = order && order.length > 0 ? order[0] : null

          // 如果查询失败，打印错误日志
          if (avatarError || !avatarData) {
            console.warn('[getUserPendingRequests] 分身查询失败:', {
              requestId: request.id,
              avatarId: request.avatar_id,
              error: avatarError?.message || '未找到数据'
            })
          }

          if (orderError || !orderData) {
            console.warn('[getUserPendingRequests] 订单查询失败:', {
              requestId: request.id,
              orderId: request.order_id,
              error: orderError?.message || '未找到数据'
            })
          }

          return {
            ...request,
            avatars: avatarData || {
              id: request.avatar_id,
              name: '未知分身',
              avatar_url: null,
              level: 1,
              completion_rate: 0,
              avg_rating: 0,
              is_hosted: false
            },
            orders: orderData || {
              id: request.order_id,
              title: '未知订单',
              description: '',
              budget: 0,
              content_type: '',
              platforms: [],
              target_audience: '',
              deadline: '',
              created_at: request.created_at
            }
          }
        })
      )

      return requestsWithDetails
    } catch (error) {
      console.error('[getUserPendingRequests] 处理失败:', error)
      return []
    }
  }

  /**
   * 获取分身已接受的订单列表
   */
  async getAvatarAcceptedOrders(avatarId: string): Promise<any[]> {
    const client = getSupabaseClient()

    try {
      // 查询该分身已接受的订单（状态为 accepted, generating, preview, publishing, completed, published）
      // 包含所有已接受和已完成的订单
      const { data: requests, error } = await client
        .from('order_dispatch_requests')
        .select('*')
        .eq('avatar_id', avatarId)
        .in('status', ['accepted', 'generating', 'preview', 'publishing', 'completed', 'published'])
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[getAvatarAcceptedOrders] 查询失败:', error)
        return []
      }

      if (!requests || requests.length === 0) {
        return []
      }

      // 关联订单信息
      const ordersWithDetails = await Promise.all(
        requests.map(async (request: any) => {
          // 查询订单信息
          const { data: order, error: orderError } = await client
            .from('orders')
            .select('id, title, description, budget, status, created_at')
            .eq('id', request.order_id)
            .single()

          return {
            ...request,
            accepted_at: request.updated_at,  // 使用 updated_at 作为接受时间
            orders: order || {
              id: request.order_id,
              title: '未知订单',
              description: '',
              budget: 0,
              status: 'unknown',
              created_at: request.created_at
            }
          }
        })
      )

      return ordersWithDetails
    } catch (error) {
      console.error('[getAvatarAcceptedOrders] 处理失败:', error)
      return []
    }
  }

  /**
   * 获取分身通知列表
   */
  async getAvatarNotifications(avatarId: string): Promise<any[]> {
    const client = getSupabaseClient()

    try {
      // 查询该分身的通知
      const { data: notifications, error } = await client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[getAvatarNotifications] 查询失败:', error)
        return []
      }

      // 过滤出包含该分身ID的通知
      const filteredNotifications = (notifications || []).filter((notification: any) => {
        try {
          if (notification.data && typeof notification.data === 'object') {
            const avatarIdField = notification.data.avatarId || notification.data.avatar_id
            return avatarIdField === avatarId
          }
          return false
        } catch (e) {
          return false
        }
      })

      return filteredNotifications
    } catch (error) {
      console.error('[getAvatarNotifications] 处理失败:', error)
      return []
    }
  }

  /**
   * 确认订单分配
   */
  async confirmDispatch(requestId: string, avatarId: string): Promise<boolean> {
    const client = getSupabaseClient()

    // 验证请求
    const { data: request } = await client
      .from('order_dispatch_requests')
      .select('*')
      .eq('id', requestId)
      .eq('avatar_id', avatarId)
      .eq('status', 'pending')
      .single()

    if (!request) {
      throw new Error('分配请求不存在或已过期')
    }

    if (new Date(request.expires_at) < new Date()) {
      throw new Error('分配请求已过期')
    }

    // 更新请求状态
    await client
      .from('order_dispatch_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)

    // 分配订单
    await this.assignOrderToAvatar(request.order_id, avatarId)

    // 将任务加入队列
    await this.orderProcessingService.enqueueTask(requestId)

    console.log(`[订单分配] 订单 ${request.order_id} 已接受并加入队列`)

    return true
  }

  /**
   * 拒绝订单分配
   */
  async rejectDispatch(requestId: string, avatarId: string): Promise<boolean> {
    const client = getSupabaseClient()
    
    await client
      .from('order_dispatch_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
      .eq('avatar_id', avatarId)
    
    return true
  }

  /**
   * 创建订单执行步骤
   */
  private async createExecutionSteps(orderId: string, avatarId: string) {
    const client = getSupabaseClient()
    
    const steps = [
      { step_number: 1, step_name: '需求分析', description: '分析订单需求，制定执行方案' },
      { step_number: 2, step_name: '内容创作', description: '根据要求生成内容' },
      { step_number: 3, step_name: '内容审核', description: '审核生成的内容' },
      { step_number: 4, step_name: '平台发布', description: '将内容发布到目标平台' },
      { step_number: 5, step_name: '数据追踪', description: '追踪发布后的数据反馈' }
    ]
    
    const stepRecords = steps.map(step => ({
      order_id: orderId,
      avatar_id: avatarId,
      ...step,
      status: 'pending'
    }))
    
    await client
      .from('order_executions')
      .insert(stepRecords)
  }

  /**
   * 获取订单执行进度
   */
  async getExecutionProgress(orderId: string) {
    const client = getSupabaseClient()
    
    const { data: executions } = await client
      .from('order_executions')
      .select('*')
      .eq('order_id', orderId)
      .order('step_number', { ascending: true })
    
    return executions || []
  }

  /**
   * 更新执行步骤状态
   */
  async updateExecutionStep(executionId: string, status: string, result?: any) {
    const client = getSupabaseClient()
    
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    }
    
    if (status === 'in_progress') {
      updates.started_at = new Date().toISOString()
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }
    
    if (result) {
      updates.result = result
    }
    
    const { data, error } = await client
      .from('order_executions')
      .update(updates)
      .eq('id', executionId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新执行步骤失败: ${error.message}`)
    }
    
    // 如果步骤完成，检查是否需要进入下一步
    if (status === 'completed') {
      await this.moveToNextStep(data.order_id, data.step_number)
    }
    
    return data
  }

  /**
   * 进入下一步骤
   */
  private async moveToNextStep(orderId: string, currentStep: number) {
    const client = getSupabaseClient()
    
    const { data: nextStep } = await client
      .from('order_executions')
      .select('id')
      .eq('order_id', orderId)
      .eq('step_number', currentStep + 1)
      .single()
    
    if (nextStep) {
      await client
        .from('order_executions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', nextStep.id)
    } else {
      // 所有步骤完成，更新订单状态
      await client
        .from('orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', orderId)
    }
  }

  /**
   * 获取订单分配状态
   */
  async getDispatchStatus(orderId: string) {
    const client = getSupabaseClient()

    const { data: order } = await client
      .from('orders')
      .select('*, avatars(name, avatar_url, level)')
      .eq('id', orderId)
      .single()

    if (!order) {
      throw new Error('订单不存在')
    }

    // 获取待确认的分配请求
    const { data: pendingRequest } = await client
      .from('order_dispatch_requests')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .single()

    // 获取已接受的分配请求
    const { data: acceptedRequest } = await client
      .from('order_dispatch_requests')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'accepted')
      .single()

    // 获取已接受的分身信息（如果存在）
    let acceptedAvatar: any = null
    if (acceptedRequest?.avatar_id) {
      const { data: avatar } = await client
        .from('avatars')
        .select('name, avatar_url, level')
        .eq('id', acceptedRequest.avatar_id)
        .single()
      acceptedAvatar = avatar
    }

    // 获取执行进度
    const executions = await this.getExecutionProgress(orderId)

    return {
      order,
      pendingRequest,
      acceptedAvatar,
      executions,
      currentStep: executions.find((e: any) => e.status === 'in_progress') || null
    }
  }

  /**
   * 获取推荐分身列表
   * 使用深度学习算法进行智能匹配
   * @param orderId 订单ID
   * @param limit 返回数量限制，0或负数表示返回全部
   */
  async getRecommendedAvatars(orderId: string, limit: number = 0) {
    const client = getSupabaseClient()
    
    // ========== 第一步：深度理解订单需求 ==========
    console.log('[智能匹配] 开始深度分析订单需求...')
    
    // 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    // 使用 LLM 深度分析订单需求
    const orderAnalysis = await this.analyzeOrderRequirements(order)
    console.log('[智能匹配] 订单深度分析完成:', {
      coreRequirement: orderAnalysis.coreRequirement,
      category: orderAnalysis.category,
      requiredSkills: orderAnalysis.requiredSkills,
      preferredPlatforms: orderAnalysis.preferredPlatforms,
      complexityLevel: orderAnalysis.complexityLevel,
      urgencyLevel: orderAnalysis.urgencyLevel,
      semanticTags: orderAnalysis.semanticTags
    })
    
    // ========== 第二步：获取活跃分身列表 ==========
    console.log('[智能匹配] 获取活跃分身列表...')
    
    const { data: avatars } = await client
      .from('avatars')
      .select('*')
      .eq('status', 'active')
    
    if (!avatars || avatars.length === 0) {
      console.log('[智能匹配] 暂无活跃分身')
      return []
    }
    console.log(`[智能匹配] 找到 ${avatars.length} 个活跃分身`)

    // ========== 第二步半：预过滤 - 平台匹配 ==========
    console.log('[智能匹配] 开始平台匹配预过滤...')
    const orderPlatforms = orderAnalysis.preferredPlatforms || []
    console.log(`[智能匹配] 订单要求平台: ${orderPlatforms.join(', ')}`)

    // 获取所有分身用户的平台配置
    const userIds = [...new Set(avatars.map(a => a.user_id))]
    console.log(`[智能匹配] 查询 ${userIds.length} 个用户的平台配置`)

    const { data: platformConfigs } = await client
      .from('platform_configs')
      .select('*')
      .in('user_id', userIds)

    console.log(`[智能匹配] 查询到 ${platformConfigs?.length || 0} 条平台配置`)

    // 按 user_id 构建平台配置映射
    const platformConfigMap = new Map<string, any[]>()
    platformConfigs?.forEach(config => {
      const existing = platformConfigMap.get(config.user_id) || []
      existing.push(config)
      platformConfigMap.set(config.user_id, existing)
    })

    // 过滤掉无效的平台要求（如"不限"、"无"等）
    const invalidPlatformKeywords = ['不限', '无', '任意', 'all', 'none', 'any']
    const validOrderPlatforms = orderPlatforms.filter(p => {
      const pLower = p.toLowerCase()
      return !invalidPlatformKeywords.some(keyword => pLower.includes(keyword))
    })

    console.log(`[智能匹配] 有效平台要求: ${validOrderPlatforms.join(', ')}`)

    // 如果订单有明确的平台要求，过滤掉没有绑定对应平台的分身
    let filteredAvatars = avatars
    if (validOrderPlatforms.length > 0) {
      filteredAvatars = avatars.filter(avatar => {
        const userConfigs = platformConfigMap.get(avatar.user_id) || []
        const avatarPlatforms = userConfigs.map(c => c.platform_type)
        console.log(`[智能匹配] 分身 ${avatar.name} (user_id: ${avatar.user_id}) 绑定平台: ${avatarPlatforms.join(', ') || '无'}`)

        // 规范化订单平台名称为平台代码
        const normalizedOrderPlatforms = validOrderPlatforms.map(p => this.normalizePlatformName(p))

        // 分身必须至少绑定一个订单要求的平台
        const hasRequiredPlatform = normalizedOrderPlatforms.some(p => avatarPlatforms.includes(p))
        if (!hasRequiredPlatform) {
          console.log(`[智能匹配] 过滤分身 ${avatar.name}：未绑定所需平台 ${normalizedOrderPlatforms.join(', ')}`)
        }
        return hasRequiredPlatform
      })
      console.log(`[智能匹配] 平台匹配过滤后：${avatars.length} -> ${filteredAvatars.length} 个分身`)
    } else {
      console.log('[智能匹配] 订单无明确平台要求，跳过平台过滤')
      filteredAvatars = avatars
    }

    if (!filteredAvatars || filteredAvatars.length === 0) {
      console.log('[智能匹配] 经过平台匹配过滤后，无可用分身')
      return []
    }
    
    // ========== 第二步半2：不再进行技能过滤，技能匹配将在评分阶段体现 ==========
    console.log('[智能匹配] 技能匹配将在评分阶段计算，不进行硬性过滤')

    if (!filteredAvatars || filteredAvatars.length === 0) {
      console.log('[智能匹配] 经过技能匹配过滤后，无可用分身')
      return []
    }

    // ========== 第二步半3：根据订单分析计算推荐分身数量 ==========
    // 动态计算需要多少推荐分身，根据订单金额和效果目标
    const orderAmount = order.budget || 0
    const recommendedCount = limit > 0
      ? limit  // 如果前端指定了limit，使用指定的limit
      : this.calculateRecommendedAvatarCount(orderAnalysis, filteredAvatars.length, orderAmount)

    console.log(`[智能匹配] 根据订单分析计算推荐分身数量: ${recommendedCount}`)
    console.log(`  - 订单金额: ${orderAmount}元，可分配: ${(orderAmount * 0.8).toFixed(0)}元`)
    console.log(`  - 紧急程度: ${orderAnalysis.urgencyLevel || 'medium'}`)
    console.log(`  - 复杂度: ${orderAnalysis.complexityLevel || 5}`)
    console.log(`  - 技能要求: ${orderAnalysis.requiredSkills?.length || 0}项`)
    console.log(`  - 平台要求: ${orderPlatforms.length}个`)
    console.log(`  - 可用分身: ${filteredAvatars.length}个`)

    // ========== 第三步：深度评估每个分身 ==========
    console.log('[智能匹配] 开始深度评估分身能力...')

    // 收集评分数据
    const scoredAvatarsPromises = filteredAvatars.map(async (avatar, index) => {
      try {
        const score = await this.evaluateAvatarOrderFit(
          avatar, 
          order, 
          orderAnalysis, 
          platformConfigMap
        )
        console.log(`[智能匹配] 分身 ${avatar.name} 评分: ${score.score.toFixed(2)}`)
        return score
      } catch (error) {
        console.error(`[智能匹配] 分身 ${avatar.name} 评估失败:`, error)
        return null
      }
    })
    
    // 等待所有评估完成
    const scoredAvatars = (await Promise.all(scoredAvatarsPromises))
      .filter(avatar => avatar !== null) as (AvatarScore & { user_id: string })[]
    
    // ========== 第五步：综合排序 ==========
    console.log('[智能匹配] 综合评分排序...')
    
    scoredAvatars.sort((a, b) => b.score - a.score)
    
    // 获取额外信息（评分、平均评分、收益等）
    const avatarIds = scoredAvatars.map(a => a.id)
    const { data: orderRatings } = await client
      .from('orders')
      .select('id, avatar_id, rating, completed_at, requirements, budget')
      .in('avatar_id', avatarIds)
      .eq('status', 'completed')
    
    // 计算每个分身的统计数据
    const avatarStatsMap = new Map<string, any>()
    orderRatings?.forEach(order => {
      const stats = avatarStatsMap.get(order.avatar_id) || {
        totalRating: 0,
        ratingCount: 0,
        totalEarnings: 0
      }
      if (order.rating?.score) {
        stats.totalRating += order.rating.score
        stats.ratingCount++
      }
      stats.totalEarnings += order.budget || 0
      avatarStatsMap.set(order.avatar_id, stats)
    })
    
    // ========== 第六步：格式化返回结果 ==========
    const result = scoredAvatars.slice(0, recommendedCount).map(avatar => {
      const stats = avatarStatsMap.get(avatar.id) || { totalRating: 0, ratingCount: 0, totalEarnings: 0 }
      const avgRating = stats.ratingCount > 0 ? stats.totalRating / stats.ratingCount : 4.5
      
      return {
        id: avatar.id,
        name: avatar.name,
        avatar_url: avatar.avatar_url || '',
        level: avatar.level,
        score: avatar.score,
        matchReasons: avatar.reason,
        isHosted: avatar.is_hosted,
        completionRate: avatar.completionRate,
        completedOrders: avatar.completedOrders,
        // 额外统计信息
        avgRating: Math.round(avgRating * 10) / 10,
        totalEarnings: Math.round(stats.totalEarnings),
        // 预估效果
        estimatedEffect: avatar.estimatedEffect,
        // 详细分析信息
        skillMatchScore: avatar.skillMatchScore,
        platformMatchScore: avatar.platformMatchScore,
        semanticSimilarity: avatar.semanticSimilarity,
        personalityFit: avatar.personalityFit,
        experienceMatch: avatar.experienceMatch,
        // 分身画像摘要
        avatarProfile: avatar.avatarProfile ? {
          expertise: avatar.avatarProfile.expertise,
          speakingStyle: avatar.avatarProfile.speakingStyle,
          platforms: avatar.avatarProfile.platforms
        } : undefined,
        // 订单分析摘要
        orderAnalysis: {
          coreRequirement: orderAnalysis.coreRequirement,
          category: orderAnalysis.category,
          requiredSkills: orderAnalysis.requiredSkills,
          complexityLevel: orderAnalysis.complexityLevel
        }
      }
    })
    
    console.log(`[智能匹配] 推荐完成，返回 ${result.length} 个分身`)
    console.log('[智能匹配] 评分详情:', result.slice(0, 3).map(a => ({
      name: a.name,
      score: a.score,
      reasons: a.matchReasons.slice(0, 2)
    })))
    
    return result
  }

  /**
   * 取消订单分配
   */
  async cancelDispatch(orderId: string, userId: string) {
    const client = getSupabaseClient()
    
    // 验证订单所有权
    const { data: order } = await client
      .from('orders')
      .select('user_id, avatar_id, status')
      .eq('id', orderId)
      .single()
    
    if (!order || order.user_id !== userId) {
      throw new Error('无权操作此订单')
    }
    
    if (order.status === 'completed') {
      throw new Error('已完成的订单无法取消')
    }
    
    // 重置订单状态
    await client
      .from('orders')
      .update({
        avatar_id: null,
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
    
    // 如果有待确认请求，标记为已取消
    await client
      .from('order_dispatch_requests')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId)
      .eq('status', 'pending')
    
    // 如果有已分配的分身，减少其订单计数
    if (order.avatar_id) {
      const { data: avatar } = await client
        .from('avatars')
        .select('total_orders')
        .eq('id', order.avatar_id)
        .single()
      
      await client
        .from('avatars')
        .update({
          total_orders: Math.max((avatar?.total_orders || 1) - 1, 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.avatar_id)
    }

    return true
  }

  /**
   * 自动生成订单内容（分配给分身后自动调用，使用分身技能）
   * @param orderId 订单ID
   * @param avatarId 分身ID
   * @param requestId 分配请求ID
   */
  async autoGenerateContent(orderId: string, avatarId: string, requestId: string) {
    console.log(`[自动内容生成] 开始生成订单 ${orderId} 的内容，分身 ${avatarId}，使用分身技能`)

    try {
      const client = getSupabaseClient()

      // 获取订单信息
      const { data: order } = await client
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (!order) {
        throw new Error('订单不存在')
      }

      // 获取分身信息
      const { data: avatar } = await client
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .single()

      if (!avatar) {
        throw new Error('分身不存在')
      }

      // 使用分身技能生成内容
      const generatedContents = await this.contentGenerationService.generateContent({
        orderId,
        requestId,
        avatarId,
        orderTitle: order.title,
        orderDescription: order.description,
        platforms: order.platforms || ['wechat_mp'],
        contentType: order.content_type || '文章',
        targetAudience: order.target_audience || '普通用户',
        avatarName: avatar.name,
        avatarPersonality: avatar.style
      })

      console.log(`[自动内容生成] 成功生成 ${generatedContents.length} 个平台的内容`)

      let generatedContent = {
        platform_count: generatedContents.length,
        contents: generatedContents
      }

      // 创建订单执行记录
      const { data: execution } = await client
        .from('order_executions')
        .insert({
          order_id: orderId,
          avatar_id: avatarId,
          step_number: 1,
          step_name: '内容生成',
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          result: {
            type: 'content_generation',
            generated: true,
            data: generatedContent
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      // 更新订单状态为"进行中"
      await client
        .from('orders')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      // 创建通知
      await this.notificationService.createNotification(avatar.user_id, {
        type: 'system',
        title: '内容生成完成',
        content: `您的分身 ${avatar.name} 已自动生成订单 "${order.title}" 的内容`,
        data: {
          orderId,
          avatarId,
          executionId: execution?.id,
          type: 'content_generated'
        }
      })

      // 如果有手机号，发送短信通知
      const { data: user } = await client
        .from('users')
        .select('phone')
        .eq('id', avatar.user_id)
        .single()

      if (user?.phone) {
        try {
          await this.smsService.sendContentGeneratedNotification(user.phone, avatar.name, orderId)
          console.log(`[自动内容生成] 已发送短信通知到 ${user.phone}`)
        } catch (error) {
          console.error(`[自动内容生成] 短信通知发送失败:`, error)
        }
      }

      console.log('[自动内容生成] 内容生成完成:', generatedContent)

      return {
        success: true,
        executionId: execution?.id,
        content: generatedContent
      }
    } catch (error) {
      console.error('[自动内容生成] 失败:', error)
      throw error
    }
  }
}
