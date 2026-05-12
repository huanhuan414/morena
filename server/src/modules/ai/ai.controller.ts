import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param } from '@nestjs/common'
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
      const result = this.aiService.startGenerate(body)
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

  @Get('status/:requestId')
  @HttpCode(HttpStatus.OK)
  async getStatus(@Param('requestId') requestId: string) {
    const task = this.aiService.getTask(requestId)
    if (!task) {
      return {
        code: 404,
        message: 'not_found',
        data: null,
      }
    }
    return {
      code: 200,
      message: 'success',
      data: task,
    }
  }
}
