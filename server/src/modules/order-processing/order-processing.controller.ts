import { Controller, Get, Post, Put, Param, Body, Headers, Query } from '@nestjs/common'
import { OrderProcessingService, ProcessingStatus } from './order-processing.service'
import { LinkValidationService } from './link-validation.service'

@Controller('order-processing')
export class OrderProcessingController {
  constructor(
    private readonly processingService: OrderProcessingService,
    private readonly linkValidationService: LinkValidationService
  ) {}

  /**
   * 获取处理状态
   */
  @Get('status/:requestId')
  async getStatus(
    @Param('requestId') requestId: string
  ) {
    try {
      const status = await this.processingService.getProcessingStatus(requestId)
      return {
        code: 200,
        data: status,
        message: '获取成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取失败'
      }
    }
  }

  /**
   * 验证链接并获取作品信息
   */
  @Post('validate-link')
  async validateLink(@Body('url') url: string) {
    try {
      const result = await this.linkValidationService.validateLink(url)
      return {
        code: 200,
        data: result,
        message: result.success ? '验证成功' : '验证失败'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: {
          success: false,
          platform: 'unknown',
          error: error.message || '验证失败'
        },
        message: error.message || '验证失败'
      }
    }
  }

  /**
   * 确认内容
   */
  @Post('confirm/:requestId')
  async confirm(
    @Param('requestId') requestId: string,
    @Body('content') content: string
  ) {
    try {
      const result = await this.processingService.confirmContent(requestId, content)
      return {
        code: 200,
        data: result,
        message: '确认成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '确认失败'
      }
    }
  }

  /**
   * 发布内容
   */
  @Post('publish/:requestId')
  async publish(
    @Param('requestId') requestId: string,
    @Body('content') content?: string
  ) {
    try {
      const result = await this.processingService.publishContent(requestId, content)
      return {
        code: 200,
        data: result,
        message: '发布成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '发布失败'
      }
    }
  }

  /**
   * 重新生成内容
   */
  @Post('regenerate/:requestId')
  async regenerate(
    @Param('requestId') requestId: string
  ) {
    try {
      const result = await this.processingService.regenerateContent(requestId)
      return {
        code: 200,
        data: result,
        message: '重新生成成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '重新生成失败'
      }
    }
  }

  /**
   * 提交发布反馈
   */
  @Post('feedback/:requestId')
  async submitFeedback(
    @Param('requestId') requestId: string,
    @Body('feedback') feedback: Record<string, { image?: string; link?: string }>
  ) {
    try {
      const result = await this.processingService.submitPublishFeedback(requestId, feedback)
      return {
        code: 200,
        data: result,
        message: '反馈成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '反馈失败'
      }
    }
  }
}
