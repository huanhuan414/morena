// @ts-nocheck
import { Injectable } from '@nestjs/common'

// 共享内存存储
const sharedMemoryNotifications: Map<string, any[]> = new Map()

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
      await db.insert('notifications', {
        id,
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        content: data.content,
        metadata: JSON.stringify(data.metadata || {}),
        is_read: false,
        created_at: new Date(),
        updated_at: new Date()
      })
    } catch (dbError) {
      // 数据库写入失败，使用内存缓存
      const userNotifications = sharedMemoryNotifications.get(data.user_id) || []
      userNotifications.unshift(notification)
      sharedMemoryNotifications.set(data.user_id, userNotifications)
    }

    return { id }
  }

  async getNotifications(userId: string, page = 1, pageSize = 20) {
    let notifications: any[] = []

    // 尝试从数据库读取
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
      notifications = (await db.query('notifications', { user_id: userId })) || []
    } catch (dbError) {
      // 数据库读取失败，使用内存缓存
      notifications = sharedMemoryNotifications.get(userId) || []
    }

    const total = notifications.length
    const offset = (page - 1) * pageSize

    return {
      list: notifications.slice(offset, offset + pageSize),
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
      await db.updateWhere('notifications', { id: notificationId, user_id: userId }, {
        is_read: true,
        updated_at: new Date()
      })
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
      const notifications = await db.query('notifications', { user_id: userId, is_read: false }) as any[]
      for (const n of notifications || []) {
        await db.updateWhere('notifications', { id: n.id }, {
          is_read: true,
          updated_at: new Date()
        })
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
      await db.delete('notifications', { id: notificationId, user_id: userId })
    } catch (dbError) {
      // 数据库删除失败，删除内存缓存
      const notifications = sharedMemoryNotifications.get(userId) || []
      const filtered = notifications.filter(n => n.id !== notificationId)
      sharedMemoryNotifications.set(userId, filtered)
    }

    return { success: true }
  }

  async getUnreadCount(userId: string) {
    let count = 0

    // 尝试从数据库读取
    try {
      const { getMySQLClient } = await import('../../storage/database/mysql-client')
      const db = getMySQLClient()
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
