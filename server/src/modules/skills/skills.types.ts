/**
 * 技能广场类型定义
 */

export interface Skill {
  id: string
  name: string
  description: string
  type: 'prebuilt' | 'custom' | 'paid'
  toolName?: string
  price: number
  creatorId?: string
  category?: string
  icon?: string
  tags: string[]
  capabilities?: any
  requirements?: string
  usageCount: number
  purchaseCount: number
  rating: number
  ratingCount: number
  status: 'active' | 'inactive' | 'pending'
  createdAt: string
  updatedAt: string
}

export interface AvatarSkill {
  id: string
  avatarId: string
  skillId: string
  userId: string
  purchasePrice: number
  purchasedAt: string
  lastUsedAt?: string
  usageCount: number
  skill?: Skill  // 关联的技能信息
}

export interface SkillReview {
  id: string
  skillId: string
  userId: string
  rating: number
  comment?: string
  createdAt: string
  user?: {
    id: string
    nickname?: string
    avatarUrl?: string
  }
}

export interface CreateSkillDto {
  name: string
  description: string
  type: 'custom' | 'paid'
  toolName?: string
  price?: number
  category?: string
  icon?: string
  tags?: string[]
  capabilities?: any
  requirements?: string
}

export interface PurchaseSkillDto {
  avatarId: string
  skillId: string
}

export interface SkillFilter {
  type?: 'prebuilt' | 'custom' | 'paid'
  category?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  tags?: string[]
  search?: string
}
