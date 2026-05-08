// @ts-nocheck
import { Controller, Get, Post, Headers, Param, Body } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
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
      const result = await this.subscriptionService.canReceiveOrders(avatarId)
      return {
        code: 200,
        data: result,
        message: result.canReceive ? '可以接单' : '无法接单'
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
   * 创建订阅
   */
  @Post('create')
  async createSubscription(
    @Headers('x-user-id') userId: string,
    @Body() body: { planId: string }
  ) {
    try {
      const result = await this.subscriptionService.createSubscription(userId, body.planId)
      return {
        code: 200,
        data: result,
        message: '订阅创建成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '订阅创建失败',
        data: null
      }
    }
  }
}
