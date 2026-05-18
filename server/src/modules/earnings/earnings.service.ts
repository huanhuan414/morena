// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class EarningsService {
  async createEarning(userId: string, data: {
    type: string
    amount: number
    order_id?: string
    order_title?: string
    avatar_id?: string
    avatar_name?: string
    description?: string
    reference_id?: string
  }) {
    const db = getMySQLClient()

    const id = crypto.randomUUID()
    const insertResult = await db.insert('earnings', {
      id,
      user_id: userId,
      order_id: data.order_id || data.reference_id || null,
      order_title: data.order_title || '',
      avatar_id: data.avatar_id || null,
      avatar_name: data.avatar_name || '',
      type: data.type,
      amount: data.amount,
      description: data.description || '',
      status: 'pending',
      created_at: new Date(),
    })

    if (insertResult.error) {
      console.error('[EarningsService] createEarning 失败:', insertResult.error)
    }

    return { id }
  }

  async getEarnings(userId: string, page = 1, pageSize = 20) {
    const pool = getPool()
    const limit = Math.max(1, Number(pageSize) || 20)
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit

    // mysql2 的 LIMIT/OFFSET 必须用内联数值，不能用占位符
    const [rows] = await pool.query(
      `SELECT * FROM earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    )
    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM earnings WHERE user_id = ?',
      [userId]
    )

    return {
      list: rows || [],
      total: countRows[0]?.total || 0,
      page,
      pageSize
    }
  }

  async getEarningStats(userId: string) {
    const pool = getPool()

    const [rows] = await pool.query(
      'SELECT status, SUM(amount) as total_amount FROM earnings WHERE user_id = ? GROUP BY status',
      [userId]
    )

    let totalEarnings = 0
    let pendingAmount = 0
    let settledAmount = 0

    for (const row of rows) {
      const amount = Number(row.total_amount) || 0
      if (row.status === 'settled' || row.status === 'completed') {
        settledAmount += amount
        totalEarnings += amount
      } else if (row.status === 'pending') {
        pendingAmount += amount
      }
    }

    // 从 users 表获取可用余额
    const [userRows] = await pool.query('SELECT balance, frozen_balance FROM users WHERE id = ?', [userId])
    const availableBalance = Number(userRows[0]?.balance) || 0
    const frozenBalance = Number(userRows[0]?.frozen_balance) || 0

    return {
      total_earnings: totalEarnings,
      pending_earnings: pendingAmount,
      available_earnings: availableBalance,
      frozen_balance: frozenBalance,
    }
  }

  async getLeaderboard() {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT e.user_id, u.nickname, u.phone, SUM(e.amount) as total
       FROM earnings e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.status = 'settled'
       GROUP BY e.user_id, u.nickname, u.phone
       ORDER BY total DESC
       LIMIT 50`
    )
    return {
      items: rows || [],
      total: rows?.length || 0
    }
  }

  async updateEarningStatus(earningId: string, status: string) {
    const pool = getPool()

    // 当状态变为已结算时，需要将金额加到用户余额
    if (status === 'settled' || status === 'completed') {
      // 获取收益记录的用户ID和金额
      const [rows] = await pool.query('SELECT user_id, amount FROM earnings WHERE id = ?', [earningId])
      const earning = rows[0]

      if (earning) {
        // 将金额加到用户余额
        await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [earning.amount, earning.user_id])
      }
    }

    await pool.query('UPDATE earnings SET status = ? WHERE id = ?', [status, earningId])
    return { success: true }
  }

  /**
   * 提现申请：冻结余额 → 创建提现记录
   */
  async requestWithdrawal(userId: string, amount: number, paymentMethod: string, paymentAccount: string) {
    const pool = getPool()

    // 检查余额
    const [userRows] = await pool.query('SELECT balance, frozen_balance FROM users WHERE id = ?', [userId])
    const balance = Number(userRows[0]?.balance) || 0

    if (amount <= 0) {
      throw new Error('提现金额必须大于0')
    }
    if (amount > balance) {
      throw new Error(`余额不足，当前可用余额: ${balance}`)
    }

    // 冻结余额
    await pool.query('UPDATE users SET balance = balance - ?, frozen_balance = frozen_balance + ? WHERE id = ?', [amount, amount, userId])

    // 创建提现记录（适配 withdrawals 表结构）
    const id = crypto.randomUUID()
    await pool.query(
      `INSERT INTO withdrawals (id, user_id, amount, bank_name, bank_account, bank_holder, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, userId, amount, paymentMethod === 'wechat' ? '微信' : '银行卡', paymentAccount, '', new Date()]
    )

    return { id, amount, status: 'pending' }
  }
}
