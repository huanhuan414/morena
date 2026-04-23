import { useLoad, useRouter, navigateBack, showToast, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  Sparkles, ArrowLeft, Check, X, Star,
  Loader, Circle,
  Clock, DollarSign, Calendar, Users
} from 'lucide-react-taro'
import './index.css'

const STATUS_CONFIG: Record<string, any> = {
  open: { label: '待接单', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  published: { label: '执行中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  published_reviewing: { label: '执行中', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  reviewing: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  cancelled: { label: '已取消', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  rejected: { label: '已拒绝', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
}

const TABS = [
  { key: 'detail', label: '订单详情' },
  { key: 'progress', label: '执行进度' },
  { key: 'result', label: '成果展示' }
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
  result?: {
    content?: {
      title?: string
      content: string
      images?: string[]
      videos?: string[]
      platform_results?: Array<{
        platform: string
        post_url?: string
        status: string
      }>
    }
    submitted_at?: string
  }
  publish_status?: {
    platforms?: Array<{
      platform: string
      status: string
      message?: string
      post_url?: string
    }>
    summary?: string
  }
  publish_feedback?: Record<string, { image?: string; link?: string }>
  generated_content?: any
  confirmed_content?: any
  dispatch_request_id?: string
  dispatch_request_status?: string
  summary_stats?: any
  dispatch_requests?: any[]
  rejection?: {
    reason: string
    rejected_at: string
  }
  rating?: {
    score: number
    comment?: string
  }
  created_at: string
  updated_at: string
  completed_at?: string
  avatars?: {
    id: string
    name: string
    avatar_url: string
    level?: number
  }
  users?: {
    nickname: string
    avatar: string
  }
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.params
  const [activeTab, setActiveTab] = useState('detail')
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

  if (loading) {
    return (
      <View className="loading-container">
        <Loader className="loading-icon" size={32} color="#00f5ff" />
        <Text className="loading-text">加载中...</Text>
      </View>
    )
  }

  if (!order) {
    return null
  }

  const displayStatus = order.dispatch_request_status || order.status
  const statusConfig = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.open

  // 根据订单状态确定可用的Tab
  const getAvailableTabs = () => {
    const tabs = [...TABS]
    // 只有在特定状态下才显示成果展示
    if (!['reviewing', 'completed'].includes(displayStatus)) {
      return tabs.filter(t => t.key !== 'result')
    }
    return tabs
  }

  const availableTabs = getAvailableTabs()

  return (
    <View className="order-detail-page">
      {/* 头部导航 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#ffffff" />
        </View>
        <Text className="header-title">订单详情</Text>
        <View className="header-right" />
      </View>

      {/* 订单基本信息卡片 */}
      <View className="order-card">
        <View className="order-header">
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

        <View className="order-info">
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

        <Text className="order-description">{order.description}</Text>
      </View>

      {/* 订单要求 */}
      {order.requirements && (
        <View className="requirements-card">
          <Text className="card-title">订单要求</Text>

          {order.requirements.contentType && (
            <View className="requirement-item">
              <Text className="req-label">内容类型</Text>
              <Text className="req-value">{order.requirements.contentType}</Text>
            </View>
          )}

          {order.requirements.platforms && order.requirements.platforms.length > 0 && (
            <View className="requirement-item">
              <Text className="req-label">发布平台</Text>
              <View className="platform-list">
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
              <Text className="req-label">目标受众</Text>
              <Text className="req-value">{order.requirements.targetAudience}</Text>
            </View>
          )}

          {order.requirements.expectedResults && (
            <View className="requirement-item">
              <Text className="req-label">期望效果</Text>
              <Text className="req-value">{order.requirements.expectedResults}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab切换 */}
      {availableTabs.length > 0 && (
        <View className="tabs-container">
          {availableTabs.map(tab => (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className="tab-text">{tab.label}</Text>
              {activeTab === tab.key && <View className="tab-indicator" />}
            </View>
          ))}
        </View>
      )}

      {/* 内容区域 */}
      <ScrollView scrollY className="content-scroll">
        {/* 订单详情 */}
        {activeTab === 'detail' && (
          <View className="detail-content">
            <Text className="section-title">订单详情</Text>
            <Text className="detail-text">订单详情信息...</Text>
          </View>
        )}

        {/* 执行进度 */}
        {activeTab === 'progress' && (
          <View className="detail-content">
            <Text className="section-title">执行进度</Text>
            <Text className="detail-text">执行进度开发中...</Text>
          </View>
        )}

        {/* 成果展示 */}
        {activeTab === 'result' && (
          <View className="result-content">
            {/* 跳转到统计页面 */}
            {order.summary_stats && order.summary_stats.totalAvatars > 0 ? (
              <View className="stats-entrance" onClick={() => navigateTo({ url: `/pages/order-stats/index?orderId=${order.id}` })}>
                <Users size={24} color="#00f5ff" />
                <View className="stats-entrance-info">
                  <Text className="stats-entrance-title">查看数据统计</Text>
                  <Text className="stats-entrance-desc">
                    共 {order.summary_stats.totalAvatars} 个分身参与
                  </Text>
                </View>
                <ArrowLeft size={20} color="rgba(255,255,255,0.5)" style={{ transform: 'rotate(180deg)' }} />
              </View>
            ) : (
              <View className="empty-state">
                <Sparkles size={64} color="rgba(255,255,255,0.2)" />
                <Text className="empty-text">暂无成果内容</Text>
              </View>
            )}

            {/* 兼容旧版展示 */}
            {order.publish_status && order.publish_status.platforms && order.publish_status.platforms.length > 0 && (
              <View className="publish-results">
                <Text className="section-title">发布结果</Text>
                {order.publish_status.platforms.map((result: any, idx: number) => {
                  const platformName = getPlatformName(result.platform)
                  const feedback = order.publish_feedback?.[result.platform]
                  return (
                    <View key={idx} className="platform-result">
                      <View className="platform-result-header">
                        <Text className="platform-name">{platformName}</Text>
                        <View
                          className="platform-status"
                          style={{
                            backgroundColor: result.status === 'success' ? 'rgba(34, 197, 94, 0.2)' :
                                               result.status === 'manual' ? 'rgba(245, 158, 11, 0.2)' :
                                               'rgba(239, 68, 68, 0.2)'
                          }}
                        >
                          <Text style={{
                            color: result.status === 'success' ? '#22c55e' :
                                   result.status === 'manual' ? '#f59e0b' : '#ef4444'
                          }}
                          >
                            {result.status === 'success' ? '已发布' :
                             result.status === 'manual' ? '需手动发布' : '发布异常'}
                          </Text>
                        </View>
                      </View>

                      {result.message && (
                        <Text className="platform-message">{result.message}</Text>
                      )}

                      {result.post_url && (
                        <View className="platform-url">
                          <Text className="url-label">发布链接：</Text>
                          <Text className="url-text" selectable>{result.post_url}</Text>
                        </View>
                      )}

                      {feedback && (
                        <View className="feedback-section">
                          <Text className="feedback-title">分身反馈</Text>
                          {feedback.image && (
                            <Image
                              src={feedback.image}
                              className="feedback-image"
                              mode="aspectFill"
                            />
                          )}
                          {feedback.link && (
                            <View className="feedback-url">
                              <Text className="url-label">反馈链接：</Text>
                              <Text className="url-text" selectable>{feedback.link}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 验收按钮 */}
      {displayStatus === 'reviewing' && (
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
            <Text className="modal-title">评价订单</Text>

            <View className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={32}
                  color={star <= rating ? '#f59e0b' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={star <= rating ? 0 : 2}
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
              >
                取消
              </Button>
              <Button
                onClick={handleApprove}
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
              >
                取消
              </Button>
              <Button
                onClick={handleReject}
                className="btn-reject"
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
