import { Controller, Post, Body, Get, Headers } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  async wechatLogin(@Body('code') code: string) {
    const result = await this.authService.wechatLogin(code)
    return {
      code: 200,
      data: result,
      message: '登录成功'
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
        message: '未登录'
      }
    }

    try {
      const decoded = Buffer.from(token, 'base64').toString()
      const [userId] = decoded.split(':')
      const user = await this.authService.getUserById(userId)
      return {
        code: 200,
        data: user,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 401,
        data: null,
        message: 'token 无效'
      }
    }
  }
}
