import { Controller, Get, Post, Put, Body, Param, Headers, Query } from '@nestjs/common'
import { OrderDispatchService } from './order-dispatch.service'

@Controller('order-dispatch')
export class OrderDispatchController {
  constructor(private readonly dispatchService: OrderDispatchService) {}

  /**
   * 触发订单分配
   */
  @Post(':id/dispatch')
  async dispatchOrder(@Param('id') orderId: string) {
    const result = await this.dispatchService.dispatchOrder(orderId)
    return {
      code: 200,
      data: result,
      message: result ? '订单分配成功' : '暂无符合条件的分身'
    }
  }

  /**
   * 获取订单执行进度
   */
  @Get(':id/progress')
  async getProgress(@Param('id') orderId: string) {
    const progress = await this.dispatchService.getExecutionProgress(orderId)
    return {
      code: 200,
      data: progress,
      message: '获取成功'
    }
  }

  /**
   * 获取订单分配状态
   */
  @Get(':id/status')
  async getDispatchStatus(@Param('id') orderId: string) {
    const status = await this.dispatchService.getDispatchStatus(orderId)
    return {
      code: 200,
      data: status,
      message: '获取成功'
    }
  }

  /**
   * 获取推荐分身列表
   */
  @Get('recommend/:orderId')
  async getRecommendedAvatars(
    @Param('orderId') orderId: string,
    @Query('limit') limit?: string
  ) {
    const avatars = await this.dispatchService.getRecommendedAvatars(
      orderId,
      limit ? parseInt(limit) : 0  // 默认为0，表示不限制，让服务层自动计算推荐数量
    )
    return {
      code: 200,
      data: avatars,
      message: '获取成功'
    }
  }

  /**
   * 确认订单分配
   */
  @Put('request/:requestId/confirm')
  async confirmDispatch(
    @Param('requestId') requestId: string,
    @Headers('x-user-id') userId: string,
    @Body('avatarId') avatarId: string
  ) {
    const result = await this.dispatchService.confirmDispatch(requestId, avatarId)
    return {
      code: 200,
      data: result,
      message: '确认成功'
    }
  }

  /**
   * 拒绝订单分配
   */
  @Put('request/:requestId/reject')
  async rejectDispatch(
    @Param('requestId') requestId: string,
    @Headers('x-user-id') userId: string,
    @Body('avatarId') avatarId: string
  ) {
    const result = await this.dispatchService.rejectDispatch(requestId, avatarId)
    return {
      code: 200,
      data: result,
      message: '已拒绝'
    }
  }

  /**
   * 取消订单分配
   */
  @Put(':id/cancel')
  async cancelDispatch(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string
  ) {
    const result = await this.dispatchService.cancelDispatch(orderId, userId)
    return {
      code: 200,
      data: result,
      message: '已取消分配'
    }
  }

  /**
   * 更新执行步骤状态
   */
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
