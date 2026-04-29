import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { PalmReadingService } from './palm-reading.service';

@Controller('palm-reading')
export class PalmReadingController {
  constructor(private readonly palmReadingService: PalmReadingService) {}

  /**
   * 创建掌相阅读任务（异步，立即返回taskId）
   */
  @Post('create')
  async create(@Body() body: { imageUrl: string; avatarId?: string }) {
    const { imageUrl, avatarId } = body;

    if (!imageUrl) {
      return { code: 400, message: '请提供图片URL', data: null };
    }

    try {
      const record = await this.palmReadingService.createTask(imageUrl, avatarId);
      return { code: 200, message: '任务创建成功', data: record };
    } catch (error: any) {
      return { code: 500, message: error.message || '创建任务失败', data: null };
    }
  }

  /**
   * 查询任务进度
   */
  @Get('progress/:id')
  async getProgress(@Param('id') id: string) {
    try {
      const record = await this.palmReadingService.getProgress(id);
      return { code: 200, message: '查询成功', data: record };
    } catch (error: any) {
      return { code: 500, message: error.message || '查询失败', data: null };
    }
  }

  /**
   * 查询历史记录
   */
  @Get('history')
  async getHistory(@Query('avatarId') avatarId?: string) {
    try {
      const records = await this.palmReadingService.getHistory(avatarId);
      return { code: 200, message: '查询成功', data: records };
    } catch (error: any) {
      return { code: 500, message: error.message || '查询失败', data: null };
    }
  }
}
