import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

interface EarningsRecord {
  avatarId: string
  avatarName: string
  avatarAvatar?: string
  totalEarnings: number
  completedOrders: number
  rank: number
  platform?: string
}

interface EarningsStats {
  totalPlatformEarnings: number
  totalAvatars: number
  totalCompletedOrders: number
  averageEarnings: number
}

export interface LeaderboardResponse {
  records: EarningsRecord[]
  stats: EarningsStats
}

@Injectable()
export class EarningsService {
  async getLeaderboard(limit: number = 50): Promise<LeaderboardResponse> {
    const client = getSupabaseClient()
    
    try {
      // 使用 RPC 调用自定义函数来处理 bytea 到 text 的转换
      // 或者直接在应用层处理转换
      
      // 1. 查询所有已完成的分身订单
      const { data: dispatchRequests, error: requestsError } = await client
        .from('order_dispatch_requests')
        .select('id, avatar_id, status, order_id')
        .eq('status', 'completed')
      
      if (requestsError) {
        console.error('[EarningsService] 查询分发请求失败:', requestsError)
        return { records: [], stats: { totalPlatformEarnings: 0, totalAvatars: 0, totalCompletedOrders: 0, averageEarnings: 0 } }
      }
      
      if (!dispatchRequests || dispatchRequests.length === 0) {
        return { records: [], stats: { totalPlatformEarnings: 0, totalAvatars: 0, totalCompletedOrders: 0, averageEarnings: 0 } }
      }
      
      // 转换 bytea order_id 为 hex 字符串
      const convertOrderId = (orderId: any): string => {
        if (!orderId) return ''
        if (typeof orderId === 'string') return orderId
        // 如果是 Buffer 或 Uint8Array，转换为 hex 字符串
        if (orderId instanceof Buffer) {
          return orderId.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
        }
        if (orderId.data) {
          const hex = Buffer.from(orderId.data).toString('hex')
          return hex.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
        }
        return String(orderId)
      }
      
      // 获取所有转换后的订单ID
      const orderIds = dispatchRequests
        .map(r => convertOrderId(r.order_id))
        .filter(Boolean)
      
      if (orderIds.length === 0) {
        return { records: [], stats: { totalPlatformEarnings: 0, totalAvatars: 0, totalCompletedOrders: 0, averageEarnings: 0 } }
      }
      
      // 2. 批量查询订单预算（使用转换后的 ID）
      const { data: orders, error: ordersError } = await client
        .from('orders')
        .select('id, budget, platforms')
        .in('id', orderIds)
      if (ordersError) {
        console.error('[EarningsService] 查询订单失败:', ordersError)
        return { records: [], stats: { totalPlatformEarnings: 0, totalAvatars: 0, totalCompletedOrders: 0, averageEarnings: 0 } }
      }
      
      // 创建订单预算映射
      const orderBudgetMap = new Map<string, { budget: number; platforms?: string[] }>()
      for (const order of orders || []) {
        // 解析 PostgreSQL money 类型格式: {200000 -2 false finite true}
        let budgetValue = 0
        if (order.budget) {
          const budgetStr = String(order.budget)
          const parts = budgetStr.match(/[^\s{}]+/g)
          if (parts && parts.length >= 1) {
            const amount = parseFloat(parts[0])
            const scale = parts.length >= 2 ? parseInt(parts[1]) : 0
            budgetValue = amount / Math.pow(10, Math.abs(scale))
          }
        }
        orderBudgetMap.set(order.id, { 
          budget: Math.floor(budgetValue),
          platforms: order.platforms
        })
      }
      
      // 3. 查询每个订单有多少个参与的分身（使用转换后的 ID）
      const { data: orderAvatarCounts, error: countError } = await client
        .from('order_dispatch_requests')
        .select('order_id')
        .in('status', ['completed', 'awaiting_acceptance', 'published', 'preview', 'generating', 'accepted'])
      
      if (countError) {
        console.error('[EarningsService] 查询分身数量失败:', countError)
      }
      
      // 计算每个订单的分身数量
      const orderAvatarCountMap = new Map<string, number>()
      for (const record of orderAvatarCounts || []) {
        const convertedOrderId = convertOrderId(record.order_id)
        const count = orderAvatarCountMap.get(convertedOrderId) || 0
        orderAvatarCountMap.set(convertedOrderId, count + 1)
      }
      
      // 4. 获取所有分身ID
      const avatarIds = [...new Set(dispatchRequests.map(r => r.avatar_id).filter(Boolean))]
      
      // 查询分身信息
      const { data: avatars, error: avatarsError } = await client
        .from('avatars')
        .select('id, name, avatar_url')
        .in('id', avatarIds)
      
      if (avatarsError) {
        console.error('[EarningsService] 查询分身失败:', avatarsError)
      }
      
      // 创建分身信息映射
      const avatarInfoMap = new Map<string, { name: string; avatar_url?: string }>()
      for (const avatar of avatars || []) {
        avatarInfoMap.set(avatar.id, { name: avatar.name, avatar_url: avatar.avatar_url })
      }
      
      // 5. 按分身分组计算收益
      const avatarEarningsMap = new Map<string, {
        avatarId: string
        avatarName: string
        avatarAvatar?: string
        totalEarnings: number
        completedOrders: number
        platform?: string
      }>()
      
      let totalPlatformEarnings = 0
      let totalCompletedOrders = 0
      
      for (const request of dispatchRequests) {
        const avatarId = request.avatar_id
        if (!avatarId) continue
        
        const orderId = convertOrderId(request.order_id)
        const orderInfo = orderBudgetMap.get(orderId)
        if (!orderInfo) continue
        
        const avatarCount = orderAvatarCountMap.get(orderId) || 1
        const budget = orderInfo.budget
        const earnings = Math.floor(budget / avatarCount) // 按参与分身数量平均分配
        
        const existing = avatarEarningsMap.get(avatarId)
        const avatarInfo = avatarInfoMap.get(avatarId)
        
        if (existing) {
          existing.totalEarnings += earnings
          existing.completedOrders += 1
        } else {
          avatarEarningsMap.set(avatarId, {
            avatarId,
            avatarName: avatarInfo?.name || `分身${avatarId.slice(0, 8)}`,
            avatarAvatar: avatarInfo?.avatar_url,
            totalEarnings: earnings,
            completedOrders: 1,
            platform: orderInfo.platforms?.[0]
          })
        }
        
        totalPlatformEarnings += earnings
        totalCompletedOrders += 1
      }
      
      // 转换为数组并排序
      const records: EarningsRecord[] = Array.from(avatarEarningsMap.values())
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, limit)
        .map((record, index) => ({
          ...record,
          rank: index + 1
        }))
      
      const totalAvatars = avatarEarningsMap.size
      const averageEarnings = totalAvatars > 0 
        ? Math.floor(totalPlatformEarnings / totalAvatars) 
        : 0
      
      return {
        records,
        stats: {
          totalPlatformEarnings,
          totalAvatars,
          totalCompletedOrders,
          averageEarnings
        }
      }
    } catch (error) {
      console.error('[EarningsService] 获取排行榜失败:', error)
      return { records: [], stats: { totalPlatformEarnings: 0, totalAvatars: 0, totalCompletedOrders: 0, averageEarnings: 0 } }
    }
  }
}
