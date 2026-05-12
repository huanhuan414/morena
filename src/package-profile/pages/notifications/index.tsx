import Taro, { useDidShow, navigateBack, showToast, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Switch } from '@/components/ui/switch'
import * as Network from '@/network'
import { Bell, MessageCircle, Heart, UserPlus, Info } from 'lucide-react-taro'
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
  type: 'message' | 'like' | 'follow' | 'system'
  title: string
  content: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    { key: 'message', title: '私信通知', desc: '收到新消息时提醒', enabled: true, icon: MessageCircle, color: '#00f5ff' },
    { key: 'like', title: '点赞通知', desc: '有人点赞时提醒', enabled: true, icon: Heart, color: '#ff6b6b' },
    { key: 'follow', title: '关注通知', desc: '有新粉丝时提醒', enabled: true, icon: UserPlus, color: '#bf00ff' },
    { key: 'system', title: '系统通知', desc: '重要系统消息', enabled: true, icon: Info, color: '#ffaa00' }
  ])
  
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
  })

  useDidShow(() => {
    fetchNotifications()
  })

  const fetchNotifications = async () => {
    try {
      const res = await Network.request({ url: '/api/notifications' })
      if (res.data?.code === 200) {
        setNotifications(res.data.data || [])
      }
    } catch (error) {
      console.error('获取通知失败:', error)
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return MessageCircle
      case 'like': return Heart
      case 'follow': return UserPlus
      default: return Info
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message': return '#00f5ff'
      case 'like': return '#ff6b6b'
      case 'follow': return '#bf00ff'
      default: return '#ffaa00'
    }
  }

  return (
    <View className="notifications-page">
      {/* 顶部导航 */}
      <View className="notifications-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">消息通知</Text>
        <View className="header-action" style={{ width: `${capsuleWidth}rpx` }} onClick={markAllAsRead}>
          <Text className="action-text">全部已读</Text>
        </View>
      </View>

      <ScrollView className="notifications-scroll" scrollY>
        {/* 通知设置 */}
        <View className="settings-section">
          <Text className="section-title">通知设置</Text>
          
          {settings.map((setting, idx) => {
            const Icon = setting.icon
            return (
              <View key={idx} className="setting-item">
                <View className="setting-left">
                  <View className="setting-icon" style={{ background: `${setting.color}20` }}>
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

        {/* 通知列表 */}
        <View className="notifications-section">
          <Text className="section-title">最近通知</Text>
          
          {notifications.length === 0 ? (
            <View className="empty-state">
              <Bell size={48} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">暂无通知</Text>
            </View>
          ) : (
            notifications.map((notification, idx) => {
              const Icon = getNotificationIcon(notification.type)
              const color = getNotificationColor(notification.type)
              return (
                <View 
                  key={idx}
                  className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <View className="notification-icon" style={{ background: `${color}20` }}>
                    <Icon size={18} color={color} />
                  </View>
                  <View className="notification-content">
                    <Text className="notification-title">{notification.title}</Text>
                    <Text className="notification-text">{notification.content}</Text>
                    <Text className="notification-time">{notification.created_at}</Text>
                  </View>
                  {!notification.is_read && <View className="unread-dot" />}
                </View>
              )
            })
          )}
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
