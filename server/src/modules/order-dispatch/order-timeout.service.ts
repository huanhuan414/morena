import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { getMySQLClient } from '../../storage/database/mysql-client';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';

/**
 * 订单超时处理服务
 *
 * 处理核心超时问题：
 * 1. 分身不接单 → 派单超时自动作废，名额释放
 * 2. 分身接单后30分钟未提交反馈 → 派单超时作废，名额释放
 *
 * 注意：Cron 已禁用，改为通过 API 手动触发 handleTimeoutOrders()
 * 原因：定时任务在高并发时可能导致 Redis 计数器漂移
 */
@Injectable()
export class OrderTimeoutService {
  private readonly logger = new Logger(OrderTimeoutService.name);

  // 超时配置（秒）
  private readonly DISPATCH_TIMEOUT = 10 * 60;      // 10分钟未接单视为超时
  private readonly FEEDBACK_TIMEOUT = 30 * 60;       // 30分钟未提交反馈视为超时
  private readonly MAX_RETRIES = 3;                   // 最大重试派单次数

  constructor(private readonly redisService: RedisService) {}

  /**
   * 手动触发：检查超时订单（原 Cron 已禁用）
   */
  async handleTimeoutOrders() {
    const result = { dispatch: 0, feedback: 0, total: 0 }
    try {
      result.dispatch = await this.checkDispatchTimeouts();
      result.feedback = await this.checkFeedbackTimeouts();
      result.total = result.dispatch + result.feedback
    } catch (error) {
      this.logger.error(`定时任务执行失败: ${error.message}`);
    }
    return result
  }

  /**
   * 1. 检查派单超时（分身不接单）
   * 流程：pending派单超过10分钟 → 标记expired → 名额释放
   */
  private async checkDispatchTimeouts(): Promise<number> {
    const client = await getMySQLClient();
    const timeoutTime = new Date(Date.now() - this.DISPATCH_TIMEOUT * 1000);

    const dispatches = await client.query(
      `SELECT od.id, od.order_id, od.avatar_id
       FROM order_dispatch_requests od
       JOIN orders o ON od.order_id = o.id
       WHERE od.status = 'pending' 
       AND od.avatar_id IS NOT NULL
       AND od.created_at < ?`,
      [timeoutTime]
    );

    if (!dispatches || dispatches.length === 0) return 0;

    this.logger.log(`发现 ${dispatches.length} 个派单超时（未接单）`);

    for (const dispatch of dispatches) {
      await this.handleDispatchTimeout(dispatch);
    }
    return dispatches.length
  }

  /**
   * 2. 检查反馈超时（接单后30分钟未提交反馈）
   * 流程：accepted派单超过30分钟未变成 awaiting_acceptance → 标记expired → 名额释放
   */
  private async checkFeedbackTimeouts(): Promise<number> {
    const client = await getMySQLClient();
    const timeoutTime = new Date(Date.now() - this.FEEDBACK_TIMEOUT * 1000);

    const dispatches = await client.query(
      `SELECT od.id, od.order_id, od.avatar_id, od.accepted_at
       FROM order_dispatch_requests od
       JOIN orders o ON od.order_id = o.id
       WHERE od.status = 'accepted'
       AND od.accepted_at IS NOT NULL
       AND od.accepted_at < ?`,
      [timeoutTime]
    );

    if (!dispatches || dispatches.length === 0) return 0;

    this.logger.log(`发现 ${dispatches.length} 个反馈超时（接单后未提交反馈）`);

    for (const dispatch of dispatches) {
      await this.handleFeedbackTimeout(dispatch);
    }
    return dispatches.length
  }

  /**
   * 处理派单超时（未接单）
   */
  private async handleDispatchTimeout(dispatch: any) {
    const client = await getMySQLClient();

    try {
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'expired', responded_at = NOW() WHERE id = ? AND status = 'pending'`,
        [dispatch.id]
      );

      // 同步Redis计数器：从数据库重新计算accepted数量
      // 注意：必须使用与 OrderDispatchService 一致的 key 前缀 'order:accept:count:'
      try {
        const redisKeyAccepted = `order:accept:count:${dispatch.order_id}`;
        const currentAcceptedRows = await client.query(
          `SELECT COUNT(DISTINCT avatar_id) as count
           FROM order_dispatch_requests
           WHERE order_id = ? AND status IN ('accepted', 'completed')`,
          [dispatch.order_id]
        );
        const currentAccepted = Number((currentAcceptedRows as any[])?.[0]?.count || 0);
        await this.redisService.getClient().set(redisKeyAccepted, String(currentAccepted), 'EX', 86400 * 7);
        this.logger.log(`Redis计数器已同步: orderId=${dispatch.order_id}, accepted=${currentAccepted}`);
      } catch (err) {
        this.logger.warn(`Redis计数器同步失败: ${err.message}`);
      }

      let avatarName = '分身';
      let orderTitle = '订单';
      
      try {
        const avatar = await client.query('SELECT name FROM avatars WHERE id = ?', [dispatch.avatar_id]);
        avatarName = avatar?.[0]?.name || '分身';
      } catch {}

      try {
        const order = await client.query('SELECT title FROM orders WHERE id = ?', [dispatch.order_id]);
        orderTitle = order?.[0]?.title || '订单';
      } catch {}

      try {
        const notificationService = new NotificationService()
        await notificationService.createNotification({
          user_id: null,
          type: 'dispatch_expired',
          title: '派单超时，名额已释放',
          content: `勾选分身"${avatarName}"超时未接单（10分钟内未接受），名额已释放到订单广场。订单："${orderTitle}"`,
          metadata: { orderId: dispatch.order_id, avatarId: dispatch.avatar_id }
        })
      } catch (err) {
        this.logger.warn(`通知发送失败: ${err.message}`);
      }

      this.logger.log(`派单超时处理完成: dispatchId=${dispatch.id}`);
    } catch (error) {
      this.logger.error(`处理派单超时失败: ${error.message}`);
    }
  }

  /**
   * 处理反馈超时（接单后未提交反馈）
   */
  private async handleFeedbackTimeout(dispatch: any) {
    const client = await getMySQLClient();

    try {
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'expired', responded_at = NOW() WHERE id = ? AND status = 'accepted'`,
        [dispatch.id]
      );

      // 同步Redis计数器：从数据库重新计算accepted数量
      // 注意：必须使用与 OrderDispatchService 一致的 key 前缀 'order:accept:count:'
      try {
        const redisKeyAccepted = `order:accept:count:${dispatch.order_id}`;
        const currentAcceptedRows = await client.query(
          `SELECT COUNT(DISTINCT avatar_id) as count
           FROM order_dispatch_requests
           WHERE order_id = ? AND status IN ('accepted', 'completed')`,
          [dispatch.order_id]
        );
        const currentAccepted = Number((currentAcceptedRows as any[])?.[0]?.count || 0);
        await this.redisService.getClient().set(redisKeyAccepted, String(currentAccepted), 'EX', 86400 * 7);
        this.logger.log(`Redis计数器已同步: orderId=${dispatch.order_id}, accepted=${currentAccepted}`);
      } catch (err) {
        this.logger.warn(`Redis计数器同步失败: ${err.message}`);
      }

      let avatarName = '分身';
      let orderTitle = '订单';
      
      try {
        const avatar = await client.query('SELECT name FROM avatars WHERE id = ?', [dispatch.avatar_id]);
        avatarName = avatar?.[0]?.name || '分身';
      } catch {}

      try {
        const order = await client.query('SELECT title FROM orders WHERE id = ?', [dispatch.order_id]);
        orderTitle = order?.[0]?.title || '订单';
      } catch {}

      try {
        const notificationService = new NotificationService()
        await notificationService.createNotification({
          user_id: null,
          type: 'feedback_timeout',
          title: '接单超时，名额已释放',
          content: `接单者"${avatarName}"接单后30分钟未提交反馈，名额已释放到订单广场。订单："${orderTitle}"`,
          metadata: { orderId: dispatch.order_id, avatarId: dispatch.avatar_id }
        })
      } catch (err) {
        this.logger.warn(`通知发送失败: ${err.message}`);
      }

      this.logger.log(`反馈超时处理完成: dispatchId=${dispatch.id}`);
    } catch (error) {
      this.logger.error(`处理反馈超时失败: ${error.message}`);
    }
  }
}
