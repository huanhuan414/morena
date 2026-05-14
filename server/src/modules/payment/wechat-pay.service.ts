import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getMySQLClient } from '../../storage/database/mysql-client';

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private appId: string;
  private mchId: string;
  private apiKeyV2: string; // 商户APIv2密钥
  private notifyUrl: string;
  private privateKey: Buffer;

  constructor() {
    this.appId = process.env.WECHAT_PAY_APPID || '';
    this.mchId = process.env.WECHAT_PAY_MCHID || '';
    this.apiKeyV2 = process.env.WECHAT_PAY_APIV2_KEY || process.env.WECHAT_PAY_APIV3_KEY || '';
    this.notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL || '';

    // 加载商户私钥（用于生成前端支付签名）
    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
    if (privateKeyPath && fs.existsSync(path.resolve(privateKeyPath))) {
      this.privateKey = fs.readFileSync(path.resolve(privateKeyPath));
      this.logger.log('从文件加载商户私钥成功');
    } else {
      this.logger.error('商户私钥文件不存在，请检查 WECHAT_PAY_PRIVATE_KEY_PATH 配置');
    }

    this.logger.log(`微信支付(V2)初始化 - AppID: ${this.appId}, MchID: ${this.mchId}`);
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
   * 创建小程序支付订单（JSAPI V2）
   *
   * 微信支付V2小程序支付流程：
   * 1. 后端调用统一下单接口 POST https://api.mch.weixin.qq.com/pay/unifiedorder → 返回 prepay_id
   * 2. 后端用 prepay_id 生成签名参数（appId, timeStamp, nonceStr, package, signType, paySign）
   * 3. 前端调用 wx.requestPayment({timeStamp, nonceStr, package, signType, paySign})
   */
  async createMiniProgramOrder(params: {
    userId: string;
    openid: string;
    planId: string;
    description: string;
    amount: number;
    orderType: string;
  }) {
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

    // 2. 调用微信V2统一下单API
    const amountInFen = Math.round(amount * 100);

    const unifiedOrderParams: Record<string, string> = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
      body: description,
      out_trade_no: outTradeNo,
      total_fee: String(amountInFen),
      spbill_create_ip: '127.0.0.1',
      notify_url: this.notifyUrl,
      trade_type: 'JSAPI',
      openid: openid,
    };

    // V2签名：MD5签名
    unifiedOrderParams.sign = this.signMd5(unifiedOrderParams);

    // 将参数转为XML
    const xmlBody = this.buildXml(unifiedOrderParams);

    this.logger.log(`调用微信V2统一下单: outTradeNo=${outTradeNo}, amount=${amountInFen}分`);

    let prepayId: string;
    try {
      const axios = require('axios');
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/pay/unifiedorder',
        xmlBody,
        {
          headers: { 'Content-Type': 'application/xml' },
          timeout: 15000,
        },
      );

      // 解析XML响应
      const result = this.parseXml(response.data);
      const returnCode = result.return_code;
      const resultCode = result.result_code;

      this.logger.log(`微信V2统一下单返回: return_code=${returnCode}, result_code=${resultCode}`);

      if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
        const errMsg = result.err_code_des || result.return_msg || '下单失败';
        const errCode = result.err_code || '';
        this.logger.error(`微信统一下单失败: err_code=${errCode}, err_msg=${errMsg}`);

        // 更新本地订单状态
        const db2 = getMySQLClient();
        await db2.query(
          `UPDATE payment_orders SET status = 'failed', metadata = JSON_SET(COALESCE(metadata, '{}'), '$.error', ?) WHERE id = ?`,
          [`${errCode}: ${errMsg}`, orderId],
        );

        throw new Error(`微信下单失败: ${errMsg}(${errCode})`);
      }

      prepayId = result.prepay_id;
      this.logger.log(`✅ 微信统一下单成功: prepay_id=${prepayId}`);
    } catch (error) {
      if (error.message.startsWith('微信下单失败:')) {
        throw error;
      }
      this.logger.error(`微信统一下单请求异常: ${error.message}`);

      const db2 = getMySQLClient();
      await db2.query(
        `UPDATE payment_orders SET status = 'failed', metadata = JSON_SET(COALESCE(metadata, '{}'), '$.error', ?) WHERE id = ?`,
        [error.message, orderId],
      );

      throw new Error(`微信下单请求失败: ${error.message}`);
    }

    // 3. 用prepay_id生成小程序支付参数
    const payParams = this.generateMiniProgramPayParams(prepayId);

    return {
      orderId,
      outTradeNo,
      prepayId,
      ...payParams,
    };
  }

  /**
   * 生成小程序调起支付所需的参数（含签名）
   *
   * V2 MD5签名规则：
   * 参与签名的字段：appId, nonceStr, package, signType, timeStamp
   * 签名方式：将所有非空参数按key的ASCII码排序，拼接成key=value&形式，最后拼接&key=APIv2密钥，MD5后转大写
   * signType = MD5
   *
   * 参考: https://pay.weixin.qq.com/wiki/doc/api/wxa/wxa_sl_api.php?chapter=7_7&index=5
   */
  private generateMiniProgramPayParams(prepayId: string) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomUUID().replace(/-/g, '');
    const packageStr = `prepay_id=${prepayId}`;

    // 小程序调起支付签名（V2 MD5方式）
    const signParams: Record<string, string> = {
      appId: this.appId,
      nonceStr,
      package: packageStr,
      signType: 'MD5',
      timeStamp,
    };
    const paySign = this.signMd5(signParams);

    this.logger.log(`生成支付参数 - appId: ${this.appId}, timeStamp: ${timeStamp}, prepayId: ${prepayId}, signType: MD5`);

    return {
      appId: this.appId,
      timeStamp,
      nonceStr,
      packageValue: packageStr,
      signType: 'MD5',
      paySign,
    };
  }

  /**
   * V2 MD5签名
   * 规则：将所有非空参数按key的ASCII码排序，拼接成key=value&形式，最后拼接&key=API密钥，MD5后转大写
   */
  private signMd5(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort();
    const stringA = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const stringSignTemp = `${stringA}&key=${this.apiKeyV2}`;
    return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * 将对象转为微信支付V2所需的XML格式
   */
  private buildXml(params: Record<string, string>): string {
    const xmlParts = Object.entries(params).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`);
    return `<xml>${xmlParts.join('')}</xml>`;
  }

  /**
   * 解析微信支付V2返回的XML
   */
  private parseXml(xml: string): Record<string, string> {
    const result: Record<string, string> = {};
    // 简单XML解析（微信返回格式固定，不需要完整XML库）
    const regex = /<(\w+)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/\1>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      if (match[1] !== 'xml') {
        result[match[1]] = match[2];
      }
    }
    return result;
  }

  /**
   * 验证V2回调通知签名
   */
  private verifyNotifySign(params: Record<string, string>): boolean {
    const sign = params.sign;
    if (!sign) return false;
    const paramsWithoutSign = { ...params };
    delete paramsWithoutSign.sign;
    delete paramsWithoutSign.sign_type;
    const expectedSign = this.signMd5(paramsWithoutSign);
    return sign === expectedSign;
  }

  /**
   * 验证并处理支付回调通知
   */
  async handlePaymentNotify(body: string, headers: any) {
    this.logger.log(`收到支付回调通知`);

    try {
      // V2回调通知是XML格式
      const result = this.parseXml(body);

      // 验证签名
      if (!this.verifyNotifySign(result)) {
        this.logger.error('回调通知签名验证失败');
        return { code: 'FAIL', message: '签名验证失败' };
      }

      const returnCode = result.return_code;
      const resultCode = result.result_code;
      const outTradeNo = result.out_trade_no;
      const transactionId = result.transaction_id;

      if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
        this.logger.warn(`交易状态非成功: return_code=${returnCode}, result_code=${resultCode}`);
        // 仍返回SUCCESS给微信，避免重复通知
        return this.buildNotifySuccessXml();
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
        return this.buildNotifySuccessXml();
      }

      // 获取支付金额（分）
      const totalFee = Number(result.total_fee || 0);

      await db.query(
        `UPDATE payment_orders SET status = 'paid', transaction_id = ?, paid_at = NOW(), metadata = JSON_SET(COALESCE(metadata, '{}'), '$.wechatTransactionId', ?, '$.paidAmount', ?) WHERE out_trade_no = ?`,
        [transactionId, transactionId, totalFee / 100, outTradeNo],
      );

      this.logger.log(`订单支付成功: outTradeNo=${outTradeNo}, transactionId=${transactionId}`);

      await this.activateSubscription(order);

      // 上报微信发货信息管理
      await this.uploadShippingInfo(transactionId, order);

      return this.buildNotifySuccessXml();
    } catch (error) {
      this.logger.error(`处理支付回调失败: ${error.message}`, error.stack);
      return { code: 'FAIL', message: error.message };
    }
  }

  /**
   * 构建V2回调成功响应XML
   */
  private buildNotifySuccessXml() {
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
  }

  /**
   * 上报微信发货信息管理
   * 微信从2024年开始强制要求小程序接入发货管理，否则支付API被封禁
   */
  private async uploadShippingInfo(transactionId: string, order: any) {
    try {
      const accessToken = await this.getMiniProgramAccessToken();
      if (!accessToken) {
        this.logger.warn('获取access_token失败，跳过发货信息上报');
        return;
      }

      const shippingData = {
        order_key: {
          order_number_type: 2,
          transaction_id: transactionId,
        },
        delivery_mode: 1,
        shipping_list: [
          {
            item_desc: 'Morena AI 订阅服务',
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
   * 主动查询微信订单状态（V2接口，用于补单）
   */
  async queryWechatOrderStatus(outTradeNo: string) {
    try {
      const params: Record<string, string> = {
        appid: this.appId,
        mch_id: this.mchId,
        out_trade_no: outTradeNo,
        nonce_str: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
      };
      params.sign = this.signMd5(params);

      const xmlBody = this.buildXml(params);
      const axios = require('axios');
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/pay/orderquery',
        xmlBody,
        {
          headers: { 'Content-Type': 'application/xml' },
          timeout: 15000,
        },
      );

      const result = this.parseXml(response.data);
      this.logger.log(`微信V2订单查询结果: trade_state=${result.trade_state}, out_trade_no=${outTradeNo}`);
      return result;
    } catch (error) {
      this.logger.error(`微信订单查询失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 关闭超时未支付订单（V2接口）
   */
  async closeOrder(outTradeNo: string) {
    try {
      const params: Record<string, string> = {
        appid: this.appId,
        mch_id: this.mchId,
        out_trade_no: outTradeNo,
        nonce_str: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
      };
      params.sign = this.signMd5(params);

      const xmlBody = this.buildXml(params);
      const axios = require('axios');
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/pay/closeorder',
        xmlBody,
        {
          headers: { 'Content-Type': 'application/xml' },
          timeout: 15000,
        },
      );

      const result = this.parseXml(response.data);
      this.logger.log(`关闭订单结果: return_code=${result.return_code}, out_trade_no=${outTradeNo}`);

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
