import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { Config, LLMClient, Message } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { setCache, getCache } from '../../common/shared-cache'
import { OrderService } from '../order/order.service'
import {
  SKILL_STRATEGIES,
  getSkillStrategy,
  getPlatformRule,
  getStyleInstruction,
  getNicheInstruction,
  detectSkillFromOrder,
} from './content-strategy'

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name)
  private readonly llmClient: LLMClient

  // 图片生成：直接 HTTP 调用 api.aaigc.top（coze SDK ImageGenerationClient 线上报 Invalid URL）
  private readonly imageGenBaseUrl = process.env.IMAGE_GEN_API_BASE_URL || 'https://api.aaigc.top'
  private readonly imageGenApiKey = process.env.IMAGE_GEN_API_KEY || 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK'
  private readonly imageGenModel = process.env.IMAGE_GEN_MODEL || 'gpt-image-2-all'

  // 视频生成：直接 HTTP 调用火山引擎 Seedance API（coze SDK VideoGenerationClient 线上报 Invalid URL）
  private readonly seedanceApiKey = process.env.SEEDANCE_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'
  private readonly seedanceBaseUrl = process.env.SEEDANCE_BASE_URL || 'https://ark.cn-beijing.volces.com'
  private readonly seedanceModel = process.env.SEEDANCE_MODEL || 'doubao-seedance-2-0-260128'

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService
  ) {
    const config = new Config({
      apiKey: process.env.COZE_WORKLOAD_IDENTITY_API_KEY,
      baseUrl: process.env.COZE_INTEGRATION_BASE_URL || 'https://api.coze.cn',
    })
    this.logger.log(`[Config] apiKey存在: ${!!process.env.COZE_WORKLOAD_IDENTITY_API_KEY}`)
    this.logger.log(`[Config] baseUrl: ${process.env.COZE_INTEGRATION_BASE_URL || 'https://api.coze.cn'}`)
    this.llmClient = new LLMClient(config)
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
    avatarSkills?: string[]
    contentStyles?: string[]
    nicheTags?: string[]
    preferredStyles?: string[]
    industryTags?: string[]
    contentQuantity?: number
  }): Promise<any[]> {
    const results: any[] = []

    // 确定分身的核心技能
    const primarySkill = this.detectPrimarySkill(input.avatarSkills || [], input.contentType)

    // 如果技能明确指定了内容类型，覆盖默认的 contentType
    const effectiveContentType = this.resolveContentType(primarySkill, input.contentType)

    this.logger.log(`内容生成: orderId=${input.orderId}, avatarId=${input.avatarId}, primarySkill=${primarySkill}, contentType=${input.contentType}->${effectiveContentType}, skills=${input.avatarSkills?.join(',')}`)

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
      this.executeGeneration(requestId, platform, {
        ...input,
        contentType: effectiveContentType,
        primarySkill,
      }).catch(err => {
        this.logger.error(`后台生成失败: ${err.message}`, err.stack)
        this.updateStatus(requestId, input.orderId, 'failed', null)
      })
    }

    return results
  }

  /**
   * 检测分身的核心技能
   */
  private detectPrimarySkill(avatarSkills: string[], contentType: string): string {
    if (avatarSkills.length > 0) {
      return avatarSkills[0] // 取第一个技能作为主技能
    }
    // 根据内容类型推断
    return detectSkillFromOrder(contentType)
  }

  /**
   * 根据技能确定内容类型
   */
  private resolveContentType(primarySkill: string, orderContentType: string): string {
    const skillStrategy = getSkillStrategy(primarySkill)
    if (skillStrategy) {
      const allowedTypes = skillStrategy.contentTypes
      // 如果订单要求的内容类型在技能允许范围内，使用订单要求
      if (allowedTypes.includes(orderContentType)) {
        return orderContentType
      }
      // 否则使用技能的首选内容类型
      return allowedTypes[0]
    }
    return orderContentType
  }

  /**
   * 后台异步执行内容生成
   */
  private async executeGeneration(
    requestId: string,
    platform: string,
    input: any
  ): Promise<void> {
    const { contentType, primarySkill } = input
    const needImage = contentType === 'image' || contentType === 'image_text'
    const needText = contentType === 'text' || contentType === 'image_text'
    const needVideo = contentType === 'video'
    // 视频类型也需要生成视频脚本作为文案内容
    const needVideoScript = contentType === 'video'

    this.logger.log(`开始后台生成: requestId=${requestId}, platform=${platform}, contentType=${contentType}, primarySkill=${primarySkill}`)

    let textContent = ''
    let images: string[] = []
    let videos: string[] = []

    // 判断是否为"图文文章"型平台
    const isArticlePlatform = this.isArticlePlatform(platform)

    if (isArticlePlatform && needText && needImage) {
      // ===== 图文文章模式 =====
      try {
        const imageCount = input.contentQuantity || 3
        this.updateDetailedStatus(requestId, input.orderId, 'generating_text')
        textContent = await this.generateArticleContent(platform, input, imageCount)
        this.logger.log(`图文文章生成完成: ${textContent.length}字`)
        await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')

        images = await this.generateArticleImages(platform, input, textContent, imageCount)
        this.logger.log(`文章配图生成完成: ${images.length}张`)

        textContent = this.replaceImagePlaceholders(textContent, images)
        await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')
      } catch (err: any) {
        this.logger.warn(`图文文章生成失败: ${err.message}`)
      }
    } else {
      // ===== 传统模式：文案 + 配图分离 =====
      if (needText) {
        try {
          this.updateDetailedStatus(requestId, input.orderId, 'generating_text')
          textContent = await this.generateTextContent(platform, input)
          this.logger.log(`文案生成完成: ${textContent.length}字`)
          await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')
        } catch (err: any) {
          this.logger.warn(`文案生成失败: ${err.message}`)
        }
      }

      // 视频类型：生成视频脚本作为文案内容（分身参考+发布指引）
      if (needVideoScript && !textContent) {
        try {
          this.updateDetailedStatus(requestId, input.orderId, 'generating_text')
          const skillStrategy = getSkillStrategy(primarySkill)
          textContent = await this.generateVideoScript(platform, input, '', skillStrategy) || ''
          this.logger.log(`视频脚本生成完成: ${textContent.length}字`)
          await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_video')
        } catch (err: any) {
          this.logger.warn(`视频脚本生成失败: ${err.message}`)
        }
      }

      if (needImage) {
        try {
          this.updateDetailedStatus(requestId, input.orderId, 'generating_images')
          images = await this.generateImages(platform, input, textContent)
          this.logger.log(`图片生成完成: ${images.length}张`)
          await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')
        } catch (err: any) {
          this.logger.warn(`图片生成失败: ${err.message}`)
        }
      }
    }

    // 3. 生成视频
    if (needVideo) {
      try {
        this.updateDetailedStatus(requestId, input.orderId, 'generating_video')
        videos = await this.generateVideos(platform, input, textContent, images)
        this.logger.log(`视频生成完成: ${videos.length}个`)
      } catch (err: any) {
        this.logger.warn(`视频生成失败: ${err.message}`)
      }
    }

    // 4. 内容质量自检（仅文本内容）
    if (textContent) {
      try {
        const qualityResult = await this.qualityCheck(textContent, input)
        this.logger.log(`内容质量评分: ${qualityResult.score}/100, 通过: ${qualityResult.passed}`)
        if (!qualityResult.passed && qualityResult.score < 50) {
          // 评分太低，自动重试一次
          this.logger.warn(`内容质量过低(${qualityResult.score}分)，自动重试...`)
          const retryText = await this.generateTextContent(platform, input)
          if (retryText && retryText.length > textContent.length * 0.5) {
            textContent = retryText
          }
        }
      } catch (err: any) {
        this.logger.warn(`质量自检失败(不影响发布): ${err.message}`)
      }
    }

    // 5. 更新为完成状态
    await this.updateStatus(requestId, input.orderId, 'completed', {
      content: textContent,
      images,
      videos,
      platforms: [platform]
    })

    // 6. 同步订单状态
    try {
      await this.syncOrderStatus(input.orderId)
    } catch (e: any) {
      this.logger.warn(`同步订单状态失败: ${e.message}`)
    }
  }

  /**
   * 判断是否为"图文文章"型平台
   */
  private isArticlePlatform(platform: string): boolean {
    const articlePlatforms = ['wechat_mp', 'wechat_channel', 'toutiao', 'zhihu', 'wechat_official']
    return articlePlatforms.includes(platform)
  }

  /**
   * 构建增强版系统提示词 — 融合技能策略+平台爆款规则+风格+领域
   */
  private buildEnhancedSystemPrompt(platform: string, input: any): string {
    const { primarySkill } = input
    const skillStrategy = getSkillStrategy(primarySkill)
    const platformRule = getPlatformRule(platform)
    const styleInstruction = getStyleInstruction(input.contentStyles || input.preferredStyles || [])
    const nicheInstruction = getNicheInstruction(input.nicheTags || input.industryTags || [])

    let systemPrompt = ''

    // 1. 技能核心能力（最关键，定义角色身份）
    if (skillStrategy) {
      systemPrompt += `【你的专业身份】\n${skillStrategy.coreCapability}\n\n`
      systemPrompt += `【专属内容策略】\n${skillStrategy.generationStrategy}\n\n`
      systemPrompt += `【爆款要素清单】\n${skillStrategy.viralElements.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n`
      if (skillStrategy.contentTemplate) {
        systemPrompt += `【内容结构模板】\n${skillStrategy.contentTemplate}\n\n`
      }
    } else {
      systemPrompt += `你是一个顶级社交媒体内容创作高手，深谙各平台的内容玩法和用户心理。\n\n`
    }

    // 2. 平台爆款规则
    if (platformRule) {
      systemPrompt += `【${platformRule.platformName}爆款规则】\n`
      systemPrompt += `算法偏好：互动率权重${(platformRule.algorithmWeights.engagement * 100).toFixed(0)}%，完播率权重${(platformRule.algorithmWeights.completion * 100).toFixed(0)}%，分享率权重${(platformRule.algorithmWeights.share * 100).toFixed(0)}%，收藏率权重${(platformRule.algorithmWeights.save * 100).toFixed(0)}%\n`
      systemPrompt += `爆款标题公式：${platformRule.titleFormulas.join(' / ')}\n`
      systemPrompt += `互动诱导技巧：${platformRule.engagementHooks.join(' / ')}\n`
      systemPrompt += `话题标签策略：${platformRule.hashtagStrategy}\n`
      systemPrompt += `禁忌红线：${platformRule.taboos.join('；')}\n`
      systemPrompt += `最佳发布时间：${platformRule.bestPostTimes.join('、')}\n\n`
    }

    // 3. 内容风格指令
    if (styleInstruction) {
      systemPrompt += `【内容风格要求】\n${styleInstruction}\n\n`
    }

    // 4. 专业领域指令
    if (nicheInstruction) {
      systemPrompt += `【专业领域要求】\n${nicheInstruction}\n\n`
    }

    // 5. 分身人设
    if (input.avatarName) {
      systemPrompt += `【分身人设】\n名字：${input.avatarName}\n`
      if (input.avatarPersonality) {
        systemPrompt += `性格：${input.avatarPersonality}\n`
      }
      if (input.avatarSkills && input.avatarSkills.length > 0) {
        const skillNames = input.avatarSkills
          .map((s: string) => SKILL_STRATEGIES[s]?.skillName || s)
          .join('、')
        systemPrompt += `擅长技能：${skillNames}\n`
      }
      systemPrompt += '\n'
    }

    return systemPrompt
  }

  /**
   * 生成图文文章 — 增强版：融合技能策略+平台规则
   */
  private async generateArticleContent(platform: string, input: any, imageCount: number): Promise<string> {
    const platformGuide: Record<string, string> = {
      wechat_mp: `微信公众号图文文章风格要求：
- 标题要有吸引力，让人想点进来
- 开头用一段引人入胜的导语，制造悬念或痛点共鸣
- 正文分段清晰，每段2-4句话，用小标题分隔
- 在关键位置插入图片，用 [IMG_1] [IMG_2] 等占位符标记（共需插入${imageCount}张图）
- 图片位置要自然：如"看看这个效果↓[IMG_1]"、"实际使用场景如下↓[IMG_2]"
- 语言像朋友在分享，不要广告腔
- 结尾加互动引导：点赞/在看/关注
- 整体字数800-1500字
- 使用markdown格式，标题用##，段落用换行`,
      wechat_channel: `微信视频号图文风格要求：
- 标题简洁有力，有悬念
- 内容精炼，重点突出
- 在合适位置插入图片，用 [IMG_1] [IMG_2] 等占位符标记（共需插入${imageCount}张图）
- 图片前后要有引导文字，如"实际效果如下↓[IMG_1]"
- 语言亲切自然，有分享感
- 结尾引导关注
- 使用markdown格式`,
      toutiao: `今日头条文章风格要求：
- 标题要有信息量和吸引力
- 内容详实有深度，数据支撑
- 在关键位置插入图片，用 [IMG_1] [IMG_2] 等占位符标记（共需插入${imageCount}张图）
- 图文结合，图片前有引导性描述
- 观点鲜明，逻辑清晰
- 结尾引导讨论
- 使用markdown格式`,
      zhihu: `知乎文章风格要求：
- 专业、理性、有深度
- 用数据和案例说话
- 在关键位置插入图片，用 [IMG_1] [IMG_2] 等占位符标记（共需插入${imageCount}张图）
- 图文结合说明，图片前有专业描述
- 逻辑严谨，论证充分
- 结尾总结观点
- 使用markdown格式`
    }

    const guide = platformGuide[platform] || platformGuide.wechat_mp
    const systemPrompt = this.buildEnhancedSystemPrompt(platform, input)

    const prompt = `${systemPrompt}【商单任务 - 必须严格围绕以下信息创作】
品牌/产品名：${input.orderTitle}
详细创作要求：
${input.orderDescription}
目标平台：${platform}
目标受众：${input.targetAudience || '年轻用户'}

【${guide}】

【图文文章格式要求 - 极其重要】
1. 文章中必须包含${imageCount}个图片占位符：[IMG_1] [IMG_2] ... [IMG_${imageCount}]
2. 图片占位符不能全部堆在一起，要分散在文章的不同位置
3. 每个图片占位符前面要有引导文字，如"看看实际效果↓[IMG_1]"、"使用场景如下↓[IMG_2]"
4. 第1张图通常放在导语之后或第一个要点处
5. 后续图片放在对应内容的段落之后

【绝对红线 - 必须遵守】
1. 文章必须围绕"${input.orderTitle}"这个品牌/产品来写，不是泛泛而谈
2. 必须体现订单要求中的核心卖点，不能偏离
3. 要让读者看完就想了解/购买这个产品
4. 禁止出现"作为AI"、"我是一个"等AI痕迹
5. 直接输出文章内容，不要输出任何创作说明或注释
6. 图片占位符 [IMG_1] 等必须出现在文章中，不能遗漏
7. 如果订单要求中提到具体卖点，必须在文章中详细阐述

请撰写一篇紧扣品牌/产品、有深度有感染力的图文文章：`

    try {
      const messages = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })
      const response = await this.llmClient.invoke(messages as Message[])
      return response?.content || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `## ${input.orderTitle}\n\n${input.orderDescription}\n\n[IMG_1]`
    }
  }

  /**
   * 生成图文文章的配图 - 增强版：融合技能图片策略
   */
  private async generateArticleImages(platform: string, input: any, textContent: string, imageCount: number): Promise<string[]> {
    const imageContexts = this.extractImageContexts(textContent, imageCount)
    const productKeywords = await this.extractProductKeywords(input.orderTitle || '', input.orderDescription || '')

    // 技能专属图片风格
    const skillStrategy = getSkillStrategy(input.primarySkill)
    const skillImageStyle = skillStrategy?.imageStrategy || ''

    const styleMap: Record<string, string> = {
      wechat_mp: 'professional editorial photo, magazine quality, clean composition, warm and inviting, high-end feel, 4K',
      wechat_channel: 'trendy lifestyle photo, eye-catching, modern composition, social media optimized, 4K',
      toutiao: 'professional news style photo, informative and clear, editorial quality, 4K',
      zhihu: 'professional and informative, clean data visualization style, high quality, 4K'
    }
    const platformStyle = styleMap[platform] || styleMap.wechat_mp

    const prompts = imageContexts.map((context, i) => {
      const contextHint = context ? `context in article: ${context.substring(0, 100)}` : ''
      const skillHint = skillImageStyle ? `, ${skillImageStyle}` : ''
      return i === 0
        ? `Featured hero image for article about ${productKeywords}, ${platformStyle}${skillHint}, ${contextHint}, captivating and professional, main visual, 4K`
        : `Supporting image ${i + 1} for article about ${productKeywords}, ${platformStyle}${skillHint}, ${contextHint}, relevant to the topic, 4K`
    })

    this.logger.log(`开始并行生成${imageCount}张文章配图...`)
    const results = await Promise.allSettled(
      prompts.map((prompt, i) => {
        this.logger.log(`正在生成文章第${i + 1}张配图，提示词: ${prompt.substring(0, 80)}...`)
        return this.generateImageViaHttp(prompt)
      })
    )

    const images: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        images.push(result.value)
        this.logger.log(`文章第${i + 1}张配图生成成功`)
      } else if (result.status === 'rejected') {
        this.logger.warn(`文章第${i + 1}张配图生成失败: ${result.reason?.message || result.reason}`)
      }
    })

    return images
  }

  /**
   * 从文章内容中提取每张图片对应的上下文
   */
  private extractImageContexts(textContent: string, imageCount: number): string[] {
    const contexts: string[] = []
    for (let i = 1; i <= imageCount; i++) {
      const placeholder = `[IMG_${i}]`
      const idx = textContent.indexOf(placeholder)
      if (idx >= 0) {
        const start = Math.max(0, idx - 100)
        const context = textContent.substring(start, idx).replace(/[#*\n]/g, ' ').trim()
        contexts.push(context)
      } else {
        contexts.push('')
      }
    }
    return contexts
  }

  /**
   * 将图片URL替换文章中的占位符
   */
  private replaceImagePlaceholders(textContent: string, images: string[]): string {
    let result = textContent
    for (let i = 0; i < images.length; i++) {
      const placeholder = `[IMG_${i + 1}]`
      const imageMarkdown = `![配图${i + 1}](${images[i]})`
      result = result.replace(placeholder, imageMarkdown)
    }
    return result
  }

  /**
   * 生成文字内容 — 增强版：融合技能策略+平台爆款规则+风格+领域
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
      wechat_moments: `微信朋友圈风格要求：
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
    const systemPrompt = this.buildEnhancedSystemPrompt(platform, input)

    const prompt = `${systemPrompt}【商单任务 - 必须严格围绕以下信息创作】
品牌/产品名：${input.orderTitle}
详细创作要求：
${input.orderDescription}
目标平台：${platform}
目标受众：${input.targetAudience || '年轻用户'}

【${guide}】

【绝对红线 - 必须遵守】
1. 文案必须围绕"${input.orderTitle}"这个品牌/产品来写，不是泛泛而谈
2. 必须体现订单要求中的核心卖点，不能偏离
3. 要让读者看完就想了解/购买这个产品
4. 禁止出现"作为AI"、"我是一个"等AI痕迹
5. 直接输出文案内容，不要输出任何创作说明或注释
6. 如果订单要求中提到具体卖点，必须包含在文案中

请创作一条紧扣品牌/产品、有感染力的高质量推广文案：`

    try {
      const messages = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })
      const response = await this.llmClient.invoke(messages as Message[])
      return response?.content || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `${input.orderTitle}\n\n${input.orderDescription}`
    }
  }

  /**
   * 生成配图 — 增强版：融合技能图片策略
   */
  private async generateImages(platform: string, input: any, textContent: string): Promise<string[]> {
    const quantity = input.contentQuantity || 3
    const imagePrompts = await this.buildImagePrompts(platform, input, textContent, quantity)

    const results = await Promise.allSettled(
      imagePrompts.map((prompt, i) => {
        this.logger.log(`正在生成第${i + 1}张图片，提示词: ${prompt.substring(0, 80)}...`)
        return this.generateImageViaHttp(prompt)
      })
    )

    const images: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        images.push(result.value)
        this.logger.log(`第${i + 1}张图片生成成功`)
      } else if (result.status === 'rejected') {
        this.logger.warn(`第${i + 1}张图片生成失败: ${result.reason?.message || result.reason}`)
      } else if (result.status === 'fulfilled') {
        this.logger.warn(`第${i + 1}张图片响应格式异常: ${JSON.stringify(result.value)}`)
      }
    })

    return images
  }

  /**
   * 构建图片提示词 — 增强版：融合技能图片策略
   */
  private async buildImagePrompts(platform: string, input: any, textContent: string, quantity: number): Promise<string[]> {
    const title = input.orderTitle || 'product'
    const desc = input.orderDescription || ''
    const audience = input.targetAudience || 'young people'

    // 技能专属图片策略
    const skillStrategy = getSkillStrategy(input.primarySkill)
    const skillImageStyle = skillStrategy?.imageStrategy || ''

    const styleMap: Record<string, string> = {
      wechat: 'warm lifestyle photo, natural lighting, cozy and intimate atmosphere, like a friend sharing on moments, high quality mobile photo',
      wechat_moments: 'warm lifestyle photo, natural lighting, cozy and intimate atmosphere, like a friend sharing on moments, high quality mobile photo, 1:1 square format',
      xiaohongshu: 'aesthetic flat lay, trendy pastel tones, clean minimal composition, Instagram worthy, soft natural light, lifestyle inspiration',
      douyin: 'vibrant eye-catching, dynamic composition, high contrast colors, trending visual style, thumb-stopping thumbnail, bold and fresh',
      weibo: 'bold modern design, clean professional look, striking visual impact, celebrity endorsement style',
      bilibili: 'creative playful, colorful, anime-inspired elements, fun and imaginative, youth culture',
      kuaishou: 'authentic real-life, down-to-earth, natural unposed, relatable everyday scene, warm and genuine'
    }
    const platformStyle = styleMap[platform] || styleMap.wechat

    const productKeywords = await this.extractProductKeywords(title, desc)

    const prompts: string[] = []
    const skillHint = skillImageStyle ? `, ${skillImageStyle}` : ''

    // 第1张：主图 - 产品核心展示，强吸引力
    prompts.push(`Professional product showcase for ${productKeywords}, ${platformStyle}${skillHint}, central composition, premium quality, attractive and desirable, targeting ${audience}, 4K, commercial photography`)

    // 第2张：使用场景 - 生活化代入感
    if (quantity >= 2) {
      prompts.push(`Lifestyle scene of a person using ${productKeywords}, ${platformStyle}${skillHint}, relatable everyday moment, showing real benefits and joy, natural and engaging, targeting ${audience}, 4K`)
    }

    // 第3张：效果/细节 - 说服力
    if (quantity >= 3) {
      prompts.push(`Close-up detail and effect of ${productKeywords}, ${platformStyle}${skillHint}, showing quality and transformation, convincing evidence, premium feel, targeting ${audience}, 4K`)
    }

    // 第4张及以后：更多角度
    for (let i = 3; i < quantity; i++) {
      prompts.push(`Creative promotional image for ${productKeywords}, unique angle ${i + 1}, ${platformStyle}${skillHint}, eye-catching design, appealing to ${audience}, 4K`)
    }

    return prompts
  }

  /**
   * 生成视频 — 从已有文案/脚本中提取视觉 prompt + Seedance 2.0 视频生成
   */
  private async generateVideos(platform: string, input: any, textContent: string, images: string[]): Promise<string[]> {
    const { primarySkill } = input
    const skillStrategy = getSkillStrategy(primarySkill)

    // 1. 如果没有现成的脚本，先生成视频脚本
    let videoScript = textContent
    if (!videoScript || videoScript.length < 50) {
      this.logger.log(`无现成脚本，先生成视频脚本: skill=${primarySkill}, platform=${platform}`)
      videoScript = await this.generateVideoScript(platform, input, textContent, skillStrategy) || ''
      if (!videoScript) {
        this.logger.warn('视频脚本生成失败，跳过视频生成')
        return []
      }
    }

    this.logger.log(`视频脚本准备完成: ${videoScript.length}字`)

    // 2. 从脚本中提取适合 Seedance 的视觉描述 prompt
    // Seedance 是文生视频模型，需要简短的视觉画面描述，不需要表格脚本
    const seedancePrompt = await this.extractVisualPrompt(videoScript, input)
    this.logger.log(`Seedance视觉prompt提取完成: ${seedancePrompt.substring(0, 80)}...`)

    // 3. 使用 Seedance API 生成视频
    const videoUrls: string[] = []

    try {
      this.logger.log(`调用Seedance视频生成API: prompt=${seedancePrompt.substring(0, 50)}...`)
      const videoUrl = await this.generateVideoViaSeedance(seedancePrompt)
      if (videoUrl) {
        videoUrls.push(videoUrl)
        this.logger.log('Seedance视频生成成功')
      }
    } catch (err: any) {
      this.logger.warn(`Seedance视频生成失败: ${err.message}`)
    }

    return videoUrls
  }

  /**
   * 从视频脚本中提取适合 Seedance 文生视频模型的视觉描述 prompt
   * Seedance 需要的是简短的视觉画面描述，不是完整的分镜脚本
   */
  private async extractVisualPrompt(videoScript: string, input: any): Promise<string> {
    const systemPrompt = `你是一个视频视觉描述提取专家。你的任务是从视频脚本中提取出适合AI文生视频模型的视觉画面描述。

要求：
1. 输出一段50-150字的核心视觉画面描述，描述视频最重要的3-5个画面
2. 只描述视觉画面，不包含口播/旁白/字幕等文字内容
3. 画面描述要具体：场景、人物动作、表情、道具、光影
4. 不需要分镜编号、时间标记、表格格式
5. 直接输出描述文本，不要加任何前缀说明

示例输出：
"一位年轻女性在温馨的咖啡厅里，手持精致的产品包装盒，惊喜地打开展示内部。特写镜头捕捉她满意的微笑和产品的精美细节。随后切到户外阳光下的使用场景，自然光影中产品质感更加突出。结尾画面是她举起产品对镜头竖起大拇指推荐。"`

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请从以下视频脚本中提取核心视觉画面描述：\n\n${videoScript.substring(0, 2000)}` }
      ]
      const response = await this.llmClient.invoke(messages as Message[])
      const prompt = response?.content || ''
      // 限制 prompt 长度，Seedance 对过长 prompt 效果不好
      return prompt.substring(0, 500)
    } catch (err: any) {
      this.logger.warn(`视觉prompt提取失败，使用脚本前500字: ${err.message}`)
      // 降级：直接用脚本前500字作为 prompt（去除表格标记）
      return videoScript
        .replace(/[|：:：]/g, ' ')
        .replace(/\n/g, ', ')
        .substring(0, 500)
    }
  }

  /**
   * 生成视频脚本 — 融合技能策略+平台规则
   */
  private async generateVideoScript(platform: string, input: any, textContent: string, skillStrategy: any): Promise<string> {
    const platformVideoGuide: Record<string, string> = {
      douyin: `抖音短视频脚本要求：
- 前3秒必须设置强悬念或制造反差，确保完播率
- 每5秒一个小刺激点（反转/金句/数据冲击/视觉冲击）
- 口播节奏快，信息密度高，但不堆砌
- 视觉描述要具体：场景、动作、表情、道具
- 结尾3秒：强CTA引导（关注/评论/下单）
- 时长15-60秒为佳`,
      kuaishou: `快手短视频脚本要求：
- 开头直接切入生活场景，接地气
- 真人出镜感强，像邻居在推荐
- 展示真实使用过程和效果
- 适当加入幽默元素
- 结尾直接引导关注`,
      bilibili: `B站视频脚本要求：
- 开头10秒抛出核心问题或观点
- 中间分点论证，有数据/案例支撑
- 适当加入梗和二次元元素
- 结尾求三连+预告下期
- 节奏可以稍慢，但信息量大`,
      xiaohongshu: `小红书视频脚本要求：
- 开头3秒展示最吸引人的结果/效果
- 中间是过程/教程/测评，节奏明快
- BGM描述要具体（风格+节奏）
- 画面风格要精致有质感
- 结尾引导点赞收藏`,
    }

    const videoGuide = platformVideoGuide[platform] || platformVideoGuide.douyin
    const skillVideoStrategy = skillStrategy?.videoStrategy || ''

    const systemPrompt = this.buildEnhancedSystemPrompt(platform, input)

    const prompt = `${systemPrompt}【商单任务 - 视频脚本创作】
品牌/产品名：${input.orderTitle}
详细创作要求：
${input.orderDescription}
目标受众：${input.targetAudience || '年轻用户'}

${skillVideoStrategy ? `【技能专属视频策略】\n${skillVideoStrategy}\n\n` : ''}【${videoGuide}】

【视频脚本格式】
每个场景包含：
- 场景编号和时间（如：场景1 0-3秒）
- 画面描述（具体的视觉内容）
- 旁白/口播文案（说出来的话）
- 字幕/文字提示（画面上出现的文字）
- BGM/音效（背景音乐和音效描述）

【绝对红线】
1. 脚本必须围绕"${input.orderTitle}"来创作
2. 禁止出现AI痕迹
3. 直接输出脚本，不要额外注释

请创作一个完整的视频脚本：`

    try {
      const messages = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })
      const response = await this.llmClient.invoke(messages as Message[])
      return response?.content || ''
    } catch (err: any) {
      this.logger.warn(`视频脚本LLM调用失败: ${err.message}`)
      return ''
    }
  }

  /**
   * 内容质量自检
   */
  private async qualityCheck(content: string, input: any): Promise<{ score: number; passed: boolean; issues: string[] }> {
    const issues: string[] = []
    let score = 100

    // 1. 基础检查（不消耗 LLM）
    if (content.length < 50) {
      issues.push('内容过短(<50字)')
      score -= 30
    }
    if (content.includes('作为AI') || content.includes('我是一个AI')) {
      issues.push('包含AI痕迹用语')
      score -= 20
    }
    if (!content.includes(input.orderTitle) && input.orderTitle) {
      issues.push('未包含品牌/产品名')
      score -= 15
    }

    // 2. 爆款要素检查
    const skillStrategy = getSkillStrategy(input.primarySkill)
    if (skillStrategy) {
      const hasInteraction = content.includes('评论') || content.includes('点赞') || content.includes('收藏') || content.includes('关注')
      if (!hasInteraction) {
        issues.push('缺少互动引导')
        score -= 10
      }
    }

    // 3. 平台特定检查
    const platform = input.platforms?.[0]
    if (platform === 'xiaohongshu' && !content.includes('#')) {
      issues.push('小红书内容缺少话题标签')
      score -= 10
    }
    if (platform === 'weibo' && content.length > 2000) {
      issues.push('微博内容过长')
      score -= 5
    }

    const passed = score >= 60
    return { score, passed, issues }
  }

  /**
   * 更新细化的生成状态
   */
  private updateDetailedStatus(
    requestId: string,
    orderId: string,
    status: string
  ): void {
    const cacheData = getCache(requestId) || getCache(orderId) || {}
    const updatedCache = {
      ...cacheData,
      requestId,
      order_id: orderId,
      status,
      created_at: cacheData.created_at || new Date().toISOString()
    }
    setCache(requestId, updatedCache)
    setCache(orderId, updatedCache)
    this.logger.log(`状态更新: requestId=${requestId}, status=${status}`)
  }

  private async updatePartialContent(
    requestId: string,
    orderId: string,
    content: string,
    images: string[],
    videos: string[],
    status: string = 'processing'
  ): Promise<void> {
    const cacheData = {
      requestId,
      order_id: orderId,
      status,
      generatedContent: {
        content: content || '',
        images: images || [],
        videos: videos || []
      },
      created_at: new Date().toISOString()
    }
    setCache(requestId, cacheData)
    setCache(orderId, cacheData)

    try {
      const db = getMySQLClient()
      await db.query(
        'UPDATE content_generation_requests SET content = ?, images = ?, status = ? WHERE id = ?',
        [content, images.length > 0 ? JSON.stringify(images) : null, status, requestId]
      )
    } catch (err: any) {
      this.logger.warn(`更新中间状态失败: ${err.message}`)
    }
  }

  /**
   * 更新最终状态
   */
  private async updateStatus(
    requestId: string,
    orderId: string,
    status: string,
    generatedContent: any
  ): Promise<void> {
    const cacheData = {
      requestId,
      order_id: orderId,
      status,
      generatedContent,
      created_at: new Date().toISOString()
    }
    setCache(requestId, cacheData)
    setCache(orderId, cacheData)

    try {
      const db = getMySQLClient()
      if (status === 'completed' && generatedContent) {
        await db.query(
          'UPDATE content_generation_requests SET status = ?, content = ?, images = ?, video_url = ? WHERE id = ?',
          [
            status,
            generatedContent.content || '',
            generatedContent.images?.length > 0 ? JSON.stringify(generatedContent.images) : null,
            generatedContent.videos?.length > 0 ? JSON.stringify(generatedContent.videos) : null,
            requestId
          ]
        )
        this.logger.log(`完成状态已写入数据库: requestId=${requestId}`)
      } else if (status === 'failed') {
        await db.query(
          'UPDATE content_generation_requests SET status = ? WHERE id = ?',
          [status, requestId]
        )
        this.logger.log(`失败状态已写入数据库: requestId=${requestId}`)
      }
    } catch (err: any) {
      this.logger.warn(`更新最终状态失败: ${err.message}`)
    }

    this.logger.log(`状态更新: requestId=${requestId}, status=${status}`)
  }

  /**
   * 从订单标题和描述中提取英文产品关键词
   */
  private async extractProductKeywords(title: string, desc: string): Promise<string> {
    const keywordMap: Record<string, string> = {
      '护肤品': 'skincare products', '面膜': 'face mask', '口红': 'lipstick', '粉底': 'foundation',
      '香水': 'perfume', '洗发水': 'shampoo', '沐浴露': 'body wash', '防晒': 'sunscreen',
      '手机': 'smartphone', '耳机': 'earphones', '电脑': 'laptop', '平板': 'tablet',
      '衣服': 'fashion clothing', '鞋子': 'shoes', '包包': 'handbag', '手表': 'watch',
      '零食': 'snacks', '茶叶': 'tea', '咖啡': 'coffee', '饮品': 'drinks',
      'AI助手': 'AI assistant app', '智能助手': 'smart AI assistant', '赚钱': 'money making app',
      '课程': 'online course', '培训': 'training program', '健身': 'fitness program',
      '旅行': 'travel', '美食': 'gourmet food', '家居': 'home decor', '办公': 'office',
      '美白': 'whitening', '抗老': 'anti-aging', '补水': 'hydrating', '修复': 'repairing',
      '副业': 'side hustle', '收入': 'income',
      '减肥': 'weight loss', '瘦身': 'slimming', '增肌': 'muscle building',
    }

    const fullText = `${title} ${desc}`
    const matchedKeywords: string[] = []

    for (const [cn, en] of Object.entries(keywordMap)) {
      if (fullText.includes(cn) && !matchedKeywords.includes(en)) {
        matchedKeywords.push(en)
      }
    }

    if (matchedKeywords.length < 2) {
      try {
        this.logger.log(`本地关键词匹配不足(${matchedKeywords.length})，调用LLM动态翻译...`)
        const llmPrompt = `将以下中文产品/服务描述翻译成3-5个英文关键词，用于AI图片生成的提示词。只输出关键词，用逗号分隔，不要解释。

产品标题：${title}
产品描述：${desc.substring(0, 300)}

英文关键词：`

        const response = await this.llmClient.invoke(
          [{ role: 'user', content: llmPrompt }] as Message[]
        )
        const keywords = response?.content?.trim() || ''
        this.logger.log(`LLM翻译结果: ${keywords}`)
        if (keywords) {
          return keywords
        }
      } catch (err: any) {
        this.logger.warn(`LLM关键词翻译失败: ${err.message}`)
      }
    }

    if (matchedKeywords.length > 0) {
      return matchedKeywords.slice(0, 4).join(' and ')
    }

    return 'premium product service'
  }

  /**
   * 同步订单状态
   */
  private async syncOrderStatus(orderId: string): Promise<void> {
    try {
      await this.orderService.syncOrderStatusByContent(orderId)
    } catch (err: any) {
      this.logger.warn(`同步订单状态失败: ${err.message}`)
    }
  }

  /**
   * 通过 HTTP 直接调用 api.aaigc.top 图片生成（替代 coze SDK ImageGenerationClient）
   */
  private async generateImageViaHttp(prompt: string, size = '1024x1536'): Promise<string> {
    const apiUrl = `${this.imageGenBaseUrl}/v1/images/generations`
    this.logger.log(`[ImageHTTP] calling: ${apiUrl}, model: ${this.imageGenModel}, size: ${size}`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.imageGenApiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: this.imageGenModel,
        prompt,
        n: 1,
        size,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error(`[ImageHTTP] API error: ${response.status} ${errorText.slice(0, 200)}`)
      throw new Error(`图片生成API错误: ${response.status}`)
    }

    const result = await response.json() as any
    this.logger.log(`[ImageHTTP] response received`)

    let imageUrl = ''
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const firstItem = result.data[0]
      imageUrl = firstItem.url || (firstItem.b64_json ? `data:image/png;base64,${firstItem.b64_json}` : '')
    }

    if (!imageUrl) {
      throw new Error('图片生成返回数据为空')
    }

    this.logger.log(`[ImageHTTP] 图片生成成功, url: ${imageUrl.slice(0, 80)}...`)
    return imageUrl
  }

  /**
   * 通过 HTTP 直接调用火山引擎 Seedance 2.0 视频生成（替代 coze SDK VideoGenerationClient）
   * 异步流程：创建任务 → 轮询结果 → 返回视频 URL
   */
  private async generateVideoViaSeedance(prompt: string): Promise<string> {
    const createUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks`
    this.logger.log(`[Seedance] creating video task, prompt: ${prompt.slice(0, 80)}...`)

    // 步骤1：创建异步视频生成任务
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.seedanceApiKey}`,
      },
      body: JSON.stringify({
        model: this.seedanceModel,
        content: [
          { type: 'text', text: prompt },
        ],
      }),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      this.logger.error(`[Seedance] create task error: ${createResponse.status} ${errorText.slice(0, 200)}`)
      throw new Error(`Seedance创建任务失败: ${createResponse.status}`)
    }

    const createResult = await createResponse.json() as any
    const taskId = createResult?.id
    if (!taskId) {
      this.logger.error(`[Seedance] no task ID in response: ${JSON.stringify(createResult).slice(0, 200)}`)
      throw new Error('Seedance返回无任务ID')
    }

    this.logger.log(`[Seedance] task created: ${taskId}, status: ${createResult.status}`)

    // 步骤2：轮询任务状态，最长等待5分钟
    const maxPollTime = 5 * 60 * 1000
    const pollInterval = 10 * 1000
    const startTime = Date.now()

    while (Date.now() - startTime < maxPollTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const pollUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks/${taskId}`
      const pollResponse = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.seedanceApiKey}`,
        },
      })

      if (!pollResponse.ok) {
        this.logger.warn(`[Seedance] poll error: ${pollResponse.status}, retrying...`)
        continue
      }

      const pollResult = await pollResponse.json() as any
      const status = pollResult.status

      this.logger.log(`[Seedance] task ${taskId} status: ${status}, response keys: ${Object.keys(pollResult).join(',')}`)

      if (status === 'succeeded' || status === 'complete' || status === 'success') {
        // 火山引擎 Seedance 响应格式：
        // 格式1: content 是对象 { video_url: "https://..." }（最常见）
        // 格式2: content 是数组 [{ type: "video_url", video_url: "..." }]
        // 格式3: content 在 data.content 或 output.content 中
        // 先检查 content 是对象且包含 video_url
        if (pollResult.content && typeof pollResult.content === 'object' && !Array.isArray(pollResult.content)) {
          const contentObj = pollResult.content as Record<string, any>
          if (contentObj.video_url) {
            this.logger.log(`[Seedance] 视频生成成功(content.video_url): ${contentObj.video_url.slice(0, 80)}...`)
            return contentObj.video_url as string
          }
        }
        let contentItems: any[] = []
        if (Array.isArray(pollResult.content)) {
          contentItems = pollResult.content
        } else if (Array.isArray(pollResult.data?.content)) {
          contentItems = pollResult.data.content
        } else if (Array.isArray(pollResult.output?.content)) {
          contentItems = pollResult.output.content
        } else if (pollResult.content && typeof pollResult.content === 'string') {
          // content 是字符串URL的情况
          this.logger.log(`[Seedance] 视频生成成功(字符串URL): ${pollResult.content.slice(0, 80)}...`)
          return pollResult.content
        }
        for (const item of contentItems) {
          if (item.type === 'video_url' && item.video_url) {
            this.logger.log(`[Seedance] 视频生成成功: ${item.video_url.slice(0, 80)}...`)
            return item.video_url
          }
          if (item.type === 'video' && item.url) {
            this.logger.log(`[Seedance] 视频生成成功: ${item.url.slice(0, 80)}...`)
            return item.url
          }
          // 兜底：如果item本身就是URL字符串
          if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
            this.logger.log(`[Seedance] 视频生成成功(直接URL): ${item.slice(0, 80)}...`)
            return item
          }
        }
        // 兜底：尝试从其他字段获取
        if (pollResult.output?.video_url) {
          return pollResult.output.video_url
        }
        if (pollResult.data?.video_url) {
          return pollResult.data.video_url
        }
        this.logger.error(`[Seedance] 任务成功但未找到视频URL: ${JSON.stringify(pollResult).slice(0, 500)}`)
        throw new Error('Seedance任务成功但未找到视频URL')
      }

      if (status === 'failed' || status === 'error') {
        const errorMsg = pollResult.error?.message || pollResult.message || '未知错误'
        this.logger.error(`[Seedance] task failed: ${errorMsg}`)
        throw new Error(`Seedance视频生成失败: ${errorMsg}`)
      }

      // 状态为 processing/in_progress/queued 等，继续轮询
    }

    throw new Error('Seedance视频生成超时（5分钟）')
  }
}
