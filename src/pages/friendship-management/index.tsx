import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { request as networkRequest } from '@/network'
import { User, Clock, MessageSquare, Heart, TrendingUp } from 'lucide-react-taro'
import { Avatar } from '@/components/ui/avatar'
import './index.css'

// 定义类型
interface Notification {
  id: string
  user_id: string
  avatar_id: string
  notification_type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
}

interface FriendRequest {
  id: string
  avatar_id: string
  friend_avatar_id: string
  match_reason: string
  compatibility_score: number
  from_avatar?: {
    id: string
    name: string
    avatar_url: string
  }
  to_avatar?: {
    id: string
    name: string
    avatar_url: string
  }
  // 为了兼容数据库返回的字段名
  from_avatar_name?: string
  from_avatar_avatar_url?: string
  to_avatar_name?: string
  to_avatar_avatar_url?: string
}

export default function FriendshipManagement() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const [stats, setStats] = useState({
    friends_count: 0,
    pending_requests: 0,
    following_count: 0,
    followers_count: 0
  })
  const [loading, setLoading] = useState(true)

  // 获取用户ID
  const getUserId = () => {
    const userId = Taro.getStorageSync('userId')
    return userId || ''
  }

  // 获取通知列表
  const fetchNotifications = async () => {
    try {
      const userId = getUserId()
      const res = await networkRequest({
        url: '/api/avatar/notifications',
        method: 'GET',
        data: { user_id: userId }
      })

      if (res.data && res.data.data) {
        setNotifications(res.data.data)
      }
    } catch (error) {
      console.error('获取通知失败:', error)
    }
  }

  // 获取好友请求（同时获取收到的和发出的）
  const fetchFriendRequests = async () => {
    try {
      const userId = getUserId()
      const res = await networkRequest({
        url: '/api/avatar/friend-requests',
        method: 'GET',
        data: { user_id: userId }
      })

      if (res.data && res.data.data) {
        setReceivedRequests(res.data.data.received || [])
        setSentRequests(res.data.data.sent || [])
        // 更新待处理数量 = 收到的 + 发出的
        const total = (res.data.data.received?.length || 0) + (res.data.data.sent?.length || 0)
        setStats(prev => ({ ...prev, pending_requests: total }))
      }
    } catch (error) {
      console.error('获取好友请求失败:', error)
    }
  }

  // 获取交友统计
  const fetchStats = async () => {
    try {
      const userId = getUserId()
      // 先获取用户的分身
      const avatarRes = await networkRequest({
        url: '/api/avatar/my-avatars',
        method: 'GET',
        data: { user_id: userId }
      })

      if (avatarRes.data && avatarRes.data.data && avatarRes.data.data.length > 0) {
        const avatarId = avatarRes.data.data[0].id
        const statsRes = await networkRequest({
          url: `/api/avatar/${avatarId}/friendship-stats`,
          method: 'GET'
        })

        if (statsRes.data && statsRes.data.data) {
          setStats(statsRes.data.data)
        }
      }
    } catch (error) {
      console.error('获取交友统计失败:', error)
    }
  }

  // 接受好友请求（收到的请求）
  const acceptFriendRequest = async (friendRequestId) => {
    try {
      await networkRequest({
        url: `/api/avatar/friend-requests/${friendRequestId}/accept`,
        method: 'POST'
      })

      Taro.showToast({ title: '已接受好友请求', icon: 'success' })
      fetchFriendRequests()
      fetchStats()
    } catch (error) {
      console.error('接受好友请求失败:', error)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  // 撤回发出的好友请求
  const cancelFriendRequest = async (friendRequestId) => {
    try {
      await networkRequest({
        url: `/api/avatar/friend-requests/${friendRequestId}`,
        method: 'DELETE'
      })

      Taro.showToast({ title: '已撤回请求', icon: 'success' })
      fetchFriendRequests()
      fetchStats()
    } catch (error) {
      console.error('撤回好友请求失败:', error)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  // 标记通知为已读
  const markNotificationAsRead = async (notificationId) => {
    try {
      await networkRequest({
        url: `/api/avatar/notifications/${notificationId}/read`,
        method: 'POST'
      })

      // 刷新列表
      fetchNotifications()
    } catch (error) {
      console.error('标记通知失败:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchNotifications(),
        fetchFriendRequests(),
        fetchStats()
      ])
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <View className="friendship-management-page">
        <View className="loading-container">
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="friendship-management-page">
      {/* 统计卡片 */}
      <View className="stats-section">
        <View className="stats-card">
          <View className="stat-item">
            <User size={24} color="#1890ff" />
            <View className="stat-info">
              <Text className="stat-value">{stats.friends_count}</Text>
              <Text className="stat-label">好友</Text>
            </View>
          </View>
          <View className="stat-item">
            <MessageSquare size={24} color="#52c41a" />
            <View className="stat-info">
              <Text className="stat-value">{stats.pending_requests}</Text>
              <Text className="stat-label">待处理</Text>
            </View>
          </View>
          <View className="stat-item">
            <Heart size={24} color="#ff4d4f" />
            <View className="stat-info">
              <Text className="stat-value">{stats.following_count}</Text>
              <Text className="stat-label">关注</Text>
            </View>
          </View>
          <View className="stat-item">
            <TrendingUp size={24} color="#faad14" />
            <View className="stat-info">
              <Text className="stat-value">{stats.followers_count}</Text>
              <Text className="stat-label">粉丝</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 好友请求列表 */}
      <View className="section">
        <View className="section-title">
          <Text>好友请求</Text>
          {stats.pending_requests > 0 && (
            <View className="badge">
              <Text>{stats.pending_requests}</Text>
            </View>
          )}
        </View>

        {/* 标签切换 */}
        <View className="request-tabs">
          <View
            className={`tab-item ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            <Text>收到的请求</Text>
            {receivedRequests.length > 0 && (
              <View className="tab-badge"><Text>{receivedRequests.length}</Text></View>
            )}
          </View>
          <View
            className={`tab-item ${activeTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            <Text>发出的请求</Text>
            {sentRequests.length > 0 && (
              <View className="tab-badge"><Text>{sentRequests.length}</Text></View>
            )}
          </View>
        </View>

        {/* 收到的请求 */}
        {activeTab === 'received' && (
          receivedRequests.length === 0 ? (
            <View className="empty-state">
              <Text>暂无收到的请求</Text>
            </View>
          ) : (
            <View className="friend-request-list">
              {receivedRequests.map((request) => (
                <View key={request.id} className="friend-request-item">
                  <View className="request-info">
                    <Avatar
                      src={request.from_avatar?.avatar_url || request.from_avatar_avatar_url}
                      name={request.from_avatar?.name || request.from_avatar_name}
                      size={100}
                      className="request-avatar"
                    />
                    <View className="request-details">
                      <Text className="request-name">{request.from_avatar?.name || request.from_avatar_name}</Text>
                      <Text className="request-reason">{request.match_reason}</Text>
                      <View className="compatibility-score">
                        <Text>匹配度: {request.compatibility_score?.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </View>
                  <View className="request-actions">
                    <View
                      className="action-button accept"
                      onClick={() => acceptFriendRequest(request.id)}
                    >
                      <Text>接受</Text>
                    </View>
                    <View className="action-button reject">
                      <Text>拒绝</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        )}

        {/* 发出的请求 */}
        {activeTab === 'sent' && (
          sentRequests.length === 0 ? (
            <View className="empty-state">
              <Text>暂无发出的请求</Text>
            </View>
          ) : (
            <View className="friend-request-list">
              {sentRequests.map((request) => (
                <View key={request.id} className="friend-request-item sent">
                  <View className="request-info">
                    <Avatar
                      src={request.to_avatar?.avatar_url || request.to_avatar_avatar_url}
                      name={request.to_avatar?.name || request.to_avatar_name}
                      size={100}
                      className="request-avatar"
                    />
                    <View className="request-details">
                      <Text className="request-name">{request.to_avatar?.name || request.to_avatar_name}</Text>
                      <Text className="request-reason">{request.match_reason}</Text>
                      <View className="compatibility-score">
                        <Text>匹配度: {request.compatibility_score?.toFixed(1)}%</Text>
                      </View>
                      <View className="sent-status">
                        <Text className="text-xs text-gray-400">等待对方确认</Text>
                      </View>
                    </View>
                  </View>
                  <View className="request-actions">
                    <View
                      className="action-button cancel"
                      onClick={() => cancelFriendRequest(request.id)}
                    >
                      <Text>撤回</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </View>

      {/* 通知列表 */}
      <View className="section">
        <View className="section-title">
          <Text>通知</Text>
        </View>
        {notifications.length === 0 ? (
          <View className="empty-state">
            <Text>暂无通知</Text>
          </View>
        ) : (
          <View className="notification-list">
            {notifications.map((notification) => (
              <View
                key={notification.id}
                className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                onClick={() => markNotificationAsRead(notification.id)}
              >
                <View className="notification-content">
                  <Text className="notification-title">{notification.title}</Text>
                  <Text className="notification-text">{notification.content}</Text>
                  <View className="notification-time">
                    <Clock size={14} color="#999" />
                    <Text>{new Date(notification.created_at).toLocaleString()}</Text>
                  </View>
                </View>
                {!notification.is_read && <View className="unread-dot" />}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
