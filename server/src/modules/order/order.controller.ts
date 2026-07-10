// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Body, Param, Headers, Query, Inject } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'

@Controller('order')
export class OrderController {
  constructor(
    @Inject('ORDER_SERVICE') private readonly orderService: OrderService,
    @Inject('ORDER_DISPATCH_SERVICE') private readonly dispatchService: OrderDispatchService
  ) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() orderData: Record<string, any>
  ) {
    const result = await this.orderService.createOrder(userId, orderData)
    return {
      code: 200,
      data: result,
      message: result.payment ? '创建成功，请完成支付' : '创建成功'
    }
  }

  @Put(':id')
  async update(
    @Param('id') orderId: string,
    @Body() updateData: Record<string, any>
  ) {
    const order = await this.orderService.updateOrder(orderId, updateData)
    return { code: 200, data: order, message: '更新成功' }
  }

  @Post(':id/task-steps')
  async saveTaskSteps(
    @Param('id') orderId: string,
    @Body() body: Record<string, any>
  ) {
    try {
      const result = await this.orderService.saveOrderTaskSteps(orderId, body?.steps || [])
      return { code: 200, data: result, message: '保存成功' }
    } catch (error: any) {
      return { code: 400, data: null, message: error.message || '保存失败' }
    }
  }

  @Get(':id/task-steps')
  async getTaskSteps(@Param('id') orderId: string) {
    const result = await this.orderService.getOrderTaskSteps(orderId)
    return { code: 200, data: result, message: '获取成功' }
  }

  @Get('list')
  async list(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: string,
    @Query('avatar_id') avatarId?: string
  ) {
    const filters: Record<string, any> = {}
    if (status) {
      filters.status = status
    }
    if (avatarId) {
      filters.avatar_id = avatarId
    }
    const orders = await this.orderService.getOrders(userId, filters)
    return { code: 200, data: orders, message: '获取成功' }
  }

  @Get('open')
  async getOpenOrders(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('platform') platform?: string
  ) {
    const result = await this.orderService.getOpenOrders(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
      platform,
      userId
    )
    return { code: 200, data: result, message: '获取成功' }
  }

  @Get('stats')
  async stats(@Headers('x-user-id') userId: string) {
    const stats = await this.orderService.getOrderStats(userId || '')
    return { code: 200, data: stats, message: '获取成功' }
  }

  @Get('price-config')
  async getPriceConfig() {
    const configs = await this.orderService.getAllPriceConfigs()
    return { code: 200, data: configs, message: '获取成功' }
  }

  @Get(':id')
  async get(@Param('id') orderId: string) {
    const order = await this.orderService.getOrderById(orderId)
    return { code: 200, data: order, message: '获取成功' }
  }

  @Get(':id/feedback')
  async getFeedback(@Param('id') orderId: string) {
    const feedback = await this.orderService.getOrderFeedback(orderId)
    return { code: 200, data: feedback, message: '获取成功' }
  }

  @Get(':id/rating')
  async getRating(@Param('id') orderId: string) {
    const rating = await this.orderService.getOrderRating(orderId)
    return { code: 200, data: rating, message: '获取成功' }
  }

  @Get(':id/dispatch-status')
  async getDispatchStatus(@Param('id') orderId: string) {
    const status = await this.dispatchService.getDispatchStatus(orderId)
    return { code: 200, data: status, message: '获取成功' }
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') orderId: string,
    @Body('status') status: string,
    @Body('avatar_id') avatarId?: string
  ) {
    const order = await this.orderService.updateOrderStatus(orderId, status, avatarId)
    return { code: 200, data: order, message: '更新成功' }
  }

  @Put(':id/accept')
  async acceptOrder(
    @Param('id') orderId: string,
    @Body('avatar_id') avatarId?: string,
    @Headers('x-user-id') userId?: string
  ) {
    const order = await this.orderService.acceptOrder(orderId, avatarId || userId)
    return { code: 200, data: order, message: '接单成功' }
  }

  @Put(':id/result')
  async submitResult(
    @Param('id') orderId: string,
    @Body('result') result: Record<string, any>
  ) {
    const order = await this.orderService.submitOrderResult(orderId, result)
    return { code: 200, data: order, message: '结果提交成功' }
  }

  @Delete(':id')
  async delete(@Param('id') orderId: string, @Headers('x-user-id') userId: string) {
    const result = await this.orderService.deleteOrder(orderId, userId || '')
    return { code: 200, data: result, message: '删除成功' }
  }

  /**
   * 取消订单
   * POST /api/order/:id/cancel
   */
  @Post(':id/cancel')
  async cancel(@Param('id') orderId: string, @Headers('x-user-id') userId: string) {
    const result = await this.orderService.cancelOrder(orderId, userId || '')
    return { code: 200, data: result, message: '取消成功' }
  }

  /**
   * 重新支付（支付取消/失败后再次发起）
   * POST /api/order/:id/repay
   */
  @Post(':id/repay')
  async repay(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: Record<string, any>
  ) {
    const openid = body.openid
    if (!openid) {
      return { code: 400, data: null, message: '缺少openid参数' }
    }
    try {
      const paymentParams = await this.orderService.repayOrder(orderId, userId, openid)
      return { code: 200, data: { payment: paymentParams }, message: '支付订单创建成功' }
    } catch (err: any) {
      console.error('[OrderController] 重新支付失败:', err.message)
      return { code: 500, data: null, message: err.message || '创建支付订单失败' }
    }
  }
}
