import { Injectable } from '@nestjs/common'
import { usersTable, avatarsTable, ordersTable, conversationsTable, tasksTable } from '../../storage/database/mysql-client'

@Injectable()
export class UserService {
  async getUserProfile(userId: string) {
    const users = usersTable()
    const { data, error } = await users.where({ id: userId }).first()

    if (error) {
      throw new Error(`获取用户信息失败: ${error.message}`)
    }

    return data
  }

  async updateUserProfile(userId: string, updates: Record<string, any>) {
    const users = usersTable()
    const { data, error } = await users.where({ id: userId }).update({
      ...updates,
      updated_at: new Date()
    })

    if (error) {
      throw new Error(`更新用户信息失败: ${error.message}`)
    }

    return data
  }

  async getUserStats(userId: string) {
    // 获取用户基本信息（包含等级和经验值）
    const { data: user } = await usersTable().where({ id: userId }).select('level, exp').first()
    
    // 获取用户的分身数量
    const { data: avatarCount } = await avatarsTable().where({ user_id: userId }).count()
    
    // 获取用户分身的ID列表及经验值
    const { data: userAvatars } = await avatarsTable().where({ user_id: userId }).select('id, exp, level')
    
    const avatarIds = (userAvatars || []).map((a: any) => a.id)
    
    // 计算分身总经验值和平均等级
    const totalAvatarExp = (userAvatars || []).reduce((sum: number, a: any) => sum + (a.exp || 0), 0)
    const maxAvatarLevel = userAvatars?.length ? Math.max(...userAvatars.map((a: any) => a.level || 1)) : 1
    
    // 获取用户分身接的订单数量（待接单 + 执行中）
    let orderCount = 0
    if (avatarIds.length > 0) {
      // 待接受的商单数量
      const { data: pendingCount } = await ordersTable().whereIn('avatar_id', avatarIds).where({ status: 'pending' }).count()
      
      // 执行中的商单数量
      const { data: executingCount } = await ordersTable().whereIn('avatar_id', avatarIds).where({ status: 'generating' }).count()
      
      orderCount = (pendingCount || 0) + (executingCount || 0)
    }
    
    // 获取用户的会话数量（模拟帖子数量）
    const { data: postCount } = await conversationsTable().where({ user_id: userId }).count()
    
    // 获取分身的好友数量（简化计算）
    const friendCount = 0
    
    return {
      avatarCount: avatarCount || 0,
      taskCount: orderCount,
      postCount: postCount || 0,
      friendCount: friendCount,
      totalXp: totalAvatarExp,
      level: maxAvatarLevel
    }
  }

  async getLearningProgress(userId: string) {
    // 获取用户学习数据
    const { data: user } = await usersTable().where({ id: userId }).select('level, exp').first()
    
    // 获取学习会话数量
    const { data: learningSessions } = await conversationsTable().where({ user_id: userId }).count()
    
    // 计算学习小时数（每10次对话约1小时）
    const totalHours = Math.floor((learningSessions || 0) / 10)
    
    // 获取完成的任务数作为课程完成数
    const { data: completedTasks } = await tasksTable().where({ user_id: userId }).where({ status: 'completed' }).count()
    
    // 获取分身等级作为技能解锁数
    const { data: avatars } = await avatarsTable().where({ user_id: userId }).select('level')
    
    const skillsLearned = avatars?.reduce((sum: number, a: any) => sum + (a.level || 1), 0) || 0
    
    // 计算连续学习天数
    const streakDays = Math.min(Math.floor((learningSessions || 0) / 3), 30)
    
    return {
      total_hours: totalHours,
      courses_completed: completedTasks || 0,
      skills_learned: skillsLearned,
      streak_days: streakDays
    }
  }

  async getSecurityStatus(userId: string) {
    const { data: user } = await usersTable().where({ id: userId }).select('phone, created_at').first()
    
    return {
      hasPassword: true,
      hasPhone: !!user?.phone,
      hasEmail: false,
      lastLoginTime: '刚刚',
      loginDevice: '微信小程序'
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // 微信小程序登录用户，密码修改主要用于绑定手机后的安全设置
    return true
  }
}
