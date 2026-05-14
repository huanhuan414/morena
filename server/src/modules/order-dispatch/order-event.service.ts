// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

/**
 * 订单事件服务 - 统一事件流
 * 
 * 核心职责：
 * 1. 记录所有订单状态变更事件
 * 2. 为发单方/接单方提供不同视角的时间线
 * 3. 自动触发通知
 * 
 * 设计原则：
 * - 单一事实来源：order_events 是所有状态变更的唯一记录
 * - 双向可见性：visibility 控制哪些事件对哪方可见
 * - 可读性：title/content 可直接用于前端展示
 */
@Injectable()
export class OrderEventService {
  private readonly logger = new Logger(OrderEventService.name)

  // ==================== 事件定义 ====================
  
  /**
   * 事件类型配置
   * title_tpl: 标题模板，{avatarName} 等占位符会被替换
   * icon: 前端图标
   * color: 展示颜色
   * default_visibility: 默认可见性
   */
  private readonly EVENT_CONFIG: Record<string, {
    titleTpl: string
    icon: string
    color: string
    defaultVisibility: string
  }> = {
    created: {
      titleTpl: '订单已创建',
      icon: 'FileText',
      color: '#3b82f6',
      defaultVisibility: 'both'
    },
    dispatched: {
      titleTpl: '已派单给 {avatarName}',
      icon: 'Send',
      color: '#8b5cf6',
      defaultVisibility: 'both'
    },
    accepted: {
      titleTpl: '{avatarName} 已接单',
      icon: 'CircleCheck',
      color: '#22c55e',
      defaultVisibility: 'both'
    },
    rejected: {
      titleTpl: '{avatarName} 婉拒了订单',
      icon: 'CircleX',
      color: '#9ca3af',
      defaultVisibility: 'both'
    },
    expired: {
      titleTpl: '{avatarName} 超时未接单',
      icon: 'Clock',
      color: '#f59e0b',
      defaultVisibility: 'both'
    },
    content_started: {
      titleTpl: '{avatarName} 开始生成内容',
      icon: 'Loader',
      color: '#6366f1',
      defaultVisibility: 'both'
    },
    content_completed: {
      titleTpl: '{avatarName} 内容已生成',
      icon: 'FileCheck',
      color: '#22c55e',
      defaultVisibility: 'both'
    },
    content_failed: {
      titleTpl: '{avatarName} 内容生成失败',
      icon: 'AlertTriangle',
      color: '#ef4444',
      defaultVisibility: 'both'
    },
    publish_started: {
      titleTpl: '{avatarName} 开始发布',
      icon: 'Upload',
      color: '#06b6d4',
      defaultVisibility: 'both'
    },
    publish_completed: {
      titleTpl: '{avatarName} 已发布到 {platformName}',
      icon: 'Globe',
      color: '#22c55e',
      defaultVisibility: 'both'
    },
    publish_failed: {
      titleTpl: '{avatarName} 发布失败',
      icon: 'AlertTriangle',
      color: '#ef4444',
      defaultVisibility: 'both'
    },
    publish_verified: {
      titleTpl: '发布已验证通过',
      icon: 'ShieldCheck',
      color: '#22c55e',
      defaultVisibility: 'both'
    },
    revision_requested: {
      titleTpl: '发单方要求修改',
      icon: 'RefreshCw',
      color: '#f59e0b',
      defaultVisibility: 'both'
    },
    reassign: {
      titleTpl: '订单已转派给其他分身',
      icon: 'Repeat',
      color: '#f59e0b',
      defaultVisibility: 'both'
    },
    timeout_warning: {
      titleTpl: '{avatarName} 即将超时',
      icon: 'AlertTriangle',
      color: '#f59e0b',
      defaultVisibility: 'both'
    },
    auto_cancel: {
      titleTpl: '订单已自动取消',
      icon: 'Ban',
      color: '#ef4444',
      defaultVisibility: 'both'
    },
    cancel: {
      titleTpl: '订单已取消',
      icon: 'Ban',
      color: '#ef4444',
      defaultVisibility: 'both'
    },
    completed: {
      titleTpl: '订单已完成',
      icon: 'PartyPopper',
      color: '#22c55e',
      defaultVisibility: 'both'
    },
    accepted_by_publisher: {
      titleTpl: '发单方验收通过',
      icon: 'CircleCheckBig',
      color: '#22c55e',
      defaultVisibility: 'both'
    }
  }

  /**
   * 记录事件
   */
  async recordEvent(params: {
    orderId: string
    dispatchId?: string
    avatarId?: string
    userId?: string
    eventType: string
    source?: 'publisher' | 'avatar' | 'system'
    visibility?: 'both' | 'publisher' | 'avatar' | 'system'
    title?: string
    content?: string
    eventData?: Record<string, any>
    avatarName?: string
    platformName?: string
  }) {
    const db = getMySQLClient()
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    
    const config = this.EVENT_CONFIG[params.eventType] || {}
    
    // 替换标题模板中的占位符
    let title = params.title || config.titleTpl || params.eventType
    title = title
      .replace(/\{avatarName\}/g, params.avatarName || '分身')
      .replace(/\{platformName\}/g, params.platformName || '平台')

    const eventData = {
      ...(params.eventData || {}),
      ...(params.avatarName ? { avatarName: params.avatarName } : {}),
      ...(params.platformName ? { platformName: params.platformName } : {}),
    }

    try {
      await db.query(
        `INSERT INTO order_events (id, order_id, dispatch_id, avatar_id, user_id, event_type, source, visibility, title, content, event_data, icon, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          params.orderId,
          params.dispatchId || null,
          params.avatarId || null,
          params.userId || null,
          params.eventType,
          params.source || 'system',
          params.visibility || config.defaultVisibility || 'both',
          title,
          params.content || null,
          JSON.stringify(eventData),
          config.icon || 'Activity',
          config.color || '#6b7280',
        ]
      )

      this.logger.log(`事件记录: [${params.eventType}] ${title} (order=${params.orderId})`)

      // 异步触发通知（不阻塞主流程）
      this.triggerNotifications(params, title).catch(err => {
        this.logger.warn(`通知触发失败: ${err.message}`)
      })

      return { id, title }
    } catch (error) {
      this.logger.error(`记录事件失败: ${error.message}`)
      return { id: null, title: '' }
    }
  }

  /**
   * 获取订单时间线（发单方视角）
   * 看到所有 visibility = both | publisher 的事件
   */
  async getPublisherTimeline(orderId: string, limit = 50) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT id, order_id, dispatch_id, avatar_id, event_type, source, 
              title, content, event_data, icon, color, created_at
       FROM order_events 
       WHERE order_id = ? AND visibility IN ('both', 'publisher')
       ORDER BY created_at ASC
       LIMIT ?`,
      [orderId, limit]
    )
    return this.formatTimeline(rows || [])
  }

  /**
   * 获取订单时间线（接单方/分身视角）
   * 看到所有 visibility = both | avatar 的事件 + 只涉及该分身的事件
   */
  async getAvatarTimeline(orderId: string, avatarId: string, limit = 50) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT id, order_id, dispatch_id, avatar_id, event_type, source,
              title, content, event_data, icon, color, created_at
       FROM order_events 
       WHERE order_id = ? 
       AND (
         visibility IN ('both', 'avatar') 
         OR (visibility = 'publisher' AND avatar_id = ?)
       )
       ORDER BY created_at ASC
       LIMIT ?`,
      [orderId, avatarId, limit]
    )
    return this.formatTimeline(rows || [])
  }

  /**
   * 获取分身的所有事件（跨订单）
   */
  async getAvatarEvents(userId: string, limit = 20) {
    const db = getMySQLClient()
    // 先查该用户拥有的分身
    const avatars = await db.query(
      `SELECT id FROM avatars WHERE user_id = ? AND status = 'active'`,
      [userId]
    )
    const avatarIds = (avatars || []).map((a: any) => a.id)
    if (avatarIds.length === 0) return []

    const placeholders = avatarIds.map(() => '?').join(',')
    const rows = await db.query(
      `SELECT e.id, e.order_id, e.dispatch_id, e.avatar_id, e.event_type, e.source,
              e.title, e.content, e.event_data, e.icon, e.color, e.created_at,
              o.title as order_title
       FROM order_events e
       LEFT JOIN orders o ON e.order_id = o.id
       WHERE e.avatar_id IN (${placeholders})
       AND e.visibility IN ('both', 'avatar')
       ORDER BY e.created_at DESC
       LIMIT ?`,
      [...avatarIds, limit]
    )
    return this.formatTimeline(rows || [])
  }

  /**
   * 获取发单方的未读事件数
   */
  async getUnreadCount(userId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT COUNT(*) as cnt FROM order_events e
       JOIN orders o ON e.order_id = o.id
       WHERE o.user_id = ? 
       AND e.visibility IN ('both', 'publisher')
       AND e.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    )
    return rows?.[0]?.cnt || 0
  }

  /**
   * 格式化时间线数据
   */
  private formatTimeline(rows: any[]) {
    return rows.map((row: any) => {
      let eventData = row.eventData || row.event_data
      if (typeof eventData === 'string') {
        try { eventData = JSON.parse(eventData) } catch { eventData = {} }
      }

      const createdAt = row.createdAt || row.created_at

      return {
        id: row.id,
        orderId: row.orderId || row.order_id,
        dispatchId: row.dispatchId || row.dispatch_id,
        avatarId: row.avatarId || row.avatar_id,
        eventType: row.eventType || row.event_type,
        source: row.source,
        title: row.title,
        content: row.content,
        eventData,
        icon: row.icon,
        color: row.color,
        orderTitle: row.orderTitle || row.order_title || null,
        createdAt: createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
      }
    })
  }

  /**
   * 根据事件类型自动触发通知
   */
  private async triggerNotifications(params: any, title: string) {
    try {
      const { NotificationService } = await import('../notification/notification.service')
      // 延迟导入避免循环依赖
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()

      // 获取订单信息
      const orders = await db.query('SELECT user_id, title FROM orders WHERE id = ?', [params.orderId])
      const order = orders?.[0]
      if (!order) return

      // 获取分身所属用户
      let avatarUserId = null
      if (params.avatarId) {
        const avatars = await db.query('SELECT user_id FROM avatars WHERE id = ?', [params.avatarId])
        avatarUserId = avatars?.[0]?.user_id
      }

      const notificationService = new NotificationService()

      // 根据事件类型决定通知谁
      const notifyPublisher = ['accepted', 'rejected', 'content_completed', 'content_failed', 
        'publish_completed', 'publish_failed', 'timeout_warning', 'expired', 'completed'].includes(params.eventType)
      
      const notifyAvatar = ['dispatched', 'revision_requested', 'reassign', 'auto_cancel', 'cancel',
        'accepted_by_publisher'].includes(params.eventType)

      if (notifyPublisher && order.user_id) {
        await notificationService.createNotification({
          user_id: order.user_id,
          type: `order_${params.eventType}`,
          title: '订单动态',
          content: title,
          metadata: { orderId: params.orderId, eventType: params.eventType }
        })
      }

      if (notifyAvatar && avatarUserId) {
        await notificationService.createNotification({
          user_id: avatarUserId,
          type: `order_${params.eventType}`,
          title: '任务动态',
          content: title,
          metadata: { orderId: params.orderId, eventType: params.eventType, avatarId: params.avatarId }
        })
      }
    } catch (err) {
      // 通知失败不影响主流程
      this.logger.warn(`通知触发异常: ${err.message}`)
    }
  }
}
