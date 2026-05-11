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

    this.logger.log(`开始后台生成: requestId=${requestId}, platform=${platform}, contentType=${contentType}`)

    let textContent = ''
    let images: string[] = []
    let videos: string[] = []

    // 判断是否为"图文文章"型平台（内容中嵌入图片）
    const isArticlePlatform = this.isArticlePlatform(platform)

    if (isArticlePlatform && needText && needImage) {
      // ===== 图文文章模式：先生成文章框架（含图片占位符），再生成图片替换占位符 =====
      try {
        const imageCount = input.contentQuantity || 3
        // 1. 生成图文文章（文中包含 [IMG_1], [IMG_2] ... 占位符）
        textContent = await this.generateArticleContent(platform, input, imageCount)
        this.logger.log(`图文文章生成完成: ${textContent.length}字`)
        this.updatePartialContent(requestId, input.orderId, textContent, images, videos)

        // 2. 生成文章配图
        images = await this.generateArticleImages(platform, input, textContent, imageCount)
        this.logger.log(`文章配图生成完成: ${images.length}张`)

        // 3. 将图片URL替换文章中的占位符
        textContent = this.replaceImagePlaceholders(textContent, images)
        this.updatePartialContent(requestId, input.orderId, textContent, images, videos)
      } catch (err: any) {
        this.logger.warn(`图文文章生成失败: ${err.message}`)
      }
    } else {
      // ===== 传统模式：文案 + 配图分离 =====
      // 1. 生成文字内容
      if (needText) {
        try {
          textContent = await this.generateTextContent(platform, input)
          this.logger.log(`文案生成完成: ${textContent.length}字`)
          this.updatePartialContent(requestId, input.orderId, textContent, images, videos)
        } catch (err: any) {
          this.logger.warn(`文案生成失败: ${err.message}`)
        }
      }

      // 2. 生成配图
      if (needImage) {
        try {
          images = await this.generateImages(platform, input, textContent)
          this.logger.log(`图片生成完成: ${images.length}张`)
          this.updatePartialContent(requestId, input.orderId, textContent, images, videos)
        } catch (err: any) {
          this.logger.warn(`图片生成失败: ${err.message}`)
        }
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
      platforms: [platform]
    })
  }

  /**
   * 判断是否为"图文文章"型平台
   * 微信公众号、今日头条、知乎等平台适合长图文文章
   */
  private isArticlePlatform(platform: string): boolean {
    const articlePlatforms = ['wechat_mp', 'wechat_channel', 'toutiao', 'zhihu', 'wechat_official']
    return articlePlatforms.includes(platform)
  }

  /**
   * 生成图文文章 - 图片嵌入文章正文中
   * 文章中使用 [IMG_1], [IMG_2] 等占位符标记图片位置
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

    const prompt = `你是一个顶级新媒体内容创作高手，特别擅长撰写爆款图文文章。

【商单任务 - 必须严格围绕以下信息创作】
品牌/产品名：${input.orderTitle}
详细创作要求：
${input.orderDescription}
目标平台：${platform}
目标受众：${input.targetAudience || '年轻用户'}
${input.avatarName ? `分身人设：${input.avatarName}，${input.avatarPersonality || '专业有趣'}` : ''}

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
      const response = await this.llmClient.invoke(
        [{ role: 'user', content: prompt }]
      )
      return response?.content || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `## ${input.orderTitle}\n\n${input.orderDescription}\n\n[IMG_1]`
    }
  }

  /**
   * 生成图文文章的配图 - 每张图对应文章中的一个段落主题
   */
  private async generateArticleImages(platform: string, input: any, textContent: string, imageCount: number): Promise<string[]> {
    // 从文章内容中提取每张图对应的位置和上下文
    const imageContexts = this.extractImageContexts(textContent, imageCount)
    const productKeywords = await this.extractProductKeywords(input.orderTitle || '', input.orderDescription || '')

    const styleMap: Record<string, string> = {
      wechat_mp: 'professional editorial photo, magazine quality, clean composition, warm and inviting, high-end feel, 4K',
      wechat_channel: 'trendy lifestyle photo, eye-catching, modern composition, social media optimized, 4K',
      toutiao: 'professional news style photo, informative and clear, editorial quality, 4K',
      zhihu: 'professional and informative, clean data visualization style, high quality, 4K'
    }
    const style = styleMap[platform] || styleMap.wechat_mp

    const images: string[] = []
    for (let i = 0; i < imageCount; i++) {
      try {
        // 根据图片在文章中的上下文构建更精准的提示词
        const context = imageContexts[i] || ''
        const contextHint = context ? `context in article: ${context.substring(0, 100)}` : ''

        const prompt = i === 0
          ? `Featured hero image for article about ${productKeywords}, ${style}, ${contextHint}, captivating and professional, main visual, 4K`
          : `Supporting image ${i + 1} for article about ${productKeywords}, ${style}, ${contextHint}, relevant to the topic, 4K`

        this.logger.log(`正在生成文章第${i + 1}张配图，提示词: ${prompt.substring(0, 80)}...`)

        const response = await this.imageClient.generate({
          prompt,
          size: '2k',
        })

        if (response?.data?.[0]?.url) {
          images.push(response.data[0].url)
          this.logger.log(`文章第${i + 1}张配图生成成功`)
        }
      } catch (err: any) {
        this.logger.warn(`文章第${i + 1}张配图生成失败: ${err.message}`)
      }
    }

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
        // 取占位符前100个字符作为上下文
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
   * 将图片URL替换文章中的 [IMG_1], [IMG_2] 等占位符
   * 替换为 markdown 图片格式：![描述](URL)
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

【商单任务 - 必须严格围绕以下信息创作】
品牌/产品名：${input.orderTitle}
详细创作要求：
${input.orderDescription}
目标平台：${platform}
目标受众：${input.targetAudience || '年轻用户'}
${input.avatarName ? `分身人设：${input.avatarName}，${input.avatarPersonality || '专业有趣'}` : ''}

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
    const imagePrompts = await this.buildImagePrompts(platform, input, textContent, quantity)

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
  private async buildImagePrompts(platform: string, input: any, textContent: string, quantity: number): Promise<string[]> {
    const title = input.orderTitle || 'product'
    const desc = input.orderDescription || ''
    const audience = input.targetAudience || 'young people'

    // 不同平台的图片风格
    const styleMap: Record<string, string> = {
      wechat: 'warm lifestyle photo, natural lighting, cozy and intimate atmosphere, like a friend sharing on moments, high quality mobile photo',
      xiaohongshu: 'aesthetic flat lay, trendy pastel tones, clean minimal composition, Instagram worthy, soft natural light, lifestyle inspiration',
      douyin: 'vibrant eye-catching, dynamic composition, high contrast colors, trending visual style, thumb-stopping thumbnail, bold and fresh',
      weibo: 'bold modern design, clean professional look, striking visual impact, celebrity endorsement style',
      bilibili: 'creative playful, colorful, anime-inspired elements, fun and imaginative, youth culture',
      kuaishou: 'authentic real-life, down-to-earth, natural unposed, relatable everyday scene, warm and genuine'
    }
    const style = styleMap[platform] || styleMap.wechat

    // 从订单描述中提取关键信息构建图片提示词（异步：可能需要LLM翻译）
    const productKeywords = await this.extractProductKeywords(title, desc)

    const prompts: string[] = []

    // 第1张：主图 - 产品核心展示，强吸引力
    prompts.push(`Professional product showcase for ${productKeywords}, ${style}, central composition, premium quality, attractive and desirable, targeting ${audience}, 4K, commercial photography`)

    // 第2张：使用场景 - 生活化代入感
    if (quantity >= 2) {
      prompts.push(`Lifestyle scene of a person using ${productKeywords}, ${style}, relatable everyday moment, showing real benefits and joy, natural and engaging, targeting ${audience}, 4K`)
    }

    // 第3张：效果/细节 - 说服力
    if (quantity >= 3) {
      prompts.push(`Close-up detail and effect of ${productKeywords}, ${style}, showing quality and transformation, convincing evidence, premium feel, targeting ${audience}, 4K`)
    }

    // 第4张及以后：更多角度
    for (let i = 3; i < quantity; i++) {
      prompts.push(`Creative promotional image for ${productKeywords}, unique angle ${i + 1}, ${style}, eye-catching design, appealing to ${audience}, 4K`)
    }

    return prompts
  }

  /**
   * 从订单标题和描述中提取英文产品关键词，用于图片生成
   * 先尝试本地关键词映射，如果匹配不足则调用 LLM 动态翻译
   */
  private async extractProductKeywords(title: string, desc: string): Promise<string> {
    // 常见中文产品/服务关键词到英文的映射
    const keywordMap: Record<string, string> = {
      // 产品类
      '护肤品': 'skincare products', '面膜': 'face mask', '口红': 'lipstick', '粉底': 'foundation',
      '香水': 'perfume', '洗发水': 'shampoo', '沐浴露': 'body wash', '防晒': 'sunscreen',
      '手机': 'smartphone', '耳机': 'earphones', '电脑': 'laptop', '平板': 'tablet',
      '衣服': 'fashion clothing', '鞋子': 'shoes', '包包': 'handbag', '手表': 'watch',
      '零食': 'snacks', '茶叶': 'tea', '咖啡': 'coffee', '饮品': 'drinks',
      // 服务类
      'AI助手': 'AI assistant app', '智能助手': 'smart AI assistant', '赚钱': 'money making app',
      '课程': 'online course', '培训': 'training program', '健身': 'fitness program',
      // 场景类
      '旅行': 'travel', '美食': 'gourmet food', '家居': 'home decor', '办公': 'office',
      // 效果类
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

    // 如果本地关键词匹配不足，使用 LLM 动态翻译整个订单描述为英文图片关键词
    if (matchedKeywords.length < 2) {
      try {
        this.logger.log(`本地关键词匹配不足(${matchedKeywords.length})，调用LLM动态翻译...`)
        const llmPrompt = `将以下中文产品/服务描述翻译成3-5个英文关键词，用于AI图片生成的提示词。只输出关键词，用逗号分隔，不要解释。

产品标题：${title}
产品描述：${desc.substring(0, 300)}

英文关键词：`

        const response = await this.llmClient.invoke(
          [{ role: 'user', content: llmPrompt }]
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

    // 如果匹配到了足够的本地关键词，组合返回
    if (matchedKeywords.length > 0) {
      return matchedKeywords.slice(0, 4).join(' and ')
    }

    // 兜底：用标题的拼音或通用描述
    return 'premium product service'
  }

  /**
   * 生成视频（占位）
   */
  private async generateVideos(platform: string, input: any): Promise<string[]> {
    return []
  }
}
