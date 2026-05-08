// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { Config } from 'coze-coding-dev-sdk'
import { LLMClient, ImageGenerationClient, VideoGenerationClient } from 'coze-coding-dev-sdk'
import * as crypto from 'crypto'

@Injectable()
export class AvatarService {
  /**
   * 创建分身
   */
  async createAvatar(userId: string, avatarData: any) {
    const db = getMySQLClient()
    const { name, description, personality, appearance, voice_id, gender, age } = avatarData

    const result = await db.insert('avatars', {
      user_id: userId,
      name,
      description,
      personality: personality || '{}',
      appearance: appearance || '{}',
      voice_id,
      gender,
      age,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    })

    if ((result as any)?.affectedRows > 0) {
      return { success: true, id: (result as any)?.insertId, data: avatarData }
    }
    return { success: false, error: '创建分身失败' }
  }

  /**
   * 获取用户的所有分身
   */
  async getUserAvatars(userId: string) {
    const db = getMySQLClient()
    const result = await db.select('avatars', { user_id: userId })
    return { success: true, data: result.data || [] }
  }

  /**
   * 获取分身详情
   */
  async getAvatarById(avatarId: number) {
    const db = getMySQLClient()
    const result = await db.queryOne('avatars', { id: avatarId })
    return { success: true, data: result?.data }
  }

  /**
   * 更新分身信息
   */
  async updateAvatar(avatarId: number, updateData: any) {
    const db = getMySQLClient()
    updateData.updated_at = new Date()
    const result = await db.updateWhere('avatars', { id: avatarId }, updateData)
    return { success: (result as any)?.affectedRows > 0, data: updateData }
  }

  /**
   * 删除分身
   */
  async deleteAvatar(avatarId: number, userId: string) {
    const db = getMySQLClient()
    const result = await db.delete('avatars', { id: avatarId, user_id: userId })
    return { success: (result as any)?.affectedRows > 0 }
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
    return { success: (result as any)?.affectedRows > 0, id: (result as any)?.insertId }
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
    return { success: (result as any)?.affectedRows > 0 }
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
    return { success: (result as any)?.affectedRows > 0, id: (result as any)?.insertId }
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
    return { success: (result as any)?.affectedRows > 0 }
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
}
