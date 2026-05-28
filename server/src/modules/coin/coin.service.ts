import { Injectable, BadRequestException } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

const SKILL_NAMES: Record<string, string> = {
  text: '文本生成',
  image: '图片生成',
  video: '视频生成',
  article: '公众号文章生成',
  clothing: '衣品改造',
  palm: '看手相',
  image_gen: '图片生成',
  video_gen: '视频生成',
  content_writing: '公众号文章生成',
  palm_reading: '看手相',
  fashion_advice: '衣品改造',
}

@Injectable()
export class CoinService {
  /**
   * 获取用户币余额
   */
  async getBalance(userId: string): Promise<number> {
    const db = getMySQLClient()
    const user = await db.queryOne('users', { id: userId })
    return Number(user?.coins || 0)
  }

  /**
   * 从数据库获取技能价格
   */
  async getSkillPrice(skillType: string): Promise<number> {
    const db = getMySQLClient()
    const skill = await db.queryOne('skills', { id: skillType })
    return Number(skill?.price || 0)
  }

  /**
   * 从数据库获取所有技能价格表
   */
  async getAllSkillPrices(): Promise<Record<string, { price: number; name: string }>> {
    const db = getMySQLClient()
    const skills = await db.query('skills', {}) as any[]
    const result: Record<string, { price: number; name: string }> = {}
    
    for (const skill of skills || []) {
      result[skill.id] = {
        price: Number(skill.price || 0),
        name: skill.name || SKILL_NAMES[skill.id] || skill.id
      }
    }
    return result
  }

  /**
   * 消费扣币
   * @param userId 用户ID
   * @param skillType 技能类型
   * @param customAmount 自定义金额（可选，默认从数据库读取技能价格）
   */
  async consume(
    userId: string,
    skillType: string,
    customAmount?: number
  ): Promise<{
    success: boolean
    balanceBefore: number
    balanceAfter: number
    amount: number
    transactionId: string
  }> {
    const pool = getPool()
    const amount = customAmount || await this.getSkillPrice(skillType)

    if (amount <= 0) {
      throw new BadRequestException('消费金额必须大于0')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const [userRows] = await connection.query(
        'SELECT coins FROM users WHERE id = ? FOR UPDATE',
        [userId]
      )
      const user = (userRows as any[])?.[0]
      
      if (!user) {
        throw new BadRequestException('用户不存在')
      }

      const balanceBefore = Number(user.coins || 0)
      
      if (balanceBefore < amount) {
        throw new BadRequestException(`币余额不足，当前余额 ${balanceBefore} 币，需要 ${amount} 币`)
      }

      const balanceAfter = balanceBefore - amount
      const transactionId = crypto.randomUUID()

      await connection.query(
        'UPDATE users SET coins = ? WHERE id = ?',
        [balanceAfter, userId]
      )

      await connection.query(
        `INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, skill_type, description, created_at)
         VALUES (?, ?, 'consume', ?, ?, ?, ?, ?, NOW())`,
        [
          transactionId,
          userId,
          -amount,
          balanceBefore,
          balanceAfter,
          skillType,
          `使用${SKILL_NAMES[skillType] || skillType}消费 ${amount} 币`
        ]
      )

      await connection.commit()

      return {
        success: true,
        balanceBefore,
        balanceAfter,
        amount,
        transactionId
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 赠送币（新用户注册、活动奖励等）
   */
  async gift(
    userId: string,
    amount: number,
    description: string
  ): Promise<{
    success: boolean
    balanceBefore: number
    balanceAfter: number
    transactionId: string
  }> {
    const pool = getPool()

    if (amount <= 0) {
      throw new BadRequestException('赠送金额必须大于0')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const [userRows] = await connection.query(
        'SELECT coins FROM users WHERE id = ? FOR UPDATE',
        [userId]
      )
      const user = (userRows as any[])?.[0]
      
      if (!user) {
        throw new BadRequestException('用户不存在')
      }

      const balanceBefore = Number(user.coins || 0)
      const balanceAfter = balanceBefore + amount
      const transactionId = crypto.randomUUID()

      await connection.query(
        'UPDATE users SET coins = ? WHERE id = ?',
        [balanceAfter, userId]
      )

      await connection.query(
        `INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, 'gift', ?, ?, ?, ?, NOW())`,
        [transactionId, userId, amount, balanceBefore, balanceAfter, description]
      )

      await connection.commit()

      return {
        success: true,
        balanceBefore,
        balanceAfter,
        transactionId
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 获取币交易记录
   */
  async getTransactions(
    userId: string,
    options?: {
      type?: string
      page?: number
      pageSize?: number
    }
  ): Promise<{
    list: any[]
    total: number
    page: number
    pageSize: number
  }> {
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

    const [list] = await pool.query(
      `SELECT * FROM coin_transactions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM coin_transactions WHERE ${where}`,
      params
    )
    const total = Number((countRows as any[])?.[0]?.total || 0)

    return {
      list: list as any[],
      total,
      page,
      pageSize
    }
  }

  /**
   * 检查是否有足够币消费
   */
  async canConsume(userId: string, skillType: string): Promise<{
    canConsume: boolean
    balance: number
    price: number
    shortage: number
  }> {
    const balance = await this.getBalance(userId)
    const price = await this.getSkillPrice(skillType)
    const shortage = Math.max(0, price - balance)

    return {
      canConsume: balance >= price,
      balance,
      price,
      shortage
    }
  }

  /**
   * 获取充值套餐列表
   */
  async getRechargePackages(): Promise<any[]> {
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT * FROM coin_recharge_packages WHERE is_active = 1 ORDER BY sort_order ASC'
    )
    return rows as any[]
  }

  /**
   * 创建充值订单
   */
  async createRechargeOrder(
    userId: string,
    packageId: string,
    paymentMethod: string = 'wechat'
  ): Promise<{
    orderId: string
    coins: number
    bonus: number
    amount: number
  }> {
    const pool = getPool()

    // 获取套餐信息
    const [pkgRows] = await pool.query(
      'SELECT * FROM coin_recharge_packages WHERE id = ? AND is_active = 1',
      [packageId]
    )
    const pkg = (pkgRows as any[])?.[0]
    if (!pkg) {
      throw new BadRequestException('套餐不存在或已下架')
    }

    const orderId = crypto.randomUUID()
    const totalCoins = Number(pkg.coins) + Number(pkg.bonus || 0)

    // 创建充值记录
    await pool.query(
      `INSERT INTO coin_recharge_records (id, user_id, package_id, coins, bonus, amount, payment_method, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [orderId, userId, packageId, pkg.coins, pkg.bonus || 0, pkg.price, paymentMethod]
    )

    return {
      orderId,
      coins: pkg.coins,
      bonus: pkg.bonus || 0,
      amount: Number(pkg.price)
    }
  }

  /**
   * 充值支付成功回调
   */
  async rechargeCallback(
    orderId: string,
    transactionId: string
  ): Promise<{
    success: boolean
    coins: number
    balanceAfter: number
  }> {
    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // 获取充值记录
      const [recordRows] = await connection.query(
        'SELECT * FROM coin_recharge_records WHERE id = ? FOR UPDATE',
        [orderId]
      )
      const record = (recordRows as any[])?.[0]

      if (!record) {
        throw new BadRequestException('充值订单不存在')
      }

      if (record.status === 'paid') {
        throw new BadRequestException('订单已支付')
      }

      if (record.status === 'failed') {
        throw new BadRequestException('订单已失败')
      }

      // 获取用户当前余额
      const [userRows] = await connection.query(
        'SELECT coins FROM users WHERE id = ? FOR UPDATE',
        [record.user_id]
      )
      const user = (userRows as any[])?.[0]
      if (!user) {
        throw new BadRequestException('用户不存在')
      }

      const totalCoins = Number(record.coins) + Number(record.bonus || 0)
      const balanceBefore = Number(user.coins || 0)
      const balanceAfter = balanceBefore + totalCoins

      // 更新用户余额
      await connection.query(
        'UPDATE users SET coins = ? WHERE id = ?',
        [balanceAfter, record.user_id]
      )

      // 更新充值记录状态
      await connection.query(
        'UPDATE coin_recharge_records SET status = ?, transaction_id = ?, paid_at = NOW() WHERE id = ?',
        ['paid', transactionId, orderId]
      )

      // 记录交易流水
      const txId = crypto.randomUUID()
      await connection.query(
        `INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, 'recharge', ?, ?, ?, ?, NOW())`,
        [txId, record.user_id, totalCoins, balanceBefore, balanceAfter, `充值${record.coins}币${record.bonus > 0 ? `，赠送${record.bonus}币` : ''}`]
      )

      await connection.commit()

      return {
        success: true,
        coins: totalCoins,
        balanceAfter
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 获取充值记录
   */
  async getRechargeRecords(
    userId: string,
    options?: {
      page?: number
      pageSize?: number
    }
  ): Promise<{
    list: any[]
    total: number
    page: number
    pageSize: number
  }> {
    const pool = getPool()
    const page = options?.page || 1
    const pageSize = options?.pageSize || 20
    const offset = (page - 1) * pageSize

    const [list] = await pool.query(
      `SELECT r.*, p.name as package_name 
       FROM coin_recharge_records r 
       LEFT JOIN coin_recharge_packages p ON r.package_id = p.id 
       WHERE r.user_id = ? 
       ORDER BY r.created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    )

    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM coin_recharge_records WHERE user_id = ?',
      [userId]
    )
    const total = Number((countRows as any[])?.[0]?.total || 0)

    return {
      list: list as any[],
      total,
      page,
      pageSize
    }
  }
}
