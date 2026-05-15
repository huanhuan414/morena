import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { getMySQLClient } from '../../storage/database/mysql-client';
import { NotificationService } from '../notification/notification.service';

/**
 * 订单超时处理服务
 * 
 * 处理三大核心问题：
 * 1. 分身不接单 → 派单超时自动重新分配
 * 2. 分身接单后不产出 → 内容超时自动取消并重新分配
 * 3. 假发布 → 发布验证机制
 */
@Injectable()
export class OrderTimeoutService {
  private readonly logger = new Logger(OrderTimeoutService.name);

  // 超时配置（秒）
  private readonly DISPATCH_TIMEOUT = 30 * 60;      // 30分钟未接单视为超时
  private readonly CONTENT_TIMEOUT = 2 * 3600;       // 2小时未产出内容视为超时
  private readonly PUBLISH_TIMEOUT = 24 * 3600;      // 24小时未发布视为超时
  private readonly ACCEPTANCE_REMIND_TIMEOUT = 6 * 3600; // 6小时未验收提醒
  private readonly MAX_RETRIES = 3;                   // 最大重试派单次数
  private readonly lastAcceptanceRemindAt = new Map<string, number>();

  private eventService: any = null;

  private async getEventService() {
    if (!this.eventService) {
      try {
        const { OrderEventService } = await import('./order-event.service');
        this.eventService = new OrderEventService();
        this.logger.log('OrderEventService 加载成功');
      } catch (err) {
        this.logger.warn(`OrderEventService 加载失败: ${err.message}`);
      }
    }
    return this.eventService;
  }

  /**
   * 定时任务：每分钟检查超时订单
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimeoutOrders() {
    const result = { dispatch: 0, content: 0, publish: 0, acceptance: 0, total: 0 }
    try {
      result.dispatch = await this.checkDispatchTimeouts();
      result.content = await this.checkContentTimeouts();
      result.publish = await this.checkPublishTimeouts();
      result.acceptance = await this.checkAcceptanceTimeouts();
      result.total = result.dispatch + result.content + result.publish + result.acceptance
    } catch (error) {
      this.logger.error(`定时任务执行失败: ${error.message}`);
    }
    return result
  }

  private async checkAcceptanceTimeouts() {
    const client = await getMySQLClient();
    const timeoutTime = new Date(Date.now() - this.ACCEPTANCE_REMIND_TIMEOUT * 1000);
    const orders = await client.query(
      `SELECT id, user_id, title, updated_at
       FROM orders
       WHERE status = 'awaiting_acceptance'
       AND updated_at < ?
       ORDER BY updated_at ASC
       LIMIT 200`,
      [timeoutTime]
    );

    if (!orders || orders.length === 0) return 0;

    let reminded = 0;
    const notificationService = new NotificationService();

    for (const order of orders) {
      const orderId = order.id || order.orderId;
      const userId = order.userId || order.user_id;
      if (!orderId || !userId) continue;

      const lastAt = this.lastAcceptanceRemindAt.get(orderId) || 0;
      if (lastAt && Date.now() - lastAt < this.ACCEPTANCE_REMIND_TIMEOUT * 1000) continue;

      const title = '验收超时提醒';
      const content = order.title
        ? `你的订单「${order.title}」已超过6小时未验收，请尽快处理`
        : '你的订单已超过6小时未验收，请尽快处理';

      try {
        await notificationService.createNotification({
          user_id: userId,
          type: 'order_acceptance_overdue',
          title,
          content,
          metadata: { orderId }
        });
        this.lastAcceptanceRemindAt.set(orderId, Date.now());
        reminded += 1;
      } catch (error) {
        this.logger.warn(`验收超时提醒发送失败: orderId=${orderId}`);
      }
    }

    return reminded;
  }

  /**
   * 1. 检查派单超时（分身不接单）
   * 流程：pending派单超过30分钟 → 标记expired → 自动重新派单给其他分身
   */
  private async checkDispatchTimeouts() {
    const client = await getMySQLClient();
    const timeoutTime = new Date(Date.now() - this.DISPATCH_TIMEOUT * 1000);

    // 查找超时的pending派单（跳过target_avatar_id为NULL的无效派单）
    const dispatches = await client.query(
      `SELECT od.id, od.order_id, od.target_avatar_id as avatar_id, o.status as order_status
       FROM order_dispatch_requests od
       JOIN orders o ON od.order_id = o.id
       WHERE od.status = 'pending' 
       AND od.target_avatar_id IS NOT NULL
       AND od.created_at < ?
       AND o.status IN ('pending_acceptance', 'awaiting_acceptance')`,
      [timeoutTime]
    );

    if (!dispatches || dispatches.length === 0) return 0;

    this.logger.log(`发现 ${dispatches.length} 个派单超时`);

    for (const dispatch of dispatches) {
      await this.handleDispatchTimeout(dispatch);
    }
    return dispatches.length
  }

  /**
   * 处理单个派单超时
   */
  private async handleDispatchTimeout(dispatch: any) {
    const client = await getMySQLClient();
    const logId = uuidv4();
    let result: { action: 'auto_cancel' | 'reassign'; orderId: string; dispatchId: string; avatarId: string; avatarName: string; retryCount: number } = null;

    try {
      await client.query('START TRANSACTION');

      // 1. 标记当前派单为expired
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'expired', responded_at = NOW() WHERE id = ? AND status = 'pending'`,
        [dispatch.id]
      );

      // 2. 检查订单重试次数
      const orders = await client.query(
        `SELECT retry_count, max_retries, status FROM orders WHERE id = ?`,
        [dispatch.orderId]
      );

      const order = orders?.[0];
      if (!order) {
        await client.query('ROLLBACK');
        return;
      }

      // 获取分身名称
      let avatarName = '分身';
      try { const a = await client.query('SELECT name FROM avatars WHERE id = ?', [dispatch.avatarId]); avatarName = a?.[0]?.name || '分身' } catch {}

      if (order.retryCount >= (order.maxRetries || this.MAX_RETRIES)) {
        // 超过最大重试次数，自动取消订单
        await client.query(
          `UPDATE orders SET status = 'auto_cancelled', auto_cancel_at = NOW() WHERE id = ?`,
          [dispatch.orderId]
        );

        // 记录日志
        await client.query(
          `INSERT INTO order_timeout_logs (id, order_id, dispatch_id, avatar_id, event_type, old_status, new_status, notes)
           VALUES (?, ?, ?, ?, 'auto_cancel', ?, 'auto_cancelled', ?)`,
          [logId, dispatch.orderId, dispatch.id, dispatch.avatarId, order.status,
           `已重试${order.retryCount}次，无分身接单，自动取消`]
        );

        result = { action: 'auto_cancel', orderId: dispatch.orderId, dispatchId: dispatch.id, avatarId: dispatch.avatarId, avatarName, retryCount: order.retryCount };

        this.logger.warn(`订单 ${dispatch.orderId} 已自动取消（重试${order.retryCount}次无人接单）`);
      } else {
        // 增加重试次数，尝试重新派单
        await client.query(
          `UPDATE orders SET retry_count = retry_count + 1, status = 'awaiting_acceptance' WHERE id = ?`,
          [dispatch.orderId]
        );

        // 记录日志
        await client.query(
          `INSERT INTO order_timeout_logs (id, order_id, dispatch_id, avatar_id, event_type, old_status, new_status, notes)
           VALUES (?, ?, ?, ?, 'dispatch_timeout', ?, 'awaiting_acceptance', ?)`,
          [logId, dispatch.orderId, dispatch.id, dispatch.avatarId, order.status,
           `分身${avatarName}超时未接单，准备重新派单(第${order.retryCount + 1}次)`]
        );

        result = { action: 'reassign', orderId: dispatch.orderId, dispatchId: dispatch.id, avatarId: dispatch.avatarId, avatarName, retryCount: order.retryCount + 1 };

        this.logger.log(`订单 ${dispatch.orderId} 派单超时，准备重新派单(第${order.retryCount + 1}次)`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`处理派单超时失败: ${error.message}`);
      return;
    }

    // 📌 事务提交后记录事件（避免事务内嵌套查询死锁）
    if (result) {
      const evtSvc = await this.getEventService();
      if (evtSvc) {
        try {
          if (result.action === 'auto_cancel') {
            await evtSvc.recordEvent({
              orderId: result.orderId, dispatchId: result.dispatchId, avatarId: result.avatarId,
              eventType: 'auto_cancel', source: 'system', visibility: 'both',
              title: `订单已自动取消（${result.avatarName}超时未接单，已重试${result.retryCount}次）`,
              avatarName: result.avatarName,
            });
          } else {
            await evtSvc.recordEvent({
              orderId: result.orderId, dispatchId: result.dispatchId, avatarId: result.avatarId,
              eventType: 'expired', source: 'system', visibility: 'both',
              title: `${result.avatarName}超时未接单`,
              avatarName: result.avatarName,
              content: `准备重新派单(第${result.retryCount}次)`,
            });
            await evtSvc.recordEvent({
              orderId: result.orderId, avatarId: result.avatarId,
              eventType: 'reassign', source: 'system', visibility: 'both',
              title: `订单已重新派单`,
              avatarName: result.avatarName,
              content: `${result.avatarName}超时未接单，正在重新分配分身(第${result.retryCount}次)`,
            });
          }
        } catch (e) { this.logger.warn(`事件记录失败: ${e.message}`) }
      }
    }

    try {
      await this.applyDispatchTimeoutGovernance(dispatch.avatarId || dispatch.avatar_id, dispatch.orderId || dispatch.order_id);
    } catch (e) {
      this.logger.warn(`派单超时治理处理失败: ${e.message}`);
    }
  }

  private async applyDispatchTimeoutGovernance(avatarId?: string, orderId?: string) {
    if (!avatarId) return;

    const client = await getMySQLClient();
    const rows = await client.query(
      `SELECT COUNT(*) as cnt
       FROM order_dispatch_requests
       WHERE avatar_id = ?
       AND status = 'expired'
       AND updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [avatarId]
    );
    const cnt = Number(rows?.[0]?.cnt || 0);
    if (cnt < 3) return;

    const existing = await client.query(
      `SELECT id FROM avatar_notifications
       WHERE avatar_id = ?
       AND type = 'hosting_auto_paused'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       LIMIT 1`,
      [avatarId]
    );
    if (existing && existing.length > 0) return;

    let paused = false;
    for (const field of ['trust_enabled', 'hosting_enabled', 'is_hosted']) {
      try {
        await client.query(`UPDATE avatars SET ${field} = 0 WHERE id = ?`, [avatarId]);
        paused = true;
        break;
      } catch {}
    }

    if (!paused) return;

    await client.insert('avatar_notifications', {
      id: uuidv4(),
      avatar_id: avatarId,
      order_id: orderId || null,
      type: 'hosting_auto_paused',
      title: '托管已自动暂停',
      content: `24小时内派单超时达到${cnt}次，已自动暂停托管，请检查接单设置`,
      status: 'unread',
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * 2. 检查内容生成超时（分身接单但不产出）
   * 流程：in_progress超过2小时无内容 → 警告通知 → 超时取消并重新派单
   */
  private async checkContentTimeouts() {
    const client = await getMySQLClient();
    const timeoutTime = new Date(Date.now() - this.CONTENT_TIMEOUT * 1000);

    // 查找内容生成超时的订单
    const orders = await client.query(
      `SELECT o.id, o.status, o.assigned_to, o.retry_count, o.max_retries,
              (SELECT COUNT(*) FROM generated_content gc WHERE gc.order_id = o.id AND gc.status = 'completed') as completed_content
       FROM orders o
       WHERE o.status = 'in_progress'
       AND o.updated_at < ?
       AND NOT EXISTS (
         SELECT 1 FROM generated_content gc 
         WHERE gc.order_id = o.id AND gc.status = 'completed'
       )`,
      [timeoutTime]
    );

    if (!orders || orders.length === 0) return 0;

    this.logger.log(`发现 ${orders.length} 个内容生成超时订单`);

    for (const order of orders) {
      await this.handleContentTimeout(order);
    }
    return orders.length;
  }

  /**
   * 处理内容生成超时
   */
  private async handleContentTimeout(order: any) {
    const client = await getMySQLClient();
    const logId = uuidv4();
    let result: { action: 'auto_cancel' | 'reassign'; orderId: string; avatarId: string; retryCount: number } = null;

    try {
      await client.query('START TRANSACTION');

      // 检查是否有正在进行的生成任务
      const processing = await client.query(
        `SELECT COUNT(*) as cnt FROM generated_content WHERE order_id = ? AND status = 'processing'`,
        [order.id]
      );

      if (processing?.[0]?.cnt > 0) {
        // 还有正在处理的任务，给30分钟宽限
        this.logger.log(`订单 ${order.id} 还有处理中的内容，暂不超时`);
        await client.query('ROLLBACK');
        return;
      }

      // 获取分身名称
      let avatarName = '分身';
      try { const a = await client.query('SELECT name FROM avatars WHERE id = ?', [order.assignedTo]); avatarName = a?.[0]?.name || '分身' } catch {}

      // 标记该分身接单超时
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'timeout' 
         WHERE order_id = ? AND avatar_id = ? AND status = 'accepted'`,
        [order.id, order.assignedTo]
      );

      if (order.retryCount >= (order.maxRetries || this.MAX_RETRIES)) {
        // 超过重试次数，自动取消
        await client.query(
          `UPDATE orders SET status = 'auto_cancelled', auto_cancel_at = NOW() WHERE id = ?`,
          [order.id]
        );

        await client.query(
          `INSERT INTO order_timeout_logs (id, order_id, avatar_id, event_type, old_status, new_status, notes)
           VALUES (?, ?, ?, 'auto_cancel', 'in_progress', 'auto_cancelled', ?)`,
          [logId, order.id, order.assignedTo,
           `${avatarName}接单后超时未产出内容，已重试${order.retryCount}次，自动取消`]
        );

        result = { action: 'auto_cancel', orderId: order.id, avatarId: order.assignedTo, retryCount: order.retryCount };
      } else {
        // 取消当前分身，重新派单
        await client.query(
          `UPDATE orders SET status = 'awaiting_acceptance', retry_count = retry_count + 1, assigned_to = NULL WHERE id = ?`,
          [order.id]
        );

        await client.query(
          `INSERT INTO order_timeout_logs (id, order_id, avatar_id, event_type, old_status, new_status, notes)
           VALUES (?, ?, ?, 'auto_reassign', 'in_progress', 'awaiting_acceptance', ?)`,
          [logId, order.id, order.assignedTo,
           `${avatarName}接单后超时未产出内容，重新派单(第${order.retryCount + 1}次)`]
        );

        result = { action: 'reassign', orderId: order.id, avatarId: order.assignedTo, retryCount: order.retryCount + 1 };
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`处理内容超时失败: ${error.message}`);
      return;
    }

    // 📌 事务提交后记录事件
    if (result) {
      const evtSvc = await this.getEventService();
      if (evtSvc) {
        try {
          if (result.action === 'auto_cancel') {
            await evtSvc.recordEvent({
              orderId: result.orderId, avatarId: result.avatarId,
              eventType: 'auto_cancel', source: 'system', visibility: 'both',
              title: `订单已自动取消（分身接单后超时未产出内容，已重试${result.retryCount}次）`,
              avatarName: '分身',
            });
          } else {
            await evtSvc.recordEvent({
              orderId: result.orderId, avatarId: result.avatarId,
              eventType: 'timeout', source: 'system', visibility: 'both',
              title: `分身接单后超时未产出内容`,
              avatarName: '分身',
              content: `准备重新派单(第${result.retryCount}次)`,
            });
          }
        } catch (e) { this.logger.warn(`事件记录失败: ${e.message}`) }
      }
    }
  }

  /**
   * 3. 检查发布超时（内容生成但未发布）
   */
  private async checkPublishTimeouts(): Promise<number> {
    const client = await getMySQLClient();
    const timeoutTime = new Date(Date.now() - this.PUBLISH_TIMEOUT * 1000);

    // 查找发布超时的订单（内容已生成但超过24小时未发布）
    const orders = await client.query(
      `SELECT o.id, o.status, o.assigned_to
       FROM orders o
       WHERE o.status = 'content_generated'
       AND o.updated_at < ?`,
      [timeoutTime]
    );

    if (!orders || orders.length === 0) return 0;

    for (const order of orders) {
      const logId = uuidv4();
      try {
        // 获取分身名称
        let avatarName = '分身';
        try { const a = await client.query('SELECT name FROM avatars WHERE id = ?', [order.assignedTo]); avatarName = a?.[0]?.name || '分身' } catch {}

        // 标记为发布超时，需要人工介入
        await client.query(
          `UPDATE orders SET status = 'publish_timeout' WHERE id = ?`,
          [order.id]
        );

        await client.query(
          `INSERT INTO order_timeout_logs (id, order_id, avatar_id, event_type, old_status, new_status, notes)
           VALUES (?, ?, ?, 'publish_timeout', 'content_generated', 'publish_timeout', ?)`,
          [logId, order.id, order.assignedTo,
           `${avatarName}内容已生成但超过24小时未发布`]
        );

        this.logger.warn(`订单 ${order.id} 发布超时`);

        // 📌 记录事件
        const evtSvc = await this.getEventService();
        if (evtSvc) {
          try {
            await evtSvc.recordEvent({
              orderId: order.id, avatarId: order.assignedTo,
              eventType: 'timeout_warning', source: 'system', visibility: 'both',
              title: `${avatarName}内容已生成但超时未发布`,
              avatarName,
              content: '内容已生成超过24小时未发布，需要人工介入',
            });
          } catch (e) { this.logger.warn(`事件记录失败: ${e.message}`) }
        }
      } catch (error) {
        this.logger.error(`处理发布超时失败: ${error.message}`);
      }
    }
    return orders.length;
  }

  /**
   * 创建派单时设置过期时间
   */
  async createDispatchWithExpiry(orderId: string, avatarId: string, userId: string): Promise<string> {
    const client = await getMySQLClient();
    const dispatchId = uuidv4();
    const expiresAt = new Date(Date.now() + this.DISPATCH_TIMEOUT * 1000);

    await client.query(
      `INSERT INTO order_dispatch_requests (id, order_id, avatar_id, user_id, status, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [dispatchId, orderId, avatarId, userId, expiresAt]
    );

    return dispatchId;
  }

  /**
   * 分身接单
   */
  async acceptDispatch(dispatchId: string): Promise<boolean> {
    const client = await getMySQLClient();

    const result = await client.query(
      `UPDATE order_dispatch_requests SET status = 'accepted', responded_at = NOW() 
       WHERE id = ? AND status = 'pending'`,
      [dispatchId]
    );

    return result.affectedRows > 0;
  }

  /**
   * 分身拒绝接单
   */
  async rejectDispatch(dispatchId: string, reason?: string): Promise<boolean> {
    const client = await getMySQLClient();

    const result = await client.query(
      `UPDATE order_dispatch_requests SET status = 'rejected', responded_at = NOW(), reject_reason = ? 
       WHERE id = ? AND status = 'pending'`,
      [reason || '', dispatchId]
    );

    return result.affectedRows > 0;
  }

  /**
   * 验证发布真实性
   */
  async verifyPublish(orderId: string, proofUrl: string, publishUrl?: string): Promise<boolean> {
    const client = await getMySQLClient();

    try {
      await client.query('START TRANSACTION');

      // 更新订单的发布凭证
      await client.query(
        `UPDATE orders SET publish_proof_url = ?, publish_verified = 1, status = 'completed' WHERE id = ?`,
        [proofUrl, orderId]
      );

      // 更新生成内容的发布URL和验证状态
      await client.query(
        `UPDATE generated_content SET publish_url = ?, verification_status = 'verified', verified_at = NOW()
         WHERE order_id = ?`,
        [publishUrl || '', orderId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`验证发布失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取订单的完整状态历史
   */
  async getOrderTimeline(orderId: string): Promise<any[]> {
    const client = await getMySQLClient();

    const logs = await client.query(
      `SELECT event_type, old_status, new_status, notes, created_at 
       FROM order_timeout_logs 
       WHERE order_id = ? 
       ORDER BY created_at ASC`,
      [orderId]
    );

    return logs || [];
  }

  /**
   * 获取分身的接单表现统计
   */
  async getAvatarPerformance(avatarId: string): Promise<any> {
    const client = await getMySQLClient();

    const dispatchStats = await client.query(
      `SELECT 
         COUNT(*) as total_dispatched,
         SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count,
         SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_count,
         ROUND(AVG(CASE WHEN status = 'accepted' AND responded_at IS NOT NULL 
           THEN TIMESTAMPDIFF(SECOND, created_at, responded_at) ELSE NULL END)) as avg_response_seconds
       FROM order_dispatch_requests 
       WHERE target_avatar_id = ?`,
      [avatarId]
    );

    const contentStats = await client.query(
      `SELECT 
         COUNT(DISTINCT o.id) as total_accepted_orders,
         SUM(CASE WHEN o.status IN ('content_generated', 'published', 'completed') THEN 1 ELSE 0 END) as delivered_count,
         SUM(CASE WHEN o.status = 'auto_cancelled' THEN 1 ELSE 0 END) as failed_count
       FROM orders o
       WHERE o.assigned_to = ?`,
      [avatarId]
    );

    return {
      dispatch: dispatchStats?.[0] || {},
      content: contentStats?.[0] || {},
    };
  }

  /**
   * 手动转派订单到其他分身
   */
  async reassignOrder(orderId: string, reason?: string) {
    const client = await getMySQLClient();

    // 1. 获取订单当前信息
    const orders = await client.query(
      `SELECT id, status, assigned_to, retry_count, max_retries FROM orders WHERE id = ?`,
      [orderId]
    );
    const order = orders?.[0];
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    // 2. 检查重试次数
    if (order.retryCount >= order.maxRetries) {
      // 超过最大重试次数，自动取消订单
      await client.query(
        `UPDATE orders SET status = 'auto_cancelled', auto_cancel_at = NOW() WHERE id = ?`,
        [orderId]
      );
      await this.logTimeout(orderId, null, order.assignedTo, 'auto_cancel', order.status, 'auto_cancelled', '超过最大重试次数，自动取消');
      return { success: false, message: '超过最大重试次数，订单已自动取消' };
    }

    // 3. 标记旧派单为 expired
    if (order.assignedTo) {
      await client.query(
        `UPDATE order_dispatch_requests SET status = 'expired' WHERE order_id = ? AND avatar_id = ? AND status IN ('pending', 'accepted')`,
        [orderId, order.assignedTo]
      );
    }

    // 4. 增加重试次数，重置订单状态
    await client.query(
      `UPDATE orders SET 
        status = 'awaiting_acceptance',
        assigned_to = NULL,
        retry_count = retry_count + 1,
        deadline_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
      WHERE id = ?`,
      [orderId]
    );

    // 5. 记录日志
    await this.logTimeout(orderId, null, order.assignedTo, 'auto_reassign', order.status, 'awaiting_acceptance', reason || '手动转派');

    return { success: true, message: '订单已重新分配', retryCount: order.retryCount + 1 };
  }

  private async logTimeout(
    orderId: string,
    dispatchId: string | null,
    avatarId: string | null,
    eventType: string,
    oldStatus: string,
    newStatus: string,
    notes: string,
  ) {
    const client = getMySQLClient();
    const id = 'otl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    await client.query(
      `INSERT INTO order_timeout_logs (id, order_id, dispatch_id, avatar_id, event_type, old_status, new_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderId, dispatchId, avatarId, eventType, oldStatus, newStatus, notes],
    );
  }
}
