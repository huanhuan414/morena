import { Module } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'
import { RecommendationController } from './recommendation.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService]
})
export class RecommendationModule {}
