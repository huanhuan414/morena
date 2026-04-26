import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import * as crypto from 'crypto'

// 默认管理员账号
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  role: 'super'
}

interface AdminUser {
  id: string
  username: string
  password: string
  role: string
  last_login?: string
  created_at: string
}

interface SystemConfig {
  siteName: string
  siteDescription: string
  maintenanceMode: boolean
  registerEnabled: boolean
  maxAvatarsPerUser: number
  commissionRate: number
}

@Injectable()
export class AdminService {
  private supabase = getSupabaseClient()
  private admins: Map<string, AdminUser> = new Map()
  private config: SystemConfig = {
    siteName: 'AI分身平台',
    siteDescription: '创建你的专属AI分身',
    maintenanceMode: false,
    registerEnabled: true,
    maxAvatarsPerUser: 5,
    commissionRate: 10
  }

  constructor() {
    // 初始化默认管理员
    this.admins.set('1', {
      id: '1',
      username: DEFAULT_ADMIN.username,
      password: DEFAULT_ADMIN.password,
      role: DEFAULT_ADMIN.role,
      created_at: new Date().toISOString()
    })
  }

  /**
   * 生成Token
   */
  private generateToken(admin: any): string {
    const data = JSON.stringify({
      id: admin.id || '1',
      username: admin.username,
      role: admin.role,
      exp: Date.now() + 24 * 60 * 60 * 1000
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
    // 检查是否是默认管理员
    if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
      const admin = {
        id: '1',
        username: DEFAULT_ADMIN.username,
        role: DEFAULT_ADMIN.role
      }
      return {
        success: true,
        message: '登录成功',
        data: { token: this.generateToken(admin), admin }
      }
    }

    // 检查其他管理员
    for (const [id, admin] of this.admins) {
      if (admin.username === username && admin.password === password) {
        return {
          success: true,
          message: '登录成功',
          data: { token: this.generateToken(admin), admin }
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
      const { count: totalUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      const { count: totalAvatars } = await this.supabase
        .from('avatars')
        .select('*', { count: 'exact', head: true })

      const { count: totalOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })

      const { data: earnings } = await this.supabase
        .from('earnings')
        .select('amount')
        .eq('type', 'revenue')

      const totalRevenue = earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { count: todayNewUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      const { count: todayOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      const { count: pendingOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: pendingContent } = await this.supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

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
        totalUsers: 0, totalAvatars: 0, totalOrders: 0, totalRevenue: 0,
        todayNewUsers: 0, todayOrders: 0, pendingOrders: 0, pendingContent: 0
      }
    }
  }

  // ===== 用户管理 =====

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

      return { list: usersWithStats || [], total: count || 0, page, limit }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      return { list: [], total: 0, page, limit }
    }
  }

  async getUserDetail(userId: string): Promise<any> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !user) return null

      const { count: avatarCount } = await this.supabase
        .from('avatars')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const { count: orderCount } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const { count: postCount } = await this.supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const { data: earnings } = await this.supabase
        .from('earnings')
        .select('amount')
        .eq('user_id', userId)

      const { data: transactions } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'expense')

      const totalEarnings = earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const totalSpent = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

      return {
        ...user,
        avatar_count: avatarCount || 0,
        order_count: orderCount || 0,
        post_count: postCount || 0,
        total_earnings: totalEarnings,
        total_spent: totalSpent
      }
    } catch (error) {
      console.error('获取用户详情失败:', error)
      return null
    }
  }

  async getUserStats(userId: string): Promise<any> {
    try {
      const months: { month: string; start: string; end: string }[] = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        months.push({
          month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
          end: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString()
        })
      }

      const monthlyOrders: { month: string; count: number }[] = []
      const monthlySpending: { month: string; amount: number }[] = []

      for (const m of months) {
        const { count } = await this.supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', m.start)
          .lte('created_at', m.end)

        const { data: spending } = await this.supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('created_at', m.start)
          .lte('created_at', m.end)

        monthlyOrders.push({ month: m.month, count: count || 0 })
        monthlySpending.push({ 
          month: m.month, 
          amount: spending?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0 
        })
      }

      return { monthlyOrders, monthlySpending }
    } catch (error) {
      console.error('获取用户统计失败:', error)
      return { monthlyOrders: [], monthlySpending: [] }
    }
  }

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

  // ===== 分身管理 =====

  async getAvatars(page: number, limit: number, keyword?: string, status?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('avatars')
        .select('*, users!inner(nickname)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (keyword) {
        query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
      }

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, count, error } = await query
      if (error) throw error

      const avatarIds = data?.map(a => a.id) || []
      const { data: orderStats } = await this.supabase
        .from('orders')
        .select('avatar_id')
        .in('avatar_id', avatarIds)

      const orderCountMap = new Map()
      orderStats?.forEach(o => {
        orderCountMap.set(o.avatar_id, (orderCountMap.get(o.avatar_id) || 0) + 1)
      })

      const avatarsWithStats = data?.map(avatar => ({
        ...avatar,
        user_nickname: avatar.users?.nickname,
        order_count: orderCountMap.get(avatar.id) || 0,
        rating: 4.5
      }))

      return { list: avatarsWithStats || [], total: count || 0, page, limit }
    } catch (error) {
      console.error('获取分身列表失败:', error)
      return { list: [], total: 0, page, limit }
    }
  }

  async updateAvatarStatus(avatarId: string, status: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('avatars')
        .update({ status })
        .eq('id', avatarId)

      if (error) throw error

      return { success: true, message: '状态更新成功' }
    } catch (error) {
      console.error('更新分身状态失败:', error)
      return { success: false, message: '操作失败' }
    }
  }

  // ===== 订单管理 =====

  async getOrders(page: number, limit: number, keyword?: string, status?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('orders')
        .select('*, users!inner(nickname, phone), avatars!inner(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, count, error } = await query
      if (error) throw error

      const orders = data?.map(order => ({
        ...order,
        user_nickname: order.users?.nickname,
        user_phone: order.users?.phone,
        avatar_name: order.avatars?.name
      }))

      return { list: orders || [], total: count || 0, page, limit }
    } catch (error) {
      console.error('获取订单列表失败:', error)
      return { list: [], total: 0, page, limit }
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)

      if (error) throw error

      return { success: true, message: '状态更新成功' }
    } catch (error) {
      console.error('更新订单状态失败:', error)
      return { success: false, message: '操作失败' }
    }
  }

  // ===== 技能管理 =====

  private skills: Map<string, any> = new Map()

  async getSkills(): Promise<any> {
    const list = Array.from(this.skills.values())
    return { list, total: list.length }
  }

  async createSkill(data: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const id = Date.now().toString()
      const skill = {
        id,
        ...data,
        order_count: 0,
        rating: 5.0,
        status: 'active',
        created_at: new Date().toISOString()
      }
      this.skills.set(id, skill)
      return { success: true, message: '创建成功', data: skill }
    } catch (error) {
      return { success: false, message: '创建失败' }
    }
  }

  async updateSkill(id: string, data: any): Promise<{ success: boolean; message: string }> {
    try {
      const skill = this.skills.get(id)
      if (!skill) return { success: false, message: '技能不存在' }
      this.skills.set(id, { ...skill, ...data })
      return { success: true, message: '更新成功' }
    } catch (error) {
      return { success: false, message: '更新失败' }
    }
  }

  async deleteSkill(id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.skills.delete(id)
      return { success: true, message: '删除成功' }
    } catch (error) {
      return { success: false, message: '删除失败' }
    }
  }

  async updateSkillStatus(id: string, status: string): Promise<{ success: boolean; message: string }> {
    try {
      const skill = this.skills.get(id)
      if (!skill) return { success: false, message: '技能不存在' }
      skill.status = status
      return { success: true, message: '状态更新成功' }
    } catch (error) {
      return { success: false, message: '更新失败' }
    }
  }

  // ===== 内容管理 =====

  private posts: Map<string, any> = new Map()

  async getPosts(status?: string, search?: string): Promise<any> {
    let list = Array.from(this.posts.values())
    
    if (status && status !== 'all') {
      list = list.filter(p => p.status === status)
    }
    
    if (search) {
      list = list.filter(p => p.content?.includes(search))
    }

    return { list, total: list.length }
  }

  async reviewPost(id: string, status: string): Promise<{ success: boolean; message: string }> {
    try {
      const post = this.posts.get(id)
      if (!post) return { success: false, message: '帖子不存在' }
      post.status = status
      return { success: true, message: '审核成功' }
    } catch (error) {
      return { success: false, message: '审核失败' }
    }
  }

  async deletePost(id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.posts.delete(id)
      return { success: true, message: '删除成功' }
    } catch (error) {
      return { success: false, message: '删除失败' }
    }
  }

  // ===== 财务管理 =====

  async getFinanceStats(): Promise<any> {
    return {
      totalRecharge: 0,
      totalWithdraw: 0,
      totalCommission: 0,
      balance: 0,
      pendingWithdraw: 0
    }
  }

  private transactions: any[] = []

  async getTransactions(type?: string): Promise<any> {
    let list = this.transactions
    if (type && type !== 'all') {
      list = list.filter(t => t.type === type)
    }
    return { list, total: list.length }
  }

  async approveWithdraw(id: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: '已通过' }
  }

  async rejectWithdraw(id: string, reason: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: '已驳回' }
  }

  // ===== 推广管理 =====

  async getReferralStats(): Promise<any> {
    return {
      totalReferrers: 0,
      totalReferred: 0,
      totalCommission: 0,
      commissionRate: this.config.commissionRate
    }
  }

  async getReferrers(): Promise<any[]> {
    return []
  }

  async updateCommissionRate(rate: number): Promise<{ success: boolean; message: string }> {
    this.config.commissionRate = rate
    return { success: true, message: '设置已更新' }
  }

  // ===== 系统设置 =====

  async getAdmins(): Promise<any[]> {
    return Array.from(this.admins.values()).map(a => ({
      id: a.id,
      username: a.username,
      role: a.role,
      last_login: a.last_login,
      created_at: a.created_at
    }))
  }

  async addAdmin(username: string, password: string): Promise<{ success: boolean; message: string }> {
    const id = Date.now().toString()
    this.admins.set(id, {
      id,
      username,
      password,
      role: 'admin',
      created_at: new Date().toISOString()
    })
    return { success: true, message: '添加成功' }
  }

  async deleteAdmin(id: string): Promise<{ success: boolean; message: string }> {
    if (id === '1') return { success: false, message: '不能删除超级管理员' }
    this.admins.delete(id)
    return { success: true, message: '删除成功' }
  }

  async changePassword(adminId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const admin = this.admins.get(adminId)
    if (!admin) return { success: false, message: '管理员不存在' }
    if (admin.password !== oldPassword) return { success: false, message: '原密码错误' }
    admin.password = newPassword
    return { success: true, message: '密码修改成功' }
  }

  async getConfig(): Promise<SystemConfig> {
    return this.config
  }

  async updateConfig(config: Partial<SystemConfig>): Promise<{ success: boolean; message: string }> {
    this.config = { ...this.config, ...config }
    return { success: true, message: '配置已更新' }
  }
}
