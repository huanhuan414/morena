// @ts-nocheck
import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { SmsService } from '../sms/sms.service'
import { NotificationService } from '../notification/notification.service'
import { OrderService } from '../order/order.service'
import { ContentGenerationService } from '../content-generation/content-generation.service'

@Injectable()
export class OrderDispatchService {
  private readonly logger = new Logger(OrderDispatchService.name)
  private avatarColumnsCache: Set<string> | null = null

  constructor(
    @Inject(forwardRef(() => SmsService)) private readonly smsService: SmsService,
    @Inject(forwardRef(() => NotificationService)) private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ContentGenerationService)) private readonly contentGenerationService: ContentGenerationService,
    @Inject(forwardRef(() => OrderService)) private readonly orderService: OrderService
  ) {}

  private normalizeDispatchStatus(status?: string): string {
    if (status === 'confirmed') {
      return 'accepted'
    }
    return status || 'pending'
  }

  private async getAvatarTableColumns(): Promise<Set<string>> {
    if (this.avatarColumnsCache) {
      return this.avatarColumnsCache
    }

    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'avatars'
    `)

    this.avatarColumnsCache = new Set(
      (rows || [])
        .map((row: any) => String(row.columnName || row.COLUMN_NAME || row.column_name || '').toLowerCase())
        .filter(Boolean)
    )

    return this.avatarColumnsCache
  }

  private buildHostedColumnChecks(columnExpression: string): string[] {
    return [
      `${columnExpression} = 1`,
      `${columnExpression} = true`,
      `${columnExpression} = '1'`,
      `${columnExpression} = 'true'`
    ]
  }

  private async buildHostedWhereClause(alias?: string): Promise<string> {
    const columns = await this.getAvatarTableColumns()
    const prefix = alias ? `${alias}.` : ''
    const conditions: string[] = []

    if (columns.has('is_hosted')) {
      conditions.push(...this.buildHostedColumnChecks(`${prefix}is_hosted`))
    }

    if (columns.has('trust_enabled')) {
      conditions.push(...this.buildHostedColumnChecks(`${prefix}trust_enabled`))
    }

    if (columns.has('hosting_enabled')) {
      conditions.push(...this.buildHostedColumnChecks(`${prefix}hosting_enabled`))
    }

    if (conditions.length === 0) {
      this.logger.warn('avatars 表缺少 is_hosted / trust_enabled 字段，自动派单将返回空结果')
      return '1 = 0'
    }

    return `(${conditions.join(' OR ')})`
  }

  async createDispatchRequest(data: {
    order_id: string
    avatar_id: string
    user_id: string
    platform: string
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      user_id: data.user_id,
      platform: data.platform,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getDispatchRequests(orderId: string) {
    const db = getMySQLClient()
    return await db.query('order_dispatch_requests', { order_id: orderId }) as any
  }

  async updateDispatchStatus(dispatchId: string, status: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('order_dispatch_requests', { id: dispatchId }, {
      status,
      updated_at: new Date()
    })
    
    return { success: true }
  }

  async getUserPendingRequests(userId: string) {
    const db = getMySQLClient()
    // 查询分派给当前用户分身的待接订单，关联订单表获取完整信息
    const requests = await db.query(
      `SELECT r.id as dispatch_id, r.order_id, r.avatar_id, r.status as dispatch_status,
              o.title, o.description, o.content_type, o.platforms, o.budget,
              o.status as order_status, o.quantity_per_avatar, o.expected_quantity,
              o.created_at as order_created_at, o.target_audience, o.deadline,
              o.priority, o.requirements,
              o.preferred_styles, o.industry_tags,
              a.name as avatar_name, a.content_styles, a.niche_tags, a.skills
       FROM order_dispatch_requests r
       LEFT JOIN orders o ON r.order_id = o.id
       LEFT JOIN avatars a ON r.avatar_id = a.id
       WHERE r.user_id = ? AND r.status = 'pending'
       ORDER BY r.created_at DESC`, [userId]) as any[]

    // 计算每个请求的匹配度
    return requests.map(req => {
      const { score, details } = this.calculateMatchScore(req, req)
      return {
        ...req,
        matchScore: score,
        matchDetails: details,
      }
    })
  }

  /**
   * 计算分身与订单的匹配度（三维匹配：技能 + 风格 + 领域）
   * 返回 0-100 的匹配分数
   */
  private calculateMatchScore(avatar: any, order: any): { score: number; details: { skillScore: number; styleScore: number; nicheScore: number } } {
    const details = { skillScore: 0, styleScore: 0, nicheScore: 0 }

    // 解析分身的 content_styles 和 niche_tags
    const avatarStyles: string[] = this.safeParseJson(avatar.content_styles || avatar.contentStyles, [])
    const avatarNiches: string[] = this.safeParseJson(avatar.niche_tags || avatar.nicheTags, [])
    const avatarSkills: string[] = this.safeParseJson(avatar.skills, [])

    // 解析订单的 preferred_styles 和 industry_tags
    const orderStyles: string[] = this.safeParseJson(order.preferred_styles || order.preferredStyles, [])
    const orderNiches: string[] = this.safeParseJson(order.industry_tags || order.industryTags, [])
    
    // 订单的 content_type 和 platforms 也作为技能匹配依据
    const orderContentType = (order.content_type || order.contentType || '').toLowerCase()
    const orderPlatforms: string[] = this.safeParseJson(order.platforms, [])

    // 维度一：技能匹配（权重40%）
    // 根据订单内容类型和平台推断需要的技能
    const requiredSkills: string[] = []
    if (orderContentType.includes('text') || orderContentType.includes('文案')) requiredSkills.push('content_writing')
    if (orderContentType.includes('image') || orderContentType.includes('图文')) requiredSkills.push('image_generation')
    if (orderContentType.includes('video') || orderContentType.includes('视频')) requiredSkills.push('video_generation')
    if (orderPlatforms.some(p => p.includes('douyin') || p.includes('tiktok'))) requiredSkills.push('video_generation', 'content_writing')
    if (orderPlatforms.some(p => p.includes('xiaohongshu') || p.includes('redbook'))) requiredSkills.push('image_generation', 'content_writing')
    if (orderPlatforms.some(p => p.includes('wechat') || p.includes('朋友圈'))) requiredSkills.push('content_writing')

    if (requiredSkills.length > 0) {
      const matchedSkills = requiredSkills.filter(s => avatarSkills.includes(s))
      details.skillScore = Math.round((matchedSkills.length / requiredSkills.length) * 40)
    } else {
      // 没有明确技能要求时，有技能的分身基础分更高
      details.skillScore = avatarSkills.length > 0 ? 20 : 10
    }

    // 维度二：风格匹配（权重30%）
    if (orderStyles.length > 0 && avatarStyles.length > 0) {
      const matchedStyles = orderStyles.filter(s => avatarStyles.includes(s))
      details.styleScore = Math.round((matchedStyles.length / orderStyles.length) * 30)
    } else if (orderStyles.length > 0) {
      // 订单有风格要求但分身没设风格，给一半分
      details.styleScore = 15
    } else {
      // 订单无风格要求，不扣分
      details.styleScore = 30
    }

    // 维度三：领域匹配（权重30%）
    if (orderNiches.length > 0 && avatarNiches.length > 0) {
      const matchedNiches = orderNiches.filter(n => avatarNiches.includes(n))
      details.nicheScore = Math.round((matchedNiches.length / orderNiches.length) * 30)
    } else if (orderNiches.length > 0) {
      // 订单有领域要求但分身没设领域，给一半分
      details.nicheScore = 15
    } else {
      // 订单无领域要求，不扣分
      details.nicheScore = 30
    }

    const score = Math.min(100, details.skillScore + details.styleScore + details.nicheScore)
    return { score, details }
  }

  private safeParseJson<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (Array.isArray(value)) return value as T
    if (typeof value === 'object') return value as T
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T
      } catch {
        return fallback
      }
    }
    return fallback
  }

  /**
   * 获取推荐分身列表（三维匹配：技能+风格+领域，按匹配度排序）
   */
  async getRecommendedAvatars(orderId: string, limit: number = 0) {
    const db = getMySQLClient()
    const hostedWhereClause = await this.buildHostedWhereClause()

    // 查询开启托管的分身
    let sql = `SELECT * FROM avatars WHERE ${hostedWhereClause} AND status = ? ORDER BY updated_at DESC`
    if (limit > 0) {
      sql += ` LIMIT ${parseInt(String(limit)) * 3}`  // 取3倍数量用于匹配筛选
    }
    
    const result = await db.query(sql, ['active'])
    const avatars = Array.isArray(result) ? result : (result?.data || [])

    // 如果有订单ID，尝试获取订单信息进行匹配排序
    if (orderId) {
      try {
        const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]) as any[]
        const order = orders?.[0]
        
        if (order) {
          // 计算每个分身的匹配分数
          const scoredAvatars = avatars.map(avatar => {
            const { score, details } = this.calculateMatchScore(avatar, order)
            return { ...avatar, matchScore: score, matchDetails: details }
          })

          // 按匹配分数降序排序
          scoredAvatars.sort((a, b) => b.matchScore - a.matchScore)
          
          // 返回指定数量
          return limit > 0 ? scoredAvatars.slice(0, limit) : scoredAvatars
        }
      } catch (err) {
        this.logger.warn('匹配排序失败，使用默认排序:', err)
      }
    }
    
    return avatars
  }

  /**
   * 订单分配（只分配给开启托管的分身）
   */
  async dispatchOrder(orderId: string) {
    const db = getMySQLClient()
    
    // 查询开启托管的分身
    const avatars = await this.getRecommendedAvatars(orderId, 1)
    
    if (avatars.length === 0) {
      return null
    }
    
    const avatar = avatars[0]
    
    // 创建分发请求
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: orderId,
      avatar_id: avatar.id,
      user_id: avatar.userId || avatar.user_id,
      platform: 'auto',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { avatar_id: avatar.id, avatar_name: avatar.name }
  }

async getExecutionProgress(orderId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { order_id: orderId }) as any[]
    return requests
  }

  async getDispatchStatus(orderId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { order_id: orderId }) as any[]
    const normalizedStatuses = requests.map((request) => this.normalizeDispatchStatus(request.status))
    const acceptedCount = normalizedStatuses.filter((status) => status === 'accepted').length

    return {
      total: requests.length,
      pending: normalizedStatuses.filter((status) => status === 'pending').length,
      accepted: acceptedCount,
      confirmed: acceptedCount,
      rejected: normalizedStatuses.filter((status) => status === 'rejected').length
    }
  }

  async dispatchToAvatar(orderId: string, avatarId: string) {
    const db = getMySQLClient()
    
    // 查询分身
    const avatars = await db.query('SELECT * FROM avatars WHERE id = ?', [avatarId]) as any[]
    if (avatars.length === 0) {
      throw new Error('分身不存在')
    }
    
    const avatar = avatars[0]
    
    // 创建分发请求
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: orderId,
      avatar_id: avatarId,
      user_id: avatar.userId || avatar.user_id,
      platform: 'manual',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { avatar_id: avatarId }
  }

  async getRequestById(requestId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { id: requestId }) as any[]
    return requests[0] || null
  }

  async confirmDispatch(requestId: string, avatarId: string) {
    const db = getMySQLClient()
    await db.updateWhere('order_dispatch_requests', { id: requestId }, {
      status: 'accepted',
      updated_at: new Date()
    })
    return { success: true }
  }

  async rejectDispatch(requestId: string, avatarId: string) {
    const db = getMySQLClient()
    await db.update('order_dispatch_requests', { status: 'rejected' }, { id: requestId })
    return { success: true }
  }

  /**
   * 一键分配订单给所有可用分身
   */
  async dispatchToAllAvatars(orderId: string) {
    const db = getMySQLClient()
    
    // 查询订单信息
    const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]) as any[]
    const order = orders[0]
    
    if (!order) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }
    
    // 获取订单需要的分身数量
    const requiredCount = order.expectedQuantity || order.expected_quantity || order.avatarCount || order.avatar_count || 1
    
    // 查询所有开启托管的分身，并关联用户表获取手机号
    // 兼容 is_hosted / trust_enabled，且兼容字符串/数字布尔值
    const hostedWhereClause = await this.buildHostedWhereClause('a')
    const allAvatars = await db.query(`
      SELECT a.*, u.phone AS user_phone 
      FROM avatars a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE ${hostedWhereClause} AND a.status = ?`, 
      ['active']
    ) as any[]
    
    // 三维匹配排序：技能 + 风格 + 领域
    const scoredAvatars = allAvatars.map(avatar => {
      const { score, details } = this.calculateMatchScore(avatar, order)
      return { ...avatar, matchScore: score, matchDetails: details }
    })
    scoredAvatars.sort((a, b) => b.matchScore - a.matchScore)
    
    // 只取订单需要的数量（优先匹配度最高的）
    const avatars = scoredAvatars.slice(0, requiredCount)
    
    if (avatars.length === 0) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }
    
    const avatarIds: string[] = []
    let smsSentCount = 0
    
    // 为每个分身创建分发请求并发送短信
    for (const avatar of avatars) {
      const id = crypto.randomUUID()
      await db.insert('order_dispatch_requests', {
        id,
        order_id: orderId,
        avatar_id: avatar.id,
        user_id: avatar.userId || avatar.user_id || avatar.userPhone,
        platform: 'auto',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      })
      avatarIds.push(avatar.id)
      
      // 发送真实短信通知 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone || avatar.user_phone
      console.log('[dispatchToAllAvatars] 分身手机号检查:', avatar.name, avatar.user_phone, avatar.phone, userPhone)
      if (userPhone) {
        const smsContent = `${order?.title || '内容创作'}`
        
        try {
          const smsResult = await this.smsService.sendSms(
            userPhone,
            'SMS_505555078',
            { name: avatar.name }
          )
          
          if (smsResult) {
            smsSentCount++
            console.log(`[SMS] 成功发送给分身 ${avatar.name} (用户手机: ${userPhone})`)
          }
        } catch (err) {
          console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
        }
        
        // 创建通知记录
        const notifId = crypto.randomUUID()
        await db.insert('avatar_notifications', {
          id: notifId,
          avatar_id: avatar.id,
          order_id: orderId,
          type: 'order_assigned',
          title: '新订单分配',
          content: smsContent,
          status: 'unread',
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    }
    
    // 为用户创建通知（记录分配成功）
    if (avatars.length > 0) {
      try {
        await this.notificationService.createNotification({
          user_id: order.user_id,
          type: 'order_dispatched',
          title: '订单已分配',
          content: `已将订单"${order.title || '内容创作'}"分配给 ${avatars.length} 个分身，已发送短信通知。`,
          metadata: {
            orderId,
            avatarIds,
            count: avatars.length
          }
        })
      } catch (err) {
        console.error('[dispatchToAllAvatars] 创建用户通知失败:', err)
      }
    }
    
    return { count: avatars.length, avatarIds, smsSentCount }
  }

  /**
   * 分身接受订单
   */
  async acceptOrder(avatarId: string, orderId: string) {
    const db = getMySQLClient()
    
    let request: any = null

    // 尝试从 order_dispatch_requests 查找 pending 的分派记录
    if (!avatarId || avatarId === 'undefined') {
      const requests = await db.query(`
        SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
        FROM order_dispatch_requests r 
        LEFT JOIN orders o ON r.order_id = o.id 
        WHERE r.order_id = ? AND r.status = 'pending' 
        LIMIT 1`, 
        [orderId]
      ) as any[]
      request = requests?.[0]
    } else {
      const requests = await db.query(`
        SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
        FROM order_dispatch_requests r 
        LEFT JOIN orders o ON r.order_id = o.id 
        WHERE r.avatar_id = ? AND r.order_id = ? AND r.status = 'pending'`, 
        [avatarId, orderId]
      ) as any[]
      request = requests?.[0]
    }

    // 如果没有分派记录，尝试直接从 orders 表查找可接单的订单，自动创建分派记录
    if (!request) {
      console.log(`[acceptOrder] 无分派记录，尝试直接从 orders 查找: orderId=${orderId}, avatarId=${avatarId}`)
      const orders = await db.query(`
        SELECT id, title, user_id as owner_user_id, description, platforms, budget, expected_quantity, quantity_per_avatar, target_audience, status
        FROM orders WHERE id = ?`, 
        [orderId]
      ) as any[]
      const order = orders?.[0]
      
      if (!order) {
        throw new Error('订单不存在')
      }
      
      // 检查订单状态是否允许接单
      const acceptablStatuses = ['pending', 'pending_payment', 'open', 'created', 'assigned']
      if (!acceptablStatuses.includes(order.status)) {
        throw new Error(`订单已${order.status === 'in_progress' ? '进行中' : order.status === 'completed' ? '完成' : '处理'}, 无法接单`)
      }

      // 自动创建分派记录
      const dispatchId = 'odr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
      const insertResult = await db.insert('order_dispatch_requests', {
        id: dispatchId,
        order_id: orderId,
        avatar_id: avatarId || null,
        user_id: order.owner_user_id || null,
        platform: Array.isArray(order.platforms) ? order.platforms[0] : (order.platforms || 'general'),
        status: 'pending',
      })
      
      if (insertResult.error) {
        console.error('[acceptOrder] 创建分派记录失败:', insertResult.error)
        throw new Error('创建分派记录失败: ' + (insertResult.error.message || JSON.stringify(insertResult.error)))
      }
      console.log(`[acceptOrder] 自动创建分派记录成功: ${dispatchId}`)

      // 用订单数据构造 request 对象（避免重新查询的延迟问题）
      request = {
        id: dispatchId,
        order_id: orderId,
        avatar_id: avatarId || null,
        user_id: order.owner_user_id || null,
        platform: Array.isArray(order.platforms) ? order.platforms[0] : (order.platforms || 'general'),
        status: 'pending',
        order_title: order.title,
        owner_user_id: order.owner_user_id,
        description: order.description,
        platforms: order.platforms,
        budget: order.budget,
        expected_quantity: order.expected_quantity,
        quantity_per_avatar: order.quantity_per_avatar,
        target_audience: order.target_audience,
      }
    }
    
    // 使用实际的 avatarId（可能是自动选择的）
    const actualAvatarId = request.avatar_id || request.avatarId || avatarId
    
    // 更新状态为 accepted
    await db.updateWhere('order_dispatch_requests', { id: request.id }, {
      status: 'accepted',
      updated_at: new Date()
    })
    
    // 更新订单状态为 in_progress
    await db.updateWhere('orders', { id: orderId }, {
      status: 'in_progress',
      updated_at: new Date()
    })
    
    // 为订单所有者创建通知（分身接受了订单）
    try {
      await this.notificationService.createNotification({
        user_id: request.owner_user_id,
        type: 'avatar_accepted_order',
        title: '分身已接受订单',
        content: `分身"${request.avatar_name || '未知'}"已接受订单"${request.order_title || '内容创作'}"`,
        metadata: {
          avatarId: actualAvatarId,
          orderId,
          dispatchRequestId: request.id
        }
      })
    } catch (err) {
      console.error('[acceptOrder] 创建通知失败:', err)
    }
    
    // 自动启动内容生成流程（异步执行，不阻塞返回）
    this.startContentGeneration(orderId, actualAvatarId, request).catch(err => {
      console.error('[acceptOrder] 启动内容生成失败:', err)
    })

    const processingRecord = await this.waitForProcessingRecord(orderId, actualAvatarId)
    
    return {
      success: true,
      orderId,
      avatarId: actualAvatarId,
      dispatchId: request.id,
      requestId: processingRecord?.id || processingRecord?.requestId || '',
    }
  }

  private async waitForProcessingRecord(orderId: string, avatarId: string): Promise<any | null> {
    const db = getMySQLClient()
    const maxAttempts = 5

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rows = await db.query(
        `SELECT id, order_id, avatar_id
         FROM content_generation_requests
         WHERE order_id = ? AND avatar_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId, avatarId]
      ) as any[]

      if (rows?.[0]) {
        return rows[0]
      }

      await new Promise((resolve) => setTimeout(resolve, 150))
    }

    return null
  }

  /**
   * 分身婉拒订单
   */
  async declineOrder(dispatchId: string) {
    const db = getMySQLClient()
    
    // 查找分派记录
    const requests = await db.query(
      'SELECT * FROM order_dispatch_requests WHERE id = ?',
      [dispatchId]
    ) as any[]
    const request = requests?.[0]
    
    if (!request) {
      throw new Error('分派记录不存在')
    }
    
    // 更新状态为 declined
    await db.updateWhere('order_dispatch_requests', { id: dispatchId }, {
      status: 'declined',
      updated_at: new Date()
    })
    
    console.log(`[declineOrder] 已婉拒: dispatchId=${dispatchId}`)
    return { success: true }
  }

  /**
   * 启动内容生成流程
   */
  private async startContentGeneration(orderId: string, avatarId: string, request: any) {
    try {
      const order = await this.getOrderById(orderId)
      if (!order) {
        console.warn(`[startContentGeneration] 订单不存在: ${orderId}`)
        return
      }

      const platforms = order.platforms ? JSON.parse(order.platforms) : ['wechat']
      const normalizedPlatforms = platforms.map((p: string) => p === 'general' ? 'wechat' : p)

      // 调用内容生成服务
      await this.contentGenerationService.generateContent({
        orderId,
        avatarId,
        orderTitle: request.order_title || order.title || '内容生成',
        orderDescription: request.description || order.description || '',
        platforms: normalizedPlatforms,
        contentType: 'image_text',
        targetAudience: request.target_audience || order.target_audience || '年轻用户',
        contentQuantity: request.quantity_per_avatar || request.expected_quantity || order.quantity_per_avatar || order.expected_quantity || 3
      })

      console.log(`[startContentGeneration] 内容生成已启动: orderId=${orderId}, avatarId=${avatarId}`)
    } catch (err) {
      console.error('[startContentGeneration] 生成失败:', err)
    }
  }

  /**
   * 根据订单ID获取订单信息
   */
  private async getOrderById(orderId: string): Promise<any | null> {
    const db = getMySQLClient()
    const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]) as any[]
    return orders?.[0] || null
  }

  /**
   * 取消订单分配
   */
  async cancelDispatch(orderId: string) {
    const db = getMySQLClient()
    
    // 更新所有未处理的分发请求为已取消
    await db.updateWhere('order_dispatch_requests', { order_id: orderId, status: 'pending' }, {
      status: 'cancelled',
      updated_at: new Date()
    })
    
    return { success: true }
  }

  /**
   * 获取分身已接受的订单列表
   */
  async getAvatarAcceptedOrders(avatarId: string) {
    const db = getMySQLClient()
    
    const results = await db.query(`
      SELECT r.*, o.title, o.status as order_status, o.budget, o.created_at as order_created_at
      FROM order_dispatch_requests r
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE r.avatar_id = ? AND r.status = 'accepted'
      ORDER BY r.updated_at DESC
    `, [avatarId]) as any[]
    
    return results
  }

  /**
   * 获取用户所有已接受的订单（通过分身）
   */
  async getUserAcceptedOrders(userId: string) {
    const db = getMySQLClient()
    
    const results = await db.query(`
      SELECT r.*, o.title, o.status as order_status, o.budget, o.created_at as order_created_at, a.name as avatar_name
      FROM order_dispatch_requests r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN avatars a ON r.avatar_id = a.id
      WHERE r.user_id = ? AND r.status = 'accepted'
      ORDER BY r.updated_at DESC
    `, [userId]) as any[]
    
    return results
  }

  /**
   * 检查订单是否已被任何分身接受
   */
  async hasAcceptedRequest(orderId: string): Promise<boolean> {
    const db = getMySQLClient()
    
    const requests = await db.query(`
      SELECT COUNT(*) as count 
      FROM order_dispatch_requests 
      WHERE order_id = ? AND status = 'accepted'
    `, [orderId]) as any[]
    
    return requests[0]?.count > 0
  }

  /**
   * 获取订单的所有接受者分身
   */
  async getOrderAcceptors(orderId: string) {
    const db = getMySQLClient()
    
    const results = await db.query(`
      SELECT a.*, r.id as dispatch_request_id
      FROM order_dispatch_requests r
      LEFT JOIN avatars a ON r.avatar_id = a.id
      WHERE r.order_id = ? AND r.status = 'accepted'
    `, [orderId]) as any[]
    
    return results
  }

  /**
   * 发送短信通知给指定分身
   */
  async notifyAvatars(orderId: string, avatarIds: string[], customMessage?: string) {
    const db = getMySQLClient()
    
    // 查询订单信息
    const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]) as any[]
    const order = orders[0]
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    let notifiedCount = 0
    let smsSentCount = 0
    
    // 为每个分身创建通知并发送短信
    for (const avatarId of avatarIds) {
      // 查询分身信息，并关联用户表获取手机号
      const avatars = await db.query(`
        SELECT a.*, u.phone AS user_phone 
        FROM avatars a 
        LEFT JOIN users u ON a.user_id = u.id 
        WHERE a.id = ?`, [avatarId]) as any[]
      const avatar = avatars[0]
      
      if (!avatar) continue
      
      // 生成通知内容
      const message = customMessage || `您有新的订单任务：${order.title || '内容创作'}，请及时查收并完成。`
      const smsContent = `【莫瑞拉】${message}`
      
      // 创建通知记录
      const id = crypto.randomUUID()
      await db.insert('avatar_notifications', {
        id,
        avatar_id: avatarId,
        order_id: orderId,
        type: 'order_assigned',
        title: '新订单分配',
        content: message,
        status: 'unread',
        created_at: new Date(),
        updated_at: new Date()
      })
      
      // 发送真实短信 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone || avatar.user_phone
      console.log('[dispatchToAllAvatars] 分身手机号检查:', avatar.name, avatar.user_phone, avatar.phone, userPhone)
      if (userPhone) {
        try {
          const smsResult = await this.smsService.sendSms(
            userPhone,
            'SMS_505555078',
            { name: avatar.name }
          )
          
          if (smsResult) {
            smsSentCount++
            console.log(`[SMS] 通知短信发送给 ${avatar.name} (用户手机: ${userPhone}) 成功`)
          }
        } catch (err) {
          console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
        }
      } else {
        console.log(`[SMS] 分身 ${avatar.name} 的账号未绑定手机号，跳过短信发送`)
      }
      
      notifiedCount++
    }
    
    return { count: notifiedCount, smsSentCount }
  }
}
