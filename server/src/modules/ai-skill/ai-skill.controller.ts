import { Controller, Get, Post, Delete, Query, Body, Param, Req, HttpCode, HttpStatus, Inject, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AiSkillService, SkillType } from './ai-skill.service';
import { StorageService } from '../storage/storage.service';
import { CoinService } from '../coin/coin.service';

@Controller('ai-skill')
export class AiSkillController {

  constructor(
    @Inject(AiSkillService) private readonly aiSkillService: AiSkillService,
    @Inject(StorageService) private readonly storageService: StorageService,
    @Inject(CoinService) private readonly coinService: CoinService,
  ) {}

  /**
   * POST /api/ai-skill/generate
   * 发起 AI 技能图片生成（异步，立即返回 recordId）
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() body: { skillType: SkillType; inputImageUrl?: string; inputText?: string; inputImageUrls?: string[] },
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }
    if (!body.skillType) {
      return { code: 400, msg: '请选择技能类型', data: null };
    }

    // 合并图片URL：inputImageUrls 优先，否则用 inputImageUrl
    let imageUrl = body.inputImageUrl;
    if (body.inputImageUrls && body.inputImageUrls.length > 0) {
      imageUrl = body.inputImageUrls.join(',');
    }


    try {
      // 检查每日使用次数限制
      const limitCheck = await this.aiSkillService.checkDailyLimit(userId, body.skillType as SkillType);
      if (limitCheck.remaining <= 0) {
        return { code: 429, msg: `今日使用次数已达上限（${limitCheck.limit}次/天）`, data: { remaining: 0, limit: limitCheck.limit, used: limitCheck.used } };
      }

      // 检查币余额是否充足
      const canConsume = await this.coinService.canConsume(userId, body.skillType);
      if (!canConsume.canConsume) {
        return { 
          code: 402, 
          msg: `币余额不足，当前 ${canConsume.balance} 币，需要 ${canConsume.price} 币`, 
          data: { balance: canConsume.balance, price: canConsume.price } 
        };
      }

      // 扣币
      let consumeResult: any = null;
      try {
        consumeResult = await this.coinService.consume(userId, body.skillType);
      } catch (coinError: any) {
        console.error('[AiSkillController] 扣币失败:', coinError.message);
        return { code: 402, msg: coinError.message || '扣币失败', data: null };
      }

      // 提交生成任务
      try {
        const result = await this.aiSkillService.startGenerate(
          userId,
          body.skillType as SkillType,
          imageUrl,
          body.inputText,
          consumeResult.amount,
        );
        // 返回结果，包含扣币信息
        return { 
          code: 200, 
          msg: '已提交生成任务', 
          data: {
            ...result,
            coinConsumed: consumeResult.amount,
            balanceAfter: consumeResult.balanceAfter
          }
        };
      } catch (generateError: any) {
        // 生成失败，退款
        console.error('[AiSkillController] 生成失败，退款:', generateError.message);
        try {
          await this.coinService.gift(
            userId, 
            consumeResult.amount, 
            `${body.skillType}生成失败退款`
          );
        } catch (refundError: any) {
          console.error('[AiSkillController] 退款失败:', refundError.message);
        }
        return { code: 500, msg: generateError.message || '提交失败', data: null };
      }
    } catch (error: any) {
      console.error('[AiSkillController] generate error:', error.message);
      return { code: 500, msg: error.message || '提交失败', data: null };
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
   * GET /api/ai-skill/usage-limit?skillType=xxx
   * GET /api/ai-skill/usage-limit （返回所有技能）
   * 获取技能每日使用次数限制
   */
  @Get('usage-limit')
  async getUsageLimit(@Query('skillType') skillType: string, @Req() req: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }
    if (skillType) {
      const result = await this.aiSkillService.checkDailyLimit(userId, skillType as SkillType);
      return { code: 200, msg: 'ok', data: result };
    }
    // 不带 skillType 时返回所有技能的使用情况
    const allLimits = await this.aiSkillService.getAllUsageLimits(userId);
    return { code: 200, msg: 'ok', data: allLimits };
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
    const imageUrl = await this.storageService.uploadImage(file);
    return { code: 200, msg: 'ok', data: { imageUrl } };
  }

  /**
   * DELETE /api/ai-skill/record/:id
   * 删除单条记录
   */
  @Delete('record/:id')
  @HttpCode(HttpStatus.OK)
  async deleteRecord(@Param('id') id: string, @Req() req: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    try {
      const result = await this.aiSkillService.deleteRecords(userId, [id]);
      return { code: 200, msg: '删除成功', data: result };
    } catch (error: any) {
      return { code: 400, msg: error.message || '删除失败', data: null };
    }
  }

  /**
   * POST /api/ai-skill/records/delete
   * 批量删除记录
   */
  @Post('records/delete')
  @HttpCode(HttpStatus.OK)
  async deleteRecords(@Body() body: { ids: string[] }, @Req() req: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return { code: 400, msg: '请选择要删除的记录', data: null };
    }

    try {
      const result = await this.aiSkillService.deleteRecords(userId, body.ids);
      return { code: 200, msg: '删除成功', data: result };
    } catch (error: any) {
      return { code: 400, msg: error.message || '删除失败', data: null };
    }
  }
}
