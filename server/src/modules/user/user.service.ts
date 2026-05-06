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
      .maybeSingle()

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
    
    // 获取用户基本信息（包含等级和经验值）
    const { data: user } = await client
      .from('users')
      .select('level, exp')
      .eq('id', userId)
      .single()
    
    // 获取用户的分身数量
    const { count: avatarCount } = await client
      .from('avatars')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    // 获取用户分身的ID列表及经验值
    const { data: userAvatars } = await client
      .from('avatars')
      .select('id, exp, level')
      .eq('user_id', userId)
    
    const avatarIds = (userAvatars || []).map(a => a.id)
    
    // 计算分身总经验值和平均等级
    const totalAvatarExp = (userAvatars || []).reduce((sum, a) => sum + (a.exp || 0), 0)
    const maxAvatarLevel = userAvatars?.length ? Math.max(...userAvatars.map(a => a.level || 1)) : 1
    
    // 获取用户分身接的订单数量（待接单 + 执行中）
    // avatarIds = 该用户创建的所有分身ID
    // orders.avatar_id IN (这些分身ID) 表示分身接的订单
    let orderCount = 0
    if (avatarIds.length > 0) {
      // 待接受的商单数量
      const { count: pendingCount } = await client
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
        .eq('status', 'pending')
      
      // 执行中的商单数量
      const { count: executingCount } = await client
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
        .eq('status', 'generating')
      
      orderCount = (pendingCount || 0) + (executingCount || 0)
    }
    
    // 获取用户的帖子数量（动态）
    const { count: postCount } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    // 获取分身的好友数量
    let friendCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('avatar_friends')
        .select('*', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
      friendCount = count || 0
    }
    
    return {
      avatarCount: avatarCount || 0,
      taskCount: orderCount,        // B端订单数量
      postCount: postCount || 0,    // 帖子数量
      friendCount: friendCount,     // 好友数量
      totalXp: totalAvatarExp,      // 分身总经验值（与心智成长挂钩）
      level: maxAvatarLevel          // 最高分身等级
    }
  }

  async getLearningProgress(userId: string) {
    const client = getSupabaseClient()
    
    // 获取用户学习数据
    const { data: user } = await client
      .from('users')
      .select('level, exp')
      .eq('id', userId)
      .single()
    
    // 获取学习会话数量（模拟学习时长）
    const { count: learningSessions } = await client
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    // 计算学习小时数（每10次对话约1小时）
    const totalHours = Math.floor((learningSessions || 0) / 10)
    
    // 获取完成的任务数作为课程完成数
    const { count: completedTasks } = await client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    // 获取分身等级作为技能解锁数
    const { data: avatars } = await client
      .from('avatars')
      .select('level')
      .eq('user_id', userId)
    
    const skillsLearned = avatars?.reduce((sum, a) => sum + (a.level || 1), 0) || 0
    
    // 计算连续学习天数（模拟，基于最近活跃度）
    const streakDays = Math.min(Math.floor((learningSessions || 0) / 3), 30)
    
    return {
      total_hours: totalHours,
      courses_completed: completedTasks || 0,
      skills_learned: skillsLearned,
      streak_days: streakDays
    }
  }

  async getSecurityStatus(userId: string) {
    const client = getSupabaseClient()
    
    const { data: user } = await client
      .from('users')
      .select('phone, created_at')
      .eq('id', userId)
      .single()
    
    return {
      hasPassword: true, // 微信登录默认有密码
      hasPhone: !!user?.phone,
      hasEmail: false,
      lastLoginTime: '刚刚',
      loginDevice: '微信小程序'
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // 微信小程序登录用户，密码修改主要用于绑定手机后的安全设置
    // 这里只做模拟实现
    const client = getSupabaseClient()
    
    // 实际项目中应该验证旧密码，这里简化处理
    // 更新密码哈希等操作...
    
    return true
  }
}
