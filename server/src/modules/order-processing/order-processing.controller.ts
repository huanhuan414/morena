// @ts-nocheck
import { Controller, Get, Post, Put, Param, Body, Headers, Query } from '@nestjs/common'
import { OrderProcessingService } from './order-processing.service'
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
      const works = await this.linkValidationService.getWorksByOrderId?.(orderId) || []
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
  async confirmContent(@Param('requestId') requestId: string) {
    try {
      const result = await this.processingService.confirmContent(requestId)
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
   * 提交发布反馈
   */
  @Post('feedback/:requestId')
  async submitFeedback(
    @Param('requestId') requestId: string,
    @Body() body: {
      screenshot_urls?: string[]
      link?: string
      note?: string
    }
  ) {
    try {
      return {
        code: 200,
        data: { success: true },
        message: '提交成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '提交失败'
      }
    }
  }
}
