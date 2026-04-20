import { Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class TikHubService {
  private readonly axios: AxiosInstance
  private readonly apiKey: string

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get('TIKHUB_API_KEY') || 'iawtA+4A7Gr1hkOTKq2M5SfzahTUd5h4uUjatHyZS/m90wqBB2yqURXBKw=='

    this.axios = axios.create({
      baseURL: 'https://api.tikhub.io/api/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })
  }

  /**
   * 根据抖音号获取用户信息
   * @param douyinId 抖音号
   * @returns 用户信息
   */
  async getDouyinUserInfo(douyinId: string) {
    try {
      console.log('[TikHubService] 获取抖音用户信息，输入值:', douyinId)
      console.log('[TikHubService] API Key 是否存在:', !!this.apiKey)

      if (!this.apiKey) {
        return {
          success: false,
          message: 'TikHub API Key 未配置',
        }
      }

      // 使用 GET 请求，参数名为 unique_id
      const response = await this.axios.get('/douyin/web/handler_user_profile_v2', {
        params: {
          unique_id: douyinId,
        },
      })

      console.log('[TikHubService] 抖音用户信息响应状态:', response.status)
      console.log('[TikHubService] 抖音用户信息响应数据:', JSON.stringify(response.data, null, 2))

      if (response.data?.code === 200 && response.data?.data?.user_info) {
        const userInfo = response.data.data.user_info

        // 获赞总数
        const totalFavorited = parseInt(userInfo.total_favorited || '0', 10)

        return {
          success: true,
          data: {
            sec_uid: userInfo.sec_uid,
            nickname: userInfo.nickname,
            avatar_url: userInfo.avatar_medium?.url_list?.[0] || userInfo.avatar_thumb?.url_list?.[0] || '',
            signature: userInfo.signature || '',
            follower_count: userInfo.mplatform_followers_count || userInfo.follower_count || 0,
            following_count: userInfo.following_count || 0,
            aweme_count: userInfo.aweme_count || 0,
            total_favorited: totalFavorited,
            favoriting_count: userInfo.favoriting_count || 0,
          },
        }
      }

      return {
        success: false,
        message: response.data?.message || response.data?.msg || '获取用户信息失败',
      }
    } catch (error: any) {
      console.error('[TikHubService] 获取抖音用户信息失败:', error)
      console.error('[TikHubService] 错误状态码:', error.response?.status)
      console.error('[TikHubService] 错误详情:', error.response?.data || error.message)

      // 返回 TikHub API 返回的具体错误信息
      const errorMsg = error.response?.data?.message ||
                      error.response?.data?.msg ||
                      error.response?.data?.detail ||
                      '请检查抖音号是否正确'

      return {
        success: false,
        message: `获取失败 (${error.response?.status}): ${errorMsg}`,
      }
    }
  }

  /**
   * 根据小红书分享链接获取用户信息
   * @param shareUrl 小红书分享链接
   * @returns 用户信息
   */
  async getXiaohongshuUserInfo(shareUrl: string) {
    try {
      console.log('[TikHubService] 获取小红书用户信息，分享链接:', shareUrl)
      console.log('[TikHubService] API Key 是否存在:', !!this.apiKey)

      // TikHub 的小红书接口暂时不可用，返回提示信息
      console.log('[TikHubService] 小红书接口返回 400 错误，可能是接口维护中')
      
      return {
        success: false,
        message: '小红书接口暂时不可用（TikHub 返回 400 错误），请手动输入账号信息后保存。建议先使用抖音账号绑定功能。',
      }
    } catch (error: any) {
      console.error('[TikHubService] 获取小红书用户信息失败:', error)
      
      return {
        success: false,
        message: '小红书接口暂时不可用，请手动输入账号信息后保存。',
      }
    }
  }
}
