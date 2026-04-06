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
}
