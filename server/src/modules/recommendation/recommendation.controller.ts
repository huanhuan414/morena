import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('avatar')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  /**
   * 获取推荐分身列表
   */
  @Post('recommendations')
  @UseGuards(JwtAuthGuard)
  async getRecommendations(@Body() body: any, @Req() req: any) {
    const userId = req.user.id
    const { location, limit = 20 } = body

    const recommendations = await this.recommendationService.getRecommendations(
      userId,
      location,
      limit
    )

    return {
      code: 200,
      msg: '获取成功',
      data: recommendations
    }
  }
}
