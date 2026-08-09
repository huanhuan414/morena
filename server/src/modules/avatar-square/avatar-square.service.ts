import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient, getPool } from '../../storage/database/mysql-client'
import { RedisService } from '../redis/redis.service'
import { ContentAuditItem, ContentAuditService } from '../content-audit/content-audit.service'

type AvatarSquareQuery = {
  page: number
  pageSize: number
  skillType?: string
  sort?: string
}

type WorkSquareQuery = {
  page: number
  pageSize: number
  category?: string
  avatarName?: string
  sort?: string
}

type FavoriteTargetType = '分身' | '作品'

type ManagedWorkStatusField = 'publicStatus' | 'avatarAcceptStatus' | 'avatarAuthStatus'

type ManagedWorksQuery = {
  avatarId?: number
  filterAvatarId?: number
  display?: string
  filters?: string[]
  publicStatus?: string
  profileDisplay?: string
  squareDisplay?: string
  category?: string
  sort?: string
  page: number
  pageSize: number
}
type AvatarSettingsUpdate = {
  avatarName?: string
  avatarUrl?: string
  description?: string
  publicStatus?: '公开' | '私有'
  auditStatus?: '审核通过' | '审核拒绝' | '待审核'
  status?: '已上线' | '已下线'
}

export const WORK_VIEW_SOURCES = [
  'avatar_public_detail',
  'work_detail',
  'avatar_square',
  'search',
  'share',
  'other',
] as const

export type WorkViewSource = typeof WORK_VIEW_SOURCES[number]


@Injectable()
export class AvatarSquareService {
  private readonly logger = new Logger(AvatarSquareService.name)
  private readonly workViewDedupTtlMs = 30 * 60 * 1000
  private readonly avatarViewDedupTtlMs = 30 * 60 * 1000

  constructor(
    private readonly redisService: RedisService,
    private readonly contentAuditService: ContentAuditService,
  ) {}
  private safeParseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return value as T
    if (typeof value !== 'string') return fallback

    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
 
  private mapAvatarSettings(row: Record<string, unknown>) {
    const tagsJson = this.safeParseJson<Record<string, string>>(row.tagsJson, {})
    return {
      id: Number(row.id || 0),
      userId: String(row.userId || ''),
      avatarName: String(row.avatarName || ''),
      avatarUrl: String(row.avatarUrl || ''),
      description: String(row.description || ''),
      tags: [tagsJson.gender, tagsJson.age, tagsJson.location, tagsJson.occupation].filter(Boolean),
      publicStatus: String(row.publicStatus || '私有'),
      auditStatus: String(row.auditStatus || ''),
      status: String(row.status || '已下线'),
      skillType: String(row.skillType || ''),
      updatedAt: row.updatedAt || '',
      useCount: Number(row.useCount || 0),
      workCount: Number(row.workCount || 0),
      viewCount: Number(row.viewCount || 0),
      favoriteCount: Number(row.favoriteCount || 0),
      incomePointsTotal: Number(row.incomePointsTotal || 0),
    }
  }

  private compactAuditItems(items: Array<ContentAuditItem | null | undefined>) {
    return items.filter((item): item is ContentAuditItem => Boolean(item?.content?.trim()))
  }

  private buildAvatarAuditItems(input: { avatarUrl?: string; avatarName?: string; description?: string }) {
    return this.compactAuditItems([
      input.avatarName ? { type: 'text', content: input.avatarName } : null,
      input.description ? { type: 'text', content: input.description } : null,
      input.avatarUrl ? { type: 'image', content: input.avatarUrl } : null,
    ])
  }

  private buildWorkAuditItems(work: Record<string, unknown>) {
    const contentJson = this.safeParseJson<Record<string, unknown>>(work.contentJson, {})
    const rawImages = Array.isArray(contentJson.images)
      ? contentJson.images
      : this.safeParseJson<unknown[]>(contentJson.images, [])
    const imageItems = rawImages
      .filter(item => typeof item === 'string' && item.trim())
      .map(item => ({ type: 'image' as const, content: String(item) }))
    const videoUrl = String(contentJson.video_url || contentJson.videoUrl || '')
    const coverUrl = String(contentJson.cover_url || contentJson.coverUrl || '')

    return this.compactAuditItems([
      work.workTitle ? { type: 'text', content: String(work.workTitle) } : null,
      work.workDescription ? { type: 'text', content: String(work.workDescription) } : null,
      contentJson.title ? { type: 'text', content: String(contentJson.title) } : null,
      contentJson.text ? { type: 'text', content: String(contentJson.text) } : null,
      ...imageItems,
      coverUrl ? { type: 'image', content: coverUrl } : null,
      videoUrl ? { type: 'video', content: videoUrl } : null,
    ])
  }
  private mapWorkPreview(row: Record<string, unknown>) {
    const contentJson = this.safeParseJson<Record<string, unknown>>(row.contentJson, {})
    const contentData = this.safeParseJson<Record<string, unknown>>(contentJson.data, {})
    const rawImages = Array.isArray(contentJson.images)
      ? contentJson.images
      : this.safeParseJson<unknown[]>(contentJson.images, [])
    const images = rawImages.filter((item): item is string => typeof item === 'string')
    const skillType = String(row.skillType || '')
    const workCategory = skillType.replace('生成', '')

    return {
      id: Number(row.id),
      category: workCategory,
      title: String(row.workTitle || ''),
      description: String(row.workDescription || ''),
      price: `${row.generatedPayPoints ?? 0}积分`,
      favoriteCount: Number(row.favoriteCount || 0),
      isFavorited: Boolean(row.isFavorited),
      images: workCategory === '图片' || workCategory === '图文' ? images : [],
      contentTitle: workCategory === '图文' ? String(contentJson.title || '') : '',
      contentText: workCategory === '文字'
        ? String(contentJson.text || '')
        : '',
      contentMarkdown: workCategory === '图文'
        ? String(contentData.content_markdown || contentData.contentMarkdown || '')
        : '',
      contentHtml: workCategory === '图文'
        ? String(contentData.content_html || contentData.contentHtml || '')
        : '',
      videoUrl: workCategory === '视频'
        ? String(contentJson.video_url || contentJson.videoUrl || '')
        : '',
      videoCoverUrl: workCategory === '视频'
        ? String(contentJson.cover_url || contentJson.coverUrl || '')
        : '',
    }
  }

  private getManagedWorksOrder(sort?: string) {
    const sortMap: Record<string, string> = {
      name: "COALESCE(work_title, '')",
      publishedAt: 'published_at',
    }
    const selected = (sort || 'name:desc')
      .split(',')
      .slice(0, 2)
      .map(item => item.trim().split(':'))
      .filter(([field, direction]) => sortMap[field] && ['asc', 'desc'].includes(direction?.toLowerCase()))
      .map(([field, direction]) => {
        const column = sortMap[field]
        const normalizedDirection = direction.toUpperCase()
        return field === 'publishedAt'
          ? `${column} IS NULL ASC, ${column} ${normalizedDirection}`
          : `${column} ${normalizedDirection}`
      })

    return [...(selected.length > 0 ? selected : [`${sortMap.name} DESC`]), 'id DESC'].join(', ')
  }

  async recordPublicWorkView(
    workId: number,
    viewerUserId: string | undefined,
    viewerKey: string,
    source: WorkViewSource,
  ) {
    const db = getMySQLClient()
    const sourceConditions =  ["public_status = '公开'",]
    const whereConditions = [
      'id = ?',
      "status = '正常'",
      'deleted_at IS NULL',
      ...sourceConditions,
    ]
    const whereSql = whereConditions.join('\n        AND ')
    const params = [workId]

    const rows = await db.query(`
      SELECT id, user_id, view_count
      FROM ai_generated_work
      WHERE ${whereSql}
      LIMIT 1
    `, params)
    const work = rows[0] as Record<string, unknown> | undefined
    if (!work) return null

    const currentViewCount = Number(work.viewCount || 0)
    if (viewerUserId && String(work.userId || '') === viewerUserId) {
      return { counted: false, viewCount: currentViewCount }
    }

    const dedupKey = `work:view:${workId}:${viewerKey}`
    let reserved = false
    try {
      reserved = await this.redisService.setNX(
        dedupKey,
        source,
        this.workViewDedupTtlMs,
      )
    } catch (error) {
      this.logger.warn(`作品浏览去重失败，跳过统计: workId=${workId}, error=${error instanceof Error ? error.message : error}`)
      return { counted: false, viewCount: currentViewCount }
    }

    if (!reserved) {
      return { counted: false, viewCount: currentViewCount }
    }

    try {
      const result = await db.query(`
        UPDATE ai_generated_work
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE ${whereSql}
      `, params)
      const counted = Number((result as any)?.affectedRows || 0) > 0
      if (!counted) {
        await this.redisService.del(dedupKey)
        return null
      }

      const countRows = await db.query(`
        SELECT view_count
        FROM ai_generated_work
        WHERE id = ?
        LIMIT 1
      `, [workId])
      const updatedWork = countRows[0] as Record<string, unknown> | undefined
      return {
        counted: true,
        viewCount: Number(updatedWork?.viewCount ?? currentViewCount + 1),
      }
    } catch (error) {
      try {
        await this.redisService.del(dedupKey)
      } catch (redisError) {
        this.logger.warn(`回滚作品浏览去重Key失败: workId=${workId}, error=${redisError instanceof Error ? redisError.message : redisError}`)
      }
      throw error
    }
  }

  async recordPublicAvatarView(
    avatarId: number,
    viewerUserId: string | undefined,
    viewerKey: string,
  ) {
    const db = getMySQLClient()
    const whereConditions = [
      'id = ?',
      "status = '已上线'",
      "public_status = '公开'",
      "audit_status = '审核通过'",
      'deleted_at IS NULL',
    ]
    const whereSql = whereConditions.join('\n        AND ')
    const params = [avatarId]

    const rows = await db.query(`
      SELECT id, user_id, view_count
      FROM ai_avatar
      WHERE ${whereSql}
      LIMIT 1
    `, params)
    const avatar = rows[0] as Record<string, unknown> | undefined
    if (!avatar) return null

    const currentViewCount = Number(avatar.viewCount || 0)
    if (viewerUserId && String(avatar.userId || '') === viewerUserId) {
      return { counted: false, viewCount: currentViewCount }
    }

    const dedupKey = `avatar:view:${avatarId}:${viewerKey}`
    let reserved = false
    try {
      reserved = await this.redisService.setNX(
        dedupKey,
        'avatar_square',
        this.avatarViewDedupTtlMs,
      )
    } catch (error) {
      this.logger.warn(`分身浏览去重失败，跳过统计: avatarId=${avatarId}, error=${error instanceof Error ? error.message : error}`)
      return { counted: false, viewCount: currentViewCount }
    }

    if (!reserved) {
      return { counted: false, viewCount: currentViewCount }
    }

    try {
      const result = await db.query(`
        UPDATE ai_avatar
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE ${whereSql}
      `, params)
      const counted = Number((result as any)?.affectedRows || 0) > 0
      if (!counted) {
        await this.redisService.del(dedupKey)
        return null
      }

      const countRows = await db.query(`
        SELECT view_count
        FROM ai_avatar
        WHERE id = ?
        LIMIT 1
      `, [avatarId])
      const updatedAvatar = countRows[0] as Record<string, unknown> | undefined
      return {
        counted: true,
        viewCount: Number(updatedAvatar?.viewCount ?? currentViewCount + 1),
      }
    } catch (error) {
      try {
        await this.redisService.del(dedupKey)
      } catch (redisError) {
        this.logger.warn(`回滚分身浏览去重Key失败: avatarId=${avatarId}, error=${redisError instanceof Error ? redisError.message : redisError}`)
      }
      throw error
    }
  }
  async getManagedWorks(userId: string, options: ManagedWorksQuery) {
    const db = getMySQLClient()
    const page = Math.max(1, Number(options.page) || 1)
    const pageSize = Math.min(20, Math.max(1, Number(options.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const whereClauses = ["status = '正常'", 'user_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [userId]
    const avatarOptionRows = await db.query(`
      SELECT id, avatar_name
      FROM ai_avatar
      WHERE user_id = ?
        AND deleted_at IS NULL
      ORDER BY updated_at DESC, id DESC
    `, [userId])
    const avatarOptions = avatarOptionRows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      avatarName: String(row.avatarName || ''),
    }))

    let avatar = null
    if (options.avatarId) {
      const avatarRows = await db.query(`
        SELECT id, avatar_url, avatar_name, description
        FROM ai_avatar
        WHERE id = ?
          AND user_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `, [options.avatarId, userId])
      const avatarRow = avatarRows[0] as Record<string, unknown> | undefined
      if (!avatarRow) throw new Error('分身不存在或无权查看')
      avatar = {
        id: Number(avatarRow.id),
        avatarUrl: String(avatarRow.avatarUrl || ''),
        avatarName: String(avatarRow.avatarName || ''),
        description: String(avatarRow.description || ''),
      }
      whereClauses.push('avatar_id = ?')
      params.push(options.avatarId)
    } else {
      const userRows = await db.query(`
        SELECT id, avatar, nickname, bio
        FROM users
        WHERE id = ?
        LIMIT 1
      `, [userId])
      const userRow = userRows[0] as Record<string, unknown> | undefined
      avatar = {
        id: 0,
        avatarUrl: String(userRow?.avatar || ''),
        avatarName: String(userRow?.nickname || ''),
        description: String(userRow?.bio || `ID:${String(userId).slice(-8)}`),
      }
      if (options.filterAvatarId) {
        whereClauses.push('avatar_id = ?')
        params.push(options.filterAvatarId)
      }
    }

    const filters = options.filters || []
    if (options.publicStatus) {
      whereClauses.push('public_status = ?')
      params.push(options.publicStatus)
    } else {
      if (filters.includes('public')) {
        whereClauses.push("public_status = '公开'")
      }
      if (filters.includes('private')) {
        whereClauses.push("public_status = '私有'")
      }
    }
    if (options.profileDisplay === 'shown') {
      whereClauses.push("avatar_accept_status = '接受展示'")
    } else if (options.profileDisplay === 'hidden') {
      whereClauses.push("COALESCE(avatar_accept_status, '') <> '接受展示'")
    }

    if (options.squareDisplay === 'shown') {
      whereClauses.push("avatar_auth_status = '展示'")
    } else if (options.squareDisplay === 'hidden') {
      whereClauses.push("COALESCE(avatar_auth_status, '') <> '展示'")
    }

    if (options.category) {
      whereClauses.push("REPLACE(skill_type, '生成', '') = ?")
      params.push(options.category)
    }

    const rows = await db.query(`
      SELECT
        id, avatar_id, template_id, work_title, work_description, skill_type,
        generated_pay_points, published_at, view_count, favorite_count,
        public_status, audit_status, avatar_auth_status, avatar_accept_status,
        content_json
      FROM ai_generated_work
      WHERE ${whereClauses.join('\n        AND ')}
      ORDER BY ${this.getManagedWorksOrder(options.sort)}
      LIMIT ? OFFSET ?
    `, [...params, pageSize + 1, offset])

    const hasMore = rows.length > pageSize
    const list = rows.slice(0, pageSize).map((row: Record<string, unknown>) => ({
      ...this.mapWorkPreview(row),
      avatarId: Number(row.avatarId),
      templateId: Number(row.templateId || 0),
      generatedPayPoints: Number(row.generatedPayPoints || 0),
      publishedAt: row.publishedAt || null,
      viewCount: Number(row.viewCount || 0),
      favoriteCount: Number(row.favoriteCount || 0),
      publicStatus: String(row.publicStatus || ''),
      auditStatus: row.auditStatus ? String(row.auditStatus) : '',
      avatarAuthStatus: String(row.avatarAuthStatus || ''),
      avatarAcceptStatus: String(row.avatarAcceptStatus || ''),
    }))

    return { avatar, avatarOptions, list, page, pageSize, hasMore }
  }

  async updateManagedWorkStatus(
    workId: number,
    userId: string,
    field: ManagedWorkStatusField,
    value: string,
  ) {
    const configs: Record<ManagedWorkStatusField, { column: string; values: string[]; auditValue: string }> = {
      publicStatus: { column: 'public_status', values: ['公开', '私有'], auditValue: '公开' },
      avatarAcceptStatus: { column: 'avatar_accept_status', values: ['接受展示', '拒绝展示'], auditValue: '接受展示' },
      avatarAuthStatus: { column: 'avatar_auth_status', values: ['展示', '禁止展示'], auditValue: '展示' },
    }
    const config = configs[field]
    if (!config || !config.values.includes(value)) {
      return { state: 'invalid' as const, data: null }
    }

    const db = getMySQLClient()
    const needsAudit = value === config.auditValue
    let current: Record<string, unknown> | undefined

    if (needsAudit || (field === 'avatarAcceptStatus' && value === '接受展示')) {
      const currentRows = await db.query(`
        SELECT
          work.id,
          work.avatar_id AS avatarId,
          work.work_title AS workTitle,
          work.work_description AS workDescription,
          work.skill_type AS skillType,
          work.content_json AS contentJson,
          avatar.status AS avatarStatus,
          avatar.public_status AS avatarPublicStatus,
          avatar.audit_status AS avatarAuditStatus
        FROM ai_generated_work work
        INNER JOIN ai_avatar avatar ON work.avatar_id = avatar.id
        WHERE work.id = ?
          AND work.user_id = ?
          AND work.deleted_at IS NULL
          AND avatar.deleted_at IS NULL
        LIMIT 1
      `, [workId, userId])
      current = currentRows[0] as Record<string, unknown> | undefined
      if (!current) return { state: 'not_found' as const, data: null }
      const avatarCanShow = current.avatarStatus === '已上线'
        && current.avatarPublicStatus === '公开'
        && current.avatarAuditStatus === '审核通过'
      if (needsAudit && !avatarCanShow) {
        return { state: 'avatar_unavailable' as const, data: null }
      }
    }

    if (field === 'avatarAcceptStatus' && value === '接受展示') {
      const countRows = await db.query(`
        SELECT COUNT(*) AS total
        FROM ai_generated_work
        WHERE avatar_id = ?
          AND user_id = ?
          AND id <> ?
          AND avatar_accept_status = '接受展示'
          AND deleted_at IS NULL
      `, [current?.avatarId, userId, workId])
      const total = Number((countRows[0] as Record<string, unknown> | undefined)?.total || 0)
      if (total >= 4) {
        return { state: 'profile_limit' as const, data: null }
      }
    }

    if (needsAudit) {
      const audit = await this.contentAuditService.reviewPorn({
        items: this.buildWorkAuditItems(current || {}),
      })
      if (!audit.passed) {
        await db.query(`
          UPDATE ai_generated_work
          SET audit_status = '审核拒绝', updated_at = NOW()
          WHERE id = ?
            AND user_id = ?
            AND deleted_at IS NULL
        `, [workId, userId])
        return { state: 'audit_rejected' as const, data: null }
      }
    }

    const auditSql = needsAudit
      ? (field === 'avatarAuthStatus'
        ? ", audit_status = '审核通过', published_at = NOW()"
        : ", audit_status = '审核通过'")
      : ", audit_status = '待审核'"

    const result = await db.query(`
      UPDATE ai_generated_work
      SET ${config.column} = ?${auditSql}, updated_at = NOW()
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
    `, [value, workId, userId])

    if (Number((result as any)?.affectedRows || 0) === 0) {
      return { state: 'not_found' as const, data: null }
    }

    const rows = await db.query(`
      SELECT public_status AS publicStatus, avatar_accept_status AS avatarAcceptStatus, avatar_auth_status AS avatarAuthStatus
      FROM ai_generated_work
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `, [workId, userId])
    const row = rows[0] as Record<string, unknown> | undefined
    return {
      state: 'updated' as const,
      data: {
        id: workId,
        publicStatus: String(row?.publicStatus || ''),
        avatarAcceptStatus: String(row?.avatarAcceptStatus || ''),
        avatarAuthStatus: String(row?.avatarAuthStatus || ''),
      },
    }
  }
  async deleteManagedWork(workId: number, userId: string) {
    const db = getMySQLClient()
    const result = await db.query(`
      UPDATE ai_generated_work
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
    `, [workId, userId])

    return Number((result as any)?.affectedRows || 0) > 0
  }
  async getPublicWorkSquare(options: WorkSquareQuery, userId?: string) {
    const db = getMySQLClient()
    const page = Math.max(1, Number(options.page) || 1)
    const pageSize = Math.min(20, Math.max(1, Number(options.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const whereClauses = [
      "work.status = '正常'",
      "work.public_status = '公开'",
      // "work.audit_status = '审核通过'",
      "work.avatar_auth_status = '展示'",
      'work.deleted_at IS NULL',
      "avatar.status = '已上线'",
      "avatar.public_status = '公开'",
      "avatar.audit_status = '审核通过'",
      'avatar.deleted_at IS NULL',
    ]
    const params: unknown[] = []

    if (options.category) {
      whereClauses.push("REPLACE(work.skill_type, '生成', '') = ?")
      params.push(options.category)
    }
    if (options.avatarName) {
      whereClauses.push('avatar.avatar_name LIKE ?')
      params.push(`%${options.avatarName}%`)
    }

    const orderByMap: Record<string, string> = {
      recommend: `(
        0.40 * LOG10(1 + GREATEST(COALESCE(work.generated_pay_points, 0), 0)) +
        0.35 * LOG10(1 + GREATEST(COALESCE(work.view_count, 0), 0)) +
        0.25 * LOG10(1 + GREATEST(COALESCE(work.favorite_count, 0), 0))
      ) DESC, work.id DESC`,
      income: 'work.generated_pay_points DESC, work.id DESC',
      views: 'work.view_count DESC, work.id DESC',
      favorites: 'work.favorite_count DESC, work.id DESC',
    }
    const orderBy = orderByMap[options.sort || 'recommend'] || orderByMap.recommend
    const rows = await db.query(`
      SELECT
        work.id,
        work.avatar_id,
        work.template_id,
        work.work_title,
        work.work_description,
        work.skill_type,
        work.generated_pay_points,
        work.view_count,
        work.favorite_count,
        work.published_at,
        work.updated_at,
        work.content_json,
        avatar.avatar_name,
        avatar.avatar_url,
        ${userId ? `
          EXISTS (
            SELECT 1
            FROM ai_user_favorite favorite
            WHERE favorite.user_id = ?
              AND favorite.target_type = '作品'
              AND favorite.target_id = work.id
          )
        ` : 'FALSE'} AS is_favorited
      FROM ai_generated_work work
      INNER JOIN ai_avatar avatar ON work.avatar_id = avatar.id
      WHERE ${whereClauses.join('\n        AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...(userId ? [userId] : []), ...params, pageSize + 1, offset])

    const hasMore = rows.length > pageSize
    const list = rows.slice(0, pageSize).map((row: Record<string, unknown>) => ({
      ...this.mapWorkPreview(row),
      avatarId: Number(row.avatarId),
      templateId: Number(row.templateId || 0),
      avatarName: String(row.avatarName || ''),
      avatarUrl: String(row.avatarUrl || ''),
      generatedPayPoints: Number(row.generatedPayPoints || 0),
      viewCount: Number(row.viewCount || 0),
      favoriteCount: Number(row.favoriteCount || 0),
      isFavorited: Boolean(row.isFavorited),
      publishedAt: row.publishedAt || row.updatedAt || null,
    }))

    return { list, page, pageSize, hasMore }
  }

  async getPublicWorkSquareDetail(workId: number, userId?: string) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        work.id,
        work.avatar_id,
        work.template_id,
        work.work_title,
        work.work_description,
        work.skill_type,
        work.generated_pay_points,
        work.published_at,
        work.view_count,
        work.favorite_count,
        COALESCE(tpl.use_count, 0) AS success_item_count,
        work.content_json,
        avatar.avatar_name,
        avatar.avatar_url,
        avatar.skill_type AS avatar_skill_type,
        avatar.favorite_count AS avatar_favorite_count,
        ${userId ? `
          EXISTS (
            SELECT 1
            FROM ai_user_favorite favorite
            WHERE favorite.user_id = ?
              AND favorite.target_type = '作品'
              AND favorite.target_id = work.id
          )
        ` : 'FALSE'} AS is_favorited,
        ${userId ? `
          EXISTS (
            SELECT 1
            FROM ai_user_favorite favorite
            WHERE favorite.user_id = ?
              AND favorite.target_type = '分身'
              AND favorite.target_id = avatar.id
          )
        ` : 'FALSE'} AS is_avatar_favorited
      FROM ai_generated_work work
      INNER JOIN ai_avatar avatar ON avatar.id = work.avatar_id
      LEFT JOIN ai_avatar_template tpl
        ON tpl.id = work.template_id
        AND tpl.deleted_at IS NULL
      WHERE work.id = ?
        AND work.status = '正常'
        ${userId
          ? "AND (work.user_id = ? OR work.public_status = '公开')"
          : "AND work.public_status = '公开'"}
        AND work.deleted_at IS NULL
        AND avatar.deleted_at IS NULL
      LIMIT 1
    `, [...(userId ? [userId, userId] : []), workId, ...(userId ? [userId] : [])])
    const row = rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    return {
      ...this.mapWorkPreview(row),
      avatarId: Number(row.avatarId || 0),
      avatarName: String(row.avatarName || ''),
      avatarUrl: String(row.avatarUrl || ''),
      avatarSkillType: String(row.avatarSkillType || ''),
      avatarFavoriteCount: Number(row.avatarFavoriteCount || 0),
      isAvatarFavorited: Boolean(row.isAvatarFavorited),
      generatedPayPoints: Number(row.generatedPayPoints || 0),
      publishedAt: row.publishedAt || null,
      viewCount: Number(row.viewCount || 0),
      favoriteCount: Number(row.favoriteCount || 0),
      successItemCount: Number(row.successItemCount || 0),
      isFavorited: Boolean(row.isFavorited),
      templateId: Number(row.templateId || 0),
    }
  }
  /**
   * 获取公开分身广场列表
   * @param options 查询参数
   */
  async getPublicAvatarSquare(options: AvatarSquareQuery, userId?: string) {
    const db = getMySQLClient()
    const page = Math.max(1, Number(options.page) || 1)
    const pageSize = Math.min(20, Math.max(1, Number(options.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const whereClauses = [
      "status = '已上线'",
      "public_status = '公开'",
      "audit_status = '审核通过'",
      'deleted_at IS NULL',
    ]
    const params: unknown[] = []

    if (options.skillType) {
      whereClauses.push('skill_type = ?')
      params.push(options.skillType)
    }

    const orderByMap: Record<string, string> = {
      recommend: `(
        0.30 * LOG10(1 + GREATEST(COALESCE(income_points_total, 0), 0)) +
        0.25 * LOG10(1 + GREATEST(COALESCE(view_count, 0), 0)) +
        0.20 * LOG10(1 + GREATEST(COALESCE(favorite_count, 0), 0)) +
        0.15 * LOG10(1 + GREATEST(COALESCE(use_count, 0), 0)) +
        0.10 * LOG10(1 + GREATEST(COALESCE(work_count, 0), 0))
      ) DESC, id DESC`,
      income: 'income_points_total DESC, id DESC',
      views: 'view_count DESC, id DESC',
      favorites: 'favorite_count DESC, id DESC',
    }
    const orderBy = orderByMap[options.sort || 'recommend'] || orderByMap.recommend
    const rows = await db.query(`
      SELECT
        id,
        user_id,
        avatar_name,
        tags_json,
        description,
        view_count,
        favorite_count,
        income_points_total,
        avatar_url,
        skill_type,
        ${userId ? `
          EXISTS (
            SELECT 1
            FROM ai_user_favorite favorite
            WHERE favorite.user_id = ?
              AND favorite.target_type = '分身'
              AND favorite.target_id = ai_avatar.id
          )
        ` : 'FALSE'} AS is_favorited
      FROM ai_avatar
      WHERE ${whereClauses.join('\n        AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...(userId ? [userId] : []), ...params, pageSize + 1, offset])

    const hasMore = rows.length > pageSize
    const list = rows.slice(0, pageSize).map((row: Record<string, unknown>) => {
      const tagsJson = this.safeParseJson<Record<string, string>>(row.tagsJson, {})

      return {
        id: row.id,
        userId: row.userId || '',
        occupation: tagsJson.occupation || '',
        avatarName: row.avatarName || '',
        tags: [tagsJson.gender, tagsJson.age, tagsJson.location, tagsJson.occupation].filter(Boolean),
        description: row.description || '',
        viewCount: Number(row.viewCount || 0),
        favoriteCount: Number(row.favoriteCount || 0),
        isFavorited: Boolean(row.isFavorited),
        incomePointsTotal: Number(row.incomePointsTotal || 0),
        avatarUrl: row.avatarUrl || '',
        skillType: row.skillType || '',
      }
    })

    return { list, page, pageSize, hasMore }
  }
 
  async setFavorite(
    targetId: number,
    userId: string,
    targetType: FavoriteTargetType,
    isFavorited: boolean,
  ) {
    const targetConfig = targetType === '分身'
      ? {
          table: 'ai_avatar',
          visibilityWhere: `
            status = '已上线'
            AND public_status = '公开'
            AND audit_status = '审核通过'
            AND deleted_at IS NULL
          `,
        }
      : {
          table: 'ai_generated_work',
          visibilityWhere: `
            status = '正常'
            AND public_status = '公开'
            AND avatar_auth_status = '展示'
            AND deleted_at IS NULL
          `,
        }
    const connection = await getPool().getConnection()

    try {
      await connection.beginTransaction()
      const [targetRows] = await connection.query(`
        SELECT id
        FROM ${targetConfig.table}
        WHERE id = ?
          AND ${targetConfig.visibilityWhere}
        LIMIT 1
        FOR UPDATE
      `, [targetId])
      if ((targetRows as Array<{ id: number }>).length === 0) {
        await connection.rollback()
        return null
      }

      const [favoriteRows] = await connection.query(`
        SELECT id
        FROM ai_user_favorite
        WHERE user_id = ?
          AND target_type = ?
          AND target_id = ?
        LIMIT 1
        FOR UPDATE
      `, [userId, targetType, targetId])
      const existingFavorite = (favoriteRows as Array<{ id: number }>)[0]
      let changed = false

      if (isFavorited && !existingFavorite) {
        await connection.query(`
          INSERT INTO ai_user_favorite (user_id, target_type, target_id)
          VALUES (?, ?, ?)
        `, [userId, targetType, targetId])
        await connection.query(`
          UPDATE ${targetConfig.table}
          SET favorite_count = COALESCE(favorite_count, 0) + 1
          WHERE id = ?
        `, [targetId])
        changed = true
      } else if (!isFavorited && existingFavorite) {
        await connection.query(`
          DELETE FROM ai_user_favorite
          WHERE user_id = ?
            AND target_type = ?
            AND target_id = ?
        `, [userId, targetType, targetId])
        await connection.query(`
          UPDATE ${targetConfig.table}
          SET favorite_count = GREATEST(COALESCE(favorite_count, 0) - 1, 0)
          WHERE id = ?
        `, [targetId])
        changed = true
      }

      const [countRows] = await connection.query(`
        SELECT favorite_count
        FROM ${targetConfig.table}
        WHERE id = ?
        LIMIT 1
      `, [targetId])
      const favoriteCount = Number(
        (countRows as Array<{ favorite_count?: number }>)[0]?.favorite_count || 0,
      )

      await connection.commit()
      return { targetType, targetId, isFavorited, favoriteCount, changed }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 获取分身所有者设置
   */
  async getOwnedAvatarSettings(avatarId: number, userId: string) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        id,
        user_id,
        avatar_name,
        avatar_url,
        description,
        tags_json,
        public_status,
        audit_status,
        status,
        skill_type,
        updated_at,
        use_count,
        work_count,
        view_count,
        favorite_count,
        income_points_total
      FROM ai_avatar
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `, [avatarId, userId])
    const row = rows[0] as Record<string, unknown> | undefined
    return row ? this.mapAvatarSettings(row) : null
  }

  /**
   * 更新分身所有者设置
   */
  async updateOwnedAvatarSettings(
    avatarId: number,
    userId: string,
    updates: AvatarSettingsUpdate,
  ) {
    const current = await this.getOwnedAvatarSettings(avatarId, userId)
    if (!current) return { state: 'not_found' as const, data: null }
    if (updates.status && current.status === '已封禁') {
      return { state: 'status_locked' as const, data: current }
    }

    if (updates.publicStatus === '公开') {
      const audit = await this.contentAuditService.reviewPorn({
        items: this.buildAvatarAuditItems({
          avatarUrl: updates.avatarUrl || current.avatarUrl,
          avatarName: updates.avatarName || current.avatarName,
          description: updates.description ?? current.description,
        }),
      })
      if (!audit.passed) {
        await getMySQLClient().query(`
          UPDATE ai_avatar
          SET audit_status = '审核拒绝', updated_at = NOW()
          WHERE id = ?
            AND user_id = ?
            AND deleted_at IS NULL
        `, [avatarId, userId])
        const rejected = await this.getOwnedAvatarSettings(avatarId, userId)
        return { state: 'audit_rejected' as const, data: rejected }
      }
      updates.auditStatus = '审核通过'
    }
    if (updates.publicStatus === '私有') {
      updates.auditStatus = '待审核'
    }

    const columns: string[] = []
    const values: unknown[] = []
    const updateFields: Array<[keyof AvatarSettingsUpdate, string]> = [
      ['avatarName', 'avatar_name'],
      ['avatarUrl', 'avatar_url'],
      ['description', 'description'],
      ['publicStatus', 'public_status'],
      ['auditStatus', 'audit_status'],
      ['status', 'status'],
    ]
    updateFields.forEach(([key, column]) => {
      if (updates[key] !== undefined) {
        columns.push(`${column} = ?`)
        values.push(updates[key])
      }
    })

    const db = getMySQLClient()
    const statusGuard = updates.status ? "AND status <> '已封禁'" : ''
    const result = await db.query(`
      UPDATE ai_avatar
      SET ${columns.join(', ')}, updated_at = NOW()
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
        ${statusGuard}
    `, [...values, avatarId, userId])

    if (Number((result as any)?.affectedRows || 0) === 0) {
      const latest = await this.getOwnedAvatarSettings(avatarId, userId)
      if (!latest) return { state: 'not_found' as const, data: null }
      if (updates.status && latest.status === '已封禁') {
        return { state: 'status_locked' as const, data: latest }
      }
    }

    const updated = await this.getOwnedAvatarSettings(avatarId, userId)
    return { state: 'updated' as const, data: updated }
  }
  /**
   * 获取公开分身广场详情
   * @param avatarId 分身ID
   */
  async getPublicAvatarSquareDetail(avatarId: number) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        id,
        user_id,
        avatar_name,
        avatar_url,
        description,
        tags_json,
        skill_type,
        status,
        updated_at,
        use_count,
        work_count,
        view_count,
        favorite_count,
        income_points_total
      FROM ai_avatar
      WHERE id = ?
        AND status = '已上线'
        AND public_status = '公开'
        AND audit_status = '审核通过'
        AND deleted_at IS NULL
      LIMIT 1
    `, [avatarId])
    const row = rows[0] as Record<string, unknown> | undefined

    if (!row) return null

    const tagsJson = this.safeParseJson<Record<string, string>>(row.tagsJson, {})

    return {
      id: row.id,
      userId: row.userId || '',
      avatarName: row.avatarName || '',
      avatarUrl: row.avatarUrl || '',
      description: row.description || '',
      tags: [tagsJson.gender, tagsJson.age, tagsJson.location, tagsJson.occupation].filter(Boolean),
      skillType: row.skillType || '',
      status: row.status || '',
      updatedAt: row.updatedAt || '',
      useCount: Number(row.useCount || 0),
      workCount: Number(row.workCount || 0),
      viewCount: Number(row.viewCount || 0),
      favoriteCount: Number(row.favoriteCount || 0),
      incomePointsTotal: Number(row.incomePointsTotal || 0),
    }
  }

  /**
   * 获取公开分身广场作品
   * @param avatarId 分身ID
   * @param category 作品分类
   */
  async getPublicAvatarWorks(avatarId: number, category?: string, userId?: string) {
    const db = getMySQLClient()
    const categoryWhere = category ? 'AND skill_type = ?' : ''
    const params = [
      ...(userId ? [userId] : []),
      avatarId,
      ...(category ? [category] : []),
    ]
    const rows = await db.query(`
      SELECT
        id,
        template_id,
        skill_type,
        work_title,
        work_description,
        generated_pay_points,
        favorite_count,
        content_json,
        ${userId ? `
          EXISTS (
            SELECT 1
            FROM ai_user_favorite favorite
            WHERE favorite.user_id = ?
              AND favorite.target_type = '作品'
              AND favorite.target_id = ai_generated_work.id
          )
        ` : 'FALSE'} AS is_favorited
      FROM ai_generated_work
      WHERE avatar_id = ?
        AND status = '正常'
        AND public_status = '公开'
        AND avatar_auth_status = '展示'
        AND avatar_accept_status = '接受展示'
        AND deleted_at IS NULL
        ${categoryWhere}
      ORDER BY id DESC
    `, params)

    return rows.map((row: Record<string, unknown>) => ({
      ...this.mapWorkPreview(row),
      templateId: Number(row.templateId || 0),
    }))
  }

  /** 获取对外作品详情 */
  async getPublicWorkDetail(workId: number) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        id,
        skill_type,
        work_title,
        work_description,
        generated_pay_points,
        content_json
      FROM ai_generated_work
      WHERE id = ?
        AND status = '正常'
        AND public_status = '公开'
        AND deleted_at IS NULL
      LIMIT 1
    `, [workId])

    return rows[0] ? this.mapWorkPreview(rows[0]) : null
  }

  /** 获取对内作品详情 */
  async getInternalWorkDetail(workId: number, userId: string) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        id,
        skill_type,
        work_title,
        work_description,
        generated_pay_points,
        content_json
      FROM ai_generated_work
      WHERE id = ?
        AND user_id = ?
        AND status = '正常'
        AND deleted_at IS NULL
      LIMIT 1
    `, [workId, userId])

    return rows[0] ? this.mapWorkPreview(rows[0]) : null
  }

  /**
   * 获取分身作品汇总数据
   * @param avatarId 分身ID
   */
  async getAvatarWorkStats(avatarId: number) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        (
          SELECT COALESCE(SUM(tpl.use_count), 0)
          FROM ai_avatar_template tpl
          INNER JOIN (
            SELECT DISTINCT template_id
            FROM ai_generated_work
            WHERE avatar_id = ?
              AND template_id IS NOT NULL
              AND deleted_at IS NULL
          ) linked_work ON linked_work.template_id = tpl.id
          WHERE tpl.deleted_at IS NULL
        ) AS call_count,
        COUNT(*) AS work_count,
        COALESCE(SUM(favorite_count), 0) AS favorite_count,
        COALESCE(SUM(view_count), 0) AS view_count
      FROM ai_generated_work
      WHERE avatar_id = ?
        AND deleted_at IS NULL
    `, [avatarId, avatarId])
    const row = rows[0] as Record<string, unknown> | undefined

    return {
      callCount: Number(row?.callCount || 0),
      workCount: Number(row?.workCount || 0),
      favoriteCount: Number(row?.favoriteCount || 0),
      viewCount: Number(row?.viewCount || 0),
    }
  }
  /**
   * 获取自身分身广场作品
   * @param avatarId 分身ID
   * @param category 作品分类
   */
  async getOwnerAvatarWorks(avatarId: number, category?: string) {
    const db = getMySQLClient()
    const categoryWhere = category ? 'AND skill_type = ?' : ''
    const params = category ? [avatarId, category] : [avatarId]
    const rows = await db.query(`
      SELECT
        id,
        work_title,
        work_description,
        skill_type,
        generated_pay_points,
        updated_at,
        favorite_count,
        view_count,
        content_json
      FROM ai_generated_work
      WHERE status = '正常'
        AND avatar_accept_status = '接受展示'
        AND avatar_id = ?
        AND deleted_at IS NULL
        ${categoryWhere}
      ORDER BY id DESC
    `, params)

    return rows.map((row: Record<string, unknown>) => {
      const workPreview = this.mapWorkPreview(row)

      return {
        ...workPreview,
        income: Number(row.generatedPayPoints || 0),
        updatedAt: row.updatedAt || '',
        favoriteCount: Number(row.favoriteCount || 0),
        viewCount: Number(row.viewCount || 0),
        coverUrl: workPreview.category === '视频'
          ? workPreview.videoCoverUrl
          : workPreview.images[0] || '',
      }
    })
  }
}
