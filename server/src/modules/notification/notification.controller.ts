// @ts-nocheck
import { Controller, Get, Put, Post, Body, Param, Headers, Inject } from '@nestjs/common'
import { NotificationService } from './notification.service'

@Controller('notifications')
export class NotificationController {
  private readonly notificationService: NotificationService

  constructor(@Inject(NotificationService) notificationService: NotificationService) {
    this.notificationService = notificationService
  }

  @Get()
  async getNotifications(@Headers('x-user-id') userId: string) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.notificationService) {
        const notifications = await this.notificationService.getNotifications(userId)
        return { code: 200, data: notifications, message: '获取成功' }
      }
    } catch (e) {
      console.error('[NotificationController] getNotifications error:', e.message)
    }
    return { code: 200, data: { list: [], total: 0, page: 1, pageSize: 20 }, message: '获取成功' }
  }

  @Get('unread-count')
  async getUnreadCount(@Headers('x-user-id') userId: string) {
    if (!userId) return { code: 200, data: { count: 0 }, message: '获取成功' }
    try {
      if (this.notificationService) {
        const count = await this.notificationService.getUnreadCount(userId)
        return { code: 200, data: count, message: '获取成功' }
      }
    } catch (e) {
      console.error('[NotificationController] getUnreadCount error:', e.message)
    }
    return { code: 200, data: { count: 0 }, message: '获取成功' }
  }

  @Get('settings')
  async getSettings(@Headers('x-user-id') userId: string) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.notificationService) {
        const settings = await this.notificationService.getNotificationSettings(userId)
        return { code: 200, data: settings, message: '获取成功' }
      }
    } catch (e) {
      console.error('[NotificationController] getSettings error:', e.message)
    }
    return { code: 200, data: { message: true, like: true, follow: true, system: true }, message: '获取成功' }
  }

  @Put('settings')
  async updateSettings(
    @Headers('x-user-id') userId: string,
    @Body() settings: Record<string, boolean>
  ) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.notificationService) {
        const result = await this.notificationService.updateNotificationSettings(userId, settings)
        return { code: 200, data: result, message: '设置已更新' }
      }
    } catch (e) {
      console.error('[NotificationController] updateSettings error:', e.message)
    }
    return { code: 200, data: { success: true, ...settings }, message: '设置已更新' }
  }

  @Put(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      if (this.notificationService) {
        await this.notificationService.markAsRead(userId, notificationId)
      }
    } catch (e) {
      console.error('[NotificationController] markAsRead error:', e.message)
    }
    return { code: 200, data: null, message: '已标记已读' }
  }

  @Post('urge-review')
  async urgeReview(
    @Headers('x-user-id') userId: string,
    @Body() body: { orderId: string; contentTitle?: string }
  ) {
    try {
      if (this.notificationService && body?.orderId) {
        await this.notificationService.createNotification({
          user_id: userId,
          type: 'urge_review',
          title: '催验收提醒',
          content: `分身已完成内容"${body.contentTitle || '内容'}"的发布，请尽快验收`,
          metadata: { orderId: body.orderId, triggeredBy: userId }
        })
      }
      return { code: 200, data: null, message: '催验收提醒已发送' }
    } catch (error) {
      return { code: 500, data: null, message: '发送失败：' + (error as Error).message }
    }
  }

  @Put('read-all')
  async markAllAsRead(@Headers('x-user-id') userId: string) {
    try {
      if (this.notificationService) {
        await this.notificationService.markAllAsRead(userId)
      }
    } catch (e) {
      console.error('[NotificationController] markAllAsRead error:', e.message)
    }
    return { code: 200, data: null, message: '已全部标记已读' }
  }

  @Post()
  async createNotification(
    @Headers('x-user-id') userId: string,
    @Body() body: { type: string; title: string; content: string; data?: any }
  ) {
    try {
      if (this.notificationService) {
        const notification = await this.notificationService.createNotification(userId, body)
        return { code: 200, data: notification, message: '创建成功' }
      }
    } catch (e) {
      console.error('[NotificationController] createNotification error:', e.message)
    }
    return { code: 500, data: null, message: '服务暂不可用' }
  }
}
