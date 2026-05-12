import { Controller, Post, Body, Headers, Get } from '@nestjs/common'
import { WechatPayService } from './wechat-pay.service'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Controller('payment')
export class PaymentController {
  constructor(private readonly wechatPayService: WechatPayService) {}

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

      // 创建统一下单（金额单位：分）
      const totalAmount = Math.round(plan.price * 100)

      const orderResult = await this.wechatPayService.createOrder(
        `订阅-${plan.name}`,
        outTradeNo,
        totalAmount,
        openid
      )

      if (orderResult.prepay_id) {
        // 生成小程序支付参数
        const payParams = this.generateMiniProgramPayParams(orderResult.prepay_id)

        // 创建支付订单记录
        const id = crypto.randomUUID()
        await db.insert('payment_orders', {
          id,
          user_id: userId,
          plan_id: planId,
          out_trade_no: outTradeNo,
          transaction_id: orderResult.prepay_id,
          total_amount: totalAmount,
          status: 'pending',
          payment_method: 'wechat',
          payment_params: JSON.stringify(payParams),
          created_at: new Date(),
          updated_at: new Date()
        })

        return {
          code: 200,
          data: {
            orderId: id,
            outTradeNo,
            prepayId: orderResult.prepay_id,
            ...payParams
          },
          message: '订单创建成功'
        }
      } else {
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

      // 创建统一下单（金额单位：分）
      const totalAmount = Math.round(amount * 100)

      const orderResult = await this.wechatPayService.createOrder(
        description,
        outTradeNo,
        totalAmount,
        openid
      )

      if (orderResult.prepay_id) {
        // 创建支付订单记录
        const id = crypto.randomUUID()
        await db.insert('payment_orders', {
          id,
          user_id: userId,
          order_id: orderId,
          out_trade_no: outTradeNo,
          transaction_id: orderResult.prepay_id,
          total_amount: totalAmount,
          status: 'pending',
          payment_method: 'wechat',
          created_at: new Date(),
          updated_at: new Date()
        })

        return {
          code: 200,
          data: {
            orderId: id,
            outTradeNo,
            prepayId: orderResult.prepay_id
          },
          message: '订单创建成功'
        }
      } else {
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
  async paymentNotify(@Body() body: any) {
    try {
      // 处理支付回调
      return { code: 200, message: '成功' }
    } catch (error) {
      return { code: 500, message: '失败' }
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
