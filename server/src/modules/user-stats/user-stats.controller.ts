// @ts-nocheck
import { Controller, Get, Headers, Query } from '@nestjs/common'
import { UserStatsService } from './user-stats.service'

@Controller('user-stats')
export class UserStatsController {
  constructor(private readonly userStatsService: UserStatsService) {}

  /**
   * 获取用户统计概览（汇总用户所有分身的统计数据）
   */
  @Get('overview')
  async getOverview(@Headers('x-user-id') userId: string) {
    console.log('[UserStatsController] 获取用户统计概览, userId:', userId)
    if (!userId) {
      return { code: 401, data: null, message: '未登录' }
    }
    
    const stats = await this.userStatsService.getUserStatsOverview(userId)
    return { code: 200, data: stats, message: '获取成功' }
  }

  /**
   * 获取用户订单列表（带分身信息）
   */
  @Get('orders')
  async getOrders(
    @Headers('x-user-id') userId: string,
    @Query('avatarId') avatarId?: string
  ) {
    console.log('[UserStatsController] 获取用户订单, userId:', userId, 'avatarId:', avatarId)
    if (!userId) {
      return { code: 401, data: null, message: '未登录' }
    }
    
    const result = await this.userStatsService.getAvatarOrders(userId, avatarId)
    return { code: 200, data: result, message: '获取成功' }
  }

  /**
   * 获取用户内容列表（带分身信息）
   */
  @Get('contents')
  async getContents(
    @Headers('x-user-id') userId: string,
    @Query('avatarId') avatarId?: string
  ) {
    console.log('[UserStatsController] 获取用户内容, userId:', userId, 'avatarId:', avatarId)
    if (!userId) {
      return { code: 401, data: null, message: '未登录' }
    }
    
    const result = await this.userStatsService.getAvatarContents(userId, avatarId)
    return { code: 200, data: result, message: '获取成功' }
  }
}
