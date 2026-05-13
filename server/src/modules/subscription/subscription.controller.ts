import { Controller, Get, Post, Body, Headers, Inject } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { WechatPayService } from '../payment/wechat-pay.service'

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly wechatPayService: WechatPayService,
  ) {}

  /**
   * 获取所有订阅套餐
   */
  @Get('plans')
  async getPlans() {
    const plans = await this.subscriptionService.getPlans()
    return {
      code: 200,
      data: plans,
      message: '获取成功',
    }
  }

  /**
   * 获取当前用户的订阅状态
   */
  @Get('status')
  async getStatus(@Headers('x-user-id') userId: string) {
    if (!userId) {
      return { code: 401, data: null, message: '未登录' }
    }
    const status = await this.subscriptionService.getUserSubscription(userId)
    return {
      code: 200,
      data: status,
      message: '获取成功',
    }
  }

  /**
   * 创建支付订单（微信支付）
   */
  @Post('order')
  async createOrder(
    @Body('planId') planId: string,
    @Body('userId') userId: string,
    @Body('openid') openid: string,
  ) {
    if (!planId || !userId || !openid) {
      return { code: 400, data: null, message: '缺少必要参数' }
    }

    try {
      // 1. 查询套餐信息
      const plan = await this.subscriptionService.getPlanById(planId)
      if (!plan) {
        return { code: 404, data: null, message: '套餐不存在' }
      }

      if (Number(plan.price) === 0) {
        return { code: 400, data: null, message: '免费计划无需支付' }
      }

      // 2. 创建支付订单
      const orderResult = await this.wechatPayService.createOrder({
        planId: plan.id,
        userId,
        openid,
        amount: Number(plan.price),
        description: `Morena AI - ${plan.name}`,
      })

      return {
        code: 200,
        data: orderResult,
        message: '下单成功',
      }
    } catch (error: any) {
      console.error('[Subscription] 创建订单失败:', error)
      return {
        code: 500,
        data: null,
        message: error.message || '创建订单失败',
      }
    }
  }
}
