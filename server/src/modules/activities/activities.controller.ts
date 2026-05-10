import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ActivitiesService } from './activities.service'

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  async getRecentActivities(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10
    const activities = await this.activitiesService.getRecentActivities(limitNum)
    return {
      code: 200,
      msg: 'success',
      data: activities,
    }
  }
}
