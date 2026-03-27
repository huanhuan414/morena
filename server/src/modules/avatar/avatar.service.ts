import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class AvatarService {
  async createAvatar(userId: string, avatarData: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .insert({
        user_id: userId,
        name: avatarData.name || '我的AI分身',
        description: avatarData.description || '',
        avatar_url: avatarData.avatar_url || '',
        personality: avatarData.personality || '',
        skills: avatarData.skills || [],
        config: avatarData.config || {},
        level: 1,
        exp: 0,
        status: 'active'
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建分身失败: ${error.message}`)
    }
    
    return data
  }

  async getAvatarsByUser(userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取分身列表失败: ${error.message}`)
    }
    
    return data
  }

  async getAvatarById(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    if (error) {
      throw new Error(`获取分身详情失败: ${error.message}`)
    }
    
    return data
  }

  async updateAvatar(avatarId: string, userId: string, updates: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新分身失败: ${error.message}`)
    }
    
    return data
  }

  async addExperience(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    // 获取当前分身信息
    const avatar = await this.getAvatarById(avatarId)
    const newExp = avatar.exp + exp
    
    // 计算新等级（每100经验升一级）
    const newLevel = Math.floor(newExp / 100) + 1
    
    const { data, error } = await client
      .from('avatars')
      .update({
        exp: newExp,
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新分身经验失败: ${error.message}`)
    }
    
    // 记录进化日志
    if (newLevel > avatar.level) {
      await client.from('avatar_evolution').insert({
        avatar_id: avatarId,
        level_from: avatar.level,
        level_to: newLevel,
        exp_gained: exp,
        source: 'interaction',
        rewards: this.calculateRewards(newLevel)
      })
    }
    
    return data
  }

  private calculateRewards(level: number) {
    const rewards: Record<string, any> = {}
    
    if (level >= 2) rewards.theme_unlock = ['dark', 'light']
    if (level >= 3) rewards.skill_slots = 3
    if (level >= 5) rewards.advanced_skills = true
    if (level >= 7) rewards.custom_personality = true
    if (level >= 10) rewards.premium_features = true
    
    return rewards
  }

  async deleteAvatar(avatarId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('avatars')
      .delete()
      .eq('id', avatarId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除分身失败: ${error.message}`)
    }
    
    return { success: true }
  }
}
