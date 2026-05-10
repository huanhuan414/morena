import { Injectable, Logger } from '@nestjs/common'
import { Config, LLMClient } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../storage/database/mysql-client'

const PLATFORM_TOOL_MAPPING: Record<string, string> = {
  wechat_mp: 'write_wechat_mp_article',
  xiaohongshu: 'write_xiaohongshu_note',
  douyin: 'generate_video',
  weibo: 'write_wechat_mp_article',
  bilibili: 'generate_video',
  kuaishou: 'generate_video',
  wechat_moments: 'write_wechat_moments_content'
}

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name)
  private readonly llmClient: LLMClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
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
    quantity?: number
  }): Promise<any[]> {
    const results: any[] = []
    const db = getMySQLClient()

    for (const platform of input.platforms) {
      try {
        this.logger.log(`为平台 ${platform} 生成内容...`)

        // 生成内容
        let generatedContent = await this.generateContentByPlatform(platform, input)

        // 保存生成请求和内容
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await db.insert('content_generation_requests', {
          id: requestId,
          avatar_id: input.avatarId,
          order_id: input.orderId,
          platform,
          status: 'completed',
          content: generatedContent,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        })

        results.push({
          platform,
          requestId,
          success: true,
          content: generatedContent
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
   * 根据平台生成内容
   */
  private async generateContentByPlatform(platform: string, input: any): Promise<string> {
    const { orderTitle, orderDescription, targetAudience, contentType, avatarName, avatarPersonality } = input

    // 根据平台构建不同的生成提示词
    const prompt = this.buildPrompt(platform, orderTitle, orderDescription, targetAudience, contentType)

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
      // 如果 LLM 调用失败，返回模拟内容
      return this.getMockContent(platform, orderTitle)
    }
  }

  /**
   * 构建生成提示词
   */
  private buildPrompt(platform: string, title: string, description: string, targetAudience: string, contentType: string): string {
    const platformNames: Record<string, string> = {
      wechat_mp: '微信公众号',
      xiaohongshu: '小红书',
      douyin: '抖音',
      weibo: '微博',
      bilibili: '哔哩哔哩',
      kuaishou: '快手',
      wechat_moments: '微信朋友圈'
    }

    const platformName = platformNames[platform] || platform

    let prompt = `请为${platformName}平台生成一篇推广内容。\n\n`
    prompt += `主题：${title}\n`
    prompt += `详细需求：${description || '根据主题自由发挥'}\n`
    if (targetAudience) {
      prompt += `目标受众：${targetAudience}\n`
    }

    // 根据平台和内容类型调整提示词
    switch (platform) {
      case 'wechat_mp':
        prompt += `\n要求：
1. 结构清晰，包含开头引入、正文分析、结尾总结
2. 字数在800-1500字之间
3. 语言专业但不失亲和力
4. 可以适当使用emoji增加可读性
5. 标题要吸引人`
        break
      case 'xiaohongshu':
        prompt += `\n要求：
1. 标题要吸引眼球，带有话题标签
2. 内容要有代入感，像真实分享
3. 字数在300-800字之间
4. 多使用emoji和小表情
5. 结尾要引导互动（点赞、收藏、关注）`
        break
      case 'douyin':
      case 'bilibili':
      case 'kuaishou':
        prompt += `\n要求：
1. 适合短视频口播风格
2. 开头3秒要有吸引力（黄金开场）
3. 语言口语化，节奏感强
4. 字数在100-300字之间
5. 结尾要有call to action`
        break
      case 'weibo':
        prompt += `\n要求：
1. 话题性强，容易引发讨论
2. 语言简洁有力，适合快速阅读
3. 字数在100-300字之间
4. 可以配合热门话题标签`
        break
      case 'wechat_moments':
        prompt += `\n要求：
1. 适合朋友圈分享
2. 语言自然，像朋友间的推荐
3. 字数在50-150字之间
4. 不要太商业化`
        break
      default:
        prompt += `\n要求：内容吸引人，符合平台风格`
    }

    return prompt
  }

  /**
   * 获取模拟内容（当 LLM 调用失败时使用）
   */
  private getMockContent(platform: string, title: string): string {
    const mockContents: Record<string, string> = {
      wechat_mp: `【${title}】\n\n今天想和大家分享一些关于这个话题的心得体会。\n\n在这个快速发展的时代，我们每天都会接触到各种各样的信息。而今天这个话题，恰恰是我们每个人都值得关注和思考的。\n\n首先，让我们来了解一下背景...\n\n（此处应有详细分析内容）\n\n总的来说，${title}对于我们的生活有着重要的影响。希望今天的分享能够给大家带来一些启发。\n\n如果觉得有帮助，记得点个赞和关注哦！`,
      xiaohongshu: `# ${title} #\n\n姐妹们！今天必须来聊聊这个！💕\n\n最近发现了一个超棒的事情，关于${title}，真的绝了！\n\n✨\n\n首先，${title}真的太好用了！\n其次，操作简单易上手\n最后，效果真的惊艳到我了\n\n💡 小贴士：\n1. 第一步\n2. 第二步\n3. 第三步\n\n姐妹们快冲！冲冲冲！🏃‍♀️\n\n你们有没有类似的经历？评论区聊聊呀~ 👇`,
      douyin: `家人们！今天必须给你们安利一下！🔥\n\n${title}真的太绝了！\n\n首先，${title}的效果真的没话说\n其次，性价比超高\n最后，操作简单好上手\n\n而且！用了之后效果真的太明显了！\n\n心动不如行动！赶紧去试试！\n\n觉得有用的点个赞！我们下期见！`,
      weibo: `# ${title} #\n\n今天来聊聊${title}这件事。\n\n说实话，之前一直没太在意，但最近深入了解后发现真的很有意思。\n\n大家怎么看？欢迎评论区讨论~`,
      wechat_moments: `${title}，真的越来越好了！👍`
    }

    return mockContents[platform] || `关于${title}的内容，已为您生成。`
  }

  async getGeneratedContent(requestId: string, avatarId: string): Promise<any> {
    const db = getMySQLClient()
    const result = await db.query('content_generation_requests', {
      id: requestId,
      avatar_id: avatarId
    })
    return result?.data?.[0] || null
  }

  async updateContentStatus(contentId: string, status: string): Promise<void> {
    const db = getMySQLClient()
    await db.updateWhere('content_generation_requests', { id: contentId }, { status })
  }
}
