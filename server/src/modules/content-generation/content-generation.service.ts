import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { AvatarToolRegistry } from '../avatar-agent/tools/tool-registry'
import { ToolContext } from '../avatar-agent/tools/tool.interface'
import { GeneratedContent } from './types'

// 平台到工具的映射
const PLATFORM_TOOL_MAPPING: Record<string, string> = {
  wechat_mp: 'write_wechat_mp_article',
  xiaohongshu: 'write_xiaohongshu_note',
  douyin: 'generate_video',
  weibo: 'write_wechat_mp_article', // 微博使用文章工具，后续可以优化
  bilibili: 'generate_video', // B站使用视频工具
  kuaishou: 'generate_video', // 快手使用视频工具
  wechat_moments: 'write_wechat_moments_content' // 微信朋友圈使用专门的朋友圈文案工具
}

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信小程序',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手',
  wechat_moments: '微信朋友圈'
}

interface GenerateContentInput {
  orderId: string
  requestId: string
  avatarId: string
  orderTitle: string
  orderDescription: string
  platforms: string[]
  contentType: string
  targetAudience: string
  avatarName?: string
  avatarPersonality?: string
  quantity?: number  // 生成内容数量
}

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name)

  constructor(private toolRegistry: AvatarToolRegistry) {}

  /**
   * 为分身生成内容（使用分身的技能/工具）
   */
  async generateContent(input: GenerateContentInput): Promise<GeneratedContent[]> {
    const {
      orderId,
      requestId,
      avatarId,
      orderTitle,
      orderDescription,
      platforms,
      contentType,
      targetAudience,
      avatarName = '分身',
      avatarPersonality,
      quantity = 1  // 默认生成1个
    } = input

    const results: GeneratedContent[] = []

    // 为每个平台生成内容
    for (const platform of platforms) {
      try {
        this.logger.log(`为平台 ${platform} 生成内容，使用分身技能...`)

        // 获取对应的工具
        const toolName = PLATFORM_TOOL_MAPPING[platform]
        if (!toolName) {
          this.logger.warn(`平台 ${platform} 没有对应的工具`)
          continue
        }

        // 检查工具是否存在
        if (!this.toolRegistry.hasTool(toolName)) {
          this.logger.warn(`工具 ${toolName} 不存在，跳过平台 ${platform}`)
          continue
        }

        // 构建工具参数，quantity 传递给工具表示需要的图片/视频数量
        const toolParams = this.buildToolParams(
          platform,
          orderTitle,
          orderDescription,
          contentType,
          targetAudience,
          avatarPersonality,
          quantity  // 传递 quantity 作为图片/视频数量
        )

        // 构建工具上下文
        const context: ToolContext = {
          avatarId,
          userId: '',
          conversationId: requestId,
          metadata: {
            orderId,
            requestId
          }
        }

        // 执行工具（只调用一次，工具内部会根据 image_count 生成多张图片）
        const result = await this.toolRegistry.executeTool(toolName, toolParams, context)

        if (!result.success) {
          this.logger.error(`工具 ${toolName} 执行失败:`, result.error)
          continue
        }

        // 解析工具输出
        const parsedContent = this.parseToolResult(result.data, platform)

        // 保存到数据库
        const contentRecord = await this.saveContent({
          order_id: orderId,
          request_id: requestId,
          avatar_id: avatarId,
          platform,
          ...parsedContent
        })

        results.push(contentRecord)
        this.logger.log(`平台 ${platform} 内容生成成功 (${quantity} 张图片)`)
      } catch (error) {
        this.logger.error(`平台 ${platform} 内容生成失败:`, error)
      }
    }

    // 如果没有成功生成任何内容，抛出错误
    if (results.length === 0) {
      throw new Error('所有平台内容生成失败')
    }

    return results
  }

  /**
   * 构建工具参数
   */
  private buildToolParams(
    platform: string,
    orderTitle: string,
    orderDescription: string,
    contentType: string,
    targetAudience: string,
    avatarPersonality?: string,
    quantity: number = 1  // 每套内容需要的图片/视频数量
  ): Record<string, any> {
    const baseParams = {
      topic: orderTitle,
      description: orderDescription,
      target_audience: targetAudience
    }

    // 根据平台添加特定参数
    if (platform === 'wechat_mp' || platform === 'weibo') {
      return {
        ...baseParams,
        emotion: this.mapContentTypeToEmotion(contentType),
        keywords: this.extractKeywords(orderDescription),
        include_cover: true
      }
    } else if (platform === 'xiaohongshu') {
      return {
        ...baseParams,
        style: this.mapContentTypeToStyle(contentType),
        keywords: this.extractKeywords(orderDescription),
        include_images: true
      }
    } else if (platform === 'douyin' || platform === 'bilibili' || platform === 'kuaishou') {
      return {
        ...baseParams,
        video_style: this.mapContentTypeToVideoStyle(contentType),
        duration: 'short', // 默认短视频
        include_background_music: true
      }
    } else if (platform === 'wechat_moments') {
      // 朋友圈：使用专门的朋友圈文案工具
      // quantity 表示每套朋友圈内容需要的图片数量
      return {
        topic: `${orderTitle}`,
        content_type: '图文',
        image_count: quantity,  // 每套内容包含的图片数量
        style: '产品推广',
        target_audience: `[重要提醒] 这是微信朋友圈（WeChat Moments）内容，不是小红书！\n朋友圈特点：\n- 简短精炼的文字（30-80字）\n- 生活化、口语化的表达\n- 真实自然，不做作\n- 适合与微信好友分享的内容\n\n${targetAudience}`
      }
    }

    return baseParams
  }

  /**
   * 将内容类型映射为情感基调
   */
  private mapContentTypeToEmotion(contentType: string): string {
    const emotionMap: Record<string, string> = {
      '文章': '干货',
      '图文': '情感',
      '短视频': '热点',
      '营销文案': '励志',
      '产品推广': '治愈',
      '品牌故事': '情感',
      '知识科普': '干货',
      '生活分享': '治愈',
      '娱乐八卦': '热点'
    }
    return emotionMap[contentType] || '干货'
  }

  /**
   * 将内容类型映射为风格
   */
  private mapContentTypeToStyle(contentType: string): string {
    const styleMap: Record<string, string> = {
      '文章': '干货',
      '图文': '种草',
      '短视频': '分享',
      '营销文案': '吐槽',
      '产品推广': '安利',
      '品牌故事': '种草',
      '知识科普': '干货',
      '生活分享': '种草',
      '娱乐八卦': '分享',
      'image': '种草',
      '图片': '种草'
    }
    return styleMap[contentType] || '种草'
  }

  /**
   * 将内容类型映射为视频风格
   */
  private mapContentTypeToVideoStyle(contentType: string): string {
    const styleMap: Record<string, string> = {
      '文章': '口播',
      '图文': '展示',
      '短视频': '快剪',
      '营销文案': '广告',
      '产品推广': '测评',
      '品牌故事': '叙事',
      '知识科普': '科普',
      '生活分享': 'vlog',
      '娱乐八卦': '搞笑'
    }
    return styleMap[contentType] || '快剪'
  }

  /**
   * 提取关键词
   */
  private extractKeywords(description: string): string[] {
    // 简单的关键词提取逻辑
    const keywords: string[] = []
    const commonKeywords = ['技巧', '方法', '攻略', '推荐', '分享', '教程', '指南', '秘籍', '心得', '经验']

    commonKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        keywords.push(keyword)
      }
    })

    return keywords.length > 0 ? keywords : ['干货', '分享']
  }

  /**
   * 解析工具输出
   */
  private parseToolResult(toolData: any, platform: string): Partial<GeneratedContent> {
    try {
      // 工具返回的数据结构可能不同，根据实际情况解析
      // 假设工具返回的结构是：
      // {
      //   title: "标题",
      //   content: "正文内容",
      //   hashtags: ["#标签1", "#标签2"],
      //   cover_image: "封面图URL",
      //   images: ["图片URL1", "图片URL2"],
      //   video_url: "视频URL"
      // }

      // 处理微信朋友圈的特殊格式（工具返回的是 text 而不是 content）
      let content = toolData.content || toolData.body || ''
      if (!content && toolData.text) {
        content = toolData.text
      }
      
      // 处理 wechat_moments_content 嵌套结构
      if (!content && toolData.wechat_moments_content) {
        content = toolData.wechat_moments_content.text || ''
      }

      return {
        title: toolData.title || toolData.topic || '',
        content: content,
        hashtags: Array.isArray(toolData.hashtags) ? toolData.hashtags : [],
        image_suggestions: [
          ...(Array.isArray(toolData.images) ? toolData.images : []),
          ...(Array.isArray(toolData.wechat_moments_content?.images) ? toolData.wechat_moments_content.images : []),
          ...(toolData.cover_image ? [toolData.cover_image] : [])
        ],
        video_suggestions: toolData.video_url ? [toolData.video_url] : [],
        status: 'draft'
      }
    } catch (error) {
      this.logger.warn('解析工具输出失败，使用原始数据', error)
      return {
        content: typeof toolData === 'string' ? toolData : JSON.stringify(toolData),
        hashtags: [],
        image_suggestions: [],
        video_suggestions: [],
        status: 'draft'
      }
    }
  }

  /**
   * 保存内容到数据库
   */
  private async saveContent(contentData: Partial<GeneratedContent> & {
    order_id: string
    request_id: string
    avatar_id: string
    platform: string
  }): Promise<GeneratedContent> {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('generated_content')
      .insert({
        order_id: contentData.order_id,
        request_id: contentData.request_id,
        avatar_id: contentData.avatar_id,
        platform: contentData.platform,
        content: contentData.content,
        hashtags: contentData.hashtags || [],
        image_suggestions: contentData.image_suggestions || [],
        video_suggestions: contentData.video_suggestions || [],
        title: contentData.title,
        status: contentData.status || 'draft'
      })
      .select()
      .single()

    if (error) {
      this.logger.error('保存内容失败:', error)
      throw error
    }

    return data
  }

  /**
   * 获取分身生成的内容
   * 支持字符串格式（如 avatar-6）和 UUID 格式（如 6ca9e8af-5951-478e-b36a-c7d51b9d80f2）的 avatarId
   */
  async getGeneratedContent(requestId: string, avatarId: string): Promise<GeneratedContent[]> {
    const client = getSupabaseClient()

    // 判断传入的 avatarId 格式，并同时查询两种可能的值
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(avatarId)
    
    let query = client
      .from('generated_content')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    // 如果是 UUID 格式，同时查询 UUID 和字符串格式（用于兼容旧数据）
    if (isUuidFormat) {
      // 使用 or 查询同时匹配两种格式
      query = query.or(`avatar_id.eq.${avatarId},avatar_id.eq.${avatarId.replace(/-/g, '')}`)
    } else {
      query = query.eq('avatar_id', avatarId)
    }

    const { data, error } = await query

    if (error) {
      this.logger.error('获取内容失败:', error)
      throw error
    }

    return data || []
  }

  /**
   * 更新内容状态
   */
  async updateContentStatus(
    contentId: string,
    status: 'draft' | 'approved' | 'published'
  ): Promise<void> {
    const client = getSupabaseClient()

    const { error } = await client
      .from('generated_content')
      .update({ status })
      .eq('id', contentId)

    if (error) {
      this.logger.error('更新内容状态失败:', error)
      throw error
    }
  }
}
