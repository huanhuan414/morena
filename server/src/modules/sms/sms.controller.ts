import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { SmsService, SendSmsParams } from './sms.service'

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * 发送短信
   */
  @Post('send')
  async sendSms(@Body() params: SendSmsParams) {
    const success = await this.smsService.sendSms(params.phone, params.templateCode, params.params)
    return {
      code: success ? 200 : 500,
      msg: success ? '发送成功' : '发送失败',
      data: { success }
    }
  }

  /**
   * 发送订单调度通知
   */
  @Post('notify/dispatch')
  async notifyDispatch(@Body() body: { phone: string; avatarName: string; orderId: string }) {
    const success = await this.smsService.sendOrderDispatchNotification(
      body.phone,
      body.avatarName,
      body.orderId
    )
    return {
      code: success ? 200 : 500,
      msg: success ? '发送成功' : '发送失败',
      data: { success }
    }
  }

  /**
   * 发送订单完成通知
   */
  @Post('notify/completion')
  async notifyCompletion(@Body() body: { phone: string; orderId: string }) {
    const success = await this.smsService.sendOrderCompletionNotification(body.phone, body.orderId)
    return {
      code: success ? 200 : 500,
      msg: success ? '发送成功' : '发送失败',
      data: { success }
    }
  }

  /**
   * 获取短信模板列表
   */
  @Get('templates')
  async getTemplates() {
    return {
      code: 200,
      msg: '获取成功',
      data: this.smsService.getTemplates()
    }
  }
}
