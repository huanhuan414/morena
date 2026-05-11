// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class EarningService {
  /**
   * 获取用户收益概览
   */
  async getEarningsOverview(userId: string) {
    const db = getMySQLClient()
    
    const user = await db.queryOne('users', { id: userId })
    
    const pendingEarnings = await db.query('earnings', {
      user_id: userId,
      status: 'pending'
    }) as any
    
    const pendingAmount = pendingEarnings?.data?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const monthlyEarnings = await db.queryWhere('earnings',
      `user_id = '${userId}' AND created_at >= '${monthStart.toISOString()}'`
    ) as any
    
    const monthlyAmount = monthlyEarnings?.data?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const totalOrders = await db.countWhere('earnings',
      `user_id = '${userId}' AND type = 'order_reward'`
    )
    
    const totalReferrals = await db.countWhere('earnings',
      `user_id = '${userId}' AND type = 'referral_bonus'`
    )
    
    return {
      balance: user?.balance || 0,
      totalEarnings: user?.total_earnings || 0,
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
    const db = getMySQLClient()
    
    const page = options?.page || 1
    const pageSize = options?.pageSize || 20
    const offset = (page - 1) * pageSize
    
    let where = `user_id = '${userId}'`
    if (options?.type) {
      where += ` AND type = '${options.type}'`
    }
    if (options?.status) {
      where += ` AND status = '${options.status}'`
    }
    
    const list = await db.queryWhere('earnings', where, {
      orderBy: 'created_at',
      orderDirection: 'desc',
      limit: pageSize,
      offset: offset
    }) as any
    
    const total = await db.countWhere('earnings', where)
    
    return {
      list: list?.data || [],
      total: total || 0,
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
    source: string
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
      source: earningData.source,
      description: earningData.description || '',
      avatar_id: earningData.avatar_id || null,
      order_id: earningData.order_id || null,
      created_at: new Date(),
      updated_at: new Date()
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
    const db = getMySQLClient()
    
    const results = []
    for (const participant of participants) {
      const id = crypto.randomUUID()
      await db.insert('earnings', {
        id,
        user_id: participant.user_id,
        type: 'order_reward',
        amount: participant.amount,
        status: 'pending',
        source: `order-${orderId}`,
        description: `订单收益`,
        avatar_id: participant.avatar_id,
        order_id: orderId,
        created_at: new Date(),
        updated_at: new Date()
      })
      results.push({ id, ...participant })
    }
    
    return results
  }

  /**
   * 结算订单收益（将pending状态转为completed并加入余额）
   */
  async settleOrderEarnings(orderId: string) {
    const db = getMySQLClient()
    
    const earnings = await db.query('SELECT * FROM earnings WHERE order_id = ? AND status = ?', [orderId, 'pending']) as any[]
    
    for (const earning of earnings) {
      await db.updateWhere('earnings', { id: earning.id }, {
        status: 'completed',
        updated_at: new Date()
      })
      
      await db.query(
        'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ?, updated_at = ? WHERE id = ?',
        [earning.amount, earning.amount, new Date(), earning.user_id]
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
