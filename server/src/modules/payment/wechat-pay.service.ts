import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getMySQLClient } from '../../storage/database/mysql-client';

// wechatpay-node-v3 ESM/CJS 兼容
let Pay: any;
try {
  const mod = require('wechatpay-node-v3');
  Pay = mod.default || mod;
} catch (e) {
  Pay = null;
}

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private pay: any;
  private appId: string;
  private mchId: string;
  private apiV3Key: string;
  private serialNo: string;
  private notifyUrl: string;

  constructor() {
    this.appId = process.env.WECHAT_PAY_APPID || '';
    this.mchId = process.env.WECHAT_PAY_MCHID || '';
    this.apiV3Key = process.env.WECHAT_PAY_APIV3_KEY || '';
    this.serialNo = process.env.WECHAT_PAY_SERIAL_NO || '';
    this.notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL || '';
    this.initPay();
  }

  private initPay() {
    try {
      const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
      const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH;

      let privateKey: Buffer;
      let publicKey: Buffer;

      if (privateKeyPath && fs.existsSync(path.resolve(privateKeyPath))) {
        privateKey = fs.readFileSync(path.resolve(privateKeyPath));
        this.logger.log('从文件加载商户私钥成功');
      } else {
        this.logger.error('商户私钥文件不存在，请检查 WECHAT_PAY_PRIVATE_KEY_PATH 配置');
        return;
      }

      if (publicKeyPath && fs.existsSync(path.resolve(publicKeyPath))) {
        publicKey = fs.readFileSync(path.resolve(publicKeyPath));
        this.logger.log('从文件加载商户证书成功');
      } else {
        this.logger.error('商户证书文件不存在，请检查 WECHAT_PAY_PUBLIC_KEY_PATH 配置');
        return;
      }

      // 自动从证书中提取序列号（优先于环境变量配置）
      let serialNo = this.serialNo;
      if (!serialNo) {
        try {
          const x509 = new (crypto as any).X509Certificate(publicKey);
          serialNo = x509.serialNumber.toUpperCase().replace(/:/g, '');
          this.logger.log(`从证书自动提取序列号: ${serialNo}`);
        } catch (e) {
          this.logger.warn('无法从证书提取序列号，使用环境变量配置');
        }
      }

      this.pay = new Pay({
        appid: this.appId,
        mchid: this.mchId,
        serial_no: serialNo,
        publicKey: publicKey,
        privateKey: privateKey,
        key: this.apiV3Key,
      });

      this.logger.log(`微信支付初始化成功 - AppID: ${this.appId}, MchID: ${this.mchId}, SerialNo: ${serialNo}`);
    } catch (error) {
      this.logger.error(`微信支付初始化失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 供 SubscriptionController 调用的统一入口
   */
  async createOrder(params: {
    planId: string;
    userId: string;
    openid: string;
    amount: number;
    description: string;
  }) {
    return this.createMiniProgramOrder({
      ...params,
      orderType: 'subscription',
    });
  }

  /**
   * 创建小程序支付订单（JSAPI）
   */
  async createMiniProgramOrder(params: {
    userId: string;
    openid: string;
    planId: string;
    description: string;
    amount: number;
    orderType: string;
  }) {
    if (!this.pay) {
      throw new Error('微信支付未初始化');
    }

    const { userId, openid, planId, description, amount, orderType } = params;
    const outTradeNo = `MRL${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 1. 创建本地支付订单
    const orderId = crypto.randomUUID();
    const db = getMySQLClient();
    await db.query(
      `INSERT INTO payment_orders (id, out_trade_no, plan_id, user_id, openid, order_type, amount, currency, payment_method, status, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CNY', 'wechat', 'pending', ?, NOW(), NOW())`,
      [
        orderId,
        outTradeNo,
        planId,
        userId,
        openid,
        orderType,
        amount,
        JSON.stringify({ planId, description }),
      ],
    );

    this.logger.log(`创建本地支付订单: ${orderId}, outTradeNo: ${outTradeNo}, 金额: ${amount}元`);

    // 2. 调用微信统一下单API
    const amountInFen = Math.round(amount * 100);
    try {
      const result: any = await this.pay.transactions_jsapi({
        appid: this.appId,
        mchid: this.mchId,
        description,
        out_trade_no: outTradeNo,
        notify_url: this.notifyUrl,
        amount: {
          total: amountInFen,
          currency: 'CNY',
        },
        payer: {
          openid,
        },
      });

      // wechatpay-node-v3 SDK 成功时直接返回支付参数在 result 顶层：
      // { status: 200, appId, timeStamp, nonceStr, package, signType, paySign }
      // 失败时: { status: 400/500, errRaw: {...} }
      this.logger.log(`微信统一下单响应: status=${result.status}, appId=${result.appId ? '有' : '无'}, paySign=${result.paySign ? '有' : '无'}`);

      // 成功：SDK已自动签名，直接返回完整支付参数
      if (result.status === 200 && result.appId && result.paySign && result.package) {
        this.logger.log('微信统一下单成功，SDK已自动生成支付参数');
        const packageStr = result.package as string; // 格式: "prepay_id=wx..."
        const extractedPrepayId = packageStr.replace('prepay_id=', '');
        return {
          orderId,
          outTradeNo,
          prepayId: extractedPrepayId,
          appId: result.appId,
          timeStamp: result.timeStamp,
          nonceStr: result.nonceStr,
          packageValue: packageStr,
          signType: result.signType,
          paySign: result.paySign,
        };
      }

      // 只返回 prepay_id 的情况（较老版本SDK）
      const prepayId = result.prepay_id || result.data?.prepay_id;
      if (prepayId) {
        const payParams = this.generateMiniProgramPayParams(prepayId);
        return {
          orderId,
          outTradeNo,
          prepayId,
          ...payParams,
        };
      }

      // 都不匹配，抛出详细错误
      this.logger.error(`未识别的SDK响应格式: status=${result.status}, keys=${Object.keys(result).join(',')}, body=${JSON.stringify(result).substring(0, 500)}`);
      throw new Error(`微信下单响应格式异常，无法提取支付参数`);
    } catch (error) {
      this.logger.error(`微信统一下单失败: ${error.message}`, error.stack);
      const db2 = getMySQLClient();
      await db2.query(
        `UPDATE payment_orders SET status = 'failed', metadata = JSON_SET(COALESCE(metadata, '{}'), '$.error', ?) WHERE id = ?`,
        [error.message, orderId],
      );
      throw error;
    }
  }

  /**
   * 生成小程序调起支付所需的参数（含签名）
   */
  private generateMiniProgramPayParams(prepayId: string) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomUUID().replace(/-/g, '');
    const packageStr = `prepay_id=${prepayId}`;

    // 微信支付V3签名规则：appId\ntimeStamp\nnonceStr\npackage\n
    const signStr = `${this.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;

    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
    const privateKey = fs.readFileSync(path.resolve(privateKeyPath));
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const paySign = sign.sign(privateKey, 'base64');

    this.logger.log(`生成支付参数 - timeStamp: ${timeStamp}, nonceStr: ${nonceStr}, prepay_id: ${prepayId}`);

    return {
      timeStamp,
      nonceStr,
      packageValue: packageStr,
      signType: 'RSA',
      paySign,
    };
  }

  /**
   * 验证并处理支付回调通知
   */
  async handlePaymentNotify(body: any, headers: any) {
    this.logger.log(`收到支付回调通知`);

    try {
      const resource = body?.resource;
      if (!resource) {
        this.logger.error('回调通知缺少resource字段');
        return { code: 'FAIL', message: '通知格式错误' };
      }

      const decryptedData = this.decryptResource(resource);
      this.logger.log(`解密后的回调数据: ${JSON.stringify(decryptedData)}`);

      if (!decryptedData) {
        this.logger.error('回调数据解密失败');
        return { code: 'FAIL', message: '解密失败' };
      }

      const outTradeNo = decryptedData.out_trade_no;
      const transactionId = decryptedData.transaction_id;
      const tradeState = decryptedData.trade_state;
      const payAmount = decryptedData.amount;

      if (tradeState !== 'SUCCESS') {
        this.logger.warn(`交易状态非成功: ${tradeState}, outTradeNo: ${outTradeNo}`);
        return { code: 'SUCCESS', message: '已接收' };
      }

      const db = getMySQLClient();
      const orders = await db.query(
        `SELECT * FROM payment_orders WHERE out_trade_no = ?`,
        [outTradeNo],
      );

      if (!orders || orders.length === 0) {
        this.logger.error(`未找到订单: outTradeNo=${outTradeNo}`);
        return { code: 'FAIL', message: '订单不存在' };
      }

      const order = orders[0];

      if (order.status === 'paid') {
        this.logger.log(`订单已处理过: ${outTradeNo}`);
        return { code: 'SUCCESS', message: '已处理' };
      }

      await db.query(
        `UPDATE payment_orders SET status = 'paid', transaction_id = ?, paid_at = NOW(), metadata = JSON_SET(COALESCE(metadata, '{}'), '$.wechatTransactionId', ?, '$.paidAmount', ?) WHERE out_trade_no = ?`,
        [transactionId, transactionId, payAmount?.total ? payAmount.total / 100 : order.amount, outTradeNo],
      );

      this.logger.log(`订单支付成功: outTradeNo=${outTradeNo}, transactionId=${transactionId}`);

      await this.activateSubscription(order);

      return { code: 'SUCCESS', message: '成功' };
    } catch (error) {
      this.logger.error(`处理支付回调失败: ${error.message}`, error.stack);
      return { code: 'FAIL', message: error.message };
    }
  }

  /**
   * 解密V3回调通知中的resource字段
   */
  private decryptResource(resource: any): any {
    try {
      const { nonce, associated_data, ciphertext } = resource;
      const result: string = this.pay.decipher_gcm(
        ciphertext,
        this.apiV3Key,
        nonce,
        associated_data,
      );
      return JSON.parse(result);
    } catch (error) {
      this.logger.error(`解密resource失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 激活用户订阅
   */
  private async activateSubscription(order: any) {
    const db = getMySQLClient();
    const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : (order.metadata || {});
    const planId = metadata.planId || order.planId;

    this.logger.log(`激活订阅: userId=${order.userId}, planId=${planId}`);

    const plans = await db.query(
      `SELECT * FROM subscription_plans WHERE id = ?`,
      [planId],
    );

    if (!plans || plans.length === 0) {
      this.logger.error(`订阅计划不存在: ${planId}`);
      return;
    }

    const plan = plans[0];
    const durationDays = plan.durationDays || plan.duration_days || 30;
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const maxAvatars = plan.maxAvatars || plan.max_avatars || 1;
    const canReceiveOrders = plan.canReceiveOrders || plan.can_receive_orders || 0;

    const existing = await db.query(
      `SELECT * FROM user_subscriptions WHERE user_id = ? AND status = 'active' ORDER BY end_date DESC LIMIT 1`,
      [order.userId],
    );

    if (existing && existing.length > 0) {
      const currentEnd = new Date(existing[0].endDate || existing[0].end_date);
      const newEndDate = currentEnd > now
        ? new Date(currentEnd.getTime() + durationDays * 24 * 60 * 60 * 1000)
        : endDate;

      await db.query(
        `UPDATE user_subscriptions SET plan_id = ?, end_date = ?, max_avatars = ?, can_receive_orders = ?, updated_at = NOW() WHERE id = ?`,
        [planId, newEndDate, maxAvatars, canReceiveOrders, existing[0].id],
      );
      this.logger.log(`续订成功: userId=${order.userId}, 新到期日=${newEndDate}`);
    } else {
      await db.query(
        `INSERT INTO user_subscriptions (id, user_id, plan_id, status, start_date, end_date, max_avatars, can_receive_orders, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          order.userId,
          planId,
          now,
          endDate,
          maxAvatars,
          canReceiveOrders,
        ],
      );
      this.logger.log(`新订阅激活: userId=${order.userId}, planId=${planId}, 到期日=${endDate}`);
    }
  }

  /**
   * 查询订单支付状态
   */
  async queryOrderStatus(orderId: string) {
    const db = getMySQLClient();
    const orders = await db.query(
      `SELECT * FROM payment_orders WHERE id = ?`,
      [orderId],
    );
    return orders?.[0] || null;
  }

  /**
   * 获取用户的支付订单列表
   */
  async getUserOrders(userId: string) {
    const db = getMySQLClient();
    return await db.query(
      `SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );
  }

  /**
   * 主动查询微信订单状态（用于补单）
   */
  async queryWechatOrderStatus(outTradeNo: string) {
    if (!this.pay) {
      throw new Error('微信支付未初始化');
    }
    try {
      const result: any = await this.pay.query({
        out_trade_no: outTradeNo,
      });
      this.logger.log(`微信订单查询结果: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`微信订单查询失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 关闭超时未支付订单
   */
  async closeOrder(outTradeNo: string) {
    if (!this.pay) {
      throw new Error('微信支付未初始化');
    }
    try {
      const result: any = await this.pay.close(outTradeNo);
      this.logger.log(`关闭订单结果: ${JSON.stringify(result)}`);

      const db = getMySQLClient();
      await db.query(
        `UPDATE payment_orders SET status = 'closed', updated_at = NOW() WHERE out_trade_no = ? AND status = 'pending'`,
        [outTradeNo],
      );
      return result;
    } catch (error) {
      this.logger.error(`关闭订单失败: ${error.message}`);
      throw error;
    }
  }
}
