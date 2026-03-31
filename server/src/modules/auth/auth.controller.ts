import { Controller, Post, Body, Get, Headers } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 发送验证码
   */
  @Post('send-code')
  async sendCode(@Body('phone') phone: string) {
    const result = await this.authService.sendVerificationCode(phone)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message,
    }
  }

  /**
   * 手机号验证码登录/注册
   * 未注册用户自动注册
   */
  @Post('phone-login')
  async phoneLogin(
    @Body('phone') phone: string,
    @Body('code') code: string,
    @Body('nickname') nickname?: string,
  ) {
    const result = await this.authService.phoneLogin(phone, code, nickname)
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

  @Get('me')
  async getCurrentUser(@Headers('authorization') authorization: string) {
    // 从 token 中提取用户 ID
    const token = authorization?.replace('Bearer ', '')
    if (!token) {
      return {
        code: 401,
        data: null,
        message: '未登录',
      }
    }

    try {
      const decoded = Buffer.from(token, 'base64').toString()
      const [userId] = decoded.split(':')
      const user = await this.authService.getUserById(userId)
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
