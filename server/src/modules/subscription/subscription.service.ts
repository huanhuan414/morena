import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { SubscriptionPlan, UserSubscription, AvatarSubscription } from './subscription.entity'

@Injectable()
export class SubscriptionService {
  /**
   * 获取所有活跃的订阅计划
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      throw new Error(`获取订阅计划失败: ${error.message}`)
    }

    return (data || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: parseFloat(plan.price),
      duration_days: plan.duration_days,
      max_avatars: plan.max_avatars,
      can_receive_orders: plan.can_receive_orders,
      order_priority: plan.order_priority,
      features: plan.features || {},
      display_order: plan.display_order,
      is_active: plan.is_active,
      created_at: plan.created_at,
      updated_at: plan.updated_at
    }))
  }

  /**
   * 获取用户的当前订阅
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      user_id: data.user_id,
      plan_id: data.plan_id,
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status,
      payment_id: data.payment_id,
      payment_method: data.payment_method,
      auto_renew: data.auto_renew,
      created_at: data.created_at,
      updated_at: data.updated_at,
      plan: data.plan ? {
        id: data.plan.id,
        name: data.plan.name,
        description: data.plan.description,
        price: parseFloat(data.plan.price),
        duration_days: data.plan.duration_days,
        max_avatars: data.plan.max_avatars,
        can_receive_orders: data.plan.can_receive_orders,
        order_priority: data.plan.order_priority,
        features: data.plan.features || {},
        display_order: data.plan.display_order,
        is_active: data.plan.is_active,
        created_at: data.plan.created_at,
        updated_at: data.plan.updated_at
      } : undefined
    }
  }

  /**
   * 获取分身的订阅信息
   */
  async getAvatarSubscription(avatarId: string): Promise<AvatarSubscription | null> {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('avatar_subscriptions')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      user_id: data.user_id,
      avatar_id: data.avatar_id,
      subscription_id: data.subscription_id,
      subscription_level: data.subscription_level,
      can_receive_orders: data.can_receive_orders,
      order_priority: data.order_priority,
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at
    }
  }

  /**
   * 检查用户是否可以创建新的分身
   */
  async canCreateAvatar(userId: string): Promise<{ canCreate: boolean, reason?: string }> {
    const client = getSupabaseClient()

    // 获取用户当前订阅
    const subscription = await this.getUserSubscription(userId)

    // 获取用户当前分身数量
    const { count: avatarCount } = await client
      .from('avatars')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')

    // 没有订阅，只能创建1个免费分身
    if (!subscription) {
      if ((avatarCount || 0) >= 1) {
        return {
          canCreate: false,
          reason: '免费用户只能创建1个分身，请升级订阅以创建更多分身'
        }
      }
      return { canCreate: true }
    }

    // 检查订阅是否过期
    const now = new Date()
    const endDate = new Date(subscription.end_date)
    if (endDate < now) {
      return {
        canCreate: false,
        reason: '订阅已过期，请续费以创建更多分身'
      }
    }

    // 检查分身数量限制
    const maxAvatars = subscription.plan?.max_avatars || 1
    if (maxAvatars !== -1 && (avatarCount || 0) >= maxAvatars) {
      return {
        canCreate: false,
        reason: `当前订阅计划最多支持${maxAvatars}个分身，请升级订阅以创建更多分身`
      }
    }

    return { canCreate: true }
  }

  /**
   * 更新分身订阅信息（用于创建/删除分身时更新）
   */
  async updateAvatarSubscription(avatarId: string, userId: string): Promise<void> {
    const client = getSupabaseClient()

    // 获取用户订阅
    const subscription = await this.getUserSubscription(userId)

    // 确定订阅等级
    let subscriptionLevel = 'free'
    let canReceiveOrders = false
    let orderPriority = 0

    if (subscription) {
      const now = new Date()
      const endDate = new Date(subscription.end_date)

      if (endDate >= now && subscription.plan) {
        // 根据订阅计划确定等级
        if (subscription.plan.name.includes('尊享') || subscription.plan.name.includes('VIP')) {
          subscriptionLevel = 'vip'
        } else if (subscription.plan.name.includes('高级') || subscription.plan.name.includes('Premium')) {
          subscriptionLevel = 'premium'
        } else if (subscription.plan.name.includes('基础') || subscription.plan.name.includes('Basic')) {
          subscriptionLevel = 'basic'
        }

        canReceiveOrders = subscription.plan.can_receive_orders
        orderPriority = subscription.plan.order_priority
      }
    }

    // 更新或创建分身订阅记录
    const { data: existing } = await client
      .from('avatar_subscriptions')
      .select('*')
      .eq('avatar_id', avatarId)
      .single()

    if (existing) {
      await client
        .from('avatar_subscriptions')
        .update({
          subscription_id: subscription?.id,
          subscription_level: subscriptionLevel,
          can_receive_orders: canReceiveOrders,
          order_priority: orderPriority,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      await client
        .from('avatar_subscriptions')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          subscription_id: subscription?.id,
          subscription_level: subscriptionLevel,
          can_receive_orders: canReceiveOrders,
          order_priority: orderPriority,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    }
  }

  /**
   * 检查分身是否可以接单
   */
  async canAvatarReceiveOrders(avatarId: string): Promise<boolean> {
    const subscription = await this.getAvatarSubscription(avatarId)

    if (!subscription) {
      return false
    }

    return subscription.can_receive_orders
  }

  /**
   * 获取分身的订单优先级
   */
  async getAvatarOrderPriority(avatarId: string): Promise<number> {
    const subscription = await this.getAvatarSubscription(avatarId)

    if (!subscription) {
      return 0
    }

    return subscription.order_priority
  }

  /**
   * 初始化分身订阅（创建分身时调用）
   */
  async initAvatarSubscription(avatarId: string, userId: string): Promise<void> {
    await this.updateAvatarSubscription(avatarId, userId)
  }
}
