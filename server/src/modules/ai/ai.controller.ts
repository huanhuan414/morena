import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AiService } from './ai.service'

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateContent(@Body() body: {
    prompt: string
    platforms: string[]
    contentType: string
  }) {
    try {
      const result = await this.aiService.generateContent(body)
      return {
        code: 200,
        message: 'success',
        data: result
      }
    } catch (error) {
      return {
        code: 500,
        message: error.message || '生成失败',
        data: null
      }
    }
  }
}
