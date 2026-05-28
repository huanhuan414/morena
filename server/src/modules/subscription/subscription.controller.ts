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

  @Get('benefits')
  async getBenefits(@Query('userId') userId: string) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    try {
      const benefits = await this.subscriptionService.getMembershipBenefits(userId)
      return { code: 200, data: benefits, message: '获取成功' }
    } catch (e) {
      console.error('[SubscriptionController] getBenefits error:', e.message)
    }
    return { code: 200, data: null, message: '获取失败' }
  }

  @Get('check-order')
  async checkOrder(@Query('userId') userId: string) {
    if (!userId) return { code: 401, allowed: false, message: '请先登录' }
    try {
      const result = await this.subscriptionService.checkOrderPermission(userId)
      return { code: 200, data: result, message: '校验成功' }
    } catch (e) {
      console.error('[SubscriptionController] checkOrder error:', e.message)
    }
    return { code: 200, data: { allowed: false, reason: '服务异常' }, message: '校验失败' }
  }

  @Get('fee-rate')
  async getFeeRate(@Query('userId') userId: string) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    try {
      const feeRate = await this.subscriptionService.getPlatformFeeRate(userId)
      return { 
        code: 200, 
        data: { 
          feeRate,
          feeRatePercent: Math.round(feeRate * 100),
        }, 
        message: '获取成功' 
      }
    } catch (e) {
      console.error('[SubscriptionController] getFeeRate error:', e.message)
    }
    return { code: 200, data: { feeRate: 0.20, feeRatePercent: 20 }, message: '获取失败，使用默认值' }
  }

  @Post('calculate-earnings')
  async calculateEarnings(
    @Body('userId') userId: string,
    @Body('amount') amount: number,
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!amount || amount <= 0) return { code: 400, data: null, message: '金额无效' }
    try {
      const result = await this.subscriptionService.calculateEarnings(userId, amount)
      return { code: 200, data: result, message: '计算成功' }
    } catch (e) {
      console.error('[SubscriptionController] calculateEarnings error:', e.message)
    }
    return { code: 500, data: null, message: '计算失败' }
  }

  @Get('skill-benefits')
  async getSkillBenefits(@Query('userId') userId: string) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    try {
      const benefits = await this.subscriptionService.getSkillBenefits(userId)
      return { code: 200, data: benefits, message: '获取成功' }
    } catch (e) {
      console.error('[SubscriptionController] getSkillBenefits error:', e.message)
    }
    return { code: 500, data: null, message: '获取失败' }
  }

  @Get('check-skill')
  async checkSkill(
    @Query('userId') userId: string,
    @Query('skillType') skillType: string,
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!skillType) return { code: 400, data: null, message: '缺少技能类型' }
    try {
      const result = await this.subscriptionService.checkSkillPermission(userId, skillType)
      return { code: 200, data: result, message: '校验成功' }
    } catch (e) {
      console.error('[SubscriptionController] checkSkill error:', e.message)
    }
    return { code: 500, data: { allowed: false }, message: '校验失败' }
  }

  @Post('record-skill-usage')
  async recordSkillUsage(
    @Body('userId') userId: string,
    @Body('skillType') skillType: string,
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!skillType) return { code: 400, data: null, message: '缺少技能类型' }
    try {
      await this.subscriptionService.recordSkillUsage(userId, skillType)
      return { code: 200, data: null, message: '记录成功' }
    } catch (e) {
      console.error('[SubscriptionController] recordSkillUsage error:', e.message)
    }
    return { code: 500, data: null, message: '记录失败' }
  }

  @Post('batch-skill-usage')
  async getBatchSkillUsage(
    @Body('userId') userId: string,
    @Body('skillTypes') skillTypes: string[]
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!skillTypes || !Array.isArray(skillTypes)) return { code: 400, data: null, message: '缺少技能类型列表' }
    try {
      const result = await this.subscriptionService.getBatchSkillUsage(userId, skillTypes)
      return { code: 200, data: result, message: '获取成功' }
    } catch (e) {
      console.error('[SubscriptionController] getBatchSkillUsage error:', e.message)
    }
    return { code: 500, data: null, message: '获取失败' }
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
