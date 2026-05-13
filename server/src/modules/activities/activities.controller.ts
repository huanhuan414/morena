import { Controller, Get, Query, HttpCode, HttpStatus, Req } from '@nestjs/common'
import { ActivitiesService } from './activities.service'

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  async getRecentActivities(
    @Req() req: any,
    @Query('limit') limit?: string
  ) {
    const userId = req.headers['x-user-id'] || req.query.userId || 'dev_user'
    const limitNum = limit ? parseInt(limit, 10) : 10
    const activities = await this.activitiesService.getRecentActivities(userId, limitNum)
    return {
      code: 200,
      msg: 'success',
      data: activities,
    }
  }
}
