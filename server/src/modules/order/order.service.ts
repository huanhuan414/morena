// @ts-nocheck
import { Injectable, Inject, forwardRef } from '@nestjs/common'
import * as crypto from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import { NotificationService } from '../notification/notification.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'
import { WechatPayService } from '../payment/wechat-pay.service'

/**
 * 字段命名规则说明：
 * - 写入DB（INSERT/UPDATE）：字段名用 snake_case（与DB列名一致）
 * - 读取DB返回值：字段名用 camelCase（MysqlClient 的 convertKeysToCamel 自动转换）
 * - SQL AS 别名：如 `x as avatar_id`，返回值也是 camelCase → `avatarId`
 */

@Injectable()
export class OrderService {
  constructor(
    @Inject(EarningService) private readonly earningService: EarningService,
    @Inject(NotificationService) private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => OrderDispatchService)) private readonly dispatchService: OrderDispatchService,
    @Inject(forwardRef(() => WechatPayService)) private readonly wechatPayService: WechatPayService,
  ) {}

  private safeParseJson<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return value as T
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T
      } catch {
        return fallback
      }
    }
    return fallback
  }

  private normalizeDispatchStatus(status?: string): string {
    if (status === 'confirmed') {
      return 'accepted'
    }
    return status || 'pending'
  }

  private isAcceptedDispatchStatus(status?: string): boolean {
    return [
      'accepted',
      'generating',
      'preview',
      'publishing',
      'published',
      'feedback_submitted',
      'awaiting_acceptance',
      'completed'
    ].includes(this.normalizeDispatchStatus(status))
  }

  private normalizeContentStatus(status?: string): string {
    const value = String(status || '').trim().toLowerCase()
    if (['pending', 'processing', 'generating_text', 'generating_images', 'generating_video'].includes(value)) return 'generating'
    if (['completed', 'revision_requested'].includes(value)) return 'preview'
    if (['published'].includes(value)) return 'published'
    if (['feedback_submitted'].includes(value)) return 'awaiting_acceptance'
    if (['settled', 'done'].includes(value)) return 'completed'
    return value || 'generating'
  }

  // 订单状态流转映射
  async syncOrderStatusByContent(orderId: string): Promise<void> {
    const db = getMySQLClient()
    try {
      const dispatches = await db.query(
        'SELECT id, status FROM order_dispatch_requests WHERE order_id = ?',
        [orderId]
      )
      const contents = await db.query(
        'SELECT id, status FROM content_generation_requests WHERE order_id = ?',
        [orderId]
      )

      const allDispatchStatuses = (dispatches || []).map((d: any) => d.status)
      const allContentStatuses = (contents || []).map((c: any) => this.normalizeContentStatus(c.status))
      const totalDispatches = allDispatchStatuses.length
      const totalContents = allContentStatuses.length

      if (totalDispatches === 0) return

      const hasPending = allDispatchStatuses.includes('pending')
      const hasAccepted = allDispatchStatuses.includes('accepted') || allDispatchStatuses.includes('feedback_submitted')
      const acceptedDispatchCount = allDispatchStatuses.filter(s => ['accepted', 'feedback_submitted'].includes(s)).length
      const completedDispatchCount = allDispatchStatuses.filter(s => ['completed', 'settled', 'done'].includes(s)).length

      const hasProcessing = allContentStatuses.some(s => ['processing', 'publishing'].includes(s))
      const hasRevisionRequested = allContentStatuses.some(s => s === 'revision_requested')
      const allContentCompleted = totalContents > 0 && allContentStatuses.every(s => s === 'completed')
      const allContentAwaitingAcceptance = totalContents > 0 && allContentStatuses.every(s => ['awaiting_acceptance', 'completed'].includes(s))
      const allContentSubmitted = totalContents > 0 && allContentStatuses.every(s => ['completed', 'published', 'awaiting_acceptance'].includes(s))

      const currentOrder = await this.getOrderById(orderId)
      if (!currentOrder) return
      const currentStatus = currentOrder.status
      const requiredAvatarCount = currentOrder.expectedQuantity || currentOrder.avatarCount || 1

      let newStatus: string | null = null

      if (completedDispatchCount >= requiredAvatarCount) {
        newStatus = 'completed'
      } else if (hasRevisionRequested) {
        newStatus = 'revision_requested'
      } else if (allContentAwaitingAcceptance) {
        newStatus = 'awaiting_acceptance'
      } else if (allContentSubmitted) {
        newStatus = 'awaiting_acceptance'
        if (allContentStatuses.some(s => ['published', 'completed'].includes(s)) && !allContentStatuses.some(s => s === 'awaiting_acceptance')) {
          newStatus = 'submitted'
        }
      } else if (hasProcessing) {
        newStatus = 'in_progress'
      } else if (hasAccepted && !hasPending) {
        if (acceptedDispatchCount >= requiredAvatarCount) {
          newStatus = 'in_progress'
        } else {
          newStatus = 'pending_acceptance'
        }
      } else if (hasAccepted && hasPending) {
        newStatus = 'pending_acceptance'
      }

      if (newStatus && newStatus !== currentStatus) {
        const payload: Record<string, any> = {
          status: newStatus,
          updated_at: new Date()
        }
        if (newStatus === 'completed') {
          payload.completed_at = new Date()
        }
        const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
        const params = [...Object.values(payload), orderId]
        await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)
        console.log(`[OrderService] 订单状态同步: ${currentStatus} → ${newStatus}, orderId=${orderId}, 已验收${completedDispatchCount}/${requiredAvatarCount}`)

        if (newStatus === 'completed') {
          await this.triggerSettlement(orderId)
        }
      }
    } catch (error: any) {
      console.error(`[OrderService] 同步订单状态失败: orderId=${orderId}, error=${error.message}`)
    }
  }

  private statusTransitions: Record<string, string[]> = {
    'pending_payment': ['open', 'cancelled'],
    'open': ['pending_dispatch', 'cancelled'],
    'pending_dispatch': ['pending_acceptance', 'cancelled'],
    'pending_acceptance': ['in_progress', 'rejected', 'cancelled'],
    'in_progress': ['submitted', 'cancelled'],
    'submitted': ['awaiting_acceptance', 'revision_requested'],
    'awaiting_acceptance': ['completed', 'revision_requested'],
    'revision_requested': ['in_progress'],
    'completed': [],
    'cancelled': [],
    'rejected': []
  }

  private isValidTransition(fromStatus: string, toStatus: string): boolean {
    const allowedTransitions = this.statusTransitions[fromStatus] || []
    return allowedTransitions.includes(toStatus)
  }

  async createOrder(userId: string, orderData: Record<string, any>) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    console.log('[OrderService] 创建订单，ID:', id, '数据:', orderData)
    
    const avatarCount = orderData.avatarCount || orderData.avatar_count || orderData.requiredAvatars || 1
    
    const priorityMap: Record<string, number> = {
      'low': 1,
      'normal': 2,
      'high': 3
    }
    const priorityValue = priorityMap[orderData.priority] || priorityMap['normal']
    
    const budget = orderData.totalPrice || orderData.total_price || orderData.budget || 0

    // 写入DB → snake_case
    const insertData: Record<string, any> = {
      id,
      user_id: userId,
      title: orderData.title,
      description: orderData.description || '',
      content_type: orderData.contentType || orderData.content_type || 'text',
      platforms: JSON.stringify(orderData.platforms || []),
      requirements: JSON.stringify(orderData.requirements || {}),
      budget,
      status: 'pending_payment',
      expected_quantity: avatarCount,
      quantity_per_avatar: orderData.quantityPerAvatar || orderData.quantity_per_avatar || 1,
      is_paid: 0,
      target_audience: orderData.targetAudience || orderData.target_audience || '',
      priority: priorityValue,
      preferred_styles: JSON.stringify(orderData.preferredStyles || orderData.preferred_styles || []),
      industry_tags: JSON.stringify(orderData.industryTags || orderData.industry_tags || []),
      deadline_at: new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
      content_deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
      auto_cancel_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
      max_retries: 3,
    }

    const fields = Object.keys(insertData).join(', ')
    const values = Object.values(insertData)
    const placeholders = values.map(() => '?').join(', ')

    await db.query(
      `INSERT INTO orders (${fields}) VALUES (${placeholders})`,
      values
    ).catch((err: any) => {
      console.error('[OrderService] INSERT 失败:', err)
      throw err
    })

    try {
      const { OrderEventService } = await import('../order-dispatch/order-event.service')
      const eventService = new OrderEventService()
      eventService.recordEvent({
        orderId: id,
        userId: userId,
        eventType: 'created',
        source: 'publisher',
        visibility: 'both',
        title: '订单已创建',
        eventData: { title: orderData.title, budget, contentType: orderData.contentType || orderData.content_type },
      }).catch(err => console.warn('[事件] created 记录失败:', err.message))
    } catch (err) {
      console.warn('[OrderService] 事件记录跳过:', err.message)
    }

    // 创建微信支付订单
    let paymentParams = null
    const openid = orderData.openid
    if (openid && budget > 0) {
      try {
        const payResult = await this.wechatPayService.createMiniProgramOrder({
          userId,
          openid,
          planId: id,
          description: `Morena AI 任务: ${orderData.title || '发单支付'}`,
          amount: Number(budget),
          orderType: 'order',
        })
        paymentParams = {
          paymentOrderId: payResult.orderId,
          outTradeNo: payResult.outTradeNo,
          timeStamp: payResult.timeStamp,
          nonceStr: payResult.nonceStr,
          packageValue: payResult.packageValue,
          signType: payResult.signType,
          paySign: payResult.paySign,
        }
        console.log('[OrderService] 支付订单创建成功:', payResult.outTradeNo)
      } catch (err) {
        console.error('[OrderService] 创建支付订单失败:', err.message)
      }
    }

    return { id, ...insertData, avatarCount, payment: paymentParams }
  }

  async getOrderById(orderId: string) {
    const db = getMySQLClient()
    
    const orderRows = await db.query(
      `SELECT id, user_id, avatar_id, title, description, content_type, 
       platforms, requirements, budget, status, result, created_at, updated_at,
       completed_at, latitude, longitude, location_text, target_audience,
       expected_quantity, deadline, order_type, priority, assigned_to,
       avatar_count, quantity_per_avatar, is_paid
       FROM orders WHERE id = ?`,
      [orderId]
    )
    
    if (!orderRows || orderRows.length === 0) {
      return null
    }
    // 读取DB返回值 → camelCase
    const order = orderRows[0]
    
    // SQL别名 avatar_id → 返回值为 avatarId
    const avatarRows = await db.query(
      `SELECT odr.id, odr.avatar_id, odr.status, odr.platform, odr.reject_reason, odr.created_at,
              a.name as nickname, a.avatar_url
       FROM order_dispatch_requests odr
       LEFT JOIN avatars a ON odr.avatar_id = a.id
       WHERE odr.order_id = ?
       ORDER BY odr.created_at DESC`,
      [orderId]
    )

    let processingRows: any[] = []
    try {
      const sql = `SELECT id, order_id, avatar_id, status, content_type, content, images, video_url, publish_feedback, created_at, updated_at FROM content_generation_requests WHERE order_id = ? ORDER BY updated_at DESC, created_at DESC`
      processingRows = await db.query(sql, [orderId])
    } catch (err) {
      console.log('[OrderService] processingRows error:', err)
    }

    const latestProcessingMap = new Map<string, any>()
    for (const row of processingRows || []) {
      const avatarId = row.avatarId
      if (avatarId && !latestProcessingMap.has(avatarId)) {
        latestProcessingMap.set(avatarId, row)
      }
    }
    
    const avatarStats = (avatarRows || []).map((row: any) => {
      const avatarId = row.avatarId
      const processing = latestProcessingMap.get(avatarId)
      const normalizedStatus = processing
        ? this.normalizeContentStatus(processing?.status)
        : this.normalizeDispatchStatus(row.status)

      return {
        id: row.id,
        requestId: processing?.id || null,
        avatarId,
        avatarName: row.nickname || '未知分身',
        nickname: row.nickname || '未知分身',
        avatarUrl: row.avatarUrl,
        platform: row.platform || 'unknown',
        status: normalizedStatus,
        dispatchStatus: row.status,
        contentStatus: processing?.status || null,
        rejectReason: row.rejectReason || null,
        contentType: processing?.contentType || order.contentType || 'image_text',
        content: processing?.content || null,
        images: this.safeParseJson<any[]>(processing?.images, []),
        videoUrl: this.safeParseJson<string[]>(processing?.videoUrl, []),
        contentUpdatedAt: processing?.updatedAt ? new Date(processing.updatedAt).toISOString() : null,
        publishFeedback: this.safeParseJson(processing?.publishFeedback, {}),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString()
      }
    })

    const summaryStats = {
      totalAvatars: avatarStats.length,
      acceptedAvatars: avatarStats.filter((row: any) => ['generating', 'preview', 'publishing', 'published', 'awaiting_acceptance', 'completed'].includes(row.status)).length,
      completedAvatars: avatarStats.filter((row: any) => row.status === 'completed').length,
      totalPosts: 0,
      totalPlatforms: 0,
      totalPublished: avatarStats.filter((row: any) => ['published', 'awaiting_acceptance', 'completed'].includes(row.status)).length,
      totalManual: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      avatarStats
    }
    
    const createdAt = order.createdAt instanceof Date 
      ? order.createdAt.toISOString() 
      : String(order.createdAt)
    
    return {
      ...order,
      id: order.id,
      title: order.title,
      description: order.description,
      contentType: order.contentType,
      platforms: typeof order.platforms === 'string' 
        ? JSON.parse(order.platforms) 
        : (order.platforms || []),
      requirements: typeof order.requirements === 'string' 
        ? JSON.parse(order.requirements) 
        : (order.requirements || {}),
      budget: order.budget,
      expectedEarnings: (order.expectedQuantity && Number(order.budget) > 0)
        ? Math.round(Number(order.budget) / order.expectedQuantity * 100) / 100
        : Number(order.budget) || 0,
      status: order.status,
      avatarCount: order.expectedQuantity || order.avatarCount || 1,
      avatarStats,
      summary_stats: summaryStats,
      createdAt
    }
  }

  async getOrders(userId: string, filters: Record<string, any> = {}) {
    const db = getMySQLClient()
    
    let whereClause = 'WHERE user_id = ?'
    const params: any[] = [userId]
    
    if (filters.status) {
      whereClause += ' AND status = ?'
      params.push(filters.status)
    }
    
    const rows = await db.query(
      `SELECT id, title, description, content_type, platforms, requirements, 
              budget, status, expected_quantity, avatar_count, is_paid, created_at
       FROM orders ${whereClause} ORDER BY created_at DESC LIMIT 100`,
      params
    )
    
    const orderIds = (rows || []).map((row: any) => row.id)
    let dispatchCounts: Record<string, number> = {}
    
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(', ')
      const countRows = await db.query(
        `SELECT order_id, COUNT(*) as count FROM order_dispatch_requests WHERE order_id IN (${placeholders}) GROUP BY order_id`,
        orderIds
      )
      for (const row of countRows) {
        // order_id → orderId (camelCase)
        dispatchCounts[row.orderId] = row.count
      }
    }
    
    // 获取每个订单的分身派单摘要（含内容生成状态的normalize映射）
    let dispatchSummaries: Record<string, any[]> = {}
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(', ')
      const dispatchRows = await db.query(
        `SELECT d.order_id, d.target_avatar_id as avatar_id, d.status, d.responded_at, d.expires_at,
                a.name as avatar_name, a.avatar_url
         FROM order_dispatch_requests d
         LEFT JOIN avatars a ON d.target_avatar_id = a.id
         WHERE d.order_id IN (${placeholders})
         ORDER BY d.created_at ASC`,
        orderIds
      )

      // 查询内容生成状态用于normalize
      let contentMap: Record<string, any> = {}
      try {
        const contentRows = await db.query(
          `SELECT id, order_id, avatar_id, status, content_type FROM content_generation_requests WHERE order_id IN (${placeholders}) ORDER BY updated_at DESC`,
          orderIds
        )
        for (const cr of contentRows || []) {
          const key = `${cr.orderId}_${cr.avatarId}`
          if (!contentMap[key]) contentMap[key] = cr
        }
      } catch (err) {
        console.log('[getOrders] content_generation_requests query error:', err)
      }

      for (const row of dispatchRows || []) {
        if (!dispatchSummaries[row.orderId]) dispatchSummaries[row.orderId] = []
        const contentRecord = contentMap[`${row.orderId}_${row.avatarId}`]
        const normalizedStatus = contentRecord
          ? this.normalizeContentStatus(contentRecord.status)
          : this.normalizeDispatchStatus(row.status)

        dispatchSummaries[row.orderId].push({
          avatarId: row.avatarId,
          avatarName: row.avatarName,
          avatarUrl: row.avatarUrl,
          status: normalizedStatus,
          dispatchStatus: row.status,
          contentStatus: contentRecord?.status || null,
          respondedAt: row.respondedAt,
          expiresAt: row.expiresAt,
        })
      }
    }

    // 获取每个订单的最新事件摘要
    let latestEvents: Record<string, any> = {}
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(', ')
      const eventRows = await db.query(
        `SELECT e.order_id, e.title, e.event_type, e.color, e.icon, e.created_at
         FROM order_events e
         INNER JOIN (
           SELECT order_id, MAX(created_at) as max_created
           FROM order_events
           WHERE order_id IN (${placeholders}) AND visibility IN ('both', 'publisher')
           GROUP BY order_id
         ) latest ON e.order_id = latest.order_id AND e.created_at = latest.max_created`,
        [...orderIds, ...orderIds]
      )
      for (const row of eventRows || []) {
        latestEvents[row.orderId] = {
          title: row.title,
          eventType: row.eventType,
          color: row.color,
          icon: row.icon,
          createdAt: row.createdAt,
        }
      }
    }

    return (rows || []).map((row: any) => {
      let platforms = row.platforms
      if (typeof platforms === 'string') {
        try { platforms = JSON.parse(platforms) } catch { platforms = [] }
      }
      
      let requirements = row.requirements
      if (typeof requirements === 'string') {
        try { requirements = JSON.parse(requirements) } catch { requirements = {} }
      }
      
      let createdAt = ''
      if (row.createdAt) {
        if (row.createdAt instanceof Date) {
          createdAt = row.createdAt.toISOString()
        } else if (typeof row.createdAt === 'string' && row.createdAt.length > 0) {
          try {
            const date = new Date(row.createdAt)
            if (!Number.isNaN(date.getTime())) {
              createdAt = date.toISOString()
            }
          } catch {
            createdAt = row.createdAt
          }
        }
      }
      if (createdAt === 'undefined' || createdAt === 'null' || createdAt === '') {
        createdAt = new Date().toISOString()
      }
      
      const dispatchedCount = dispatchCounts[row.id] || 0
      const needAvatarCount = row.expectedQuantity || row.avatarCount || 0
      const budget = Number(row.budget) || 0
      const expectedEarnings = needAvatarCount > 0 ? Math.round(budget / needAvatarCount * 100) / 100 : budget

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        contentType: row.contentType,
        platforms,
        requirements,
        budget: row.budget,
        expectedEarnings,
        status: row.status,
        avatarCount: needAvatarCount,
        dispatchedCount,
        avatarStats: row.avatarStats || [],
        isPaid: row.isPaid,
        createdAt,
        dispatchSummary: dispatchSummaries[row.id] || [],
        latestEvent: latestEvents[row.id] || null,
      }
    })
  }

  async getOrderStats(userId: string) {
    const db = getMySQLClient()
    
    const rows = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pendingPayment,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(budget) as totalBudget
       FROM orders WHERE user_id = ?`,
      [userId]
    )
    
    if (!rows || rows.length === 0) {
      return { total: 0, pendingPayment: 0, inProgress: 0, completed: 0, totalBudget: 0 }
    }
    
    return rows[0]
  }

  async updateOrder(orderId: string, updateData: Record<string, any>) {
    const db = getMySQLClient()

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      content_type: 'content_type',
      contentType: 'content_type',
      platforms: 'platforms',
      requirements: 'requirements',
      budget: 'budget',
      status: 'status',
      expected_quantity: 'expected_quantity',
      expectedQuantity: 'expected_quantity',
      avatar_count: 'avatar_count',
      avatarCount: 'avatar_count',
      quantity_per_avatar: 'quantity_per_avatar',
      quantityPerAvatar: 'quantity_per_avatar',
      avatar_id: 'avatar_id',
      avatarId: 'avatar_id',
      result: 'result',
      deadline: 'deadline',
      priority: 'priority',
      order_type: 'order_type',
      orderType: 'order_type',
      location_text: 'location_text',
      locationText: 'location_text',
      latitude: 'latitude',
      longitude: 'longitude',
      target_audience: 'target_audience',
      targetAudience: 'target_audience'
    }

    const normalized: Record<string, any> = {}
    for (const [key, value] of Object.entries(updateData || {})) {
      const dbField = fieldMap[key]
      if (!dbField) continue
      if (dbField === 'platforms') {
        normalized[dbField] = JSON.stringify(Array.isArray(value) ? value : this.safeParseJson<any[]>(value, []))
      } else if (dbField === 'requirements' || dbField === 'result') {
        normalized[dbField] = typeof value === 'string' ? value : JSON.stringify(value ?? {})
      } else {
        normalized[dbField] = value
      }
    }

    if (Object.keys(normalized).length > 0) {
      normalized.updated_at = new Date()
      const setClause = Object.keys(normalized).map((key) => `${key} = ?`).join(', ')
      const params = [...Object.values(normalized), orderId]
      await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)
    }

    return this.getOrderById(orderId)
  }

  async getOpenOrders(page: number = 1, pageSize: number = 20) {
    const db = getMySQLClient()
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20
    const offset = (safePage - 1) * safePageSize

    const whereClause = `
      WHERE (
        o.status IN ('pending', 'pending_acceptance', 'awaiting_acceptance', 'in_progress', 'accepted', 'content_generated', 'submitted', 'published', 'publish_failed', 'publish_timeout')
        OR (o.status = 'pending_payment' AND IFNULL(o.is_paid, 0) = 1)
      )
    `

    const rows = await db.query(
      `SELECT o.id, o.user_id, o.avatar_id, o.title, o.description, o.content_type, o.platforms, o.requirements,
              o.budget, o.status, o.expected_quantity, o.avatar_count, o.quantity_per_avatar, o.is_paid,
              o.created_at, o.updated_at,
              COALESCE(
                (SELECT a.name FROM avatars a WHERE a.id = o.avatar_id LIMIT 1),
                (SELECT a.name FROM avatars a WHERE a.user_id = o.user_id AND a.status = 'active' ORDER BY a.created_at DESC LIMIT 1),
                u.nickname
              ) as publisher_nickname,
              COALESCE(
                (SELECT a.avatar_url FROM avatars a WHERE a.id = o.avatar_id LIMIT 1),
                (SELECT a.avatar_url FROM avatars a WHERE a.user_id = o.user_id AND a.status = 'active' ORDER BY a.created_at DESC LIMIT 1),
                u.avatar
              ) as publisher_avatar
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ${safePageSize} OFFSET ${offset}`
    )

    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`
    )
    const total = Number(totalRows?.[0]?.total || 0)

    // 读取DB返回值 → camelCase
    const items = (rows || []).map((row: any) => ({
      id: row.id,
      userId: row.userId || row.user_id,
      avatarId: row.avatarId || row.avatar_id,
      title: row.title,
      description: row.description || '',
      contentType: row.contentType || row.content_type,
      platforms: this.safeParseJson<any[]>(row.platforms, []),
      requirements: this.safeParseJson<Record<string, any>>(row.requirements, {}),
      budget: Number(row.budget || 0),
      status: row.status,
      avatarCount: row.expectedQuantity || row.expected_quantity || row.avatarCount || row.avatar_count || 1,
      quantityPerAvatar: row.quantityPerAvatar || row.quantity_per_avatar || 1,
      isPaid: row.isPaid ?? row.is_paid ?? 0,
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      updatedAt: row.updatedAt || row.updated_at || null,
      publisherNickname: row.publisherNickname || row.publisher_nickname || '发布方',
      publisherAvatar: row.publisherAvatar || row.publisher_avatar || ''
    }))

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      items
    }
  }

  async getOrderFeedback(orderId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT id, order_id, avatar_id, result, created_at, updated_at
       FROM order_results
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    )

    const row = rows?.[0]
    if (!row) return null

    // 读取DB返回值 → camelCase
    return {
      id: row.id,
      orderId: row.orderId,
      avatarId: row.avatarId,
      result: this.safeParseJson<Record<string, any>>(row.result, {}),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  async getOrderRating(orderId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT
         AVG(CASE WHEN customer_rating IS NOT NULL THEN customer_rating END) as averageRating,
         COUNT(CASE WHEN customer_rating IS NOT NULL THEN 1 END) as ratingCount
       FROM order_results
       WHERE order_id = ?`,
      [orderId]
    )

    const data = rows?.[0] || {}
    return {
      averageRating: Number(data.averageRating || 0),
      ratingCount: Number(data.ratingCount || 0)
    }
  }

  async updateOrderStatus(orderId: string, status: string, avatarId?: string) {
    const db = getMySQLClient()
    
    const currentOrder = await this.getOrderById(orderId)
    if (!currentOrder) {
      throw new Error('订单不存在')
    }

    const currentStatus = currentOrder.status
    if (!this.isValidTransition(currentStatus, status)) {
      throw new Error(`无法从状态 "${currentStatus}" 转换到 "${status}"`)
    }

    // 写入DB → snake_case
    const payload: Record<string, any> = {
      status,
      updated_at: new Date()
    }

    if (avatarId) {
      payload.avatar_id = avatarId
    }

    if (status === 'completed') {
      payload.completed_at = new Date()
    }

    const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
    const params = [...Object.values(payload), orderId]
    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)

    await this.notifyStatusChange(orderId, status)

    if (status === 'completed') {
      await this.triggerSettlement(orderId)
    }

    return this.getOrderById(orderId)
  }

  async acceptOrder(orderId: string, avatarId?: string) {
    const db = getMySQLClient()
    const orderRows = await db.query(
      `SELECT id, status, is_paid FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    )
    const order = orderRows?.[0]
    if (!order) {
      throw new Error('订单不存在')
    }

    // 读取DB返回值 → camelCase
    const isPaid = Number(order.isPaid ?? 0)
    if (order.status === 'pending_payment' && isPaid !== 1) {
      throw new Error('订单未支付，暂不可接单')
    }

    return this.updateOrderStatus(orderId, 'in_progress', avatarId)
  }

  async submitOrderResult(orderId: string, result: Record<string, any>) {
    const db = getMySQLClient()
    // 写入DB → snake_case
    const payload = {
      result: JSON.stringify(result || {}),
      status: 'submitted',
      updated_at: new Date()
    }
    const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
    const params = [...Object.values(payload), orderId]
    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)
    return this.getOrderById(orderId)
  }

  /**
   * 取消订单（仅允许特定状态，发单方操作）
   */
  async cancelOrder(orderId: string, userId: string) {
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }
    if (order.userId !== userId) {
      throw new Error('无权操作此订单')
    }
    // 只有这些状态可以取消
    const cancellableStatuses = ['pending_payment', 'pending', 'awaiting_acceptance', 'pending_acceptance']
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`订单状态为"${order.status}"，无法取消`)
    }
    // 如果已支付，需要退款逻辑（暂记TODO，目前先标记取消）
    if (order.isPaid === 1) {
      console.log(`[cancelOrder] 订单${orderId}已支付，取消后需退款 ¥${order.budget}`)
      // TODO: 调用微信退款API
    }
    const db = getMySQLClient()
    await db.updateWhere('orders', { id: orderId }, {
      status: order.isPaid === 1 ? 'cancelled' : 'auto_cancelled',
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    })
    // 取消关联的派单请求
    await db.updateWhere('dispatch_requests', { order_id: orderId, status: 'pending' }, {
      status: 'expired',
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    })
    console.log(`[cancelOrder] 订单${orderId}已取消，原状态: ${order.status}`)
    return { success: true, orderId, newStatus: order.isPaid === 1 ? 'cancelled' : 'auto_cancelled' }
  }

  /**
   * 删除订单（仅已取消/已完成的订单可删除，物理删除）
   */
  async deleteOrder(orderId: string, userId: string) {
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }
    if (order.userId !== userId) {
      throw new Error('无权操作此订单')
    }
    const deletableStatuses = ['cancelled', 'auto_cancelled', 'completed', 'expired']
    if (!deletableStatuses.includes(order.status)) {
      throw new Error('只有已完成或已取消的订单才能删除')
    }
    const db = getMySQLClient()
    await db.query('DELETE FROM order_dispatch_requests WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM content_generation_requests WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM order_results WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM order_events WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM orders WHERE id = ?', [orderId])
    console.log(`[deleteOrder] 订单${orderId}已删除`)
    return { success: true, orderId }
  }

  async handlePaymentSuccess(orderId: string, transactionId: string) {
    const db = getMySQLClient()
    
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.isPaid === 1) {
      throw new Error('订单已支付')
    }

    // 写入DB → snake_case，status必须使用orders表ENUM允许的值
    // ENUM: pending, pending_acceptance, pending_payment, accepted, in_progress, ...
    // 支付成功后 → pending（待接单/待处理）
    await db.query(
      'UPDATE orders SET is_paid = 1, status = ?, updated_at = ? WHERE id = ?',
      ['pending', new Date(), orderId]
    )

    // 读取DB返回值 → camelCase (order.userId)
    // 只通知支付成功，不暗示已分配分身（分身匹配由前端确认页触发）
    await this.notificationService.createNotification({
      user_id: order.userId,
      type: 'order_paid',
      title: '订单支付成功',
      content: `订单"${order.title}"支付成功，正在匹配分身`,
      metadata: { orderId, transactionId }
    })

    try {
      const paidCountRows = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND is_paid = 1`,
        [order.userId]
      )
      const paidCount = paidCountRows?.[0]?.count ?? paidCountRows?.data?.[0]?.count ?? 0
      if (Number(paidCount) === 1) {
        await this.notificationService.createTemplateNotification(
          order.userId,
          'first_order_guide',
          { orderTitle: order.title || '订单' },
          { orderId }
        )
      }
    } catch (e) {
      console.warn('[handlePaymentSuccess] 首单引导通知发送失败(忽略):', (e as any)?.message || e)
    }

    // 派单和短信通知由前端匹配确认页触发（POST /api/order-dispatch/:orderId/dispatch-all）
    // 不在支付成功时自动派单，等待发单方在匹配页确认后再执行

    return this.getOrderById(orderId)
  }

  async handlePaymentFailure(orderId: string, reason: string) {
    const order = await this.getOrderById(orderId)
    if (!order) return

    // 读取DB返回值 → camelCase (order.userId)
    await this.notificationService.createNotification({
      user_id: order.userId,
      type: 'order_payment_failed',
      title: '订单支付失败',
      content: `订单"${order.title}"支付失败: ${reason}`,
      metadata: { orderId }
    })
  }

  /**
   * 重新支付（支付取消/失败/超时后再次发起）
   */
  async repayOrder(orderId: string, userId: string, openid: string) {
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }

    // 读取DB返回值 → camelCase
    if (order.userId !== userId) {
      console.error('[repayOrder] 用户ID不匹配:', { orderUserId: order.userId, requestUserId: userId })
      throw new Error('无权操作此订单')
    }
    if (order.isPaid === 1) {
      throw new Error('订单已支付，无需重复支付')
    }
    if (order.status !== 'pending_payment') {
      throw new Error('订单状态不允许支付')
    }
    const budget = Number(order.budget || 0)
    if (budget <= 0) {
      throw new Error('订单金额异常，无法支付')
    }

    // 关闭之前未支付的支付单
    try {
      const db = getMySQLClient()
      const pendingPayments = await db.query(
        `SELECT out_trade_no FROM payment_orders WHERE plan_id = ? AND order_type = 'order' AND status = 'pending'`,
        [orderId]
      )
      if (pendingPayments && pendingPayments.length > 0) {
        for (const p of pendingPayments) {
          try {
            await this.wechatPayService.closeOrder(p.outTradeNo || p.out_trade_no)
            console.log('[repayOrder] 关闭旧支付单:', p.outTradeNo || p.out_trade_no)
          } catch (e) {
            console.warn('[repayOrder] 关闭旧支付单失败(忽略):', e.message)
          }
        }
      }
    } catch (e) {
      console.warn('[repayOrder] 查询旧支付单失败(忽略):', e.message)
    }

    // 创建新的支付单
    const payResult = await this.wechatPayService.createMiniProgramOrder({
      userId,
      openid,
      planId: orderId,
      description: `Morena AI 任务: ${order.title || '发单支付'}`,
      amount: budget,
      orderType: 'order',
    })

    return {
      paymentOrderId: payResult.orderId,
      outTradeNo: payResult.outTradeNo,
      timeStamp: payResult.timeStamp,
      nonceStr: payResult.nonceStr,
      packageValue: payResult.packageValue,
      signType: payResult.signType,
      paySign: payResult.paySign,
    }
  }

  private async notifyStatusChange(orderId: string, status: string) {
    const order = await this.getOrderById(orderId)
    if (!order) return

    const statusMessages: Record<string, string> = {
      'pending': '订单已支付，等待派单',
      'awaiting_acceptance': '订单已分配，等待分身确认',
      'accepted': '分身已接单',
      'in_progress': '订单开始处理',
      'content_generated': '内容已生成',
      'submitted': '订单结果已提交',
      'published': '内容已发布',
      'completed': '订单已完成',
      'cancelled': '订单已取消',
      'auto_cancelled': '订单已自动取消',
      'timeout': '订单已超时',
      'publish_failed': '发布失败',
    }

    const message = statusMessages[status] || `订单状态变更为: ${status}`

    // notificationService.createNotification 接收 snake_case 字段（它内部自己处理）
    await this.notificationService.createNotification({
      user_id: order.userId,
      type: `order_${status}`,
      title: '订单状态变更',
      content: message,
      metadata: { orderId, status }
    })
  }

  private async triggerSettlement(orderId: string) {
    const order = await this.getOrderById(orderId)
    if (!order || order.status !== 'completed') return

    const db = getMySQLClient()
    
    const dispatchRequests = await db.query(
      'SELECT avatar_id, user_id FROM order_dispatch_requests WHERE order_id = ? AND status = ?',
      [orderId, 'completed']
    )

    const totalAmount = Number(order.budget || 0)
    const participantCount = dispatchRequests.length || 1
    const amountPerAvatar = totalAmount / participantCount

    // 读取DB返回值 → camelCase
    const participants = dispatchRequests.map((request: any) => ({
      user_id: request.userId,
      avatar_id: request.avatarId,
      amount: amountPerAvatar
    }))

    await this.earningService.createOrderEarnings(orderId, participants)
    
    await this.earningService.settleOrderEarnings(orderId)

    console.log(`[OrderService] 订单 ${orderId} 结算完成，共 ${participantCount} 个参与者，每人 ${amountPerAvatar.toFixed(2)} 元`)
  }

  async submitRating(orderId: string, rating: number, comment?: string) {
    const db = getMySQLClient()
    
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.status !== 'completed') {
      throw new Error('只有已完成的订单才能评价')
    }

    const id = crypto.randomUUID()
    // 写入DB → snake_case（order.userId/order.avatarId 是从getOrderById读取的camelCase值）
    await db.query(
      `INSERT INTO order_results (id, order_id, avatar_id, user_id, result, customer_rating, customer_comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orderId,
        order.avatarId,
        order.userId,
        JSON.stringify({ rating, comment }),
        rating,
        comment || '',
        new Date(),
        new Date()
      ]
    )

    return { success: true, message: '评价成功' }
  }
}
