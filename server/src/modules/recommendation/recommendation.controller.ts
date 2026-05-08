// @ts-nocheck
import { Controller, Post, Body, Headers } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'

@Controller('avatar')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  /**
   * 获取推荐分身列表
   */
  @Post('recommendations')
  async getRecommendations(
    @Headers('x-user-id') userId: string,
    @Body() body: any
  ) {
    const { location, limit = 20 } = body

    const recommendations = await this.recommendationService.getRecommendations(
      userId,
      location,
      limit
    )

    return {
      code: 200,
      msg: 'Get recommendations successfully',
      data: recommendations
    }
  }
}
