import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getCache, setCache } from '../../common/shared-cache'
import { OrderService } from '../order/order.service'
import { NotificationService } from '../notification/notification.service'
import { normalizeFulfillmentStatus } from '../order/order-status'

const URGE_ACCEPTANCE_COOLDOWN_MS = 60 * 60 * 1000
const lastUrgeAcceptanceAt = new Map<string, number>()

@Injectable()
export class OrderProcessingService {
  private readonly logger = new Logger(OrderProcessingService.name)
  private columnsCache: Set<string> | null = null
  private disputesTableReady = false

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService
  ) {}

  private async ensureDisputesTable() {
    if (this.disputesTableReady) return
    const db = getMySQLClient()
    await db.query(
      `CREATE TABLE IF NOT EXISTS order_disputes (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        avatar_id VARCHAR(36),
        status VARCHAR(20) DEFAULT 'open',
        reason TEXT,
        evidence TEXT,
        resolution VARCHAR(50),
        resolution_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_id (order_id),
        INDEX idx_status (status),
        INDEX idx_avatar_id (avatar_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单争议表'`
    )
    this.disputesTableReady = true
  }

  private async hasOpenDispute(orderId?: string): Promise<boolean> {
    if (!orderId) return false
    await this.ensureDisputesTable()
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT id FROM order_disputes WHERE order_id = ? AND status = 'open' LIMIT 1`,
      [orderId]
    )
    return Boolean(rows && rows.length > 0)
  }

  async createDispute(identifier: string, payload: { reason?: string; evidence?: any }): Promise<any> {
    const current = await this.findRecordByIdentifier(identifier)
    if (!current) return null

    const normalized = this.normalizeRecord(current)
    const orderId = normalized.orderId
    if (!orderId) return null

    await this.ensureDisputesTable()
    const db = getMySQLClient()

    const existing = await db.query(
      `SELECT id FROM order_disputes WHERE order_id = ? AND status = 'open' LIMIT 1`,
      [orderId]
    )
    if (existing && existing.length > 0) {
      return { success: false, message: '该订单已有未处理的争议' }
    }

    const order = await db.queryOne('orders', { id: orderId }) as any
    const userId = order?.user_id || order?.userId
    const avatarId = order?.assigned_to || order?.assignedTo || normalized.avatarId
    if (!userId) return null

    const disputeId = randomUUID()
    await db.query(
      `INSERT INTO order_disputes (id, order_id, user_id, avatar_id, status, reason, evidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, NOW(), NOW())`,
      [
        disputeId,
        orderId,
        userId,
        avatarId || null,
        String(payload?.reason || '').trim() || null,
        payload?.evidence ? JSON.stringify(payload.evidence) : null
      ]
    )

    try {
      if (avatarId) {
        await db.insert('avatar_notifications', {
          id: randomUUID(),
          avatar_id: avatarId,
          notification_type: 'order_dispute_opened',
          title: '订单进入争议处理',
          content: '发单方发起争议，等待仲裁处理',
          is_read: 0,
          data: JSON.stringify({ order_id: orderId }),
          created_at: new Date(),
        })
      }
    } catch (error: any) {
      this.logger.warn(`写入分身通知失败: orderId=${orderId}, error=${error.message}`)
    }

    return { success: true, id: disputeId, orderId }
  }

  async listDisputes(status: string = 'open', limit: number = 50): Promise<any> {
    await this.ensureDisputesTable()
    const db = getMySQLClient()
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
    const st = String(status || 'open').trim().toLowerCase()
    const result = await db.query(
      `SELECT d.*, o.title as order_title, a.name as avatar_name
       FROM order_disputes d
       LEFT JOIN orders o ON d.order_id = o.id
       LEFT JOIN avatars a ON d.avatar_id = a.id
       WHERE d.status = ?
       ORDER BY d.updated_at DESC
       LIMIT ?`,
      [st, safeLimit]
    )
    return { status: st, list: result || [], total: (result || []).length }
  }

  async resolveDispute(disputeId: string, payload: { resolution: string; note?: string }): Promise<any> {
    await this.ensureDisputesTable()
    const db = getMySQLClient()
    const rows = await db.query(`SELECT * FROM order_disputes WHERE id = ? LIMIT 1`, [disputeId])
    const dispute = rows?.[0]
    if (!dispute) return null

    await db.query(
      `UPDATE order_disputes
       SET status = 'resolved', resolution = ?, resolution_note = ?, updated_at = NOW()
       WHERE id = ?`,
      [String(payload?.resolution || '').trim() || 'resolved', String(payload?.note || '').trim() || null, disputeId]
    )

    try {
      const notificationService = new NotificationService()
      const orderId = dispute.orderId || dispute.order_id
      const userId = dispute.userId || dispute.user_id
      await notificationService.createNotification({
        user_id: userId,
        type: 'order_dispute_resolved',
        title: '争议已处理',
        content: '你的订单争议已完成处理，可继续流程',
        metadata: { orderId, disputeId, resolution: payload?.resolution }
      })
    } catch (e: any) {
      this.logger.warn(`争议处理通知发送失败: disputeId=${disputeId}, error=${e.message}`)
    }

    return { success: true }
  }

  private readonly platformAliasMap: Record<string, string> = {
    wechat: 'wechat_channel',
    wechat_channel: 'wechat_channel',
    wechat_video: 'wechat_channel',
    wechat_mp: 'wechat_mp',
    wechat_official: 'wechat_mp',
    wechat_moments: 'wechat_moments',
    douyin: 'douyin',
    xiaohongshu: 'xiaohongshu',
    xhs: 'xiaohongshu',
    weibo: 'weibo',
    bilibili: 'bilibili',
    bili: 'bilibili',
    kuaishou: 'kuaishou',
    zhihu: 'zhihu',
    toutiao: 'toutiao'
  }

  private canonicalizePlatform(platform?: string): string {
    const key = String(platform || '').trim().toLowerCase()
    return this.platformAliasMap[key] || key
  }

  private normalizePlatformStatusMap(input: any): Record<string, any> {
    const parsed = this.parseJsonObject<Record<string, any>>(input, {})
    return Object.entries(parsed).reduce<Record<string, any>>((acc, [platform, status]) => {
      const canonicalPlatform = this.canonicalizePlatform(platform)
      if (!canonicalPlatform) return acc
      acc[canonicalPlatform] = {
        ...(acc[canonicalPlatform] || {}),
        ...(typeof status === 'object' && status ? status : { status })
      }
      return acc
    }, {})
  }

  private normalizeWorkflowStatus(status?: string): string {
    const value = String(status || '').trim().toLowerCase()
    if (!value) return 'queuing'
    if (['pending', 'processing', 'generating_text', 'generating_images', 'generating_video'].includes(value)) return 'generating'
    if (['completed', 'revision_requested'].includes(value)) return 'preview'
    if (value === 'feedback_submitted') return 'awaiting_acceptance'
    if (['settled', 'done'].includes(value)) return 'completed'
    if (['queuing', 'preview', 'publishing', 'published', 'awaiting_acceptance', 'completed', 'failed', 'generating'].includes(value)) {
      return value
    }
    return value
  }

  private async getTableColumns(): Promise<Set<string>> {
    if (this.columnsCache) {
      return this.columnsCache
    }

    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'content_generation_requests'`
    )

    this.columnsCache = new Set(
      (rows || [])
        .map((row: any) => String(row.columnName || row.COLUMN_NAME || row.column_name || '').toLowerCase())
        .filter(Boolean)
    )
    return this.columnsCache
  }

  private parseJsonArray(input: any): any[] {
    if (!input) return []
    if (Array.isArray(input)) return input
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        // 兼容纯 URL 字符串：如果看起来是 URL，包装成单元素数组
        const trimmed = input.trim()
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return [trimmed]
        }
        return []
      }
    }
    return []
  }

  private parseJsonObject<T = Record<string, any>>(input: any, fallback: T): T {
    if (!input) return fallback
    if (typeof input === 'object') return input as T
    if (typeof input === 'string') {
      try {
        return JSON.parse(input) as T
      } catch {
        return fallback
      }
    }
    return fallback
  }

  private normalizePlatforms(input: any): string[] {
    if (!input) return []
    if (Array.isArray(input)) {
      const normalized = input.map((item) => this.canonicalizePlatform(String(item || ''))).filter(Boolean)
      return Array.from(new Set(normalized))
    }
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input)
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item) => this.canonicalizePlatform(String(item || ''))).filter(Boolean)
          return Array.from(new Set(normalized))
        }
      } catch {
        const normalized = input
          .split(',')
          .map((item) => this.canonicalizePlatform(item))
          .filter(Boolean)
        return Array.from(new Set(normalized))
      }
    }
    return []
  }

  private mergeFeedback(
    existing: Record<string, any>,
    incoming: Record<string, any>
  ): Record<string, any> {
    const base = { ...(existing || {}) }
    Object.entries(incoming || {}).forEach(([platform, payload]) => {
      const canonicalPlatform = this.canonicalizePlatform(platform)
      if (!canonicalPlatform) return
      const prev = base[canonicalPlatform] || {}
      base[canonicalPlatform] = { ...prev, ...(payload || {}) }
    })
    return base
  }

  private async findByRequestId(requestId: string): Promise<any | null> {
    const db = getMySQLClient()
    const rows = await db.query(
      'SELECT * FROM content_generation_requests WHERE id = ? ORDER BY created_at DESC LIMIT 1',
      [requestId]
    )
    return rows?.[0] || null
  }

  private async findByOrderId(orderId: string): Promise<any | null> {
    const db = getMySQLClient()
    const rows = await db.query(
      'SELECT * FROM content_generation_requests WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
      [orderId]
    )
    return rows?.[0] || null
  }

  private async findRecordByIdentifier(identifier: string): Promise<any | null> {
    if (!identifier) return null

    const byRequestId = await this.findByRequestId(identifier)
    if (byRequestId) {
      return byRequestId
    }

    return this.findByOrderId(identifier)
  }

  private normalizeRecord(record: any): any {
    const images = this.parseJsonArray(record.images)
    const videos = this.parseJsonArray(record.videoUrl || record.video_url)
    const rawPublishStatus = this.parseJsonObject<Record<string, any>>(record.publishStatus || record.publish_status, { platforms: [] })
    const publishFeedback = this.mergeFeedback({}, this.parseJsonObject(record.publishFeedback || record.publish_feedback, {}))
    const config = this.parseJsonObject<Record<string, any>>(record.config, {})
    const configPlatforms = this.normalizePlatforms(config.platforms)
    const fallbackPlatforms = record.platform ? [this.canonicalizePlatform(record.platform)] : []
    const normalizedPlatforms = configPlatforms.length > 0 ? configPlatforms : fallbackPlatforms
    const platformStatus = this.normalizePlatformStatusMap(rawPublishStatus.platformStatus)

    return {
      id: record.id,
      requestId: record.id,
      order_id: record.orderId || record.order_id,
      orderId: record.orderId || record.order_id,
      avatar_id: record.avatarId || record.avatar_id,
      avatarId: record.avatarId || record.avatar_id,
      user_id: record.userId || record.user_id,
      userId: record.userId || record.user_id,
      platform: this.canonicalizePlatform(record.platform),
      rawStatus: record.status || 'pending',
      status: normalizeFulfillmentStatus(record.status || 'pending'),
      contentType: config.contentType || config.content_type || record.contentType || record.content_type || 'image',
      generatedContent: {
        title: config.title || '',
        content: record.content || '',
        images,
        videos,
        platform: this.canonicalizePlatform(record.platform),
        platforms: normalizedPlatforms
      },
      publishStatus: {
        ...rawPublishStatus,
        platforms: this.normalizePlatforms(rawPublishStatus.platforms || normalizedPlatforms),
        platformStatus
      },
      publishFeedback,
      created_at: record.createdAt || record.created_at,
      updated_at: record.updatedAt || record.updated_at
    }
  }

  private async updateRecordByIdentifier(identifier: string, patch: Record<string, any>): Promise<any | null> {
    const record = await this.findRecordByIdentifier(identifier)
    if (!record) {
      return null
    }

    const columns = await this.getTableColumns()
    const updates: string[] = []
    const params: any[] = []

    Object.entries(patch).forEach(([key, value]) => {
      if (!columns.has(key.toLowerCase())) return
      updates.push(`${key} = ?`)
      params.push(value)
    })

    if (columns.has('updated_at')) {
      updates.push('updated_at = ?')
      params.push(new Date())
    }

    if (updates.length > 0) {
      const db = getMySQLClient()
      params.push(record.id)
      await db.query(`UPDATE content_generation_requests SET ${updates.join(', ')} WHERE id = ?`, params)
    }

    return this.findByRequestId(record.id)
  }

  async getProcessingByRequestId(requestId: string): Promise<any> {
    const record = await this.findByRequestId(requestId)
    return record ? this.normalizeRecord(record) : null
  }

  async createProcessingOrder(data: {
    order_id: string
    avatar_id: string
    user_id?: string
    config?: Record<string, any>
  }): Promise<any> {
    const db = getMySQLClient()
    const columns = await this.getTableColumns()
    const now = new Date()
    const requestId = randomUUID()

    const insertData: Record<string, any> = {
      id: requestId,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      user_id: data.user_id || '',
      status: 'processing',
      content: '',
      config: JSON.stringify(data.config || {}),
      created_at: now,
      updated_at: now
    }

    const validEntries = Object.entries(insertData).filter(([key]) => columns.has(key.toLowerCase()))
    const fieldNames = validEntries.map(([key]) => key)
    const placeholders = validEntries.map(() => '?')
    const values = validEntries.map(([, value]) => value)

    await db.query(
      `INSERT INTO content_generation_requests (${fieldNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    )

    const created = await this.findByRequestId(requestId)
    const normalized = created ? this.normalizeRecord(created) : { requestId, orderId: data.order_id, avatarId: data.avatar_id }
    setCache(requestId, normalized)
    setCache(data.order_id, normalized)
    return normalized
  }

  /**
   * 查询订单处理状态
   * 优先从数据库查询，数据库无数据则从缓存查询
   */
  private readonly STUCK_STATUSES = ['processing', 'generating_text', 'generating_images', 'generating_video']
  private readonly STUCK_TIMEOUT_MS = 10 * 60 * 1000 // 10分钟

  async getProcessingStatus(identifier: string, userId?: string): Promise<any> {
    this.logger.log(`查询订单处理状态: identifier=${identifier}, userId=${userId || ''}`)

    // 1. 先从数据库查询
    try {
      const record = await this.findRecordByIdentifier(identifier)
      if (record) {
        this.logger.log(`从数据库找到记录: id=${record.id}, status=${record.status}`)

        // 卡住检测：processing/generating_* 状态超过10分钟 → 标记 failed
        if (this.STUCK_STATUSES.includes(record.status)) {
          const updatedAt = new Date(record.updated_at || record.created_at)
          const elapsed = Date.now() - updatedAt.getTime()
          if (elapsed > this.STUCK_TIMEOUT_MS) {
            this.logger.warn(`检测到卡住记录: id=${record.id}, status=${record.status}, 已耗时${Math.round(elapsed / 60000)}分钟，标记为 failed`)
            try {
              const db = getMySQLClient()
              await db.query(
                'UPDATE content_generation_requests SET status = ?, error_message = ?, updated_at = NOW() WHERE id = ?',
                ['failed', `生成超时(卡在${record.status}状态超过10分钟)`, record.id]
              )
              record.status = 'failed'
              record.error_message = `生成超时(卡在${record.status}状态超过10分钟)`
            } catch (updateErr: any) {
              this.logger.warn(`更新卡住记录失败: ${updateErr.message}`)
            }
          }
        }

        const normalized = this.normalizeRecord(record)
        setCache(record.id, normalized)
        setCache(normalized.order_id, normalized)
        return normalized
      }
    } catch (dbError: any) {
      this.logger.warn(`数据库查询失败: ${dbError.message}`)
    }

    // 2. 数据库没有数据，从缓存查询
    const cachedData = getCache(identifier)
    if (cachedData) {
      this.logger.log(`从缓存找到数据: identifier=${identifier}`)
      return cachedData
    }

    // 3. 没有任何数据
    this.logger.log(`未找到订单处理数据: identifier=${identifier}`)
    return null
  }

  async confirmProcessing(identifier: string, content?: string): Promise<any> {
    const record = await this.updateRecordByIdentifier(identifier, {
      ...(content ? { content } : {}),
      status: 'publishing'
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)
    await this.syncOrderStatus(normalized.orderId)
    return normalized
  }

  async publishProcessing(identifier: string, targetPlatforms?: string[]): Promise<any> {
    const current = await this.findRecordByIdentifier(identifier)
    if (!current) return null

    const config = this.parseJsonObject<Record<string, any>>(current.config, {})
    const configPlatforms = this.normalizePlatforms(config.platforms)
    const existingStatus = this.parseJsonObject<Record<string, any>>(
      current.publishStatus || current.publish_status,
      {}
    )
    const requestedPlatforms = this.normalizePlatforms(targetPlatforms)
    const resolvedPlatforms = requestedPlatforms.length > 0
      ? requestedPlatforms
      : configPlatforms.length > 0
        ? configPlatforms
        : (current.platform ? [current.platform] : [])
    const dedupPlatforms = Array.from(new Set(resolvedPlatforms))
    const previousPlatformStatus = this.normalizePlatformStatusMap(existingStatus.platformStatus)
    const nextPlatformStatus = dedupPlatforms.reduce<Record<string, any>>((acc, platform) => {
      acc[platform] = {
        status: 'success',
        message: '发布成功'
      }
      return acc
    }, { ...previousPlatformStatus })
    const nextPublishStatus = {
      ...existingStatus,
      platforms: dedupPlatforms,
      platformStatus: nextPlatformStatus,
      status: 'success',
      message: '发布成功'
    }

    const record = await this.updateRecordByIdentifier(identifier, {
      status: 'published',
      publish_status: JSON.stringify(nextPublishStatus)
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)
    await this.syncOrderStatus(normalized.orderId)
    return normalized
  }

  async submitFeedback(identifier: string, feedback: Record<string, any>): Promise<any> {
    const current = await this.findRecordByIdentifier(identifier)
    if (!current) return null
    const existingFeedback = this.parseJsonObject<Record<string, any>>(
      current.publishFeedback || current.publish_feedback,
      {}
    )
    const mergedFeedback = this.mergeFeedback(existingFeedback, feedback || {})

    const record = await this.updateRecordByIdentifier(identifier, {
      status: 'awaiting_acceptance',
      publish_feedback: JSON.stringify(mergedFeedback)
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)
    await this.syncOrderStatus(normalized.orderId)
    return normalized
  }

  async urgeAcceptance(identifier: string): Promise<any> {
    const current = await this.findRecordByIdentifier(identifier)
    if (!current) return null

    const normalized = this.normalizeRecord(current)
    const requestId = normalized.requestId || identifier
    const now = Date.now()
    const lastAt = lastUrgeAcceptanceAt.get(requestId) || 0
    if (lastAt && now - lastAt < URGE_ACCEPTANCE_COOLDOWN_MS) {
      return {
        success: false,
        cooldownRemainingMs: URGE_ACCEPTANCE_COOLDOWN_MS - (now - lastAt)
      }
    }

    const db = getMySQLClient()
    const orderId = normalized.orderId || normalized.order_id
    if (!orderId) return { success: false }

    let order: any = null
    try {
      order = await db.queryOne('orders', { id: orderId })
    } catch (error: any) {
      this.logger.warn(`催促验收查询订单失败: orderId=${orderId}, error=${error.message}`)
      return { success: false }
    }

    const issuerUserId = order?.user_id || order?.userId
    if (!issuerUserId) return { success: false }

    const title = '验收提醒'
    const content = order?.title
      ? `你的订单「${order.title}」已提交发布反馈，请尽快验收`
      : '你的订单已提交发布反馈，请尽快验收'

    try {
      const notificationService = new NotificationService()
      await notificationService.createNotification({
        user_id: issuerUserId,
        type: 'order_urge_acceptance',
        title,
        content,
        metadata: {
          orderId,
          requestId
        }
      })
      lastUrgeAcceptanceAt.set(requestId, now)
    } catch (error: any) {
      this.logger.warn(`催促验收通知发送失败: requestId=${requestId}, error=${error.message}`)
      return { success: false }
    }

    return { success: true }
  }

  async acceptProcessing(identifier: string): Promise<any> {
    const current = await this.findRecordByIdentifier(identifier)
    if (!current) return null
    const currentNormalized = this.normalizeRecord(current)
    const blocked = await this.hasOpenDispute(currentNormalized.orderId)
    if (blocked) {
      throw new Error('订单存在未处理争议，暂不可验收')
    }

    const record = await this.updateRecordByIdentifier(identifier, {
      status: 'settled'
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)

    const db = getMySQLClient()
    if (normalized.orderId && normalized.avatarId) {
      await db.query(
        `UPDATE order_dispatch_requests SET status = 'completed', updated_at = NOW() WHERE order_id = ? AND avatar_id = ?`,
        [normalized.orderId, normalized.avatarId]
      )
      this.logger.log(`[验收] 已更新派单记录状态: orderId=${normalized.orderId}, avatarId=${normalized.avatarId}`)
    }

    await this.syncOrderStatus(normalized.orderId)
    return normalized
  }

  private async syncOrderStatus(orderId?: string): Promise<void> {
    if (!orderId) return
    try {
      await this.orderService.syncOrderStatusByContent(orderId)
    } catch (error: any) {
      this.logger.warn(`同步订单状态失败: orderId=${orderId}, error=${error.message}`)
    }
  }

  /**
   * 请求修改（进入修改流程）
   */
  async requestRevision(identifier: string, feedback: Record<string, any>): Promise<any> {
    const current = await this.findRecordByIdentifier(identifier)
    if (!current) return null

    const existingFeedback = this.parseJsonObject<Record<string, any>>(
      current.publishFeedback || current.publish_feedback,
      {}
    )
    const mergedFeedback = this.mergeFeedback(existingFeedback, feedback || {})

    const record = await this.updateRecordByIdentifier(identifier, {
      status: 'revision_requested',
      publish_feedback: JSON.stringify(mergedFeedback)
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)
    await this.syncOrderStatus(normalized.orderId)

    return normalized
  }

  /**
   * 获取订单的所有处理记录
   */
  async getOrderProcessings(orderId: string): Promise<any[]> {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT * FROM content_generation_requests WHERE order_id = ? ORDER BY created_at DESC`,
      [orderId]
    ) as any[]

    return rows.map(row => this.normalizeRecord(row))
  }

  /**
   * 删除处理记录
   */
  async deleteProcessing(requestId: string): Promise<boolean> {
    const db = getMySQLClient()
    const record = await this.findByRequestId(requestId)
    if (!record) return false

    await db.query('DELETE FROM content_generation_requests WHERE id = ?', [requestId])
    
    const orderId = record.orderId || record.order_id
    if (orderId) {
      await this.syncOrderStatus(orderId)
    }

    return true
  }
}
