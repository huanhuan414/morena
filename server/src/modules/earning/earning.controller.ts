import { Controller, Get, Post, Body, Headers, Query } from '@nestjs/common'
import { EarningService } from './earning.service'

@Controller('earnings')
export class EarningController {
  constructor(private readonly earningService: EarningService) {}

  @Get('overview')
  async getOverview(@Headers('x-user-id') userId: string) {
    const overview = await this.earningService.getEarningsOverview(userId)
    return {
      code: 200,
      data: overview,
      message: '获取成功'
    }
  }

  @Get()
  async getList(
    @Headers('x-user-id') userId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
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
    @Headers('x-user-id') userId: string,
    @Body() body: { amount: number; method: string; accountInfo: Record<string, any> }
  ) {
    const withdrawal = await this.earningService.createWithdrawal(userId, body)
    return {
      code: 200,
      data: withdrawal,
      message: '提现申请已提交'
    }
  }

  @Get('withdrawals')
  async getWithdrawals(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.earningService.getWithdrawals(
      userId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }
}
