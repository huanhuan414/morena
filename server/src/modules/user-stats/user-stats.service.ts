// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
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
          }
        }
      } catch (e) {
        console.warn('[UserStats] 同步共享缓存失败:', e.message)
      }
    }

    // 尝试使用数据库
    let db: any = null
    try {
      db = getMySQLClient()
      
      // 1. 获取用户所有活跃分身（只查需要的字段，避免读取 photo_analysis 等大字段）
      const dbAvatars = await db.query(
        `SELECT id, user_id, name, avatar_url, status, is_hosted, hosting_enabled FROM avatars WHERE user_id = ? AND status = ?`,
        [userId, 'active']
      ) as any[]
      avatarList = dbAvatars || []
      
      // 同步 AvatarService 的内存数据
      syncFromSharedCache()
      
      const avatarIds = avatarList.map((a: any) => a.id)
      avatarCount = avatarList.length
      
      // 2. 统计待接订单数（从 order_dispatch_requests 关联 orders，只统计订单仍有效的分派请求）
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const pendingResult = await db.query(
            `SELECT COUNT(*) as cnt FROM order_dispatch_requests r
             INNER JOIN orders o ON r.order_id = o.id
               AND o.status IN ('pending', 'pending_payment', 'awaiting_acceptance', 'pending_acceptance', 'accepted', 'in_progress')
             WHERE r.avatar_id IN (${avatarIdList}) AND r.status = 'pending'`
          ) as any[]
          pendingOrders = pendingResult?.[0]?.cnt || 0
        } catch (e) {
          console.error('[UserStats] 查询待接订单失败:', e.message)
          pendingOrders = 0
        }
      }
      
      // 3. 统计生成内容数（只统计已完成的内容，排除 pending/failed）
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const contentResult = await db.query(
            `SELECT COUNT(*) as cnt FROM content_generation_requests
             WHERE avatar_id IN (${avatarIdList})
               AND status NOT IN ('pending', 'failed', 'cancelled')`
          ) as any[]
          generatedContents = contentResult?.[0]?.cnt || 0
        } catch (e) {
          generatedContents = 0
        }
      }
      
      // 4. 统计累计收益（只从 earnings 表计算，status='pending' 或 'settled'，考虑抽成）
      userResult = await db.queryOne('users', { id: userId }) as any
      
      // 与收益中心保持一致：使用 pool.query 查询收益记录，然后逐笔计算（每笔都四舍五入到2位小数）
      const pool = getPool()
      const [earningsRows] = await pool.query(
        `SELECT amount, fee_rate FROM earnings 
         WHERE user_id = ? AND status IN ('settled')`,
        [userId]
      ) as any[]
      
      // 计算累计收益，每笔记录都先四舍五入到2位小数（与收益中心calcActualAmount一致）
      totalEarnings = (earningsRows || []).reduce((sum: number, e: any) => {
        const actualAmount = Number((Number(e.amount) * (1 - Number(e.fee_rate || 0))).toFixed(2))
        // console.log('[UserStats] 收益记录: amount=', e.amount, ', fee_rate=', e.fee_rate || e.feeRate, ', actual=', actualAmount)
        return sum + actualAmount
      }, 0)
      
      // 5. 获取用户邀请码和邀请人数
      try {
        const referralResult = await db.queryWhere('referrals', `referrer_id = '${userId}' AND status = 'completed'`) as any[]
        invitedCount = referralResult?.length || 0

        if (userResult?.referral_code || userResult?.referralCode) {
          referralCode = userResult.referral_code || userResult.referralCode
        } else {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
          referralCode = ''
          for (let i = 0; i < 6; i++) {
            referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
          }
          await db.updateWhere('users', { id: userId }, {
            referral_code: referralCode,
            updated_at: new Date()
          })
        }
      } catch (e) {}
      
      // 6. 统计分身总工作时长（只统计有效完成的任务，每个任务约30分钟）
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        try {
          const contentResult = await db.query(
            `SELECT COUNT(*) as cnt FROM content_generation_requests
             WHERE avatar_id IN (${avatarIdList})
               AND status IN ('completed', 'approved', 'published', 'awaiting_acceptance', 'settled', 'done')`
          ) as any[]
          const completedCount = contentResult?.[0]?.cnt || 0
          totalWorkHours = Math.round(completedCount * 0.5 * 10) / 10 // 每个任务约30分钟
        } catch (e) {}
      }
      
      // 存入内存缓存
      sharedMemoryAvatars.set(userId, avatarList)
      sharedMemoryStats.set(userId, { pendingOrders, generatedContents, totalEarnings })
      
      // 批量查询所有分身统计（避免逐个循环查询导致 N+1 问题）
      let avatarStatsResult: any[] = []
      if (avatarIds.length > 0) {
      try {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        // 一次性查询所有分身的订单统计
        const statsResult = await db.query(
          `SELECT
             cgr.avatar_id,
             COUNT(DISTINCT cgr.order_id) as total_orders,
             COUNT(DISTINCT CASE WHEN cgr.status IN ('completed','approved','published','awaiting_acceptance','settled','done','preview') THEN cgr.order_id END) as completed_orders
           FROM content_generation_requests cgr
           WHERE cgr.avatar_id IN (${avatarIdList})
             AND cgr.status NOT IN ('pending', 'cancelled')
           GROUP BY cgr.avatar_id`
        ) as any[]
        const statsMap = new Map(statsResult.map((r: any) => [r.avatarId || r.avatar_id, r]))

        // 与首页和收益中心保持一致：先查询每条收益记录，然后逐笔计算（每笔都四舍五入到2位小数）
        const [earnRows] = await pool.query(
          `SELECT avatar_id, amount, fee_rate
           FROM earnings
           WHERE avatar_id IN (${avatarIdList}) AND status IN ('settled')`,
          []
        ) as any[]
        
        // 按分身分组，逐笔计算每笔收益（四舍五入到2位小数）
        const avatarEarningsMap: Record<string, number> = {}
        for (const e of earnRows || []) {
          const avatarId = e.avatar_id
          const actualAmount = Number((Number(e.amount) * (1 - Number(e.fee_rate || 0))).toFixed(2))
          avatarEarningsMap[avatarId] = (avatarEarningsMap[avatarId] || 0) + actualAmount
        }
        const earnMap = new Map(Object.entries(avatarEarningsMap).map(([id, total]) => [id, total]))

        for (const a of avatarList) {
          const stats = statsMap.get(a.id)
          const earnings = earnMap.get(a.id) || 0
          avatarStatsResult.push({
            id: a.id,
            totalOrders: stats?.totalOrders || stats?.total_orders || 0,
            completedOrders: stats?.completedOrders || stats?.completed_orders || 0,
            totalEarnings: earnings,
          })
        }
      } catch (e) { console.error('[user-stats] avatar stats error:', e.message) }
    }
    const avatarStatsMap = new Map(avatarStatsResult.map((s: any) => [s.id, s]))

    const allHostingEnabled = avatarCount > 0 && avatarList.every((a: any) => a.isHosted === 1 || a.hostingEnabled === 1)

    return {
      avatarCount,
      pendingOrders,
      generatedContents,
      totalEarnings,
      allHostingEnabled,
      avatars: avatarList.map((a: any) => {
        const stats = avatarStatsMap.get(a.id)
        return {
          id: a.id,
          name: a.name || a.nickname || '分身',
          avatar: a.avatar_url || a.avatarUrl || '',
          status: a.status || 'active',
          totalOrders: stats?.totalOrders || 0,
          completedOrders: stats?.completedOrders || 0,
          totalEarnings: stats?.totalEarnings || 0,
        }
      }),
      nickname: userResult?.nickname || '',
      avatar: userResult?.avatar || '',
      referralCode,
      invitedCount,
      totalWorkHours
    }
    } catch (error) {
      // 数据库不可用，使用内存缓存
      avatarList = sharedMemoryAvatars.get(userId) || []
      avatarCount = avatarList.length
      
      const cachedStats = sharedMemoryStats.get(userId) || {}
      pendingOrders = cachedStats.pendingOrders || 0
      generatedContents = cachedStats.generatedContents || 0
      totalEarnings = cachedStats.totalEarnings || 0
      
      return {
        avatarCount,
        pendingOrders,
        generatedContents,
        totalEarnings,
        allHostingEnabled: avatarCount > 0,
        avatars: avatarList.map((a: any) => ({
          id: a.id,
          name: a.name || a.nickname || '分身',
          avatar: a.avatar_url || a.avatarUrl || '',
          status: a.status || 'active',
          totalOrders: 0,
          completedOrders: 0,
          totalEarnings: 0,
        })),
        nickname: '',
        avatar: '',
        referralCode: '',
        invitedCount: 0,
        totalWorkHours: 0
      }
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
      
      // 获取用户所有活跃分身（只查需要的字段）
      const avatars = await db.query(
        `SELECT id, user_id, name, avatar_url, status FROM avatars WHERE user_id = ? AND status = ?`,
        [userId, 'active']
      ) as any[]
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
      
      // 获取用户所有活跃分身（只查需要的字段）
      const avatars = await db.query(
        `SELECT id, user_id, name, avatar_url, status FROM avatars WHERE user_id = ? AND status = ?`,
        [userId, 'active']
      ) as any[]
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
        // 选择列表展示需要的字段（base64 图片已迁移到 TOS，images 字段现在只存 URL）
        const avatarIdParams = avatarIds.map(() => '?').join(',')
        const sql = `SELECT cgr.id, cgr.order_id, cgr.avatar_id, cgr.content_type, cgr.platform, cgr.platforms, cgr.status, cgr.revision_count, cgr.created_at, cgr.updated_at, cgr.video_url, cgr.images, cgr.publish_feedback, SUBSTRING(cgr.content, 1, 200) as content, CASE WHEN cgr.images IS NOT NULL AND cgr.images != '' AND cgr.images != '[]' THEN JSON_LENGTH(cgr.images) ELSE 0 END as image_count, o.title as order_title FROM content_generation_requests cgr LEFT JOIN orders o ON cgr.order_id = o.id WHERE cgr.avatar_id IN (${avatarIdParams}) ORDER BY cgr.created_at DESC LIMIT 50`
        const t0 = Date.now()
        const result = await db.query(sql, avatarIds) as any
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
      // images: 解析 JSON 字符串，过滤掉 base64 数据（只保留 URL 图片）
      let images = content.images
      if (typeof images === 'string') {
        try { images = JSON.parse(images) } catch { images = [] }
      }
      if (!Array.isArray(images)) images = images ? [String(images)] : []
      // 过滤掉 base64 图片，只保留 URL（base64 数据可达数 MB，不应在列表接口传输）
      images = images.filter((img: string) => typeof img === 'string' && img.startsWith('http'))
      return {
        ...content,
        // 确保前端常用的字段都有值（兼容 camelCase 和 snake_case）
        orderId: content.orderId || content.order_id || '',
        avatarId: aid,
        avatarName: avatar?.name || avatar?.userName || '未知分身',
        avatar_name: avatar?.name || avatar?.userName || '未知分身',
        avatarUrl: avatar?.avatarUrl || avatar?.avatar_url || '',
        avatar_url: avatar?.avatarUrl || avatar?.avatar_url || '',
        contentType: content.contentType || content.content_type || 'image_text',
        content_type: content.contentType || content.content_type || 'image_text',
        platform: content.platform || (Array.isArray(platforms) ? platforms[0] : '') || '',
        platforms,
        images,
        status: content.status,
        createdAt: content.createdAt || content.created_at || '',
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
