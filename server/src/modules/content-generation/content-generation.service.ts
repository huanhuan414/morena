import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import { setCache, getCache } from '../../common/shared-cache'
import { OrderService } from '../order/order.service'
import { StorageService } from '../storage/storage.service'
import { VolcengineService } from '../upload/volcengine.service'
import {
  SKILL_STRATEGIES,
  getSkillStrategy,
  getPlatformRule,
  getStyleInstruction,
  getNicheInstruction,
  detectSkillFromOrder,
} from './content-strategy'

// 火山引擎豆包 ARK API 直连配置（与 AiService 一致）
const ARK_API_KEY = '0a6405d5-b7ae-4afa-88e3-c707ae379a47'
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const ARK_MODEL = 'doubao-seed-2-0-pro-260215'

@Injectable()
export class ContentGenerationService implements OnModuleInit {
  private readonly logger = new Logger(ContentGenerationService.name)
  // 超时阈值：10分钟（毫秒）
  private readonly GENERATION_TIMEOUT_MS = 10 * 60 * 1000

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
    private readonly orderService: OrderService,
    private readonly storageService: StorageService,
    private readonly volcengineService: VolcengineService
  ) {
    this.logger.log('ContentGenerationService 初始化，使用 ARK API 直连')
  }

  /**
   * 统一 LLM 调用方法：使用 Chat Completions API（比 Responses API 更快）
   */
  private async invokeLlm(messages: { role: string; content: string }[]): Promise<string> {
    this.logger.log(`[ARK] 调用 LLM (Chat Completions), messages=${messages.length}条`)

    const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      this.logger.error(`[ARK] API 请求失败: status=${response.status}, body=${errText.slice(0, 200)}`)
      throw new Error(`ARK API 请求失败: ${response.status}`)
    }

    const result = await response.json() as any
    const content = result?.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('模型返回内容为空')
    }

    this.logger.log(`[ARK] LLM 调用成功, 返回内容长度: ${content.length}`)
    return content
  }

  /**
   * 模块初始化时检查并恢复卡住的内容生成任务
   */
  async onModuleInit() {
    this.logger.log('ContentGenerationService 初始化，检查卡住的生成任务...')
    try {
      await this.recoverStuckGenerations()
    } catch (err: any) {
      this.logger.warn(`恢复卡住任务时出错: ${err.message}`)
    }
    // 每5分钟检查一次
    setInterval(() => {
      this.recoverStuckGenerations().catch(err => {
        this.logger.warn(`定时恢复卡住任务时出错: ${err.message}`)
      })
    }, 5 * 60 * 1000)
  }

  /**
   * 恢复卡住的生成任务（状态超过10分钟未更新则标记为completed）
   */
  private async recoverStuckGenerations() {
    try {
      const db = getMySQLClient()
      const stuckStatuses = ['generating_text', 'generating_images', 'generating_video', 'pending', 'processing']
      const stuckRecords: any[] = []
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      for (const status of stuckStatuses) {
        const records = await db.from('content_generation_requests').findMany({ status })
        for (const r of records) {
          const updatedAt = new Date(r.updatedAt)
          if (updatedAt < tenMinutesAgo) {
            stuckRecords.push(r)
          }
        }
      }
      if (stuckRecords.length === 0) return

      this.logger.warn(`发现 ${stuckRecords.length} 条卡住的生成任务，将自动完成`)
      for (const record of stuckRecords) {
        this.logger.warn(`恢复卡住任务: id=${record.id}, status=${record.status}`)
        await db.update('content_generation_requests', record.id, { status: 'completed' })
        // 清除缓存
        setCache(record.id, null)
      }
    } catch (err: any) {
      this.logger.warn(`恢复卡住任务失败: ${err.message}`)
    }
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
          content_type: effectiveContentType,
          content_quantity: input.contentQuantity || 1,
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
    // 'image'(图文笔记)也需要文案：用户选"图文笔记"期望获得文案+图片，而非纯图片
    const needText = contentType === 'text' || contentType === 'image_text' || contentType === 'image'
    const needVideo = contentType === 'video'
    // 视频类型也需要生成视频脚本作为文案内容
    const needVideoScript = contentType === 'video'

    this.logger.log(`开始后台生成: requestId=${requestId}, platform=${platform}, contentType=${contentType}, primarySkill=${primarySkill}`)

    let textContent = ''
    let images: string[] = []
    let videos: string[] = []
    let textFailed = false
    let imageFailed = false
    let videoFailed = false

    // 判断是否为"图文文章"型平台
    const isArticlePlatform = this.isArticlePlatform(platform)

    if (isArticlePlatform && needText && needImage) {
      // ===== 图文文章模式 =====
      try {
        const imageCount = this.getDefaultImageCount(platform, contentType)
        this.updateDetailedStatus(requestId, input.orderId, 'generating_text')
        textContent = await this.generateArticleContent(platform, input, imageCount)
        this.logger.log(`图文文章生成完成: ${textContent.length}字`)
        await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')

        images = await this.generateArticleImages(platform, input, textContent, imageCount, requestId)
        this.logger.log(`文章配图生成完成: ${images.length}张`)

        textContent = this.replaceImagePlaceholders(textContent, images)
        await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')
      } catch (err: any) {
        this.logger.warn(`图文文章生成失败: ${err.message}`)
        textFailed = !textContent
        imageFailed = images.length === 0
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
          textFailed = true
        }
      }

      // 文案是后续生成的基础，文案失败则跳过图片生成
      if (textFailed && !textContent) {
        this.logger.warn(`文案生成失败，跳过后续图片/视频生成`)
      } else {
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
            textFailed = true
          }
        }

        // 视频脚本失败则跳过视频生成
        if (needVideoScript && textFailed && !textContent) {
          this.logger.warn(`视频脚本生成失败，跳过视频生成`)
        } else {
          if (needImage) {
            try {
              this.updateDetailedStatus(requestId, input.orderId, 'generating_images')
              images = await this.generateImages(platform, input, textContent, requestId)
              this.logger.log(`图片生成完成: ${images.length}张`)
              await this.updatePartialContent(requestId, input.orderId, textContent, images, videos, 'generating_images')
            } catch (err: any) {
              this.logger.warn(`图片生成失败: ${err.message}`)
              imageFailed = true
            }
          }
        }
      }
    }

    // 3. 生成视频（异步模式：只创建 Seedance 任务，不等待结果）
    // 视频结果由 pollPendingVideoTasks 定时任务轮询获取
    if (needVideo && !textFailed) {
      try {
        this.updateDetailedStatus(requestId, input.orderId, 'generating_video')
        await this.generateVideos(platform, input, textContent, images, requestId)
        // 视频任务是异步的，此时 videos 为空，状态保持 generating_video
        // 如果 Seedance 任务创建成功，seedance_task_id 已存到数据库
        // 如果 Seedance 任务创建失败，videos 也为空，后续会被空结果检测标记为失败
        this.logger.log(`Seedance异步视频任务已提交: requestId=${requestId}`)
        // 视频异步生成中，直接进入最终状态判断
        // 如果有 seedance_task_id，说明视频正在后台生成，不算失败
      } catch (err: any) {
        this.logger.warn(`视频任务提交失败: ${err.message}`)
        videoFailed = true
      }
    } else if (needVideo && textFailed) {
      this.logger.warn(`文案/脚本生成失败，跳过视频生成`)
      videoFailed = true
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

    // 5. 根据各环节成败决定最终状态
    // 视频是异步模式：如果 Seedance 任务已提交（有 seedance_task_id），则视频不算失败
    // 需要查询数据库确认是否有 seedance_task_id
    let videoTaskSubmitted = false
    if (needVideo && !videoFailed) {
      try {
        const pool = getPool()
        const [taskRows]: any = await pool.execute(
          'SELECT seedance_task_id FROM content_generation_requests WHERE id = ?',
          [requestId]
        )
        videoTaskSubmitted = taskRows?.length > 0 && !!taskRows[0].seedance_task_id
      } catch (e: any) {
        this.logger.warn(`查询seedance_task_id失败: ${e.message}`)
      }
    }

    const imageMissing = needImage && !imageFailed && images.length === 0
    const videoMissing = needVideo && !videoFailed && videos.length === 0 && !videoTaskSubmitted
    if (imageMissing) {
      imageFailed = true
      this.logger.warn(`配图生成返回空结果，标记为失败`)
    }
    if (videoMissing) {
      videoFailed = true
      this.logger.warn(`视频生成返回空结果且无后台任务，标记为失败`)
    }

    const hasAnyContent = textContent || images.length > 0 || videos.length > 0
    const allRequiredFailed = (needText && textFailed && !textContent) &&
                              (needImage && imageFailed && images.length === 0) &&
                              (needVideo && videoFailed && videos.length === 0)

    let finalStatus: string
    let failedParts: string[] = []

    if (!hasAnyContent || allRequiredFailed) {
      // 全部失败
      finalStatus = 'failed'
    } else if (videoTaskSubmitted) {
      // 视频还在后台生成中，保持 generating_video 状态
      // 定时任务 pollPendingVideoTasks 会在视频完成后更新状态
      finalStatus = 'generating_video'
      this.logger.log(`视频任务在后台生成中，保持 generating_video 状态`)
    } else if (textFailed || imageFailed || videoFailed) {
      // 部分失败（视频不在后台生成中）
      if (needText && textFailed && !textContent) failedParts.push('文案')
      if (needImage && imageFailed && images.length === 0) failedParts.push('配图')
      if (needVideo && videoFailed && videos.length === 0) failedParts.push('视频')
      finalStatus = 'partial_failed'
    } else {
      finalStatus = 'preview'
    }

    await this.updateStatus(requestId, input.orderId, finalStatus, {
      content: textContent,
      images,
      videos,
      platforms: [platform],
      failedParts,
    })

    this.logger.log(`内容生成结束: requestId=${requestId}, status=${finalStatus}, failedParts=[${failedParts.join(',')}]`)

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
   * 根据平台和内容类型智能设置默认配图数量
   * 不同平台对配图数量的要求差异很大：
   * - 文章类平台（公众号/头条/知乎）：需要多张配图穿插文中，增强阅读体验
   * - 所有平台统一3张配图
   */
  private getDefaultImageCount(platform: string, contentType: string): number {
    const isVideo = contentType === 'video' || contentType === 'video_text'
    // 视频类型不需要生成配图（由视频生成环节处理）
    if (isVideo) return 0

    const countMap: Record<string, number> = {
      wechat_mp: 3,          // 微信公众号：3张配图
      wechat_official: 3,    // 微信公众号（旧key同上）
      wechat_channel: 3,     // 视频号图文：3张
      toutiao: 3,            // 今日头条：3张配图
      zhihu: 3,              // 知乎：3张配图
      xiaohongshu: 3,        // 小红书：3张配图
      wechat_moments: 3,     // 朋友圈：3张（1+2布局）
      weibo: 3,              // 微博：3张（1+2布局）
      douyin: 3,             // 抖音图文：3张
      kuaishou: 3,           // 快手图文：3张
      bilibili: 3,           // B站：3张
    }
    return countMap[platform] || 3
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
      const response = await this.invokeLlm(messages)
      return response || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `## ${input.orderTitle}\n\n${input.orderDescription}\n\n[IMG_1]`
    }
  }

  /**
   * 生成图文文章的配图 - 增强版：融合技能图片策略 + LLM上下文感知
   */
  private async generateArticleImages(platform: string, input: any, textContent: string, imageCount: number, requestId: string): Promise<string[]> {
    // 用LLM从文章内容中为每张图生成精准的视觉描述
    const imageVisualDescs = await this.generateContextAwareImageDescs(textContent, imageCount, input.orderTitle || '产品')

    const productKeywords = await this.extractProductKeywords(input.orderTitle || '', input.orderDescription || '')
    const title = input.orderTitle || '产品'

    // 技能专属图片风格
    const skillStrategy = getSkillStrategy(input.primarySkill)
    const skillImageStyle = skillStrategy?.imageStrategy || ''

    // 平台视觉风格（中文描述）
    const styleMap: Record<string, string> = {
      wechat_mp: '专业编辑风格，杂志品质，构图干净整洁，温暖高端感，4K',
      wechat_official: '专业编辑风格，杂志品质，构图干净整洁，温暖高端感，4K',
      wechat_channel: '潮流生活风，吸睛抢眼，现代构图，社交短视频封面风格，4K',
      toutiao: '专业资讯风格，信息清晰，编辑级品质，4K',
      zhihu: '专业学术风，干净数据可视化风格，高品质，4K'
    }
    const platformStyle = styleMap[platform] || styleMap.wechat_mp

    const chineseTextRule = '图片中出现的所有文字、标语、标签必须使用中文，禁止出现英文文字'

    const prompts = imageVisualDescs.map((desc, i) => {
      const skillHint = skillImageStyle ? `，${skillImageStyle}` : ''
      return i === 0
        ? `${title}文章封面主图，视觉描述：${desc}，${platformStyle}${skillHint}，吸睛专业，主视觉，4K，${chineseTextRule}。产品关键词参考：${productKeywords}`
        : `${title}文章配图${i + 1}，视觉描述：${desc}，${platformStyle}${skillHint}，与上下文紧密呼应，4K，${chineseTextRule}。产品关键词参考：${productKeywords}`
    })

    // 文章配图用横版
    const articleImageSize = platform === 'wechat_mp' || platform === 'wechat_official' || platform === 'toutiao' || platform === 'zhihu'
      ? '1536x1024' : '1024x1024'

    // 逐张生成并逐张保存，让前端轮询时能实时看到新图片
    this.logger.log(`开始逐张生成${imageCount}张文章配图...`)
    const images: string[] = []
    for (let i = 0; i < prompts.length; i++) {
      try {
        this.logger.log(`正在生成文章第${i + 1}张配图，提示词: ${prompts[i].substring(0, 80)}...`)
        const url = await this.generateImageViaHttp(prompts[i], articleImageSize)
        if (url) {
          images.push(url)
          this.logger.log(`文章第${i + 1}张配图生成成功，已保存到数据库 (${images.length}/${imageCount})`)
          // 每生成一张就更新数据库和缓存，前端下次轮询即可看到
          await this.updatePartialContent(requestId, input.orderId, textContent, images, [], 'generating_images')
        }
      } catch (err: any) {
        this.logger.warn(`文章第${i + 1}张配图生成失败: ${err.message}`)
      }
    }

    return images
  }

  /**
   * 用LLM从文章内容中为每张图片生成精准的视觉描述
   * 让每张图都与文章对应段落的主题紧密呼应
   */
  private async generateContextAwareImageDescs(textContent: string, imageCount: number, title: string): Promise<string[]> {
    // 先提取每张图占位符周围的上下文
    const rawContexts = this.extractImageContexts(textContent, imageCount)

    // 如果只有1张图，直接用标题+上下文即可
    if (imageCount <= 1) {
      return rawContexts.map((ctx, i) =>
        i === 0
          ? `展示"${title}"核心卖点的封面主视觉，${ctx ? `围绕：${ctx.substring(0, 80)}` : '突出品牌和产品'}`
          : ctx || `与"${title}"相关的视觉场景`
      )
    }

    // 多张图：用LLM生成差异化视觉描述
    try {
      const contextBlock = rawContexts
        .map((ctx, i) => `【第${i + 1}张图上下文】${ctx || '（无明确上下文，请根据文章整体主题推断）'}`)
        .join('\n')

      const prompt = `你是一个专业的视觉创意总监。以下是一篇关于"${title}"的文章中${imageCount}张配图各自对应的上下文内容。

请为每张图生成一段精准的视觉描述（30-50字），要求：
1. 每张图的视觉描述必须不同，体现该段文章内容的独特主题
2. 描述要具体，包含具体场景、物体、色调、氛围等视觉元素
3. 第1张是封面图，要最具视觉冲击力
4. 后续配图要与对应上下文主题紧密呼应
5. 只输出每张图的视觉描述，用"图1:xxx\n图2:xxx"格式，不要其他解释

${contextBlock}`

      const response = await this.invokeLlm([
        { role: 'user', content: prompt }
      ])

      if (response) {
        const descs: string[] = []
        for (let i = 1; i <= imageCount; i++) {
          const match = response.match(new RegExp(`图${i}[：:]\\s*(.+?)(?:\\n|$)`))
          descs.push(match ? match[1].trim() : rawContexts[i - 1] || `与"${title}"相关的视觉场景`)
        }
        this.logger.log(`LLM生成${descs.length}张图片的差异化视觉描述成功`)
        return descs
      }
    } catch (err: any) {
      this.logger.warn(`LLM生成图片视觉描述失败: ${err.message}，降级为上下文提取`)
    }

    // 降级：使用原始上下文
    return rawContexts.map((ctx, i) =>
      i === 0
        ? `展示"${title}"核心卖点的封面主视觉，${ctx ? `围绕：${ctx.substring(0, 80)}` : '突出品牌和产品'}`
        : ctx ? `与文章段落主题呼应：${ctx.substring(0, 80)}` : `与"${title}"相关的视觉场景`
    )
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
        // 提取占位符前后各150字符的上下文（共300字符）
        const start = Math.max(0, idx - 150)
        const end = Math.min(textContent.length, idx + placeholder.length + 50)
        const before = textContent.substring(start, idx).replace(/[#*\n]/g, ' ').trim()
        const after = textContent.substring(idx + placeholder.length, end).replace(/[#*\n]/g, ' ').trim()
        // 优先取占位符前面的内容（所属段落主题）
        const context = before || after
        contexts.push(context.substring(0, 200))
      } else {
        // 没有占位符时，按文章长度均匀切分段落
        const chunkSize = Math.floor(textContent.length / imageCount)
        const start = Math.min(chunkSize * (i - 1), textContent.length - 100)
        const context = textContent.substring(Math.max(0, start), Math.min(textContent.length, start + 200)).replace(/[#*\n]/g, ' ').trim()
        contexts.push(context)
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
      wechat_mp: `微信公众号文章风格要求：
- 标题要有吸引力，让人想点进来
- 开头用一段引人入胜的导语，制造悬念或痛点共鸣
- 正文分段清晰，每段2-4句话，用小标题分隔
- 语言像朋友在分享，不要广告腔
- 结尾加互动引导：点赞/在看/关注
- 整体字数800-1500字
- 使用markdown格式，标题用##，段落用换行`,
      wechat_official: `微信公众号文章风格要求：
- 标题要有吸引力，让人想点进来
- 开头用一段引人入胜的导语，制造悬念或痛点共鸣
- 正文分段清晰，每段2-4句话，用小标题分隔
- 语言像朋友在分享，不要广告腔
- 结尾加互动引导：点赞/在看/关注
- 整体字数800-1500字
- 使用markdown格式，标题用##，段落用换行`,

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
      const response = await this.invokeLlm(messages)
      return response || ''
    } catch (err: any) {
      this.logger.warn(`LLM调用失败: ${err.message}`)
      return `${input.orderTitle}\n\n${input.orderDescription}`
    }
  }

  /**
   * 生成配图 — 增强版：融合技能图片策略
   */
  private async generateImages(platform: string, input: any, textContent: string, requestId: string): Promise<string[]> {
    const quantity = this.getDefaultImageCount(platform, input.contentType || 'image')
    const imagePrompts = await this.buildImagePrompts(platform, input, textContent, quantity)

    // 根据平台选择合适的图片尺寸
    const sizeMap: Record<string, string> = {
      wechat_moments: '1024x1024',   // 朋友圈：1:1方形
      xiaohongshu: '1024x1536',      // 小红书：3:4竖版
      douyin: '1024x1536',           // 抖音：3:4竖版
      wechat_mp: '1536x1024',        // 公众号：横版
      wechat_official: '1536x1024',   // 视频号：横版
    }
    const imageSize = sizeMap[platform] || '1024x1536'

    // 逐张生成并逐张保存，让前端轮询时能实时看到新图片
    this.logger.log(`开始逐张生成${quantity}张配图...`)
    const images: string[] = []
    for (let i = 0; i < imagePrompts.length; i++) {
      try {
        this.logger.log(`正在生成第${i + 1}张图片，提示词: ${imagePrompts[i].substring(0, 80)}...`)
        const url = await this.generateImageViaHttp(imagePrompts[i], imageSize)
        if (url) {
          images.push(url)
          this.logger.log(`第${i + 1}张图片生成成功，已保存到数据库 (${images.length}/${quantity})`)
          // 每生成一张就更新数据库和缓存，前端下次轮询即可看到
          await this.updatePartialContent(requestId, input.orderId, textContent, images, [], 'generating_images')
        }
      } catch (err: any) {
        this.logger.warn(`第${i + 1}张图片生成失败: ${err.message}`)
      }
    }

    return images
  }

  /**
   * 构建图片提示词 — 增强版：融合技能图片策略
   */
  private async buildImagePrompts(platform: string, input: any, textContent: string, quantity: number): Promise<string[]> {
    const title = input.orderTitle || '产品'
    const desc = input.orderDescription || ''
    const audience = input.targetAudience || '年轻人'

    // 技能专属图片策略
    const skillStrategy = getSkillStrategy(input.primarySkill)
    const skillImageStyle = skillStrategy?.imageStrategy || ''

    // 平台视觉风格（中文描述，图片中的文字必须为中文）
    const styleMap: Record<string, string> = {
      wechat: '温馨生活风照片，自然光线，亲切真实的朋友圈分享感，高质量手机拍摄',
      wechat_moments: '温馨生活风照片，自然光线，亲切真实的朋友圈分享感，高质量手机拍摄，1:1方形构图',
      wechat_mp: '专业编辑风格图片，杂志品质，构图干净整洁，温暖高端感，适合文章配图',
      wechat_official: '专业编辑风格图片，杂志品质，构图干净整洁，温暖高端感，适合文章配图',
      wechat_channel: '潮流生活风照片，吸睛抢眼，现代构图，社交短视频封面风格',
      xiaohongshu: 'ins风精美摆拍，柔和粉彩色调，干净极简构图，自然柔光，生活灵感',
      douyin: '活力吸睛风，动态构图，高对比色彩，潮流视觉风格，拇指停留级封面',
      weibo: '大胆现代设计，干净专业外观，强烈视觉冲击，明星代言风格',
      bilibili: '创意趣味风，色彩丰富，二次元元素，活泼想象，年轻文化',
      kuaishou: '真实接地气风，自然不做作，生活化场景，温暖质朴',
      toutiao: '专业资讯风图片，信息清晰，编辑级品质，有冲击力',
      zhihu: '专业学术风，干净数据可视化风格，高品质，知性感'
    }
    const platformStyle = styleMap[platform] || styleMap.wechat

    const productKeywords = await this.extractProductKeywords(title, desc)

    // 通用中文指令：图片中所有文字必须使用中文
    const chineseTextRule = '图片中出现的所有文字、标语、标签必须使用中文，禁止出现英文文字'

    const skillHint = skillImageStyle ? `，${skillImageStyle}` : ''

    // 多图场景（>=3张）：用LLM生成差异化视觉描述
    if (quantity >= 3 && textContent && textContent.length > 100) {
      try {
        const llmPrompts = await this.generateContextAwareImageDescs(textContent, quantity, title)
        if (llmPrompts && llmPrompts.length === quantity) {
          this.logger.log(`使用LLM差异化提示词生成${quantity}张图片`)
          return llmPrompts.map((desc, i) => {
            if (i === 0) {
              return `${title}的封面主图，视觉描述：${desc}，${platformStyle}${skillHint}，居中构图，高端品质，极强吸引力，面向${audience}，4K商业摄影级别，${chineseTextRule}。产品关键词参考：${productKeywords}`
            }
            return `${title}的${desc}，${platformStyle}${skillHint}，面向${audience}，4K，${chineseTextRule}。产品关键词参考：${productKeywords}`
          })
        }
      } catch (err: any) {
        this.logger.warn(`LLM生成差异化图片提示词失败: ${err.message}，降级为模板模式`)
      }
    }

    // 降级：模板模式（2张图以下，或LLM失败时）
    const prompts: string[] = []

    // 从文案中提取关键场景信息（非LLM方式，取文案关键词句）
    const textHighlights = this.extractTextHighlights(textContent, quantity)

    // 第1张：封面主图
    const coverHint = textHighlights[0] ? `，画面呼应：${textHighlights[0]}` : ''
    prompts.push(`${title}的封面主图，${platformStyle}${skillHint}，居中构图，高端品质，极强吸引力，让人忍不住点进来看${coverHint}，面向${audience}，4K商业摄影级别，${chineseTextRule}。产品关键词参考：${productKeywords}`)

    // 第2张：使用场景
    if (quantity >= 2) {
      const scene2Hint = textHighlights[1] ? `，画面呼应：${textHighlights[1]}` : ''
      prompts.push(`有人物使用${title}的生活场景图，${platformStyle}${skillHint}，真实日常瞬间，展现实际好处和快乐，自然有代入感${scene2Hint}，面向${audience}，4K，${chineseTextRule}。产品关键词参考：${productKeywords}`)
    }

    // 第3张：效果/细节
    if (quantity >= 3) {
      const scene3Hint = textHighlights[2] ? `，画面呼应：${textHighlights[2]}` : ''
      prompts.push(`${title}的特写细节和效果展示图，${platformStyle}${skillHint}，展示品质和变化，有说服力的证据，高端质感${scene3Hint}，面向${audience}，4K，${chineseTextRule}。产品关键词参考：${productKeywords}`)
    }

    // 第4张及以后：多角度多场景
    const extraScenes = [
      '开箱/拆封瞬间，惊喜感满满，仪式感场景',
      '与朋友分享/推荐的社交场景，欢快温馨氛围',
      '使用前后对比，直观展示效果变化',
      '收纳/摆放展示，融入家居或日常环境，美观协调',
      '户外/旅行携带场景，便携实用，生活化展示',
      '细节工艺特写，质感与做工，体现高端品质',
      '多角度外观展示，全面呈现产品设计之美',
      '搭配/组合使用场景，创意玩法，提升生活品质',
    ]
    for (let i = 3; i < quantity; i++) {
      const sceneHint = extraScenes[(i - 3) % extraScenes.length]
      const textHint = textHighlights[i] ? `，画面呼应：${textHighlights[i]}` : ''
      prompts.push(`${title}的${sceneHint}${textHint}，${platformStyle}${skillHint}，面向${audience}，4K，${chineseTextRule}。产品关键词参考：${productKeywords}`)
    }

    return prompts
  }

  /**
   * 从文案内容中提取关键视觉描述句（非LLM方式，用于模板降级）
   * 将文案按段落切分，取每段的核心短句
   */
  private extractTextHighlights(textContent: string, count: number): string[] {
    if (!textContent || textContent.length < 50) return Array(count).fill('')

    const highlights: string[] = []
    // 按段落分割
    const paragraphs = textContent.split(/\n+/).filter(p => p.trim().length > 10)
    // 取前N个段落的摘要
    for (let i = 0; i < count; i++) {
      if (i < paragraphs.length) {
        // 取段落中前40字，去掉markdown标记
        const cleaned = paragraphs[i].replace(/[#*\[\]()>!]/g, '').trim()
        highlights.push(cleaned.substring(0, 40))
      } else {
        highlights.push('')
      }
    }
    return highlights
  }

  /**
   * 生成视频 — 从已有文案/脚本中提取视觉 prompt + Seedance 2.0 视频生成
   */
  /**
   * 生成视频 — 异步模式：只创建 Seedance 任务，存 taskId 到数据库
   * 视频结果由 pollPendingVideoTasks 定时任务轮询获取
   */
  private async generateVideos(platform: string, input: any, textContent: string, images: string[], requestId: string): Promise<string[]> {
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
    const seedancePrompt = await this.extractVisualPrompt(videoScript, input)
    this.logger.log(`Seedance视觉prompt提取完成: ${seedancePrompt.substring(0, 80)}...`)

    // 3. 创建 Seedance 异步任务（不等待视频生成完成）
    try {
      this.logger.log(`创建Seedance异步视频任务: prompt=${seedancePrompt.substring(0, 50)}...`)
      const taskId = await this.createSeedanceTask(seedancePrompt)
      if (taskId) {
        // 存储 taskId 到数据库，后续由定时任务轮询
        const pool = getPool()
        await pool.execute(
          'UPDATE content_generation_requests SET seedance_task_id = ? WHERE id = ?',
          [taskId, requestId]
        )
        this.logger.log(`Seedance任务已创建并存储: taskId=${taskId}, requestId=${requestId}`)
        // 返回空数组 — 视频尚未生成，状态保持 generating_video
        return []
      }
    } catch (err: any) {
      this.logger.warn(`Seedance任务创建失败: ${err.message}`)
    }

    return []
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
6. 视频总时长为15秒，画面描述应匹配15秒视频节奏

示例输出：
"一位年轻女性在温馨的咖啡厅里，手持精致的产品包装盒，惊喜地打开展示内部。特写镜头捕捉她满意的微笑和产品的精美细节。随后切到户外阳光下的使用场景，自然光影中产品质感更加突出。结尾画面是她举起产品对镜头竖起大拇指推荐。"`

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请从以下视频脚本中提取核心视觉画面描述：\n\n${videoScript.substring(0, 2000)}` }
      ]
      const response = await this.invokeLlm(messages)
      const prompt = response || ''
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

    // 风格偏好和领域偏好指令
    const styleInstruction = getStyleInstruction(input.contentStyles || input.preferredStyles || [])
    const nicheInstruction = getNicheInstruction(input.nicheTags || input.industryTags || [])

    const systemPrompt = this.buildEnhancedSystemPrompt(platform, input)

    const prompt = `${systemPrompt}${styleInstruction ? `\n【创作风格要求 - 必须体现在脚本中】\n${styleInstruction}\n\n` : ''}${nicheInstruction ? `\n【专业领域要求 - 必须体现在脚本中】\n${nicheInstruction}\n\n` : ''}【商单任务 - 视频脚本创作】
品牌/产品名：${input.orderTitle}
详细创作要求：
${input.orderDescription}
目标受众：${input.targetAudience || '年轻用户'}

${skillVideoStrategy ? `【技能专属视频策略】\n${skillVideoStrategy}\n\n` : ''}【${videoGuide}】

【时长硬性约束 - 必须严格遵守】
1. 视频总时长严格控制在15秒以内，不得超过
2. 脚本场景数量控制在2-4个，每个场景3-5秒
3. 旁白/口播总字数不超过45字（15秒视频，每秒3字）
4. 画面描述精炼，直接给出核心视觉

【视频脚本格式】
每个场景包含：
- 场景编号和时间（如：场景1 0-3秒）
- 画面描述（具体的视觉内容）
- 旁白/口播文案（说出来的话，严格控制字数）
- 字幕/文字提示（画面上出现的文字）

【绝对红线】
1. 脚本必须围绕"${input.orderTitle}"来创作
2. 脚本时长不得超过15秒
3. 禁止出现AI痕迹
4. 风格和领域偏好必须体现在脚本创作中
5. 直接输出脚本，不要额外注释

请创作一个15秒以内的完整视频脚本：`

    try {
      const messages = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })
      const response = await this.invokeLlm(messages)
      return response || ''
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
      if ((status === 'preview' || status === 'completed') && generatedContent) {
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
        this.logger.log(`预览状态已写入数据库: requestId=${requestId}`)
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
   * 从订单标题和描述中提取产品关键词（中文，用于中文图片prompt）
   */
  private async extractProductKeywords(title: string, desc: string): Promise<string> {
    const fullText = `${title} ${desc}`

    // 中文关键词直接匹配（prompt已改为中文，关键词也用中文）
    const keywordList: string[] = [
      '护肤品', '面膜', '口红', '粉底', '香水', '洗发水', '沐浴露', '防晒',
      '手机', '耳机', '电脑', '平板', '衣服', '鞋子', '包包', '手表',
      '零食', '茶叶', '咖啡', '饮品', 'AI助手', '智能助手', '赚钱',
      '课程', '培训', '健身', '旅行', '美食', '家居', '办公',
      '美白', '抗老', '补水', '修复', '副业', '收入', '减肥', '瘦身', '增肌',
      '数字分身', '人机共生', '拉新', '推广', '变现', '自动化',
    ]

    const matchedKeywords: string[] = []
    for (const kw of keywordList) {
      if (fullText.includes(kw) && !matchedKeywords.includes(kw)) {
        matchedKeywords.push(kw)
      }
    }

    if (matchedKeywords.length >= 2) {
      return matchedKeywords.slice(0, 4).join('、')
    }

    // 关键词不足时，用LLM从标题描述中提取中文关键词
    try {
      this.logger.log(`本地关键词匹配不足(${matchedKeywords.length})，调用LLM提取中文关键词...`)
      const llmPrompt = `从以下产品/服务描述中提取3-5个中文关键词，用于AI图片生成的提示词。只输出关键词，用顿号分隔，不要解释。

产品标题：${title}
产品描述：${desc.substring(0, 300)}

中文关键词：`

      const keywords = await this.invokeLlm(
        [{ role: 'user', content: llmPrompt }]
      )
      const trimmedKeywords = keywords?.trim() || ''
      this.logger.log(`LLM关键词提取结果: ${trimmedKeywords}`)
      if (trimmedKeywords) {
        return trimmedKeywords
      }
    } catch (err: any) {
      this.logger.warn(`LLM关键词提取失败: ${err.message}`)
    }

    if (matchedKeywords.length > 0) {
      return matchedKeywords.slice(0, 4).join('、')
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
      if (firstItem.url) {
        // 下载临时URL并转存到veImageX CDN，避免第三方链接过期
        try {
          this.logger.log(`[ImageHTTP] 下载临时图片并转存veImageX CDN: ${firstItem.url.slice(0, 80)}...`)
          const imgResponse = await fetch(firstItem.url)
          if (imgResponse.ok) {
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
            const fileName = `ai-generated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
            const uploadResult = await this.volcengineService.uploadImage({ buffer: imgBuffer, originalname: fileName, mimetype: 'image/png' } as Express.Multer.File)
            imageUrl = uploadResult.url
            this.logger.log(`[ImageHTTP] 图片转存veImageX CDN成功: ${imageUrl.slice(0, 80)}...`)
          } else {
            this.logger.warn(`[ImageHTTP] 下载临时图片失败: ${imgResponse.status}，使用原始URL`)
            imageUrl = firstItem.url
          }
        } catch (downloadErr: any) {
          this.logger.warn(`[ImageHTTP] 图片转存veImageX CDN失败: ${downloadErr.message}，使用原始URL`)
          imageUrl = firstItem.url
        }
      } else if (firstItem.b64_json) {
        // base64 图片上传到 veImageX CDN
        this.logger.log('[ImageHTTP] API返回base64，上传到veImageX CDN...')
        try {
          const base64Data = firstItem.b64_json
          const buffer = Buffer.from(base64Data, 'base64')
          const fileName = `ai-generated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
          const uploadResult = await this.volcengineService.uploadImage({ buffer, originalname: fileName, mimetype: 'image/png' } as Express.Multer.File)
          imageUrl = uploadResult.url
          this.logger.log(`[ImageHTTP] base64上传veImageX成功: ${imageUrl.slice(0, 80)}...`)
        } catch (uploadErr: any) {
          this.logger.error(`[ImageHTTP] base64上传veImageX失败: ${uploadErr.message}`)
          // 降级：仍然返回 base64（保证功能不中断）
          imageUrl = `data:image/png;base64,${firstItem.b64_json}`
        }
      }
    }

    if (!imageUrl) {
      throw new Error('图片生成返回数据为空')
    }

    this.logger.log(`[ImageHTTP] 图片生成成功, url: ${imageUrl.slice(0, 80)}...`)
    return imageUrl
  }

  /**
   * 创建 Seedance 异步视频生成任务，返回 taskId
   */
  private async createSeedanceTask(prompt: string): Promise<string> {
    const createUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks`
    this.logger.log(`[Seedance] creating video task, prompt: ${prompt.slice(0, 80)}...`)

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
        duration: 15,
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
    return taskId
  }

  /**
   * 查询单个 Seedance 任务状态，返回视频 URL 或 null（还在生成中）或抛出异常（失败）
   */
  private async pollSeedanceTask(taskId: string): Promise<string | null> {
    const pollUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks/${taskId}`
    const pollResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.seedanceApiKey}`,
      },
    })

    if (!pollResponse.ok) {
      this.logger.warn(`[Seedance] poll error: ${pollResponse.status}`)
      return null // 网络问题，下次重试
    }

    const pollResult = await pollResponse.json() as any
    const status = pollResult.status
    this.logger.log(`[Seedance] task ${taskId} status: ${status}`)

    if (status === 'succeeded' || status === 'complete' || status === 'success') {
      // 解析视频 URL（多种格式兼容）
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
        if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
          this.logger.log(`[Seedance] 视频生成成功(直接URL): ${item.slice(0, 80)}...`)
          return item
        }
      }
      if (pollResult.output?.video_url) return pollResult.output.video_url
      if (pollResult.data?.video_url) return pollResult.data.video_url

      this.logger.error(`[Seedance] 任务成功但未找到视频URL: ${JSON.stringify(pollResult).slice(0, 500)}`)
      throw new Error('Seedance任务成功但未找到视频URL')
    }

    if (status === 'failed' || status === 'error') {
      const errorMsg = pollResult.error?.message || pollResult.message || '未知错误'
      this.logger.error(`[Seedance] task failed: ${errorMsg}`)
      throw new Error(`Seedance视频生成失败: ${errorMsg}`)
    }

    // 状态为 running/processing/in_progress/queued 等，还在生成中
    return null
  }

  /**
   * 定时任务：每 30 秒扫描 generating_video 状态且有 seedance_task_id 的记录
   * 轮询 Seedance 任务状态，完成后更新记录
   * 超时保护：超过 30 分钟仍未完成的自动标记失败
   */
  @Cron('*/30 * * * * *')
  async pollPendingVideoTasks() {
    try {
      const pool = getPool()

      // 1. 超时保护：generating_video 超过 30 分钟自动标记失败
      const [timeoutRows]: any = await pool.execute(
        `SELECT id, order_id FROM content_generation_requests
         WHERE status = 'generating_video' AND seedance_task_id IS NOT NULL
         AND updated_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
      )
      if (timeoutRows && timeoutRows.length > 0) {
        for (const row of timeoutRows) {
          this.logger.warn(`[VideoPoll] 视频生成超时(>30min): requestId=${row.id}`)
          await pool.execute(
            'UPDATE content_generation_requests SET status = ?, error = ?, seedance_task_id = NULL, updated_at = NOW() WHERE id = ?',
            ['partial_failed', '视频生成超时（30分钟）', row.id]
          )
          try { await this.syncOrderStatus(row.order_id) } catch (e: any) { /* ignore */ }
        }
      }

      // 2. 正常轮询：未超时的记录
      const [rows]: any = await pool.execute(
        `SELECT id, order_id, seedance_task_id, content, images, platform
         FROM content_generation_requests
         WHERE status = 'generating_video' AND seedance_task_id IS NOT NULL
         ORDER BY created_at ASC LIMIT 10`
      )

      if (!rows || rows.length === 0) return

      for (const record of rows) {
        const { id, order_id, seedance_task_id, content, images, platform } = record
        try {
          this.logger.log(`[VideoPoll] 轮询任务: requestId=${id}, taskId=${seedance_task_id}`)
          const videoUrl = await this.pollSeedanceTask(seedance_task_id)

          if (videoUrl) {
            // 视频生成成功，下载并转存到自己的CDN
            let finalVideoUrl = videoUrl
            try {
              this.logger.log(`[VideoPoll] 下载临时视频并转存veImageX CDN: ${videoUrl.slice(0, 80)}...`)
              const videoResponse = await fetch(videoUrl)
              if (videoResponse.ok) {
                const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
                const fileName = `content-video/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp4`
                const uploadResult = await this.volcengineService.uploadVideo(videoBuffer, fileName)
                finalVideoUrl = uploadResult.url
                this.logger.log(`[VideoPoll] 视频转存veImageX CDN成功: ${finalVideoUrl.slice(0, 80)}...`)
              } else {
                this.logger.warn(`[VideoPoll] 下载临时视频失败: ${videoResponse.status}，使用原始URL`)
              }
            } catch (downloadErr: any) {
              this.logger.warn(`[VideoPoll] 视频转存CDN失败: ${downloadErr.message}，使用原始URL`)
            }
            // 更新记录
            this.logger.log(`[VideoPoll] 视频生成成功: requestId=${id}, url=${finalVideoUrl.slice(0, 80)}...`)
            await pool.execute(
              'UPDATE content_generation_requests SET status = ?, video_url = ?, seedance_task_id = NULL, updated_at = NOW() WHERE id = ?',
              ['preview', finalVideoUrl, id]
            )
            // 同步订单状态
            try {
              await this.syncOrderStatus(order_id)
            } catch (e: any) {
              this.logger.warn(`[VideoPoll] 同步订单状态失败: ${e.message}`)
            }
          }
          // null 表示还在生成中，下次再轮询
        } catch (err: any) {
          // Seedance 任务失败
          this.logger.warn(`[VideoPoll] 视频任务失败: requestId=${id}, error=${err.message}`)
          const hasImages = images && images !== '[]' && images !== ''
          const finalStatus = hasImages ? 'partial_failed' : (content ? 'partial_failed' : 'failed')
          await pool.execute(
            'UPDATE content_generation_requests SET status = ?, error = ?, seedance_task_id = NULL, updated_at = NOW() WHERE id = ?',
            [finalStatus, `视频生成失败: ${err.message}`, id]
          )
          try {
            await this.syncOrderStatus(order_id)
          } catch (e: any) {
            this.logger.warn(`[VideoPoll] 同步订单状态失败: ${e.message}`)
          }
        }
      }

      // 3. 兜底：处理无 seedance_task_id 但卡在 generating_video 的旧记录
      const [stuckRows]: any = await pool.execute(
        `SELECT id, order_id, content, images FROM content_generation_requests
         WHERE status = 'generating_video' AND seedance_task_id IS NULL
         AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)`
      )
      if (stuckRows && stuckRows.length > 0) {
        for (const row of stuckRows) {
          this.logger.warn(`[VideoPoll] 无taskId的卡住记录: requestId=${row.id}, 标记为partial_failed`)
          const hasImages = row.images && row.images !== '[]' && row.images !== ''
          const hasContent = row.content && row.content.length > 0
          const finalStatus = (hasImages || hasContent) ? 'partial_failed' : 'failed'
          await pool.execute(
            'UPDATE content_generation_requests SET status = ?, error = ?, updated_at = NOW() WHERE id = ?',
            [finalStatus, '视频生成异常（无后台任务）', row.id]
          )
          try { await this.syncOrderStatus(row.order_id) } catch (e: any) { /* ignore */ }
        }
      }
    } catch (err: any) {
      this.logger.error(`[VideoPoll] 定时任务执行失败: ${err.message}`)
    }
  }

  /**
   * 将数据库中存储的 base64 图片迁移到 TOS 对象存储
   * 上传成功后更新数据库，只保留 URL
   */
  async migrateBase64ImagesToTos(requestId: string, images: string[]): Promise<void> {
    try {
      const updatedImages: string[] = []
      for (const img of images) {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
          // base64 → Buffer → 上传 veImageX CDN → 获取永久 URL
          const matches = img.match(/^data:image\/(\w+);base64,(.+)$/)
          if (matches) {
            const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
            const buffer = Buffer.from(matches[2], 'base64')
            const filename = `content-images_${requestId}_${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`
            const uploadResult = await this.volcengineService.uploadImage({ buffer, originalname: filename, mimetype: 'image/png' } as Express.Multer.File)
            const url = uploadResult.url
            console.log(`[CDN迁移] base64→永久URL: ${filename} → ${url.slice(0, 80)}...`)
            updatedImages.push(url)
          } else {
            // 无法解析的 base64，跳过
          }
        } else if (typeof img === 'string' && img.startsWith('http')) {
          updatedImages.push(img)
        }
      }

      // 更新数据库
      if (updatedImages.length > 0) {
        const db = getMySQLClient()
        await db.query(
          'UPDATE content_generation_requests SET images = ? WHERE id = ?',
          [JSON.stringify(updatedImages), requestId]
        )
        console.log(`[TOS迁移] 已更新 ${requestId} 的图片: ${updatedImages.length} 张`)
      }
    } catch (error) {
      console.error(`[TOS迁移] 迁移失败 ${requestId}:`, error.message)
    }
  }
}
