import { Controller, Get, Post, Body, Query, Inject } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { WechatPayService } from '../payment/wechat-pay.service'

@Controller('subscription')
export class SubscriptionController {
  private readonly subscriptionService: SubscriptionService
  private readonly wechatPayService: WechatPayService

  constructor(
    @Inject(SubscriptionService) subscriptionService: SubscriptionService,
    @Inject(WechatPayService) wechatPayService: WechatPayService,
  ) {
    this.subscriptionService = subscriptionService
    this.wechatPayService = wechatPayService
  }

  @Get('plans')
  async getPlans() {
    try {
      if (this.subscriptionService) {
        const plans = await this.subscriptionService.getPlans()
        return { code: 200, data: plans, message: '获取成功' }
      }
    } catch (e) {
      console.error('[SubscriptionController] getPlans error:', e.message)
    }
    return { code: 200, data: [], message: '获取成功' }
  }

  @Get('status')
  async getStatus(@Query('userId') userId: string) {
    if (!userId) return { code: 401, data: null, message: '未登录' }
    try {
      if (this.subscriptionService) {
        const status = await this.subscriptionService.getUserSubscription(userId)
        return { code: 200, data: status, message: '获取成功' }
      }
    } catch (e) {
      console.error('[SubscriptionController] getStatus error:', e.message)
    }
    return { code: 200, data: { plan: 'free', features: {} }, message: '获取成功' }
  }

  @Get('check')
  async checkPermission(
    @Query('userId') userId: string,
    @Query('type') type: string,
    @Query('currentCount') currentCount?: string,
  ) {
    if (!userId || !type) return { code: 400, data: null, message: '缺少参数' }
    try {
      if (this.subscriptionService) {
        const result = await this.subscriptionService.checkPermission(userId, type, currentCount ? Number(currentCount) : 0)
        return { code: 200, data: result, message: '校验成功' }
      }
    } catch (e) {
      console.error('[SubscriptionController] checkPermission error:', e.message)
    }
    return { code: 200, data: { allowed: true, remaining: 999 }, message: '校验成功' }
  }

  @Post('order')
  async createOrder(
    @Body('planId') planId: string,
    @Body('userId') userId: string,
    @Body('openid') openid: string,
  ) {
    if (!planId || !userId || !openid) return { code: 400, data: null, message: '缺少必要参数' }
    try {
      if (this.subscriptionService && this.wechatPayService) {
        const plan = await this.subscriptionService.getPlanByPlanId(planId)
        if (!plan) return { code: 404, data: null, message: '套餐不存在' }
        if (Number(plan.price) === 0) return { code: 400, data: null, message: '免费计划无需支付' }

        const orderResult = await this.wechatPayService.createOrder({
          planId: plan.id, userId, openid,
          amount: Number(plan.price),
          description: `Morena AI - ${plan.name}`,
        })
        return { code: 200, data: orderResult, message: '下单成功' }
      }
    } catch (error: any) {
      console.error('[Subscription] 创建订单失败:', error)
      return { code: 500, data: null, message: error.message || '创建订单失败' }
    }
    return { code: 500, data: null, message: '服务暂不可用' }
  }
}
