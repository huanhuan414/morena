import { Controller, Post, Body, Get, Headers, Inject, Req } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(@Inject("AUTH_SERVICE") private readonly authService: AuthService) {}

  /**
   * 获取客户端真实IP
   */
  private getClientIp(request: Request): string {
    // 优先级：X-Forwarded-For > X-Real-IP > remoteAddress
    const forwardedFor = request.headers['x-forwarded-for']
    if (forwardedFor) {
      // X-Forwarded-For可能包含多个IP，取第一个（客户端IP）
      return forwardedFor.toString().split(',')[0].trim()
    }

    const realIp = request.headers['x-real-ip']
    if (realIp) {
      return realIp.toString()
    }

    // 最后使用连接IP
    return request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           'unknown'
  }

  /**
   * 发送验证码
   */
  @Post('send-code')
  async sendCode(@Body('phone') phone: string) {
    const result = await this.authService.sendVerificationCode(phone)
    return {
      code: result.success ? 200 : 400,
      data: result.code ? { code: result.code } : null,
      message: result.message,
    }
  }

  /**
   * 手机号验证码登录/注册
   * 未注册用户自动注册
   * 支持邀请码参数，注册成功后自动发放邀请奖励
   * 支持设备ID和IP地址记录
   */
  @Post('phone-login')
  async phoneLogin(
    @Body('phone') phone: string,
    @Body('code') code: string,
    @Body('nickname') nickname?: string,
    @Body('referral_code') referralCode?: string,
    @Body('device_id') deviceId?: string,
    @Req() request?: Request,
  ) {
    // 获取客户端IP
    const ipAddress = request ? this.getClientIp(request) : 'unknown'

    const result = await this.authService.phoneLogin(
      phone, code, nickname, referralCode, deviceId, ipAddress
    )
    return {
      code: 200,
      data: result,
      message: result.isNewUser ? '注册成功' : '登录成功',
    }
  }

  @Post('wechat-login')
  async wechatLogin(@Body('code') code: string) {
    const result = await this.authService.wechatLogin(code)
    return {
      code: 200,
      data: result,
      message: '登录成功',
    }
  }

  @Post('wechat-phone-login')
  async wechatPhoneLogin(
    @Body('code') code: string,
    @Body('phoneCode') phoneCode: string,
    @Body('nickname') nickname?: string,
    @Body('avatar') avatar?: string,
    @Body('referral_code') referralCode?: string,
    @Body('device_id') deviceId?: string,
    @Req() request?: Request,
  ) {
    // 获取客户端IP
    const ipAddress = request ? this.getClientIp(request) : 'unknown'

    const result = await this.authService.wechatPhoneLogin(
      code, phoneCode, nickname, avatar, referralCode, deviceId, ipAddress
    )
    return {
      code: 200,
      data: result,
      message: result.isNewUser ? '注册成功' : '登录成功',
    }
  }

  /**
   * 通过 code 获取 openid（供支付使用）
   */
  @Post('wechat/get-openid')
  async getOpenid(@Body('code') code: string) {
    if (!code) {
      return { code: 400, data: null, message: '缺少code参数' }
    }
    try {
      const result = await this.authService.wechatLogin(code)
      return {
        code: 200,
        data: { openid: result.user.openid || result.user.id },
        message: '获取成功',
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取openid失败',
      }
    }
  }

  @Get('me')
  async getCurrentUser(@Headers() headers: Record<string, string | string[] | undefined>) {
    const authorization = (headers.authorization || headers.Authorization) as string | undefined
    const userIdFromHeader = (headers['x-user-id'] || headers['X-User-Id']) as string | undefined
    try {
      if (authorization) {
        const result = await this.authService.getCurrentUser(authorization)
        return {
          code: 200,
          data: result.user,
          message: '获取成功',
        }
      }

      // 兼容旧链路：允许通过 X-User-Id 获取当前用户
      if (!userIdFromHeader) {
        return {
          code: 401,
          data: null,
          message: '未登录',
        }
      }

      const user = await this.authService.getUserById(userIdFromHeader)
      return {
        code: 200,
        data: user,
        message: '获取成功',
      }
    } catch (error) {
      return {
        code: 401,
        data: null,
        message: 'token 无效',
      }
    }
  }
}
