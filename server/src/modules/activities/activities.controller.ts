import { Controller, Get, Query, HttpCode, HttpStatus, Req } from '@nestjs/common'
import { ActivitiesService } from './activities.service'

@Controller('activities')
export class ActivitiesController {
  private readonly activitiesService: ActivitiesService

  constructor(activitiesService: ActivitiesService) {
    this.activitiesService = activitiesService
  }

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  async getRecentActivities(
    @Req() req: any,
    @Query('limit') limit?: string
  ) {
    const userId = req.headers['x-user-id'] || req.query.userId || 'dev_user'
    const limitNum = limit ? parseInt(limit, 10) : 10
    try {
      if (this.activitiesService) {
        const activities = await this.activitiesService.getRecentActivities(userId, limitNum)
        return { code: 200, msg: 'success', data: activities }
      }
    } catch (e) {
      console.error('[ActivitiesController] getRecentActivities error:', e.message)
    }
    return { code: 200, msg: 'success', data: [] }
  }
}
