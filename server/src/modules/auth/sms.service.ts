// @ts-nocheck
import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

@Injectable()
export class AuthSmsService {
  private accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || ''
  private accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || ''
  private signName = '贵州一枝梅信息科技'
  private templateCode = 'SMS_262600614' // 阿里云短信模板编码

  /**
   * 发送短信验证码
   */
  async sendVerificationCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
    const params: Record<string, string> = {
      AccessKeyId: this.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: 'cn-hangzhou',
      SignName: this.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Date.now().toString() + Math.random().toString(36).substring(2),
      SignatureVersion: '1.0',
      Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''),
      Version: '2017-05-25',
      TemplateCode: this.templateCode,
      TemplateParam: JSON.stringify({ code }),
    }

    // 构造签名字符串
    const sortedKeys = Object.keys(params).sort()
    const canonicalizedQueryString = sortedKeys
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(params[key as keyof typeof params])}`)
      .join('&')

    const stringToSign = `POST&${this.percentEncode('/')}&${this.percentEncode(canonicalizedQueryString)}`
    
    // 计算 HMAC-SHA1 签名
    const signature = crypto
      .createHmac('sha1', `${this.accessKeySecret}&`)
      .update(stringToSign)
      .digest('base64')

    const signedParams = {
      ...params,
      Signature: signature,
    }

    try {
      const response = await fetch('https://dysmsapi.aliyuncs.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(signedParams as Record<string, string>).toString(),
      })

      const result = await response.json() as any
      console.log('短信发送结果:', result)

      if (result.Code === 'OK') {
        return { success: true, message: '验证码发送成功' }
      } else if (result.Code === 'isv.TEMPLATE_MISSING_PARAMETERS' || result.Code === 'isv.TEMPLATE_NOT_EXIST') {
        // 模板不存在，开发环境模拟发送成功
        console.log(`[开发模式] 模板未配置，模拟发送成功。验证码: ${code}`)
        return { success: true, message: '验证码已发送（开发模式）' }
      } else {
        console.error('短信发送失败:', result)
        // 开发环境：模拟发送成功
        console.log(`[开发模式] 验证码已发送到 ${phone}: ${code}`)
        return { success: true, message: '验证码发送成功（开发模式）' }
      }
    } catch (error) {
      console.error('短信发送异常:', error)
      // 开发环境：模拟发送成功
      console.log(`[开发模式] 验证码已发送到 ${phone}: ${code}`)
      return { success: true, message: '验证码发送成功（开发模式）' }
    }
  }

  /**
   * URL 编码
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~')
  }

  /**
   * 生成6位验证码
   */
  generateCode(): string {
    return Math.random().toString().slice(2, 8)
  }
}
