// @ts-nocheck
import { Controller, Get, Post, Query, Headers, Body, Inject } from '@nestjs/common'
import { EarningsService } from './earnings.service'

@Controller('earnings')
export class EarningsController {
  constructor(@Inject('EARNINGS_SERVICE') private readonly earningsService: EarningsService) {}

  /**
   * GET /api/earnings/leaderboard - 收益排行榜
   */
  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50
    const result = await this.earningsService.getLeaderboard(limitNum)

    return {
      code: 200,
      msg: 'success',
      data: result
    }
  }

  /**
   * GET /api/earnings/overview - 收益概览
   */
  @Get('overview')
  async getOverview(@Headers('x-user-id') userId?: string) {
    if (!userId) {
      return {
        code: 401,
        msg: '未登录',
        data: { total_earnings: 0, pending_earnings: 0, available_earnings: 0 }
      }
    }
    const result = await this.earningsService.getEarningStats(userId)

    return {
      code: 200,
      msg: 'success',
      data: result
    }
  }

  /**
   * GET /api/earnings - 收益列表
   */
  @Get()
  async getEarnings(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!userId) {
      return { code: 401, msg: '未登录', data: { list: [], total: 0, page: 1, pageSize: 20 } }
    }
    const result = await this.earningsService.getEarnings(userId, parseInt(page) || 1, parseInt(pageSize) || 20)
    return { code: 200, msg: 'success', data: result }
  }

  /**
   * POST /api/earnings/withdraw - 提现申请
   */
  @Post('withdraw')
  async requestWithdrawal(
    @Headers('x-user-id') userId: string,
    @Body() body: any
  ) {
    if (!userId) {
      return { code: 401, msg: '未登录', data: null }
    }
    try {
      const amount = Number(body?.amount) || 0
      const paymentMethod = body?.paymentMethod || body?.method || 'wechat'
      const paymentAccount = body?.paymentAccount || body?.accountInfo || body?.account || ''
      const result = await this.earningsService.requestWithdrawal(
        userId,
        amount,
        paymentMethod,
        typeof paymentAccount === 'string' ? paymentAccount : JSON.stringify(paymentAccount || {})
      )
      return { code: 200, msg: '提现申请已提交', data: result }
    } catch (e) {
      return { code: 400, msg: e.message, data: null }
    }
  }
}
