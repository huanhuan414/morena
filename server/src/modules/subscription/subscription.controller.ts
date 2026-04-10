import { Controller, Get, Post, Headers, Param, Body } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { WechatPayService } from '../payment/wechat-pay.service'

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly wechatPayService: WechatPayService
  ) {}

  /**
   * 获取所有订阅计划
   */
  @Get('plans')
  async getSubscriptionPlans() {
    try {
      const plans = await this.subscriptionService.getSubscriptionPlans()
      return {
        code: 200,
        data: plans,
        message: '获取成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '获取失败',
        data: null
      }
    }
  }

  /**
   * 获取用户当前订阅
   */
  @Get('user')
  async getUserSubscription(@Headers('x-user-id') userId: string) {
    try {
      const subscription = await this.subscriptionService.getUserSubscription(userId)
      return {
        code: 200,
        data: subscription,
        message: '获取成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '获取失败',
        data: null
      }
    }
  }

  /**
   * 获取分身订阅信息
   */
  @Get('avatar/:avatarId')
  async getAvatarSubscription(@Param('avatarId') avatarId: string) {
    try {
      const subscription = await this.subscriptionService.getAvatarSubscription(avatarId)
      return {
        code: 200,
        data: subscription,
        message: '获取成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '获取失败',
        data: null
      }
    }
  }

  /**
   * 检查是否可以创建分身
   */
  @Get('check/create-avatar')
  async checkCanCreateAvatar(@Headers('x-user-id') userId: string) {
    try {
      const result = await this.subscriptionService.canCreateAvatar(userId)
      return {
        code: 200,
        data: result,
        message: result.canCreate ? '可以创建' : '无法创建'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '检查失败',
        data: null
      }
    }
  }

  /**
   * 检查分身是否可以接单
   */
  @Get('check/receive-orders/:avatarId')
  async checkCanReceiveOrders(@Param('avatarId') avatarId: string) {
    try {
      const canReceive = await this.subscriptionService.canAvatarReceiveOrders(avatarId)
      return {
        code: 200,
        data: { canReceive },
        message: canReceive ? '可以接单' : '无法接单'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '检查失败',
        data: null
      }
    }
  }

  /**
   * 创建订阅订单（支持微信支付）
   */
  @Post('order')
  async createSubscriptionOrder(
    @Headers('x-user-id') userId: string,
    @Body() body: { planId: string, paymentMethod?: string, openid?: string }
  ) {
    try {
      const { planId, paymentMethod, openid } = body

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

      // 免费订阅直接激活
      if (plan.price === 0) {
        const startDate = new Date()
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + plan.duration_days)

        const { data: subscription, error: subError } = await client
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            status: 'active',
            payment_id: `FREE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            payment_method: 'free',
            auto_renew: false
          })
          .select()
          .single()

        if (subError) {
          throw new Error(`创建订阅失败: ${subError.message}`)
        }

        // 更新用户所有分身的订阅信息
        const { data: avatars } = await client
          .from('avatars')
          .select('id')
          .eq('user_id', userId)

        if (avatars) {
          for (const avatar of avatars) {
            await this.subscriptionService.updateAvatarSubscription(avatar.id, userId)
          }
        }

        return {
          code: 200,
          data: {
            subscriptionId: subscription.id,
            plan: plan.name,
            price: plan.price,
            startDate: subscription.start_date,
            endDate: subscription.end_date
          },
          message: '订阅成功'
        }
      }

      // 付费订阅需要微信支付
      if (paymentMethod === 'wechat') {
        if (!openid) {
          return {
            code: 400,
            message: '缺少用户openid',
            data: null
          }
        }

        // 检查支付服务是否可用
        if (!this.wechatPayService.isServiceAvailable()) {
          console.warn('[SubscriptionController] 微信支付服务未配置，使用模拟支付模式')
          return this.createMockOrder(userId, planId, plan, openid, client)
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

        console.log('[SubscriptionController] 微信支付订单创建成功:', orderResult)

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
            console.error('[SubscriptionController] 创建支付订单记录失败:', orderError)
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
      }

      return {
        code: 400,
        message: '暂不支持该支付方式',
        data: null
      }
    } catch (error: any) {
      console.error('[SubscriptionController] 创建订阅订单失败:', error)
      return {
        code: 500,
        message: error.message || '创建订阅失败',
        data: null
      }
    }
  }

  /**
   * 创建模拟支付订单（用于测试环境）
   */
  private async createMockOrder(
    userId: string,
    planId: string,
    plan: any,
    openid: string,
    client: any
  ) {
    console.log('[SubscriptionController] 创建模拟支付订单')

    // 生成商户订单号
    const outTradeNo = `MOCK_SUB_${userId}_${Date.now()}`

    // 模拟小程序支付参数
    const payParams = {
      appId: process.env.WECHAT_APPID || '',
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: Math.random().toString(36).substr(2, 32),
      package: 'prepay_id=mock_prepay_id',
      signType: 'RSA',
      paySign: 'mock_pay_sign_for_testing'
    }

    // 直接激活订阅，跳过支付订单记录
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + plan.duration_days)

    const { data: subscription, error: subError } = await client
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        payment_id: outTradeNo,
        payment_method: 'mock',
        auto_renew: false
      })
      .select()
      .single()

    if (subError) {
      console.error('[SubscriptionController] 创建订阅失败:', subError)
      throw new Error('创建订阅失败')
    }

    // 更新用户所有分身的订阅信息
    const { data: avatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)

    if (avatars) {
      for (const avatar of avatars) {
        await this.subscriptionService.updateAvatarSubscription(avatar.id, userId)
      }
    }

    return {
      code: 200,
      data: {
        orderId: 'mock-order-id',
        outTradeNo,
        prepayId: 'mock_prepay_id',
        ...payParams,
        isMock: true // 标记为模拟支付
      },
      message: '订阅成功（模拟支付）'
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
   * 检查是否可以添加好友
   */
  @Get('check/add-friend')
  async checkCanAddFriend(@Headers('x-user-id') userId: string) {
    try {
      const result = await this.subscriptionService.canAddFriend(userId)
      return {
        code: 200,
        data: result,
        message: result.canAdd ? '可以添加好友' : '无法添加好友'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '检查失败',
        data: null
      }
    }
  }

  /**
   * 获取用户的好友数量限制
   */
  @Get('friend-limit')
  async getFriendLimit(@Headers('x-user-id') userId: string) {
    try {
      const result = await this.subscriptionService.getFriendLimit(userId)
      return {
        code: 200,
        data: result,
        message: '获取成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '获取失败',
        data: null
      }
    }
  }
}
