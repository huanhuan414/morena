import { Injectable } from '@nestjs/common'

import { getMySQLClient } from '../../storage/database/mysql-client'

export type MyAvatarFilter = 'all' | 'skilled' | 'pending'

@Injectable()
export class MyAvatarService {
  async getMyAvatars(userId: string, filter: MyAvatarFilter) {
    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT
        id,
        user_id,
        avatar_url,
        avatar_name,
        skill_type,
        tags_json,
        description,
        status,
        view_count,
        favorite_count,
        income_points_total,
        updated_at
      FROM ai_avatar
      WHERE user_id = ?
        AND deleted_at IS NULL
      ORDER BY updated_at DESC, id DESC
    `, [userId])

    const list = rows.map((row: Record<string, unknown>) => {
      const item = this.mapAvatar(row)
      return {
        ...item,
        hasSkill: item.status === '已上线' && Boolean(item.skillType.trim()),
      }
    })
    const skilledCount = list.filter(item => item.hasSkill).length
    const filteredList = filter === 'skilled'
      ? list.filter(item => item.hasSkill)
      : filter === 'pending'
        ? list.filter(item => !item.hasSkill)
        : list
    const workRows = await this.getWorksByAvatarIds(filteredList.map(item => item.id))
    const workRowsByAvatar = new Map<number, Array<Record<string, unknown>>>()
    workRows.forEach((row: Record<string, unknown>) => {
      const avatarId = Number(row.avatarId || 0)
      const avatarWorks = workRowsByAvatar.get(avatarId) || []
      avatarWorks.push(row)
      workRowsByAvatar.set(avatarId, avatarWorks)
    })

    return {
      summary: {
        avatarCount: list.length,
        totalViewCount: list.reduce((sum, item) => sum + item.viewCount, 0),
        totalFavoriteCount: list.reduce((sum, item) => sum + item.favoriteCount, 0),
        totalIncomePoints: list.reduce((sum, item) => sum + item.incomePointsTotal, 0),
      },
      counts: {
        all: list.length,
        skilled: skilledCount,
        pending: list.length - skilledCount,
      },
      list: filteredList.map(item => ({
        ...item,
        works: (workRowsByAvatar.get(item.id) || []).map(row => this.mapWork(row)),
      })),
    }
  }

  async getMyAvatarWorks(avatarId: number, userId: string) {
    const db = getMySQLClient()
    const avatarRows = await db.query(`
      SELECT id
      FROM ai_avatar
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `, [avatarId, userId])
    if (!avatarRows[0]) return null

    const rows = await this.getWorksByAvatarIds([avatarId])
    return rows.map((row: Record<string, unknown>) => this.mapWork(row))
  }

  async deleteMyAvatar(avatarId: number, userId: string) {
    const db = getMySQLClient()
    const result = await db.query(`
      UPDATE ai_avatar
      SET deleted_at = NOW(), status = '已下线', updated_at = NOW()
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
    `, [avatarId, userId])
    return Number((result as any)?.affectedRows || 0) > 0
  }

  private mapAvatar(row: Record<string, unknown>) {
    return {
      id: Number(row.id || 0),
      userId: String(row.userId || ''),
      avatarUrl: String(row.avatarUrl || ''),
      avatarName: String(row.avatarName || ''),
      skillType: String(row.skillType || ''),
      tags: this.parseTags(row.tagsJson),
      description: String(row.description || ''),
      status: String(row.status || ''),
      viewCount: Number(row.viewCount || 0),
      favoriteCount: Number(row.favoriteCount || 0),
      incomePointsTotal: Number(row.incomePointsTotal || 0),
      updatedAt: row.updatedAt || '',
    }
  }

  private mapWork(row: Record<string, unknown>) {
    const contentJson = this.safeParseJson<Record<string, unknown>>(row.contentJson, {})
    const rawImages = Array.isArray(contentJson.images)
      ? contentJson.images
      : this.safeParseJson<unknown[]>(contentJson.images, [])
    const images = rawImages.filter((item): item is string => typeof item === 'string')
    const category = String(row.skillType || '').replace('生成', '')

    return {
      id: Number(row.id || 0),
      title: String(row.workTitle || ''),
      description: String(row.workDescription || ''),
      category,
      income: Number(row.generatedPayPoints || 0),
      updatedAt: row.updatedAt || '',
      favoriteCount: Number(row.favoriteCount || 0),
      viewCount: Number(row.viewCount || 0),
      images: category === '图片' || category === '图文' ? images : [],
      contentTitle: category === '图文' ? String(contentJson.title || '') : '',
      contentText: category === '文字' || category === '图文' ? String(contentJson.text || '') : '',
      videoUrl: category === '视频'
        ? String(contentJson.video_url || contentJson.videoUrl || '')
        : '',
      videoCoverUrl: category === '视频'
        ? String(contentJson.cover_url || contentJson.coverUrl || '')
        : '',
      coverUrl: category === '视频'
        ? String(contentJson.cover_url || contentJson.coverUrl || '')
        : images[0] || '',
    }
  }

  private async getWorksByAvatarIds(avatarIds: number[]) {
    if (avatarIds.length === 0) return []

    const db = getMySQLClient()
    const placeholders = avatarIds.map(() => '?').join(', ')
    return db.query(`
      SELECT
        avatar_id,
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
        AND avatar_id IN (${placeholders})
        AND deleted_at IS NULL
      ORDER BY avatar_id ASC, id DESC
    `, avatarIds)
  }

  private parseTags(value: unknown) {
    const parsed = this.safeParseJson<unknown>(value, {})
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    }
    if (!parsed || typeof parsed !== 'object') return []

    const tags = parsed as Record<string, unknown>
    return [tags.gender, tags.age, tags.location, tags.occupation]
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  }

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
}
