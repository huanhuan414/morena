// @ts-nocheck
import { Controller, Post, Get, Body, Param, Headers, Inject, ForbiddenException } from '@nestjs/common'
import { OrderResultsService, CreateResultDto } from './order-results.service'
import { requireAuthenticatedUserId, rethrowAuthError } from '../../common/auth-user.util'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Controller('order-results')
export class OrderResultsController {
  constructor(@Inject('ORDER_RESULTS_SERVICE') private readonly orderResultsService: OrderResultsService) {}

  private getAuthenticatedUserId(headers: Record<string, string | string[] | undefined>) {
    return requireAuthenticatedUserId(headers)
  }

  private async assertResultResourceAccess(
    userId: string,
    payload: { orderId?: string; order_id?: string; avatarId?: string; avatar_id?: string },
    message: string = '无权操作该订单效果数据'
  ) {
    const orderId = payload.orderId || payload.order_id
    const avatarId = payload.avatarId || payload.avatar_id
    const db = getMySQLClient()

    const [orderRows, avatarRows] = await Promise.all([
      orderId
        ? db.query('SELECT id, user_id FROM orders WHERE id = ? LIMIT 1', [orderId])
        : Promise.resolve([]),
      avatarId
        ? db.query('SELECT id, user_id FROM avatars WHERE id = ? LIMIT 1', [avatarId])
        : Promise.resolve([]),
    ])

    const orderOwnerUserId = orderRows?.[0]?.userId || orderRows?.[0]?.user_id
    const avatarOwnerUserId = avatarRows?.[0]?.userId || avatarRows?.[0]?.user_id

    if (!orderOwnerUserId && !avatarOwnerUserId) {
      throw new Error('订单效果关联资源不存在')
    }

    if (userId !== orderOwnerUserId && userId !== avatarOwnerUserId) {
      throw new ForbiddenException(message)
    }
  }

  /**
   * 提交订单效果数据
   */
  @Post()
  async createResult(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CreateResultDto
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertResultResourceAccess(userId, dto)
      const result = await this.orderResultsService.createResult(dto)
      return {
        code: 200,
        data: result,
        message: '提交成功'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      return {
        code: 500,
        data: null,
        message: error.message || '提交失败'
      }
    }
  }

  /**
   * 获取订单的效果结果列表
   * 匿名边界：该接口保留匿名只读访问，仅返回订单效果展示数据，不返回用户身份、支付信息或其它私有字段。
   */
  @Get('order/:orderId')
  async getOrderResults(@Param('orderId') orderId: string) {
    const results = await this.orderResultsService.getOrderResults(orderId)
    return {
      code: 200,
      data: results,
      message: '获取成功'
    }
  }

  /**
   * 获取分身的效果结果列表
   * 匿名边界：该接口保留匿名只读访问，仅返回分身效果展示数据，不返回资源归属、鉴权态或其它私有字段。
   */
  @Get('avatar/:avatarId')
  async getAvatarResults(@Param('avatarId') avatarId: string) {
    const results = await this.orderResultsService.getAvatarResults(avatarId)
    return {
      code: 200,
      data: results,
      message: '获取成功'
    }
  }
}
