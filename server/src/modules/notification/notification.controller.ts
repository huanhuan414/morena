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
}
