import { useLoad, useRouter, navigateBack, showToast, navigateTo } from '@tarojs/taro'
import { getSafeArea } from '@/utils/safe-area'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Badge } from '@/components/ui/badge'
import * as Network from '@/network'
import {
  ArrowLeft, TrendingUp, CircleCheck,
  Users, Eye, Heart, MessageCircle, ChevronRight
} from 'lucide-react-taro'
import '../profile/index.css'
import './index.css'

const STATUS_CONFIG: Record<string, any> = {
  open: { label: '待接单', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  pending: { label: '待接单', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  in_progress: { label: '进行中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  active: { label: '进行中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  reviewing: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  awaiting_acceptance: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  cancelled: { label: '已取消', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }
}

interface Order {
  id: string
  title: string
  status: string
  budget: number
  expected_quantity?: number
  deadline?: string
  created_at: string
  dispatch_request_status?: string
  summary_stats?: any
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.params
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    // 初始化安全区域信息
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)

    if (id) {
      fetchOrder()
    }
  })

  const fetchOrder = async () => {
    try {
      const res = await Network.request({
        url: `/api/order/${id}`
      })

      if (res.data?.code === 200 && res.data.data) {
        setOrder(res.data.data)
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const goToAcceptance = () => {
    navigateTo({
      url: `/pages/order-acceptance/index?orderId=${id}`
    })
  }

  const goToStats = () => {
    navigateTo({
      url: `/pages/order-stats/index?orderId=${id}`
    })
  }

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  if (loading) {
    return (
      <View className="order-detail-page">
        <View className="loading-page">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="order-detail-page">
        <View className="error-page">
          <Text className="error-text">订单不存在</Text>
        </View>
      </View>
    )
  }

  const displayStatus = order.status
  const statusConfig = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.pending
  const isReviewing = displayStatus === 'reviewing' || displayStatus === 'awaiting_acceptance'
  const stats = order.summary_stats

  return (
    <View className="order-detail-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={36} color="#7B3FE4" />
        </View>
        <Text className="header-title">订单详情</Text>
        <View className="header-right" style={{ width: `${capsulePlaceholderWidth}rpx` }} />
      </View>

      {/* 内容区域 */}
      <ScrollView scrollY className="content-scroll">
        {/* 订单信息卡片 */}
        <View className="order-card">
          <View className="order-header">
            <Text className="order-title">{order.title}</Text>
            <Badge style={{
              backgroundColor: statusConfig.bg,
              color: statusConfig.color
            }}
            >
              {statusConfig.label}
            </Badge>
          </View>

          <View className="order-stats">
            <View className="order-stat-item">
              <Users size={16} color="#6366f1" />
              <Text className="order-stat-value">
                {stats?.totalAvatars || 0}
              </Text>
              <Text className="order-stat-label">参与</Text>
            </View>
            <View className="order-stat-item">
              <Eye size={16} color="#22c55e" />
              <Text className="order-stat-value">
                {formatNumber(stats?.totalViews || 0)}
              </Text>
              <Text className="order-stat-label">浏览</Text>
            </View>
            <View className="order-stat-item">
              <Heart size={16} color="#ef4444" />
              <Text className="order-stat-value">
                {formatNumber(stats?.totalLikes || 0)}
              </Text>
              <Text className="order-stat-label">点赞</Text>
            </View>
            <View className="order-stat-item">
              <MessageCircle size={16} color="#f59e0b" />
              <Text className="order-stat-value">
                {formatNumber(stats?.totalComments || 0)}
              </Text>
              <Text className="order-stat-label">评论</Text>
            </View>
          </View>

          <View className="order-details">
            <View className="order-detail-item">
              <Text className="detail-label">预算金额</Text>
              <Text className="detail-value">¥{order.budget}</Text>
            </View>
            {order.expected_quantity && (
              <View className="order-detail-item">
                <Text className="detail-label">期望数量</Text>
                <Text className="detail-value">{order.expected_quantity} 个</Text>
              </View>
            )}
          </View>
        </View>

        {/* 功能入口 */}
        {isReviewing && (
          <View className="action-entrance" onClick={goToAcceptance}>
            <View className="action-icon">
              <CircleCheck size={24} color="#6366f1" />
            </View>
            <View className="action-info">
              <Text className="action-title">开始验收</Text>
              <Text className="action-desc">验收分身提交的内容</Text>
            </View>
            <ChevronRight size={20} color="#94a3b8" />
          </View>
        )}

        <View className="action-entrance" onClick={goToStats}>
          <View className="action-icon">
            <TrendingUp size={24} color="#22c55e" />
          </View>
          <View className="action-info">
            <Text className="action-title">数据统计</Text>
            <Text className="action-desc">查看详细数据分析</Text>
          </View>
          <ChevronRight size={20} color="#94a3b8" />
        </View>
      </ScrollView>
    </View>
  )
}
