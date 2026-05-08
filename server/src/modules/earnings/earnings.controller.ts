// @ts-nocheck
import { Controller, Get, Query } from '@nestjs/common'
import { EarningsService } from './earnings.service'

@Controller('earnings')
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}
  
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
}
