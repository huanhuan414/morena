import { useLoad, useRouter, navigateBack, showToast, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  ArrowLeft, Check, X, Star, Loader, Circle,
  DollarSign, Users, TrendingUp
} from 'lucide-react-taro'
import './index.css'

const STATUS_CONFIG: Record<string, any> = {
  reviewing: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  awaiting_acceptance: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' }
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
  const [loading, setLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useLoad(() => {
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
      console.error('获取订单失败:', error)
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

  if (loading) {
    return (
      <View className="loading-page">
        <Loader className="loading-icon" size={32} color="#6366f1" />
        <Text className="loading-text">加载中...</Text>
      </View>
    )
  }

  if (!order) {
    return null
  }

  const displayStatus = order.dispatch_request_status || order.status
  const statusConfig = STATUS_CONFIG[displayStatus]

  if (!statusConfig) {
    return (
      <View className="error-page">
        <Text className="error-text">订单状态不支持验收</Text>
      </View>
    )
  }

  const isReviewing = displayStatus === 'reviewing' || displayStatus === 'awaiting_acceptance'

  return (
    <View className="order-detail-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#1e293b" />
        </View>
        <Text className="header-title">订单验收</Text>
        <View className="header-right" />
      </View>

      {/* 订单简要信息 */}
      <View className="order-summary">
        <View className="summary-header">
          <View className="order-title-row">
            <Text className="order-title">{order.title}</Text>
            <View
              className="order-status"
              style={{ backgroundColor: statusConfig.bg }}
            >
              <Circle size={8} color={statusConfig.color} strokeWidth={3} />
              <Text className="status-text" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>

        <View className="summary-info">
          <View className="info-row">
            <View className="info-item">
              <DollarSign size={16} color="#6366f1" />
              <Text className="info-label">预算</Text>
              <Text className="info-value">¥{order.budget}</Text>
            </View>
            {order.expected_quantity && (
              <View className="info-item">
                <Users size={16} color="#6366f1" />
                <Text className="info-label">期望</Text>
                <Text className="info-value">{order.expected_quantity}个</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView scrollY className="content-scroll">
        {/* 数据统计入口 */}
        {order.summary_stats && order.summary_stats.totalAvatars > 0 && (
          <View
            className="stats-entrance"
            onClick={() => navigateTo({ url: `/pages/order-stats/index?orderId=${order.id}` })}
          >
            <View className="stats-entrance-left">
              <View className="stats-icon">
                <TrendingUp size={24} color="#6366f1" />
              </View>
              <View className="stats-entrance-info">
                <Text className="stats-entrance-title">查看数据统计</Text>
                <Text className="stats-entrance-desc">
                  共 {order.summary_stats.totalAvatars} 个分身参与
                </Text>
              </View>
            </View>
            <ArrowLeft size={20} color="#94a3b8" style={{ transform: 'rotate(180deg)' }} />
          </View>
        )}

        {/* 验收说明 */}
        <View className="acceptance-guide">
          <View className="guide-header">
            <Circle size={20} color="#6366f1" strokeWidth={2} />
            <Text className="guide-title">验收说明</Text>
          </View>
          <View className="guide-content">
            <Text className="guide-text">
              • 请先查看数据统计，了解各分身的发布情况
            </Text>
            <Text className="guide-text">
              • 确认数据达标后，点击「验收通过」完成订单
            </Text>
            <Text className="guide-text">
              • 如有问题，可点击「驳回修改」要求分身重新处理
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 验收按钮 */}
      {isReviewing && (
        <View className="bottom-actions">
          <Button
            variant="outline"
            onClick={() => setShowReject(true)}
            className="reject-btn"
          >
            <X size={18} color="#ef4444" />
            <Text>驳回修改</Text>
          </Button>
          <Button
            onClick={() => setShowRating(true)}
            className="approve-btn"
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
            <Text className="modal-title">验收通过</Text>

            <View className="rating-section">
              <Text className="rating-label">请给分身打分</Text>
              <View className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={36}
                    color={star <= rating ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth={star <= rating ? 0 : 2}
                    onClick={() => setRating(star)}
                  />
                ))}
              </View>
            </View>

            <View className="form-group">
              <Text className="form-label">评价内容（可选）</Text>
              <Textarea
                className="form-textarea"
                placeholder="请输入评价内容..."
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
              <Text className="form-label">驳回原因 *</Text>
              <Textarea
                className="form-textarea"
                placeholder="请输入驳回原因，分身会根据原因修改后重新提交..."
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
