import { Controller, Get, Post, Delete, Query, Body, Param, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { VideoGenService } from './video-gen.service';
import { CoinService } from '../coin/coin.service';
import { AiSkillService } from '../ai-skill/ai-skill.service';
import { getPool } from '../../storage/database/mysql-client';

const SKILL_NAME = '视频生成';

@Controller('video-gen')
export class VideoGenController {
  constructor(
    @Inject(VideoGenService) private readonly videoGenService: VideoGenService,
    @Inject(CoinService) private readonly coinService: CoinService,
    @Inject(AiSkillService) private readonly aiSkillService: AiSkillService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() body: { prompt: string; duration?: number; ratio?: string },
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return { code: 401, msg: '请先登录', data: null };
    }
    if (!body.prompt || body.prompt.trim().length === 0) {
      return { code: 400, msg: '请输入视频描述', data: null };
    }

    try {
      const skillType = 'video_gen';

      const [activeTasks] = await getPool().query(
        `SELECT id FROM generated_content
         WHERE user_id = ? AND content_type = 'video' AND status IN ('pending', 'generating')
         LIMIT 1`,
        [userId],
      );
      if ((activeTasks as any[]).length > 0) {
        return { code: 409, msg: '请等待前面的作品完成', data: null };
      }


      // const limitCheck = await this.aiSkillService.checkDailyLimit(userId, skillType);
      // if (limitCheck.remaining <= 0) {
      //   return {
      //     code: 429,
      //     msg: `今日使用次数已达上限（${limitCheck.limit}次/天）`,
      //     data: { remaining: 0, limit: limitCheck.limit, used: limitCheck.used }
      //   };
      // }

      const canConsume = await this.coinService.canConsume(userId, skillType);
      if (!canConsume.canConsume) {
        return {
          code: 402,
          msg: `积分余额不足，当前 ${canConsume.balance} 积分，需要 ${canConsume.price} 积分`,
          data: { balance: canConsume.balance, price: canConsume.price }
        };
      }

      let consumeResult: any = null;
      try {
        consumeResult = await this.coinService.consume(userId, skillType);
      } catch (coinError: any) {
        console.error('[VideoGenController] 扣积分失败:', coinError.message);
        return { code: 402, msg: coinError.message || '扣积分失败', data: null };
      }

      try {
        const task = await this.videoGenService.startGenerate({
          userId,
          prompt: body.prompt.trim(),
          duration: body.duration || 5,
          ratio: body.ratio || '9:16',
          coinConsumed: consumeResult.amount,
        });

        return {
          code: 200,
          msg: '已进入待处理队列',
          data: {
            id: task.id,
            status: task.status,
            coinConsumed: consumeResult.amount,
            balanceAfter: consumeResult.balanceAfter
          }
        };
      } catch (generateError: any) {
        console.error('[VideoGenController] 提交失败，退款:', generateError.message);
        try {
          await this.coinService.gift(userId, consumeResult.amount, SKILL_NAME + '提交失败退款');
        } catch (refundError: any) {
          console.error('[VideoGenController] 退款失败:', refundError.message);
        }
        return { code: 500, msg: generateError.message || '视频生成任务提交失败', data: null };
      }
    } catch (error: any) {
      console.error('[VideoGenController] generate error:', error.message);
      return { code: 500, msg: error.message || '视频生成失败', data: null };
    }
  }

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
      const result = await this.videoGenService.getHistory(
        userId,
        parseInt(page || '1', 10),
        parseInt(pageSize || '20', 10),
      );
      return { code: 200, msg: 'success', data: result };
    } catch (error: any) {
      console.error('[VideoGenController] getHistory error:', error.message);
      return { code: 500, msg: error.message || '获取历史失败', data: null };
    }
  }

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
      const result = await this.videoGenService.getById(id, userId);
      if (!result) {
        return { code: 404, msg: '记录不存在', data: null };
      }
      return { code: 200, msg: 'success', data: result };
    } catch (error: any) {
      console.error('[VideoGenController] getById error:', error.message);
      return { code: 500, msg: error.message || '获取详情失败', data: null };
    }
  }

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
      await this.videoGenService.delete(id, userId);
      return { code: 200, msg: '删除成功', data: null };
    } catch (error: any) {
      console.error('[VideoGenController] delete error:', error.message);
      return { code: 500, msg: error.message || '删除失败', data: null };
    }
  }
}
