import { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { Bell, Check, Clock, ChevronRight, ArrowLeft, Loader, Sparkles } from 'lucide-react-taro'
import './index.css'

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: '待接单', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  pending_review: { label: '待验收', color: '#8b5cf6' },
  completed: { label: '已完成', color: '#22c55e' },
  cancelled: { label: '已取消', color: '#ef4444' }
}

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_moments: '微信朋友圈',
  wechat_video: '微信视频号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

export default function AvatarOrdersPage() {
  const router = useRouter()
  const avatarId = router.params.avatarId

  const [avatarInfo, setAvatarInfo] = useState<any>(null)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
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
      // 并行获取分身信息和订单
      const [avatarRes, ordersRes] = await Promise.all([
        Network.request({ url: `/api/avatar/${avatarId}` }),
        Network.request({ url: `/api/order-dispatch/avatar/${avatarId}/accepted-orders` })
      ])

      if (avatarRes.data?.code === 200) {
        setAvatarInfo(avatarRes.data.data)
      }

      if (ordersRes.data?.code === 200) {
        const orders = ordersRes.data.data || []
        const inProgress = orders.filter((o: any) =>
          o.status === 'accepted' ||
          o.status === 'generating' ||
          o.status === 'preview'
        )
        const completed = orders.filter((o: any) =>
          o.status === 'completed' ||
          o.status === 'published'
        )
        setOrdersInProgress(inProgress)
        setOrdersCompleted(completed)
      }

      // 获取待接单订单
      const pendingRes = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })

      if (pendingRes.data?.code === 200) {
        // 过滤出当前分身的待接单订单
        const currentAvatarPending = (pendingRes.data.data || []).filter((req: any) =>
          req.avatars?.id === avatarId
        )
        setPendingOrders(currentAvatarPending)
      }
    } catch (error) {
      console.error('获取分身数据失败:', error)
      showToast({ title: '获取数据失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleViewPendingOrder = (request: any) => {
    navigateTo({
      url: `/pages/pending-order/index?requestId=${request.id}`
    })
  }

  if (loading) {
    return (
      <View className="avatar-orders-page">
        <View className="page-header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="rgba(255,255,255,0.9)" />
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
        {/* 待接单订单区块（通知） */}
        <View className="section-block">
          <View className="section-header">
            <Bell size={18} color="#00f5ff" />
            <Text className="section-title">待接单</Text>
            <View className="section-badge">
              <Text className="section-badge-text">{pendingOrders.length}</Text>
            </View>
          </View>

          {pendingOrders.length > 0 ? (
            <View className="pending-orders-list">
              {pendingOrders.map((request) => (
                <View key={request.id} className="pending-order-card">
                  <View className="request-avatar-section">
                    <View className="request-avatar">
                      {request.avatars?.avatar_url ? (
                        <Image src={request.avatars.avatar_url} className="request-avatar-img" mode="aspectFill" />
                      ) : (
                        <View className="request-avatar-placeholder">
                          <Sparkles size={24} color="#00f5ff" />
                        </View>
                      )}
                    </View>
                    <View className="request-info">
                      <Text className="request-avatar-name">{request.avatars?.name || '未知分身'}</Text>
                      <Text className="request-order-title">{request.orders?.title || '未知订单'}</Text>
                    </View>
                  </View>

                  <View className="request-budget">
                    <Text className="budget-label">预算</Text>
                    <Text className="budget-value">¥{request.orders?.budget || 0}</Text>
                  </View>

                  <View className="request-budget">
                    <Text className="budget-label">预估收益</Text>
                    <Text className="budget-value">
                      ¥{(request.orders as any)?.expected_quantity
                        ? Math.floor(request.orders.budget / (request.orders as any).expected_quantity)
                        : Math.floor((request.orders?.budget || 0) * 0.8)}
                    </Text>
                  </View>

                  <View className="request-meta">
                    <Text className="meta-item">📱 {request.orders?.platforms?.map((p: string) => PLATFORM_NAMES[p] || p).join('、') || '全平台'}</Text>
                    <Text className="meta-item">📅 {request.orders?.deadline ? new Date(request.orders.deadline).toLocaleDateString() : '不限'}</Text>
                  </View>

                  <Button
                    className="view-request-btn"
                    onClick={() => handleViewPendingOrder(request)}
                  >
                    <Text className="view-request-text">查看详情并确认</Text>
                    <ChevronRight size={16} color="#00f5ff" />
                  </Button>
                </View>
              ))}
            </View>
          ) : (
            <View className="empty-state">
              <Bell size={32} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">暂无待接单订单</Text>
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
                  onClick={() => navigateTo({
                    url: `/pages/order-content-creation/index?requestId=${item.id}&avatarId=${item.avatar_id}&orderId=${item.order_id}`
                  })}
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
