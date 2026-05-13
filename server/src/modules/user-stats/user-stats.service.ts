// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getSharedCache } from '../../common/shared-cache'

// 共享内存缓存（与 avatar.service.ts 共享）
export const sharedMemoryAvatars = new Map<string, any[]>()
export const sharedMemoryStats = new Map<string, any>()

@Injectable()
export class UserStatsService {
  /**
   * 获取用户统计概览（汇总用户所有分身的统计数据）
   */
  async getUserStatsOverview(userId: string) {
    let avatarList: any[] = []
    let avatarCount = 0
    let pendingOrders = 0
    let generatedContents = 0
    let totalEarnings = 0
    let referralCode = ''
    let invitedCount = 0
    let totalWorkHours = 0
    let userResult: any = null
    
    // 跨服务数据同步：从全局共享缓存同步 AvatarService 的数据
    const syncFromSharedCache = () => {
      try {
        const sharedCache = getSharedCache()
        const cacheKey = `avatars_${userId}`
        const cachedAvatars = sharedCache.get(cacheKey) || []
        
        if (cachedAvatars.length > 0) {
          // 合并数据（去重）
          const existingIds = new Set(avatarList.map(a => a.id))
          const newAvatars = cachedAvatars.filter((a: any) => !existingIds.has(a.id))
          if (newAvatars.length > 0) {
            avatarList = [...avatarList, ...newAvatars]
            avatarCount = avatarList.length
            console.log('[UserStats] 从共享缓存同步 AvatarService 数据:', newAvatars.length)
          }
        }
      } catch (e) {
        console.warn('[UserStats] 同步共享缓存失败:', e.message)
      }
    }

    // 尝试使用数据库
    try {
      const db = getMySQLClient()
      
      // 1. 获取用户所有分身
      const dbAvatars = await db.query('avatars', { user_id: userId }) as any[]
      console.log('[UserStats] DB avatars for', userId, ':', dbAvatars?.length || 0)
      avatarList = dbAvatars || []
      
      // 同步 AvatarService 的内存数据
      syncFromSharedCache()
      
      const avatarIds = avatarList.map((a: any) => a.id)
      avatarCount = avatarList.length
      
      // 2. 统计待接订单数（从 order_dispatch_requests 表查询，状态为 pending 的分派请求）
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const pendingResult = await db.query(
            `SELECT COUNT(*) as cnt FROM order_dispatch_requests WHERE avatar_id IN (${avatarIdList}) AND status = 'pending'`
          ) as any[]
          pendingOrders = pendingResult?.[0]?.cnt || 0
        } catch (e) {
          console.error('[UserStats] 查询待接订单失败:', e.message)
          pendingOrders = 0
        }
      }
      
      // 3. 统计生成内容数
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const contentResult = await db.queryWhere(
            'content_generation',
            `avatar_id IN (${avatarIdList})`
          ) as any[]
          generatedContents = contentResult?.length || 0
        } catch (e) {
          generatedContents = 0
        }
      }
      
      // 4. 统计累计收益
      const userResult = await db.queryOne('users', { id: userId }) as any
      totalEarnings = userResult?.total_earnings || 0
      
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const earningsResult = await db.queryWhere(
            'earnings',
            `avatar_id IN (${avatarIdList}) AND status = 'completed'`
          ) as any[]
          const avatarEarnings = earningsResult?.reduce(
            (sum: number, e: any) => sum + Number(e.amount || 0), 0
          ) || 0
          totalEarnings += avatarEarnings
        } catch (e) {}
      }
      
      // 5. 获取用户邀请码和邀请人数（自动创建邀请码）
      try {
        const referralResult = await db.queryWhere('referrals', `referrer_id = '${userId}'`) as any[]
        invitedCount = referralResult?.length || 0
        const codeResult = await db.queryWhere('referral_codes', `user_id = '${userId}'`) as any[]
        if (codeResult?.length > 0) {
          referralCode = codeResult[0].code || ''
        } else {
          // 自动生成邀请码
          referralCode = Math.random().toString(36).substring(2, 8).toUpperCase()
          await db.insert('referral_codes', {
            user_id: userId,
            code: referralCode,
            created_at: new Date(),
            updated_at: new Date()
          })
        }
      } catch (e) {}
      
      // 6. 统计分身总工作时长（基于 content_generation 的记录数 × 平均30分钟）
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const contentResult = await db.queryWhere(
            'content_generation',
            `avatar_id IN (${avatarIdList})`
          ) as any[]
          const completedCount = (Array.isArray(contentResult) ? contentResult : []).filter(
            (c: any) => c.status === 'completed' || c.status === 'approved'
          ).length
          totalWorkHours = Math.round(completedCount * 0.5 * 10) / 10 // 每个任务约30分钟
        } catch (e) {}
      }
      
      // 存入内存缓存
      sharedMemoryAvatars.set(userId, avatarList)
      sharedMemoryStats.set(userId, { pendingOrders, generatedContents, totalEarnings })
    } catch (error) {
      // 数据库不可用，使用内存缓存
      avatarList = sharedMemoryAvatars.get(userId) || []
      avatarCount = avatarList.length
      
      // 从内存统计获取
      const cachedStats = sharedMemoryStats.get(userId) || {}
      pendingOrders = cachedStats.pendingOrders || 0
      generatedContents = cachedStats.generatedContents || 0
      totalEarnings = cachedStats.totalEarnings || 0
    }
    
    const allHostingEnabled = avatarCount > 0 && avatarList.every((a: any) => a.isHosted === 1 || a.hostingEnabled === 1)

    return {
      avatarCount,
      pendingOrders,
      generatedContents,
      totalEarnings,
      allHostingEnabled,
      avatars: avatarList.map((a: any) => ({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatar_url || '',
        hostingEnabled: a.hosting_enabled || 0,
        isHosted: a.is_hosted || 0,
        
        serviceHours: a.service_hours || '24h',
        totalOrders: a.total_orders || 0,
        completedOrders: a.completed_orders || 0,
        totalEarnings: a.total_earnings || 0,
        todayEarnings: a.today_earnings || 0,
        status: a.status || 'active'
      })),
      nickname: userResult?.nickname || '',
      avatar: userResult?.avatar || '',
      referralCode,
      invitedCount,
      totalWorkHours
    }
  }
  
  /**
   * 获取用户指定分身的订单列表
   */
  async getAvatarOrders(userId: string, avatarId?: string) {
    let avatarList: any[] = []
    let orders: any[] = []
    
    // 尝试使用数据库
    try {
      const db = getMySQLClient()
      
      // 获取用户所有分身
      const avatars = await db.query('avatars', { user_id: userId }) as any[]
      avatarList = avatars || []
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
      
      const ordersResult = await db.queryWhere('orders', where, {
        orderBy: 'created_at',
        orderDirection: 'desc',
        limit: 50
      }) as any
      
      orders = ordersResult?.data || []
      
      // 存入内存缓存
      sharedMemoryAvatars.set(userId, avatarList)
    } catch (error) {
      // 数据库不可用，使用内存缓存
      avatarList = sharedMemoryAvatars.get(userId) || []
    }
    
    // 关联分身信息
    const ordersWithAvatar = orders.map((order: any) => {
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
    let avatarList: any[] = []
    let contents: any[] = []
    
    // 尝试使用数据库
    try {
      const db = getMySQLClient()
      
      // 获取用户所有分身
      const avatars = await db.query('avatars', { user_id: userId }) as any[]
      avatarList = avatars || []
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
      
      try {
        const result = await db.queryWhere('content_generation', where, {
          orderBy: 'created_at',
          orderDirection: 'desc',
          limit: 50
        }) as any
        // queryWhere 直接返回数组，不是 { data: [] } 格式
        contents = Array.isArray(result) ? result : (result?.data || [])
      } catch (e) {
        contents = []
      }
      
      // 存入内存缓存
      sharedMemoryAvatars.set(userId, avatarList)
    } catch (error) {
      // 数据库不可用，使用内存缓存
      avatarList = sharedMemoryAvatars.get(userId) || []
    }
    
    // 关联分身信息 + 补全字段（queryWhere 返回的字段名已转为 camelCase）
    const contentsWithAvatar = contents.map((content: any) => {
      const aid = content.avatarId || content.avatar_id
      const avatar = avatarList.find((a: any) => a.id === aid)
      // platforms: 优先取 platforms（数组），fallback 到 platform（字符串）
      let platforms = content.platforms || content.platform
      if (typeof platforms === 'string') {
        try { platforms = JSON.parse(platforms) } catch { platforms = [platforms] }
      }
      if (!Array.isArray(platforms)) {
        platforms = platforms ? [String(platforms)] : []
      }
      // images: 解析 JSON 字符串
      let images = content.images
      if (typeof images === 'string') {
        try { images = JSON.parse(images) } catch { images = [] }
      }
      if (!Array.isArray(images)) images = images ? [String(images)] : []
      return {
        ...content,
        avatar_name: avatar?.name || avatar?.userName || '未知分身',
        avatar_url: avatar?.avatarUrl || avatar?.avatar_url || '',
        avatarId: aid,
        content_type: content.contentType || content.content_type || 'image_text',
        platforms,
        images,
        status: content.status
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
