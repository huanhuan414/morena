/**
 * 技能广场服务
 * 提供技能列表、购买、评价等功能
 */

import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import {
  Skill,
  AvatarSkill,
  SkillReview,
  CreateSkillDto,
  PurchaseSkillDto,
  SkillFilter
} from './skills.types'

@Injectable()
export class SkillsService {
  /**
   * 获取技能列表
   */
  async getSkills(filter?: SkillFilter, page: number = 1, pageSize: number = 20) {
    try {
      let query = getSupabaseClient()
        .from('skills')
        .select('*', { count: 'exact' })
        .eq('status', 'active')

      // 应用过滤条件
      if (filter) {
        if (filter.type) {
          query = query.eq('type', filter.type)
        }
        if (filter.category) {
          query = query.eq('category', filter.category)
        }
        if (filter.minPrice !== undefined) {
          query = query.gte('price', filter.minPrice)
        }
        if (filter.maxPrice !== undefined) {
          query = query.lte('price', filter.maxPrice)
        }
        if (filter.minRating !== undefined) {
          query = query.gte('rating', filter.minRating)
        }
        if (filter.tags && filter.tags.length > 0) {
          query = query.overlaps('tags', filter.tags)
        }
        if (filter.search) {
          query = query.or(`name.ilike.%${filter.search}%,description.ilike.%${filter.search}%`)
        }
      }

      // 分页
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to).order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) {
        throw new Error(`获取技能列表失败: ${error.message}`)
      }

      return {
        skills: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    } catch (error) {
      console.error('[SkillsService] getSkills error:', error)
      throw error
    }
  }

  /**
   * 获取技能详情
   */
  async getSkillById(skillId: string): Promise<Skill> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('skills')
        .select('*')
        .eq('id', skillId)
        .single()

      if (error || !data) {
        throw new Error('技能不存在')
      }

      return data as Skill
    } catch (error) {
      console.error('[SkillsService] getSkillById error:', error)
      throw error
    }
  }

  /**
   * 创建自定义技能
   */
  async createSkill(userId: string, dto: CreateSkillDto): Promise<Skill> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('skills')
        .insert({
          name: dto.name,
          description: dto.description,
          type: dto.type,
          toolName: dto.toolName,
          price: dto.price || 0,
          creatorId: userId,
          category: dto.category,
          icon: dto.icon,
          tags: dto.tags || [],
          capabilities: dto.capabilities || {},
          requirements: dto.requirements,
          status: 'active'
        })
        .select()
        .single()

      if (error || !data) {
        throw new Error(`创建技能失败: ${error.message}`)
      }

      return data as Skill
    } catch (error) {
      console.error('[SkillsService] createSkill error:', error)
      throw error
    }
  }

  /**
   * 购买技能
   */
  async purchaseSkill(userId: string, dto: PurchaseSkillDto): Promise<AvatarSkill> {
    try {
      // 检查技能是否存在
      const skill = await this.getSkillById(dto.skillId)

      // 检查是否已购买
      const { data: existing } = await getSupabaseClient()
        .from('avatar_skills')
        .select('*')
        .eq('avatar_id', dto.avatarId)
        .eq('skill_id', dto.skillId)
        .single()

      if (existing) {
        throw new Error('该分身已拥有此技能')
      }

      // 检查用户余额（如果是付费技能）
      if (skill.price > 0) {
        const { data: user } = await getSupabaseClient()
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single()

        if (!user || user.balance < skill.price) {
          throw new Error('余额不足，请先充值')
        }

        // 扣除余额
        await getSupabaseClient()
          .from('users')
          .update({ balance: user.balance - skill.price })
          .eq('id', userId)
      }

      // 添加技能到分身
      const { data: avatarSkill, error: insertError } = await getSupabaseClient()
        .from('avatar_skills')
        .insert({
          avatarId: dto.avatarId,
          skillId: dto.skillId,
          userId: userId,
          purchasePrice: skill.price
        })
        .select()
        .single()

      if (insertError || !avatarSkill) {
        throw new Error(`购买技能失败: ${insertError.message}`)
      }

      // 更新技能购买次数
      await getSupabaseClient()
        .from('skills')
        .update({ purchaseCount: skill.purchaseCount + 1 })
        .eq('id', dto.skillId)

      return avatarSkill as AvatarSkill
    } catch (error) {
      console.error('[SkillsService] purchaseSkill error:', error)
      throw error
    }
  }

  /**
   * 获取分身已拥有的技能
   */
  async getAvatarSkills(avatarId: string): Promise<AvatarSkill[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('avatar_skills')
        .select(`
          *,
          skill:skills(*)
        `)
        .eq('avatar_id', avatarId)
        .order('purchased_at', { ascending: false })

      if (error) {
        throw new Error(`获取分身技能失败: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('[SkillsService] getAvatarSkills error:', error)
      throw error
    }
  }

  /**
   * 添加技能评价
   */
  async addReview(
    userId: string,
    skillId: string,
    rating: number,
    comment?: string
  ): Promise<SkillReview> {
    try {
      // 检查是否已评价
      const { data: existing } = await getSupabaseClient()
        .from('skill_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('skill_id', skillId)
        .single()

      if (existing) {
        throw new Error('您已评价过此技能')
      }

      // 添加评价
      const { data: review, error: insertError } = await getSupabaseClient()
        .from('skill_reviews')
        .insert({
          userId,
          skillId,
          rating,
          comment
        })
        .select()
        .single()

      if (insertError || !review) {
        throw new Error(`添加评价失败: ${insertError.message}`)
      }

      // 更新技能评分
      const { data: allReviews } = await getSupabaseClient()
        .from('skill_reviews')
        .select('rating')
        .eq('skill_id', skillId)

      if (allReviews && allReviews.length > 0) {
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        await getSupabaseClient()
          .from('skills')
          .update({
            rating: parseFloat(avgRating.toFixed(2)),
            ratingCount: allReviews.length
          })
          .eq('id', skillId)
      }

      return review as SkillReview
    } catch (error) {
      console.error('[SkillsService] addReview error:', error)
      throw error
    }
  }

  /**
   * 获取技能评价列表
   */
  async getSkillReviews(skillId: string, page: number = 1, pageSize: number = 10) {
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error, count } = await getSupabaseClient()
        .from('skill_reviews')
        .select(`
          *,
          user:users(id, nickname, avatar_url)
        `, { count: 'exact' })
        .eq('skill_id', skillId)
        .range(from, to)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`获取评价列表失败: ${error.message}`)
      }

      return {
        reviews: data || [],
        total: count || 0,
        page,
        pageSize
      }
    } catch (error) {
      console.error('[SkillsService] getSkillReviews error:', error)
      throw error
    }
  }

  /**
   * 获取分类列表
   */
  async getCategories(): Promise<string[]> {
    try {
      const { data } = await getSupabaseClient()
        .from('skills')
        .select('category')
        .not('category', 'is', null)
        .order('category')

      const categories = [...new Set(data?.map(s => s.category).filter(Boolean))]
      return categories || []
    } catch (error) {
      console.error('[SkillsService] getCategories error:', error)
      return []
    }
  }

  /**
   * 搜索技能
   */
  async searchSkills(keyword: string, limit: number = 10): Promise<Skill[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('skills')
        .select('*')
        .eq('status', 'active')
        .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,tags.cs.{${keyword}}`)
        .limit(limit)

      if (error) {
        throw new Error(`搜索技能失败: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('[SkillsService] searchSkills error:', error)
      return []
    }
  }
}
