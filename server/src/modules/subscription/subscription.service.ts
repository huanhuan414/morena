// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class SubscriptionService {
  private tableColumnsCache = new Map<string, Set<string>>()

  private async getTableColumns(tableName: string): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName)
    if (cached) {
      return cached
    }

    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName]
    )

    const columns = new Set(
      (rows || [])
        .map((row: any) => String(row.columnName || row.COLUMN_NAME || row.column_name || '').toLowerCase())
        .filter(Boolean)
    )

    this.tableColumnsCache.set(tableName, columns)
    return columns
  }

  private filterColumns(data: Record<string, any>, columns: Set<string>) {
    return Object.fromEntries(
      Object.entries(data).filter(([key, value]) => columns.has(key.toLowerCase()) && value !== undefined)
    )
  }

  private inferPlanTier(plan: any): 'free' | 'basic' | 'premium' | 'vip' {
    const raw = String(plan?.tier || plan?.name || plan?.id || '').toLowerCase()
    if (raw.includes('vip') || raw.includes('enterprise')) return 'vip'
    if (raw.includes('premium') || raw.includes('pro')) return 'premium'
    if (raw.includes('basic')) return 'basic'
    return 'free'
  }

  private normalizePlan(plan: any) {
    if (!plan) return null
    let features = plan.features || {}
    if (typeof features === 'string') {
      try {
        features = JSON.parse(features)
      } catch {
        features = {}
      }
    }
    return {
      ...plan,
      tier: plan.tier || this.inferPlanTier(plan),
      features
    }
  }

  async getSubscriptionPlans() {
    const db = getMySQLClient()
    const plans = await db.query('subscription_plans', {}) as any[]
    return (plans || [])
      .map((plan) => this.normalizePlan(plan))
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
  }

  async getPlans() {
    return this.getSubscriptionPlans()
  }

  async getUserSubscription(userId: string) {
    const db = getMySQLClient()
    const subscriptions = await db.query('user_subscriptions', {
      user_id: userId
    }) as any[]
    
    if (!subscriptions || subscriptions.length === 0) {
      return null
    }

    const current = [...subscriptions].sort((a, b) => {
      const aTime = new Date(a.end_date || a.created_at || 0).getTime()
      const bTime = new Date(b.end_date || b.created_at || 0).getTime()
      return bTime - aTime
    })[0]

    const plan = current?.plan_id
      ? this.normalizePlan(await db.queryOne('subscription_plans', { id: current.plan_id }))
      : null

    const endDate = current?.end_date ? new Date(current.end_date) : null
    const isActive = current?.status === 'active' && !!endDate && endDate.getTime() > Date.now()

    return {
      ...current,
      status: isActive ? current.status : (current.status === 'active' ? 'expired' : current.status),
      is_active: isActive,
      plan
    }
  }

  async getAvatarSubscription(avatarId: string) {
    const db = getMySQLClient()
    const avatarSubscription = await db.queryOne('avatar_subscriptions', { avatar_id: avatarId })
    if (avatarSubscription) {
      return avatarSubscription
    }

    const avatar = await db.queryOne('avatars', { id: avatarId })
    if (!avatar?.user_id) {
      return null
    }

    const userSubscription = await this.getUserSubscription(avatar.user_id)
    if (!userSubscription) {
      return null
    }

    return {
      avatar_id: avatarId,
      user_id: avatar.user_id,
      subscription_id: userSubscription.id,
      subscription_level: userSubscription.plan?.tier || userSubscription.tier || 'free',
      can_receive_orders: Boolean(userSubscription.plan?.can_receive_orders ?? userSubscription.plan?.canReceiveOrders),
      start_date: userSubscription.start_date,
      end_date: userSubscription.end_date,
      status: userSubscription.status
    }
  }

  async subscribe(
    userId: string,
    planId: string,
    paymentInfo?: {
      payment_id?: string
      payment_method?: string
    },
    options?: {
      start_date?: Date
      end_date?: Date
      status?: string
      auto_renew?: boolean
    }
  ) {
    const db = getMySQLClient()
    const subscriptionColumns = await this.getTableColumns('user_subscriptions')
    const userColumns = await this.getTableColumns('users')

    const plans = await db.query('subscription_plans', {
      id: planId
    }) as any[]

    const plan = this.normalizePlan(plans?.[0])
    if (!plan) {
      throw new Error('订阅计划不存在')
    }

    const startDate = options?.start_date ? new Date(options.start_date) : new Date()
    const endDate = options?.end_date ? new Date(options.end_date) : new Date(startDate)
    if (!options?.end_date) {
      endDate.setDate(endDate.getDate() + Number(plan.duration_days || 0))
    }

    const id = crypto.randomUUID()
    const insertData = this.filterColumns({
      id,
      user_id: userId,
      plan_id: planId,
      status: options?.status || 'active',
      start_date: startDate,
      end_date: endDate,
      payment_id: paymentInfo?.payment_id || null,
      payment_method: paymentInfo?.payment_method || null,
      auto_renew: options?.auto_renew ?? true,
      created_at: new Date(),
      updated_at: new Date()
    }, subscriptionColumns)

    await db.insert('user_subscriptions', insertData)

    const userUpdateData = this.filterColumns({
      subscription_tier: plan.tier,
      subscription_expires_at: endDate
    }, userColumns)

    if (Object.keys(userUpdateData).length > 0) {
      await db.updateWhere('users', { id: userId }, userUpdateData)
    }

    return { id, plan_id: planId, end_date: endDate }
  }

  async cancelSubscription(userId: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('user_subscriptions', { user_id: userId }, {
      status: 'cancelled',
      auto_renew: false,
      updated_at: new Date()
    })
    
    return { success: true }
  }

  async createSubscription(userId: string, planId: string) {
    return this.subscribe(userId, planId)
  }

  async activateSubscriptionFromPayment(userId: string, planId: string, paymentInfo: {
    payment_id: string
    payment_method?: string
  }) {
    const db = getMySQLClient()
    const subscriptionColumns = await this.getTableColumns('user_subscriptions')

    if (subscriptionColumns.has('payment_id') && paymentInfo.payment_id) {
      const existingByPayment = await db.queryOne('user_subscriptions', {
        payment_id: paymentInfo.payment_id
      })

      if (existingByPayment) {
        return {
          mode: 'existing',
          subscription: await this.getUserSubscription(userId)
        }
      }
    }

    const current = await this.getUserSubscription(userId)
    const currentPlanId = String(current?.plan_id || current?.planId || '')
    const currentEndDate = current?.end_date ? new Date(current.end_date) : null
    const isCurrentActive = Boolean(
      current?.status === 'active'
      && currentEndDate
      && currentEndDate.getTime() > Date.now()
    )

    if (isCurrentActive && current?.id && currentPlanId === planId && currentEndDate) {
      const nextEndDate = new Date(currentEndDate)
      const plan = this.normalizePlan(await db.queryOne('subscription_plans', { id: planId }))
      nextEndDate.setDate(nextEndDate.getDate() + Number(plan?.duration_days || 0))

      const updateData = this.filterColumns({
        end_date: nextEndDate,
        status: 'active',
        payment_id: paymentInfo.payment_id,
        payment_method: paymentInfo.payment_method || 'wechat',
        updated_at: new Date()
      }, subscriptionColumns)

      await db.updateWhere('user_subscriptions', { id: current.id }, updateData)

      const refreshed = await this.getUserSubscription(userId)
      return {
        mode: 'renewed',
        subscription: refreshed
      }
    }

    await this.subscribe(userId, planId, paymentInfo, {
      status: 'active',
      auto_renew: true
    })

    return {
      mode: 'created',
      subscription: await this.getUserSubscription(userId)
    }
  }

  async canCreateAvatar(userId: string) {
    const db = getMySQLClient()
    const subscription = await this.getUserSubscription(userId)
    const plan = subscription?.plan
    const avatars = await db.query('avatars', { user_id: userId }) as any[]
    const currentCount = avatars?.length || 0
    const maxAvatars = Number(plan?.max_avatars ?? plan?.maxAvatars ?? 1)
    const unlimited = maxAvatars === -1

    return {
      canCreate: unlimited || currentCount < maxAvatars,
      currentCount,
      maxAvatars,
      plan: plan || null
    }
  }

  async canReceiveOrders(avatarId: string) {
    const subscription = await this.getAvatarSubscription(avatarId)
    const canReceive = Boolean(
      subscription?.can_receive_orders
      ?? subscription?.canReceiveOrders
      ?? false
    )

    return {
      canReceive,
      subscription: subscription || null
    }
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
      plan: subscription.plan_id,
      expires_at: endDate
    }
  }
}
