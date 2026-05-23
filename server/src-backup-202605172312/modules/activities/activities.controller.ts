import { Controller, Get, Query, HttpCode, HttpStatus, Req, Inject, Post, Body } from '@nestjs/common'
import { ActivitiesService } from './activities.service'

@Controller('activities')
export class ActivitiesController {
  private readonly activitiesService: ActivitiesService

  constructor(@Inject(ActivitiesService) activitiesService: ActivitiesService) {
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

  @Get('campaign/active')
  @HttpCode(HttpStatus.OK)
  async getActiveCampaign() {
    try {
      const campaign = await this.activitiesService.getActiveCampaign()
      return { code: 200, msg: 'success', data: campaign }
    } catch (e) {
      console.error('[ActivitiesController] getActiveCampaign error:', e.message)
      return { code: 200, msg: 'success', data: null }
    }
  }

  @Post('campaign/track')
  @HttpCode(HttpStatus.OK)
  async trackCampaign(@Req() req: any, @Body('eventType') eventType: string) {
    const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId
    const normalizedEventType = String(eventType || '').trim()
    if (!normalizedEventType) {
      return { code: 200, msg: 'success', data: { skipped: true } }
    }
    try {
      const result = await this.activitiesService.trackCampaignEvent(userId, normalizedEventType)
      return { code: 200, msg: 'success', data: result }
    } catch (e) {
      console.error('[ActivitiesController] trackCampaign error:', e.message)
      return { code: 200, msg: 'success', data: { skipped: true } }
    }
  }
}
