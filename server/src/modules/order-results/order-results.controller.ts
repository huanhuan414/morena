// @ts-nocheck
import { Controller, Post, Get, Body, Param, Headers } from '@nestjs/common'
import { OrderResultsService, CreateResultDto } from './order-results.service'

@Controller('order-results')
export class OrderResultsController {
  constructor(private readonly orderResultsService: OrderResultsService) {}

  /**
   * 提交订单效果数据
   */
  @Post()
  async createResult(@Body() dto: CreateResultDto) {
    const result = await this.orderResultsService.createResult(dto)
    return {
      code: 200,
      data: result,
      message: '提交成功'
    }
  }

  /**
   * 获取订单的效果结果列表
   */
  @Get('order/:orderId')
  async getOrderResults(@Param('orderId') orderId: string) {
    const results = await this.orderResultsService.getOrderResults(orderId)
    return {
      code: 200,
      data: results,
      message: '获取成功'
    }
  }

  /**
   * 获取分身的效果结果列表
   */
  @Get('avatar/:avatarId')
  async getAvatarResults(@Param('avatarId') avatarId: string) {
    const results = await this.orderResultsService.getAvatarResults(avatarId)
    return {
      code: 200,
      data: results,
      message: '获取成功'
    }
  }
}
