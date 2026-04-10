import { Controller, Get, Post, Headers, Param, Body } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

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
   * 创建订阅订单（模拟支付流程）
   */
  @Post('order')
  async createSubscriptionOrder(
    @Headers('x-user-id') userId: string,
    @Body() body: { planId: string, paymentMethod?: string }
  ) {
    try {
      const { planId, paymentMethod } = body

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

      // 计算结束日期
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + plan.duration_days)

      // 创建订阅记录
      const { data: subscription, error: subError } = await client
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          payment_id: `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          payment_method: paymentMethod || 'wechat',
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
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '创建订阅失败',
        data: null
      }
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
