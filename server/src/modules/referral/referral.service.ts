// @ts-nocheck
import { Injectable, Inject } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
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
    console.log('[ReferralService] generateReferralCode - userId:', userId)
    console.log('[ReferralService] user data:', { 
      referral_code: user?.referral_code, 
      referralCode: user?.referralCode 
    })
    
    if (user?.referral_code || user?.referralCode) {
      const existingCode = user.referral_code || user.referralCode
      console.log('[ReferralService] returning existing code:', existingCode)
      return existingCode
    }
    
    const code = this.generateUniqueCode()
    console.log('[ReferralService] generating new code:', code)
    
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
    const pool = getPool()
    const conn = await pool.getConnection()

    const INVITER_REWARD = 5
    const INVITEE_REWARD = 5
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    try {
      await conn.beginTransaction()

      const [inviterRows] = await conn.query(
        'SELECT id FROM users WHERE referral_code = ? LIMIT 1',
        [code]
      ) as any[]
      const inviter = (inviterRows as any[])?.[0]

      if (!inviter) {
        throw new Error('邀请码无效')
      }

      if (inviter.id === inviteeId) {
        throw new Error('不能使用自己的邀请码')
      }

      await conn.query('SELECT id FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [inviteeId])

      const [existingRows] = await conn.query(
        `SELECT id FROM referrals WHERE referred_id = ? LIMIT 1`,
        [inviteeId]
      ) as any[]
      if ((existingRows as any[])?.length) {
        throw new Error('您已被邀请过')
      }

      const id = crypto.randomUUID()
      await conn.query(
        `INSERT INTO referrals (id, referrer_id, referred_id, status, reward_amount, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [id, inviter.id, inviteeId, INVITER_REWARD, now]
      )

      await conn.query(
        'UPDATE users SET referral_count = referral_count + 1, updated_at = ? WHERE id = ?',
        [now, inviter.id]
      )

      await conn.commit()
      return {
        success: true,
        inviterReward: INVITER_REWARD,
        inviteeReward: INVITEE_REWARD
      }
    } catch (error) {
      try {
        await conn.rollback()
      } catch {}
      throw error
    } finally {
      conn.release()
    }
  }

  /**
   * 获取用户邀请统计
   */
  async getReferralStats(userId: string) {
    const db = getMySQLClient()
    
    const referralCode = await this.generateReferralCode(userId)

    const referrals = await db.query(`SELECT * FROM referrals WHERE referrer_id = ?`, [userId]) as any
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
    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      const [pendingRows] = await conn.query(
        `SELECT id, referrer_id, referred_id
         FROM referrals
         WHERE referred_id = ? AND status = 'pending'
         LIMIT 1
         FOR UPDATE`,
        [inviteeId]
      ) as any[]
      const referral = (pendingRows as any[])?.[0]

      if (!referral) {
        await conn.rollback()
        return { skipped: true }
      }

      const inviterId = referral.referrer_id || referral.referrerId
      if (!inviterId) {
        await conn.rollback()
        return { skipped: true }
      }

      const INVITER_REWARD = 5
      const INVITEE_REWARD = 5
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

      const [updateResult] = await conn.query(
        `UPDATE referrals
         SET status = 'completed',
             reward_amount = ?
         WHERE id = ? AND status = 'pending'`,
        [INVITER_REWARD, referral.id]
      ) as any[]

      if (Number((updateResult as any)?.affectedRows || 0) !== 1) {
        await conn.rollback()
        return { skipped: true }
      }

      const [inviterUserRows] = await conn.query(
        `SELECT balance FROM users WHERE id = ? FOR UPDATE`,
        [inviterId]
      ) as any[]
      const inviterBalanceBefore = Number(inviterUserRows?.[0]?.balance) || 0

      const [inviteeUserRows] = await conn.query(
        `SELECT balance FROM users WHERE id = ? FOR UPDATE`,
        [inviteeId]
      ) as any[]
      const inviteeBalanceBefore = Number(inviteeUserRows?.[0]?.balance) || 0

      await this.earningService.createSettledEarningRecord(conn, {
        userId: inviterId,
        type: 'referral_bonus',
        amount: INVITER_REWARD,
        description: '邀请好友奖励',
        createdAt: now,
      })
      await this.earningService.createSettledEarningRecord(conn, {
        userId: inviteeId,
        type: 'referral_bonus',
        amount: INVITEE_REWARD,
        description: '受邀创建分身奖励',
        createdAt: now,
      })

      await conn.query(
        `UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = ? WHERE id = ?`,
        [INVITER_REWARD, INVITER_REWARD, now, inviterId]
      )
      await conn.query(
        `UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = ? WHERE id = ?`,
        [INVITEE_REWARD, INVITEE_REWARD, now, inviteeId]
      )

      await this.earningService.writeTransaction(conn, {
        userId: inviterId,
        type: 'referral_bonus_inviter',
        amount: INVITER_REWARD,
        balanceBefore: inviterBalanceBefore,
        balanceAfter: inviterBalanceBefore + INVITER_REWARD,
        frozenBefore: 0,
        frozenAfter: 0,
        status: 'completed',
        description: '邀请好友奖励',
        referenceId: referral.id,
        idempotencyKey: `referral_bonus_inviter:${referral.id}`,
      })

      await this.earningService.writeTransaction(conn, {
        userId: inviteeId,
        type: 'referral_bonus_invitee',
        amount: INVITEE_REWARD,
        balanceBefore: inviteeBalanceBefore,
        balanceAfter: inviteeBalanceBefore + INVITEE_REWARD,
        frozenBefore: 0,
        frozenAfter: 0,
        status: 'completed',
        description: '受邀创建分身奖励',
        referenceId: referral.id,
        idempotencyKey: `referral_bonus_invitee:${referral.id}`,
      })

      await conn.commit()
      return { completed: true, inviterId }
    } catch (error) {
      try {
        await conn.rollback()
      } catch {}
      throw error
    } finally {
      conn.release()
    }
  }

  /**
   * 获取邀请列表
   */
  async getReferralList(userId: string, page = 1, pageSize = 10) {
    const db = getMySQLClient()
    
    const offset = (page - 1) * pageSize
    const referrals = await db.query(`SELECT * FROM referrals WHERE referrer_id = ?`, [userId]) as any
    
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
