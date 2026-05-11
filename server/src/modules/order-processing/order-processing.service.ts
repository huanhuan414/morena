import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getCache, setCache } from '../../common/shared-cache'
import { OrderService } from '../order/order.service'

@Injectable()
export class OrderProcessingService {
  private readonly logger = new Logger(OrderProcessingService.name)
  private columnsCache: Set<string> | null = null

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService
  ) {}
  private readonly platformAliasMap: Record<string, string> = {
    wechat: 'wechat_channel',
    wechat_channel: 'wechat_channel',
    wechat_mp: 'wechat_mp',
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
    const publishStatus = this.parseJsonObject<Record<string, any>>(record.publishStatus || record.publish_status, { platforms: [] })
    const publishFeedback = this.mergeFeedback({}, this.parseJsonObject(record.publishFeedback || record.publish_feedback, {}))
    const config = this.parseJsonObject<Record<string, any>>(record.config, {})

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
      status: record.status || 'completed',
      contentType: config.contentType || config.content_type || 'image',
      generatedContent: {
        title: config.title || '',
        content: record.content || '',
        images,
        videos,
        platform: record.platform,
        platforms: this.normalizePlatforms(config.platforms).length > 0
          ? this.normalizePlatforms(config.platforms)
          : (record.platform ? [record.platform] : [])
      },
      publishStatus: {
        ...publishStatus,
        platforms: this.normalizePlatforms(publishStatus.platforms || [])
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
      status: 'queuing',
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
  async getProcessingStatus(identifier: string, userId?: string): Promise<any> {
    this.logger.log(`查询订单处理状态: identifier=${identifier}, userId=${userId || ''}`)

    // 1. 先从数据库查询
    try {
      const record = await this.findRecordByIdentifier(identifier)
      if (record) {
        this.logger.log(`从数据库找到记录: id=${record.id}, status=${record.status}`)
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
    const previousPlatformStatus = this.parseJsonObject<Record<string, any>>(
      existingStatus.platformStatus,
      {}
    )
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
    return normalized
  }

  async acceptProcessing(identifier: string): Promise<any> {
    const record = await this.updateRecordByIdentifier(identifier, {
      status: 'completed'
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)

    await this.trySyncOrderStatus(normalized.orderId)
    return normalized
  }

  private async trySyncOrderStatus(orderId?: string): Promise<void> {
    if (!orderId) return
    const db = getMySQLClient()
    try {
      const rows = await db.query(
        `SELECT COUNT(*) AS total_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
         FROM content_generation_requests
         WHERE order_id = ?`,
        [orderId]
      )

      const totalCount = Number(rows?.[0]?.totalCount || 0)
      const completedCount = Number(rows?.[0]?.completedCount || 0)
      if (totalCount === 0) return

      if (completedCount === totalCount) {
        await db.query('UPDATE orders SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', [
          'completed',
          new Date(),
          new Date(),
          orderId
        ])
        
        await this.orderService.updateOrderStatus(orderId, 'completed')
      } else {
        await db.query('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', ['in_progress', new Date(), orderId])
      }
    } catch (error: any) {
      this.logger.warn(`同步订单状态失败: orderId=${orderId}, error=${error.message}`)
    }
  }

  /**
   * 请求修改（进入修改流程）
   */
  async requestRevision(identifier: string, feedback: Record<string, any>): Promise<any> {
    const record = await this.updateRecordByIdentifier(identifier, {
      status: 'revision_requested',
      publish_feedback: JSON.stringify(feedback || {})
    })
    if (!record) return null

    const normalized = this.normalizeRecord(record)
    setCache(normalized.requestId, normalized)
    setCache(normalized.orderId, normalized)

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
      await this.trySyncOrderStatus(orderId)
    }

    return true
  }
}
