// @ts-nocheck
import { Controller, Get, Headers, Query } from '@nestjs/common'
import { UserStatsService } from './user-stats.service'

@Controller('user-stats')
export class UserStatsController {
  private readonly userStatsService: UserStatsService

  constructor(userStatsService: UserStatsService) {
    this.userStatsService = userStatsService
  }

  @Get('overview')
  async getOverview(@Headers('x-user-id') userId: string) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.userStatsService) {
        const stats = await this.userStatsService.getUserStatsOverview(userId)
        return { code: 200, data: stats, message: '获取成功' }
      }
    } catch (e) {
      console.error('[UserStatsController] getOverview error:', e.message)
    }
    return { code: 200, data: { avatarCount: 0, pendingOrders: 0, generatedContents: 0, totalEarnings: 0, totalWorkHours: 0 }, message: '获取成功' }
  }

  @Get('orders')
  async getOrders(
    @Headers('x-user-id') userId: string,
    @Query('avatarId') avatarId?: string
  ) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.userStatsService) {
        const result = await this.userStatsService.getAvatarOrders(userId, avatarId)
        return { code: 200, data: result, message: '获取成功' }
      }
    } catch (e) {
      console.error('[UserStatsController] getOrders error:', e.message)
    }
    return { code: 200, data: { list: [], total: 0 }, message: '获取成功' }
  }

  @Get('contents')
  async getContents(
    @Headers('x-user-id') userId: string,
    @Query('avatarId') avatarId?: string
  ) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.userStatsService) {
        const result = await this.userStatsService.getAvatarContents(userId, avatarId)
        return { code: 200, data: result, message: '获取成功' }
      }
    } catch (e) {
      console.error('[UserStatsController] getContents error:', e.message)
    }
    return { code: 200, data: { list: [], total: 0 }, message: '获取成功' }
  }
}
