import { Controller, Get, Post, Delete, Query, Body, Param, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ImageGenService } from './image-gen.service';

@Controller('image-gen')
export class ImageGenController {
  private readonly imageGenService: ImageGenService;

  constructor(
    @Inject(ImageGenService) imageGenService: ImageGenService,
  ) {
    this.imageGenService = imageGenService;
  }

  /**
   * POST /api/image-gen/generate
   * 生成图片
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() body: { prompt: string; style?: string; size?: string },
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }
    if (!body.prompt || body.prompt.trim().length === 0) {
      return { code: 400, msg: '请输入图片描述', data: null };
    }

    console.log(`[ImageGenController] generate: userId=${userId}, prompt="${body.prompt.slice(0, 50)}"`);

    try {
      const result = await this.imageGenService.generate({
        userId,
        prompt: body.prompt.trim(),
        style: body.style || 'realistic',
        size: body.size || '1024x1024',
      });
      return { code: 200, msg: '生成成功', data: result };
    } catch (error: any) {
      console.error('[ImageGenController] generate error:', error.message);
      return { code: 500, msg: error.message || '图片生成失败', data: null };
    }
  }

  /**
   * GET /api/image-gen/history
   * 获取用户的图片生成历史
   */
  @Get('history')
  async getHistory(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    try {
      const result = await this.imageGenService.getHistory(
        userId,
        parseInt(page || '1', 10),
        parseInt(pageSize || '20', 10),
      );
      return { code: 200, msg: 'success', data: result };
    } catch (error: any) {
      console.error('[ImageGenController] getHistory error:', error.message);
      return { code: 500, msg: error.message || '获取历史失败', data: null };
    }
  }

  /**
   * GET /api/image-gen/:id
   * 获取单条图片详情
   */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    try {
      const result = await this.imageGenService.getById(id, userId);
      if (!result) {
        return { code: 404, msg: '记录不存在', data: null };
      }
      return { code: 200, msg: 'success', data: result };
    } catch (error: any) {
      console.error('[ImageGenController] getById error:', error.message);
      return { code: 500, msg: error.message || '获取详情失败', data: null };
    }
  }

  /**
   * DELETE /api/image-gen/:id
   * 删除图片记录
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    try {
      await this.imageGenService.delete(id, userId);
      return { code: 200, msg: '删除成功', data: null };
    } catch (error: any) {
      console.error('[ImageGenController] delete error:', error.message);
      return { code: 500, msg: error.message || '删除失败', data: null };
    }
  }
}
