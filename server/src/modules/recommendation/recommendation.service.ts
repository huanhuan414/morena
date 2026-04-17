import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

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
    // 获取用户信息
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        avatars: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    const latestAvatar = user.avatars[0]
    const userPersonality = latestAvatar?.personality || null
    const userAbilities = latestAvatar?.abilities || []

    // 获取其他用户的公开分身
    const otherAvatars = await this.prisma.aiAvatar.findMany({
      where: {
        userId: { not: userId },
        isPublic: true,
        status: 'active'
      },
      include: {
        user: {
          select: {
            id: true,
            latitude: true,
            longitude: true
          }
        }
      },
      take: limit * 2 // 获取更多候选，用于排序
    })

    // 为每个分身计算推荐分数
    const scoredAvatars = otherAvatars.map(avatar => {
      let matchScore = 50 // 基础分
      const reasons = []

      // 1. 等级得分（占20%）
      const levelScore = Math.min(avatar.level / 50 * 20, 20)
      matchScore += levelScore
      if (avatar.level >= 10) reasons.push('高等级')

      // 2. 地理位置得分（占25%）
      let distance: number | undefined
      if (location?.latitude && location?.longitude && avatar.user.latitude && avatar.user.longitude) {
        distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          avatar.user.latitude,
          avatar.user.longitude
        )
        const distanceScore = Math.max(25 - distance * 0.5, 0) // 距离越近得分越高，最高25分
        matchScore += distanceScore
        if (distance < 50) reasons.push('距离近')
      }

      // 3. 性格匹配度（占30%）
      const personalityMatch = this.calculatePersonalityMatch(userPersonality, avatar.personality)
      matchScore += personalityMatch * 0.3
      if (personalityMatch >= 70) reasons.push('性格匹配')

      // 4. 技能互补性（占25%）
      const abilityMatch = this.calculateAbilityMatch(userAbilities, avatar.abilities || [])
      matchScore += abilityMatch * 0.25
      if (abilityMatch >= 60) reasons.push('技能互补')

      // 5. 活跃度加分（+5分）
      if (avatar.exp > 1000) {
        matchScore += 5
        reasons.push('高活跃度')
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
          avatar_url: avatar.avatarUrl,
          level: avatar.level,
          personality: avatar.personality,
          abilities,
          exp: avatar.exp,
          distance: avatar.distance,
          matchScore: avatar.matchScore,
          description: avatar.description || `一个${avatar.personality}的AI分身`,
          location: avatar.user.latitude && avatar.user.longitude ? {
            latitude: avatar.user.latitude,
            longitude: avatar.user.longitude
          } : undefined
        }
      })

    return recommendations
  }
}
