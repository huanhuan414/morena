// @ts-nocheck
import { Injectable, Inject, forwardRef } from '@nestjs/common'
import * as crypto from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import { NotificationService } from '../notification/notification.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'
import {
  deriveOrderStatusFromWorkflowDetailed,
  isValidOrderStatusTransition,
  normalizeDispatchStatus,
  normalizeFulfillmentStatus,
  normalizeOrderStatus,
  ORDER_STATUS_TRANSITIONS,
} from './order-status'
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

  private ordersColumns: Set<string> | null = null
  private ordersColumnsCheckedAt = 0
  private readCache = new Map<string, { value: any; expiresAt: number }>()
  private readonly readCacheTtlMs = 2000

  private stableStringify(value: any): string {
    if (!value || typeof value !== 'object') return String(value)
    if (Array.isArray(value)) return `[${value.map((v) => this.stableStringify(v)).join(',')}]`
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${k}:${this.stableStringify(value[k])}`).join(',')}}`
  }

  private getCached<T>(key: string): T | null {
    const hit = this.readCache.get(key)
    if (!hit) return null
    if (Date.now() > hit.expiresAt) {
      this.readCache.delete(key)
      return null
    }
    return hit.value as T
  }

  private setCached(key: string, value: any) {
    this.readCache.set(key, { value, expiresAt: Date.now() + this.readCacheTtlMs })
  }

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

  private async getOrdersColumns() {
    const now = Date.now()
    if (this.ordersColumns && now - this.ordersColumnsCheckedAt < 60_000) return this.ordersColumns
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT COLUMN_NAME as columnName
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`
    )
    const columns = new Set<string>((rows || []).map((r: any) => String(r.columnName || r.COLUMN_NAME || '').toLowerCase()).filter(Boolean))
    this.ordersColumns = columns
    this.ordersColumnsCheckedAt = now
    return columns
  }

  private getPrimaryPlatformFromOrderData(orderData: Record<string, any>) {
    const rawPlatforms = orderData.platforms
    const platforms = Array.isArray(rawPlatforms) ? rawPlatforms : this.safeParseJson<any[]>(rawPlatforms, [])
    const first = platforms?.[0]
    if (typeof first === 'string' && first.trim()) return first.trim().slice(0, 50)
    return 'general'
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
      const allContentStatuses = (contents || []).map((c: any) => normalizeFulfillmentStatus(c.status))
      if (allDispatchStatuses.length === 0) return

      const completedDispatchCount = allDispatchStatuses.filter(s => ['completed', 'settled', 'done'].includes(s)).length

      const currentOrder = await this.getOrderById(orderId)
      if (!currentOrder) return
      const currentStatus = currentOrder.status
      const expectedQuantity = Number(currentOrder.expectedQuantity)
      const avatarCount = Number(currentOrder.avatarCount)
      const requiredAvatarCount =
        Number.isFinite(expectedQuantity) && expectedQuantity > 0
          ? expectedQuantity
          : Number.isFinite(avatarCount) && avatarCount > 0
            ? avatarCount
            : 1

      const derived = deriveOrderStatusFromWorkflowDetailed({
        dispatchStatuses: allDispatchStatuses,
        fulfillmentStatuses: allContentStatuses,
      })

      let newStatus: string | null = derived.status
      let deriveReason = derived.reason

      if (completedDispatchCount >= requiredAvatarCount) {
        newStatus = 'completed'
        deriveReason = 'ALL_SETTLED_AND_DISPATCH_DONE'
      }

      if (newStatus && newStatus !== currentStatus) {
        await this.updateOrderStatus(orderId, newStatus)
        console.log(`[OrderService] 订单状态同步: ${currentStatus} → ${newStatus}, orderId=${orderId}, reason=${deriveReason}, 已验收${completedDispatchCount}/${requiredAvatarCount}`)
      }

      const shouldSettle =
        (newStatus === 'completed' || currentStatus === 'completed') &&
        completedDispatchCount >= requiredAvatarCount
      if (shouldSettle) {
        await this.triggerSettlement(orderId)
      }
    } catch (error: any) {
      console.error(`[OrderService] 同步订单状态失败: orderId=${orderId}, error=${error.message}`)
    }
  }

  private isValidTransition(fromStatus: string, toStatus: string): boolean {
    return isValidOrderStatusTransition(fromStatus, toStatus)
  }

  async createOrder(userId: string, orderData: Record<string, any>) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    console.log('[OrderService] 创建订单，ID:', id, '数据:', orderData)
    
    const avatarCount = (() => {
      const raw = orderData.avatarCount ?? orderData.avatar_count ?? orderData.requiredAvatars ?? 1
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : 1
    })()
    
    const priorityMap: Record<string, number> = {
      'low': 1,
      'normal': 2,
      'high': 3
    }
    const priorityValue = priorityMap[orderData.priority] || priorityMap['normal']
    
    const budget = orderData.totalPrice || orderData.total_price || orderData.budget || 0
    const primaryPlatform = this.getPrimaryPlatformFromOrderData(orderData)
    const ordersColumns = await this.getOrdersColumns()

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
      avatar_count: avatarCount,
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
    if (ordersColumns.has('primary_platform')) {
      insertData.primary_platform = primaryPlatform
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
    const cacheKey = `order:getOrderById:${orderId}`
    const cached = this.getCached<any>(cacheKey)
    if (cached) return cached

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
    const toIsoString = (value: any): string | null => {
      if (!value) return null
      if (value instanceof Date) return value.toISOString()
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
    }
    
    // SQL别名 avatar_id → 返回值为 avatarId
    const avatarRows = await db.query(
      `SELECT odr.id, COALESCE(odr.avatar_id, odr.target_avatar_id) as avatar_id, odr.status, odr.platform, odr.reject_reason, odr.created_at,
              a.name as nickname, a.avatar_url
       FROM order_dispatch_requests odr
       LEFT JOIN avatars a ON COALESCE(odr.avatar_id, odr.target_avatar_id) = a.id
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
        ? normalizeFulfillmentStatus(processing?.status)
        : normalizeDispatchStatus(row.status)

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
        contentUpdatedAt: toIsoString(processing?.updatedAt),
        publishFeedback: this.safeParseJson(processing?.publishFeedback, {}),
        createdAt: toIsoString(row.createdAt) || new Date().toISOString()
      }
    })

    const completedAvatarStatuses = ['settled']
    const acceptedAvatarStatuses = ['generating', 'preview', 'publishing', 'published', 'awaiting_acceptance', 'settled']
    const publishedAvatarStatuses = ['published', 'awaiting_acceptance', 'settled']
    const pendingAvatarStatuses = ['pending']
    const rejectedAvatarStatuses = ['rejected', 'revision_requested', 'failed', 'partial_failed']
    const summaryStats = {
      totalAvatars: avatarStats.length,
      acceptedAvatars: avatarStats.filter((row: any) => acceptedAvatarStatuses.includes(row.status)).length,
      completedAvatars: avatarStats.filter((row: any) => completedAvatarStatuses.includes(row.status)).length,
      pendingAvatars: avatarStats.filter((row: any) => pendingAvatarStatuses.includes(row.status)).length,
      rejectedAvatars: avatarStats.filter((row: any) => rejectedAvatarStatuses.includes(row.status)).length,
      totalPosts: 0,
      totalPlatforms: 0,
      totalPublished: avatarStats.filter((row: any) => publishedAvatarStatuses.includes(row.status)).length,
      totalManual: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      effectiveStatus: order.status,
      avatarStats
    }

    const budget = Number(order.budget) || 0
    const expectedQuantity = Number(order.expectedQuantity)
    const avatarCount = Number(order.avatarCount)
    const requiredCount =
      Number.isFinite(expectedQuantity) && expectedQuantity > 0
        ? expectedQuantity
        : Number.isFinite(avatarCount) && avatarCount > 0
          ? avatarCount
          : 1
    const expectedEarnings =
      budget > 0 && requiredCount > 0
        ? Math.round((budget / requiredCount) * 100) / 100
        : budget

    const platforms = this.safeParseJson<any[]>(order.platforms, [])
    const requirements = this.safeParseJson<Record<string, any>>(order.requirements, {})
    const createdAt = toIsoString(order.createdAt)
    const updatedAt = toIsoString(order.updatedAt)
    const completedAt = toIsoString(order.completedAt)
    const deadlineAt = toIsoString(order.deadline)
    const isPaid = Number(order.isPaid) === 1

    return {
      id: order.id,
      userId: order.userId || null,
      avatarId: order.avatarId || null,
      title: order.title,
      description: order.description,
      contentType: order.contentType,
      platforms,
      requirements,
      budget,
      totalPrice: budget,
      status: order.status,
      isPaid,
      expectedQuantity: requiredCount,
      avatarCount: requiredCount,
      quantityPerAvatar: Number(order.quantityPerAvatar) || 1,
      expectedEarnings,
      targetAudience: order.targetAudience || '',
      latitude: order.latitude ?? null,
      longitude: order.longitude ?? null,
      locationText: order.locationText || '',
      orderType: order.orderType || null,
      priority: order.priority ?? null,
      assignedTo: order.assignedTo || null,
      deadlineAt,
      createdAt,
      updatedAt,
      completedAt,
      avatarStats,
      summaryStats,
      user_id: order.userId || null,
      avatar_id: order.avatarId || null,
      total_price: budget,
      is_paid: isPaid ? 1 : 0,
      expected_quantity: requiredCount,
      quantity_per_avatar: Number(order.quantityPerAvatar) || 1,
      target_audience: order.targetAudience || '',
      location_text: order.locationText || '',
      order_type: order.orderType || null,
      assigned_to: order.assignedTo || null,
      deadline: deadlineAt,
      created_at: createdAt,
      updated_at: updatedAt,
      completed_at: completedAt,
      summary_stats: summaryStats,
    }
    this.setCached(cacheKey, result)
    return result
  }

  async getOrders(userId: string, filters: Record<string, any> = {}) {
    const cacheKey = `order:getOrders:${userId}:${this.stableStringify(filters)}`
    const cached = this.getCached<any>(cacheKey)
    if (cached) return cached

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
          ? normalizeFulfillmentStatus(contentRecord.status)
          : normalizeDispatchStatus(row.status)

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

  async getOpenOrders(page: number = 1, pageSize: number = 20, platform?: string, userId?: string) {
    const db = getMySQLClient()
    const ordersColumns = await this.getOrdersColumns()
    const platformFromPlatforms = `COALESCE(NULLIF(CASE WHEN o.platforms IS NOT NULL AND JSON_VALID(o.platforms) THEN JSON_UNQUOTE(JSON_EXTRACT(o.platforms, '$[0]')) ELSE NULL END, ''), 'general')`
    const platformField = ordersColumns.has('primary_platform')
      ? `COALESCE(NULLIF(o.primary_platform, ''), ${platformFromPlatforms})`
      : platformFromPlatforms
    const deadlineField = ordersColumns.has('deadline_at')
      ? 'o.deadline_at'
      : (ordersColumns.has('deadline') ? 'o.deadline' : 'NULL')
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20
    const offset = (safePage - 1) * safePageSize

    const platformParams: any[] = []
    let platformClause = ''
    if (platform && platform !== 'all') {
      platformClause = ` AND ${platformField} = ?`
      platformParams.push(platform)
    }

    const requiredCountExpr = `GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1)`

    const whereClause = `
      WHERE (
        IFNULL(o.is_paid, 0) = 1 
        AND o.status NOT IN ('completed', 'cancelled', 'closed', 'rejected')
      )${platformClause}
      AND COALESCE(odc.accept_count, 0) < ${requiredCountExpr}
    `

    const rows = await db.query(
      `SELECT o.id, o.user_id, o.avatar_id, o.title, o.description, o.content_type, o.platforms,
              ${platformField} as primary_platform,
              o.requirements, o.target_audience, o.priority, ${deadlineField} as deadline, o.content_deadline_at,
              o.budget, o.price, o.status, o.expected_quantity, o.avatar_count, o.quantity_per_avatar, o.is_paid,
              o.created_at, o.updated_at,
              COALESCE(a_order.name, a_latest.name, u.nickname) as publisher_nickname,
              COALESCE(a_order.avatar_url, a_latest.avatar_url, u.avatar) as publisher_avatar,
              COALESCE(odc.accept_count, 0) as accept_count,
              ${requiredCountExpr} as required_count,
              COALESCE(odm.is_accepted_by_me, 0) as is_accepted_by_me,
              odp.pending_avatar_ids as pending_avatar_ids
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN avatars a_order ON a_order.id = o.avatar_id
       LEFT JOIN (
         SELECT a1.user_id, a1.name, a1.avatar_url
         FROM avatars a1
         INNER JOIN (
           SELECT x.user_id, MIN(x.id) as picked_id
           FROM avatars x
           INNER JOIN (
             SELECT user_id, MAX(created_at) as max_created_at
             FROM avatars
             WHERE status = 'active'
             GROUP BY user_id
           ) m ON m.user_id = x.user_id AND m.max_created_at = x.created_at
           WHERE x.status = 'active'
           GROUP BY x.user_id
         ) pick ON pick.picked_id = a1.id
         WHERE a1.status = 'active'
       ) a_latest ON a_latest.user_id = o.user_id
       INNER JOIN (
         SELECT r.order_id, GROUP_CONCAT(DISTINCT r.avatar_id) as pending_avatar_ids
         FROM order_dispatch_requests r
         INNER JOIN avatars a ON a.id = r.avatar_id
         WHERE r.status = 'pending' AND a.user_id = ?
         GROUP BY r.order_id
       ) odp ON odp.order_id = o.id
       LEFT JOIN (
         SELECT order_id, COUNT(DISTINCT CASE WHEN status IN ('accepted', 'in_progress', 'completed') THEN avatar_id END) as accept_count
         FROM order_dispatch_requests
         GROUP BY order_id
       ) odc ON odc.order_id = o.id
       LEFT JOIN (
         SELECT r.order_id, 1 as is_accepted_by_me
         FROM order_dispatch_requests r
         INNER JOIN avatars a ON a.id = r.avatar_id
         WHERE r.status = 'accepted' AND a.user_id = ?
         GROUP BY r.order_id
       ) odm ON odm.order_id = o.id
       ${whereClause}
       ORDER BY o.priority DESC, o.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId || null, userId || null, ...platformParams, safePageSize, offset]
    )

    const totalRows = await db.query(
      `SELECT COUNT(*) as total
       FROM orders o
       INNER JOIN (
         SELECT r.order_id
         FROM order_dispatch_requests r
         INNER JOIN avatars a ON a.id = r.avatar_id
         WHERE r.status = 'pending' AND a.user_id = ?
         GROUP BY r.order_id
       ) odp ON odp.order_id = o.id
       LEFT JOIN (
         SELECT order_id, COUNT(DISTINCT CASE WHEN status IN ('accepted', 'in_progress', 'completed') THEN avatar_id END) as accept_count
         FROM order_dispatch_requests
         GROUP BY order_id
       ) odc ON odc.order_id = o.id
       ${whereClause}`,
      [userId || null, ...platformParams]
    )
    const total = Number(totalRows?.[0]?.total || 0)

    // 读取DB返回值 → camelCase
    const items = (rows || []).map((row: any) => {
      const platforms = this.safeParseJson<any[]>(row.platforms, [])
      const primaryPlatform = row.primaryPlatform || row.primary_platform || platforms?.[0] || 'general'
      return ({
      id: row.id,
      userId: row.userId || row.user_id,
      avatarId: row.avatarId || row.avatar_id,
      title: row.title,
      description: row.description || '',
      contentType: row.contentType || row.content_type,
      platform: primaryPlatform,
      platforms,
      primaryPlatform,
      requirements: this.safeParseJson<Record<string, any>>(row.requirements, {}),
      targetAudience: row.targetAudience || row.target_audience || '',
      priority: Number(row.priority ?? 0),
      deadline: row.deadline || null,
      contentDeadlineAt: row.contentDeadlineAt || row.content_deadline_at || null,
      budget: Number(row.budget || 0),
      price: Number(row.price || row.price || 0),
      status: row.status,
      avatarCount: (() => {
        const raw = row.expectedQuantity ?? row.expected_quantity ?? row.avatarCount ?? row.avatar_count ?? 1
        const n = Number(raw)
        return Number.isFinite(n) && n > 0 ? n : 1
      })(),
      quantityPerAvatar: row.quantityPerAvatar || row.quantity_per_avatar || 1,
      isPaid: row.isPaid ?? row.is_paid ?? 0,
      acceptCount: Number(row.acceptCount || row.accept_count || 0),
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      updatedAt: row.updatedAt || row.updated_at || null,
      publisherNickname: row.publisherNickname || row.publisher_nickname || '发布方',
      publisherAvatar: row.publisherAvatar || row.publisher_avatar || '',
      acceptCount: Number(row.acceptCount || row.accept_count || 0),
      isAcceptedByMe: Boolean(row.isAcceptedByMe ?? row.is_accepted_by_me ?? 0),
      pendingAvatarIds: String(row.pendingAvatarIds || row.pending_avatar_ids || '')
        .split(',')
        .map((x) => String(x || '').trim())
        .filter(Boolean)
      })
    })

    const result = {
      page: safePage,
      pageSize: safePageSize,
      total,
      items,
    }
    this.setCached(cacheKey, result)
    return result
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
    const nextStatus = normalizeOrderStatus(status)
    if (!nextStatus) {
      throw new Error('缺少目标状态')
    }

    if (currentStatus === nextStatus) {
      return currentOrder
    }

    if (!this.isValidTransition(currentStatus, nextStatus)) {
      const allowedTransitions = ORDER_STATUS_TRANSITIONS[normalizeOrderStatus(currentStatus) || 'pending_payment'] || []
      throw new Error(`无法从状态 "${currentStatus}" 转换到 "${nextStatus}"，允许流转: ${allowedTransitions.join(', ') || '无'}`)
    }

    // 写入DB → snake_case
    const payload: Record<string, any> = {
      status: nextStatus,
      updated_at: new Date()
    }

    if (avatarId) {
      payload.avatar_id = avatarId
    }

    if (nextStatus === 'completed') {
      payload.completed_at = new Date()
    }

    const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
    const params = [...Object.values(payload), orderId]
    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)

    await this.notifyStatusChange(orderId, nextStatus)

    return this.getOrderById(orderId)
  }

  async assertOrderOwner(orderId: string, userId: string) {
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }
    if (order.userId !== userId) {
      throw new Error('无权访问此订单')
    }
    return order
  }

  async assertAvatarOwner(avatarId: string, userId: string) {
    const db = getMySQLClient()
    const avatar = await db.queryOne('avatars', { id: avatarId, user_id: userId })
    if (!avatar) {
      throw new Error('无权使用该分身')
    }
    return avatar
  }

  async acceptOrder(orderId: string, avatarId?: string) {
    if (!avatarId) {
      throw new Error('缺少分身ID')
    }

    // 接单边界统一收敛到派单服务，避免订单聚合层直接推动 orders.status。
    await this.dispatchService.acceptOrder(avatarId, orderId)
    return this.getOrderById(orderId)
  }

  async submitOrderResult(orderId: string, result: Record<string, any>) {
    const db = getMySQLClient()
    const currentOrder = await this.getOrderById(orderId)
    if (!currentOrder) {
      throw new Error('订单不存在')
    }

    const nextStatus = normalizeOrderStatus('submitted')
    if (!nextStatus) {
      throw new Error('缺少目标状态')
    }

    const shouldChangeStatus = currentOrder.status !== nextStatus
    if (shouldChangeStatus && !this.isValidTransition(currentOrder.status, nextStatus)) {
      const allowedTransitions = ORDER_STATUS_TRANSITIONS[normalizeOrderStatus(currentOrder.status) || 'pending_payment'] || []
      throw new Error(`无法从状态 "${currentOrder.status}" 转换到 "${nextStatus}"，允许流转: ${allowedTransitions.join(', ') || '无'}`)
    }

    // 结果提交允许更新 payload，但 orders.status 仍需走统一状态边界校验。
    const payload: Record<string, any> = {
      result: JSON.stringify(result || {}),
      updated_at: new Date()
    }
    const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
    const params = [...Object.values(payload), orderId]
    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)

    if (shouldChangeStatus) {
      return this.updateOrderStatus(orderId, nextStatus)
    }

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
    const cancellableStatuses = ['pending_payment', 'open', 'pending_dispatch', 'awaiting_acceptance', 'pending_acceptance']
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`订单状态为"${order.status}"，无法取消`)
    }
    // 如果已支付，需要退款逻辑（暂记TODO，目前先标记取消）
    if (order.isPaid === 1) {
      console.log(`[cancelOrder] 订单${orderId}已支付，取消后需退款 ¥${order.budget}`)
      // TODO: 调用微信退款API
    }
    const db = getMySQLClient()
    const nextStatus = normalizeOrderStatus('cancelled')
    if (!nextStatus) {
      throw new Error('缺少目标状态')
    }
    await this.updateOrderStatus(orderId, nextStatus)
    // 取消关联的派单请求
    await db.updateWhere('order_dispatch_requests', { order_id: orderId, status: 'pending' }, {
      status: 'cancelled',
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    })
    console.log(`[cancelOrder] 订单${orderId}已取消，原状态: ${order.status}`)
    return { success: true, orderId, newStatus: nextStatus }
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

    // 写入DB → snake_case，支付成功后写 canonical 订单状态
    // 支付成功后 → open（已支付，等待后续匹配/派单）
    await db.query(
      'UPDATE orders SET is_paid = 1, status = ?, updated_at = ? WHERE id = ?',
      ['open', new Date(), orderId]
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

    const canonicalStatus = normalizeOrderStatus(status)
    if (!canonicalStatus) {
      console.warn(`[notifyStatusChange] 跳过非 canonical 订单状态通知: ${status}`)
      return
    }

    const statusMessages: Record<string, string> = {
      'pending_payment': '订单待支付',
      'open': '订单已支付，等待派单',
      'pending_dispatch': '订单正在派单',
      'pending_acceptance': '订单已派单，等待接单',
      'awaiting_acceptance': '订单结果已提交，等待验收',
      'in_progress': '订单开始处理',
      'submitted': '订单结果已提交',
      'revision_requested': '订单需要修改',
      'completed': '订单已完成',
      'cancelled': '订单已取消',
      'rejected': '订单已拒绝',
    }

    const message = statusMessages[canonicalStatus] || `订单状态变更为: ${canonicalStatus}`

    // notificationService.createNotification 接收 snake_case 字段（它内部自己处理）
    await this.notificationService.createNotification({
      user_id: order.userId,
      type: `order_${canonicalStatus}`,
      title: '订单状态变更',
      content: message,
      metadata: { orderId, status: canonicalStatus }
    })
  }

  private async triggerSettlement(orderId: string) {
    const order = await this.getOrderById(orderId)
    if (!order || order.status !== 'completed') return
    if (Number((order as any).isPaid ?? (order as any).is_paid ?? 0) !== 1) return

    const db = getMySQLClient()

    const existingRewardRows = await db.query(
      `SELECT id, status
       FROM earnings
       WHERE order_id = ? AND type = ?
       LIMIT 1`,
      [orderId, 'order_reward']
    )
    if (existingRewardRows?.[0]) {
      await this.earningService.settleOrderEarnings(orderId)
      return
    }
    
    const requiredCount = (() => {
      const raw =
        (order as any).requiredCount ??
        (order as any).required_count ??
        (order as any).avatarCount ??
        (order as any).avatar_count ??
        (order as any).expectedQuantity ??
        (order as any).expected_quantity ??
        1
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
    })()

    const totalAmount = Number(order.budget || 0)
    const totalCents = Math.max(0, Math.round(totalAmount * 100))
    if (totalCents <= 0) return

    const dispatchRequests = await db.query(
      `SELECT avatar_id, user_id, updated_at as done_at
       FROM order_dispatch_requests
       WHERE order_id = ? AND status = 'completed'
         AND avatar_id IS NOT NULL AND avatar_id <> '' AND avatar_id <> 'undefined'
       ORDER BY updated_at ASC`,
      [orderId]
    )

    const uniqueParticipantsMap = new Map<string, { user_id: string; avatar_id: string }>()
    for (const request of dispatchRequests || []) {
      const avatarId = request.avatarId || request.avatar_id
      const userId = request.userId || request.user_id
      if (!avatarId || !userId) continue
      if (uniqueParticipantsMap.has(avatarId)) continue
      uniqueParticipantsMap.set(avatarId, { user_id: userId, avatar_id: avatarId })
      if (uniqueParticipantsMap.size >= requiredCount) break
    }

    const amountPerSlotCents = Math.floor(totalCents / requiredCount)
    const slotRemainderCents = totalCents - amountPerSlotCents * requiredCount

    const baseParticipants = Array.from(uniqueParticipantsMap.values())
    const extraCount = Math.min(Math.max(slotRemainderCents, 0), baseParticipants.length)
    const participants = baseParticipants.map((p, idx) => {
      const cents = amountPerSlotCents + (idx < extraCount ? 1 : 0)
      return { ...p, amount: cents / 100 }
    })

    await this.earningService.createOrderEarnings(orderId, participants)
    
    await this.earningService.settleOrderEarnings(orderId)

    console.log(`[OrderService] 订单 ${orderId} 结算完成，共 ${participants.length}/${requiredCount} 个参与者`)
  }

  async settleDispatchOnAcceptance(orderId: string, avatarId: string, userId: string) {
    const order = await this.getOrderById(orderId)
    if (!order) return
    if (Number((order as any).isPaid ?? (order as any).is_paid ?? 0) !== 1) return

    const requiredCount = (() => {
      const raw =
        (order as any).requiredCount ??
        (order as any).required_count ??
        (order as any).avatarCount ??
        (order as any).avatar_count ??
        (order as any).expectedQuantity ??
        (order as any).expected_quantity ??
        1
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
    })()

    const totalAmount = Number(order.budget || 0)
    const totalCents = Math.max(0, Math.round(totalAmount * 100))
    if (totalCents <= 0) return

    const db = getMySQLClient()
    const dispatchRequests = await db.query(
      `SELECT avatar_id, updated_at
       FROM order_dispatch_requests
       WHERE order_id = ? AND status = 'completed'
         AND avatar_id IS NOT NULL AND avatar_id <> '' AND avatar_id <> 'undefined'
       ORDER BY updated_at ASC`,
      [orderId]
    )

    const uniq: string[] = []
    for (const request of dispatchRequests || []) {
      const id = request.avatarId || request.avatar_id
      if (!id) continue
      if (uniq.includes(id)) continue
      uniq.push(id)
      if (uniq.length >= requiredCount) break
    }

    const idx = uniq.indexOf(avatarId)
    if (idx < 0 || idx >= requiredCount) return

    const base = Math.floor(totalCents / requiredCount)
    const remainder = totalCents - base * requiredCount
    const cents = base + (idx < remainder ? 1 : 0)
    if (cents <= 0) return

    await this.earningService.createOrderEarnings(orderId, [
      { user_id: userId, avatar_id: avatarId, amount: cents / 100 },
    ])
    await this.earningService.settleOrderEarnings(orderId)
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
