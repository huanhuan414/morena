import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { ensureGrowthCampaignTables } from './growth-campaign.tables'

export interface Activity {
  id: string
  type: 'order' | 'content' | 'avatar' | 'chat' | 'earning'
  title: string
  description: string
  timestamp: string
  avatar?: string
  amount?: string
  platform?: string
  status?: string
}

@Injectable()
export class ActivitiesService {
  private async ensureGrowthCampaignTables() {
    await ensureGrowthCampaignTables()
  }

  async getCampaignConfig() {
    await this.ensureGrowthCampaignTables()
    const db = getMySQLClient()
    const rows = await db.query(`SELECT * FROM growth_campaigns WHERE id = 'current' LIMIT 1`)
    const row = rows?.[0] || rows?.data?.[0]
    if (!row) {
      return {
        id: 'current',
        enabled: 0,
        title: '',
        description: '',
        startAt: null,
        endAt: null
      }
    }
    return {
      id: row.id,
      enabled: Number(row.enabled || 0),
      title: row.title || '',
      description: row.description || '',
      startAt: row.start_at || row.startAt || null,
      endAt: row.end_at || row.endAt || null,
      updatedAt: row.updated_at || row.updatedAt || null
    }
  }

  async getActiveCampaign() {
    const config = await this.getCampaignConfig()
    if (!config || !config.enabled) return null
    const now = Date.now()
    const startAt = config.startAt ? new Date(config.startAt).getTime() : null
    const endAt = config.endAt ? new Date(config.endAt).getTime() : null
    if (startAt && now < startAt) return null
    if (endAt && now > endAt) return null
    return config
  }

  async upsertCampaignConfig(payload: {
    enabled?: number
    title?: string
    description?: string
    startAt?: string | null
    endAt?: string | null
  }) {
    await this.ensureGrowthCampaignTables()
    const db = getMySQLClient()

    const enabled = payload.enabled ? 1 : 0
    const title = payload.title || ''
    const description = payload.description || ''
    const startAt = payload.startAt ? new Date(payload.startAt) : null
    const endAt = payload.endAt ? new Date(payload.endAt) : null

    await db.query(
      `INSERT INTO growth_campaigns (id, enabled, title, description, start_at, end_at, created_at, updated_at)
       VALUES ('current', ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), title = VALUES(title), description = VALUES(description),
       start_at = VALUES(start_at), end_at = VALUES(end_at), updated_at = NOW()`,
      [enabled, title, description, startAt, endAt]
    )

    return await this.getCampaignConfig()
  }

  async trackCampaignEvent(userId: string | undefined, eventType: string) {
    const active = await this.getActiveCampaign()
    if (!active) return { skipped: true }
    await this.ensureGrowthCampaignTables()
    const db = getMySQLClient()
    const id = crypto.randomUUID()
    await db.query(
      `INSERT INTO growth_campaign_events (id, campaign_id, event_type, user_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, 'current', String(eventType || ''), userId || null]
    )
    return { success: true }
  }

  async getCampaignStats(days: number = 7) {
    await this.ensureGrowthCampaignTables()
    const db = getMySQLClient()
    const normalizedDays = Math.max(1, Math.min(90, Number(days) || 7))
    const rows = await db.query(
      `SELECT DATE(created_at) as day, event_type, COUNT(*) as count
       FROM growth_campaign_events
       WHERE campaign_id = 'current' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at), event_type
       ORDER BY day DESC`,
      [normalizedDays - 1]
    )
    const dataRows = rows?.data || rows || []
    return { days: normalizedDays, rows: dataRows }
  }

  async getRecentActivities(userId: string, limit: number = 10): Promise<Activity[]> {
    const activities: Activity[] = []

    // 1. 最近订单动态
    try {
      const db = getMySQLClient()
      const orders = await db.query(
        `SELECT id, title, status, budget, created_at, updated_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
        [userId]
      )
      for (const order of orders) {
        const statusMap: Record<string, string> = {
          'submitted': '已提交',
          'pending_payment': '待支付',
          'awaiting_acceptance': '待接单',
          'in_progress': '进行中',
          'completed': '已完成',
          'cancelled': '已取消',
        }
        activities.push({
          id: `order-${order.id}`,
          type: 'order',
          title: order.title || '新订单',
          description: `订单状态：${statusMap[order.status] || order.status}`,
          timestamp: order.updatedAt || order.createdAt,
          amount: order.budget ? `¥${Number(order.budget).toFixed(2)}` : undefined,
          status: order.status,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询订单失败:', err.message)
    }

    // 2. 最近内容生成动态
    try {
      const db = getMySQLClient()
      const contents = await db.query(
        `SELECT cgr.id, cgr.order_id, cgr.status, cgr.created_at, o.title as order_title
         FROM content_generation_requests cgr
         LEFT JOIN orders o ON cgr.order_id = o.id
         WHERE o.user_id = ?
         ORDER BY cgr.created_at DESC LIMIT 5`,
        [userId]
      )
      for (const content of contents) {
        const statusMap: Record<string, string> = {
          'pending': '待生成',
          'generating': '生成中',
          'generated': '已生成',
          'published': '已发布',
          'feedback_submitted': '待验收',
          'completed': '已完成',
        }
        activities.push({
          id: `content-${content.id}`,
          type: 'content',
          title: content.orderTitle || '内容生成',
          description: `内容${statusMap[content.status] || content.status}`,
          timestamp: content.createdAt,
          status: content.status,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询内容生成失败:', err.message)
    }

    // 3. 最近分身动态
    try {
      const db = getMySQLClient()
      const avatars = await db.query(
        `SELECT id, name, created_at, updated_at FROM avatars WHERE user_id = ? ORDER BY updated_at DESC LIMIT 3`,
        [userId]
      )
      for (const avatar of avatars) {
        const isNew = (new Date(avatar.updatedAt).getTime() - new Date(avatar.createdAt).getTime()) < 60000
        activities.push({
          id: `avatar-${avatar.id}`,
          type: 'avatar',
          title: avatar.name || '分身',
          description: isNew ? '新分身创建成功' : '分身状态更新',
          timestamp: avatar.updatedAt || avatar.createdAt,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询分身失败:', err.message)
    }

    // 4. 最近接单动态（分派请求）
    try {
      const db = getMySQLClient()
      const dispatches = await db.query(
        `SELECT od.id, od.order_id, od.avatar_id, od.status, od.created_at, o.title as order_title, a.name as avatar_name
         FROM order_dispatch_requests od
         LEFT JOIN orders o ON od.order_id = o.id
         LEFT JOIN avatars a ON od.avatar_id = a.id
         WHERE o.user_id = ? OR a.user_id = ?
         ORDER BY od.created_at DESC LIMIT 5`,
        [userId, userId]
      )
      for (const dispatch of dispatches) {
        const statusMap: Record<string, string> = {
          'pending': '待接单',
          'accepted': '已接单',
          'rejected': '已拒绝',
          'feedback_submitted': '待验收',
          'completed': '已完成',
        }
        activities.push({
          id: `dispatch-${dispatch.id}`,
          type: 'order',
          title: dispatch.orderTitle || '订单分派',
          description: `分身「${dispatch.avatarName || '未知'}」${statusMap[dispatch.status] || dispatch.status}`,
          timestamp: dispatch.createdAt,
          status: dispatch.status,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询分派记录失败:', err.message)
    }

    // 5. 最近收益动态
    try {
      const db = getMySQLClient()
      const earnings = await db.query(
        `SELECT id, amount, type, order_title, avatar_name, description, created_at FROM earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
        [userId]
      )
      for (const earning of earnings) {
        activities.push({
          id: `earning-${earning.id}`,
          type: 'earning',
          title: '收益到账',
          description: `${earning.orderTitle || earning.description || earning.type || '订单收益'}`,
          timestamp: earning.createdAt,
          amount: earning.amount ? `+¥${Number(earning.amount).toFixed(2)}` : undefined,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询收益失败:', err.message)
    }

    // 按时间倒序排列
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return activities.slice(0, limit)
  }
}
