// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Body, Param, Headers, Query, Inject, BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('order')
export class OrderController {
  constructor(
    @Inject('ORDER_SERVICE') private readonly orderService: OrderService,
    @Inject('ORDER_DISPATCH_SERVICE') private readonly dispatchService: OrderDispatchService
  ) {}

  @Post()
  async create(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() orderData: Record<string, any>
  ) {
    const userId = requireAuthenticatedUserId(headers)
    console.log('[OrderController] 创建订单，用户ID:', userId, '订单数据:', orderData)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() updateData: Record<string, any>
  ) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    const order = await this.orderService.updateOrder(orderId, updateData)
    return { code: 200, data: order, message: '更新成功' }
  }

  @Get('list')
  async list(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('status') status?: string,
    @Query('avatar_id') avatarId?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    console.log('[OrderController] list 被调用, userId:', userId, 'status:', status, 'avatarId:', avatarId)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('platform') platform?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    const result = await this.orderService.getOpenOrders(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
      platform,
      userId
    )
    return { code: 200, data: result, message: '获取成功' }
  }

  @Get('stats')
  async stats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    console.log('[OrderController] stats 被调用, userId:', userId)
    const stats = await this.orderService.getOrderStats(userId || '')
    return { code: 200, data: stats, message: '获取成功' }
  }

  @Get(':id')
  async get(@Param('id') orderId: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    console.log('[OrderController] get 被调用, orderId:', orderId)
    const order = await this.orderService.getOrderById(orderId)
    return { code: 200, data: order, message: '获取成功' }
  }

  @Get(':id/feedback')
  async getFeedback(@Param('id') orderId: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    const feedback = await this.orderService.getOrderFeedback(orderId)
    return { code: 200, data: feedback, message: '获取成功' }
  }

  @Get(':id/rating')
  async getRating(@Param('id') orderId: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    const rating = await this.orderService.getOrderRating(orderId)
    return { code: 200, data: rating, message: '获取成功' }
  }

  @Get(':id/dispatch-status')
  async getDispatchStatus(@Param('id') orderId: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    const status = await this.dispatchService.getDispatchStatus(orderId)
    return { code: 200, data: status, message: '获取成功' }
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') orderId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('status') status: string,
    @Body('avatar_id') avatarId?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    if (String(status || '').trim().toLowerCase() === 'completed') {
      throw new BadRequestException('订单完成状态仅允许系统根据履约链路自动推进')
    }
    const order = await this.orderService.updateOrderStatus(orderId, status, avatarId)
    return { code: 200, data: order, message: '更新成功' }
  }

  @Put(':id/accept')
  async acceptOrder(
    @Param('id') orderId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('avatar_id') avatarId?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    if (!avatarId) {
      throw new BadRequestException('缺少avatar_id参数')
    }
    await this.orderService.assertAvatarOwner(avatarId, userId)
    const order = await this.orderService.acceptOrder(orderId, avatarId)
    return { code: 200, data: order, message: '接单成功' }
  }

  @Put(':id/result')
  async submitResult(
    @Param('id') orderId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('result') result: Record<string, any>
  ) {
    const userId = requireAuthenticatedUserId(headers)
    await this.orderService.assertOrderOwner(orderId, userId)
    const order = await this.orderService.submitOrderResult(orderId, result)
    return { code: 200, data: order, message: '结果提交成功' }
  }

  @Delete(':id')
  async delete(@Param('id') orderId: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    const result = await this.orderService.deleteOrder(orderId, userId || '')
    return { code: 200, data: result, message: '删除成功' }
  }

  /**
   * 取消订单
   * POST /api/order/:id/cancel
   */
  @Post(':id/cancel')
  async cancel(@Param('id') orderId: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, any>
  ) {
    const userId = requireAuthenticatedUserId(headers)
    const openid = body.openid
    if (!openid) {
      throw new BadRequestException({ msg: '缺少openid参数', data: null })
    }
    try {
      const paymentParams = await this.orderService.repayOrder(orderId, userId, openid)
      return { code: 200, data: { payment: paymentParams }, message: '支付订单创建成功' }
    } catch (err: any) {
      if (err instanceof HttpException) throw err
      console.error('[OrderController] 重新支付失败:', err.message)
      throw new InternalServerErrorException({ msg: err.message || '创建支付订单失败', data: null })
    }
  }
}
