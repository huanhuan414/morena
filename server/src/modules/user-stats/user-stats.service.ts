// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class UserStatsService {
  /**
   * 获取用户统计概览（汇总用户所有分身的统计数据）
   */
  async getUserStatsOverview(userId: string) {
    const db = getMySQLClient()
    
    // 1. 获取用户所有分身
    const avatars = await db.query('avatars', { user_id: userId }) as any
    const avatarList = avatars?.data || []
    const avatarIds = avatarList.map((a: any) => a.id)
    const avatarCount = avatarList.length
    
    // 2. 统计待接订单数（状态为 pending_dispatch 或 processing 的订单）
    let pendingOrders = 0
    if (avatarIds.length > 0) {
      const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
      const pendingResult = await db.queryWhere(
        'orders',
        `avatar_id IN (${avatarIdList}) AND status IN ('pending_dispatch', 'processing')`
      ) as any
      pendingOrders = pendingResult?.data?.length || 0
    }
    
    // 3. 统计生成内容数（根据 avatar_id 关联的内容）
    let generatedContents = 0
    if (avatarIds.length > 0) {
      const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
      // 检查是否有 content_generation 表
      try {
        const contentResult = await db.queryWhere(
          'content_generation',
          `avatar_id IN (${avatarIdList})`
        ) as any
        generatedContents = contentResult?.data?.length || 0
      } catch (e) {
        // 表不存在，使用0
        generatedContents = 0
      }
    }
    
    // 4. 统计累计收益（用户本人的收益 + 分身的收益）
    let totalEarnings = 0
    const userResult = await db.queryOne('users', { id: userId }) as any
    totalEarnings = userResult?.total_earnings || 0
    
    // 加上分身产生的收益
    if (avatarIds.length > 0) {
      const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
      try {
        const earningsResult = await db.queryWhere(
          'earnings',
          `avatar_id IN (${avatarIdList}) AND status = 'completed'`
        ) as any
        const avatarEarnings = earningsResult?.data?.reduce(
          (sum: number, e: any) => sum + Number(e.amount || 0), 0
        ) || 0
        totalEarnings += avatarEarnings
      } catch (e) {
        // 表不存在
      }
    }
    
    return {
      avatarCount,           // 分身数量
      pendingOrders,         // 待接订单数
      generatedContents,     // 生成内容数
      totalEarnings,         // 累计收益
      avatars: avatarList.map((a: any) => ({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatar_url || ''
      }))
    }
  }
  
  /**
   * 获取用户指定分身的订单列表
   */
  async getAvatarOrders(userId: string, avatarId?: string) {
    const db = getMySQLClient()
    
    // 获取用户所有分身
    const avatars = await db.query('avatars', { user_id: userId }) as any
    const avatarList = avatars?.data || []
    const avatarIds = avatarList.map((a: any) => a.id)
    
    let where = ''
    if (avatarId) {
      where = `avatar_id = '${avatarId}'`
    } else if (avatarIds.length > 0) {
      const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
      where = `avatar_id IN (${avatarIdList})`
    } else {
      return { orders: [], avatars: [] }
    }
    
    const orders = await db.queryWhere('orders', where, {
      orderBy: 'created_at',
      orderDirection: 'desc',
      limit: 50
    }) as any
    
    // 关联分身信息
    const ordersWithAvatar = (orders?.data || []).map((order: any) => {
      const avatar = avatarList.find((a: any) => a.id === order.avatar_id)
      return {
        ...order,
        avatar_name: avatar?.name || '未知分身',
        avatar_url: avatar?.avatar_url || ''
      }
    })
    
    return {
      orders: ordersWithAvatar,
      avatars: avatarList.map((a: any) => ({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatar_url || ''
      }))
    }
  }
  
  /**
   * 获取用户指定分身的内容列表
   */
  async getAvatarContents(userId: string, avatarId?: string) {
    const db = getMySQLClient()
    
    // 获取用户所有分身
    const avatars = await db.query('avatars', { user_id: userId }) as any
    const avatarList = avatars?.data || []
    const avatarIds = avatarList.map((a: any) => a.id)
    
    let where = ''
    if (avatarId) {
      where = `avatar_id = '${avatarId}'`
    } else if (avatarIds.length > 0) {
      const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
      where = `avatar_id IN (${avatarIdList})`
    } else {
      return { contents: [], avatars: [] }
    }
    
    let contents: any[] = []
    try {
      const result = await db.queryWhere('content_generation', where, {
        orderBy: 'created_at',
        orderDirection: 'desc',
        limit: 50
      }) as any
      contents = result?.data || []
    } catch (e) {
      // 表不存在
      contents = []
    }
    
    // 关联分身信息
    const contentsWithAvatar = contents.map((content: any) => {
      const avatar = avatarList.find((a: any) => a.id === content.avatar_id)
      return {
        ...content,
        avatar_name: avatar?.name || '未知分身',
        avatar_url: avatar?.avatar_url || ''
      }
    })
    
    return {
      contents: contentsWithAvatar,
      avatars: avatarList.map((a: any) => ({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatar_url || ''
      }))
    }
  }
}
