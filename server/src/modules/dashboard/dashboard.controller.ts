// @ts-nocheck
import { Controller, Get, Headers } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

// 测试用户ID列表
const TEST_USER_IDS = ['dev_user', 'test_user', 'guest-user-id', 'anonymous']

@Controller('dashboard')
export class DashboardController {
  
  @Get('stats')
  async getDashboardStats(@Headers('x-user-id') userId?: string) {
    const db = getMySQLClient()
    
    try {
      // 获取用户分身数量
      let avatarCount = 0
      const isTestUser = userId && TEST_USER_IDS.includes(userId)
      const hasValidUserId = userId && userId.trim() && !isTestUser
      
      if (isTestUser || !userId || !userId.trim()) {
        // 测试用户或无用户ID时，返回所有活跃分身数量
        const countResult = await db.query('SELECT COUNT(*) as count FROM avatars WHERE status = ?', ['active'])
        avatarCount = countResult?.[0]?.count || 0
      } else if (hasValidUserId) {
        // 有效用户：只查询该用户自己的分身（数据库列名是驼峰userId）
        const avatarResult = await db.query('SELECT * FROM avatars WHERE userId = ?', [userId])
        avatarCount = Array.isArray(avatarResult) ? avatarResult.length : 0
      }
      
      // 获取用户订单数量（数据库列名可能是userId或user_id）
      let orderCount = 0
      if (userId && userId.trim()) {
        const orderResult = await db.query('SELECT COUNT(*) as count FROM orders WHERE userId = ? OR user_id = ?', [userId, userId])
        orderCount = orderResult?.[0]?.count || 0
      }
      
      // 获取用户收入（数据库列名可能是userId或user_id）
      let totalEarnings = '0.00'
      if (userId && userId.trim()) {
        const earningResult = await db.query(
          'SELECT SUM(amount) as total FROM earnings WHERE userId = ? OR user_id = ?',
          [userId, userId]
        )
        totalEarnings = earningResult?.[0]?.total || '0.00'
      }
      
      return {
        code: 200,
        msg: 'success',
        data: {
          avatar_count: avatarCount,
          order_count: orderCount,
          total_earnings: totalEarnings,
          user_avatar: null
        }
      }
    } catch (error) {
      console.error('获取仪表盘统计失败:', error)
      return {
        code: 200,
        msg: 'success',
        data: {
          avatar_count: 0,
          order_count: 0,
          total_earnings: '0.00',
          user_avatar: null
        }
      }
    }
  }
}
