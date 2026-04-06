import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class OrderService {
  async createOrder(userId: string, orderData: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('orders')
      .insert({
        user_id: userId,
        title: orderData.title,
        description: orderData.description,
        requirements: orderData.requirements || {},
        budget: orderData.budget,
        status: 'open'
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
    
    const { count: completed } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    return {
      total: total || 0,
      open: open || 0,
      inProgress: inProgress || 0,
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
      await client
        .from('users')
        .update({
          available_balance: client.sql`available_balance + ${earningsAmount}`,
          total_earnings: client.sql`total_earnings + ${earningsAmount}`,
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
    const platformStats = this.calculatePlatformStats(order.result, posts)
    
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
}
