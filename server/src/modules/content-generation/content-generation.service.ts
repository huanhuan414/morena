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

    // 1. 生成文字内容（一条完整的文案）
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

    // 2. 生成配图（数量由 contentQuantity 决定）
    if (needImage) {
      try {
        images = await this.generateImages(platform, input, textContent)
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
   * 生成文字内容 - 一条完整的、有吸引力的文案
   */
  private async generateTextContent(platform: string, input: any): Promise<string> {
    const platformGuide: Record<string, string> = {
      wechat: `微信朋友圈风格要求：
- 开头要抓眼球，让人忍不住往下看
- 像朋友在聊天一样自然亲切，不要广告腔
- 适当用emoji点缀，但不要堆砌
- 控制在3-5行以内，朋友圈展示区域有限
- 可以制造悬念或引发共鸣
- 结尾自然带出产品/服务，不要硬广
- 不要用markdown标题格式(#)，用纯文本换行`,

      xiaohongshu: `小红书风格要求：
- 标题用【】或emoji开头，吸引点击
- 第一行要制造好奇心或痛点共鸣
- 分点阐述，每点一行，用emoji标号
- 适当加粗关键信息
- 结尾加话题标签（3-5个），如 #好物推荐 #种草
- 整体语调活泼、真实、有分享感
- 使用markdown格式`,

      douyin: `抖音风格要求：
- 开头3秒就要炸，设置强悬念
- 口语化表达，像在对朋友说话
- 节奏快，信息密度高
- 适当用网络热词和梗
- 结尾要引导互动（点赞/评论/关注）
- 适合短视频脚本的节奏感
- 使用markdown格式`,

      weibo: `微博风格要求：
- 第一句话就要炸裂，引发讨论
- 简洁有力，140字以内核心信息
- 带热门话题标签
- 适当用emoji
- 结尾引导转发评论
- 使用markdown格式`,

      bilibili: `B站风格要求：
- 标题要有梗，吸引点击
- 内容专业有趣并重
- 可以适当二次元用语
- 详细但不啰嗦
- 结尾求三连
- 使用markdown格式`,

      kuaishou: `快手风格要求：
- 接地气，说人话
- 生活化场景感强
- 真实不做作
- 适当用方言感表达
- 结尾引导关注
- 使用markdown格式`
    }

    const guide = platformGuide[platform] || platformGuide.wechat

    const prompt = `你是一个顶级社交媒体内容创作高手，深谙各平台的内容玩法和用户心理。

【商单任务】
标题：${input.orderTitle}
详细要求：${input.orderDescription}
目标平台：${platform}
目标受众：${input.targetAudience}
${input.avatarName ? `分身人设：${input.avatarName}，${input.avatarPersonality || '专业有趣'}` : ''}

【${guide}】

【创作要求】
1. 严格按照上述平台风格创作，不要用其他平台的风格
2. 内容必须紧扣商单主题，突出产品/服务的核心卖点
3. 文案要有感染力，让目标受众产生购买欲或行动欲
4. 禁止出现"作为AI"、"我是一个"等AI痕迹
5. 直接输出文案内容，不要输出任何创作说明或注释

请创作一条完整的高质量推广文案：`

    try {
      const response = await this.llmClient.invoke(
        [{ role: 'user', content: prompt }]
      )
      return response?.content || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `${input.orderTitle}\n\n${input.orderDescription}`
    }
  }

  /**
   * 生成配图 - 与文案和订单紧密相关的精美图片
   */
  private async generateImages(platform: string, input: any, textContent: string): Promise<string[]> {
    const quantity = input.contentQuantity || 3
    const images: string[] = []

    // 根据平台和订单构建精准的图片提示词
    const imagePrompts = this.buildImagePrompts(platform, input, textContent, quantity)

    for (let i = 0; i < imagePrompts.length; i++) {
      try {
        this.logger.log(`正在生成第${i + 1}张图片，提示词: ${imagePrompts[i].substring(0, 80)}...`)

        const response = await this.imageClient.generate({
          prompt: imagePrompts[i],
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
   * 构建图片提示词 - 让每张图都有明确主题，与订单强相关
   */
  private buildImagePrompts(platform: string, input: any, textContent: string, quantity: number): string[] {
    const title = input.orderTitle || '产品展示'
    const desc = input.orderDescription || ''
    const audience = input.targetAudience || '年轻人'

    // 不同平台的图片风格
    const styleMap: Record<string, string> = {
      wechat: 'warm, lifestyle, natural lighting, cozy atmosphere, high quality photo',
      xiaohongshu: 'aesthetic, trendy, soft pastel tones, clean composition, Instagram style',
      douyin: 'vibrant, eye-catching, dynamic, trendy, high contrast, short video thumbnail style',
      weibo: 'bold, modern, clean design, professional look',
      bilibili: 'creative, playful, anime-inspired elements, colorful',
      kuaishou: 'authentic, real-life, down-to-earth, natural'
    }
    const style = styleMap[platform] || styleMap.wechat

    const prompts: string[] = []

    // 第1张：主图 - 展示核心产品/服务
    prompts.push(`Commercial product photography, ${title}, ${desc.substring(0, 100)}, ${style}, professional lighting, 4K, attractive and appealing to ${audience}`)

    // 第2张：场景图 - 使用场景/生活化
    if (quantity >= 2) {
      prompts.push(`Lifestyle scene photography, people using ${title} in daily life, ${style}, natural and engaging, showing real benefits, 4K, appealing to ${audience}`)
    }

    // 第3张：细节/效果图
    if (quantity >= 3) {
      prompts.push(`Detail and effect showcase, ${title} close-up showing quality and features, ${style}, professional product shot, 4K, convincing and desirable to ${audience}`)
    }

    // 第4张及以后：更多角度
    for (let i = 3; i < quantity; i++) {
      prompts.push(`Creative promotional image for ${title}, unique angle ${i + 1}, ${style}, eye-catching design, 4K, appealing to ${audience}`)
    }

    return prompts
  }

  /**
   * 生成视频（占位）
   */
  private async generateVideos(platform: string, input: any): Promise<string[]> {
    return []
  }
}
