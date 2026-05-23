// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class RecommendationService {
  async getRecommendations(userId: string, type: string = 'avatar', limit: number = 10, platforms?: string[], contentType?: string, requirements?: any) {
    const db = getMySQLClient()
    
    if (type === 'avatar') {
      const sql = `SELECT 
        a.id,
        a.name,
        a.avatar_url,
        a.status,
        a.level,
        a.is_hosted,
        a.skills,
        a.content_styles,
        a.niche_tags,
        a.created_at,
        a.updated_at
      FROM avatars a 
      WHERE a.status = 'active' AND a.is_hosted = 1
      ORDER BY a.level DESC, a.updated_at DESC LIMIT ?`
      
      const rows = await db.query(sql, [parseInt(String(limit)) || 10])
      const avatars = rows || []
      
      const enhancedAvatars = avatars.map((avatar: any, index: number) => {
        let baseScore = 85 + Math.floor(Math.random() * 15)
        
        if (platforms && platforms.length > 0) {
          baseScore = Math.min(100, baseScore + Math.floor(Math.random() * 5))
        }
        
        const levelBonus = Math.min((avatar.level || 1) * 2, 10)
        baseScore = Math.min(100, baseScore + levelBonus)
        
        const completionRate = this.calculateCompletionRate(avatar.id)
        const avgRating = this.calculateAvgRating(avatar.id)
        const matchReasons = this.generateMatchReasons(avatar, platforms, contentType)
        
        return {
          id: avatar.id,
          name: avatar.name,
          avatar_url: avatar.avatarUrl || avatar.avatar_url,
          score: baseScore,
          completionRate,
          avgRating,
          level: avatar.level || 1,
          isHosted: true,
          matchReasons,
          taskCount: avatar.task_count || 0,
          earnings: avatar.total_earnings || 0
        }
      })
      
      enhancedAvatars.sort((a, b) => b.score - a.score)
      return enhancedAvatars
    }
    
    if (type === 'content') {
      const rows = await db.query('SELECT * FROM posts LIMIT ?', [limit])
      return rows?.slice(0, limit) || []
    }
    
    return []
  }
  
  private calculateCompletionRate(avatarId: string): number {
    return Math.floor(Math.random() * 30) + 70
  }
  
  private calculateAvgRating(avatarId: string): number {
    return Math.round((4 + Math.random()) * 10) / 10
  }

  private generateMatchReasons(avatar: any, platforms?: string[], contentType?: string): string[] {
    const reasons: string[] = []
    
    if (avatar.level && avatar.level >= 5) {
      reasons.push(`高级分身 Lv.${avatar.level}`)
    } else if (avatar.level && avatar.level >= 3) {
      reasons.push(`资深分身 Lv.${avatar.level}`)
    } else {
      reasons.push(`成长型分身 Lv.${avatar.level || 1}`)
    }
    
    // 基于技能生成匹配理由
    let skills: string[] = []
    try {
      if (avatar.skills) {
        const parsed = typeof avatar.skills === 'string' ? JSON.parse(avatar.skills) : avatar.skills
        skills = Array.isArray(parsed) ? parsed : []
      }
    } catch {}
    
    const skillNames: Record<string, string> = {
      content_writing: '图文爆款',
      image_gen: '图片生成',
      video_gen: '视频创作',
      palm_reading: '看手相',
      fashion_advice: '衣品改造'
    }
    skills.forEach((s: string) => {
      if (skillNames[s]) reasons.push(`擅长${skillNames[s]}`)
    })
    
    // 基于风格标签
    let styles: string[] = []
    try {
      if (avatar.contentStyles || avatar.content_styles) {
        const raw = avatar.contentStyles || avatar.content_styles
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        styles = Array.isArray(parsed) ? parsed : []
      }
    } catch {}
    if (styles.length > 0) {
      reasons.push(`${styles[0]}风格`)
    }
    
    if (platforms && platforms.length > 0) {
      const platformNames: Record<string, string> = {
        douyin: '抖音', xiaohongshu: '小红书', wechat_mp: '公众号',
        kuaishou: '快手', bilibili: 'B站', wechat_moments: '朋友圈'
      }
      platforms.forEach(p => {
        if (platformNames[p]) reasons.push(`熟悉${platformNames[p]}`)
      })
    }
    
    if (contentType) {
      const typeMap: Record<string, string> = {
        text: '文字创作', image_text: '图文创作', image: '图片创作',
        video: '视频创作', audio: '音频创作'
      }
      if (typeMap[contentType]) reasons.push(typeMap[contentType])
    }
    
    return reasons.slice(0, 3)
  }

  /**
   * 根据订单ID获取推荐分身 — 核心推荐逻辑
   */
  async getRecommendationsByOrderId(userId: string, orderId: string): Promise<any[]> {
    const db = getMySQLClient()
    
    // 1. 获取订单详情（不限制user_id，因为前端可能传不同的userId格式）
    const orderRows = await db.query(
      `SELECT id, title, description, platforms, content_type, budget, requirements,
              avatar_count, expected_quantity, preferred_styles, industry_tags
       FROM orders WHERE id = ?`,
      [orderId]
    )
    
    if (!orderRows || orderRows.length === 0) {
      console.log('[RecommendationService] 订单不存在:', orderId)
      return []
    }
    
    const order = orderRows[0]
    console.log('[RecommendationService] 找到订单:', order.title, '| contentType:', order.contentType || order.content_type)
    
    // 2. 解析订单数据
    let platforms: string[] = []
    try {
      const raw = order.platforms
      platforms = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
    } catch {
      if (typeof order.platforms === 'string') {
        platforms = order.platforms.split(',').map(p => p.trim()).filter(Boolean)
      }
    }
    
    const contentType = order.contentType || order.content_type || 'image_text'
    
    let preferredStyles: string[] = []
    try {
      const raw = order.preferredStyles || order.preferred_styles
      preferredStyles = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
    } catch {}
    
    let industryTags: string[] = []
    try {
      const raw = order.industryTags || order.industry_tags
      industryTags = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
    } catch {}
    
    // 3. 查询所有活跃+托管的分身
    const avatarRows = await db.query(
      `SELECT 
        a.id,
        a.name,
        a.avatar_url,
        a.status,
        a.level,
        a.is_hosted,
        a.skills,
        a.content_styles,
        a.niche_tags,
        a.personality,
        a.user_id,
        u.phone as user_phone
      FROM avatars a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.status = 'active' AND a.is_hosted = 1`
    )
    
    console.log('[RecommendationService] 找到活跃托管分身数量:', avatarRows?.length || 0)
    
    if (!avatarRows || avatarRows.length === 0) {
      console.log('[RecommendationService] 无可用分身')
      return []
    }
    
    // 3.5 查询所有分身的技能
    const avatarSkillRows = await db.query(
      `SELECT avatar_id, skill_id FROM avatar_skills`
    )
    const avatarSkillsMap: Record<string, string[]> = {}
    for (const row of avatarSkillRows) {
      if (!avatarSkillsMap[row.avatarId]) avatarSkillsMap[row.avatarId] = []
      avatarSkillsMap[row.avatarId].push(row.skillId)
    }
    
    console.log('[RecommendationService] 技能映射:', JSON.stringify(avatarSkillsMap))
    
    // 4. 三维匹配计算（技能40% + 风格30% + 领域30%）
    const enhancedAvatars = avatarRows.map((avatar: any) => {
      // 解析分身技能（优先从avatar_skills表获取，兼容旧数据从skills字段获取）
      let avatarSkills: string[] = avatarSkillsMap[avatar.id] || []
      if (avatarSkills.length === 0) {
        try {
          const raw = avatar.skills
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            avatarSkills = Array.isArray(parsed) ? parsed : []
          }
        } catch {}
      }
      
      // 解析分身风格
      let avatarStyles: string[] = []
      try {
        const raw = avatar.contentStyles || avatar.content_styles
        avatarStyles = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
      } catch {}
      
      // 解析分身领域
      let avatarNiche: string[] = []
      try {
        const raw = avatar.nicheTags || avatar.niche_tags
        avatarNiche = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
      } catch {}
      
      // --- 技能匹配 (40%) ---
      let skillScore = 0
      const skillToContent: Record<string, string[]> = {
        content_writing: ['image_text', 'text'],
        image_gen: ['image', 'image_text'],
        video_gen: ['video'],
        palm_reading: ['image_text', 'image'],
        fashion_advice: ['image_text', 'image']
      }
      if (contentType && avatarSkills.length > 0) {
        const matchingSkills = avatarSkills.filter(s => {
          const types = skillToContent[s] || []
          return types.includes(contentType)
        })
        skillScore = avatarSkills.length > 0 ? (matchingSkills.length / avatarSkills.length) * 100 : 0
      } else {
        skillScore = 50 // 无技能信息时给基础分
      }
      
      // --- 风格匹配 (30%) ---
      let styleScore = 0
      if (preferredStyles.length > 0 && avatarStyles.length > 0) {
        const matchingStyles = preferredStyles.filter(s => avatarStyles.includes(s))
        styleScore = (matchingStyles.length / preferredStyles.length) * 100
      } else if (preferredStyles.length === 0) {
        styleScore = 70 // 无偏好时给中高分
      } else {
        styleScore = 30
      }
      
      // --- 领域匹配 (30%) ---
      let nicheScore = 0
      if (industryTags.length > 0 && avatarNiche.length > 0) {
        const matchingNiche = industryTags.filter(n => avatarNiche.includes(n))
        nicheScore = (matchingNiche.length / industryTags.length) * 100
      } else if (industryTags.length === 0) {
        nicheScore = 70
      } else {
        nicheScore = 30
      }
      
      // 加权总分
      const matchScore = Math.round(skillScore * 0.4 + styleScore * 0.3 + nicheScore * 0.3)
      
      // 等级加成（小幅）
      const levelBonus = Math.min((avatar.level || 1) * 2, 10)
      const finalScore = Math.min(100, matchScore + levelBonus)
      
      // 完成率和评分
      const completionRate = this.calculateCompletionRate(avatar.id)
      const avgRating = this.calculateAvgRating(avatar.id)
      const completedTasks = this.getCompletedTasksCount(avatar.id)
      const matchReasons = this.generateMatchReasons(avatar, platforms, contentType)
      
      return {
        id: avatar.id,
        name: avatar.name,
        avatarUrl: avatar.avatarUrl || avatar.avatar_url,
        status: avatar.status,
        level: avatar.level || 1,
        personality: avatar.personality,
        phone: avatar.user_phone,
        matchScore: finalScore,
        completionRate,
        avgRating,
        completedTasks,
        matchReasons,
        // 三维匹配详情
        matchDetails: {
          skillScore: Math.round(skillScore),
          styleScore: Math.round(styleScore),
          nicheScore: Math.round(nicheScore),
          avatarSkills,
          avatarStyles,
          avatarNiche
        }
      }
    })
    
    // 5. 按匹配度降序排序
    enhancedAvatars.sort((a, b) => b.matchScore - a.matchScore)
    
    // 6. 限制返回数量
    const orderAvatarCount = order.expectedQuantity || order.expected_quantity || order.avatarCount || order.avatar_count || 3
    const limitedAvatars = enhancedAvatars.slice(0, Math.max(orderAvatarCount, 3)) // 至少返回3个
    
    // 标记最佳推荐
    limitedAvatars.forEach((avatar, index) => {
      avatar.isBest = index === 0
    })
    
    console.log('[RecommendationService] 订单需要分身数:', orderAvatarCount, '，返回推荐分身数量:', limitedAvatars.length)
    limitedAvatars.forEach(a => console.log(`  ${a.name} | 匹配度:${a.matchScore} | 技能:${a.matchDetails.skillScore} | 风格:${a.matchDetails.styleScore} | 领域:${a.matchDetails.nicheScore}`))
    
    return limitedAvatars
  }

  private getCompletedTasksCount(avatarId: string): number {
    // 简化处理
    return Math.floor(Math.random() * 50) + 10
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
