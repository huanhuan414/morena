import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { ContentGenerationService } from '../content-generation/content-generation.service'
import { AvatarAgentService } from '../avatar-agent/avatar-agent.service'
import { LinkValidationService } from './link-validation.service'
import { LLMClient, Config } from 'coze-coding-dev-sdk'

export interface ProcessingStatus {
  requestId: string
  status: 'queuing' | 'generating' | 'preview' | 'publishing' | 'completed' | 'failed'
  queuePosition?: number
  estimatedTime?: number
  generatedContent?: {
    title: string
    content: string
    images?: string[]
    platforms: string[]
  }
  publishStatus?: {
    platforms: Array<{
      platform: string
      status: 'success' | 'failed' | 'manual'
      message: string
      publishedAt?: string
    }>
    summary: string
  }
}

// 队列管理
class TaskQueue {
  private maxConcurrentTasks = 3 // 最大并发数
  private activeTasks = new Set<string>() // 正在执行的任务ID
  private queue: Array<{ requestId: string; timestamp: number }> = []

  constructor(
    private contentGenerationService: ContentGenerationService,
    private checkGenerateSkill: (platform: string, avatarId: string) => Promise<boolean>
  ) {
    // 每30秒执行一次队列检查
    setInterval(() => this.processQueue(), 30000)
  }

  // 加入队列
  async enqueue(requestId: string): Promise<{ position: number; estimatedTime: number }> {
    const position = this.queue.length
    this.queue.push({ requestId, timestamp: Date.now() })

    // 每个任务预计耗时 60 秒
    const estimatedTime = position * 60

    console.log('[TaskQueue] 任务加入队列:', {
      requestId,
      position,
      estimatedTime
    })

    // 尝试处理队列
    this.processQueue()

    return { position, estimatedTime }
  }

  // 处理队列
  async processQueue() {
    const client = getSupabaseClient()

    console.log('[TaskQueue] 检查队列:', {
      activeTasks: this.activeTasks.size,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrentTasks
    })

    // 检查是否有空闲执行槽位
    while (this.activeTasks.size < this.maxConcurrentTasks && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break

      // 检查任务是否还在队列中
      const { data: request } = await client
        .from('order_dispatch_requests')
        .select('id, status, order_id, avatar_id')
        .eq('id', task.requestId)
        .single()

      if (!request || request.status !== 'accepted') {
        console.log('[TaskQueue] 任务已取消或不存在:', task.requestId)
        continue
      }

      // 将任务加入执行队列
      this.activeTasks.add(task.requestId)

      console.log('[TaskQueue] 开始执行任务:', task.requestId)

      // 更新状态为生成中
      await client
        .from('order_dispatch_requests')
        .update({ status: 'generating' })
        .eq('id', task.requestId)

      // 异步执行任务
      this.executeTask(task.requestId, request.order_id, request.avatar_id).catch(error => {
        console.error('[TaskQueue] 任务执行失败:', task.requestId, error)
        this.activeTasks.delete(task.requestId)
      })
    }
  }

  // 执行任务
  private async executeTask(requestId: string, orderId: string, avatarId: string) {
    try {
      console.log('[TaskQueue] 正在生成内容:', { requestId, orderId, avatarId })

      // 获取订单和分身信息
      const client = getSupabaseClient()

      const [{ data: order }, { data: avatar }] = await Promise.all([
        client.from('orders').select('*').eq('id', orderId).single(),
        client.from('avatars').select('*').eq('id', avatarId).single()
      ])

      if (!order || !avatar) {
        throw new Error('订单或分身不存在')
      }

      // 检查分身是否有内容生成技能
      const platforms = order.platforms || []
      const firstPlatform = platforms[0]

      const hasGenerateSkill = await this.checkGenerateSkill(firstPlatform, avatarId)

      console.log('[TaskQueue] 分身技能检查:', {
        avatarId,
        avatarName: avatar.name,
        platform: firstPlatform,
        hasGenerateSkill,
        message: hasGenerateSkill
          ? '分身具有内容生成技能，可以使用技能生成内容'
          : '分身暂无对应的内容生成技能，使用默认内容生成服务'
      })

      // TODO: 如果分身有技能，调用分身技能生成内容
      // 目前暂时使用默认的内容生成服务
      if (hasGenerateSkill) {
        console.log('[TaskQueue] 检测到分身技能，但尚未实现技能调用，使用默认服务生成')
      }

      // 使用 ContentGenerationService 生成内容
      const generatedContents = await this.contentGenerationService.generateContent({
        orderId,
        requestId,
        avatarId,
        orderTitle: order.title,
        orderDescription: order.description,
        platforms: platforms,
        contentType: order.content_type,
        targetAudience: order.target_audience || '',
        avatarName: avatar.name,
        avatarPersonality: avatar.personality
      })

      console.log('[TaskQueue] 内容生成成功:', {
        requestId,
        contentCount: generatedContents.length,
        usedSkill: hasGenerateSkill
      })

      // 取第一个生成的内容（如果有的话）
      let generatedContent = ''
      if (generatedContents.length > 0 && generatedContents[0].content) {
        generatedContent = generatedContents[0].content
      }

      // 检查是否成功生成内容
      if (!generatedContent || generatedContent.trim().length === 0) {
        console.error('[TaskQueue] 生成的内容为空，标记为失败:', requestId)
        await client
          .from('order_dispatch_requests')
          .update({ status: 'failed' })
          .eq('id', requestId)
        throw new Error('生成的内容为空')
      }

      // 更新状态为预览
      await client
        .from('order_dispatch_requests')
        .update({
          status: 'preview',
          generated_content: generatedContent
        })
        .eq('id', requestId)

    } catch (error) {
      console.error('[TaskQueue] 任务执行失败:', error)

      // 更新状态为失败
      const client = getSupabaseClient()
      await client
        .from('order_dispatch_requests')
        .update({ status: 'failed' })
        .eq('id', requestId)

    } finally {
      // 从执行队列移除
      this.activeTasks.delete(requestId)

      // 尝试处理下一个任务
      this.processQueue()
    }
  }

  // 获取队列位置
  getQueuePosition(requestId: string): number {
    const position = this.queue.findIndex(t => t.requestId === requestId)
    return position >= 0 ? position + 1 : 0
  }

  // 获取活跃任务数
  getActiveTaskCount(): number {
    return this.activeTasks.size
  }
}

@Injectable()
export class OrderProcessingService {
  private queue: TaskQueue
  private llmClient: LLMClient

  constructor(
    private readonly contentGenerationService: ContentGenerationService,
    private readonly avatarAgentService: AvatarAgentService,
    private readonly linkValidationService: LinkValidationService
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    // 将 contentGenerationService 和 checkGenerateSkill 方法传递给 TaskQueue
    this.queue = new TaskQueue(contentGenerationService, this.checkGenerateSkill.bind(this))
  }

  /**
   * 将任务加入队列
   */
  async enqueueTask(requestId: string): Promise<{ position: number; estimatedTime: number }> {
    return this.queue.enqueue(requestId)
  }

  /**
   * 获取处理状态
   */
  async getProcessingStatus(requestId: string): Promise<ProcessingStatus> {
    const client = getSupabaseClient()

    console.log('[OrderProcessing] 查询订单状态:', { requestId })

    // 分别查询订单请求、订单和分身信息（因为可能没有外键关系）
    const { data: request, error: requestError } = await client
      .from('order_dispatch_requests')
      .select('id, order_id, avatar_id, status, generated_content, publish_status, confirmed_content')
      .eq('id', requestId)
      .single()

    // 查询生成的内容（包括图片）
    let imageSuggestions: string[] = []
    const { data: genContent } = await client
      .from('generated_content')
      .select('image_suggestions')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (genContent?.image_suggestions) {
      imageSuggestions = genContent.image_suggestions
    }

    if (requestError) {
      console.error('[OrderProcessing] 查询订单请求失败:', requestError)
      throw new Error(`查询订单请求失败: ${requestError.message}`)
    }

    if (!request) {
      console.error('[OrderProcessing] 订单请求不存在:', { requestId })
      throw new Error(`订单请求不存在: ${requestId}`)
    }

    console.log('[OrderProcessing] 订单请求查询成功:', {
      requestId,
      status: request.status,
      orderId: request.order_id,
      avatarId: request.avatar_id
    })

    // 查询订单信息
    let orderData: any = null
    if (request.order_id) {
      const { data: order, error: orderError } = await client
        .from('orders')
        .select('id, title, platforms, content_type, deadline')
        .eq('id', request.order_id)
        .maybeSingle()

      if (orderError) {
        console.warn('[OrderProcessing] 查询订单信息失败:', orderError)
      } else if (order) {
        orderData = order
        console.log('[OrderProcessing] 订单信息查询成功:', order)
      } else {
        console.warn('[OrderProcessing] 未找到订单信息，order_id:', request.order_id)
      }
    }

    // 查询分身信息
    let avatarData: any = null
    if (request.avatar_id) {
      const { data: avatar, error: avatarError } = await client
        .from('avatars')
        .select('id, name, avatar_url, level')
        .eq('id', request.avatar_id)
        .single()

      if (avatarError) {
        console.warn('[OrderProcessing] 查询分身信息失败:', avatarError)
      } else {
        avatarData = avatar
      }
    }

    console.log('[OrderProcessing] 所有数据查询完成:', {
      hasOrder: !!orderData,
      hasAvatar: !!avatarData
    })

    const status: ProcessingStatus = {
      requestId,
      status: request.status as any,
      generatedContent: request.generated_content ? {
        title: orderData?.title || '未知订单',
        content: request.generated_content,
        images: imageSuggestions,
        platforms: orderData?.platforms || []
      } : undefined,
      publishStatus: request.publish_status
    }

    // 如果是排队状态，获取队列位置
    if (request.status === 'accepted') {
      const position = this.queue.getQueuePosition(requestId)
      const estimatedTime = position * 60

      status.status = 'queuing'
      status.queuePosition = position
      status.estimatedTime = estimatedTime
    }

    console.log('[OrderProcessing] 返回状态数据:', {
      requestId,
      status: status.status,
      hasGeneratedContent: !!status.generatedContent,
      generatedContent: status.generatedContent,
      orderDataTitle: orderData?.title,
      orderDataPlatforms: orderData?.platforms
    })

    return status
  }

  /**
   * 确认内容并开始发布
   */
  async confirmContent(requestId: string, content: string) {
    const client = getSupabaseClient()

    // 保存用户确认的内容
    const { error } = await client
      .from('order_dispatch_requests')
      .update({
        status: 'publishing',
        confirmed_content: content
      })
      .eq('id', requestId)

    if (error) {
      throw new Error('确认内容失败')
    }

    return { success: true }
  }

  /**
   * 发布内容
   */
  async publishContent(requestId: string, content?: string) {
    const client = getSupabaseClient()

    // 分别查询订单请求、订单和分身信息
    const { data: request, error: requestError } = await client
      .from('order_dispatch_requests')
      .select('id, order_id, avatar_id, status, generated_content, publish_status, confirmed_content')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      throw new Error('获取订单请求失败')
    }

    // 查询订单信息
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('*')
      .eq('id', request.order_id)
      .single()

    if (orderError || !order) {
      throw new Error('获取订单信息失败')
    }

    // 使用传递的内容，如果没有则使用已生成的内容
    const finalContent = content || request.confirmed_content || request.generated_content
    if (!finalContent) {
      throw new Error('没有可发布的内容')
    }

    const platforms = order.platforms || []
    if (platforms.length === 0) {
      throw new Error('订单没有指定发布平台')
    }

    // 发布结果记录
    const publishResults: Array<{
      platform: string
      status: 'success' | 'manual'
      message: string
      publishedAt?: string
    }> = []

    // 遍历所有平台进行发布
    for (const platform of platforms) {
      console.log('[OrderProcessing] 开始发布到平台:', { platform, requestId, avatarId: request.avatar_id })

      try {
        // 检查分身是否有发布技能
        const hasPublishSkill = await this.checkPublishSkill(platform, request.avatar_id)

        console.log('[OrderProcessing] 发布技能检查结果:', {
          platform,
          avatarId: request.avatar_id,
          hasPublishSkill
        })

        if (platform === 'wechat_mp') {
          if (hasPublishSkill) {
            // 公众号：分身有发布技能，尝试自动发布
            console.log('[OrderProcessing] 分身有公众号发布技能，尝试自动发布')
            await this.autoPublish(platform, order, finalContent, request.avatar_id)
            publishResults.push({
              platform,
              status: 'success',
              message: '已使用分身技能发布到公众号草稿箱',
              publishedAt: new Date().toISOString()
            })
          } else {
            // 分身没有发布技能，提示需要手动发布
            console.log('[OrderProcessing] 分身无公众号发布技能')
            publishResults.push({
              platform,
              status: 'manual',
              message: '分身暂未配置公众号发布技能，请手动复制内容发布到公众号草稿箱'
            })
          }
        } else if (platform === 'wechat_moments') {
          // 朋友圈：微信官方 API 不支持自动发布，需要手动发布
          publishResults.push({
            platform,
            status: 'manual',
            message: '朋友圈暂不支持自动发布，请手动复制内容后发布'
          })
        } else if (platform === 'wechat_video') {
          // 视频号：微信官方 API 不支持自动发布，需要手动发布
          publishResults.push({
            platform,
            status: 'manual',
            message: '视频号暂不支持自动发布，请手动复制内容后发布'
          })
        } else {
          // 其他平台：检查是否有发布技能
          if (hasPublishSkill) {
            // 自动发布
            console.log('[OrderProcessing] 分身有发布技能，尝试自动发布')
            await this.autoPublish(platform, order, finalContent, request.avatar_id)
            publishResults.push({
              platform,
              status: 'success',
              message: '已使用分身技能自动发布',
              publishedAt: new Date().toISOString()
            })
          } else {
            // 提示手动发布
            console.log('[OrderProcessing] 分身无发布技能')
            publishResults.push({
              platform,
              status: 'manual',
              message: '分身暂未配置该平台的发布技能，请手动发布'
            })
          }
        }
      } catch (error: any) {
        console.error('[OrderProcessing] 平台发布失败:', { platform, error: error.message })
        // 发布失败时，标记为需要手动发布，而不是失败
        publishResults.push({
          platform,
          status: 'manual',
          message: `自动发布失败（${error.message}），请手动发布`
        })
      }
    }

    // 检查是否有成功的发布
    const hasSuccess = publishResults.some(r => r.status === 'success')
    const hasManual = publishResults.some(r => r.status === 'manual')

    // 更新发布状态
    // 发布完成后的状态应该是 'published'（已发布，待反馈）
    // 分身需要反馈发布效果（截图、链接）
    await client
      .from('order_dispatch_requests')
      .update({
        status: 'published',  // 改为 published，而不是 completed
        confirmed_content: finalContent,
        publish_status: {
          platforms: publishResults,
          summary: hasSuccess
            ? '部分或全部平台发布成功，请反馈发布效果'
            : '需要手动发布，请发布后反馈效果'
        }
      })
      .eq('id', requestId)

    // 更新订单状态为 published
    if (hasSuccess || hasManual) {
      await client
        .from('orders')
        .update({ status: 'published' })  // 改为 published
        .eq('id', request.order_id)
    }

    return {
      success: true,
      publishResults,
      content: finalContent,
      summary: hasSuccess
        ? '部分或全部平台发布成功'
        : '需要手动发布'
    }
  }

  /**
   * 重新生成内容
   */
  async regenerateContent(requestId: string) {
    const client = getSupabaseClient()

    console.log('[OrderProcessing] 开始重新生成内容:', { requestId })

    // 查询订单请求信息
    const { data: request, error: requestError } = await client
      .from('order_dispatch_requests')
      .select('id, order_id, avatar_id, status')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      throw new Error('获取订单请求失败')
    }

    // 查询订单信息
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('*')
      .eq('id', request.order_id)
      .single()

    if (orderError || !order) {
      throw new Error('获取订单信息失败')
    }

    // 查询分身信息
    const { data: avatar, error: avatarError } = await client
      .from('avatars')
      .select('*')
      .eq('id', request.avatar_id)
      .single()

    if (avatarError || !avatar) {
      throw new Error('获取分身信息失败')
    }

    console.log('[OrderProcessing] 订单和分身信息:', {
      orderId: order.id,
      orderTitle: order.title,
      avatarId: avatar.id,
      avatarName: avatar.name
    })

    // 重置状态为 accepted，并清空已生成的内容
    await client
      .from('order_dispatch_requests')
      .update({
        status: 'accepted',
        generated_content: null,
        confirmed_content: null,
        publish_status: null
      })
      .eq('id', requestId)

    // 重新将任务加入队列
    const { position, estimatedTime } = await this.queue.enqueue(requestId)

    console.log('[OrderProcessing] 重新生成任务已加入队列:', {
      requestId,
      position,
      estimatedTime
    })

    return {
      success: true,
      position,
      estimatedTime
    }
  }

  /**
   * 检查是否有内容生成技能
   */
  private async checkGenerateSkill(platform: string, avatarId: string): Promise<boolean> {
    const client = getSupabaseClient()

    // 查询分身是否有对应的内容生成技能
    const { data: skills } = await client
      .from('avatar_skills')
      .select('*')
      .eq('avatar_id', avatarId)

    if (!skills || skills.length === 0) {
      return false
    }

    // 根据平台映射到对应的技能类型
    const platformSkillMap: Record<string, string> = {
      'wechat_mp': 'write_wechat_mp_article',
      'xiaohongshu': 'write_xiaohongshu_note',
      'douyin': 'write_article',
      'weibo': 'write_article',
      'bilibili': 'write_article',
      'wechat_video': 'write_article',
      'wechat_moments': 'write_article'
    }

    const skillType = platformSkillMap[platform] || 'write_article'

    // 检查是否有对应的生成技能
    const hasGenerateSkill = skills.some(skill => {
      const skillTypeFromDb = skill.skill_type
      // 完全匹配或者通用的 write_article
      return skillTypeFromDb === skillType || skillTypeFromDb === 'write_article'
    })

    console.log('[OrderProcessing] 检查内容生成技能:', {
      avatarId,
      platform,
      skillType,
      hasGenerateSkill,
      availableSkills: skills.map(s => s.skill_type)
    })

    return hasGenerateSkill
  }

  /**
   * 检查是否有发布技能
   */
  private async checkPublishSkill(platform: string, avatarId: string): Promise<boolean> {
    const client = getSupabaseClient()

    // 查询分身是否有对应的发布技能
    const { data: skills } = await client
      .from('avatar_skills')
      .select('*')
      .eq('avatar_id', avatarId)

    if (!skills || skills.length === 0) {
      return false
    }

    // 根据平台映射到对应的技能类型
    const platformSkillMap: Record<string, string> = {
      'wechat_mp': 'publish_wechat_mp',
      'xiaohongshu': 'publish_xiaohongshu',
      'douyin': 'publish_douyin',
      'weibo': 'publish_weibo',
      'bilibili': 'publish_bilibili',
      'wechat_video': 'publish_wechat_video'
    }

    const skillType = platformSkillMap[platform]

    if (!skillType) {
      console.log('[OrderProcessing] 平台未映射发布技能:', { platform })
      return false
    }

    // 检查是否有对应的发布技能
    const hasPublishSkill = skills.some(skill => {
      return skill.skill_type === skillType
    })

    console.log('[OrderProcessing] 检查发布技能:', {
      avatarId,
      platform,
      skillType,
      hasPublishSkill,
      availableSkills: skills.map(s => s.skill_type)
    })

    return hasPublishSkill
  }

  /**
   * 自动发布（调用分身技能）
   */
  private async autoPublish(platform: string, order: any, content: string, avatarId: string) {
    console.log('[OrderProcessing] 开始自动发布（调用分身技能）:', {
      platform,
      orderId: order.id,
      title: order.title,
      contentLength: content.length,
      avatarId
    })

    try {
      // 1. 获取分身的 userId
      const client = getSupabaseClient()
      const { data: avatar, error: avatarError } = await client
        .from('avatars')
        .select('id, user_id, name')
        .eq('id', avatarId)
        .single()

      if (avatarError || !avatar) {
        console.error('[OrderProcessing] 获取分身信息失败:', avatarError)
        throw new Error('分身不存在')
      }

      const userId = avatar.user_id
      console.log('[OrderProcessing] 分身信息:', { avatarId, userId, avatarName: avatar.name })

      // 2. 根据平台映射到对应的工具名称
      const toolMap: Record<string, string> = {
        'wechat_mp': 'publish_wechat_mp',
        'xiaohongshu': 'publish_xiaohongshu',
        'douyin': 'publish_douyin',
        'weibo': 'publish_weibo',
        'bilibili': 'publish_bilibili',
        'wechat_video': 'publish_wechat_video'
      }

      const toolName = toolMap[platform]

      if (!toolName) {
        console.error('[OrderProcessing] 不支持的平台:', platform)
        throw new Error(`不支持的平台: ${platform}`)
      }

      console.log('[OrderProcessing] 调用分身发布工具:', { toolName, avatarId, userId })

      // 3. 构建发布参数（只传递工具需要的参数）
      let publishParams: any = {
        title: order.title,
        content
      }

      // 公众号特殊处理
      if (platform === 'wechat_mp') {
        publishParams.auto_image = false  // 禁用自动配图，避免内容混乱
      }

      console.log('[OrderProcessing] 发布参数:', {
        title: publishParams.title,
        contentLength: publishParams.content.length,
        auto_image: publishParams.auto_image
      })

      // 4. 创建 thought 内容
      const thoughtContent = `发布内容到${platform}，标题：${order.title}，内容长度：${content.length}字`

      // 5. 创建 AvatarThought 对象（根据类型定义）
      const thought = {
        id: `publish_${order.id}_${Date.now()}`,
        avatarId,
        userId,  // 传递 userId
        content: thoughtContent,
        reasoning: `根据订单要求，将发布内容到${platform}平台`,
        intent: {
          type: 'publish',
          toolName,
          params: publishParams,
          confidence: 0.9
        },
        requiresTool: true,
        createdAt: new Date().toISOString()
      }

      console.log('[OrderProcessing] AvatarThought:', thought)

      // 6. 调用分身的发布工具
      // 需要构建 AvatarContext 对象，确保 userId 正确传递
      const avatarContext = {
        userId,
        conversationId: `order_${order.id}`,
        metadata: {
          orderId: order.id,
          platform
        }
      }

      const result = await this.avatarAgentService.act(avatarId, thought, avatarContext)

      console.log('[OrderProcessing] 发布工具执行结果:', result)

      if (result.success) {
        console.log('[OrderProcessing] 发布成功')
        return result
      } else {
        console.error('[OrderProcessing] 发布失败:', result.error)
        throw new Error(result.error || '发布失败')
      }
    } catch (error) {
      console.error('[OrderProcessing] 自动发布异常:', error)
      throw error
    }
  }

  async submitPublishFeedback(
    requestId: string,
    feedback: Record<string, { image?: string; link?: string }>
  ) {
    const client = getSupabaseClient()

    console.log('[OrderProcessing] 开始提交发布反馈:', { requestId, feedback })

    // 查询订单请求信息
    const { data: request, error: requestError } = await client
      .from('order_dispatch_requests')
      .select('id, order_id, avatar_id, status, publish_status')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      throw new Error('获取订单请求失败')
    }

    console.log('[OrderProcessing] 订单请求信息:', request)

    // 验证状态
    if (request.status !== 'published') {
      throw new Error('订单状态不允许提交反馈')
    }

    // 对每个平台的链接进行抓取，获取数据统计
    const enhancedFeedback: Record<string, any> = {}
    for (const [platform, feedbackData] of Object.entries(feedback)) {
      enhancedFeedback[platform] = { ...feedbackData }

      if (feedbackData.link) {
        console.log(`[OrderProcessing] 开始抓取平台 ${platform} 的链接数据: ${feedbackData.link}`)
        try {
          const result = await this.linkValidationService.validateLink(
            feedbackData.link,
            request.order_id,
            request.avatar_id
          )

          if (result.success && result.data) {
            // 将抓取到的数据添加到 feedback 中
            enhancedFeedback[platform] = {
              ...feedbackData,
              ...result.data
            }
            console.log(`[OrderProcessing] 平台 ${platform} 数据抓取成功:`, result.data)
          } else {
            console.warn(`[OrderProcessing] 平台 ${platform} 数据抓取失败:`, result.error)
          }
        } catch (error: any) {
          console.error(`[OrderProcessing] 平台 ${platform} 数据抓取异常:`, error)
          // 即使抓取失败，也保存原有的 feedback 数据
        }
      }
    }

    console.log('[OrderProcessing] 增强后的反馈数据:', enhancedFeedback)

    // 更新反馈信息
    const { error: updateError } = await client
      .from('order_dispatch_requests')
      .update({
        publish_feedback: enhancedFeedback,
        status: 'awaiting_acceptance', // 分身请求状态变为 awaiting_acceptance，等待发单者验收
        publish_status: {
          ...request.publish_status,
          summary: '已提交发布反馈，等待发单者验收',
          feedbackSubmittedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('[OrderProcessing] 更新反馈失败:', updateError)
      throw new Error('更新反馈失败')
    }

    // 更新订单状态为 reviewing（待验收）
    const { error: orderUpdateError } = await client
      .from('orders')
      .update({
        status: 'reviewing', // 订单状态变为 reviewing，等待发单者验收
        updated_at: new Date().toISOString()
      })
      .eq('id', request.order_id)

    if (orderUpdateError) {
      console.error('[OrderProcessing] 更新订单状态失败:', orderUpdateError)
      // 不抛出错误，因为反馈已经更新成功
    }

    console.log('[OrderProcessing] 订单状态已更新为 reviewing')

    // 更新 published_works 表中的反馈截图
    for (const [platform, feedbackData] of Object.entries(enhancedFeedback)) {
      if (feedbackData.image) {
        // 查找已保存的作品记录
        const { data: workData, error: workError } = await client
          .from('published_works')
          .select('id')
          .eq('order_id', request.order_id)
          .eq('platform', platform)
          .single()

        if (!workError && workData) {
          // 更新反馈截图
          await client
            .from('published_works')
            .update({
              feedback_image: feedbackData.image,
              updated_at: new Date().toISOString()
            })
            .eq('id', workData.id)
          console.log(`[OrderProcessing] 已更新平台 ${platform} 的反馈截图`)
        }
      }
    }

    console.log('[OrderProcessing] 提交发布反馈成功')

    return {
      requestId,
      feedback: enhancedFeedback,
      status: 'awaiting_acceptance'
    }
  }

  /**
   * 刷新反馈数据（重新抓取链接数据）
   */
  async refreshFeedbackData(requestId: string) {
    const client = getSupabaseClient()

    console.log('[OrderProcessing] 开始刷新反馈数据:', { requestId })

    // 查询订单请求信息
    const { data: request, error: requestError } = await client
      .from('order_dispatch_requests')
      .select('id, order_id, avatar_id, status, publish_feedback')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      throw new Error('获取订单请求失败')
    }

    if (!request.publish_feedback) {
      throw new Error('该订单没有提交反馈')
    }

    // 对每个平台的链接重新抓取数据
    const enhancedFeedback: Record<string, any> = {}
    for (const [platform, feedbackData] of Object.entries(request.publish_feedback)) {
      const platformFeedback = feedbackData as any
      enhancedFeedback[platform] = { ...platformFeedback }

      if (platformFeedback.link) {
        console.log(`[OrderProcessing] 开始抓取平台 ${platform} 的链接数据: ${platformFeedback.link}`)
        try {
          const result = await this.linkValidationService.validateLink(
            platformFeedback.link,
            request.order_id,
            request.avatar_id
          )

          if (result.success && result.data) {
            // 将抓取到的数据添加到 feedback 中
            enhancedFeedback[platform] = {
              ...platformFeedback,
              ...result.data
            }
            console.log(`[OrderProcessing] 平台 ${platform} 数据抓取成功:`, result.data)
          } else {
            console.warn(`[OrderProcessing] 平台 ${platform} 数据抓取失败:`, result.error)
          }
        } catch (error: any) {
          console.error(`[OrderProcessing] 平台 ${platform} 数据抓取异常:`, error)
          // 即使抓取失败，也保留原有的 feedback 数据
        }
      }
    }

    console.log('[OrderProcessing] 刷新后的反馈数据:', enhancedFeedback)

    // 更新反馈信息
    const { error: updateError } = await client
      .from('order_dispatch_requests')
      .update({
        publish_feedback: enhancedFeedback,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('[OrderProcessing] 更新反馈失败:', updateError)
      throw new Error('更新反馈失败')
    }

    console.log('[OrderProcessing] 刷新反馈数据成功')

    return {
      requestId,
      feedback: enhancedFeedback
    }
  }
}
