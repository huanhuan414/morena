import { Controller, Get, Post, Put, Delete, Body, Param, Headers, Query } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderDispatchService } from '../order-dispatch/order-dispatch.service'

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly dispatchService: OrderDispatchService
  ) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() orderData: Record<string, any>
  ) {
    const order = await this.orderService.createOrder(userId, orderData)
    
    // 自动调度分身
    try {
      const dispatchResult = await this.dispatchService.dispatchOrder(order.id)
      
      if (dispatchResult) {
        console.log('[订单调度] 自动分配成功:', dispatchResult)
        // 返回带有分身信息的订单
        const updatedOrder = await this.orderService.getOrderById(order.id)
        return {
          code: 200,
          data: updatedOrder,
          message: '创建成功，已自动分配AI分身'
        }
      } else {
        console.log('[订单调度] 暂无可用分身，订单保持待接单状态')
        return {
          code: 200,
          data: order,
          message: '创建成功，等待分身接单'
        }
      }
    } catch (error) {
      console.log('[订单调度] 自动分配失败:', error.message)
      return {
        code: 200,
        data: order,
        message: '创建成功，等待分身接单'
      }
    }
  }

  @Put(':id')
  async update(
    @Param('id') orderId: string,
    @Body() updateData: Record<string, any>
  ) {
    const order = await this.orderService.updateOrder(orderId, updateData)
    return {
      code: 200,
      data: order,
      message: '更新成功'
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

  @Get(':id/feedback')
  async getFeedback(@Param('id') orderId: string) {
    const feedback = await this.orderService.getOrderFeedback(orderId)
    return {
      code: 200,
      data: feedback,
      message: '获取成功'
    }
  }

  @Get(':id/rating')
  async getRating(@Param('id') orderId: string) {
    const rating = await this.orderService.getOrderRating(orderId)
    return {
      code: 200,
      data: rating,
      message: '获取成功'
    }
  }

  @Get(':id/dispatch-status')
  async getDispatchStatus(@Param('id') orderId: string) {
    const status = await this.dispatchService.getDispatchStatus(orderId)
    return {
      code: 200,
      data: status,
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

  @Put(':id/content')
  async submitContent(
    @Param('id') orderId: string,
    @Body('avatar_id') avatarId: string,
    @Body('content') content: {
      title?: string
      content: string
      images?: string[]
      videos?: string[]
      platform_results?: Array<{
        platform: string
        post_id?: string
        post_url?: string
        status: string
      }>
    }
  ) {
    const order = await this.orderService.submitContent(orderId, avatarId, content)
    return {
      code: 200,
      data: order,
      message: '内容提交成功'
    }
  }

  @Put(':id/approve')
  async approveOrder(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string,
    @Body('rating') rating?: { score: number; comment?: string }
  ) {
    const order = await this.orderService.approveOrder(orderId, userId, rating)
    return {
      code: 200,
      data: order,
      message: '验收通过'
    }
  }

  @Put(':id/reject')
  async rejectOrder(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string,
    @Body('reason') reason: string
  ) {
    const order = await this.orderService.rejectOrder(orderId, userId, reason)
    return {
      code: 200,
      data: order,
      message: '订单已驳回'
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

  @Put(':id/cancel-dispatch')
  async cancelDispatch(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string
  ) {
    const result = await this.dispatchService.cancelDispatch(orderId, userId)
    return {
      code: 200,
      data: result,
      message: '分配已取消'
    }
  }

  @Delete(':id')
  async delete(
    @Param('id') orderId: string,
    @Headers('x-user-id') userId: string
  ) {
    const client = (await import('../../storage/database/supabase-client')).getSupabaseClient()
    
    const { error } = await client
      .from('orders')
      .delete()
      .eq('id', orderId)
      .eq('user_id', userId)
      .eq('status', 'open') // 只允许删除未开始的订单
    
    if (error) {
      throw new Error(`删除订单失败: ${error.message}`)
    }
    
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }

  @Get(':id/detailed-report')
  async getDetailedReport(@Param('id') orderId: string) {
    const report = await this.orderService.getOrderDetailedReport(orderId)
    return {
      code: 200,
      data: report,
      message: '获取成功'
    }
  }

  @Get('avatar/:avatarId/statistics')
  async getAvatarStatistics(
    @Param('avatarId') avatarId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const stats = await this.orderService.getAvatarOrderStatistics(avatarId, {
      startDate,
      endDate
    })
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }
}
