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
 * 订单支付请求体接口
 */
interface CreateOrderPaymentRequest {
  orderId: string
  amount: number
  description: string
  openid: string
  platform?: 'miniprogram' | 'h5'
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

      // 检查微信支付服务是否可用
      if (!this.wechatPayService.isServiceAvailable()) {
        const configStatus = this.wechatPayService.getConfigStatus()
        console.error('[PaymentController] 微信支付服务未初始化，配置状态:', configStatus)
        return {
          code: 400,
          message: '微信支付服务未初始化',
          data: {
            isAvailable: configStatus.isAvailable,
            missingConfigs: configStatus.missingConfigs,
            instructions: configStatus.instructions,
            currentConfig: {
              hasAppid: !!process.env.WECHAT_PAY_APPID,
              hasMchid: !!process.env.WECHAT_PAY_MCHID,
              hasPrivateKey: !!(process.env.WECHAT_PAY_PRIVATE_KEY || process.env.WECHAT_PAY_PRIVATE_KEY_PATH),
              hasKey: !!process.env.WECHAT_PAY_APIV3_KEY
            }
          }
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
   * 创建订单支付
   * POST /api/payment/wechat/create-order-payment
   */
  @Post('wechat/create-order-payment')
  async createOrderPayment(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateOrderPaymentRequest
  ) {
    try {
      const { orderId, amount, description, openid, platform = 'miniprogram' } = body

      console.log('[PaymentController] 开始创建订单支付:', {
        userId,
        orderId,
        amount,
        description,
        openid,
        platform
      })

      if (!openid) {
        console.error('[PaymentController] 缺少用户openid')
        return {
          code: 400,
          message: '缺少用户openid',
          data: null
        }
      }

      const client = getSupabaseClient()

      // 验证订单是否存在
      const { data: order, error: orderError } = await client
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single()

      if (orderError || !order) {
        console.error('[PaymentController] 订单不存在:', { orderId, userId, error: orderError })
        return {
          code: 400,
          message: '订单不存在',
          data: null
        }
      }

      console.log('[PaymentController] 订单查询成功，当前状态:', order.status, '预算:', order.budget)

      // 检查订单状态
      if (order.status !== 'pending_payment' && order.status !== 'paying') {
        console.error('[PaymentController] 订单状态不正确，当前状态:', order.status, '期望状态: pending_payment 或 paying')
        return {
          code: 400,
          message: `订单状态不正确，当前状态：${order.status}，期望状态：待支付或支付中`,
          data: {
            currentStatus: order.status,
            expectedStatus: ['pending_payment', 'paying']
          }
        }
      }

      // 防并发：检查是否已有支付中的订单
      const { data: existingPayment } = await client
        .from('order_payments')
        .select('*')
        .eq('order_id', orderId)
        .in('status', ['pending', 'paying'])
        .maybeSingle()

      if (existingPayment) {
        console.log('[PaymentController] 订单已在支付中，返回已有支付记录:', existingPayment.id)
        return {
          code: 400,
          message: '订单已在支付中，请勿重复操作',
          data: {
            paymentId: existingPayment.id,
            ...existingPayment.payment_params
          }
        }
      }

      // 将订单状态改为支付中（防并发）
      console.log('[PaymentController] 尝试更新订单状态: pending_payment -> paying')
      const { error: updateError } = await client
        .from('orders')
        .update({ status: 'paying' })
        .eq('id', orderId)
        .eq('status', 'pending_payment')

      if (updateError) {
        console.error('[PaymentController] 订单状态更新失败:', updateError)
        // 查询订单当前状态
        const { data: currentOrder } = await client
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single()

        return {
          code: 400,
          message: `订单状态已变更，请刷新后重试。当前状态：${currentOrder?.status || 'unknown'}`,
          data: null
        }
      }

      console.log('[PaymentController] 订单状态更新成功: paying')

      // 检查微信支付服务是否可用
      if (!this.wechatPayService.isServiceAvailable()) {
        const configStatus = this.wechatPayService.getConfigStatus()
        console.error('[PaymentController] 微信支付服务未初始化，配置状态:', configStatus)
        return {
          code: 400,
          message: '微信支付服务未初始化',
          data: {
            isAvailable: configStatus.isAvailable,
            missingConfigs: configStatus.missingConfigs,
            instructions: configStatus.instructions,
            currentConfig: {
              hasAppid: !!process.env.WECHAT_PAY_APPID,
              hasMchid: !!process.env.WECHAT_PAY_MCHID,
              hasPrivateKey: !!(process.env.WECHAT_PAY_PRIVATE_KEY || process.env.WECHAT_PAY_PRIVATE_KEY_PATH),
              hasKey: !!process.env.WECHAT_PAY_APIV3_KEY
            }
          }
        }
      }

      // 生成商户订单号
      const outTradeNo = `ORDER_${userId}_${orderId}_${Date.now()}`

      // 创建统一下单（金额单位：分）
      const totalAmount = Math.round(amount * 100) // 元转分

      console.log('[PaymentController] 创建微信支付订单:', {
        platform,
        orderId,
        outTradeNo,
        totalAmount,
        openid,
        description
      })

      // 根据平台调用不同的支付接口
      let wechatOrderResult: any
      let payParams: any

      try {
        if (platform === 'h5') {
          // H5端：使用微信H5支付
          console.log('[PaymentController] 调用微信H5支付接口')
          wechatOrderResult = await this.wechatPayService.createH5Order(
            description,
            outTradeNo,
            totalAmount
          )

          console.log('[PaymentController] H5支付订单创建成功:', wechatOrderResult)

          if (wechatOrderResult.h5_url) {
            payParams = {
              mweb_url: wechatOrderResult.h5_url
            }
          } else {
            throw new Error('微信H5支付订单创建失败：h5_url为空')
          }
        } else {
          // 小程序端：使用小程序支付
          console.log('[PaymentController] 调用微信小程序支付接口')
          wechatOrderResult = await this.wechatPayService.createOrder(
            description,
            outTradeNo,
            totalAmount,
            openid
          )

          console.log('[PaymentController] 小程序支付订单创建成功:', wechatOrderResult)

          if (wechatOrderResult.prepay_id) {
            // 生成小程序支付参数
            payParams = this.generateMiniProgramPayParams(wechatOrderResult.prepay_id)
          } else {
            throw new Error('微信支付订单创建失败：prepay_id为空')
          }
        }

        // 创建支付记录
        console.log('[PaymentController] 创建支付记录')
        const { data: payment, error: paymentError } = await client
          .from('order_payments')
          .insert({
            user_id: userId,
            order_id: orderId,
            out_trade_no: outTradeNo,
            transaction_id: wechatOrderResult.prepay_id || wechatOrderResult.h5_url,
            total_amount: totalAmount,
            status: 'paying',
            payment_method: 'wechat',
            payment_params: payParams,
            platform
          })
          .select()
          .single()

        if (paymentError) {
          console.error('[PaymentController] 创建支付记录失败:', paymentError)
          // 回滚订单状态
          console.log('[PaymentController] 回滚订单状态: paying -> pending_payment')
          await client
            .from('orders')
            .update({ status: 'pending_payment' })
            .eq('id', orderId)
          throw new Error(`创建支付记录失败: ${paymentError.message}`)
        }

        console.log('[PaymentController] 支付记录创建成功，支付ID:', payment.id)

        return {
          code: 200,
          data: {
            paymentId: payment.id,
            orderId,
            outTradeNo,
            platform,
            ...payParams
          },
          message: '支付订单创建成功'
        }
      } catch (error: any) {
        // 支付失败，回滚订单状态
        console.error('[PaymentController] 创建微信支付订单失败，回滚订单状态:', error)
        await client
          .from('orders')
          .update({ status: 'pending_payment' })
          .eq('id', orderId)
          .eq('status', 'paying')
        throw error
      }
    } catch (error: any) {
      console.error('[PaymentController] 创建订单支付失败:', error)
      return {
        code: 500,
        message: error.message || '创建订单支付失败',
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
