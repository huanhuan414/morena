// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { Config, LLMClient, ImageGenerationClient, VideoGenerationClient } from 'coze-coding-dev-sdk'
import * as crypto from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getSharedCache } from '../../common/shared-cache'
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service'
import { sharedMemoryAvatars } from '../user-stats/user-stats.service'

// 测试用户ID列表
const TEST_USER_IDS = ['dev_user', 'test_user', 'guest-user-id', 'anonymous']

@Injectable()
export class AvatarService {
  constructor(private readonly reverseGeocodingService: ReverseGeocodingService) {}
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
    // 统一用户ID规范：必须有有效的用户ID
    const effectiveUserId = userId && !TEST_USER_IDS.includes(userId) ? userId : userId
    
    if (!effectiveUserId) {
      console.warn('[AvatarService] 创建分身时userId为空，使用默认测试ID')
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
      created_at: now,
      updated_at: now
    }

    // 尝试使用数据库
    try {
      const db = getMySQLClient()
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
      }

      console.log('[AvatarService] 创建分身，用户ID:', effectiveUserId, '数据:', insertData)
      const result = await db.insert('avatars', insertData)
      
      console.log('[AvatarService] 插入结果:', result)

      // 检查是否有错误
      if (result.error) {
        console.warn('[AvatarService] 数据库插入失败，使用内存缓存:', result.error.message)
        // 使用内存缓存
        const userAvatars = sharedMemoryAvatars.get(effectiveUserId) || []
        userAvatars.unshift(newAvatar)
        sharedMemoryAvatars.set(effectiveUserId, userAvatars)
        
        // 同步到全局共享缓存（供 UserStatsService 使用）
        const sharedCache = getSharedCache()
        const cacheKey = `avatars_${effectiveUserId}`
        const cachedAvatars = sharedCache.get(cacheKey) || []
        cachedAvatars.unshift(newAvatar)
        sharedCache.set(cacheKey, cachedAvatars)
        
        return { success: true, id, data: newAvatar }
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
        
        return { success: true, id: (result as any)?.data?.insertId, data: newAvatar }
      }
      
      return { success: false, error: '创建分身失败' }
    } catch (error) {
      console.warn('[AvatarService] 数据库不可用，使用内存缓存:', error.message)
      // 使用内存缓存
      const userAvatars = sharedMemoryAvatars.get(effectiveUserId) || []
      userAvatars.unshift(newAvatar)
      sharedMemoryAvatars.set(effectiveUserId, userAvatars)
      
      // 同步到全局共享缓存（供 UserStatsService 使用）
      const sharedCache = getSharedCache()
      const cacheKey = `avatars_${effectiveUserId}`
      const cachedAvatars = sharedCache.get(cacheKey) || []
      cachedAvatars.unshift(newAvatar)
      sharedCache.set(cacheKey, cachedAvatars)
      
      return { success: true, id, data: newAvatar }
    }
  }

  /**
   * 获取用户的所有分身
   * @param userId - 用户ID（从 x-user-id header 获取）
   */
  async getUserAvatars(userId?: string) {
    let rows: any[] = []
    
    // 统一用户ID规范
    const isTestUser = userId && TEST_USER_IDS.includes(userId)
    
    // 有效用户ID：非空且非测试用户ID
    const hasValidUserId = userId && userId.trim() && !isTestUser
    
    // 尝试使用数据库
    try {
      const db = getMySQLClient()
      
      if (hasValidUserId) {
        // 有效用户：只查询该用户自己的分身（直接使用SQL，数据库列名是驼峰userId）
        console.log('[AvatarService] 查询用户分身，userId:', userId)
        const result = await db.query(`SELECT * FROM avatars WHERE user_id = ?`, [userId])
        rows = Array.isArray(result) ? result : (result?.data || [])
      } else if (isTestUser) {
        // 测试用户：返回所有分身（开发环境）
        console.log('[AvatarService] 测试用户，返回所有分身')
        const result = await db.query(`SELECT * FROM avatars WHERE status = 'active' ORDER BY created_at DESC LIMIT 50`)
        rows = Array.isArray(result) ? result : (result?.data || [])
      } else {
        // 无用户ID：返回空
        rows = []
      }
      
      // 存入内存缓存
      if (hasValidUserId && userId) {
        sharedMemoryAvatars.set(userId, rows)
      }
    } catch (error) {
      console.warn('[AvatarService] 数据库不可用，使用内存缓存')
      // 使用内存缓存
      if (hasValidUserId && userId) {
        rows = sharedMemoryAvatars.get(userId) || []
      } else {
        rows = []
      }
    }
    
    // 格式化返回数据（query已转换为驼峰，需转回蛇形兼容前端）
    const avatars = rows.map((avatar: any) => {
      const personality = this.safeParseJson(avatar.personality, {})
      const config = this.safeParseJson(avatar.config, {})
      const trustEnabled = this.resolveTrustEnabled(avatar)

      // 如果没有头像，生成默认头像（使用 PNG 格式，兼容小程序）
      const defaultAvatarUrl = avatar.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(avatar.name || avatar.id)}&size=200`

      return {
        ...avatar,
        config,
        avatar_url: defaultAvatarUrl, // 蛇形兼容前端
        photo: defaultAvatarUrl,
        avatarUrl: defaultAvatarUrl, // 驼峰格式也加上
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
        avatar_url: avatar.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(avatar.name || avatarId)}&size=200`, // 蛇形兼容前端
        photo: avatar.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(avatar.name || avatarId)}&size=200`,
        avatarUrl: avatar.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(avatar.name || avatarId)}&size=200`,
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
   * 删除分身
   */
  async deleteAvatar(avatarId: string, userId: string) {
    const db = getMySQLClient()
    const result = await db.delete('avatars', { id: avatarId, user_id: userId })
    return { success: (result as any)?.data?.affectedRows > 0 }
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
}
