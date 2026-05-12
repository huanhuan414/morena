// @ts-nocheck
import { Controller, Get, Put, Post, Body, Param, Headers } from '@nestjs/common'
import { NotificationService } from './notification.service'

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Headers('x-user-id') userId: string) {
    const notifications = await this.notificationService.getNotifications(userId)
    return {
      code: 200,
      data: notifications,
      message: '获取成功'
    }
  }

  @Get('unread-count')
  async getUnreadCount(@Headers('x-user-id') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId)
    return {
      code: 200,
      data: { count },
      message: '获取成功'
    }
  }

  @Get('settings')
  async getSettings(@Headers('x-user-id') userId: string) {
    const settings = await this.notificationService.getNotificationSettings(userId)
    return {
      code: 200,
      data: settings,
      message: '获取成功'
    }
  }

  @Put('settings')
  async updateSettings(
    @Headers('x-user-id') userId: string,
    @Body() settings: Record<string, boolean>
  ) {
    const result = await this.notificationService.updateNotificationSettings(userId, settings)
    return {
      code: 200,
      data: result,
      message: '设置已更新'
    }
  }

  @Put(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Headers('x-user-id') userId: string
  ) {
    await this.notificationService.markAsRead(userId, notificationId)
    return {
      code: 200,
      data: null,
      message: '已标记已读'
    }
  }

  @Post('urge-review')
  async urgeReview(
    @Headers('x-user-id') userId: string,
    @Body() body: { orderId: string; contentTitle?: string }
  ) {
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()

      // 查找订单发布者
      const orders = await db.query('orders', { id: body.orderId })
      const order = Array.isArray(orders) ? orders[0] : orders?.[0]
      if (!order) {
        return { code: 404, data: null, message: '订单不存在' }
      }

      const publisherId = order.userId || order.user_id
      const title = body.contentTitle || order.title || '内容'

      await this.notificationService.createNotification({
        user_id: publisherId,
        type: 'urge_review',
        title: '催验收提醒',
        content: `分身已完成内容"${title}"的发布，请尽快验收`,
        metadata: { orderId: body.orderId, triggeredBy: userId }
      })

      return { code: 200, data: null, message: '催验收提醒已发送' }
    } catch (error) {
      return { code: 500, data: null, message: '发送失败：' + (error as Error).message }
    }
  }

  @Put('read-all')
  async markAllAsRead(@Headers('x-user-id') userId: string) {
    await this.notificationService.markAllAsRead(userId)
    return {
      code: 200,
      data: null,
      message: '已全部标记已读'
    }
  }

  @Post()
  async createNotification(
    @Headers('x-user-id') userId: string,
    @Body() body: { type: string; title: string; content: string; data?: any }
  ) {
    const notification = await this.notificationService.createNotification(userId, body)
    return {
      code: 200,
      data: notification,
      message: '创建成功'
    }
  }

  @Get('order/:orderId')
  async getNotificationsByOrder(@Param('orderId') orderId: string) {
    const notifications = await this.notificationService.getNotificationsByOrder(orderId)
    return {
      code: 200,
      data: notifications,
      message: '获取成功'
    }
  }
}
