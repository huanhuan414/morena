import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class UserService {
  async getUserProfile(userId: string) {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      throw new Error(`获取用户信息失败: ${error.message}`)
    }
    
    return data
  }

  async updateUserProfile(userId: string, updates: Record<string, any>) {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新用户信息失败: ${error.message}`)
    }
    
    return data
  }

  async getUserStats(userId: string) {
    const client = getSupabaseClient()
    
    // 获取用户的分身数量
    const { count: avatarCount } = await client
      .from('avatars')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    // 获取用户的任务数量
    const { count: taskCount } = await client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    // 获取用户的帖子数量
    const { count: postCount } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    // 获取用户的关注数
    const { count: followingCount } = await client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)
    
    // 获取用户的粉丝数
    const { count: followerCount } = await client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
    
    return {
      avatarCount: avatarCount || 0,
      taskCount: taskCount || 0,
      postCount: postCount || 0,
      followingCount: followingCount || 0,
      followerCount: followerCount || 0
    }
  }
}
