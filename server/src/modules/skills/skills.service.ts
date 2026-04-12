/**
 * 技能广场服务
 * 提供技能列表、购买、评价等功能
 */

import { Injectable } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
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
  private llmClient: LLMClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }
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
        throw new Error(`创建技能失败: ${error?.message || '未知错误'}`)
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

      // 检查是否已购买（通过 skill_type）
      const { data: existing } = await getSupabaseClient()
        .from('avatar_skills')
        .select('*')
        .eq('avatar_id', dto.avatarId)
        .eq('skill_type', skill.toolName)
        .single()

      if (existing) {
        console.log('[SkillsService] 技能已存在，更新 metadata')
        // 技能已存在，更新 metadata
        const { data: updated, error: updateError } = await getSupabaseClient()
          .from('avatar_skills')
          .update({
            metadata: {
              ...existing.metadata,
              skill_id: dto.skillId,
              skill_name: skill.name,
              purchase_price: skill.price,
              updated_at: new Date().toISOString()
            } as any
          })
          .eq('id', existing.id)

        if (updateError) {
          throw new Error(`更新技能失败: ${updateError.message}`)
        }

        return updated as AvatarSkill
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
          id: crypto.randomUUID(),
          avatar_id: dto.avatarId,
          skill_type: skill.toolName || 'custom',
          skill_level: 1,
          usage_count: 0,
          metadata: {
            skill_id: dto.skillId,
            skill_name: skill.name,
            purchase_price: skill.price,
            purchased_at: new Date().toISOString()
          } as any
        })
        .select()
        .single()

      if (insertError || !avatarSkill) {
        throw new Error(`购买技能失败: ${insertError?.message || '未知错误'}`)
      }

      // 更新技能购买次数
      await getSupabaseClient()
        .from('skills')
        .update({ purchase_count: (skill.purchaseCount || 0) + 1 })
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
        .select('*')
        .eq('avatar_id', avatarId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`获取分身技能失败: ${error.message}`)
      }

      console.log('[SkillsService] getAvatarSkills - 原始数据:', data)
      console.log('[SkillsService] getAvatarSkills - 数据长度:', data?.length)

      // 打印每个项的结构
      if (data && data.length > 0) {
        data.forEach((item: any, index: number) => {
          console.log(`[SkillsService] avatar_skills[${index}]:`, {
            id: item.id,
            avatar_id: item.avatar_id,
            skill_type: item.skill_type,
            metadata: item.metadata,
            全部字段: Object.keys(item)
          })
        })
      }

      // 通过 skill_type 查询 skills 表，获取对应的 id
      const result: any[] = []
      for (const item of data || []) {
        const skillType = item.skill_type
        console.log('[SkillsService] 查询技能，skill_type:', skillType)

        // 查询 skills 表，获取 id
        const { data: skillData, error: skillError } = await getSupabaseClient()
          .from('skills')
          .select('id, name, tool_name')
          .eq('tool_name', skillType)
          .single()

        if (skillError) {
          console.warn(`[SkillsService] 未找到技能，skill_type: ${skillType}, error:`, skillError)
          continue
        }

        result.push({
          ...item,
          skillId: skillData.id
        })

        console.log('[SkillsService] 找到技能匹配:', {
          skill_type: skillType,
          skill_id: skillData.id,
          skill_name: skillData.name
        })
      }

      console.log('[SkillsService] getAvatarSkills - 返回数据:', result)

      return result
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
        throw new Error(`添加评价失败: ${insertError?.message || '未知错误'}`)
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
        .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
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

  /**
   * 使用 AI 生成技能描述和标签
   */
  async generateSkillWithAI(prompt: string) {
    try {
      const systemPrompt = `你是一个专业的技能设计专家，擅长从用户描述中提取关键信息，生成详细的技能描述和标签。

用户会提供一个简短的需求描述，你需要：
1. 生成一个专业的技能名称（8-20字）
2. 生成详细的技能描述（50-100字）
3. 识别技能所属分类（从以下分类中选择：内容创作、平台发布、平台管理、社交互动、订阅管理、图像生成、视频生成、文本分析、语音识别）
4. 生成3-5个相关标签
5. 描述技能的核心能力（JSON格式）
6. 说明使用要求（如果没有，填"无"）`

      const userPrompt = `用户需求描述：
${prompt}

请以 JSON 格式返回以下信息：
{
  "name": "优化后的技能名称",
  "description": "优化后的详细描述（50-100字）",
  "category": "技能分类（从以下选择：内容创作、平台发布、平台管理、社交互动、订阅管理、图像生成、视频生成、文本分析、语音识别）",
  "tags": ["标签1", "标签2", "标签3"],
  "capabilities": {
    "功能描述": "这个技能的主要功能"
  },
  "requirements": "使用要求（如需要特定配置）",
  "icon": "推荐一个emoji图标"
}

直接返回 JSON，不要有任何额外文字说明。`

      const response = await this.llmClient.invoke(
        [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        {
          model: 'doubao-seed-1-8-251228',
          temperature: 0.7
        }
      )

      // 解析 AI 返回的 JSON
      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const generatedData = JSON.parse(jsonMatch[0])

        // 根据分类选择合适的工具名称
        const toolNameMap: Record<string, string> = {
          '内容创作': 'write_article',
          '平台发布': 'publish_content',
          '平台管理': 'manage_platform',
          '社交互动': 'social_interaction',
          '订阅管理': 'manage_subscription',
          '图像生成': 'generate_image',
          '视频生成': 'generate_video',
          '文本分析': 'analyze_text',
          '语音识别': 'recognize_speech'
        }

        return {
          name: generatedData.name || '未命名技能',
          description: generatedData.description || prompt,
          category: generatedData.category || '内容创作',
          tags: generatedData.tags || [],
          capabilities: generatedData.capabilities || {},
          requirements: generatedData.requirements || '无',
          icon: generatedData.icon || '🎯',
          tool_name: toolNameMap[generatedData.category] || 'custom'
        }
      }

      // 如果解析失败，返回默认数据
      return {
        name: '自定义技能',
        description: prompt,
        category: '内容创作',
        tags: [],
        capabilities: {},
        requirements: '无',
        icon: '🎯',
        tool_name: 'custom'
      }
    } catch (error) {
      console.error('[SkillsService] AI 生成失败:', error)
      // 返回默认数据
      return {
        name: '自定义技能',
        description: prompt,
        category: '内容创作',
        tags: [],
        capabilities: {},
        requirements: '无',
        icon: '🎯',
        tool_name: 'custom'
      }
    }
  }
}
