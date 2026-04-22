import { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import * as Network from '@/network'
import { ChevronLeft, TrendingUp, Award, Star, FileText, Sparkles, CircleCheck, CircleAlert, CircleX, Clock, Upload, Eye, ChevronRight, ChevronDown, ListFilter, Hourglass } from 'lucide-react-taro'
import './index.css'

// 订单状态配置（高级设计风格）
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
    bgColor: 'rgba(59, 130, 246, 0.1)',
    icon: FileText,
    description: '正在创建内容'
  },
  generating: {
    label: '生成中',
    shortLabel: '生成',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    icon: Sparkles,
    description: 'AI正在生成内容'
  },
  preview: {
    label: '预览中',
    shortLabel: '预览',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    icon: Eye,
    description: '等待确认内容'
  },
  publishing: {
    label: '发布中',
    shortLabel: '发布',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.1)',
    icon: Upload,
    description: '正在发布到平台'
  },
  published: {
    label: '待反馈',
    shortLabel: '反馈',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    icon: CircleAlert,
    description: '需上传截图和链接'
  },
  awaiting_acceptance: {
    label: '等待验收',
    shortLabel: '验收',
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
    icon: Hourglass,
    description: '等待发单者验收'
  },
  completed: {
    label: '已完成',
    shortLabel: '完成',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    icon: CircleCheck,
    description: '订单已验收完成'
  },
  cancelled: {
    label: '已取消',
    shortLabel: '取消',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
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
  
  // 控制每个状态的展开/收起
  const [expandedStatus, setExpandedStatus] = useState<Record<string, boolean>>({})

  useLoad(() => {
    if (avatarId) {
      fetchAvatarData()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchAvatarData = async () => {
    console.log('[AvatarOrders] 开始获取分身数据, avatarId:', avatarId)
    setLoading(true)
    try {
      // 并行获取分身信息和订单
      const [avatarRes, ordersRes] = await Promise.all([
        Network.request({ url: `/api/avatar/${avatarId}` }),
        Network.request({ url: `/api/order-dispatch/avatar/${avatarId}/accepted-orders` })
      ])

      console.log('[AvatarOrders] 分身信息响应:', avatarRes.data)
      console.log('[AvatarOrders] 订单响应:', ordersRes.data)

      if (avatarRes.data?.code === 200) {
        setAvatarInfo(avatarRes.data.data)
        console.log('[AvatarOrders] 设置分身信息成功')
      } else {
        console.error('[AvatarOrders] 获取分身信息失败:', avatarRes.data?.message)
      }

      if (ordersRes.data?.code === 200) {
        const orders = ordersRes.data.data || []
        setAllOrders(orders)
        console.log('[AvatarOrders] 设置订单成功，订单数量:', orders.length)
      } else {
        console.error('[AvatarOrders] 获取订单失败:', ordersRes.data?.message)
      }

      // 获取待接单订单
      const pendingRes = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })

      console.log('[AvatarOrders] 待接单订单响应:', pendingRes.data)

      if (pendingRes.data?.code === 200) {
        const currentAvatarPending = (pendingRes.data.data || []).filter((req: any) =>
          req.avatars?.id === avatarId
        )
        setPendingOrders(currentAvatarPending)
        console.log('[AvatarOrders] 设置待接单订单成功，数量:', currentAvatarPending.length)
      } else {
        console.error('[AvatarOrders] 获取待接单订单失败:', pendingRes.data?.message)
      }

      console.log('[AvatarOrders] 数据加载完成')
    } catch (error) {
      console.error('[AvatarOrders] 获取分身数据失败:', error)
      showToast({ title: '获取数据失败', icon: 'none' })
    } finally {
      setLoading(false)
      console.log('[AvatarOrders] loading 状态设为 false')
    }
  }

  const handleViewPendingOrder = (request: any) => {
    navigateTo({
      url: `/pages/pending-order/index?requestId=${request.id}`
    })
  }

  const handleOrderClick = (order: any) => {
    switch (order.status) {
      case 'pending':
        handleViewPendingOrder(order)
        break
      case 'publishing':
      case 'awaiting_acceptance':
      case 'completed':
      case 'cancelled':
        navigateTo({
          url: `/pages/order-detail/index?id=${order.order_id}`
        })
        break
      case 'published':
        navigateTo({
          url: `/pages/order-publish-feedback/index?requestId=${order.id}&orderId=${order.order_id}`
        })
        break
      default:
        navigateTo({
          url: `/pages/order-content-creation/index?requestId=${order.id}&avatarId=${order.avatar_id}&orderId=${order.order_id}`
        })
    }
  }

  // 切换状态的展开/收起
  const toggleExpand = (status: string) => {
    setExpandedStatus(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  // 按状态分组
  const ordersByStatus = allOrders.reduce((acc, order) => {
    if (!acc[order.status]) {
      acc[order.status] = []
    }
    acc[order.status].push(order)
    return acc
  }, {} as Record<string, any[]>)

  if (loading) {
    return (
      <View className="avatar-orders-page">
        {/* 顶部导航栏 */}
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
      {/* 顶部导航栏 - 精美设计 */}
      <View className="nav-header">
        <View className="nav-back" onClick={() => navigateBack()}>
          <View className="nav-back-icon">
            <ChevronLeft size={20} color="#1e293b" />
          </View>
        </View>
        <Text className="nav-title">商单管理</Text>
        <View className="nav-actions">
          <View className="nav-action-btn">
            <ListFilter size={18} color="#64748b" />
          </View>
        </View>
      </View>

      {/* 分身信息卡片 - 简化版 */}
      <View className="avatar-info-card simple">
        <View className="avatar-info-content">
          <View className="avatar-name-row">
            <Text className="avatar-name">{avatarInfo?.name || '未知分身'}</Text>
            <View className="level-badge">
              <Star size={12} color="#fbbf24" />
              <Text className="level-text">LV.{avatarInfo?.level || 1}</Text>
            </View>
          </View>
          <Text className="avatar-personality">
            {avatarInfo?.personality || '暂无个性描述'}
          </Text>
        </View>
      </View>

      {/* 统计数据 - 横向滚动 */}
      <ScrollView scrollX className="stats-scroll">
        <View className="stats-row-simple">
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{allOrders.length}</Text>
            <Text className="stat-label-simple">总订单</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{pendingOrders.length}</Text>
            <Text className="stat-label-simple">待接单</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.accepted?.length || 0}</Text>
            <Text className="stat-label-simple">制作中</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.generating?.length || 0}</Text>
            <Text className="stat-label-simple">生成中</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.preview?.length || 0}</Text>
            <Text className="stat-label-simple">预览中</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.publishing?.length || 0}</Text>
            <Text className="stat-label-simple">发布中</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.published?.length || 0}</Text>
            <Text className="stat-label-simple">待反馈</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.awaiting_acceptance?.length || 0}</Text>
            <Text className="stat-label-simple">等待验收</Text>
          </View>
          <View className="stat-item-simple">
            <Text className="stat-value-simple">{ordersByStatus.completed?.length || 0}</Text>
            <Text className="stat-label-simple">已完成</Text>
          </View>
        </View>
      </ScrollView>

      {/* 调试信息 */}
      <View className="debug-section">
        <Text className="debug-title">数据调试</Text>
        <Text className="debug-item">总订单: {allOrders.length}</Text>
        <Text className="debug-item">待接单: {pendingOrders.length}</Text>
        <Text className="debug-item">分身ID: {avatarId}</Text>
        <Text className="debug-item">分身名: {avatarInfo?.name || '未知'}</Text>
        {allOrders.length > 0 && (
          <View className="debug-orders">
            <Text className="debug-item">订单状态分布:</Text>
            {Object.entries(ordersByStatus).map(([status, orders]: [string, any[]]) => (
              <Text key={status} className="debug-item">
                {status}: {orders.length}个
              </Text>
            ))}
          </View>
        )}
      </View>

      <ScrollView scrollY className="scroll-container" style={{ height: '100%' }}>
        {/* 待接单订单 - 高级卡片 */}
        {pendingOrders.length > 0 && (
          <View className="status-section">
            <View className="status-header alert">
              <TrendingUp size={20} color="#f59e0b" />
              <View className="status-title-row">
                <Text className="status-title">待接单</Text>
                <View className="status-count alert">
                  <Text className="count-text">{pendingOrders.length}</Text>
                </View>
              </View>
            </View>

            <View className="orders-grid">
              {pendingOrders.slice(0, 3).map((request) => (
                <View
                  key={request.id}
                  className="order-card alert"
                  onClick={() => handleViewPendingOrder(request)}
                >
                  <View className="order-card-header">
                    <View className="order-title-row">
                      <Text className="order-title">{request.orders?.title || '未知订单'}</Text>
                      <View className="order-status-badge alert">
                        <Clock size={12} color="#f59e0b" />
                        <Text className="badge-text">待接单</Text>
                      </View>
                    </View>
                  </View>

                  <View className="order-card-body">
                    <View className="info-row">
                      <Text className="info-label">预算</Text>
                      <Text className="info-value">¥{request.orders?.budget || 0}</Text>
                    </View>
                    <View className="info-row">
                      <Text className="info-label">平台</Text>
                      <Text className="info-value">
                        {request.orders?.platforms && request.orders.platforms.length > 0
                          ? request.orders.platforms.map((p: string) => PLATFORM_NAMES[p] || p).join('、')
                          : '全平台'}
                      </Text>
                    </View>
                    {request.orders?.deadline && (
                      <View className="info-row">
                        <Text className="info-label">截止</Text>
                        <Text className="info-value">
                          {new Date(request.orders.deadline).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="order-card-footer">
                    <Text className="action-text">查看详情</Text>
                    <ChevronRight size={16} color="#8b5cf6" />
                  </View>
                </View>
              ))}

              {/* 待接单更多提示 */}
              {pendingOrders.length > 3 && (
                <View
                  className="more-hint"
                  onClick={() => {
                    showToast({ title: '请到订单列表查看全部', icon: 'none' })
                  }}
                >
                  <Text className="more-hint-text">还有 {pendingOrders.length - 3} 个待接单订单</Text>
                  <ChevronRight size={16} color="#8b5cf6" />
                </View>
              )}
            </View>
          </View>
        )}

        {/* 按状态展示所有订单 - 显示所有状态，即使数量为0 */}
        {Object.entries(ORDER_STATUS_CONFIG).map(([status, config]) => {
          const orders = ordersByStatus[status] || []

          const StatusIcon = config.icon
          const isExpanded = expandedStatus[status]
          const displayOrders = isExpanded ? orders : orders.slice(0, 3)
          const showMore = orders.length > 3

          return (
            <View key={status} className="status-section">
              <View
                className="status-header"
                style={{ borderColor: config.color }}
                onClick={() => toggleExpand(status)}
              >
                <StatusIcon size={20} color={config.color} />
                <View className="status-title-row">
                  <Text className="status-title">{config.label}</Text>
                  <View
                    className="status-count"
                    style={{ backgroundColor: config.bgColor, color: config.color }}
                  >
                    <Text className="count-text">{orders.length}</Text>
                  </View>
                </View>
                {showMore && (
                  <View className="expand-icon">
                    {isExpanded ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
                  </View>
                )}
              </View>

              {orders.length > 0 && (
                <View className="orders-grid">
                  {displayOrders.map((order) => (
                    <View
                      key={order.id}
                      className="order-card"
                      style={{ borderColor: `${config.color}20` }}
                      onClick={() => handleOrderClick(order)}
                    >
                      <View className="order-card-header">
                        <View className="order-title-row">
                          <Text className="order-title">{order.orders?.title || '未知订单'}</Text>
                          <View
                            className="order-status-badge"
                            style={{ backgroundColor: config.bgColor, color: config.color }}
                          >
                            <StatusIcon size={12} color={config.color} />
                            <Text className="badge-text">{config.shortLabel}</Text>
                          </View>
                        </View>
                      </View>

                      <View className="order-card-body">
                        <View className="info-row">
                          <Text className="info-label">预算</Text>
                          <Text className="info-value">¥{order.orders?.budget || 0}</Text>
                        </View>
                        <View className="info-row">
                          <Text className="info-label">状态说明</Text>
                          <Text className="info-value" style={{ color: config.color }}>
                            {config.description}
                          </Text>
                        </View>
                      </View>

                      <View className="order-card-footer">
                        <Text className="action-text" style={{ color: config.color }}>
                          {status === 'published'
                            ? '去反馈'
                            : ['awaiting_acceptance', 'completed', 'cancelled'].includes(status)
                              ? '查看详情'
                              : '继续处理'}
                        </Text>
                        <ChevronRight size={16} color={config.color} />
                      </View>
                    </View>
                  ))}

                  {/* 更多提示 */}
                  {showMore && !isExpanded && (
                    <View className="more-hint" onClick={() => toggleExpand(status)}>
                      <Text className="more-hint-text">还有 {orders.length - 3} 个{config.label}订单</Text>
                      <ChevronDown size={16} color="#8b5cf6" />
                    </View>
                  )}
                </View>
              )}

              {orders.length === 0 && (
                <View className="empty-status">
                  <Text className="empty-status-text">暂无{config.label}订单</Text>
                </View>
              )}
            </View>
          )
        })}

        {/* 空状态 */}
        {pendingOrders.length === 0 && allOrders.length === 0 && (
          <View className="empty-state">
            <Award size={64} color="rgba(139, 92, 246, 0.3)" />
            <Text className="empty-title">暂无订单</Text>
            <Text className="empty-description">
              等待订单匹配...
            </Text>
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
