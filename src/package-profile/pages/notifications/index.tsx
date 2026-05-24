import { useDidShow, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Switch } from '@/components/ui/switch'
import { Network } from '@/network'
import { ArrowLeft, Bell, MessageCircle, Heart, UserPlus, Info, CheckCheck } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import '@/styles/variables.css'
import './index.css'

interface NotificationSetting {
  key: string
  title: string
  desc: string
  enabled: boolean
  icon: any
  color: string
}

interface Notification {
  id: string
  type: string
  title: string
  content: string
  metadata?: any
  is_read: boolean
  created_at: string
}

const typeIconMap: Record<string, any> = {
  message: MessageCircle,
  like: Heart,
  follow: UserPlus,
  system: Info,
  urge_review: Bell,
}

const typeColorMap: Record<string, string> = {
  message: '#7B3FE4',
  like: '#EF4444',
  follow: '#3B82F6',
  system: '#F59E0B',
  urge_review: '#10B981',
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    { key: 'message', title: '私信通知', desc: '收到新消息时提醒', enabled: true, icon: MessageCircle, color: '#7B3FE4' },
    { key: 'like', title: '点赞通知', desc: '有人点赞时提醒', enabled: true, icon: Heart, color: '#EF4444' },
    { key: 'follow', title: '关注通知', desc: '有新粉丝时提醒', enabled: true, icon: UserPlus, color: '#3B82F6' },
    { key: 'system', title: '系统通知', desc: '重要系统消息', enabled: true, icon: Info, color: '#F59E0B' },
  ])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const statusBarHeight = getStatusBarHeight()

  useDidShow(() => {
    fetchNotifications()
  })

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/notifications' })
      if (res.data?.code === 200) {
        const data = res.data.data
        setNotifications(data?.list || data || [])
      }
    } catch (error) {
      console.error('获取通知失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSetting = async (key: string, enabled: boolean) => {
    setSettings(prev => prev.map(s =>
      s.key === key ? { ...s, enabled } : s
    ))
    try {
      await Network.request({
        url: '/api/notifications/settings',
        method: 'PUT',
        data: { [key]: enabled }
      })
      showToast({ title: '设置已保存', icon: 'success', duration: 1000 })
    } catch (error) {
      console.error('保存设置失败:', error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await Network.request({
        url: `/api/notifications/${id}/read`,
        method: 'PUT'
      })
      setNotifications(prev => prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ))
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id)

    let metadata = notification.metadata
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      } catch {
        metadata = null
      }
    }

    const orderId = metadata?.orderId || metadata?.order_id
    const eventType = metadata?.eventType || metadata?.event_type
    const avatarId = metadata?.avatarId || metadata?.avatar_id

    if (orderId) {
      if (['dispatched', 'revision_requested'].includes(String(eventType || '')) && avatarId) {
        navigateTo({ url: `/package-order/pages/order-processing/index?orderId=${encodeURIComponent(orderId)}&avatarId=${encodeURIComponent(avatarId)}` })
        return
      }
      navigateTo({ url: `/package-order/pages/order-detail/index?id=${encodeURIComponent(orderId)}` })
      return
    }
  }

  const markAllAsRead = async () => {
    try {
      await Network.request({
        url: '/api/notifications/read-all',
        method: 'PUT'
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      showToast({ title: '已全部标记已读', icon: 'success' })
    } catch (error) {
      console.error('操作失败:', error)
    }
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <View className="notifications-page">
      {/* 紫蓝渐变头部 */}
      <View className="noti-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-decor-1" />
        <View className="header-decor-2" />
        <View className="header-nav">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="nav-title">消息通知</Text>
          <View className="nav-placeholder" />
        </View>
        <View className="header-actions">
          <View className="nav-action" onClick={markAllAsRead}>
            <CheckCheck size={18} color="rgba(255,255,255,0.75)" />
            <Text className="nav-action-text">全部已读</Text>
          </View>
        </View>
        {unreadCount > 0 && (
          <View className="unread-summary">
            <Text className="unread-summary-text">{unreadCount} 条未读消息</Text>
          </View>
        )}
      </View>

      <ScrollView className="noti-scroll" scrollY>
        {/* 通知设置 */}
        <View className="section-card">
          <View className="section-header">
            <View className="section-dot" />
            <Text className="section-title">通知设置</Text>
          </View>
          <View className="settings-list">
            {settings.map((setting, idx) => {
              const Icon = setting.icon
              return (
                <View key={idx} className="setting-row">
                  <View className="setting-left">
                    <View className="setting-icon-wrap" style={{ backgroundColor: `${setting.color}12` }}>
                      <Icon size={18} color={setting.color} />
                    </View>
                    <View className="setting-info">
                      <Text className="setting-title">{setting.title}</Text>
                      <Text className="setting-desc">{setting.desc}</Text>
                    </View>
                  </View>
                  <Switch
                    checked={setting.enabled}
                    onCheckedChange={(checked) => toggleSetting(setting.key, checked)}
                  />
                </View>
              )
            })}
          </View>
        </View>

        {/* 通知列表 */}
        <View className="section-card">
          <View className="section-header">
            <View className="section-dot" />
            <Text className="section-title">最近通知</Text>
          </View>

          {loading ? (
            <View className="empty-state">
              <View className="loading-spinner" />
              <Text className="empty-text">加载中...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View className="empty-state">
              <Bell size={40} color="#d1d5db" />
              <Text className="empty-text">暂无通知</Text>
            </View>
          ) : (
            <View className="noti-list">
              {notifications.map((notification, idx) => {
                const normalizedType = notification.type?.startsWith('order_') ? 'system' : notification.type
                const Icon = typeIconMap[normalizedType] || Bell
                const color = typeColorMap[normalizedType] || '#7B3FE4'
                return (
                  <View
                    key={idx}
                    className={`noti-item ${notification.is_read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <View className="noti-icon-wrap" style={{ backgroundColor: `${color}12` }}>
                      <Icon size={18} color={color} />
                    </View>
                    <View className="noti-content">
                      <View className="noti-top-row">
                        <Text className="noti-title">{notification.title}</Text>
                        <Text className="noti-time">{formatTime(notification.created_at)}</Text>
                      </View>
                      <Text className="noti-text">{notification.content}</Text>
                    </View>
                    {!notification.is_read && <View className="unread-dot" />}
                  </View>
                )
              })}
            </View>
          )}
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
