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
      const isTestUser = userId && TEST_USER_IDS.includes(userId)
      const hasValidUserId = userId && userId.trim() && !isTestUser
      let avatarCount = 0
      try {
        if (!userId || !userId.trim() || userId.length < 10) {
          // 无用户ID或测试用户，返回所有分身数量
          const countResult = await db.query('SELECT COUNT(*) as count FROM avatars WHERE status = ?', ['active'])
          avatarCount = countResult?.[0]?.count || 0
          console.log('[Dashboard] 无用户ID/测试用户，返回所有分身数量:', avatarCount)
        } else {
          // 有效用户：查询该用户自己的分身
          console.log('[Dashboard] 有效用户:', userId)
          const avatarResult = await db.query('SELECT COUNT(*) as count FROM avatars WHERE user_id = ? AND status = ?', [userId, 'active'])
          avatarCount = avatarResult?.[0]?.count || 0
          console.log('[Dashboard] 查询结果:', JSON.stringify(avatarResult))
        }
      } catch (err) {
        console.error('[Dashboard] 查询失败:', err)
      }
      
      // 获取用户订单数量
      let orderCount = 0
      if (userId && userId.trim()) {
        const orderResult = await db.query('SELECT COUNT(*) as count FROM orders WHERE user_id = ?', [userId])
        orderCount = orderResult?.[0]?.count || 0
      }
      
      // 获取用户收入
      let totalEarnings = '0.00'
      if (userId && userId.trim()) {
        const earningResult = await db.query(
          'SELECT SUM(amount) as total FROM earnings WHERE user_id = ?',
          [userId]
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
