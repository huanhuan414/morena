// @ts-nocheck
import { Injectable, Logger, Inject } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'

const WX_ACCESS_TOKEN_KEY = 'wechat:access_token'
const WX_ACCESS_TOKEN_EXPIRES_KEY = 'wechat:access_token_expires'

/**
 * 微信小程序订阅消息服务
 * 用于发送订阅消息通知
 */
@Injectable()
export class WechatSubscribeMessageService {
  private readonly logger = new Logger(WechatSubscribeMessageService.name)
  // 内存缓存作为 fallback
  private accessToken: string = ''
  private tokenExpiresAt: number = 0

  constructor(private readonly redisService: RedisService) {}

  private get appId(): string {
    return process.env.WX_APP_ID || ''
  }

  private get appSecret(): string {
    return process.env.WX_APP_SECRET || ''
  }

  private get feedbackTemplateId(): string {
    return process.env.WX_SUBSCRIBE_TEMPLATE_FEEDBACK || ''
  }

  /**
   * 获取微信小程序 access_token
   * 1. 先从 Redis 获取（多实例共享）
   * 2. 内存缓存作为 fallback
   * 3. 过期前60秒自动刷新，避免使用即将过期的token
   */
  async getAccessToken(): Promise<string> {
    const EXPIRY_BUFFER = 60 * 1000 // 提前60秒刷新

    // 检查 Redis 缓存
    try {
      const cachedToken = await this.redisService.getClient().get(WX_ACCESS_TOKEN_KEY)
      const cachedExpires = await this.redisService.getClient().get(WX_ACCESS_TOKEN_EXPIRES_KEY)

      if (cachedToken && cachedExpires && Date.now() + EXPIRY_BUFFER < parseInt(cachedExpires, 10)) {
        return cachedToken
      }
    } catch (err) {
      this.logger.warn(`Redis 获取 token 失败，使用内存缓存: ${err.message}`)
    }

    // 检查内存缓存
    if (this.accessToken && Date.now() + EXPIRY_BUFFER < this.tokenExpiresAt) {
      return this.accessToken
    }

    // 需要刷新 token，带重试
    return this.refreshAccessTokenWithRetry(3)
  }

  /**
   * 带重试的 token 刷新
   */
  private async refreshAccessTokenWithRetry(maxRetries: number): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const token = await this.fetchAccessToken()
        // 移除日志：this.logger.log(`微信access_token刷新成功`)
        return token
      } catch (error: any) {
        this.logger.warn(`获取access_token失败 (${i + 1}/${maxRetries}): ${error.message}`)
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    if (this.accessToken) {
      this.logger.warn('access_token刷新失败，使用内存中即将过期的token')
      return this.accessToken
    }

    throw new Error('获取微信access_token失败，所有重试均失败')
  }

  /**
   * 从微信服务器获取新的 access_token
   */
  private async fetchAccessToken(): Promise<string> {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`

    const response = await fetch(url)
    const data = await response.json() as any

    if (data.errcode) {
      throw new Error(`errcode=${data.errcode}, errmsg=${data.errmsg}`)
    }

    const expiresIn = (data.expires_in - 300) * 1000 // 提前5分钟过期
    const expiresAt = Date.now() + expiresIn

    // 保存到 Redis（有效期2小时）
    try {
      await this.redisService.getClient().setex(WX_ACCESS_TOKEN_KEY, data.expires_in, data.access_token)
      await this.redisService.getClient().set(WX_ACCESS_TOKEN_EXPIRES_KEY, expiresAt.toString())
    } catch (err) {
      this.logger.warn(`Redis 保存 token 失败: ${err.message}`)
    }

    // 保存到内存
    this.accessToken = data.access_token
    this.tokenExpiresAt = expiresAt

    return data.access_token
  }

  /**
   * 强制刷新 access_token（清除缓存后重新获取）
   */
  async forceRefreshAccessToken(): Promise<string> {
    this.logger.log('强制刷新微信access_token')
    
    // 清除内存缓存
    this.accessToken = ''
    this.tokenExpiresAt = 0
    
    // 清除 Redis 缓存
    try {
      await this.redisService.getClient().del(WX_ACCESS_TOKEN_KEY)
      await this.redisService.getClient().del(WX_ACCESS_TOKEN_EXPIRES_KEY)
      this.logger.log('Redis缓存已清除')
    } catch (err) {
      this.logger.warn(`Redis清除缓存失败: ${err.message}`)
    }
    
    // 获取新的 token
    return this.fetchAccessToken()
  }

  /**
   * 发送订阅消息
   * @param toUser 接收者的openid
   * @param templateId 模板ID
   * @param page 点击消息卡片后的跳转页面
   * @param data 模板数据
   */
  async sendSubscribeMessage(params: {
    toUser: string
    templateId: string
    page?: string
    data: Record<string, { value: string }>
  }, retryCount: number = 0): Promise<boolean> {
    try {
      this.logger.log(`准备发送订阅消息: toUser=${params.toUser}, templateId=${params.templateId}`)
      
      const token = await this.getAccessToken()
      this.logger.log(`获取access_token成功:`,process.env.NODE_ENV)
      
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`

      const stateMap: Record<string, string> = {
        development: 'developer',
        test: 'trial',
        production: 'formal',
      }
      const miniprogramState = stateMap[process.env.NODE_ENV] || 'formal'

      const body = {
        touser: params.toUser,
        template_id: params.templateId,
        page: params.page || '',
        data: params.data,
        miniprogram_state: miniprogramState,
        lang: 'zh_CN'
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await response.json() as any

      if (result.errcode === 0) {
        this.logger.log(`订阅消息发送成功: toUser=${params.toUser}, templateId=${params.templateId}`)
        return true
      }

      // 40001 = access_token失效，强制刷新并重试
      if (result.errcode === 40001 && retryCount < 2) {
        this.logger.warn(`access_token失效，强制刷新并重试 (${retryCount + 1}/2)`)
        await this.forceRefreshAccessToken()
        return this.sendSubscribeMessage(params, retryCount + 1)
      }

      if (result.errcode === 43101) {
        this.logger.warn(`用户未订阅该模板消息: toUser=${params.toUser}, templateId=${params.templateId}`)
        return false
      }

      this.logger.error(`订阅消息发送失败: errcode=${result.errcode}, errmsg=${result.errmsg}, toUser=${params.toUser}, templateId=${params.templateId}`)
      return false
    } catch (error: any) {
      this.logger.error(`订阅消息发送异常: ${error.message}`)
      return false
    }
  }

  /**
   * 发送反馈提交通知给发单方
   * @param toUserOpenid 发单方的openid
   * @param orderTitle 订单标题
   * @param avatarName 分身名称
   * @param page 跳转页面路径
   * @param acceptanceTimeoutHint 验收超时提示
   */
  async sendFeedbackNotification(params: {
    toUserOpenid: string
    orderTitle: string
    avatarName: string
    page?: string
    acceptanceTimeoutHint?: string
  }): Promise<boolean> {
    if (!this.feedbackTemplateId) {
      this.logger.warn('未配置反馈订阅消息模板ID，跳过发送')
      return false
    }

    return this.sendSubscribeMessage({
      toUser: params.toUserOpenid,
      templateId: this.feedbackTemplateId,
      page: params.page,
      data: {
        thing2: { value: this.truncate(`[${params.avatarName}]已完成[${params.orderTitle}]订单，请尽快验收`, 20) },
        phrase1: { value: '待验收' },
        thing4: { value: this.truncate(params.acceptanceTimeoutHint, 20) },
      }
    })
  }

  /**
   * 截断字符串，微信订阅消息字段有长度限制
   */
  private truncate(str: string, maxLen: number): string {
    if (!str) return ''
    return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str
  }
}
