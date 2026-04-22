import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { ContentGenerationService } from '../content-generation/content-generation.service'
import { LLMClient, Config } from 'coze-coding-dev-sdk'

export interface ProcessingStatus {
  requestId: string
  status: 'queuing' | 'generating' | 'preview' | 'publishing' | 'completed' | 'failed'
  queuePosition?: number
  estimatedTime?: number
  generatedContent?: {
    title: string
    content: string
    platform: string
  }
  publishStatus?: {
    platform: string
    status: 'pending' | 'success' | 'failed' | 'manual'
    message?: string
  }
}

// 队列管理
class TaskQueue {
  private maxConcurrentTasks = 3 // 最大并发数
  private activeTasks = new Set<string>() // 正在执行的任务ID
  private queue: Array<{ requestId: string; timestamp: number }> = []

  constructor(private contentGenerationService: ContentGenerationService) {
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

      // 使用 ContentGenerationService 生成内容
      const generatedContents = await this.contentGenerationService.generateContent({
        orderId,
        requestId,
        avatarId,
        orderTitle: order.title,
        orderDescription: order.description,
        platforms: order.platforms || [],
        contentType: order.content_type,
        targetAudience: order.target_audience || '',
        avatarName: avatar.name,
        avatarPersonality: avatar.personality
      })

      console.log('[TaskQueue] 内容生成成功:', {
        requestId,
        contentCount: generatedContents.length
      })

      // 取第一个生成的内容（如果有的话）
      let generatedContent = ''
      if (generatedContents.length > 0 && generatedContents[0].content) {
        generatedContent = generatedContents[0].content
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
    private readonly contentGenerationService: ContentGenerationService
  ) {
    const config = new Config()
    this.llmClient = new LLMClient(config)
    // 将 contentGenerationService 传递给 TaskQueue
    this.queue = new TaskQueue(contentGenerationService)
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
        .single()

      if (orderError) {
        console.warn('[OrderProcessing] 查询订单信息失败:', orderError)
      } else {
        orderData = order
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
        platform: orderData?.platforms?.[0] || ''
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
  async publishContent(requestId: string) {
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

    const platform = order.platforms[0]
    const content = request.confirmed_content || request.generated_content

    try {
      // 根据平台进行发布
      if (platform === 'wechat_mp') {
        // 公众号：发布到草稿箱
        await this.publishToWechatMP(order, content)
      } else {
        // 其他平台：检查是否有发布技能
        const hasPublishSkill = await this.checkPublishSkill(platform, request.avatar_id)

        if (hasPublishSkill) {
          // 自动发布
          await this.autoPublish(platform, order, content)
        } else {
          // 提示手动发布
          throw new Error('该平台暂未配置发布技能，请手动发布')
        }
      }

      // 更新发布状态
      await client
        .from('order_dispatch_requests')
        .update({
          status: 'completed',
          publish_status: {
            platform,
            status: 'success',
            message: '发布成功'
          }
        })
        .eq('id', requestId)

      // 更新订单状态
      await client
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', request.order_id)

    } catch (error: any) {
      // 更新发布状态
      await client
        .from('order_dispatch_requests')
        .update({
          status: 'completed',
          publish_status: {
            platform,
            status: 'manual',
            message: error.message || '自动发布失败，请手动发布'
          }
        })
        .eq('id', requestId)

      throw error
    }

    return { success: true }
  }

  /**
   * 发布到公众号草稿箱
   */
  private async publishToWechatMP(order: any, content: string) {
    // 这里需要调用微信公众号 API
    // 暂时只记录日志
    console.log('[OrderProcessing] 发布到公众号草稿箱:', {
      orderId: order.id,
      title: order.title,
      contentLength: content.length
    })

    // TODO: 实现真实的公众号草稿箱发布
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

    // 检查是否有发布相关的技能
    const hasPublishSkill = skills.some(skill => {
      const skillConfig = skill.skill_config || {}
      return skillConfig.type === 'publish' && skillConfig.platform === platform
    })

    return hasPublishSkill
  }

  /**
   * 自动发布
   */
  private async autoPublish(platform: string, order: any, content: string) {
    console.log('[OrderProcessing] 自动发布:', {
      platform,
      orderId: order.id,
      title: order.title,
      contentLength: content.length
    })

    // TODO: 根据平台调用相应的发布 API
  }
}
