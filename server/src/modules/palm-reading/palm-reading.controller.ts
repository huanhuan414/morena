import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PalmReadingService } from './palm-reading.service';

interface GenerateDto {
  imageUrl: string;
}

@Controller('palm-reading')
export class PalmReadingController {
  constructor(private readonly palmReadingService: PalmReadingService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(@Body() body: GenerateDto) {
    const { imageUrl } = body;

    if (!imageUrl) {
      return {
        code: 400,
        message: '请提供图片URL',
        data: null
      };
    }

    try {
      const result = await this.palmReadingService.generatePalmReading(imageUrl);
      return {
        code: 200,
        message: '生成成功',
        data: result
      };
    } catch (error: any) {
      return {
        code: error.status || 500,
        message: error.message || '生成失败',
        data: null
      };
    }
  }
}
