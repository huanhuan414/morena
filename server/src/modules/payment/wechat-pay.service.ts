import { Injectable } from '@nestjs/common'
const WxPay = require('wechatpay-node-v3')
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * 微信支付配置
 * 需要在 .env 文件中配置以下参数：
 * WECHAT_PAY_MCHID: 商户号
 * WECHAT_PAY_SERIAL_NO: 证书序列号
 * WECHAT_PAY_PRIVATE_KEY_PATH: 商户私钥文件路径
 * WECHAT_PAY_PUBLIC_KEY_PATH: 微信平台公钥文件路径（可选，用于验证签名）
 * WECHAT_PAY_APIV3_KEY: APIv3密钥
 * WECHAT_PAY_APPID: 小程序AppID
 */
@Injectable()
export class WechatPayService {
  private pay: any = null
  private mchid: string
  private appid: string

  constructor() {
    this.mchid = process.env.WECHAT_PAY_MCHID || '1290305501'
    this.appid = process.env.WECHAT_PAY_APPID || ''

    // 检查是否配置了必要的证书文件
    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH
    const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH

    if (!privateKeyPath || !publicKeyPath) {
      console.warn('[WechatPayService] 未配置完整的支付证书，支付功能将不可用')
      this.pay = null
      return
    }

    try {
      // 获取私钥和公钥
      const privateKey = this.getPrivateKey()
      const publicKey = this.getPublicKey()

      // 初始化微信支付
      this.pay = new WxPay({
        appid: this.appid,
        mchid: this.mchid,
        publicKey: Buffer.from(publicKey),
        privateKey: Buffer.from(privateKey),
        serial_no: process.env.WECHAT_PAY_SERIAL_NO || '',
        key: process.env.WECHAT_PAY_APIV3_KEY || ''
      })

      console.log('[WechatPayService] 微信支付服务初始化完成', {
        mchid: this.mchid,
        appid: this.appid
      })
    } catch (error) {
      console.error('[WechatPayService] 微信支付服务初始化失败:', error)
      this.pay = null
    }
  }

  /**
   * 获取商户私钥
   * 注意：实际生产环境需要从商户平台下载证书文件
   */
  private getPrivateKey(): string {
    try {
      const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH
      if (privateKeyPath) {
        // 读取证书文件
        return readFileSync(privateKeyPath, 'utf-8')
      }

      // 如果没有配置证书文件，返回一个占位符（仅用于测试）
      console.warn('[WechatPayService] 未配置商户私钥文件路径，使用测试模式')
      return `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDExample
-----END PRIVATE KEY-----`
    } catch (error) {
      console.error('[WechatPayService] 读取商户私钥失败:', error)
      throw new Error('读取商户私钥失败')
    }
  }

  /**
   * 获取微信平台公钥（用于验证签名）
   * 如果未配置，返回占位符
   */
  private getPublicKey(): string {
    try {
      const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH
      if (publicKeyPath) {
        return readFileSync(publicKeyPath, 'utf-8')
      }
      console.warn('[WechatPayService] 未配置平台公钥文件路径，使用占位符')
      return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvExample
-----END PUBLIC KEY-----`
    } catch (error) {
      console.warn('[WechatPayService] 读取平台公钥失败，签名验证可能受影响:', error)
      return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvExample
-----END PUBLIC KEY-----`
    }
  }

  /**
   * 创建小程序支付订单
   * @param description 商品描述
   * @param outTradeNo 商户订单号
   * @param totalAmount 订单总金额（单位：分）
   * @param openid 用户openid
   * @param notifyUrl 支付结果通知地址
   */
  async createOrder(
    description: string,
    outTradeNo: string,
    totalAmount: number,
    openid: string,
    notifyUrl?: string
  ): Promise<any> {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化，请检查配置')
    }

    try {
      const params = {
        appid: this.appid,
        mchid: this.mchid,
        description,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl || process.env.WECHAT_PAY_NOTIFY_URL || '',
        amount: {
          total: totalAmount,
          currency: 'CNY'
        },
        payer: {
          openid
        }
      }

      console.log('[WechatPayService] 创建订单参数:', params)

      // 调用微信支付统一下单API（JSAPI支付/小程序支付）
      const result = await this.pay.transactions_jsapi(params)

      console.log('[WechatPayService] 创建订单响应:', result)

      return result
    } catch (error: any) {
      console.error('[WechatPayService] 创建订单失败:', error)
      throw new Error(error.message || '创建订单失败')
    }
  }

  /**
   * 查询订单
   * @param outTradeNo 商户订单号
   */
  async queryOrder(outTradeNo: string): Promise<any> {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化，请检查配置')
    }

    try {
      console.log('[WechatPayService] 查询订单:', outTradeNo)

      // 调用查询订单API
      const result = await this.pay.query({ out_trade_no: outTradeNo })

      console.log('[WechatPayService] 查询订单结果:', result)

      return result
    } catch (error: any) {
      console.error('[WechatPayService] 查询订单失败:', error)
      throw new Error(error.message || '查询订单失败')
    }
  }

  /**
   * 关闭订单
   * @param outTradeNo 商户订单号
   */
  async closeOrder(outTradeNo: string): Promise<any> {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化，请检查配置')
    }

    try {
      console.log('[WechatPayService] 关闭订单:', outTradeNo)

      // 调用关闭订单API
      const result = await this.pay.close({ out_trade_no: outTradeNo })

      console.log('[WechatPayService] 关闭订单结果:', result)

      return result
    } catch (error: any) {
      console.error('[WechatPayService] 关闭订单失败:', error)
      throw new Error(error.message || '关闭订单失败')
    }
  }

  /**
   * 验证支付结果通知签名
   * @param signature 签名
   * @param timestamp 时间戳
   * @param nonce 随机字符串
   * @param body 通知体
   */
  async verifyNotify(
    signature: string,
    timestamp: string,
    nonce: string,
    body: any
  ): Promise<boolean> {
    if (!this.pay) {
      console.warn('[WechatPayService] 支付服务未初始化，无法验证签名')
      return false
    }

    try {
      const isValid = await this.pay.verifySign({
        timestamp,
        nonce,
        body,
        serial: process.env.WECHAT_PAY_SERIAL_NO || '',
        signature,
        apiSecret: process.env.WECHAT_PAY_APIV3_KEY
      })
      console.log('[WechatPayService] 验证签名结果:', isValid)
      return isValid
    } catch (error: any) {
      console.error('[WechatPayService] 验证签名失败:', error)
      return false
    }
  }

  /**
   * 解密支付结果通知
   * @param associatedData 关联数据
   * @param nonce 随机字符串
   * @param ciphertext 密文
   */
  async decryptNotify(
    associatedData: string,
    nonce: string,
    ciphertext: string
  ): Promise<any> {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化，请检查配置')
    }

    try {
      const result = this.pay.decipher_gcm(associatedData, nonce, ciphertext)
      console.log('[WechatPayService] 解密通知结果:', result)
      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error: any) {
      console.error('[WechatPayService] 解密通知失败:', error)
      throw new Error(error.message || '解密通知失败')
    }
  }

  /**
   * 申请退款
   * @param outTradeNo 商户订单号
   * @param outRefundNo 退款订单号
   * @param totalAmount 订单总金额
   * @param refundAmount 退款金额
   */
  async refund(
    outTradeNo: string,
    outRefundNo: string,
    totalAmount: number,
    refundAmount: number
  ): Promise<any> {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化，请检查配置')
    }

    try {
      const params = {
        out_trade_no: outTradeNo,
        out_refund_no: outRefundNo,
        notify_url: process.env.WECHAT_PAY_REFUND_NOTIFY_URL || '',
        amount: {
          refund: refundAmount,
          total: totalAmount,
          currency: 'CNY'
        }
      }

      console.log('[WechatPayService] 申请退款参数:', params)

      // 调用退款API
      const result = await this.pay.refunds(params)

      console.log('[WechatPayService] 申请退款结果:', result)

      return result
    } catch (error: any) {
      console.error('[WechatPayService] 申请退款失败:', error)
      throw new Error(error.message || '申请退款失败')
    }
  }
}
