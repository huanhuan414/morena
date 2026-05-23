import { Controller, Get, Post, Body, Query, Inject, Headers, BadRequestException, InternalServerErrorException, NotFoundException, HttpException } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { WechatPayService } from '../payment/wechat-pay.service'
import { requireMatchedAuthenticatedUserId } from '../../common/auth-user.util'

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

  /**
   * 匿名边界：该接口保留匿名只读访问，仅返回订阅套餐公开展示信息，不返回用户订阅状态、支付凭证或其它私有字段。
   */
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
  async getStatus(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('userId') userId?: string
  ) {
    const authenticatedUserId = requireMatchedAuthenticatedUserId(headers, userId)
    try {
      if (this.subscriptionService) {
        const status = await this.subscriptionService.getUserSubscription(authenticatedUserId)
        return { code: 200, data: status, message: '获取成功' }
      }
    } catch (e) {
      console.error('[SubscriptionController] getStatus error:', e.message)
    }
    return { code: 200, data: { plan: 'free', features: {} }, message: '获取成功' }
  }

  @Get('check')
  async checkPermission(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('userId') userId: string,
    @Query('type') type: string,
    @Query('currentCount') currentCount?: string,
  ) {
    if (!type) throw new BadRequestException({ msg: '缺少参数', data: null })
    const authenticatedUserId = requireMatchedAuthenticatedUserId(headers, userId)
    try {
      if (this.subscriptionService) {
        const result = await this.subscriptionService.checkPermission(authenticatedUserId, type, currentCount ? Number(currentCount) : 0)
        return { code: 200, data: result, message: '校验成功' }
      }
    } catch (e) {
      if (e instanceof HttpException) throw e
      console.error('[SubscriptionController] checkPermission error:', e.message)
      throw new InternalServerErrorException({ msg: '校验失败', data: null })
    }
    throw new InternalServerErrorException({ msg: '服务暂不可用', data: null })
  }

  @Post('order')
  async createOrder(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('planId') planId: string,
    @Body('openid') openid: string,
    @Body('userId') userId?: string,
  ) {
    const authenticatedUserId = requireMatchedAuthenticatedUserId(headers, userId)
    if (!planId || !openid) throw new BadRequestException({ msg: '缺少必要参数', data: null })
    try {
      if (this.subscriptionService && this.wechatPayService) {
        const plan = await this.subscriptionService.getPlanByPlanId(planId)
        if (!plan) throw new NotFoundException({ msg: '套餐不存在', data: null })
        if (Number(plan.price) === 0) throw new BadRequestException({ msg: '免费计划无需支付', data: null })

        const orderResult = await this.wechatPayService.createOrder({
          planId: plan.id, userId: authenticatedUserId, openid,
          amount: Number(plan.price),
          description: `Morena AI - ${plan.name}`,
        })
        return { code: 200, data: orderResult, message: '下单成功' }
      }
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      console.error('[Subscription] 创建订单失败:', error)
      throw new InternalServerErrorException({ msg: error.message || '创建订单失败', data: null })
    }
    throw new InternalServerErrorException({ msg: '服务暂不可用', data: null })
  }
}
