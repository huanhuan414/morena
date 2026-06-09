// @ts-nocheck
import { Injectable, Inject } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import * as crypto from 'crypto'

@Injectable()
export class ReferralService {
  constructor(@Inject(EarningService) private readonly earningService: EarningService) {}

  /**
   * 生成邀请码
   */
  async generateReferralCode(userId: string): Promise<string> {
    const db = getMySQLClient()
    
    const user = await db.queryOne('users', { id: userId }) as any
    
    if (user?.referral_code || user?.referralCode) {
      const existingCode = user.referral_code || user.referralCode
      return existingCode
    }
    
    const code = this.generateUniqueCode()
    
    await db.updateWhere('users', { id: userId }, {
      referral_code: code,
      updated_at: new Date()
    })
    
    return code
  }

  /**
   * 生成唯一邀请码
   */
  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * 使用邀请码注册 - 注册就算邀请成功
   * 支持设备ID和IP地址记录
   */
  async useReferralCode(
    inviteeId: string, 
    code: string,
    deviceId?: string,
    ipAddress?: string
  ) {
    const db = getMySQLClient()
    
    const inviter = await db.queryOne('users', { referral_code: code }) as any
    
    if (!inviter) {
      throw new Error('邀请码无效')
    }
    
    if (inviter.id === inviteeId) {
      throw new Error('不能使用自己的邀请码')
    }
    
    const existingReferral = await db.queryOne('referrals', { referred_id: inviteeId })
    
    if (existingReferral) {
      throw new Error('您已被邀请过')
    }
    
    // 检查每日邀请限制（每人每日最多50人）
    const limitInfo = await this.checkDailyInviteLimit(inviter.id)
    if (!limitInfo.allowed) {
      throw new Error(`今日邀请已达上限（${limitInfo.current}/${limitInfo.limit}人），邀请人无法得到奖励，不影响用户注册`)
    }
    
    // 注册就算邀请成功，直接标记为completed
    // 同时记录设备ID和IP地址
    const id = crypto.randomUUID()
    await db.query(
      `INSERT INTO referrals 
       (id, referrer_id, referred_id, referral_code, status, reward_amount, 
        device_id, ip_address, created_at)
       VALUES (?, ?, ?, ?, 'completed', 0, ?, ?, NOW())`,
      [id, inviter.id, inviteeId, code, deviceId || null, ipAddress || null]
    )
    
    // 更新被邀请人的邀请关系
    await db.updateWhere('users', { id: inviteeId }, {
      referred_by: inviter.id,
      invited_by: inviter.id,
      updated_at: new Date()
    })
    
    // 更新邀请人的邀请计数
    const inviterRecord = await db.queryOne('users', { id: inviter.id }) as any
    await db.updateWhere('users', { id: inviter.id }, {
      referral_count: (inviterRecord?.referral_count || 0) + 1,
      updated_at: new Date()
    })
    
    // 立即发放基础奖励（根据阶梯等级）
    await this.distributeBaseReward(inviter.id, inviteeId)

    // 获取当前阶梯的奖励信息
    const tierInfo = await this.getCurrentTier(inviter.id)
    const currentTier = tierInfo.currentTier
    const reward = currentTier ? (currentTier.base_reward || 0) + (currentTier.coins_reward || 0) : 0

    return { 
      inviterId: inviter.id,
      reward: reward,
      success: true,
      message: '邀请成功，奖励已发放'
    }
  }

  /**
   * 获取用户邀请统计
   */
  async getReferralStats(userId: string) {
    const db = getMySQLClient()
    
    const referralCode = await this.generateReferralCode(userId)
    
    // 获取邀请记录
    const referrals = await db.query('referrals', { referrer_id: userId }) as any
    const completedReferrals = referrals?.filter((r: any) => r.status === 'completed') || []
    
    // 计算基础奖励总额（从 referral_rewards 表）
    const baseRewards = await db.query(
      `SELECT SUM(base_reward) as total_base_reward, SUM(coins_reward) as total_coins_reward FROM referral_rewards WHERE referrer_id = ?`,
      [userId]
    ) as any[]
    const totalBaseReward = Number(baseRewards?.[0]?.totalBaseReward || baseRewards?.[0]?.total_base_reward || 0)
    const totalCoinsReward = Number(baseRewards?.[0]?.totalCoinsReward || baseRewards?.[0]?.total_coins_reward || 0)
    
    // 计算返佣奖励总额（从 referral_commissions 表）
    const commissions = await db.query(
      `SELECT SUM(commission_amount) as total_commission FROM referral_commissions WHERE referrer_id = ? AND status = 'completed'`,
      [userId]
    ) as any[]
    const totalCommission = Number(commissions?.[0]?.totalCommission || commissions?.[0]?.total_commission || 0)
    
    // 总奖励 = 基础奖励 + 返佣奖励
    const totalReward = totalBaseReward + totalCommission
    
    return {
      referralCode,
      totalInvited: completedReferrals.length,  // 只计算已完成的邀请
      totalReward,  // 总金额奖励（元）
      totalCoinsReward,  // 总积分奖励
      totalInvites: completedReferrals.length,
      completedInvites: completedReferrals.length,
      totalEarned: totalReward
    }
  }

  /**
   * 获取邀请列表
   */
  async getReferralList(userId: string, page = 1, pageSize = 1000) {
    const db = getMySQLClient()

    console.log('[ReferralService] getReferralList userId:', userId)
    
    const offset = (page - 1) * pageSize
    const referrals = await db.query(
      `SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC`,
      [userId]
    ) as any

    console.log('[ReferralService] referrals:', referrals)
    console.log('[ReferralService] referrals length:', referrals?.length)

    const total = referrals?.length || 0
    const paginatedReferrals = referrals?.slice(offset, offset + pageSize) || []

    // 获取邀请人当前的阶梯等级
    const tierInfo = await this.getCurrentTier(userId)
    const currentTier = tierInfo.currentTier

    const list = await Promise.all(paginatedReferrals.map(async (ref: any) => {
      const inviteeId = ref.referred_id || ref.referredId
      let inviteeNickname = '未知用户'
      let inviteeAvatar = ''

      if (inviteeId) {
        try {
          const invitee = await db.queryOne('users', { id: inviteeId }) as any
          if (invitee) {
            inviteeNickname = invitee.nickname || inviteeNickname
            inviteeAvatar = invitee.avatar || ''
          }
        } catch (e) {
          console.error('[ReferralService] 获取被邀请人信息失败:', e)
        }
      }

      // 查询该好友的所有返佣记录
      console.log('[ReferralService] 查询返佣记录 userId:', userId, 'inviteeId:', inviteeId)
      const commissionRecords = await db.query(
        `SELECT
          consumption_type,
          consumption_amount,
          commission_amount,
          created_at as commission_time
         FROM referral_commissions
         WHERE referrer_id = ? AND referred_id = ? AND status = 'completed'
         ORDER BY created_at DESC`,
        [userId, inviteeId]
      ) as any[]
      console.log('[ReferralService] commissionRecords:', commissionRecords)

      // 计算总返佣金额
      const totalCommission = commissionRecords?.reduce((sum, record) => {
        return sum + Number(record.commissionAmount || record.commission_amount || 0)
      }, 0) || 0

      // 格式化返佣记录
      const formattedCommissionRecords = (commissionRecords || []).map(record => ({
        consumption_type: record.consumptionType || record.consumption_type,
        consumption_amount: Number(record.consumptionAmount || record.consumption_amount || 0),
        commission_amount: Number(record.commissionAmount || record.commission_amount || 0),
        commission_time: record.commissionTime || record.commission_time
      }))

      // 查询该好友的注册奖励记录
      const rewardRecord = await db.query(
        `SELECT base_reward, coins_reward
         FROM referral_rewards
         WHERE referrer_id = ? AND referred_id = ? AND reward_type = 'base'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, inviteeId]
      ) as any[]

      // 获取注册时的实际积分奖励和现金奖励
      const coinsReward = Number(rewardRecord?.[0]?.coins_reward || rewardRecord?.[0]?.coinsReward || 10)
      const baseReward = Number(rewardRecord?.[0]?.base_reward || rewardRecord?.[0]?.baseReward || 0)

      return {
        invitee_id: inviteeId,
        invitee_nickname: inviteeNickname,
        invitee_avatar: inviteeAvatar,
        invite_time: ref.created_at || ref.createdAt,
        commission_records: formattedCommissionRecords,
        total_commission: totalCommission,
        has_commission: formattedCommissionRecords.length > 0,
        status: ref.status,
        reward_amount: ref.reward_amount || ref.rewardAmount || 0,
        coins_reward: coinsReward,  // 注册时的实际积分奖励
        base_reward: baseReward,      // 注册时的实际现金奖励
      }
    }))

    return {
      list,
      total,
      page,
      pageSize
    }
  }

  /**
   * 获取用户当前阶梯等级
   */
  async getCurrentTier(userId: string): Promise<any> {
    const db = getMySQLClient()

    // 获取用户有效邀请总数（已完成的）
    const result = await db.query(
      `SELECT COUNT(*) as total_invites
       FROM referrals
       WHERE referrer_id = ? AND status = 'completed'`,
      [userId]
    ) as any[]

    console.log('[ReferralService] 查询结果:', result)
    console.log('[ReferralService] 查询结果类型:', typeof result, '是否数组:', Array.isArray(result))
    console.log('[ReferralService] 查询结果长度:', result?.length)
    console.log('[ReferralService] 查询结果第一项:', result?.[0])
    console.log('[ReferralService] 查询结果第一项类型:', typeof result?.[0])

    const totalInvites = Number(result?.[0]?.totalInvites || result?.[0]?.total_invites || 0)
    console.log('[ReferralService] 邀请总数:', totalInvites, '用户ID:', userId)

    // 获取所有阶梯配置
    const tiers = await db.query(
      `SELECT * FROM referral_tiers ORDER BY tier_level ASC`
    ) as any[]

    console.log('[ReferralService] 从数据库查询的阶梯数据:', tiers)

    // 转换字段名（兼容camelCase和snake_case格式）
    const formattedTiers = (tiers || []).map(tier => ({
      id: tier.id,
      tier_level: tier.tierLevel || tier.tier_level,
      min_invites: tier.min_invites ?? tier.minInvites ?? 0,
      max_invites: tier.max_invites ?? tier.maxInvites ?? -1,
      base_reward: Number(tier.base_reward ?? tier.baseReward ?? 0),
      coins_reward: Number(tier.coins_reward ?? tier.coinsReward ?? 0),
      commission_rate: Number(tier.commission_rate ?? tier.commissionRate ?? 0),
      extra_reward: tier.extra_reward ?? tier.extraReward ?? null,
      created_at: tier.created_at ?? tier.createdAt,
      updated_at: tier.updated_at ?? tier.updatedAt
    }))

    console.log('[ReferralService] 格式化后的阶梯数据:', formattedTiers)

    // 找到当前阶梯
    let currentTier = formattedTiers?.[0] || null
    for (const tier of formattedTiers || []) {
      console.log('[ReferralService] 检查阶梯:', tier.tier_level, 'min_invites:', tier.min_invites, 'max_invites:', tier.max_invites)
      console.log('[ReferralService] 判断条件:', 'totalInvites >= min_invites:', totalInvites >= tier.min_invites, 'max_invites === -1:', tier.max_invites === -1, 'totalInvites < max_invites:', totalInvites < tier.max_invites)
      if (totalInvites >= tier.min_invites) {
        if (tier.max_invites === -1 || totalInvites < tier.max_invites) {
          currentTier = tier
          console.log('[ReferralService] 找到匹配的阶梯:', tier.tier_level)
          break
        }
      }
    }

    console.log('[ReferralService] 当前阶梯:', currentTier)
    
    return {
      totalInvites,
      currentTier,
      allTiers: formattedTiers || []
    }
  }

  /**
   * 检查每日邀请限制（每人每日最多50人）
   */
  async checkDailyInviteLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const db = getMySQLClient()
    const today = new Date().toISOString().split('T')[0]
    
    const result = await db.query(
      `SELECT COUNT(*) as count 
       FROM referrals 
       WHERE referrer_id = ? AND DATE(created_at) = ?`,
      [userId, today]
    ) as any[]
    
    const currentCount = Number(result?.[0]?.count || 0)
    const DAILY_LIMIT = 50
    
    return {
      allowed: currentCount < DAILY_LIMIT,
      current: currentCount,
      limit: DAILY_LIMIT
    }
  }



  /**
   * 风控检测：检查设备ID和IP地址是否重复
   */
  async checkRiskControl(userId: string, deviceId: string, ipAddress: string): Promise<{ riskLevel: string; actionTaken: string }> {
    const db = getMySQLClient()
    
    let riskLevel = 'low'
    let actionTaken = 'none'
    
    // 检查设备ID是否重复
    if (deviceId) {
      const deviceResult = await db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE device_id = ? AND id != ?`,
        [deviceId, userId]
      ) as any[]
      
      const deviceCount = Number(deviceResult?.[0]?.count || 0)
      
      if (deviceCount > 0) {
        riskLevel = 'high'
        actionTaken = 'freeze'
        
        // 记录风控信息
        await db.query(
          `INSERT INTO referral_risk_controls 
           (id, user_id, device_id, risk_type, risk_level, action_taken, created_at)
           VALUES (?, ?, ?, 'duplicate_device', ?, ?, NOW())`,
          [crypto.randomUUID(), userId, deviceId, riskLevel, actionTaken]
        )
        
        // 冻结用户
        await db.query(
          `UPDATE users SET status = 'frozen', updated_at = NOW() WHERE id = ?`,
          [userId]
        )
        
        return { riskLevel, actionTaken }
      }
    }
    
    // 检查IP地址是否重复
    if (ipAddress) {
      const ipResult = await db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE ip_address = ? AND id != ?`,
        [ipAddress, userId]
      ) as any[]
      
      const ipCount = Number(ipResult?.[0]?.count || 0)
      
      if (ipCount > 0) {
        riskLevel = 'medium'
        actionTaken = 'warn'
        
        // 记录风控信息
        await db.query(
          `INSERT INTO referral_risk_controls 
           (id, user_id, ip_address, risk_type, risk_level, action_taken, created_at)
           VALUES (?, ?, ?, 'duplicate_ip', ?, ?, NOW())`,
          [crypto.randomUUID(), userId, ipAddress, riskLevel, actionTaken]
        )
        
        return { riskLevel, actionTaken }
      }
    }
    
    return { riskLevel, actionTaken }
  }

  /**
   * 检查用户是否满足新用户首冲会员8折优惠条件
   */
  async checkFirstSubscriptionDiscount(userId: string): Promise<{ eligible: boolean; discountRate: number }> {
    const db = getMySQLClient()
    
    // 1. 检查用户是否是被邀请的新用户
    const referralResult = await db.query(
      `SELECT * FROM referrals WHERE referred_id = ? AND status = 'completed'`,
      [userId]
    ) as any[]
    
    const isInvitedUser = referralResult?.length > 0
    
    // 2. 检查用户是否是首次充值会员
    const subscriptionResult = await db.query(
      `SELECT * FROM user_subscriptions WHERE user_id = ?`,
      [userId]
    ) as any[]
    
    const isFirstSubscription = !subscriptionResult || subscriptionResult.length === 0
    
    // 3. 如果满足条件，返回8折优惠信息
    if (isInvitedUser && isFirstSubscription) {
      return {
        eligible: true,
        discountRate: 0.8  // 8折优惠
      }
    }
    
    return {
      eligible: false,
      discountRate: 1.0  // 无优惠
    }
  }

  /**
   * 发放基础奖励（根据阶梯等级）
   */
  async distributeBaseReward(referrerId: string, referredId: string): Promise<void> {
    const db = getMySQLClient()
    
    // 获取当前阶梯等级
    const tierInfo = await this.getCurrentTier(referrerId)
    const currentTier = tierInfo.currentTier
    
    if (!currentTier) {
      console.log('[ReferralService] 未找到阶梯配置，跳过奖励发放')
      return
    }
    
    // 记录奖励发放
    await db.query(
      `INSERT INTO referral_rewards 
       (id, referrer_id, referred_id, tier_level, base_reward, coins_reward, reward_type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'base', 'completed', NOW())`,
      [crypto.randomUUID(), referrerId, referredId, currentTier.tier_level, currentTier.base_reward, currentTier.coins_reward]
    )
    
    // 发放现金奖励
    if (currentTier.base_reward > 0) {
      await db.query(
        `UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = NOW() WHERE id = ?`,
        [currentTier.base_reward, currentTier.base_reward, referrerId]
      )
      
      // 记录收益
      await db.query(
        `INSERT INTO earnings
         (id, user_id, type, amount, description, status, created_at)
         VALUES (?, ?, 'referral_bonus', ?, '邀请好友奖励', 'settled', NOW())`,
        [crypto.randomUUID(), referrerId, currentTier.base_reward]
      )
    }
    
    // 发放积分奖励
    if (currentTier.coins_reward > 0) {
      // 获取用户当前积分余额
      const user = await db.queryOne('users', { id: referrerId }) as any
      const balanceBefore = user.coins || 0
      const balanceAfter = balanceBefore + currentTier.coins_reward
      
      // 更新用户积分
      await db.query(
        `UPDATE users SET coins = ?, updated_at = NOW() WHERE id = ?`,
        [balanceAfter, referrerId]
      )
      
      // 记录积分交易到 coin_transactions 表
      await db.query(
        `INSERT INTO coin_transactions 
         (id, user_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, 'gift', ?, ?, ?, '邀请好友奖励', NOW())`,
        [crypto.randomUUID(), referrerId, currentTier.coins_reward, balanceBefore, balanceAfter]
      )
    }
    
    console.log(`[ReferralService] 已发放奖励给用户 ${referrerId}: 现金${currentTier.base_reward}元，积分${currentTier.coins_reward}`)
  }

  /**
   * 记录返佣（被邀请用户充值时）
   */
  async recordCommission(referrerId: string, referredId: string, consumptionType: string, consumptionAmount: number): Promise<void> {
    const db = getMySQLClient()
    
    // 获取当前阶梯的返佣比例
    const tierInfo = await this.getCurrentTier(referrerId)
    const currentTier = tierInfo.currentTier
    
    if (!currentTier || currentTier.commission_rate === 0) {
      console.log('[ReferralService] 当前阶梯无返佣，跳过记录')
      return
    }
    
    // 检查是否已存在相同的返佣记录（防止重复发放）
    // 注释：已取消1小时重复检查限制，现在每次充值都会发放返佣
    // const existingCommission = await db.query(
    //   `SELECT * FROM referral_commissions 
    //    WHERE referred_id = ? AND consumption_type = ? AND consumption_amount = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    //   [referredId, consumptionType, consumptionAmount]
    // ) as any[]
    // 
    // if (existingCommission && existingCommission.length > 0) {
    //   console.log(`[ReferralService] 已存在相同返佣记录，跳过发放: referredId=${referredId}, consumptionType=${consumptionType}, amount=${consumptionAmount}`)
    //   return
    // }
    console.log(`[ReferralService] 准备发放返佣: referredId=${referredId}, consumptionType=${consumptionType}, amount=${consumptionAmount}`)
    
    const commissionRate = currentTier.commission_rate
    const commissionAmount = consumptionAmount * commissionRate
    const commissionId = crypto.randomUUID()
    
    // 记录返佣（状态直接为completed）
    await db.query(
      `INSERT INTO referral_commissions 
       (id, referrer_id, referred_id, consumption_type, consumption_amount, commission_rate, commission_amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', NOW())`,
      [commissionId, referrerId, referredId, consumptionType, consumptionAmount, commissionRate, commissionAmount]
    )
    
    // 立即发放返佣金额到用户balance字段
    await db.query(
      `UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = NOW() WHERE id = ?`,
      [commissionAmount, commissionAmount, referrerId]
    )
    
    // 记录收益到earnings表
    await db.query(
      `INSERT INTO earnings
       (id, user_id, type, amount, description, status, created_at)
       VALUES (?, ?, 'referral_commission', ?, '邀请返佣', 'settled', NOW())`,
      [crypto.randomUUID(), referrerId, commissionAmount]
    )
    
    console.log(`[ReferralService] 已发放返佣: 用户${referrerId}获得${commissionAmount}元返佣`)
  }

  /**
   * 发放返佣（充值完成1小时后）
   */
  async distributeCommission(referrerId: string, commissionId: string): Promise<void> {
    const db = getMySQLClient()
    
    // 获取返佣记录
    const result = await db.query(
      `SELECT * FROM referral_commissions WHERE id = ? AND referrer_id = ? AND status = 'pending'`,
      [commissionId, referrerId]
    ) as any[]
    
    const commission = result?.[0]
    if (!commission) {
      console.log('[ReferralService] 未找到待发放的返佣记录')
      return
    }
    
    // 发放返佣金额
    await db.query(
      `UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = NOW() WHERE id = ?`,
      [commission.commission_amount, commission.commission_amount, referrerId]
    )
    
    // 记录收益
    await db.query(
      `INSERT INTO earnings
       (id, user_id, type, amount, description, status, created_at)
       VALUES (?, ?, 'referral_commission', ?, '邀请返佣', 'settled', NOW())`,
      [crypto.randomUUID(), referrerId, commission.commission_amount]
    )
    
    // 更新返佣状态
    await db.query(
      `UPDATE referral_commissions SET status = 'completed', updated_at = NOW() WHERE id = ?`,
      [commissionId]
    )
    
    console.log(`[ReferralService] 已发放返佣给用户 ${referrerId}: ${commission.commission_amount}元`)
  }

  /**
   * 批量发放返佣（定时任务调用）
   */
  async batchDistributeCommissions(): Promise<void> {
    const db = getMySQLClient()
    
    // 获取所有待发放的返佣记录（充值完成1小时后）
    const pendingCommissions = await db.query(
      `SELECT * FROM referral_commissions 
       WHERE status = 'pending' 
       AND TIMESTAMPDIFF(HOUR, created_at, NOW()) >= 1`
    ) as any[]
    
    for (const commission of pendingCommissions || []) {
      try {
        await this.distributeCommission(commission.referrer_id, commission.id)
      } catch (error) {
        console.error(`[ReferralService] 发放返佣失败: ${commission.id}`, error)
      }
    }
    
    console.log(`[ReferralService] 批量发放返佣完成，共处理${pendingCommissions?.length || 0}条记录`)
  }
}
