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
   * 使用邀请码注册
   */
  async useReferralCode(inviteeId: string, code: string) {
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
    
    const INVITER_REWARD = 5
    const INVITEE_REWARD = 5
    
    const id = crypto.randomUUID()
    await db.insert('referrals', {
      id,
      referrer_id: inviter.id,
      referred_id: inviteeId,
      status: 'pending',
      reward_amount: INVITER_REWARD,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    
    // 注册时先记录为 pending，首次创建分身后再触发奖励结算。
    // 这里仍维护邀请计数，便于邀请看板与后台统计即时展示。
    const inviterRecord = await db.queryOne('users', { id: inviter.id }) as any
    await db.updateWhere('users', { id: inviter.id }, {
      referral_count: (inviterRecord?.referral_count || 0) + 1,
      updated_at: new Date()
    })

    return { 
      success: true,
      inviterReward: INVITER_REWARD,
      inviteeReward: INVITEE_REWARD
    }
  }

  /**
   * 获取用户邀请统计
   */
  async getReferralStats(userId: string) {
    const db = getMySQLClient()
    
    const referralCode = await this.generateReferralCode(userId)
    
    const referrals = await db.query('referrals', { referrer_id: userId }) as any
    const completedReferrals = referrals?.filter((r: any) => r.status === 'completed') || []
    const pendingCount = (referrals?.length || 0) - completedReferrals.length
    
    const totalReward = completedReferrals.reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0)
    
    return {
      referralCode,
      totalInvited: referrals?.length || 0,
      totalReward,
      pendingReward: pendingCount * 5,
      totalInvites: referrals?.length || 0,
      pendingInvites: pendingCount,
      completedInvites: completedReferrals.length,
      inviterReward: 5,
      inviteeReward: 5,
      totalEarned: totalReward
    }
  }

  async settleReferralOnFirstAvatar(inviteeId: string) {
    const db = getMySQLClient()
    const pending = await db.queryOne('referrals', { referred_id: inviteeId, status: 'pending' }) as any
    const referral = pending?.data
    if (!referral) return { skipped: true }

    const inviterId = referral.referrer_id || referral.referrerId
    if (!inviterId) return { skipped: true }

    const INVITER_REWARD = 5
    const INVITEE_REWARD = 5
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    await db.updateWhere('referrals', { id: referral.id }, {
      status: 'completed',
      reward_amount: INVITER_REWARD,
    })

    await db.insert('earnings', {
      id: crypto.randomUUID(),
      user_id: inviterId,
      type: 'referral_bonus',
      amount: INVITER_REWARD,
      description: '邀请好友奖励',
      status: 'completed',
      created_at: now,
    })
    await db.insert('earnings', {
      id: crypto.randomUUID(),
      user_id: inviteeId,
      type: 'referral_bonus',
      amount: INVITEE_REWARD,
      description: '受邀创建分身奖励',
      status: 'completed',
      created_at: now,
    })

    await db.query(
      'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = ? WHERE id = ?',
      [INVITER_REWARD, INVITER_REWARD, now, inviterId]
    )
    await db.query(
      'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = ? WHERE id = ?',
      [INVITEE_REWARD, INVITEE_REWARD, now, inviteeId]
    )

    return { completed: true, inviterId }
  }

  /**
   * 获取邀请列表
   */
  async getReferralList(userId: string, page = 1, pageSize = 10) {
    const db = getMySQLClient()
    
    const offset = (page - 1) * pageSize
    const referrals = await db.query('referrals', { referrer_id: userId }) as any
    
    const total = referrals?.length || 0
    const paginatedReferrals = referrals?.slice(offset, offset + pageSize) || []
    
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
      
      return {
        invitee_id: inviteeId,
        invitee_nickname: inviteeNickname,
        invitee_avatar: inviteeAvatar,
        status: ref.status,
        reward_amount: ref.reward_amount || ref.rewardAmount || 0,
        created_at: ref.created_at || ref.createdAt
      }
    }))
    
    return {
      list,
      total,
      page,
      pageSize
    }
  }
}
