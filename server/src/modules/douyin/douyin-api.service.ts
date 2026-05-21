/**
 * 抖音开放平台 API 接口封装
 * 参考：https://developer.open-douyin.com/
 */

import * as crypto from 'crypto'

// ==================== 类型定义 ====================

export interface DouyinAccessTokenInfo {
  access_token: string
  captcha: string
  desc_url: string
  description: string
  error_code: number
  expires_in: number
  log_id: string
  open_id: string
  refresh_expires_in: number
  refresh_token: string
  scope: string
}

export interface DouyinRefreshTokenInfo {
  captcha: string
  desc_url: string
  description: string
  error_code: number
  expires_in: number
  refresh_token: string
}

export interface DouyinUserInfo {
  open_id: string
  nickname: string
  description: string
  e_account_role: string
  error_code: number
  avatar: string
  client_key: string
  log_id: string
  union_id: string
}

export interface DouyinClientTokenInfo {
  captcha: string
  desc_url: string
  description: string
  error_code: number
  expires_in: number
  access_token: string
}

export interface DouyinOpenTicketInfo {
  error_code: number
  description: string
  expires_in: number
  ticket: string
}

export enum DouyinDownloadType {
  Allow = 1,
  Disallow = 2,
}

export enum DouyinPrivateStatus {
  All = 0,
  Self = 1,
  Friend = 2,
}

export interface DouyinShareSchemaOptions {
  shareId?: string
  hashtag_list?: string[]
  title?: string
  short_title?: string
  title_hashtag_list?: { name: string; start: number }[]
  downloadType?: DouyinDownloadType
  privateStatus?: DouyinPrivateStatus
  image_list_path?: string[]
  video_path?: string
}

// ==================== API 服务 ====================

export class DouyinApiService {
  private readonly appId: string
  private readonly appSecret: string

  constructor(appId: string, appSecret: string) {
    this.appId = appId
    this.appSecret = appSecret
  }

  /**
   * 获取授权页面 URL
   * @param redirectURL 回调地址
   * @param state 状态参数（用于防 CSRF）
   */
  getAuthPageUrl(redirectURL: string, state: string): string {
    const scopes = ['user_info', 'video.create', 'video.data'].join(',')
    return `https://open.douyin.com/platform/oauth/connect?client_key=${this.appId}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectURL)}&state=${state}`
  }

  /**
   * 用 code 换取 access_token
   */
  async getAccessToken(code: string): Promise<DouyinAccessTokenInfo> {
    console.log(`[抖音API] getAccessToken, code: ${code.substring(0, 10)}...`)

    const res = await fetch('https://open.douyin.com/oauth/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.appId,
        client_secret: this.appSecret,
        code,
        grant_type: 'authorization_code',
      }).toString(),
    })

    const data = await res.json() as any
    console.log(`[抖音API] getAccessToken response:`, { message: data.message, error_code: data.data?.error_code })

    if (data.message !== 'success' || data.data?.error_code !== 0) {
      throw new Error(data.data?.description || data.data?.desc_url || '获取 access_token 失败')
    }

    return data.data as DouyinAccessTokenInfo
  }

  /**
   * 刷新 access_token
   */
  async refreshAccessToken(refreshToken: string): Promise<DouyinAccessTokenInfo> {
    console.log(`[抖音API] refreshAccessToken`)

    const res = await fetch('https://open.douyin.com/oauth/refresh_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.appId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    })

    const data = await res.json() as any
    console.log(`[抖音API] refreshAccessToken response:`, { message: data.message })

    if (data.message !== 'success' || data.data?.error_code !== 0) {
      throw new Error(data.data?.description || '刷新 access_token 失败')
    }

    return data.data as DouyinAccessTokenInfo
  }

  /**
   * 获取授权用户信息
   */
  async getUserInfo(accessToken: string, openId: string): Promise<DouyinUserInfo> {
    console.log(`[抖音API] getUserInfo, openId: ${openId}`)

    const res = await fetch('https://open.douyin.com/oauth/userinfo/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: accessToken,
        open_id: openId,
      }).toString(),
    })

    const data = await res.json() as any
    console.log(`[抖音API] getUserInfo response:`, { err_no: data.err_no, nickname: data.data?.nickname })

    if (data.err_no !== 0) {
      throw new Error(data.err_msg || '获取用户信息失败')
    }

    return data.data as DouyinUserInfo
  }

  /**
   * 获取 Client Token（用于不需要用户授权的接口，如获取 ticket、share_id）
   */
  async getClientToken(): Promise<DouyinClientTokenInfo> {
    console.log(`[抖音API] getClientToken`)

    const res = await fetch('https://open.douyin.com/oauth/client_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_key: this.appId,
        client_secret: this.appSecret,
        grant_type: 'client_credential',
      }),
    })

    const data = await res.json() as any
    console.log(`[抖音API] getClientToken response:`, { message: data.message })

    if (data.message !== 'success' || data.data?.error_code !== 0) {
      throw new Error(data.data?.description || '获取 client_token 失败')
    }

    return data.data as DouyinClientTokenInfo
  }

  /**
   * 获取 Open Ticket（用于生成 share schema 签名）
   */
  async getOpenTicket(clientToken: string): Promise<DouyinOpenTicketInfo> {
    console.log(`[抖音API] getOpenTicket`)

    const res = await fetch('https://open.douyin.com/open/getticket/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': clientToken,
      },
    })

    const data = await res.json() as any
    console.log(`[抖音API] getOpenTicket response:`, { error_code: data.data?.error_code })

    if (data.data?.error_code !== 0) {
      throw new Error(data.data?.description || '获取 ticket 失败')
    }

    return data.data as DouyinOpenTicketInfo
  }

  /**
   * 获取分享 ID
   */
  async getShareId(clientToken: string): Promise<string> {
    console.log(`[抖音API] getShareId`)

    const res = await fetch('https://open.douyin.com/share-id/?need_callback=true&default_hashtag=hashtag', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': clientToken,
      },
    })

    const data = await res.json() as any

    if (data.extra?.error_code !== 0) {
      throw new Error(data.data?.description || '获取 share_id 失败')
    }

    return data.data.share_id
  }

  /**
   * 生成分享 Schema URL
   * 用户点击此 URL 后，会调起抖音 APP 并进入发布页面（预填内容）
   * 用户仍需手动点击"发布"按钮确认
   */
  async generateShareSchema(ticket: string, options: DouyinShareSchemaOptions): Promise<string> {
    console.log(`[抖音API] generateShareSchema, title: ${options.title}`)

    const nonceStr = this.generateNonceStr(32)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = this.generateSignature(ticket, nonceStr, timestamp)

    const url = new URL('snssdk1128://openplatform/share')
    const query = url.searchParams

    query.append('client_key', this.appId)
    if (options.shareId) {
      query.append('state', options.shareId)
    }
    query.append('nonce_str', nonceStr)
    if (options.title) {
      query.append('title', options.title)
    }
    if (options.short_title) {
      query.append('short_title', options.short_title)
    }
    query.append('timestamp', timestamp)
    query.append('signature', signature)
    query.append('share_type', 'h5')

    if (options.video_path) {
      query.append('video_path', options.video_path)
      query.append('share_to_publish', '1')
    }
    if (options.image_list_path && options.image_list_path.length > 0) {
      query.append('image_list_path', JSON.stringify(options.image_list_path))
    }
    if (options.hashtag_list && options.hashtag_list.length > 0) {
      query.append('hashtag_list', JSON.stringify(options.hashtag_list))
    }
    if (options.title_hashtag_list && options.title_hashtag_list.length > 0) {
      query.append('title_hashtag_list', JSON.stringify(options.title_hashtag_list))
    }
    if (options.downloadType !== undefined) {
      query.append('download_type', String(options.downloadType))
    }
    if (options.privateStatus !== undefined) {
      query.append('private_status', String(options.privateStatus))
    }

    return url.toString().replace(/\+/g, '%20')
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const randomValues = new Uint32Array(length)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length]
    }
    return result
  }

  /**
   * 生成签名
   * 签名规则：对 nonce_str、ticket、timestamp 按 ASCII 码排序后拼接，做 MD5
   */
  private generateSignature(ticket: string, nonceStr: string, timestamp: string): string {
    const signStr = `nonce_str=${nonceStr}&ticket=${ticket}&timestamp=${timestamp}`
    return crypto.createHash('md5').update(signStr).digest('hex')
  }
}
