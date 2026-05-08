// @ts-nocheck
import { Controller, Post, Body, Get, Query, Param, Delete, Headers } from '@nestjs/common';
import { PalmReadingService } from './palm-reading.service';

@Controller('palm-reading')
export class PalmReadingController {
  constructor(private readonly palmReadingService: PalmReadingService) {}

  /**
   * 创建掌相阅读任务（异步，立即返回taskId）
   */
  @Post('create')
  async create(
    @Headers('x-user-id') userId: string,
    @Body() body: { imageUrl: string; avatarId?: string }
  ) {
    const { imageUrl, avatarId } = body;

    if (!imageUrl) {
      return { code: 400, message: '请提供图片URL', data: null };
    }

    try {
      const record = await this.palmReadingService.createTask(imageUrl, avatarId, userId);
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
   * 查询历史记录（支持分页，按用户ID过滤）
   */
  @Get('history')
  async getHistory(
    @Headers('x-user-id') userId: string,
    @Query('avatarId') avatarId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const result = await this.palmReadingService.getHistory(userId, avatarId, pageNum, limitNum);
      return { code: 200, message: '查询成功', data: result };
    } catch (error: any) {
      return { code: 500, message: error.message || '查询失败', data: null };
    }
  }

  /**
   * 删除指定记录
   */
  @Delete(':id')
  async deleteRecord(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string
  ) {
    try {
      await this.palmReadingService.deleteRecord(id, userId);
      return { code: 200, message: '删除成功', data: null };
    } catch (error: any) {
      return { code: 500, message: error.message || '删除失败', data: null };
    }
  }

  /**
   * 清空所有历史记录
   */
  @Delete()
  async clearHistory(
    @Headers('x-user-id') userId: string,
    @Query('avatarId') avatarId?: string
  ) {
    try {
      await this.palmReadingService.clearHistory(userId, avatarId);
      return { code: 200, message: '清空成功', data: null };
    } catch (error: any) {
      return { code: 500, message: error.message || '清空失败', data: null };
    }
  }
}
