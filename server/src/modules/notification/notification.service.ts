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

    // 验证 userId 是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      console.warn(`[NotificationService] 无效的 userId 格式: ${userId}，跳过创建通知`)
      return null
    }

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

  async getNotificationsByOrder(orderId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('获取订单通知失败:', error)
      return []
    }

    // 过滤出包含该订单ID的通知
    // 支持 data.orderId 和 data.order_id 两种格式
    const filteredNotifications = (data || []).filter((notification: any) => {
      try {
        // 检查 data 字段中是否包含 order_id
        if (notification.data && typeof notification.data === 'object') {
          // 优先检查 order_id（下划线命名）
          if (notification.data.order_id === orderId) {
            return true
          }
          // 其次检查 orderId（驼峰命名）
          if (notification.data.orderId === orderId) {
            return true
          }
        }

        // 检查 content 字段中是否包含订单ID
        if (notification.content && typeof notification.content === 'string') {
          if (notification.content.includes(orderId)) {
            return true
          }
          // 尝试解析 content 为 JSON
          try {
            const contentData = JSON.parse(notification.content)
            if (contentData.order_id === orderId || contentData.orderId === orderId) {
              return true
            }
          } catch (e) {
            // 忽略解析错误
          }
        }

        // 检查 content 字段中是否包含订单标题（备用方案）
        // 注意：这个方案需要先获取订单标题，效率较低，仅作为最后的备用方案
        // 这里暂时不实现，因为上面的逻辑应该已经足够了

        return false
      } catch (e) {
        console.warn('解析通知数据失败:', e)
        return false
      }
    })

    // 为每个通知关联分身信息
    const notificationsWithAvatar = await Promise.all(
      filteredNotifications.map(async (notification: any) => {
        let avatarInfo: any = null

        // 尝试从通知的 data 字段中提取 avatarId
        if (notification.data && typeof notification.data === 'object') {
          const avatarId = notification.data.avatarId || notification.data.avatar_id

          if (avatarId) {
            try {
              // 查询分身信息
              const { data: avatar } = await client
                .from('avatars')
                .select('id, name, avatar_url')
                .eq('id', avatarId)
                .single()

              if (avatar) {
                avatarInfo = {
                  id: avatar.id,
                  name: avatar.name,
                  avatar_url: avatar.avatar_url
                }
              }
            } catch (error) {
              console.warn(`获取分身信息失败:`, error)
            }
          }
        }

        // 如果没有找到分身信息，尝试从 content 中解析分身名称
        if (!avatarInfo && notification.content) {
          const match = notification.content.match(/分身["\s]+([^"\s]+)/)
          if (match && match[1]) {
            avatarInfo = {
              id: null,
              name: match[1],
              avatar_url: null
            }
          }
        }

        return {
          ...notification,
          avatar: avatarInfo
        }
      })
    )

    return notificationsWithAvatar
  }
}
