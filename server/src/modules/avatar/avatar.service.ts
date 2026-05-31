// @ts-nocheck
import { Injectable, Inject } from '@nestjs/common'
import { Config, LLMClient, ImageGenerationClient, VideoGenerationClient } from 'coze-coding-dev-sdk'
import * as crypto from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getSharedCache } from '../../common/shared-cache'
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service'
import { sharedMemoryAvatars } from '../user-stats/user-stats.service'
import { ReferralService } from '../referral/referral.service'
import { SubscriptionService } from '../subscription/subscription.service'

// 测试用户ID列表
const TEST_USER_IDS = ['dev_user', 'test_user', 'guest-user-id', 'anonymous']

@Injectable()
export class AvatarService {
  constructor(
    @Inject(ReverseGeocodingService) private readonly reverseGeocodingService: ReverseGeocodingService,
    @Inject(ReferralService) private readonly referralService: ReferralService,
    @Inject(SubscriptionService) private readonly subscriptionService: SubscriptionService,
  ) {}
  private avatarColumnsCache: Set<string> | null = null

  private hasOwnKey(obj: any, key: string) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key)
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return normalized === '1' || normalized === 'true'
    }
    return false
  }

  private resolveTrustEnabled(avatar: any): boolean {
    return this.parseBoolean(
      avatar?.isHosted
      ?? avatar?.is_hosted
      ?? avatar?.trustEnabled
      ?? avatar?.trust_enabled
    )
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

  private async buildHostingTrustUpdate(trustEnabled: boolean): Promise<Record<string, any>> {
    const columns = await this.getAvatarTableColumns()
    const updateData: Record<string, any> = {}
    const hostingFlag = trustEnabled ? 1 : 0

    if (columns.has('is_hosted')) {
      updateData.is_hosted = hostingFlag
    }

    if (columns.has('trust_enabled')) {
      updateData.trust_enabled = hostingFlag
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('avatars 表缺少托管状态字段，请先补齐 is_hosted 或 trust_enabled 列')
    }

    return updateData
  }

  private safeParseJson<T = any>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return value as T
    if (typeof value !== 'string') return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  /**
   * 创建分身
   * @param userId - 用户ID（从 x-user-id header 获取）
   */
  async createAvatar(userId: string, avatarData: any) {
    const effectiveUserId = userId && !TEST_USER_IDS.includes(userId) ? userId : userId
    const isTestUser = effectiveUserId && TEST_USER_IDS.includes(effectiveUserId)
    
    if (!effectiveUserId) {
      console.warn('[AvatarService] 创建分身时userId为空，使用默认测试ID')
    }
    
    // 分身数量限制校验
    if (effectiveUserId && !isTestUser) {
      try {
        const benefits = await this.subscriptionService.getMembershipBenefits(effectiveUserId)
        console.log(`[AvatarService] 获取权益结果:`, JSON.stringify(benefits))
        
        const db = getMySQLClient()
        console.log(`[AvatarService] 查询分身数量: userId=${effectiveUserId}`)
        
        const [countRows] = await db.query(
          'SELECT COUNT(*) as cnt FROM avatars WHERE user_id = ? AND status = "active"',
          [effectiveUserId]
        ) as any[]
        console.log(`[AvatarService] 查询结果原始:`, JSON.stringify(countRows))
        
        // countRows 可能是数组或对象，兼容处理
        const currentCount = Number(
          countRows?.cnt || 
          countRows?.[0]?.cnt || 
          countRows?.[0]?.Cnt || 
          0
        )
        console.log(`[AvatarService] 分身数量检查: userId=${effectiveUserId}, 当前=${currentCount}, 限制=${benefits.avatarLimit}`)
        
        if (currentCount >= benefits.avatarLimit) {
          throw new Error(`分身数量已达上限(${benefits.avatarLimit}个)，请升级套餐或删除现有分身`)
        }
      } catch (err: any) {
        // 所有错误都重新抛出，包括查询失败
        console.error('[AvatarService] 分身数量校验失败:', err.message)
        throw err
      }
    }
    
    // 生成 UUID 作为 id
    const id = `avatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    const newAvatar = {
      id,
      user_id: effectiveUserId || 'dev_user',
      name: avatarData.name,
      description: avatarData.description || '',
      avatar_url: avatarData.photo || avatarData.avatar_url || '',
      personality: JSON.stringify({ tags: avatarData.tags || [], abilities: avatarData.abilities || {} }),
      skills: JSON.stringify(avatarData.selectedSkills || []),
      content_styles: JSON.stringify(avatarData.contentStyles || []),
      niche_tags: JSON.stringify(avatarData.nicheTags || []),
      config: '{}',
      voice_id: avatarData.preset_voice_id || avatarData.voice_type || 'preset',
      status: avatarData.voice_type === 'clone' ? 'training' : 'active',
      gender: avatarData.gender,
      birthday: avatarData.birthday,
      identity: avatarData.identity,
      location_text: avatarData.location,
      latitude: avatarData.latitude,
      longitude: avatarData.longitude,
      created_at: now,
      updated_at: now
    }

    // 尝试使用数据库
    try {
      const db = getMySQLClient()

      // 确保用户存在于 users 表，避免外键约束报错
      if (effectiveUserId && !TEST_USER_IDS.includes(effectiveUserId)) {
        try {
          const userResult = await db.query('SELECT id FROM users WHERE id = ?', [effectiveUserId])
          const userRow = (userResult as any)?.data?.[0] || (Array.isArray(userResult) ? (userResult as any)[0] : null)
          if (!userRow) {
            console.warn('[AvatarService] 用户不存在于users表，自动创建, userId:', effectiveUserId)
            await db.query(
              'INSERT IGNORE INTO users (id, openid, nickname, level, exp, credits, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0, NOW(), NOW())',
              [effectiveUserId, `auto_${effectiveUserId}`, avatarData.name ? `用户${avatarData.name.slice(0, 2)}` : `用户${effectiveUserId.slice(0, 6)}`]
            )
          }
        } catch (userErr: any) {
          console.warn('[AvatarService] 检查/创建用户记录失败:', userErr.message)
        }
      }

      let isFirstAvatar = false
      try {
        const countResult = await db.query('SELECT COUNT(*) as count FROM avatars WHERE user_id = ?', [effectiveUserId || 'dev_user'])
        const row = (countResult as any)?.data?.[0] || (Array.isArray(countResult) ? (countResult as any)[0] : null)
        const count = Number(row?.count ?? row?.['COUNT(*)'] ?? 0)
        isFirstAvatar = count === 0
      } catch {}

      const insertData = {
        id,
        user_id: effectiveUserId || 'dev_user',
        name: avatarData.name,
        description: '',
        avatar_url: avatarData.photo || '',
        personality: JSON.stringify({ tags: avatarData.tags || [], abilities: avatarData.abilities || {} }),
        skills: JSON.stringify(avatarData.selectedSkills || []),
        content_styles: JSON.stringify(avatarData.contentStyles || []),
        niche_tags: JSON.stringify(avatarData.nicheTags || []),
        config: '{}',
        voice_id: avatarData.preset_voice_id || avatarData.voice_type || 'preset',
        status: avatarData.voice_type === 'clone' ? 'training' : 'active',
        gender: avatarData.gender,
        birthday: avatarData.birthday,
        identity: avatarData.identity,
        location_text: avatarData.location,
        latitude: avatarData.latitude,
        longitude: avatarData.longitude,
      }

      const columns = await this.getAvatarTableColumns()
      const filteredInsertData = Object.fromEntries(
        Object.entries(insertData)
          .filter(([key, value]) => value !== undefined && columns.has(String(key).toLowerCase()))
      )
      const result = await db.insert('avatars', filteredInsertData)
      

      // 检查是否有错误
      if (result.error) {
        if (isTestUser) {
          console.warn('[AvatarService] 测试用户数据库插入失败，使用内存缓存:', result.error.message)
          const userAvatars = sharedMemoryAvatars.get(effectiveUserId) || []
          userAvatars.unshift(newAvatar)
          sharedMemoryAvatars.set(effectiveUserId, userAvatars)

          const sharedCache = getSharedCache()
          const cacheKey = `avatars_${effectiveUserId}`
          const cachedAvatars = sharedCache.get(cacheKey) || []
          cachedAvatars.unshift(newAvatar)
          sharedCache.set(cacheKey, cachedAvatars)

          return { success: true, id, data: newAvatar }
        }

        console.warn('[AvatarService] 数据库插入失败:', result.error.message)
        return { success: false, error: result.error.message || '创建分身失败', data: null }
      }

      if ((result as any)?.data?.affectedRows > 0) {
        // 存入内存缓存
        const userAvatars = sharedMemoryAvatars.get(effectiveUserId) || []
        userAvatars.unshift(newAvatar)
        sharedMemoryAvatars.set(effectiveUserId, userAvatars)

        // 同步到全局共享缓存（供 UserStatsService 使用）
        const sharedCache = getSharedCache()
        const cacheKey = `avatars_${effectiveUserId}`
        const cachedAvatars = sharedCache.get(cacheKey) || []
        cachedAvatars.unshift(newAvatar)
        sharedCache.set(cacheKey, cachedAvatars)

        try {
          if (isFirstAvatar && this.referralService?.settleReferralOnFirstAvatar) {
            await this.referralService.settleReferralOnFirstAvatar(effectiveUserId)
          }
        } catch (e) {
          console.error('[AvatarService] settleReferralOnFirstAvatar failed:', (e as any)?.message || e)
        }

        return { success: true, id: (result as any)?.data?.insertId, data: newAvatar }
      }
      
      return { success: false, error: '创建分身失败' }
    } catch (error) {
      if (isTestUser) {
        console.warn('[AvatarService] 测试用户数据库不可用，使用内存缓存:', error.message)
        const userAvatars = sharedMemoryAvatars.get(effectiveUserId) || []
        userAvatars.unshift(newAvatar)
        sharedMemoryAvatars.set(effectiveUserId, userAvatars)

        const sharedCache = getSharedCache()
        const cacheKey = `avatars_${effectiveUserId}`
        const cachedAvatars = sharedCache.get(cacheKey) || []
        cachedAvatars.unshift(newAvatar)
        sharedCache.set(cacheKey, cachedAvatars)

        return { success: true, id, data: newAvatar }
      }

      console.warn('[AvatarService] 数据库不可用:', error.message)
      return { success: false, error: error.message || '创建分身失败', data: null }
    }
  }

  /**
   * 获取用户的所有分身
   * @param userId - 用户ID（从 x-user-id header 获取）
   */
  async getUserAvatars(userId?: string) {
    let rows: any[] = []
    
    const isTestUser = userId && TEST_USER_IDS.includes(userId)
    const hasValidUserId = userId && userId.trim() && !isTestUser
    
    try {
      const db = getMySQLClient()
      
      if (hasValidUserId) {
        const result = await db.query(`SELECT * FROM avatars WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC`, [userId])
        rows = Array.isArray(result) ? result : (result?.data || [])
      } else if (isTestUser) {
        const result = await db.query(`SELECT * FROM avatars WHERE status = 'active' ORDER BY created_at DESC LIMIT 50`)
        rows = Array.isArray(result) ? result : (result?.data || [])
      } else {
        rows = []
      }
      
      if (hasValidUserId && userId) {
        sharedMemoryAvatars.set(userId, rows)
      }
    } catch (error) {
      console.warn('[AvatarService] 数据库不可用，使用内存缓存')
      if (hasValidUserId && userId) {
        rows = sharedMemoryAvatars.get(userId) || []
      } else {
        rows = []
      }
    }
    
    const avatarIds = rows.map((a: any) => a.id || a.avatarId)
    let earningsMap: Record<string, { total: number; today: number }> = {}
    
    
    if (avatarIds.length > 0) {
      try {
        const db = getMySQLClient()
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const idList = avatarIds.map(id => `'${id}'`).join(', ')
        
        const earningsRows = await db.query(
          `SELECT 
            avatar_id,
            SUM(amount) as total_earnings,
            SUM(CASE WHEN created_at >= ? THEN amount ELSE 0 END) as today_earnings
           FROM earnings 
           WHERE avatar_id IN (${idList}) AND status IN ('settled', 'completed')
           GROUP BY avatar_id`,
          [today]
        )
        
        
        const earningsData = Array.isArray(earningsRows) ? earningsRows : (earningsRows?.data || [])
        for (const e of earningsData) {
          const avatarId = e.avatarId || e.avatar_id
          earningsMap[avatarId] = {
            total: Number(e.totalEarnings || e.total_earnings) || 0,
            today: Number(e.todayEarnings || e.today_earnings) || 0
          }
        }
      } catch (error) {
        console.warn('[AvatarService] 查询收益失败:', error)
      }
    }
    
    const avatars = rows.map((avatar: any) => {
      const personality = this.safeParseJson(avatar.personality, {})
      const config = this.safeParseJson(avatar.config, {})
      const trustEnabled = this.resolveTrustEnabled(avatar)
      const avatarId = avatar.id || avatar.avatarId
      const earnings = earningsMap[avatarId] || { total: 0, today: 0 }

      const defaultAvatarUrl = avatar.avatarUrl || avatar.avatar_url || avatar.photo || process.env.DEFAULT_AVATAR_URL || ''

      return {
        ...avatar,
        config,
        avatar_url: defaultAvatarUrl,
        photo: defaultAvatarUrl,
        avatarUrl: defaultAvatarUrl,
        tags: personality.tags || [],
        abilities: personality.abilities || {},
        trust_enabled: trustEnabled,
        is_hosted: trustEnabled,
        isHosted: trustEnabled,
        location_text: avatar.locationText || avatar.location_text || '',
        locationText: avatar.locationText || avatar.location_text || '',
        latitude: avatar.latitude ?? null,
        longitude: avatar.longitude ?? null,
        voice_type: avatar.voiceType || 'preset',
        voice_url: avatar.voiceUrl || '',
        totalEarnings: earnings.total,
        todayEarnings: earnings.today
      }
    })
    
    return { success: true, data: avatars }
  }

  /**
   * 获取分身详情
   */
  async getAvatarById(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.queryOne('avatars', { id: avatarId })
    
    if (!result?.data) {
      return { success: false, error: '分身不存在' }
    }

    const avatar = result.data
    const personality = this.safeParseJson(avatar.personality, {})
    const config = this.safeParseJson(avatar.config, {})
    const trustEnabled = this.resolveTrustEnabled(avatar)

    return { 
      success: true, 
      data: {
        ...avatar,
        config,
        avatar_url: avatar.avatarUrl || avatar.avatar_url || avatar.photo || process.env.DEFAULT_AVATAR_URL || '',
        photo: avatar.avatarUrl || avatar.avatar_url || avatar.photo || process.env.DEFAULT_AVATAR_URL || '',
        avatarUrl: avatar.avatarUrl || avatar.avatar_url || avatar.photo || process.env.DEFAULT_AVATAR_URL || '',
        tags: personality.tags || [],
        abilities: personality.abilities || {},
        trust_enabled: trustEnabled,
        is_hosted: trustEnabled,
        isHosted: trustEnabled,
        location_text: avatar.locationText || avatar.location_text || '',
        locationText: avatar.locationText || avatar.location_text || '',
        latitude: avatar.latitude ?? null,
        longitude: avatar.longitude ?? null,
        voice_type: avatar.voiceType || 'preset',
        voice_url: avatar.voiceUrl || ''
      }
    }
  }

  /**
   * 更新分身信息
   */
  async updateAvatar(avatarId: string, updateData: any) {
    const db = getMySQLClient()
    const existing = await db.queryOne('avatars', { id: avatarId })

    if (!existing?.data) {
      return { success: false, error: '分身不存在', data: null }
    }

    const existingRow = existing.data
    const formattedData: any = {}

    if (this.hasOwnKey(updateData, 'name')) formattedData.name = updateData.name
    if (this.hasOwnKey(updateData, 'avatarUrl') || this.hasOwnKey(updateData, 'photo') || this.hasOwnKey(updateData, 'avatar_url')) {
      formattedData.avatar_url = updateData.avatarUrl || updateData.photo || updateData.avatar_url || ''
    }
    if (this.hasOwnKey(updateData, 'description')) formattedData.description = updateData.description

    // 设置页 config 更新（落库）
    if (this.hasOwnKey(updateData, 'config')) {
      const existingConfig = this.safeParseJson(existingRow.config, {})
      const incomingConfig = this.safeParseJson(updateData.config, {})
      formattedData.config = JSON.stringify({
        ...existingConfig,
        ...incomingConfig
      })
    }

    // 设置页 personality 更新（落库）
    if (this.hasOwnKey(updateData, 'personality')) {
      formattedData.personality = typeof updateData.personality === 'string'
        ? updateData.personality
        : JSON.stringify(updateData.personality || {})
    }

    if (this.hasOwnKey(updateData, 'tags') || this.hasOwnKey(updateData, 'abilities')) {
      const existingPersonality = this.safeParseJson(existingRow.personality, {})
      const mergedPersonality = {
        ...existingPersonality
      }
      if (this.hasOwnKey(updateData, 'tags')) {
        mergedPersonality.tags = updateData.tags
      }
      if (this.hasOwnKey(updateData, 'abilities')) {
        mergedPersonality.abilities = updateData.abilities
      }
      formattedData.personality = JSON.stringify(mergedPersonality)
    }

    // 设置页 location 更新（落库）
    const hasLatitude = this.hasOwnKey(updateData, 'latitude')
    const hasLongitude = this.hasOwnKey(updateData, 'longitude')
    const hasLocationText = this.hasOwnKey(updateData, 'location_text') || this.hasOwnKey(updateData, 'locationText')

    if (hasLatitude) formattedData.latitude = updateData.latitude
    if (hasLongitude) formattedData.longitude = updateData.longitude

    if (hasLocationText) {
      formattedData.location_text = updateData.location_text || updateData.locationText || ''
    } else if (hasLatitude && hasLongitude && Number.isFinite(Number(updateData.latitude)) && Number.isFinite(Number(updateData.longitude))) {
      try {
        const geo = await this.reverseGeocodingService.reverseGeocode(Number(updateData.latitude), Number(updateData.longitude))
        formattedData.location_text = geo.formatted_address || geo.full_location_text || ''
      } catch (error) {
        console.warn('[AvatarService] 逆地理编码失败，回退为经纬度文本:', error?.message || error)
        formattedData.location_text = `${Number(updateData.latitude).toFixed(6)}, ${Number(updateData.longitude).toFixed(6)}`
      }
    }

    if (Object.keys(formattedData).length === 0) {
      return { success: true, data: null }
    }

    const result = await db.updateWhere('avatars', { id: avatarId }, formattedData)
    const success = (result as any)?.data?.affectedRows > 0

    return {
      success,
      data: success
        ? {
            id: avatarId,
            ...formattedData
          }
        : null
    }
  }

  /**
   * 删除分身（级联清理所有关联数据）
   */
  async deleteAvatar(avatarId: string, userId: string) {
    const db = getMySQLClient()

    // 1. 先验证分身归属
    const avatars = await db.query('SELECT id FROM avatars WHERE id = ? AND user_id = ?', [avatarId, userId]) as any[]
    if (avatars.length === 0) {
      return { success: false, error: '分身不存在或无权删除' }
    }

    // 2. 级联清理：将关联的 pending dispatch 标记为 cancelled
    try {
      await db.query(
        `UPDATE order_dispatch_requests SET status = 'cancelled', updated_at = NOW() WHERE avatar_id = ? AND status = 'pending'`,
        [avatarId]
      )
    } catch (e) {
      console.warn('[AvatarService] 取消待接单dispatch失败:', e.message)
    }

    // 3. 级联清理：删除 avatar_skills
    try {
      await db.query('DELETE FROM avatar_skills WHERE avatar_id = ?', [avatarId])
    } catch (e) {
      console.warn('[AvatarService] 删除分身技能失败:', e.message)
    }

    // 4. 级联清理：删除 avatar_notifications
    try {
      await db.query('DELETE FROM avatar_notifications WHERE avatar_id = ?', [avatarId])
    } catch (e) {
      console.warn('[AvatarService] 删除分身通知失败:', e.message)
    }

    // 5. 级联清理：删除 avatar_memories
    try {
      await db.query('DELETE FROM avatar_memories WHERE avatar_id = ?', [avatarId])
    } catch (e) {
      console.warn('[AvatarService] 删除分身记忆失败:', e.message)
    }

    // 6. 先删除分身本体（数据库操作）
    const result = await db.delete('avatars', { id: avatarId, user_id: userId })
    const affectedRows = (result as any)?.data?.affectedRows || 0
    if (affectedRows === 0) {
      console.error('[AvatarService] 分身删除失败，未匹配到记录:', avatarId, 'userId:', userId)
      return { success: false, error: '分身删除失败，请重试' }
    }

    // 7. 数据库删除成功后，再清理内存缓存
    const userAvatars = sharedMemoryAvatars.get(userId) || []
    sharedMemoryAvatars.set(userId, userAvatars.filter(a => a.id !== avatarId))

    // 同时清理全局共享缓存（供 UserStatsService 使用）
    const sharedCache = getSharedCache()
    const cacheKey = `avatars_${userId}`
    const cachedAvatars = sharedCache.get(cacheKey) || []
    sharedCache.set(cacheKey, cachedAvatars.filter((a: any) => a.id !== avatarId))

    return { success: true }
  }

  /**
   * 添加分身技能
   */
  async addSkill(avatarId: string, skillData: any) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_skills', {
      avatar_id: avatarId,
      skill_name: skillData.skill_name,
      skill_description: skillData.skill_description,
      skill_config: skillData.skill_config || '{}',
      status: 'active',
      created_at: new Date()
    })
    return { success: (result as any)?.data?.affectedRows > 0, id: (result as any)?.data?.insertId }
  }

  /**
   * 获取分身技能列表
   */
  async getSkills(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.select('avatar_skills', { avatar_id: avatarId })
    return { success: true, data: result.data || [] }
  }

  /**
   * 删除分身技能
   */
  async deleteSkill(skillId: number) {
    const db = getMySQLClient()
    const result = await db.delete('avatar_skills', { id: skillId })
    return { success: (result as any)?.data?.affectedRows > 0 }
  }

  /**
   * 添加分身记忆
   */
  async addMemory(avatarId: string, memoryData: any) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_memories', {
      avatar_id: avatarId,
      memory_type: memoryData.memory_type,
      memory_content: memoryData.memory_content,
      importance: memoryData.importance || 5,
      created_at: new Date()
    })
    return { success: (result as any)?.data?.affectedRows > 0, id: (result as any)?.data?.insertId }
  }

  /**
   * 获取分身记忆列表
   */
  async getMemories(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.select('avatar_memories', { avatar_id: avatarId })
    return { success: true, data: result.data || [] }
  }

  /**
   * 删除分身记忆
   */
  async deleteMemory(memoryId: number) {
    const db = getMySQLClient()
    const result = await db.delete('avatar_memories', { id: memoryId })
    return { success: (result as any)?.data?.affectedRows > 0 }
  }

  /**
   * 获取分身统计数据
   */
  async getStats(avatarId: string) {
    const db = getMySQLClient()
    const [fans, posts, likes, comments] = await Promise.all([
      db.count('follows', { avatar_id: avatarId }),
      db.count('posts', { avatar_id: avatarId }),
      db.count('likes', { avatar_id: avatarId }),
      db.count('comments', { avatar_id: avatarId })
    ])
    return {
      success: true,
      data: {
        fans_count: fans || 0,
        posts_count: posts || 0,
        likes_count: likes || 0,
        comments_count: comments || 0
      }
    }
  }

  /**
   * 声音复刻状态查询
   */
  async getVoiceCloneStatus(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.queryOne('avatars', { id: avatarId })
    
    if (!result?.data) {
      return { success: false, error: '分身不存在' }
    }

    const avatar = result.data
    return {
      success: true,
      data: {
        avatar_id: avatarId,
        status: avatar.status, // 'training' | 'active' | 'failed'
        voice_type: avatar.voice_type,
        is_cloning: avatar.voice_type === 'clone' && avatar.status === 'training'
      }
    }
  }

  /**
   * 获取分身列表（分页）
   */
  async getAvatarList(params: {
    page?: number;
    pageSize?: number;
    gender?: string;
    ageGroup?: string;
    search?: string;
  }) {
    const db = getMySQLClient()
    const { page = 1, pageSize = 10, gender, ageGroup, search } = params
    const offset = (page - 1) * pageSize

    let where = '1=1'
    const values: any[] = []

    if (gender) {
      where += ' AND gender = ?'
      values.push(gender)
    }
    if (search) {
      where += ' AND (name LIKE ? OR description LIKE ?)'
      values.push(`%${search}%`, `%${search}%`)
    }

    const countResult = await db.query(`SELECT COUNT(*) as total FROM avatars WHERE ${where}`, values)
    const countArray = Array.isArray(countResult) ? countResult : (countResult?.data || [])
    const total = countArray[0]?.total || 0

    const listResult = await db.query(
      `SELECT * FROM avatars WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    )
    const listArray = Array.isArray(listResult) ? listResult : (listResult?.data || [])

    return {
      success: true,
      data: {
        list: listArray,
        total,
        page,
        pageSize
      }
    }
  }

  /**
   * 搜索分身
   */
  async searchAvatars(keyword: string) {
    const db = getMySQLClient()
    const result = await db.query(
      `SELECT * FROM avatars WHERE name LIKE ? OR description LIKE ? LIMIT 20`,
      [`%${keyword}%`, `%${keyword}%`]
    )
    return { success: true, data: result.data || [] }
  }

  /**
   * 更新单个分身托管状态
   */
  async updateTrust(avatarId: string, trustEnabled: boolean) {
    const db = getMySQLClient()
    
    // 先查询分身确保存在
    const avatar = await db.query(`SELECT * FROM avatars WHERE id = ?`, [avatarId])
    const avatars = Array.isArray(avatar) ? avatar : (avatar?.data || [])
    
    if (avatars.length === 0) {
      throw new Error('分身不存在')
    }

    const updateData = await this.buildHostingTrustUpdate(trustEnabled)
    await db.updateWhere('avatars', { id: avatarId }, updateData)
    return { success: true }
  }

  /**
   * 批量更新用户所有分身的托管状态
   */
  async enableAllTrust(userId: string, trustEnabled: boolean) {
    const db = getMySQLClient()
    
    // 统一用户ID规范
    const isTestUser = userId && TEST_USER_IDS.includes(userId)
    const hasValidUserId = userId && userId.trim() && !isTestUser
    
    if (!hasValidUserId) {
      throw new Error('无效的用户ID')
    }

    const updateData = await this.buildHostingTrustUpdate(trustEnabled)
    await db.updateWhere('avatars', { user_id: userId }, updateData)
    return { success: true }
  }

  /**
   * 更新分身托管配置（存入 avatars.config.hosting_settings）
   */
  async updateHostingSettings(avatarId: string, settings: Record<string, any>) {
    const db = getMySQLClient()
    const existing = await db.queryOne('avatars', { id: avatarId })

    if (!existing?.data) {
      throw new Error('分身不存在')
    }

    const existingConfig = this.safeParseJson(existing.data.config, {})
    const currentHostingSettings = this.safeParseJson(existingConfig.hosting_settings, {})
    const mergedHostingSettings = {
      ...currentHostingSettings,
      ...settings
    }
    const mergedConfig = {
      ...existingConfig,
      hosting_settings: mergedHostingSettings
    }

    const result = await db.updateWhere('avatars', { id: avatarId }, {
      config: JSON.stringify(mergedConfig)
    })

    return {
      success: (result as any)?.data?.affectedRows > 0,
      data: {
        id: avatarId,
        hosting_settings: mergedHostingSettings,
        config: mergedConfig
      }
    }
  }

  /**
   * 获取分身托管配置
   */
  async getHostingSettings(avatarId: string) {
    const db = getMySQLClient()
    const existing = await db.queryOne('avatars', { id: avatarId })

    if (!existing?.data) {
      throw new Error('分身不存在')
    }

    const config = this.safeParseJson(existing.data.config, {})
    const trustEnabled = this.resolveTrustEnabled(existing.data)
    return {
      success: true,
      data: {
        id: avatarId,
        trust_enabled: trustEnabled,
        is_hosted: trustEnabled,
        isHosted: trustEnabled,
        hosting_settings: this.safeParseJson(config.hosting_settings, {})
      }
    }
  }

  // ==================== 账号管理 ====================

  async getAccounts(avatarId: string) {
    const db = await getMySQLClient()
    const results = await db.query('avatar_accounts', { avatar_id: avatarId })
    if (!results || results.length === 0) return []
    return results.map(r => this.normalizeAccount(r))
  }

  async getAccountsByUserId(userId: string) {
    const db = await getMySQLClient()
    const results = await db.query('avatar_accounts', { user_id: userId })
    if (!results || results.length === 0) return []
    return results.map(r => this.normalizeAccount(r))
  }

  async createAccount(data: Record<string, any>) {
    const db = await getMySQLClient()
    const id = `acct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // 如果没有 avatar_id，自动使用用户的第一个分身
    let avatarId: string | null = data.avatar_id || null
    const userId = data.user_id || null
    if (!avatarId && userId) {
      const [rows] = await db.query(
        'SELECT id FROM avatars WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
        [userId]
      )
      if (Array.isArray(rows) && rows.length > 0) {
        avatarId = rows[0].id
      }
    }

    const record = {
      id,
      avatar_id: avatarId,
      user_id: userId,
      platform: data.platform || '',
      account_name: data.account_name || '',
      followers: data.followers || 0,
      total_exposure: data.total_exposure || 0,
      total_works: data.total_works || 0,
      avg_likes_per_work: data.avg_likes_per_work || 0,
      avg_comments_per_work: data.avg_comments_per_work || 0,
      avg_shares_per_work: data.avg_shares_per_work || 0,
      appid: data.appid || null,
      appkey: data.appkey || null,
      account_url: data.account_url || null,
      extra_info: data.extra_info || null,
      platform_user_id: data.platform_user_id || null,
      status: 'active',
    }
    const insertResult = await db.insert('avatar_accounts', record)
    if (insertResult.error) {
      throw new Error(`创建账号失败: ${insertResult.error.message || insertResult.error}`)
    }
    return this.normalizeAccount(record)
  }

  async updateAccount(id: string, data: Record<string, any>) {
    const db = await getMySQLClient()
    const updateData: Record<string, any> = { updated_at: new Date() }

    // Only update fields that are provided
    const updatableFields = [
      'user_id', 'platform', 'account_name', 'followers', 'total_exposure', 'total_works',
      'avg_likes_per_work', 'avg_comments_per_work', 'avg_shares_per_work',
      'appid', 'appkey', 'account_url', 'extra_info', 'platform_user_id', 'status',
    ]

    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field]
      }
    }

    await db.update('avatar_accounts', id, updateData)

    // Return updated record
    const results = await db.query('avatar_accounts', { id })
    if (results && results.length > 0) {
      return this.normalizeAccount(results[0])
    }
    return { id, ...updateData }
  }

  async deleteAccount(id: string) {
    const db = await getMySQLClient()
    await db.delete('avatar_accounts', id)
    return { success: true }
  }

  private normalizeAccount(record: any) {
    if (!record) return null
    return {
      id: record.id,
      avatarId: record.avatar_id || record.avatarId,
      avatar_id: record.avatar_id || record.avatarId,
      platform: record.platform,
      accountName: record.account_name || record.accountName || '',
      account_name: record.account_name || record.accountName || '',
      followers: record.followers || 0,
      totalExposure: record.total_exposure || record.totalExposure || 0,
      total_exposure: record.total_exposure || record.totalExposure || 0,
      totalWorks: record.total_works || record.totalWorks || 0,
      total_works: record.total_works || record.totalWorks || 0,
      avgLikesPerWork: record.avg_likes_per_work || record.avgLikesPerWork || 0,
      avg_likes_per_work: record.avg_likes_per_work || record.avgLikesPerWork || 0,
      avgCommentsPerWork: record.avg_comments_per_work || record.avgCommentsPerWork || 0,
      avg_comments_per_work: record.avg_comments_per_work || record.avgCommentsPerWork || 0,
      avgSharesPerWork: record.avg_shares_per_work || record.avgSharesPerWork || 0,
      avg_shares_per_work: record.avg_shares_per_work || record.avgSharesPerWork || 0,
      appid: record.appid || '',
      appkey: record.appkey || '',
      accountUrl: record.account_url || record.accountUrl || '',
      account_url: record.account_url || record.accountUrl || '',
      extraInfo: record.extra_info || record.extraInfo || '',
      extra_info: record.extra_info || record.extraInfo || '',
      status: record.status || 'active',
      createdAt: record.created_at || record.createdAt,
      updatedAt: record.updated_at || record.updatedAt,
    }
  }

  /**
   * 发布内容到微信公众号草稿箱
   * 1. 用 appid + appkey 获取 access_token
   * 2. 上传图片到微信素材库（获取 media_id）
   * 3. 将图片 URL 替换为微信素材 URL
   * 4. 调用新建草稿接口
   */
  async publishWechatDraft(params: {
    accountId: string
    title: string
    content: string
    imageUrls?: string[]
    digest?: string
  }) {
    const { accountId, title, content, imageUrls = [], digest } = params

    // 1. 获取账号信息
    const db = await getMySQLClient()
    const accounts = await db.query('avatar_accounts', { id: accountId })
    if (!accounts || accounts.length === 0) {
      throw new Error('账号不存在')
    }
    const account = accounts[0]
    const appid = account.appid
    const appsecret = account.appkey

    if (!appid || !appsecret) {
      throw new Error('缺少 AppID 或 AppSecret，请先完善公众号配置')
    }


    // 2. 获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    if (tokenData.errcode) {
      console.error('[微信发布] 获取access_token失败:', tokenData)
      throw new Error(`获取access_token失败: ${tokenData.errmsg} (errcode: ${tokenData.errcode})`)
    }
    const accessToken = tokenData.access_token

    // 3. 上传图片到微信素材库（thumb_media_id 用于封面）
    let thumbMediaId = ''
    let processedContent = content

    if (imageUrls.length > 0) {
      // 上传第一张图作为封面（thumb）
      try {
        const thumbResult = await this.uploadWechatMedia(accessToken, imageUrls[0], 'thumb')
        thumbMediaId = thumbResult.media_id
      } catch (err) {
        console.error('[微信发布] 封面上传失败:', err.message)
        // 封面失败不阻断，继续发布
      }

      // 上传所有图片到微信素材库，替换 content 中的图片 URL
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const imgResult = await this.uploadWechatMedia(accessToken, imageUrls[i], 'image')
          if (imgResult.url) {
            // 替换 content 中的图片 URL 为微信素材 URL
            processedContent = processedContent.replace(imageUrls[i], imgResult.url)
          }
        } catch (err) {
          console.error(`[微信发布] 图片${i + 1}上传失败:`, err.message)
        }
      }
    }

    // 4. 如果没有封面图，生成一张默认封面并上传
    if (!thumbMediaId) {
      try {
        const defaultThumb = await this.generateDefaultThumb(accessToken, title)
        thumbMediaId = defaultThumb
      } catch (err) {
        console.error('[微信发布] 默认封面生成失败:', err.message)
      }
    }

    // 4. 处理 HTML 内容
    // 将 Markdown 格式内容转换为微信兼容的 HTML
    processedContent = this.convertToWechatHtml(processedContent)

    // 5. 调用新建草稿接口
    const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`
    const draftBody = {
      articles: [{
        title: title || '无标题',
        author: '',
        digest: digest || title || '',
        content: processedContent,
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
      }]
    }

    const draftRes = await fetch(draftUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftBody),
    })
    const draftData = await draftRes.json()

    if (draftData.errcode && draftData.errcode !== 0) {
      console.error('[微信发布] 创建草稿失败:', draftData)
      throw new Error(`创建草稿失败: ${draftData.errmsg} (errcode: ${draftData.errcode})`)
    }

    const mediaId = draftData.media_id

    return {
      mediaId,
      thumbMediaId,
      message: '已成功发布到公众号草稿箱',
    }
  }

  /**
   * 上传图片到微信素材库
   */
  private async uploadWechatMedia(accessToken: string, imageUrl: string, type: 'thumb' | 'image') {
    // 1. 下载图片
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      throw new Error(`下载图片失败: HTTP ${imgRes.status}`)
    }
    const imgBuffer = await imgRes.arrayBuffer()
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

    // 2. 上传到微信
    const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=${type}`
    const filename = type === 'thumb' ? 'thumb.jpg' : 'image.jpg'

    const formData = new FormData()
    const blob = new Blob([imgBuffer], { type: contentType })
    formData.append('media', blob, filename)

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })
    const uploadData = await uploadRes.json()

    if (uploadData.errcode) {
      throw new Error(`上传素材失败: ${uploadData.errmsg}`)
    }

    return uploadData
  }

  /**
   * 将 Markdown/文本内容转换为微信兼容的 HTML
   * 微信公众号编辑器支持有限的 HTML 标签
   */
  private convertToWechatHtml(text: string): string {
    if (!text) return ''

    let html = text

    // 处理标题 (# ## ###)
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:bold;margin:20px 0 10px;color:#333">$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:bold;margin:24px 0 12px;color:#333">$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:bold;margin:28px 0 14px;color:#333">$1</h1>')

    // 处理加粗 (**text**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:bold;color:#333">$1</strong>')

    // 处理斜体 (*text*)
    html = html.replace(/\*(.+?)\*/g, '<em style="font-style:italic">$1</em>')

    // 处理无序列表 (- item)
    html = html.replace(/^- (.+)$/gm, '<p style="padding-left:20px;margin:6px 0;color:#555">• $1</p>')

    // 处理有序列表 (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<p style="padding-left:20px;margin:6px 0;color:#555">$1</p>')

    // 处理分割线 (---)
    html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>')

    // 处理段落（连续换行）
    html = html.replace(/\n\n/g, '</p><p style="margin:12px 0;line-height:1.8;color:#555">')
    html = html.replace(/\n/g, '<br/>')

    // 包裹在容器中
    html = `<section style="padding:10px;font-size:15px;line-height:1.8;color:#555"><p style="margin:12px 0;line-height:1.8;color:#555">${html}</p></section>`

    // 清理残留的 markdown 标记
    html = html.replace(/\[IMG_\d+\]/g, '')
    html = html.replace(/\[IMG\d+\]/g, '')

    return html
  }

  /**
   * 生成默认封面图并上传到微信
   * 使用图片生成API创建一个简单的封面图
   */
  private async generateDefaultThumb(accessToken: string, title: string): Promise<string> {
    // 方案1: 使用图片生成API创建封面
    try {
      const imageApiKey = process.env.IMAGE_API_KEY || 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK'
      const imageApiUrl = process.env.IMAGE_API_URL || 'https://api.aaigc.top/v1/images/generations'
      const imageModel = process.env.IMAGE_MODEL || 'gpt-image-2'

      const prompt = `微信公众号文章封面图，简约大气的设计风格，渐变蓝色背景，中央有装饰性几何图形，无文字，尺寸900x383像素，专业杂志风格`


      const imgRes = await fetch(imageApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${imageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: prompt,
          n: 1,
          size: '1024x1024',
        }),
      })

      const imgData = await imgRes.json()
      if (imgData.data && imgData.data[0]) {
        const imageUrl = imgData.data[0].url || (imgData.data[0].b64_json ? `data:image/png;base64,${imgData.data[0].b64_json}` : null)
        if (imageUrl) {
          // 下载并上传到微信
          const uploadResult = await this.uploadWechatMedia(accessToken, imageUrl, 'thumb')
          return uploadResult.media_id
        }
      }
    } catch (err) {
      console.error('[微信发布] 图片API生成封面失败:', err.message)
    }

    // 方案2: 创建一个最简单的1x1像素PNG并上传
    try {
      // 最小合法PNG文件 (1x1 透明像素)
      const minimalPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      const blob = new Blob([minimalPng], { type: 'image/png' })
      const formData = new FormData()
      formData.append('media', blob, 'thumb.png')

      const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=thumb`
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (uploadData.media_id) {
        return uploadData.media_id
      }
      throw new Error(uploadData.errmsg || '上传默认封面失败')
    } catch (err) {
      console.error('[微信发布] 上传默认封面失败:', err.message)
      throw err
    }
  }
}
