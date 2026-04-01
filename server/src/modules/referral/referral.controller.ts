import { Controller, Get, Post, Body, Headers, Query } from '@nestjs/common'
import { ReferralService } from './referral.service'

@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('code')
  async getReferralCode(@Headers('x-user-id') userId: string) {
    const code = await this.referralService.generateReferralCode(userId)
    return {
      code: 200,
      data: { referralCode: code },
      message: '获取成功'
    }
  }

  @Post('use')
  async useReferralCode(
    @Headers('x-user-id') userId: string,
    @Body('code') code: string
  ) {
    const result = await this.referralService.useReferralCode(userId, code)
    return {
      code: 200,
      data: result,
      message: '邀请码使用成功'
    }
  }

  @Get('stats')
  async getStats(@Headers('x-user-id') userId: string) {
    const stats = await this.referralService.getReferralStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  @Get('list')
  async getList(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.referralService.getReferralList(
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
