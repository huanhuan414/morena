import { Controller, Get, Post, Delete, Query, Body, Param, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ImageGenService } from './image-gen.service';
import { CoinService } from '../coin/coin.service';
import { AiSkillService } from '../ai-skill/ai-skill.service';

const SKILL_NAMES: Record<string, string> = {
  text: '文本生成',
  image: '图片生成',
  video: '视频生成',
  article: '公众号文章生成',
  clothing: '衣品改造',
  palm: '看手相',
  image_gen: '图片生成',
  video_gen: '视频生成',
  content_writing: '公众号文章生成',
  palm_reading: '看手相',
  fashion_advice: '衣品改造',
  wechat_mp_article: '公众号文章生成',
  fashion_makeover: '衣品改造',
}

@Controller('image-gen')
export class ImageGenController {
  private readonly imageGenService: ImageGenService;

  constructor(
    @Inject(ImageGenService) imageGenService: ImageGenService,
    @Inject(CoinService) private readonly coinService: CoinService,
    @Inject(AiSkillService) private readonly aiSkillService: AiSkillService,
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


    try {
      const skillType = 'image_gen';

      // 检查每日使用次数限制
      const limitCheck = await this.aiSkillService.checkDailyLimit(userId, skillType);
      if (limitCheck.remaining <= 0) {
        return { 
          code: 429, 
          msg: `今日使用次数已达上限（${limitCheck.limit}次/天）`, 
          data: { remaining: 0, limit: limitCheck.limit, used: limitCheck.used } 
        };
      }

      // 检查积分余额是否充足
      const canConsume = await this.coinService.canConsume(userId, skillType);
      if (!canConsume.canConsume) {
        return { 
          code: 402, 
          msg: `积分余额不足，当前 ${canConsume.balance} 积分，需要 ${canConsume.price} 积分`, 
          data: { balance: canConsume.balance, price: canConsume.price } 
        };
      }

      // 扣积分
      let consumeResult: any = null;
      try {
        consumeResult = await this.coinService.consume(userId, skillType);
      } catch (coinError: any) {
        console.error('[ImageGenController] 扣积分失败:', coinError.message);
        return { code: 402, msg: coinError.message || '扣积分失败', data: null };
      }

      // 生成图片
      try {
        const result = await this.imageGenService.generate({
          userId,
          prompt: body.prompt.trim(),
          style: body.style || 'realistic',
          size: body.size || '1024x1024',
        });
        return { 
          code: 200, 
          msg: '生成成功', 
          data: {
            ...result,
            coinConsumed: consumeResult.amount,
            balanceAfter: consumeResult.balanceAfter
          }
        };
      } catch (generateError: any) {
        // 生成失败，退款
        console.error('[ImageGenController] 生成失败，退款:', generateError.message);
        try {
          await this.coinService.gift(
            userId, 
            consumeResult.amount, 
            `${SKILL_NAMES[skillType] || skillType}生成失败退款`
          );
        } catch (refundError: any) {
          console.error('[ImageGenController] 退款失败:', refundError.message);
        }
        return { code: 500, msg: generateError.message || '图片生成失败', data: null };
      }
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
