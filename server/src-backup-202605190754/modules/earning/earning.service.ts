// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class EarningService {
  /**
   * 获取用户收益概览
   */
  async getEarningsOverview(userId: string) {
    const db = getMySQLClient()
    
    const user = await db.queryOne('users', { id: userId })
    
    const completedEarnings = await db.queryWhere('earnings',
      `user_id = '${userId}' AND status IN ('settled', 'completed')`
    ) as any
    const totalEarnings = completedEarnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const pendingEarnings = await db.queryWhere('earnings',
      `user_id = '${userId}' AND status = 'pending'`
    ) as any
    const pendingAmount = pendingEarnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const monthlyEarnings = await db.queryWhere('earnings',
      `user_id = '${userId}' AND status IN ('settled', 'completed') AND created_at >= '${monthStart.toISOString()}'`
    ) as any
    const monthlyAmount = monthlyEarnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const totalOrders = await db.countWhere('earnings',
      `user_id = '${userId}' AND type = 'order_reward'`
    )
    
    const totalReferrals = await db.countWhere('earnings',
      `user_id = '${userId}' AND type = 'referral_bonus'`
    )
    
    return {
      balance: user?.balance || 0,
      totalEarnings,
      pendingAmount,
      monthlyAmount,
      totalOrders: totalOrders || 0,
      totalReferrals: totalReferrals || 0
    }
  }

  /**
   * 获取收益明细
   */
  async getEarningsList(userId: string, options?: {
    type?: string
    status?: string
    page?: number
    pageSize?: number
  }) {
    const pool = getPool()
    
    const page = options?.page || 1
    const pageSize = options?.pageSize || 20
    const offset = (page - 1) * pageSize
    
    let where = 'user_id = ?'
    const params: any[] = [userId]
    if (options?.type) {
      where += ' AND type = ?'
      params.push(options.type)
    }
    if (options?.status) {
      where += ' AND status = ?'
      params.push(options.status)
    }
    
    const [list] = await pool.query(
      `SELECT * FROM earnings WHERE ${where} ORDER BY created_at DESC LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    )
    
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM earnings WHERE ${where}`,
      params
    )
    
    return {
      list: Array.isArray(list) ? list : [],
      total: countResult?.[0]?.total || 0,
      page,
      pageSize
    }
  }

  /**
   * 创建收益记录
   */
  async createEarning(userId: string, earningData: {
    type: string
    amount: number
    source?: string
    description?: string
    avatar_id?: string
    order_id?: string
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('earnings', {
      id,
      user_id: userId,
      type: earningData.type,
      amount: earningData.amount,
      status: 'pending',
      description: earningData.description || '',
      avatar_id: earningData.avatar_id || null,
      order_id: earningData.order_id || null,
      created_at: new Date()
    })
    
    return await db.queryOne('users', { id })
  }

  /**
   * 订单完成后批量创建收益记录
   */
  async createOrderEarnings(orderId: string, participants: Array<{
    user_id: string
    avatar_id: string
    amount: number
  }>) {
    const pool = getPool()

    // 检查是否已经创建过收益记录
    const [existingEarnings] = await pool.query('SELECT id FROM earnings WHERE order_id = ?', [orderId]) as any[]
    if (existingEarnings && existingEarnings.length > 0) {
      console.log(`[EarningService] 订单 ${orderId} 已创建收益记录，跳过重复创建`)
      return []
    }

    const results = []
    for (const participant of participants) {
      const id = crypto.randomUUID()
      try {
        await pool.query(
          `INSERT INTO earnings (id, user_id, type, amount, status, description, avatar_id, order_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, participant.user_id, 'order_reward', participant.amount, 'pending', '订单收益', participant.avatar_id, orderId, new Date()]
        )
        results.push({ id, ...participant })
      } catch (e) {
        console.error('[EarningService] createOrderEarnings 写入失败:', e.message)
      }
    }

    return results
  }

  /**
   * 结算订单收益（将pending状态转为completed并加入余额）
   */
  async settleOrderEarnings(orderId: string) {
    const pool = getPool()

    const [earnings] = await pool.query('SELECT * FROM earnings WHERE order_id = ? AND status = ?', [orderId, 'pending']) as any[]

    for (const earning of earnings) {
      await pool.query('UPDATE earnings SET status = ? WHERE id = ?', ['settled', earning.id])

      await pool.query(
        'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ? WHERE id = ?',
        [earning.amount, earning.amount, earning.user_id]
      )
    }

    return { count: earnings.length }
  }

  /**
   * 获取订单相关的所有收益记录
   */
  async getOrderEarnings(orderId: string) {
    const db = getMySQLClient()
    
    const earnings = await db.query('SELECT * FROM earnings WHERE order_id = ? ORDER BY created_at DESC', [orderId]) as any[]
    
    return earnings
  }

  /**
   * 确认提现申请
   */
  async confirmWithdrawal(withdrawalId: string) {
    const db = getMySQLClient()
    
    const withdrawal = await db.queryOne('withdrawals', { id: withdrawalId }) as any
    if (!withdrawal || withdrawal.status !== 'pending') {
      throw new Error('提现申请不存在或已处理')
    }
    
    await db.updateWhere('withdrawals', { id: withdrawalId }, {
      status: 'completed',
      updated_at: new Date()
    })
    
    await db.query(
      'UPDATE users SET frozen_balance = frozen_balance - ?, updated_at = ? WHERE id = ?',
      [withdrawal.amount, new Date(), withdrawal.user_id]
    )
    
    return await db.queryOne('withdrawals', { id: withdrawalId })
  }

  /**
   * 拒绝提现申请
   */
  async rejectWithdrawal(withdrawalId: string, reason?: string) {
    const db = getMySQLClient()
    
    const withdrawal = await db.queryOne('withdrawals', { id: withdrawalId }) as any
    if (!withdrawal || withdrawal.status !== 'pending') {
      throw new Error('提现申请不存在或已处理')
    }
    
    await db.updateWhere('withdrawals', { id: withdrawalId }, {
      status: 'rejected',
      rejected_reason: reason || '',
      updated_at: new Date()
    })
    
    await db.query(
      'UPDATE users SET balance = balance + ?, frozen_balance = frozen_balance - ?, updated_at = ? WHERE id = ?',
      [withdrawal.amount, withdrawal.amount, new Date(), withdrawal.user_id]
    )
    
    return await db.queryOne('withdrawals', { id: withdrawalId })
  }

  /**
   * 更新收益状态
   */
  async updateEarningStatus(earningId: string, status: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('earnings', { id: earningId }, {
      status,
      updated_at: new Date()
    })
    
    return await db.queryOne('earnings', { id: earningId })
  }

  /**
   * 获取交易记录
   */
  async getTransactions(userId: string, page: number = 1, pageSize: number = 20) {
    const db = getMySQLClient()
    const offset = (page - 1) * pageSize
    
    const list = await db.query('transactions', { user_id: userId }, {
      orderBy: 'created_at',
      orderDirection: 'desc',
      limit: pageSize,
      offset: offset
    }) as any
    
    const total = await db.count('transactions', { user_id: userId })
    
    return { list: list?.data || [], total: total || 0 }
  }

  /**
   * 创建提现申请
   */
  async createWithdrawal(userId: string, withdrawalData: {
    amount: number
    method: string
    account: string
  }) {
    const db = getMySQLClient()
    
    const user = await db.queryOne('users', { id: userId }) as any
    if (!user || (user.balance || 0) < withdrawalData.amount) {
      throw new Error('余额不足')
    }
    
    const id = crypto.randomUUID()
    await db.insert('withdrawals', {
      id,
      user_id: userId,
      amount: withdrawalData.amount,
      method: withdrawalData.method,
      account: withdrawalData.account,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    // 冻结余额
    await db.updateWhere('users', { id: userId }, {
      frozen_balance: (user.frozen_balance || 0) + withdrawalData.amount,
      updated_at: new Date()
    })
    
    return await db.queryOne('withdrawals', { id })
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(userId: string, page: number = 1, pageSize: number = 20) {
    const db = getMySQLClient()
    const offset = (page - 1) * pageSize
    
    const list = await db.query('withdrawals', { user_id: userId }, {
      orderBy: 'created_at',
      orderDirection: 'desc',
      limit: pageSize,
      offset: offset
    }) as any
    
    const total = await db.count('withdrawals', { user_id: userId })
    
    return { list: list?.data || [], total: total || 0 }
  }
}
