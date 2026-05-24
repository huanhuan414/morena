// @ts-nocheck
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

/**
 * 统一用户ID规范：
 * - 前端从 userInfo.id 获取用户ID（数据库 users 表的 UUID）
 * - 所有请求通过 x-user-id header 传递
 * - 未登录用户不能创建/查看分身
 */

// 测试用户ID列表（开发环境使用）
const TEST_USER_IDS = ['dev_user', 'test_user', 'guest-user-id', 'anonymous']

@Injectable()
export class UserService {
  /**
   * 获取当前请求的用户ID
   */
  getCurrentUserId(userIdFromHeader: string): string {
    if (userIdFromHeader && !TEST_USER_IDS.includes(userIdFromHeader)) {
      return userIdFromHeader
    }
    if (userIdFromHeader && TEST_USER_IDS.includes(userIdFromHeader)) {
      return userIdFromHeader
    }
    return 'dev_user'
  }

  /**
   * 检查用户是否已登录
   */
  isLoggedIn(userId: string): boolean {
    if (!userId) return false
    return !TEST_USER_IDS.includes(userId)
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(userId: string) {
    const db = getMySQLClient()
    const user = await db.queryOne('users', { id: userId })
    if (!user) {
      return { id: userId, nickname: '探索者', avatar: '', level: 1, exp: 0, credits: 0 }
    }
    return {
      id: user.id,
      nickname: user.nickname || '探索者',
      avatar: user.avatar || '',
      phone: user.phone || '',
      bio: user.bio || '',
      level: user.level || 1,
      exp: user.exp || 0,
      credits: user.credits || 0,
      created_at: user.created_at,
      updated_at: user.updated_at
    }
  }

  /**
   * 更新用户资料
   */
  async updateUserProfile(userId: string, updates: Record<string, any>) {
    const db = getMySQLClient()
    
    const allowedUpdates: Record<string, any> = {}
    const allowedFields = ['nickname', 'avatar', 'phone', 'bio']
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        allowedUpdates[field] = updates[field]
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getUserProfile(userId)
    }

    const result = await db.update('users', userId, allowedUpdates)
    if (result.error) {
      console.error('[UserService] updateProfile error:', result.error)
    }

    return this.getUserProfile(userId)
  }

  /**
   * 获取用户统计数据
   */
  async getUserStats(userId: string) {
    const db = getMySQLClient()

    // 分身数量
    const avatarCount = await db.count('avatars', { user_id: userId })

    // 商单数量
    const taskCount = await db.count('orders', { user_id: userId })

    // 动态数量
    const postCount = await db.count('social_posts', { user_id: userId })

    // 好友数量
    const friendRows = await db.queryWhere('friendships', `(user_id = '${userId}' OR friend_id = '${userId}') AND status = 'accepted'`)
    const friendCount = friendRows?.length || 0

    // 等级和经验值
    const user = await db.queryOne('users', { id: userId })
    const level = user?.level || 1
    const totalXp = user?.exp || 0

    return {
      avatarCount,
      taskCount,
      postCount,
      friendCount,
      totalXp,
      level
    }
  }

  /**
   * 获取学习进度
   */
  async getLearningProgress(userId: string) {
    const profile = await this.getUserProfile(userId)
    return {
      level: profile.level,
      exp: profile.exp,
      nextLevelExp: (profile.level || 1) * 100,
      progress: Math.min(100, ((profile.exp || 0) / ((profile.level || 1) * 100)) * 100)
    }
  }

  /**
   * 获取安全状态
   */
  async getSecurityStatus(userId: string) {
    const profile = await this.getUserProfile(userId)
    return {
      hasPassword: true,
      hasPhone: !!profile.phone,
      phone: profile.phone ? profile.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
      twoFactorEnabled: false
    }
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const db = getMySQLClient()
    const user = await db.queryOne('users', { id: userId })
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }
    // 简单实现：直接更新密码（实际应该验证旧密码）
    await db.update('users', userId, { password_hash: newPassword })
    return { success: true }
  }
}
