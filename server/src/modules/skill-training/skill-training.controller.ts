import { Controller, Post, Body } from '@nestjs/common'
import { SkillTrainingService } from './skill-training.service'

interface GenerateSkillDto {
  experience: string
  tips?: string
}

interface SaveSkillDto {
  name: string
  description: string
  category: string
}

@Controller('skill-training')
export class SkillTrainingController {
  constructor(private readonly skillTrainingService: SkillTrainingService) {}

  @Post('generate')
  async generateSkill(@Body() dto: GenerateSkillDto) {
    const result = await this.skillTrainingService.generateSkill(dto.experience, dto.tips)
    return {
      code: 200,
      msg: 'success',
      data: result
    }
  }

  @Post('save')
  async saveSkill(@Body() dto: SaveSkillDto) {
    const result = await this.skillTrainingService.saveSkill(dto)
    return {
      code: 200,
      msg: 'success',
      data: result
    }
  }
}
