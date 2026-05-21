/**
 * 抖音开放平台控制器
 * 提供 OAuth 授权、账号管理、shareSchema 发布接口
 */

import { Controller, Get, Post, Query, Body, Req, Res, Logger } from '@nestjs/common'
import { DouyinService } from './douyin.service'
import { Request, Response } from 'express'

@Controller('douyin')
export class DouyinController {
  private readonly logger = new Logger(DouyinController.name)

  constructor(private readonly douyinService: DouyinService) {}

  /**
   * 检查抖音配置状态
   * GET /api/douyin/config
   */
  @Get('config')
  getConfig() {
    return {
      code: 200,
      msg: 'success',
      data: {
        configured: this.douyinService.isConfigured(),
      },
    }
  }

  /**
   * 创建 OAuth 授权任务
   * POST /api/douyin/auth/create-task
   * Body: { avatarId, userId }
   */
  @Post('auth/create-task')
  async createAuthTask(@Body() body: Record<string, any>) {
    try {
      const { avatarId, userId } = body
      if (!avatarId) {
        return { code: 400, msg: '缺少 avatarId', data: null }
      }
      if (!userId) {
        return { code: 400, msg: '缺少 userId', data: null }
      }

      const result = await this.douyinService.createAuthTask({ avatarId, userId })
      return { code: 200, msg: 'success', data: result }
    } catch (err: any) {
      console.error('[抖音] 创建授权任务失败:', err.message)
      return { code: 500, msg: err.message || '创建授权任务失败', data: null }
    }
  }

  /**
   * OAuth 授权回调
   * GET /api/douyin/auth/callback?code=xxx&state=xxx
   */
  @Get('auth/callback')
  async authCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {
      console.log(`[抖音] 收到授权回调, code: ${code?.substring(0, 10)}..., state: ${state}`)

      const result = await this.douyinService.handleAuthCallback(code, state)

      // 回调完成后重定向到前端页面
      const frontendUrl = process.env.PROJECT_DOMAIN || 'http://localhost:5000'
      if (result.success) {
        // 授权成功，重定向到前端成功页面
        const redirectUrl = `${frontendUrl}/#/package-avatar/pages/avatar-account-config/index?platform=douyin&bindResult=success&nickname=${encodeURIComponent(result.nickname || '')}&avatar=${encodeURIComponent(result.avatar || '')}`
        res.redirect(redirectUrl)
      } else {
        // 授权失败
        const redirectUrl = `${frontendUrl}/#/package-avatar/pages/avatar-account-config/index?platform=douyin&bindResult=fail&message=${encodeURIComponent(result.message || '授权失败')}`
        res.redirect(redirectUrl)
      }
    } catch (err: any) {
      console.error('[抖音] 授权回调处理失败:', err.message)
      const frontendUrl = process.env.PROJECT_DOMAIN || 'http://localhost:5000'
      res.redirect(`${frontendUrl}/#/package-avatar/pages/avatar-account-config/index?platform=douyin&bindResult=fail&message=${encodeURIComponent(err.message)}`)
    }
  }

  /**
   * 查询授权任务状态
   * GET /api/douyin/auth/task-status?taskId=xxx
   */
  @Get('auth/task-status')
  async getAuthTaskStatus(@Query('taskId') taskId: string) {
    try {
      const status = this.douyinService.getAuthTaskStatus(taskId)
      return { code: 200, msg: 'success', data: status }
    } catch (err: any) {
      return { code: 500, msg: err.message, data: null }
    }
  }

  /**
   * 获取抖音账号绑定信息
   * GET /api/douyin/account?avatarId=xxx
   */
  @Get('account')
  async getDouyinAccount(@Query('avatarId') avatarId: string) {
    try {
      if (!avatarId) {
        return { code: 400, msg: '缺少 avatarId', data: null }
      }
      const account = await this.douyinService.getDouyinAccount(avatarId)
      return { code: 200, msg: 'success', data: account }
    } catch (err: any) {
      console.error('[抖音] 获取账号信息失败:', err.message)
      return { code: 500, msg: err.message, data: null }
    }
  }

  /**
   * 解绑抖音账号
   * DELETE /api/douyin/account?accountId=xxx
   * (用 POST 替代 DELETE 以兼容小程序)
   */
  @Post('account/unbind')
  async unbindAccount(@Body() body: Record<string, any>) {
    try {
      const { accountId } = body
      if (!accountId) {
        return { code: 400, msg: '缺少 accountId', data: null }
      }
      await this.douyinService.unbindAccount(accountId)
      return { code: 200, msg: 'success', data: null }
    } catch (err: any) {
      console.error('[抖音] 解绑账号失败:', err.message)
      return { code: 500, msg: err.message, data: null }
    }
  }

  /**
   * 生成抖音分享 Schema 链接（半自动发布）
   * POST /api/douyin/publish/share-schema
   * Body: { videoUrl?, imageUrls?, title?, hashtags? }
   */
  @Post('publish/share-schema')
  async generateShareSchema(@Body() body: Record<string, any>) {
    try {
      const { videoUrl, imageUrls, title, hashtags } = body

      if (!videoUrl && (!imageUrls || imageUrls.length === 0)) {
        return { code: 400, msg: '请提供视频 URL 或图片 URL', data: null }
      }

      const result = await this.douyinService.generateShareSchema({
        videoUrl,
        imageUrls,
        title,
        hashtags,
      })

      return {
        code: 200,
        msg: 'success',
        data: {
          schemaUrl: result.schemaUrl,
          shareId: result.shareId,
          tips: '点击链接将调起抖音APP并预填内容，您仍需在抖音中确认发布',
        },
      }
    } catch (err: any) {
      console.error('[抖音] 生成分享 Schema 失败:', err.message)
      return { code: 500, msg: err.message, data: null }
    }
  }
}
