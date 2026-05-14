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
      return user.referral_code || user.referralCode
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
    
    // 邀请人奖励：3元现金
    const INVITER_REWARD = 3
    const INVITEE_REWARD = 2
    
    const id = crypto.randomUUID()
    await db.insert('referrals', {
      id,
      referrer_id: inviter.id,
      referred_id: inviteeId,
      referral_code: code,
      status: 'completed',
      reward_amount: INVITER_REWARD,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    
    await this.earningService.createEarning(inviter.id, {
      type: 'referral_bonus',
      amount: INVITER_REWARD,
      source: 'invite_friend',
      description: '邀请好友奖励'
    })
    
    // 给被邀请人发放奖励：2元现金
    await this.earningService.createEarning(inviteeId, {
      type: 'referral_bonus',
      amount: INVITEE_REWARD,
      source: 'be_invited',
      description: '受邀注册奖励'
    })
    
    // 更新邀请人的邀请计数
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
    
    // 获取或生成邀请码
    const referralCode = await this.generateReferralCode(userId)
    
    const referrals = await db.query('referrals', { referrer_id: userId }) as any
    const completedCount = referrals?.filter((r: any) => r.status === 'completed').length || 0
    
    return {
      referralCode,
      totalInvites: referrals?.length || 0,
      pendingInvites: (referrals?.length || 0) - completedCount,
      completedInvites: completedCount,
      inviterReward: 3,
      inviteeReward: 2,
      totalEarned: completedCount * 3
    }
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
