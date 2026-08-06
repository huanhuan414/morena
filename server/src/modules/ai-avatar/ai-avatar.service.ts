import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

import { getPool } from '../../storage/database/mysql-client'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { CoinService } from '../coin/coin.service'
import { UploadService } from '../upload/upload.service'

/** 等级对应最大分身数量 */
const LEVEL_MAX_AVATARS: Record<number, number> = {
  1: 1,   // 免费版
  2: 3,   // 基础版
  3: 10,  // 专业版
  4: 20,  // 企业版
}

/** 创建分身的入参（对应 ai_avatar 表字段） */
export interface CreateAiAvatarDto {
  avatar_name: string
  avatar_url?: string
  cover_url?: string
  description?: string
  tags_json?: {
    age?: string
    gender?: string
    occupation?: string
    location?: string
    tags?: string[]
  }
  skill_type: string
}

/** 配额查询结果 */
export interface AvatarQuotaInfo {
  level: number
  levelName: string
  currentCount: number
  maxCount: number
  canCreate: boolean
}

/** 创建生成任务的入参 */
export interface CreateGenerationTaskDto {
  avatarId: number
  templateId: number
  inputParams?: Record<string, string>
  inputMaterials?: Array<{ name: string; url: string; type: string }>
  idempotencyKey: string
}

@Injectable()
export class AiAvatarService {
  constructor(
    private readonly coinService: CoinService,
    private readonly uploadService: UploadService,
  ) {}
  /**
   * 查询用户分身配额
   * 读取 users.level + 统计 ai_avatar 已创建数量
   */
  async getAvatarQuota(userId: string): Promise<AvatarQuotaInfo> {
    const pool = getPool()

    const [userRows] = await pool.query<any[]>(
      'SELECT level FROM users WHERE id = ? LIMIT 1',
      [userId]
    )
    const level = Number(userRows?.[0]?.level) || 1

    const [countRows] = await pool.query<any[]>(
      'SELECT COUNT(*) AS cnt FROM ai_avatar WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    )
    const currentCount = Number(countRows?.[0]?.cnt) || 0

    const maxCount = LEVEL_MAX_AVATARS[level] ?? 1
    const levelNames: Record<number, string> = { 1: '免费版', 2: '基础版', 3: '专业版', 4: '企业版' }

    return {
      level,
      levelName: levelNames[level] || '免费版',
      currentCount,
      maxCount,
      canCreate: currentCount < maxCount,
    }
  }

  /**
   * 创建分身（草稿状态）
   * 对应 ai_avatar 表 INSERT，status 默认为 '草稿'
   */
  async createAvatar(userId: string, dto: CreateAiAvatarDto) {
    // 创建前再次校验配额
    const quota = await this.getAvatarQuota(userId)
    if (!quota.canCreate) {
      throw new Error(`分身数量已达上限（${quota.levelName}最多${quota.maxCount}个）`)
    }

    const db = getMySQLClient('ai_avatar')

    const result = await db.insert({
      user_id: userId,
      avatar_name: dto.avatar_name,
      avatar_url: dto.avatar_url || null,
      cover_url: dto.cover_url || null,
      description: dto.description || null,
      tags_json: dto.tags_json ? JSON.stringify(dto.tags_json) : null,
      skill_type: dto.skill_type,
      status: '草稿',
      public_status: '私有',
    })

    if (result.error) {
      throw new Error(result.error?.message || '创建分身失败')
    }

    const insertId = result.data?.insertId || result.data?.id
    return { id: insertId }
  }

  /**
   * 根据 ID 查询分身（仅限本人）
   */
  async getAvatarById(avatarId: number, userId: string) {
    const db = getMySQLClient('ai_avatar')
    const row = await db.queryOne({ id: avatarId, user_id: userId })
    return row || null
  }

  /**
   * 查询分身已绑定的模板列表（返回 source_template_id + 首条 skill_type）
   */
  async getAvatarBoundTemplates(avatarId: number, userId: string): Promise<{ sourceIds: number[]; skillType: string }> {
    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      `SELECT source_template_id, skill_type FROM ai_avatar_template
       WHERE avatar_id = ? AND user_id = ? AND template_source = '官方复制'
         AND deleted_at IS NULL
       ORDER BY id ASC`,
      [avatarId, userId]
    )
    const list = rows || []
    const sourceIds = list
      .map((r: any) => Number(r.source_template_id))
      .filter((id: number) => id > 0)
    const skillType = String(list[0]?.skill_type || '')
    return { sourceIds, skillType }
  }

  /**
   * 差量同步模板到分身（编辑模式专用）
   *
   * 对比逻辑（基于 source_template_id）：
   * - 本次选中且已存在 → 保留不动
   * - 本次选中但不存在 → 新复制
   * - 原来存在但本次未选中 → 软删除
   */
  async syncTemplatesToAvatar(avatarId: number, userId: string, selectedSourceIds: number[]) {
    const pool = getPool()

    const [avatarRows] = await pool.query<any[]>(
      'SELECT id, skill_type FROM ai_avatar WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [avatarId, userId]
    )
    if (!avatarRows?.length) {
      throw new Error('分身不存在或无权操作')
    }

    if (!selectedSourceIds.length) {
      throw new Error('请至少选择一个模板')
    }

    const bound = await this.getAvatarBoundTemplates(avatarId, userId)
    const existingSourceIds = bound.sourceIds

    const toAdd = selectedSourceIds.filter(id => !existingSourceIds.includes(id))
    const toDelete = existingSourceIds.filter(id => !selectedSourceIds.includes(id))

    if (toDelete.length > 0) {
      const delPlaceholders = toDelete.map(() => '?').join(',')
      await pool.query(
        `DELETE FROM ai_avatar_template
         WHERE avatar_id = ? AND user_id = ? AND source_template_id IN (${delPlaceholders})
           AND template_source = '官方复制'`,
        [avatarId, userId, ...toDelete]
      )
    }

    const copiedIds: number[] = []
    if (toAdd.length > 0) {
      const addPlaceholders = toAdd.map(() => '?').join(',')
      const [templateRows] = await pool.query<any[]>(
        `SELECT * FROM ai_avatar_template
         WHERE id IN (${addPlaceholders})
           AND template_source = '官方模板' AND status = '已启用' AND deleted_at IS NULL`,
        toAdd
      )

      for (const tpl of (templateRows || [])) {
        const tagsJson = this.toJsonString(tpl.tags_json)
        const promptVarsJson = this.toJsonString(tpl.prompt_variables_json)
        const materialConfigJson = this.toJsonString(tpl.material_config_json)
        const modelParamsJson = this.toJsonString(tpl.model_params_json)
        const outputConfigJson = this.toJsonString(tpl.output_config_json)

        const [insertResult] = await pool.query<any>(
          `INSERT INTO ai_avatar_template
           (avatar_id, user_id, source_template_id, source_version_no, template_source,
            template_name, template_description, cover_url, skill_type, tags_json,
            model_api_id, prompt_text, prompt_variables_json, material_config_json,
            model_params_json, output_config_json, creator_income_points, status, display_status)
           VALUES (?, ?, ?, ?, '官方复制', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待测试', '仅自己可见')`,
          [
            avatarId, userId, tpl.id, tpl.version_no || 1,
            tpl.template_name, tpl.template_description, tpl.cover_url, tpl.skill_type,
            tagsJson, tpl.model_api_id || 0, tpl.prompt_text,
            promptVarsJson, materialConfigJson, modelParamsJson, outputConfigJson,
            tpl.creator_income_points || 0,
          ]
        )
        if (insertResult?.insertId) {
          copiedIds.push(insertResult.insertId)
        }
      }
    }

    const [pendingRows] = await pool.query<any[]>(
      `SELECT id FROM ai_avatar_template
       WHERE avatar_id = ? AND user_id = ?
         AND status IN ('草稿', '待测试') AND deleted_at IS NULL
       ORDER BY id ASC`,
      [avatarId, userId]
    )
    const pendingTemplates = (pendingRows || []).map((r: any) => Number(r.id))

    if (pendingTemplates.length > 0) {
      await pool.query(
        `UPDATE ai_avatar SET status = '待测试' WHERE id = ? AND user_id = ?`,
        [avatarId, userId]
      )
    }

    const kept = selectedSourceIds.filter(id => existingSourceIds.includes(id))
    return {
      added: copiedIds.length,
      deleted: toDelete.length,
      kept: kept.length,
      copiedIds,
      pendingTestCount: pendingTemplates.length,
      pendingTestTemplateId: pendingTemplates[0] || 0,
    }
  }

  /**
   * 更新分身基础信息（用于编辑模式）
   * 仅允许更新：avatar_name, avatar_url, cover_url, description, tags_json, skill_type
   */
  async updateAvatar(avatarId: number, userId: string, dto: CreateAiAvatarDto) {
    const pool = getPool()

    const [rows] = await pool.query<any[]>(
      'SELECT id, status FROM ai_avatar WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [avatarId, userId]
    )
    if (!rows?.length) {
      throw new Error('分身不存在或无权操作')
    }

    const tagsJsonStr = dto.tags_json ? JSON.stringify(dto.tags_json) : null

    await pool.query(
      `UPDATE ai_avatar
       SET avatar_name = ?, avatar_url = ?, cover_url = ?, description = ?, tags_json = ?, skill_type = ?
       WHERE id = ? AND user_id = ?`,
      [
        dto.avatar_name,
        dto.avatar_url || null,
        dto.cover_url || null,
        dto.description || null,
        tagsJsonStr,
        dto.skill_type,
        avatarId,
        userId,
      ]
    )

    return { id: avatarId }
  }

  /**
   * 查询分身下"待测试"状态的模版数量及首条模版ID
   */
  async getPendingTemplates(avatarId: number, userId: string): Promise<{ count: number; firstTemplateId: number }> {
    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      `SELECT id FROM ai_avatar_template
       WHERE avatar_id = ? AND user_id = ? AND template_source = '官方复制'
         AND status = '待测试' AND deleted_at IS NULL
       ORDER BY id ASC`,
      [avatarId, userId]
    )
    const list = rows || []
    return {
      count: list.length,
      firstTemplateId: list.length > 0 ? Number(list[0].id) : 0,
    }
  }

  /**
   * 查询分身下的完整模版列表（含统计摘要，支持按状态筛选）
   * @param avatarId 分身ID
   * @param userId   用户ID
   * @param filter   筛选条件: all / pending / enabled
   */
  async getAvatarTemplateList(avatarId: number, userId: string, filter: string = 'all') {
    const pool = getPool()

    const [countRows] = await pool.query<any[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = '待测试' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = '已启用' THEN 1 ELSE 0 END) AS enabled_count
       FROM ai_avatar_template
       WHERE avatar_id = ? AND user_id = ? AND deleted_at IS NULL`,
      [avatarId, userId]
    )
    const summary = {
      total: Number(countRows?.[0]?.total) || 0,
      pendingCount: Number(countRows?.[0]?.pending_count) || 0,
      enabledCount: Number(countRows?.[0]?.enabled_count) || 0,
    }

    let filterCondition = ''
    if (filter === 'pending') filterCondition = " AND status = '待测试'"
    else if (filter === 'enabled') filterCondition = " AND status = '已启用'"

    const [rows] = await pool.query<any[]>(
      `SELECT id, avatar_id, template_name, template_description, cover_url,
              skill_type, tags_json, status, display_status, use_count,
              favorite_count, creator_income_points, version_no, tested_at,
              template_source
       FROM ai_avatar_template
       WHERE avatar_id = ? AND user_id = ? AND deleted_at IS NULL${filterCondition}
       ORDER BY status ASC, id DESC`,
      [avatarId, userId]
    )

    const list = (rows || []).map((row: any) => ({
      id: row.id,
      avatarId: row.avatar_id,
      templateName: row.template_name,
      templateDescription: row.template_description,
      coverUrl: row.cover_url,
      skillType: row.skill_type,
      tags: this.parseJsonSafe(row.tags_json, []),
      status: row.status,
      displayStatus: row.display_status,
      useCount: row.use_count || 0,
      favoriteCount: row.favorite_count || 0,
      creatorIncomePoints: row.creator_income_points || 0,
      versionNo: row.version_no || 1,
      testedAt: row.tested_at ? this.formatDateStr(row.tested_at) : null,
      templateSource: row.template_source,
    }))

    return { summary, list }
  }

  /**
   * 查询模版详情页所需的完整数据（模版 + 分身 + 模型 + 历史作品）
   * @param templateId 模版ID
   * @param userId     用户ID
   */
  async getTemplatePageDetail(templateId: number, userId: string) {
    const pool = getPool()

    const [tplRows] = await pool.query<any[]>(
      `SELECT t.*, m.model_name, m.provider_name, m.description AS model_description,
              m.icon_url AS model_icon_url, m.skill_type AS model_skill_type,
              m.model_cost_points,
              a.avatar_name, a.avatar_url, a.description AS avatar_description,
              a.skill_type AS avatar_skill_type, a.status AS avatar_status
       FROM ai_avatar_template t
       LEFT JOIN ai_model_api m ON t.model_api_id = m.id AND m.deleted_at IS NULL
       LEFT JOIN ai_avatar a ON t.avatar_id = a.id AND a.deleted_at IS NULL
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [templateId]
    )

    if (!tplRows?.length) return null
    const tpl = tplRows[0]

    const templateOwnerId = tpl.user_id
    const [workRows] = await pool.query<any[]>(
      `SELECT id, work_title, work_description, skill_type, cover_url,
              content_json, generated_pay_points, view_count, favorite_count,
              success_item_count, created_at
       FROM ai_generated_work
       WHERE template_id = ? AND user_id = ? AND status = '正常' AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [templateId, templateOwnerId]
    )

    const works = (workRows || []).map((w: any) => {
      const content = this.parseJsonSafe(w.content_json, {})
      const images = content.images || []
      const videoUrl = content.video_url || ''
      return {
        id: w.id,
        title: w.work_title || '',
        description: w.work_description || '',
        skillType: w.skill_type || '',
        coverUrl: w.cover_url || images[0] || '',
        images,
        videoUrl,
        contentText: content.text || content.title || '',
        payPoints: w.generated_pay_points || 0,
        viewCount: w.view_count || 0,
        favoriteCount: w.favorite_count || 0,
        successCount: w.success_item_count || 1,
        createdAt: this.formatDateTimeStr(w.created_at),
      }
    })

    const [statsRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total_works,
              COALESCE(SUM(view_count), 0) AS total_views,
              COALESCE(SUM(favorite_count), 0) AS total_favorites
       FROM ai_generated_work
       WHERE template_id = ? AND user_id = ? AND status = '正常' AND deleted_at IS NULL`,
      [templateId, templateOwnerId]
    )
    const stats = statsRows?.[0] || {}

    const totalCost = (Number(tpl.model_cost_points) || 0) + (Number(tpl.creator_income_points) || 0)
    const outputType = this.inferOutputType(tpl.skill_type)

    return {
      template: {
        id: tpl.id,
        templateName: tpl.template_name,
        templateDescription: tpl.template_description,
        coverUrl: tpl.cover_url,
        skillType: tpl.skill_type,
        tags: this.parseJsonSafe(tpl.tags_json, []),
        status: tpl.status,
        displayStatus: tpl.display_status,
        useCount: tpl.use_count || 0,
        favoriteCount: tpl.favorite_count || 0,
        creatorIncomePoints: tpl.creator_income_points || 0,
        versionNo: tpl.version_no || 1,
        promptText: tpl.prompt_text || '',
        promptVariables: this.parseJsonSafe(tpl.prompt_variables_json, []),
        materialConfig: this.parseJsonSafe(tpl.material_config_json, null),
        outputConfig: this.parseJsonSafe(tpl.output_config_json, null),
        outputType,
        totalCost,
        testedAt: tpl.tested_at ? this.formatDateTimeStr(tpl.tested_at) : null,
        templateSource: tpl.template_source,
      },
      avatar: tpl.avatar_name ? {
        id: tpl.avatar_id,
        avatarName: tpl.avatar_name,
        avatarUrl: tpl.avatar_url,
        description: tpl.avatar_description,
        skillType: tpl.avatar_skill_type,
        status: tpl.avatar_status,
      } : null,
      modelApi: tpl.model_name ? {
        id: tpl.model_api_id,
        modelName: tpl.model_name,
        providerName: tpl.provider_name,
        description: tpl.model_description,
        iconUrl: tpl.model_icon_url,
        skillType: tpl.model_skill_type,
        modelCostPoints: Number(tpl.model_cost_points) || 0,
      } : null,
      works,
      workStats: {
        totalWorks: Number(stats.total_works) || 0,
        totalViews: Number(stats.total_views) || 0,
        totalFavorites: Number(stats.total_favorites) || 0,
      },
      isOwner: String(tpl.user_id) === String(userId),
    }
  }

  /**
   * 更新模版基本信息（仅允许模版所有者编辑）
   * @param templateId 模版ID
   * @param userId     用户ID
   * @param updates    更新字段
   */
  async updateTemplate(
    templateId: number,
    userId: string,
    updates: {
      template_name?: string
      template_description?: string
      tags_json?: string[]
      creator_income_points?: number
      cover_url?: string | null
    },
  ) {
    const pool = getPool()

    const [existing] = await pool.query<any[]>(
      'SELECT id, user_id FROM ai_avatar_template WHERE id = ? AND deleted_at IS NULL',
      [templateId],
    )
    if (!existing?.length) throw new Error('模版不存在')
    if (String(existing[0].user_id) !== String(userId)) throw new Error('无权编辑此模版')

    const setClauses: string[] = []
    const params: any[] = []

    if (updates.template_name !== undefined) {
      setClauses.push('template_name = ?')
      params.push(updates.template_name)
    }
    if (updates.template_description !== undefined) {
      setClauses.push('template_description = ?')
      params.push(updates.template_description)
    }
    if (updates.tags_json !== undefined) {
      setClauses.push('tags_json = ?')
      params.push(JSON.stringify(updates.tags_json))
    }
    if (updates.creator_income_points !== undefined) {
      setClauses.push('creator_income_points = ?')
      params.push(updates.creator_income_points)
    }
    if (updates.cover_url !== undefined) {
      setClauses.push('cover_url = ?')
      params.push(updates.cover_url)
    }

    if (setClauses.length === 0) throw new Error('无更新内容')

    setClauses.push('updated_at = NOW()')
    params.push(templateId, userId)

    await pool.execute(
      `UPDATE ai_avatar_template SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      params,
    )

    return { success: true }
  }

  /**
   * 切换模版对外展示状态
   * @param templateId 模版ID
   * @param userId     用户ID
   * @param displayPublic true=对外展示, false=仅自己可见
   */
  async toggleTemplateDisplayStatus(templateId: number, userId: string, displayPublic: boolean) {
    const pool = getPool()

    const [existing] = await pool.query<any[]>(
      'SELECT id, user_id, status FROM ai_avatar_template WHERE id = ? AND deleted_at IS NULL',
      [templateId],
    )
    if (!existing?.length) throw new Error('模版不存在')
    if (String(existing[0].user_id) !== String(userId)) throw new Error('无权操作此模版')

    const newStatus = displayPublic ? '对外展示' : '仅自己可见'
    await pool.execute(
      'UPDATE ai_avatar_template SET display_status = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [newStatus, templateId, userId],
    )

    return { success: true, displayStatus: newStatus }
  }

  /** 根据技能类型推断输出格式 */
  private inferOutputType(skillType: string): string {
    switch (skillType) {
      case '图片生成': return '图片'
      case '视频生成': return '视频'
      case '图文生成': return '图文 / 文案'
      case '文字生成': return '文字 / 文案'
      default: return '文字'
    }
  }

  /** 格式化日期为 YYYY/MM/DD */
  private formatDateStr(dateValue: any): string {
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  /** 格式化日期为 YYYY-MM-DD HH:mm */
  private formatDateTimeStr(dateValue: any): string {
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  /**
   * 查询官方模板列表（按技能类型筛选）
   * template_source='官方模板' AND status='已启用' AND display_status='对外展示' AND deleted_at IS NULL
   */
  async getOfficialTemplates(skillType?: string) {
    const pool = getPool()

    let sql = `
      SELECT id, template_name, template_description, cover_url, skill_type,
             tags_json, creator_income_points, use_count, favorite_count
      FROM ai_avatar_template
      WHERE template_source = '官方模板'
        AND status = '已启用'
        AND display_status = '对外展示'
        AND deleted_at IS NULL
    `
    const params: any[] = []

    if (skillType) {
      sql += ' AND skill_type = ?'
      params.push(skillType)
    }

    sql += ' ORDER BY use_count DESC, id ASC'

    const [rows] = await pool.query<any[]>(sql, params)
    return (rows || []).map((row: any) => ({
      id: row.id,
      templateName: row.template_name,
      templateDescription: row.template_description,
      coverUrl: row.cover_url,
      skillType: row.skill_type,
      tags: this.parseJsonSafe(row.tags_json, []),
      creatorIncomePoints: row.creator_income_points || 0,
      useCount: row.use_count || 0,
      favoriteCount: row.favorite_count || 0,
    }))
  }

  /**
   * 查询模板详情（含关联模型API信息）
   * 用于技能认证页面展示模板信息和体验设置表单
   */
  async getTemplateDetail(templateId: number) {
    const pool = getPool()

    const [tplRows] = await pool.query<any[]>(
      `SELECT t.*, m.model_name, m.provider_name, m.description AS model_description,
              m.icon_url AS model_icon_url, m.skill_type AS model_skill_type,
              m.model_cost_points
       FROM ai_avatar_template t
       LEFT JOIN ai_model_api m ON t.model_api_id = m.id AND m.deleted_at IS NULL
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [templateId]
    )

    if (!tplRows?.length) return null

    const tpl = tplRows[0]
    return {
      id: tpl.id,
      templateName: tpl.template_name,
      templateDescription: tpl.template_description,
      coverUrl: tpl.cover_url,
      skillType: tpl.skill_type,
      tags: this.parseJsonSafe(tpl.tags_json, []),
      promptText: tpl.prompt_text || '',
      promptVariables: this.parseJsonSafe(tpl.prompt_variables_json, []),
      materialConfig: this.parseJsonSafe(tpl.material_config_json, null),
      outputConfig: this.parseJsonSafe(tpl.output_config_json, null),
      creatorIncomePoints: tpl.creator_income_points || 0,
      useCount: tpl.use_count || 0,
      favoriteCount: tpl.favorite_count || 0,
      status: tpl.status,
      modelApi: tpl.model_name ? {
        id: tpl.model_api_id,
        modelName: tpl.model_name,
        providerName: tpl.provider_name,
        description: tpl.model_description,
        iconUrl: tpl.model_icon_url,
        skillType: tpl.model_skill_type,
        modelCostPoints: tpl.model_cost_points || 0,
      } : null,
    }
  }

  /**
   * 复制官方模板并绑定到分身
   * 1. 校验分身归属
   * 2. 校验官方模板存在且可用
   * 3. 复制为"官方复制"模板，绑定 avatar_id
   * 4. 更新分身 skill_type（若尚未设置）
   */
  async copyTemplatesToAvatar(avatarId: number, userId: string, templateIds: number[]) {
    const pool = getPool()

    // 校验分身归属
    const [avatarRows] = await pool.query<any[]>(
      'SELECT id, skill_type FROM ai_avatar WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [avatarId, userId]
    )
    if (!avatarRows?.length) {
      throw new Error('分身不存在或无权操作')
    }

    if (!templateIds.length) {
      throw new Error('请至少选择一个模板')
    }

    // 查询所选官方模板
    const placeholders = templateIds.map(() => '?').join(',')
    const [templateRows] = await pool.query<any[]>(
      `SELECT * FROM ai_avatar_template
       WHERE id IN (${placeholders})
         AND template_source = '官方模板'
         AND status = '已启用'
         AND deleted_at IS NULL`,
      templateIds
    )

    if (!templateRows?.length) {
      throw new Error('所选模板不存在或已下架')
    }

    // 获取第一个模板的 skill_type 作为分身的技能类型
    const skillType = templateRows[0].skill_type

    // 批量复制模板
    const copiedIds: number[] = []
    for (const tpl of templateRows) {
      const tagsJson = this.toJsonString(tpl.tags_json)
      const promptVarsJson = this.toJsonString(tpl.prompt_variables_json)
      const materialConfigJson = this.toJsonString(tpl.material_config_json)
      const modelParamsJson = this.toJsonString(tpl.model_params_json)
      const outputConfigJson = this.toJsonString(tpl.output_config_json)

      const [insertResult] = await pool.query<any>(
        `INSERT INTO ai_avatar_template
         (avatar_id, user_id, source_template_id, source_version_no, template_source,
          template_name, template_description, cover_url, skill_type, tags_json,
          model_api_id, prompt_text, prompt_variables_json, material_config_json,
          model_params_json, output_config_json, creator_income_points, status, display_status)
         VALUES (?, ?, ?, ?, '官方复制', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '已启用', '仅自己可见')`,
        [
          avatarId,
          userId,
          tpl.id,
          tpl.version_no || 1,
          tpl.template_name,
          tpl.template_description,
          tpl.cover_url,
          tpl.skill_type,
          tagsJson,
          tpl.model_api_id || 0,
          tpl.prompt_text,
          promptVarsJson,
          materialConfigJson,
          modelParamsJson,
          outputConfigJson,
          tpl.creator_income_points || 0,
        ]
      )
      if (insertResult?.insertId) {
        copiedIds.push(insertResult.insertId)
      }
    }

    // 更新分身的 skill_type 和 status
    await pool.query(
      `UPDATE ai_avatar SET skill_type = ?, status = '待测试' WHERE id = ? AND user_id = ?`,
      [skillType, avatarId, userId]
    )

    return { copiedCount: copiedIds.length, copiedIds, skillType }
  }

  /**
   * 调试运行：调用模型API生成内容（不扣积分、不落库任务）
   * 逻辑与 web 后台 call_model_by_template 一致
   */
  async debugRun(templateId: number, filledPrompt: string, materialValues?: Record<string, string>) {
    const pool = getPool()

    // 查询模板及关联模型API
    const [rows] = await pool.query<any[]>(
      `SELECT t.*, m.api_endpoint, m.adapter_code, m.model_code,
              m.credential_ciphertext, m.fixed_params_json AS model_fixed_params,
              m.timeout_seconds, m.status AS model_status, m.model_name,
              m.task_query_endpoint, m.call_mode
       FROM ai_avatar_template t
       LEFT JOIN ai_model_api m ON t.model_api_id = m.id AND m.deleted_at IS NULL
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [templateId]
    )

    if (!rows?.length) {
      return { success: false, output_type: null, result: {}, task_id: null, error: '模板不存在' }
    }

    const tpl = rows[0]

    if (!tpl.api_endpoint) {
      return { success: false, output_type: null, result: {}, task_id: null, error: '该模板未绑定模型API' }
    }

    if (tpl.model_status !== '启用') {
      return { success: false, output_type: null, result: {}, task_id: null, error: `模型「${tpl.model_name}」当前状态为「${tpl.model_status}」，无法调用` }
    }

    const fixedParams = this.parseJsonSafe(tpl.model_fixed_params, null)
    if (!fixedParams || !fixedParams.url || !fixedParams.method || !fixedParams.headers || !fixedParams.body) {
      return { success: false, output_type: null, result: {}, task_id: null, error: '模型API未配置调用模板（fixed_params_json 为空或不完整）' }
    }

    // 解密 API Key
    const apiKey = this.decryptCredential(tpl.credential_ciphertext)
    if (!apiKey) {
      return { success: false, output_type: null, result: {}, task_id: null, error: 'API凭证解密失败' }
    }

    const modelParams = this.parseJsonSafe(tpl.model_params_json, {})
    const timeout = parseInt(tpl.timeout_seconds) || 60

    // 构建占位符映射
    const placeholderMap: Record<string, any> = {
      api_endpoint: tpl.api_endpoint || '',
      adapter_code: tpl.adapter_code || '',
      model_code: tpl.model_code || '',
      credential_ciphertext: apiKey,
      prompt_text: filledPrompt,
      ...modelParams,
      ...(materialValues || {}),
    }

    // 替换所有 {{placeholder}}
    const resolved = this.resolveTemplate(fixedParams, placeholderMap)

    const url = resolved.url || ''
    const method = (resolved.method || 'POST').toUpperCase()
    const headers = resolved.headers || {}
    const body = resolved.body || {}

    if (!url) {
      return { success: false, output_type: null, result: {}, task_id: null, error: 'fixed_params_json 中 url 为空' }
    }

    console.log(`[debugRun] templateId=${templateId} 请求: ${method} ${url.substring(0, 120)}`)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000)

      const resp = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await resp.json()
      return this.parseModelResponse(data)
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { success: false, output_type: null, result: {}, task_id: null, error: `调用模型超时（${timeout}s）` }
      }
      return { success: false, output_type: null, result: {}, task_id: null, error: `调用异常：${e.message}` }
    }
  }

  /**
   * 轮询异步任务状态
   */
  async debugPoll(templateId: number, taskId: string) {
    const pool = getPool()

    const [rows] = await pool.query<any[]>(
      `SELECT t.model_api_id, m.adapter_code, m.task_query_endpoint,
              m.credential_ciphertext, m.timeout_seconds, m.api_endpoint
       FROM ai_avatar_template t
       LEFT JOIN ai_model_api m ON t.model_api_id = m.id AND m.deleted_at IS NULL
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [templateId]
    )

    if (!rows?.length) {
      return { success: false, output_type: null, result: {}, task_id: null, error: '模板不存在' }
    }

    const row = rows[0]
    const apiKey = this.decryptCredential(row.credential_ciphertext)
    if (!apiKey) {
      return { success: false, output_type: null, result: {}, task_id: null, error: 'API凭证解密失败' }
    }

    const timeout = parseInt(row.timeout_seconds) || 60
    const queryUrl = row.task_query_endpoint
    const adapter = (row.adapter_code || '').toLowerCase()
    const endpoint = (row.api_endpoint || '').toLowerCase()

    if (!queryUrl) {
      return { success: false, output_type: null, result: {}, task_id: null, error: '未配置异步任务查询地址' }
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000)

      const resp = await fetch(`${queryUrl.replace(/\/$/, '')}/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await resp.json()

      // CogVideo 系列
      if (/^(cogvideo|glm)/i.test(adapter) || endpoint.includes('bigmodel.cn') || endpoint.includes('zhipuai')) {
        const taskStatus = data.task_status || data?.data?.task_status || ''
        if (['PROCESSING', 'PENDING'].includes(taskStatus)) {
          return { success: false, output_type: 'video', result: {}, task_id: taskId, error: 'pending' }
        }
        if (taskStatus === 'SUCCESS') {
          const videoUrl = (data.video_result || [{}])[0]?.url || (data?.data?.video_result || [{}])[0]?.url
          return { success: true, output_type: 'video', result: { video_url: videoUrl }, task_id: null, error: null }
        }
        return { success: false, output_type: null, result: {}, task_id: null, error: data.fail_reason || '任务失败' }
      }

      // DashScope 万象图片
      if (/^(qwen|wanx)/i.test(adapter) || endpoint.includes('dashscope') || endpoint.includes('aliyuncs')) {
        const output = data.output || {}
        const taskStatus = output.task_status || ''
        if (['PENDING', 'RUNNING'].includes(taskStatus)) {
          return { success: false, output_type: 'image', result: {}, task_id: taskId, error: 'pending' }
        }
        if (taskStatus === 'SUCCEEDED') {
          const images = (output.results || []).map((r: any) => r.url).filter(Boolean)
          return { success: true, output_type: 'image', result: { images }, task_id: null, error: null }
        }
        return { success: false, output_type: null, result: {}, task_id: null, error: output.message || '任务失败' }
      }

      return { success: false, output_type: null, result: {}, task_id: null, error: `adapter_code=${adapter} 暂不支持异步轮询` }
    } catch (e: any) {
      return { success: false, output_type: null, result: {}, task_id: null, error: `轮询异常：${e.message}` }
    }
  }

  /**
   * 生成任务编号 GEN + yyyyMMddHHmmss + 6位随机数
   */
  private generateTaskNo(): string {
    const now = new Date()
    const pad = (n: number, w = 2) => String(n).padStart(w, '0')
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
    return `GEN${ts}${rand}`
  }

  /**
   * 步骤1：创建生成任务 + 扣积分（不调用模型）
   *
   * 前端拿到 taskNo 后自行调用 debug-run 获取生成结果，
   * 再通过 completeGenerationTask 提交结果、落作品、结算收益。
   */
  async createTaskAndDeductPoints(userId: string, dto: CreateGenerationTaskDto) {
    const pool = getPool()

    // ── 1. 校验分身、模板、模型 ──
    const [tplRows] = await pool.query<any[]>(
      `SELECT t.*, m.id AS m_id, m.model_name, m.provider_name, m.model_code,
              m.description AS model_description, m.icon_url AS model_icon_url,
              m.skill_type AS model_skill_type, m.model_cost_points, m.adapter_code,
              m.api_endpoint, m.status AS model_status
       FROM ai_avatar_template t
       LEFT JOIN ai_model_api m ON t.model_api_id = m.id AND m.deleted_at IS NULL
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [dto.templateId]
    )
    if (!tplRows?.length) {
      return { success: false, error: '模板不存在' }
    }
    const tpl = tplRows[0]

    if (tpl.avatar_id && Number(tpl.avatar_id) !== dto.avatarId) {
      return { success: false, error: '模板不属于该分身' }
    }

    const [avatarRows] = await pool.query<any[]>(
      'SELECT id, user_id, skill_type FROM ai_avatar WHERE id = ? AND deleted_at IS NULL',
      [dto.avatarId]
    )
    if (!avatarRows?.length) {
      return { success: false, error: '分身不存在' }
    }
    const avatar = avatarRows[0]
    const avatarUserId = avatar.user_id

    if (!tpl.api_endpoint || tpl.model_status !== '启用') {
      return { success: false, error: `模型「${tpl.model_name || '未绑定'}」不可用` }
    }

    // ── 2. 计算积分 ──
    const modelCostPoints = Number(tpl.model_cost_points) || 0
    const isSelfUse = userId === avatarUserId
    const creatorIncomePoints = isSelfUse ? 0 : (Number(tpl.creator_income_points) || 0)
    const paidPoints = modelCostPoints + creatorIncomePoints

    // ── 3. 幂等检查 ──
    const [existingTask] = await pool.query<any[]>(
      'SELECT id, task_no, status, points_status FROM ai_generation_task WHERE idempotency_key = ?',
      [dto.idempotencyKey]
    )
    if (existingTask?.length) {
      const et = existingTask[0]
      return {
        success: true,
        taskNo: et.task_no,
        status: et.status,
        pointsStatus: et.points_status,
        paidPoints,
        duplicate: true,
      }
    }

    // ── 4. 事务：插入任务 + 扣积分 ──
    const taskNo = this.generateTaskNo()
    const skillType = tpl.skill_type || avatar.skill_type

    const templateSnapshot = {
      template_name: tpl.template_name,
      template_description: tpl.template_description,
      cover_url: tpl.cover_url,
      skill_type: tpl.skill_type,
      prompt_text: tpl.prompt_text,
    }
    const modelSnapshot = {
      model_name: tpl.model_name,
      provider_name: tpl.provider_name,
      model_code: tpl.model_code,
      adapter_code: tpl.adapter_code,
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const [insertResult] = await connection.query<any>(
        `INSERT INTO ai_generation_task
         (task_no, idempotency_key, task_type, user_id, avatar_user_id,
          avatar_id, template_id, model_api_id, skill_type,
          input_params_json, input_materials_json,
          template_snapshot_json, model_snapshot_json,
          model_cost_points, creator_income_points, paid_points,
          points_status, status)
         VALUES (?, ?, '模板测试', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待扣积分', '生成中')`,
        [
          taskNo, dto.idempotencyKey, userId, avatarUserId,
          dto.avatarId, dto.templateId, tpl.model_api_id || tpl.m_id, skillType,
          dto.inputParams ? JSON.stringify(dto.inputParams) : null,
          dto.inputMaterials ? JSON.stringify(dto.inputMaterials) : null,
          JSON.stringify(templateSnapshot), JSON.stringify(modelSnapshot),
          modelCostPoints, creatorIncomePoints, paidPoints,
        ]
      )
      const taskId = insertResult.insertId

      if (paidPoints > 0) {
        await this.coinService.consume(userId, skillType, paidPoints, {
          description: `分身技能认证消费 ${paidPoints} 积分`,
          metadata: {
            business_type: '分身内容生成',
            business_action: '生成扣除',
            task_id: taskId,
            task_no: taskNo,
            attempt_no: 1,
            avatar_id: dto.avatarId,
            template_id: dto.templateId,
            model_api_id: tpl.model_api_id || tpl.m_id,
            model_cost_points: modelCostPoints,
            creator_income_points: creatorIncomePoints,
            paid_points: paidPoints,
          },
          connection,
        })
      }

      await connection.query(
        `UPDATE ai_generation_task SET points_status = '已扣积分', paid_at = NOW(), started_at = NOW() WHERE id = ?`,
        [taskId]
      )

      await connection.commit()

      return {
        success: true,
        taskNo,
        taskId,
        paidPoints,
        modelCostPoints,
        creatorIncomePoints,
        status: '生成中',
        pointsStatus: '已扣积分',
      }
    } catch (error: any) {
      await connection.rollback()
      console.error('创建生成任务事务失败:', error)
      return { success: false, error: error.message || '创建任务失败' }
    } finally {
      connection.release()
    }
  }

  /**
   * 步骤2：模型调用完成后提交结果（成功→落作品+收益 / 失败→退款）
   *
   * 由前端在 debug-run / debug-poll 拿到结果后调用。
   */
  async completeGenerationTask(userId: string, taskNo: string, modelResult: any) {
    const pool = getPool()

    const [taskRows] = await pool.query<any[]>(
      `SELECT * FROM ai_generation_task
       WHERE task_no = ? AND user_id = ? AND deleted_at IS NULL`,
      [taskNo, userId]
    )
    if (!taskRows?.length) {
      return { success: false, error: '任务不存在' }
    }
    const task = taskRows[0]

    if (task.status === '生成成功') {
      return { success: true, status: '生成成功' }
    }
    if (task.status !== '生成中') {
      return { success: false, error: `任务状态异常: ${task.status}` }
    }

    const [tplRows] = await pool.query<any[]>(
      'SELECT * FROM ai_avatar_template WHERE id = ? AND deleted_at IS NULL',
      [task.template_id]
    )
    const tpl = tplRows?.[0] || {}

    const paidPoints = Number(task.paid_points) || 0
    const creatorIncomePoints = Number(task.creator_income_points) || 0
    const skillType = task.skill_type

    if (modelResult.success) {
      try {
        await this.convertBase64ToUrls(modelResult)
        await this.handleGenerationSuccess(
          Number(task.id), task.task_no, task.user_id, task.avatar_user_id,
          {
            avatarId: Number(task.avatar_id),
            templateId: Number(task.template_id),
            inputParams: this.parseJsonSafe(task.input_params_json, null),
            idempotencyKey: task.idempotency_key,
          },
          tpl, skillType, modelResult, paidPoints, creatorIncomePoints,
        )
        return { success: true, status: '生成成功' }
      } catch (err: any) {
        console.error(`[complete] handleGenerationSuccess 异常 taskNo=${taskNo}:`, err?.message, err?.sql || '')
        return { success: false, error: `作品保存失败: ${err?.message || '未知错误'}` }
      }
    } else {
      try {
        await this.handleGenerationFailure(
          Number(task.id), task.task_no, task.user_id, paidPoints, skillType,
          {
            avatarId: Number(task.avatar_id),
            templateId: Number(task.template_id),
            idempotencyKey: task.idempotency_key,
          },
          tpl, modelResult.error || '生成失败',
        )
      } catch (err: any) {
        console.error(`[complete] handleGenerationFailure 异常 taskNo=${taskNo}:`, err?.message)
      }
      return { success: false, status: '生成失败', refunded: paidPoints > 0 }
    }
  }

  /**
   * 步骤2B：后端直接执行模型调用并落作品
   *
   * 前端传入 taskNo + filledPrompt，后端自己调 debugRun → handleSuccess/Failure。
   * 避免前端中转大体积 base64 数据导致传输超时。
   */
  async executeGenerationTask(userId: string, taskNo: string, filledPrompt: string, materialValues?: Record<string, string>) {
    const pool = getPool()

    const [taskRows] = await pool.query<any[]>(
      `SELECT * FROM ai_generation_task
       WHERE task_no = ? AND user_id = ? AND deleted_at IS NULL`,
      [taskNo, userId]
    )
    if (!taskRows?.length) {
      return { success: false, error: '任务不存在' }
    }
    const task = taskRows[0]

    if (task.status === '生成成功') {
      return { success: true, status: '生成成功' }
    }
    if (task.status !== '生成中') {
      return { success: false, error: `任务状态异常: ${task.status}` }
    }

    const templateId = Number(task.template_id)
    console.log(`[execute] taskNo=${taskNo} 开始调用模型, templateId=${templateId}`)

    const modelResult = await this.debugRun(templateId, filledPrompt, materialValues)
    console.log(`[execute] taskNo=${taskNo} 模型返回: success=${modelResult.success}, output_type=${modelResult.output_type}, task_id=${modelResult.task_id}, error=${modelResult.error || 'none'}`)

    if (modelResult.task_id && modelResult.error === 'pending') {
      await pool.query(
        'UPDATE ai_generation_task SET third_party_task_id = ? WHERE id = ?',
        [modelResult.task_id, task.id]
      )
      return { success: false, status: '生成中', pending: true, taskId: modelResult.task_id }
    }

    const [tplRows] = await pool.query<any[]>(
      'SELECT * FROM ai_avatar_template WHERE id = ? AND deleted_at IS NULL',
      [templateId]
    )
    const tpl = tplRows?.[0] || {}
    const paidPoints = Number(task.paid_points) || 0
    const creatorIncomePoints = Number(task.creator_income_points) || 0
    const skillType = task.skill_type

    if (modelResult.success) {
      try {
        console.log(`[execute] taskNo=${taskNo} 开始上传图片到 TOS...`)
        await this.convertBase64ToUrls(modelResult)
        console.log(`[execute] taskNo=${taskNo} 图片上传完成, images=${JSON.stringify((modelResult.result?.images || []).map((u: string) => u?.substring(0, 60)))}`)
        await this.handleGenerationSuccess(
          Number(task.id), task.task_no, task.user_id, task.avatar_user_id,
          {
            avatarId: Number(task.avatar_id),
            templateId,
            inputParams: this.parseJsonSafe(task.input_params_json, null),
            idempotencyKey: task.idempotency_key,
          },
          tpl, skillType, modelResult, paidPoints, creatorIncomePoints,
        )
        const preview = this.buildResultPreview(skillType, modelResult)
        return { success: true, status: '生成成功', preview }
      } catch (err: any) {
        console.error(`[execute] handleGenerationSuccess 异常 taskNo=${taskNo}:`, err?.message, err?.sql || '')
        await pool.query(
          'UPDATE ai_generation_task SET result_summary_json = ? WHERE task_no = ?',
          [JSON.stringify({ _raw_result: modelResult }), taskNo]
        )
        return { success: false, error: `作品保存失败: ${err?.message || '未知错误'}` }
      }
    } else {
      try {
        await this.handleGenerationFailure(
          Number(task.id), task.task_no, task.user_id, paidPoints, skillType,
          { avatarId: Number(task.avatar_id), templateId, idempotencyKey: task.idempotency_key },
          tpl, modelResult.error || '生成失败',
        )
      } catch (err: any) {
        console.error(`[execute] handleGenerationFailure 异常 taskNo=${taskNo}:`, err?.message)
      }
      return { success: false, status: '生成失败', error: modelResult.error, refunded: paidPoints > 0 }
    }
  }

  /**
   * 构建精简预览数据（不含 base64，只传 URL 或文本摘要）
   */
  private buildResultPreview(skillType: string, modelResult: any): any {
    const r = modelResult.result || {}
    switch (skillType) {
      case '图片生成': {
        const images = (r.images || []).map((img: string) =>
          img.startsWith('data:') ? img.substring(0, 100) + '...[base64]' : img
        )
        return { output_type: 'image', images }
      }
      case '视频生成':
        return { output_type: 'video', video_url: r.video_url || '' }
      case '图文生成': {
        const images = (r.images || []).map((img: string) =>
          img.startsWith('data:') ? img.substring(0, 100) + '...[base64]' : img
        )
        return { output_type: 'mixed', text: (r.text || '').substring(0, 500), images }
      }
      default:
        return { output_type: 'text', text: (r.text || '').substring(0, 500) }
    }
  }

  /**
   * 轮询生成任务（异步任务完成后落作品）
   */
  async pollGenerationTask(userId: string, taskNo: string) {
    const pool = getPool()

    const [taskRows] = await pool.query<any[]>(
      'SELECT * FROM ai_generation_task WHERE task_no = ? AND user_id = ? AND deleted_at IS NULL',
      [taskNo, userId]
    )
    if (!taskRows?.length) {
      return { success: false, error: '任务不存在' }
    }

    const task = taskRows[0]

    if (task.status === '生成成功') {
      const [workRows] = await pool.query<any[]>(
        'SELECT id FROM ai_generated_work WHERE task_id = ?',
        [task.id]
      )
      return {
        success: true,
        status: '生成成功',
        workId: workRows?.[0]?.id || null,
      }
    }

    if (task.status === '生成失败') {
      return { success: false, status: '生成失败', error: task.error_message || '生成失败' }
    }

    if (task.status !== '生成中' || !task.third_party_task_id) {
      return { success: false, status: task.status, error: 'pending' }
    }

    const pollResult = await this.debugPoll(Number(task.template_id), task.third_party_task_id)

    if (pollResult.success) {
      const [tplRows] = await pool.query<any[]>(
        'SELECT * FROM ai_avatar_template WHERE id = ? AND deleted_at IS NULL',
        [task.template_id]
      )
      const tpl = tplRows?.[0] || {}

      await this.handleGenerationSuccess(
        Number(task.id), task.task_no, task.user_id, task.avatar_user_id,
        {
          avatarId: Number(task.avatar_id),
          templateId: Number(task.template_id),
          inputParams: this.parseJsonSafe(task.input_params_json, null),
          idempotencyKey: task.idempotency_key,
        },
        tpl, task.skill_type, pollResult,
        Number(task.paid_points), Number(task.creator_income_points)
      )

      return {
        success: true,
        status: '生成成功',
        result: pollResult,
      }
    } else if (pollResult.error === 'pending') {
      return { success: false, status: '生成中', error: 'pending' }
    } else {
      await this.handleGenerationFailure(
        Number(task.id), task.task_no, task.user_id,
        Number(task.paid_points), task.skill_type,
        {
          avatarId: Number(task.avatar_id),
          templateId: Number(task.template_id),
          idempotencyKey: task.idempotency_key,
        },
        { model_api_id: task.model_api_id },
        pollResult.error || '生成失败'
      )
      return { success: false, status: '生成失败', error: pollResult.error || '生成失败' }
    }
  }

  /**
   * 查询任务状态
   */
  async getTaskByNo(userId: string, taskNo: string) {
    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM ai_generation_task WHERE task_no = ? AND user_id = ? AND deleted_at IS NULL',
      [taskNo, userId]
    )
    if (!rows?.length) return null
    const task = rows[0]

    let workId: number | null = null
    if (task.status === '生成成功') {
      const [workRows] = await pool.query<any[]>(
        'SELECT id FROM ai_generated_work WHERE task_id = ?',
        [task.id]
      )
      workId = workRows?.[0]?.id || null
    }

    return {
      taskNo: task.task_no,
      status: task.status,
      pointsStatus: task.points_status,
      paidPoints: Number(task.paid_points),
      currentAttemptNo: Number(task.current_attempt_no),
      retryCount: Number(task.retry_count),
      resultSummary: this.parseJsonSafe(task.result_summary_json, null),
      workId,
      errorMessage: task.error_message,
      thirdPartyTaskId: task.third_party_task_id,
    }
  }

  /**
   * 重试保存作品：当 executeGenerationTask 模型调用成功但 handleGenerationSuccess 失败时，
   * 从 result_summary_json._raw_result 读取缓存的模型结果重新执行落作品。
   */
  async retrySaveWork(userId: string, taskNo: string) {
    const pool = getPool()

    const [taskRows] = await pool.query<any[]>(
      'SELECT * FROM ai_generation_task WHERE task_no = ? AND user_id = ? AND deleted_at IS NULL',
      [taskNo, userId]
    )
    if (!taskRows?.length) return { success: false, error: '任务不存在' }
    const task = taskRows[0]

    if (task.status === '生成成功') {
      return { success: true, status: '已保存' }
    }

    const summary = this.parseJsonSafe(task.result_summary_json, null)
    if (!summary?._raw_result) {
      return { success: false, error: '无缓存结果，无法重试' }
    }

    const modelResult = summary._raw_result
    const [tplRows] = await pool.query<any[]>(
      'SELECT * FROM ai_avatar_template WHERE id = ? AND deleted_at IS NULL',
      [task.template_id]
    )
    const tpl = tplRows?.[0] || {}

    try {
      await this.convertBase64ToUrls(modelResult)
      await this.handleGenerationSuccess(
        Number(task.id), task.task_no, task.user_id, task.avatar_user_id,
        {
          avatarId: Number(task.avatar_id),
          templateId: Number(task.template_id),
          inputParams: this.parseJsonSafe(task.input_params_json, null),
          idempotencyKey: task.idempotency_key,
        },
        tpl, task.skill_type, modelResult,
        Number(task.paid_points) || 0, Number(task.creator_income_points) || 0,
      )
      return { success: true, status: '生成成功' }
    } catch (err: any) {
      console.error(`[retry-save] handleGenerationSuccess 异常 taskNo=${taskNo}:`, err?.message)
      return { success: false, error: `保存失败: ${err?.message || '未知错误'}` }
    }
  }

  /**
   * 生成成功：创建作品 + 分身提供者收益 + 更新模板/分身统计 + 模板状态→已启用
   */
  private async handleGenerationSuccess(
    taskId: number, taskNo: string, userId: string, avatarUserId: string,
    dto: Pick<CreateGenerationTaskDto, 'avatarId' | 'templateId' | 'inputParams' | 'idempotencyKey'>,
    tpl: any, skillType: string, modelResult: any,
    paidPoints: number, creatorIncomePoints: number,
  ) {
    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()
      console.log(`[success] taskNo=${taskNo} 开始事务`)

      const successCount = this.countSuccessItems(modelResult)
      const resultSummary = { expected_count: successCount, success_count: successCount, failed_count: 0 }

      await connection.query(
        `UPDATE ai_generation_task
         SET status = '生成成功', completed_at = NOW(),
             result_summary_json = ?
         WHERE id = ?`,
        [JSON.stringify(resultSummary), taskId]
      )
      console.log(`[success] taskNo=${taskNo} 任务状态已更新`)

      const contentJson = this.buildContentJson(skillType, modelResult)
      const workTitle = this.extractWorkTitle(skillType, modelResult)
      const coverUrl = this.extractCoverUrl(skillType, modelResult)

      const [avatarInfoRows] = await connection.query<any[]>(
        'SELECT avatar_name, avatar_url FROM ai_avatar WHERE id = ? AND deleted_at IS NULL',
        [dto.avatarId]
      )
      const avatarInfo = avatarInfoRows?.[0] || {}

      const sourceSnapshot = {
        avatar_name: avatarInfo.avatar_name || '',
        avatar_url: avatarInfo.avatar_url || '',
        template_name: tpl.template_name || '',
        template_cover_url: tpl.cover_url || '',
      }

      console.log(`[success] taskNo=${taskNo} INSERT ai_generated_work: skillType=${skillType}, title=${workTitle?.slice(0, 30)}`)
      await connection.query(
        `INSERT INTO ai_generated_work
         (task_id, user_id, avatar_user_id, avatar_id, template_id,
          work_title, cover_url, skill_type, content_json, tags_json, source_snapshot_json,
          generated_pay_points, success_item_count, status, public_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '正常', '私有')`,
        [
          taskId, userId, avatarUserId, dto.avatarId, dto.templateId,
          workTitle, coverUrl, skillType, JSON.stringify(contentJson),
          tpl.tags_json ? (typeof tpl.tags_json === 'string' ? tpl.tags_json : JSON.stringify(tpl.tags_json)) : null,
          JSON.stringify(sourceSnapshot), paidPoints, successCount,
        ]
      )
      console.log(`[success] taskNo=${taskNo} 作品已插入`)

      if (creatorIncomePoints > 0 && avatarUserId !== userId) {
        console.log(`[success] taskNo=${taskNo} 开始分身收益: ${creatorIncomePoints} 积分 → ${avatarUserId}`)
        await this.coinService.gift(avatarUserId, creatorIncomePoints, `分身技能生成收益 ${creatorIncomePoints} 积分`, {
          metadata: {
            business_type: '分身生成收益',
            business_action: '分身提供者收益',
            task_id: taskId,
            task_no: taskNo,
            avatar_id: dto.avatarId,
            template_id: dto.templateId,
            income_points: creatorIncomePoints,
          },
          connection,
        })

        await connection.query(
          'UPDATE ai_avatar SET income_points_total = income_points_total + ? WHERE id = ?',
          [creatorIncomePoints, dto.avatarId]
        )
      }

      await connection.query(
        'UPDATE ai_avatar SET use_count = use_count + 1, work_count = work_count + 1 WHERE id = ?',
        [dto.avatarId]
      )
      await connection.query(
        'UPDATE ai_avatar_template SET use_count = use_count + 1 WHERE id = ?',
        [dto.templateId]
      )

      await connection.query(
        `UPDATE ai_avatar_template SET status = '已启用', tested_at = NOW()
         WHERE id = ? AND status = '待测试'`,
        [dto.templateId]
      )

      const [pendingRows] = await connection.query<any[]>(
        `SELECT COUNT(*) AS cnt FROM ai_avatar_template
         WHERE avatar_id = ? AND status != '已启用' AND deleted_at IS NULL`,
        [dto.avatarId]
      )
      if (pendingRows?.[0]?.cnt === 0) {
        await connection.query(
          `UPDATE ai_avatar SET status = '已上线' WHERE id = ? AND status != '已上线' AND deleted_at IS NULL`,
          [dto.avatarId]
        )
        console.log(`[success] taskNo=${taskNo} 分身所有模板已启用，状态更新为已上线`)
      }

      await connection.commit()
      console.log(`[success] taskNo=${taskNo} 事务提交成功`)
    } catch (error) {
      await connection.rollback()
      console.error('生成成功后处理失败:', error)
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 生成失败：全额退款 + 更新任务状态
   */
  private async handleGenerationFailure(
    taskId: number, taskNo: string, userId: string,
    paidPoints: number, skillType: string,
    dto: Pick<CreateGenerationTaskDto, 'avatarId' | 'templateId' | 'idempotencyKey'>,
    tpl: any, errorMessage: string,
  ) {
    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      await connection.query(
        `UPDATE ai_generation_task
         SET status = '生成失败', error_message = ?, completed_at = NOW(),
             points_status = CASE WHEN ? > 0 THEN '已退款' ELSE points_status END,
             refunded_at = CASE WHEN ? > 0 THEN NOW() ELSE refunded_at END
         WHERE id = ?`,
        [errorMessage, paidPoints, paidPoints, taskId]
      )

      if (paidPoints > 0) {
        await this.coinService.gift(userId, paidPoints, `分身技能生成失败退款 ${paidPoints} 积分`, {
          metadata: {
            business_type: '分身内容生成',
            business_action: '生成失败退款',
            task_id: taskId,
            task_no: taskNo,
            attempt_no: 1,
            failure_reason: errorMessage,
          },
          connection,
        })
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      console.error('生成失败退款处理异常:', error)
    } finally {
      connection.release()
    }
  }

  /**
   * 将模型返回结果中的图片统一上传到自有 TOS 存储
   * 无论原始数据是 base64 还是外部 URL，都转为自有持久化 URL
   */
  private async convertBase64ToUrls(modelResult: any): Promise<void> {
    const images: string[] = modelResult.result?.images
    if (!Array.isArray(images) || images.length === 0) return

    const converted: string[] = []
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      if (!img) { converted.push(''); continue }

      try {
        const fileName = `ai_gen_${Date.now()}_${i}.png`
        let buffer: Buffer

        if (img.startsWith('data:')) {
          buffer = Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        } else if (img.startsWith('http://') || img.startsWith('https://')) {
          const resp = await fetch(img)
          if (!resp.ok) throw new Error(`下载失败: HTTP ${resp.status}`)
          buffer = Buffer.from(await resp.arrayBuffer())
        } else {
          converted.push(img)
          continue
        }

        const url = await this.uploadService.uploadBuffer(buffer, fileName)
        console.log(`[upload] 图片已上传 TOS: ${fileName} (${(buffer.length / 1024).toFixed(0)}KB) → ${url.substring(0, 80)}`)
        converted.push(url)
      } catch (e: any) {
        console.error(`[upload] 图片上传失败 [${i}]:`, e?.message)
        converted.push(img)
      }
    }
    modelResult.result.images = converted
  }

  /** 统计成功内容数量 */
  private countSuccessItems(result: any): number {
    if (result.result?.images?.length) return result.result.images.length
    if (result.result?.video_url) return 1
    if (result.result?.text) return 1
    return 1
  }

  /**
   * 构建 content_json（严格按文档 9.3 节最小结构）
   *
   * 文字: { text }
   * 图片: { images: [url, ...] }
   * 视频: { video_url, cover_url }
   * 图文: { title, text, images: [url, ...] }
   */
  private buildContentJson(skillType: string, result: any): any {
    const r = result.result || {}
    switch (skillType) {
      case '图片生成':
        return { images: (r.images || []).filter(Boolean) }
      case '视频生成':
        return { video_url: r.video_url || '', cover_url: r.images?.[0] || '' }
      case '图文生成':
        return {
          title: this.extractWorkTitle(skillType, result),
          text: r.text || '',
          images: (r.images || []).filter(Boolean),
        }
      default:
        return { text: r.text || '' }
    }
  }

  /** 提取作品标题 */
  private extractWorkTitle(skillType: string, result: any): string {
    if (result.result?.text) {
      const firstLine = result.result.text.split('\n').find((l: string) => l.trim()) || ''
      return firstLine.length > 200 ? firstLine.substring(0, 200) : firstLine || 'AI生成作品'
    }
    if (skillType === '图片生成') return 'AI生成图片'
    if (skillType === '视频生成') return 'AI生成视频'
    return 'AI生成作品'
  }

  /** 提取封面URL（只接受 http/https URL，跳过 base64） */
  private extractCoverUrl(skillType: string, result: any): string | null {
    const first = result.result?.images?.[0]
    if (first && !first.startsWith('data:')) return first
    return null
  }

  /** Fernet 解密（与 web 后台 Python 的 crypto.py 逻辑一致） */
  private decryptCredential(ciphertext: string): string {
    if (!ciphertext?.trim()) return ''
    try {
      const secretKey = process.env.SECRET_KEY || 'change-me-to-a-random-secret-key'
      const keyBytes = crypto.createHash('sha256').update(secretKey, 'utf8').digest()

      // Fernet token: Version(1) + Timestamp(8) + IV(16) + Ciphertext(N) + HMAC(32)
      const tokenBytes = Buffer.from(ciphertext.trim(), 'base64')
      const iv = tokenBytes.subarray(9, 25)
      const ct = tokenBytes.subarray(25, tokenBytes.length - 32)

      // Fernet key: 前16字节是 signing key，后16字节是 encryption key
      const encKey = keyBytes.subarray(16, 32)
      const decipher = crypto.createDecipheriv('aes-128-cbc', encKey, iv)
      let decrypted = decipher.update(ct)
      decrypted = Buffer.concat([decrypted, decipher.final()])
      return decrypted.toString('utf8')
    } catch (e) {
      console.warn('API凭证解密失败:', e)
      return ''
    }
  }

  /** 递归替换模板中的 {{placeholder}} */
  private resolveTemplate(obj: any, mapping: Record<string, any>): any {
    if (typeof obj === 'string') {
      const soleMatch = obj.match(/^\s*\{\{(\w+)\}\}\s*$/)
      if (soleMatch) {
        const key = soleMatch[1]
        return key in mapping ? mapping[key] : obj
      }
      return obj.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return key in mapping ? String(mapping[key]) : `{{${key}}}`
      })
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveTemplate(item, mapping))
    }
    if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.resolveTemplate(v, mapping)
      }
      return result
    }
    return obj
  }

  /** 解析模型API返回结果为统一结构 */
  private parseModelResponse(data: any): any {
    if (data?.error) {
      const errMsg = typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : String(data.error)
      return { success: false, output_type: null, result: {}, task_id: null, error: errMsg }
    }

    // DashScope 错误
    if (data?.code && data?.message && data?.request_id) {
      return { success: false, output_type: null, result: {}, task_id: null, error: `[${data.code}] ${data.message}` }
    }

    // OpenAI Chat（choices[].message.content）
    if (data?.choices) {
      const text = data.choices[0]?.message?.content || ''
      return { success: true, output_type: 'text', result: { text }, task_id: null, error: null }
    }

    // OpenAI Responses API（output[].content[].text）
    if (Array.isArray(data?.output)) {
      const parts: string[] = []
      for (const item of data.output) {
        for (const c of (item.content || [])) {
          if (c?.type === 'output_text') parts.push(c.text || '')
        }
      }
      if (parts.length) {
        return { success: true, output_type: 'text', result: { text: parts.join('\n') }, task_id: null, error: null }
      }
    }

    // OpenAI Image（data[].url）
    if (data?.data && Array.isArray(data.data)) {
      const images = data.data.map((item: any) => item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '')).filter(Boolean)
      if (images.length) {
        return { success: true, output_type: 'image', result: { images }, task_id: null, error: null }
      }
    }

    // DashScope 异步任务
    const dsOutput = data?.output
    if (dsOutput && typeof dsOutput === 'object' && dsOutput.task_id) {
      return { success: false, output_type: 'image', result: {}, task_id: dsOutput.task_id, error: 'pending' }
    }

    // CogVideo 异步
    const cogStatus = data?.task_status || data?.data?.task_status || ''
    if (['PROCESSING', 'PENDING'].includes(cogStatus)) {
      return { success: false, output_type: 'video', result: {}, task_id: String(data.id || ''), error: 'pending' }
    }

    // 兜底：原样返回 JSON
    return { success: true, output_type: 'text', result: { text: JSON.stringify(data, null, 2) }, task_id: null, error: null }
  }

  private parseJsonSafe(jsonStr: any, defaultValue: any) {
    if (!jsonStr) return defaultValue
    if (typeof jsonStr === 'object') return jsonStr
    try { return JSON.parse(jsonStr) } catch { return defaultValue }
  }

  /** 确保 JSON 字段以字符串形式传入 SQL，避免 mysql2 将对象展开为多个参数 */
  private toJsonString(val: any): string | null {
    if (val === null || val === undefined) return null
    if (typeof val === 'string') return val
    return JSON.stringify(val)
  }
}
