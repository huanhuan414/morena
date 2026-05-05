import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service'
import { EarningService } from '../earning/earning.service'

@Injectable()
export class OrderService {
  constructor(
    private readonly reverseGeocodingService: ReverseGeocodingService,
    private readonly earningService: EarningService
  ) {}

  async createOrder(userId: string, orderData: Record<string, any>) {
    const client = getSupabaseClient()

    // 处理地理位置信息
    let locationData = {
      latitude: orderData.latitude || null,
      longitude: orderData.longitude || null,
      location_text: orderData.location_text || null
    }

    // 如果有经纬度但没有详细地址，进行逆地理编码
    if (locationData.latitude && locationData.longitude) {
      try {
        const geoResult = await this.reverseGeocodingService.reverseGeocode(
          locationData.latitude,
          locationData.longitude
        )
        // 使用逆地理编码的结果
        locationData.location_text = geoResult.formatted_address
        console.log('[创建订单] 逆地理编码成功:', geoResult.formatted_address)
      } catch (error) {
        console.warn('[创建订单] 逆地理编码失败，使用原始坐标:', error)
        // 逆地理编码失败，使用原始坐标
        locationData.location_text = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`
      }
    }

    // 根据预算金额设置订单状态
    const status = orderData.budget && orderData.budget > 0 ? 'pending_payment' : 'open'

    const { data, error } = await client
      .from('orders')
      .insert({
        user_id: userId,
        title: orderData.title,
        description: orderData.description,
        content_type: orderData.content_type || 'text',
        platforms: orderData.platforms || [],
        target_audience: orderData.target_audience || null,
        requirements: orderData.requirements || {},
        budget: orderData.budget || 0,
        expected_quantity: orderData.expected_quantity || 1,
        deadline: orderData.deadline || null,
        status,
        // 地理位置信息（包含逆地理编码结果）
        ...locationData
      })
      .select()
      .single()

    if (error) {
      throw new Error(`创建订单失败: ${error.message}`)
    }

    return data
  }

  async getOrders(userId: string, status?: string) {
    const client = getSupabaseClient()
    
    let query = client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取订单列表失败: ${error.message}`)
    }
    
    return data || []
  }

  async getOrderById(orderId: string) {
    const client = getSupabaseClient()

    // 先查询订单基本信息
    const { data: ordersData, error: orderError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)

    if (orderError) {
      throw new Error(`获取订单详情失败: ${orderError.message}`)
    }

    // 确保获取到订单数据
    const orderData = ordersData && ordersData.length > 0 ? ordersData[0] : null
    if (!orderData) {
      throw new Error('订单不存在')
    }

    // 查询用户信息
    let userInfo: any = null
    if (orderData.user_id) {
      const { data: userData } = await client
        .from('users')
        .select('nickname, avatar')
        .eq('id', orderData.user_id)
        .maybeSingle()
      userInfo = userData
    }

    // 查询分身信息
    let avatarInfo: any = null
    if (orderData.avatar_id) {
      const { data: avatarData } = await client
        .from('avatars')
        .select('id, name, avatar_url')
        .eq('id', orderData.avatar_id)
        .maybeSingle()
      avatarInfo = avatarData
    }

    // 查询所有订单请求信息（用于获取所有分身的发布结果和反馈）
    const { data: requestsData, error: requestError } = await client
      .from('order_dispatch_requests')
      .select(`
        id,
        status,
        publish_status,
        publish_feedback,
        generated_content,
        confirmed_content,
        avatar_id,
        created_at,
        updated_at
      `)
      .eq('order_id', orderId)

    // 如果有请求记录，查询分身信息和相关帖子统计
    if (!requestError && requestsData && requestsData.length > 0) {
      const avatarIds = requestsData.map((r: any) => r.avatar_id).filter(Boolean)

      let avatarMap = new Map()
      let postsMap = new Map()

      // 查询分身信息
      if (avatarIds.length > 0) {
        const { data: avatarsData } = await client
          .from('avatars')
          .select('id, name, avatar_url')
          .in('id', avatarIds)

        if (avatarsData) {
          avatarMap = new Map(avatarsData.map(a => [a.id, a]))
        }

        // 查询这些分身发布的所有帖子（按订单）
        const { data: postsData } = await client
          .from('posts')
          .select('id, avatar_id, content, images, video_url, likes_count, comments_count, shares_count, views_count, created_at, platforms')
          .in('avatar_id', avatarIds)
          .eq('order_id', orderId)

        if (postsData) {
          // 按分身ID分组帖子
          postsData.forEach((post: any) => {
            if (!postsMap.has(post.avatar_id)) {
              postsMap.set(post.avatar_id, [])
            }
            postsMap.get(post.avatar_id).push(post)
          })
        }
      }

      // 将分身信息和帖子映射到请求记录中
      requestsData.forEach((request: any) => {
        request.avatars = avatarMap.get(request.avatar_id)
        request.posts = postsMap.get(request.avatar_id) || []
      })

      // 将所有分身的发布结果和反馈添加到订单数据中
      orderData.dispatch_requests = requestsData

      // 兼容旧代码，将第一个request的数据也设置到字段中
      const firstRequest = requestsData[0]
      orderData.publish_status = firstRequest.publish_status
      orderData.publish_feedback = firstRequest.publish_feedback
      orderData.generated_content = firstRequest.generated_content
      orderData.confirmed_content = firstRequest.confirmed_content
      orderData.dispatch_request_id = firstRequest.id
      orderData.dispatch_request_status = firstRequest.status

      // 计算统计数据
      const acceptedRequests = requestsData.filter((r: any) => r.status === 'accepted' || r.status === 'generating' || r.status === 'preview' || r.status === 'published' || r.status === 'awaiting_acceptance' || r.status === 'feedback_submitted')
      const completedRequests = requestsData.filter((r: any) => r.status === 'completed')

      // 统计每个分身的作品数据
      const avatarStats = requestsData.map((request: any) => {
        const platforms = request.publish_status?.platforms || []
        let posts = request.posts || []
        const avatarData = request.avatars
        const avatarInfo = Array.isArray(avatarData) ? avatarData[0] : avatarData

        // 如果没有posts但有生成内容，创建虚拟的post用于展示
        if (posts.length === 0 && (request.generated_content || request.confirmed_content)) {
          const content = request.confirmed_content || request.generated_content
          // 提取图片链接（Markdown格式：![alt](url)）
          const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []
          const images = imageMatches.map((match: string) => {
            const urlMatch = match.match(/\(([^)]+)\)/)
            return urlMatch ? urlMatch[1] : ''
          }).filter((url: string) => url)

          posts = [{
            id: `temp-${request.id}`,
            content: content,
            images: images,
            videoUrl: '',
            likesCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            viewsCount: 0,
            createdAt: request.publish_status?.feedbackSubmittedAt || request.updated_at,
            platforms: platforms.map((p: any) => p.platform)
          }]
        }

        // 聚合帖子数据
        const totalViews = posts.reduce((sum: number, p: any) => sum + (p.viewsCount || p.views_count || 0), 0)
        const totalLikes = posts.reduce((sum: number, p: any) => sum + (p.likesCount || p.likes_count || 0), 0)
        const totalComments = posts.reduce((sum: number, p: any) => sum + (p.commentsCount || p.comments_count || 0), 0)
        const totalShares = posts.reduce((sum: number, p: any) => sum + (p.sharesCount || p.shares_count || 0), 0)

        return {
          requestId: request.id,  // 添加 requestId
          avatarId: request.avatar_id,
          avatarName: avatarInfo?.name || '未知',
          avatarUrl: avatarInfo?.avatar_url || '',
          status: request.status,
          postCount: posts.length,
          platformCount: platforms.length,
          publishedCount: platforms.filter((p: any) => p.status === 'success').length,
          manualCount: platforms.filter((p: any) => p.status === 'manual').length,
          feedbackCount: request.publish_feedback ? Object.keys(request.publish_feedback).length : 0,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          publishFeedback: request.publish_feedback || null,
          posts: posts.map((p: any) => ({
            id: p.id,
            content: p.content,
            images: p.images,
            videoUrl: p.videoUrl || p.video_url,
            likesCount: p.likesCount || p.likes_count || 0,
            commentsCount: p.commentsCount || p.comments_count || 0,
            sharesCount: p.sharesCount || p.shares_count || 0,
            viewsCount: p.viewsCount || p.views_count || 0,
            createdAt: p.createdAt || p.created_at,
            platforms: p.platforms
          }))
        }
      })

      // 总计统计
      const summaryStats = {
        totalAvatars: requestsData.length,
        acceptedAvatars: acceptedRequests.length,
        completedAvatars: completedRequests.length,
        totalPosts: requestsData.reduce((sum: number, r: any) => sum + (r.posts?.length || 0), 0),
        totalPlatforms: requestsData.reduce((sum: number, r: any) => sum + (r.publish_status?.platforms?.length || 0), 0),
        totalPublished: requestsData.reduce((sum: number, r: any) => sum + (r.publish_status?.platforms?.filter((p: any) => p.status === 'success').length || 0), 0),
        totalManual: requestsData.reduce((sum: number, r: any) => sum + (r.publish_status?.platforms?.filter((p: any) => p.status === 'manual').length || 0), 0),
        totalViews: avatarStats.reduce((sum: number, s: any) => sum + (s.totalViews || 0), 0),
        totalLikes: avatarStats.reduce((sum: number, s: any) => sum + (s.totalLikes || 0), 0),
        totalComments: avatarStats.reduce((sum: number, s: any) => sum + (s.totalComments || 0), 0),
        totalShares: avatarStats.reduce((sum: number, s: any) => sum + (s.totalShares || 0), 0),
        avatarStats
      }

      orderData.summary_stats = summaryStats
    } else {
      orderData.dispatch_requests = []
      orderData.summary_stats = null
    }

    // 添加用户和分身信息
    orderData.users = userInfo
    orderData.avatars = avatarInfo

    return orderData
  }

  async updateOrder(orderId: string, updateData: Record<string, any>) {
    const client = getSupabaseClient()
    
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    }
    
    if (updateData.title) updates.title = updateData.title
    if (updateData.description) updates.description = updateData.description
    if (updateData.budget) updates.budget = updateData.budget
    if (updateData.requirements) updates.requirements = updateData.requirements
    
    const { data, error } = await client
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新订单失败: ${error.message}`)
    }
    
    return data
  }

  async updateOrderStatus(orderId: string, status: string, avatarId?: string) {
    const client = getSupabaseClient()
    
    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    }
    
    if (avatarId) {
      updates.avatar_id = avatarId
    }
    
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }
    
    const { data, error } = await client
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新订单状态失败: ${error.message}`)
    }
    
    return data
  }

  async submitOrderResult(orderId: string, result: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('orders')
      .update({
        result,
        status: 'reviewing',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`提交订单结果失败: ${error.message}`)
    }
    
    // 增加分身经验：根据订单预算计算
    if (data.avatar_id) {
      const exp = this.calculateOrderExp(data)
      await this.addAvatarExp(data.avatar_id, exp)
    }
    
    return data
  }

  /**
   * 计算订单完成获得的经验值
   * 规则：根据订单预算计算，预算越高经验值越多
   */
  private calculateOrderExp(order: any): number {
    const budget = order.budget || 0
    
    // 基础经验 30 XP
    let exp = 30
    
    // 预算加成：每增加100元 +5 XP，上限 +50
    if (budget > 0) {
      const budgetBonus = Math.min(50, Math.floor(budget / 100) * 5)
      exp += budgetBonus
    }
    
    return exp
  }

  async acceptOrder(orderId: string, avatarId: string) {
    const client = getSupabaseClient()
    
    // 检查订单状态
    const order = await this.getOrderById(orderId)
    if (order.status !== 'open') {
      throw new Error('订单已被接取或已关闭')
    }
    
    const { data, error } = await client
      .from('orders')
      .update({
        avatar_id: avatarId,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`接单失败: ${error.message}`)
    }
    
    // 接单后自动分析并生成内容
    this.autoGenerateContent(order, avatarId).catch(err => {
      console.error('[OrderService] 自动生成内容失败:', err.message)
    })
    
    return data
  }

  /**
   * 自动分析订单需求并生成图片/海报
   */
  private async autoGenerateContent(order: any, avatarId: string) {
    const needsImage = this.checkIfNeedsImage(order)
    const needsVideo = this.checkIfNeedsVideo(order)
    
    if (!needsImage && !needsVideo) {
      console.log('[OrderService] 订单不需要生成图片或视频，跳过自动生成')
      return
    }
    
    const generatedItems: string[] = []
    let imageUrl: string | null = null
    let videoUrl: string | null = null
    
    // 生成图片
    const platforms = order.platforms || []
    const isWechatMoments = platforms.includes('wechat_moments')
    
    if (needsImage) {
      console.log('[OrderService] 开始自动生成图片/海报...')
      
      // 朋友圈平台生成3张图片
      if (isWechatMoments) {
        const imageUrls = await this.generateMultipleImagesForOrder(order, 3)
        for (const url of imageUrls) {
          if (url) {
            generatedItems.push(`![自动生成图片](${url})`)
          }
        }
      } else {
        imageUrl = await this.generateImageForOrder(order)
        if (imageUrl) {
          generatedItems.push(`![自动生成图片](${imageUrl})`)
        }
      }
    }
    
    // 生成视频
    if (needsVideo) {
      console.log('[OrderService] 开始自动生成视频...')
      videoUrl = await this.generateVideoForOrder(order, imageUrl)
      if (videoUrl) {
        generatedItems.push(`[自动生成视频](${videoUrl})`)
      }
    }
    
    // 如果有生成内容，保存到订单
    if (generatedItems.length > 0) {
      const client = getSupabaseClient()
      const updateData: any = {
        generated_content: generatedItems.join('\n\n') + '\n\n根据订单需求自动生成。',
        updated_at: new Date().toISOString()
      }
      
      // 如果有 images 字段则更新
      if ('images' in order && imageUrl) {
        const existingImages = order.images || []
        updateData.images = [...existingImages, imageUrl].slice(0, 10)
      }
      
      // 如果有 videos 字段则更新
      if ('videos' in order && videoUrl) {
        const existingVideos = order.videos || []
        updateData.videos = [...existingVideos, videoUrl].slice(0, 10)
      }
      
      await client
        .from('orders')
        .update(updateData)
        .eq('id', order.id)
      
      console.log('[OrderService] 内容生成成功，图片:', imageUrl, '视频:', videoUrl)
      
      // 发送通知给用户
      const contentType = needsVideo && needsImage ? '图片和视频' : (needsVideo ? '视频' : '图片')
      const notifyUrl = imageUrl || videoUrl || ''
      if (notifyUrl) {
        this.notifyUserAboutGeneratedContent(order.id, notifyUrl, contentType).catch(err => {
          console.error('[OrderService] 发送通知失败:', err.message)
        })
      }
    }
  }

  /**
   * 为订单生成图片
   */
  private async generateImageForOrder(order: any): Promise<string | null> {
    const prompt = this.buildImagePrompt(order)
    
    try {
      const axios = require('axios')
      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
      const apiKey = process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'
      
      const response = await axios.post(apiUrl, {
        model: 'seedream-4-0',
        prompt: prompt,
        size: '1024x1024',
        style: 'flat_illustration'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        timeout: 60000
      })
      
      const imageUrl = response.data?.data?.[0]?.url
      console.log('[OrderService] 图片生成成功:', imageUrl)
      return imageUrl || null
    } catch (error: any) {
      console.error('[OrderService] 图片生成失败:', error.message)
      return null
    }
  }

  /**
   * 为订单生成多张图片（用于朋友圈等需要多图的场景）
   */
  private async generateMultipleImagesForOrder(order: any, count: number = 3): Promise<string[]> {
    const results: string[] = []
    const platforms = order.platforms || []
    const isWechatMoments = platforms.includes('wechat_moments')
    
    // 为每张图片生成不同的提示词（朋友圈九宫格风格）
    const imageStyles = [
      '精美封面图，高端大气，吸引眼球',
      '真实场景图，生活化，有代入感',
      '细节特写图，质感强，引人注目'
    ]
    
    for (let i = 0; i < count; i++) {
      try {
        // 构建图片提示词
        const prompt = this.buildImagePromptForIndex(order, i, imageStyles[i % imageStyles.length], isWechatMoments)
        
        const axios = require('axios')
        const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
        const apiKey = process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'
        
        const response = await axios.post(apiUrl, {
          model: 'seedream-4-0',
          prompt: prompt,
          size: '1024x1024',
          style: isWechatMoments ? '3d_animation' : 'flat_illustration'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey
          },
          timeout: 60000
        })
        
        const imageUrl = response.data?.data?.[0]?.url
        if (imageUrl) {
          console.log(`[OrderService] 图片${i + 1}/${count} 生成成功:`, imageUrl)
          results.push(imageUrl)
        }
      } catch (error: any) {
        console.error(`[OrderService] 图片${i + 1}/${count} 生成失败:`, error.message)
        // 继续生成下一张，不中断
      }
    }
    
    return results
  }

  /**
   * 为指定序号的图片构建提示词（朋友圈九宫格风格）
   */
  private buildImagePromptForIndex(order: any, index: number, style: string, isWechatMoments: boolean): string {
    const parts: string[] = []
    
    // 朋友圈风格特殊处理
    if (isWechatMoments) {
      parts.push(`【朋友圈九宫格图片 - 第${index + 1}张】`)
      parts.push(`风格要求: ${style}`)
      parts.push(`统一主题: ${order.title || order.description || '精彩内容'}`)
      
      if (order.description) {
        parts.push(`内容描述: ${order.description}`)
      }
      
      // 九宫格风格要求
      parts.push('九宫格风格：图片之间要有连贯性，整体构成完整故事')
      parts.push('色调统一：保持整体视觉风格一致')
      parts.push('构图精美：适合朋友圈展示，视觉效果好')
    } else {
      // 默认单图风格
      return this.buildImagePrompt(order)
    }
    
    return parts.join('\n')
  }

  /**
   * 为订单生成视频
   */
  private async generateVideoForOrder(order: any, imageUrl?: string | null): Promise<string | null> {
    const prompt = this.buildVideoPrompt(order)
    
    try {
      // 使用 coze-coding-dev-sdk 生成视频
      const { VideoGenerationClient, Config, S3Storage } = require('coze-coding-dev-sdk')
      
      const config = new Config({
        apiKey: process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47',
        endpointUrl: process.env.VOLC_VIDEO_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3',
      })
      
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com',
        accessKey: process.env.VOLC_ACCESS_KEY || '',
        secretKey: process.env.VOLC_SECRET_KEY || '',
        bucketName: process.env.COZE_BUCKET_NAME || 'morena-ai',
        region: 'cn-guangzhou',
      })
      
      const client = new VideoGenerationClient(config, storage)
      
      // 确定视频比例（根据平台）
      let ratio = '16:9' // 默认横屏
      if (order.platforms && order.platforms.length > 0) {
        if (order.platforms.includes('douyin') || order.platforms.includes('kuaishou')) {
          ratio = '9:16' // 抖音/快手用竖屏
        }
      }
      
      // 构建视频生成参数
      const videoParams: any = {
        prompt: prompt,
        duration: 10, // 支持10秒视频
        ratio: ratio,
        resolution: '720p',
        generateAudio: true,
      }
      
      // 如果有生成的图片，使用图片作为首帧
      if (imageUrl) {
        videoParams.firstFrameUrl = imageUrl
      }
      
      console.log('[OrderService] 视频生成参数:', videoParams)
      
      // 调用视频生成API
      const result = await client.generateVideo(videoParams)
      
      console.log('[OrderService] 视频生成成功:', result.videoUrl)
      return result.videoUrl || null
    } catch (error: any) {
      console.error('[OrderService] 视频生成失败:', error.message)
      return null
    }
  }

  /**
   * 检测订单是否需要生成视频
   */
  private checkIfNeedsVideo(order: any): boolean {
    // 检测 content_type 字段
    const contentType = (order.content_type || '').toLowerCase()
    if (contentType.includes('video') || contentType.includes('视频')) {
      return true
    }
    
    const text = [
      order.title || '',
      order.description || '',
      JSON.stringify(order.requirements || {})
    ].join(' ').toLowerCase()
    
    // 视频相关关键词
    const videoKeywords = [
      '视频', '短视频', '影片', '短剧', '宣传片', '广告片',
      '生成视频', '生成短视频', '拍视频', '做视频', '制作视频',
      '抖音', '快手', '视频号', 'B站', '小红书',
      '竖屏视频', '横屏视频', '视频素材'
    ]
    
    return videoKeywords.some(keyword => text.includes(keyword))
  }

  /**
   * 构建视频生成提示词
   */
  private buildVideoPrompt(order: any): string {
    const parts: string[] = []
    
    // 标题 - 视频核心主题
    if (order.title) {
      parts.push(`视频主题: ${order.title}`)
    }
    
    // 描述 - 这是最重要的需求
    if (order.description) {
      parts.push(`内容要求: ${order.description}`)
    }
    
    // 目标受众
    if (order.target_audience) {
      parts.push(`目标观众: ${order.target_audience}`)
    }
    
    // 根据 requirements 提取详细信息
    const requirements = order.requirements || {}
    if (requirements.style) {
      parts.push(`视频风格: ${requirements.style}`)
    }
    if (requirements.mood) {
      parts.push(`整体氛围: ${requirements.mood}`)
    }
    if (requirements.duration) {
      parts.push(`时长要求: ${requirements.duration}`)
    }
    
    // 检测视频类型
    const text = (order.title || '') + ' ' + (order.description || '')
    let videoType = '创意短视频'
    
    if (text.includes('宣传') || text.includes('广告')) {
      videoType = '品牌宣传短视频'
    } else if (text.includes('种草') || text.includes('推荐')) {
      videoType = '种草推荐视频'
    } else if (text.includes('教程') || text.includes('教学')) {
      videoType = '知识教程视频'
    } else if (text.includes('产品') || text.includes('商品')) {
      videoType = '产品展示视频'
    } else if (text.includes('活动') || text.includes('促销')) {
      videoType = '活动促销视频'
    } else if (text.includes('故事') || text.includes('剧情')) {
      videoType = '故事剧情短视频'
    } else if (text.includes('美食')) {
      videoType = '美食展示视频'
    } else if (text.includes('旅游') || text.includes('风景')) {
      videoType = '风景旅行视频'
    } else if (text.includes('时尚') || text.includes('穿搭')) {
      videoType = '时尚穿搭视频'
    }
    
    // 平台要求 - 不同平台风格不同
    if (order.platforms && order.platforms.length > 0) {
      const platformStyles: Record<string, string> = {
        douyin: '抖音风格，节奏感强，画面有冲击力，开头抓人眼球',
        kuaishou: '快手风格，真实接地气，有代入感',
        xiaohongshu: '小红书风格，画面精致，高质感，有种草感',
        bilibili: 'B站风格，内容有趣，创意十足',
        wechat: '微信风格，简洁明了，适合朋友圈传播'
      }
      const styles = order.platforms.map((p: string) => platformStyles[p] || p)
      parts.push(`发布平台: ${styles.join('，')}`)
    }
    
    // 视频格式说明
    const ratio = (order.platforms?.includes('douyin') || order.platforms?.includes('kuaishou'))
      ? '竖屏 9:16' : '横屏 16:9'
    parts.push(`视频格式: ${ratio}，时长10秒，画面精美流畅`)
    
    // 构建最终提示词
    let finalPrompt = `${videoType}，制作要求：\n${parts.join('\n')}\n\n视频效果：画面精美，节奏流畅，适合社交媒体传播`
    
    // 如果描述很详细，用描述作为核心提示词
    if (order.description && order.description.length > 15) {
      finalPrompt = `请根据以下需求生成一段${videoType}（10秒）：\n\n${order.description}\n\n制作要求：画面精美，节奏流畅，${ratio}格式，适合在${order.platforms?.join('、') || '社交媒体'}上传播`
    }
    
    return finalPrompt
  }

  /**
   * 检测订单是否需要生成图片
   */
  private checkIfNeedsImage(order: any): boolean {
    // 检测 content_type 字段
    const contentType = (order.content_type || '').toLowerCase()
    if (contentType.includes('image') || contentType.includes('图片') || contentType.includes('海报')) {
      return true
    }
    
    const text = [
      order.title || '',
      order.description || '',
      JSON.stringify(order.requirements || {})
    ].join(' ').toLowerCase()
    
    // 图片/海报相关关键词
    const imageKeywords = [
      '海报', '图片', '封面', 'banner', '宣传图', '配图',
      '生成图片', '生成海报', '画一张', '创作图片', '制作图片',
      '宣传海报', '广告图', '素材', '图形', '插画', '设计图'
    ]
    
    // 如果标题或描述包含图片相关关键词，则需要生成
    return imageKeywords.some(keyword => text.includes(keyword))
  }

  /**
   * 构建图片生成提示词
   */
  private buildImagePrompt(order: any): string {
    const parts: string[] = []
    
    // 标题
    if (order.title) {
      parts.push(`主题: ${order.title}`)
    }
    
    // 描述 - 这是最重要的需求描述
    if (order.description) {
      parts.push(`需求描述: ${order.description}`)
    }
    
    // 目标受众
    if (order.target_audience) {
      parts.push(`目标受众: ${order.target_audience}`)
    }
    
    // 平台要求 - 不同平台风格不同
    if (order.platforms && order.platforms.length > 0) {
      const platformStyles: Record<string, string> = {
        douyin: '抖音风格，视觉冲击力强，适合短视频封面',
        kuaishou: '快手风格，亲民接地气，真实感强',
        xiaohongshu: '小红书风格，精致美观，高质感',
        bilibili: 'B站风格，年轻化，有趣创意',
        wechat: '微信风格，简洁大方，适合朋友圈传播'
      }
      const styles = order.platforms.map((p: string) => platformStyles[p] || p)
      parts.push(`发布平台: ${styles.join('，')}`)
    }
    
    // 根据 requirements 构建更详细的提示词
    const requirements = order.requirements || {}
    if (requirements.style) {
      parts.push(`设计风格: ${requirements.style}`)
    }
    if (requirements.color) {
      parts.push(`主色调: ${requirements.color}`)
    }
    if (requirements.mood) {
      parts.push(`整体氛围: ${requirements.mood}`)
    }
    
    // 检测海报类型，添加对应描述
    const text = (order.title || '') + ' ' + (order.description || '')
    let imageType = '精美的宣传图片'
    
    if (text.includes('海报')) {
      imageType = '创意宣传海报'
    } else if (text.includes('封面')) {
      imageType = '社交媒体封面图'
    } else if (text.includes('banner')) {
      imageType = 'Banner广告图'
    } else if (text.includes('朋友圈')) {
      imageType = '朋友圈分享图片'
    } else if (text.includes('头像') || text.includes('logo')) {
      imageType = '品牌标识图片'
    } else if (text.includes('商品') || text.includes('产品')) {
      imageType = '产品展示图片'
    } else if (text.includes('活动')) {
      imageType = '活动宣传图'
    }
    
    // 构建最终的提示词
    let finalPrompt = parts.length > 0 
      ? `${imageType}，设计要求：\n${parts.join('\n')}\n\n设计风格：现代简洁，视觉精美，适合社交媒体传播`
      : imageType
    
    // 如果描述很详细，直接用描述作为提示词
    if (order.description && order.description.length > 20) {
      finalPrompt = `请根据以下需求生成一张${imageType}：\n\n${order.description}\n\n设计要求：现代简洁，视觉精美，适合在${order.platforms?.join('、') || '社交媒体'}上传播`
    }
    
    return finalPrompt
  }

  /**
   * 通知用户内容已生成
   */
  private async notifyUserAboutGeneratedContent(orderId: string, contentUrl: string, contentType: string = '图片') {
    const client = getSupabaseClient()
    
    // 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('user_id, title')
      .eq('id', orderId)
      .single()
    
    if (!order) return
    
    // 发送系统通知
    await client
      .from('notifications')
      .insert({
        user_id: order.user_id,
        type: 'order_update',
        title: '订单内容已生成',
        content: `您的订单"${order.title}"已自动生成${contentType}，请前往查看：${contentUrl}`,
        metadata: {
          orderId: orderId,
          contentUrl: contentUrl,
          contentType: contentType,
          type: 'content_generated'
        }
      })
  }

  async cancelOrder(orderId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`取消订单失败: ${error.message}`)
    }
    
    return data
  }

  async getOpenOrders(page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    const { data, error, count } = await client
      .from('orders')
      .select('*, users(nickname, avatar)', { count: 'exact' })
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取开放订单失败: ${error.message}`)
    }
    
    return {
      orders: data,
      total: count || 0,
      page,
      pageSize
    }
  }

  async getOrderStats(userId: string) {
    const client = getSupabaseClient()

    const { count: total } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: open } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'open')

    const { count: inProgress } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'in_progress')

    const { count: reviewing } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'reviewing')

    const { count: completed } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')

    return {
      total: total || 0,
      open: open || 0,
      inProgress: inProgress || 0,
      reviewing: reviewing || 0,
      completed: completed || 0
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

  /**
   * 提交订单内容结果
   */
  async submitContent(orderId: string, avatarId: string, content: {
    title?: string
    content: string
    images?: string[]
    videos?: string[]
    platform_results?: Array<{
      platform: string
      post_id?: string
      post_url?: string
      status: string
    }>
  }) {
    const client = getSupabaseClient()
    
    // 验证订单所有权
    const order = await this.getOrderById(orderId)
    if (order.avatar_id !== avatarId) {
      throw new Error('无权操作此订单')
    }
    
    if (order.status !== 'in_progress') {
      throw new Error('订单状态不正确')
    }
    
    const { data, error } = await client
      .from('orders')
      .update({
        result: {
          content,
          submitted_at: new Date().toISOString()
        },
        status: 'reviewing',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`提交内容失败: ${error.message}`)
    }
    
    // 通知订单发布者
    await this.notifyOrderResult(orderId, 'submitted')
    
    return data
  }

  /**
   * 验收订单
   */
  async approveOrder(orderId: string, userId: string, rating?: {
    score: number
    comment?: string
  }) {
    const client = getSupabaseClient()
    
    const order = await this.getOrderById(orderId)
    if (order.user_id !== userId) {
      throw new Error('无权操作此订单')
    }
    
    if (order.status !== 'reviewing') {
      throw new Error('订单状态不正确')
    }
    
    // 更新订单状态
    const updates: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // 如果有评分，保存评分
    if (rating) {
      updates.rating = rating
    }
    
    const { data, error } = await client
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`验收订单失败: ${error.message}`)
    }
    
    // 更新分身的完成订单数和完成率
    if (order.avatar_id) {
      await this.updateAvatarCompletionStats(order.avatar_id, rating?.score)
    }
    
    // 计算并发放收益
    if (order.budget && order.avatar_id) {
      await this.createOrderEarnings(orderId, order.avatar_id, order.budget)
    }
    
    // 通知分身验收通过
    await this.notifyAvatarApproval(orderId, order.avatar_id)
    
    return data
  }

  /**
   * 驳回订单
   */
  async rejectOrder(orderId: string, userId: string, reason: string) {
    const client = getSupabaseClient()
    
    const order = await this.getOrderById(orderId)
    if (order.user_id !== userId) {
      throw new Error('无权操作此订单')
    }
    
    if (order.status !== 'reviewing') {
      throw new Error('订单状态不正确')
    }
    
    const { data, error } = await client
      .from('orders')
      .update({
        status: 'in_progress',
        rejection: {
          reason,
          rejected_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`驳回订单失败: ${error.message}`)
    }
    
    // 通知分身需要修改
    await this.notifyAvatarRejection(orderId, order.avatar_id, reason)
    
    return data
  }

  /**
   * 更新分身完成统计
   */
  private async updateAvatarCompletionStats(avatarId: string, rating?: number) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('completed_orders, total_orders, completion_rate')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      const completedOrders = avatar.completed_orders + 1
      const totalOrders = avatar.total_orders
      // 计算新的完成率
      const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 100
      
      await client
        .from('avatars')
        .update({
          completed_orders: completedOrders,
          completion_rate: completionRate,
          updated_at: new Date().toISOString()
        })
        .eq('id', avatarId)
    }
  }

  /**
   * 创建订单收益
   */
  private async createOrderEarnings(orderId: string, avatarId: string, budget: number) {
    const client = getSupabaseClient()
    
    // 获取分身所属用户
    const { data: avatar } = await client
      .from('avatars')
      .select('user_id')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      // 收益 = 订单预算 * 分成比例（假设70%）
      const earningsAmount = Number(budget) * 0.7
      
      await client
        .from('earnings')
        .insert({
          user_id: avatar.user_id,
          type: 'order_income',
          amount: earningsAmount.toFixed(2),
          status: 'completed',
          description: `订单完成收益`,
          order_id: orderId,
          settled_at: new Date().toISOString()
        })
      
      // 更新用户余额
      const { data: user } = await client
        .from('users')
        .select('available_balance, total_earnings')
        .eq('id', avatar.user_id)
        .single()
      
      await client
        .from('users')
        .update({
          available_balance: (user?.available_balance || 0) + earningsAmount,
          total_earnings: (user?.total_earnings || 0) + earningsAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', avatar.user_id)
    }
  }

  /**
   * 通知订单结果
   */
  private async notifyOrderResult(orderId: string, type: 'submitted' | 'approved' | 'rejected') {
    const client = getSupabaseClient()
    
    const { data: order } = await client
      .from('orders')
      .select('user_id, title')
      .eq('id', orderId)
      .single()
    
    if (order) {
      const titles = {
        submitted: '订单内容已提交',
        approved: '订单已验收通过',
        rejected: '订单需要修改'
      }
      
      const contents = {
        submitted: `您的订单"${order.title}"的内容已提交，请前往验收`,
        approved: `您的订单"${order.title}"已验收通过`,
        rejected: `您的订单"${order.title}"需要修改`
      }
      
      await client
        .from('notifications')
        .insert({
          user_id: order.user_id,
          type: 'system',
          title: titles[type],
          content: contents[type],
          data: { orderId, type }
        })
    }
  }

  /**
   * 通知分身验收通过
   */
  private async notifyAvatarApproval(orderId: string, avatarId: string) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('user_id, name')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      await client
        .from('notifications')
        .insert({
          user_id: avatar.user_id,
          type: 'system',
          title: '订单验收通过',
          content: `您的分身"${avatar.name}"完成的订单已验收通过，收益已到账`,
          data: { orderId, avatarId }
        })
    }
  }

  /**
   * 通知分身被驳回
   */
  private async notifyAvatarRejection(orderId: string, avatarId: string, reason: string) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('user_id, name')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      await client
        .from('notifications')
        .insert({
          user_id: avatar.user_id,
          type: 'system',
          title: '订单需要修改',
          content: `您的分身"${avatar.name}"完成的订单需要修改：${reason}`,
          data: { orderId, avatarId }
        })
    }
  }

  /**
   * 获取订单数据反馈
   */
  async getOrderFeedback(orderId: string) {
    const client = getSupabaseClient()
    
    const order = await this.getOrderById(orderId)
    
    // 获取执行步骤
    const { data: executions } = await client
      .from('order_executions')
      .select('*')
      .eq('order_id', orderId)
      .order('step_number', { ascending: true })
    
    // 获取相关的社交动态（如果有）
    const { data: posts } = await client
      .from('posts')
      .select('*')
      .eq('order_id', orderId)
    
    // 统计各平台数据
    const platformStats = this.calculatePlatformStats(order.result, posts || [])
    
    return {
      order,
      executions,
      posts,
      platformStats,
      summary: {
        totalReach: platformStats.reduce((sum, p) => sum + (p.reach || 0), 0),
        totalLikes: platformStats.reduce((sum, p) => sum + (p.likes || 0), 0),
        totalComments: platformStats.reduce((sum, p) => sum + (p.comments || 0), 0),
        totalShares: platformStats.reduce((sum, p) => sum + (p.shares || 0), 0)
      }
    }
  }

  /**
   * 计算各平台数据统计
   */
  private calculatePlatformStats(result: any, posts: any[]) {
    const stats: Array<{
      platform: string
      reach?: number
      likes?: number
      comments?: number
      shares?: number
      post_url?: string
      post_id?: string
    }> = []
    
    // 从发布结果中提取数据
    if (result?.content?.platform_results) {
      for (const pr of result.content.platform_results) {
        stats.push({
          platform: pr.platform,
          post_url: pr.post_url,
          post_id: pr.post_id,
          // 模拟数据，实际应该从平台API获取
          reach: Math.floor(Math.random() * 10000) + 1000,
          likes: Math.floor(Math.random() * 500) + 50,
          comments: Math.floor(Math.random() * 100) + 10,
          shares: Math.floor(Math.random() * 50) + 5
        })
      }
    }
    
    return stats
  }

  /**
   * 获取订单评分
   */
  async getOrderRating(orderId: string) {
    const client = getSupabaseClient()
    
    const { data: order } = await client
      .from('orders')
      .select('rating, result, completed_at')
      .eq('id', orderId)
      .single()
    
    return order?.rating || null
  }

  /**
   * 获取分身评分统计
   */
  async getAvatarRatingStats(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data: completedOrders } = await client
      .from('orders')
      .select('rating')
      .eq('avatar_id', avatarId)
      .eq('status', 'completed')
    
    if (!completedOrders || completedOrders.length === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: {}
      }
    }
    
    const ratings = completedOrders
      .map(o => o.rating?.score)
      .filter((r): r is number => r !== undefined && r !== null)
    
    if (ratings.length === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: {}
      }
    }
    
    const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
    const ratingDistribution = ratings.reduce((acc, r) => {
      acc[r] = (acc[r] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings: ratings.length,
      ratingDistribution
    }
  }

  /**
   * 获取订单详细统计报表（分身维度）
   */
  async getOrderDetailedReport(orderId: string) {
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

    // 获取订单结果数据
    const { data: results } = await client
      .from('order_results')
      .select('*, avatars(*)')
      .eq('order_id', orderId)

    // 获取订单执行记录
    const { data: executions } = await client
      .from('order_executions')
      .select('*')
      .eq('order_id', orderId)
      .order('step_number')

    // 统计总数据
    const totalStats = {
      exposure: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0
    }

    // 分身维度统计
    const avatarStats = (results || []).map(result => {
      totalStats.exposure += result.actual_exposure || 0
      totalStats.likes += result.actual_likes || 0
      totalStats.comments += result.actual_comments || 0
      totalStats.shares += result.actual_shares || 0
      totalStats.views += result.actual_views || 0

      return {
        avatarId: result.avatar_id,
        avatarName: result.avatars?.name || '未知分身',
        platform: result.platform,
        exposure: result.actual_exposure || 0,
        likes: result.actual_likes || 0,
        comments: result.actual_comments || 0,
        shares: result.actual_shares || 0,
        views: result.actual_views || 0,
        engagementRate: result.actual_exposure > 0
          ? ((result.actual_likes || 0) + (result.actual_comments || 0) + (result.actual_shares || 0)) / result.actual_exposure * 100
          : 0,
        qualityScore: result.quality_score || 0,
        customerRating: result.customer_rating || 0,
        publishTime: result.publish_time,
        feedback: result.feedback || null
      }
    })

    // 计算平均值
    const avgStats = {
      exposure: avatarStats.length > 0 ? Math.round(totalStats.exposure / avatarStats.length) : 0,
      likes: avatarStats.length > 0 ? Math.round(totalStats.likes / avatarStats.length) : 0,
      comments: avatarStats.length > 0 ? Math.round(totalStats.comments / avatarStats.length) : 0,
      shares: avatarStats.length > 0 ? Math.round(totalStats.shares / avatarStats.length) : 0,
      views: avatarStats.length > 0 ? Math.round(totalStats.views / avatarStats.length) : 0,
      engagementRate: avatarStats.length > 0
        ? avatarStats.reduce((sum, s) => sum + s.engagementRate, 0) / avatarStats.length
        : 0,
      qualityScore: avatarStats.length > 0
        ? avatarStats.reduce((sum, s) => sum + s.qualityScore, 0) / avatarStats.length
        : 0,
      customerRating: avatarStats.length > 0
        ? avatarStats.reduce((sum, s) => sum + s.customerRating, 0) / avatarStats.length
        : 0
    }

    // 平台维度统计
    const platformStats = avatarStats.reduce((acc, stat) => {
      if (!acc[stat.platform]) {
        acc[stat.platform] = {
          platform: stat.platform,
          count: 0,
          exposure: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0
        }
      }
      acc[stat.platform].count += 1
      acc[stat.platform].exposure += stat.exposure
      acc[stat.platform].likes += stat.likes
      acc[stat.platform].comments += stat.comments
      acc[stat.platform].shares += stat.shares
      acc[stat.platform].views += stat.views
      return acc
    }, {} as Record<string, any>)

    // 执行流程统计
    const executionStats = (executions || []).reduce((acc, exec) => {
      if (!acc[exec.status]) {
        acc[exec.status] = 0
      }
      acc[exec.status] += 1
      return acc
    }, {} as Record<string, number>)

    return {
      order: {
        id: order.id,
        title: order.title,
        content_type: order.content_type,
        platforms: order.platforms,
        status: order.status,
        created_at: order.created_at,
        completed_at: order.completed_at
      },
      totalStats,
      avgStats,
      avatarStats: avatarStats.sort((a, b) => b.exposure - a.exposure), // 按曝光量排序
      platformStats: Object.values(platformStats).sort((a: any, b: any) => b.exposure - a.exposure),
      executionStats,
      summary: {
        totalAvatars: avatarStats.length,
        totalPlatforms: Object.keys(platformStats).length,
        totalSteps: executions?.length || 0,
        completedSteps: executionStats.completed || 0,
        overallQuality: avgStats.qualityScore,
        overallSatisfaction: avgStats.customerRating,
        totalEngagement: totalStats.likes + totalStats.comments + totalStats.shares,
        totalReach: totalStats.exposure
      }
    }
  }

  /**
   * 获取分身订单统计
   */
  async getAvatarOrderStatistics(avatarId: string, params?: { startDate?: string; endDate?: string }) {
    const client = getSupabaseClient()

    let query = client
      .from('orders')
      .select('*')
      .eq('avatar_id', avatarId)

    if (params?.startDate) {
      query = query.gte('created_at', params.startDate)
    }

    if (params?.endDate) {
      query = query.lte('created_at', params.endDate)
    }

    const { data: orders } = await query

    const stats = {
      totalOrders: orders?.length || 0,
      pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
      inProgressOrders: orders?.filter(o => o.status === 'in_progress').length || 0,
      completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
      cancelledOrders: orders?.filter(o => o.status === 'cancelled').length || 0
    }

    // 获取结果数据
    const { data: results } = await client
      .from('order_results')
      .select('*')
      .eq('avatar_id', avatarId)

    if (params?.startDate) {
      const startDate = new Date(params.startDate)
      results?.forEach((r: any) => {
        const publishTime = r.publish_time ? new Date(r.publish_time) : null
        if (publishTime && publishTime < startDate) {
          r._exclude = true
        }
      })
    }

    if (params?.endDate) {
      const endDate = new Date(params.endDate)
      results?.forEach((r: any) => {
        const publishTime = r.publish_time ? new Date(r.publish_time) : null
        if (publishTime && publishTime > endDate) {
          r._exclude = true
        }
      })
    }

    const filteredResults = results?.filter((r: any) => !r._exclude) || []

    const performanceStats = {
      totalExposure: filteredResults.reduce((sum: number, r: any) => sum + (r.actual_exposure || 0), 0),
      totalLikes: filteredResults.reduce((sum: number, r: any) => sum + (r.actual_likes || 0), 0),
      totalComments: filteredResults.reduce((sum: number, r: any) => sum + (r.actual_comments || 0), 0),
      totalShares: filteredResults.reduce((sum: number, r: any) => sum + (r.actual_shares || 0), 0),
      totalViews: filteredResults.reduce((sum: number, r: any) => sum + (r.actual_views || 0), 0),
      avgQualityScore: filteredResults.length > 0
        ? filteredResults.reduce((sum: number, r: any) => sum + (r.quality_score || 0), 0) / filteredResults.length
        : 0,
      avgCustomerRating: filteredResults.length > 0
        ? filteredResults.reduce((sum: number, r: any) => sum + (r.customer_rating || 0), 0) / filteredResults.length
        : 0
    }

    return {
      ...stats,
      performanceStats,
      completionRate: stats.totalOrders > 0 ? (stats.completedOrders / stats.totalOrders * 100) : 0
    }
  }

  /**
   * 分身验收通过
   */
  async approveAvatarOrder(orderId: string, avatarId: string) {
    const client = getSupabaseClient()

    // 获取订单信息和分身信息
    const { data: order } = await client
      .from('orders')
      .select('budget, expected_quantity, title')
      .eq('id', orderId)
      .single()

    if (!order) {
      throw new Error('订单不存在')
    }

    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('user_id, name')
      .eq('id', avatarId)
      .single()

    if (!avatar) {
      throw new Error('分身不存在')
    }

    // 计算每个分身应得的金额
    const rewardAmount = order.budget && order.expected_quantity
      ? order.budget / order.expected_quantity
      : 0

    // 更新分身订单请求状态
    const { error } = await client
      .from('order_dispatch_requests')
      .update({
        status: 'accepted',
        publish_status: {
          feedbackSubmittedAt: new Date().toISOString(),
          status: 'approved'
        },
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .eq('avatar_id', avatarId)

    if (error) {
      throw new Error(`分身验收失败: ${error.message}`)
    }

    // 创建收益记录并结算（验收通过后立即到账）
    if (rewardAmount > 0) {
      // 获取用户当前余额
      const { data: user } = await client
        .from('users')
        .select('balance, total_earnings')
        .eq('id', avatar.user_id)
        .single()

      const currentBalance = Number(user?.balance || 0)
      const currentTotalEarnings = Number(user?.total_earnings || 0)
      const newBalance = currentBalance + rewardAmount
      const newTotalEarnings = currentTotalEarnings + rewardAmount

      // 创建收益记录（已结算状态）
      await this.earningService.createEarning({
        userId: avatar.user_id,
        avatarId: avatarId,
        orderId: orderId,
        type: 'order_reward',
        amount: rewardAmount,
        description: `完成订单「${order.title}」奖励`
      })

      // 更新收益记录状态为已结算
      const { data: earningRecord } = await client
        .from('earnings')
        .select('id')
        .eq('user_id', avatar.user_id)
        .eq('order_id', orderId)
        .eq('avatar_id', avatarId)
        .eq('type', 'order_reward')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (earningRecord) {
        await client
          .from('earnings')
          .update({ status: 'settled' })
          .eq('id', earningRecord.id)
      }

      // 更新用户余额
      await client
        .from('users')
        .update({
          balance: newBalance,
          total_earnings: newTotalEarnings,
          updated_at: new Date().toISOString()
        })
        .eq('id', avatar.user_id)

      console.log(`[验收通过] 分身 ${avatar.name} (ID: ${avatarId}) 获得 ${rewardAmount} 元奖励，余额更新为 ${newBalance} 元`)
    }

    // 检查是否所有分身都已验收，如果是，更新订单状态
    const { data: requests } = await client
      .from('order_dispatch_requests')
      .select('status')
      .eq('order_id', orderId)

    const allApproved = requests?.every(r => r.status === 'accepted')

    if (allApproved) {
      await client
        .from('orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    }

    // 通知分身验收通过
    await this.notifyAvatarApproval(orderId, avatarId)

    return { success: true, rewardAmount }
  }

  /**
   * 分身驳回
   */
  async rejectAvatarOrder(orderId: string, avatarId: string, reason: string) {
    const client = getSupabaseClient()

    // 更新分身订单请求状态
    const { error } = await client
      .from('order_dispatch_requests')
      .update({
        status: 'feedback_required',
        publish_feedback: {
          ...{ reason },
          feedbackSubmittedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .eq('avatar_id', avatarId)

    if (error) {
      throw new Error(`分身驳回失败: ${error.message}`)
    }

    // 通知分身被驳回
    await this.notifyAvatarRejection(orderId, avatarId, reason)

    return { success: true }
  }
}
