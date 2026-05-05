import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { Star, Users, Clock, Loader } from 'lucide-react-taro'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  description?: string
  skills?: string[]
  completed_orders: number
  total_earnings: number
  rating: number
}

interface AvatarOrder {
  id: string
  order_id: string
  order_title: string
  status: string
  statusText: string
  platforms: string[]
  content_type: string
  earnings: number
  created_at: string
  submitted_at?: string
}

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  wechat_moments: '朋友圈',
  wechat_public: '公众号',
  wechat_mp: '微信公众号'
}

const AVATAR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '待接受', color: '#f59e0b' },
  accepted: { label: '制作中', color: '#3b82f6' },
  generating: { label: '生成中', color: '#8b5cf6' },
  preview: { label: '预览中', color: '#06b6d4' },
  published: { label: '待反馈', color: '#22c55e' }, // 需要上传反馈截图和链接
  awaiting_acceptance: { label: '待验收', color: '#a855f7' },
  completed: { label: '已完成', color: '#10b981' },
  rejected: { label: '已拒绝', color: '#ef4444' },
  cancelled: { label: '已取消', color: '#6b7280' }
}

export default function AvatarDetailPage() {
  const router = useRouter()
  const { id } = router.params

  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [orders, setOrders] = useState<AvatarOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadAvatarDetail()
      loadAvatarOrders()
    }
  }, [id])

  const loadAvatarDetail = async () => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${id}`
      })
      if (res.data.code === 200) {
        setAvatar(res.data.data)
      }
    } catch (err) {
      console.error('加载分身详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAvatarOrders = async () => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${id}/orders`
      })
      if (res.data.code === 200) {
        setOrders(res.data.data || [])
      }
    } catch (err) {
      console.error('加载订单列表失败:', err)
    }
  }

  // 根据订单状态跳转到不同页面（分身视角）
  const handleOrderClick = (order: AvatarOrder) => {
    if (order.status === 'pending') {
      // 待接受 → 查看订单详情，决定是否接受
      Taro.navigateTo({ url: `/pages/order/order-detail/index?id=${order.order_id}` })
    } else if (['accepted', 'generating', 'preview'].includes(order.status)) {
      // 制作中/预览中 → 内容创作页面
      Taro.navigateTo({ url: `/pages/order/order-content-creation/index?requestId=${order.id}&orderId=${order.order_id}` })
    } else if (order.status === 'published') {
      // 待反馈 → 发布反馈页面
      Taro.navigateTo({ url: `/pages/order/order-publish-feedback/index?requestId=${order.id}&orderId=${order.order_id}` })
    } else if (['awaiting_acceptance', 'completed'].includes(order.status)) {
      // 待验收/已完成 → 查看发布成果
      Taro.navigateTo({ url: `/pages/order/order-result/index?requestId=${order.id}&orderId=${order.order_id}` })
    } else {
      // 其他状态 → 查看订单详情
      Taro.navigateTo({ url: `/pages/order/order-detail/index?id=${order.order_id}` })
    }
  }

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    return AVATAR_STATUS_CONFIG[status] || { label: status, color: '#999' }
  }

  if (loading) {
    return (
      <View className="detail-container">
        <View className="loading-state">
          <Loader size={32} color="#667eea" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!avatar) {
    return (
      <View className="detail-container">
        <View className="error-state">
          <Text className="error-text">分身不存在</Text>
        </View>
      </View>
    )
  }

  // 统计各状态订单数量
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <View className="detail-container">
      {/* 顶部导航 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={() => Taro.navigateBack()}>
          <Text className="nav-back-text">←</Text>
        </View>
        <Text className="nav-title">分身详情</Text>
        <View className="nav-right" />
      </View>

      <ScrollView scrollY className="content-scroll">
        {/* 分身基本信息 */}
        <View className="avatar-header">
          <Image 
            src={avatar.avatar_url || 'https://via.placeholder.com/200'} 
            className="avatar-avatar" 
          />
          <View className="avatar-info">
            <View className="avatar-name-row">
              <Text className="avatar-name">{avatar.name}</Text>
              <View className="avatar-level">
                <Star size={14} color="#eab308" />
                <Text className="level-text">Lv.{avatar.level}</Text>
              </View>
            </View>
            {avatar.description && (
              <Text className="avatar-desc">{avatar.description}</Text>
            )}
          </View>
        </View>

        {/* 数据统计 */}
        <View className="stats-card">
          <View className="stat-item">
            <Text className="stat-value">{avatar.completed_orders}</Text>
            <Text className="stat-label">已完成</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Text className="stat-value">¥{avatar.total_earnings}</Text>
            <Text className="stat-label">总收益</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Text className="stat-value">{avatar.rating}</Text>
            <Text className="stat-label">评分</Text>
          </View>
        </View>

        {/* 执行状态统计 - 不放在执行进度里 */}
        <View className="status-overview-card">
          <Text className="section-title">执行状态</Text>
          <View className="status-summary">
            {Object.entries(statusCounts).map(([status, count]) => {
              const config = getStatusConfig(status)
              return (
                <View key={status} className="status-summary-item">
                  <View className="status-dot" style={{ backgroundColor: config.color }} />
                  <Text className="status-count">{count}</Text>
                  <Text className="status-name">{config.label}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 订单列表 */}
        <View className="orders-section">
          <Text className="section-title">接单列表</Text>
          {orders.length === 0 ? (
            <View className="empty-state">
              <Users size={48} color="#ccc" />
              <Text className="empty-text">暂无接单</Text>
            </View>
          ) : (
            <View className="order-list">
              {orders.map(order => {
                const statusConfig = getStatusConfig(order.status)
                return (
                  <View 
                    key={order.id} 
                    className="order-card"
                    onClick={() => handleOrderClick(order)}
                  >
                    <View className="order-header">
                      <Text className="order-title">{order.order_title}</Text>
                      <View className="order-status" style={{ backgroundColor: statusConfig.color }}>
                        <Text className="order-status-text">{statusConfig.label}</Text>
                      </View>
                    </View>
                    <View className="order-info">
                      <View className="order-platforms">
                        {order.platforms?.map(p => (
                          <View key={p} className="platform-tag">
                            <Text className="platform-text">{PLATFORM_NAMES[p] || p}</Text>
                          </View>
                        ))}
                      </View>
                      <Text className="order-earnings">¥{order.earnings}</Text>
                    </View>
                    <View className="order-time">
                      <Clock size={12} color="#999" />
                      <Text className="time-text">{new Date(order.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
