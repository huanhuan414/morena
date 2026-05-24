// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class SubscriptionService {
  async getPlans() {
    const db = getMySQLClient()
    const plans = await db.query('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price ASC')
    return plans
  }

  /**
   * 按 planId 查询（如 plan_basic, plan_pro）
   * 旧表 id 字段存储的就是 plan_xxx，所以直接按 id 查
   */
  async getPlanByPlanId(planId: string) {
    const db = getMySQLClient()
    const plans = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [planId])
    return plans?.[0] || null
  }

  /**
   * 按 id 查询（主键，同 getPlanByPlanId）
   */
  async getPlanById(id: string) {
    const db = getMySQLClient()
    const plans = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [id])
    return plans?.[0] || null
  }

  /**
   * 获取用户订阅状态
   */
  async getUserSubscription(userId: string) {
    const db = getMySQLClient()
    const subscriptions = await db.query(
      'SELECT us.id, us.status, us.start_date, us.end_date, us.plan_id, ' +
      'sp.name as plan_name, sp.price as plan_price, sp.duration_days, sp.max_avatars, sp.can_receive_orders ' +
      'FROM user_subscriptions us ' +
      'LEFT JOIN subscription_plans sp ON us.plan_id = sp.id ' +
      'WHERE us.user_id = ? ORDER BY us.created_at DESC LIMIT 1',
      [userId]
    )

    if (!subscriptions || subscriptions.length === 0) {
      return null
    }

    const sub = subscriptions[0]
    // 组装 plan 对象供前端使用（注意 getMySQLClient 自动转 camelCase）
    return {
      id: sub.id,
      status: sub.status,
      startDate: sub.startDate || sub.start_date,
      endDate: sub.endDate || sub.end_date,
      maxAvatars: sub.maxAvatars || sub.max_avatars,
      canReceiveOrders: sub.canReceiveOrders || sub.can_receive_orders,
      plan: {
        id: sub.planId || sub.plan_id,
        name: sub.planName || sub.plan_name,
        price: sub.planPrice || sub.plan_price,
        durationDays: sub.durationDays || sub.duration_days,
        maxAvatars: sub.maxAvatars || sub.max_avatars,
        canReceiveOrders: sub.canReceiveOrders || sub.can_receive_orders,
      }
    }
  }

  /**
   * 激活订阅（支付成功后调用）
   */
  async activateSubscription(userId: string, planId: string, paymentOrderId: string) {
    const db = getMySQLClient()

    // 查找 plan（planId 即 subscription_plans.id，如 plan_basic）
    const plan = await this.getPlanById(planId)
    if (!plan) {
      throw new Error('订阅计划不存在')
    }

    // getMySQLClient 自动转 camelCase
    const durationDays = Number(plan.durationDays || plan.duration_days || 30)
    const maxAvatars = Number(plan.maxAvatars || plan.max_avatars || 1)
    const canReceiveOrders = Number(plan.canReceiveOrders || plan.can_receive_orders || 0)

    // 检查是否已有活跃订阅
    const existing = await db.query(
      'SELECT * FROM user_subscriptions WHERE user_id = ? AND status = ? LIMIT 1',
      [userId, 'active']
    )

    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + durationDays)

    if (existing && existing.length > 0) {
      // 更新现有订阅
      await db.query(
        'UPDATE user_subscriptions SET plan_id = ?, status = ?, start_date = ?, end_date = ?, max_avatars = ?, can_receive_orders = ?, updated_at = NOW() WHERE id = ?',
        [plan.id, 'active', startDate, endDate, maxAvatars, canReceiveOrders, existing[0].id]
      )
      return { id: existing[0].id, planId: plan.id, endDate }
    }

    // 新建订阅
    const id = crypto.randomUUID()
    await db.query(
      'INSERT INTO user_subscriptions (id, user_id, plan_id, status, start_date, end_date, max_avatars, can_receive_orders, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [id, userId, plan.id, 'active', startDate, endDate, maxAvatars, canReceiveOrders]
    )

    return { id, planId: plan.id, endDate }
  }

  async cancelSubscription(userId: string) {
    const db = getMySQLClient()
    await db.query(
      'UPDATE user_subscriptions SET status = ?, updated_at = NOW() WHERE user_id = ? AND status = ?',
      ['cancelled', userId, 'active']
    )
    return { success: true }
  }

  async checkSubscriptionStatus(userId: string): Promise<{
    is_active: boolean
    plan?: string
    expires_at?: Date
  }> {
    const subscription = await this.getUserSubscription(userId)

    if (!subscription) {
      return { is_active: false }
    }

    const now = new Date()
    const endDate = new Date(subscription.end_date)

    return {
      is_active: subscription.status === 'active' && endDate > now,
      plan: subscription.plan?.plan_id,
      expires_at: endDate
    }
  }

  /**
   * 权益校验 - 供各模块调用
   * type: check_avatars(分身数量), check_orders(接单权限), check_skills(技能次数), check_feature(功能开关)
   */
  async checkPermission(userId: string, type: string, currentCount: number = 0): Promise<{
    allowed: boolean
    reason?: string
    limit?: number
    current?: number
  }> {
    const subscription = await this.getUserSubscription(userId)

    // 获取当前用户套餐的 features
    let features: any = {}
    let planId = 'plan_free'

    if (subscription && subscription.status === 'active') {
      planId = subscription.plan?.id || 'plan_free'
      const plan = await this.getPlanById(planId)
      if (plan) {
        features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {})
      }
    } else {
      // 免费用户
      const freePlan = await this.getPlanById('plan_free')
      if (freePlan) {
        features = typeof freePlan.features === 'string' ? JSON.parse(freePlan.features) : (freePlan.features || {})
      }
    }

    switch (type) {
      case 'check_avatars': {
        // 测试阶段：取消分身数量限制，所有用户都可以创建无限分身
        return {
          allowed: true,
          limit: 999,
          current: currentCount,
          reason: undefined,
        }
        // 原有代码（保留作为备用方案）：
        // const maxAvatars = features.maxAvatars || features.max_avatars || 1
        // const allowed = currentCount < maxAvatars
        // return {
        //   allowed,
        //   limit: maxAvatars,
        //   current: currentCount,
        //   reason: allowed ? undefined : `当前套餐最多创建 ${maxAvatars} 个分身，请升级套餐`,
        // }
      }
      case 'check_orders': {
        // 测试阶段：取消接单套餐限制，所有用户都可以接单
        return {
          allowed: true,
          reason: undefined,
        }
        // 原有代码（保留作为备用方案）：
        // const canReceive = features.canReceiveOrders || features.can_receive_orders || false
        // return {
        //   allowed: canReceive,
        //   reason: canReceive ? undefined : '接单赚钱需要专业版及以上套餐，请升级',
        // }
      }
      case 'check_skills': {
        const skillUses = features.skillUsesPerDay || features.skill_uses_per_day || 3
        // 简单返回限制数，具体扣减逻辑由调用方实现
        return {
          allowed: true,
          limit: skillUses,
          current: currentCount,
          reason: currentCount >= skillUses ? `今日技能使用已达上限(${skillUses}次)，请升级套餐` : undefined,
        }
      }
      case 'check_feature': {
        // 通用功能检查，返回 features 中的布尔值
        return {
          allowed: true,
          limit: 0,
          current: 0,
        }
      }
      default:
        return { allowed: false, reason: '未知校验类型' }
    }
  }
}
