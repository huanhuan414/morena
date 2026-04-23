import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service'

@Injectable()
export class OrderService {
  constructor(private readonly reverseGeocodingService: ReverseGeocodingService) {}

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
      .select('*, avatars(name, avatar_url)')
      .eq('user_id', userId)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取订单列表失败: ${error.message}`)
    }
    
    return data
  }

  async getOrderById(orderId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('orders')
      .select('*, users(nickname, avatar), avatars(id, name, avatar_url)')
      .eq('id', orderId)
      .single()

    if (error) {
      throw new Error(`获取订单详情失败: ${error.message}`)
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
      data.dispatch_requests = requestsData

      // 兼容旧代码，将第一个request的数据也设置到字段中
      const firstRequest = requestsData[0]
      data.publish_status = firstRequest.publish_status
      data.publish_feedback = firstRequest.publish_feedback
      data.generated_content = firstRequest.generated_content
      data.confirmed_content = firstRequest.confirmed_content
      data.dispatch_request_id = firstRequest.id
      data.dispatch_request_status = firstRequest.status

      // 计算统计数据
      const acceptedRequests = requestsData.filter((r: any) => r.status === 'accepted')
      const submittedRequests = requestsData.filter((r: any) => r.status === 'feedback_submitted' || r.status === 'awaiting_acceptance')

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
        submittedAvatars: submittedRequests.length,
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

      data.summary_stats = summaryStats
    } else {
      data.dispatch_requests = []
      data.summary_stats = null
    }

    return data
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
    
    return data
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
}
