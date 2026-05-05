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
  async validateLink(
    @Body('url') url: string,
    @Body('orderId') orderId?: string,
    @Body('avatarId') avatarId?: string
  ) {
    try {
      const result = await this.linkValidationService.validateLink(url, orderId, avatarId)
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
   * 获取订单的已发布作品列表
   */
  @Get('works/:orderId')
  async getWorksByOrderId(@Param('orderId') orderId: string) {
    try {
      const works = await this.linkValidationService.getWorksByOrderId(orderId)
      return {
        code: 200,
        data: works,
        message: '获取成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: [],
        message: error.message || '获取失败'
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

  /**
   * 刷新反馈数据（重新抓取链接数据）
   */
  @Post('refresh-feedback/:requestId')
  async refreshFeedback(
    @Param('requestId') requestId: string
  ) {
    try {
      const result = await this.processingService.refreshFeedbackData(requestId)
      return {
        code: 200,
        data: result,
        message: '刷新成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '刷新失败'
      }
    }
  }

  /**
   * 发单者验收分身发布的內容
   */
  @Post('accept/:requestId')
  async acceptContent(
    @Param('requestId') requestId: string
  ) {
    try {
      console.log('[OrderProcessing] 发单者验收:', { requestId })
      const result = await this.processingService.acceptContent(requestId)
      return {
        code: 200,
        data: result,
        message: '验收成功'
      }
    } catch (error: any) {
      console.error('[OrderProcessing] 验收失败:', error)
      return {
        code: 500,
        data: null,
        message: error.message || '验收失败'
      }
    }
  }
}
