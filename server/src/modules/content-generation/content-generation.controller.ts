import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'

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
      // 确保 targetAudience 有默认值
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
      // 从数据库查询生成的内容
      const db = this.contentGenerationService.getDatabase()
      const results = await db.query(
        'SELECT * FROM content_generation_requests WHERE id = ? AND avatar_id = ? LIMIT 1',
        [requestId, avatarId]
      )
      
      if (results.length === 0) {
        return { code: 404, message: '内容不存在', data: null }
      }
      
      const record = Array.isArray(results) ? results[0] : results
      return {
        code: 200,
        message: '获取成功',
        data: {
          id: record.id,
          content: record.content,
          images: record.images ? JSON.parse(record.images) : [],
          video: record.video_url ? JSON.parse(record.video_url) : null,
          status: record.status,
          createdAt: record.created_at
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
      const db = this.contentGenerationService.getDatabase()
      await db.update(
        'content_generation_requests',
        { status: body.status },
        { id: contentId }
      )
      return { code: 200, message: '状态更新成功' }
    } catch (error: any) {
      return { code: 500, message: '状态更新失败', error: error.message }
    }
  }

  @Get('history/avatar/:avatarId')
  async getHistory(@Param('avatarId') avatarId: string) {
    try {
      const db = this.contentGenerationService.getDatabase()
      const results = await db.query(
        'SELECT * FROM content_generation_requests WHERE avatar_id = ? ORDER BY created_at DESC LIMIT 50',
        [avatarId]
      )
      return {
        code: 200,
        message: '获取成功',
        data: results
      }
    } catch (error: any) {
      return { code: 500, message: '获取失败', error: error.message }
    }
  }
}
