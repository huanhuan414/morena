// @ts-nocheck
import { Module } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'
import { RecommendationController } from './recommendation.controller'

@Module({
  imports: [],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService]
})
export class RecommendationModule {}
