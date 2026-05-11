import { Injectable, Logger } from '@nestjs/common'
import { Config, LLMClient, ImageGenerationClient } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { setCache } from '../../common/shared-cache'

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
    const db = getMySQLClient()
    const { contentType } = input

    const needImage = contentType === 'image' || contentType === 'image_text' || contentType === 'video'
    const needText = contentType === 'text' || contentType === 'image_text' || contentType === 'video'
    const needVideo = contentType === 'video'

    for (const platform of input.platforms) {
      try {
        this.logger.log(`为平台 ${platform} 生成 ${contentType} 类型内容...`)

        const platformResult: any = {
          platform,
          success: true,
          content: null,
          images: [],
          videos: []
        }

        // 1. 生成文字内容
        if (needText) {
          const textContent = await this.generateTextContent(platform, input)
          platformResult.content = textContent
        }

        // 2. 生成图片
        if (needImage) {
          const images = await this.generateImages(platform, input)
          platformResult.images = images
        }

        // 3. 生成视频（如果需要）
        if (needVideo) {
          const videos = await this.generateVideos(platform, input)
          platformResult.videos = videos
        }

        // 生成 requestId
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // 保存到数据库
        try {
          await db.insert('content_generation_requests', {
            id: requestId,
            avatar_id: input.avatarId,
            order_id: input.orderId,
            platform,
            status: 'completed',
            content: platformResult.content || '',
            images: platformResult.images.length > 0 ? JSON.stringify(platformResult.images) : null,
            video_url: platformResult.videos.length > 0 ? JSON.stringify(platformResult.videos) : null,
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
          })
          this.logger.log(`内容已保存到数据库, requestId: ${requestId}`)
        } catch (dbError: any) {
          this.logger.warn(`数据库保存失败: ${dbError.message}`)
        }

        // 保存到共享缓存（用 requestId 和 orderId 双重保存）
        const cacheData = {
          requestId,
          order_id: input.orderId,
          avatar_id: input.avatarId,
          platform,
          status: 'completed',
          generatedContent: {
            content: platformResult.content || '',
            images: platformResult.images || [],
            videos: platformResult.videos || [],
            platform
          },
          created_at: new Date().toISOString()
        }
        setCache(requestId, cacheData)
        setCache(input.orderId, cacheData)

        results.push({
          platform,
          requestId,
          success: true,
          content: platformResult.content,
          images: platformResult.images,
          videos: platformResult.videos
        })
      } catch (error: any) {
        this.logger.error(`生成内容失败: ${error.message}`)
        results.push({
          platform,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * 生成文字内容
   */
  private async generateTextContent(platform: string, input: any): Promise<string> {
    const { orderTitle, orderDescription, targetAudience, contentType, avatarName, avatarPersonality } = input
    const prompt = this.buildTextPrompt(platform, orderTitle, orderDescription, targetAudience, contentType)

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: `你是一个专业的社交媒体内容创作者，擅长根据需求生成吸引人的内容。${avatarPersonality ? `你的创作风格要符合分身"${avatarName}"的特点：${avatarPersonality}` : ''}` },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      return response.content || '内容生成完成'
    } catch (error: any) {
      this.logger.error(`LLM 调用失败: ${error.message}`)
      return this.getMockContent(platform, orderTitle)
    }
  }

  /**
   * 生成图片 - 使用 ImageGenerationClient
   */
  private async generateImages(platform: string, input: any): Promise<string[]> {
    const { orderTitle, orderDescription, contentQuantity = 1 } = input
    const imageCount = Math.max(1, Math.min(contentQuantity, 9))
    const images: string[] = []

    this.logger.log(`需要生成 ${imageCount} 张图片`)

    for (let i = 0; i < imageCount; i++) {
      const imagePrompt = this.buildImagePrompt(platform, orderTitle, orderDescription, input.avatarName, i + 1, imageCount)
      this.logger.log(`生成第 ${i + 1}/${imageCount} 张图片...`)

      try {
        const result = await this.imageClient.generate({
          prompt: imagePrompt,
          size: '1024x1024'
        })
        const helper = this.imageClient.getResponseHelper(result)
        if (helper.success && helper.imageUrls.length > 0) {
          images.push(...helper.imageUrls)
          this.logger.log(`Image ${i + 1} generated successfully`)
        } else if (result?.data?.length > 0) {
          for (const img of result.data) {
            if (img.url) images.push(img.url)
          }
        } else {
          this.logger.warn(`Image ${i + 1} returned empty result`)
        }
      } catch (error: any) {
        this.logger.error(`第 ${i + 1} 张图片生成失败: ${error.message}`)
      }
    }

    return images
  }

  /**
   * 生成视频
   */
  private async generateVideos(platform: string, input: any): Promise<string[]> {
    const { orderTitle, orderDescription, contentQuantity = 1 } = input
    const videoCount = Math.max(1, Math.min(contentQuantity, 3))
    const videos: string[] = []

    this.logger.log(`需要生成 ${videoCount} 个视频`)

    for (let i = 0; i < videoCount; i++) {
      const videoPrompt = this.buildVideoPrompt(platform, orderTitle, orderDescription, i + 1, videoCount)
      this.logger.log(`生成第 ${i + 1}/${videoCount} 个视频...`)

      try {
        const { spawnSync } = require('child_process')
        const result = spawnSync('coze-coding', ['video', '--prompt', videoPrompt, '--duration', '5'], { encoding: 'utf-8', timeout: 120000 })

        if (result.status === 0 && result.stdout) {
          try {
            const output = JSON.parse(result.stdout)
            if (output.url) {
              videos.push(output.url)
              this.logger.log(`第 ${i + 1} 个视频生成成功: ${output.url}`)
            }
          } catch {
            const url = result.stdout.trim()
            if (url.startsWith('http')) {
              videos.push(url)
            }
          }
        } else {
          this.logger.error(`第 ${i + 1} 个视频生成失败: ${result.stderr || '未知错误'}`)
        }
      } catch (error: any) {
        this.logger.error(`第 ${i + 1} 个视频生成失败: ${error.message}`)
      }
    }

    return videos
  }

  private buildTextPrompt(platform: string, title: string, description: string, targetAudience: string, contentType: string): string {
    const platformNames: Record<string, string> = {
      wechat_mp: '微信公众号', xiaohongshu: '小红书', douyin: '抖音',
      weibo: '微博', bilibili: '哔哩哔哩', kuaishou: '快手', wechat_moments: '微信朋友圈'
    }
    const platformName = platformNames[platform] || platform

    let prompt = `请为${platformName}平台生成推广内容。\n\n主题：${title}\n详细需求：${description || '根据主题自由发挥'}\n`
    if (targetAudience) prompt += `目标受众：${targetAudience}\n`

    switch (platform) {
      case 'wechat_mp':
        prompt += `\n要求：\n1. 结构清晰，包含开头引入、正文分析、结尾总结\n2. 字数在800-1500字之间\n3. 语言专业但不失亲和力\n4. 可以适当使用emoji增加可读性\n5. 标题要吸引人`
        break
      case 'xiaohongshu':
        prompt += `\n要求：\n1. 标题要吸引眼球，带有话题标签\n2. 内容要有代入感，像真实分享\n3. 字数在300-800字之间\n4. 多使用emoji和小表情\n5. 结尾要引导互动（点赞、收藏、关注）`
        break
      case 'douyin': case 'bilibili': case 'kuaishou':
        prompt += `\n要求：\n1. 适合短视频口播风格\n2. 开头3秒要有吸引力\n3. 语言口语化，节奏感强\n4. 字数在100-300字之间\n5. 结尾要有call to action`
        break
      case 'weibo':
        prompt += `\n要求：\n1. 话题性强，容易引发讨论\n2. 语言简洁有力\n3. 字数在100-300字之间`
        break
      case 'wechat_moments':
        prompt += `\n要求：\n1. 适合朋友圈分享\n2. 内容轻松自然\n3. 字数在50-200字之间\n4. 多使用emoji\n5. 结尾要自然`
        break
    }
    return prompt
  }

  private buildImagePrompt(platform: string, title: string, description: string, avatarName?: string, index?: number, total?: number): string {
    const platformStyles: Record<string, string> = {
      wechat_mp: '专业商务风格，高质量的配图，适合公众号封面',
      xiaohongshu: '精致生活风格，温暖色调，高颜值图片',
      douyin: '潮流时尚风格，视觉冲击力强，适合短视频封面',
      weibo: '多元化风格，可以是资讯图解或生活分享',
      bilibili: '年轻化风格，二次元元素可选，活泼有趣',
      kuaishou: '接地气风格，真实生活感',
      wechat_moments: '生活化风格，自然真实'
    }
    const style = platformStyles[platform] || '高质量商业摄影风格'
    const partInfo = total && total > 1 ? `（第${index}/${total}张）` : ''
    let prompt = `${style}的推广配图${partInfo}。\n主题：${title}\n`
    if (description) prompt += `内容：${description}\n`
    if (avatarName) prompt += `风格参考：${avatarName}的人设风格\n`
    prompt += `\n要求：图片要精美，吸引眼球，适合社交媒体传播`
    return prompt
  }

  private buildVideoPrompt(platform: string, title: string, description: string, index?: number, total?: number): string {
    const platformStyles: Record<string, string> = {
      douyin: '抖音短视频风格，节奏快，视觉冲击强',
      bilibili: 'B站风格，可以有创意有深度',
      kuaishou: '快手风格，接地气，真实感'
    }
    const style = platformStyles[platform] || '短视频风格'
    const partInfo = total && total > 1 ? `（第${index}/${total}个）` : ''
    let prompt = `生成一个${style}的推广短视频${partInfo}。\n主题：${title}\n`
    if (description) prompt += `内容：${description}\n`
    prompt += `\n要求：开头要有吸引力，整体节奏紧凑，适合短视频平台传播`
    return prompt
  }

  private getMockContent(platform: string, title: string): string {
    const mockContents: Record<string, string> = {
      wechat_mp: `# ${title}\n\n这是一篇关于${title}的专业文章。\n\n## 引言\n\n${title}是我们今天要讨论的重点主题...\n\n## 正文内容\n\n在这里我们会详细展开关于${title}的各种内容...\n\n## 总结\n\n以上就是关于${title}的全部内容，希望对你有所帮助！`,
      xiaohongshu: `# 🔥 ${title}\n\n姐妹们！今天必须跟你们分享这个！💕\n\n最近我发现了一个超级棒的东西——${title}！\n\n✨ 使用体验：\n- 效果真的绝绝子\n- 使用感满分\n- 性价比超高\n\n强烈推荐给大家！冲鸭！🦆\n\n#${title.replace(/\s+/g, '')} #好物推荐`,
      douyin: `家人们谁懂啊！${title}也太绝了吧！😭\n\n真的不是吹，这个${title}我用了之后直接封神！\n\n喜欢的赶紧冲！👇链接在评论区！`,
      weibo: `${title}\n\n今天来聊聊${title}这个话题~\n\n你们觉得怎么样？评论区见！\n\n#${title.replace(/\s+/g, '')} #生活日常`,
      wechat_moments: `${title} 🌟\n\n今天又是美好的一天～\n\n分享一个最近的心头好✨`
    }
    return mockContents[platform] || `关于${title}的分享内容`
  }
}
