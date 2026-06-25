import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getMySQLClient, getPool } from '../../storage/database/mysql-client';
import { ReferralService } from '../referral/referral.service';

// 微信支付V3 API证书序列号
let wechatPaySerialNo: string | null = null;

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private appId: string;
  private mchId: string;
  private apiKeyV2: string; // 商户APIv2密钥
  private notifyUrl: string;
  private privateKey: Buffer;

  constructor(
    @Inject(forwardRef(() => 'ORDER_SERVICE')) private readonly orderService: any,
    @Inject(forwardRef(() => ReferralService)) private readonly referralService: ReferralService,
  ) {
    this.appId = process.env.WECHAT_PAY_APPID || '';
    this.mchId = process.env.WECHAT_PAY_MCHID || '';
    this.notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL || '';

    // V2签名必须使用APIv2密钥，不能用APIv3密钥代替
    if (process.env.WECHAT_PAY_APIV2_KEY) {
      this.apiKeyV2 = process.env.WECHAT_PAY_APIV2_KEY;
    } else {
      this.apiKeyV2 = process.env.WECHAT_PAY_APIV3_KEY || '';
      this.logger.warn('⚠️ 未配置 WECHAT_PAY_APIV2_KEY，当前 fallback 使用 APIV3_KEY，V2签名可能失败！请在 .env 中配置 WECHAT_PAY_APIV2_KEY');
    }

    if (!this.apiKeyV2) {
      this.logger.error('❌ 未配置任何微信支付密钥！请配置 WECHAT_PAY_APIV2_KEY');
    }

    // 加载商户私钥（用于生成前端支付签名）
    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
    if (privateKeyPath && fs.existsSync(path.resolve(privateKeyPath))) {
      this.privateKey = fs.readFileSync(path.resolve(privateKeyPath));
      this.logger.log('从文件加载商户私钥成功');
    } else {
      this.logger.error('商户私钥文件不存在，请检查 WECHAT_PAY_PRIVATE_KEY_PATH 配置');
    }

    // 加载微信支付V3证书序列号（用于商户转账）
    wechatPaySerialNo = process.env.WECHAT_PAY_SERIAL_NO || null;
    if (!wechatPaySerialNo) {
      this.logger.warn('⚠️ 未配置 WECHAT_PAY_SERIAL_NO，商户转账功能可能无法使用');
    }

    this.logger.log(`微信支付(V2)初始化 - AppID: ${this.appId}, MchID: ${this.mchId}, APIv2Key: ${this.apiKeyV2 ? '已配置' : '未配置'}`);
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
    
    // 检查是否是新用户首冲会员8折优惠
    let finalAmount = amount;
    let discountApplied = false;
    
    if (orderType === 'subscription') {
      const db = getMySQLClient();
      
      // 1. 检查用户是否是被邀请的新用户
      const referralResult = await db.query(
        `SELECT * FROM referrals WHERE referred_id = ? AND status = 'completed'`,
        [userId]
      ) as any[];
      
      const isInvitedUser = referralResult?.length > 0;
      
      // 2. 检查用户是否是首次充值会员
      const subscriptionResult = await db.query(
        `SELECT * FROM user_subscriptions WHERE user_id = ?`,
        [userId]
      ) as any[];
      
      const isFirstSubscription = !subscriptionResult || subscriptionResult.length === 0;
      
      // 3. 如果满足条件，应用8折优惠
      if (isInvitedUser && isFirstSubscription) {
        finalAmount = Math.round(amount * 0.8 * 100) / 100;  // 8折优惠，保留两位小数
        discountApplied = true;
        this.logger.log(`新用户首冲会员8折优惠: userId=${userId}, 原价=${amount}元, 折后价=${finalAmount}元`);
      }
    }
    
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
        finalAmount,
        JSON.stringify({ planId, description, discountApplied, originalAmount: amount }),
      ],
    );

    this.logger.log(`创建本地支付订单: ${orderId}, outTradeNo: ${outTradeNo}, 金额: ${finalAmount}元${discountApplied ? ' (8折优惠)' : ''}`);

    // 2. 调用微信V2统一下单API
    const amountInFen = Math.round(finalAmount * 100);

    const sanitizedBody = this.sanitizeBody(description);

    const unifiedOrderParams: Record<string, string> = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
      body: sanitizedBody,
      out_trade_no: outTradeNo,
      total_fee: String(amountInFen),
      spbill_create_ip: '127.0.0.1',
      notify_url: this.notifyUrl,
      trade_type: 'JSAPI',
      openid: openid,
      sign_type: 'MD5',
    };

    // V2签名：MD5签名
    unifiedOrderParams.sign = this.signMd5(unifiedOrderParams);

    // 将参数转为XML
    const xmlBody = this.buildXml(unifiedOrderParams);

    this.logger.log(`调用微信V2统一下单: outTradeNo=${outTradeNo}, amount=${amountInFen}分, body=${sanitizedBody}`);

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
        this.logger.error(`微信统一下单失败: err_code=${errCode}, err_msg=${errMsg}, return_code=${returnCode}, result_code=${resultCode}, body值="${sanitizedBody}"`);

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
   * 过滤掉 undefined/null 值，避免生成空节点
   */
  private buildXml(params: Record<string, string>): string {
    const xmlParts = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`);
    return `<xml>${xmlParts.join('')}</xml>`;
  }

  /**
   * 清理并校验 body（商品描述）字段
   * 微信支付V2对body字段要求：
   * 1. 必填，不能为空
   * 2. 最长128字节（UTF-8中文3字节）
   * 3. 不能包含控制字符和XML破坏性序列
   */
  private sanitizeBody(description: string): string {
    const DEFAULT_BODY = 'Morena AI服务';

    // 1. 空值兜底
    let body = description || '';
    if (!body.trim()) {
      this.logger.warn(`微信支付body为空，使用默认值: ${DEFAULT_BODY}`);
      return DEFAULT_BODY;
    }

    // 2. 清理控制字符和CDATA破坏性序列
    body = body
      .replace(/[\x00-\x1F\x7F]/g, '')  // 移除控制字符
      .replace(/\]\]>/g, '')              // 移除CDATA结束符（防止XML解析中断）
      .trim();

    if (!body) {
      return DEFAULT_BODY;
    }

    // 3. 截断到128字节（UTF-8中文3字节，英文1字节）
    const MAX_BYTES = 128;
    let byteLen = 0;
    let result = '';
    for (const char of body) {
      const charBytes = char.charCodeAt(0) > 127 ? 3 : 1;
      if (byteLen + charBytes > MAX_BYTES) break;
      byteLen += charBytes;
      result += char;
    }

    return result || DEFAULT_BODY;
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

      if (order.orderType === 'order' || order.order_type === 'order') {
        await this.activateOrder(order, transactionId);
      } else if (order.orderType === 'coin_recharge' || order.order_type === 'coin_recharge') {
        await this.activateCoinRecharge(order, transactionId);
      } else {
        await this.activateSubscription(order);
      }

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

      const isOrderPayment = order.orderType === 'order' || order.order_type === 'order';
      const shippingData = {
        order_key: {
          order_number_type: 2,
          transaction_id: transactionId,
        },
        delivery_mode: 1,
        shipping_list: [
          {
            item_desc: isOrderPayment ? 'Morena AI 内容创作服务' : 'Morena AI 订阅服务',
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
   * 激活订单（支付成功后调用）
   * 更新 orders 表 is_paid=1, status=open → 触发自动派单
   */
  private async activateOrder(order: any, transactionId: string) {
    try {
      const orderId = order.planId || order.plan_id; // 订单支付场景下 planId 存的是 orderId
      if (!orderId) {
        this.logger.error('订单支付回调: planId(orderId)为空，无法激活');
        return;
      }
      this.logger.log(`激活订单: orderId=${orderId}, transactionId=${transactionId}`);

      await this.orderService.handlePaymentSuccess(orderId, transactionId);
      this.logger.log(`✅ 订单激活成功: orderId=${orderId}`);
    } catch (error) {
      this.logger.error(`激活订单失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 激活用户订阅
   */
  private async activateSubscription(order: any) {
    const db = getMySQLClient();
    const pool = getPool();
    const connection = await pool.getConnection();

    const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : (order.metadata || {});
    const planId = metadata.planId || order.planId;

    this.logger.log(`激活订阅: userId=${order.userId}, planId=${planId}`);

    try {
      await connection.beginTransaction();

      const plans = await connection.query(
        `SELECT * FROM subscription_plans WHERE id = ?`,
        [planId],
      );

      if (!plans || (plans as any[]).length === 0) {
        this.logger.error(`订阅计划不存在: ${planId}`);
        await connection.rollback();
        return;
      }

      const plan = (plans as any[])[0];
      // 读取DB返回值 → camelCase (convertKeysToCamel自动转换)
      const durationDays = plan.durationDays || 30;
      const now = new Date();
      const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const maxAvatars = plan.maxAvatars || 1;
      const canReceiveOrders = plan.canReceiveOrders || 0;


      // 创建新订阅记录（每次购买都创建新记录）
      const subscriptionId = crypto.randomUUID()
      await connection.query(
        'INSERT INTO user_subscriptions (id, user_id, plan_id, status, start_date, end_date, max_avatars, can_receive_orders, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [subscriptionId, order.userId, planId, 'active', now, endDate, maxAvatars, canReceiveOrders]
      );
       // 记录是否是新订阅（用于续费到期时间）
      const existing = await connection.query(
        `SELECT * FROM user_subscriptions WHERE user_id = ? AND status = 'active' ORDER BY end_date DESC LIMIT 1`,
        [order.userId],
      ) as any[];
     this.logger.log(`新订阅激活: userId=${order.userId}, planId=${planId}, 到期日=${endDate}`);

    
      

    // 发放会员开通积分奖励（仅新订阅时发放）

    await this.giveSubscriptionReward(connection, order.userId, planId);
    await connection.commit();

      // 集成返佣机制：检查用户是否是被邀请的用户（事务外执行）
      try {
        const referralResult = await db.query(
          `SELECT * FROM referrals WHERE referred_id = ? AND status = 'completed'`,
          [order.userId],
        ) as any[];

        const referral = referralResult?.[0];
        if (referral) {
          const referrerId = referral.referrer_id || referral.referrerId;
          const amount = Number(order.amount || 0);

          this.logger.log(`检测到被邀请用户订阅，准备处理返佣: userId=${order.userId}, referrerId=${referrerId}, amount=${amount}`);

          // 记录返佣
          if (this.referralService) {
            await this.referralService.recordCommission(referrerId, order.userId, 'subscription', amount);
            this.logger.log(`返佣已记录: referrerId=${referrerId}, amount=${amount}`);
          }
        }
      } catch (err) {
        this.logger.error(`处理返佣失败: ${err.message}`, err.stack);
      }
    } catch (error) {
      await connection.rollback();
      this.logger.error(`订阅激活失败: ${error.message}`, error.stack);
    } finally {
      connection.release();
    }
  }

  /**
   * 发放会员开通积分奖励
   */
  private async giveSubscriptionReward(connection: any, userId: string, planId: string) {
    try {
      // 查询奖励配置
      const rewardKeyMap: Record<string, string> = {
        'plan_basic': 'basic_coin_reward',
        'plan_pro': 'pro_coin_reward',
        'plan_enterprise': 'enterprise_coin_reward',
      }

      const rewardKey = rewardKeyMap[planId];
      if (!rewardKey) {
        this.logger.log(`[giveSubscriptionReward] 无对应奖励配置: planId=${planId}`);
        return;
      }

      const [configRows] = await connection.query(
        'SELECT value FROM reward_configs WHERE `key` = ? AND enabled = 1',
        [rewardKey],
      ) as any[];

      const config = (configRows as any[])?.[0];
      if (!config) {
        this.logger.log(`[giveSubscriptionReward] 奖励配置不存在或已禁用: ${rewardKey}`);
        return;
      }

      const rewardAmount = Number(config.value || 0);
      if (rewardAmount <= 0) {
        this.logger.log(`[giveSubscriptionReward] 奖励积分为0: ${rewardKey}`);
        return;
      }

      // 查询用户当前余额
      const [balanceRows] = await connection.query(
        `SELECT coins FROM users WHERE id = ?`,
        [userId],
      ) as any[];

      const currentBalance = Number((balanceRows as any[])?.[0]?.coins || 0);
      const newBalance = currentBalance + rewardAmount;

      // 更新用户余额
      await connection.query(
        'UPDATE users SET coins = coins + ?, updated_at = NOW() WHERE id = ?',
        [rewardAmount, userId],
      );

      // 记录交易
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await connection.query(
        `INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, 'gift', ?, ?, ?, ?, NOW())`,
        [transactionId, userId, rewardAmount, currentBalance, newBalance, `开通会员赠送积分`],
      );

      this.logger.log(`[giveSubscriptionReward] 发放会员积分奖励成功: userId=${userId}, planId=${planId}, 奖励=${rewardAmount}, 新余额=${newBalance}`);
    } catch (error) {
      this.logger.error(`[giveSubscriptionReward] 发放会员积分奖励失败: ${error.message}`, error.stack);
    }
  }

  private async activateCoinRecharge(order: any, transactionId: string) {
    try {
      const packageId = order.planId || order.plan_id;
      const userId = order.userId || order.user_id;
      
      if (!packageId || !userId) {
        this.logger.error('积分充值回调: packageId或userId为空');
        return;
      }

      this.logger.log(`激活积分充值: userId=${userId}, packageId=${packageId}`);

      const db = getMySQLClient();
      const packages = await db.query(
        `SELECT * FROM coin_recharge_packages WHERE id = ?`,
        [packageId],
      );

      if (!packages || packages.length === 0) {
        this.logger.error(`充值套餐不存在: ${packageId}`);
        return;
      }

      const pkg = packages[0];
      const totalCoins = Number(pkg.coins) + Number(pkg.bonus || 0);

      const users = await db.query(`SELECT coins FROM users WHERE id = ? FOR UPDATE`, [userId]);
      const user = users?.[0];
      
      if (!user) {
        this.logger.error(`用户不存在: ${userId}`);
        return;
      }

      const balanceBefore = Number(user.coins || 0);
      const balanceAfter = balanceBefore + totalCoins;

      await db.query(`UPDATE users SET coins = ? WHERE id = ?`, [balanceAfter, userId]);

      const rechargeRecordId = crypto.randomUUID();
      await db.query(
        `INSERT INTO coin_recharge_records (id, user_id, package_id, coins, bonus, amount, payment_method, status, transaction_id, paid_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'wechat', 'paid', ?, NOW(), NOW())`,
        [rechargeRecordId, userId, packageId, pkg.coins, pkg.bonus || 0, pkg.price, transactionId]
      );

      const txId = crypto.randomUUID();
      await db.query(
        `INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, description, created_at)
         VALUES (?, ?, 'recharge', ?, ?, ?, ?, NOW())`,
        [txId, userId, totalCoins, balanceBefore, balanceAfter, `充值${pkg.coins}积分${pkg.bonus > 0 ? `，赠送${pkg.bonus}积分` : ''}`]
      );

      this.logger.log(`✅ 积分充值成功: userId=${userId}, 充值${totalCoins}积分, 余额${balanceBefore}→${balanceAfter}`);

      // 集成返佣机制：检查用户是否是被邀请的用户
      try {
        this.logger.log(`检查返佣: userId=${userId}`);
        
        const referralResult = await db.query(
          `SELECT * FROM referrals WHERE referred_id = ? AND status = 'completed'`,
          [userId],
        ) as any[];

        this.logger.log(`查询邀请关系结果: userId=${userId}, referralResult=${JSON.stringify(referralResult)}`);

        const referral = referralResult?.[0];
        if (referral) {
          const referrerId = referral.referrer_id || referral.referrerId;
          const amount = Number(pkg.price || 0);

          this.logger.log(`检测到被邀请用户充值，准备处理返佣: userId=${userId}, referrerId=${referrerId}, amount=${amount}`);

          // 记录返佣
          if (this.referralService) {
            this.logger.log(`准备调用recordCommission: referrerId=${referrerId}, userId=${userId}, amount=${amount}`);
            await this.referralService.recordCommission(referrerId, userId, 'coin_recharge', amount);
            this.logger.log(`返佣已记录: referrerId=${referrerId}, amount=${amount}`);
          } else {
            this.logger.error(`ReferralService未注入，跳过返佣`);
          }
        } else {
          this.logger.log(`未找到邀请关系，跳过返佣: userId=${userId}`);
        }
      } catch (error) {
        this.logger.error(`处理返佣失败: ${error.message}`, error.stack);
      }
    } catch (error) {
      this.logger.error(`激活积分充值失败: ${error.message}`, error.stack);
    }
  }

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

  /**
   * ===================== 微信商户转账（商家转账到零钱） =====================
   * 
   * 微信支付V3 API - 商家转账到零钱
   * 文档: https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter4_3_1.shtml
   * 
   * 使用场景：用户提现、退款、奖励发放等
   */

  /**
   * 商家转账到零钱（V3 API）
   * 
   * @param params 转账参数
   * @returns 转账结果
   */
  async transferToBalance(params: {
    openid: string;           // 收款用户openid
    amount: number;           // 转账金额（元）
    description: string;      // 转账说明
    outBatchNo?: string;      // 商户批次单号（可选，自动生成）
    outDetailNo?: string;     // 商户明细单号（可选，自动生成）
  }): Promise<{
    out_batch_no: string;
    batch_id: string;
    out_detail_no: string;
    detail_id: string;
    status: string;
  }> {
    const { openid, amount, description } = params;

    // 生成批次单号和明细单号
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex');
    const outBatchNo = params.outBatchNo || `WB${timestamp}${randomStr}`;
    const outDetailNo = params.outDetailNo || `WD${timestamp}${randomStr}`;

    // 金额转换为分
    const amountInFen = Math.round(amount * 100);

    this.logger.log(`发起商户转账: openid=${openid}, amount=${amountInFen}分, batchNo=${outBatchNo}`);

    // 构建请求体
    const requestBody = {
      appid: this.appId,
      out_batch_no: outBatchNo,
      batch_name: '用户提现',
      batch_remark: description,
      total_amount: amountInFen,
      total_num: 1,
      transfer_detail_list: [
        {
          out_detail_no: outDetailNo,
          transfer_amount: amountInFen,
          transfer_remark: description,
          openid: openid,
        }
      ]
    };

    // 生成V3签名并调用API
    try {
      const axios = require('axios');
      const url = 'https://api.mch.weixin.qq.com/v3/transfer/batches';
      const method = 'POST';
      const bodyStr = JSON.stringify(requestBody);

      // 生成Authorization签名
      const authorization = this.generateV3Authorization(method, url, bodyStr);

      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authorization,
        },
        timeout: 15000,
      });

      const result = response.data;
      this.logger.log(`✅ 商户转账成功: batchId=${result.batch_id}, detailId=${result.detail_list?.[0]?.detail_id}`);

      return {
        out_batch_no: outBatchNo,
        batch_id: result.batch_id,
        out_detail_no: outDetailNo,
        detail_id: result.detail_list?.[0]?.detail_id || '',
        status: result.detail_list?.[0]?.status || 'PROCESSING',
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      const errCode = error.response?.data?.code || '';
      this.logger.error(`商户转账失败: code=${errCode}, message=${errMsg}`);
      throw new Error(`商户转账失败: ${errMsg}(${errCode})`);
    }
  }

  /**
   * 查询转账批次状态
   * 
   * @param outBatchNo 商户批次单号
   * @returns 转账状态
   */
  async queryTransferBatch(outBatchNo: string): Promise<{
    batch_id: string;
    status: string;
    total_amount: number;
    total_num: number;
    detail_list: Array<{
      out_detail_no: string;
      detail_id: string;
      status: string;
      fail_reason?: string;
    }>;
  }> {
    this.logger.log(`查询转账批次状态: outBatchNo=${outBatchNo}`);

    try {
      const axios = require('axios');
      const url = `https://api.mch.weixin.qq.com/v3/transfer/batches/out-batch-no/${outBatchNo}`;
      const method = 'GET';
      const bodyStr = '';

      const authorization = this.generateV3Authorization(method, url, bodyStr);

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authorization,
        },
        timeout: 10000,
      });

      const result = response.data;
      this.logger.log(`查询转账批次成功: batchId=${result.batch_id}, status=${result.status}`);

      return {
        batch_id: result.batch_id,
        status: result.status,
        total_amount: result.total_amount,
        total_num: result.total_num,
        detail_list: result.detail_list || [],
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`查询转账批次失败: ${errMsg}`);
      throw new Error(`查询转账批次失败: ${errMsg}`);
    }
  }

  /**
   * 查询转账明细状态
   * 
   * @param outBatchNo 商户批次单号
   * @param outDetailNo 商户明细单号
   * @returns 转账明细状态
   */
  async queryTransferDetail(outBatchNo: string, outDetailNo: string): Promise<{
    detail_id: string;
    status: string;
    fail_reason?: string;
    transfer_amount: number;
  }> {
    this.logger.log(`查询转账明细状态: outBatchNo=${outBatchNo}, outDetailNo=${outDetailNo}`);

    try {
      const axios = require('axios');
      const url = `https://api.mch.weixin.qq.com/v3/transfer-detail/out-batch-no/${outBatchNo}/out-detail-no/${outDetailNo}`;
      const method = 'GET';
      const bodyStr = '';

      const authorization = this.generateV3Authorization(method, url, bodyStr);

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authorization,
        },
        timeout: 10000,
      });

      const result = response.data;
      this.logger.log(`查询转账明细成功: detailId=${result.detail_id}, status=${result.status}`);

      return {
        detail_id: result.detail_id,
        status: result.status,
        fail_reason: result.fail_reason,
        transfer_amount: result.transfer_amount,
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`查询转账明细失败: ${errMsg}`);
      throw new Error(`查询转账明细失败: ${errMsg}`);
    }
  }

  /**
   * 生成微信支付V3 Authorization签名
   * 
   * V3签名规则：
   * Authorization = WECHATPAY2-SHA256-RSA2048 mchid="",nonce_str="",signature="",timestamp="",serial_no=""
   * 
   * signature生成步骤：
   * 1. 构造签名串：HTTP方法\nURL\n请求时间戳\n请求随机串\n请求体\n
   * 2. 使用商户私钥对签名串进行SHA256withRSA签名
   * 3. Base64编码签名结果
   */
  private generateV3Authorization(method: string, url: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');

    // 构造签名串
    // URL需要去掉域名部分，只保留路径和查询参数
    const urlPath = url.replace(/^https:\/\/[^\/]+/, '');
    const signStr = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;

    // 使用商户私钥签名
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const signature = sign.sign(this.privateKey, 'base64');

    // 构造Authorization头
    if (!wechatPaySerialNo) {
      throw new Error('未配置微信支付证书序列号 WECHAT_PAY_SERIAL_NO');
    }

    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${wechatPaySerialNo}"`;

    return authorization;
  }
}
