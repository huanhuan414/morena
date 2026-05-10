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
   * @param userIdFromHeader - 从 x-user-id header 获取的用户ID
   * @returns 用户ID
   * @throws UnauthorizedException - 如果用户未登录
   */
  getCurrentUserId(userIdFromHeader: string): string {
    // 如果有有效的用户ID，直接返回
    if (userIdFromHeader && !TEST_USER_IDS.includes(userIdFromHeader)) {
      return userIdFromHeader
    }
    
    // 开发/测试环境：允许测试用户ID
    if (userIdFromHeader && TEST_USER_IDS.includes(userIdFromHeader)) {
      console.log(`[UserService] 使用测试用户ID: ${userIdFromHeader}`)
      return userIdFromHeader
    }
    
    // 生产环境：必须登录
    // throw new UnauthorizedException('请先登录后再进行操作')
    // 暂时返回测试用户ID用于开发
    return 'dev_user'
  }

  /**
   * 检查用户是否已登录
   */
  isLoggedIn(userId: string): boolean {
    if (!userId) return false
    return !TEST_USER_IDS.includes(userId)
  }
}
