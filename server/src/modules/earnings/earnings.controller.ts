// @ts-nocheck
import { Controller, Get, Post, Query, Headers, Body, Inject, BadRequestException, HttpException } from '@nestjs/common'
import { EarningsService } from './earnings.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('earnings')
export class EarningsController {
  constructor(@Inject('EARNINGS_SERVICE') private readonly earningsService: EarningsService) {}

  /**
   * GET /api/earnings/leaderboard - 收益排行榜
   * 匿名边界：该接口保留匿名只读访问，仅返回排行榜公开统计结果，不返回用户提现账户、联系方式或其它私有字段。
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
  async getOverview(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    const result = await this.earningsService.getEarnings(userId, parseInt(page) || 1, parseInt(pageSize) || 20)
    return { code: 200, msg: 'success', data: result }
  }

  /**
   * POST /api/earnings/withdraw - 提现申请
   */
  @Post('withdraw')
  async requestWithdrawal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { amount: number; paymentMethod?: string; paymentAccount?: string }
  ) {
    const userId = requireAuthenticatedUserId(headers)
    try {
      const result = await this.earningsService.requestWithdrawal(
        userId,
        body.amount,
        body.paymentMethod || 'wechat',
        body.paymentAccount || ''
      )
      return { code: 200, msg: '提现申请已提交', data: result }
    } catch (e) {
      if (e instanceof HttpException) throw e
      throw new BadRequestException({ msg: e.message, data: null })
    }
  }
}
