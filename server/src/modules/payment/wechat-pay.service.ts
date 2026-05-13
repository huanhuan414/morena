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
  private privateKey: Buffer;

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

      if (privateKeyPath && fs.existsSync(path.resolve(privateKeyPath))) {
        this.privateKey = fs.readFileSync(path.resolve(privateKeyPath));
        this.logger.log('从文件加载商户私钥成功');
      } else {
        this.logger.error('商户私钥文件不存在，请检查 WECHAT_PAY_PRIVATE_KEY_PATH 配置');
        return;
      }

      let publicKey: Buffer;
      if (publicKeyPath && fs.existsSync(path.resolve(publicKeyPath))) {
        publicKey = fs.readFileSync(path.resolve(publicKeyPath));
        this.logger.log('从文件加载商户证书成功');
      } else {
        this.logger.error('商户证书文件不存在，请检查 WECHAT_PAY_PUBLIC_KEY_PATH 配置');
        return;
      }

      // 自动从证书中提取序列号
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
        privateKey: this.privateKey,
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
   * 
   * 微信支付V3小程序支付完整流程（参考官方文档）：
   * 1. 后端调用统一下单接口 POST /v3/pay/transactions/jsapi → 返回 prepay_id
   * 2. 后端用 prepay_id 生成签名参数（appId, timeStamp, nonceStr, package, signType, paySign）
   *    - 签名串: appId\ntimeStamp\nnonceStr\npackage\n
   *    - 签名方式: RSA-SHA256 + 商户私钥
   * 3. 前端调用 wx.requestPayment({timeStamp, nonceStr, package, signType, paySign})
   * 
   * wechatpay-node-v3 SDK 的 transactions_jsapi() 已自动完成1+2，
   * 但返回格式不确定，所以这里做3层兼容
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

    let result: any;
    try {
      result = await this.pay.transactions_jsapi({
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
    } catch (sdkError: any) {
      // SDK可能抛异常，但异常对象里可能包含成功的支付参数
      this.logger.warn(`SDK抛出异常，检查是否包含支付参数: ${sdkError.message?.substring(0, 200)}`);

      // 尝试从异常对象中提取支付参数
      const errObj = sdkError;
      if (errObj?.status === 200 && errObj?.data?.appId && errObj?.data?.paySign) {
        this.logger.log('从SDK异常对象中成功提取支付参数(result.data)');
        return this.buildPayResponse(orderId, outTradeNo, errObj.data);
      }
      if (errObj?.appId && errObj?.paySign) {
        this.logger.log('从SDK异常对象中成功提取支付参数(result顶层)');
        return this.buildPayResponse(orderId, outTradeNo, errObj);
      }

      // 真正的失败
      this.logger.error(`微信统一下单失败: ${sdkError.message}`);
      const db2 = getMySQLClient();
      await db2.query(
        `UPDATE payment_orders SET status = 'failed', metadata = JSON_SET(COALESCE(metadata, '{}'), '$.error', ?) WHERE id = ?`,
        [sdkError.message, orderId],
      );
      throw new Error(`微信下单失败: ${sdkError.message}`);
    }

    // 3. 正常返回 - 从result中提取支付参数
    this.logger.log(`微信统一下单返回: keys=[${Object.keys(result || {}).join(',')}], status=${result?.status}`);

    // 打印关键调试信息（不打印paySign完整值）
    const debugInfo = {
      status: result?.status,
      hasData: !!result?.data,
      dataKeys: result?.data ? Object.keys(result.data).join(',') : 'none',
      hasAppId: !!(result?.data?.appId || result?.appId),
      hasPaySign: !!(result?.data?.paySign || result?.paySign),
      hasPackage: !!(result?.data?.package || result?.package),
      hasPrepayId: !!(result?.prepay_id || result?.data?.prepay_id),
    };
    this.logger.log(`支付参数检测: ${JSON.stringify(debugInfo)}`);

    // 方式1: 支付参数在 result.data 中（wechatpay-node-v3 常见格式）
    if (result?.data?.appId && result?.data?.paySign && result?.data?.package) {
      this.logger.log('✅ 提取方式1: 支付参数在result.data中');
      return this.buildPayResponse(orderId, outTradeNo, result.data);
    }

    // 方式2: 支付参数在 result 顶层（部分SDK版本）
    if (result?.appId && result?.paySign && result?.package) {
      this.logger.log('✅ 提取方式2: 支付参数在result顶层');
      return this.buildPayResponse(orderId, outTradeNo, result);
    }

    // 方式3: 只返回 prepay_id，需要手动签名生成支付参数
    const prepayId = result?.prepay_id || result?.data?.prepay_id;
    if (prepayId) {
      this.logger.log(`✅ 提取方式3: 返回prepay_id=${prepayId}，手动生成签名`);
      const payParams = this.generateMiniProgramPayParams(prepayId);
      return {
        orderId,
        outTradeNo,
        prepayId,
        ...payParams,
      };
    }

    // 方式4: 无论如何尝试从result中找任何包含prepay_id的字段
    const resultStr = JSON.stringify(result);
    const prepayIdMatch = resultStr.match(/"prepay_id"\s*:\s*"([^"]+)"/);
    if (prepayIdMatch) {
      this.logger.log(`✅ 提取方式4: 从JSON字符串中正则匹配到prepay_id=${prepayIdMatch[1]}`);
      const payParams = this.generateMiniProgramPayParams(prepayIdMatch[1]);
      return {
        orderId,
        outTradeNo,
        prepayId: prepayIdMatch[1],
        ...payParams,
      };
    }

    // 全部失败
    this.logger.error(`❌ 无法从SDK响应中提取支付参数: ${JSON.stringify(result).substring(0, 500)}`);
    throw new Error(`微信下单响应格式异常: status=${result?.status}, keys=${Object.keys(result || {}).join(',')}`);
  }

  /**
   * 构建统一的支付参数返回格式
   */
  private buildPayResponse(orderId: string, outTradeNo: string, payData: any) {
    const packageStr = payData.package as string;
    const prepayId = packageStr?.replace('prepay_id=', '') || '';
    return {
      orderId,
      outTradeNo,
      prepayId,
      appId: payData.appId,
      timeStamp: payData.timeStamp,
      nonceStr: payData.nonceStr,
      packageValue: packageStr,
      signType: payData.signType || 'RSA',
      paySign: payData.paySign,
    };
  }

  /**
   * 生成小程序调起支付所需的参数（含签名）
   * 
   * 签名规则（微信支付V3官方文档）：
   * 签名串 = appId + "\n" + timeStamp + "\n" + nonceStr + "\n" + package + "\n"
   * 签名方式 = RSA-SHA256 + 商户私钥
   * 返回给前端的参数: { appId, timeStamp, nonceStr, package, signType: "RSA", paySign }
   */
  private generateMiniProgramPayParams(prepayId: string) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomUUID().replace(/-/g, '');
    const packageStr = `prepay_id=${prepayId}`;

    // 微信支付V3签名规则：appId\ntimeStamp\nnonceStr\npackage\n
    const signStr = `${this.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const paySign = sign.sign(this.privateKey, 'base64');

    this.logger.log(`手动生成支付参数 - appId: ${this.appId}, timeStamp: ${timeStamp}, prepayId: ${prepayId}`);

    return {
      appId: this.appId,
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

      // 上报微信发货信息管理（微信强制要求，不接入会导致jsapi has no permission）
      await this.uploadShippingInfo(transactionId, order);

      return { code: 'SUCCESS', message: '成功' };
    } catch (error) {
      this.logger.error(`处理支付回调失败: ${error.message}`, error.stack);
      return { code: 'FAIL', message: error.message };
    }
  }

  /**
   * 上报微信发货信息管理
   * 微信从2024年开始强制要求小程序接入发货管理，否则支付API被封禁（jsapi has no permission）
   * 文档: https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/industry/mini-order/shipping.html
   */
  private async uploadShippingInfo(transactionId: string, order: any) {
    try {
      // 获取小程序access_token
      const accessToken = await this.getMiniProgramAccessToken();
      if (!accessToken) {
        this.logger.warn('获取access_token失败，跳过发货信息上报');
        return;
      }

      // 虚拟商品直接发货（订阅类属于虚拟商品）
      const shippingData = {
        order_key: {
          order_number_type: 2, // 使用微信支付单号
          transaction_id: transactionId,
        },
        delivery_mode: 1, // 统一发货
        shipping_list: [
          {
            item_desc: 'Morena AI 订阅服务', // 商品描述
          },
        ],
        upload_time: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
        payer: {
          openid: order.openid || order.openId,
        },
      };

      const axios = require('axios');
      const response = await axios.post(
        `https://api.weixin.qq.com/wxa/sec/order/upload_shipping_info?access_token=${accessToken}`,
        shippingData,
        { timeout: 10000 },
      );

      if (response.data?.errcode === 0) {
        this.logger.log(`✅ 发货信息上报成功: transactionId=${transactionId}`);
      } else {
        this.logger.warn(`⚠️ 发货信息上报失败: errcode=${response.data?.errcode}, errmsg=${response.data?.errmsg}`);
      }
    } catch (error) {
      this.logger.warn(`发货信息上报异常(不影响支付): ${error.message}`);
    }
  }

  /**
   * 获取小程序access_token
   */
  private async getMiniProgramAccessToken(): Promise<string | null> {
    try {
      const appId = process.env.WX_APP_ID || this.appId;
      const appSecret = process.env.WX_APP_SECRET;

      if (!appId || !appSecret) {
        this.logger.warn('缺少WX_APP_ID或WX_APP_SECRET配置');
        return null;
      }

      const axios = require('axios');
      const response = await axios.get(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
        { timeout: 10000 },
      );

      if (response.data?.access_token) {
        return response.data.access_token;
      }

      this.logger.warn(`获取access_token失败: ${JSON.stringify(response.data)}`);
      return null;
    } catch (error) {
      this.logger.warn(`获取access_token异常: ${error.message}`);
      return null;
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
