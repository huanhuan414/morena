import { Controller, Get, Post, Query, Body, Param, Req, HttpCode, HttpStatus, Inject, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AiSkillService, SkillType } from './ai-skill.service';
import { StorageService } from '../storage/storage.service';

@Controller('ai-skill')
export class AiSkillController {

  constructor(
    @Inject(AiSkillService) private readonly aiSkillService: AiSkillService,
    @Inject(StorageService) private readonly storageService: StorageService,
  ) {}

  /**
   * POST /api/ai-skill/generate
   * 生成 AI 技能图片
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() body: { skillType: SkillType; inputImageUrl?: string; inputText?: string },
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }
    if (!body.skillType) {
      return { code: 400, msg: '请选择技能类型', data: null };
    }

    console.log(`[AiSkillController] generate: userId=${userId}, skillType=${body.skillType}, hasImage=${!!body.inputImageUrl}`);

    try {
      const result = await this.aiSkillService.generate(
        userId,
        body.skillType as SkillType,
        body.inputImageUrl,
        body.inputText,
      );
      return { code: 200, msg: '生成成功', data: result };
    } catch (error: any) {
      console.error('[AiSkillController] generate error:', error.message);
      return { code: 500, msg: error.message || '生成失败', data: null };
    }
  }

  /**
   * GET /api/ai-skill/history
   * 获取生成历史
   */
  @Get('history')
  async getHistory(
    @Query('skillType') skillType: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    const result = await this.aiSkillService.getHistory(
      userId,
      (skillType as SkillType) || undefined,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
    return { code: 200, msg: 'ok', data: result };
  }

  /**
   * GET /api/ai-skill/record/:id
   * 获取单条记录（轮询状态用）
   */
  @Get('record/:id')
  async getRecord(@Param('id') id: string, @Req() req: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    const record = await this.aiSkillService.getRecord(userId, id);
    if (!record) {
      return { code: 404, msg: '记录不存在', data: null };
    }
    return { code: 200, msg: 'ok', data: record };
  }

  /** 上传图片到TOS，返回URL */
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { code: 400, msg: '请选择图片', data: null };
    }
    console.log('[AiSkill] 上传图片:', file.originalname, file.mimetype, file.size, 'bytes');
    const imageUrl = await this.storageService.uploadImage(file);
    console.log('[AiSkill] 图片URL:', imageUrl);
    return { code: 200, msg: 'ok', data: { imageUrl } };
  }
}
