// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class SubscriptionService {
  async getPlans() {
    const db = getMySQLClient()
    return await db.query('subscription_plans', {}) as any[]
  }

  async getUserSubscription(userId: string) {
    const db = getMySQLClient()
    const subscriptions = await db.query('user_subscriptions', {
      user_id: userId
    }) as any[]
    
    if (!subscriptions || subscriptions.length === 0) {
      return null
    }
    
    return subscriptions[0]
  }

  async subscribe(userId: string, planId: string, paymentInfo?: {
    payment_id?: string
    payment_method?: string
  }) {
    const db = getMySQLClient()
    
    const plans = await db.query('subscription_plans', {
      id: planId
    }) as any[]
    
    const plan = plans?.[0]
    if (!plan) {
      throw new Error('订阅计划不存在')
    }
    
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + plan.duration_days)
    
    const id = crypto.randomUUID()
    await db.insert('user_subscriptions', {
      id,
      user_id: userId,
      plan_id: planId,
      status: 'active',
      start_date: startDate,
      end_date: endDate,
      payment_id: paymentInfo?.payment_id || null,
      payment_method: paymentInfo?.payment_method || null,
      auto_renew: true,
      created_at: new Date(),
      updated_at: new Date()
    })
    
    await db.updateWhere('users', { id: userId }, {
      subscription_tier: plan.tier,
      subscription_expires_at: endDate
    })
    
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

import * as crypto from 'crypto'
