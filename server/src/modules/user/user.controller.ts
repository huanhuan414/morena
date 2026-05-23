// @ts-nocheck
import { Inject, Controller, Get, Put, Post, Body, Headers, Query, BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common'
import { UserService } from './user.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('user')
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  private getAuthenticatedUserId(headers: Record<string, string | string[] | undefined>) {
    return requireAuthenticatedUserId(headers)
  }

  @Get('profile')
  async getProfile(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = this.getAuthenticatedUserId(headers)
    const profile = await this.userService.getUserProfile(userId)
    return {
      code: 200,
      data: profile,
      message: '获取成功'
    }
  }

  @Put('profile')
  async updateProfile(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() updates: Record<string, any>
  ) {
    const userId = this.getAuthenticatedUserId(headers)
    console.log('[UserController] updateProfile called, userId:', userId, 'updates:', JSON.stringify(updates))
    const profile = await this.userService.updateUserProfile(userId, updates)
    console.log('[UserController] updateProfile result:', JSON.stringify(profile))
    return {
      code: 200,
      data: profile,
      message: '更新成功'
    }
  }

  /**
   * 通过微信登录code获取openid（用于支付）
   * GET /api/user/openid?code=xxx
   * 匿名边界：该接口仅用于小程序支付前置换取 openid，允许未登录访问，不返回用户资料或会话态。
   */
  @Get('openid')
  async getOpenid(@Query('code') code: string) {
    if (!code) {
      throw new BadRequestException({ msg: '缺少code参数', data: null })
    }
    try {
      const appId = process.env.WECHAT_PAY_APPID || process.env.WX_APP_ID || ''
      const appSecret = process.env.WX_APP_SECRET || ''
      if (!appId || !appSecret) {
        throw new InternalServerErrorException({ msg: '微信配置缺失', data: null })
      }
      const axios = require('axios')
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`
      const res = await axios.get(url, { timeout: 10000 })
      const openid = res.data?.openid
      if (!openid) {
        console.error('[UserController] 获取openid失败:', res.data)
        throw new InternalServerErrorException({ msg: '获取openid失败', data: null })
      }
      return { code: 200, data: { openid }, message: '获取成功' }
    } catch (err) {
      console.error('[UserController] 获取openid异常:', err.message)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '获取openid异常', data: null })
    }
  }

  @Get('stats')
  async getStats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = this.getAuthenticatedUserId(headers)
    const stats = await this.userService.getUserStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  @Get('learning-progress')
  async getLearningProgress(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = this.getAuthenticatedUserId(headers)
    const progress = await this.userService.getLearningProgress(userId)
    return {
      code: 200,
      data: progress,
      message: '获取成功'
    }
  }

  @Get('security-status')
  async getSecurityStatus(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = this.getAuthenticatedUserId(headers)
    const status = await this.userService.getSecurityStatus(userId)
    return {
      code: 200,
      data: status,
      message: '获取成功'
    }
  }

  @Post('change-password')
  async changePassword(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    const userId = this.getAuthenticatedUserId(headers)
    await this.userService.changePassword(userId, body.oldPassword, body.newPassword)
    return {
      code: 200,
      data: null,
      message: '密码修改成功'
    }
  }
}
