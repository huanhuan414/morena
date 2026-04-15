import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'

@Controller('content-generation')
export class ContentGenerationController {
  constructor(private readonly contentGenerationService: ContentGenerationService) {}

  /**
   * 为订单生成内容
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateContent(@Body() body: {
    orderId: string
    requestId: string
    avatarId: string
    orderTitle: string
    orderDescription: string
    platforms: string[]
    contentType: string
    targetAudience: string
    avatarName?: string
    avatarPersonality?: string
  }) {
    try {
      const result = await this.contentGenerationService.generateContent(body)
      return {
        code: 200,
        message: '内容生成成功',
        data: result
      }
    } catch (error) {
      return {
        code: 500,
        message: '内容生成失败',
        error: error.message
      }
    }
  }

  /**
   * 获取分身生成的内容
   */
  @Get('request/:requestId/avatar/:avatarId')
  async getGeneratedContent(
    @Param('requestId') requestId: string,
    @Param('avatarId') avatarId: string
  ) {
    try {
      const content = await this.contentGenerationService.getGeneratedContent(requestId, avatarId)
      return {
        code: 200,
        message: '获取成功',
        data: content
      }
    } catch (error) {
      return {
        code: 500,
        message: '获取失败',
        error: error.message
      }
    }
  }

  /**
   * 更新内容状态
   */
  @Post(':contentId/status')
  @HttpCode(HttpStatus.OK)
  async updateContentStatus(
    @Param('contentId') contentId: string,
    @Body() body: { status: 'draft' | 'approved' | 'published' }
  ) {
    try {
      await this.contentGenerationService.updateContentStatus(contentId, body.status)
      return {
        code: 200,
        message: '状态更新成功'
      }
    } catch (error) {
      return {
        code: 500,
        message: '状态更新失败',
        error: error.message
      }
    }
  }
}
