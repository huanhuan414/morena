// @ts-nocheck
import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

// 共享内存存储
const sharedMemoryNotifications: Map<string, any[]> = new Map()
const sharedMemoryNotificationOrder: Array<{ userId: string; id: string }> = []
const MEMORY_MAX_USERS = Number(process.env?.NOTIFY_MEMORY_MAX_USERS || 200)
const MEMORY_MAX_TOTAL = Number(process.env?.NOTIFY_MEMORY_MAX_TOTAL || 2000)
const MEMORY_MAX_PER_USER = Number(process.env?.NOTIFY_MEMORY_MAX_PER_USER || 50)

const TEMPLATE_DEFS: Record<string, any> = {
  first_order_guide: {
    envKey: 'NOTIFY_TPL_FIRST_ORDER_ENABLED',
    type: 'growth_first_order_guide',
    title: '首单完成引导',
    content: '你已完成首单支付，订单「{orderTitle}」正在分配分身。你可以在订单页查看进度与时间线。',
  },
  acceptance_overdue: {
    envKey: 'NOTIFY_TPL_ACCEPTANCE_OVERDUE_ENABLED',
    type: 'order_acceptance_overdue',
    title: '验收超时提醒',
    content: '你的订单「{orderTitle}」已超过6小时未验收，请尽快处理。',
  }
}

@Injectable()
export class NotificationService {
  private notificationColumns: Set<string> | null = null

  private async getNotificationColumns() {
    if (this.notificationColumns) return this.notificationColumns
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      const rows = await db.query(
        `SELECT COLUMN_NAME as column_name
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'notifications'`
      )
      const list = Array.isArray(rows) ? rows : (rows?.data || [])
      this.notificationColumns = new Set(
        (list || []).map((r: any) => String(r.columnName ?? r.column_name ?? '').toLowerCase()).filter(Boolean)
      )
    } catch {
      this.notificationColumns = new Set(['id', 'user_id', 'type', 'title', 'content', 'is_read', 'data', 'created_at'])
    }
    return this.notificationColumns
  }

  private pickNotificationPayload(columns: Set<string>, payload: Record<string, any>) {
    const picked: Record<string, any> = {}
    for (const [key, value] of Object.entries(payload || {})) {
      if (columns.has(key.toLowerCase())) {
        picked[key] = value
      }
    }
    return picked
  }
  private removeFromMemoryOrder(userId: string, ids: string[]) {
    if (!ids || ids.length === 0) return
    const idSet = new Set(ids)
    for (let i = sharedMemoryNotificationOrder.length - 1; i >= 0; i--) {
      const item = sharedMemoryNotificationOrder[i]
      if (item.userId === userId && idSet.has(item.id)) {
        sharedMemoryNotificationOrder.splice(i, 1)
      }
    }
  }

  private removeMemoryNotification(userId: string, notificationId: string) {
    const notifications = sharedMemoryNotifications.get(userId) || []
    const filtered = notifications.filter((n) => n.id !== notificationId)
    if (filtered.length === 0) {
      sharedMemoryNotifications.delete(userId)
    } else {
      sharedMemoryNotifications.set(userId, filtered)
    }
    this.removeFromMemoryOrder(userId, [notificationId])
  }

  private enforceMemoryLimits() {
    if (MEMORY_MAX_PER_USER > 0) {
      for (const [userId, list] of sharedMemoryNotifications.entries()) {
        if (list.length > MEMORY_MAX_PER_USER) {
          const removed = list.slice(MEMORY_MAX_PER_USER)
          const removedIds = removed.map((n) => n.id)
          list.length = MEMORY_MAX_PER_USER
          this.removeFromMemoryOrder(userId, removedIds)
        }
      }
    }

    while (
      (MEMORY_MAX_TOTAL > 0 && sharedMemoryNotificationOrder.length > MEMORY_MAX_TOTAL)
      || (MEMORY_MAX_USERS > 0 && sharedMemoryNotifications.size > MEMORY_MAX_USERS)
    ) {
      const item = sharedMemoryNotificationOrder.pop()
      if (!item) break
      this.removeMemoryNotification(item.userId, item.id)
    }
  }

  private addMemoryNotification(userId: string, notification: any) {
    const userNotifications = sharedMemoryNotifications.get(userId) || []
    userNotifications.unshift(notification)
    sharedMemoryNotifications.set(userId, userNotifications)
    sharedMemoryNotificationOrder.unshift({ userId, id: notification.id })
    this.enforceMemoryLimits()
  }

  private async flushMemoryNotificationsToDb(userId: string) {
    const notifications = sharedMemoryNotifications.get(userId) || []
    if (notifications.length === 0) return { flushed: 0 }

    let flushed = 0
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      const columns = await this.getNotificationColumns()

      const remaining: any[] = []
      for (let i = notifications.length - 1; i >= 0; i--) {
        const n = notifications[i]
        try {
          const base: any = {
            id: n.id,
            user_id: n.user_id || userId,
            type: n.type,
            title: n.title,
            content: n.content,
            is_read: Boolean(n.is_read),
            created_at: n.created_at ? new Date(n.created_at) : new Date(),
          }
          const metadataJson = JSON.stringify(n.metadata || {})
          if (columns.has('metadata')) base.metadata = metadataJson
          if (columns.has('data')) base.data = metadataJson
          if (columns.has('updated_at')) base.updated_at = n.updated_at ? new Date(n.updated_at) : new Date()
          await db.insert('notifications', this.pickNotificationPayload(columns, base))
          flushed += 1
        } catch {
          remaining.unshift(n)
        }
      }

      if (remaining.length === 0) {
        sharedMemoryNotifications.delete(userId)
      } else {
        sharedMemoryNotifications.set(userId, remaining)
      }

      const remainingIds = new Set(remaining.map((n) => n.id))
      for (let i = sharedMemoryNotificationOrder.length - 1; i >= 0; i--) {
        const item = sharedMemoryNotificationOrder[i]
        if (item.userId === userId && !remainingIds.has(item.id)) {
          sharedMemoryNotificationOrder.splice(i, 1)
        }
      }
    } catch {}

    this.enforceMemoryLimits()
    return { flushed }
  }

  private normalizeReadFlag(value: any): boolean {
    if (value === true) return true
    if (value === false) return false
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return normalized === '1' || normalized === 'true' || normalized === 'yes'
    }
    return false
  }

  private safeParseJson<T = any>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return value as T
    if (typeof value !== 'string') return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  private normalizeNotificationRow(row: any) {
    const isRead = this.normalizeReadFlag(row?.isRead ?? row?.is_read)
    const createdAt = row?.createdAt || row?.created_at
    const updatedAt = row?.updatedAt || row?.updated_at
    const metadataSource = row?.metadata ?? row?.data
    const metadata = this.safeParseJson(metadataSource, metadataSource || {})

    return {
      ...row,
      metadata,
      is_read: isRead,
      isRead,
      created_at: createdAt,
      createdAt,
      updated_at: updatedAt,
      updatedAt,
    }
  }

  private renderTemplate(input: string, params: Record<string, any> = {}) {
    if (!input) return input
    return String(input).replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = params[key]
      if (value === undefined || value === null) return ''
      return String(value)
    })
  }

  async createTemplateNotification(
    userId: string,
    templateKey: string,
    params: Record<string, any> = {},
    metadata?: Record<string, any>
  ) {
    const def = TEMPLATE_DEFS[templateKey]
    if (!def) {
      throw new Error('未知通知模板')
    }
    if (def.envKey && process.env?.[def.envKey] === '0') {
      return { skipped: true }
    }
    const title = this.renderTemplate(def.title, params)
    const content = this.renderTemplate(def.content, params)
    return await this.createNotification({
      user_id: userId,
      type: def.type,
      title,
      content,
      metadata: { ...(metadata || {}), templateKey }
    })
  }

  async createNotification(data: {
    user_id: string
    type: string
    title: string
    content: string
    metadata?: Record<string, any>
  }) {
    const id = crypto.randomUUID()
    const notification = {
      id,
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      content: data.content,
      metadata: data.metadata || {},
      is_read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 尝试写入数据库，失败则使用内存
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      const columns = await this.getNotificationColumns()
      const base: any = {
        id,
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        content: data.content,
        is_read: false,
        created_at: new Date(),
      }
      const metadataJson = JSON.stringify(data.metadata || {})
      if (columns.has('metadata')) base.metadata = metadataJson
      if (columns.has('data')) base.data = metadataJson
      if (columns.has('updated_at')) base.updated_at = new Date()
      await db.insert('notifications', this.pickNotificationPayload(columns, base))
      await this.flushMemoryNotificationsToDb(data.user_id)
    } catch (dbError) {
      // 数据库写入失败，使用内存缓存
      this.addMemoryNotification(data.user_id, notification)
    }

    return { id }
  }

  async getNotifications(userId: string, page = 1, pageSize = 20) {
    let notifications: any[] = []

    // 尝试从数据库读取
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      await this.flushMemoryNotificationsToDb(userId)
      const result = await db.query(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      )
      notifications = Array.isArray(result) ? result : (result?.data || [])
    } catch (dbError) {
      // 数据库读取失败，使用内存缓存
      notifications = sharedMemoryNotifications.get(userId) || []
    }

    // 按创建时间降序排序（确保内存缓存的数据也有正确的顺序）
    notifications.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime()
      const timeB = new Date(b.created_at || 0).getTime()
      return timeB - timeA
    })

    const total = notifications.length
    const offset = (page - 1) * pageSize

    return {
      list: notifications.slice(offset, offset + pageSize).map((n: any) => this.normalizeNotificationRow(n)),
      total,
      page,
      pageSize
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    // 尝试更新数据库
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      await this.flushMemoryNotificationsToDb(userId)
      const columns = await this.getNotificationColumns()
      const base: any = { is_read: true }
      if (columns.has('updated_at')) base.updated_at = new Date()
      await db.updateWhere('notifications', { id: notificationId, user_id: userId }, this.pickNotificationPayload(columns, base))
    } catch (dbError) {
      // 数据库更新失败，更新内存缓存
      const notifications = sharedMemoryNotifications.get(userId) || []
      const notification = notifications.find(n => n.id === notificationId)
      if (notification) {
        notification.is_read = true
        notification.updated_at = new Date().toISOString()
      }
    }

    return { success: true }
  }

  async markAllAsRead(userId: string) {
    // 尝试更新数据库
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      await this.flushMemoryNotificationsToDb(userId)
      const notifications = await db.query('notifications', { user_id: userId, is_read: false }) as any[]
      const columns = await this.getNotificationColumns()
      for (const n of notifications || []) {
        const base: any = { is_read: true }
        if (columns.has('updated_at')) base.updated_at = new Date()
        await db.updateWhere('notifications', { id: n.id }, this.pickNotificationPayload(columns, base))
      }
    } catch (dbError) {
      // 数据库更新失败，更新内存缓存
      const notifications = sharedMemoryNotifications.get(userId) || []
      notifications.forEach(n => {
        n.is_read = true
        n.updated_at = new Date().toISOString()
      })
    }

    return { success: true }
  }

  async deleteNotification(notificationId: string, userId: string) {
    // 尝试删除数据库记录
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      await this.flushMemoryNotificationsToDb(userId)
      await db.delete('notifications', { id: notificationId, user_id: userId })
    } catch (dbError) {
      // 数据库删除失败，删除内存缓存
      this.removeMemoryNotification(userId, notificationId)
    }

    return { success: true }
  }

  async getUnreadCount(userId: string) {
    let count = 0

    // 尝试从数据库读取
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      await this.flushMemoryNotificationsToDb(userId)
      const notifications = await db.query('notifications', { user_id: userId, is_read: false }) as any[]
      count = notifications?.length || 0
    } catch (dbError) {
      // 数据库读取失败，使用内存缓存
      const notifications = sharedMemoryNotifications.get(userId) || []
      count = notifications.filter(n => !n.is_read).length
    }

    return { count }
  }

  async getNotificationSettings(userId: string) {
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      const settings = await db.query('notification_settings', { user_id: userId }) as any[]
      if (settings && settings.length > 0) {
        return settings[0]
      }
    } catch (dbError) {
      // 数据库不可用，返回默认设置
    }

    return {
      message: true,
      like: true,
      follow: true,
      system: true
    }
  }

  async updateNotificationSettings(userId: string, settings: Record<string, boolean>) {
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      const existing = await db.query('notification_settings', { user_id: userId }) as any[]

      if (existing && existing.length > 0) {
        await db.updateWhere('notification_settings', { user_id: userId }, {
          ...settings,
          updated_at: new Date()
        })
      } else {
        await db.insert('notification_settings', {
          user_id: userId,
          ...settings,
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    } catch (dbError) {
      // 数据库不可用，静默处理
    }

    return { success: true, ...settings }
  }
}

import * as crypto from 'crypto'
