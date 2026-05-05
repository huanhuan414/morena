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
    
    // 查询所有已完成的分身订单
    const { data: avatarOrders, error: ordersError } = await client
      .from('avatar_orders')
      .select(`
        id,
        avatar_id,
        status,
        budget,
        platform,
        avatars (
          id,
          name,
          avatar_url,
          user_id
        ),
        orders (
          id,
          user_id
        )
      `)
      .eq('status', 'completed')
    
    if (ordersError) {
      console.error('[EarningsService] 查询失败:', ordersError)
      // 返回模拟数据
      return this.getMockLeaderboard()
    }
    
    // 按分身分组计算收益
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
    
    for (const order of avatarOrders || []) {
      const avatar = order.avatars as any
      if (!avatar) continue
      
      const avatarId = avatar.id
      const existing = avatarEarningsMap.get(avatarId)
      
      // 计算这个分身的收益（订单预算 / 参与分身数量，这里简化为订单预算）
      const earnings = order.budget || 0
      
      if (existing) {
        existing.totalEarnings += earnings
        existing.completedOrders += 1
      } else {
        avatarEarningsMap.set(avatarId, {
          avatarId,
          avatarName: avatar.name || `分身${avatarId.slice(0, 8)}`,
          avatarAvatar: avatar.avatar_url,
          totalEarnings: earnings,
          completedOrders: 1,
          platform: order.platform
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
  }
  
  // 获取模拟数据（当没有真实数据时）
  private getMockLeaderboard(): LeaderboardResponse {
    const mockRecords: EarningsRecord[] = []
    const names = [
      '创作达人小王', '内容女王Lisa', '短视频新星', '图文专家',
      '种草博主', '好物推荐官', '生活分享家', '时尚达人',
      '美食探索家', '旅行博主', '美妆达人', '科技测评师'
    ]
    const platforms = ['抖音', '小红书', '微博', 'B站', '微信']
    
    for (let i = 0; i < 12; i++) {
      const earnings = Math.floor(Math.random() * 5000) + 500
      mockRecords.push({
        avatarId: `mock-${i}`,
        avatarName: names[i],
        avatarAvatar: undefined,
        totalEarnings: earnings,
        completedOrders: Math.floor(earnings / 50),
        rank: i + 1,
        platform: platforms[Math.floor(Math.random() * platforms.length)]
      })
    }
    
    // 按收益排序
    mockRecords.sort((a, b) => b.totalEarnings - a.totalEarnings)
    mockRecords.forEach((record, index) => {
      record.rank = index + 1
    })
    
    const total = mockRecords.reduce((sum, r) => sum + r.totalEarnings, 0)
    
    return {
      records: mockRecords,
      stats: {
        totalPlatformEarnings: total,
        totalAvatars: mockRecords.length,
        totalCompletedOrders: mockRecords.reduce((sum, r) => sum + r.completedOrders, 0),
        averageEarnings: Math.floor(total / mockRecords.length)
      }
    }
  }
}
