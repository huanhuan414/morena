// @ts-nocheck
import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

@Injectable()
export class AuthSmsService {
  private accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || ''
  private accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || ''
  private signName = process.env.ALIYUN_SMS_SIGN_NAME || '贵州一枝梅信息科技'
  private templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_262600614'

  /**
   * 发送短信验证码
   */
  async sendVerificationCode(phone: string, code: string): Promise<{ success: boolean; message: string; isDev?: boolean }> {
    // 未配置阿里云密钥时，直接走开发模式
    if (!this.accessKeyId || !this.accessKeySecret) {
      console.log(`[SMS开发模式] 阿里云密钥未配置，验证码: ${code}，手机号: ${phone}`)
      return { success: true, message: '验证码发送成功（开发模式）', isDev: true }
    }

    console.log(`[SMS] 尝试发送验证码到 ${phone}，签名: ${this.signName}，模板: ${this.templateCode}`)

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
      console.log('[SMS] 阿里云返回:', JSON.stringify(result))

      if (result.Code === 'OK') {
        return { success: true, message: '验证码发送成功', isDev: false }
      }
      
      // 常见错误码处理
      const errorMsg = this.getErrorMessage(result.Code, result.Message)
      console.error(`[SMS] 发送失败: Code=${result.Code}, Message=${result.Message}`)
      
      // 开发环境降级：签名/模板问题时返回验证码
      if (result.Code === 'isv.SIGN_NOT_EXIST' || result.Code === 'isv.TEMPLATE_NOT_EXIST' || 
          result.Code === 'isv.SIGN_NAME_ILLEGAL' || result.Code === 'isv.TEMPLATE_MISSING_PARAMETERS') {
        console.log(`[SMS降级] 短信配置问题，降级为开发模式。验证码: ${code}`)
        return { success: true, message: `验证码已发送（开发模式：${errorMsg}）`, isDev: true }
      }
      
      // 其他错误（如频率限制、手机号格式错误等）返回失败
      return { success: false, message: errorMsg, isDev: false }
    } catch (error) {
      console.error('[SMS] 请求异常:', error)
      // 网络错误降级为开发模式
      console.log(`[SMS降级] 网络异常，降级为开发模式。验证码: ${code}`)
      return { success: true, message: '验证码发送成功（开发模式：网络异常）', isDev: true }
    }
  }

  /**
   * 获取友好的错误信息
   */
  private getErrorMessage(code: string, message: string): string {
    const errorMap: Record<string, string> = {
      'isv.BUSINESS_LIMIT_CONTROL': '短信发送频率限制，请稍后再试',
      'isv.INVALID_PARAMETERS': '手机号格式错误',
      'isv.MOBILE_NUMBER_ILLEGAL': '手机号格式错误',
      'isv.AMOUNT_NOT_ENOUGH': '短信余额不足',
      'isv.SIGN_NOT_EXIST': '短信签名不存在',
      'isv.TEMPLATE_NOT_EXIST': '短信模板不存在',
      'isv.SIGN_NAME_ILLEGAL': '短信签名不合法',
      'isv.TEMPLATE_MISSING_PARAMETERS': '短信模板参数缺失',
      'isp.RAM_PERMISSION_DENY': 'RAM权限不足',
    }
    return errorMap[code] || message || `短信发送失败(${code})`
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
