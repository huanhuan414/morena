// @ts-nocheck
import { Inject, Controller, Get, Put, Post, Body, Headers, Query } from '@nestjs/common'
import { UserService } from './user.service'

@Controller('user')
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Headers('x-user-id') userId: string) {
    const profile = await this.userService.getUserProfile(userId)
    return {
      code: 200,
      data: profile,
      message: '获取成功'
    }
  }

  @Put('profile')
  async updateProfile(
    @Headers('x-user-id') userId: string,
    @Body() updates: Record<string, any>
  ) {
    const profile = await this.userService.updateUserProfile(userId, updates)
    return {
      code: 200,
      data: profile,
      message: '更新成功'
    }
  }

  /**
   * 通过微信登录code获取openid（用于支付）
   * GET /api/user/openid?code=xxx
   */
  @Get('openid')
  async getOpenid(@Query('code') code: string) {
    if (!code) {
      return { code: 400, data: null, message: '缺少code参数' }
    }
    try {
      const appId = process.env.WECHAT_PAY_APPID || process.env.WX_APP_ID || ''
      const appSecret = process.env.WX_APP_SECRET || ''
      if (!appId || !appSecret) {
        return { code: 500, data: null, message: '微信配置缺失' }
      }
      const axios = require('axios')
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`
      const res = await axios.get(url, { timeout: 10000 })
      const openid = res.data?.openid
      if (!openid) {
        console.error('[UserController] 获取openid失败:', res.data)
        return { code: 500, data: null, message: '获取openid失败' }
      }
      return { code: 200, data: { openid }, message: '获取成功' }
    } catch (err) {
      console.error('[UserController] 获取openid异常:', err.message)
      return { code: 500, data: null, message: '获取openid异常' }
    }
  }

  @Get('stats')
  async getStats(@Headers('x-user-id') userId: string) {
    const stats = await this.userService.getUserStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  @Get('learning-progress')
  async getLearningProgress(@Headers('x-user-id') userId: string) {
    const progress = await this.userService.getLearningProgress(userId)
    return {
      code: 200,
      data: progress,
      message: '获取成功'
    }
  }

  @Get('security-status')
  async getSecurityStatus(@Headers('x-user-id') userId: string) {
    const status = await this.userService.getSecurityStatus(userId)
    return {
      code: 200,
      data: status,
      message: '获取成功'
    }
  }

  @Post('change-password')
  async changePassword(
    @Headers('x-user-id') userId: string,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    await this.userService.changePassword(userId, body.oldPassword, body.newPassword)
    return {
      code: 200,
      data: null,
      message: '密码修改成功'
    }
  }
}
