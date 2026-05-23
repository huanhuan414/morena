import { Controller, Get, Query, HttpCode, HttpStatus, Inject, Post, Body, Headers } from '@nestjs/common'
import { ActivitiesService } from './activities.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('activities')
export class ActivitiesController {
  private readonly activitiesService: ActivitiesService

  constructor(@Inject(ActivitiesService) activitiesService: ActivitiesService) {
    this.activitiesService = activitiesService
  }

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  async getRecentActivities(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('limit') limit?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
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
  async trackCampaign(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('eventType') eventType: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
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
