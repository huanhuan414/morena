// @ts-nocheck
import { Controller, Get, Query, Headers, Inject } from '@nestjs/common'
import { EarningsService } from './earnings.service'

@Controller('earnings')
export class EarningsController {
  constructor(@Inject('EARNINGS_SERVICE') private readonly earningsService: EarningsService) {}
  
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
}
