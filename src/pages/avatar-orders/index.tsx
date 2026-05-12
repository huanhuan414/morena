import { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import * as Network from '@/network'
import { ChevronLeft, FileText, Sparkles, CircleCheck, CircleAlert, CircleX, Clock, Upload, Eye, ChevronRight, ListFilter, Hourglass, ShoppingBag, TrendingUp } from 'lucide-react-taro'
import './index.css'

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, {
  label: string
  shortLabel: string
  color: string
  bgColor: string
  icon: any
  description: string
}> = {
  accepted: {
    label: '制作中',
    shortLabel: '制作',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    icon: FileText,
    description: '正在创建内容'
  },
  generating: {
    label: '生成中',
    shortLabel: '生成',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    icon: Sparkles,
    description: 'AI正在生成内容'
  },
  preview: {
    label: '预览中',
    shortLabel: '预览',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: Eye,
    description: '等待确认内容'
  },
  publishing: {
    label: '发布中',
    shortLabel: '发布',
    color: '#06b6d4',
    bgColor: '#cffafe',
    icon: Upload,
    description: '正在发布到平台'
  },
  published: {
    label: '待反馈',
    shortLabel: '反馈',
    color: '#f97316',
    bgColor: '#ffedd5',
    icon: CircleAlert,
    description: '需上传截图和链接'
  },
  awaiting_acceptance: {
    label: '等待验收',
    shortLabel: '验收',
    color: '#ec4899',
    bgColor: '#fce7f3',
    icon: Hourglass,
    description: '等待发单者验收'
  },
  completed: {
    label: '已完成',
    shortLabel: '完成',
    color: '#10b981',
    bgColor: '#d1fae5',
    icon: CircleCheck,
    description: '订单已验收完成'
  },
  cancelled: {
    label: '已取消',
    shortLabel: '取消',
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: CircleX,
    description: '订单已取消'
  }
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
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('all')

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
      const [avatarRes, ordersRes] = await Promise.all([
        Network.request({ url: `/api/avatar/${avatarId}` }),
        Network.request({ url: `/api/order-dispatch/avatar/${avatarId}/accepted-orders` })
      ])

      if (avatarRes.data?.code === 200) {
        setAvatarInfo(avatarRes.data.data)
      }

      if (ordersRes.data?.code === 200) {
        setAllOrders(ordersRes.data.data || [])
      }

      const pendingRes = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })

      if (pendingRes.data?.code === 200) {
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

  const handleOrderClick = (order: any) => {
    const processingQuery = [
      `orderId=${encodeURIComponent(order.order_id || '')}`,
      order.avatar_id ? `avatarId=${encodeURIComponent(order.avatar_id)}` : '',
      order.id ? `requestId=${encodeURIComponent(order.id)}` : '',
    ].filter(Boolean).join('&')

    switch (order.status) {
      case 'pending':
        handleViewPendingOrder(order)
        break
      case 'accepted':
      case 'generating':
      case 'preview':
      case 'publishing':
      case 'published':
        // 统一回到处理桥，避免形成第二套处理链
        navigateTo({
          url: `/pages/order/order-processing/index?${processingQuery}`
        })
        break
      case 'awaiting_acceptance':
        // 待验收统一回处理桥，避免形成独立验收旁路
        navigateTo({
          url: `/pages/order/order-processing/index?${processingQuery}`
        })
        break
      case 'cancelled':
        // 已取消的订单跳转到订单详情页面
        navigateTo({
          url: `/pages/order/order-detail/index?orderId=${order.order_id}`
        })
        break
      case 'completed':
        // 已完成的订单跳转到商单完成页面
        navigateTo({
          url: `/pages/order-completed/index?requestId=${order.id}&orderId=${order.order_id}`
        })
        break
      default:
        // 其他状态默认回处理桥
        navigateTo({
          url: `/pages/order/order-processing/index?${processingQuery}`
        })
    }
  }

  const toggleExpand = (status: string) => {
    setActiveTab(activeTab === status ? 'all' : status)
  }

  const ordersByStatus = allOrders.reduce((acc, order) => {
    if (!acc[order.status]) {
      acc[order.status] = []
    }
    acc[order.status].push(order)
    return acc
  }, {} as Record<string, any[]>)

  const displayedOrders = activeTab === 'all'
    ? [...allOrders].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    : ordersByStatus[activeTab] || []

  const totalStats = {
    all: allOrders.length,
    accepted: ordersByStatus.accepted?.length || 0,
    generating: ordersByStatus.generating?.length || 0,
    preview: ordersByStatus.preview?.length || 0,
    publishing: ordersByStatus.publishing?.length || 0,
    published: ordersByStatus.published?.length || 0,
    awaiting_acceptance: ordersByStatus.awaiting_acceptance?.length || 0,
    completed: ordersByStatus.completed?.length || 0,
    cancelled: ordersByStatus.cancelled?.length || 0
  }

  if (loading) {
    return (
      <View className="avatar-orders-page">
        <View className="nav-header">
          <View className="nav-back" onClick={() => navigateBack()}>
            <ChevronLeft size={20} color="#1e293b" />
          </View>
          <Text className="nav-title">商单管理</Text>
          <View className="nav-spacer" />
        </View>
        <View className="loading-container">
          <Clock size={32} color="#8b5cf6" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="avatar-orders-page">
      {/* 顶部导航栏 */}
      <View className="nav-header">
        <View className="nav-back" onClick={() => navigateBack()}>
          <View className="nav-back-icon">
            <ChevronLeft size={20} color="#1e293b" />
          </View>
        </View>
        <Text className="nav-title">{avatarInfo?.name || '商单管理'}</Text>
        <View className="nav-actions">
          <View className="nav-action-btn">
            <ListFilter size={18} color="#64748b" />
          </View>
        </View>
      </View>

      {/* 数据概览卡片 */}
      <View className="overview-card">
        <View className="overview-item">
          <View className="overview-icon total">
            <ShoppingBag size={24} color="#8b5cf6" />
          </View>
          <View className="overview-content">
            <Text className="overview-value">{totalStats.all}</Text>
            <Text className="overview-label">总订单</Text>
          </View>
        </View>
        <View className="overview-divider" />
        <View className="overview-item">
          <View className="overview-icon pending">
            <TrendingUp size={24} color="#f59e0b" />
          </View>
          <View className="overview-content">
            <Text className="overview-value">{pendingOrders.length}</Text>
            <Text className="overview-label">待接单</Text>
          </View>
        </View>
        <View className="overview-divider" />
        <View className="overview-item">
          <View className="overview-icon active">
            <Clock size={24} color="#3b82f6" />
          </View>
          <View className="overview-content">
            <Text className="overview-value">{totalStats.accepted + totalStats.generating + totalStats.preview}</Text>
            <Text className="overview-label">进行中</Text>
          </View>
        </View>
      </View>

      {/* 状态Tab栏 */}
      <ScrollView scrollX className="tabs-scroll">
        <View className="tabs-container">
          <View 
            className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Text className="tab-text">全部</Text>
            <View className={`tab-badge ${activeTab === 'all' ? 'active' : ''}`}>
              <Text className="tab-badge-text">{totalStats.all}</Text>
            </View>
          </View>
          {Object.entries(ORDER_STATUS_CONFIG).map(([status, config]) => (
            <View
              key={status}
              className={`tab-item ${activeTab === status ? 'active' : ''}`}
              onClick={() => toggleExpand(status)}
            >
              <Text className="tab-text">{config.label}</Text>
              {totalStats[status as keyof typeof totalStats] > 0 && (
                <View className={`tab-badge ${activeTab === status ? 'active' : ''}`} style={{ backgroundColor: config.bgColor, color: config.color }}>
                  <Text className="tab-badge-text">{totalStats[status as keyof typeof totalStats]}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 订单列表 */}
      <ScrollView scrollY className="orders-scroll">
        {displayedOrders.length > 0 ? (
          <View className="orders-list">
            {displayedOrders.map((order) => {
              const config = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.accepted
              const StatusIcon = config.icon

              return (
                <View
                  key={order.id}
                  className="order-item"
                  onClick={() => handleOrderClick(order)}
                >
                  <View className="order-header">
                    <Text className="order-title">{order.orders?.title || '未知订单'}</Text>
                    <View className="order-status" style={{ backgroundColor: config.bgColor, color: config.color }}>
                      <StatusIcon size={14} color={config.color} />
                      <Text className="status-label">{config.shortLabel}</Text>
                    </View>
                  </View>

                  <View className="order-info">
                    <View className="info-tag">
                      <Text className="info-tag-label">预算</Text>
                      <Text className="info-tag-value">¥{order.orders?.budget || 0}</Text>
                    </View>
                    {order.orders?.platforms && order.orders.platforms.length > 0 && (
                      <View className="info-tag">
                        <Text className="info-tag-label">平台</Text>
                        <Text className="info-tag-value">
                          {order.orders.platforms.slice(0, 2).map((p: string) => PLATFORM_NAMES[p] || p).join('、')}
                          {order.orders.platforms.length > 2 && `等${order.orders.platforms.length}个`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="order-footer">
                    <Text className="order-time">
                      {new Date(order.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <ChevronRight size={16} color="#94a3b8" />
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className="empty-state">
            <View className="empty-icon">
              <Clock size={48} color="#cbd5e1" />
            </View>
            <Text className="empty-title">暂无订单</Text>
            <Text className="empty-desc">{activeTab === 'all' ? '还没有订单数据' : `${ORDER_STATUS_CONFIG[activeTab]?.label || '该状态'}暂无订单`}</Text>
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
