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
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common'
import { Request, Response } from 'express';
import { WechatPayService } from './wechat-pay.service';
import { getMySQLClient } from '../../storage/database/mysql-client';
import { assertResourceOwner, requireAuthenticatedUserId, requireMatchedAuthenticatedUserId, rethrowAuthError } from '../../common/auth-user.util';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(@Inject(WechatPayService) private readonly wechatPayService: WechatPayService) {}

  private assertPaymentOrderOwner(order: any, userId: string) {
    assertResourceOwner(userId, order?.userId || order?.user_id, '无权访问该支付订单');
  }

  private async getPaymentOrderByOutTradeNo(outTradeNo: string) {
    const db = await getMySQLClient();
    const orders = await db.query(
      `SELECT * FROM payment_orders WHERE out_trade_no = ? LIMIT 1`,
      [outTradeNo],
    );
    return orders?.[0] || null;
  }

  /**
   * 创建微信支付订单
   * POST /api/payment/wechat/create
   */
  @Post('wechat/create')
  @HttpCode(HttpStatus.OK)
  async createPayment(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: any,
  ) {
    const userId = requireMatchedAuthenticatedUserId(headers, body?.userId);
    const { openid, planId } = body;
    this.logger.log(`创建支付请求 - userId: ${userId}, planId: ${planId}, openid: ${openid ? '***' : 'missing'}`);

    if (!userId || !planId) {
      throw new BadRequestException({ msg: '缺少必要参数: userId, planId', data: null })
    }

    if (!openid) {
      throw new BadRequestException({ msg: '缺少openid，请先登录小程序获取openid', data: null })
    }

    try {
      // 查询订阅计划
      const db = await getMySQLClient();
      const plans = await db.query(
        `SELECT * FROM subscription_plans WHERE id = ?`,
        [planId],
      );

      if (!plans || plans.length === 0) {
        throw new NotFoundException({ msg: '订阅计划不存在', data: null })
      }

      const plan = plans[0];

      if (plan.price === 0) {
        throw new BadRequestException({ msg: '免费计划无需支付', data: null })
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
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: `创建订单失败: ${error.message}`, data: null })
    }
  }

  /**
   * 微信支付回调通知（V2 XML格式）
   * POST /api/payment/wechat/notify
   *
   * V2回调通知发送XML格式的请求体，需要用raw body解析
   * 匿名边界：该接口仅接受微信支付平台服务端回调，保留匿名访问以便第三方通知落库，安全校验由签名/回调体校验承担。
   */
  @Post('wechat/notify')
  @HttpCode(HttpStatus.OK)
  async wechatNotify(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`收到微信支付回调通知`);

    try {
      // V2回调是XML格式：必须拿到未被 JSON 化/对象化 的原始 XML 字符串
      let rawBody = '';
      const anyReq = req as any;

      if (Buffer.isBuffer(anyReq.rawBody)) {
        rawBody = anyReq.rawBody.toString('utf8');
      } else if (typeof anyReq.rawBody === 'string') {
        rawBody = anyReq.rawBody;
      } else if (typeof req.body === 'string') {
        rawBody = req.body;
      } else if (Buffer.isBuffer(req.body as any)) {
        rawBody = (req.body as any).toString('utf8');
      }

      if (!rawBody) {
        this.logger.warn(`微信回调 body 为空或非 XML 字符串，content-type=${req.headers['content-type'] || ''}`);
        res.setHeader('Content-Type', 'application/xml');
        return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[EMPTY_BODY]]></return_msg></xml>');
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

  @Post('mock/pay-success/:outTradeNo')
  @HttpCode(HttpStatus.OK)
  async mockPaySuccess(
    @Param('outTradeNo') outTradeNo: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    if (process.env.NODE_ENV === 'production' || process.env.WECHAT_PAY_MOCK !== '1') {
      throw new NotFoundException({ msg: 'Not Found', data: null })
    }
    const userId = requireAuthenticatedUserId(headers)
    const existingOrder = await this.getPaymentOrderByOutTradeNo(outTradeNo)
    if (existingOrder) {
      this.assertPaymentOrderOwner(existingOrder, userId)
    }
    try {
      const result = await this.wechatPayService.mockPaySuccess(outTradeNo, userId)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      this.logger.error(`mockPaySuccess失败: ${error.message}`);
      throw new InternalServerErrorException({ msg: error.message || '操作失败', data: null })
    }
  }

  /**
   * 查询订单支付状态
   * GET /api/payment/order/:orderId/status
   */
  @Get('order/:orderId/status')
  async getOrderStatus(
    @Param('orderId') orderId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    try {
      const userId = requireAuthenticatedUserId(headers);
      const order = await this.wechatPayService.queryOrderStatus(orderId);

      if (!order) {
        throw new NotFoundException({ msg: '订单不存在', data: null })
      }

      this.assertPaymentOrderOwner(order, userId);

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
      rethrowAuthError(error);
      this.logger.error(`查询订单失败: ${error.message}`);
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '查询失败', data: null })
    }
  }

  /**
   * 获取用户支付订单列表
   * GET /api/payment/orders?userId=xxx
   */
  @Get('orders')
  async getUserOrders(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('userId') userId?: string,
  ) {
    const authenticatedUserId = requireMatchedAuthenticatedUserId(headers, userId);
    try {
      const orders = await this.wechatPayService.getUserOrders(authenticatedUserId);
      return { code: 200, msg: '查询成功', data: orders };
    } catch (error) {
      this.logger.error(`查询订单列表失败: ${error.message}`);
      throw new InternalServerErrorException({ msg: '查询失败', data: null })
    }
  }

  /**
   * 获取订阅计划列表
   * GET /api/payment/plans
   * 匿名边界：公开只读套餐目录，允许未登录用户在支付前浏览，不暴露用户私有订阅状态。
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
      throw new InternalServerErrorException({ msg: '查询失败', data: null })
    }
  }

  /**
   * 获取用户当前订阅信息
   * GET /api/payment/subscription?userId=xxx
   */
  @Get('subscription')
  async getSubscription(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('userId') userId?: string,
  ) {
    const authenticatedUserId = requireMatchedAuthenticatedUserId(headers, userId);
    try {
      const db = await getMySQLClient();
      const subs = await db.query(
        `SELECT us.*, sp.name as plan_name, sp.max_avatars, sp.can_receive_orders 
         FROM user_subscriptions us 
         LEFT JOIN subscription_plans sp ON us.plan_id = sp.id 
         WHERE us.user_id = ? AND us.status = 'active' 
         ORDER BY us.end_date DESC LIMIT 1`,
        [authenticatedUserId],
      );

      if (!subs || subs.length === 0) {
        return { code: 200, msg: '无活跃订阅', data: { status: 'free', planId: 'plan_free' } };
      }

      return { code: 200, msg: '查询成功', data: subs[0] };
    } catch (error) {
      this.logger.error(`查询订阅失败: ${error.message}`);
      throw new InternalServerErrorException({ msg: '查询失败', data: null })
    }
  }

  /**
   * 主动查询微信订单并同步状态（补单接口）
   * POST /api/payment/sync/:outTradeNo
   */
  @Post('sync/:outTradeNo')
  @HttpCode(HttpStatus.OK)
  async syncOrderStatus(
    @Param('outTradeNo') outTradeNo: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    try {
      const userId = requireAuthenticatedUserId(headers);
      const existingOrder = await this.getPaymentOrderByOutTradeNo(outTradeNo);
      if (existingOrder) {
        this.assertPaymentOrderOwner(existingOrder, userId);
      }
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
      rethrowAuthError(error);
      this.logger.error(`同步订单失败: ${error.message}`);
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '同步失败', data: null })
    }
  }

  /**
   * 手动上报发货信息（用于补单或调试）
   * POST /api/payment/shipping/upload
   */
  @Post('shipping/upload')
  @HttpCode(HttpStatus.OK)
  async uploadShipping(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { outTradeNo: string },
  ) {
    requireAuthenticatedUserId(headers);
    const { outTradeNo } = body;
    if (!outTradeNo) {
      throw new BadRequestException({ msg: '缺少outTradeNo参数', data: null })
    }

    try {
      const db = await getMySQLClient();
      const orders = await db.query(
        `SELECT * FROM payment_orders WHERE out_trade_no = ? AND status = 'paid'`,
        [outTradeNo],
      );

      if (!orders || orders.length === 0) {
        throw new NotFoundException({ msg: '未找到已支付订单', data: null })
      }

      const order = orders[0];
      this.assertPaymentOrderOwner(order, requireAuthenticatedUserId(headers));
      const transactionId = order.transactionId || order.transaction_id;
      if (!transactionId) {
        throw new BadRequestException({ msg: '订单缺少微信支付单号', data: null })
      }

      // 调用 WechatPayService 的发货上报方法
      await this.wechatPayService['uploadShippingInfo'](transactionId, order);

      return { code: 200, msg: '发货信息上报已触发', data: { outTradeNo, transactionId } };
    } catch (error) {
      rethrowAuthError(error);
      this.logger.error(`上报发货信息失败: ${error.message}`);
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: '上报失败', data: null })
    }
  }
}
