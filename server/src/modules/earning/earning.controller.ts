// @ts-nocheck
import { Controller, Get, Post, Body, Headers, Query, Inject } from '@nestjs/common'
import { EarningService } from './earning.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('earnings')
export class EarningController {
  constructor(@Inject('EARNING_SERVICE') private readonly earningService: EarningService) {}

  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string) {
    const limitNum = (() => {
      const n = Number(limit)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50
    })()
    const data = await this.earningService.getLeaderboard(limitNum)
    return { code: 200, data, message: '获取成功' }
  }

  @Get('overview')
  async getOverview(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    const overview = await this.earningService.getEarningsOverview(userId)
    return {
      code: 200,
      data: overview,
      message: '获取成功'
    }
  }

  @Get()
  async getList(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    const result = await this.earningService.getEarningsList(userId, {
      type,
      status,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    })
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  @Post('withdraw')
  async createWithdrawal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body()
    body: {
      amount: number
      method?: string
      account?: string
      accountInfo?: any
    }
  ) {
    const userId = requireAuthenticatedUserId(headers)
    const withdrawal = await this.earningService.createWithdrawal(userId, {
      amount: body?.amount,
      method: body?.method || 'wechat',
      account: body?.account || (body?.accountInfo ? JSON.stringify(body.accountInfo) : '')
    })
    return {
      code: 200,
      data: withdrawal,
      message: '提现申请已提交'
    }
  }
}
