import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
  Headers,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { OrderService } from '../order/order.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'
import { assertResourceOwner, requireAuthenticatedUserId, rethrowAuthError } from '../../common/auth-user.util'

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

  private getAuthenticatedUserId(headers: Record<string, string | string[] | undefined>) {
    return requireAuthenticatedUserId(headers)
  }

  private async assertOrderOwner(orderId: string, userId: string, message: string = '无权操作该订单内容') {
    const order = await this.orderService.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }
    assertResourceOwner(userId, order.userId || order.user_id, message)
    return order
  }

  private async getContentOwnershipRecord(contentId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT c.id, c.order_id, c.avatar_id,
              o.user_id AS order_owner_user_id,
              a.user_id AS avatar_owner_user_id
       FROM content_generation_requests c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN avatars a ON c.avatar_id = a.id
       WHERE c.id = ?
       LIMIT 1`,
      [contentId]
    )
    return rows?.[0] || null
  }

  private async assertContentAccess(
    contentId: string,
    userId: string,
    options?: { allowOrderOwner?: boolean; allowAvatarOwner?: boolean; message?: string }
  ) {
    const ownership = await this.getContentOwnershipRecord(contentId)
    if (!ownership) {
      throw new Error('内容不存在')
    }

    const allowOrderOwner = options?.allowOrderOwner !== false
    const allowAvatarOwner = options?.allowAvatarOwner === true
    const allowedOwners = [
      allowOrderOwner ? ownership.orderOwnerUserId || ownership.order_owner_user_id : null,
      allowAvatarOwner ? ownership.avatarOwnerUserId || ownership.avatar_owner_user_id : null,
    ].filter(Boolean)

    if (!allowedOwners.includes(userId)) {
      throw new ForbiddenException(options?.message || '无权操作该内容资源')
    }

    return ownership
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
  }, @Headers() headers: Record<string, string | string[] | undefined>) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertOrderOwner(body.orderId, userId)
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
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '内容生成失败', data: null })
    }
  }

  @Post('retry/:requestId')
  @HttpCode(HttpStatus.OK)
  async retryGeneration(
    @Param('requestId') requestId: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const db = getMySQLClient()
      const records = await db.query(
        'SELECT * FROM content_generation_requests WHERE id = ?',
        [requestId]
      )
      if (!records || records.length === 0) {
        throw new NotFoundException({ msg: '记录不存在', data: null })
      }
      const record = records[0]
      const orderId = record.orderId || record.order_id
      const avatarId = record.avatarId || record.avatar_id
      await this.assertOrderOwner(orderId, userId)

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
      rethrowAuthError(error)
      console.error('[ContentGeneration] retry error:', error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '重试失败', data: null })
    }
  }

  /**
   * 匿名边界：该接口保留匿名只读访问，仅返回单条生成内容的展示结果，不返回用户身份、支付或订单隐私字段。
   */
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
        throw new NotFoundException({ msg: '内容不存在', data: null })
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
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '获取失败', data: null })
    }
  }

  /**
   * 获取内容的图片URL列表（轻量接口，不查询content等大字段）
   * 过滤掉 base64 数据，只返回 URL 格式的图片
   * 匿名边界：该接口保留匿名只读访问，仅暴露已生成图片 URL，不返回内容正文、用户身份或订单隐私字段。
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
        throw new NotFoundException({ msg: '内容不存在', data: { images: [] } })
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
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '获取失败', data: { images: [] } })
    }
  }

  @Post('content-images/batch')
  async getContentImagesBatch(
    @Body() body: { ids?: string[] }
  ) {
    const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x || '').trim()).filter(Boolean) : []
    if (ids.length === 0) {
      throw new BadRequestException({ msg: 'ids不能为空', data: { items: [] } })
    }
    if (ids.length > 50) {
      throw new BadRequestException({ msg: 'ids数量过多', data: { items: [] } })
    }

    try {
      const db = getMySQLClient()
      const results = await db.query(
        'SELECT id, images FROM content_generation_requests WHERE id IN (?)',
        [ids]
      ) as any[]
      const rows = Array.isArray(results) ? results : []

      const items = rows.map((row: any) => {
        const contentId = String(row?.id || '')
        let images: string[] = []
        const raw = row?.images
        if (typeof raw === 'string') {
          try { images = JSON.parse(raw) } catch { images = [] }
        } else if (Array.isArray(raw)) {
          images = raw
        }

        const urlImages: string[] = []
        const base64Images: { index: number; data: string }[] = []
        images.forEach((img: string, idx: number) => {
          if (typeof img === 'string' && img.startsWith('http')) {
            urlImages.push(img)
          } else if (typeof img === 'string' && img.startsWith('data:image/')) {
            base64Images.push({ index: idx, data: img })
          }
        })

        if (base64Images.length > 0) {
          this.contentGenerationService.migrateBase64ImagesToTos(contentId, images).catch(() => {})
        }

        return { id: contentId, images: urlImages }
      })

      return { code: 200, message: '获取成功', data: { items } }
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '获取失败', data: { items: [] } })
    }
  }

  /**
   * 匿名边界：该接口保留匿名只读访问，仅返回生成内容展示所需字段，不返回资源归属、支付信息或其它私有元数据。
   */
  @Get('content/:contentId')
  async getContentById(@Param('contentId') contentId: string) {
    try {
      const db = await getMySQLClient()
      const results = await db.query(
        `SELECT id, avatar_id, order_id, content, images, video_url, platform, platforms,
                status, content_type, created_at, updated_at
         FROM content_generation_requests
         WHERE id = ?
         LIMIT 1`,
        [contentId]
      )

      const rows = Array.isArray(results) ? results : []
      if (rows.length === 0) {
        throw new NotFoundException({ msg: '内容不存在', data: null })
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
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '获取失败', data: null })
    }
  }

  @Post('content/:contentId/status')
  async updateContentStatus(
    @Param('contentId') contentId: string,
    @Body() body: { status: string },
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertContentAccess(contentId, userId, {
        allowOrderOwner: true,
        allowAvatarOwner: true,
        message: '无权更新该内容状态'
      })
      const pool = getMySQLClient()
      await pool.query(
        'UPDATE content_generation_requests SET status = ? WHERE id = ?',
        [body.status, contentId]
      )
      return { code: 200, message: '状态更新成功' }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '状态更新失败', data: null })
    }
  }

  /**
   * 匿名边界：该接口保留匿名只读访问，仅返回某个分身的公开生成历史结果，不返回资源归属、鉴权态或其它私有字段。
   */
  @Get('history/avatar/:avatarId')
  async getHistory(
    @Param('avatarId') avatarId: string,
    @Query('orderId') orderId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    try {
      const pool = await getMySQLClient()
      const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Math.floor(Number(page)) : 1
      const safePageSize = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0
        ? Math.min(Math.floor(Number(pageSize)), 50)
        : 20
      const offset = (safePage - 1) * safePageSize

      let sql = `
        SELECT id, avatar_id, order_id, platform, platforms, status, content_type, created_at, updated_at,
               CASE WHEN images IS NOT NULL AND JSON_VALID(images) THEN JSON_LENGTH(images) ELSE 0 END as image_count,
               CASE WHEN content IS NOT NULL THEN SUBSTRING(content, 1, 200) ELSE '' END as content_preview
        FROM content_generation_requests
        WHERE avatar_id = ?
      `
      const params: any[] = [avatarId]
      if (orderId) {
        sql += ' AND order_id = ?'
        params.push(orderId)
      }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
      params.push(safePageSize, offset)
      const [rows]: any = await pool.query(sql, params)
      return {
        code: 200,
        message: '获取成功',
        data: rows,
        page: safePage,
        pageSize: safePageSize
      }
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '获取失败', data: null })
    }
  }

  /**
   * 提交发布凭证（分身发布内容后上传截图/URL作为凭证）
   */
  @Post('content/:contentId/publish-proof')
  async submitPublishProof(
    @Param('contentId') contentId: string,
    @Body() body: { publishUrl?: string; publishScreenshot?: string },
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const ownership = await this.assertContentAccess(contentId, userId, {
        allowOrderOwner: true,
        allowAvatarOwner: true,
        message: '无权提交该内容的发布凭证'
      })
      const db = getMySQLClient()
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
      const orderId = ownership.orderId || ownership.order_id
      if (orderId) {
        await db.query(
          `UPDATE orders SET publish_proof_url = ?, publish_verified = 0 WHERE id = ?`,
          [body.publishScreenshot || body.publishUrl || null, orderId]
        )
      }

      console.log(`[发布凭证] contentId=${contentId}, publishUrl=${body.publishUrl}`)
      return { code: 200, message: '发布凭证提交成功，等待验证' }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '提交失败', data: null })
    }
  }

  /**
   * 验证发布结果（用户确认/驳回发布）
   */
  @Post('content/:contentId/verify')
  async verifyPublish(
    @Param('contentId') contentId: string,
    @Body() body: { verified: boolean; reason?: string },
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const ownership = await this.assertContentAccess(contentId, userId, {
        allowOrderOwner: true,
        allowAvatarOwner: false,
        message: '无权验证该内容发布结果'
      })
      const db = getMySQLClient()
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
      const orderId = ownership.orderId || ownership.order_id
      if (orderId) {
        if (body.verified) {
          await db.query(
            `UPDATE orders SET publish_verified = 1, status = 'completed' WHERE id = ?`,
            [orderId]
          )
        } else {
          // 验证失败，标记需要重新发布
          await db.query(
            `UPDATE orders SET publish_verified = 0, status = 'publish_failed' WHERE id = ?`,
            [orderId]
          )
          // 记录超时日志
          try {
            await db.query(
              `INSERT INTO order_timeout_logs (id, order_id, event_type, old_status, new_status, notes)
               VALUES (UUID(), ?, 'publish_timeout', 'published', 'publish_failed', ?)`,
              [orderId, body.reason || '发布验证失败']
            )
          } catch {}
        }
      }

      console.log(`[发布验证] contentId=${contentId}, verified=${body.verified}`)
      return { code: 200, message: body.verified ? '验证通过' : '验证失败，需重新发布' }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '验证失败', data: null })
    }
  }

  @Post('order/:orderId/retry-publish')
  @HttpCode(HttpStatus.OK)
  async retryPublish(
    @Param('orderId') orderId: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertOrderOwner(orderId, userId, '无权重试该订单发布流程')
      const db = getMySQLClient()
      const columns = await this.getContentGenerationColumns(db)
      const rows = await db.query('SELECT id, status FROM orders WHERE id = ? LIMIT 1', [orderId])
      const order = rows?.[0] || rows?.data?.[0]
      if (!order) {
        throw new NotFoundException({ msg: '订单不存在', data: null })
      }

      const currentStatus = String(order.status || '')
      if (!['publish_failed', 'publish_timeout'].includes(currentStatus)) {
        throw new BadRequestException({ msg: '当前订单状态不可重试', data: { status: currentStatus } })
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
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '重试失败', data: null })
    }
  }

  /**
   * 清除订单的内容生成记录（重新生成时调用）
   */
  @Delete('clear/:orderId')
  async clearGeneration(
    @Param('orderId') orderId: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertOrderOwner(orderId, userId, '无权清除该订单的生成记录')
      const pool = getMySQLClient()
      await pool.query(
        'DELETE FROM content_generation_requests WHERE order_id = ?',
        [orderId]
      )
      return {
        code: 200,
        message: '清除成功'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '清除失败', data: null })
    }
  }
}
