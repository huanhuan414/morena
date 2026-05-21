/**
 * 抖音开放平台服务
 * 负责 OAuth 授权、Token 管理、shareSchema 发布
 */

import { Injectable, Logger } from '@nestjs/common'
import { DouyinApiService, DouyinAccessTokenInfo, DouyinShareSchemaOptions } from './douyin-api.service'
import { getMySQLClient } from '../../storage/database/mysql-client'

// 抖音配置
interface DouyinConfig {
  appId: string
  appSecret: string
  authCallbackUrl: string
}

@Injectable()
export class DouyinService {
  private readonly logger = new Logger(DouyinService.name)
  private readonly apiService: DouyinApiService
  private readonly config: DouyinConfig

  // 内存缓存（生产环境应使用 Redis）
  private authTaskCache = new Map<string, {
    avatarId: string
    userId: string
    state: string
    createdAt: number
    result?: {
      success: boolean
      accountId?: string
      nickname?: string
      avatar?: string
      openId?: string
      message?: string
    }
  }>()

  // client_token 缓存
  private clientTokenCache: { token: string; expiresAt: number } | null = null
  // open ticket 缓存
  private ticketCache: { ticket: string; expiresAt: number } | null = null

  constructor() {
    // 从环境变量读取配置
    this.config = {
      appId: process.env.DOUYIN_APP_ID || '',
      appSecret: process.env.DOUYIN_APP_SECRET || '',
      authCallbackUrl: process.env.DOUYIN_AUTH_CALLBACK_URL || '',
    }
    this.apiService = new DouyinApiService(this.config.appId, this.config.appSecret)
    this.logger.log(`抖音服务初始化, appId: ${this.config.appId ? '已配置' : '未配置'}`)
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return !!(this.config.appId && this.config.appSecret)
  }

  // ==================== OAuth 授权 ====================

  /**
   * 创建授权任务，返回授权链接
   */
  async createAuthTask(params: {
    avatarId: string
    userId: string
  }): Promise<{ url: string; taskId: string }> {
    if (!this.isConfigured()) {
      throw new Error('抖音开放平台未配置，请设置 DOUYIN_APP_ID 和 DOUYIN_APP_SECRET')
    }

    const taskId = `dy_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const callbackUrl = this.config.authCallbackUrl || `${process.env.PROJECT_DOMAIN || 'http://localhost:3000'}/api/douyin/auth/callback`

    // 保存任务信息到缓存
    this.authTaskCache.set(taskId, {
      avatarId: params.avatarId,
      userId: params.userId,
      state: taskId,
      createdAt: Date.now(),
    })

    // 10 分钟后自动清除
    setTimeout(() => this.authTaskCache.delete(taskId), 10 * 60 * 1000)

    const url = this.apiService.getAuthPageUrl(callbackUrl, taskId)
    console.log(`[抖音] 创建授权任务, taskId: ${taskId}, url: ${url.substring(0, 80)}...`)

    return { url, taskId }
  }

  /**
   * OAuth 回调处理：用 code 换取 token，获取用户信息，绑定账号
   */
  async handleAuthCallback(code: string, state: string): Promise<{
    success: boolean
    accountId?: string
    nickname?: string
    avatar?: string
    openId?: string
    message?: string
  }> {
    console.log(`[抖音] 处理授权回调, state: ${state}`)

    // 查找授权任务
    const taskInfo = this.authTaskCache.get(state)
    if (!taskInfo) {
      return { success: false, message: '授权任务不存在或已过期，请重新授权' }
    }

    // 用 code 换取 access_token
    let tokenInfo: DouyinAccessTokenInfo
    try {
      tokenInfo = await this.apiService.getAccessToken(code)
    } catch (err: any) {
      console.error(`[抖音] 获取 access_token 失败:`, err.message)
      return { success: false, message: `获取授权失败: ${err.message}` }
    }

    // 获取用户信息
    let userInfo: any
    try {
      userInfo = await this.apiService.getUserInfo(tokenInfo.access_token, tokenInfo.open_id)
    } catch (err: any) {
      console.error(`[抖音] 获取用户信息失败:`, err.message)
      return { success: false, message: `获取用户信息失败: ${err.message}` }
    }

    console.log(`[抖音] 授权成功, nickname: ${userInfo.nickname}, openId: ${tokenInfo.open_id}`)

    // 保存到数据库
    const db = getMySQLClient('avatar_accounts')
    const accountId = `acct_dy_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // 检查是否已绑定
    const existing = await db.query('avatar_accounts', {
      avatar_id: taskInfo.avatarId,
      platform: 'douyin',
    })

    if (existing && existing.length > 0) {
      // 已绑定，更新
      const existingAccount = existing[0]
      await db.update('avatar_accounts', {
        id: existingAccount.id,
        account_name: userInfo.nickname,
        account_url: `https://www.douyin.com/user/${tokenInfo.open_id}`,
        platform_user_id: tokenInfo.open_id,
        extra_info: JSON.stringify({
          access_token: tokenInfo.access_token,
          refresh_token: tokenInfo.refresh_token,
          expires_at: Date.now() + tokenInfo.expires_in * 1000,
          refresh_expires_at: Date.now() + tokenInfo.refresh_expires_in * 1000,
          scope: tokenInfo.scope,
          open_id: tokenInfo.open_id,
          union_id: userInfo.union_id,
          avatar: userInfo.avatar,
        }),
        updated_at: new Date(),
      })

      // 保存结果到缓存，方便前端轮询
      taskInfo.result = {
        success: true,
        accountId: existingAccount.id,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        openId: tokenInfo.open_id,
      }

      return {
        success: true,
        accountId: existingAccount.id,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        openId: tokenInfo.open_id,
      }
    }

    // 新建绑定
    await db.insert('avatar_accounts', {
      id: accountId,
      avatar_id: taskInfo.avatarId,
      platform: 'douyin',
      account_name: userInfo.nickname,
      account_url: `https://www.douyin.com/user/${tokenInfo.open_id}`,
      platform_user_id: tokenInfo.open_id,
      followers: 0,
      total_exposure: 0,
      total_works: 0,
      avg_likes_per_work: 0,
      avg_comments_per_work: 0,
      avg_shares_per_work: 0,
      extra_info: JSON.stringify({
        access_token: tokenInfo.access_token,
        refresh_token: tokenInfo.refresh_token,
        expires_at: Date.now() + tokenInfo.expires_in * 1000,
        refresh_expires_at: Date.now() + tokenInfo.refresh_expires_in * 1000,
        scope: tokenInfo.scope,
        open_id: tokenInfo.open_id,
        union_id: userInfo.union_id,
        avatar: userInfo.avatar,
      }),
      status: 'active',
    })

    // 保存结果到缓存
    taskInfo.result = {
      success: true,
      accountId,
      nickname: userInfo.nickname,
      avatar: userInfo.avatar,
      openId: tokenInfo.open_id,
    }

    return {
      success: true,
      accountId,
      nickname: userInfo.nickname,
      avatar: userInfo.avatar,
      openId: tokenInfo.open_id,
    }
  }

  /**
   * 查询授权任务状态
   */
  getAuthTaskStatus(taskId: string): {
    found: boolean
    completed?: boolean
    accountId?: string
    nickname?: string
    avatar?: string
    message?: string
  } {
    const taskInfo = this.authTaskCache.get(taskId)
    if (!taskInfo) {
      // 任务已从缓存中移除
      return { found: false }
    }
    if (taskInfo.result) {
      return {
        found: true,
        completed: true,
        accountId: taskInfo.result.accountId,
        nickname: taskInfo.result.nickname,
        avatar: taskInfo.result.avatar,
        message: taskInfo.result.message,
      }
    }
    return { found: true, completed: false }
  }

  // ==================== Token 管理 ====================

  /**
   * 获取账号的 access_token（自动刷新）
   */
  async getAccountAccessToken(accountId: string): Promise<string> {
    const db = getMySQLClient('avatar_accounts')
    const accounts = await db.query('avatar_accounts', { id: accountId })
    if (!accounts || accounts.length === 0) {
      throw new Error('抖音账号不存在')
    }

    const account = accounts[0]
    let extraInfo: any = {}
    try {
      extraInfo = JSON.parse(account.extra_info || '{}')
    } catch { /* ignore */ }

    // 检查 token 是否过期
    const expiresAt = extraInfo.expires_at || 0
    if (Date.now() < expiresAt - 10 * 60 * 1000) {
      // 还有 10 分钟以上有效期，直接返回
      return extraInfo.access_token
    }

    // 需要刷新
    const refreshToken = extraInfo.refresh_token
    const refreshExpiresAt = extraInfo.refresh_expires_at || 0

    if (!refreshToken || Date.now() > refreshExpiresAt) {
      throw new Error('抖音授权已过期，请重新授权')
    }

    console.log(`[抖音] 刷新 access_token, accountId: ${accountId}`)
    const newTokenInfo = await this.apiService.refreshAccessToken(refreshToken)

    // 更新数据库
    const newExtraInfo = {
      ...extraInfo,
      access_token: newTokenInfo.access_token,
      refresh_token: newTokenInfo.refresh_token,
      expires_at: Date.now() + newTokenInfo.expires_in * 1000,
      refresh_expires_at: Date.now() + newTokenInfo.refresh_expires_in * 1000,
    }

    await db.update('avatar_accounts', {
      id: accountId,
      extra_info: JSON.stringify(newExtraInfo),
      updated_at: new Date(),
    })

    return newTokenInfo.access_token
  }

  // ==================== shareSchema 发布 ====================

  /**
   * 获取 client_token（带缓存）
   */
  private async getClientToken(): Promise<string> {
    if (this.clientTokenCache && Date.now() < this.clientTokenCache.expiresAt) {
      return this.clientTokenCache.token
    }

    const tokenInfo = await this.apiService.getClientToken()
    this.clientTokenCache = {
      token: tokenInfo.access_token,
      expiresAt: Date.now() + (tokenInfo.expires_in - 300) * 1000, // 提前5分钟过期
    }

    return tokenInfo.access_token
  }

  /**
   * 获取 open ticket（带缓存）
   */
  private async getOpenTicket(): Promise<string> {
    if (this.ticketCache && Date.now() < this.ticketCache.expiresAt) {
      return this.ticketCache.ticket
    }

    const clientToken = await this.getClientToken()
    const ticketInfo = await this.apiService.getOpenTicket(clientToken)
    this.ticketCache = {
      ticket: ticketInfo.ticket,
      expiresAt: Date.now() + (ticketInfo.expires_in - 300) * 1000,
    }

    return ticketInfo.ticket
  }

  /**
   * 生成抖音分享 Schema 链接
   * 用户点击此链接后，会调起抖音 APP 并进入发布页面，预填视频/图片和标题
   * 用户仍需手动点击"发布"确认
   *
   * @param params 发布参数
   * @returns schema URL
   */
  async generateShareSchema(params: {
    videoUrl?: string
    imageUrls?: string[]
    title?: string
    hashtags?: string[]
  }): Promise<{ schemaUrl: string; shareId: string }> {
    if (!this.isConfigured()) {
      throw new Error('抖音开放平台未配置，请设置 DOUYIN_APP_ID 和 DOUYIN_APP_SECRET')
    }

    const { videoUrl, imageUrls, title, hashtags } = params

    if (!videoUrl && (!imageUrls || imageUrls.length === 0)) {
      throw new Error('请提供视频 URL 或图片 URL')
    }

    // 获取 share_id
    const clientToken = await this.getClientToken()
    const shareId = await this.apiService.getShareId(clientToken)

    // 获取 ticket
    const ticket = await this.getOpenTicket()

    // 构建 shareSchema 参数
    const options: DouyinShareSchemaOptions = {
      shareId,
      title: title || '',
      hashtag_list: hashtags || [],
      downloadType: 1, // 允许下载
      privateStatus: 0, // 所有人可见
    }

    if (videoUrl) {
      options.video_path = videoUrl
    }
    if (imageUrls && imageUrls.length > 0) {
      options.image_list_path = imageUrls
    }

    const schemaUrl = await this.apiService.generateShareSchema(ticket, options)

    console.log(`[抖音] 生成分享 Schema, shareId: ${shareId}, title: ${title}`)
    console.log(`[抖音] schemaUrl: ${schemaUrl.substring(0, 120)}...`)

    return { schemaUrl, shareId }
  }

  /**
   * 获取抖音账号信息（从数据库）
   */
  async getDouyinAccount(avatarId: string): Promise<any | null> {
    const db = getMySQLClient('avatar_accounts')
    const accounts = await db.query('avatar_accounts', {
      avatar_id: avatarId,
      platform: 'douyin',
    })

    if (!accounts || accounts.length === 0) {
      return null
    }

    const account = accounts[0]
    let extraInfo: any = {}
    try {
      extraInfo = JSON.parse(account.extra_info || '{}')
    } catch { /* ignore */ }

    return {
      id: account.id,
      avatarId: account.avatar_id,
      platform: account.platform,
      accountName: account.account_name,
      accountUrl: account.account_url,
      platformUserId: account.platform_user_id,
      avatar: extraInfo.avatar || '',
      openId: extraInfo.open_id || '',
      tokenExpiresAt: extraInfo.expires_at || 0,
      isTokenValid: Date.now() < (extraInfo.expires_at || 0),
    }
  }

  /**
   * 解绑抖音账号
   */
  async unbindAccount(accountId: string): Promise<void> {
    const db = getMySQLClient('avatar_accounts')
    await db.delete({ id: accountId })
    console.log(`[抖音] 解绑账号, accountId: ${accountId}`)
  }
}
