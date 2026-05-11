import { Injectable, Logger } from '@nestjs/common'
import { Config, LLMClient, ImageGenerationClient } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { setCache, getCache } from '../../common/shared-cache'

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name)
  private readonly llmClient: LLMClient
  private readonly imageClient: ImageGenerationClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    this.imageClient = new ImageGenerationClient(config)
  }

  /**
   * 创建内容生成请求 - 立即返回，后台异步生成
   */
  async generateContent(input: {
    orderId: string
    avatarId: string
    orderTitle: string
    orderDescription: string
    platforms: string[]
    contentType: string
    targetAudience: string
    avatarName?: string
    avatarPersonality?: string
    contentQuantity?: number
  }): Promise<any[]> {
    const results: any[] = []

    for (const platform of input.platforms) {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 1. 先在数据库创建 pending 记录，立即返回
      const db = getMySQLClient()
      try {
        await db.insert('content_generation_requests', {
          id: requestId,
          avatar_id: input.avatarId,
          order_id: input.orderId,
          platform,
          status: 'processing',
          content: '',
          images: null,
          video_url: null,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        })
        this.logger.log(`创建生成记录: ${requestId}, 状态: processing`)
      } catch (dbError: any) {
        this.logger.warn(`数据库创建记录失败: ${dbError.message}`)
      }

      // 2. 写入缓存（processing 状态）
      const cacheData = {
        requestId,
        order_id: input.orderId,
        avatar_id: input.avatarId,
        platform,
        status: 'processing',
        generatedContent: null,
        created_at: new Date().toISOString()
      }
      setCache(requestId, cacheData)
      setCache(input.orderId, cacheData)

      results.push({
        platform,
        requestId,
        status: 'processing'
      })

      // 3. 后台异步执行生成（不 await，让接口立即返回）
      this.executeGeneration(requestId, platform, input).catch(err => {
        this.logger.error(`后台生成失败: ${err.message}`, err.stack)
        this.updateStatus(requestId, input.orderId, 'failed', null)
      })
    }

    return results
  }

  /**
   * 后台异步执行内容生成
   */
  private async executeGeneration(
    requestId: string,
    platform: string,
    input: any
  ): Promise<void> {
    const { contentType } = input
    const needImage = contentType === 'image' || contentType === 'image_text' || contentType === 'video'
    const needText = contentType === 'text' || contentType === 'image_text' || contentType === 'video'
    const needVideo = contentType === 'video'

    this.logger.log(`开始后台生成: requestId=${requestId}, platform=${platform}`)

    let textContent = ''
    let images: string[] = []
    let videos: string[] = []

    // 1. 生成文字内容
    if (needText) {
      try {
        textContent = await this.generateTextContent(platform, input)
        this.logger.log(`文案生成完成: ${textContent.length}字`)
        // 更新中间状态
        this.updatePartialContent(requestId, input.orderId, textContent, images, videos)
      } catch (err: any) {
        this.logger.warn(`文案生成失败: ${err.message}`)
      }
    }

    // 2. 生成图片
    if (needImage) {
      try {
        images = await this.generateImages(platform, input)
        this.logger.log(`图片生成完成: ${images.length}张`)
        this.updatePartialContent(requestId, input.orderId, textContent, images, videos)
      } catch (err: any) {
        this.logger.warn(`图片生成失败: ${err.message}`)
      }
    }

    // 3. 生成视频
    if (needVideo) {
      try {
        videos = await this.generateVideos(platform, input)
        this.logger.log(`视频生成完成: ${videos.length}个`)
      } catch (err: any) {
        this.logger.warn(`视频生成失败: ${err.message}`)
      }
    }

    // 4. 更新为完成状态
    this.updateStatus(requestId, input.orderId, 'completed', {
      content: textContent,
      images,
      videos,
      platform
    })
  }

  /**
   * 更新中间状态（部分内容已生成）
   */
  private updatePartialContent(
    requestId: string,
    orderId: string,
    content: string,
    images: string[],
    videos: string[]
  ): void {
    const cacheData = {
      requestId,
      order_id: orderId,
      status: 'processing',
      generatedContent: {
        content: content || '',
        images: images || [],
        videos: videos || []
      },
      created_at: new Date().toISOString()
    }
    setCache(requestId, cacheData)
    setCache(orderId, cacheData)

    // 更新数据库
    const db = getMySQLClient()
    db.query(
      'UPDATE content_generation_requests SET content = ?, images = ? WHERE id = ?',
      [content, images.length > 0 ? JSON.stringify(images) : null, requestId]
    ).catch(err => this.logger.warn(`更新中间状态失败: ${err.message}`))
  }

  /**
   * 更新最终状态
   */
  private updateStatus(
    requestId: string,
    orderId: string,
    status: string,
    generatedContent: any
  ): void {
    const cacheData = {
      requestId,
      order_id: orderId,
      status,
      generatedContent,
      created_at: new Date().toISOString()
    }
    setCache(requestId, cacheData)
    setCache(orderId, cacheData)

    // 更新数据库
    const db = getMySQLClient()
    if (status === 'completed' && generatedContent) {
      db.query(
        'UPDATE content_generation_requests SET status = ?, content = ?, images = ?, video_url = ? WHERE id = ?',
        [
          status,
          generatedContent.content || '',
          generatedContent.images?.length > 0 ? JSON.stringify(generatedContent.images) : null,
          generatedContent.videos?.length > 0 ? JSON.stringify(generatedContent.videos) : null,
          requestId
        ]
      ).catch(err => this.logger.warn(`更新完成状态失败: ${err.message}`))
    } else if (status === 'failed') {
      db.query(
        'UPDATE content_generation_requests SET status = ? WHERE id = ?',
        [status, requestId]
      ).catch(err => this.logger.warn(`更新失败状态失败: ${err.message}`))
    }

    this.logger.log(`状态更新: requestId=${requestId}, status=${status}`)
  }

  /**
   * 生成文字内容
   */
  private async generateTextContent(platform: string, input: any): Promise<string> {
    const platformStyles: Record<string, string> = {
      xiaohongshu: '小红书风格，使用emoji，分段清晰，带话题标签',
      douyin: '抖音风格，口语化，适合短视频脚本',
      wechat: '微信朋友圈风格，简洁亲和',
      weibo: '微博风格，简洁有力，带话题',
      bilibili: 'B站风格，二次元友好，详细专业',
      kuaishou: '快手风格，接地气，生活化'
    }

    const style = platformStyles[platform] || '通用社交媒体风格'
    const quantity = input.contentQuantity || 1

    const prompt = `你是一个专业的社交媒体内容创作者。请根据以下信息生成${quantity}份内容：

商单标题：${input.orderTitle}
商单描述：${input.orderDescription}
目标平台：${platform}
目标受众：${input.targetAudience}
内容风格：${style}
分身人设：${input.avatarName || '专业创作者'}，${input.avatarPersonality || '专业、有趣'}

请生成完整的推广文案，使用markdown格式，包含标题、正文和话题标签。`

    try {
      const response = await this.llmClient.invoke(
        [{ role: 'user', content: prompt }]
      )
      return response?.content || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `# ${input.orderTitle}\n\n${input.orderDescription}\n\n> 内容生成中，请稍候...\n\n#${platform} #推广`
    }
  }

  /**
   * 生成图片
   */
  private async generateImages(platform: string, input: any): Promise<string[]> {
    const quantity = input.contentQuantity || 3
    const images: string[] = []

    for (let i = 0; i < quantity; i++) {
      try {
        const prompt = `${input.orderDescription}，${platform}风格，高质量，精美${i > 0 ? `，变体${i + 1}` : ''}`
        this.logger.log(`正在生成第${i + 1}张图片...`)

        const response = await this.imageClient.generate({
          prompt,
          size: '2k',
        })

        if (response?.data?.[0]?.url) {
          images.push(response.data[0].url)
          this.logger.log(`第${i + 1}张图片生成成功`)
        }
      } catch (err: any) {
        this.logger.warn(`第${i + 1}张图片生成失败: ${err.message}`)
      }
    }

    return images
  }

  /**
   * 生成视频（占位）
   */
  private async generateVideos(platform: string, input: any): Promise<string[]> {
    // 视频生成暂时返回空数组
    return []
  }
}
