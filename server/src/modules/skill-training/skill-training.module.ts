import { Module } from '@nestjs/common'
import { SkillTrainingController } from './skill-training.controller'
import { SkillTrainingService } from './skill-training.service'

@Module({
  controllers: [SkillTrainingController],
  providers: [SkillTrainingService],
})
export class SkillTrainingModule {}
