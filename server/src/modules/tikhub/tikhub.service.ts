// @ts-nocheck
import { Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

@Injectable()
export class TikHubService {
  private readonly axios: AxiosInstance
  private readonly apiKey: string

  constructor() {
    // 直接从环境变量获取，不依赖 ConfigService
    this.apiKey = process.env.TIKHUB_API_KEY || 'iawtA+4A7Gr1hkOTKq2M5SfzahTUd5h4uUjatHyZS/m90wqBB2yqURXBKw=='

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
   * 通用 TikHub API 调用方法
   * @param endpoint API 端点（如 '/douyin/web/handler_user_profile_v2'）
   * @param params 查询参数
   * @param method HTTP 方法（默认 GET）
   * @returns API 响应数据
   */
  async callTikHubAPI(endpoint: string, params: any = {}, method: 'GET' | 'POST' = 'GET') {
    try {
      console.log(`[TikHubService] 调用 TikHub API: ${endpoint}`, params)
      console.log('[TikHubService] API Key 是否存在:', !!this.apiKey)

      if (!this.apiKey) {
        throw new Error('TikHub API Key 未配置')
      }

      let response
      if (method === 'GET') {
        response = await this.axios.get(endpoint, { params })
      } else {
        response = await this.axios.post(endpoint, params)
      }

      console.log(`[TikHubService] TikHub API 响应状态:`, response.status)
      console.log(`[TikHubService] TikHub API 响应数据:`, JSON.stringify(response.data, null, 2))

      return response.data
    } catch (error: any) {
      console.error(`[TikHubService] TikHub API 调用失败 (${endpoint}):`, error)
      console.error(`[TikHubService] 错误详情:`, error.response?.data || error.message)

      throw new Error(error.response?.data?.message || error.response?.data?.detail || error.message || 'API 调用失败')
    }
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

      if (!this.apiKey) {
        return {
          success: false,
          message: 'TikHub API Key 未配置',
        }
      }

      // 第一步：从分享链接中提取用户ID和xsec_token
      const tokenResponse = await this.axios.get('/xiaohongshu/app/get_user_id_and_xsec_token', {
        params: {
          share_link: shareUrl,
        },
      })

      console.log('[TikHubService] 第一步获取token响应:', JSON.stringify(tokenResponse.data, null, 2))

      if (tokenResponse.data?.code !== 200 || !tokenResponse.data?.data) {
        return {
          success: false,
          message: tokenResponse.data?.message || '获取用户ID失败，请检查分享链接是否正确',
        }
      }

      const tokenData = tokenResponse.data.data
      const userId = tokenData.user_id
      const xsecToken = tokenData.xsec_token

      console.log('[TikHubService] 获取到用户ID:', userId)

      // 第二步：使用用户ID获取详细信息
      const userResponse = await this.axios.get('/xiaohongshu/app/get_user_info', {
        params: {
          user_id: userId,
        },
      })

      console.log('[TikHubService] 第二步获取用户信息响应:', JSON.stringify(userResponse.data, null, 2))

      if (userResponse.data?.code === 200 && userResponse.data?.data?.data) {
        const data = userResponse.data.data.data

        // 从interactions数组中找到"获赞与收藏"的数量
        const interaction = data.interactions?.find((item: any) => item.name === '获赞与收藏')
        const totalFavorited = interaction?.count || 0

        return {
          success: true,
          data: {
            nickname: data.nickname,
            avatar_url: data.images || data.imageb,
            desc: data.desc,
            follower_count: data.fans || data.follower_count || 0,
            following_count: data.follows || data.following_count || 0,
            notes_count: data.note_num_stat?.posted || data.notes_count || 0,
            interaction_count: totalFavorited,
            total_favorited: totalFavorited, // 小红书的获赞与收藏数
          },
        }
      }

      return {
        success: false,
        message: userResponse.data?.message || '获取用户详细信息失败',
      }
    } catch (error: any) {
      console.error('[TikHubService] 获取小红书用户信息失败:', error)
      console.error('[TikHubService] 错误详情:', error.response?.data || error.message)

      const errorMsg = error.response?.data?.detail ||
                      error.response?.data?.message ||
                      '请检查分享链接是否正确，确保使用完整的小红书分享链接'

      return {
        success: false,
        message: `获取失败: ${errorMsg}`,
      }
    }
  }
}
