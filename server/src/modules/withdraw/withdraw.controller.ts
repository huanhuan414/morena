import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WithdrawService } from './withdraw.service';

@Controller('withdraw')
export class WithdrawController {
  private readonly logger = new Logger(WithdrawController.name);

  constructor(private readonly withdrawService: WithdrawService) {}

  /**
   * 用户申请提现
   * POST /api/withdraw/apply
   */
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyWithdraw(@Body() body: any, @Headers('x-user-id') userId: string) {
    const { amount } = body;

    // 从请求头获取用户ID（如果没有则从body获取）
    const actualUserId = userId || body.userId;

    if (!actualUserId) {
      return { code: 400, msg: '缺少用户ID', data: null };
    }

    if (!amount || amount <= 0) {
      return { code: 400, msg: '请输入正确的提现金额', data: null };
    }

    try {
      const result = await this.withdrawService.createWithdrawRequest(actualUserId, Number(amount));
      return {
        code: 200,
        msg: '提现申请已提交',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`提现申请失败: ${error.message}`);
      return { code: 500, msg: error.message, data: null };
    }
  }

  /**
   * 自动提现（直接到账）
   * POST /api/withdraw/auto
   */
  @Post('auto')
  @HttpCode(HttpStatus.OK)
  async autoWithdraw(@Body() body: any, @Headers('x-user-id') userId: string) {
    const { amount } = body;

    const actualUserId = userId || body.userId;

    if (!actualUserId) {
      return { code: 400, msg: '缺少用户ID', data: null };
    }

    if (!amount || amount <= 0) {
      return { code: 400, msg: '请输入正确的提现金额', data: null };
    }

    try {
      const result = await this.withdrawService.autoWithdraw(actualUserId, Number(amount));
      return {
        code: 200,
        msg: result.message,
        data: {
          withdrawId: result.withdrawId,
          amount: result.amount,
          paymentNo: result.paymentNo,
        },
      };
    } catch (error: any) {
      this.logger.error(`自动提现失败: ${error.message}`);
      return { code: 500, msg: error.message, data: null };
    }
  }

  /**
   * 执行提现（管理员审核通过）
   * POST /api/withdraw/execute/:withdrawId
   */
  @Post('execute/:withdrawId')
  @HttpCode(HttpStatus.OK)
  async executeWithdraw(@Param('withdrawId') withdrawId: string) {
    try {
      // 检查 withdrawService 中是否存在对应方法，如果不存在需要实现或调用正确的方法
      // 这里假设应该调用 processWithdraw 或类似方法，请根据实际服务实现调整
      const result = await this.withdrawService.processWithdraw(withdrawId);
      return {
        code: 200,
        msg: result.message,
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`执行提现失败: ${error.message}`);
      return { code: 500, msg: error.message, data: null };
    }
  }

  /**
   * 获取用户提现记录
   * GET /api/withdraw/list?page=1&pageSize=20
   */
  @Get('list')
  async getWithdrawList(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Headers('x-user-id') userIdFromHeader?: string
  ) {
    const userId = userIdFromHeader;
    if (!userId) {
      return { code: 400, msg: '缺少用户ID', data: null };
    }

    try {
      const result = await this.withdrawService.getWithdrawList(userId, { page, pageSize });
      return {
        code: 200,
        msg: '查询成功',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`查询提现记录失败: ${error.message}`);
      return { code: 500, msg: error.message, data: null };
    }
  }
}