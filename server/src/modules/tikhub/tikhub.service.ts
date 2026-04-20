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
   * @param douyinId 抖音号或sec_user_id
   * @returns 用户信息
   */
  async getDouyinUserInfo(douyinId: string) {
    try {
      console.log('[TikHubService] 获取抖音用户信息，抖音号:', douyinId)
      console.log('[TikHubService] API Key 是否存在:', !!this.apiKey)

      // 尝试使用 GET 请求
      const response = await this.axios.get('/douyin/web/handler_user_profile_v2', {
        params: {
          sec_user_id: douyinId,
        },
      })

      console.log('[TikHubService] 抖音用户信息响应状态:', response.status)
      console.log('[TikHubService] 抖音用户信息响应数据:', JSON.stringify(response.data, null, 2))

      if (response.data?.code === 200 && response.data?.data) {
        const data = response.data.data
        return {
          success: true,
          data: {
            sec_uid: data.sec_uid,
            nickname: data.nickname,
            avatar_url: data.avatar_larger?.url_list?.[0] || data.avatar_thumb?.url_list?.[0],
            signature: data.signature,
            follower_count: data.follower_count || 0,
            following_count: data.following_count || 0,
            aweme_count: data.aweme_count || 0,
            total_favorited: data.total_favorited || 0,
          },
        }
      }

      return {
        success: false,
        message: response.data?.message || '获取用户信息失败',
      }
    } catch (error: any) {
      console.error('[TikHubService] 获取抖音用户信息失败:', error)
      console.error('[TikHubService] 错误详情:', error.response?.data || error.message)

      return {
        success: false,
        message: `网络请求失败: ${error.response?.data?.message || error.message || '请稍后重试'}`,
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

      // 调用 TikHub API
      const response = await this.axios.post('/xiaohongshu/app_v2/get_user_info', {
        share_url: shareUrl,
      })

      console.log('[TikHubService] 小红书用户信息响应:', JSON.stringify(response.data, null, 2))

      if (response.data?.code === 200 && response.data?.data) {
        const data = response.data.data
        return {
          success: true,
          data: {
            nickname: data.nickname,
            avatar_url: data.avatar,
            desc: data.desc,
            follower_count: data.follower_count || 0,
            following_count: data.following_count || 0,
            notes_count: data.notes_count || 0,
            interaction_count: data.interaction_count || 0,
          },
        }
      }

      return {
        success: false,
        message: response.data?.message || '获取用户信息失败',
      }
    } catch (error) {
      console.error('[TikHubService] 获取小红书用户信息失败:', error)
      return {
        success: false,
        message: '网络请求失败，请稍后重试',
      }
    }
  }
}
