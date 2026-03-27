import { Controller, Get, Post, Put, Delete, Body, Param, Headers, Query } from '@nestjs/common'
import { OrderService } from './order.service'

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() orderData: Record<string, any>
  ) {
    const order = await this.orderService.createOrder(userId, orderData)
    return {
      code: 200,
      data: order,
      message: '创建成功'
    }
  }

  @Get()
  async list(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: string
  ) {
    const orders = await this.orderService.getOrders(userId, status)
    return {
      code: 200,
      data: orders,
      message: '获取成功'
    }
  }

  @Get('open')
  async getOpenOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.orderService.getOpenOrders(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  @Get('stats')
  async stats(@Headers('x-user-id') userId: string) {
    const stats = await this.orderService.getOrderStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  @Get(':id')
  async get(@Param('id') orderId: string) {
    const order = await this.orderService.getOrderById(orderId)
    return {
      code: 200,
      data: order,
      message: '获取成功'
    }
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') orderId: string,
    @Body('status') status: string,
    @Body('avatar_id') avatarId?: string
  ) {
    const order = await this.orderService.updateOrderStatus(orderId, status, avatarId)
    return {
      code: 200,
      data: order,
      message: '更新成功'
    }
  }

  @Put(':id/accept')
  async acceptOrder(
    @Param('id') orderId: string,
    @Body('avatar_id') avatarId: string
  ) {
    const order = await this.orderService.acceptOrder(orderId, avatarId)
    return {
      code: 200,
      data: order,
      message: '接单成功'
    }
  }

  @Put(':id/result')
  async submitResult(
    @Param('id') orderId: string,
    @Body('result') result: Record<string, any>
  ) {
    const order = await this.orderService.submitOrderResult(orderId, result)
    return {
      code: 200,
      data: order,
      message: '提交成功'
    }
  }

  @Put(':id/cancel')
  async cancel(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string
  ) {
    const order = await this.orderService.cancelOrder(orderId, userId)
    return {
      code: 200,
      data: order,
      message: '取消成功'
    }
  }
}
