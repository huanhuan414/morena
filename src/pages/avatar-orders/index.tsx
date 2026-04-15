import { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import * as Network from '@/network'
import { Bell, Check, Clock, ChevronRight, ArrowLeft, Loader } from 'lucide-react-taro'
import './index.css'

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: '待接单', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  pending_review: { label: '待验收', color: '#8b5cf6' },
  completed: { label: '已完成', color: '#22c55e' },
  cancelled: { label: '已取消', color: '#ef4444' }
}

export default function AvatarOrdersPage() {
  const router = useRouter()
  const avatarId = router.params.avatarId

  const [avatarInfo, setAvatarInfo] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [ordersInProgress, setOrdersInProgress] = useState<any[]>([])
  const [ordersCompleted, setOrdersCompleted] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    if (avatarId) {
      fetchAvatarData()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchAvatarData = async () => {
    setLoading(true)
    try {
      // 并行获取分身信息、通知和订单
      const [avatarRes, notificationsRes, ordersRes] = await Promise.all([
        Network.request({ url: `/api/avatar/${avatarId}` }),
        Network.request({ url: `/api/order-dispatch/avatar/${avatarId}/notifications` }),
        Network.request({ url: `/api/order-dispatch/avatar/${avatarId}/accepted-orders` })
      ])

      if (avatarRes.data?.code === 200) {
        setAvatarInfo(avatarRes.data.data)
      }

      if (notificationsRes.data?.code === 200) {
        setNotifications(notificationsRes.data.data || [])
      }

      if (ordersRes.data?.code === 200) {
        const orders = ordersRes.data.data || []
        const inProgress = orders.filter((o: any) => o.orders?.status === 'in_progress' || o.orders?.status === 'pending_review')
        const completed = orders.filter((o: any) => o.orders?.status === 'completed')
        setOrdersInProgress(inProgress)
        setOrdersCompleted(completed)
      }
    } catch (error) {
      console.error('获取分身数据失败:', error)
      showToast({ title: '获取数据失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className="avatar-orders-page">
        <View className="page-header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
          </View>
          <Text className="header-title">商单管理</Text>
          <View className="header-right" />
        </View>
        <View className="loading-container">
          <Loader size={32} color="#00f5ff" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="avatar-orders-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title">商单管理</Text>
        <View className="header-right" />
      </View>

      {/* 分身信息卡片 */}
      <View className="avatar-info-card">
        <View className="avatar-info-header">
          <Text className="avatar-name">{avatarInfo?.name || '未知分身'}</Text>
          <View className="avatar-level-badge">
            <Text className="level-text">LV.{avatarInfo?.level || 1}</Text>
          </View>
        </View>
        <Text className="avatar-personality">
          {avatarInfo?.personality || '暂无个性描述'}
        </Text>
      </View>

      <ScrollView scrollY className="scroll-container">
        {/* 通知区块 */}
        <View className="section-block">
          <View className="section-header">
            <Bell size={18} color="#00f5ff" />
            <Text className="section-title">通知</Text>
            <View className="section-badge">
              <Text className="section-badge-text">{notifications.length}</Text>
            </View>
          </View>

          {notifications.length > 0 ? (
            <View className="notifications-list">
              {notifications.map((notification) => (
                <View key={notification.id} className="notification-item">
                  <Text className="notification-content">{notification.content}</Text>
                  <Text className="notification-time">
                    {new Date(notification.created_at).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="empty-state">
              <Bell size={32} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">暂无通知</Text>
            </View>
          )}
        </View>

        {/* 进行中订单 */}
        <View className="section-block">
          <View className="section-header">
            <Clock size={18} color="#3b82f6" />
            <Text className="section-title">进行中</Text>
            <View className="section-badge blue">
              <Text className="section-badge-text">{ordersInProgress.length}</Text>
            </View>
          </View>

          {ordersInProgress.length > 0 ? (
            <View className="orders-list">
              {ordersInProgress.map((item) => (
                <View
                  key={item.order_id}
                  className="order-item"
                  onClick={() => navigateTo({ url: `/pages/order-detail/index?id=${item.order_id}` })}
                >
                  <View className="order-main">
                    <Text className="order-title">{item.orders?.title || '未知订单'}</Text>
                    <View className="order-meta">
                      <Text className="order-budget">¥{item.orders?.budget || 0}</Text>
                      <View
                        className="order-status"
                        style={{ color: ORDER_STATUS_CONFIG[item.orders?.status]?.color || '#666' }}
                      >
                        <Text className="order-status-text">
                          {ORDER_STATUS_CONFIG[item.orders?.status]?.label || '未知状态'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
                </View>
              ))}
            </View>
          ) : (
            <View className="empty-state">
              <Clock size={32} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">暂无进行中订单</Text>
            </View>
          )}
        </View>

        {/* 已完成订单 */}
        <View className="section-block">
          <View className="section-header">
            <Check size={18} color="#22c55e" />
            <Text className="section-title">已完成</Text>
            <View className="section-badge green">
              <Text className="section-badge-text">{ordersCompleted.length}</Text>
            </View>
          </View>

          {ordersCompleted.length > 0 ? (
            <View className="orders-list">
              {ordersCompleted.map((item) => (
                <View
                  key={item.order_id}
                  className="order-item"
                  onClick={() => navigateTo({ url: `/pages/order-detail/index?id=${item.order_id}` })}
                >
                  <View className="order-main">
                    <Text className="order-title">{item.orders?.title || '未知订单'}</Text>
                    <View className="order-meta">
                      <Text className="order-budget">¥{item.orders?.budget || 0}</Text>
                      <View
                        className="order-status"
                        style={{ color: ORDER_STATUS_CONFIG[item.orders?.status]?.color || '#666' }}
                      >
                        <Text className="order-status-text">
                          {ORDER_STATUS_CONFIG[item.orders?.status]?.label || '已完成'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
                </View>
              ))}
            </View>
          ) : (
            <View className="empty-state">
              <Check size={32} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">暂无已完成订单</Text>
            </View>
          )}
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
