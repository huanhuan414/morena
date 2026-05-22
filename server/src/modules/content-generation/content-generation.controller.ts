import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus, Inject, forwardRef } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { OrderService } from '../order/order.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'

@Controller('content-generation')
export class ContentGenerationController {
  private contentGenerationColumns: Set<string> | null = null

  constructor(
    @Inject(ContentGenerationService) private readonly contentGenerationService: ContentGenerationService,
    @Inject(forwardRef(() => OrderService)) private readonly orderService: OrderService,
    @Inject(forwardRef(() => OrderDispatchService)) private readonly orderDispatchService: OrderDispatchService,
  ) {}

  private async getContentGenerationColumns(db: any) {
    if (this.contentGenerationColumns) return this.contentGenerationColumns
    try {
      const [rows]: any = await db.query(
        `SELECT COLUMN_NAME as column_name
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'content_generation_requests'`
      )
      this.contentGenerationColumns = new Set(
        (rows || []).map((r: any) => String(r.column_name || r.columnName || '').toLowerCase()).filter(Boolean)
      )
    } catch {
      this.contentGenerationColumns = new Set()
    }
    return this.contentGenerationColumns
  }

  private pickPayload(columns: Set<string>, payload: Record<string, any>) {
    const picked: Record<string, any> = {}
    for (const [key, value] of Object.entries(payload || {})) {
      if (columns.has(key.toLowerCase())) {
        picked[key] = value
      }
    }
    return picked
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateContent(@Body() body: {
    orderId: string
    requestId?: string
    avatarId: string
    orderTitle: string
    orderDescription: string
    platforms: string[]
    contentType: string
    targetAudience?: string
    contentQuantity?: number
  }) {
    try {
      const payload = {
        ...body,
        targetAudience: body.targetAudience || '通用用户'
      }
      const result = await this.contentGenerationService.generateContent(payload)
      return {
        code: 200,
        message: '内容生成成功',
        data: result
      }
    } catch (error: any) {
      return {
        code: 500,
        message: '内容生成失败',
        error: error.message
      }
    }
  }

  @Post('retry/:requestId')
  @HttpCode(HttpStatus.OK)
  async retryGeneration(@Param('requestId') requestId: string) {
    try {
      const db = await getMySQLClient()
      const records: any = await db.query(
        'SELECT * FROM content_generation_requests WHERE id = ?',
        [requestId]
      )
      if (!records || records.length === 0) {
        return { code: 404, message: '记录不存在' }
      }
      const record = records[0]
      const orderId = record.orderId || record.order_id
      const avatarId = record.avatarId || record.avatar_id

      await db.query(
        'UPDATE content_generation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['processing', requestId]
      )

      this.orderDispatchService.startContentGeneration(
        orderId,
        avatarId,
        {
          order_title: record.orderTitle || record.order_title,
          description: record.orderDescription || record.order_description,
          target_audience: record.targetAudience || record.target_audience,
          quantity_per_avatar: record.contentQuantity || record.content_quantity,
        },
        requestId
      ).catch((err: any) => {
        console.error('[ContentGeneration] retry generation error:', err.message)
      })

      return { code: 200, message: '已开始重新生成', data: { requestId, status: 'processing' } }
    } catch (error: any) {
      console.error('[ContentGeneration] retry error:', error)
      return { code: 500, message: '重试失败', error: error.message }
    }
  }

  @Get('request/:requestId/avatar/:avatarId')
  async getGeneratedContent(
    @Param('requestId') requestId: string,
    @Param('avatarId') avatarId: string
  ) {
    try {
      const pool = await getMySQLClient()
      const [rows]: any = await pool.query(
        'SELECT * FROM content_generation_requests WHERE id = ? AND avatar_id = ? LIMIT 1',
        [requestId, avatarId]
      )

      if (!rows || rows.length === 0) {
        return { code: 404, message: '内容不存在', data: null }
      }

      const record = rows[0]
      let images = []
      let video = null
      try { images = record.images ? JSON.parse(record.images) : [] } catch { images = [] }
      try { video = record.video_url ? JSON.parse(record.video_url) : null } catch { video = record.video_url || null }

      return {
        code: 200,
        message: '获取成功',
        data: {
          id: record.id,
          content: record.content,
          images,
          video,
          status: record.status,
          createdAt: record.created_at
        }
      }
    } catch (error: any) {
      return { code: 500, message: '获取失败', error: error.message }
    }
  }

  /**
   * 获取内容的图片URL列表（轻量接口，不查询content等大字段）
   * 过滤掉 base64 数据，只返回 URL 格式的图片
   */
  @Get('content-images/:contentId')
  async getContentImages(@Param('contentId') contentId: string) {
    try {
      const db = getMySQLClient()
      const results = await db.query(
        'SELECT images FROM content_generation_requests WHERE id = ? LIMIT 1',
        [contentId]
      ) as any[]
      const rows = Array.isArray(results) ? results : []
      if (!rows || rows.length === 0) {
        return { code: 404, message: '内容不存在', data: { images: [] } }
      }
      let images: string[] = []
      const raw = rows[0]?.images
      if (typeof raw === 'string') {
        try { images = JSON.parse(raw) } catch { images = [] }
      } else if (Array.isArray(raw)) {
        images = raw
      }

      // 分离 URL 和 base64 图片
      const urlImages: string[] = []
      const base64Images: { index: number; data: string }[] = []
      images.forEach((img: string, idx: number) => {
        if (typeof img === 'string' && img.startsWith('http')) {
          urlImages.push(img)
        } else if (typeof img === 'string' && img.startsWith('data:image/')) {
          base64Images.push({ index: idx, data: img })
        }
      })

      // 如果有 base64 图片，异步上传到 TOS 并更新数据库（不阻塞当前请求）
      if (base64Images.length > 0) {
        this.contentGenerationService.migrateBase64ImagesToTos(contentId, images).catch(() => {})
      }

      // 当前请求只返回已有的 URL 图片
      return { code: 200, message: '获取成功', data: { images: urlImages } }
    } catch (error: any) {
      return { code: 500, message: '获取失败', data: { images: [] } }
    }
  }

  @Get('content/:contentId')
  async getContentById(@Param('contentId') contentId: string) {
    try {
      const db = await getMySQLClient()
      const results = await db.query(
        'SELECT * FROM content_generation_requests WHERE id = ? LIMIT 1',
        [contentId]
      )

      const rows = Array.isArray(results) ? results : []
      if (rows.length === 0) {
        return { code: 404, message: '内容不存在', data: null }
      }

      const record = rows[0]
      // db.query() 已自动转为 camelCase
      let images: string[] = []
      try { images = record.images ? (Array.isArray(record.images) ? record.images : JSON.parse(record.images)) : [] } catch { images = [] }

      // 解析 videoUrl：兼容 JSON 数组字符串、纯 URL 字符串、null
      let videos: string[] = []
      try {
        const rawVideoUrl = record.videoUrl
        if (rawVideoUrl) {
          if (Array.isArray(rawVideoUrl)) {
            videos = rawVideoUrl
          } else if (typeof rawVideoUrl === 'string') {
            const trimmed = rawVideoUrl.trim()
            if (trimmed.startsWith('[')) {
              const parsed = JSON.parse(trimmed)
              videos = Array.isArray(parsed) ? parsed : []
            } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              videos = [trimmed]
            }
          }
        }
      } catch { videos = [] }

      // 解析 platforms：兼容数组、JSON字符串、单个字符串
      let parsedPlatforms: string[] = []
      try {
        const p = record.platforms
        if (Array.isArray(p) && p.length > 0) {
          parsedPlatforms = p
        } else if (typeof p === 'string' && p.trim()) {
          const parsed = JSON.parse(p)
          parsedPlatforms = Array.isArray(parsed) ? parsed : [String(parsed)]
        }
      } catch {
        if (record.platforms) parsedPlatforms = [String(record.platforms)]
      }
      // fallback: 如果 platforms 解析为空，使用 platform 字段
      if (parsedPlatforms.length === 0 && record.platform) {
        parsedPlatforms = [record.platform]
      }

      return {
        code: 200,
        message: '获取成功',
        data: {
          id: record.id,
          avatarId: record.avatarId,
          orderId: record.orderId,
          content: record.content || '',
          images,
          videos,
          videoUrl: videos.length > 0 ? videos[0] : null,
          platform: record.platform,
          platforms: parsedPlatforms,
          status: record.status,
          contentType: record.contentType || 'image_text',
          createdAt: record.createdAt,
        }
      }
    } catch (error: any) {
      return { code: 500, message: '获取失败', error: error.message }
    }
  }

  @Post('content/:contentId/status')
  async updateContentStatus(
    @Param('contentId') contentId: string,
    @Body() body: { status: string }
  ) {
    try {
      const pool = await getMySQLClient()
      await pool.query(
        'UPDATE content_generation_requests SET status = ? WHERE id = ?',
        [body.status, contentId]
      )
      return { code: 200, message: '状态更新成功' }
    } catch (error: any) {
      return { code: 500, message: '状态更新失败', error: error.message }
    }
  }

  @Get('history/avatar/:avatarId')
  async getHistory(@Param('avatarId') avatarId: string, @Query('orderId') orderId?: string) {
    try {
      const pool = await getMySQLClient()
      let sql = 'SELECT id, order_id, avatar_id, status, content_type, platform, platforms, video_url, publish_feedback, created_at, updated_at, SUBSTRING(content, 1, 500) as content_preview, CASE WHEN images IS NOT NULL AND images != \'\' AND images != \'[]\' THEN JSON_LENGTH(images) ELSE 0 END as image_count FROM content_generation_requests WHERE avatar_id = ?'
      const params: string[] = [avatarId]
      if (orderId) {
        sql += ' AND order_id = ?'
        params.push(orderId)
      }
      sql += ' ORDER BY created_at DESC LIMIT 50'
      const [rows]: any = await pool.query(sql, params)
      return {
        code: 200,
        message: '获取成功',
        data: rows
      }
    } catch (error: any) {
      return { code: 500, message: '获取失败', error: error.message }
    }
  }

  /**
   * 提交发布凭证（分身发布内容后上传截图/URL作为凭证）
   */
  @Post('content/:contentId/publish-proof')
  async submitPublishProof(
    @Param('contentId') contentId: string,
    @Body() body: { publishUrl?: string; publishScreenshot?: string }
  ) {
    try {
      const db = await getMySQLClient()
      const columns = await this.getContentGenerationColumns(db)
      
      // 更新内容的发布凭证和验证状态
      const payload: any = {
        publish_url: body.publishUrl || null,
        publish_screenshot: body.publishScreenshot || null,
        verification_status: 'pending',
        verified_at: null,
        updated_at: new Date(),
      }
      const picked = this.pickPayload(columns, payload)
      const setClause = Object.keys(picked).map((k) => `${k} = ?`).join(', ')
      if (setClause) {
        await db.query(
          `UPDATE content_generation_requests SET ${setClause} WHERE id = ?`,
          [...Object.values(picked), contentId]
        )
      }

      // 同时更新关联订单的发布凭证
      const [contents]: any = await db.query(
        'SELECT order_id FROM content_generation_requests WHERE id = ?',
        [contentId]
      )
      if (contents && contents.length > 0 && contents[0].orderId) {
        await db.query(
          `UPDATE orders SET publish_proof_url = ?, publish_verified = 0 WHERE id = ?`,
          [body.publishScreenshot || body.publishUrl || null, contents[0].orderId]
        )
      }

      console.log(`[发布凭证] contentId=${contentId}, publishUrl=${body.publishUrl}`)
      return { code: 200, message: '发布凭证提交成功，等待验证' }
    } catch (error: any) {
      return { code: 500, message: '提交失败', error: error.message }
    }
  }

  /**
   * 验证发布结果（用户确认/驳回发布）
   */
  @Post('content/:contentId/verify')
  async verifyPublish(
    @Param('contentId') contentId: string,
    @Body() body: { verified: boolean; reason?: string }
  ) {
    try {
      const db = await getMySQLClient()
      const columns = await this.getContentGenerationColumns(db)
      const verificationStatus = body.verified ? 'verified' : 'failed'

      const payload: any = {
        verification_status: verificationStatus,
        verified_at: new Date(),
        updated_at: new Date(),
      }
      const picked = this.pickPayload(columns, payload)
      const setClause = Object.keys(picked).map((k) => `${k} = ?`).join(', ')
      if (setClause) {
        await db.query(
          `UPDATE content_generation_requests SET ${setClause} WHERE id = ?`,
          [...Object.values(picked), contentId]
        )
      }

      // 如果验证通过，更新关联订单
      const [contents]: any = await db.query(
        'SELECT order_id FROM content_generation_requests WHERE id = ?',
        [contentId]
      )
      if (contents && contents.length > 0 && contents[0].orderId) {
        if (body.verified) {
          await db.query(
            `UPDATE orders SET publish_verified = 1, status = 'completed' WHERE id = ?`,
            [contents[0].orderId]
          )
        } else {
          // 验证失败，标记需要重新发布
          await db.query(
            `UPDATE orders SET publish_verified = 0, status = 'publish_failed' WHERE id = ?`,
            [contents[0].orderId]
          )
          // 记录超时日志
          try {
            await db.query(
              `INSERT INTO order_timeout_logs (id, order_id, event_type, old_status, new_status, notes)
               VALUES (UUID(), ?, 'publish_timeout', 'published', 'publish_failed', ?)`,
              [contents[0].orderId, body.reason || '发布验证失败']
            )
          } catch {}
        }
      }

      console.log(`[发布验证] contentId=${contentId}, verified=${body.verified}`)
      return { code: 200, message: body.verified ? '验证通过' : '验证失败，需重新发布' }
    } catch (error: any) {
      return { code: 500, message: '验证失败', error: error.message }
    }
  }

  @Post('order/:orderId/retry-publish')
  @HttpCode(HttpStatus.OK)
  async retryPublish(@Param('orderId') orderId: string) {
    try {
      const db = await getMySQLClient()
      const columns = await this.getContentGenerationColumns(db)
      const rows = await db.query('SELECT id, status FROM orders WHERE id = ? LIMIT 1', [orderId])
      const order = rows?.[0] || rows?.data?.[0]
      if (!order) {
        return { code: 404, message: '订单不存在', data: null }
      }

      const currentStatus = String(order.status || '')
      if (!['publish_failed', 'publish_timeout'].includes(currentStatus)) {
        return { code: 400, message: '当前订单状态不可重试', data: { status: currentStatus } }
      }

      const orderUpdateResult = await db.query(
        `UPDATE orders SET publish_verified = 0, status = 'submitted', updated_at = NOW() WHERE id = ?`,
        [orderId]
      )
      let contentUpdateResult: any = null
      if (columns.has('verification_status') && columns.has('verified_at')) {
        contentUpdateResult = await db.query(
          `UPDATE content_generation_requests
           SET verification_status = 'pending', verified_at = NULL
           WHERE order_id = ? AND verification_status = 'failed'`,
          [orderId]
        )
      } else {
        const payload: any = { updated_at: new Date() }
        const picked = this.pickPayload(columns, payload)
        const setClause = Object.keys(picked).map((k) => `${k} = ?`).join(', ')
        if (setClause) {
          contentUpdateResult = await db.query(
            `UPDATE content_generation_requests SET ${setClause} WHERE order_id = ?`,
            [...Object.values(picked), orderId]
          )
        }
      }

      await this.orderService.syncOrderStatusByContent(orderId)

      return {
        code: 200,
        message: '已触发重试',
        data: {
          orderId,
          status: 'submitted',
          updatedOrders: orderUpdateResult?.affectedRows ?? null,
          resetContents: contentUpdateResult?.affectedRows ?? null,
        }
      }
    } catch (error: any) {
      return { code: 500, message: '重试失败', error: error.message }
    }
  }

  /**
   * 清除订单的内容生成记录（重新生成时调用）
   */
  @Delete('clear/:orderId')
  async clearGeneration(@Param('orderId') orderId: string) {
    try {
      const pool = await getMySQLClient()
      await pool.query(
        'DELETE FROM content_generation_requests WHERE order_id = ?',
        [orderId]
      )
      return {
        code: 200,
        message: '清除成功'
      }
    } catch (error: any) {
      return { code: 500, message: '清除失败', error: error.message }
    }
  }
}
