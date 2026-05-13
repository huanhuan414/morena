// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import * as crypto from 'crypto'

@Injectable()
export class ReferralService {
  constructor(private readonly earningService: EarningService) {}

  /**
   * 生成邀请码
   */
  async generateReferralCode(userId: string): Promise<string> {
    const db = getMySQLClient()
    
    const user = await db.queryOne('users', { id: userId }) as any
    
    if (user?.referral_code) {
      return user.referral_code
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
    
    const existingReferral = await db.queryOne('referrals', { invitee_id: inviteeId })
    
    if (existingReferral) {
      throw new Error('您已被邀请过')
    }
    
    const id = crypto.randomUUID()
    await db.insert('referrals', {
      id,
      referrer_id: inviter.id,
      invitee_id: inviteeId,
      referral_code: code,
      status: 'completed',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    // 给邀请人发放奖励
    await this.earningService.createEarning(inviter.id, {
      type: 'referral_bonus',
      amount: 10,
      description: '邀请奖励'
    })
    
    // 更新邀请人的邀请计数
    const inviterRecord = await db.queryOne('users', { id: inviter.id }) as any
    await db.updateWhere('users', { id: inviter.id }, {
      referral_count: (inviterRecord?.referral_count || 0) + 1,
      updated_at: new Date()
    })
    
    return { success: true }
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
      completedInvites: completedCount
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
    
    const list = paginatedReferrals.map((ref: any) => {
      return {
        invitee_nickname: '未知用户',
        invitee_avatar: '',
        status: ref.status,
        created_at: ref.created_at
      }
    })
    
    return {
      list,
      total,
      page,
      pageSize
    }
  }
}
