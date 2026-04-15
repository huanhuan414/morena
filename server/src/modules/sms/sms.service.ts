import { Injectable } from '@nestjs/common'

export interface SendSmsParams {
  phone: string
  templateCode: string
  params: Record<string, string>
}

export interface SmsTemplate {
  code: string
  name: string
  content: string
}

@Injectable()
export class SmsService {
  /**
   * 发送短信
   * @param phone 手机号
   * @param templateCode 模板代码
   * @param params 模板参数
   */
  async sendSms(phone: string, templateCode: string, params: Record<string, string>): Promise<boolean> {
    try {
      // TODO: 集成实际的短信服务（阿里云、腾讯云等）
      console.log('[SmsService] 发送短信:', { phone, templateCode, params })

      // 临时模拟发送成功
      // 实际使用时需要替换为真实的短信服务调用
      // 例如：
      // const result = await this.aliyunSmsClient.send({
      //   phoneNumbers: phone,
      //   templateCode,
      //   templateParam: JSON.stringify(params)
      // })
      // return result.Code === 'OK'

      return true
    } catch (error) {
      console.error('[SmsService] 发送短信失败:', error)
      return false
    }
  }

  /**
   * 发送订单调度通知短信
   * @param phone 手机号
   * @param avatarName 分身名称
   * @param orderId 订单ID
   */
  async sendOrderDispatchNotification(phone: string, avatarName: string, orderId: string): Promise<boolean> {
    return this.sendSms(phone, 'SMS_505555078', {
      name: avatarName
    })
  }

  /**
   * 发送订单完成通知短信
   * @param phone 手机号
   * @param orderId 订单ID
   */
  async sendOrderCompletionNotification(phone: string, orderId: string): Promise<boolean> {
    return this.sendSms(phone, 'ORDER_COMPLETION', {
      orderId: orderId.substring(0, 8)
    })
  }

  /**
   * 发送内容生成完成通知短信
   * @param phone 手机号
   * @param avatarName 分身名称
   * @param orderId 订单ID
   */
  async sendContentGeneratedNotification(phone: string, avatarName: string, orderId: string): Promise<boolean> {
    return this.sendSms(phone, 'CONTENT_GENERATED', {
      avatarName,
      orderId: orderId.substring(0, 8)
    })
  }

  /**
   * 获取可用的短信模板列表
   */
  getTemplates(): SmsTemplate[] {
    return [
      {
        code: 'SMS_505555078',
        name: '订单调度通知',
        content: '亲爱的，您的分身${name}的接到新的订单啦，快去确认一下！马上开始赚钱啦'
      },
      {
        code: 'ORDER_COMPLETION',
        name: '订单完成通知',
        content: '订单${orderId}已全部完成，请查看统计报表。'
      },
      {
        code: 'CONTENT_GENERATED',
        name: '内容生成完成通知',
        content: '您的分身${avatarName}已完成订单${orderId}的内容生成。'
      }
    ]
  }
}
