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
      'sp.name as plan_name, sp.price as plan_price, sp.duration_days, sp.max_avatars, sp.can_receive_orders, sp.platform_fee_rate ' +
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
      platformFeeRate: sub.platformFeeRate || sub.platform_fee_rate || 0.20,
      plan: {
        id: sub.planId || sub.plan_id,
        name: sub.planName || sub.plan_name,
        price: sub.planPrice || sub.plan_price,
        durationDays: sub.durationDays || sub.duration_days,
        maxAvatars: sub.maxAvatars || sub.max_avatars,
        canReceiveOrders: sub.canReceiveOrders || sub.can_receive_orders,
        platformFeeRate: sub.platformFeeRate || sub.platform_fee_rate || 0.20,
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

  /**
   * 获取用户会员权益（完整版）
   */
  async getMembershipBenefits(userId: string) {
    const db = getMySQLClient()
    
    const subscriptions = await db.query(
      `SELECT us.plan_id, sp.*
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? AND us.status = 'active'
       ORDER BY us.created_at DESC LIMIT 1`,
      [userId]
    ) as any[]
    
    const sub = subscriptions?.[0]
    console.log('[getMembershipBenefits] userId:', userId, 'sub:', JSON.stringify(sub))
    
    if (!sub) {
      const freePlan = await db.query('SELECT * FROM subscription_plans WHERE id = ?', ['plan_free']) as any[]
      const free = freePlan?.[0]
      return {
        level: 'plan_free',
        name: free?.name || '免费版',
        dailyOrderLimit: free?.dailyOrderLimit || free?.daily_order_limit || 5,
        platformFeeRate: Number(free?.platformFeeRate || free?.platform_fee_rate || 0.20),
        orderPriority: free?.orderPriority || free?.order_priority || 1,
        concurrentLimit: free?.concurrentLimit || free?.concurrent_limit || 1,
        avatarLimit: free?.maxAvatars || free?.max_avatars || 1,
        canReceiveOrders: false,
      }
    }
    
    return {
      level: sub.plan_id,
      name: sub.name,
      dailyOrderLimit: sub.dailyOrderLimit || sub.daily_order_limit || 999999,
      platformFeeRate: Number(sub.platformFeeRate || sub.platform_fee_rate || 0.20),
      orderPriority: sub.orderPriority || sub.order_priority || 1,
      concurrentLimit: sub.concurrentLimit || sub.concurrent_limit || 1,
      avatarLimit: sub.maxAvatars || sub.max_avatars || 1,
      canReceiveOrders: sub.canReceiveOrders || sub.can_receive_orders === 1 || sub.can_receive_orders === true,
    }
  }

  /**
   * 检查接单权限（每日次数+同时接单数）
   */
  async checkOrderPermission(userId: string) {
    const benefits = await this.getMembershipBenefits(userId)
    console.log('[checkOrderPermission] benefits:', JSON.stringify(benefits))
    
    const db = getMySQLClient()
    const today = new Date().toISOString().split('T')[0]
    
    // 1. 检查每日次数
    const todayResult = await db.query(
      `SELECT COUNT(*) as cnt FROM order_dispatch_requests WHERE user_id = ? AND DATE(created_at) = ?`,
      [userId, today]
    ) as any[]
    const todayCount = Number(todayResult?.[0]?.cnt || todayResult?.cnt || 0)
    console.log('[checkOrderPermission] todayCount:', todayCount, 'dailyLimit:', benefits.dailyOrderLimit)
    
    if (benefits.dailyOrderLimit !== 999999 && todayCount >= benefits.dailyOrderLimit) {
      return {
        allowed: false,
        reason: `今日接单次数已用完(${todayCount}/${benefits.dailyOrderLimit})，请升级会员获得更多接单次数`
      }
    }
    
    // 2. 检查同时接单数（测试阶段：取消限制，所有用户都可以同时接多个订单）
    // 原有代码（保留作为备用方案）：
    // const pendingResult = await db.query(
    //   `SELECT COUNT(*) as cnt FROM order_dispatch_requests r
    //    LEFT JOIN orders o ON r.order_id = o.id
    //    WHERE r.user_id = ? 
    //      AND r.status IN ('accepted', 'pending_acceptance', 'revision_requested')
    //      AND (o.status IS NULL OR o.status NOT IN ('completed', 'cancelled'))`,
    //   [userId]
    // ) as any[]
    // const pendingCount = Number(pendingResult?.[0]?.cnt || pendingResult?.cnt || 0)
    // console.log('[checkOrderPermission] pendingCount:', pendingCount, 'concurrentLimit:', benefits.concurrentLimit)
    // 
    // if (pendingCount >= benefits.concurrentLimit) {
    //   console.log('[checkOrderPermission] REJECTED: pendingCount >= concurrentLimit')
    //   return {
    //     allowed: false,
    //     reason: `同时接单数已达上限(${pendingCount}/${benefits.concurrentLimit})，请等待当前订单完成后重试`
    //   }
    // }
    
    console.log('[checkOrderPermission] ALLOWED (concurrent limit disabled)')
    return { 
      allowed: true, 
      usedToday: todayCount,
      dailyLimit: benefits.dailyOrderLimit,
      pendingCount: 0,
      concurrentLimit: 999,
    }
  }

  /**
   * 获取用户平台抽成比例
   * @param userId 用户ID
   * @returns 平台抽成比例（0-1）
   */
  async getPlatformFeeRate(userId: string): Promise<number> {
    const benefits = await this.getMembershipBenefits(userId)
    return benefits.platformFeeRate
  }

  /**
   * 计算实际收益（扣除平台抽成）
   * @param userId 用户ID
   * @param baseAmount 原始金额
   * @returns { baseAmount, feeRate, feeAmount, actualAmount }
   */
  async calculateEarnings(userId: string, baseAmount: number): Promise<{
    baseAmount: number
    feeRate: number
    feeAmount: number
    actualAmount: number
  }> {
    const benefits = await this.getMembershipBenefits(userId)
    const feeRate = benefits.platformFeeRate
    const feeAmount = baseAmount * feeRate
    const actualAmount = baseAmount - feeAmount
    
    return {
      baseAmount,
      feeRate,
      feeAmount: Math.round(feeAmount * 100) / 100,
      actualAmount: Math.round(actualAmount * 100) / 100,
    }
  }

  /**
   * 批量计算收益（用于订单结算等场景）
   * @param userIds 用户ID列表
   * @param amounts 对应金额列表
   * @returns Map<userId, { feeRate, feeAmount, actualAmount }>
   */
  async batchCalculateEarnings(
    userIds: string[], 
    amounts: number[]
  ): Promise<Map<string, { feeRate: number; feeAmount: number; actualAmount: number }>> {
    const result = new Map<string, { feeRate: number; feeAmount: number; actualAmount: number }>()
    if (!userIds || userIds.length === 0) return result

    // 批量获取用户权益
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT u.id as user_id, COALESCE(sp.platform_fee_rate, 0.20) as platform_fee_rate
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id IN (?)`,
      [userIds]
    ) as any[]

    const feeRateMap = new Map<string, number>()
    for (const row of rows || []) {
      const uid = row.userId || row.user_id
      const feeRate = Number(row.platformFeeRate || row.platform_fee_rate || 0.20)
      feeRateMap.set(uid, feeRate)
    }

    // 计算每个用户的收益
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i]
      const baseAmount = amounts[i] || 0
      const feeRate = feeRateMap.get(userId) || 0.20
      const feeAmount = baseAmount * feeRate
      const actualAmount = baseAmount - feeAmount
      
      result.set(userId, {
        feeRate,
        feeAmount: Math.round(feeAmount * 100) / 100,
        actualAmount: Math.round(actualAmount * 100) / 100,
      })
    }

    return result
  }

  /**
   * 批量获取用户会员优先级（用于订单匹配排序）
   * @param userIds 用户ID列表
   * @returns Map<userId, orderPriority>
   */
  async getBatchOrderPriority(userIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (!userIds || userIds.length === 0) return result

    const db = getMySQLClient()
    
    // 查询用户的会员优先级
    const rows = await db.query(
      `SELECT u.id as user_id, COALESCE(sp.order_priority, 1) as order_priority
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id IN (?)`,
      [userIds]
    ) as any[]

    for (const row of rows || []) {
      const userId = row.userId || row.user_id
      const priority = Number(row.orderPriority || row.order_priority || 1)
      result.set(userId, priority)
    }

    // 未查询到的用户默认优先级为 1
    for (const userId of userIds) {
      if (!result.has(userId)) {
        result.set(userId, 1)
      }
    }

    return result
  }

  /**
   * 批量获取用户自动接单权益（用于派单时判断是否自动接单）
   * @param userIds 用户ID列表
   * @returns Map<userId, autoAccept>
   */
  async getBatchAutoAccept(userIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>()
    if (!userIds || userIds.length === 0) return result

    const db = getMySQLClient()
    
    // 查询用户的自动接单权益
    const rows = await db.query(
      `SELECT u.id as user_id, COALESCE(sp.auto_accept, 0) as auto_accept
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id IN (?)`,
      [userIds]
    ) as any[]

    for (const row of rows || []) {
      const userId = row.userId || row.user_id
      const autoAccept = Number(row.autoAccept || row.auto_accept || 0) === 1
      result.set(userId, autoAccept)
    }

    // 未查询到的用户默认无自动接单权益
    for (const userId of userIds) {
      if (!result.has(userId)) {
        result.set(userId, false)
      }
    }

    return result
  }

  /**
   * 检查用户是否支持自定义分身接单
   * @param userId 用户ID
   * @returns { allowed: boolean, reason?: string }
   */
  async checkCustomAvatarAccept(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const db = getMySQLClient()
    
    const rows = await db.query(
      `SELECT COALESCE(sp.custom_avatar_accept, 0) as custom_avatar_accept
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id = ?`,
      [userId]
    ) as any[]

    const row = rows?.[0]
    const customAvatarAccept = Number(row?.customAvatarAccept || row?.custom_avatar_accept || 0) === 1

    if (!customAvatarAccept) {
      return {
        allowed: false,
        reason: '自定义分身接单需要专业版及以上套餐，请升级'
      }
    }

    return { allowed: true }
  }

  /**
   * 检查用户托管分身数量限制
   * @param userId 用户ID
   * @returns { allowed: boolean, limit: number, current: number, reason?: string }
   */
  async checkHostingLimit(userId: string): Promise<{ allowed: boolean; limit: number; current: number; reason?: string }> {
    const db = getMySQLClient()
    
    const rows = await db.query(
      `SELECT COALESCE(sp.max_avatars, 1) as max_avatars
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id = ?`,
      [userId]
    ) as any[]

    const row = rows?.[0]
    const maxAvatars = Number(row?.max_avatars || row?.maxAvatars || 1)

    const hostedRows = await db.query(
      `SELECT COUNT(*) as count FROM avatars WHERE user_id = ? AND status = 'active' AND (is_hosted = 1 OR hosting_enabled = 1)`,
      [userId]
    ) as any[]
    const currentHosted = Number(hostedRows?.[0]?.count || 0)

    if (currentHosted >= maxAvatars) {
      return {
        allowed: false,
        limit: maxAvatars,
        current: currentHosted,
        reason: `当前套餐最多托管 ${maxAvatars} 个分身，已托管 ${currentHosted} 个，请升级套餐`
      }
    }

    return { allowed: true, limit: maxAvatars, current: currentHosted }
  }

  /**
   * 获取用户技能权益配置
   * @param userId 用户ID
   */
  async getSkillBenefits(userId: string): Promise<{
    text: { dailyLimit: number; speed: string }
    image: { dailyLimit: number; speed: string }
    video: { dailyLimit: number; speed: string }
    article: { dailyLimit: number; speed: string }
    clothing: { dailyLimit: number; speed: string }
    palm: { dailyLimit: number; speed: string }
  }> {
    const db = getMySQLClient()
    
    const rows = await db.query(
      `SELECT 
        COALESCE(sp.text_daily_limit, -1) as text_daily_limit,
        COALESCE(sp.image_daily_limit, -1) as image_daily_limit,
        COALESCE(sp.video_daily_limit, -1) as video_daily_limit,
        COALESCE(sp.article_daily_limit, 0) as article_daily_limit,
        COALESCE(sp.clothing_daily_limit, 0) as clothing_daily_limit,
        COALESCE(sp.palm_daily_limit, 0) as palm_daily_limit,
        COALESCE(sp.image_speed, 'normal') as image_speed,
        COALESCE(sp.video_speed, 'normal') as video_speed
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id = ?`,
      [userId]
    ) as any[]

    const row = rows?.[0] || {}
    
    return {
      text: { 
        dailyLimit: Number(row.text_daily_limit || row.textDailyLimit || -1), 
        speed: 'normal' 
      },
      image: { 
        dailyLimit: Number(row.image_daily_limit || row.imageDailyLimit || -1), 
        speed: row.image_speed || row.imageSpeed || 'normal' 
      },
      video: { 
        dailyLimit: Number(row.video_daily_limit || row.videoDailyLimit || -1), 
        speed: row.video_speed || row.videoSpeed || 'normal' 
      },
      article: { 
        dailyLimit: Number(row.article_daily_limit || row.articleDailyLimit || 0), 
        speed: 'normal' 
      },
      clothing: { 
        dailyLimit: Number(row.clothing_daily_limit || row.clothingDailyLimit || 0), 
        speed: 'normal' 
      },
      palm: { 
        dailyLimit: Number(row.palm_daily_limit || row.palmDailyLimit || 0), 
        speed: 'normal' 
      },
    }
  }

  /**
   * 获取用户今日技能使用次数
   * @param userId 用户ID
   * @param skillType 技能类型
   */
  async getSkillUsageToday(userId: string, skillType: string): Promise<number> {
    const db = getMySQLClient()
    const today = new Date().toISOString().split('T')[0]
    
    const rows = await db.query(
      `SELECT usage_count FROM user_skill_usage 
       WHERE user_id = ? AND skill_type = ? AND usage_date = ?`,
      [userId, skillType, today]
    ) as any[]

    return Number(rows?.[0]?.usage_count || 0)
  }

  /**
   * 检查技能使用权限
   * @param userId 用户ID
   * @param skillType 技能类型: text/image/video/article/clothing/palm
   */
  async checkSkillPermission(
    userId: string, 
    skillType: string
  ): Promise<{ 
    allowed: boolean
    reason?: string
    dailyLimit: number
    usedToday: number
    remaining: number
  }> {
    const skillBenefits = await this.getSkillBenefits(userId)
    const benefit = skillBenefits[skillType as keyof typeof skillBenefits]
    
    if (!benefit) {
      return { allowed: false, reason: '未知技能类型', dailyLimit: 0, usedToday: 0, remaining: 0 }
    }

    const dailyLimit = benefit.dailyLimit
    
    // dailyLimit = 0 表示不支持该功能
    if (dailyLimit === 0) {
      return { 
        allowed: false, 
        reason: `当前套餐不支持${this.getSkillName(skillType)}功能，请升级套餐`,
        dailyLimit: 0,
        usedToday: 0,
        remaining: 0
      }
    }

    // 获取今日使用次数
    const usedToday = await this.getSkillUsageToday(userId, skillType)
    
    // dailyLimit = -1 表示不限次数
    if (dailyLimit === -1) {
      return { allowed: true, dailyLimit: -1, usedToday, remaining: -1 }
    }

    // 检查是否超过限制
    if (usedToday >= dailyLimit) {
      return { 
        allowed: false, 
        reason: `今日${this.getSkillName(skillType)}次数已用完（${usedToday}/${dailyLimit}），请明天再试或升级套餐`,
        dailyLimit,
        usedToday,
        remaining: 0
      }
    }

    return { 
      allowed: true, 
      dailyLimit, 
      usedToday, 
      remaining: dailyLimit - usedToday 
    }
  }

  /**
   * 记录技能使用（增加使用次数）
   * @param userId 用户ID
   * @param skillType 技能类型
   */
  async recordSkillUsage(userId: string, skillType: string): Promise<void> {
    const db = getMySQLClient()
    const today = new Date().toISOString().split('T')[0]
    const id = crypto.randomUUID()
    
    // 使用 INSERT ... ON DUPLICATE KEY UPDATE
    await db.query(
      `INSERT INTO user_skill_usage (id, user_id, skill_type, usage_date, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         usage_count = usage_count + 1,
         updated_at = NOW()`,
      [id, userId, skillType, today]
    )
  }

  /**
   * 获取技能名称（用于提示信息）
   */
  private getSkillName(skillType: string): string {
    const names: Record<string, string> = {
      text: '文本生成',
      image: '图片生成',
      video: '视频生成',
      article: '公众号文章生成',
      clothing: '衣品改造',
      palm: '看手相',
      image_gen: '图片生成',
      video_gen: '视频生成',
      content_writing: '公众号文章生成',
      palm_reading: '看手相',
      fashion_advice: '衣品改造',
    }
    return names[skillType] || skillType
  }

  /**
   * 批量获取用户所有技能的使用情况
   * @param userId 用户ID
   * @param skillTypes 技能类型列表
   */
  async getBatchSkillUsage(
    userId: string,
    skillTypes: string[]
  ): Promise<Record<string, {
    allowed: boolean
    reason?: string
    dailyLimit: number
    usedToday: number
    remaining: number
    speed?: string
    planName: string
  }>> {
    const result: Record<string, any> = {}
    const db = getMySQLClient()
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // 获取用户会员信息，没有订阅则使用免费版
    const userRows = await db.query(
      `SELECT 
         COALESCE(sp.name, '免费版') as plan_name, 
         COALESCE(sp.article_daily_limit, fp.article_daily_limit) as article_daily_limit,
         COALESCE(sp.clothing_daily_limit, fp.clothing_daily_limit) as clothing_daily_limit,
         COALESCE(sp.palm_daily_limit, fp.palm_daily_limit) as palm_daily_limit,
         COALESCE(sp.image_speed, fp.image_speed) as image_speed,
         COALESCE(sp.video_speed, fp.video_speed) as video_speed
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       LEFT JOIN subscription_plans fp ON fp.id = 'plan_free'
       WHERE u.id = ?`,
      [userId]
    ) as any[]
    const userPlan = userRows?.[0] || {}
    const planName = userPlan.plan_name || userPlan.planName || '免费版'

    // 技能ID到skill_type的映射
    const skillIdToTypeMap: Record<string, string> = {
      content_writing: 'wechat_mp_article',
      article: 'wechat_mp_article',
      fashion_advice: 'fashion_makeover',
      clothing: 'fashion_makeover',
      palm_reading: 'palm_reading',
      palm: 'palm_reading',
      image_gen: 'image_gen',
      image: 'image_gen',
      video_gen: 'video_gen',
      video: 'video_gen',
    }

    // 批量获取今日使用次数（从 ai_skill_records 表）
    const skillTypesForQuery = skillTypes.map(s => skillIdToTypeMap[s] || s)
    const usageRows = await db.query(
      `SELECT skill_type, COUNT(*) as cnt 
       FROM ai_skill_records 
       WHERE user_id = ? AND created_at >= ? AND created_at < ? AND skill_type IN (?)
       GROUP BY skill_type`,
      [userId, startOfDay, endOfDay, skillTypesForQuery]
    ) as any[]

    const usageMap: Record<string, number> = {}
    for (const row of usageRows || []) {
      usageMap[row.skill_type || row.skillType] = Number(row.cnt || 0)
    }

    // 技能类型到权益字段的映射
    const skillLimitMap: Record<string, string> = {
      content_writing: 'article_daily_limit',
      article: 'article_daily_limit',
      fashion_advice: 'clothing_daily_limit',
      clothing: 'clothing_daily_limit',
      palm_reading: 'palm_daily_limit',
      palm: 'palm_daily_limit',
    }

    const skillSpeedMap: Record<string, string> = {
      image_gen: 'image_speed',
      image: 'image_speed',
      video_gen: 'video_speed',
      video: 'video_speed',
    }

    // 处理每个技能
    for (const skillType of skillTypes) {
      // 使用映射获取实际的 skill_type
      const actualSkillType = skillIdToTypeMap[skillType] || skillType
      const usedToday = usageMap[actualSkillType] || 0
      let dailyLimit = -1
      let allowed = true
      let reason: string | undefined
      let speed: string | undefined

      // 获取每日限制
      const limitField = skillLimitMap[skillType]
      if (limitField) {
        dailyLimit = Number(userPlan[limitField] || userPlan[limitField.replace('_daily_limit', 'DailyLimit')] || 0)
        if (dailyLimit === 0) {
          allowed = false
          reason = `当前套餐不支持${this.getSkillName(skillType)}功能，请升级套餐`
        }
      }

      // 获取生成速度
      const speedField = skillSpeedMap[skillType]
      if (speedField) {
        speed = userPlan[speedField] || userPlan[speedField?.replace('_speed', 'Speed')] || 'normal'
      }

      // 计算剩余次数
      let remaining = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - usedToday)
      if (dailyLimit > 0 && usedToday >= dailyLimit) {
        allowed = false
        reason = `今日${this.getSkillName(skillType)}次数已用完`
      }

      result[skillType] = {
        allowed,
        reason,
        dailyLimit,
        usedToday,
        remaining,
        speed,
        planName,
      }
    }

    return result
  }
}
