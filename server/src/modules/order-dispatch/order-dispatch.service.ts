import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

export interface AvatarScore {
  id: string
  name: string
  score: number
  completionRate: number
  level: number
  totalOrders: number
  completedOrders: number
}

@Injectable()
export class OrderDispatchService {
  /**
   * 分身调度算法
   * 根据完成率、活跃度、等级综合评分匹配最合适的分身
   */
  async dispatchOrder(orderId: string): Promise<any> {
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
    
    // 2. 获取所有活跃分身并计算评分
    const { data: avatars } = await client
      .from('avatars')
      .select('id, name, level, exp, completion_rate, total_orders, completed_orders, config, is_hosted')
      .eq('status', 'active')
      .eq('is_hosted', true) // 只选择开启托管的分身
    
    if (!avatars || avatars.length === 0) {
      console.log('[分身调度] 暂无开启托管的分身，订单保持待接单状态')
      return null
    }
    
    // 3. 计算每个分身的综合评分
    const scoredAvatars = avatars.map(avatar => this.calculateAvatarScore(avatar))
    
    // 4. 按评分排序
    scoredAvatars.sort((a, b) => b.score - a.score)
    
    // 5. 选择评分最高的分身
    const selectedAvatar = scoredAvatars[0]
    
    // 6. 分配订单
    await client
      .from('orders')
      .update({
        avatar_id: selectedAvatar.id,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
    
    // 7. 创建执行步骤
    await this.createExecutionSteps(orderId, selectedAvatar.id, order)
    
    // 8. 返回分配结果
    return {
      orderId,
      avatarId: selectedAvatar.id,
      avatarName: selectedAvatar.name,
      score: selectedAvatar.score,
      reason: this.getSelectionReason(selectedAvatar)
    }
  }

  /**
   * 计算分身综合评分
   */
  private calculateAvatarScore(avatar: any): AvatarScore {
    const completionRate = avatar.completion_rate || 100
    const level = avatar.level || 1
    const totalOrders = avatar.total_orders || 0
    const completedOrders = avatar.completed_orders || 0
    
    // 评分权重
    const weights = {
      completionRate: 0.4,  // 完成率权重 40%
      level: 0.3,           // 等级权重 30%
      activity: 0.2,        // 活跃度权重 20%
      experience: 0.1       // 经验权重 10%
    }
    
    // 完成率评分 (0-100)
    const completionScore = completionRate
    
    // 等级评分 (1-100 级映射到 0-100 分)
    const levelScore = Math.min(level * 5, 100)
    
    // 活跃度评分 (基于托管状态和最近活动)
    const activityScore = avatar.is_hosted ? 80 : 50
    
    // 经验评分 (基于完成订单数)
    const experienceScore = Math.min(completedOrders * 2, 100)
    
    // 综合评分
    const totalScore = 
      completionScore * weights.completionRate +
      levelScore * weights.level +
      activityScore * weights.activity +
      experienceScore * weights.experience
    
    return {
      id: avatar.id,
      name: avatar.name,
      score: Math.round(totalScore * 100) / 100,
      completionRate,
      level,
      totalOrders,
      completedOrders
    }
  }

  /**
   * 创建订单执行步骤
   */
  private async createExecutionSteps(orderId: string, avatarId: string, order: any) {
    const client = getSupabaseClient()
    
    const steps = [
      {
        order_id: orderId,
        avatar_id: avatarId,
        step_type: 'planning',
        step_name: '策划方案制定',
        status: 'pending'
      },
      {
        order_id: orderId,
        avatar_id: avatarId,
        step_type: 'content_creation',
        step_name: '内容创作',
        status: 'pending'
      },
      {
        order_id: orderId,
        avatar_id: avatarId,
        step_type: 'distribution',
        step_name: '内容分发',
        status: 'pending'
      },
      {
        order_id: orderId,
        avatar_id: avatarId,
        step_type: 'feedback',
        step_name: '数据反馈',
        status: 'pending'
      }
    ]
    
    await client
      .from('order_executions')
      .insert(steps)
  }

  /**
   * 获取选择原因说明
   */
  private getSelectionReason(avatar: AvatarScore): string {
    const reasons: string[] = []
    
    if (avatar.completionRate >= 95) {
      reasons.push('完成率优秀')
    }
    if (avatar.level >= 5) {
      reasons.push('等级较高')
    }
    if (avatar.completedOrders >= 10) {
      reasons.push('经验丰富')
    }
    
    return reasons.length > 0 ? reasons.join('、') : '综合评分最高'
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
      .order('created_at', { ascending: true })
    
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
    } else if (status === 'completed' || status === 'failed') {
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
    
    // 如果所有步骤都完成，更新订单状态
    if (status === 'completed') {
      await this.checkOrderCompletion(data.order_id)
    }
    
    return data
  }

  /**
   * 检查订单是否全部完成
   */
  private async checkOrderCompletion(orderId: string) {
    const client = getSupabaseClient()
    
    const { data: executions } = await client
      .from('order_executions')
      .select('status')
      .eq('order_id', orderId)
    
    const allCompleted = executions?.every(e => e.status === 'completed')
    
    if (allCompleted) {
      // 更新订单状态为待审核
      await client
        .from('orders')
        .update({
          status: 'reviewing',
          completed_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      // 更新分身统计数据
      const order = await client
        .from('orders')
        .select('avatar_id')
        .eq('id', orderId)
        .single()
      
      if (order.data?.avatar_id) {
        await this.updateAvatarStats(order.data.avatar_id)
      }
    }
  }

  /**
   * 更新分身统计数据
   */
  private async updateAvatarStats(avatarId: string) {
    const client = getSupabaseClient()
    
    // 获取分身当前统计
    const { data: avatar } = await client
      .from('avatars')
      .select('total_orders, completed_orders')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      const newCompleted = (avatar.completed_orders || 0) + 1
      const newTotal = (avatar.total_orders || 0) + 1
      const newRate = (newCompleted / newTotal) * 100
      
      await client
        .from('avatars')
        .update({
          total_orders: newTotal,
          completed_orders: newCompleted,
          completion_rate: Math.round(newRate * 100) / 100
        })
        .eq('id', avatarId)
    }
  }

  /**
   * 获取推荐分身列表
   */
  async getRecommendedAvatars(orderId: string, limit = 5) {
    const client = getSupabaseClient()
    
    const { data: avatars } = await client
      .from('avatars')
      .select('id, name, level, completion_rate, total_orders, completed_orders, is_hosted')
      .eq('status', 'active')
    
    if (!avatars) return []
    
    const scoredAvatars = avatars.map(avatar => this.calculateAvatarScore(avatar))
    scoredAvatars.sort((a, b) => b.score - a.score)
    
    return scoredAvatars.slice(0, limit)
  }
}
