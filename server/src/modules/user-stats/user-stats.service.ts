// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

// 共享内存缓存（与 avatar.service.ts 共享）
export const sharedMemoryAvatars = new Map<string, any[]>()
export const sharedMemoryStats = new Map<string, any>()

@Injectable()
export class UserStatsService {
  /**
   * 获取用户统计概览（汇总用户所有分身的统计数据）
   */
  async getUserStatsOverview(userId: string) {
    const startTime = Date.now()
    let avatarList: any[] = []
    let avatarCount = 0
    let pendingOrders = 0
    let generatedContents = 0
    let totalEarnings = 0
    let referralCode = ''
    let invitedCount = 0
    let totalWorkHours = 0
    let userResult: any = null

    // 尝试使用数据库
    let db: any = null
    try {
      db = getMySQLClient()
      
      // 1. 获取用户所有活跃分身（只查需要的字段）
      const dbAvatars = await db.query(
        `SELECT id, user_id, name, avatar_url, status, is_hosted, hosting_enabled FROM avatars WHERE user_id = ? AND status = ?`,
        [userId, 'active']
      ) as any[]
      avatarList = dbAvatars || []
      
      const avatarIds = avatarList.map((a: any) => a.id)
      avatarCount = avatarList.length
      
      if (avatarIds.length > 0) {
        const avatarIdList = avatarIds.map((id: string) => `'${id}'`).join(',')
        
        // 2. 合并统计查询：一次查询获取所有分身维度的统计数据
        // 包含：待接订单、生成内容数、完成内容数（用于计算工作时长）、分身订单统计、分身收益统计
        const [
          pendingResult,
          contentResult,
          completedResult,
          userRow,
          earningsSumResult,
          referralCountResult,
          avatarStatsResult,
          avatarEarningsResult,
        ] = await Promise.all([
          // 待接订单数
          db.query(
            `SELECT COUNT(*) as cnt FROM order_dispatch_requests r
             INNER JOIN orders o ON r.order_id = o.id
               AND o.status IN ('pending', 'pending_payment', 'awaiting_acceptance', 'pending_acceptance', 'accepted', 'in_progress')
             WHERE r.avatar_id IN (${avatarIdList}) AND r.status = 'pending'`
          ).catch(() => [{ cnt: 0 }]),
          // 生成内容数
          db.query(
            `SELECT COUNT(*) as cnt FROM content_generation_requests
             WHERE avatar_id IN (${avatarIdList})
               AND status NOT IN ('pending', 'failed', 'cancelled')`
          ).catch(() => [{ cnt: 0 }]),
          // 完成内容数（用于计算工作时长）
          db.query(
            `SELECT COUNT(*) as cnt FROM content_generation_requests
             WHERE avatar_id IN (${avatarIdList})
               AND status IN ('completed', 'approved', 'published', 'awaiting_acceptance', 'settled', 'done')`
          ).catch(() => [{ cnt: 0 }]),
          // 用户信息
          db.query(`SELECT id, nickname, avatar, referral_code FROM users WHERE id = ?`, [userId]).catch(() => []),
          // 累计收益总额（用SQL SUM替代queryWhere+JS reduce）
          db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = ? AND status IN ('settled', 'completed')`,
            [userId]
          ).catch(() => [{ total: 0 }]),
          // 邀请人数
          db.query(
            `SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'completed'`,
            [userId]
          ).catch(() => [{ cnt: 0 }]),
          // 分身维度订单统计
          db.query(
            `SELECT cgr.avatar_id,
               COUNT(DISTINCT cgr.order_id) as total_orders,
               COUNT(DISTINCT CASE WHEN cgr.status IN ('completed','approved','published','awaiting_acceptance','settled','done','preview') THEN cgr.order_id END) as completed_orders
             FROM content_generation_requests cgr
             WHERE cgr.avatar_id IN (${avatarIdList}) AND cgr.status NOT IN ('pending', 'cancelled')
             GROUP BY cgr.avatar_id`
          ).catch(() => []),
          // 分身维度收益统计
          db.query(
            `SELECT avatar_id, COALESCE(SUM(amount), 0) as total FROM earnings WHERE avatar_id IN (${avatarIdList}) AND status IN ('settled', 'completed') GROUP BY avatar_id`
          ).catch(() => []),
        ])

        pendingOrders = Number(pendingResult?.[0]?.cnt || 0)
        generatedContents = Number(contentResult?.[0]?.cnt || 0)
        const completedCount = Number(completedResult?.[0]?.cnt || 0)
        totalWorkHours = Math.round(completedCount * 0.5 * 10) / 10
        totalEarnings = Number(earningsSumResult?.[0]?.total || 0)
        invitedCount = Number(referralCountResult?.[0]?.cnt || 0)
        
        // 用户信息
        const userRows = Array.isArray(userRow) ? userRow : (userRow?.data || [])
        userResult = userRows?.[0] || null
        
        // 处理邀请码
        if (userResult?.referral_code) {
          referralCode = userResult.referral_code
        } else if (userResult) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
          referralCode = ''
          for (let i = 0; i < 6; i++) {
            referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
          }
          await db.query(`UPDATE users SET referral_code = ?, updated_at = NOW() WHERE id = ?`, [referralCode, userId]).catch(() => {})
        }

        // 分身统计Map
        const statsMap = new Map(
          (Array.isArray(avatarStatsResult) ? avatarStatsResult : (avatarStatsResult?.data || [])).map((r: any) => [r.avatarId || r.avatar_id, r])
        )
        const earnMap = new Map(
          (Array.isArray(avatarEarningsResult) ? avatarEarningsResult : (avatarEarningsResult?.data || [])).map((r: any) => [r.avatarId || r.avatar_id, Number(r.total || 0)])
        )
        
        // 存入内存缓存
        sharedMemoryAvatars.set(userId, avatarList)
        sharedMemoryStats.set(userId, { pendingOrders, generatedContents, totalEarnings })

        const allHostingEnabled = avatarCount > 0 && avatarList.every((a: any) => a.isHosted === 1 || a.hostingEnabled === 1)

        console.log(`[UserStats] overview for ${userId}: ${Date.now() - startTime}ms`)
        return {
          avatarCount,
          pendingOrders,
          generatedContents,
          totalEarnings,
          allHostingEnabled,
          avatars: avatarList.map((a: any) => {
            const stats = statsMap.get(a.id)
            return {
              id: a.id,
              name: a.name || a.nickname || '分身',
              avatar: a.avatar_url || a.avatarUrl || '',
              status: a.status || 'active',
              totalOrders: stats?.totalOrders || stats?.total_orders || 0,
              completedOrders: stats?.completedOrders || stats?.completed_orders || 0,
              totalEarnings: earnMap.get(a.id) || 0,
            }
          }),
          nickname: userResult?.nickname || '',
          avatar: userResult?.avatar || '',
          referralCode,
          invitedCount,
          totalWorkHours
        }
      }

      // 没有分身时，只查用户基础信息
      const userRows = await db.query(`SELECT id, nickname, avatar, referral_code FROM users WHERE id = ?`, [userId]).catch(() => []) as any[]
      userResult = Array.isArray(userRows) ? userRows?.[0] : null
      
      const earningsSumResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = ? AND status IN ('settled', 'completed')`,
        [userId]
      ).catch(() => [{ total: 0 }]) as any[]
      totalEarnings = Number(earningsSumResult?.[0]?.total || 0)
      
      const referralCountResult = await db.query(
        `SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'completed'`,
        [userId]
      ).catch(() => [{ cnt: 0 }]) as any[]
      invitedCount = Number(referralCountResult?.[0]?.cnt || 0)
      
      if (userResult?.referral_code) {
        referralCode = userResult.referral_code
      } else if (userResult) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        referralCode = ''
        for (let i = 0; i < 6; i++) {
          referralCode += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        await db.query(`UPDATE users SET referral_code = ?, updated_at = NOW() WHERE id = ?`, [referralCode, userId]).catch(() => {})
      }

      console.log(`[UserStats] overview for ${userId} (no avatars): ${Date.now() - startTime}ms`)
      return {
        avatarCount: 0,
        pendingOrders: 0,
        generatedContents: 0,
        totalEarnings,
        allHostingEnabled: false,
        avatars: [],
        nickname: userResult?.nickname || '',
        avatar: userResult?.avatar || '',
        referralCode,
        invitedCount,
        totalWorkHours: 0
      }
    } catch (error) {
      console.error('[UserStats] overview error:', error.message)
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
        // 优化：不读取 content 和 images 大字段，images 只取数量
        const avatarIdParams = avatarIds.map(() => '?').join(',')
        const sql = `SELECT id, order_id, avatar_id, content_type, platform, platforms, status, created_at, updated_at, video_url, publish_feedback, CASE WHEN images IS NOT NULL AND images != '' AND images != '[]' THEN JSON_LENGTH(images) ELSE 0 END as image_count FROM content_generation_requests WHERE avatar_id IN (${avatarIdParams}) ORDER BY created_at DESC LIMIT 50`
        const t0 = Date.now()
        const result = await db.query(sql, avatarIds) as any
        console.log(`[getAvatarContents] SQL query took ${Date.now() - t0}ms`)
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
      // images: 不再从SQL读取（避免大字段传输），列表页只展示数量
      const imageCount = content.imageCount || content.image_count || 0
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
        images: [], // 列表页不返回图片URL，详情页单独获取
        imageCount,
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
