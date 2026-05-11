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
   * 根据 orderId 查询内容生成状态
   * 路径: GET /api/order-processing/status/:orderId
   */
  @Get('status/:id')
  async getStatus(
    @Param('id') id: string
  ) {
    try {
      // 先按 orderId 查询
      let status = await this.processingService.getProcessingStatus(id)

      // 如果没找到，再按 requestId 查询
      if (!status) {
        status = await this.processingService.getProcessingByRequestId(id)
      }

      return {
        code: 200,
        data: status,
        message: status ? '获取成功' : '暂无生成记录'
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
   * 创建处理订单
   */
  @Post('create')
  async createProcessing(
    @Body() body: any,
    @Headers('x-user-id') userId: string
  ) {
    try {
      const result = await this.processingService.createProcessingOrder({
        order_id: body.order_id,
        avatar_id: body.avatar_id,
        user_id: userId,
        config: body.config
      })
      return {
        code: 200,
        data: result,
        message: '创建成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '创建失败'
      }
    }
  }
}
