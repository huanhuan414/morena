import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { getMySQLClient } from '../../storage/database/mysql-client';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';
import { EarningService } from '../earning/earning.service';

/**
 * 订单超时处理服务
 *
 * 处理核心超时问题：
 * 1. 接单超时：用户接单后超过 accept_timeout 分钟未发布 → 踢出 + 静默1天
 * 2. （已禁用）分身不接单 → 派单超时自动作废
 * 3. （已禁用）分身接单后未提交反馈 → 派单超时作废
 * 4. 审核超时：接单者提交验收后超时未被验收 → 自动验收 + 结算收益
 */
@Injectable()
export class OrderTimeoutService {
  private readonly logger = new Logger(OrderTimeoutService.name);

  // 静默期时长（毫秒）：从环境变量读取，默认1天
  private readonly SILENCE_DURATION_MS = parseInt(process.env.ORDER_SILENCE_DURATION_MS || '86400000', 10);
  
  // 待接单超时时间（毫秒）：从环境变量读取，默认10分钟
  private readonly ACCEPT_TIMEOUT_MS = parseInt(process.env.ORDER_ACCEPT_TIMEOUT_MS || '600000', 10);

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => EarningService))
    private readonly earningService: EarningService
  ) {}

  /**
   * 结算单个派单的收益（参考验收接口逻辑）
   */
  private async settleSingleDispatch(orderId: string, avatarId: string, userId: string): Promise<void> {
    try {
      const db = await getMySQLClient()

      // 1. 获取订单信息
      const orderRows = await db.query(
        `SELECT id, budget, base_amount, custom_base_price, is_paid, expected_quantity, avatar_count FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
      )
      const order = Array.isArray(orderRows) ? orderRows[0] : (orderRows as any)?.data?.[0]
      if (!order) {
        this.logger.warn(`[结算] 订单不存在: orderId=${orderId}`)
        return
      }

      // 2. 检查订单是否已支付
      const isPaid = Number((order as any).isPaid ?? (order as any).is_paid ?? 0)
      if (isPaid !== 1) {
        this.logger.log(`[结算] 订单未支付，跳过结算: orderId=${orderId}`)
        return
      }

      // 3. 检查是否已结算过（避免重复结算）
      const [existingEarning] = await db.query(
        `SELECT id FROM earnings WHERE order_id = ? AND avatar_id = ? LIMIT 1`,
        [orderId, avatarId]
      ) as any[]
      if (existingEarning && existingEarning.length > 0) {
        this.logger.log(`[结算] 该分身已结算，跳过: orderId=${orderId}, avatarId=${avatarId}`)
        return
      }

      // 4. 计算单份收益金额
      const requiredCount = (() => {
        const raw =
          (order as any).expectedQuantity ??
          (order as any).expected_quantity ??
          (order as any).avatarCount ??
          (order as any).avatar_count ??
          1
        const n = Number(raw)
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
      })()
      const totalAmount = Number((order as any).baseAmount || (order as any).base_amount || 0)
      const totalCents = Math.max(0, Math.round(totalAmount * 100))
      const amountPerSlotCents = Math.floor(totalCents / requiredCount)
      const amountPerSlot = amountPerSlotCents / 100

      // 5. 获取 custom_base_price 值
      const customBasePrice = Number((order as any).customBasePrice || (order as any).custom_base_price || amountPerSlot)
      
      // 6. 验证结算金额
      if (customBasePrice <= 0) {
        this.logger.error(`[结算] custom_base_price 为空: orderId=${orderId}, customBasePrice=${customBasePrice}`)
        throw new Error(`结算失败: 收益值不能为空`)
      }
      if (amountPerSlot !== customBasePrice) {
        this.logger.error(`[结算] custom_base_price 与计算值不一致: orderId=${orderId}, customBasePrice=${customBasePrice}, amountPerSlot=${amountPerSlot}`)
        throw new Error(`结算失败: 收益值(${customBasePrice})与计算的值(${amountPerSlot})不一致`)
      }

      // 7. 查询用户会员等级获取抽成比例
      const [subRows] = await db.query(
        `SELECT sp.platform_fee_rate 
         FROM user_subscriptions us 
         LEFT JOIN subscription_plans sp ON us.plan_id = sp.id 
         WHERE us.user_id = ? AND us.status = 'active' 
         ORDER BY us.created_at DESC LIMIT 1`,
        [userId]
      ) as any[]
      
      let platformFeeRate = 0.20 // 默认抽成 20%（免费版）
      
      if (subRows) {
        if (Array.isArray(subRows) && subRows.length > 0) {
          const row = subRows[0]
          const rate = row.platform_fee_rate || row.platformFeeRate
          if (rate !== undefined && rate !== null) {
            platformFeeRate = Number(rate)
          }
        } else if (typeof subRows === 'object') {
          const rate = subRows.platform_fee_rate || subRows.platformFeeRate
          if (rate !== undefined && rate !== null) {
            platformFeeRate = Number(rate)
          }
        }
      }

      // 8. 计算实际收益（扣除平台抽成后）
      const feeAmount = Number((customBasePrice * (1 - platformFeeRate)).toFixed(2))
      
      // 9. 创建收益记录
      const earningId = uuidv4()
      await db.query(
        `INSERT INTO earnings (id, user_id, type, amount, status, description, avatar_id, order_id, created_at, fee_rate, fee_amount)
         VALUES (?, ?, 'order_reward', ?, 'settled', '订单收益', ?, ?, NOW(), ?, ?)`,
        [earningId, userId, customBasePrice, avatarId, orderId, platformFeeRate, feeAmount]
      )

      // 10. 更新用户余额
      await db.query(
        `UPDATE users SET balance = COALESCE(balance, 0) + ?, total_earnings = COALESCE(total_earnings, 0) + ?, fee_balance = COALESCE(fee_balance, 0) + ?, fee_total_earnings = COALESCE(fee_total_earnings, 0) + ?, updated_at = NOW() WHERE id = ?`,
        [customBasePrice, customBasePrice, feeAmount, feeAmount, userId]
      )

      this.logger.log(`[结算] 分身结算成功: orderId=${orderId}, avatarId=${avatarId}, userId=${userId}, amount=${feeAmount}`)
    } catch (error: any) {
      this.logger.error(`[结算] 分身结算失败: orderId=${orderId}, avatarId=${avatarId}, error=${error.message}`)
      
      if (error.message && error.message.includes('Duplicate entry')) {
        throw new Error('该订单已结算，无需重复验收')
      }
      
      throw error
    }
  }

  /**
   * 每5分钟检查待接单超时
   * 
   * 条件：pending 状态 + accept_timeout_at 已过期（派单后超过指定时间未接单）
   * 处理：释放名额 + 发送通知 + 自动重新派单给其他分身
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handlePendingAcceptTimeouts() {
    this.logger.log(' ====== 开始检查待接单超时（未接受派单） ===============')
    let count = 0
    try {
      count = await this.checkPendingAcceptTimeouts()
      if (count > 0) {
        this.logger.log(`待接单超时处理完成: ${count} 个派单已释放`)
      }
    } catch (error) {
      this.logger.error(`待接单超时定时任务执行失败: ${error.message}`)
    }
    return count
  }

  /**
   * 检查待接单超时
   * 查找条件：
   *   - dispatch.status = 'pending'（还未接受）
   *   - dispatch.accept_timeout_at < NOW()（超时截止时间已过）
   * 处理：
   *   1. 更新 dispatch 状态为 expired
   *   2. 同步 Redis 计数器
   *   3. 发送通知（不静默用户）
   *   4. 自动重新派单给其他分身
   */
  private async checkPendingAcceptTimeouts(): Promise<number> {
    const client = await getMySQLClient()

    // 查找超时的待接单记录（pending 状态 + accept_timeout_at 已过期）
    const dispatches = await client.query(
      `SELECT od.id, od.order_id, od.avatar_id, od.user_id, od.accept_timeout_at, od.created_at as dispatch_created_at
       FROM order_dispatch_requests od
       WHERE od.status = 'pending'
       AND od.accept_timeout_at IS NOT NULL
       AND od.accept_timeout_at < NOW()`
    )

    if (!dispatches || dispatches.length === 0) {
      this.logger.log('无待接单超时记录')
      return 0
    }

    this.logger.log(`发现 ${dispatches.length} 个待接单超时（未接受派单）`)

    for (const dispatch of dispatches) {
      await this.handlePendingTimeout(dispatch)
    }
    return dispatches.length
  }

  /**
   * 处理单个待接单超时
   */
  private async handlePendingTimeout(dispatch: any) {
    const client = await getMySQLClient()
    // 统一字段名
    const orderId = dispatch.order_id || dispatch.orderId
    const avatarId = dispatch.avatar_id || dispatch.avatarId
    const userId = dispatch.user_id || dispatch.userId

    try {
      // 1. 更新 dispatch 状态为 expired
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'expired', kick_type = 'pending_timeout', reject_reason = '接单超时，收到派单后未在规定时间内确认', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
        [dispatch.id]
      )
      this.logger.log(`[待接单超时] 派单记录已过期: dispatchId=${dispatch.id}`)

       // 2. 取消对应的内容生成请求
      const cgrResult = await client.query(
        `UPDATE content_generation_requests SET status = 'cancelled', updated_at = NOW() WHERE order_id = ? AND avatar_id = ? AND status NOT IN ('completed', 'awaiting_acceptance', 'settled', 'rejected', 'expired', 'failed', 'cancelled')`,
        [orderId, avatarId]
      )
  
      // 2. 同步 Redis 计数器（已拒绝，所以需要减少计数）
      try {
        const redisKey = `order:accept:count:${orderId}`
        await this.redisService.getClient().decr(redisKey)
        this.logger.log(`[待接单超时] Redis DECR: key=${redisKey}`)
      } catch (err) {
        this.logger.warn(`[待接单超时] Redis DECR失败(可忽略): ${err.message}`)
      }

      // 3. 发送通知
      let avatarName = '分身'
      let orderTitle = '订单'
      try {
        const avatar = await client.query('SELECT name FROM avatars WHERE id = ?', [avatarId])
        avatarName = (avatar as any[])?.[0]?.name || '分身'
      } catch (e) { this.logger.warn(`[待接单超时] 获取分身名失败: ${e.message}`) }
      try {
        const order = await client.query('SELECT title FROM orders WHERE id = ?', [orderId])
        orderTitle = (order as any[])?.[0]?.title || '订单'
      } catch (e) { this.logger.warn(`[待接单超时] 获取订单名失败: ${e.message}`) }

      try {
        const notificationService = new NotificationService()
        await notificationService.createNotification({
          user_id: userId,
          type: 'pending_timeout',
          title: '派单超时未接受，名额已释放',
          content: `您在订单"${orderTitle}"中未在规定时间内接受派单，名额已释放给其他分身。`,
          metadata: { orderId, avatarId, avatarName }
        })
        this.logger.log(`[待接单超时] 通知发送成功: userId=${userId}`)
      } catch (err) {
        this.logger.warn(`[待接单超时] 通知发送失败: ${err.message}`)
      }

      this.logger.log(`[待接单超时] 完成: dispatchId=${dispatch.id}, userId=${userId}`)
    } catch (error) {
      this.logger.error(`[待接单超时] 失败: ${error.message}`)
    }
  }


  /**
   * 每分钟检查接单超时
   * 
   * 条件：pending/accepted 状态 + accept_timeout_at 已过期 + 内容未发布
   * 处理：释放名额 + 取消内容生成 + 发送通知（不静默用户）
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAcceptTimeouts() {
    this.logger.log(' ======开始检查接单超时 ===============')
    let count = 0
    try {
      count = await this.checkAcceptTimeouts()
      if (count > 0) {
        this.logger.log(`接单超时处理完成: ${count} 个派单已释放`)
      }
    } catch (error) {
      this.logger.error(`接单超时定时任务执行失败: ${error.message}`)
    }
    return count
  }

  /**
   * 检查接单超时
   * 查找条件：
   *   - dispatch.status IN ('pending', 'accepted')
   *   - dispatch.accept_timeout_at < NOW()（超时截止时间已过）
   *   - 对应的 content_generation_requests 不存在或状态未到 published/awaiting_acceptance/settled
   * 处理：
   *   1. 更新 dispatch 状态为 expired, kick_type = 'auto_timeout'
   *   2. 取消对应的内容生成请求
   *   3. 释放素材
   *   4. 同步 Redis 计数器
   *   5. 发送通知（不静默用户）
   */
  private async checkAcceptTimeouts(): Promise<number> {
    const client = await getMySQLClient()

    // 查找超时的接单记录
    // 条件：pending/accepted + accept_timeout_at已过期 + 内容未发布（不在 completed/published/awaiting_acceptance/settled）
    const dispatches = await client.query(
      `SELECT od.id, od.order_id, od.avatar_id, od.user_id, od.accept_timeout_at
       FROM order_dispatch_requests od
       LEFT JOIN content_generation_requests cg ON od.order_id = cg.order_id AND od.avatar_id = cg.avatar_id
       WHERE od.status IN ('pending', 'accepted')
       AND od.accept_timeout_at IS NOT NULL
       AND od.accept_timeout_at < NOW()
       AND (cg.id IS NULL OR cg.status NOT IN ('revision_requested','completed', 'awaiting_acceptance', 'settled', 'rejected', 'expired', 'failed', 'cancelled'))
       GROUP BY od.id`
    )

    if (!dispatches || dispatches.length === 0) return 0

    this.logger.log(`发现 ${dispatches.length} 个接单超时（超时未发布）`)

    for (const dispatch of dispatches) {
      await this.handleAcceptTimeout(dispatch)
    }
    return dispatches.length
  }

  /**
   * 处理单个接单超时
   */
  private async handleAcceptTimeout(dispatch: any) {
    const client = await getMySQLClient()
    // 统一字段名（MySQL 可能返回下划线或驼峰）
    const orderId = dispatch.order_id || dispatch.orderId
    const avatarId = dispatch.avatar_id || dispatch.avatarId
    const userId = dispatch.user_id || dispatch.userId
  
    try {
      // 1. 更新 dispatch 状态为 expired，记录 kick_type
      const updateResult = await client.query(
        `UPDATE order_dispatch_requests SET status = 'expired', kick_type = 'auto_timeout', reject_reason = '接单超时，未在规定时间内发布', updated_at = NOW() WHERE id = ? AND status IN ('pending', 'accepted')`,
        [dispatch.id]
      )
  
      // 2. 取消对应的内容生成请求
      const cgrResult = await client.query(
        `UPDATE content_generation_requests SET status = 'cancelled', updated_at = NOW() WHERE order_id = ? AND avatar_id = ? AND status NOT IN ('completed', 'awaiting_acceptance', 'settled', 'rejected', 'expired', 'failed', 'cancelled')`,
        [orderId, avatarId]
      )
  
      // 3. 释放该分身占用的素材
      const cgrRecords = await client.query(
        `SELECT id FROM content_generation_requests WHERE order_id = ? AND avatar_id = ? LIMIT 1`,
        [orderId, avatarId]
      )
      const cgrId = (cgrRecords as any[])?.[0]?.id
      if (cgrId) {
        const assetResult = await client.query(
          `UPDATE order_assets SET assigned_to = NULL WHERE order_id = ? AND assigned_to = ?`,
          [orderId, cgrId]
        )
      }

      // 5. 同步 Redis 计数器
      try {
        const redisKeyAccepted = `order:accept:count:${orderId}`
        const currentAcceptedRows = await client.query(
          `SELECT COUNT(DISTINCT avatar_id) as count
           FROM order_dispatch_requests
           WHERE order_id = ? AND status IN ('accepted', 'completed')`,
          [orderId]
        )
        const currentAccepted = Number((currentAcceptedRows as any[])?.[0]?.count || 0)
        await this.redisService.getClient().set(redisKeyAccepted, String(currentAccepted), 'EX', 3600)
        this.logger.log(`[超时处理] Redis计数器: key=${redisKeyAccepted}, value=${currentAccepted}`)
      } catch (err) {
        this.logger.warn(`[超时处理] Redis计数器同步失败: ${err.message}`)
      }

      // 6. 发送通知
      let avatarName = '分身'
      let orderTitle = '订单'
      try {
        const avatar = await client.query('SELECT name FROM avatars WHERE id = ?', [avatarId])
        avatarName = (avatar as any[])?.[0]?.name || '分身'
      } catch (e) { this.logger.warn(`[超时处理] 获取分身名失败: ${e.message}`) }
      try {
        const order = await client.query('SELECT title FROM orders WHERE id = ?', [orderId])
        orderTitle = (order as any[])?.[0]?.title || '订单'
      } catch (e) { this.logger.warn(`[超时处理] 获取订单名失败: ${e.message}`) }

      try {
        const notificationService = new NotificationService()
        await notificationService.createNotification({
          user_id: userId,
          type: 'accept_timeout',
          title: '接单超时，已释放名额',
          content: `您在订单"${orderTitle}"中超时未发布内容，名额已释放给其他分身。`,
          metadata: { orderId, avatarId }
        })
        this.logger.log(`[超时处理] 通知发送成功`)
      } catch (err) {
        this.logger.warn(`[超时处理] 通知发送失败: ${err.message}`)
      }
      this.logger.log(`[超时处理] 完成: dispatchId=${dispatch.id}, userId=${userId}`)
    } catch (error) {
      this.logger.error(`[超时处理] 失败: ${error.message}`)
    }
  }

  /**
   * 每分钟检查验收超时
   * 
   * 条件：order.status = 'awaiting_acceptance' + acceptance_timeout_at 已过期
   * 处理：自动验收 + 结算收益给接单用户
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAcceptanceTimeouts() {
    this.logger.log(' ====== 开始检查审核超时 ===============')
    let count = 0
    try {
      count = await this.checkAcceptanceTimeouts()
      if (count > 0) {
        this.logger.log(`审核超时处理完成: ${count} 个订单已自动验收`)
      }
    } catch (error) {
      this.logger.error(`审核超时定时任务执行失败: ${error.message}`)
    }
    return count
  }

  /**
   * 检查验收超时
   * 查找条件：
   *   - dispatch.acceptance_timeout_at IS NOT NULL
   *   - dispatch.acceptance_timeout_at < NOW()
   *   - dispatch.status IN ('accepted', 'completed')
   *   - content.status = 'awaiting_acceptance'
   * 处理：
   *   1. 更新 dispatch 状态为 settled
   *   2. 更新对应的 content_generation_requests 状态为 settled
   *   3. 结算收益给接单用户
   *   4. 检查订单是否所有 dispatch 都已完成，若是则更新订单状态为 completed
   */
  private async checkAcceptanceTimeouts(): Promise<number> {
    const client = await getMySQLClient()

    // 查找验收超时的 dispatch（接单者提交验收后超时）
    const dispatches = await client.query(
      `SELECT od.id, od.order_id, od.avatar_id, od.user_id, o.title, o.budget, o.base_amount, o.content_amount
       FROM order_dispatch_requests od
       LEFT JOIN content_generation_requests cg ON od.order_id = cg.order_id AND od.avatar_id = cg.avatar_id
       LEFT JOIN orders o ON od.order_id = o.id
       WHERE od.acceptance_timeout_at IS NOT NULL
         AND od.acceptance_timeout_at < NOW()
         AND od.status IN ('accepted', 'completed')
         AND cg.status = 'awaiting_acceptance'`
    )

    if (!dispatches || dispatches.length === 0) return 0

    this.logger.log(`发现 ${dispatches.length} 个审核超时的 dispatch`)

    for (const dispatch of dispatches) {
      await this.handleAcceptanceTimeout(dispatch)
    }
    return dispatches.length
  }

  /**
   * 处理单个 dispatch 的验收超时（自动验收）
   */
  private async handleAcceptanceTimeout(dispatch: any) {
    const client = await getMySQLClient()
    const dispatchId = dispatch.id
    const orderId = dispatch.order_id || dispatch.orderId
    const avatarId = dispatch.avatar_id || dispatch.avatarId
    const userId = dispatch.user_id || dispatch.userId

    try {
      this.logger.log(`[审核超时] 开始处理 dispatch: ${dispatchId}, orderId: ${orderId}`)

      // 1. 更新 dispatch 状态为 completed
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'completed', updated_at = NOW() WHERE id = ? AND status IN ('accepted', 'completed')`,
        [dispatchId]
      )

      // 2. 更新对应的 content_generation_requests 状态为 settled
      await client.query(
        `UPDATE content_generation_requests SET status = 'settled', updated_at = NOW() WHERE order_id = ? AND avatar_id = ? AND status = 'awaiting_acceptance'`,
        [orderId, avatarId]
      )

      // 3. 结算收益给接单用户（参考验收接口逻辑）
      if (userId) {
        try {
          await this.settleSingleDispatch(orderId, avatarId, userId)
          this.logger.log(`[审核超时] 收益结算成功: userId=${userId}, orderId=${orderId}`)
        } catch (earningError) {
          this.logger.error(`[审核超时] 收益结算失败: userId=${userId}, orderId=${orderId}, error=${earningError.message}`)
        }
      } else {
        this.logger.warn(`[审核超时] 无法结算，userId为空: dispatchId=${dispatchId}`)
      }

      // 4. 检查订单是否所有 dispatch 都已完成
      await this.checkAndCompleteOrder(orderId)

      this.logger.log(`[审核超时] 完成: dispatchId=${dispatchId}, orderId=${orderId}`)
    } catch (error) {
      this.logger.error(`[审核超时] 失败: dispatchId=${dispatchId}, orderId=${orderId}, error=${error.message}`)
    }
  }

  /**
   * 检查订单是否所有 dispatch 都已完成，若是则更新订单状态为 completed
   */
  private async checkAndCompleteOrder(orderId: string): Promise<void> {
    const client = await getMySQLClient()

    // 查询订单的所有 dispatch 状态
    const dispatchResults = await client.query(
      `SELECT status FROM order_dispatch_requests WHERE order_id = ?`,
      [orderId]
    )

    const dispatchStatuses = (dispatchResults as any[]).map(d => d.status)
    
    // 如果所有 dispatch 都已完成（settled/done/completed），则更新订单状态为 completed
    const allCompleted = dispatchStatuses.every(s => ['settled', 'done', 'completed', 'expired', 'rejected'].includes(s))
    
    if (allCompleted) {
      await client.query(
        `UPDATE orders SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 'awaiting_acceptance'`,
        [orderId]
      )
      this.logger.log(`[审核超时] 订单已全部完成，更新状态为 completed: orderId=${orderId}`)
    }
  }
}
