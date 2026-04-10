import { Controller, Post, Body, Headers, Get, Req } from '@nestjs/common'
import { WechatPayService } from './wechat-pay.service'
import { getSupabaseClient } from '../../storage/database/supabase-client'

/**
 * 支付请求体接口
 */
interface CreatePaymentRequest {
  planId: string
  paymentMethod: 'wechat'
  openid?: string
}

/**
 * 支付控制器
 */
@Controller('payment')
export class PaymentController {
  constructor(private readonly wechatPayService: WechatPayService) {}

  /**
   * 创建支付订单
   * POST /api/payment/wechat/create
   */
  @Post('wechat/create')
  async createPayment(
    @Headers('x-user-id') userId: string,
    @Body() body: CreatePaymentRequest
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

      const client = getSupabaseClient()

      // 获取订阅计划
      const { data: plan, error: planError } = await client
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (planError || !plan) {
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

      // 生成商户订单号
      const outTradeNo = `SUB_${userId}_${Date.now()}`

      // 创建统一下单（金额单位：分）
      const totalAmount = Math.round(plan.price * 100) // 元转分

      const orderResult = await this.wechatPayService.createOrder(
        `订阅-${plan.name}`,
        outTradeNo,
        totalAmount,
        openid
      )

      console.log('[PaymentController] 微信支付订单创建成功:', orderResult)

      if (orderResult.prepay_id) {
        // 生成小程序支付参数
        const payParams = this.generateMiniProgramPayParams(orderResult.prepay_id)

        // 创建支付订单记录
        const { data: order, error: orderError } = await client
          .from('payment_orders')
          .insert({
            user_id: userId,
            plan_id: planId,
            out_trade_no: outTradeNo,
            transaction_id: orderResult.prepay_id,
            total_amount: totalAmount,
            status: 'pending',
            payment_method: 'wechat',
            payment_params: payParams
          })
          .select()
          .single()

        if (orderError) {
          console.error('[PaymentController] 创建支付订单记录失败:', orderError)
          throw new Error('创建支付订单记录失败')
        }

        return {
          code: 200,
          data: {
            orderId: order.id,
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
      console.error('[PaymentController] 创建支付订单失败:', error)
      return {
        code: 500,
        message: error.message || '创建支付订单失败',
        data: null
      }
    }
  }

  /**
   * 生成小程序支付参数
   */
  private generateMiniProgramPayParams(prepayId: string): any {
    const appId = process.env.WECHAT_PAY_APPID || ''
    const timeStamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = Math.random().toString(36).substr(2, 32)
    const packageStr = `prepay_id=${prepayId}`

    // 生成签名
    const signStr = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`

    // 这里需要使用微信支付SDK生成签名
    // 为了简化，先返回基础参数
    return {
      appId,
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      // paySign 需要使用商户私钥签名，这里先返回占位符
      paySign: 'TODO_USE_WECHAT_PAY_SDK_TO_SIGN'
    }
  }

  /**
   * 支付结果通知回调
   * POST /api/payment/wechat/notify
   */
  @Post('wechat/notify')
  async paymentNotify(@Req() req: any) {
    try {
      console.log('[PaymentController] 收到支付通知:', req.body)

      // 验证签名
      const { signature, timestamp, nonce } = req.headers
      const body = JSON.stringify(req.body)

      const isValid = await this.wechatPayService.verifyNotify(
        signature,
        timestamp,
        nonce,
        body
      )

      if (!isValid) {
        console.error('[PaymentController] 支付通知签名验证失败')
        return {
          code: 'FAIL',
          message: '签名验证失败'
        }
      }

      // 解密通知内容
      const { resource } = req.body
      const decryptedData = await this.wechatPayService.decryptNotify(
        resource.associated_data,
        resource.nonce,
        resource.ciphertext
      )

      console.log('[PaymentController] 解密后的支付数据:', decryptedData)

      // 更新支付订单状态
      await this.updatePaymentOrder(
        decryptedData.out_trade_no,
        decryptedData.transaction_id,
        'success'
      )

      return {
        code: 'SUCCESS',
        message: '处理成功'
      }
    } catch (error: any) {
      console.error('[PaymentController] 处理支付通知失败:', error)
      return {
        code: 'FAIL',
        message: error.message || '处理失败'
      }
    }
  }

  /**
   * 更新支付订单状态并激活订阅
   */
  private async updatePaymentOrder(
    outTradeNo: string,
    transactionId: string,
    status: string
  ): Promise<void> {
    const client = getSupabaseClient()

    // 查询支付订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .select('*')
      .eq('out_trade_no', outTradeNo)
      .single()

    if (orderError || !order) {
      console.error('[PaymentController] 支付订单不存在:', outTradeNo)
      throw new Error('支付订单不存在')
    }

    // 更新支付订单状态
    await client
      .from('payment_orders')
      .update({
        status,
        transaction_id: transactionId,
        paid_at: new Date().toISOString()
      })
      .eq('id', order.id)

    // 如果支付成功，激活用户订阅
    if (status === 'success') {
      await this.activateUserSubscription(order.user_id, order.plan_id)
    }
  }

  /**
   * 激活用户订阅
   */
  private async activateUserSubscription(userId: string, planId: string): Promise<void> {
    const client = getSupabaseClient()

    // 获取订阅计划
    const { data: plan, error: planError } = await client
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      console.error('[PaymentController] 订阅计划不存在:', planId)
      throw new Error('订阅计划不存在')
    }

    // 计算结束日期
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + plan.duration_days)

    // 创建或更新订阅记录
    await client
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_id: planId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        auto_renew: false
      }, {
        onConflict: 'user_id'
      })

    console.log('[PaymentController] 用户订阅激活成功:', { userId, planId, endDate })
  }

  /**
   * 查询支付订单状态
   * GET /api/payment/order/:outTradeNo
   */
  @Get('order/:outTradeNo')
  async queryOrder(@Req() req: any) {
    try {
      const { outTradeNo } = req.params

      // 查询微信支付订单状态
      const wechatOrder = await this.wechatPayService.queryOrder(outTradeNo)

      // 查询本地订单记录
      const client = getSupabaseClient()
      const { data: localOrder } = await client
        .from('payment_orders')
        .select('*')
        .eq('out_trade_no', outTradeNo)
        .single()

      return {
        code: 200,
        data: {
          ...localOrder,
          wechatStatus: wechatOrder.trade_state,
          wechatOrder
        },
        message: '查询成功'
      }
    } catch (error: any) {
      console.error('[PaymentController] 查询订单失败:', error)
      return {
        code: 500,
        message: error.message || '查询订单失败',
        data: null
      }
    }
  }
}
