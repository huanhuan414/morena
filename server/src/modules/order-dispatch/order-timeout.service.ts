import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { getMySQLClient } from '../../storage/database/mysql-client';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';

/**
 * 订单超时处理服务
 *
 * 处理核心超时问题：
 * 1. 接单超时：用户接单后超过 accept_timeout 分钟未发布 → 踢出 + 静默1天
 * 2. （已禁用）分身不接单 → 派单超时自动作废
 * 3. （已禁用）分身接单后未提交反馈 → 派单超时作废
 */
@Injectable()
export class OrderTimeoutService {
  private readonly logger = new Logger(OrderTimeoutService.name);

  // 静默期时长（毫秒）：从环境变量读取，默认1天
  private readonly SILENCE_DURATION_MS = parseInt(process.env.ORDER_SILENCE_DURATION_MS || '86400000', 10);

  constructor(private readonly redisService: RedisService) {}

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
       AND (cg.id IS NULL OR cg.status NOT IN ('completed', 'awaiting_acceptance', 'settled', 'rejected', 'expired', 'failed', 'cancelled'))
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
}
