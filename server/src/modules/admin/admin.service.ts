import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import * as crypto from 'crypto'

// 默认管理员账号
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123', // 实际应该加密存储
  role: 'super_admin'
}

@Injectable()
export class AdminService {
  private supabase = getSupabaseClient()

  /**
   * 生成Token
   */
  private generateToken(admin: any): string {
    const data = JSON.stringify({
      id: admin.id || '1',
      username: admin.username,
      role: admin.role,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24小时过期
    })
    return Buffer.from(data).toString('base64')
  }

  /**
   * 验证Token
   */
  async verifyToken(token: string): Promise<any> {
    if (!token) return null
    
    try {
      const data = JSON.parse(Buffer.from(token, 'base64').toString())
      if (data.exp < Date.now()) return null
      return data
    } catch {
      return null
    }
  }

  /**
   * 管理员登录
   */
  async login(username: string, password: string): Promise<{ success: boolean; message: string; data?: any }> {
    // 验证默认管理员账号
    if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
      const admin = {
        id: '1',
        username: DEFAULT_ADMIN.username,
        role: DEFAULT_ADMIN.role
      }
      
      return {
        success: true,
        message: '登录成功',
        data: {
          token: this.generateToken(admin),
          admin
        }
      }
    }
    
    return { success: false, message: '账号或密码错误' }
  }

  /**
   * 获取仪表盘统计数据
   */
  async getDashboardStats(): Promise<any> {
    try {
      // 总用户数
      const { count: totalUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // 总分身数
      const { count: totalAvatars } = await this.supabase
        .from('avatars')
        .select('*', { count: 'exact', head: true })

      // 总订单数
      const { count: totalOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })

      // 总收益
      const { data: earnings } = await this.supabase
        .from('earnings')
        .select('amount')
        .eq('type', 'revenue')
      
      const totalRevenue = earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      // 今日新增用户
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: todayNewUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // 今日订单
      const { count: todayOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // 待处理订单
      const { count: pendingOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 待审核内容
      const { count: pendingContent } = await this.supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review')

      return {
        totalUsers: totalUsers || 0,
        totalAvatars: totalAvatars || 0,
        totalOrders: totalOrders || 0,
        totalRevenue: totalRevenue,
        todayNewUsers: todayNewUsers || 0,
        todayOrders: todayOrders || 0,
        pendingOrders: pendingOrders || 0,
        pendingContent: pendingContent || 0
      }
    } catch (error) {
      console.error('获取仪表盘数据失败:', error)
      return {
        totalUsers: 0,
        totalAvatars: 0,
        totalOrders: 0,
        totalRevenue: 0,
        todayNewUsers: 0,
        todayOrders: 0,
        pendingOrders: 0,
        pendingContent: 0
      }
    }
  }

  /**
   * 获取用户列表
   */
  async getUsers(page: number, limit: number, keyword?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (keyword) {
        query = query.or(`phone.ilike.%${keyword}%,nickname.ilike.%${keyword}%`)
      }

      const { data, count, error } = await query

      if (error) throw error

      // 获取用户的分身数和订单数
      const userIds = data?.map(u => u.id) || []
      
      const { data: avatarCounts } = await this.supabase
        .from('avatars')
        .select('user_id')
        .in('user_id', userIds)
      
      const { data: orderCounts } = await this.supabase
        .from('orders')
        .select('user_id')
        .in('user_id', userIds)

      const avatarCountMap = new Map()
      avatarCounts?.forEach(a => {
        avatarCountMap.set(a.user_id, (avatarCountMap.get(a.user_id) || 0) + 1)
      })

      const orderCountMap = new Map()
      orderCounts?.forEach(o => {
        orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) || 0) + 1)
      })

      const usersWithStats = data?.map(user => ({
        ...user,
        avatar_count: avatarCountMap.get(user.id) || 0,
        order_count: orderCountMap.get(user.id) || 0
      }))

      return {
        list: usersWithStats || [],
        total: count || 0,
        page,
        limit
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      return { list: [], total: 0, page, limit }
    }
  }

  /**
   * 禁用/解禁用户
   */
  async banUser(userId: string, action: 'ban' | 'unban'): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ status: action === 'ban' ? 'banned' : 'active' })
        .eq('id', userId)

      if (error) throw error

      return {
        success: true,
        message: action === 'ban' ? '用户已禁用' : '用户已解禁'
      }
    } catch (error) {
      console.error('操作用户失败:', error)
      return { success: false, message: '操作失败' }
    }
  }
}
