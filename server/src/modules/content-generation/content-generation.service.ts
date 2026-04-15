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
  kuaishou: 'generate_video' // 快手使用视频工具
}

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信小程序',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
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
      avatarPersonality
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

        // 构建工具参数
        const toolParams = this.buildToolParams(
          platform,
          orderTitle,
          orderDescription,
          contentType,
          targetAudience,
          avatarPersonality
        )

        // 构建工具上下文
        const context: ToolContext = {
          avatarId,
          userId: '', // 可以从订单中获取
          conversationId: requestId,
          metadata: {
            orderId,
            requestId
          }
        }

        // 执行工具
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

        this.logger.log(`平台 ${platform} 内容生成成功`)
      } catch (error) {
        this.logger.error(`平台 ${platform} 内容生成失败:`, error)
        // 即使失败也继续处理其他平台
      }
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
    avatarPersonality?: string
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
    } else if (platform === 'douyin' || platform === 'bilibibili' || platform === 'kuaishou') {
      return {
        ...baseParams,
        video_style: this.mapContentTypeToVideoStyle(contentType),
        duration: 'short', // 默认短视频
        include_background_music: true
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
      '短视频': 'vlog',
      '营销文案': '广告',
      '产品推广': '测评',
      '品牌故事': '故事',
      '知识科普': '科普',
      '生活分享': '生活',
      '娱乐八卦': '娱乐'
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

      return {
        title: toolData.title || toolData.topic || '',
        content: toolData.content || toolData.body || '',
        hashtags: Array.isArray(toolData.hashtags) ? toolData.hashtags : [],
        image_suggestions: [
          ...(Array.isArray(toolData.images) ? toolData.images : []),
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
   */
  async getGeneratedContent(requestId: string, avatarId: string): Promise<GeneratedContent[]> {
    const client = getSupabaseClient()

    // 使用 RPC 函数绕过 schema cache 问题
    const { data, error } = await client
      .rpc('get_generated_content', {
        p_request_id: requestId,
        p_avatar_id: avatarId
      })

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
