import { Controller, Post, Body, Get, Headers, Inject } from '@nestjs/common'
import { AuthService } from './auth.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'
import { BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common'

@Controller('auth')
export class AuthController {
  constructor(@Inject("AUTH_SERVICE") private readonly authService: AuthService) {}

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
   */
  @Post('phone-login')
  async phoneLogin(
    @Body('phone') phone: string,
    @Body('code') code: string,
    @Body('nickname') nickname?: string,
    @Body('referral_code') referralCode?: string,
  ) {
    const result = await this.authService.phoneLogin(phone, code, nickname, referralCode)
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
  ) {
    const result = await this.authService.wechatPhoneLogin(code, phoneCode, nickname, avatar, referralCode)
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
      throw new BadRequestException({ msg: '缺少code参数', data: null })
    }
    try {
      const result = await this.authService.wechatLogin(code)
      return {
        code: 200,
        data: { openid: result.user.openid || result.user.id },
        message: '获取成功',
      }
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      throw new InternalServerErrorException({ msg: error.message || '获取openid失败', data: null })
    }
  }

  @Get('me')
  async getCurrentUser(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    const user = await this.authService.getUserById(userId)
    return {
      code: 200,
      data: user,
      message: '获取成功',
    }
  }
}
