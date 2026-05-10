// @ts-nocheck
import { Controller, Post, Get, Body, Headers, Query, Inject, Param } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'

@Controller('recommendation')
export class RecommendationController {
  constructor(@Inject('RECOMMENDATION_SERVICE') private readonly recommendationService: RecommendationService) {}

  /**
   * 获取推荐分身列表 - POST
   */
  @Post('recommendations')
  async getRecommendations(
    @Headers('x-user-id') userId: string,
    @Body() body: any
  ) {
    const { platforms, contentType, limit = 20 } = body

    const recommendations = await this.recommendationService.getRecommendations(
      userId,
      'avatar',
      limit,
      platforms,
      contentType
    )

    return {
      code: 200,
      msg: 'Get recommendations successfully',
      data: recommendations
    }
  }

  /**
   * 获取推荐列表 - GET
   */
  @Get('list')
  async getRecommendationList(@Query('type') type: string) {
    const recommendations = await this.recommendationService.getRecommendations(
      undefined,
      type,
      20
    )

    return {
      code: 200,
      msg: 'success',
      data: recommendations
    }
  }

  /**
   * 根据订单获取推荐分身 - GET
   */
  @Get('avatar/order/:orderId')
  async getRecommendationsByOrder(
    @Headers('x-user-id') userId: string,
    @Param('orderId') orderId: string
  ) {
    const recommendations = await this.recommendationService.getRecommendationsByOrderId(
      userId,
      orderId
    )

    return {
      code: 200,
      msg: 'success',
      data: recommendations
    }
  }
}
