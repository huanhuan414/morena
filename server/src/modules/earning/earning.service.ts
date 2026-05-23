// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class EarningService {
  private toIsoString(value: any): string | null {
    if (!value) return null
    if (value instanceof Date) return value.toISOString()
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
  }

  private async insertTransaction(
    conn: any,
    payload: {
      userId: string
      type: string
      amount: number
      balanceBefore: number
      balanceAfter: number
      frozenBefore?: number
      frozenAfter?: number
      status?: string
      description?: string
      referenceId?: string | null
      idempotencyKey?: string | null
    }
  ) {
    const id = crypto.randomUUID()
    await conn.query(
      `INSERT INTO transactions (
        id,
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        frozen_before,
        frozen_after,
        status,
        description,
        reference_id,
        idempotency_key,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id`,
      [
        id,
        payload.userId,
        payload.type,
        payload.amount,
        payload.balanceBefore,
        payload.balanceAfter,
        Number(payload.frozenBefore || 0),
        Number(payload.frozenAfter || 0),
        payload.status || 'completed',
        payload.description || '',
        payload.referenceId || null,
        payload.idempotencyKey || null,
        new Date(),
      ]
    )
  }

  async writeTransaction(
    conn: any,
    payload: {
      userId: string
      type: string
      amount: number
      balanceBefore: number
      balanceAfter: number
      frozenBefore?: number
      frozenAfter?: number
      status?: string
      description?: string
      referenceId?: string | null
      idempotencyKey?: string | null
    }
  ) {
    await this.insertTransaction(conn, payload)
  }

  async createSettledEarningRecord(
    conn: any,
    payload: {
      userId: string
      type: string
      amount: number
      description?: string
      avatarId?: string | null
      orderId?: string | null
      createdAt?: Date | string
    }
  ) {
    await conn.query(
      `INSERT INTO earnings (id, user_id, type, amount, status, description, avatar_id, order_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        payload.userId,
        payload.type,
        payload.amount,
        'settled',
        payload.description || '',
        payload.avatarId || null,
        payload.orderId || null,
        payload.createdAt || new Date(),
      ]
    )
  }

  private normalizeEarningStatus(status?: string): string {
    const value = String(status || '').trim().toLowerCase()
    if (value === 'completed') return 'settled'
    return value || 'pending'
  }

  private serializeEarningRecord(record: any): any {
    const createdAt = this.toIsoString(record?.createdAt || record?.created_at)
    const updatedAt = this.toIsoString(record?.updatedAt || record?.updated_at)
    const userId = record?.userId || record?.user_id || null
    const avatarId = record?.avatarId || record?.avatar_id || null
    const orderId = record?.orderId || record?.order_id || null
    const status = this.normalizeEarningStatus(record?.status)

    return {
      id: record?.id,
      userId,
      avatarId,
      orderId,
      type: record?.type || '',
      amount: Number(record?.amount || 0),
      status,
      description: record?.description || '',
      createdAt,
      updatedAt,
      user_id: userId,
      avatar_id: avatarId,
      order_id: orderId,
      created_at: createdAt,
      updated_at: updatedAt,
    }
  }

  async getLeaderboard(limit: number = 50) {
    const pool = getPool()
    const safeLimit = (() => {
      const n = Number(limit)
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 200) : 50
    })()

    const [rows] = await pool.query(
      `SELECT 
         e.user_id as avatar_id,
         COALESCE(u.nickname, '') as avatar_name,
         SUM(CASE WHEN e.status IN ('settled', 'completed') THEN e.amount ELSE 0 END) as total_earnings,
         SUM(CASE WHEN e.type = 'order_reward' AND e.status IN ('settled', 'completed') THEN 1 ELSE 0 END) as completed_orders
       FROM earnings e
       LEFT JOIN users u ON e.user_id = u.id
       GROUP BY e.user_id, u.nickname
       ORDER BY total_earnings DESC
       LIMIT ?`,
      [safeLimit]
    )

    const items = Array.isArray(rows) ? rows : []
    return {
      items,
      records: items,
      total: items.length
    }
  }
  /**
   * 获取用户收益概览
   */
  async getEarningsOverview(userId: string) {
    const db = getMySQLClient()
    
    const user = await db.queryOne('users', { id: userId })
    
    const completedEarnings = await db.query(
      "SELECT * FROM earnings WHERE user_id = ? AND status IN ('settled', 'completed')",
      [userId]
    ) as any
    const totalEarnings = completedEarnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const pendingEarnings = await db.query(
      "SELECT * FROM earnings WHERE user_id = ? AND status = 'pending'",
      [userId]
    ) as any
    const pendingAmount = pendingEarnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const monthlyEarnings = await db.query(
      "SELECT * FROM earnings WHERE user_id = ? AND status IN ('settled', 'completed') AND created_at >= ?",
      [userId, monthStart]
    ) as any
    const monthlyAmount = monthlyEarnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
    
    const totalOrdersRows = await db.query(
      `SELECT COUNT(*) as count FROM earnings WHERE user_id = ? AND type = 'order_reward'`,
      [userId]
    ) as any[]
    const totalOrders = Number(totalOrdersRows?.[0]?.count) || 0
    
    const totalReferralsRows = await db.query(
      `SELECT COUNT(*) as count FROM earnings WHERE user_id = ? AND type = 'referral_bonus'`,
      [userId]
    ) as any[]
    const totalReferrals = Number(totalReferralsRows?.[0]?.count) || 0
    
    return {
      balance: Number(user?.balance || 0),
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
    const pageSizeRaw = options?.pageSize || 20
    const safePageSize = (() => {
      const n = Number(pageSizeRaw)
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 200) : 20
    })()
    const safeOffset = (page - 1) * safePageSize
    
    let where = 'user_id = ?'
    const params: any[] = [userId]
    if (options?.type) {
      where += ` AND type = ?`
      params.push(options.type)
    }
    if (options?.status) {
      where += ' AND status = ?'
      params.push(options.status)
    }
    
    const listSql =
      'SELECT * FROM earnings WHERE ' + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    const [list] = await pool.query(listSql, [...params, safePageSize, safeOffset])
    
    const countSql = 'SELECT COUNT(*) as total FROM earnings WHERE ' + where
    const [countResult] = await pool.query(countSql, params)
    
    const normalizedList = (Array.isArray(list) ? list : []).map((item: any) => this.serializeEarningRecord(item))

    return {
      list: normalizedList,
      total: countResult?.[0]?.total || 0,
      page,
      pageSize: safePageSize
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
    await db.query(
      `INSERT INTO earnings (id, user_id, type, amount, status, description, avatar_id, order_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        earningData.type,
        earningData.amount,
        'pending',
        earningData.description || '',
        earningData.avatar_id || null,
        earningData.order_id || null,
        new Date(),
      ]
    )
    
    return await db.queryOne('earnings', { id })
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
      const id = crypto.randomUUID()
      try {
        const [insertResult] = await pool.query(
          `INSERT INTO earnings (id, user_id, type, amount, status, description, avatar_id, order_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = id`,
          [
            id,
            participant.user_id,
            'order_reward',
            participant.amount,
            'pending',
            '订单收益',
            participant.avatar_id,
            orderId,
            new Date(),
          ]
        ) as any[]
        if (insertResult?.affectedRows > 0) {
          results.push({ id, ...participant })
        }
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
        const [userRows] = await conn.query(
          `SELECT balance, frozen_balance FROM users WHERE id = ? FOR UPDATE`,
          [earning.user_id]
        ) as any[]
        const balanceBefore = Number(userRows?.[0]?.balance) || 0
        const frozenBefore = Number(userRows?.[0]?.frozen_balance) || 0
        const amount = Number(earning.amount) || 0
        await conn.query(
          `UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ? WHERE id = ?`,
          [amount, amount, earning.user_id]
        )

        await conn.query(
          `UPDATE earnings
           SET status = 'settled'
           WHERE id = ? AND status = 'pending'`,
          [earning.id]
        )

        await this.writeTransaction(conn, {
          userId: earning.user_id,
          type: 'order_reward_settled',
          amount,
          balanceBefore,
          balanceAfter: balanceBefore + amount,
          frozenBefore,
          frozenAfter: frozenBefore,
          status: 'completed',
          description: '订单收益结算入账',
          referenceId: earning.id,
          idempotencyKey: `order_reward_settled:${earning.id}`,
        })
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
    
    return (earnings || []).map((item: any) => this.serializeEarningRecord(item))
  }

  /**
   * 确认提现申请
   */
  async confirmWithdrawal(withdrawalId: string) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [withdrawalRows] = await conn.query(
        `SELECT * FROM withdrawals WHERE id = ? FOR UPDATE`,
        [withdrawalId]
      ) as any[]
      const withdrawal = (withdrawalRows as any[])?.[0]
      if (!withdrawal || String(withdrawal.status) !== 'pending') {
        throw new Error('提现申请不存在或已处理')
      }

      const userId = withdrawal.user_id || withdrawal.userId
      const amount = Number(withdrawal.amount) || 0
      if (!userId || amount <= 0) {
        throw new Error('提现数据异常')
      }

      const [userRows] = await conn.query(
        `SELECT balance, frozen_balance FROM users WHERE id = ? FOR UPDATE`,
        [userId]
      ) as any[]
      const balanceBefore = Number(userRows?.[0]?.balance) || 0
      const frozenBefore = Number(userRows?.[0]?.frozen_balance) || 0

      const [updateResult] = await conn.query(
        `UPDATE withdrawals SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'pending'`,
        [new Date(), withdrawalId]
      ) as any[]
      if (Number((updateResult as any)?.affectedRows || 0) !== 1) {
        await conn.rollback()
        const db = getMySQLClient()
        return await db.queryOne('withdrawals', { id: withdrawalId })
      }

      await conn.query(
        'UPDATE users SET frozen_balance = frozen_balance - ?, updated_at = ? WHERE id = ?',
        [amount, new Date(), userId]
      )

      await this.writeTransaction(conn, {
        userId,
        type: 'withdrawal_complete',
        amount: 0,
        balanceBefore,
        balanceAfter: balanceBefore,
        frozenBefore,
        frozenAfter: frozenBefore - amount,
        status: 'completed',
        description: '提现完成，扣减冻结余额',
        referenceId: withdrawalId,
        idempotencyKey: `withdrawal_complete:${withdrawalId}`,
      })

      await conn.commit()
      const db = getMySQLClient()
      return await db.queryOne('withdrawals', { id: withdrawalId })
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
   * 拒绝提现申请
   */
  async rejectWithdrawal(withdrawalId: string, reason?: string) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [withdrawalRows] = await conn.query(
        `SELECT * FROM withdrawals WHERE id = ? FOR UPDATE`,
        [withdrawalId]
      ) as any[]
      const withdrawal = (withdrawalRows as any[])?.[0]
      if (!withdrawal || String(withdrawal.status) !== 'pending') {
        throw new Error('提现申请不存在或已处理')
      }

      const userId = withdrawal.user_id || withdrawal.userId
      const amount = Number(withdrawal.amount) || 0
      if (!userId || amount <= 0) {
        throw new Error('提现数据异常')
      }

      const [userRows] = await conn.query(
        `SELECT balance, frozen_balance FROM users WHERE id = ? FOR UPDATE`,
        [userId]
      ) as any[]
      const balanceBefore = Number(userRows?.[0]?.balance) || 0
      const frozenBefore = Number(userRows?.[0]?.frozen_balance) || 0

      const [updateResult] = await conn.query(
        `UPDATE withdrawals SET status = 'rejected', rejected_reason = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
        [reason || '', new Date(), withdrawalId]
      ) as any[]
      if (Number((updateResult as any)?.affectedRows || 0) !== 1) {
        await conn.rollback()
        const db = getMySQLClient()
        return await db.queryOne('withdrawals', { id: withdrawalId })
      }

      await conn.query(
        `UPDATE users SET balance = balance + ?, frozen_balance = frozen_balance - ?, updated_at = ? WHERE id = ?`,
        [amount, amount, new Date(), userId]
      )

      await this.writeTransaction(conn, {
        userId,
        type: 'withdrawal_reject_unfreeze',
        amount,
        balanceBefore,
        balanceAfter: balanceBefore + amount,
        frozenBefore,
        frozenAfter: frozenBefore - amount,
        status: 'rejected',
        description: '提现驳回，解冻返还余额',
        referenceId: withdrawalId,
        idempotencyKey: `withdrawal_reject_unfreeze:${withdrawalId}`,
      })

      await conn.commit()
      const db = getMySQLClient()
      return await db.queryOne('withdrawals', { id: withdrawalId })
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
    const pool = getPool()
    const conn = await pool.getConnection()
    const amount = Number(withdrawalData?.amount)
    const method = withdrawalData?.method || 'wechat'
    const account = withdrawalData?.account || ''

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('提现金额必须大于0')
    }

    try {
      await conn.beginTransaction()

      const [userRows] = await conn.query(
        `SELECT balance, frozen_balance FROM users WHERE id = ? FOR UPDATE`,
        [userId]
      ) as any[]
      const balance = Number(userRows?.[0]?.balance) || 0
      const frozenBefore = Number(userRows?.[0]?.frozen_balance) || 0
      if (amount > balance) {
        throw new Error('余额不足')
      }

      await conn.query(
        `UPDATE users SET balance = balance - ?, frozen_balance = frozen_balance + ?, updated_at = ? WHERE id = ?`,
        [amount, amount, new Date(), userId]
      )

      const id = crypto.randomUUID()
      await conn.query(
        `INSERT INTO withdrawals (id, user_id, amount, method, account, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [id, userId, amount, method, account, new Date(), new Date()]
      )

      await this.writeTransaction(conn, {
        userId,
        type: 'withdrawal_freeze',
        amount: -amount,
        balanceBefore: balance,
        balanceAfter: balance - amount,
        frozenBefore,
        frozenAfter: frozenBefore + amount,
        status: 'pending',
        description: '提现申请，冻结余额',
        referenceId: id,
        idempotencyKey: `withdrawal_freeze:${id}`,
      })

      await conn.commit()
      const db = getMySQLClient()
      return await db.queryOne('withdrawals', { id })
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
