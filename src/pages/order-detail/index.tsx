import Taro, { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import {
  ArrowLeft, Package, TrendingUp, Users, Calendar, DollarSign,
  Check, Clock, X, Star
} from 'lucide-react-taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import AvatarStatsPanel from './AvatarStatsPanel'
import './index.css'

// 状态配置
const STATUS_CONFIG: Record<string, any> = {
  open: { label: '待接单', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Clock },
  published: { label: '执行中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: TrendingUp },
  published_reviewing: { label: '执行中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: TrendingUp },
  reviewing: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: Star },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: Check },
  cancelled: { label: '已取消', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: X },
  rejected: { label: '已拒绝', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: X }
}

const TABS = [
  { key: 'detail', label: '订单详情', icon: Package },
  { key: 'progress', label: '执行进度', icon: TrendingUp },
  { key: 'result', label: '成果展示', icon: Check }
]

interface Order {
  id: string
  title: string
  description: string
  budget: number
  status: string
  expected_quantity?: number
  deadline?: string
  requirements?: {
    contentType?: string
    platforms?: string[]
    targetAudience?: string
    expectedResults?: string
    requiredSkills?: string[]
  }
  created_at: string
  dispatch_request_status?: string
  summary_stats?: any
  dispatch_requests?: any[]
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.params
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [activeTab, setActiveTab] = useState('detail')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)

    if (id) {
      fetchOrder()
    }
  })

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/order/${id}` })
      if (res.data?.code === 200) {
        setOrder(res.data.data)
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      const res = await Network.request({
        url: `/api/order/${id}/approve`,
        method: 'PUT',
        data: rating > 0 ? { rating: { score: rating, comment: ratingComment } } : {}
      })

      if (res.data?.code === 200) {
        showToast({ title: '验收通过', icon: 'success' })
        setShowRating(false)
        fetchOrder()
      }
    } catch (error) {
      console.error('验收失败:', error)
      showToast({ title: '验收失败', icon: 'none' })
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast({ title: '请输入驳回原因', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: `/api/order/${id}/reject`,
        method: 'PUT',
        data: { reason: rejectReason }
      })

      if (res.data?.code === 200) {
        showToast({ title: '已驳回', icon: 'success' })
        setShowReject(false)
        setRejectReason('')
        fetchOrder()
      }
    } catch (error) {
      console.error('驳回失败:', error)
      showToast({ title: '驳回失败', icon: 'none' })
    }
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const getPlatformName = (platform: string): string => {
    const platformMap: Record<string, string> = {
      douyin: '抖音',
      xiaohongshu: '小红书',
      wechat_mp: '微信公众号'
    }
    return platformMap[platform] || platform
  }

  if (loading || !order) {
    return (
      <View className="order-detail-container">
        <View className="loading-container">
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  const displayStatus = order.dispatch_request_status || order.status
  const statusConfig = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.open
  const StatusIcon = statusConfig.icon

  const isReviewing = displayStatus === 'reviewing'

  return (
    <View className="order-detail-container" style={{ paddingTop: `${statusBarHeight + 44}px` }}>
      {/* 顶部导航栏 */}
      <View className="navbar" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="navbar-content">
          <View className="navbar-left" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#ffffff" />
          </View>
          <Text className="navbar-title">订单详情</Text>
          <View className="navbar-right" />
        </View>
      </View>

      {/* 状态栏 */}
      <View className="status-bar" style={{ backgroundColor: statusConfig.bg }}>
        <View className="status-bar-content">
          <StatusIcon size={20} color={statusConfig.color} />
          <Text className="status-text" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <View className="tabs-container">
        {TABS.map(tab => {
          const TabIcon = tab.icon
          return (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <TabIcon
                size={18}
                color={activeTab === tab.key ? '#00f5ff' : 'rgba(255,255,255,0.5)'}
              />
              <Text className="tab-label">{tab.label}</Text>
              {activeTab === tab.key && <View className="tab-indicator" />}
            </View>
          )
        })}
      </View>

      {/* 内容区域 */}
      <ScrollView scrollY className="content-scroll">
        {/* 订单详情 */}
        {activeTab === 'detail' && (
          <View className="content-container">
            {/* 标题卡片 */}
            <View className="info-card">
              <Text className="card-title">{order.title}</Text>
              <Text className="card-description">{order.description}</Text>

              <View className="info-grid">
                <View className="info-item">
                  <DollarSign size={16} color="#00f5ff" />
                  <Text className="info-label">预算</Text>
                  <Text className="info-value">¥{order.budget}</Text>
                </View>

                {order.deadline && (
                  <View className="info-item">
                    <Calendar size={16} color="#00f5ff" />
                    <Text className="info-label">截止日期</Text>
                    <Text className="info-value">{formatDate(order.deadline)}</Text>
                  </View>
                )}

                {order.expected_quantity && (
                  <View className="info-item">
                    <Users size={16} color="#00f5ff" />
                    <Text className="info-label">期望数量</Text>
                    <Text className="info-value">{order.expected_quantity}个分身</Text>
                  </View>
                )}

                <View className="info-item">
                  <Clock size={16} color="#00f5ff" />
                  <Text className="info-label">发布时间</Text>
                  <Text className="info-value">{formatDate(order.created_at)}</Text>
                </View>
              </View>
            </View>

            {/* 订单要求 */}
            {order.requirements && (
              <View className="info-card">
                <Text className="section-title">订单要求</Text>
                <View className="requirement-list">
                  {order.requirements.contentType && (
                    <View className="requirement-item">
                      <Text className="requirement-label">内容类型</Text>
                      <Text className="requirement-value">{order.requirements.contentType}</Text>
                    </View>
                  )}
                  {order.requirements.platforms && order.requirements.platforms.length > 0 && (
                    <View className="requirement-item">
                      <Text className="requirement-label">发布平台</Text>
                      <View className="platform-tags">
                        {order.requirements.platforms.map((platform: string, idx: number) => (
                          <Text key={idx} className="platform-tag">
                            {getPlatformName(platform)}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {order.requirements.targetAudience && (
                    <View className="requirement-item">
                      <Text className="requirement-label">目标受众</Text>
                      <Text className="requirement-value">{order.requirements.targetAudience}</Text>
                    </View>
                  )}
                  {order.requirements.expectedResults && (
                    <View className="requirement-item">
                      <Text className="requirement-label">期望效果</Text>
                      <Text className="requirement-value">{order.requirements.expectedResults}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 执行进度 */}
        {activeTab === 'progress' && (
          <View className="content-container">
            <View className="info-card">
              <Text className="section-title">执行进度</Text>
              <Text className="empty-hint">执行进度功能开发中...</Text>
            </View>
          </View>
        )}

        {/* 成果展示 */}
        {activeTab === 'result' && (
          <View className="content-container result-container">
            {order.summary_stats && order.summary_stats.totalAvatars > 0 ? (
              <AvatarStatsPanel stats={order.summary_stats} />
            ) : (
              <View className="info-card">
                <View className="empty-state">
                  <Users size={64} color="rgba(255,255,255,0.2)" />
                  <Text className="empty-text">暂无分身参与数据</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 验收按钮（固定底部） */}
      {isReviewing && (
        <View className="bottom-actions">
          <Button
            variant="outline"
            onClick={() => setShowReject(true)}
            className="action-btn action-btn-reject"
          >
            <X size={18} color="#ef4444" />
            <Text>驳回修改</Text>
          </Button>
          <Button
            onClick={() => setShowRating(true)}
            className="action-btn action-btn-approve"
          >
            <Check size={18} color="#ffffff" />
            <Text>验收通过</Text>
          </Button>
        </View>
      )}

      {/* 评分弹窗 */}
      {showRating && (
        <View className="modal-overlay" onClick={() => setShowRating(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">评价订单</Text>

            <View className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={32}
                  color={star <= rating ? '#f59e0b' : 'rgba(255,255,255,0.3)'}
                  filled={star <= rating}
                  onClick={() => setRating(star)}
                />
              ))}
            </View>

            <View className="form-group">
              <Text className="form-label">评价内容（可选）</Text>
              <Textarea
                className="form-textarea"
                placeholder="请输入评价内容"
                value={ratingComment}
                onInput={(e) => setRatingComment(e.detail.value)}
                maxlength={200}
              />
            </View>

            <View className="modal-actions">
              <Button
                variant="outline"
                onClick={() => setShowRating(false)}
                className="modal-btn"
              >
                取消
              </Button>
              <Button
                onClick={handleApprove}
                className="modal-btn modal-btn-confirm"
              >
                确认验收
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 驳回弹窗 */}
      {showReject && (
        <View className="modal-overlay" onClick={() => setShowReject(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">驳回修改</Text>

            <View className="form-group">
              <Text className="form-label">驳回原因</Text>
              <Textarea
                className="form-textarea"
                placeholder="请输入驳回原因"
                value={rejectReason}
                onInput={(e) => setRejectReason(e.detail.value)}
                maxlength={200}
              />
            </View>

            <View className="modal-actions">
              <Button
                variant="outline"
                onClick={() => setShowReject(false)}
                className="modal-btn"
              >
                取消
              </Button>
              <Button
                onClick={handleReject}
                className="modal-btn modal-btn-reject"
              >
                确认驳回
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
