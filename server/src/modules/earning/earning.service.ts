// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class EarningService {
  /**
   * 获取用户收益概览
   * 使用 amount 和 feeRate 计算实际金额：实际金额 = amount * (1 - feeRate)
   * 
   * 状态流转：settled(刚创建) -> pending(提现待审核) -> processing(提现审核中) -> completed(提现成功)
   * 
   * 可提现余额 = settled状态收益 - (提现记录表已结算 + 结算中金额)
   */

  async getEarningsOverview(userId: string) {
    const pool = getPool()

    // 从 users 表获取统计值
    const [userRows] = await pool.query(
      `SELECT fee_total_earnings, fee_balance, frozen_balance FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const totalEarnings = Number(userRows?.[0]?.fee_total_earnings) || 0 // 总累计
    const balance = Number(userRows?.[0]?.fee_balance) || 0        //余额
    const settlingAmount = Number(userRows?.[0]?.frozen_balance) || 0  // 提现中
    const completedAmount = Number((totalEarnings - balance - settlingAmount).toFixed(2)) //已提现
    // 本月收益
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [monthlyRows] = await pool.query(
      `SELECT COALESCE(SUM(fee_amount), 0) as monthlyAmount
       FROM earnings WHERE user_id = ? AND created_at >= ?`,
      [userId, monthStart]
    ) as any[]

    const monthlyAmount = Number(monthlyRows?.[0]?.monthlyAmount) || 0
    // const totalOrders = Number(monthlyRows?.[0]?.totalOrders) || 0

    // 查询 referrals 表中的推荐人数（用于提现门槛判断）
    const [referralRows] = await pool.query(
      `SELECT COUNT(1) as referralCount FROM referrals WHERE referrer_id = ? and status = 'completed'`,
      [userId]
    ) as any[];
    const referralCount = Number(referralRows?.[0]?.referralCount) || 0;
   
    return {
      balance,                       // 可提现余额 = settled - (已结算 + 结算中)
      totalEarnings,                 // 累计收益 = 全部状态
      completedAmount,               // 已结算 = 提现记录表 completed
      settlingAmount,                // 结算中 = 提现记录表 processing + pending + confirming
      monthlyAmount,                 // 本月收益
      // totalOrders,                   // 统计订单数
      referralCount                  // 推荐人数（referrals表中referrer_id=userId的记录数）
    }
  }

  /**
   * 获取收益明细
   * feeAmount 从 amount 和 feeRate 计算：feeAmount = amount * (1 - feeRate)
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
    
    let where = 'user_id = ? AND status IN (?)'
    const params: any[] = [userId, 'settled']
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
    
    // 计算 feeAmount = amount * (1 - feeRate)
    const processedList = (Array.isArray(list) ? list : []).map(item => {
      // const amount = Number(item.amount) || 0
      // const feeRate = Number(item.fee_rate) || 0
      // const feeAmount = Number((amount * (1 - feeRate)).toFixed(2))
      return {
        ...item,
        // feeAmount
      }
    })
    
    return {
      list: processedList,
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

    const results = []
    for (const participant of participants) {
      if (!participant?.user_id || !participant?.avatar_id) continue
      const [existing] = await pool.query(
        'SELECT id FROM earnings WHERE order_id = ? AND avatar_id = ? AND type = ? LIMIT 1',
        [orderId, participant.avatar_id, 'order_reward']
      ) as any[]
      if (existing && existing.length > 0) {
        continue
      }

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
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [earnings] = await conn.query(
        `SELECT id, user_id, amount
         FROM earnings
         WHERE order_id = ? AND status = 'pending'
         FOR UPDATE`,
        [orderId]
      ) as any[]

      for (const earning of (Array.isArray(earnings) ? earnings : [])) {
        await conn.query(
          'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ? WHERE id = ?',
          [earning.amount, earning.amount, earning.user_id]
        )

        await conn.query(
          `UPDATE earnings
           SET status = 'settled', updated_at = NOW()
           WHERE id = ? AND status = 'pending'`,
          [earning.id]
        )
      }

      await conn.commit()
      return { count: Array.isArray(earnings) ? earnings.length : 0 }
    } catch (err) {
      try {
        await conn.rollback()
      } catch {}
      throw err
    } finally {
      conn.release()
    }
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
