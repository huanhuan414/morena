import { Injectable, Logger } from '@nestjs/common'
import { Config } from 'coze-coding-dev-sdk'
import { LLMClient } from 'coze-coding-dev-sdk'
import { SupabaseService } from '../supabase/supabase.service'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信小程序',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

// 平台特性
const PLATFORM_FEATURES: Record<string, {
  characterLimit: number
  supportsImages: boolean
  supportsVideo: boolean
  tone: string
}> = {
  wechat_mp: {
    characterLimit: 1000,
    supportsImages: true,
    supportsVideo: true,
    tone: '专业、亲切'
  },
  xiaohongshu: {
    characterLimit: 1000,
    supportsImages: true,
    supportsVideo: true,
    tone: '时尚、生活化、emoji丰富'
  },
  douyin: {
    characterLimit: 200,
    supportsImages: false,
    supportsVideo: true,
    tone: '轻松、有趣、互动性强'
  },
  weibo: {
    characterLimit: 140,
    supportsImages: true,
    supportsVideo: true,
    tone: '简练、有力、话题感强'
  },
  bilibili: {
    characterLimit: 500,
    supportsImages: true,
    supportsVideo: true,
    tone: '专业、二次元、年轻化'
  },
  kuaishou: {
    characterLimit: 200,
    supportsImages: false,
    supportsVideo: true,
    tone: '接地气、真实、互动性强'
  }
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

interface GeneratedContent {
  id?: string
  order_id: string
  request_id: string
  avatar_id: string
  platform: string
  content: string
  hashtags: string[]
  image_suggestions: string[]
  video_suggestions: string[]
  title?: string
  status: 'draft' | 'approved' | 'published'
  created_at: string
}

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name)
  private llmClient: LLMClient

  constructor(private supabase: SupabaseService) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  /**
   * 为分身生成内容
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
        this.logger.log(`为平台 ${platform} 生成内容...`)

        // 构建系统提示词
        const systemPrompt = this.buildSystemPrompt(
          platform,
          contentType,
          targetAudience,
          avatarName,
          avatarPersonality
        )

        // 构建用户提示词
        const userPrompt = this.buildUserPrompt(
          orderTitle,
          orderDescription,
          platform
        )

        // 调用LLM生成内容
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]

        const response = await this.llmClient.invoke(messages, {
          model: 'doubao-seed-2-0-lite-260215',
          temperature: 0.8,
          thinking: 'disabled'
        })

        // 解析生成的内容
        const parsedContent = this.parseGeneratedContent(response.content, platform)

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
   * 构建系统提示词
   */
  private buildSystemPrompt(
    platform: string,
    contentType: string,
    targetAudience: string,
    avatarName: string,
    avatarPersonality?: string
  ): string {
    const platformInfo = PLATFORM_FEATURES[platform] || PLATFORM_FEATURES.wechat_mp
    const platformName = PLATFORM_NAMES[platform] || platform

    let prompt = `你是一个专业的内容创作助手，帮助分身 "${avatarName}" 为 ${platformName} 平台创作内容。

平台特性：
- 平台名称：${platformName}
- 字符限制：${platformInfo.characterLimit}字
- 支持图片：${platformInfo.supportsImages ? '是' : '否'}
- 支持视频：${platformInfo.supportsVideo ? '是' : '否'}
- 语调风格：${platformInfo.tone}

创作要求：
1. 内容类型：${contentType}
2. 目标受众：${targetAudience}`

    if (avatarPersonality) {
      prompt += `\n3. 分身个性：${avatarPersonality}`
    }

    prompt += `

输出格式要求（严格按照JSON格式）：
{
  "title": "内容标题（如果需要）",
  "content": "正文内容",
  "hashtags": ["#话题1", "#话题2"],
  "image_suggestions": ["图片建议1", "图片建议2"],
  "video_suggestions": ["视频建议1", "视频建议2"]
}

注意事项：
- 内容要符合平台调性
- 使用emoji增加亲和力
- 标签要相关且有热度
- 图片/视频建议要具体可行
- 保持原创性和吸引力`

    return prompt
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    orderTitle: string,
    orderDescription: string,
    platform: string
  ): string {
    const platformInfo = PLATFORM_FEATURES[platform] || PLATFORM_FEATURES.wechat_mp

    return `请为以下订单需求生成适合 ${PLATFORM_NAMES[platform]} 平台的内容：

订单标题：${orderTitle}
需求描述：${orderDescription}

要求：
- 正文内容控制在 ${platformInfo.characterLimit} 字以内
- 内容要贴近用户需求
- 引导用户互动
- 增加转化引导

请按照系统提示词中指定的JSON格式输出。`
  }

  /**
   * 解析生成的内容
   */
  private parseGeneratedContent(rawContent: string, platform: string): Partial<GeneratedContent> {
    try {
      // 尝试提取JSON部分（可能包含在markdown代码块中）
      let jsonStr = rawContent

      // 如果内容包含代码块，提取JSON部分
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }

      const parsed = JSON.parse(jsonStr)

      return {
        content: parsed.content || rawContent,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        image_suggestions: Array.isArray(parsed.image_suggestions) ? parsed.image_suggestions : [],
        video_suggestions: Array.isArray(parsed.video_suggestions) ? parsed.video_suggestions : [],
        title: parsed.title,
        status: 'draft'
      }
    } catch (error) {
      this.logger.warn('解析生成内容失败，使用原始内容', error)
      // 如果解析失败，使用原始内容
      return {
        content: rawContent,
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
    const { data, error } = await this.supabase.client
      .from('generated_contents')
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
    const { data, error } = await this.supabase.client
      .from('generated_contents')
      .select('*')
      .eq('request_id', requestId)
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false })

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
    const { error } = await this.supabase.client
      .from('generated_contents')
      .update({ status })
      .eq('id', contentId)

    if (error) {
      this.logger.error('更新内容状态失败:', error)
      throw error
    }
  }
}
