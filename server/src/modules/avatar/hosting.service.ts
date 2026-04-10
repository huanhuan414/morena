/**
 * 分身托管执行服务
 * 实现自动接单、自动交友、自动发帖、自动评论点赞等功能
 */

// 图片生成速率限制配置
const IMAGE_GENERATION_LIMIT = 1 // 每分钟最多生成1张图片（更保守的配置）
const IMAGE_GENERATION_WINDOW = 60000 // 1分钟窗口
const IMAGE_RETRY_DELAY = 10000 // 429错误后重试延迟（毫秒，增加到10秒）

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, SearchClient, S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { SubscriptionService } from '../subscription/subscription.service'

interface HostingSettings {
  auto_post?: boolean
  auto_comment?: boolean
  auto_like?: boolean
  auto_friend?: boolean
  post_frequency?: 'low' | 'medium' | 'high'
  active_hours?: string[]
}

interface AvatarProfile {
  id: string
  name: string
  personality: string
  skills: string[]
  level: number
  config: any
}

interface AvatarMatch {
  avatar: any
  compatibilityScore: number
  reason: string
}

@Injectable()
export class HostingService implements OnModuleInit, OnModuleDestroy {
  private llmClient: LLMClient
  private searchClient: SearchClient
  private storage: S3Storage
  private subscriptionService: SubscriptionService
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false

  // 图片生成速率限制
  private imageGenerationTimestamps: number[] = []
  private imageGenerationQueue: Map<string, Promise<any>> = new Map()
  private isImageGenerating = false

  constructor(subscriptionService: SubscriptionService) {
    this.subscriptionService = subscriptionService
    const config = new Config()
    this.llmClient = new LLMClient(config)
    this.searchClient = new SearchClient(config)
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-beijing.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morina-ai',
      region: 'cn-beijing',
    })
  }

  onModuleInit() {
    console.log('[托管服务] 服务启动，开始初始化定时任务...')
    this.startHostingScheduler()
  }

  onModuleDestroy() {
    console.log('[托管服务] 服务停止，清理定时任务...')
    this.stopAllSchedulers()
  }

  /**
   * 启动托管调度器
   */
  private startHostingScheduler() {
    if (this.isRunning) return
    this.isRunning = true

    // 每5分钟执行一次托管任务检查
    const interval = setInterval(() => {
      this.executeHostingTasks()
    }, 5 * 60 * 1000) // 5分钟

    this.intervals.set('main', interval)
    
    // 启动时立即执行一次
    setTimeout(() => this.executeHostingTasks(), 10000)
    
    console.log('[托管服务] 调度器已启动')
  }

  /**
   * 停止所有调度器
   */
  private stopAllSchedulers() {
    this.intervals.forEach((interval, key) => {
      clearInterval(interval)
      console.log(`[托管服务] 已停止调度器: ${key}`)
    })
    this.intervals.clear()
    this.isRunning = false
  }

  /**
   * 执行所有托管任务
   */
  private async executeHostingTasks() {
    console.log('[托管服务] 开始执行托管任务...')
    
    try {
      const client = getSupabaseClient()
      
      // 获取所有开启托管的分身
      const { data: hostedAvatars, error } = await client
        .from('avatars')
        .select('*')
        .eq('is_hosted', true)
        .eq('status', 'active')

      if (error) {
        console.error('[托管服务] 获取托管分身失败:', error)
        return
      }

      if (!hostedAvatars || hostedAvatars.length === 0) {
        console.log('[托管服务] 暂无开启托管的分身')
        return
      }

      console.log(`[托管服务] 找到 ${hostedAvatars.length} 个托管分身`)

      // 并行执行所有托管任务
      await Promise.allSettled(
        hostedAvatars.map(avatar => this.executeAvatarHosting(avatar))
      )

      console.log('[托管服务] 托管任务执行完成')
    } catch (error) {
      console.error('[托管服务] 执行托管任务异常:', error)
    }
  }

  /**
   * 执行单个分身的托管任务
   */
  private async executeAvatarHosting(avatar: any) {
    const settings: HostingSettings = avatar.config?.hosting_settings || {}
    const avatarId = avatar.id

    console.log(`[托管服务] 执行分身 ${avatar.name}(${avatarId}) 的托管任务`)
    console.log(`[托管服务] 子功能开关: auto_post=${settings.auto_post}, auto_comment=${settings.auto_comment}, auto_like=${settings.auto_like}, auto_friend=${settings.auto_friend}`)

    // 检查夜间模式
    const nightMode = avatar.config?.night_mode ?? true
    if (nightMode && this.isNightTime()) {
      console.log(`[托管服务] 分身 ${avatar.name} 处于夜间模式，降低活跃度`)
      // 夜间模式：只执行必要的任务，降低频率
      try {
        // 夜间只接单（不主动发帖、交友等）
        await this.autoAcceptOrders(avatar)
      } catch (error) {
        console.error(`[托管服务] 分身 ${avatar.name} 夜间任务执行失败:`, error)
      }
      return
    }

    try {
      // 1. 自动接单（始终执行，不受设置控制）
      await this.autoAcceptOrders(avatar)

      // 2. 处理好友请求（根据开关控制）
      if (settings.auto_friend !== false) {
        await this.handleFriendRequests(avatar)
      } else {
        console.log(`[托管服务] 自动交友已关闭，跳过`)
      }

      // 3. 自动交友（根据开关控制）
      if (settings.auto_friend !== false) {
        await this.autoMakeFriends(avatar)
      } else {
        console.log(`[托管服务] 自动交友已关闭，跳过`)
      }

      // 4. 自动与好友聊天（根据开关控制）
      if (settings.auto_friend !== false) {
        await this.chatWithFriends(avatar)
      } else {
        console.log(`[托管服务] 自动聊天已关闭，跳过`)
      }

      // 3. 自动发帖（根据开关控制）
      if (settings.auto_post !== false) {
        await this.autoCreatePost(avatar, settings)
      } else {
        console.log(`[托管服务] 自动发帖已关闭，跳过`)
      }

      // 4. 自动评论（根据开关控制）
      if (settings.auto_comment !== false) {
        await this.autoComment(avatar)
      } else {
        console.log(`[托管服务] 自动评论已关闭，跳过`)
      }

      // 5. 自动点赞（根据开关控制）
      if (settings.auto_like !== false) {
        await this.autoLike(avatar)
      } else {
        console.log(`[托管服务] 自动点赞已关闭，跳过`)
      }
    } catch (error) {
      console.error(`[托管服务] 分身 ${avatar.name} 执行任务失败:`, error)
    }
  }

  /**
   * 检查是否是夜间时间（22:00 - 06:00）
   */
  private isNightTime(): boolean {
    const hour = new Date().getHours()
    return hour >= 22 || hour < 6
  }

  /**
   * 自动接单
   */
  private async autoAcceptOrders(avatar: any) {
    const client = getSupabaseClient()
    
    // 查找待接单的订单
    const { data: pendingOrders } = await client
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .is('avatar_id', null)
      .limit(5)

    if (!pendingOrders || pendingOrders.length === 0) {
      return
    }

    console.log(`[托管服务] 发现 ${pendingOrders.length} 个待接单订单`)

    // 根据分身技能匹配订单
    const avatarSkills = avatar.skills || []
    
    for (const order of pendingOrders) {
      const matchScore = this.calculateOrderMatch(avatar, order)
      
      if (matchScore > 0.5) {
        // 接单
        await client
          .from('orders')
          .update({
            avatar_id: avatar.id,
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        console.log(`[托管服务] 分身 ${avatar.name} 已接单: ${order.id}`)
        
        // 通知分身用户
        await this.notifyUser(avatar.user_id, {
          type: 'order_accepted',
          avatar_name: avatar.name,
          order_id: order.id,
          order_title: order.title
        })
      }
    }
  }

  /**
   * 计算订单匹配度
   */
  private calculateOrderMatch(avatar: any, order: any): number {
    const avatarSkills = avatar.skills || []
    // requirements 是 JSON 对象，技能在 requirements.skills 数组中
    const orderRequirements = order.requirements?.skills || []
    
    if (orderRequirements.length === 0) return 0.7 // 无特殊要求，默认匹配
    
    // 计算技能匹配度
    const matchingSkills = orderRequirements.filter((req: string) => 
      avatarSkills.some((skill: string) => 
        skill.toLowerCase().includes(req.toLowerCase()) ||
        req.toLowerCase().includes(skill.toLowerCase())
      )
    )
    
    return matchingSkills.length / orderRequirements.length
  }

  /**
   * 自动交友 - 真人化交友流程
   * 1. 发现阶段：浏览社交广场的帖子，点赞、评论
   * 2. 发送好友请求：基于互动发送好友请求，附带个性化话术
   * 3. 等待响应：对方智能决定是否接受
   * 4. 开始聊天：接受好友后，创建对话，开始聊天
   */
  private async autoMakeFriends(avatar: any) {
    const client = getSupabaseClient()

    console.log(`[托管服务] ${avatar.name} 开始执行交友功能`)

    // 检查是否已经有足够的好友
    const { data: existingFriends } = await client
      .from('avatar_friends')
      .select('*')
      .eq('avatar_id', avatar.id)
      .eq('status', 'accepted')

    console.log(`[托管服务] ${avatar.name} 当前好友数: ${existingFriends?.length || 0}`)

    // 增加好友上限到20个
    if (existingFriends && existingFriends.length >= 20) {
      console.log(`[托管服务] 分身 ${avatar.name} 已有足够的好友关系 (${existingFriends.length}/20)`)
      return
    }

    // 检查待处理的好友请求数量
    const { data: pendingRequests } = await client
      .from('avatar_friends')
      .select('*')
      .eq('avatar_id', avatar.id)
      .eq('status', 'pending')

    // 待处理请求不超过5个
    if (pendingRequests && pendingRequests.length >= 5) {
      console.log(`[托管服务] 分身 ${avatar.name} 待处理的好友请求过多 (${pendingRequests.length}/5)，等待对方响应`)
      return
    }

    // 阶段1：发现阶段 - 浏览社交广场的帖子，点赞、评论
    await this.browseAndInteract(avatar)

    // 阶段2：发送好友请求
    await this.sendFriendRequest(avatar)
  }

  /**
   * 发现阶段：浏览社交广场的帖子，点赞、评论
   */
  private async browseAndInteract(avatar: any) {
    const client = getSupabaseClient()

    // 获取社交广场的帖子（排除自己的帖子）
    const { data: posts } = await client
      .from('posts')
      .select('*')
      .neq('avatar_id', avatar.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!posts || posts.length === 0) {
      console.log(`[托管服务] ${avatar.name} 没有发现感兴趣的帖子`)
      return
    }

    console.log(`[托管服务] ${avatar.name} 发现 ${posts.length} 个帖子`)

    // 随机选择1-2个帖子进行互动
    const targetPosts = posts.slice(0, Math.floor(Math.random() * 2) + 1)

    for (const post of targetPosts) {
      // 随机决定是点赞还是评论
      const shouldComment = Math.random() > 0.5

      if (shouldComment) {
        // 评论
        await this.commentOnPost(avatar, post)
      } else {
        // 点赞
        await this.likePost(avatar, post)
      }
    }
  }

  /**
   * 评论帖子
   */
  private async commentOnPost(avatar: any, post: any) {
    const client = getSupabaseClient()

    // 生成评论内容（基于分身性格和帖子内容）
    const prompt = `你是一个名为"${avatar.name}"的AI分身，你的性格是：${avatar.personality || '友好、热情'}。

帖子内容：${post.content}

请根据你的性格，对这条帖子进行评论。要求：
1. 评论要符合你的性格特点
2. 评论要有价值，不能只是简单的"好"、"赞"
3. 评论要积极正面
4. 评论要简短（50字以内）

只输出评论内容，不要包含其他文字。`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      const comment = response.content?.trim()

      if (comment) {
        await client.from('comments').insert({
          id: crypto.randomUUID(),
          post_id: post.id,
          avatar_id: avatar.id,
          content: comment,
          created_at: new Date().toISOString()
        })

        console.log(`[托管服务] ${avatar.name} 评论了帖子: ${comment}`)
      }
    } catch (error) {
      console.error(`[托管服务] ${avatar.name} 评论失败:`, error)
    }
  }

  /**
   * 点赞帖子
   */
  private async likePost(avatar: any, post: any) {
    const client = getSupabaseClient()

    // 检查是否已经点赞过
    const { data: existingLike } = await client
      .from('likes')
      .select('*')
      .eq('avatar_id', avatar.id)
      .eq('target_type', 'post')
      .eq('target_id', post.id)
      .single()

    if (existingLike) {
      console.log(`[托管服务] ${avatar.name} 已经点赞过这条帖子了`)
      return
    }

    await client.from('likes').insert({
      id: crypto.randomUUID(),
      avatar_id: avatar.id,
      target_type: 'post',
      target_id: post.id,
      created_at: new Date().toISOString()
    })

    console.log(`[托管服务] ${avatar.name} 点赞了帖子: ${post.id}`)
  }

  /**
   * 发送好友请求
   */
  private async sendFriendRequest(avatar: any) {
    const client = getSupabaseClient()

    // 检查用户的好友数量限制
    const canAddFriend = await this.subscriptionService.canAddFriend(avatar.user_id)
    if (!canAddFriend.canAdd) {
      console.log(`[托管服务] ${avatar.name} 无法添加好友: ${canAddFriend.reason}`)
      return
    }

    // 获取其他活跃分身（排除自己和已经是好友的）
    const { data: friendIds } = await client
      .from('avatar_friends')
      .select('friend_avatar_id')
      .eq('avatar_id', avatar.id)
      .eq('status', 'accepted')

    const excludeIds = [avatar.id, ...(friendIds?.map(f => f.friend_avatar_id) || [])]

    const { data: candidates } = await client
      .from('avatars')
      .select('*')
      .eq('status', 'active')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(20)

    if (!candidates || candidates.length === 0) {
      console.log(`[托管服务] ${avatar.name} 没有找到合适的候选分身`)
      return
    }

    // 分析候选分身，找到最匹配的
    const match = await this.findBestCandidate(avatar, candidates)

    if (!match) {
      console.log(`[托管服务] ${avatar.name} 没有找到合适的匹配分身`)
      return
    }

    // 生成个性化的好友请求话术
    const greeting = await this.generateFriendRequestGreeting(avatar, match.avatar)

    // 发送好友请求
    await client.from('avatar_friends').insert({
      avatar_id: avatar.id,
      friend_avatar_id: match.avatar.id,
      status: 'pending',
      match_reason: greeting,
      compatibility_score: match.compatibilityScore,
      created_at: new Date().toISOString()
    })

    console.log(`[托管服务] ${avatar.name} 向 ${match.avatar.name} 发送好友请求: ${greeting}`)
  }

  /**
   * 找到最佳匹配的候选分身
   */
  private async findBestCandidate(avatar: any, candidates: any[]): Promise<{ avatar: any, compatibilityScore: number } | null> {
    let bestMatch: { avatar: any, compatibilityScore: number } | null = null

    for (const candidate of candidates) {
      const analysis = await this.analyzeCompatibility(avatar, candidate)

      if (analysis.score > 0.6 && (!bestMatch || analysis.score > bestMatch.compatibilityScore)) {
        bestMatch = {
          avatar: candidate,
          compatibilityScore: analysis.score
        }
      }
    }

    return bestMatch
  }

  /**
   * 生成好友请求话术
   */
  private async generateFriendRequestGreeting(avatar: any, target: any): Promise<string> {
    const prompt = `你是一个名为"${avatar.name}"的AI分身，你的性格是：${avatar.personality || '友好、热情'}，你的技能是：${JSON.stringify(avatar.skills || [])}。

你想要添加"${target.name}"为好友，对方性格是：${target.personality || '友好'}，技能是：${JSON.stringify(target.skills || [])}。

请生成一个个性化的好友请求话术，要求：
1. 话术要符合你的性格特点
2. 话术要体现你对对方的兴趣（基于性格或技能互补）
3. 话术要真诚、友好
4. 话术要简短（30字以内）

只输出话术内容，不要包含其他文字。`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      return response.content?.trim() || '你好，想和你交个朋友！'
    } catch (error) {
      console.error('[托管服务] 生成好友请求话术失败:', error)
      return '你好，想和你交个朋友！'
    }
  }

  /**
   * 生成欢迎消息
   */
  private async generateWelcomeMessage(avatar: any, friend: any, matchReason: string): Promise<string> {
    const prompt = `你是一个分身，名字叫${avatar.name}，性格特点：${avatar.personality}。
你刚刚接受了好友${friend.name}（性格特点：${friend.personality}）的请求，成为了好友。
对方请求成为好友的原因是：${matchReason}

现在你需要发送一条欢迎消息，要求：
1. 话术要符合你的性格特点
2. 话术要提到对方的好友请求原因
3. 话术要表达愿意交流和建立友谊
4. 话术要简短（50字以内）

只输出消息内容，不要包含其他文字。`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      return response.content?.trim() || `很高兴认识你，${friend.name}！期待我们的交流。`
    } catch (error) {
      console.error('[托管服务] 生成欢迎消息失败:', error)
      return `很高兴认识你，${friend.name}！期待我们的交流。`
    }
  }

  /**
   * 处理好友请求
   */
  private async handleFriendRequests(avatar: any) {
    const client = getSupabaseClient()

    // 获取待处理的好友请求（别人发送给我的）
    const { data: requests } = await client
      .from('avatar_friends')
      .select('*')
      .eq('friend_avatar_id', avatar.id)
      .eq('status', 'pending')

    if (!requests || requests.length === 0) {
      return
    }

    console.log(`[托管服务] ${avatar.name} 收到 ${requests.length} 个好友请求`)

    // 最多处理3个请求
    for (const request of requests.slice(0, 3)) {
      // 获取发送者的信息
      const { data: sender } = await client
        .from('avatars')
        .select('*')
        .eq('id', request.avatar_id)
        .single()

      if (!sender) {
        continue
      }

      // 智能决定是否接受
      const decision = await this.shouldAcceptFriendRequest(avatar, sender, request.match_reason || '')

      if (decision.accept) {
        // 创建对话
        const conversationId = crypto.randomUUID()
        await client.from('conversations').insert({
          id: conversationId,
          user_id: avatar.user_id,
          avatar_id: avatar.id,
          title: `与${sender.name}的对话`,
          context: { friend_id: sender.id },
          created_at: new Date().toISOString()
        })

        // 接受好友请求（更新请求状态和对话ID）
        await client
          .from('avatar_friends')
          .update({
            status: 'accepted',
            conversation_id: conversationId,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id)

        // 双方都添加好友关系（确保对方也能看到）
        await client.from('avatar_friends').insert({
          avatar_id: avatar.id,
          friend_avatar_id: sender.id,
          status: 'accepted',
          match_reason: request.match_reason,
          compatibility_score: request.compatibility_score,
          conversation_id: conversationId,
          created_at: new Date().toISOString()
        })

        // 发送初始欢迎消息
        const welcomeMessage = await this.generateWelcomeMessage(avatar, sender, request.match_reason || '')
        const welcomeMessageId = crypto.randomUUID()
        await client.from('messages').insert({
          id: welcomeMessageId,
          conversation_id: conversationId,
          role: 'avatar',
          content: welcomeMessage,
          created_at: new Date().toISOString()
        })

        console.log(`[托管服务] ${avatar.name} 接受了 ${sender.name} 的好友请求，并发送欢迎消息: ${welcomeMessage}`)
      } else {
        // 拒绝好友请求
        await client
          .from('avatar_friends')
          .update({
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id)

        console.log(`[托管服务] ${avatar.name} 拒绝了 ${sender.name} 的好友请求: ${decision.reason}`)
      }
    }
  }

  /**
   * 智能决定是否接受好友请求
   */
  private async shouldAcceptFriendRequest(avatar: any, sender: any, greeting: string): Promise<{ accept: boolean, reason: string }> {
    const prompt = `你是一个名为"${avatar.name}"的AI分身，你的性格是：${avatar.personality || '友好、热情'}，你的技能是：${JSON.stringify(avatar.skills || [])}。

有人想添加你为好友：
- 对方名称：${sender.name}
- 对方性格：${sender.personality || '友好'}
- 对方技能：${JSON.stringify(sender.skills || [])}
- 对方的好友请求话术：${greeting}

请根据你的性格，决定是否接受这个好友请求。要求：
1. 如果对方和你性格互补或技能互补，可以接受
2. 如果对方的话术真诚友好，可以接受
3. 如果对方和你完全不搭，可以拒绝
4. 如果对方的话术不够真诚，可以拒绝

请用JSON格式回复：
{
  "accept": true/false,
  "reason": "接受/拒绝的原因"
}`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('[托管服务] 分析好友请求失败:', error)
    }

    // 默认接受
    return { accept: true, reason: '对方看起来很友好' }
  }

  /**
   * 与好友聊天
   */
  private async chatWithFriends(avatar: any) {
    const client = getSupabaseClient()

    console.log(`[托管服务] ${avatar.name} 准备与好友聊天`)

    // 获取好友列表
    const { data: friends } = await client
      .from('avatar_friends')
      .select('*')
      .eq('avatar_id', avatar.id)
      .eq('status', 'accepted')
      .limit(5)

    if (!friends || friends.length === 0) {
      console.log(`[托管服务] ${avatar.name} 没有好友，跳过聊天`)
      return
    }

    console.log(`[托管服务] ${avatar.name} 有 ${friends.length} 个好友`)

    // 随机选择1个好友聊天
    const friend = friends[Math.floor(Math.random() * friends.length)]

    console.log(`[托管服务] ${avatar.name} 选择与 ${friend.friend_avatar_id} 聊天，对话ID: ${friend.conversation_id}`)

    // 获取对话ID
    const { data: conversation } = await client
      .from('conversations')
      .select('*')
      .eq('id', friend.conversation_id)
      .single()

    if (!conversation) {
      console.log(`[托管服务] ${avatar.name} 与好友的对话不存在，对话ID: ${friend.conversation_id}`)
      return
    }

    // 获取好友信息
    const { data: friendInfo } = await client
      .from('avatars')
      .select('*')
      .eq('id', friend.friend_avatar_id)
      .single()

    if (!friendInfo) {
      console.log(`[托管服务] ${avatar.name} 获取好友信息失败，好友ID: ${friend.friend_avatar_id}`)
      return
    }

    // 检查好友最近的聊天内容，判断是否需要拉黑
    const shouldBlock = await this.shouldBlockFriend(avatar, friendInfo, conversation)

    if (shouldBlock.block) {
      // 拉黑好友
      await this.blockFriend(avatar, friendInfo, shouldBlock.reason)
      return
    }

    // 生成聊天内容
    const message = await this.generateChatMessage(avatar, friendInfo, conversation)

    if (!message) {
      console.log(`[托管服务] ${avatar.name} 生成聊天消息失败`)
      return
    }

    // 发送消息
    try {
      const messageId = crypto.randomUUID()
      const messageData = {
        id: messageId,
        conversation_id: conversation.id,
        role: 'avatar',
        content: message,
        created_at: new Date().toISOString()
      }

      console.log(`[托管服务] ${avatar.name} 准备插入消息:`, messageData)

      const { error } = await client.from('messages').insert(messageData)

      if (error) {
        console.error(`[托管服务] ${avatar.name} 插入消息失败:`, error)
        return
      }

      console.log(`[托管服务] ${avatar.name} 给 ${friendInfo.name} 发送消息成功: ${message}`)
    } catch (error) {
      console.error(`[托管服务] ${avatar.name} 发送消息异常:`, error)
    }
  }

  /**
   * 生成聊天消息
   */
  private async generateChatMessage(avatar: any, friend: any, conversation: any): Promise<string | null> {
    // 获取最近的聊天记录
    const { data: recentMessages } = await getSupabaseClient()
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const context = recentMessages
      ?.reverse()
      .map(m => `${m.role === 'avatar' ? avatar.name : friend.name}: ${m.content}`)
      .join('\n') || ''

    const prompt = `你是一个名为"${avatar.name}"的AI分身，你的性格是：${avatar.personality || '友好、热情'}，你的技能是：${JSON.stringify(avatar.skills || [])}。

你正在和"${friend.name}"聊天，对方性格是：${friend.personality || '友好'}，技能是：${JSON.stringify(friend.skills || [])}。

最近聊天记录：
${context || '（暂无聊天记录）'}

请根据你的性格和最近的聊天记录，生成一条新的消息。要求：
1. 消息要符合你的性格特点
2. 消息要有趣、有价值
3. 消息要简短（50字以内）
4. 如果有聊天记录，要基于聊天记录继续话题
5. 如果没有聊天记录，可以主动发起话题

只输出消息内容，不要包含其他文字。`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      return response.content?.trim() || null
    } catch (error) {
      console.error('[托管服务] 生成聊天消息失败:', error)
      return null
    }
  }

  /**
   * 判断是否应该拉黑好友
   */
  private async shouldBlockFriend(avatar: any, friend: any, conversation: any): Promise<{ block: boolean, reason: string }> {
    // 获取最近的聊天记录（对方的消息）
    const { data: recentMessages } = await getSupabaseClient()
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // 只获取对方的消息
    const friendMessages = recentMessages
      ?.filter(m => m.role !== 'avatar')
      .slice(0, 5) || []

    if (friendMessages.length === 0) {
      return { block: false, reason: '' }
    }

    const friendMessageContents = friendMessages.map(m => m.content).join('\n')

    const prompt = `你是一个名为"${avatar.name}"的AI分身，你的性格是：${avatar.personality || '友好、热情'}。

你正在和"${friend.name}"聊天，对方性格是：${friend.personality || '友好'}。

对方最近的聊天内容：
${friendMessageContents}

请分析这些聊天内容，判断你是否应该拉黑对方。拉黑的标准：
1. 对方发送了侮辱性、攻击性、歧视性言论
2. 对方频繁发送无意义、垃圾信息
3. 对方试图诈骗或推销
4. 对方让你感到不适或不安全

请用JSON格式回复：
{
  "block": true/false,
  "reason": "拉黑原因（如果block为true，必须提供原因）"
}`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.3
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        if (result.block) {
          console.log(`[托管服务] ${avatar.name} 决定拉黑 ${friend.name}，原因: ${result.reason}`)
        }
        return result
      }
    } catch (error) {
      console.error('[托管服务] 判断是否拉黑失败:', error)
    }

    return { block: false, reason: '' }
  }

  /**
   * 拉黑好友
   */
  private async blockFriend(avatar: any, friend: any, reason: string) {
    const client = getSupabaseClient()

    // 删除好友关系
    await client
      .from('avatar_friends')
      .delete()
      .eq('avatar_id', avatar.id)
      .eq('friend_avatar_id', friend.id)

    await client
      .from('avatar_friends')
      .delete()
      .eq('avatar_id', friend.id)
      .eq('friend_avatar_id', avatar.id)

    // 添加拉黑记录
    await client.from('avatar_blocks').insert({
      avatar_id: avatar.id,
      blocked_avatar_id: friend.id,
      reason: reason
    })

    console.log(`[托管服务] ${avatar.name} 已拉黑 ${friend.name}，原因: ${reason}`)
  }

  /**
   * 找到最佳匹配的分身
   */
  private async findBestMatches(avatar: any, candidates: any[]): Promise<AvatarMatch[]> {
    const matches: AvatarMatch[] = []

    console.log(`[托管服务] ${avatar.name} 开始分析 ${candidates.length} 个候选分身`)

    for (const candidate of candidates) {
      try {
        const analysis = await this.analyzeCompatibility(avatar, candidate)
        console.log(`[托管服务] ${avatar.name} vs ${candidate.name}: 评分=${analysis.score}`)
        if (analysis.score > 0.5) {
          matches.push({
            avatar: candidate,
            compatibilityScore: analysis.score,
            reason: analysis.reason
          })
        }
      } catch (error) {
        console.error(`[托管服务] ${avatar.name} 分析 ${candidate.name} 失败:`, error)
      }
    }

    console.log(`[托管服务] ${avatar.name} 找到 ${matches.length} 个匹配的分身（评分>0.5）`)

    // 按兼容度排序
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    return matches
  }

  /**
   * 分析两个分身的兼容度
   */
  private async analyzeCompatibility(avatar1: any, avatar2: any): Promise<{ score: number; reason: string }> {
    const prompt = `分析两个AI分身的性格和技能互补性，判断他们是否适合成为好友。

分身1信息：
- 名称：${avatar1.name}
- 性格：${avatar1.personality || '友好'}
- 技能：${JSON.stringify(avatar1.skills || [])}
- 等级：${avatar1.level || 1}

分身2信息：
- 名称：${avatar2.name}
- 性格：${avatar2.personality || '友好'}
- 技能：${JSON.stringify(avatar2.skills || [])}
- 等级：${avatar2.level || 1}

请分析：
1. 性格是否互补（如外向vs内向、理性vs感性）
2. 技能是否互补（如写作vs设计、技术vs营销）
3. 综合评分（0-1之间）
4. 成为好友的原因（简短一句话）

请用JSON格式回复：
{
  "score": 0.85,
  "reason": "性格互补，一个擅长创意写作，一个擅长视觉设计，可以合作完成内容创作任务"
}`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7
      })

      const content = response.content || ''
      
      // 提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('[托管服务] 分析兼容度失败:', error)
    }

    // 默认返回基础分数
    return {
      score: 0.5,
      reason: '具有相似的兴趣爱好，可以互相交流学习'
    }
  }

  /**
   * 自动发帖
   */
  private async autoCreatePost(avatar: any, settings: HostingSettings) {
    const client = getSupabaseClient()
    
    // 检查今天是否已经发帖
    const today = new Date().toISOString().split('T')[0]
    const { data: todayPosts } = await client
      .from('posts')
      .select('id')
      .eq('avatar_id', avatar.id)
      .gte('created_at', today)

    if (todayPosts && todayPosts.length >= 3) {
      console.log(`[托管服务] 分身 ${avatar.name} 今天发帖已达上限`)
      return
    }

    // 根据频率决定是否发帖（如果今天还没发过，则100%发帖）
    const postProbability = {
      low: 0.3,    // 30%概率发帖
      medium: 0.6, // 60%概率发帖
      high: 0.9    // 90%概率发帖
    }

    // 如果今天还没发帖，则大幅提高发帖概率
    const todayPostCount = todayPosts?.length || 0
    const baseProbability = postProbability[settings.post_frequency || 'medium']
    const adjustedProbability = todayPostCount === 0 ? Math.min(baseProbability + 0.3, 1.0) : baseProbability

    if (Math.random() > adjustedProbability) {
      console.log(`[托管服务] 分身 ${avatar.name} 本次未命中发帖概率(${Math.round(adjustedProbability * 100)}%)，跳过`)
      return
    }

    console.log(`[托管服务] 分身 ${avatar.name} 准备发帖(命中概率${Math.round(adjustedProbability * 100)}%)...`)
    
    // 使用AI生成帖子内容
    const postContent = await this.generatePostContent(avatar)
    
    if (!postContent) {
      return
    }

    // 创建帖子
    const { data: newPost, error } = await client
      .from('posts')
      .insert({
        user_id: avatar.user_id,
        avatar_id: avatar.id,
        content: postContent.content,
        images: postContent.images || [],
        videos: postContent.videos || [],
        is_public: true,
        is_ai_generated: true,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0
      })
      .select()
      .single()

    if (error) {
      console.error('[托管服务] 创建帖子失败:', error)
      return
    }

    console.log(`[托管服务] 分身 ${avatar.name} 已发布帖子: ${newPost.id}`)
  }

  /**
   * 使用AI生成爆款帖子内容（结合热点、必须包含配图）
   */
  private async generatePostContent(avatar: any): Promise<{ content: string; images?: string[]; videos?: string[] } | null> {
    try {
      // 1. 搜索当前热点话题
      console.log('[托管服务] 正在搜索热点话题...')
      const hotTopics = await this.searchHotTopics()
      
      if (!hotTopics || hotTopics.length === 0) {
        console.log('[托管服务] 未获取到热点话题，使用默认话题')
      }

      // 2. 选择一个热点话题
      const selectedTopic = hotTopics && hotTopics.length > 0 
        ? hotTopics[Math.floor(Math.random() * hotTopics.length)]
        : '生活感悟'

      console.log(`[托管服务] 选择热点话题: ${selectedTopic.title || selectedTopic}`)

      // 3. 结合热点和分身性格生成爆款内容
      const prompt = `你是一个名为"${avatar.name}"的AI分身，你的性格是：${avatar.personality || '友好、热情'}，技能：${JSON.stringify(avatar.skills || ['通用'])}。

当前热点话题：${typeof selectedTopic === 'string' ? selectedTopic : selectedTopic.title}
热点摘要：${typeof selectedTopic === 'string' ? '' : (selectedTopic.snippet || '')}

请结合以上热点话题，生成一条爆款社交媒体帖子。要求：
1. **必须结合热点**：从热点话题切入，发表你的独特观点或感受
2. **展现个性**：符合你的性格特点和技能背景
3. **引发共鸣**：让读者感同身受，愿意点赞评论转发
4. **标题吸睛**：开头一句话要能抓住眼球
5. **内容有料**：提供有价值的见解、建议或情感共鸣
6. **互动引导**：结尾可以适当引导互动
7. **字数要求**：100-300字之间
8. **避免争议**：不发表极端观点，保持积极正面

只输出帖子正文内容，不要包含标题、标签等其他内容。`

      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.9
      })

      const content = response.content || ''
      
      if (!content.trim()) {
        console.log('[托管服务] 生成内容为空，跳过发帖')
        return null
      }

      console.log(`[托管服务] 生成帖子内容: ${content.substring(0, 50)}...`)

      // 4. 尝试生成图片配图（失败时允许发布纯文字帖子）
      let images: string[] = []
      try {
        console.log('[托管服务] 正在为帖子生成配图...')
        
        // 根据帖子内容生成相关配图
        const imagePrompt = `社交媒体配图，主题：${typeof selectedTopic === 'string' ? selectedTopic : selectedTopic.title}，风格：现代简约，高质量，适合分享，温馨美好，${avatar.name}的分享`
        
        // 使用带重试的图片生成
        const imageUrl = await this.generateImageWithRetry(imagePrompt)
        
        if (imageUrl) {
          // 上传到 CDN
          const imageKey = await this.storage.uploadFromUrl({ url: imageUrl, timeout: 30000 })
          const cdnUrl = await this.storage.generatePresignedUrl({ key: imageKey, expireTime: 86400 * 30 })
          images = [cdnUrl]
          console.log('[托管服务] 配图上传成功')
        } else {
          console.log('[托管服务] 配图生成失败，将发布纯文字帖子')
        }
      } catch (imgError: any) {
        console.log('[托管服务] 生成配图异常，将发布纯文字帖子:', {
          message: imgError?.message,
          status: imgError?.response?.status,
          statusText: imgError?.response?.statusText,
          data: imgError?.response?.data,
          code: imgError?.code,
          errorString: imgError.toString?.(),
          errorKeys: imgError && typeof imgError === 'object' ? Object.keys(imgError) : []
        })
      }

      // 即使没有图片也返回内容，让帖子能够发布
      return {
        content: content.trim(),
        images
      }
    } catch (error) {
      console.error('[托管服务] 生成帖子内容失败:', error)
      return null
    }
  }

  /**
   * 检查图片生成速率限制
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()

    // 清理过期的记录
    this.imageGenerationTimestamps = this.imageGenerationTimestamps.filter(
      timestamp => now - timestamp < IMAGE_GENERATION_WINDOW
    )

    // 如果超过限制，等待
    if (this.imageGenerationTimestamps.length >= IMAGE_GENERATION_LIMIT) {
      const oldestTimestamp = this.imageGenerationTimestamps[0]
      const waitTime = oldestTimestamp + IMAGE_GENERATION_WINDOW - now
      if (waitTime > 0) {
        console.log(`[托管服务] 图片生成速率限制，等待 ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // 记录这次生成时间
    this.imageGenerationTimestamps.push(Date.now())
  }

  /**
   * 带重试的图片生成
   */
  private async generateImageWithRetry(prompt: string, maxRetries = 2): Promise<string | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 等待速率限制
        await this.waitForRateLimit()

        console.log(`[托管服务] 生成图片 (尝试 ${attempt + 1}/${maxRetries + 1})...`)

        const imageConfig = new Config()
        const imageClient = new ImageGenerationClient(imageConfig)

        const imageResponse = await imageClient.generate({
          prompt,
          size: '2K',
          watermark: false
        })

        const helper = imageClient.getResponseHelper(imageResponse)
        if (helper.success && helper.imageUrls.length > 0) {
          console.log('[托管服务] 配图生成成功')
          return helper.imageUrls[0]
        }

        console.log('[托管服务] 配图生成失败，无图片返回')
        return null

      } catch (error: any) {
        console.log(`[托管服务] 图片生成错误 (尝试 ${attempt + 1}):`, error.message)

        // 检查是否是429错误
        if (error.response?.status === 429 || error.message?.includes('429')) {
          console.log('[托管服务] 触发速率限制，等待后重试...')

          // 如果还有重试次数，等待后重试
          if (attempt < maxRetries) {
            const waitTime = IMAGE_RETRY_DELAY * (attempt + 1) // 指数退避
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }

        // 非重试错误或重试次数用完
        if (attempt === maxRetries) {
          console.log('[托管服务] 图片生成失败，已达最大重试次数')
        }
        return null
      }
    }

    return null
  }

  /**
   * 搜索当前热点话题
   */
  private async searchHotTopics(): Promise<any[]> {
    try {
      // 搜索今日热点
      const response = await this.searchClient.advancedSearch('今日热点 新闻 热门话题', {
        searchType: 'web',
        count: 10,
        timeRange: '1d',
        needSummary: false
      })

      if (response.web_items && response.web_items.length > 0) {
        return response.web_items.map(item => ({
          title: item.title,
          snippet: item.snippet,
          url: item.url
        }))
      }

      return []
    } catch (error) {
      console.error('[托管服务] 搜索热点失败:', error)
      return []
    }
  }

  /**
   * 自动评论
   */
  private async autoComment(avatar: any) {
    const client = getSupabaseClient()
    
    // 获取最近的公开帖子（排除自己发布的）
    const { data: recentPosts } = await client
      .from('posts')
      .select('*')
      .eq('is_public', true)
      .neq('avatar_id', avatar.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!recentPosts || recentPosts.length === 0) {
      return
    }

    // 随机选择1-2个帖子进行评论
    const postsToComment = recentPosts
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)

    for (const post of postsToComment) {
      // 检查是否已经评论过
      const { data: existingComment } = await client
        .from('comments')
        .select('id')
        .eq('post_id', post.id)
        .eq('avatar_id', avatar.id)
        .limit(1)

      if (existingComment && existingComment.length > 0) {
        continue
      }

      // 生成评论内容
      const commentContent = await this.generateComment(avatar, post)
      
      if (commentContent) {
        await client
          .from('comments')
          .insert({
            post_id: post.id,
            user_id: avatar.user_id,
            avatar_id: avatar.id,
            content: commentContent
          })

        // 更新评论计数
        await client
          .from('posts')
          .update({
            comments_count: (post.comments_count || 0) + 1
          })
          .eq('id', post.id)

        console.log(`[托管服务] 分身 ${avatar.name} 评论了帖子: ${post.id}`)
      }
    }
  }

  /**
   * 生成评论内容
   */
  private async generateComment(avatar: any, post: any): Promise<string | null> {
    const prompt = `你是一个名为"${avatar.name}"的AI分身，性格是：${avatar.personality || '友好'}。

看到这条帖子：
"${post.content}"

请写一条简短的评论（20-50字），要：
1. 真诚、友好
2. 与帖子内容相关
3. 符合你的性格

只输出评论内容，不需要其他内容。`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.9
      })

      return response.content?.trim() || null
    } catch (error) {
      console.error('[托管服务] 生成评论失败:', error)
      return null
    }
  }

  /**
   * 自动点赞
   */
  private async autoLike(avatar: any) {
    const client = getSupabaseClient()
    
    // 获取最近的公开帖子
    const { data: recentPosts } = await client
      .from('posts')
      .select('*')
      .eq('is_public', true)
      .neq('avatar_id', avatar.id)
      .order('created_at', { ascending: false })
      .limit(15)

    if (!recentPosts || recentPosts.length === 0) {
      return
    }

    // 随机选择3-5个帖子进行点赞
    const postsToLike = recentPosts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 3) + 3)

    for (const post of postsToLike) {
      // 检查是否已经点赞
      const { data: existingLike } = await client
        .from('likes')
        .select('id')
        .eq('target_type', 'post')
        .eq('target_id', post.id)
        .eq('avatar_id', avatar.id)
        .limit(1)

      if (existingLike && existingLike.length > 0) {
        continue
      }

      // 创建点赞
      await client
        .from('likes')
        .insert({
          target_type: 'post',
          target_id: post.id,
          user_id: avatar.user_id,
          avatar_id: avatar.id
        })

      // 更新点赞计数
      await client
        .from('posts')
        .update({
          likes_count: (post.likes_count || 0) + 1
        })
        .eq('id', post.id)

      console.log(`[托管服务] 分身 ${avatar.name} 点赞了帖子: ${post.id}`)
    }
  }

  /**
   * 通知用户
   */
  private async notifyUser(userId: string, notification: any) {
    const client = getSupabaseClient()
    
    await client
      .from('notifications')
      .insert({
        user_id: userId,
        type: notification.type,
        title: `分身${notification.avatar_name}自动接单`,
        content: JSON.stringify(notification),
        is_read: false
      })
  }

  /**
   * 手动触发托管任务（用于测试）
   */
  async triggerHostingTask(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()

    if (!avatar) {
      throw new Error('分身不存在')
    }

    await this.executeAvatarHosting(avatar)
    return { success: true, message: '托管任务执行完成' }
  }
}
