import { Controller, Post, Body, Headers } from '@nestjs/common'
import { WechatPayService } from './wechat-pay.service'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'
import { SubscriptionService } from '../subscription/subscription.service'

@Controller('payment')
export class PaymentController {
  private paymentOrderColumnsCache: Set<string> | null = null

  constructor(
    private readonly wechatPayService: WechatPayService,
    private readonly subscriptionService: SubscriptionService
  ) {}

  private async getPaymentOrderColumns(): Promise<Set<string>> {
    if (this.paymentOrderColumnsCache) {
      return this.paymentOrderColumnsCache
    }

    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'payment_orders'`
    )

    this.paymentOrderColumnsCache = new Set(
      (rows || [])
        .map((row: any) => String(row.columnName || row.COLUMN_NAME || row.column_name || '').toLowerCase())
        .filter(Boolean)
    )

    return this.paymentOrderColumnsCache
  }

  private filterColumns(data: Record<string, any>, columns: Set<string>) {
    return Object.fromEntries(
      Object.entries(data).filter(([key, value]) => columns.has(key.toLowerCase()) && value !== undefined)
    )
  }

  private parseJsonObject<T = Record<string, any>>(input: any, fallback: T): T {
    if (!input) return fallback
    if (typeof input === 'object') return input as T
    if (typeof input === 'string') {
      try {
        return JSON.parse(input) as T
      } catch {
        return fallback
      }
    }
    return fallback
  }

  private normalizePaymentStatus(status?: string): 'created' | 'paying' | 'paid' | 'closed' | 'failed' | 'refunded' {
    const value = String(status || '').trim().toLowerCase()
    if (!value || value === 'pending') return 'created'
    if (value === 'success') return 'paid'
    if (value === 'cancelled') return 'closed'
    if (['created', 'paying', 'paid', 'closed', 'failed', 'refunded'].includes(value)) {
      return value as 'created' | 'paying' | 'paid' | 'closed' | 'failed' | 'refunded'
    }
    return 'failed'
  }

  private resolveWechatTradeState(notify: any): 'paid' | 'paying' | 'closed' | 'failed' | 'refunded' {
    const eventType = String(notify?.event_type || '').trim().toUpperCase()
    if (eventType === 'REFUND.SUCCESS') return 'refunded'

    const tradeState = String(notify?.trade_state || '').trim().toUpperCase()
    if (tradeState === 'SUCCESS') return 'paid'
    if (tradeState === 'USERPAYING' || tradeState === 'NOTPAY') return 'paying'
    if (tradeState === 'CLOSED' || tradeState === 'REVOKED') return 'closed'
    if (tradeState === 'REFUND') return 'refunded'
    return 'failed'
  }

  private readPaymentMetadata(order: any): Record<string, any> {
    return this.parseJsonObject(order?.metadata, {})
  }

  private async findPaymentOrderByOutTradeNo(outTradeNo: string): Promise<any> {
    const db = getMySQLClient()
    const columns = await this.getPaymentOrderColumns()

    if (columns.has('out_trade_no')) {
      return db.queryOne('payment_orders', { out_trade_no: outTradeNo })
    }

    if (columns.has('metadata')) {
      const rows = await db.query(
        `SELECT *
         FROM payment_orders
         WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.outTradeNo')) = ?
         LIMIT 1`,
        [outTradeNo]
      )
      return rows?.[0] || null
    }

    return null
  }

  private async updatePaymentOrder(orderId: string, patch: Record<string, any>) {
    const db = getMySQLClient()
    const columns = await this.getPaymentOrderColumns()
    const safePatch = this.filterColumns(patch, columns)

    if (Object.keys(safePatch).length === 0) {
      return
    }

    await db.updateWhere('payment_orders', { id: orderId }, safePatch)
  }

  /**
   * 创建支付订单
   */
  @Post('wechat/create')
  async createPayment(
    @Headers('x-user-id') userId: string,
    @Body() body: { planId: string; paymentMethod: string; openid?: string }
  ) {
    try {
      const { planId, paymentMethod, openid } = body

      if (paymentMethod !== 'wechat') {
        return {
          code: 400,
          message: '暂不支持该支付方式',
          data: null
        }
      }

      if (!openid) {
        return {
          code: 400,
          message: '缺少用户openid',
          data: null
        }
      }

      const db = getMySQLClient()
      const columns = await this.getPaymentOrderColumns()

      // 获取订阅计划
      const plan = await db.queryOne('subscription_plans', { id: planId })

      if (!plan) {
        return {
          code: 400,
          message: '订阅计划不存在',
          data: null
        }
      }

      if (plan.price <= 0) {
        return {
          code: 400,
          message: '免费版无需支付',
          data: null
        }
      }

      // 检查微信支付服务是否可用
      if (!this.wechatPayService.isServiceAvailable()) {
        return {
          code: 400,
          message: '微信支付服务未初始化',
          data: null
        }
      }

      // 生成商户订单号
      const outTradeNo = `SUB_${userId}_${Date.now()}`
      const paymentOrderId = crypto.randomUUID()

      // 创建统一下单（金额单位：分）
      const totalAmount = Math.round(plan.price * 100)
      const now = new Date()
      const metadata = {
        bizType: 'subscription',
        bizId: planId,
        planId,
        userId,
        outTradeNo,
        amountFen: totalAmount,
        amountYuan: Number(plan.price || 0),
        channel: 'wechat'
      }

      await db.insert('payment_orders', this.filterColumns({
        id: paymentOrderId,
        user_id: userId,
        order_type: 'subscription',
        amount: Number(plan.price || 0),
        currency: 'CNY',
        payment_method: 'wechat',
        status: 'created',
        plan_id: planId,
        out_trade_no: outTradeNo,
        total_amount: totalAmount,
        metadata: JSON.stringify(metadata),
        created_at: now,
        updated_at: now
      }, columns))

      const orderResult = await this.wechatPayService.createOrder(
        `订阅-${plan.name}`,
        outTradeNo,
        totalAmount,
        openid
      )

      if (orderResult.prepay_id) {
        // 生成小程序支付参数
        const payParams = this.generateMiniProgramPayParams(orderResult.prepay_id)
        const nextMetadata = {
          ...metadata,
          prepayId: orderResult.prepay_id,
          paymentParams: payParams
        }

        await this.updatePaymentOrder(paymentOrderId, {
          transaction_id: orderResult.prepay_id,
          status: 'paying',
          payment_params: JSON.stringify(payParams),
          metadata: JSON.stringify(nextMetadata),
          updated_at: new Date()
        })

        return {
          code: 200,
          data: {
            orderId: paymentOrderId,
            outTradeNo,
            prepayId: orderResult.prepay_id,
            ...payParams
          },
          message: '订单创建成功'
        }
      } else {
        await this.updatePaymentOrder(paymentOrderId, {
          status: 'failed',
          updated_at: new Date()
        })
        throw new Error('微信支付订单创建失败')
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '创建支付订单失败',
        data: null
      }
    }
  }

  /**
   * 创建订单支付
   */
  @Post('wechat/create-order-payment')
  async createOrderPayment(
    @Headers('x-user-id') userId: string,
    @Body() body: { orderId: string; amount: number; description: string; openid: string; platform?: string }
  ) {
    try {
      const { orderId, amount, description, openid, platform = 'miniprogram' } = body

      const db = getMySQLClient()
      const columns = await this.getPaymentOrderColumns()

      // 验证订单是否存在
      const order = await db.queryOne('orders', { id: orderId, user_id: userId })

      if (!order) {
        return {
          code: 400,
          message: '订单不存在',
          data: null
        }
      }

      // 生成商户订单号
      const outTradeNo = `ORD_${userId}_${Date.now()}`
      const paymentOrderId = crypto.randomUUID()

      // 创建统一下单（金额单位：分）
      const totalAmount = Math.round(amount * 100)
      const metadata = {
        bizType: 'order',
        bizId: orderId,
        orderId,
        userId,
        outTradeNo,
        amountFen: totalAmount,
        amountYuan: Number(amount || 0),
        channel: 'wechat',
        platform
      }

      await db.insert('payment_orders', this.filterColumns({
        id: paymentOrderId,
        user_id: userId,
        order_type: 'order',
        amount: Number(amount || 0),
        currency: 'CNY',
        payment_method: 'wechat',
        status: 'created',
        order_id: orderId,
        out_trade_no: outTradeNo,
        total_amount: totalAmount,
        metadata: JSON.stringify(metadata),
        created_at: new Date(),
        updated_at: new Date()
      }, columns))

      const orderResult = await this.wechatPayService.createOrder(
        description,
        outTradeNo,
        totalAmount,
        openid
      )

      if (orderResult.prepay_id) {
        await this.updatePaymentOrder(paymentOrderId, {
          transaction_id: orderResult.prepay_id,
          status: 'paying',
          metadata: JSON.stringify({
            ...metadata,
            prepayId: orderResult.prepay_id
          }),
          updated_at: new Date()
        })

        return {
          code: 200,
          data: {
            orderId: paymentOrderId,
            outTradeNo,
            prepayId: orderResult.prepay_id
          },
          message: '订单创建成功'
        }
      } else {
        await this.updatePaymentOrder(paymentOrderId, {
          status: 'failed',
          updated_at: new Date()
        })
        throw new Error('微信支付订单创建失败')
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '创建支付订单失败',
        data: null
      }
    }
  }

  /**
   * 支付回调
   */
  @Post('wechat/notify')
  async paymentNotify(@Headers() headers: Record<string, string>, @Body() body: any) {
    try {
      const signature = headers?.['wechatpay-signature'] || headers?.['Wechatpay-Signature'] || ''
      const timestamp = headers?.['wechatpay-timestamp'] || headers?.['Wechatpay-Timestamp'] || ''
      const nonce = headers?.['wechatpay-nonce'] || headers?.['Wechatpay-Nonce'] || ''

      if (signature && timestamp && nonce && this.wechatPayService.isServiceAvailable()) {
        const isValid = await this.wechatPayService.verifyNotify(
          signature,
          timestamp,
          nonce,
          typeof body === 'string' ? body : JSON.stringify(body)
        )

        if (!isValid) {
          return { code: 500, message: '签名验证失败' }
        }
      }

      let notifyPayload = body
      if (body?.resource?.ciphertext) {
        notifyPayload = await this.wechatPayService.decryptNotify(
          body.resource.associated_data || '',
          body.resource.nonce || '',
          body.resource.ciphertext || ''
        )
      } else if (body?.resource && typeof body.resource === 'object') {
        notifyPayload = body.resource
      }

      const outTradeNo = String(notifyPayload?.out_trade_no || '').trim()
      if (!outTradeNo) {
        return { code: 500, message: '缺少商户订单号' }
      }

      const paymentOrder = await this.findPaymentOrderByOutTradeNo(outTradeNo)
      if (!paymentOrder) {
        return { code: 500, message: '支付订单不存在' }
      }

      const currentStatus = this.normalizePaymentStatus(paymentOrder.status)
      if (currentStatus === 'paid') {
        return { code: 200, message: '成功' }
      }

      const nextStatus = this.resolveWechatTradeState({
        ...body,
        ...notifyPayload
      })

      if (nextStatus !== 'paid') {
        await this.updatePaymentOrder(paymentOrder.id, {
          status: nextStatus,
          updated_at: new Date(),
          metadata: JSON.stringify({
            ...this.readPaymentMetadata(paymentOrder),
            notifySummary: body?.summary || '',
            tradeState: notifyPayload?.trade_state || ''
          })
        })
        return { code: 200, message: '成功' }
      }

      const metadata = this.readPaymentMetadata(paymentOrder)
      const bizType = String(paymentOrder.orderType || paymentOrder.order_type || metadata.bizType || '').toLowerCase()
      const planId = String(paymentOrder.planId || paymentOrder.plan_id || metadata.planId || metadata.bizId || '').trim()
      const paymentUserId = String(paymentOrder.userId || paymentOrder.user_id || metadata.userId || '').trim()

      if (bizType === 'subscription' && paymentUserId && planId) {
        await this.subscriptionService.activateSubscriptionFromPayment(paymentUserId, planId, {
          payment_id: String(paymentOrder.id),
          payment_method: 'wechat'
        })
      }

      await this.updatePaymentOrder(paymentOrder.id, {
        status: 'paid',
        transaction_id: notifyPayload?.transaction_id || paymentOrder.transactionId || paymentOrder.transaction_id || null,
        paid_at: notifyPayload?.success_time ? new Date(notifyPayload.success_time) : new Date(),
        updated_at: new Date(),
        metadata: JSON.stringify({
          ...metadata,
          transactionId: notifyPayload?.transaction_id || metadata.transactionId,
          successTime: notifyPayload?.success_time || metadata.successTime,
          tradeState: notifyPayload?.trade_state || 'SUCCESS'
        })
      })

      return { code: 200, message: '成功' }
    } catch (error: any) {
      return { code: 500, message: error.message || '失败' }
    }
  }

  /**
   * 生成小程序支付参数
   */
  private generateMiniProgramPayParams(prepayId: string) {
    return {
      timeStamp: Date.now().toString(),
      nonceStr: crypto.randomUUID().replace(/-/g, ''),
      package: `prepay_id=${prepayId}`,
      signType: 'RSA',
      paySign: ''
    }
  }
}
