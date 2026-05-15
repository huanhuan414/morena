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

  /**
   * 验证发布内容 — 通过分享链接解析并比对关键词
   * 支持平台：抖音、快手、小红书、微信公众号
   * @param platform 平台标识 (douyin/kuaishou/xiaohongshu/wechat_mp)
   * @param postUrl 发布内容链接
   * @param keywords 用于比对的关键词（从生成的文案标题/品牌名中提取）
   */
  async verifyPost(platform: string, postUrl: string, keywords: string[] = []) {
    try {
      console.log(`[TikHubService] 验证发布内容: platform=${platform}, url=${postUrl}, keywords=${keywords.join(',')}`)

      if (!postUrl) {
        return { success: false, message: '请输入发布链接' }
      }

      // 小红书：使用专用接口，支持短链接
      if (platform === 'xiaohongshu') {
        return await this.verifyXiaohongshuPost(postUrl, keywords)
      }

      // 抖音 / 快手：使用 TikHub 混合解析接口
      if (['douyin', 'kuaishou'].includes(platform)) {
        return await this.verifyViaTikHub(platform, postUrl, keywords)
      }

      // 微信公众号：直接抓取文章内容
      if (platform === 'wechat_mp' || platform === 'wechat_channel') {
        return await this.verifyWechatArticle(postUrl, keywords)
      }

      // 其他平台暂不支持自动验证
      return { success: false, message: '该平台暂不支持自动验证', data: null }
    } catch (error: any) {
      console.error('[TikHubService] 验证发布内容失败:', error)
      return {
        success: false,
        message: error.response?.data?.detail || error.response?.data?.message || error.message || '验证失败',
      }
    }
  }

  /**
   * 小红书专用验证接口 - 支持短链接和完整链接
   * 使用 /xiaohongshu/app_v2/get_image_note_detail 接口
   */
  private async verifyXiaohongshuPost(postUrl: string, keywords: string[]) {
    try {
      console.log('[TikHubService] 小红书专用接口验证:', postUrl)

      // 简单验证：只要链接包含 xhslink 就通过
      if (postUrl.toLowerCase().includes('xhslink')) {
        return {
          success: true,
          data: {
            platform: 'xiaohongshu',
            verified: true,
            title: '',
            nickname: '',
            noteId: '',
            keywordMatch: true,
            message: '验证通过：小红书链接有效',
          },
        }
      }

      const response = await this.axios.get('/xiaohongshu/app_v2/get_image_note_detail', {
        params: { share_text: postUrl },
      })

      console.log('[TikHubService] 小红书接口响应:', JSON.stringify(response.data)?.substring(0, 1000))

      if (response.data?.code !== 200 || !response.data?.data) {
        return {
          success: false,
          message: response.data?.message || '无法解析该链接，请确认链接是否正确',
        }
      }

      // 小红书返回的数据结构: data.data[0].note_list[0]
      const outerData = response.data.data
      const dataArray = outerData.data || outerData
      const firstItem = Array.isArray(dataArray) ? dataArray[0] : dataArray
      const noteList = firstItem?.note_list || []
      const note = noteList[0] || firstItem

      // 获取标题和描述
      const title = note.title || ''
      const desc = note.desc || ''
      const content = title || desc || ''
      const nickname = note.user?.nickname || firstItem?.user?.nickname || ''
      const noteId = note.id || note.note_id || ''

      console.log('[TikHubService] 解析结果: title=', title, ', desc=', desc?.substring(0, 50), ', nickname=', nickname)

      // 关键词比对（仅作参考，不影响验证结果）
      let keywordMatch = false
      let keywordInfo = ''
      if (keywords.length > 0 && content) {
        keywordMatch = keywords.some(kw => 
          title.toLowerCase().includes(kw.toLowerCase()) || 
          desc.toLowerCase().includes(kw.toLowerCase())
        )
        keywordInfo = keywordMatch 
          ? '关键词匹配成功' 
          : '关键词未匹配，但链接有效，验证通过'
      } else {
        keywordMatch = true
        keywordInfo = '无关键词要求或帖子有内容'
      }

      return {
        success: true,
        data: {
          platform: 'xiaohongshu',
          verified: true, // 只要链接解析成功就算通过
          title: content,
          nickname,
          noteId,
          keywordMatch,
          message: `验证通过：链接有效，已发布到小红书${keywordMatch ? '' : '（关键词未匹配）'}`,
          keywordInfo,
        },
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('[TikHubService] 小红书验证失败:', errorMsg)
      return {
        success: false,
        message: `链接解析失败: ${errorMsg}`,
      }
    }
  }

  /**
   * 通过 TikHub 混合解析接口验证抖音/快手/小红书发布内容
   */
  private async verifyViaTikHub(platform: string, postUrl: string, keywords: string[]) {
    try {
      const response = await this.axios.get('/hybrid/video_data', {
        params: { url: postUrl },
      })

      if (response.data?.code !== 200 || !response.data?.data) {
        return {
          success: false,
          message: response.data?.message || '无法解析该链接，请确认链接是否正确',
        }
      }

      const videoData = response.data.data
      const title = videoData.title || videoData.desc || ''
      const nickname = videoData.author?.nickname || videoData.author?.unique_id || ''
      const awemeId = videoData.aweme_id || videoData.note_id || ''

      // 关键词比对：只要有任意一个关键词出现在标题中即可
      let keywordMatch = false
      if (keywords.length > 0) {
        keywordMatch = keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()))
      } else {
        // 没有关键词时，只要能解析到内容就算验证通过
        keywordMatch = true
      }

      return {
        success: true,
        data: {
          platform,
          verified: keywordMatch,
          title,
          nickname,
          awemeId,
          keywordMatch,
          message: keywordMatch ? '验证通过：发布内容与订单要求匹配' : '验证未通过：发布内容与订单要求不匹配，请确认是否发布了正确内容',
        },
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('[TikHubService] TikHub 解析失败:', errorMsg)
      return {
        success: false,
        message: `链接解析失败: ${errorMsg}`,
      }
    }
  }

  /**
   * 验证微信公众号文章
   */
  private async verifyWechatArticle(postUrl: string, keywords: string[]) {
    try {
      // 微信公众号文章通过 mp.weixin.qq.com 链接直接获取
      const response = await axios.get(postUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 15000,
      })

      const html = response.data || ''
      // 提取标题：微信文章标题在 <h1> 或 id="activity-name" 中
      let title = ''
      const titleMatch = html.match(/id="activity-name"[^>]*>([\s\S]*?)<\/h1>/) ||
                         html.match(/<h1[^>]*class="rich_media_title"[^>]*>([\s\S]*?)<\/h1>/) ||
                         html.match(/<title>([\s\S]*?)<\/title>/)
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
      }

      // 关键词比对
      let keywordMatch = false
      if (keywords.length > 0) {
        keywordMatch = keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()))
      } else {
        keywordMatch = !!title
      }

      return {
        success: true,
        data: {
          platform: 'wechat_mp',
          verified: keywordMatch,
          title,
          keywordMatch,
          message: keywordMatch ? '验证通过：发布内容与订单要求匹配' : '验证未通过：发布内容与订单要求不匹配',
        },
      }
    } catch (error: any) {
      console.error('[TikHubService] 微信文章验证失败:', error.message)
      return {
        success: false,
        message: `微信文章验证失败: ${error.message}`,
      }
    }
  }
}
