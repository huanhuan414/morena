import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WechatPayService } from './wechat-pay.service';
import { getMySQLClient } from '../../storage/database/mysql-client';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly wechatPayService: WechatPayService) {}

  /**
   * 创建微信支付订单
   * POST /api/payment/wechat/create
   */
  @Post('wechat/create')
  @HttpCode(HttpStatus.OK)
  async createPayment(@Body() body: any) {
    const { userId, openid, planId } = body;
    this.logger.log(`创建支付请求 - userId: ${userId}, planId: ${planId}, openid: ${openid ? '***' : 'missing'}`);

    if (!userId || !planId) {
      return { code: 400, msg: '缺少必要参数: userId, planId', data: null };
    }

    if (!openid) {
      return { code: 400, msg: '缺少openid，请先登录小程序获取openid', data: null };
    }

    try {
      // 查询订阅计划
      const db = await getMySQLClient();
      const plans = await db.query(
        `SELECT * FROM subscription_plans WHERE plan_id = ?`,
        [planId],
      );

      if (!plans || plans.length === 0) {
        return { code: 404, msg: '订阅计划不存在', data: null };
      }

      const plan = plans[0];

      if (plan.price === 0) {
        return { code: 400, msg: '免费计划无需支付', data: null };
      }

      // 创建支付订单
      const result = await this.wechatPayService.createMiniProgramOrder({
        userId,
        openid,
        planId,
        description: `${plan.name} - Morena AI订阅`,
        amount: Number(plan.price),
        orderType: 'subscription',
      });

      this.logger.log(`支付订单创建成功: orderId=${result.orderId}`);

      return {
        code: 200,
        msg: '订单创建成功',
        data: {
          orderId: result.orderId,
          outTradeNo: result.outTradeNo,
          // 小程序调起支付所需的参数
          timeStamp: result.timeStamp,
          nonceStr: result.nonceStr,
          packageValue: result.packageValue,
          signType: result.signType,
          paySign: result.paySign,
        },
      };
    } catch (error) {
      this.logger.error(`创建支付订单失败: ${error.message}`, error.stack);
      return { code: 500, msg: `创建订单失败: ${error.message}`, data: null };
    }
  }

  /**
   * 微信支付回调通知
   * POST /api/payment/wechat/notify
   */
  @Post('wechat/notify')
  @HttpCode(HttpStatus.OK)
  async wechatNotify(@Body() body: any, @Headers() headers: any, @Req() req: Request, @Res() res: Response) {
    this.logger.log(`收到微信支付回调通知`);

    try {
      const result = await this.wechatPayService.handlePaymentNotify(body, headers);

      // 微信支付回调需要返回JSON格式的应答
      if (result.code === 'SUCCESS') {
        return res.json({ code: 'SUCCESS', message: '成功' });
      } else {
        return res.json({ code: 'FAIL', message: result.message || '处理失败' });
      }
    } catch (error) {
      this.logger.error(`处理回调异常: ${error.message}`, error.stack);
      return res.json({ code: 'FAIL', message: '内部错误' });
    }
  }

  /**
   * 查询订单支付状态
   * GET /api/payment/order/:orderId/status
   */
  @Get('order/:orderId/status')
  async getOrderStatus(@Param('orderId') orderId: string) {
    try {
      const order = await this.wechatPayService.queryOrderStatus(orderId);

      if (!order) {
        return { code: 404, msg: '订单不存在', data: null };
      }

      return {
        code: 200,
        msg: '查询成功',
        data: {
          orderId: order.id,
          outTradeNo: order.outTradeNo,
          status: order.status,
          amount: order.amount,
          planId: order.planId,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`查询订单失败: ${error.message}`);
      return { code: 500, msg: '查询失败', data: null };
    }
  }

  /**
   * 获取用户支付订单列表
   * GET /api/payment/orders?userId=xxx
   */
  @Get('orders')
  async getUserOrders(@Query('userId') userId: string) {
    if (!userId) {
      return { code: 400, msg: '缺少userId参数', data: null };
    }

    try {
      const orders = await this.wechatPayService.getUserOrders(userId);
      return { code: 200, msg: '查询成功', data: orders };
    } catch (error) {
      this.logger.error(`查询订单列表失败: ${error.message}`);
      return { code: 500, msg: '查询失败', data: null };
    }
  }

  /**
   * 获取订阅计划列表
   * GET /api/payment/plans
   */
  @Get('plans')
  async getPlans() {
    try {
      const db = await getMySQLClient();
      const plans = await db.query(
        `SELECT * FROM subscription_plans ORDER BY price ASC`,
      );
      return { code: 200, msg: '查询成功', data: plans };
    } catch (error) {
      this.logger.error(`查询订阅计划失败: ${error.message}`);
      return { code: 500, msg: '查询失败', data: null };
    }
  }

  /**
   * 获取用户当前订阅信息
   * GET /api/payment/subscription?userId=xxx
   */
  @Get('subscription')
  async getSubscription(@Query('userId') userId: string) {
    if (!userId) {
      return { code: 400, msg: '缺少userId参数', data: null };
    }

    try {
      const db = await getMySQLClient();
      const subs = await db.query(
        `SELECT us.*, sp.name as plan_name, sp.max_avatars, sp.can_receive_orders 
         FROM user_subscriptions us 
         LEFT JOIN subscription_plans sp ON us.plan_id = sp.plan_id 
         WHERE us.user_id = ? AND us.status = 'active' 
         ORDER BY us.end_date DESC LIMIT 1`,
        [userId],
      );

      if (!subs || subs.length === 0) {
        return { code: 200, msg: '无活跃订阅', data: { status: 'free', planId: 'plan_free' } };
      }

      return { code: 200, msg: '查询成功', data: subs[0] };
    } catch (error) {
      this.logger.error(`查询订阅失败: ${error.message}`);
      return { code: 500, msg: '查询失败', data: null };
    }
  }

  /**
   * 主动查询微信订单并同步状态（补单接口）
   * POST /api/payment/sync/:outTradeNo
   */
  @Post('sync/:outTradeNo')
  @HttpCode(HttpStatus.OK)
  async syncOrderStatus(@Param('outTradeNo') outTradeNo: string) {
    try {
      const wechatResult = await this.wechatPayService.queryWechatOrderStatus(outTradeNo);
      const tradeState = wechatResult?.trade_state;

      if (tradeState === 'SUCCESS') {
        // 触发与回调一样的处理逻辑
        const mockNotify = {
          resource: wechatResult.resource || null,
        };

        // 如果有resource，走正常解密流程
        // 否则直接更新状态
        const db = await getMySQLClient();
        await db.query(
          `UPDATE payment_orders SET status = 'paid', transaction_id = ?, paid_at = NOW() WHERE out_trade_no = ? AND status = 'pending'`,
          [wechatResult.transaction_id || '', outTradeNo],
        );

        const orders = await db.query(`SELECT * FROM payment_orders WHERE out_trade_no = ?`, [outTradeNo]);
        if (orders && orders.length > 0) {
          await this.wechatPayService['activateSubscription'](orders[0]);
        }

        return { code: 200, msg: '同步成功，订单已支付', data: { tradeState } };
      }

      return { code: 200, msg: `订单状态: ${tradeState}`, data: wechatResult };
    } catch (error) {
      this.logger.error(`同步订单失败: ${error.message}`);
      return { code: 500, msg: '同步失败', data: null };
    }
  }
}
