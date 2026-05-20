// @ts-nocheck
import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import { SmsService } from '../sms/sms.service'
import { NotificationService } from '../notification/notification.service'
import { OrderService } from '../order/order.service'
import { ContentGenerationService } from '../content-generation/content-generation.service'
import { OrderEventService } from './order-event.service'

@Injectable()
export class OrderDispatchService {
  private readonly logger = new Logger(OrderDispatchService.name)
  private avatarColumnsCache: Set<string> | null = null

  constructor(
    @Inject(forwardRef(() => SmsService)) private readonly smsService: SmsService,
    @Inject(forwardRef(() => NotificationService)) private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ContentGenerationService)) private readonly contentGenerationService: ContentGenerationService,
    @Inject(forwardRef(() => OrderService)) private readonly orderService: OrderService,
    @Inject(forwardRef(() => OrderEventService)) private readonly eventService: OrderEventService,
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
    const colRows = await db.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'avatars'
    `)

    this.avatarColumnsCache = new Set(
      (colRows || [])
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
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30分钟内必须接单
    await db.insert('order_dispatch_requests', {
      id,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      user_id: data.user_id,
      platform: data.platform,
      status: 'pending',
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getDispatchRequests(orderId: string) {
    const db = getMySQLClient()
    return await db.query('order_dispatch_requests', { order_id: orderId }) as any
  }

  async updateDispatchStatus(dispatchId: string, status: string, rejectReason?: string) {
    const db = getMySQLClient()
    
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date()
    }
    if (status === 'accepted' || status === 'rejected') {
      updateData.responded_at = new Date()
    }
    if (rejectReason) {
      updateData.reject_reason = rejectReason
    }
    
    await db.updateWhere('order_dispatch_requests', { id: dispatchId }, updateData)
    
    return { success: true }
  }

  async getUserPendingRequests(userId: string) {
    const db = getMySQLClient()
    // 查询分派给当前用户分身的待接订单，关联订单表获取完整信息
    // 关键修复：用 INNER JOIN 确保只返回分身仍然存在的记录（LEFT JOIN 会导致已删分身仍显示）
    const requestRows = await db.query(
      `SELECT r.id as dispatch_id, r.order_id, r.avatar_id, r.status as dispatch_status,
              r.expires_at, r.created_at as dispatch_created_at,
              o.title, o.description, o.content_type, o.platforms, o.budget,
              o.status as order_status, o.quantity_per_avatar, o.expected_quantity,
              o.created_at as order_created_at, o.target_audience, o.deadline,
              o.priority, o.requirements,
              o.preferred_styles, o.industry_tags,
              a.name as avatar_name, a.content_styles, a.niche_tags, a.skills
       FROM order_dispatch_requests r
       INNER JOIN avatars a ON r.avatar_id = a.id AND a.status = 'active'
       INNER JOIN orders o ON r.order_id = o.id AND o.status IN ('pending', 'pending_payment', 'awaiting_acceptance', 'pending_acceptance', 'accepted', 'in_progress')
       WHERE r.user_id = ? AND r.status = 'pending'
       ORDER BY r.created_at DESC`, [userId])
    const requests = requestRows || []

    // 批量获取所有相关分身的技能（从 avatar_skills 表）
    const avatarIds = [...new Set(requests.map((r: any) => r.avatar_id).filter(Boolean))]
    const skillsMap = new Map<string, string[]>()
    if (avatarIds.length > 0) {
      const skillRows = await db.query(
        `SELECT s.avatar_id, s.skill_id FROM avatar_skills s WHERE s.avatar_id IN (?)`,
        [avatarIds]
      )
      for (const sr of (skillRows || [])) {
        const aid = sr.avatarId
        if (!skillsMap.has(aid)) skillsMap.set(aid, [])
        skillsMap.get(aid)!.push(sr.skill_id)
      }
    }

    // 计算每个请求的匹配度 + 预期收益
    return requests.map(req => {
      // 注入 avatar_skills 表的技能数据
      req._skillsFromTable = skillsMap.get(req.avatarId) || []
      const { score, details } = this.calculateMatchScore(req, req)
      // 预期收益 = 总预算 / 期望分身数
      const budget = Number(req.budget || 0)
      const expectedQuantity = Number(req.expectedQuantity || req.expected_quantity || 1)
      const expectedEarnings = expectedQuantity > 0 ? Math.round(budget / expectedQuantity * 100) / 100 : budget
      return {
        ...req,
        matchScore: score,
        matchDetails: details,
        expectedEarnings,
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
    const avatarStyles: string[] = this.safeParseJson(avatar.contentStyles, [])
    const avatarNiches: string[] = this.safeParseJson(avatar.nicheTags, [])
    // 优先使用 avatar_skills 表的技能数据，fallback 到 avatars.skills 字段
    const avatarSkills: string[] = (avatar._skillsFromTable && avatar._skillsFromTable.length > 0)
      ? avatar._skillsFromTable
      : this.safeParseJson(avatar.skills, [])

    // 解析订单的 preferred_styles 和 industry_tags
    const orderStyles: string[] = this.safeParseJson(order.preferredStyles, [])
    const orderNiches: string[] = this.safeParseJson(order.industryTags, [])
    
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
    if (typeof value === 'object') {
      // 如果期望数组但得到的是对象（如 {}），返回 fallback
      if (Array.isArray(fallback) && !Array.isArray(value)) return fallback
      return value as T
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        // 解析后再次校验：期望数组但解析结果不是数组（如 JSON.parse("{}") → {}），返回 fallback
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback
        return parsed as T
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

    // 查询开启托管的活跃分身
    let sql = `SELECT * FROM avatars WHERE ${hostedWhereClause} AND status = 'active' ORDER BY updated_at DESC`
    if (limit > 0) {
      sql += ` LIMIT ${parseInt(String(limit)) * 3}`  // 取3倍数量用于匹配筛选
    }
    
    const resultRows = await db.query(sql)
    const avatars = resultRows || []

    const avatarIds = [...new Set(avatars.map((a: any) => a.id).filter(Boolean))]
    const skillsMap = new Map<string, string[]>()
    if (avatarIds.length > 0) {
      try {
        const skillRows = await db.query(
          `SELECT s.avatar_id, s.skill_id FROM avatar_skills s WHERE s.avatar_id IN (?)`,
          [avatarIds]
        )
        for (const sr of (skillRows || [])) {
          const aid = sr.avatarId || sr.avatar_id
          if (!aid) continue
          if (!skillsMap.has(aid)) skillsMap.set(aid, [])
          skillsMap.get(aid)!.push(sr.skillId || sr.skill_id)
        }
      } catch (err) {
        this.logger.warn('读取 avatar_skills 失败，回退使用 avatars.skills 字段:', err)
      }
    }

    const readyAvatars = avatars.map((avatar: any) => {
        avatar._skillsFromTable = skillsMap.get(avatar.id) || []
        return avatar
      })

    const dispatchStatsMap = new Map<string, { total: number; accepted: number; expired: number }>()
    const readyAvatarIds = [...new Set(readyAvatars.map((a: any) => a.id).filter(Boolean))]
    if (readyAvatarIds.length > 0) {
      try {
        const rows = await db.query(
          `SELECT COALESCE(od.avatar_id, od.target_avatar_id) as avatar_id,
                  COUNT(*) as total,
                  SUM(CASE WHEN od.status IN ('accepted', 'confirmed') THEN 1 ELSE 0 END) as accepted,
                  SUM(CASE WHEN od.status = 'expired' THEN 1 ELSE 0 END) as expired
           FROM order_dispatch_requests od
           WHERE COALESCE(od.avatar_id, od.target_avatar_id) IN (?)
             AND od.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY COALESCE(od.avatar_id, od.target_avatar_id)`,
          [readyAvatarIds]
        )
        for (const r of (rows || [])) {
          const id = r.avatarId || r.avatar_id
          if (!id) continue
          dispatchStatsMap.set(id, {
            total: Number(r.total || 0),
            accepted: Number(r.accepted || 0),
            expired: Number(r.expired || 0),
          })
        }
      } catch (err) {
        this.logger.warn('读取派单统计失败，跳过派单权重:', err)
      }
    }

    // 如果有订单ID，尝试获取订单信息进行匹配排序
    if (orderId) {
      try {
        const orderRows2 = await db.query('SELECT * FROM orders WHERE id = ?', [orderId])
        const order = orderRows2?.[0]
        
        if (order) {
          // 计算每个分身的匹配分数
          const scoredAvatars = readyAvatars.map(avatar => {
            const { score, details } = this.calculateMatchScore(avatar, order)
            const stats = dispatchStatsMap.get(avatar.id) || { total: 0, accepted: 0, expired: 0 }
            const rate = stats.total > 0 ? stats.accepted / stats.total : 0
            const baseScore = score
            let bonus = 0
            if (stats.total >= 5 && rate >= 0.8) bonus = 5
            if (stats.total >= 5 && rate <= 0.3) bonus = -10
            const finalScore = Math.max(0, Math.min(100, baseScore + bonus))
            return {
              ...avatar,
              matchScoreBase: baseScore,
              matchScore: finalScore,
              matchDetails: details,
              dispatchStats: { ...stats, acceptanceRate: rate }
            }
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
    
    return readyAvatars
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
      user_id: avatar.userId,
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
      completed: normalizedStatuses.filter((status) => status === 'completed').length,
      rejected: normalizedStatuses.filter((status) => status === 'rejected').length
    }
  }

  async dispatchToAvatar(orderId: string, avatarId: string) {
    const db = getMySQLClient()
    
    // 查询分身（必须是活跃状态）
    const avatars = await db.query('SELECT * FROM avatars WHERE id = ? AND status = \'active\'', [avatarId]) as any[]
    if (avatars.length === 0) {
      throw new Error('分身不存在或已失效')
    }
    
    const avatar = avatars[0]
    
    // 创建分发请求
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: orderId,
      avatar_id: avatarId,
      user_id: avatar.userId,
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
    const orderRows = await db.query('SELECT * FROM orders WHERE id = ?', [orderId])
    const order = orderRows?.[0]
    
    if (!order) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }
    
    // 获取订单需要的分身数量
    const requiredCount = order.expectedQuantity || order.expected_quantity || order.avatarCount || 1
    console.log(`[dispatchToAllAvatars] 订单需要分身数量: expectedQuantity=${order.expectedQuantity}, expected_quantity=${order.expected_quantity}, requiredCount=${requiredCount}`)
    
    // 查询所有开启托管的活跃分身，并关联用户表获取手机号
    // 关键修复：确保 a.status = 'active' 过滤已删除/训练中分身
    const allAvatarRows = await db.query(`
      SELECT a.*, u.phone AS user_phone 
      FROM avatars a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE a.is_hosted = 1 AND a.status = 'active'`)
    
    const allAvatars = allAvatarRows || []

    // 从 avatar_skills 表获取分身技能（不依赖 avatars.skills 字段，该字段可能为空对象{}）
    const avatarIdsList = allAvatars.map(a => a.id || a.avatarId)
    const avatarSkillsMap: Record<string, string[]> = {}
    if (avatarIdsList.length > 0) {
      const skillRows = await db.query(
        `SELECT as2.avatar_id, as2.skill_id FROM avatar_skills as2 WHERE as2.avatar_id IN (?)`,
        [avatarIdsList]
      ) as any[]
      for (const sr of skillRows) {
        const aid = sr.avatarId || sr.avatarId
        if (!avatarSkillsMap[aid]) avatarSkillsMap[aid] = []
        avatarSkillsMap[aid].push(sr.skillId || sr.skill_id)
      }
    }
    
    // 三维匹配排序：技能 + 风格 + 领域
    const scoredAvatars = allAvatars.map(avatar => {
      // 优先使用 avatar_skills 表的技能，fallback 到 avatars.skills 字段
      const aid = avatar.id || avatar.avatarId
      const skillsFromTable = avatarSkillsMap[aid] || []
      const avatarWithSkills = { ...avatar, _skillsFromTable: skillsFromTable }
      const { score, details } = this.calculateMatchScore(avatarWithSkills, order)
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
      
      // 检查该分身是否已经有派单记录（防止重复派单）
      const existingDispatchRows = await db.query(
        'SELECT id FROM order_dispatch_requests WHERE order_id = ? AND avatar_id = ?',
        [orderId, avatar.id]
      )
      if (existingDispatchRows && existingDispatchRows.length > 0) {
        console.log(`[dispatchToAllAvatars] 分身 ${avatar.name} 已有派单记录，跳过`)
        continue
      }
      
      const insertResult = await db.insert('order_dispatch_requests', {
        id,
        order_id: orderId,
        avatar_id: avatar.id,
        user_id: avatar.userId || avatar.userPhone,
        platform: 'auto',
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date()
      })
      if (insertResult.error) {
        console.error('[dispatchToAllAvatars] 创建派发记录失败:', insertResult.error)
        continue
      }
      avatarIds.push(avatar.id)
      
      // 📌 记录事件：已派单
      this.eventService.recordEvent({
        orderId,
        dispatchId: id,
        avatarId: avatar.id,
        userId: avatar.userId,
        eventType: 'dispatched',
        source: 'system',
        avatarName: avatar.name,
        eventData: { matchScore: avatar.matchScore, matchDetails: avatar.matchDetails },
      }).catch(err => console.warn('[事件] dispatched 记录失败:', err.message))
      
      // 发送真实短信通知 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone
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
        const notifResult = await db.insert('avatar_notifications', {
          id: notifId,
          avatar_id: avatar.id,
          notification_type: 'order_assigned',
          title: '新订单分配',
          content: smsContent,
          is_read: 0,
          data: JSON.stringify({ orderId }),
          created_at: new Date()
        })
        if (notifResult.error) {
          console.error('[dispatchToAllAvatars] 创建分身通知记录失败:', notifResult.error)
        }
      }
    }
    
    // 为用户创建通知（记录分配成功）
    if (avatars.length > 0) {
      try {
        await this.notificationService.createNotification({
          user_id: order.userId,
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
    const pool = getPool()
    const conn = await pool.getConnection()
    let request: any = null
    let actualAvatarId: string | undefined = avatarId
    let requiredCount = 1

    try {
      await conn.beginTransaction()

      const [orderRows] = await conn.query(
        `SELECT id, status,
                GREATEST(COALESCE(NULLIF(avatar_count, 0), NULLIF(expected_quantity, 0), 1), 1) as required_count
         FROM orders
         WHERE id = ?
         FOR UPDATE`,
        [orderId]
      )
      const orderRow: any = (orderRows as any[])?.[0]
      if (!orderRow) {
        throw new Error('订单不存在')
      }

      requiredCount = Number(orderRow.required_count || 1) || 1

      const acceptablStatuses = ['pending', 'pending_payment', 'open', 'created', 'assigned', 'pending_acceptance', 'pending_dispatch']
      if (!acceptablStatuses.includes(orderRow.status)) {
        throw new Error(`订单已${orderRow.status === 'in_progress' ? '进行中' : orderRow.status === 'completed' ? '完成' : '处理'}, 无法接单`)
      }

      if (!avatarId || avatarId === 'undefined') {
        const [acceptRows1] = await conn.query(
          `SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
           FROM order_dispatch_requests r
           LEFT JOIN orders o ON r.order_id = o.id
           WHERE r.order_id = ? AND r.status = 'pending'
           LIMIT 1
           FOR UPDATE`,
          [orderId]
        )
        request = (acceptRows1 as any[])?.[0]
      } else {
        const [acceptRows2] = await conn.query(
          `SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
           FROM order_dispatch_requests r
           LEFT JOIN orders o ON r.order_id = o.id
           WHERE r.avatar_id = ? AND r.order_id = ? AND r.status = 'pending'
           LIMIT 1
           FOR UPDATE`,
          [avatarId, orderId]
        )
        request = (acceptRows2 as any[])?.[0]
        if (request) request._isMatchedAvatar = true
      }

      if (!request && avatarId && avatarId !== 'undefined') {
        const [existingDispatchRows] = await conn.query(
          'SELECT id, status FROM order_dispatch_requests WHERE order_id = ? AND avatar_id = ? LIMIT 1 FOR UPDATE',
          [orderId, avatarId]
        )
        const existingDispatch: any = (existingDispatchRows as any[])?.[0]
        if (existingDispatch) {
          throw new Error(`该分身已接单（状态：${existingDispatch.status}），不能重复接单`)
        }
      }

      if (!request) {
        console.log(`[acceptOrder] 无分派记录，尝试直接从 orders 查找: orderId=${orderId}, avatarId=${avatarId}`)
        const [acceptOrderRows] = await conn.query(
          `SELECT id, title, user_id as owner_user_id, description, platforms, budget, expected_quantity, quantity_per_avatar, target_audience, status
           FROM orders WHERE id = ? FOR UPDATE`,
          [orderId]
        )
        const order: any = (acceptOrderRows as any[])?.[0]
        if (!order) {
          throw new Error('订单不存在')
        }

        const dispatchId = 'odr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
        await conn.query(
          `INSERT INTO order_dispatch_requests (id, order_id, avatar_id, user_id, platform, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
          [
            dispatchId,
            orderId,
            avatarId || null,
            order.owner_user_id || null,
            Array.isArray(order.platforms) ? order.platforms[0] : (order.platforms || 'general'),
          ]
        )

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

      actualAvatarId = request.avatarId || request.avatar_id || avatarId

      if (actualAvatarId) {
        const [avatarCheckRows] = await conn.query('SELECT id, status FROM avatars WHERE id = ? FOR UPDATE', [actualAvatarId])
        const avatarCheck: any = (avatarCheckRows as any[])?.[0]
        if (!avatarCheck || avatarCheck.status !== 'active') {
          throw new Error('分身不存在或已失效，无法接单')
        }
      }

      const [acceptedDistinctRows] = await conn.query(
        `SELECT COUNT(DISTINCT avatar_id) as count
         FROM order_dispatch_requests
         WHERE order_id = ? AND status IN ('accepted', 'completed')
         FOR UPDATE`,
        [orderId]
      )
      const acceptedDistinctCount = Number((acceptedDistinctRows as any[])?.[0]?.count || 0)
      if (acceptedDistinctCount >= requiredCount) {
        throw new Error('订单名额已满')
      }

      await conn.query(
        `UPDATE order_dispatch_requests
         SET status = 'accepted',
             accepted_at = IFNULL(accepted_at, NOW()),
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = ? AND status = 'pending'`,
        [request.id]
      )

      const [acceptedCountRows] = await conn.query(
        `SELECT COUNT(DISTINCT avatar_id) as count
         FROM order_dispatch_requests
         WHERE order_id = ? AND status IN ('accepted', 'completed')
         FOR UPDATE`,
        [orderId]
      )
      const acceptedCount = Number((acceptedCountRows as any[])?.[0]?.count || 0)

      const isMatchedAvatar = request._isMatchedAvatar === true
      const [matchedPendingRows] = await conn.query(
        `SELECT COUNT(*) as count
         FROM order_dispatch_requests
         WHERE order_id = ? AND status = 'pending'
         FOR UPDATE`,
        [orderId]
      )
      const matchedPendingCount = Number((matchedPendingRows as any[])?.[0]?.count || 0)
      const shouldKick = !isMatchedAvatar && (acceptedCount + matchedPendingCount) >= requiredCount
      console.log(`[acceptOrder] 踢人判断: isMatched=${isMatchedAvatar}, accepted=${acceptedCount}, pending=${matchedPendingCount}, required=${requiredCount}, shouldKick=${shouldKick}`)
      if (shouldKick) {
        const [pendingDispatches] = await conn.query(
          `SELECT d.id, d.avatar_id, d.user_id
           FROM order_dispatch_requests d
           WHERE d.order_id = ? AND d.status = 'pending'
           ORDER BY d.created_at ASC
           LIMIT 1
           FOR UPDATE`,
          [orderId]
        )
        const kickedDispatch: any = (pendingDispatches as any[])?.[0]
        if (kickedDispatch) {
          await conn.query(
            `UPDATE order_dispatch_requests
             SET status = 'expired',
                 reject_reason = '订单已被其他分身抢先接单，名额已满',
                 updated_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [kickedDispatch.id]
          )
        }
      }

      if (acceptedCount >= requiredCount) {
        await conn.query(
          `UPDATE orders
           SET status = 'in_progress',
               updated_at = NOW()
           WHERE id = ?`,
          [orderId]
        )
        console.log(`[acceptOrder] 所有分身已接单(${acceptedCount}/${requiredCount})，订单状态更新为 in_progress`)
      }

      await conn.commit()
    } catch (error) {
      try {
        await conn.rollback()
      } catch {}
      throw error
    } finally {
      conn.release()
    }

    if (!actualAvatarId) {
      throw new Error('缺少分身ID')
    }

    request.ownerUserId = request.ownerUserId || request.owner_user_id
    request.orderTitle = request.orderTitle || request.order_title
    
    // 📌 记录事件：分身已接单
    let acceptedAvatarName = '分身'
    try {
      const avatarInfo = await db.query('SELECT name FROM avatars WHERE id = ?', [actualAvatarId])
      acceptedAvatarName = avatarInfo?.[0]?.name || '分身'
    } catch {}
    this.eventService.recordEvent({
      orderId,
      dispatchId: request.id,
      avatarId: actualAvatarId,
      userId: request.ownerUserId,
      eventType: 'accepted',
      source: 'avatar',
      avatarName: acceptedAvatarName,
      eventData: { respondedAt: new Date().toISOString() },
    }).catch(err => console.warn('[事件] accepted 记录失败:', err.message))
    
    // 为订单所有者创建通知（分身接受了订单）
    try {
      await this.notificationService.createNotification({
        user_id: request.ownerUserId,
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
      const waitRows = await db.query(
        `SELECT id, order_id, avatar_id
         FROM content_generation_requests
         WHERE order_id = ? AND avatar_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId, avatarId]
      )

      if (waitRows?.[0]) {
        return waitRows[0]
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
    const declineRows = await db.query(
      'SELECT * FROM order_dispatch_requests WHERE id = ?',
      [dispatchId]
    )
    const request = declineRows?.[0]
    
    if (!request) {
      throw new Error('分派记录不存在')
    }
    
    // 更新状态为 declined
    await db.updateWhere('order_dispatch_requests', { id: dispatchId }, {
      status: 'rejected',
      responded_at: new Date(),
      updated_at: new Date()
    })
    
    // 📌 记录事件：分身婉拒
    let declinedAvatarName = '分身'
    try {
      const avatarInfo = await db.query('SELECT name FROM avatars WHERE id = ?', [request.avatarId])
      declinedAvatarName = avatarInfo?.[0]?.name || '分身'
    } catch {}
    this.eventService.recordEvent({
      orderId: request.orderId,
      dispatchId,
      avatarId: request.avatarId,
      eventType: 'rejected',
      source: 'avatar',
      avatarName: declinedAvatarName,
    }).catch(err => console.warn('[事件] rejected 记录失败:', err.message))
    
    console.log(`[declineOrder] 已婉拒: dispatchId=${dispatchId}`)
    return { success: true }
  }

  /**
   * 启动内容生成流程（带重试和兜底）
   */
  async startContentGeneration(orderId: string, avatarId: string, request: any) {
    const MAX_RETRIES = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this._doStartContentGeneration(orderId, avatarId, request)
        return // 成功，直接返回
      } catch (err: any) {
        lastError = err
        console.warn(`[startContentGeneration] 第${attempt}次尝试失败: ${err.message}`)
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * attempt)) // 递增等待
        }
      }
    }

    // 所有重试都失败，创建 failed 记录兜底，确保前端能感知到
    console.error(`[startContentGeneration] ${MAX_RETRIES}次重试全部失败，创建兜底 failed 记录: orderId=${orderId}`)
    try {
      const db = getMySQLClient()
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      await db.insert('content_generation_requests', {
        id: requestId,
        order_id: orderId,
        avatar_id: avatarId,
        content_type: 'image_text',
        content_quantity: 1,
        status: 'failed',
        error_message: `内容生成启动失败(${MAX_RETRIES}次重试): ${lastError?.message || '未知错误'}`,
        order_title: request?.order_title || '',
        created_at: new Date(),
        updated_at: new Date(),
      })
    } catch (fallbackErr: any) {
      console.error('[startContentGeneration] 创建兜底记录也失败:', fallbackErr.message)
    }
  }

  /**
   * 实际执行内容生成
   */
  private async _doStartContentGeneration(orderId: string, avatarId: string, request: any) {
    const db = getMySQLClient()
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error(`订单不存在: ${orderId}`)
    }

    const platforms = order.platforms ? JSON.parse(order.platforms) : ['wechat']
    const normalizedPlatforms = platforms.map((p: string) => p === 'general' ? 'wechat' : p)

    // 获取分身完整信息（技能、风格、领域、人设）
    let avatarName: string | undefined
    let avatarPersonality: string | undefined
    let avatarSkills: string[] = []
    let contentStyles: string[] = []
    let nicheTags: string[] = []

    if (avatarId) {
      try {
        const avatarRows = await db.query(
          'SELECT name, personality, content_styles, niche_tags FROM avatars WHERE id = ? AND status = \'active\'',
          [avatarId]
        ) as [any[], any]
        const avatar = avatarRows?.[0]
        if (avatar) {
          avatarName = avatar.name
          avatarPersonality = avatar.personality
          contentStyles = typeof avatar.contentStyles === 'string' ? JSON.parse(avatar.contentStyles) : (avatar.contentStyles || [])
          nicheTags = typeof avatar.nicheTags === 'string' ? JSON.parse(avatar.nicheTags) : (avatar.nicheTags || [])
        }

        // 获取分身技能
        const skillRows = await db.query(
          'SELECT skill_id FROM avatar_skills WHERE avatar_id = ?',
          [avatarId]
        ) as [any[], any]
        avatarSkills = skillRows?.map((s: any) => s.skillId || s.skill_id) || []
      } catch (err: any) {
        console.warn('[startContentGeneration] 获取分身信息失败:', err.message)
      }
    }

    // 解析订单的风格和领域偏好
    let preferredStyles: string[] = []
    let industryTags: string[] = []
    try {
      preferredStyles = order.preferredStyles 
        ? (typeof order.preferredStyles === 'string' ? JSON.parse(order.preferredStyles) : order.preferredStyles)
        : []
      industryTags = order.industryTags
        ? (typeof order.industryTags === 'string' ? JSON.parse(order.industryTags) : order.industryTags)
        : []
    } catch (_) {}

    // 调用内容生成服务
    await this.contentGenerationService.generateContent({
      orderId,
      avatarId,
      orderTitle: request.order_title || order.title || '内容生成',
      orderDescription: request.description || order.description || '',
      platforms: normalizedPlatforms,
      contentType: order.contentType || order.content_type || 'image_text',
      targetAudience: request.target_audience || order.targetAudience || '年轻用户',
      contentQuantity: request.quantityPerAvatar || request.quantity_per_avatar || order.quantityPerAvatar || order.quantity_per_avatar || 1,
      avatarName,
      avatarPersonality,
      avatarSkills,
      contentStyles,
      nicheTags,
      preferredStyles,
      industryTags,
    })

    console.log(`[startContentGeneration] 内容生成已启动: orderId=${orderId}, avatarId=${avatarId}, skills=${avatarSkills.join(',')}`)
  }

  /**
   * 根据订单ID获取订单信息
   */
  private async getOrderById(orderId: string): Promise<any | null> {
    const db = getMySQLClient()
    const orderRows3 = await db.query('SELECT * FROM orders WHERE id = ?', [orderId])
    return orderRows3?.[0] || null
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
    
    // 先确认分身仍然存在
    const avatarCheckRows2 = await db.query('SELECT id FROM avatars WHERE id = ? AND status = \'active\'', [avatarId])
    if (!avatarCheckRows2 || avatarCheckRows2.length === 0) return []
    
    const acceptedRows = await db.query(`
      SELECT r.*, o.title, o.status as order_status, o.budget, o.created_at as order_created_at
      FROM order_dispatch_requests r
      INNER JOIN orders o ON r.order_id = o.id
      WHERE r.avatar_id = ? AND r.status = 'accepted'
      ORDER BY r.updated_at DESC
    `, [avatarId])
    
    return acceptedRows || []
  }

  /**
   * 获取用户所有已接受的订单（通过分身）
   */
  async getUserAcceptedOrders(userId: string) {
    const db = getMySQLClient()
    
    const userAcceptedRows = await db.query(`
      SELECT r.*, o.title, o.status as order_status, o.budget, o.created_at as order_created_at, a.name as avatar_name
      FROM order_dispatch_requests r
      INNER JOIN orders o ON r.order_id = o.id
      INNER JOIN avatars a ON r.avatar_id = a.id AND a.status = 'active'
      WHERE r.user_id = ? AND r.status = 'accepted'
      ORDER BY r.updated_at DESC
    `, [userId])
    
    return userAcceptedRows || []
  }

  /**
   * 检查订单是否已被任何分身接受
   */
  async hasAcceptedRequest(orderId: string): Promise<boolean> {
    const db = getMySQLClient()
    
    const countRows = await db.query(`
      SELECT COUNT(*) as count 
      FROM order_dispatch_requests 
      WHERE order_id = ? AND status = 'accepted'
    `, [orderId])
    
    return (countRows?.[0]?.count || 0) > 0
  }

  /**
   * 获取订单的所有接受者分身
   */
  async getOrderAcceptors(orderId: string) {
    const db = getMySQLClient()
    
    const acceptorRows = await db.query(`
      SELECT a.*, r.id as dispatch_request_id
      FROM order_dispatch_requests r
      INNER JOIN avatars a ON r.avatar_id = a.id AND a.status = 'active'
      WHERE r.order_id = ? AND r.status = 'accepted'
    `, [orderId])
    
    return acceptorRows || []
  }

  /**
   * 发送短信通知给指定分身
   */
  async notifyAvatars(orderId: string, avatarIds: string[], customMessage?: string) {
    const db = getMySQLClient()
    
    // 查询订单信息
    const notifyOrderRows = await db.query('SELECT * FROM orders WHERE id = ?', [orderId])
    const order = notifyOrderRows?.[0]
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    let notifiedCount = 0
    let smsSentCount = 0
    
    // 为每个分身创建通知并发送短信
    for (const avatarId of avatarIds) {
      // 查询分身信息，并关联用户表获取手机号
      const notifyAvatarRows = await db.query(`
        SELECT a.*, u.phone AS user_phone 
        FROM avatars a 
        LEFT JOIN users u ON a.user_id = u.id 
        WHERE a.id = ? AND a.status = 'active'`, [avatarId])
      const avatar = notifyAvatarRows?.[0]
      
      if (!avatar) continue
      
      // 生成通知内容
      const message = customMessage || `您有新的订单任务：${order.title || '内容创作'}，请及时查收并完成。`
      const smsContent = `【莫瑞拉】${message}`
      
      // 创建通知记录
      const notifId = crypto.randomUUID()
      const notifResult = await db.insert('avatar_notifications', {
        id: notifId,
        avatar_id: avatarId,
        notification_type: 'order_assigned',
        title: '新订单分配',
        content: message,
        is_read: 0,
        data: JSON.stringify({ orderId }),
        created_at: new Date()
      })
      if (notifResult.error) {
        console.error('[dispatchToAllAvatars] 创建分身通知记录失败:', notifResult.error)
      }
      
      // 发送真实短信 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone
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
