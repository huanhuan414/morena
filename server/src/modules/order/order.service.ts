// @ts-nocheck
import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common'
import * as crypto from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import { NotificationService } from '../notification/notification.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'
import { WechatPayService } from '../payment/wechat-pay.service'
import { ContentGenerationService } from '../content-generation/content-generation.service'
import { RedisService } from '../redis/redis.service'

/**
 * 字段命名规则说明：
 * - 写入DB（INSERT/UPDATE）：字段名用 snake_case（与DB列名一致）
 * - 读取DB返回值：字段名用 camelCase（MysqlClient 的 convertKeysToCamel 自动转换）
 * - SQL AS 别名：如 `x as avatar_id`，返回值也是 camelCase → `avatarId`
 */

// 价格配置相关接口
export interface ContentTypePrice {
  id: string
  contentType: string
  label: string
  icon: string
  basePrice: number
  contentPrice: number
  desc: string
  output: string
}

export interface PriceCalculation {
  base: number
  content: number
  total: number
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name)

  constructor(
    @Inject(EarningService) private readonly earningService: EarningService,
    @Inject(NotificationService) private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => OrderDispatchService)) private readonly dispatchService: OrderDispatchService,
    @Inject(forwardRef(() => WechatPayService)) private readonly wechatPayService: WechatPayService,
    @Inject(forwardRef(() => ContentGenerationService)) private readonly contentGenService: ContentGenerationService,
    @Inject(RedisService) private readonly redisService: RedisService,
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

  // ========== 价格配置相关方法 ==========

  async getAllPriceConfigs(): Promise<ContentTypePrice[]> {
    try {
      const db = getMySQLClient()
      this.logger.log('[价格配置] 开始查询数据库...')
      
      const result = await db.query(
        `SELECT id, content_type, name, icon, base_price, content_price, description, output_unit, sort_order
         FROM content_type_prices
         WHERE is_active = TRUE
         ORDER BY sort_order ASC`
      )
      
      // 处理 db.query 返回的两种格式：数组或 {data: [...]}
      const rows = Array.isArray(result) ? result : (result?.data || [])
      this.logger.log(`[价格配置] 查询到 ${rows.length} 条记录`)

      const configs: ContentTypePrice[] = []
      for (const row of rows as any[]) {
        const contentType = row.contentType || row.content_type
        const basePrice = row.basePrice || row.base_price
        const contentPrice = row.contentPrice || row.content_price
        const outputUnit = row.outputUnit || row.output_unit
        
        configs.push({
          id: row.id,
          contentType: contentType,
          label: row.name,
          icon: row.icon || '',
          basePrice: Number(basePrice) || 0,
          contentPrice: Number(contentPrice) || 0,
          desc: row.description || row.desc || '',
          output: outputUnit || '',
        })
      }
      
      return configs
    } catch (error: any) {
      this.logger.error(`[价格配置] 加载失败: ${error.message}`)
      throw error
    }
  }

  async getPriceConfig(contentType: string): Promise<ContentTypePrice | undefined> {
    const configs = await this.getAllPriceConfigs()
    return configs.find(c => c.contentType === contentType)
  }

  async calculatePrice(
    contentType: string,
    avatarCount: number,
    quantityPerAvatar: number
  ): Promise<PriceCalculation> {
    // 映射数据库存储的 contentType 到价格配置的 contentType
    const mappedContentType = contentType === 'simple' ? 'simple' : contentType
    
    const config = await this.getPriceConfig(mappedContentType)
    if (!config) {
      this.logger.warn(`[价格计算] 未知内容类型: ${contentType}, 数据库中未找到配置`)
      throw new Error(`未知的内容类型: ${contentType}`)
    }

    const base = config.basePrice * avatarCount
    const content = config.contentPrice * quantityPerAvatar * avatarCount
    const total = base + content

    this.logger.log(
      `[价格计算] contentType=${contentType}, avatarCount=${avatarCount}, quantityPerAvatar=${quantityPerAvatar}, base=${base}, content=${content}, total=${total}`
    )

    return { base, content, total }
  }

  async validatePrice(
    contentType: string,
    avatarCount: number,
    quantityPerAvatar: number,
    expectedBase: number,
    expectedContent: number
  ): Promise<{ valid: boolean; actual: PriceCalculation }> {
    const actual = await this.calculatePrice(contentType, avatarCount, quantityPerAvatar)

    const valid =
      Math.abs(actual.base - expectedBase) < 0.01 &&
      Math.abs(actual.content - expectedContent) < 0.01

    if (!valid) {
      this.logger.warn(
        `[价格校验] 不匹配: contentType=${contentType}, expected={base:${expectedBase}, content:${expectedContent}}, actual={base:${actual.base}, content:${actual.content}}`
      )
    }

    return { valid, actual }
  }

  // ========== 订单相关方法 ==========

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
    if (['submitted'].includes(value)) return 'submitted'
    if (['completed'].includes(value)) return 'preview'
    if (['revision_requested'].includes(value)) return 'revision_requested'
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
        'SELECT id, status FROM order_dispatch_requests WHERE order_id = ? AND status not in ("expired")',
        [orderId]
      )
      const contents = await db.query(
        'SELECT id, status FROM content_generation_requests WHERE order_id = ? and status not in ("cancelled")',
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

      const hasProcessing = allContentStatuses.some(s => ['generating', 'publishing'].includes(s))
      const hasRevisionRequested = allContentStatuses.some(s => s === 'revision_requested')
      const allContentCompleted = totalContents > 0 && allContentStatuses.every(s => s === 'completed')
      const allContentAwaitingAcceptance = totalContents > 0 && allContentStatuses.every(s => ['awaiting_acceptance', 'completed'].includes(s))
      const allContentSubmitted = totalContents > 0 && allContentStatuses.every(s => ['completed', 'published', 'awaiting_acceptance'].includes(s))
      

      const currentOrder = await this.getOrderById(orderId)
      if (!currentOrder) return
      const currentStatus = currentOrder.status
      // const expectedQuantity = Number(currentOrder.expectedQuantity)
      const avatarCount = Number(currentOrder.avatarCount)
      const requiredAvatarCount =
        Number.isFinite(avatarCount) && avatarCount > 0
          ? avatarCount
          : 1

      let newStatus: string | null = null
      
      if (completedDispatchCount >= requiredAvatarCount) {
        newStatus = 'completed'
      } else if (hasRevisionRequested) {
        // 驳回后分身需重新生成内容，orders 表 ENUM 无 revision_requested，映射为 in_progress
        newStatus = 'in_progress'
      } else if (allContentAwaitingAcceptance) {
        newStatus = 'awaiting_acceptance'
      } else if (allContentSubmitted) {
        newStatus = 'awaiting_acceptance'
        if (allContentStatuses.some(s => ['published', 'completed'].includes(s)) && !allContentStatuses.some(s => s === 'awaiting_acceptance')) {
          if (!hasPending && completedDispatchCount >= requiredAvatarCount) {
            newStatus = 'submitted'
          } else if (hasPending) {
            newStatus = 'pending_acceptance'
          } else {
            newStatus = 'in_progress'
          }
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
        await db.query(`UPDATE orders SET ${setClause} WHERE id = ? and status not in ("draft", "cancelled", "completed")`, params)
      }
    } catch (error: any) {
      console.error(`[OrderService] 同步订单状态失败: orderId=${orderId}, error=${error.message}`)
    }
  }

  private statusTransitions: Record<string, string[]> = {
    'draft': ['pending_payment', 'cancelled'],
    'pending_payment': ['open', 'cancelled'],
    'open': ['pending_review', 'cancelled'],
    'pending_review': ['pending_acceptance', 'cancelled'],
    'pending_dispatch': ['pending_acceptance', 'cancelled'],
    'pending_acceptance': ['in_progress', 'rejected', 'cancelled'],
    'in_progress': ['submitted', 'cancelled'],
    'submitted': ['awaiting_acceptance', 'in_progress'],
    'awaiting_acceptance': ['completed', 'in_progress'],
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
    
    const contentType = orderData.contentType || orderData.content_type || 'text'
    const quantityPerAvatar = Number(orderData.quantityPerAvatar || orderData.quantity_per_avatar || 1)
    
    // 直接使用前端传来的价格，不做任何计算
    const budget = Number(orderData.total_price || orderData.budget || 0)
    const baseAmount = Number(orderData.base_price || orderData.basePrice || 0)
    const contentAmount = Number(orderData.content_price || orderData.contentPrice || 0)
    const customBasePriceRaw = orderData.customBasePrice ?? orderData.custom_base_price ?? orderData.price
    const customBasePrice = customBasePriceRaw !== undefined && customBasePriceRaw !== null && customBasePriceRaw !== ''
      ? Number(customBasePriceRaw)
      : null
    const priceRaw = orderData.price ?? orderData.customBasePrice ?? orderData.custom_base_price
    const price = priceRaw !== undefined && priceRaw !== null && priceRaw !== ''
      ? Number(priceRaw)
      : 0

    const insertData: Record<string, any> = {
      id,
      user_id: userId,
      title: orderData.title,
      description: orderData.description || '',
      content_type: orderData.contentType || orderData.content_type || 'text',
      accept_regions: JSON.stringify(orderData.acceptRegions || orderData.accept_regions || []),
      accept_timeout: orderData.acceptTimeout || orderData.accept_timeout || null, // 接单超时时间（分钟），空表示不限时
      acceptance_timeout: orderData.acceptanceTimeout || orderData.acceptance_timeout || 24, // 验收超时时间（小时），默认1天
      platforms: JSON.stringify(orderData.platforms || []),
      platform: orderData.platform || '',
      requirements: JSON.stringify(orderData.requirements || {}),
      // 添加 personality 字段，保存风格偏好和领域偏好
      personality: typeof orderData.personality === 'string' 
        ? orderData.personality 
        : JSON.stringify(orderData.personality || { tags: [], niches: [] }),
      budget,
      base_amount: baseAmount,
      content_amount: contentAmount,
      price,
      custom_base_price: customBasePrice,
      status: orderData.status || 'pending_payment',
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
      asset_distribute_mode: orderData.requirements?.asset_distribute_mode || orderData.assetDistributeMode || orderData.asset_distribute_mode || 'shared',
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
      } catch (err) {
        console.error('[OrderService] 创建支付订单失败:', err.message)
      }
    }

    return { id, ...insertData, avatarCount, payment: paymentParams }
  }

  async getOrderById(orderId: string) {
    const db = getMySQLClient()
    
    const orderRows = await db.query(
      `SELECT id, user_id, avatar_id, title, description, content_type, accept_regions,
       platforms, platform, requirements, budget, base_amount, content_amount, price, status, result, created_at, updated_at,
       completed_at, latitude, longitude, location_text, target_audience,
       expected_quantity, deadline, order_type, priority, assigned_to,custom_base_price,
       avatar_count, quantity_per_avatar, is_paid, acceptance_timeout, accept_timeout, personality
       FROM orders WHERE id = ? AND is_deleted = 0`,
      [orderId]
    )
    
    if (!orderRows || orderRows.length === 0) {
      return null
    }
    // 读取DB返回值 → camelCase
    const order = orderRows[0]
    
    // SQL别名 avatar_id → 返回值为 avatarId
    const avatarRows = await db.query(
      `SELECT odr.id, COALESCE(odr.avatar_id, odr.target_avatar_id) as avatar_id, odr.status, odr.platform, odr.reject_reason, odr.created_at, odr.accepted_at,
              odr.acceptance_timeout_at, a.name as nickname, a.avatar_url, u.phone
       FROM order_dispatch_requests odr
       LEFT JOIN avatars a ON COALESCE(odr.avatar_id, odr.target_avatar_id) = a.id
       LEFT JOIN users u ON a.user_id = u.id
       WHERE odr.order_id = ? AND odr.status NOT IN ('expired', 'cancelled')
       ORDER BY odr.created_at DESC`,
      [orderId]
    )

    let processingRows: any[] = []
    try {
      const sql = `SELECT id, order_id, avatar_id, status, content_type, content, images, video_url, publish_feedback, created_at, updated_at FROM content_generation_requests WHERE order_id = ? ORDER BY updated_at DESC, created_at DESC`
      processingRows = await db.query(sql, [orderId])
    } catch (err) {
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
        phone: row.phone || null,
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
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : (row.updatedAt ? new Date(row.updatedAt).toISOString() : null),
        acceptanceTimeoutAt: row.acceptanceTimeoutAt ? new Date(row.acceptanceTimeoutAt).toISOString() : null
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

    const budget = Number(order.budget) || 0
    const baseAmount = Number(order.baseAmount || order.base_amount) || budget
    const contentAmount = Number(order.contentAmount || order.content_amount) || 0
    const customBasePrice = Number(order.customBasePrice || order.custom_base_price || 0)
    // const expectedQuantity = Number(order.expectedQuantity)
    const avatarCount = Number(order.avatarCount)
    const requiredCount =
      Number.isFinite(avatarCount) && avatarCount > 0
        ? avatarCount
        : 1
    const expectedEarnings =
      baseAmount > 0 && requiredCount > 0
        ? customBasePrice
        : Math.round((baseAmount / requiredCount) * 100) / 100
    
    // 静默时间配置（毫秒，让前端计算合适的显示单位）
    const silenceDurationMs = parseInt(process.env.ORDER_SILENCE_DURATION_MS || '0', 10)
  
    return {
      ...order,
      id: order.id,
      title: order.title,
      description: order.description,
      contentType: order.contentType,
      platform: order.platform || '',
      acceptRegions: typeof order.acceptRegions === 'string' 
        ? JSON.parse(order.acceptRegions) 
        : (order.acceptRegions || []),
      acceptTimeout: Number(order.acceptTimeout || order.accept_timeout) || 0,
      acceptanceTimeout: Number(order.acceptanceTimeout || order.acceptance_timeout) || 24,
      platforms: typeof order.platforms === 'string' 
        ? JSON.parse(order.platforms) 
        : (order.platforms || []),
      requirements: typeof order.requirements === 'string' 
        ? JSON.parse(order.requirements) 
        : (order.requirements || {}),
      personality: typeof order.personality === 'string'
        ? JSON.parse(order.personality)
        : (order.personality || {}),
      budget,
      price: Number(order.price || 0),
      customBasePrice: Number(order.customBasePrice || order.custom_base_price || 0),
      expectedEarnings,
      status: order.status,
      avatarCount: requiredCount,
      avatarStats,
      summary_stats: summaryStats,
      silenceDurationMs,  // 静默时间（毫秒）
      createdAt
    }
  }

  async getOrders(userId: string, filters: Record<string, any> = {}) {
    const db = getMySQLClient()

    let whereClause = 'WHERE user_id = ? AND is_deleted = 0'
    const params: any[] = [userId]

    if (filters.status) {
      whereClause += ' AND status = ?'
      params.push(filters.status)
    }

    const rows = await db.query(
      `SELECT id, title, description, content_type, accept_regions, platforms, requirements,
              budget, base_amount, content_amount, status, expected_quantity, avatar_count, is_paid, created_at
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
                a.name as avatar_name, a.avatar_url, u.phone
         FROM order_dispatch_requests d
         LEFT JOIN avatars a ON d.target_avatar_id = a.id
         LEFT JOIN users u ON a.user_id = u.id
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
          phone: row.phone || null,
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
      
      let acceptRegions = row.acceptRegions
      if (typeof acceptRegions === 'string') {
        try { acceptRegions = JSON.parse(acceptRegions) } catch { acceptRegions = [] }
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
      const needAvatarCount = Number.isFinite(Number(row.avatarCount)) ? Number(row.avatarCount) : Number.isFinite(Number(row.expectedQuantity)) ? Number(row.expectedQuantity) : 0
      const budget = Number(row.budget) || 0
      const baseAmount = Number(row.baseAmount || row.base_amount) || budget
      const contentAmount = Number(row.contentAmount || row.content_amount) || 0
      const expectedEarnings = needAvatarCount > 0 ? Math.round(baseAmount / needAvatarCount * 100) / 100 : baseAmount

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        contentType: row.contentType,
        acceptRegions,
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
       FROM orders WHERE user_id = ? AND is_deleted = 0`,
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
      platform: 'platform',
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
      targetAudience: 'target_audience',
      accept_regions: 'accept_regions',
      acceptRegions: 'accept_regions',
      accept_timeout: 'accept_timeout',
      acceptTimeout: 'accept_timeout',
      acceptance_timeout: 'acceptance_timeout',
      acceptanceTimeout: 'acceptance_timeout',
      personality: 'personality',
      preferred_styles: 'preferred_styles',
      preferredStyles: 'preferred_styles',
      industry_tags: 'industry_tags',
      industryTags: 'industry_tags',
      // 价格字段
      base_price: 'base_amount',
      basePrice: 'base_amount',
      content_price: 'content_amount',
      contentPrice: 'content_amount',
      total_price: 'budget',
      price: 'price',
      custom_base_price: 'custom_base_price',
      customBasePrice: 'custom_base_price',
      // 素材分配模式
      asset_distribute_mode: 'asset_distribute_mode',
      assetDistributeMode: 'asset_distribute_mode',
    }

    const normalized: Record<string, any> = {}
    for (const [key, value] of Object.entries(updateData || {})) {
      const dbField = fieldMap[key]
      if (!dbField) continue
      if (dbField === 'platforms' || dbField === 'accept_regions') {
        normalized[dbField] = JSON.stringify(Array.isArray(value) ? value : this.safeParseJson<any[]>(value, []))
      } else if (dbField === 'requirements' || dbField === 'result' || dbField === 'personality') {
        normalized[dbField] = typeof value === 'string' ? value : JSON.stringify(value ?? {})
      } else if (dbField === 'preferred_styles' || dbField === 'industry_tags') {
        normalized[dbField] = JSON.stringify(Array.isArray(value) ? value : this.safeParseJson<any[]>(value, []))
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

  async getOpenOrders(page: number = 1, pageSize: number = 20, platform?: string, userId?: string, availableOnly: boolean = false) {
    const db = getMySQLClient()
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20

    const offset = (safePage - 1) * safePageSize

    const platformParams: any[] = []
    let platformClause = ''
    if (platform && platform !== 'all') {
      platformClause = ` AND (o.platforms LIKE ? OR o.platform = ?)`
      platformParams.push(`%"${platform}"%`, platform)
    }

    const whereClause = `
      WHERE (
        o.is_paid = 1
        AND o.is_deleted = 0
        AND o.status IN ('pending', 'in_progress','awaiting_acceptance', 'submitted','pending_acceptance')
        AND NOT EXISTS (
          SELECT 1 FROM order_assets oa
          WHERE oa.order_id COLLATE utf8mb4_general_ci = o.id AND oa.status NOT IN ('ready')
        )
      )${availableOnly ? `
        AND COALESCE(odm.is_accepted_by_me, 0) != 1
        AND COALESCE(odc.accept_count, 0) < o.avatar_count
        AND COALESCE(odm.odr_status, '') <> 'rejected'
        AND (
          o.accept_regions IS NULL
          OR o.accept_regions = ''
          OR o.accept_regions = '[]'
          OR EXISTS (
            SELECT 1
            FROM avatars region_avatar
            WHERE region_avatar.user_id = ?
              AND region_avatar.status = 'active'
              AND COALESCE(region_avatar.location_text, '') <> ''
              AND o.accept_regions LIKE CONCAT(
                '%',
                TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(
                  region_avatar.location_text, CONVERT(0xE79C81 USING utf8mb4), 1
                ), CONVERT(0xE5B882 USING utf8mb4), 1
                ), CONVERT(0xE58CBA USING utf8mb4), 1
                ), CONVERT(0xE58EBF USING utf8mb4), 1)),
                '%'
              )
          )
        )` : ''}${platformClause}
    `

    const rows = await db.query(
      `SELECT o.id, o.user_id, o.avatar_id, o.title, o.description, o.content_type, o.platforms, o.platform,
              o.requirements, o.target_audience, o.priority, o.deadline, o.content_deadline_at,
              o.budget, o.base_amount, o.acceptance_timeout, o.custom_base_price, o.content_amount, o.price, o.status, o.expected_quantity, o.avatar_count, o.quantity_per_avatar, o.is_paid,
              o.accept_regions, o.personality,
              o.created_at, o.updated_at,
              COALESCE(a_order.name, a_latest.name, u.nickname) as publisher_nickname,
              COALESCE(a_order.avatar_url, a_latest.avatar_url, u.avatar) as publisher_avatar,
              COALESCE(odc.accept_count, 0) as accept_count,
              GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1) as required_count,
              COALESCE(odm.is_accepted_by_me, 0) as is_accepted_by_me, odm.odr_status, odm.odr_id, odm.odr_avatar_id, odm.request_id
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN avatars a_order ON a_order.id = o.avatar_id
       LEFT JOIN (
         SELECT a1.user_id, a1.name, a1.avatar_url
         FROM avatars a1
         INNER JOIN (
           SELECT user_id, MAX(created_at) as max_created_at
           FROM avatars
           WHERE status = 'active'
           GROUP BY user_id
         ) latest ON latest.user_id = a1.user_id 
                  AND latest.max_created_at = a1.created_at
         WHERE a1.status = 'active'
       ) a_latest ON a_latest.user_id = o.user_id
       LEFT JOIN (
         SELECT order_id, 
                COUNT(DISTINCT CASE WHEN status IN ('pending','accepted', 'in_progress', 'completed') THEN avatar_id END) as accept_count,
                COUNT(DISTINCT CASE WHEN status = 'pending' THEN avatar_id END) as pending_count
         FROM order_dispatch_requests
         GROUP BY order_id
       ) odc ON odc.order_id = o.id
       LEFT JOIN (
         SELECT
           r.order_id,
           1 as is_accepted_by_me,
           r.status as odr_status,
           r.id as odr_id,
           r.avatar_id as odr_avatar_id,
           cg.id as request_id
         FROM order_dispatch_requests r
         LEFT JOIN content_generation_requests cg ON cg.order_id = r.order_id AND cg.avatar_id = r.avatar_id  AND cg.status NOT IN ('cancelled','failed')
         WHERE r.status in ('accepted','completed','rejected')  AND r.user_id = ?
         GROUP BY r.order_id
       ) odm ON odm.order_id = o.id
       ${whereClause}
       ORDER BY o.priority DESC, o.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId || null, ...(availableOnly ? [userId || ''] : []), ...platformParams, safePageSize, offset]
    )

    const totalRows = await db.query(
      `SELECT COUNT(*) as total
       FROM orders o
       ${availableOnly ? `
         LEFT JOIN (
           SELECT order_id,
                  COUNT(DISTINCT CASE WHEN status IN ('pending', 'accepted', 'in_progress', 'completed') THEN avatar_id END) as accept_count
           FROM order_dispatch_requests
           GROUP BY order_id
         ) odc ON odc.order_id = o.id
         LEFT JOIN (
           SELECT r.order_id, 1 as is_accepted_by_me, r.status AS odr_status
           FROM order_dispatch_requests r
           INNER JOIN avatars a ON a.id = r.avatar_id
           WHERE r.status IN ('accepted', 'completed', 'rejected') AND a.user_id = ?
           GROUP BY r.order_id
         ) odm ON odm.order_id = o.id
       ` : ''}
       ${whereClause}`,
      [...(availableOnly ? [userId || '', userId || ''] : []), ...platformParams]
    )
    const total = Number(totalRows?.[0]?.total || 0)
    
    // 读取DB返回值 → camelCase
    const items = (rows || []).map((row: any) => {
      const platforms = this.safeParseJson<any[]>(row.platforms, [])
      const primaryPlatform = platforms?.[0] || row.platform || 'general'
      return ({
      id: row.id,
      userId: row.userId || row.user_id,
      avatarId: row.avatarId || row.avatar_id,
      title: row.title,
      description: row.description || '',
      contentType: row.contentType || row.content_type,
      platform: row.platform || 'general',
      platforms,
      primaryPlatform,
      requirements: this.safeParseJson<Record<string, any>>(row.requirements, {}),
      targetAudience: row.targetAudience || row.target_audience || '',
      priority: Number(row.priority ?? 0),
      deadline: row.deadline || null,
      contentDeadlineAt: row.contentDeadlineAt || row.content_deadline_at || null,
      budget: Number(row.budget || 0),
      baseAmount: Number(row.baseAmount || row.base_amount || row.budget || 0),
      customBasePrice: Number(row.customBasePrice || row.custom_base_price || 0),
      acceptanceTimeout: Number(row.acceptance_timeout || row.acceptanceTimeout || 0),
      contentAmount: Number(row.contentAmount || row.content_amount || 0),
      price: Number(row.price || row.price || 0),
      status: row.status,
      avatarCount: (() => {
        const raw = row.avatarCount ?? row.avatar_count ?? row.expectedQuantity ?? row.expected_quantity ?? 1
        const n = Number(raw)
        return Number.isFinite(n) && n > 0 ? n : 1
      })(),
      quantityPerAvatar: row.quantityPerAvatar || row.quantity_per_avatar || 1,
      isPaid: row.isPaid ?? row.is_paid ?? 0,
      acceptCount: Number(row.acceptCount || row.accept_count || 0),
      pendingCount: Number(row.pendingCount || row.pending_count || 0),
      remainingSlots: Math.max(0, 
        ((() => {
          const raw = row.avatarCount ?? row.avatar_count ?? row.expectedQuantity ?? row.expected_quantity ?? 1
          const n = Number(raw)
          return Number.isFinite(n) && n > 0 ? n : 1
        })()) - Number(row.acceptCount || row.accept_count || 0) - Number(row.pendingCount || row.pending_count || 0)
      ),
      expectedEarnings: (() => {
        const baseAmount = Number(row.baseAmount || row.base_amount || row.budget || 0)
        const avatarCount = (() => {
          const raw = row.avatarCount ?? row.avatar_count ?? row.expectedQuantity ?? row.expected_quantity ??  1
          const n = Number(raw)
          return Number.isFinite(n) ? n : 1
        })()
        return avatarCount > 0 ? Math.round(baseAmount / avatarCount * 100) / 100 : baseAmount
      })(),
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      updatedAt: row.updatedAt || row.updated_at || null,
      publisherNickname: row.publisherNickname || row.publisher_nickname || '发布方',
      publisherAvatar: row.publisherAvatar || row.publisher_avatar || '',
      acceptCount: Number(row.acceptCount || row.accept_count || 0),
      isAcceptedByMe: Boolean(row.isAcceptedByMe ?? row.is_accepted_by_me ?? 0),
      odrStatus: row.odrStatus || row.odr_status,
      odrId: row.odrId || row.odr_id,
      acceptedAvatarId: row.odrAvatarId || row.odr_avatar_id,
      requestId: row.requestId || row.request_id,
      acceptRegions: this.safeParseJson<string[]>(row.acceptRegions || row.accept_regions, []),
      personality: this.safeParseJson<{ tags: string; niches: string }>(row.personality || '{}', { tags: '', niches: '' })
      })
    })

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

    return this.getOrderById(orderId)
  }

  async acceptOrder(orderId: string, avatarId?: string) {
    const db = getMySQLClient()
    const orderRows = await db.query(
      `SELECT id, status, is_paid FROM orders WHERE id = ? AND is_deleted = 0 LIMIT 1`,
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
    // 先写入结果，再通过 recalculateOrderStatus 重新计算状态
    const payload = {
      result: JSON.stringify(result || {}),
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
    // const cancellableStatuses = ['draft', 'pending_payment', 'pending', 'awaiting_acceptance', 'pending_acceptance']
    const cancellableStatuses = ['draft','pending_payment']
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`订单状态为"${order.status}"，无法取消`)
    }
    // 如果已支付，需要退款逻辑（暂记TODO，目前先标记取消）
    if (order.isPaid === 1) {
      // TODO: 调用微信退款API
    }
    const db = getMySQLClient()
    await db.updateWhere('orders', { id: orderId }, {
      status: order.isPaid === 1 ? 'cancelled' : 'auto_cancelled',
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }) 
    // // 取消关联的派单请求
    // await db.updateWhere('dispatch_requests', { order_id: orderId, status: 'pending' }, {
    //   status: 'expired',
    //   updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    // })
    // return { success: true, orderId, newStatus: order.isPaid === 1 ? 'cancelled' : 'auto_cancelled' }
  }

  /**
   * 删除订单（仅已取消/已完成的订单可删除，逻辑删除）
   */
  async deleteOrder(orderId: string, userId: string) {
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }
    if (order.userId !== userId) {
      throw new Error('无权操作此订单')
    }
    const deletableStatuses = ['cancelled', 'auto_cancelled', 'completed', 'expired', 'pending_payment']
    if (!deletableStatuses.includes(order.status)) {
      throw new Error('只有已完成、已取消或待支付的订单才能删除')
    }
    const db = getMySQLClient()
    // 逻辑删除：更新 is_deleted 和 deleted_at 字段
    await db.query(
      `UPDATE orders SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [orderId]
    )
    // 清理Redis接单计数器
    try {
      const redisClient = this.redisService?.getClient()
      if (redisClient) {
        await redisClient.del(`order:accept:count:${orderId}`)
        await redisClient.del(`order:accept:required:${orderId}`)
      }
    } catch (e) {
      console.warn('删除订单Redis计数器失败:', e?.message || e)
    }
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
    // 支付成功后 → pending_review（待审核）
    await db.query(
      'UPDATE orders SET is_paid = 1, status = ?, updated_at = ? WHERE id = ?',
      ['pending_review', new Date(), orderId]
    )

    // 读取DB返回值 → camelCase (order.userId)
    // 只通知支付成功，不暗示已分配分身（分身匹配由前端确认页触发）
    await this.notificationService.createNotification({
      user_id: order.userId,
      type: 'order_paid',
      title: '订单支付成功',
      content: `订单"${order.title}"支付成功，等待审核`,
      metadata: { orderId, transactionId }
    })

    try {
      const paidCountRows = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND is_paid = 1 AND is_deleted = 0`,
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

    // 支付成功后立即触发AI素材预生成（异步，不阻塞返回）
    // this.contentGenService.pregenerateOrderAssets(orderId).catch(err => {
    //   console.warn(`[handlePaymentSuccess] 素材预生成启动失败(非阻塞): ${err.message}`)
    // })

    return this.getOrderById(orderId)
  }

  private getTaskStepType(step: Record<string, any>): string {
    return String(step?.type || step?.stepType || step?.step_type || '')
  }

  private readonly MATERIAL_TYPES = ['material_text', 'material_image', 'material_video']

  private toJson(value: any): string | null {
    if (value === undefined || value === null) return null
    return JSON.stringify(value)
  }

  private toMediaList(step: Record<string, any>, stepType: string): any[] | null {
    const data = step?.data || {}
    const mediaList: any[] = []
    const imageUrl = data.image
    const videoUrl = data.video
    const exampleImageUrl = data.exampleImage || data.example_image

    switch (stepType) {
      case 'upload_qrcode':
        if (imageUrl) mediaList.push({ type: 'qrcode', url: imageUrl })
        break
      case 'image_instruction':
        if (imageUrl) mediaList.push({ type: 'image', url: imageUrl })
        break
      case 'video_instruction':
        if (videoUrl) mediaList.push({ type: 'video', url: videoUrl })
        break
      case 'collect_image':
        if (exampleImageUrl) mediaList.push({ type: 'sample_image', url: exampleImageUrl })
        break
      default:
        if (imageUrl) mediaList.push({ type: 'image', url: imageUrl })
        if (videoUrl) mediaList.push({ type: 'video', url: videoUrl })
    }

    return mediaList.length > 0 ? mediaList : null
  }

  private toMainContent(step: Record<string, any>): string | null {
    const data = step?.data || {}
    return data.url || data.copyData || data.copy_data || data.exampleText || data.example_text || data.exampleUrl || data.example_url || null
  }

  private buildMaterialRecords(orderId: string, materialSteps: Record<string, any>[]): any {
    const record: any = {
      order_id: orderId,
      text_mode: '',
      text_content: null,
      text_prompt: null,
      text_ext: null,
      image_mode: '',
      image_list: null,
      image_prompt: null,
      image_ext: null,
      video_mode: '',
      video_list: null,
      video_ext: null,
      status: 1,
    }

    for (const step of materialSteps) {
      const stepType = this.getTaskStepType(step)
      if (!this.MATERIAL_TYPES.includes(stepType)) continue

      const stepData = step.data || {}
      const materials = Array.isArray(stepData.materials) ? stepData.materials : []
      const useAiMaterial = stepData.useAiMaterial === true || stepData.use_ai_material === true
      const aiPrompt = stepData.aiPrompt || stepData.prompt || ''
      const distributeMode = stepData.distributeMode || stepData.distribute_mode || 'shared'
      const stepDescription = step.description || step.step_desc || ''
      const materialExt = {
        distribute_mode: distributeMode,
      }

      switch (stepType) {
        case 'material_text':
          if (useAiMaterial || materials.length === 0) {
            record.text_mode = 'ai_prompt_only'
          } else {
            record.text_mode = 'user_upload'
          }
          record.text_content = materials.length > 0 ? this.toJson(materials) : null
          record.text_prompt = aiPrompt || null
          record.text_ext = this.toJson(materialExt)
          break

        case 'material_image':
          if (useAiMaterial || materials.length === 0) {
            record.image_mode = 'ai_generate'
          } else {
            record.image_mode = 'user_upload'
          }
          record.image_list = materials.length > 0 ? this.toJson(materials) : null
          record.image_prompt = aiPrompt || null
          record.image_ext = this.toJson(materialExt)
          break

        case 'material_video':
          if (useAiMaterial || materials.length === 0) {
            record.video_mode = 'ai_generate'
          } else {
            record.video_mode = 'user_upload'
          }
          record.video_list = materials.length > 0 ? this.toJson(materials) : null
          record.video_ext = this.toJson(materialExt)
          break
      }
    }

    return record
  }

  async saveOrderTaskSteps(orderId: string, steps: Record<string, any>[]) {
    // console.log('saveOrderTaskSteps', orderId, steps)
    if (!orderId) {
      throw new Error('缺少订单ID')
    }
    if (!Array.isArray(steps)) {
      throw new Error('步骤数据格式错误')
    }

    const db = getMySQLClient()
    const orderRows = await db.query('SELECT id, avatar_count FROM orders WHERE id = ? LIMIT 1', [orderId])
    if (!orderRows || orderRows.length === 0) {
      throw new Error('订单不存在')
    }

    const stepsWithSortOrder = steps.map((step, index) => ({ ...(step || {}), __sortOrder: index }))
    const materialSteps = stepsWithSortOrder.filter(step => this.MATERIAL_TYPES.includes(this.getTaskStepType(step)))
    const order = orderRows[0] || {}
    const rawAvatarCount = Number(order.avatar_count || order.avatarCount )
    const avatarCount = Number.isFinite(rawAvatarCount) && rawAvatarCount > 0 ? rawAvatarCount : 0
    if (avatarCount <= 0) {
      throw new Error('获取接单数量为空，请联系管理员查看！')
    }

    const invalidExclusiveStep = materialSteps.find((step) => {
      const stepData = step.data || {}
      const distributeMode = stepData.distributeMode || stepData.distribute_mode || 'shared'
      if (distributeMode !== 'exclusive') return false
      if (stepData.useAiMaterial === true || stepData.use_ai_material === true) return false
      const materials = Array.isArray(stepData.materials) ? stepData.materials : []
      return materials.length < avatarCount
    })
    if (invalidExclusiveStep) {
      const stepIndex = Number(invalidExclusiveStep.__sortOrder ?? stepsWithSortOrder.findIndex(step => step === invalidExclusiveStep))
      throw new Error(`步骤${stepIndex + 1}：独占至少需要${avatarCount}个素材，不能比接单数少！`)
    }

    // 校验通过后再清空旧步骤，避免保存失败时把原有配置删掉
    // await db.query('UPDATE order_task_steps SET status = 0 WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM order_task_steps WHERE order_id = ?', [orderId])

    for (let index = 0; index < stepsWithSortOrder.length; index++) {
      const step = stepsWithSortOrder[index] || {}
      const stepType = this.getTaskStepType(step)
      const isMaterialStep = this.MATERIAL_TYPES.includes(stepType)
      const mediaList = isMaterialStep ? null : this.toMediaList(step, stepType)
      const extConfig = step.extConfig || step.ext_config
      const sortOrder = Number(step.__sortOrder ?? index)

      await db.query(
        `INSERT INTO order_task_steps
         (order_id, step_type, step_title, step_desc, main_content, media_list, ext_config, sort_order, is_required,created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())`,
        [
          orderId,
          stepType,
          step.label || '',
          step.description || null,
          isMaterialStep ? null : this.toMainContent(step),
          this.toJson(mediaList),
          this.toJson(extConfig),
          sortOrder,
          1
        ]
      )
    }

    const materialRecord = this.buildMaterialRecords(orderId, materialSteps)
    
    await db.query('DELETE FROM order_task_materials WHERE order_id = ?', [orderId])

    const fields = Object.keys(materialRecord)
    const values = Object.values(materialRecord)
    await db.query(
      `INSERT INTO order_task_materials (${fields.join(', ')},created_at) VALUES (${fields.map(() => '?').join(', ')},NOW())`,
      values
    )

    return {
      orderId,
      stepCount: stepsWithSortOrder.length,
      materialCount: materialSteps.length,
    }
  }

  async getOrderTaskSteps(orderId: string) {
    const db = getMySQLClient()
    const queryResult = await db.query(
      `SELECT id, order_id, step_type, step_title, step_desc, main_content,
              media_list, ext_config, sort_order, is_required, status, created_at, updated_at
       FROM order_task_steps
       WHERE order_id = ? AND status = 1
       ORDER BY sort_order ASC, id ASC`,
      [orderId]
    )
    const steps = queryResult || []

    const materialQueryResult = await db.query(
      `SELECT id, order_id, text_mode, text_content, text_prompt, text_ext,
              image_mode, image_list, image_prompt, image_ext,
              video_mode, video_list, video_ext,
              status, created_at, updated_at
       FROM order_task_materials
       WHERE order_id = ? AND status = 1`,
      [orderId]
    )

    const materialRows = materialQueryResult || []
    const materialRecord = materialRows.length > 0 ? materialRows[0] : null

    return {
      steps,
      material: materialRecord || null,
    }
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

    const baseAmount = Number(order.baseAmount || order.base_amount || order.budget || 0)
    const totalCents = Math.max(0, Math.round(baseAmount * 100))
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
