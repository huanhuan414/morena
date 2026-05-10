// @ts-nocheck
import { Controller, Get, Headers } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Controller('dashboard')
export class DashboardController {
  
  @Get('stats')
  async getDashboardStats(@Headers('x-user-id') userId?: string) {
    const db = getMySQLClient()
    
    try {
      // 获取用户分身数量
      let avatarCount = 0
      // 测试/开发用户返回所有分身数量
      const isTestUser = userId && (userId === 'dev_user' || userId === 'guest-user')
      if (isTestUser || !userId || !userId.trim()) {
        // 测试用户或无用户ID时，返回所有活跃分身数量
        const countResult = await db.query('SELECT COUNT(*) as count FROM avatars WHERE status = ?', ['active'])
        avatarCount = countResult?.[0]?.count || 0
      } else {
        const avatarResult = await db.select('avatars', { user_id: userId })
        avatarCount = avatarResult?.data?.length || 0
      }
      
      // 获取用户订单数量
      let orderCount = 0
      if (userId && userId.trim()) {
        const orderResult = await db.select('orders', { user_id: userId })
        orderCount = orderResult?.data?.length || 0
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
