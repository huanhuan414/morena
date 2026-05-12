import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Controller('content-generation')
export class ContentGenerationController {
  constructor(private readonly contentGenerationService: ContentGenerationService) {}

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
          videoUrl: record.videoUrl || null,
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
      let sql = 'SELECT * FROM content_generation_requests WHERE avatar_id = ?'
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
