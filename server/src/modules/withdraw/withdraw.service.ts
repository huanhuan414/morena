import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getMySQLClient, getPool } from '../../storage/database/mysql-client';

@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);
  private appId: string;
  private mchId: string;
  private apiKeyV2: string;
  private certPath: string;
  private keyPath: string;

  constructor() {
    this.appId = process.env.WECHAT_PAY_APPID || '';
    this.mchId = process.env.WECHAT_PAY_MCHID || '';
    this.apiKeyV2 = process.env.WECHAT_PAY_APIV2_KEY || '';
    this.certPath = process.env.WECHAT_PAY_CERT_PATH || '';
    this.keyPath = process.env.WECHAT_PAY_KEY_PATH || '';

    this.logger.log(`提现服务初始化 - AppID: ${this.appId}, MchID: ${this.mchId}`);
  }

  /**
   * 创建提现申请（需要审核）
   * 用户提交提现申请后，状态为 pending，等待管理员审核
   */
  async createWithdrawRequest(userId: string, amount: number) {
    const pool = getPool();

    // 1. 检查用户 openid
    const [userRows] = await pool.query(
      `SELECT id, openid, nickname, balance, frozen_balance FROM users WHERE id = ?`,
      [userId]
    ) as any[];

    if (!userRows || userRows.length === 0) {
      throw new Error('用户不存在');
    }

    const user = userRows[0];
    const openid = user.openid;

    if (!openid) {
      throw new Error('请先绑定微信账号');
    }

    // 2. 检查提现金额规则
    // 查询推荐人数
    const [referralRows] = await pool.query(
      `SELECT COUNT(*) as referralCount FROM referrals WHERE referrer_id = ?`,
      [userId]
    ) as any[];
    const referralCount = Number(referralRows?.[0]?.referralCount) || 0;

    // 判断提现门槛
    const MIN_AMOUNT_NORMAL = 100; // 普通用户最低提现金额
    const MIN_AMOUNT_VIP = 20;     // 推荐2人以上最低提现金额
    const MULTIPLE = 20;            // 提现金额必须是20的倍数

    const minAmount = referralCount >= 2 ? MIN_AMOUNT_VIP : MIN_AMOUNT_NORMAL;

    if (amount <= 0) {
      throw new Error('提现金额必须大于0');
    }

    if (amount < minAmount) {
      const condition = referralCount >= 2  
        ? `已推荐2人及以上，可享最低提现${MIN_AMOUNT_VIP}元` 
        : `还需推荐${2 - referralCount}人及以上可享低门槛，当前最低提现${MIN_AMOUNT_NORMAL}元`;
      throw new Error(`提现金额不足，${condition}`);
    }

    if (amount % MULTIPLE !== 0) {
      throw new Error(`提现金额必须是${MULTIPLE}的倍数`);
    }

    // 3. 计算可提现余额
    const [settledEarnings] = await pool.query(
      `SELECT amount, fee_rate FROM earnings WHERE user_id = ? AND status = 'settled'`,
      [userId]
    ) as any[];

    const calcActualAmount = (amount: number, feeRate: number) => {
      return Number((amount * (1 - (feeRate || 0))).toFixed(2));
    };

    const settledAmount = (settledEarnings || []).reduce((sum: number, e: any) => {
      return sum + calcActualAmount(Number(e.amount), Number(e.fee_rate || 0));
    }, 0);

    // 4. 查询提现记录表中的金额
    const [withdrawStats] = await pool.query(
      `SELECT 
         SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completedWithdraw,
         SUM(CASE WHEN status IN ('processing', 'pending','confirming') THEN amount ELSE 0 END) as settlingWithdraw
       FROM withdraw_logs WHERE user_id = ?`,
      [userId]
    ) as any[];

    const completedWithdraw = Number(withdrawStats?.[0]?.completedWithdraw) || 0;
    const settlingWithdraw = Number(withdrawStats?.[0]?.settlingWithdraw) || 0;

    // 可提现余额 = settled状态收益 - (已结算 + 结算中金额)
    const availableBalance = Number((settledAmount - completedWithdraw - settlingWithdraw).toFixed(2));

    if (amount > availableBalance) {
      throw new Error(`可提现余额不足，当前可提现: ${availableBalance.toFixed(2)}元`);
    }

    // 5. 检查是否有正在处理中的提现
    const [pendingWithdraws] = await pool.query(
      `SELECT id FROM withdraw_logs WHERE user_id = ? AND status IN ('pending', 'processing','confirming')`,
      [userId]
    ) as any[];

    if (pendingWithdraws && pendingWithdraws.length > 0) {
      throw new Error('您有正在处理中的提现申请，请等待完成后再申请');
    }

    // 6. 创建提现记录（状态为 pending，等待审核）
    const withdrawLogId = crypto.randomUUID();
    const outTradeNo = `WD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await pool.query(
      `INSERT INTO withdraw_logs (id, user_id, amount, out_trade_no, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [withdrawLogId, userId, amount, outTradeNo]
    );

    // 7. fee_balance 扣减，frozen_balance 增加
    await pool.query(
      `UPDATE users SET fee_balance = fee_balance - ?, frozen_balance = frozen_balance + ?, updated_at = NOW() WHERE id = ?`,
      [amount, amount, userId]
    );

    this.logger.log(`提现申请创建成功: userId=${userId}, amount=${amount}, withdrawLogId=${withdrawLogId}`);

    return {
      withdrawId: withdrawLogId,
      outTradeNo,
      amount,
      status: 'pending',
      message: '提现申请已提交，等待审核'
    };
  }

  /**
   * 自动提现（简化版）
   * 
   * 逻辑：
   * 1. 检查用户 openid
   * 2. 计算可提现余额 = settled状态收益 - (提现记录表已结算 + 结算中金额)
   * 3. 判断余额是否充足
   * 4. 创建 withdraw_logs 记录
   * 5. 调用微信企业付款
   * 6. 成功：更新 status 为 completed
   * 7. 失败：更新 status 为 failed
   */
  async autoWithdraw(userId: string, amount: number) {
    const pool = getPool();

    // 1. 检查用户 openid
    const [userRows] = await pool.query(
      `SELECT id, openid, nickname FROM users WHERE id = ?`,
      [userId]
    ) as any[];

    if (!userRows || userRows.length === 0) {
      throw new Error('用户不存在');
    }

    const user = userRows[0];
    const openid = user.openid;

    if (!openid) {
      throw new Error('请先绑定微信账号');
    }

    if (amount <= 0) {
      throw new Error('提现金额必须大于0');
    }

    if (amount < 1) {
      throw new Error('最小提现金额为1元');
    }

    // 2. 计算可提现余额
    const [settledEarnings] = await pool.query(
      `SELECT amount, fee_rate FROM earnings WHERE user_id = ? AND status = 'settled'`,
      [userId]
    ) as any[];

    const calcActualAmount = (amount: number, feeRate: number) => {
      return Number((amount * (1 - (feeRate || 0))).toFixed(2));
    };

    const settledAmount = (settledEarnings || []).reduce((sum: number, e: any) => {
      return sum + calcActualAmount(Number(e.amount), Number(e.fee_rate || 0));
    }, 0);

    // 3. 查询提现记录表中的金额
    const [withdrawStats] = await pool.query(
      `SELECT 
         SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completedWithdraw,
         SUM(CASE WHEN status IN ('processing', 'pending') THEN amount ELSE 0 END) as settlingWithdraw
       FROM withdraw_logs WHERE user_id = ?`,
      [userId]
    ) as any[];

    const completedWithdraw = Number(withdrawStats?.[0]?.completedWithdraw) || 0;
    const settlingWithdraw = Number(withdrawStats?.[0]?.settlingWithdraw) || 0;

    // 可提现余额 = settled状态收益 - (已结算 + 结算中金额)
    const availableBalance = Number((settledAmount - completedWithdraw - settlingWithdraw).toFixed(2));

    if (amount > availableBalance) {
      throw new Error(`可提现余额不足，当前可提现: ${availableBalance.toFixed(2)}元`);
    }

    // 4. 检查是否有正在处理中的提现
    const [pendingWithdraws] = await pool.query(
      `SELECT id FROM withdraw_logs WHERE user_id = ? AND status IN ('pending', 'processing')`,
      [userId]
    ) as any[];

    if (pendingWithdraws && pendingWithdraws.length > 0) {
      throw new Error('您有正在处理中的提现申请，请等待完成后再申请');
    }

    // 5. 创建提现记录
    const withdrawLogId = crypto.randomUUID();
    const outTradeNo = `WD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const amountInFen = Math.round(amount * 100);

    // 创建 withdraw_logs 记录
    await pool.query(
      `INSERT INTO withdraw_logs (id, user_id, amount, out_trade_no, status, created_at)
       VALUES (?, ?, ?, ?, 'processing', NOW())`,
      [withdrawLogId, userId, amount, outTradeNo]
    );

    // 6. 调用微信企业付款
    try {
      const result = await this.transferToBalance({
        openid,
        amount: amountInFen,
        outTradeNo,
        desc: 'Morena收益提现'
      });

      // 7. 提现成功，更新状态
      await pool.query(
        `UPDATE withdraw_logs SET status = 'completed', payment_no = ?, updated_at = NOW() WHERE id = ?`,
        [result.payment_no, withdrawLogId]
      );

      this.logger.log(`自动提现成功: userId=${userId}, amount=${amount}元`);

      return {
        success: true,
        withdrawId: withdrawLogId,  // 兼容控制器期望的字段名
        withdrawLogId,
        amount,
        paymentNo: result.payment_no,
        message: '提现成功，款项已到微信零钱'
      };
    } catch (error: any) {
      // 8. 提现失败，更新状态
      this.logger.error(`自动提现失败: userId=${userId}, error=${error.message}`);

      await pool.query(
        `UPDATE withdraw_logs SET status = 'failed', remark = ?, updated_at = NOW() WHERE id = ?`,
        [error.message, withdrawLogId]
      );

      throw new Error(`提现失败: ${error.message}`);
    }
  }

  /**
   * 微信企业付款到零钱
   * API: https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers
   */
  private async transferToBalance(params: {
    openid: string;
    amount: number; // 单位：分
    outTradeNo: string;
    desc: string;
  }) {
    const { openid, amount, outTradeNo, desc } = params;

    // 构建请求参数
    const transferParams: Record<string, string> = {
      mch_appid: this.appId,
      mchid: this.mchId,
      nonce_str: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
      partner_trade_no: outTradeNo,
      openid: openid,
      check_name: 'NO_CHECK', // 不校验真实姓名
      amount: String(amount),
      desc: desc,
      spbill_create_ip: '127.0.0.1',
    };

    // 签名
    transferParams.sign = this.signMd5(transferParams);

    // 转为XML
    const xmlBody = this.buildXml(transferParams);

    this.logger.log(`调用微信企业付款: outTradeNo=${outTradeNo}, amount=${amount}分, openid=${openid}`);

    // 发送请求（需要双向证书）
    const axios = require('axios');

    // 加载证书
    let cert: Buffer;
    let key: Buffer;

    try {
      // 检查证书路径是目录还是文件
      const certResolvedPath = path.resolve(this.certPath);
      const keyResolvedPath = path.resolve(this.keyPath);

      if (fs.statSync(certResolvedPath).isDirectory()) {
        // 如果是目录，查找目录中的证书文件
        const certFiles = fs.readdirSync(certResolvedPath).filter(f => f.includes('cert') || f.endsWith('.pem'));
        const keyFiles = fs.readdirSync(keyResolvedPath).filter(f => f.includes('key') || f.endsWith('.pem'));

        // 找到 apiclient_cert.pem 和 apiclient_key.pem
        const certFile = certFiles.find(f => f.includes('apiclient_cert')) || certFiles[0];
        const keyFile = keyFiles.find(f => f.includes('apiclient_key')) || keyFiles[0];

        if (!certFile || !keyFile) {
          throw new Error('证书目录中未找到证书文件');
        }

        cert = fs.readFileSync(path.join(certResolvedPath, certFile));
        key = fs.readFileSync(path.join(keyResolvedPath, keyFile));

        this.logger.log(`从目录加载证书: cert=${certFile}, key=${keyFile}`);
      } else {
        // 如果是文件，直接读取
        cert = fs.readFileSync(certResolvedPath);
        key = fs.readFileSync(keyResolvedPath);
        this.logger.log('从文件加载证书成功');
      }
    } catch (err: any) {
      this.logger.error(`加载证书失败: ${err.message}`);
      throw new Error(`加载微信支付证书失败: ${err.message}`);
    }

    const response = await axios.post(
      'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers',
      xmlBody,
      {
        headers: { 'Content-Type': 'application/xml' },
        httpsAgent: new (require('https').Agent)({
          cert: cert,
          key: key,
        }),
        timeout: 30000,
      }
    );

    // 解析响应
    const result = this.parseXml(response.data);

    if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
      const errMsg = result.err_code_des || result.return_msg || '转账失败';
      throw new Error(errMsg);
    }

    return {
      payment_no: result.payment_no,
      payment_time: result.payment_time,
    };
  }

  /**
   * V2 MD5签名
   */
  private signMd5(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort();
    const stringA = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const stringSignTemp = `${stringA}&key=${this.apiKeyV2}`;
    return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * 将对象转为XML
   */
  private buildXml(params: Record<string, string>): string {
    const xmlParts = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`);
    return `<xml>${xmlParts.join('')}</xml>`;
  }

  /**
   * 解析XML
   */
  private parseXml(xml: string): Record<string, string> {
    const result: Record<string, string> = {};
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
   * 执行提现（管理员审核通过后调用）
   * 通过提现记录ID执行提现
   */
  async processWithdraw(withdrawId: string) {
    const pool = getPool();

    // 1. 查询提现记录
    const [withdrawRows] = await pool.query(
      `SELECT wl.*, u.openid, u.nickname 
       FROM withdraw_logs wl 
       LEFT JOIN users u ON wl.user_id = u.id 
       WHERE wl.id = ?`,
      [withdrawId]
    ) as any[];

    if (!withdrawRows || withdrawRows.length === 0) {
      throw new Error('提现记录不存在');
    }

    const withdraw = withdrawRows[0];

    if (withdraw.status !== 'pending') {
      throw new Error(`提现状态不正确，当前状态: ${withdraw.status}`);
    }

    const openid = withdraw.openid;
    if (!openid) {
      throw new Error('用户openid不存在，无法提现到微信');
    }

    // 2. 更新状态为 processing
    await pool.query(
      `UPDATE withdraw_logs SET status = 'processing', updated_at = NOW() WHERE id = ?`,
      [withdrawId]
    );

    // 3. 调用微信企业付款接口
    const amountInFen = Math.round(Number(withdraw.amount) * 100);

    try {
      const result = await this.transferToBalance({
        openid,
        amount: amountInFen,
        outTradeNo: withdraw.out_trade_no,
        desc: 'Morena收益提现'
      });

      // 4. 提现成功，更新状态
      await pool.query(
        `UPDATE withdraw_logs SET status = 'completed', payment_no = ?, updated_at = NOW() WHERE id = ?`,
        [result.payment_no, withdrawId]
      );

      this.logger.log(`执行提现成功: withdrawId=${withdrawId}, amount=${withdraw.amount}元`);

      return {
        success: true,
        withdrawId,
        amount: withdraw.amount,
        paymentNo: result.payment_no,
        message: '提现成功，款项已到账'
      };
    } catch (error: any) {
      // 5. 提现失败，更新状态
      await pool.query(
        `UPDATE withdraw_logs SET status = 'failed', remark = ?, updated_at = NOW() WHERE id = ?`,
        [error.message, withdrawId]
      );

      this.logger.error(`执行提现失败: withdrawId=${withdrawId}, error=${error.message}`);

      throw new Error(`提现失败: ${error.message}`);
    }
  }

  /**
   * 获取用户提现记录
   */
  async getWithdrawList(userId: string, options?: { page?: number; pageSize?: number }) {
    const pool = getPool();

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const [list] = await pool.query(
      `SELECT * FROM withdraw_logs wl 
       WHERE wl.user_id = ? 
       ORDER BY wl.created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    ) as any[];

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM withdraw_logs WHERE user_id = ?`,
      [userId]
    ) as any[];

    return {
      list: (list || []).map((item: any) => ({
        id: item.id,
        amount: Number(item.amount),
        outTradeNo: item.out_trade_no,
        paymentNo: item.payment_no,
        status: item.status,
        remark: item.remark,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      total: countResult?.[0]?.total || 0,
      page,
      pageSize,
    };
  }

  /**
   * 获取用户待确认的提现记录（status=confirming）
   * 按 created_at 降序取第一条（即最早创建的）
   */
  async getConfirmingWithdraw(userId: string) {
    const pool = getPool();

    const [records] = await pool.query(
      `SELECT id, out_trade_no, amount, status, created_at 
       FROM withdraw_logs 
       WHERE user_id = ? AND status = 'confirming' 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [userId]
    ) as any[];

    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      outTradeNo: record.out_trade_no,
      amount: Number(record.amount),
      status: record.status,
      createdAt: record.created_at,
    };
  }

  /**
   * 查询用户是否有进行中的提现（pending/processing/confirming）
   */
  async hasActiveWithdraw(userId: string): Promise<boolean> {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 1 FROM withdraw_logs WHERE user_id = ? AND status IN ('pending', 'processing', 'confirming') LIMIT 1`,
      [userId]
    ) as any[];
    return Array.isArray(rows) && rows.length > 0;
  }
}