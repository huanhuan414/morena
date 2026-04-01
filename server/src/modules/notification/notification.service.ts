import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class NotificationService {
  async getNotifications(userId: string, options?: { unreadOnly?: boolean }) {
    const client = getSupabaseClient()
    
    let query = client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (options?.unreadOnly) {
      query = query.eq('is_read', false)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('获取通知失败:', error)
      return []
    }
    
    return data || []
  }

  async markAsRead(userId: string, notificationId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`标记已读失败: ${error.message}`)
    }
    
    return true
  }

  async markAllAsRead(userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    
    if (error) {
      throw new Error(`标记全部已读失败: ${error.message}`)
    }
    
    return true
  }

  async createNotification(userId: string, notification: {
    type: string
    title: string
    content: string
    data?: Record<string, any>
  }) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('notifications')
      .insert({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        data: notification.data || {}
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建通知失败: ${error.message}`)
    }
    
    return data
  }

  async getNotificationSettings(userId: string) {
    const client = getSupabaseClient()
    
    const { data: user } = await client
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single()
    
    const settings = user?.settings || {}
    
    return {
      message: settings.notification_message ?? true,
      like: settings.notification_like ?? true,
      follow: settings.notification_follow ?? true,
      system: settings.notification_system ?? true
    }
  }

  async updateNotificationSettings(userId: string, settings: Record<string, boolean>) {
    const client = getSupabaseClient()
    
    // 获取现有设置
    const { data: user } = await client
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single()
    
    const currentSettings = user?.settings || {}
    
    // 合并新设置
    const newSettings = {
      ...currentSettings,
      notification_message: settings.message ?? currentSettings.notification_message,
      notification_like: settings.like ?? currentSettings.notification_like,
      notification_follow: settings.follow ?? currentSettings.notification_follow,
      notification_system: settings.system ?? currentSettings.notification_system
    }
    
    const { error } = await client
      .from('users')
      .update({ settings: newSettings })
      .eq('id', userId)
    
    if (error) {
      throw new Error(`更新设置失败: ${error.message}`)
    }
    
    return this.getNotificationSettings(userId)
  }

  async getUnreadCount(userId: string) {
    const client = getSupabaseClient()
    
    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    
    if (error) {
      return 0
    }
    
    return count || 0
  }
}
