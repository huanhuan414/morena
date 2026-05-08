// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class NotificationService {
  async createNotification(data: {
    user_id: string
    type: string
    title: string
    content: string
    metadata?: Record<string, any>
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
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
    
    return { id }
  }

  async getNotifications(userId: string, page = 1, pageSize = 20) {
    const db = getMySQLClient()
    
    const notifications = await db.query('notifications', { user_id: userId }) as any
    const total = notifications?.length || 0
    const offset = (page - 1) * pageSize
    
    return {
      list: notifications?.slice(offset, offset + pageSize) || [],
      total,
      page,
      pageSize
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('notifications', { id: notificationId, user_id: userId }, {
      is_read: true,
      updated_at: new Date()
    })
    
    return { success: true }
  }

  async markAllAsRead(userId: string) {
    const db = getMySQLClient()
    
    const notifications = await db.query('notifications', { user_id: userId, is_read: false }) as any
    for (const n of notifications || []) {
      await db.updateWhere('notifications', { id: n.id }, {
        is_read: true,
        updated_at: new Date()
      })
    }
    
    return { success: true }
  }

  async deleteNotification(notificationId: string, userId: string) {
    const db = getMySQLClient()
    
    await db.delete('notifications', { id: notificationId, user_id: userId })
    
    return { success: true }
  }

  async getUnreadCount(userId: string) {
    const db = getMySQLClient()
    
    const notifications = await db.query('notifications', { user_id: userId, is_read: false }) as any
    return { count: notifications?.length || 0 }
  }
}

import * as crypto from 'crypto'
