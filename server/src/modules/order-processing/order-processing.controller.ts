// @ts-nocheck
import { Controller, Get, Post, Put, Param, Body, Headers, Query, Inject, ForbiddenException, InternalServerErrorException, HttpException } from '@nestjs/common'
import { OrderProcessingService } from './order-processing.service'
import { LinkValidationService } from './link-validation.service'
import { assertResourceOwner, requireAuthenticatedUserId, rethrowAuthError } from '../../common/auth-user.util'

@Controller('order-processing')
export class OrderProcessingController {
  constructor(
    @Inject(OrderProcessingService) private readonly processingService: OrderProcessingService,
    @Inject(LinkValidationService) private readonly linkValidationService: LinkValidationService
  ) {}

  private getAuthenticatedUserId(headers: Record<string, string | string[] | undefined>) {
    return requireAuthenticatedUserId(headers)
  }

  private async ensureProcessingOwner(identifier: string, userId: string, view?: string) {
    const record = await this.processingService.getProcessingStatus(identifier, userId, view)
      || await this.processingService.getProcessingByRequestId(identifier, view)
    if (!record) {
      return null
    }
    let ownerUserId = record.userId || record.user_id
    if (!ownerUserId) {
      const orderId = record.orderId || record.order_id || identifier
      const db = require('../../storage/database/mysql-client').getMySQLClient()
      const rows = await db.query(
        `SELECT user_id
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [orderId]
      )
      const orderOwnerUserId = rows?.[0]?.userId || rows?.[0]?.user_id
      if (!orderOwnerUserId) {
        throw new ForbiddenException('无权访问该订单处理记录')
      }
      const requestId = record.requestId || record.id || record.request_id || identifier
      await db.query(
        `UPDATE content_generation_requests
         SET user_id = ?
         WHERE id = ?
           AND (user_id IS NULL OR user_id = '')`,
        [orderOwnerUserId, requestId]
      )
      record.userId = orderOwnerUserId
      record.user_id = orderOwnerUserId
      ownerUserId = orderOwnerUserId
    }
    assertResourceOwner(userId, ownerUserId, '无权访问该订单处理记录')
    return record
  }

  private async assertDisputeOwner(disputeId: string, userId: string) {
    const db = require('../../storage/database/mysql-client').getMySQLClient()
    const rows = await db.query(
      `SELECT id, user_id
       FROM order_disputes
       WHERE id = ?
       LIMIT 1`,
      [disputeId]
    )
    const dispute = rows?.[0]
    if (!dispute) {
      throw new Error('争议不存在')
    }
    assertResourceOwner(userId, dispute.userId || dispute.user_id, '无权操作该争议记录')
    return dispute
  }

  /**
   * 根据 orderId 查询内容生成状态
   * 路径: GET /api/order-processing/status/:orderId
   */
  @Get('status/:id')
  async getStatus(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('view') view?: string
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const status = await this.ensureProcessingOwner(id, userId, view)

      return {
        code: 200,
        data: status,
        message: status ? '获取成功' : '暂无生成记录'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '获取失败', data: null })
    }
  }

  /**
   * 验证链接并获取作品信息
   */
  @Post('validate-link')
  async validateLink(
    @Body('url') url: string,
    @Body('orderId') orderId?: string,
    @Body('avatarId') avatarId?: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      this.getAuthenticatedUserId(headers)
      const result = await this.linkValidationService.validateLink(url, orderId, avatarId)
      return {
        code: 200,
        data: result,
        message: result.success ? '验证成功' : '验证失败'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({
        msg: error.message || '验证失败',
        data: {
          success: false,
          platform: 'unknown',
          error: error.message || '验证失败'
        },
      })
    }
  }

  /**
   * 创建处理订单
   */
  @Post('create')
  async createProcessing(
    @Body() body: any,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const result = await this.processingService.createProcessingOrder({
        order_id: body.order_id,
        avatar_id: body.avatar_id,
        user_id: userId,
        config: body.config
      })
      return {
        code: 200,
        data: result,
        message: '创建成功'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '创建失败', data: null })
    }
  }

  /**
   * 确认内容并进入发布流程
   * 支持 requestId / orderId
   */
  @Post('confirm/:id')
  async confirmContent(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('content') content?: string
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.confirmProcessing(id, content)
      return {
        code: 200,
        data: result,
        message: result ? '确认成功' : '记录不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '确认失败', data: null })
    }
  }

  /**
   * 执行发布
   * 支持 requestId / orderId
   */
  @Post('publish/:id')
  async publishContent(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('platforms') platforms?: string[]
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.publishProcessing(id, platforms)
      return {
        code: 200,
        data: result,
        message: result ? '发布成功' : '记录不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '发布失败', data: null })
    }
  }

  /**
   * 提交发布反馈
   * 支持 requestId / orderId
   */
  @Post('feedback/:id')
  async submitFeedback(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('feedback') feedback: Record<string, any>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.submitFeedback(id, feedback || {})
      return {
        code: 200,
        data: result,
        message: result ? '反馈提交成功' : '记录不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '反馈提交失败', data: null })
    }
  }

  /**
   * 验收通过
   * 支持 requestId / orderId
   */
  @Put('accept/:id')
  async acceptContent(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    console.log(`[OrderProcessingController] 验收请求: id=${id}`)
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.acceptProcessing(id)
      console.log(`[OrderProcessingController] 验收结果:`, JSON.stringify(result))
      return {
        code: 200,
        data: result,
        message: result ? '验收成功' : '记录不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      console.error(`[OrderProcessingController] 验收失败:`, error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '验收失败', data: null })
    }
  }

  @Post('dispute/:id')
  async openDispute(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('reason') reason?: string,
    @Body('evidence') evidence?: any
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.createDispute(id, { reason, evidence })
      return {
        code: 200,
        data: result,
        message: result ? '已发起争议' : '记录不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '发起争议失败', data: null })
    }
  }

  @Get('disputes')
  async listDisputes(
    @Query('status') status: string = 'open',
    @Query('limit') limit: number = 50
  ) {
    try {
      const result = await this.processingService.listDisputes(status, Number(limit) || 50)
      return {
        code: 200,
        data: result,
        message: 'success'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '获取争议列表失败', data: null })
    }
  }

  @Post('disputes/resolve')
  async resolveDispute(
    @Body('dispute_id') disputeId: string,
    @Body('resolution') resolution: string,
    @Body('note') note?: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertDisputeOwner(disputeId, userId)
      const result = await this.processingService.resolveDispute(disputeId, { resolution, note })
      return {
        code: 200,
        data: result,
        message: result ? '已处理' : '争议不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '处理争议失败', data: null })
    }
  }

  @Post('urge-acceptance/:id')
  async urgeAcceptance(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.urgeAcceptance(id)
      if (!result) {
        return {
          code: 200,
          data: null,
          message: '记录不存在'
        }
      }
      if (!result.success) {
        return {
          code: 200,
          data: result,
          message: result.cooldownRemainingMs ? '催促过于频繁，请稍后再试' : '催促失败'
        }
      }
      return {
        code: 200,
        data: result,
        message: '已催促发单者验收'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '催促失败', data: null })
    }
  }

  /**
   * 请求修改
   * 支持 requestId / orderId
   */
  @Post('revision/:id')
  async requestRevision(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('feedback') feedback: Record<string, any>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.ensureProcessingOwner(id, userId)
      const result = await this.processingService.requestRevision(id, feedback || {})
      return {
        code: 200,
        data: result,
        message: result ? '已发起修改' : '记录不存在'
      }
    } catch (error: any) {
      rethrowAuthError(error)
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '发起修改失败', data: null })
    }
  }
}
