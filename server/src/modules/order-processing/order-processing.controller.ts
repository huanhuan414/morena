import { Controller, Get, Post, Put, Param, Body, Headers, Query } from '@nestjs/common'
import { OrderProcessingService, ProcessingStatus } from './order-processing.service'

@Controller('order-processing')
export class OrderProcessingController {
  constructor(
    private readonly processingService: OrderProcessingService
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
    @Param('requestId') requestId: string
  ) {
    try {
      const result = await this.processingService.publishContent(requestId)
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
}
