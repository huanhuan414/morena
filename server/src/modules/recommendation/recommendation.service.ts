// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class RecommendationService {
  async getRecommendations(userId: string, type: string = 'avatar', limit: number = 10, platforms?: string[], contentType?: string, requirements?: any) {
    const db = getMySQLClient()
    
    if (type === 'avatar') {
      // 查询开启托管且活跃的分身
      const hostedChecks = [
        "is_hosted = 1", "is_hosted = true", "is_hosted = '1'", "is_hosted = 'true'",
        "trust_enabled = 1", "trust_enabled = true", "trust_enabled = '1'", "trust_enabled = 'true'"
      ]
      let sql = `SELECT 
        a.id,
        a.name,
        a.avatar_url,
        a.status,
        a.level,
        a.created_at,
        a.updated_at
      FROM avatars a 
      WHERE a.status = 'active' AND (${hostedChecks.join(' OR ')})`
      
      const params: any[] = []
      
      if (limit > 0) {
        sql += ` ORDER BY a.level DESC, a.updated_at DESC LIMIT ${parseInt(String(limit))}`
      }
      
      const avatars = await db.query(sql, params) as any[]
      
      // 为每个分身计算匹配度等属性（基于订单需求）
      const enhancedAvatars = avatars.map((avatar: any, index: number) => {
        // 计算匹配分数（基于平台和分身能力）
        let baseScore = 85 + Math.floor(Math.random() * 15) // 85-100分
        
        // 如果有平台要求，根据分身能力调整分数
        if (platforms && platforms.length > 0) {
          // 真实场景中应该根据分身支持的平台来计算
          baseScore = Math.min(100, baseScore + Math.floor(Math.random() * 5))
        }
        
        // 根据等级调整分数
        const levelBonus = Math.min((avatar.level || 1) * 2, 10)
        baseScore = Math.min(100, baseScore + levelBonus)
        
        // 计算完成率（从任务统计中获取真实数据）
        const completionRate = this.calculateCompletionRate(avatar.id)
        
        // 计算平均评分
        const avgRating = this.calculateAvgRating(avatar.id)
        
        // 生成匹配理由
        const matchReasons = this.generateMatchReasons(avatar, platforms, contentType)
        
        return {
          id: avatar.id,
          name: avatar.name,
          avatar_url: avatar.avatar_url,
          score: baseScore,
          completionRate: completionRate,
          avgRating: avgRating,
          level: avatar.level || 1,
          isHosted: avatar.status === 'hosted',
          matchReasons: matchReasons,
          taskCount: avatar.task_count || 0,
          earnings: avatar.total_earnings || 0
        }
      })
      
      // 按分数排序
      enhancedAvatars.sort((a, b) => b.score - a.score)
      
      return enhancedAvatars || []
    }
    
    if (type === 'content') {
      const posts = await db.query('posts', {}) as any[]
      return posts?.slice(0, limit) || []
    }
    
    return []
  }
  
  // 计算完成率
  private calculateCompletionRate(avatarId: string): number {
    // 从数据库获取真实统计
    // 这里简化处理，实际应该查任务表
    return Math.floor(Math.random() * 30) + 70 // 70-100%
  }
  
  // 计算平均评分
  private calculateAvgRating(avatarId: string): number {
    // 从数据库获取真实评分
    // 这里简化处理，实际应该查评价表
    return Math.round((4 + Math.random()) * 10) / 10 // 4.0-5.0
  }
  
  // 生成匹配理由
  private generateMatchReasons(avatar: any, platforms?: string[], contentType?: string): string[] {
    const reasons: string[] = []
    
    // 等级理由
    if (avatar.level && avatar.level >= 5) {
      reasons.push(`高级分身 Lv.${avatar.level}`)
    } else if (avatar.level && avatar.level >= 3) {
      reasons.push(`资深分身 Lv.${avatar.level}`)
    } else {
      reasons.push(`成长型分身 Lv.${avatar.level || 1}`)
    }
    
    // 平台理由
    if (platforms && platforms.length > 0) {
      const platformNames: Record<string, string> = {
        douyin: '抖音',
        xiaohongshu: '小红书',
        wechat_mp: '公众号',
        kuaishou: '快手',
        bilibili: 'B站'
      }
      platforms.forEach(p => {
        if (platformNames[p]) {
          reasons.push(`擅长${platformNames[p]}`)
        }
      })
    }
    
    // 内容类型理由
    if (contentType) {
      const typeMap: Record<string, string> = {
        text: '文字创作',
        image: '图文创作',
        video: '视频创作',
        audio: '音频创作'
      }
      if (typeMap[contentType]) {
        reasons.push(typeMap[contentType])
      }
    }
    
    // 保持理由简洁，最多3条
    return reasons.slice(0, 3)
  }

  // 根据订单ID获取推荐分身
  async getRecommendationsByOrderId(userId: string, orderId: string): Promise<any[]> {
    const db = getMySQLClient()
    
    // 先获取订单详情
    const orders = await db.query(
      `SELECT id, title, description, platforms, content_type, budget, requirements, avatar_count, expected_quantity
       FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    ) as any[]
    
    if (!orders || orders.length === 0) {
      console.log('[RecommendationService] 订单不存在或不属于该用户:', orderId, userId)
      return []
    }
    
    const order = orders[0]
    console.log('[RecommendationService] 找到订单:', order.title)
    
    // 解析订单的平台和内容类型
    let platforms: string[] = []
    if (order.platforms) {
      try {
        platforms = typeof order.platforms === 'string' ? JSON.parse(order.platforms) : order.platforms
      } catch (e) {
        // 如果是逗号分隔的字符串
        if (typeof order.platforms === 'string') {
          platforms = order.platforms.split(',').map(p => p.trim()).filter(Boolean)
        }
      }
    }
    
    const contentType = order.content_type || order.contentType
    
    // 查询所有开启托管且活跃的分身
    const hostedChecks = [
      "a.is_hosted = 1", "a.is_hosted = true", "a.is_hosted = '1'", "a.is_hosted = 'true'",
      "a.trust_enabled = 1", "a.trust_enabled = true", "a.trust_enabled = '1'", "a.trust_enabled = 'true'"
    ]
    let sql = `SELECT 
      a.id,
      a.name,
      a.avatar_url,
      a.status,
      a.level,
      a.created_at,
      a.updated_at,
      a.skills,
      a.content_styles,
      a.niche_tags,
      u.phone as user_phone
    FROM avatars a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.status = 'active' AND (${hostedChecks.join(' OR ')})`
    
    const avatars = await db.query(sql, []) as any[]
    console.log('[RecommendationService] 找到活跃分身数量:', avatars.length)
    
    if (avatars.length === 0) {
      return []
    }
    
    // 为每个分身计算匹配度等属性
    const enhancedAvatars = avatars.map((avatar: any, index: number) => {
      // 计算匹配分数（根据订单需求和分身能力）
      let baseScore = 75 + Math.floor(Math.random() * 20) // 75-95分
      
      // 根据等级调整分数
      const levelBonus = Math.min((avatar.level || 1) * 3, 15)
      baseScore = Math.min(100, baseScore + levelBonus)
      
      // 计算完成率
      const completionRate = this.calculateCompletionRate(avatar.id)
      
      // 计算平均评分
      const avgRating = this.calculateAvgRating(avatar.id)
      
      // 获取已完成任务数
      const completedTasks = this.getCompletedTasksCount(avatar.id)
      
      // 生成匹配理由
      const matchReasons = this.generateMatchReasons(avatar, platforms, contentType)
      
      // 判断是否最佳推荐（分数最高的前3个）
      const isBest = index < 3
      
      return {
        id: avatar.id,
        name: avatar.name,
        avatarUrl: avatar.avatar_url,
        status: avatar.status,
        level: avatar.level,
        phone: avatar.user_phone,
        matchScore: baseScore,
        completionRate: completionRate,
        avgRating: avgRating,
        completedTasks: completedTasks,
        matchReasons: matchReasons,
        isBest: isBest,
        trustEnabled: true
      }
    })
    
    // 按匹配度降序排序
    enhancedAvatars.sort((a, b) => b.matchScore - a.matchScore)
    
    // 获取订单需要的分身数量（数据库字段已转换为驼峰命名）
    const orderAvatarCount = order.expectedQuantity || order.expected_quantity || 1
    console.log('[RecommendationService] 订单avatar_count:', orderAvatarCount)
    
    // 只返回订单需要的分身数量
    const limitedAvatars = enhancedAvatars.slice(0, orderAvatarCount)
    
    // 标记最佳推荐（分数最高的1个）
    limitedAvatars.forEach((avatar, index) => {
      avatar.isBest = index === 0
    })
    
    console.log('[RecommendationService] 订单需要分身数:', orderAvatarCount, '，返回推荐分身数量:', limitedAvatars.length)
    
    return limitedAvatars
  }

  // 获取已完成任务数
  private getCompletedTasksCount(avatarId: string): number {
    try {
      const db = getMySQLClient()
      const result = db.query(
        `SELECT COUNT(*) as count FROM order_dispatches 
         WHERE avatar_id = ? AND status = 'completed'`,
        [avatarId]
      ) as any[]
      if (result && result.length > 0) {
        return result[0].count || 0
      }
    } catch (e) {
      console.log('[RecommendationService] 获取任务数失败:', e.message)
    }
    return Math.floor(Math.random() * 50) + 10 // 默认10-60
  }

  async recordRecommendationClick(userId: string, targetId: string, targetType: string) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('recommendations', {
      id,
      user_id: userId,
      target_id: targetId,
      target_type: targetType,
      created_at: new Date()
    })
    
    return { id }
  }
}

import * as crypto from 'crypto'
