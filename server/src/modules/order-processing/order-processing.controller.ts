// @ts-nocheck
import { Controller, Get, Post, Put, Param, Body, Headers, Query, Inject } from '@nestjs/common'
import { OrderProcessingService } from './order-processing.service'
import { LinkValidationService } from './link-validation.service'

@Controller('order-processing')
export class OrderProcessingController {
  constructor(
    @Inject(OrderProcessingService) private readonly processingService: OrderProcessingService,
    @Inject(LinkValidationService) private readonly linkValidationService: LinkValidationService
  ) {}

  /**
   * 根据 orderId 查询内容生成状态
   * 路径: GET /api/order-processing/status/:orderId
   */
  @Get('status/:id')
  async getStatus(
    @Param('id') id: string
  ) {
    try {
      // 先按 orderId 查询
      let status = await this.processingService.getProcessingStatus(id)

      // 如果没找到，再按 requestId 查询
      if (!status) {
        status = await this.processingService.getProcessingByRequestId(id)
      }

      return {
        code: 200,
        data: status,
        message: status ? '获取成功' : '暂无生成记录'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取失败'
      }
    }
  }

  /**
   * 验证链接并获取作品信息
   */
  @Post('validate-link')
  async validateLink(
    @Body('url') url: string,
    @Body('orderId') orderId?: string,
    @Body('avatarId') avatarId?: string
  ) {
    try {
      const result = await this.linkValidationService.validateLink(url, orderId, avatarId)
      return {
        code: 200,
        data: result,
        message: result.success ? '验证成功' : '验证失败'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: {
          success: false,
          platform: 'unknown',
          error: error.message || '验证失败'
        },
        message: error.message || '验证失败'
      }
    }
  }

  /**
   * 创建处理订单
   */
  @Post('create')
  async createProcessing(
    @Body() body: any,
    @Headers('x-user-id') userId: string
  ) {
    try {
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
      return {
        code: 500,
        data: null,
        message: error.message || '创建失败'
      }
    }
  }

  /**
   * 确认内容并进入发布流程
   * 支持 requestId / orderId
   */
  @Post('confirm/:id')
  async confirmContent(
    @Param('id') id: string,
    @Body('content') content?: string
  ) {
    try {
      const result = await this.processingService.confirmProcessing(id, content)
      return {
        code: 200,
        data: result,
        message: result ? '确认成功' : '记录不存在'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '确认失败'
      }
    }
  }

  /**
   * 执行发布
   * 支持 requestId / orderId
   */
  @Post('publish/:id')
  async publishContent(
    @Param('id') id: string,
    @Body('platforms') platforms?: string[]
  ) {
    try {
      const result = await this.processingService.publishProcessing(id, platforms)
      return {
        code: 200,
        data: result,
        message: result ? '发布成功' : '记录不存在'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '发布失败'
      }
    }
  }

  /**
   * 提交发布反馈
   * 支持 requestId / orderId
   */
  @Post('feedback/:id')
  async submitFeedback(
    @Param('id') id: string,
    @Body('feedback') feedback: Record<string, any>
  ) {
    try {
      const result = await this.processingService.submitFeedback(id, feedback || {})
      return {
        code: 200,
        data: result,
        message: result ? '反馈提交成功' : '记录不存在'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '反馈提交失败'
      }
    }
  }

  /**
   * 验收通过
   * 支持 requestId / orderId
   */
  @Put('accept/:id')
  async acceptContent(@Param('id') id: string) {
    console.log(`[OrderProcessingController] 验收请求: id=${id}`)
    try {
      const result = await this.processingService.acceptProcessing(id)
      console.log(`[OrderProcessingController] 验收结果:`, JSON.stringify(result))
      return {
        code: 200,
        data: result,
        message: result ? '验收成功' : '记录不存在'
      }
    } catch (error: any) {
      console.error(`[OrderProcessingController] 验收失败:`, error)
      return {
        code: 500,
        data: null,
        message: error.message || '验收失败'
      }
    }
  }

  @Post('dispute/:id')
  async openDispute(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Body('evidence') evidence?: any
  ) {
    try {
      const result = await this.processingService.createDispute(id, { reason, evidence })
      return {
        code: 200,
        data: result,
        message: result ? '已发起争议' : '记录不存在'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '发起争议失败'
      }
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
      return {
        code: 500,
        data: null,
        message: error.message || '获取争议列表失败'
      }
    }
  }

  @Post('disputes/resolve')
  async resolveDispute(
    @Body('dispute_id') disputeId: string,
    @Body('resolution') resolution: string,
    @Body('note') note?: string
  ) {
    try {
      const result = await this.processingService.resolveDispute(disputeId, { resolution, note })
      return {
        code: 200,
        data: result,
        message: result ? '已处理' : '争议不存在'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '处理争议失败'
      }
    }
  }

  @Post('urge-acceptance/:id')
  async urgeAcceptance(@Param('id') id: string) {
    try {
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
      return {
        code: 500,
        data: null,
        message: error.message || '催促失败'
      }
    }
  }

  /**
   * 请求修改
   * 支持 requestId / orderId
   */
  @Post('revision/:id')
  async requestRevision(
    @Param('id') id: string,
    @Body('feedback') feedback: Record<string, any>
  ) {
    try {
      const result = await this.processingService.requestRevision(id, feedback || {})
      return {
        code: 200,
        data: result,
        message: result ? '已发起修改' : '记录不存在'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '发起修改失败'
      }
    }
  }
}
