// @ts-nocheck
import { Controller, Get, Post, Put, Body, Param, Headers, Query, Inject } from '@nestjs/common'
import { OrderDispatchService } from './order-dispatch.service'
import { OrderTimeoutService } from './order-timeout.service'

@Controller('order-dispatch')
export class OrderDispatchController {
  constructor(
    @Inject('ORDER_DISPATCH_SERVICE') private readonly dispatchService: OrderDispatchService,
    @Inject(OrderTimeoutService) private readonly timeoutService: OrderTimeoutService,
  ) {}

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
   * 获取单个分发请求详情
   */
  @Get('request/:requestId')
  async getRequest(@Param('requestId') requestId: string) {
    const result = await this.dispatchService.getRequestById(requestId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 手动分配订单给指定分身
   */
  @Post(':orderId/dispatch-avatar')
  async dispatchToAvatar(
    @Param('orderId') orderId: string,
    @Body('avatarId') avatarId: string
  ) {
    const result = await this.dispatchService.dispatchToAvatar(orderId, avatarId)
    return {
      code: 200,
      data: result,
      message: '分配成功，已发送通知'
    }
  }

  /**
   * 获取用户待确认订单列表
   */
  @Get('pending-requests')
  async getPendingRequests(
    @Headers('x-user-id') userId: string
  ) {
    const requests = await this.dispatchService.getUserPendingRequests(userId)
    return {
      code: 200,
      data: requests,
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
   * 获取分身已接受的订单列表
   */
  @Get('avatar/:avatarId/accepted-orders')
  async getAvatarAcceptedOrders(@Param('avatarId') avatarId: string) {
    const orders = await this.dispatchService.getAvatarAcceptedOrders(avatarId)
    return {
      code: 200,
      data: orders,
      message: '获取成功'
    }
  }

  /**
   * 获取分身通知列表
   */
  @Get('avatar/:avatarId/notifications')
  async getAvatarNotifications(@Param('avatarId') avatarId: string) {
    const notifications = await this.dispatchService.getAvatarNotifications(avatarId)
    return {
      code: 200,
      data: notifications,
      message: '获取成功'
    }
  }

  /**
   * 分身接受订单
   */
  @Post('avatar/:avatarId/accept/:orderId')
  async acceptOrder(@Param('avatarId') avatarId: string, @Param('orderId') orderId: string) {
    const result = await this.dispatchService.acceptOrder(avatarId, orderId)
    return {
      code: 200,
      data: result,
      message: '订单已接受'
    }
  }

  /**
   * 分身婉拒订单
   */
  @Post('dispatch/:dispatchId/decline')
  async declineOrder(@Param('dispatchId') dispatchId: string) {
    await this.dispatchService.declineOrder(dispatchId)
    return {
      code: 200,
      data: null,
      message: '已婉拒'
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

  /**
   * 更新订单分发请求状态
   */
  @Put('request/:requestId/status')
  async updateRequestStatus(
    @Param('requestId') requestId: string,
    @Body('status') status: string
  ) {
    await this.dispatchService.updateRequestStatus(requestId, status)
    return {
      code: 200,
      message: '状态更新成功'
    }
  }

  /**
   * 一键分配订单给所有可用分身
   */
  @Post(':orderId/dispatch-all')
  async dispatchToAllAvatars(@Param('orderId') orderId: string) {
    const result = await this.dispatchService.dispatchToAllAvatars(orderId)
    return {
      code: 200,
      data: result,
      message: `已分配给 ${result.count} 个分身`
    }
  }

  /**
   * 发送短信通知给分身
   */
  @Post(':orderId/notify')
  async notifyAvatars(
    @Param('orderId') orderId: string,
    @Body('avatarIds') avatarIds: string[],
    @Body('message') message?: string
  ) {
    const result = await this.dispatchService.notifyAvatars(orderId, avatarIds, message)
    return {
      code: 200,
      data: result,
      message: `已发送 ${result.count} 条通知`
    }
  }

  /**
   * 手动触发超时检查
   */
  @Post('timeout/check')
  async checkTimeouts() {
    const result = await this.timeoutService.handleTimeoutOrders()
    return {
      code: 200,
      data: result,
      message: `处理了 ${result.total} 个超时订单`
    }
  }

  /**
   * 手动重新分配超时订单
   */
  @Post(':orderId/reassign')
  async reassignOrder(@Param('orderId') orderId: string) {
    const result = await this.timeoutService.reassignOrder(orderId)
    return {
      code: 200,
      data: result,
      message: result.message || '重新分配完成'
    }
  }

  /**
   * 获取订单超时日志
   */
  @Get(':orderId/timeout-logs')
  async getTimeoutLogs(@Param('orderId') orderId: string) {
    const mysqlClient = require('../../storage/database/mysql-client').getMySQLClient()
    const rows = await mysqlClient.query(
      'SELECT * FROM order_timeout_logs WHERE order_id = ? ORDER BY created_at DESC',
      [orderId]
    )
    return {
      code: 200,
      data: rows,
      message: '获取超时日志成功'
    }
  }
}
