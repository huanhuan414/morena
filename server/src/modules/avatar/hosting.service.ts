/**
 * 分身托管执行服务
 * 实现自动接单、自动交友、自动发帖、自动评论点赞等功能
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, SearchClient, S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

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
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false

  constructor() {
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

    try {
      // 1. 自动接单（始终执行，不受设置控制）
      await this.autoAcceptOrders(avatar)

      // 2. 自动交友
      if (settings.auto_friend !== false) {
        await this.autoMakeFriends(avatar)
      }

      // 3. 自动发帖
      if (settings.auto_post) {
        await this.autoCreatePost(avatar, settings)
      }

      // 4. 自动评论
      if (settings.auto_comment) {
        await this.autoComment(avatar)
      }

      // 5. 自动点赞
      if (settings.auto_like) {
        await this.autoLike(avatar)
      }
    } catch (error) {
      console.error(`[托管服务] 分身 ${avatar.name} 执行任务失败:`, error)
    }
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
    const orderRequirements = order.requirements || []
    
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
   * 自动交友 - 分析其他分身并推荐好友
   */
  private async autoMakeFriends(avatar: any) {
    const client = getSupabaseClient()
    
    // 检查是否已经有待处理的好友请求
    const { data: existingRequests } = await client
      .from('avatar_friends')
      .select('*')
      .eq('avatar_id', avatar.id)
      .in('status', ['pending', 'accepted'])
      .limit(10)

    if (existingRequests && existingRequests.length >= 5) {
      console.log(`[托管服务] 分身 ${avatar.name} 已有足够的好友关系`)
      return
    }

    // 获取其他活跃分身（排除自己）
    const { data: otherAvatars } = await client
      .from('avatars')
      .select('*')
      .eq('status', 'active')
      .neq('id', avatar.id)
      .limit(20)

    if (!otherAvatars || otherAvatars.length === 0) {
      return
    }

    // 分析并找到最匹配的分身
    const matches = await this.findBestMatches(avatar, otherAvatars)

    for (const match of matches.slice(0, 2)) { // 每次最多添加2个好友
      if (match.compatibilityScore > 0.6) {
        // 创建好友关系
        await client
          .from('avatar_friends')
          .insert({
            avatar_id: avatar.id,
            friend_avatar_id: match.avatar.id,
            status: 'accepted',
            match_reason: match.reason,
            compatibility_score: match.compatibilityScore
          })

        console.log(`[托管服务] 分身 ${avatar.name} 与 ${match.avatar.name} 成为好友，原因: ${match.reason}`)
      }
    }
  }

  /**
   * 找到最佳匹配的分身
   */
  private async findBestMatches(avatar: any, candidates: any[]): Promise<AvatarMatch[]> {
    const matches: AvatarMatch[] = []

    for (const candidate of candidates) {
      const analysis = await this.analyzeCompatibility(avatar, candidate)
      if (analysis.score > 0.5) {
        matches.push({
          avatar: candidate,
          compatibilityScore: analysis.score,
          reason: analysis.reason
        })
      }
    }

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
    
    // 根据频率决定是否发帖
    const postProbability = {
      low: 0.2,    // 20%概率发帖
      medium: 0.5, // 50%概率发帖
      high: 0.8    // 80%概率发帖
    }

    const probability = postProbability[settings.post_frequency || 'medium']
    if (Math.random() > probability) {
      console.log(`[托管服务] 分身 ${avatar.name} 本次未命中发帖概率，跳过`)
      return
    }

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

    console.log(`[托管服务] 分身 ${avatar.name} 准备发帖...`)
    
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

      // 4. 必须生成图片配图
      let images: string[] = []
      try {
        console.log('[托管服务] 正在为帖子生成配图...')
        const imageConfig = new Config()
        const imageClient = new ImageGenerationClient(imageConfig)
        
        // 根据帖子内容生成相关配图
        const imagePrompt = `社交媒体配图，主题：${typeof selectedTopic === 'string' ? selectedTopic : selectedTopic.title}，风格：现代简约，高质量，适合分享，温馨美好，${avatar.name}的分享`
        
        const imageResponse = await imageClient.generate({
          prompt: imagePrompt,
          size: '2K',
          watermark: false
        })
        
        const helper = imageClient.getResponseHelper(imageResponse)
        if (helper.success && helper.imageUrls.length > 0) {
          // 上传到 CDN
          const imageKey = await this.storage.uploadFromUrl({ url: helper.imageUrls[0], timeout: 30000 })
          const cdnUrl = await this.storage.generatePresignedUrl({ key: imageKey, expireTime: 86400 * 30 })
          images = [cdnUrl]
          console.log('[托管服务] 配图生成成功')
        } else {
          console.log('[托管服务] 配图生成失败，跳过发帖')
          return null
        }
      } catch (imgError: any) {
        console.log('[托管服务] 生成配图失败，跳过发帖:', imgError?.message || imgError)
        return null
      }

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
