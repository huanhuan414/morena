import { Controller, Get, Post, Put, Body, Param, Headers, Query } from '@nestjs/common'
import { OrderDispatchService } from './order-dispatch.service'

@Controller('order-dispatch')
export class OrderDispatchController {
  constructor(private readonly dispatchService: OrderDispatchService) {}

  @Post(':id/dispatch')
  async dispatchOrder(@Param('id') orderId: string) {
    const result = await this.dispatchService.dispatchOrder(orderId)
    return {
      code: 200,
      data: result,
      message: '订单分配成功'
    }
  }

  @Get(':id/progress')
  async getProgress(@Param('id') orderId: string) {
    const progress = await this.dispatchService.getExecutionProgress(orderId)
    return {
      code: 200,
      data: progress,
      message: '获取成功'
    }
  }

  @Get(':id/recommended-avatars')
  async getRecommendedAvatars(
    @Param('id') orderId: string,
    @Query('limit') limit?: string
  ) {
    const avatars = await this.dispatchService.getRecommendedAvatars(
      orderId,
      limit ? parseInt(limit) : 5
    )
    return {
      code: 200,
      data: avatars,
      message: '获取成功'
    }
  }

  @Put('execution/:executionId/status')
  async updateExecutionStep(
    @Param('executionId') executionId: string,
    @Body('status') status: string,
    @Body('result') result?: any
  ) {
    const execution = await this.dispatchService.updateExecutionStep(executionId, status, result)
    return {
      code: 200,
      data: execution,
      message: '更新成功'
    }
  }
}
