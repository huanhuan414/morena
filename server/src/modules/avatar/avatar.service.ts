// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { Config } from 'coze-coding-dev-sdk'
import { LLMClient, ImageGenerationClient, VideoGenerationClient } from 'coze-coding-dev-sdk'
import * as crypto from 'crypto'

// 测试用户ID列表
const TEST_USER_IDS = ['dev_user', 'test_user', 'guest-user-id', 'anonymous']

@Injectable()
export class AvatarService {
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
    
    const db = getMySQLClient()
    const { 
      name, 
      photo, 
      tags, 
      voice_type, 
      voice_url, 
      preset_voice_id, 
      abilities 
    } = avatarData

    // 构建 personality JSON
    const personality = JSON.stringify({
      tags: tags || [],
      abilities: abilities || {}
    })

    const insertData = {
      user_id: effectiveUserId || 'dev_user', // 统一使用传入的 userId
      name,
      description: '',
      avatar_url: photo || '',
      personality,
      skills: '{}',
      config: '{}',
      voice_id: preset_voice_id || voice_type || 'preset',
      status: voice_type === 'clone' ? 'training' : 'active',
    }

    console.log('[AvatarService] 创建分身，用户ID:', effectiveUserId, '数据:', insertData)
    
    const result = await db.insert('avatars', insertData)
    
    console.log('[AvatarService] 插入结果:', result)

    if ((result as any)?.data?.affectedRows > 0) {
      const avatarId = (result as any)?.data?.insertId
      
      // 如果是原声复刻，触发声音训练任务
      if (voice_type === 'clone' && voice_url) {
        console.log(`触发声音复刻训练任务，avatarId: ${avatarId}, voiceUrl: ${voice_url}`)
      }

      return { success: true, id: avatarId, data: avatarData }
    }
    return { success: false, error: '创建分身失败' }
  }

  /**
   * 获取用户的所有分身
   * @param userId - 用户ID（从 x-user-id header 获取）
   */
  async getUserAvatars(userId?: string) {
    const db = getMySQLClient()
    let rows: any[]
    
    // 统一用户ID规范
    const isTestUser = userId && TEST_USER_IDS.includes(userId)
    
    // 有效用户ID：非空且非测试用户ID
    const hasValidUserId = userId && userId.trim() && !isTestUser
    
    if (hasValidUserId) {
      // 有效用户：只查询该用户自己的分身
      console.log('[AvatarService] 查询用户分身，userId:', userId)
      const result = await db.select('avatars', { user_id: userId })
      rows = result.data || []
    } else if (isTestUser) {
      // 测试用户：返回所有分身（开发环境）
      console.log('[AvatarService] 测试用户，返回所有分身')
      const result = await db.query(`SELECT * FROM avatars WHERE status = 'active' ORDER BY created_at DESC LIMIT 50`)
      rows = Array.isArray(result) ? result : (result?.data || [])
    } else {
      // 无用户ID：返回空
      console.log('[AvatarService] 无效用户ID，返回空列表')
      rows = []
    }
    
    // 格式化返回数据
    const avatars = rows.map((avatar: any) => {
      let personality = {}
      
      try {
        personality = typeof avatar.personality === 'string' 
          ? JSON.parse(avatar.personality) 
          : avatar.personality || {}
      } catch (e) {
        console.error('解析 avatar 数据失败:', e)
      }

      return {
        ...avatar,
        photo: avatar.avatar_url || '', // 使用 avatar_url 列
        tags: personality.tags || [],
        abilities: personality.abilities || {},
        voice_type: avatar.voice_type || 'preset',
        voice_url: avatar.voice_url || ''
      }
    })
    
    return { success: true, data: avatars }
  }

  /**
   * 获取分身详情
   */
  async getAvatarById(avatarId: number) {
    const db = getMySQLClient()
    const result = await db.queryOne('avatars', { id: avatarId })
    
    if (!result?.data) {
      return { success: false, error: '分身不存在' }
    }

    const avatar = result.data
    let personality = {}
    
    try {
      personality = typeof avatar.personality === 'string' 
        ? JSON.parse(avatar.personality) 
        : avatar.personality || {}
    } catch (e) {
      console.error('解析 avatar 数据失败:', e)
    }

    return { 
      success: true, 
      data: {
        ...avatar,
        photo: avatar.avatar_url || '',
        tags: personality.tags || [],
        abilities: personality.abilities || {},
        voice_type: avatar.voice_type || 'preset',
        voice_url: avatar.voice_url || ''
      }
    }
  }

  /**
   * 更新分身信息
   */
  async updateAvatar(avatarId: number, updateData: any) {
    const db = getMySQLClient()
    
    // 处理嵌套的 JSON 字段
    const formattedData: any = {}
    
    if (updateData.name) formattedData.name = updateData.name
    if (updateData.avatar_url || updateData.photo) formattedData.avatar_url = updateData.avatar_url || updateData.photo
    if (updateData.description) formattedData.description = updateData.description
    
    if (updateData.tags || updateData.abilities) {
      const existing = await db.queryOne('avatars', { id: avatarId })
      if (existing?.data) {
        let existingPersonality = {}
        
        try {
          existingPersonality = typeof existing.data.personality === 'string' 
            ? JSON.parse(existing.data.personality) 
            : existing.data.personality || {}
        } catch (e) {}

        formattedData.personality = JSON.stringify({
          ...existingPersonality,
          tags: updateData.tags,
          abilities: updateData.abilities
        })
      }
    }
    
    const result = await db.updateWhere('avatars', { id: avatarId }, formattedData)
    return { success: (result as any)?.data?.affectedRows > 0, data: updateData }
  }

  /**
   * 删除分身
   */
  async deleteAvatar(avatarId: number, userId: string) {
    const db = getMySQLClient()
    const result = await db.delete('avatars', { id: avatarId, user_id: userId })
    return { success: (result as any)?.data?.affectedRows > 0 }
  }

  /**
   * 添加分身技能
   */
  async addSkill(avatarId: number, skillData: any) {
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
  async getSkills(avatarId: number) {
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
  async addMemory(avatarId: number, memoryData: any) {
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
  async getMemories(avatarId: number) {
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
  async getStats(avatarId: number) {
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
  async getVoiceCloneStatus(avatarId: number) {
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
    const total = countResult?.data?.[0]?.total || 0

    const listResult = await db.query(
      `SELECT * FROM avatars WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    )

    return {
      success: true,
      data: {
        list: listResult.data || [],
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
}
