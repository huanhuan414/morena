import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class RecommendationService {

  /**
   * 计算两个经纬度之间的距离（单位：公里）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371 // 地球半径（公里）
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    return distance
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * 计算性格匹配度
   */
  private calculatePersonalityMatch(
    userPersonality: string | null,
    avatarPersonality: string
  ): number {
    if (!userPersonality) return 50 // 默认中等匹配

    const personalityTypes = {
      creative: ['creative', 'analytical'],
      analytical: ['analytical', 'strategic'],
      empathetic: ['empathetic', 'creative'],
      strategic: ['strategic', 'analytical']
    }

    const userMatches = personalityTypes[userPersonality as keyof typeof personalityTypes] || []
    if (userMatches.includes(avatarPersonality)) {
      return 85 // 高匹配
    } else if (userPersonality === avatarPersonality) {
      return 70 // 中等匹配
    }
    return 50 // 低匹配
  }

  /**
   * 计算技能匹配度
   */
  private calculateAbilityMatch(
    userAbilities: string[],
    avatarAbilities: any[]
  ): number {
    if (!userAbilities.length || !avatarAbilities.length) return 50

    const userAbilityNames = userAbilities.map(a => {
      if (typeof a === 'object' && 'tool_name' in a) {
        return (a as any).tool_name
      }
      return a
    })

    const avatarAbilityNames = avatarAbilities.map(a => {
      if (typeof a === 'object' && 'tool_name' in a) {
        return (a as any).tool_name
      }
      return a
    })

    const commonAbilities = userAbilityNames.filter(name =>
      avatarAbilityNames.includes(name)
    )

    const matchRatio = commonAbilities.length / Math.max(userAbilityNames.length, 1)
    return Math.min(50 + matchRatio * 50, 100) // 50-100分
  }

  /**
   * 获取推荐分身列表
   */
  async getRecommendations(
    userId: string,
    location?: { latitude: number | null; longitude: number | null },
    limit: number = 20
  ) {
    const client = getSupabaseClient()

    console.log('[推荐服务] 开始获取推荐分身，userId:', userId)

    try {
      // 获取用户信息
      const { data: user, error: userError } = await client
        .from('users')
        .select(`
          *,
          avatars (
            id,
            personality,
            abilities
          )
        `)
        .eq('id', userId)
        .maybeSingle() // 使用 maybeSingle 而不是 single，避免用户不存在时报错

      console.log('[推荐服务] 用户信息:', user ? '已获取' : '不存在')

      const latestAvatar = user?.avatars && user.avatars.length > 0 ? user.avatars[0] : null
      const userPersonality = latestAvatar?.personality || null
      const userAbilities = latestAvatar?.abilities || []
      console.log('[推荐服务] 用户分身:', latestAvatar ? '存在' : '不存在')

      // 获取其他用户的公开分身
      const { data: otherAvatars, error: avatarsError } = await client
        .from('avatars')
        .select('*')
        .neq('user_id', userId)
        .eq('is_public', true)
        .eq('status', 'active')
        .limit(limit * 2) // 获取更多候选，用于排序

      console.log('[推荐服务] 公开分身数量:', otherAvatars?.length || 0)

      if (avatarsError) {
        console.error('[推荐服务] 获取公开分身失败:', avatarsError)
        // 不抛出错误，返回空数组
        return []
      }

      if (!otherAvatars || otherAvatars.length === 0) {
        console.log('[推荐服务] 没有公开分身可用')
        return []
      }

      // 获取这些分身对应的用户信息（获取所有用户ID）
      const userIds = [...new Set(otherAvatars.map(a => a.user_id))]
      const { data: users } = await client
        .from('users')
        .select('id, latitude, longitude')
        .in('id', userIds)
      
      const userMap = new Map(users?.map(u => [u.id, u]) || [])

      // 为每个分身计算推荐分数
      const scoredAvatars = otherAvatars.map(avatar => {
      let matchScore = 50 // 基础分
      const reasons: string[] = []

      // 1. 等级得分（占20%）
      const levelScore = Math.min(avatar.level / 50 * 20, 20)
      matchScore += levelScore
      if (avatar.level >= 10) reasons.push('High Level')

      // 2. 地理位置得分（占25%）
      let distance: number | undefined
      const user = userMap.get(avatar.user_id)
      if (location?.latitude && location?.longitude && user?.latitude && user?.longitude) {
        distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          user.latitude,
          user.longitude
        )
        const distanceScore = Math.max(25 - distance * 0.5, 0) // 距离越近得分越高，最高25分
        matchScore += distanceScore
        if (distance < 50) reasons.push('Nearby')
      }

      // 3. 性格匹配度（占30%）
      const personalityMatch = this.calculatePersonalityMatch(userPersonality, avatar.personality)
      matchScore += personalityMatch * 0.3
      if (personalityMatch >= 70) reasons.push('Personality Match')

      // 4. 技能互补性（占25%）
      const abilityMatch = this.calculateAbilityMatch(userAbilities, avatar.abilities || [])
      matchScore += abilityMatch * 0.25
      if (abilityMatch >= 60) reasons.push('Skill Complementarity')

      // 5. 活跃度加分（+5分）
      if (avatar.exp > 1000) {
        matchScore += 5
        reasons.push('High Activity')
      }

      return {
        ...avatar,
        distance,
        matchScore: Math.round(matchScore),
        matchReasons: reasons
      }
    })

    // 按推荐分数排序，取前limit个
    const recommendations = scoredAvatars
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
      .map(avatar => {
        const abilities = (avatar.abilities || []).map((a: any) => {
          if (typeof a === 'string') {
            return a
          }
          return a.tool_name || a.name || '未知'
        })

        return {
          id: avatar.id,
          name: avatar.name,
          avatar_url: avatar.avatar_url,
          level: avatar.level,
          personality: avatar.personality,
          abilities,
          exp: avatar.exp,
          distance: avatar.distance,
          matchScore: avatar.matchScore,
          description: avatar.description || `一个${avatar.personality}的AI分身`,
          location: user?.latitude && user?.longitude ? {
            latitude: user.latitude,
            longitude: user.longitude
          } : undefined
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)

      return recommendations
    } catch (error) {
      console.error('[推荐服务] 推荐分身失败:', error)
      return []
    }
  }
}
