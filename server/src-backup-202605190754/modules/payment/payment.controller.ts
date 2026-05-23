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
  Inject,
} from '@nestjs/common'
import { Request, Response } from 'express';
import { WechatPayService } from './wechat-pay.service';
import { getMySQLClient } from '../../storage/database/mysql-client';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(@Inject(WechatPayService) private readonly wechatPayService: WechatPayService) {}

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
   * 微信支付回调通知（V2 XML格式）
   * POST /api/payment/wechat/notify
   *
   * V2回调通知发送XML格式的请求体，需要用raw body解析
   */
  @Post('wechat/notify')
  @HttpCode(HttpStatus.OK)
  async wechatNotify(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`收到微信支付回调通知`);

    try {
      // V2回调是XML格式，直接取原始body
      let rawBody = '';
      if (typeof req.body === 'string') {
        rawBody = req.body;
      } else if (req.body && typeof req.body === 'object') {
        // NestJS可能已解析为对象，需要还原为XML或直接传对象
        rawBody = JSON.stringify(req.body);
      }

      // 如果body为空，尝试从raw body读取
      if (!rawBody) {
        // 设置raw body中间件的情况
        rawBody = (req as any).rawBody || '';
      }

      const result = await this.wechatPayService.handlePaymentNotify(rawBody, req.headers);

      // V2回调需要返回XML格式的应答
      if (typeof result === 'string') {
        res.setHeader('Content-Type', 'application/xml');
        return res.send(result);
      } else {
        // result 是 { code, message } 对象
        if (result.code === 'SUCCESS') {
          res.setHeader('Content-Type', 'application/xml');
          return res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
        } else {
          res.setHeader('Content-Type', 'application/xml');
          return res.send(`<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${(result as any).message || '处理失败'}]]></return_msg></xml>`);
        }
      }
    } catch (error) {
      this.logger.error(`处理回调异常: ${error.message}`, error.stack);
      res.setHeader('Content-Type', 'application/xml');
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[内部错误]]></return_msg></xml>');
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
          const payOrder = orders[0];
          if (payOrder.orderType === 'order' || payOrder.order_type === 'order') {
            await this.wechatPayService['activateOrder'](payOrder, wechatResult.transaction_id || '');
          } else {
            await this.wechatPayService['activateSubscription'](payOrder);
          }
        }

        return { code: 200, msg: '同步成功，订单已支付', data: { tradeState } };
      }

      return { code: 200, msg: `订单状态: ${tradeState}`, data: wechatResult };
    } catch (error) {
      this.logger.error(`同步订单失败: ${error.message}`);
      return { code: 500, msg: '同步失败', data: null };
    }
  }

  /**
   * 手动上报发货信息（用于补单或调试）
   * POST /api/payment/shipping/upload
   */
  @Post('shipping/upload')
  @HttpCode(HttpStatus.OK)
  async uploadShipping(@Body() body: { outTradeNo: string }) {
    const { outTradeNo } = body;
    if (!outTradeNo) {
      return { code: 400, msg: '缺少outTradeNo参数', data: null };
    }

    try {
      const db = await getMySQLClient();
      const orders = await db.query(
        `SELECT * FROM payment_orders WHERE out_trade_no = ? AND status = 'paid'`,
        [outTradeNo],
      );

      if (!orders || orders.length === 0) {
        return { code: 404, msg: '未找到已支付订单', data: null };
      }

      const order = orders[0];
      const transactionId = order.transactionId || order.transaction_id;
      if (!transactionId) {
        return { code: 400, msg: '订单缺少微信支付单号', data: null };
      }

      // 调用 WechatPayService 的发货上报方法
      await this.wechatPayService['uploadShippingInfo'](transactionId, order);

      return { code: 200, msg: '发货信息上报已触发', data: { outTradeNo, transactionId } };
    } catch (error) {
      this.logger.error(`上报发货信息失败: ${error.message}`);
      return { code: 500, msg: '上报失败', data: null };
    }
  }
}
