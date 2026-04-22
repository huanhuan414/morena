import { Injectable, Logger } from '@nestjs/common'
import { TikHubService } from '../tikhub/tikhub.service'
import { getSupabaseClient } from '../../storage/database/supabase-client'

export interface ValidateResult {
  success: boolean
  platform: string
  data?: {
    title?: string
    author?: string
    cover?: string
    description?: string
    url?: string
  }
  error?: string
}

export interface SaveWorkParams {
  orderId: string
  avatarId: string
  platform: string
  workTitle: string
  workUrl: string
  authorNickname?: string
  coverImage?: string
  description?: string
  extraData?: any
  feedbackImage?: string
}

@Injectable()
export class LinkValidationService {
  private readonly logger = new Logger(LinkValidationService.name)

  constructor(private readonly tikHubService: TikHubService) {}

  /**
   * 验证链接并获取作品信息
   * @param url 作品链接
   * @param orderId 订单ID（可选，用于保存到数据库）
   * @param avatarId 分身ID（可选，用于保存到数据库）
   */
  async validateLink(url: string, orderId?: string, avatarId?: string): Promise<ValidateResult> {
    try {
      // 参数验证
      if (!url || typeof url !== 'string') {
        return {
          success: false,
          platform: 'unknown',
          error: '链接不能为空'
        }
      }

      this.logger.log(`[LinkValidation] 开始验证链接: ${url}`)

      // 识别平台
      const platform = this.detectPlatform(url)
      if (!platform) {
        return {
          success: false,
          platform: 'unknown',
          error: '无法识别链接所属平台'
        }
      }

      this.logger.log(`[LinkValidation] 识别到平台: ${platform}`)

      // 根据平台调用不同的接口
      let result: ValidateResult
      switch (platform) {
        case 'douyin':
          result = await this.validateDouyin(url)
          break
        case 'xiaohongshu':
          result = await this.validateXiaohongshu(url)
          break
        case 'wechat_mp':
          result = await this.validateWechatMp(url)
          break
        default:
          result = {
            success: false,
            platform,
            error: '暂不支持该平台'
          }
      }

      // 如果验证成功且提供了订单ID和分身ID，保存到数据库
      if (result.success && orderId && avatarId && result.data) {
        try {
          await this.saveWork({
            orderId,
            avatarId,
            platform,
            workTitle: result.data.title || '',
            workUrl: result.data.url || url,
            authorNickname: result.data.author,
            coverImage: result.data.cover,
            description: result.data.description,
            extraData: result.data
          })
          this.logger.log(`[LinkValidation] 作品信息已保存到数据库`)
        } catch (saveError: any) {
          // 保存失败不影响验证结果，只记录日志
          this.logger.error(`[LinkValidation] 保存作品信息到数据库失败:`, saveError)
        }
      }

      return result
    } catch (error: any) {
      this.logger.error(`[LinkValidation] 验证链接失败:`, error)
      return {
        success: false,
        platform: 'unknown',
        error: error.message || '验证失败，请检查链接是否正确'
      }
    }
  }

  /**
   * 识别平台
   */
  private detectPlatform(url: string): string | null {
    if (url.includes('douyin.com') || url.includes('iesdouyin.com')) {
      return 'douyin'
    }
    if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) {
      return 'xiaohongshu'
    }
    if (url.includes('mp.weixin.qq.com') || url.includes('weixin.qq.com')) {
      return 'wechat_mp'
    }
    return null
  }

  /**
   * 验证抖音链接
   */
  private async validateDouyin(url: string): Promise<ValidateResult> {
    try {
      this.logger.log(`[LinkValidation] 验证抖音链接: ${url}`)

      const response = await this.tikHubService.callTikHubAPI(
        '/api/v1/douyin/app/v3/fetch_one_video_by_share_url',
        { share_url: url }
      )

      this.logger.log(`[LinkValidation] 抖音响应:`, response)

      if (!response || !response.data) {
        return {
          success: false,
          platform: 'douyin',
          error: '获取抖音视频信息失败'
        }
      }

      const videoData = response.data
      return {
        success: true,
        platform: 'douyin',
        data: {
          title: videoData.desc || videoData.title || '',
          author: videoData.author?.nickname || videoData.author?.unique_id || '',
          cover: videoData.cover || videoData.origin_cover || '',
          description: videoData.desc || '',
          url
        }
      }
    } catch (error: any) {
      this.logger.error(`[LinkValidation] 抖音验证失败:`, error)
      return {
        success: false,
        platform: 'douyin',
        error: error.message || '抖音链接验证失败'
      }
    }
  }

  /**
   * 验证小红书链接
   */
  private async validateXiaohongshu(url: string): Promise<ValidateResult> {
    try {
      this.logger.log(`[LinkValidation] 验证小红书链接: ${url}`)

      // 小红书笔记信息获取接口
      // 根据TikHub文档，使用app端接口获取笔记详情
      const response = await this.tikHubService.callTikHubAPI(
        '/api/v1/xiaohongshu/app/fetch_one_note_by_url',
        { url }
      )

      this.logger.log(`[LinkValidation] 小红书响应:`, response)

      if (!response || !response.data) {
        return {
          success: false,
          platform: 'xiaohongshu',
          error: '获取小红书笔记信息失败'
        }
      }

      const noteData = response.data

      // TikHub 返回的数据结构可能是：data.items[0].note_card
      const noteInfo = noteData.items?.[0]?.note_card || noteData

      return {
        success: true,
        platform: 'xiaohongshu',
        data: {
          title: noteInfo.title || noteInfo.desc || '',
          author: noteInfo.user?.nickname || noteInfo.author?.nickname || '',
          cover: noteInfo.cover?.url_default || noteInfo.cover?.url || noteInfo.image_list?.[0] || '',
          description: noteInfo.desc || noteInfo.title || '',
          url
        }
      }
    } catch (error: any) {
      this.logger.error(`[LinkValidation] 小红书验证失败:`, error)
      return {
        success: false,
        platform: 'xiaohongshu',
        error: error.message || '小红书链接验证失败'
      }
    }
  }

  /**
   * 验证微信公众号链接
   */
  private async validateWechatMp(url: string): Promise<ValidateResult> {
    try {
      this.logger.log(`[LinkValidation] 验证微信公众号链接: ${url}`)

      const response = await this.tikHubService.callTikHubAPI(
        '/api/v1/wechat_mp/web/fetch_mp_article_detail_html',
        { url }
      )

      this.logger.log(`[LinkValidation] 微信公众号响应:`, response)

      if (!response || !response.data) {
        return {
          success: false,
          platform: 'wechat_mp',
          error: '获取微信公众号文章信息失败'
        }
      }

      const articleData = response.data
      return {
        success: true,
        platform: 'wechat_mp',
        data: {
          title: articleData.title || articleData.msg_title || '',
          author: articleData.author || articleData.msg_cdn_url || '',
          cover: articleData.cover || articleData.msg_cdn_url || '',
          description: articleData.digest || '',
          url
        }
      }
    } catch (error: any) {
      this.logger.error(`[LinkValidation] 微信公众号验证失败:`, error)
      return {
        success: false,
        platform: 'wechat_mp',
        error: error.message || '微信公众号链接验证失败'
      }
    }
  }

  /**
   * 保存作品信息到数据库
   */
  async saveWork(params: SaveWorkParams): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      
      const workData = {
        order_id: params.orderId,
        avatar_id: params.avatarId,
        platform: params.platform,
        work_title: params.workTitle,
        work_url: params.workUrl,
        author_nickname: params.authorNickname,
        cover_image: params.coverImage,
        description: params.description,
        extra_data: params.extraData || {},
        status: 'verified',
        feedback_image: params.feedbackImage,
        updated_at: new Date().toISOString()
      }

      this.logger.log(`[LinkValidation] 保存作品信息:`, workData)

      const { data, error } = await supabase
        .from('published_works')
        .insert(workData)
        .select()
        .single()

      if (error) {
        this.logger.error(`[LinkValidation] 保存作品信息失败:`, error)
        throw error
      }

      this.logger.log(`[LinkValidation] 作品信息保存成功，ID: ${data.id}`)
    } catch (error: any) {
      this.logger.error(`[LinkValidation] 保存作品信息到数据库失败:`, error)
      throw error
    }
  }

  /**
   * 根据订单ID获取已发布的作品列表
   */
  async getWorksByOrderId(orderId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('published_works')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      if (error) {
        this.logger.error(`[LinkValidation] 获取作品列表失败:`, error)
        throw error
      }

      return data || []
    } catch (error: any) {
      this.logger.error(`[LinkValidation] 获取作品列表失败:`, error)
      throw error
    }
  }
}
