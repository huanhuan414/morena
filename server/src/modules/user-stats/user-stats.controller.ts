// @ts-nocheck
import { Controller, Get, Headers, Query, Inject } from '@nestjs/common'
import { UserStatsService } from './user-stats.service'

@Controller('user-stats')
export class UserStatsController {
  private readonly userStatsService: UserStatsService

  constructor(@Inject(UserStatsService) userStatsService: UserStatsService) {
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
    @Query('avatarId') avatarId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    const safePage = Math.max(1, parseInt(page || '1', 10) || 1)
    const safePageSize = Math.min(50, Math.max(1, parseInt(pageSize || '20', 10) || 20))
    try {
      if (this.userStatsService) {
        const result = await this.userStatsService.getAvatarContents(
          userId,
          avatarId,
          status,
          safePage,
          safePageSize
        )
        return { code: 200, data: result, message: '获取成功' }
      }
    } catch (e) {
      console.error('[UserStatsController] getContents error:', e.message)
    }
    return {
      code: 200,
      data: { contents: [], avatars: [], total: 0, page: safePage, pageSize: safePageSize, hasMore: false },
      message: '获取成功'
    }
  }
}
