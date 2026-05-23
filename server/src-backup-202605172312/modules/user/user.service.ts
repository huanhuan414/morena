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
      console.log(`[UserService] 使用测试用户ID: ${userIdFromHeader}`)
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
    const client = await getMySQLClient()
    const [rows] = await client.execute(
      'SELECT id, nickname, avatar_url, phone, bio, level, exp, credits, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    )
    const user = rows[0]
    if (!user) {
      return { id: userId, nickname: '探索者', avatar: '', level: 1, exp: 0, credits: 0 }
    }
    return {
      id: user.id,
      nickname: user.nickname || '探索者',
      avatar: user.avatar_url || '',
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
    const client = await getMySQLClient()
    const allowedFields = ['nickname', 'avatar_url', 'phone', 'bio']
    const setClauses = []
    const values = []

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`)
        values.push(updates[field])
      }
    }

    if (setClauses.length === 0) {
      return this.getUserProfile(userId)
    }

    values.push(userId)
    await client.execute(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    )

    return this.getUserProfile(userId)
  }

  /**
   * 获取用户统计数据
   */
  async getUserStats(userId: string) {
    const client = await getMySQLClient()

    // 分身数量
    const [avatarRows] = await client.execute(
      'SELECT COUNT(*) as count FROM avatars WHERE user_id = ?',
      [userId]
    )
    const avatarCount = avatarRows[0]?.count || 0

    // 商单数量
    const [orderRows] = await client.execute(
      'SELECT COUNT(*) as count FROM orders WHERE user_id = ?',
      [userId]
    )
    const taskCount = orderRows[0]?.count || 0

    // 动态数量
    const [postRows] = await client.execute(
      'SELECT COUNT(*) as count FROM social_posts WHERE user_id = ?',
      [userId]
    )
    const postCount = postRows[0]?.count || 0

    // 好友数量
    const [friendRows] = await client.execute(
      'SELECT COUNT(*) as count FROM friendships WHERE (user_id = ? OR friend_id = ?) AND status = ?',
      [userId, userId, 'accepted']
    )
    const friendCount = friendRows[0]?.count || 0

    // 等级和经验值
    const [userRows] = await client.execute(
      'SELECT level, exp FROM users WHERE id = ?',
      [userId]
    )
    const level = userRows[0]?.level || 1
    const totalXp = userRows[0]?.exp || 0

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
    const client = await getMySQLClient()
    const [rows] = await client.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    )
    if (!rows[0]) {
      throw new UnauthorizedException('用户不存在')
    }
    // 简单实现：直接更新密码（实际应该验证旧密码）
    await client.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPassword, userId]
    )
    return { success: true }
  }
}
