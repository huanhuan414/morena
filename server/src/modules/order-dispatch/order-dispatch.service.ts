// @ts-nocheck
import { Injectable, Inject, Logger, forwardRef, HttpException, HttpStatus, ConflictException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import { SmsService } from '../sms/sms.service'
import { NotificationService } from '../notification/notification.service'
import { OrderService } from '../order/order.service'
import { normalizeDispatchStatus as normalizeDispatchStatusV2, normalizeFulfillmentStatus } from '../order/order-status'
import { ContentGenerationService } from '../content-generation/content-generation.service'
import { OrderEventService } from './order-event.service'
import { RedisService } from '../redis/redis.service'
import { SubscriptionService } from '../subscription/subscription.service'

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
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => SubscriptionService)) private readonly subscriptionService: SubscriptionService,
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
    
    const orderRows = await db.query(
      `SELECT id, status, is_paid,
              GREATEST(COALESCE(NULLIF(avatar_count, 0), NULLIF(expected_quantity, 0), 1), 1) as required_count
       FROM orders WHERE id = ? AND is_deleted = 0 LIMIT 1`,
      [data.order_id]
    )
    const order: any = orderRows?.[0]
    if (!order) {
      throw new NotFoundException('订单不存在')
    }
    if (order.status === 'pending_payment' && Number(order.is_paid || 0) !== 1) {
      throw new BadRequestException('订单未支付，无法派单')
    }
    const requiredCount = Number(order?.requiredCount || order?.required_count || 1) || 1
    const acceptedRows = await db.query(
      `SELECT COUNT(DISTINCT avatar_id) as count
       FROM order_dispatch_requests
       WHERE order_id = ? AND status IN ('accepted', 'completed')`,
      [data.order_id]
    )
    const acceptedCount = Number(acceptedRows?.[0]?.count || 0)
    if (acceptedCount >= requiredCount) {
      throw new ConflictException('名额已满，请抢其他订单')
    }

    const existingRows = await db.query(
      `SELECT id FROM order_dispatch_requests
       WHERE order_id = ? AND avatar_id = ?
         AND status IN ('pending', 'accepted', 'completed')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [data.order_id, data.avatar_id]
    )
    const existing: any = existingRows?.[0]
    if (existing?.id) {
      return { id: existing.id }
    }

    const id = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10分钟内必须接单
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
              r.expires_at, r.created_at as dispatch_created_at,r.accept_timeout_at,
              o.title, o.description, o.content_type, o.platforms, o.budget, o.base_amount,
              o.status as order_status, o.quantity_per_avatar, o.expected_quantity,
              o.created_at as order_created_at, o.target_audience, o.deadline,
              o.priority, o.requirements,
              o.preferred_styles, o.industry_tags,
              o.custom_base_price, o.accept_regions,
              a.name as avatar_name, a.content_styles, a.niche_tags, a.skills, a.location_text
       FROM order_dispatch_requests r
       INNER JOIN avatars a ON r.avatar_id = a.id AND a.status = 'active'
       INNER JOIN orders o ON r.order_id = o.id AND o.status IN ('pending', 'in_progress','awaiting_acceptance', 'submitted','pending_acceptance') and o.is_deleted = 0
       WHERE r.user_id = ? AND r.status = 'pending'
       ORDER BY r.created_at DESC`, [userId])
    const requests = requestRows || []

    // 获取用户的平台费率
    let platformFeeRate = 0.20 // 默认20%
    try {
      const feeRows = await db.query(
        `SELECT u.id as user_id, COALESCE(sp.platform_fee_rate, 0.20) as platform_fee_rate
         FROM users u
         LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
         LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
         WHERE u.id = ?
         ORDER BY us.created_at DESC
         LIMIT 1`,
        [userId]
      )
      if (feeRows && feeRows.length > 0) {
        platformFeeRate = Number(feeRows[0].platformFeeRate || feeRows[0].platform_fee_rate || 0.20)
      }
    } catch (err) {
      console.warn('[getUserPendingRequests] 获取用户费率失败，使用默认20%:', err)
    }

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

    // 计算每个请求的匹配度 + 预期收益 + 待接单倒计时
    return requests.map(req => {
      // 注入 avatar_skills 表的技能数据
      req._skillsFromTable = skillsMap.get(req.avatarId) || []
      const { score, details } = this.calculateMatchScore(req, req)
      const baseAmount = Number(req.base_amount || req.baseAmount || req.budget || 0)
      const expectedQuantity = Number(req.expectedQuantity || req.expected_quantity || 1)
      const customBasePrice = Number(req.custom_base_price || req.customBasePrice || 0)
      const expectedEarnings = Number((customBasePrice * (1 - platformFeeRate)).toFixed(2))
      
 
      // 计算待接单倒计时文本（兼容下划线和驼峰）
      const acceptTimeoutAt = req.accept_timeout_at || req.acceptTimeoutAt
      const acceptTimeoutText = this.calculateAcceptTimeoutText(acceptTimeoutAt)
      
      return {
        ...req,
        matchScore: score,
        matchDetails: details,
        expectedEarnings,
        platformFeeRate,
        acceptTimeoutText,
      }
    })
  }

  /**
   * 计算待接单倒计时文本
   */
  private calculateAcceptTimeoutText(acceptTimeoutAt: any): string | null {
    if (!acceptTimeoutAt) return null
    
    const timeoutTime = new Date(acceptTimeoutAt).getTime()
    const now = Date.now()
    const remaining = timeoutTime - now
    
    if (remaining <= 0) return '已超时'
    
    if (remaining < 60 * 1000) {
      return `剩${Math.round(remaining / 1000)}秒`
    } else if (remaining < 60 * 60 * 1000) {
      const minutes = Math.floor(remaining / (60 * 1000))
      const seconds = Math.round((remaining % (60 * 1000)) / 1000)
      return `剩${minutes}分${seconds}秒`
    } else {
      const hours = Math.floor(remaining / (60 * 60 * 1000))
      return `剩${hours}小时`
    }
  }

  /**
   * 计算分身与订单的匹配度（风格 + 领域 + 技能）
   * 返回 0-100 的匹配分数
   * 注意：区域匹配已在 getRecommendedAvatars 中作为必须条件处理，这里不再计算区域分数
   */
  private calculateMatchScore(avatar: any, order: any): { score: number; details: { skillScore: number; styleScore: number; nicheScore: number; regionScore: number } } {
    const details = { skillScore: 0, styleScore: 0, nicheScore: 0, regionScore: 100 } // regionScore 固定100，因为区域匹配已在筛选时处理

    // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 开始计算匹配分数`)
    
    // 解析分身的 personality 字段：{"tags": [], "niches": []}
    const avatarPersonality = this.safeParseJson(avatar.personality, { tags: [], niches: [] })
    // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} personality 原始值: ${avatar.personality}`)
    // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} personality 解析后: ${JSON.stringify(avatarPersonality)}`)
    
    const avatarStyles: string[] = Array.isArray(avatarPersonality?.tags) ? avatarPersonality.tags : []
    const avatarNiches: string[] = Array.isArray(avatarPersonality?.niches) ? avatarPersonality.niches : []
    // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 风格数组: ${JSON.stringify(avatarStyles)}`)
    // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 领域数组: ${JSON.stringify(avatarNiches)}`)
    
    // 优先使用 avatar_skills 表的技能数据，fallback 到 avatars.skills 字段
    const avatarSkills: string[] = (avatar._skillsFromTable && avatar._skillsFromTable.length > 0)
      ? avatar._skillsFromTable
      : this.safeParseJson(avatar.skills, [])

    // 解析订单的 personality 字段：{"tags": '', "niches": ''}
    // this.logger.log(`[calculateMatchScore] 订单 personality 原始值: ${order.personality}`)
    const orderPersonality = this.safeParseJson(order.personality, { tags: '', niches: '' })
    // this.logger.log(`[calculateMatchScore] 订单 personality 解析后: ${JSON.stringify(orderPersonality)}`)
    
    const orderStyle: string = orderPersonality?.tags || ''
    const orderNiche: string = orderPersonality?.niches || ''
    // this.logger.log(`[calculateMatchScore] 订单风格偏好: ${orderStyle}`)
    // this.logger.log(`[calculateMatchScore] 订单领域偏好: ${orderNiche}`)
    
    // 订单的 content_type 和 platforms 也作为技能匹配依据
    const orderContentType = (order.content_type || order.contentType || '').toLowerCase()
    const orderPlatforms: string[] = this.safeParseJson(order.platforms, [])

    // 维度一：风格匹配（权重40%）- 主要匹配因素
    // 订单风格偏好 IN 分身风格数组
    if (orderStyle && avatarStyles.length > 0) {
      if (avatarStyles.includes(orderStyle)) {
        details.styleScore = 40  // 完全匹配
        // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 风格匹配: 订单风格=${orderStyle}, 分身风格=${JSON.stringify(avatarStyles)}, 匹配成功, styleScore=40`)
      } else {
        details.styleScore = 0   // 不匹配
        // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 风格不匹配: 订单风格=${orderStyle}, 分身风格=${JSON.stringify(avatarStyles)}, styleScore=0`)
      }
    } else if (orderStyle) {
      // 订单有风格要求但分身没设风格，给一半分
      details.styleScore = 20
      // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 有订单风格要求但分身无风格, styleScore=20`)
    } else {
      // 订单无风格要求，给满分
      details.styleScore = 40
      // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 订单无风格要求, styleScore=40`)
    }

    // 维度二：领域匹配（权重40%）- 主要匹配因素
    // 订单领域偏好 IN 分身领域数组
    if (orderNiche && avatarNiches.length > 0) {
      if (avatarNiches.includes(orderNiche)) {
        details.nicheScore = 40  // 完全匹配
        // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 领域匹配: 订单领域=${orderNiche}, 分身领域=${JSON.stringify(avatarNiches)}, 匹配成功, nicheScore=40`)
      } else {
        details.nicheScore = 0   // 不匹配
        // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 领域不匹配: 订单领域=${orderNiche}, 分身领域=${JSON.stringify(avatarNiches)}, nicheScore=0`)
      }
    } else if (orderNiche) {
      // 订单有领域要求但分身没设领域，给一半分
      details.nicheScore = 20
      // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 有订单领域要求但分身无领域, nicheScore=20`)
    } else {
      // 订单无领域要求，给满分
      details.nicheScore = 40
      // this.logger.log(`[calculateMatchScore] 分身 ${avatar.name} 订单无领域要求, nicheScore=40`)
    }

    // 维度三：技能匹配（权重20%）- 辅助匹配因素
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
      details.skillScore = Math.round((matchedSkills.length / requiredSkills.length) * 20)
    } else {
      // 没有明确技能要求时，有技能的分身基础分更高
      details.skillScore = avatarSkills.length > 0 ? 15 : 10
    }

    const score = Math.min(100, details.styleScore + details.nicheScore + details.skillScore)
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
   * 从地址字符串中提取省份
   */
  private extractProvince(location: string): string {
    const locationText = (location || '').trim()
    if (!locationText) return ''
    const parts = locationText.split(/[省市区县]/)
    return parts.length > 0 ? parts[0].trim() : ''
  }

  /**
   * 获取推荐分身列表
   * 新逻辑：
   * 1. 区域匹配是必须条件：先查询区域匹配的分身
   * 2. 风格、领域是辅组条件：在区域匹配的分身中按匹配度排序
   * 3. 不够时随机补充：其他未查询出的分身
   */
  async getRecommendedAvatars(orderId: string, limit: number = 0) {
    const db = getMySQLClient()
    // const hostedWhereClause = await this.buildHostedWhereClause()

    // ========== 合并订单查询（只查一次） ==========
    let order: any = null
    let orderAvatarCount = 0
    let orderRegions: string[] = []
    let orderPersonality: any = { tags: '', niches: '' }
    
    if (orderId) {
      try {
        const orderRows = await db.query(
          'SELECT avatar_count, accept_regions, personality FROM orders WHERE id = ? AND is_deleted = 0', 
          [orderId]
        )
        order = orderRows?.[0]
        
        if (order) {
          orderAvatarCount = Number(order.avatar_count || order.avatarCount || 0)
          orderRegions = this.safeParseJson(order.accept_regions || order.acceptRegions, [])
          orderPersonality = this.safeParseJson(order.personality, { tags: '', niches: '' })
          
          this.logger.log(`[getRecommendedAvatars] 自动计算fetchLimit: ${orderAvatarCount + 5} (avatar_count=${orderAvatarCount})`)
          this.logger.log(`[getRecommendedAvatars] 订单接单区域: ${JSON.stringify(orderRegions)}`)
          this.logger.log(`[getRecommendedAvatars] 订单 personality: ${JSON.stringify(orderPersonality)}`)
        }
      } catch (err) {
        this.logger.warn('获取订单信息失败:', err)
      }
    }
    
    // 如果没有指定limit，则根据订单的avatar_count自动计算：取avatar_count + 5个分身
    const fetchLimit = limit === 0 && orderId ? orderAvatarCount + 5 : limit

    // 查询所有开启托管的活跃分身（不限制数量，后续按匹配条件筛选）
    let sql = `SELECT * FROM avatars WHERE is_hosted = 1 AND status = 'active'`
    
    const resultRows = await db.query(sql)
    const allAvatars = resultRows || []

    // 获取分身技能数据
    const avatarIds = [...new Set(allAvatars.map((a: any) => a.id).filter(Boolean))]
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

    // 注入技能数据
    const readyAvatars = allAvatars.map((avatar: any) => {
      avatar._skillsFromTable = skillsMap.get(avatar.id) || []
      return avatar
    })

    // 获取派单统计
    const dispatchStatsMap = new Map<string, { total: number; accepted: number; expired: number }>()
    const readyAvatarIds = [...new Set(readyAvatars.map((a: any) => a.id).filter(Boolean))]
    if (readyAvatarIds.length > 0) {
      try {
        const rows = await db.query(
          `SELECT COALESCE(od.avatar_id, od.target_avatar_id) as avatar_id,
                  COUNT(1) as total,
                  SUM(CASE WHEN od.status IN ('accepted') THEN 1 ELSE 0 END) as accepted,
                  SUM(CASE WHEN od.status IN ('expired','rejected') THEN 1 ELSE 0 END) as expired
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

    // 如果有订单ID，进行匹配排序
    if (orderId) {
      try {
        // 需要的分身数量
        const requiredCount = Number(orderAvatarCount) + 5
        
        this.logger.log(`[getRecommendedAvatars] 开始匹配，订单接单区域: ${JSON.stringify(orderRegions)}`)
        this.logger.log(`[getRecommendedAvatars] 订单风格偏好: ${orderPersonality.tags}, 领域偏好: ${orderPersonality.niches}`)
        this.logger.log(`[getRecommendedAvatars] 需要分身数量: ${requiredCount}`)
        
        // ========== 第一步：根据是否有区域选择，筛选出目标分身列表 ==========
        // 如果有区域选择，只处理区域匹配的分身；否则处理全部分身
        const targetAvatars = orderRegions.length > 0
          ? readyAvatars.filter(avatar => {
              const province = this.extractProvince(avatar.locationText || avatar.location_text)
              return province && orderRegions.some(region => province.includes(region) || region.includes(province))
            })
          : readyAvatars
        
        this.logger.log(`[getRecommendedAvatars] 区域筛选后剩余 ${targetAvatars.length} 个分身`)
        
        // ========== 第二步：给目标分身打上风格、领域标签，并计算排序权重 ==========
        // 批量获取用户会员优先级（用于权益排序）
        const allUserIds = [...new Set(targetAvatars.map((a: any) => a.userId || a.user_id).filter(Boolean))]
        const orderPriorityMap = await this.subscriptionService.getBatchOrderPriority(allUserIds)
        
        const taggedAvatars = targetAvatars.map(avatar => {
          // 使用抽取的方法从地址中提取省份
          const avatarProvince = this.extractProvince(avatar.locationText || avatar.location_text)
          
          // 区域匹配检查（由于已经筛选过，这里必然匹配或无区域限制）
          const isRegionMatched = orderRegions.length === 0 || (avatarProvince && orderRegions.some(region => avatarProvince.includes(region) || region.includes(avatarProvince)))
          
          // 风格和领域匹配检查
          let isStyleMatched = false
          let isNicheMatched = false
          
          // 解析分身 personality
          let avatarPersonality: { tags?: string[]; niches?: string[] } = {}
          try {
            avatarPersonality = typeof avatar.personality === 'string'
              ? JSON.parse(avatar.personality || '{}')
              : (avatar.personality || {})
          } catch {
            avatarPersonality = {}
          }
          
          const avatarTags = Array.isArray(avatarPersonality.tags) ? avatarPersonality.tags : []
          const avatarNiches = Array.isArray(avatarPersonality.niches) ? avatarPersonality.niches : []
          
          // 风格匹配：订单风格偏好 IN 分身风格数组
          if (orderPersonality.tags && avatarTags.length > 0) {
            isStyleMatched = avatarTags.some(tag => 
              tag.includes(orderPersonality.tags) || orderPersonality.tags.includes(tag)
            )
          }
          
          // 领域匹配：订单领域偏好 IN 分身领域数组
          if (orderPersonality.niches && avatarNiches.length > 0) {
            isNicheMatched = avatarNiches.some(niche => 
              niche.includes(orderPersonality.niches) || orderPersonality.niches.includes(niche)
            )
          }
          
          // 获取派单统计（接单数量）
          const stats = dispatchStatsMap.get(avatar.id) || { total: 0, accepted: 0, expired: 0 }
          const acceptanceRate = stats.total > 0 ? stats.accepted / stats.total : 0
          const expiredRate = stats.total > 0 ? stats.expired / stats.total : 0

          // 获取用户权益优先级
          const userId = avatar.userId || avatar.user_id
          const orderPriority = orderPriorityMap.get(userId) || 0
          
          // 计算排序权重：风格 > 领域 > 权益 > 接单数量 > 接单率（减去过期率惩罚）
          // 风格匹配：100分，领域匹配：100分，权益等级：每级10分，接单数量：每单1分（最多10分），接单率：0-10分，过期率惩罚：0-10分
          const styleScore = isStyleMatched ? 80 : 0
          const nicheScore = isNicheMatched ? 80 : 0
          const priorityScore = orderPriority * 10
          const orderCountScore = Math.min(stats.total, 10)
          const acceptanceScore = Math.round(acceptanceRate * 10)
          const expiredPenalty = Math.round(expiredRate * 10)
          
          const sortWeight = styleScore + nicheScore + priorityScore + orderCountScore + acceptanceScore - expiredPenalty
          
          this.logger.log(`[getRecommendedAvatars] 分身 ${avatar.name}: 区域=${isRegionMatched}, 风格=${isStyleMatched}, 领域=${isNicheMatched}, 权益等级=${orderPriority}, 接单数=${stats.total}, 接单率=${acceptanceRate.toFixed(2)}, 权重=${sortWeight}`)
          
          return {
            ...avatar,
            avatarProvince,
            isRegionMatched,
            isStyleMatched,
            isNicheMatched,
            orderPriority,
            dispatchStats: stats,
            acceptanceRate,
            sortWeight,
          }
        })
        
        // ========== 第四步：按标签权重排序 ==========
        // 排序规则：风格匹配 > 领域匹配 > 权益 > 接单数量/接单率
        taggedAvatars.sort((a, b) => b.sortWeight - a.sortWeight)
        
        this.logger.log(`[getRecommendedAvatars] 排序后前10个分身: ${taggedAvatars.slice(0, 10).map(a => `${a.name}(区域=${a.isRegionMatched},风格=${a.isStyleMatched},领域=${a.isNicheMatched},权重=${a.sortWeight})`).join(', ')}`)
        
        // ========== 第五步：按 user_id 去重，保留每个用户权重最高的分身 ==========
        const seenUserIds = new Set<string>()
        const uniqueAvatars = taggedAvatars.filter(avatar => {
          const userId = avatar.userId || avatar.user_id
          if (!userId || seenUserIds.has(userId)) return false
          seenUserIds.add(userId)
          return true
        })
        
        // ========== 第六步：取订单分身数+5个值 ==========
        const finalAvatars = uniqueAvatars.slice(0, requiredCount)
        
        this.logger.log(`[getRecommendedAvatars] 最终返回 ${finalAvatars.length} 个分身`)
        
        // ========== 第六步：为最终的分身计算匹配分数（用于前端展示） ==========
        const scoredAvatars = finalAvatars.map(avatar => {
          // 计算风格和领域匹配分数
          const { score: styleNicheScore, details } = this.calculateMatchScore(avatar, order)
          
          // 获取派单统计（复用第三步已计算的数据）
          const stats = avatar.dispatchStats || { total: 0, accepted: 0, expired: 0 }
          const rate = stats.total > 0 ? stats.accepted / stats.total : 0
          let bonus = 0
          if (stats.total >= 5 && rate >= 0.8) bonus = 5
          if (stats.total >= 5 && rate <= 0.3) bonus = -10
          const userId = avatar.userId || avatar.user_id
          const orderPriority = orderPriorityMap.get(userId) || 1
          const priorityBonus = (orderPriority - 1) * 10
          
          // 最终分数：区域匹配优先，然后是风格领域匹配
          const regionScore = avatar.isRegionMatched ? 100 : 0
          const finalScore = Math.max(0, Math.min(200, regionScore + styleNicheScore + bonus + priorityBonus))
          
          return {
            ...avatar,
            matchScoreBase: styleNicheScore,
            matchScore: finalScore,
            regionScore,
            matchDetails: { ...details, regionScore, styleScore: avatar.isStyleMatched ? 40 : 0, nicheScore: avatar.isNicheMatched ? 40 : 0 },
            dispatchStats: { ...stats, acceptanceRate: rate },
            orderPriority,
            priorityBonus,
            matchType: avatar.isRegionMatched ? 'region' : 'other',
          }
        })
        
        return scoredAvatars
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

    // 检查AI生成素材状态：如果开启AI补足且素材未生成完成，拒绝派单
    const orderForCheck = await db.query('SELECT * FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
    if (orderForCheck?.[0]) {
      const order = orderForCheck[0]
      const reqs = typeof order.requirements === 'string' ? JSON.parse(order.requirements) : (order.requirements || {})
      if (reqs.ai_auto_fill) {
        const generatingRows = await db.query(
          `SELECT COUNT(*) as cnt FROM order_assets WHERE order_id = ? AND status IN ('pending', 'generating')`,
          [orderId]
        )
        const generatingCount = Number(generatingRows?.[0]?.cnt || 0)
        if (generatingCount > 0) {
          this.logger.warn(`[dispatchOrder] 订单${orderId}素材生成中，ai_auto_fill=true，拒绝自动派单`)
          return null
        }
      }
    }
    
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

  /**
   * 获取订单名额状态（用于前端检查是否可接单）
   */
  async getQuotaStatus(orderId: string) {
    const db = getMySQLClient()
    const pool = getPool()
    
    // 查询订单的名额限制（与 acceptOrder 保持一致）
    // 使用 GREATEST(COALESCE(NULLIF(x, 0), NULLIF(y, 0), 1), 1) 逻辑
    const [orderRows] = await pool.query(
      `SELECT id, avatar_count, expected_quantity,
              GREATEST(COALESCE(NULLIF(avatar_count, 0), NULLIF(expected_quantity, 0), 1), 1) as required_count
       FROM orders WHERE id = ? AND is_deleted = 0 LIMIT 1`,
      [orderId]
    ) as any[]

    if (!orderRows || orderRows.length === 0) {
      return { exists: false, acceptedCount: 0, totalQuota: 0, remainingQuota: 0, isFull: true }
    }
    
    const order = orderRows[0]
    // 与 acceptOrder 完全一致的名额计算逻辑
    const totalQuota = Math.max(
      Number(order.avatar_count) || 0,
      Number(order.expected_quantity) || 0,
      1
    )
    
    // 如果 avatar_count 和 expected_quantity 都是 0 或 null，使用 required_count
    const effectiveTotalQuota = (Number(order.avatar_count) === 0 && Number(order.expected_quantity) === 0)
      ? Number(order.required_count || 1)
      : totalQuota
    
    // 查询已接单数量
    const acceptedRows = await db.query(
      `SELECT COUNT(1) as count FROM order_dispatch_requests WHERE order_id = ? AND status IN ('pending','accepted', 'completed')`,
      [orderId]
    ) as any[]
    const acceptedCount = Number(acceptedRows?.[0]?.count || 0)
    
    const remainingQuota = Math.max(0, effectiveTotalQuota - acceptedCount)
    const isFull = acceptedCount >= effectiveTotalQuota
    
    return {
      exists: true,
      acceptedCount,
      totalQuota: effectiveTotalQuota,
      remainingQuota,
      isFull
    }
  }

  async dispatchToAvatar(orderId: string, avatarId: string) {
    const db = getMySQLClient()
    
    // 查询分身（必须是活跃状态）
    const avatars = await db.query('SELECT * FROM avatars WHERE id = ? AND status = \'active\'', [avatarId]) as any[]
    if (avatars.length === 0) {
      throw new NotFoundException('分身不存在或已失效')
    }

    const orderRows = await db.query(
      `SELECT id, status, is_paid,
              GREATEST(COALESCE(NULLIF(avatar_count, 0), NULLIF(expected_quantity, 0), 1), 1) as required_count
       FROM orders WHERE id = ? AND is_deleted = 0 LIMIT 1`,
      [orderId]
    )
    const order: any = orderRows?.[0]
    if (!order) {
      throw new NotFoundException('订单不存在')
    }
    if (order.status === 'pending_payment' && Number(order.is_paid || 0) !== 1) {
      throw new BadRequestException('订单未支付，无法派单')
    }
    const requiredCount = Number(order?.requiredCount || order?.required_count || 1) || 1
    const acceptedRows = await db.query(
      `SELECT COUNT(DISTINCT avatar_id) as count
       FROM order_dispatch_requests
       WHERE order_id = ? AND status IN ('accepted', 'completed')`,
      [orderId]
    )
    const acceptedCount = Number(acceptedRows?.[0]?.count || 0)
    if (acceptedCount >= requiredCount) {
      throw new ConflictException('名额已满，请抢其他订单')
    }

    const avatar = avatars[0]

    const existingRows = await db.query(
      `SELECT id FROM order_dispatch_requests
       WHERE order_id = ? AND avatar_id = ?
         AND status IN ('pending', 'accepted', 'completed')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [orderId, avatarId]
    )
    const existing: any = existingRows?.[0]
    if (existing?.id) {
      return { avatar_id: avatarId, dispatch_id: existing.id }
    }
    
    // 创建分发请求
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: orderId,
      avatar_id: avatarId,
      user_id: avatar.userId,
      platform: 'manual',
      status: 'pending',
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { avatar_id: avatarId, dispatch_id: id }
  }

  async getRequestById(requestId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { id: requestId }) as any[]
    return requests[0] || null
  }

  async confirmDispatch(requestId: string, avatarId: string) {
    const request = await this.getRequestById(requestId)
    if (!request) {
      throw new NotFoundException('派单记录不存在')
    }
    const actualAvatarId = avatarId || request.avatarId || request.avatar_id
    const orderId = request.orderId || request.order_id
    const result = await this.acceptOrder(actualAvatarId, orderId)
    return { success: true, ...result }
  }

  async rejectDispatch(requestId: string, avatarId: string) {
    const db = getMySQLClient()

    // 先查出orderId，用于Redis计数器修正
    const [record] = await db.query('SELECT order_id, status FROM order_dispatch_requests WHERE id = ?', [requestId])
    const orderId = record?.order_id

    await db.update('order_dispatch_requests', { status: 'rejected' }, { id: requestId })

    // 如果之前是accepted状态，需要Redis DECR（分身接单时INCR了，拒绝时必须减回来）
    if (record?.status === 'accepted' && orderId) {
      try {
        const redisKey = `order:accept:count:${orderId}`
        await this.redisService.getClient().decr(redisKey)
        // 注意：不做DB同步补偿。并发时DB事务延迟会导致补偿覆盖INCR/DECR的正确结果
      } catch (err) {
        console.warn('[Redis] 拒绝分身DECR失败:', err.message)
      }
    }

    return { success: true }
  }

  /**
   * 一键分配订单给所有可用分身
   */
  async dispatchToAllAvatars(orderId: string) {
    const db = getMySQLClient()
    // 查询订单信息
    const orderRows = await db.query('SELECT * FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
    const order = orderRows?.[0]

    if (!order) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }

    // 获取订单需要的分身数量
    const requiredCount = Math.max(
      1,
      Number(order.expectedQuantity || order.expected_quantity || order.avatarCount || order.avatar_count || 1) || 1
    )

    const existingDistinctRows = await db.query(
      `SELECT COUNT(DISTINCT avatar_id) as count
       FROM order_dispatch_requests
       WHERE order_id = ? AND status IN ('pending', 'accepted', 'completed')`,
      [orderId]
    )
    const existingDistinctCount = Number(existingDistinctRows?.[0]?.count || 0)
    const remainingSlots = Math.max(0, requiredCount - existingDistinctCount)
    if (remainingSlots <= 0) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }

    const existingAvatarRows = await db.query(
      `SELECT DISTINCT avatar_id
       FROM order_dispatch_requests
       WHERE order_id = ? AND status IN ('pending', 'accepted', 'completed')`,
      [orderId]
    )
    const existingAvatarIdSet = new Set(
      (existingAvatarRows || [])
        .map((r: any) => r.avatarId || r.avatar_id)
        .filter(Boolean)
    )
    
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
    
    // 批量获取用户会员优先级
    const userIds = [...new Set(allAvatars.map(a => a.userId || a.user_id).filter(Boolean))]
    const orderPriorityMap = await this.subscriptionService.getBatchOrderPriority(userIds)
    
    // 批量获取用户自动接单权益
    const autoAcceptMap = await this.subscriptionService.getBatchAutoAccept(userIds)
    
    // 三维匹配排序：技能 + 风格 + 领域 + 会员优先级
    const scoredAvatars = allAvatars.map(avatar => {
      // 优先使用 avatar_skills 表的技能，fallback 到 avatars.skills 字段
      const aid = avatar.id || avatar.avatarId
      const skillsFromTable = avatarSkillsMap[aid] || []
      const avatarWithSkills = { ...avatar, _skillsFromTable: skillsFromTable }
      const { score, details } = this.calculateMatchScore(avatarWithSkills, order)
      // 会员优先级加分：(优先级-1) * 10，免费版=0，基础版=10，专业版=20，进阶版=30
      const uid = avatar.userId || avatar.user_id
      const orderPriority = orderPriorityMap.get(uid) || 1
      const priorityBonus = (orderPriority - 1) * 10
      // 自动接单权益
      const autoAccept = autoAcceptMap.get(uid) || false
      return { 
        ...avatar, 
        matchScore: score + priorityBonus, 
        matchDetails: details,
        orderPriority,
        priorityBonus,
        autoAccept,
      }
    })
    scoredAvatars.sort((a, b) => b.matchScore - a.matchScore)
    
    // 只取剩余名额（排除已派单/已接单过的分身）
    const candidates = scoredAvatars.filter((a: any) => !existingAvatarIdSet.has(a.id || a.avatarId))
    const avatars = candidates.slice(0, remainingSlots)
    
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
        `SELECT id FROM order_dispatch_requests
         WHERE order_id = ? AND avatar_id = ?
           AND status IN ('pending', 'accepted', 'completed')
         LIMIT 1`,
        [orderId, avatar.id]
      )
      if (existingDispatchRows && existingDispatchRows.length > 0) {
        continue
      }
      
      const insertResult = await db.insert('order_dispatch_requests', {
        id,
        order_id: orderId,
        avatar_id: avatar.id,
        user_id: avatar.userId || avatar.userPhone,
        platform: 'auto',
        status: avatar.autoAccept ? 'accepted' : 'pending',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date()
      })
      if (insertResult.error) {
        console.error('[dispatchToAllAvatars] 创建派发记录失败:', insertResult.error)
        continue
      }
      avatarIds.push(avatar.id)
      
      // autoAccept分身直接accepted，需要同步INCR Redis计数器
      if (avatar.autoAccept) {
        try {
          const redisKey = `order:accept:count:${orderId}`
          await this.redisService.getClient().incr(redisKey)
          this.logger.log(`[dispatchToAllAvatars] autoAccept Redis INCR: key=${redisKey}, avatarId=${avatar.id}`)
        } catch (redisErr) {
          this.logger.warn(`[dispatchToAllAvatars] autoAccept Redis INCR失败(可忽略): ${(redisErr as Error).message}`)
        }
      }
      
      // 📌 记录事件：已派单（自动接单时记录 accepted 事件）
      this.eventService.recordEvent({
        orderId,
        dispatchId: id,
        avatarId: avatar.id,
        userId: avatar.userId,
        eventType: avatar.autoAccept ? 'accepted' : 'dispatched',
        source: avatar.autoAccept ? 'auto_accept' : 'system',
        avatarName: avatar.name,
        eventData: { matchScore: avatar.matchScore, matchDetails: avatar.matchDetails, autoAccept: avatar.autoAccept },
      }).catch(err => console.warn('[事件] dispatched 记录失败:', err.message))
      
      // 发送真实短信通知 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone
      if (userPhone) {
        const smsContent = avatar.autoAccept 
          ? `【自动接单】${order?.title || '内容创作'}`
          : `【待确认】${order?.title || '内容创作'}`
        
        try {
          const smsResult = await this.smsService.sendSms(
            userPhone,
            'SMS_505555078',
            { name: avatar.name }
          )
          
          if (smsResult) {
            smsSentCount++
          }
        } catch (err) {
          console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
        }
        
        // 创建通知记录
        const notifId = crypto.randomUUID()
        const notifResult = await db.insert('avatar_notifications', {
          id: notifId,
          avatar_id: avatar.id,
          notification_type: avatar.autoAccept ? 'order_auto_accepted' : 'order_assigned',
          title: avatar.autoAccept ? '订单已自动接单' : '新订单待确认',
          content: smsContent,
          is_read: 0,
          data: JSON.stringify({ orderId, autoAccept: avatar.autoAccept }),
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

    // 派单结束后：校验补偿Redis与DB一致性
    // 注意：不做DB同步补偿。并发时DB事务延迟会导致补偿覆盖INCR/DECR的正确结果
    
    return { count: avatars.length, avatarIds, smsSentCount }
  }

  /**
   * 分配指定分身（手动选择 + 自动补充）
   * @param orderId 订单ID
   * @param selectedIds 手动选择的分身ID列表
   * @param additionalIds 自动补充的分身ID列表
   */
  async dispatchSpecifiedAvatars(orderId: string, selectedIds: string[] = [], additionalIds: string[] = []) {
    const db = getMySQLClient()
    
    // 合并所有要分配的分身ID
    const allAvatarIds = [...new Set([...selectedIds, ...additionalIds])]
    
    const avatarIds: string[] = []
    let smsSentCount = 0
    // 查询订单信息
    const orderRows = await db.query('SELECT * FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
    const order = orderRows?.[0]
    if (!order) {
      return { count: 0, avatarIds: [], smsSentCount: 0, reason: '订单不存在' }
    }
    if (allAvatarIds.length > 0) {
     
     
      // 查询这些分身是否存在且开启托管
      const avatarRows = await db.query(
        `SELECT a.*, u.phone AS user_phone 
       FROM avatars a 
       LEFT JOIN users u ON a.user_id = u.id 
       WHERE a.id IN (?) AND a.status = 'active'`,
        [allAvatarIds]
      )
    
      if (avatarRows.length === 0) {
        return { count: 0, avatarIds: [], smsSentCount: 0, reason: '未找到有效的分身' }
      }
    
      const avatarMap = new Map(avatarRows.map(a => [a.id, a]))
      
      // 获取待接单超时时间配置（毫秒）
      const acceptTimeoutMs = parseInt(process.env.ORDER_ACCEPT_TIMEOUT_MS || '600000', 10)
      const acceptTimeoutAt = new Date(Date.now() + acceptTimeoutMs)

      // 为每个分身创建派单记录
      for (const avatarId of allAvatarIds) {
        const avatar = avatarMap.get(avatarId)
        if (!avatar) {
          console.warn(`[dispatchSpecifiedAvatars] 分身 ${avatarId} 不存在或未开启托管，跳过`)
          continue
        }
      
        // 检查是否已有派单记录
        const existingDispatchRows = await db.query(
          `SELECT id FROM order_dispatch_requests
         WHERE order_id = ? AND avatar_id = ?
           AND status IN ('pending', 'accepted', 'completed')
         LIMIT 1`,
          [orderId, avatarId]
        )
        if (existingDispatchRows && existingDispatchRows.length > 0) {
          console.warn(`[dispatchSpecifiedAvatars] 分身 ${avatarId} 已有派单记录，跳过`)
          continue
        }
      
        // 判断是否自动接单
        const avatarUserId = avatar.userId || avatar.user_id
        const autoAccept = false
      
        // 创建派单记录
        const id = crypto.randomUUID()
        const insertResult = await db.insert('order_dispatch_requests', {
          id,
          order_id: orderId,
          avatar_id: avatarId,
          user_id: avatarUserId,
          platform: 'manual',
          status: autoAccept ? 'accepted' : 'pending',
          accept_timeout_at: acceptTimeoutAt,
          created_at: new Date(),
          updated_at: new Date()
        })
      
        if (insertResult.error) {
          console.error(`[dispatchSpecifiedAvatars] 创建派发记录失败:`, insertResult.error)
          continue
        }
      
        avatarIds.push(avatarId)
      
        // autoAccept分身直接accepted，需要同步INCR Redis计数器
        // if (autoAccept) {
        try {
          const redisKey = `order:accept:count:${orderId}`
          await this.redisService.getClient().incr(redisKey)
        } catch (redisErr) {
          console.warn(`[dispatchSpecifiedAvatars] autoAccept Redis INCR失败(可忽略): ${(redisErr as Error).message}`)
        }
        // }
      
        // 记录事件
        this.eventService.recordEvent({
          orderId,
          dispatchId: id,
          avatarId,
          userId: avatarUserId,
          eventType: autoAccept ? 'accepted' : 'dispatched',
          source: 'manual_select',
          avatarName: avatar.name,
          eventData: { autoAccept, from: selectedIds.includes(avatarId) ? 'manual' : 'auto' },
        }).catch(err => console.warn('[事件] dispatched 记录失败:', err.message))
      
        // 发送短信通知
        const userPhone = avatar.userPhone || avatar.phone || avatar.user_phone
        if (userPhone) {
          const smsContent = autoAccept
            ? `【自动接单】${order?.title || '内容创作'}`
            : `【待确认】${order?.title || '内容创作'}`
        
          try {
            const smsResult = await this.smsService.sendSms(
              userPhone,
              'SMS_505555078',
              { name: avatar.name }
            )
          
            if (smsResult) {
              smsSentCount++
            }
          } catch (err) {
            console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
          }
        
          // 创建分身通知记录
          const notifId = crypto.randomUUID()
          await db.insert('avatar_notifications', {
            id: notifId,
            avatar_id: avatarId,
            notification_type: autoAccept ? 'order_auto_accepted' : 'order_assigned',
            title: autoAccept ? '订单已自动接单' : '新订单待确认',
            content: smsContent,
            is_read: 0,
            data: JSON.stringify({ orderId, autoAccept }),
            created_at: new Date()
          })
        }
      }
    }
     
    // 更新订单状态为 pending
     await db.query(
      'UPDATE orders SET status = ?, updated_at = ? WHERE id = ?',
      ['pending', new Date(), orderId]
    )
    const orderUserId = order.userId || order.user_id 
    // 为用户创建通知
    if (avatarIds.length > 0 && orderUserId) {
      try {
        await this.notificationService.createNotification({
          user_id: orderUserId,
          type: 'order_dispatched',
          title: '订单已分配',
          content: `已将订单"${order.title || '内容创作'}"分配给 ${avatarIds.length} 个分身，已发送短信通知。`,
          metadata: {
            orderId,
            avatarIds,
            count: avatarIds.length
          }
        })
      } catch (err) {
        console.error('[dispatchSpecifiedAvatars] 创建用户通知失败:', err)
      }
    }
    
    return { 
      count: avatarIds.length, 
      avatarIds, 
      smsSentCount,
      selectedCount: selectedIds.length,
      additionalCount: additionalIds.length
    }
  }

  /**
   * 分身接受订单
   */
  /**
   * Redis原子计数器的key前缀（仅用于接单计数，不影响其他Redis数据）
   */
  private static readonly REDIS_KEY_ACCEPTED = 'order:accept:count:'    // 已接单计数 order:accept:count:{orderId}
  private static readonly REDIS_KEY_REQUIRED = 'order:accept:required:' // 名额上限   order:accept:required:{orderId}
  private static readonly REDIS_KEY_LOCK = 'order:accept:lock:'         // 分布式锁   order:accept:lock:{orderId}
  private static readonly REDIS_TTL_SECONDS = 86400 * 7 // 7天自动过期

  async acceptOrder(avatarId: string, orderId: string) {
    const db = getMySQLClient()
    const pool = getPool()
    let request: any = null
    let actualAvatarId: string | undefined = avatarId
    let requiredCount = 1
    let wasAlreadyAccepted = false

    // =====================================================
    // 第零阶段：区域限制检查
    // =====================================================
    // 获取订单的接单区域限制
    const orderRegionRows = await db.query('SELECT accept_regions FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
    const acceptRegionsStr = (orderRegionRows as any[])?.[0]?.acceptRegions || (orderRegionRows as any[])?.[0]?.accept_regions
    const acceptRegions = this.safeParseJson<string[]>(acceptRegionsStr, [])

    // 如果订单有区域限制，检查分身地址是否在限制区域内
    if (acceptRegions.length > 0) {
      const avatarRows = await db.query('SELECT location_text FROM avatars WHERE id = ?', [avatarId])
      const avatarLocationText = (avatarRows as any[])?.[0]?.locationText || (avatarRows as any[])?.[0]?.location_text || ''
      
      // 提取省份（与前端逻辑一致：split(/[省市区县]/) 取第一个部分）
      const parts = avatarLocationText.split(/[省市区县]/)
      const avatarProvince = parts.length > 0 ? parts[0].trim() : ''

      this.logger.log(`[acceptOrder] 区域检查: 分身省份=${avatarProvince}, 订单区域=${JSON.stringify(acceptRegions)}`)

      // 检查分身省份是否在订单限制区域内
      const isRegionMatched = acceptRegions.some(region => 
        avatarProvince.includes(region) || region.includes(avatarProvince)
      )

      if (!isRegionMatched) {
        throw new BadRequestException(`该订单限制了接单区域：${acceptRegions.join('、')}，您的分身地址不在这些区域内，无法接单`)
      }
    }

    // =====================================================
    // 第一阶段：Redis快速检查（毫秒级，快速拒绝已满订单）
    // =====================================================

    // 1.1 快速校验订单状态（不加锁，读最新数据即可）
    const orderRows = await db.query(
      `SELECT id, status, is_paid, accept_timeout,
              GREATEST(COALESCE(NULLIF(avatar_count, 0), NULLIF(expected_quantity, 0), 1), 1) as required_count
       FROM orders
       WHERE id = ?`,
      [orderId]
    )
    const orderRow: any = (orderRows as any[])?.[0]
    // db.query 内部会 convertKeysToCamel，所以 required_count → requiredCount
    requiredCount = Number(orderRow?.requiredCount || orderRow?.required_count || 1) || 1
    const orderAcceptTimeout = orderRow?.acceptTimeout || orderRow?.accept_timeout || null // 接单超时（分钟）
    if (!orderRow) {
      throw new NotFoundException('订单不存在')
    }
    
    const acceptablStatuses = ['pending', 'pending_payment', 'open', 'created', 'assigned', 'pending_acceptance', 'pending_dispatch', 'awaiting_acceptance', 'in_progress']
    if (!acceptablStatuses.includes(orderRow.status)) {
      throw new ConflictException(`订单已${orderRow.status === 'completed' ? '完成' : orderRow.status === 'cancelled' ? '取消' : '关闭'}, 无法接单`)
    }
    if (orderRow.status === 'pending_payment' && Number(orderRow.is_paid || 0) !== 1) {
      throw new BadRequestException('订单未支付，无法接单')
    }

    // 1.2 初始化Redis计数器（首次访问时从数据库同步）
    const redisKeyAccepted = `${OrderDispatchService.REDIS_KEY_ACCEPTED}${orderId}`
    const redisKeyRequired = `${OrderDispatchService.REDIS_KEY_REQUIRED}${orderId}`

    // 用SET NX确保只初始化一次
    const requiredSet = await this.redisService.setNX(redisKeyRequired, String(requiredCount), OrderDispatchService.REDIS_TTL_SECONDS * 1000)
    if (requiredSet) {
      // 首次初始化：用SET NX初始化redisKeyAccepted（不覆盖已存在的INCR结果）
      // 关键：并发时，其他请求可能已经先INCR了redisKeyAccepted，
      // 如果用SET会覆盖INCR结果导致超卖，所以必须用SET NX
      const acceptedSetResult = await this.redisService.getClient().set(
        redisKeyAccepted, '0', 'NX', 'EX', OrderDispatchService.REDIS_TTL_SECONDS
      )
      if (!acceptedSetResult) {
        // redisKeyAccepted已被其他并发请求INCR创建，无需初始化
        this.logger.log(`redisKeyAccepted已存在，跳过初始化: orderId=${orderId}`)
      }
    }

    // 独占模式校验：分身数不能超过可用素材数
    let effectiveRequired = requiredCount
    try {
      const orderInfoRows = await db.query('SELECT asset_distribute_mode FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
      const orderDistributeMode = (orderInfoRows as any[])?.[0]?.assetDistributeMode || (orderInfoRows as any[])?.[0]?.asset_distribute_mode || 'shared'
      if (orderDistributeMode === 'exclusive') {
        const assetCountRows = await db.query(
          `SELECT asset_type, COUNT(*) as cnt FROM order_assets WHERE order_id = ? AND status = 'ready' GROUP BY asset_type`,
          [orderId]
        )
        const readyImageCount = (assetCountRows as any[])?.find((a: any) => a.assetType === 'image' || a.asset_type === 'image')?.cnt || 0
        const readyVideoCount = (assetCountRows as any[])?.find((a: any) => a.assetType === 'video' || a.asset_type === 'video')?.cnt || 0
        const maxAvatarsByAssets = readyImageCount + readyVideoCount
        if (maxAvatarsByAssets > 0 && maxAvatarsByAssets < effectiveRequired) {
          effectiveRequired = maxAvatarsByAssets
          // 更新Redis中的required计数
          await this.redisService.getClient().set(redisKeyRequired, String(effectiveRequired), 'EX', OrderDispatchService.REDIS_TTL_SECONDS)
        }
      }
    } catch (err: any) {
      console.warn(`[acceptOrder] 独占模式校验失败:`, err.message)
    }

    // 1.3 原子占位：INCR递增已接单计数
    // 关键：INCR之前不做DB同步检查！
    // DB事务提交有延迟，并发时"先读DB再覆盖Redis"会导致INCR结果被覆盖，造成超卖。
    // Redis计数器仅通过INCR/DECR原子操作管理，不需要从DB同步。
    // 如果Redis计数器因重启丢失，SET NX初始化时已从DB同步过一次。

    // INCR是原子操作，返回递增后的值。如果超过名额，立即DECR回滚并拒绝
    // 这确保了即使100个请求同时到达，也只有requiredCount个能通过
    const redisRequiredCount = await this.redisService.getCounter(redisKeyRequired)
    const slotNumber = await this.redisService.getClient().incr(redisKeyAccepted)
    if (slotNumber > redisRequiredCount && redisRequiredCount > 0) {
      // 超出名额，回滚占位（DECR是原子操作，无需额外补偿）
      // 不做DB同步补偿！并发时DB事务延迟会导致补偿覆盖INCR/DECR的正确结果
      await this.redisService.getClient().decr(redisKeyAccepted)
      throw new ConflictException('名额已满，请抢其他订单')
    }


    // =====================================================
    // 第二阶段：数据库短事务（不锁orders行，仅操作dispatch_requests）
    // =====================================================
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      if (!avatarId || avatarId === 'undefined') {
        const [acceptRows1] = await conn.query(
          `SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
           FROM order_dispatch_requests r
           LEFT JOIN orders o ON r.order_id = o.id
           WHERE r.order_id = ? AND r.status = 'pending'
           LIMIT 1`,
          [orderId]
        )
        request = (acceptRows1 as any[])?.[0]
        if (!request) {
          throw new NotFoundException('暂无可接派单记录')
        }
      } else {
        const [acceptRows2] = await conn.query(
          `SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
           FROM order_dispatch_requests r
           LEFT JOIN orders o ON r.order_id = o.id
           WHERE r.avatar_id = ? AND r.order_id = ? AND r.status = 'pending'
           LIMIT 1`,
          [avatarId, orderId]
        )
        request = (acceptRows2 as any[])?.[0]
        if (request) request._isMatchedAvatar = true
      }

      if (!request && avatarId && avatarId !== 'undefined') {
        // 先获取该分身所属的用户ID（按用户判断，不是按分身）
        const [avatarRows] = await conn.query(
          `SELECT user_id FROM avatars WHERE id = ? LIMIT 1`,
          [avatarId]
        )
        const avatarUserId = (avatarRows as any[])?.[0]?.user_id
        
        if (avatarUserId) {
          // 按用户ID检查是否已接单
          const [existingDispatchRows] = await conn.query(
            `SELECT COUNT(1) as count
             FROM order_dispatch_requests
             WHERE order_id = ? AND user_id = ?`,
            [orderId, avatarUserId]
          )
          const existingCount = Number((existingDispatchRows as any[])?.[0]?.count || 0)
          if (existingCount > 0) {
            throw new ConflictException('您已接过此订单，不能重复接单')
          }
        }
      }

      // 检查该分身是否曾被踢出（expired），被踢出的分身不能再接此订单
      const [kickedDispatchRows] = await conn.query(
        `SELECT COUNT(*) as count
         FROM order_dispatch_requests
         WHERE order_id = ? AND (avatar_id = ? OR target_avatar_id = ?)
           AND status = 'expired' AND reject_reason IS NULL`,
        [orderId, avatarId, avatarId]
      )
      const kickedCount = Number((kickedDispatchRows as any[])?.[0]?.count || 0)
      if (kickedCount > 0) {
        throw new ConflictException('该分身已被踢出，不能再接此订单')
      }

      if (!request) {
        const [acceptOrderRows] = await conn.query(
          `SELECT id, title, user_id as owner_user_id, description, platforms, budget, expected_quantity, quantity_per_avatar, target_audience, status, accept_timeout
           FROM orders WHERE id = ? AND is_deleted = 0`,
          [orderId]
        )
        const order: any = (acceptOrderRows as any[])?.[0]
        if (!order) {
          throw new NotFoundException('订单不存在')
        }

        if (!avatarId || avatarId === 'undefined') {
          throw new BadRequestException('缺少分身ID')
        }

        const [avatarOwnerRows] = await conn.query(
          `SELECT id, user_id, status
           FROM avatars
           WHERE id = ?
           LIMIT 1`,
          [avatarId]
        )
        const avatarOwner: any = (avatarOwnerRows as any[])?.[0]
        if (!avatarOwner || avatarOwner.status !== 'active') {
          throw new NotFoundException('分身不存在或已失效，无法接单')
        }

        // 静默期检查：用户在静默期内不能接单
        const [silenceRows] = await conn.query(
          `SELECT silence_until FROM users WHERE id = ?`,
          [avatarOwner.user_id]
        )
        const silenceUntil = (silenceRows as any[])?.[0]?.silence_until || (silenceRows as any[])?.[0]?.silenceUntil
        if (silenceUntil && new Date(silenceUntil) > new Date()) {
          // 计算剩余静默时间并格式化
          const remainingMs = new Date(silenceUntil).getTime() - Date.now()
          let remainingText = ''
          if (remainingMs < 60 * 1000) {
            remainingText = `${Math.ceil(remainingMs / 1000)}秒`
          } else if (remainingMs < 60 * 60 * 1000) {
            remainingText = `${Math.ceil(remainingMs / (60 * 1000))}分钟`
          } else if (remainingMs < 24 * 60 * 60 * 1000) {
            remainingText = `${Math.ceil(remainingMs / (60 * 60 * 1000))}小时`
          } else {
            remainingText = `${Math.ceil(remainingMs / (24 * 60 * 60 * 1000))}天`
          }
          throw new ConflictException(`您目前处于静默期，${remainingText}后可恢复接单`)
        }

        // 接单权限校验：检查每日次数+同时接单数
        const permission = await this.subscriptionService.checkOrderPermission(avatarOwner.user_id)
        if (!permission.allowed) {
          throw new ConflictException(permission.reason)
        }

        const dispatchId = 'odr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
        try {
          // 如果订单设置了接单超时时间，计算超时截止时间
          const acceptTimeoutMinutes = order.accept_timeout ? Number(order.accept_timeout) : null
          const acceptTimeoutAt = acceptTimeoutMinutes
            ? new Date(Date.now() + acceptTimeoutMinutes * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
            : null
          
          await conn.query(
            `INSERT INTO order_dispatch_requests (id, order_id, avatar_id, user_id, platform, status, accept_timeout_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
            [
              dispatchId,
              orderId,
              avatarId,
              avatarOwner.user_id,
              Array.isArray(order.platforms) ? order.platforms[0] : (order.platforms || 'general'),
              acceptTimeoutAt,
            ]
          )
        } catch (err: any) {
          if (String(err?.code || '') === 'ER_DUP_ENTRY') {
            throw new ConflictException('该分身已接单，不能重复接单')
          }
          throw err
        }

        request = {
          id: dispatchId,
          order_id: orderId,
          avatar_id: avatarId,
          user_id: avatarOwner.user_id,
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
        const [avatarCheckRows] = await conn.query('SELECT id, status FROM avatars WHERE id = ?', [actualAvatarId])
        const avatarCheck: any = (avatarCheckRows as any[])?.[0]
        if (!avatarCheck || avatarCheck.status !== 'active') {
          throw new NotFoundException('分身不存在或已失效，无法接单')
        }
      }

      // 计算接单超时截止时间
      const acceptTimeoutAt = orderAcceptTimeout
        ? new Date(Date.now() + orderAcceptTimeout * 60 * 1000)
        : null

      const [updateResult] = await conn.query(
        `UPDATE order_dispatch_requests
         SET status = 'accepted',
             accepted_at = IFNULL(accepted_at, NOW()),
             accept_timeout_at = ?,
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = ? AND status = 'pending'`,
        [acceptTimeoutAt, request.id]
      )
      if (!updateResult || Number((updateResult as any).affectedRows || 0) !== 1) {
        const [rowCheck] = await conn.query(
          `SELECT avatar_id, status
           FROM order_dispatch_requests
           WHERE id = ?
           LIMIT 1`,
          [request.id]
        )
        const currentRow: any = (rowCheck as any[])?.[0]
        const currentAvatarId = currentRow?.avatar_id || currentRow?.avatarId
        const currentStatus = String(currentRow?.status || '').trim().toLowerCase()
        if (currentRow && currentAvatarId === actualAvatarId && ['accepted', 'completed'].includes(currentStatus)) {
          wasAlreadyAccepted = true
        } else {
          throw new ConflictException('手慢了，订单已被其他人抢走')
        }
      }

      if (!wasAlreadyAccepted) {
        // 从数据库查询当前已接单数（事务内，数据一致性保证）
        const [acceptedCountRows] = await conn.query(
          `SELECT COUNT(DISTINCT avatar_id) as count
           FROM order_dispatch_requests
           WHERE order_id = ? AND status IN ('accepted', 'completed')`,
          [orderId]
        )
        const acceptedCount = Number((acceptedCountRows as any[])?.[0]?.count || 0)

        const isMatchedAvatar = request._isMatchedAvatar === true
        const [matchedPendingRows] = await conn.query(
          `SELECT COUNT(*) as count
           FROM order_dispatch_requests
           WHERE order_id = ? AND status = 'pending'`,
          [orderId]
        )
        const matchedPendingCount = Number((matchedPendingRows as any[])?.[0]?.count || 0)
        const shouldKick = !isMatchedAvatar && (acceptedCount + matchedPendingCount) >= requiredCount
        if (shouldKick) {
          const [pendingDispatches] = await conn.query(
            `SELECT d.id, d.avatar_id, d.user_id
             FROM order_dispatch_requests d
             WHERE d.order_id = ? AND d.status = 'pending'
             ORDER BY d.created_at ASC
             LIMIT 1`,
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
            `UPDATE order_dispatch_requests
             SET status = 'expired',
                 reject_reason = '订单名额已满',
                 updated_at = NOW()
             WHERE order_id = ? AND status = 'pending'`,
            [orderId]
          )
          await conn.query(
            `UPDATE orders
             SET status = 'in_progress',
                 updated_at = NOW()
             WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
            [orderId]
          )
        }
      }

      await conn.commit()

      // INCR已在事务前完成，无需再次更新Redis
    } catch (error) {
      try {
        await conn.rollback()
      } catch {}
      // 事务失败，回滚Redis占位
      if (!wasAlreadyAccepted) {
        await this.redisService.getClient().decr(redisKeyAccepted)
      }
      throw error
    } finally {
      conn.release()
    }

    // =====================================================
    // 第四阶段：名额满时更新订单状态（Redis原子判断，不依赖事务隔离级别）
    // =====================================================
    if (slotNumber === redisRequiredCount) {
      // 我是最后一个占位成功的请求，负责更新订单状态和踢人
      try {
        // 更新订单为 in_progress
        await db.query(
          `UPDATE orders SET status = 'in_progress', updated_at = NOW() WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
          [orderId]
        )
        // 踢掉剩余的pending派单
        await db.query(
          `UPDATE order_dispatch_requests
           SET status = 'expired', reject_reason = '订单名额已满', updated_at = NOW()
           WHERE order_id = ? AND status = 'pending'`,
          [orderId]
        )
      } catch (err) {
        console.error(`[acceptOrder] 名额满后更新失败:`, err)
      }
    }

    if (!actualAvatarId) {
      throw new BadRequestException('缺少分身ID')
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
    const processingRecordBefore = await this.waitForProcessingRecord(orderId, actualAvatarId)
    if (!processingRecordBefore && !wasAlreadyAccepted) {
      this.startContentGeneration(orderId, actualAvatarId, request).catch(err => {
        console.error('[acceptOrder] 启动内容生成失败:', err)
      })
    }

    const processingRecord = processingRecordBefore || await this.waitForProcessingRecord(orderId, actualAvatarId)
    
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
   * 接单接口（使用已有的dispatchId，直接更新派单记录）
   * 适用于已有派单记录的场景
   */
  async acceptOrderWithDispatch(avatarId: string, orderId: string, dispatchId: string) {
    const db = getMySQLClient()
    const pool = getPool()
    let request: any = null
    let actualAvatarId: string | undefined = avatarId
    let requiredCount = 1
    let wasAlreadyAccepted = false

    const orderRows = await db.query(
      `SELECT id, status, is_paid, accept_timeout,accept_regions,
              GREATEST(COALESCE(NULLIF(avatar_count, 0), NULLIF(expected_quantity, 0), 1), 1) as required_count
       FROM orders
       WHERE id = ? AND is_deleted = 0`,
      [orderId]
    )
    // =====================================================
    // 第零阶段：区域限制检查
    // =====================================================
    // 获取订单的接单区域限制
    const acceptRegionsStr = (orderRows as any[])?.[0]?.acceptRegions || (orderRows as any[])?.[0]?.accept_regions
    const acceptRegions = this.safeParseJson<string[]>(acceptRegionsStr, [])

    // 如果订单有区域限制，检查分身地址是否在限制区域内
    if (acceptRegions.length > 0) {
      const avatarRows = await db.query('SELECT location_text FROM avatars WHERE id = ?', [avatarId])
      const avatarLocationText = (avatarRows as any[])?.[0]?.locationText || (avatarRows as any[])?.[0]?.location_text || ''
      
      // 提取省份（与前端逻辑一致：split(/[省市区县]/) 取第一个部分）
      const parts = avatarLocationText.split(/[省市区县]/)
      const avatarProvince = parts.length > 0 ? parts[0].trim() : ''

      this.logger.log(`[acceptOrder] 区域检查: 分身省份=${avatarProvince}, 订单区域=${JSON.stringify(acceptRegions)}`)

      // 检查分身省份是否在订单限制区域内
      const isRegionMatched = acceptRegions.some(region => 
        avatarProvince.includes(region) || region.includes(avatarProvince)
      )

      if (!isRegionMatched) {
        throw new BadRequestException(`该订单限制了接单区域：${acceptRegions.join('、')}，您的分身地址不在这些区域内，无法接单`)
      }
    }

    // 1.1 快速校验订单状态（不加锁，读最新数据即可）
    
    const orderRow: any = (orderRows as any[])?.[0]
    // db.query 内部会 convertKeysToCamel，所以 required_count → requiredCount
    requiredCount = Number(orderRow?.requiredCount || orderRow?.required_count || 1) || 1
    const orderAcceptTimeout = orderRow?.acceptTimeout || orderRow?.accept_timeout || null // 接单超时（分钟）
    if (!orderRow) {
      throw new NotFoundException('订单不存在')
    }
    
    const acceptablStatuses = ['pending', 'pending_payment', 'open', 'created', 'assigned', 'pending_acceptance', 'pending_dispatch', 'awaiting_acceptance', 'in_progress']
    if (!acceptablStatuses.includes(orderRow.status)) {
      throw new ConflictException(`订单已${orderRow.status === 'completed' ? '完成' : orderRow.status === 'cancelled' ? '取消' : '关闭'}, 无法接单`)
    }
    if (orderRow.status === 'pending_payment' && Number(orderRow.is_paid || 0) !== 1) {
      throw new BadRequestException('订单未支付，无法接单')
    }

    // 独占模式校验：分身数不能超过可用素材数
    let effectiveRequired = requiredCount
    try {
      const orderInfoRows = await db.query('SELECT asset_distribute_mode FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
      const orderDistributeMode = (orderInfoRows as any[])?.[0]?.assetDistributeMode || (orderInfoRows as any[])?.[0]?.asset_distribute_mode || 'shared'
      if (orderDistributeMode === 'exclusive') {
        const assetCountRows = await db.query(
          `SELECT asset_type, COUNT(*) as cnt FROM order_assets WHERE order_id = ? AND status = 'ready' GROUP BY asset_type`,
          [orderId]
        )
        const readyImageCount = (assetCountRows as any[])?.find((a: any) => a.assetType === 'image' || a.asset_type === 'image')?.cnt || 0
        const readyVideoCount = (assetCountRows as any[])?.find((a: any) => a.assetType === 'video' || a.asset_type === 'video')?.cnt || 0
        const maxAvatarsByAssets = readyImageCount + readyVideoCount
        if (maxAvatarsByAssets > 0 && maxAvatarsByAssets < effectiveRequired) {
          effectiveRequired = maxAvatarsByAssets
          // 更新Redis中的required计数
          await this.redisService.getClient().set(redisKeyRequired, String(effectiveRequired), 'EX', OrderDispatchService.REDIS_TTL_SECONDS)
        }
      }
    } catch (err: any) {
      console.warn(`[acceptOrder] 独占模式校验失败:`, err.message)
    }

    // =====================================================
    // 第二阶段：数据库短事务（不锁orders行，仅操作dispatch_requests）
    // =====================================================
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [acceptRows2] = await conn.query(
        `SELECT r.*, o.title as order_title, o.user_id as owner_user_id, o.description, o.platforms, o.budget, o.expected_quantity, o.quantity_per_avatar, o.target_audience
          FROM order_dispatch_requests r
          LEFT JOIN orders o ON r.order_id = o.id
          WHERE r.id = ? AND r.status = 'pending'`,
        [dispatchId]
      )
      request = (acceptRows2 as any[])?.[0]
      if (request) request._isMatchedAvatar = true
      if (!request) { 
         throw new ConflictException(`未查询到该待接订单，请核查！`)
      }
      actualAvatarId = request.avatarId || request.avatar_id || avatarId
      
      // 静默期检查：用户在静默期内不能接单
      const [silenceRows] = await conn.query(
        `SELECT silence_until FROM users WHERE id = ?`,
        [request.owner_user_id]
      )
      const silenceUntil = (silenceRows as any[])?.[0]?.silence_until || (silenceRows as any[])?.[0]?.silenceUntil
      if (silenceUntil && new Date(silenceUntil) > new Date()) {
        // 计算剩余静默时间并格式化
        const remainingMs = new Date(silenceUntil).getTime() - Date.now()
        let remainingText = ''
        if (remainingMs < 60 * 1000) {
          remainingText = `${Math.ceil(remainingMs / 1000)}秒`
        } else if (remainingMs < 60 * 60 * 1000) {
          remainingText = `${Math.ceil(remainingMs / (60 * 1000))}分钟`
        } else if (remainingMs < 24 * 60 * 60 * 1000) {
          remainingText = `${Math.ceil(remainingMs / (60 * 60 * 1000))}小时`
        } else {
          remainingText = `${Math.ceil(remainingMs / (24 * 60 * 60 * 1000))}天`
        }
        throw new ConflictException(`您目前处于静默期，${remainingText}后可恢复接单`)
      }
      // 计算接单超时截止时间
      const acceptTimeoutAt = orderAcceptTimeout
        ? new Date(Date.now() + orderAcceptTimeout * 60 * 1000)
        : null

      const [updateResult] = await conn.query(
        `UPDATE order_dispatch_requests
         SET status = 'accepted',
             accepted_at = IFNULL(accepted_at, NOW()),
             accept_timeout_at = ?,
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = ? AND status = 'pending'`,
        [acceptTimeoutAt, request.id]
      )

      await conn.commit()

      // INCR已在事务前完成，无需再次更新Redis
    } catch (error) {
      try {
        await conn.rollback()
      } catch {}
      // 事务失败，回滚Redis占位
      // if (!wasAlreadyAccepted) {
      //   await this.redisService.getClient().decr(redisKeyAccepted)
      // }
      throw error
    } finally {
      conn.release()
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
    const processingRecordBefore = await this.waitForProcessingRecord(orderId, actualAvatarId)
    if (!processingRecordBefore && !wasAlreadyAccepted) {
      this.startContentGeneration(orderId, actualAvatarId, request).catch(err => {
        console.error('[acceptOrder] 启动内容生成失败:', err)
      })
    }

    const processingRecord = processingRecordBefore || await this.waitForProcessingRecord(orderId, actualAvatarId)
    
    return {
      success: true,
      orderId,
      avatarId: actualAvatarId,
      dispatchId: request.id,
      requestId: processingRecord?.id || processingRecord?.requestId || '',
    }
  }
  /**
   * 分身婉拒订单
   */
  async declineOrder(dispatchId: string) {
    const db = getMySQLClient()
    
    const declineRows = await db.query(
      'SELECT * FROM order_dispatch_requests WHERE id = ?',
      [dispatchId]
    )
    const request = declineRows?.[0]
    
    if (!request) {
      throw new NotFoundException('分派记录不存在')
    }
    
    const wasAccepted = request.status === 'accepted'
    const wasPending = request.status === 'pending'
    const orderId = request.orderId
    const avatarId = request.avatarId

    await db.updateWhere('order_dispatch_requests', { id: dispatchId }, {
      status: 'rejected',
      responded_at: new Date(),
      updated_at: new Date()
    })
    
    // 清理订单相关的Redis缓存（accepted或pending状态都需要清理，防止缓存残留导致名额检查错误）
    if (wasAccepted || wasPending) {
      try {
        const redis = this.redisService.getClient()
        const cacheKeys = [
          `order:accept:count:${orderId}`,
          `order:accept:required:${orderId}`,
          `order:accept:lock:${orderId}`,
        ]
        for (const key of cacheKeys) {
          await redis.del(key)
          this.logger.log(`declineOrder Redis DEL: ${key}`)
        }
      } catch (redisErr) {
        this.logger.warn(`declineOrder Redis缓存清理失败(可忽略): ${(redisErr as Error).message}`)
      }
    }
    
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
    try {
      const orderInfo = await db.query('SELECT user_id, title FROM orders WHERE id = ? AND is_deleted = 0', [request.orderId])
      const order = orderInfo?.[0]

      if (order?.user_id) {
        await this.notificationService.createNotification({
          user_id: order.user_id,
          type: 'dispatch_rejected',
          title: '分身已拒绝订单',
          content: `分身"${declinedAvatarName}"已拒绝接单"${order.title || '内容创作'}"，名额已释放到订单广场。`,
          metadata: { orderId: request.orderId, avatarId: request.avatarId, avatarName: declinedAvatarName },
          created_at: new Date(),
          updated_at: new Date()
        }).catch(err => console.warn('[通知] 分身拒绝通知发送失败:', err.message))
      }
    } catch (err) {
      console.warn('[通知] 分身拒绝通知失败:', err.message)
    }
    
    return { success: true }
  }

  /**
   * 启动内容生成流程（带重试和兜底）
   */
  async startContentGeneration(orderId: string, avatarId: string, request: any, requestId?: string) {
    const MAX_RETRIES = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this._doStartContentGeneration(orderId, avatarId, request, requestId)
        return
      } catch (err: any) {
        lastError = err
        console.warn(`[startContentGeneration] 第${attempt}次尝试失败: ${err.message}`)
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * attempt))
        }
      }
    }

    console.error(`[startContentGeneration] ${MAX_RETRIES}次重试全部失败，创建兜底 failed 记录: orderId=${orderId}`)
    try {
      const db = getMySQLClient()
      const fallbackRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      await db.query(
        'UPDATE content_generation_requests SET status = ?, error = ?, updated_at = NOW() WHERE id = ?',
        ['failed', `内容生成启动失败(${MAX_RETRIES}次重试): ${lastError?.message || '未知错误'}`, fallbackRequestId]
      )
    } catch (fallbackErr: any) {
      console.error('[startContentGeneration] 创建兜底记录也失败:', fallbackErr.message)
    }
  }

  /**
   * 实际执行内容生成
   */
  private async _doStartContentGeneration(orderId: string, avatarId: string, request: any, requestId?: string) {
    // 提前生成 requestId，用于独占模式标记 assigned_to
    const effectiveRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const db = getMySQLClient()
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new NotFoundException(`订单不存在: ${orderId}`)
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

    // 获取订单素材池中已就绪的素材（含等待机制）
    const assignedImages: string[] = []
    let assignedVideoUrl: string | undefined
    const assetDistributeMode = order.assetDistributeMode || order.asset_distribute_mode || 'shared'
    try {
      const db2 = getMySQLClient()
      
      // 第一步：查询是否有任何素材记录（包括generating/pending）
      // 注意：getMySQLClient().query() 返回直接的行数组（已转camelCase），不是 [rows, fields] 元组
      const anyAssetRows = await db2.query(
        'SELECT COUNT(*) as cnt FROM order_assets WHERE order_id = ?',
        [orderId]
      )
      const hasAssets = (anyAssetRows as any[])?.[0]?.cnt > 0
      
      if (hasAssets) {
        // 第二步：查已就绪的素材（包含id和assigned_to用于独占模式）
        let readyAssets = await db2.query(
          'SELECT id, asset_type, asset_url, assigned_to FROM order_assets WHERE order_id = ? AND status = \'ready\' ORDER BY sort_order ASC',
          [orderId]
        ) as any[]
        
        let readyImageCount = readyAssets?.filter((a: any) => a.assetType === 'image').length || 0
        let readyVideoCount = readyAssets?.filter((a: any) => a.assetType === 'video').length || 0
        
        // 第三步：如果还有pending/generating的素材，轮询等待（最多60秒）
        const hasPendingRows = await db2.query(
          'SELECT COUNT(*) as cnt FROM order_assets WHERE order_id = ? AND status IN (\'pending\', \'generating\')',
          [orderId]
        )
        const pendingCount = (hasPendingRows as any[])?.[0]?.cnt || 0
        
        const orderContentType = order.content_type || order.contentType || 'image_text'
        let orderRequirements: any = {}
        try {
          orderRequirements = typeof order.requirements === 'string' ? JSON.parse(order.requirements) : (order.requirements || {})
        } catch { orderRequirements = {} }
        const orderAiAutoFill = orderRequirements?.ai_auto_fill !== false

        // 素材等待逻辑：
        // - 不开AI补齐：有就绪素材即可（等最多15秒），不需要凑满默认数量
        // - 开AI补齐：需要凑满默认数量
        const defaultImageCount = orderContentType === 'video' ? 0 : this.contentGenerationService.getDefaultImageCount(normalizedPlatforms[0] || 'wechat', orderContentType)
        const defaultVideoCount = orderContentType === 'video' ? 1 : 0
        
        if (pendingCount > 0) {
          // 需要等待的场景：
          // 1. 没有任何就绪图片/视频
          // 2. 开AI补齐且就绪素材数量不足默认数量
          const needMoreImages = orderAiAutoFill && readyImageCount < defaultImageCount
          const needMoreVideos = orderAiAutoFill && orderContentType === 'video' && readyVideoCount < defaultVideoCount
          
          if (readyImageCount === 0 || needMoreImages || needMoreVideos) {
            const isVideoOrder = orderContentType === 'video'
            const maxWaitMs = isVideoOrder ? 600000 : 60000
            const pollIntervalMs = isVideoOrder ? 5000 : 3000
            const startTime = Date.now()
            
            while (Date.now() - startTime < maxWaitMs) {
              await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
              
              readyAssets = await db2.query(
                'SELECT id, asset_type, asset_url, assigned_to FROM order_assets WHERE order_id = ? AND status = \'ready\' ORDER BY sort_order ASC',
                [orderId]
              ) as any[]
              
              readyImageCount = readyAssets?.filter((a: any) => a.assetType === 'image').length || 0
              readyVideoCount = readyAssets?.filter((a: any) => a.assetType === 'video').length || 0
              
              // 退出条件：
              // - 开AI补齐：就绪数量已满足默认需求
              // - 不开AI补齐：有至少1张就绪素材且已等超过15秒（给pending素材留准备时间）
              const imagesEnough = !orderAiAutoFill || readyImageCount >= defaultImageCount
              const videosEnough = orderContentType !== 'video' || !orderAiAutoFill || readyVideoCount >= defaultVideoCount
              if ((imagesEnough && videosEnough) || ((readyImageCount > 0 || readyVideoCount > 0) && Date.now() - startTime > 15000)) {
                break
              }
              
              // 检查是否还有pending的
              const stillPendingRows = await db2.query(
                'SELECT COUNT(*) as cnt FROM order_assets WHERE order_id = ? AND status IN (\'pending\', \'generating\')',
                [orderId]
              )
              if ((stillPendingRows as any[])?.[0]?.cnt === 0) break
            }
          }
        }
        
        // 第四步：分配就绪素材（根据分配模式）
        if (readyAssets && readyAssets.length > 0) {
          // 计算独占模式下每个分身的素材上限
          const totalImageAssets = readyAssets.filter((a: any) => a.assetType === 'image').length
          const totalVideoAssets = readyAssets.filter((a: any) => a.assetType === 'video').length
          const avatarCount = order.avatarCount || order.avatar_count || 1
          const maxImagesPerAvatar = assetDistributeMode === 'exclusive' ? Math.ceil(totalImageAssets / avatarCount) : 9
          const maxVideosPerAvatar = assetDistributeMode === 'exclusive' ? Math.ceil(totalVideoAssets / avatarCount) : 1

          if (assetDistributeMode === 'exclusive') {
            // 独占模式：每个素材只能分配给一个分身，每个分身最多分配 maxImagesPerAvatar / maxVideosPerAvatar
            // 使用原子性 UPDATE + affectedRows 确保并发安全
            const unassignedAssets = readyAssets.filter((a: any) => !a.assignedTo)
            for (const asset of unassignedAssets) {
              if (asset.assetType === 'image' && assignedImages.length < maxImagesPerAvatar) {
                // 原子性占位：只有 assigned_to 为 NULL 时才能更新成功
                const updateResult = await db2.query(
                  'UPDATE order_assets SET assigned_to = ? WHERE id = ? AND assigned_to IS NULL',
                  [effectiveRequestId, asset.id]
                )
                const affected = (updateResult as any)?.affectedRows || (updateResult as any)?.[0]?.affectedRows || 0
                if (affected > 0) {
                  assignedImages.push(asset.assetUrl)
                }
              } else if (asset.assetType === 'video' && !assignedVideoUrl && maxVideosPerAvatar > 0) {
                const updateResult = await db2.query(
                  'UPDATE order_assets SET assigned_to = ? WHERE id = ? AND assigned_to IS NULL',
                  [effectiveRequestId, asset.id]
                )
                const affected = (updateResult as any)?.affectedRows || (updateResult as any)?.[0]?.affectedRows || 0
                if (affected > 0) {
                  assignedVideoUrl = asset.assetUrl
                }
              }
            }
          } else {
            // 共享模式：所有分身拿到同样素材
            for (const asset of readyAssets) {
              if (asset.assetType === 'image' && assignedImages.length < 9) {
                assignedImages.push(asset.assetUrl)
              } else if (asset.assetType === 'video' && !assignedVideoUrl) {
                assignedVideoUrl = asset.assetUrl
              }
            }
          }
        }
        
      }
    } catch (err: any) {
      console.warn('[startContentGeneration] 获取订单素材失败:', err.message)
    }

    // 调用内容生成服务
    // 读取自定义文案配置
    let orderRequirements: any = {}
    try {
      orderRequirements = typeof order.requirements === 'string' ? JSON.parse(order.requirements) : (order.requirements || {})
    } catch { orderRequirements = {} }
    const useCustomCopywriting = !!orderRequirements?.use_custom_copywriting
    const customCopywriting = orderRequirements?.custom_copywriting || ''

    await this.contentGenerationService.generateContent({
      orderId,
      avatarId,
      orderTitle: request.order_title || order.title || '内容生成',
      orderDescription: request.description || order.description || '',
      platforms: normalizedPlatforms,
      contentType: order.content_type || order.contentType || 'image_text',
      // simple类型不需要AI生成内容，直接标记ready
      skipGeneration: (order.content_type || order.contentType) === 'simple',
      targetAudience: request.target_audience || order.targetAudience || '年轻用户',
      contentQuantity: request.quantityPerAvatar || request.quantity_per_avatar || order.quantityPerAvatar || order.quantity_per_avatar || 1,
      avatarName,
      avatarPersonality,
      avatarSkills,
      contentStyles,
      nicheTags,
      preferredStyles,
      industryTags,
      requestId: effectiveRequestId,
      assignedImages: assignedImages.length > 0 ? assignedImages : undefined,
      assignedVideoUrl,
      useCustomCopywriting,
      customCopywriting,
    })

  }

  /**
   * 根据订单ID获取订单信息
   */
  private async getOrderById(orderId: string): Promise<any | null> {
    const db = getMySQLClient()
    const orderRows3 = await db.query('SELECT * FROM orders WHERE id = ? AND is_deleted = 0', [orderId])
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
    
    const dispatchRows = await db.query(
      `SELECT r.*, o.title, o.status as order_status, o.budget, o.created_at as order_created_at
       FROM order_dispatch_requests r
       INNER JOIN orders o ON r.order_id = o.id
       WHERE r.avatar_id = ? AND r.status IN ('accepted', 'completed')
       ORDER BY r.updated_at DESC`,
      [avatarId]
    )

    const deduped = []
    const seen = new Set<string>()
    for (const row of dispatchRows || []) {
      const oid = row.orderId || row.order_id
      const aid = row.avatarId || row.avatar_id
      const key = `${oid}_${aid}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(row)
    }

    const orderIds = [...new Set(deduped.map((r: any) => r.orderId || r.order_id).filter(Boolean))]
    const contentMap = new Map<string, any>()
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(', ')
      const contentRows = await db.query(
        `SELECT id, order_id, avatar_id, status, content_type, updated_at, created_at
         FROM content_generation_requests
         WHERE order_id IN (${placeholders}) AND avatar_id = ?
         ORDER BY updated_at DESC, created_at DESC`,
        [...orderIds, avatarId]
      )
      for (const cr of contentRows || []) {
        const oid = cr.orderId || cr.order_id
        const aid = cr.avatarId || cr.avatar_id
        const key = `${oid}_${aid}`
        if (!contentMap.has(key)) contentMap.set(key, cr)
      }
    }

    return deduped.map((row: any) => {
      const oid = row.orderId || row.order_id
      const aid = row.avatarId || row.avatar_id
      const content = contentMap.get(`${oid}_${aid}`)
      const normalized = content ? normalizeFulfillmentStatus(content.status) : null
      const derivedStatus =
        normalized === 'settled'
          ? 'completed'
          : normalized
            ? normalized
            : normalizeDispatchStatusV2(row.status)

      const contentRequestId = content?.id || null
      return {
        ...row,
        dispatch_id: row.id,
        dispatchId: row.id,
        request_id: contentRequestId,
        requestId: contentRequestId,
        id: contentRequestId || row.id,
        status: derivedStatus,
        order_status: row.orderStatus || row.order_status,
        content_status: content?.status || null,
        content_type: content?.contentType || content?.content_type || row.contentType || row.content_type,
      }
    })
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
      throw new NotFoundException('订单不存在')
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
      if (userPhone) {
        try {
          const smsResult = await this.smsService.sendSms(
            userPhone,
            'SMS_505555078',
            { name: avatar.name }
          )
          
          if (smsResult) {
            smsSentCount++
          }
        } catch (err) {
          console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
        }
      } else {
      }
      
      notifiedCount++
    }
    
    return { count: notifiedCount, smsSentCount }
  }

  /**
   * 踢出超时分身（发单者操作）
   * 条件：分身已接单超过5分钟且未提交反馈
   */
  async kickAvatar(orderId: string, avatarId: string, operatorUserId: string) {
    const db = getMySQLClient()

    // 1. 验证订单存在且操作者是发单方
    const orders = await db.query('SELECT id, user_id, status FROM orders WHERE id = ?', [orderId])
    const order = orders?.[0]
    if (!order) {
      return { success: false, message: '订单不存在' }
    }
    const orderUserId = order.user_id || order.userId
    if (orderUserId !== operatorUserId) {
      return { success: false, message: '只有发单方可以踢出分身' }
    }

    // 2. 验证该分身确实已接单
    const dispatchRows = await db.query(
      `SELECT id, status, accepted_at, updated_at, created_at, target_avatar_id, user_id 
      FROM order_dispatch_requests WHERE order_id = ? AND (target_avatar_id = ? OR avatar_id = ?)
      AND status in ( 'accepted', 'pending')`,
      [orderId, avatarId, avatarId]
    )
    const dispatch = dispatchRows?.[0]
    if (!dispatch) {
      return { success: false, message: '该分身未接单或已不在接单状态' }
    }

    // 3. 检查是否超过5分钟（优先用 accepted_at，备选 updated_at / created_at）
    const acceptedTimeStr = dispatch.acceptedAt || dispatch.updatedAt || dispatch.createdAt
    const acceptedAt = acceptedTimeStr ? new Date(acceptedTimeStr) : null
    if (!acceptedAt || isNaN(acceptedAt.getTime())) {
      // accepted_at 为空且无备选，视为数据异常，允许踢出
      console.log(`[kickAvatar] 分身 ${avatarId} 的 accepted_at 为空，视为可踢出`)
    } else {
      const now = new Date()
      const minutesElapsed = (now.getTime() - acceptedAt.getTime()) / (1000 * 60)
      if (minutesElapsed < 5) {
        return { success: false, message: `接单未满5分钟（已${Math.floor(minutesElapsed)}分钟），无法踢出` }
      }
    }

    // 4. 检查是否已提交反馈（submitted/settled 状态不允许踢出）
    const cgrRows = await db.query(
      `SELECT id, status FROM content_generation_requests WHERE order_id = ? AND avatar_id = ? AND status IN ('submitted', 'settled')`,
      [orderId, avatarId]
    )
    if (cgrRows?.length > 0) {
      return { success: false, message: '该分身已提交反馈，无法踢出' }
    }

    // 5. 执行踢出：更新 dispatch_request 状态为 expired，记录 kick_type
    await db.query(
      `UPDATE order_dispatch_requests SET status = 'expired', kick_type = 'manual_kick', reject_reason = '发单者手动踢出', updated_at = NOW() WHERE id = ?`,
      [dispatch.id]
    )

    // 6. 取消该分身的内容生成请求
    await db.query(
      `UPDATE content_generation_requests SET status = 'cancelled', updated_at = NOW() WHERE order_id = ? AND avatar_id = ? AND status NOT IN ('submitted', 'settled')`,
      [orderId, avatarId]
    )

    // 7. 释放该分身占用的素材（独占模式下 assigned_to 指向 content_generation_request.id）
    const cgrRecords = await db.query(
      `SELECT id FROM content_generation_requests WHERE order_id = ? AND avatar_id = ? LIMIT 1`,
      [orderId, avatarId]
    )
    const cgrId = cgrRecords?.[0]?.id
    if (cgrId) {
      const releaseResult = await db.query(
        `UPDATE order_assets SET assigned_to = NULL WHERE order_id = ? AND assigned_to = ?`,
        [orderId, cgrId]
      )
      this.logger.log(`释放素材: orderId=${orderId}, cgrId=${cgrId}, 释放${(releaseResult as any)?.affectedRows || 0}条素材`)
    }

    // 8. 设置用户静默期（按用户，不按分身）
    const silenceDurationMs = parseInt(process.env.ORDER_SILENCE_DURATION_MS || '86400000', 10)
    const silenceUntil = new Date(Date.now() + silenceDurationMs)
    await db.query(
      `UPDATE users SET silence_until = ? WHERE id = ? AND (silence_until IS NULL OR silence_until < ?)`,
      [silenceUntil, dispatch.userId || dispatch.user_id, silenceUntil]
    )
    this.logger.log(`手动踢出: 用户 ${dispatch.userId || dispatch.user_id} 静默期至 ${silenceUntil.toISOString()}`)

    // 9. 发送通知给被踢出的用户
    try {
      const notificationService = new NotificationService()
      // 获取订单标题用于通知
      let orderTitle = ''
      try {
        const [orderRows] = await db.query(
          `SELECT title FROM orders WHERE id = ? LIMIT 1`,
          [orderId]
        )
      
        // 处理不同的返回格式
        const rawRows = (orderRows as any)
        let orderRow = null
        if (Array.isArray(rawRows)) {
          orderRow = rawRows[0]
        } else if (rawRows?.data && Array.isArray(rawRows.data)) {
          orderRow = rawRows.data[0]
        } else if (rawRows?.title) {
          // rawRows 本身就是单条记录
          orderRow = rawRows
        }
        if (orderRow?.title) {
          orderTitle = orderRow.title
        }
      } catch (orderErr) {
        this.logger.warn(`获取订单标题失败: ${(orderErr as Error).message}`)
      }

      // 计算静默期文本（支持秒、分钟、小时、天）
      let silenceText = ''
      if (silenceDurationMs < 60 * 1000) {
        silenceText = `${Math.round(silenceDurationMs / 1000)}秒`
      } else if (silenceDurationMs < 60 * 60 * 1000) {
        silenceText = `${Math.round(silenceDurationMs / (60 * 1000))}分钟`
      } else if (silenceDurationMs < 24 * 60 * 60 * 1000) {
        silenceText = `${Math.round(silenceDurationMs / (60 * 60 * 1000))}小时`
      } else {
        silenceText = `${Math.round(silenceDurationMs / (24 * 60 * 60 * 1000))}天`
      }
      console.log('orderTitle2:', orderTitle)
      await notificationService.createNotification({
        user_id: dispatch.userId || dispatch.user_id,
        type: 'manual_kick',
        title: '您已被踢出订单',
        content: `您在订单「${orderTitle}」中被发单者踢出。${silenceText}内无法接单。`,
        metadata: { orderId, avatarId }
      })
      this.logger.log(`手动踢出: 已发送通知给用户 ${dispatch.userId || dispatch.user_id}`)
    } catch (notifyErr) {
      this.logger.warn(`手动踢出: 发送通知失败 ${(notifyErr as Error).message}`)
    }

    // 6.5 释放Redis已接单计数器
    const redisKeyAccepted = `order:accept:count:${orderId}`
    try {
      const currentCount = await this.redisService.getClient().decr(redisKeyAccepted)
      this.logger.log(`Redis DECR: key=${redisKeyAccepted}, 释放后计数=${currentCount}`)
      // 注意：不做DB同步补偿。并发时DB事务延迟会导致补偿覆盖DECR的正确结果
    } catch (redisErr) {
      this.logger.warn(`Redis DECR失败(可忽略): ${(redisErr as Error).message}`)
    }

    this.logger.log(`踢出分身: orderId=${orderId}, avatarId=${avatarId}`)

    // // 7. 检查是否有 pending 状态的分身可以自动接单
    // const pendingDispatches = await db.query(
    //   `SELECT id, target_avatar_id FROM order_dispatch_requests WHERE order_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1`,
    //   [orderId]
    // )

    // let autoAcceptedAvatar = null
    // if (pendingDispatches?.length > 0) {
    //   const pending = pendingDispatches[0]
    //   // 将 pending 分身自动接单
    //   await db.query(
    //     `UPDATE order_dispatch_requests SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE id = ?`,
    //     [pending.id]
    //   )
    //   // 自动接单也需要 INCR Redis 计数器
    //   try {
    //     const afterIncr = await this.redisService.getClient().incr(redisKeyAccepted)
    //     this.logger.log(`自动接单 Redis INCR: key=${redisKeyAccepted}, 计数=${afterIncr}`)
    //     // 注意：不做DB同步补偿。并发时DB事务延迟会导致补偿覆盖INCR的正确结果
    //   } catch (redisErr2) {
    //     this.logger.warn(`自动接单 Redis INCR失败(可忽略): ${(redisErr2 as Error).message}`)
    //   }
    //   autoAcceptedAvatar = pending.targetAvatarId
    //   this.logger.log(`自动接单: avatarId=${autoAcceptedAvatar}, orderId=${orderId}`)
    // }

    return {
      success: true,
      message: '已踢出超时分身，名额已释放',
    }
  }
}
