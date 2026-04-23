import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  ArrowLeft, Check, X, Star, Loader, Circle,
  DollarSign, Users, Eye, Heart, MessageCircle, Share2
} from 'lucide-react-taro'
import './index.css'

const STATUS_CONFIG: Record<string, any> = {
  reviewing: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  awaiting_acceptance: { label: '待验收', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' }
}

const AVATAR_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  accepted: '已接单',
  generating: '生成中',
  publishing: '发布中',
  published: '已发布',
  awaiting_acceptance: '待验收',
  feedback_submitted: '已提交'
}

const AVATAR_STATUS_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  pending: { bg: '#fef3c7', text: '#d97706', border: '#f59e0b' },
  accepted: { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' },
  generating: { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' },
  publishing: { bg: '#ede9fe', text: '#7c3aed', border: '#8b5cf6' },
  published: { bg: '#dcfce7', text: '#16a34a', border: '#22c55e' },
  awaiting_acceptance: { bg: '#ede9fe', text: '#7c3aed', border: '#8b5cf6' },
  feedback_submitted: { bg: '#dcfce7', text: '#16a34a', border: '#22c55e' }
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
  dispatch_requests?: any[]
}

interface Post {
  id: string
  content: string
  images: string[]
  videoUrl?: string
  likesCount: number
  commentsCount: number
  sharesCount: number
  viewsCount: number
  createdAt: string
  platforms: string[]
}

interface AvatarStat {
  avatarId: string
  avatarName: string
  avatarUrl: string
  status: string
  postCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  publishFeedback: any
  posts: Post[]
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

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString()
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
        <Text className="header-title">验收确认</Text>
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
        {/* 分身列表 */}
        {order.summary_stats?.avatarStats && order.summary_stats.avatarStats.length > 0 ? (
          <View className="avatar-list">
            {order.summary_stats.avatarStats.map((avatar: AvatarStat) => {
              const statusColor = AVATAR_STATUS_COLORS[avatar.status] || AVATAR_STATUS_COLORS.pending

              return (
                <View key={avatar.avatarId} className="avatar-card">
                  {/* 分身头部 */}
                  <View className="avatar-header">
                    <Image
                      src={avatar.avatarUrl || 'https://via.placeholder.com/48'}
                      className="avatar-avatar"
                      mode="aspectFill"
                    />
                    <View className="avatar-info">
                      <View className="avatar-name-row">
                        <Text className="avatar-name">{avatar.avatarName}</Text>
                        <View
                          className="avatar-status"
                          style={{
                            backgroundColor: statusColor.bg,
                            borderColor: statusColor.border
                          }}
                        >
                          <Text style={{ color: statusColor.text }}>
                            {AVATAR_STATUS_LABELS[avatar.status]}
                          </Text>
                        </View>
                      </View>
                      <Text className="avatar-summary">
                        {avatar.postCount} 个作品 · {formatNumber(avatar.totalViews)} 浏览 · {formatNumber(avatar.totalLikes)} 点赞
                      </Text>
                    </View>
                  </View>

                  {/* 数据指标 */}
                  <View className="metrics-row">
                    <View className="metric-item">
                      <Eye size={16} color="#22c55e" />
                      <Text className="metric-value">{formatNumber(avatar.totalViews)}</Text>
                      <Text className="metric-label">浏览</Text>
                    </View>
                    <View className="metric-item">
                      <Heart size={16} color="#ef4444" />
                      <Text className="metric-value">{formatNumber(avatar.totalLikes)}</Text>
                      <Text className="metric-label">点赞</Text>
                    </View>
                    <View className="metric-item">
                      <MessageCircle size={16} color="#f59e0b" />
                      <Text className="metric-value">{formatNumber(avatar.totalComments)}</Text>
                      <Text className="metric-label">评论</Text>
                    </View>
                    <View className="metric-item">
                      <Share2 size={16} color="#6366f1" />
                      <Text className="metric-value">{formatNumber(avatar.totalShares)}</Text>
                      <Text className="metric-label">分享</Text>
                    </View>
                  </View>

                  {/* 提交的链接和截图 */}
                  {avatar.publishFeedback && (
                    <View className="feedback-section">
                      <Text className="feedback-title">发布提交</Text>

                      {Object.entries(avatar.publishFeedback).map(([platform, feedback]: [string, any]) => (
                        <View key={platform} className="feedback-card">
                          <Text className="feedback-platform">{platform === 'wechat_mp' ? '微信公众号' : platform}</Text>

                          {/* 链接 */}
                          {feedback.link && (
                            <View className="feedback-link">
                              <Text className="feedback-link-label">发布链接：</Text>
                              <Text className="feedback-link-value">{feedback.link}</Text>
                            </View>
                          )}

                          {/* 截图 */}
                          {feedback.image && (
                            <View className="feedback-image-container">
                              <Text className="feedback-image-label">发布截图</Text>
                              <Image
                                src={feedback.image}
                                className="feedback-image"
                                mode="widthFix"
                              />
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 作品列表（如果有） */}
                  {avatar.posts && avatar.posts.length > 0 && (
                    <View className="posts-section">
                      <Text className="posts-title">作品内容 ({avatar.posts.length})</Text>
                      {avatar.posts.map((post) => (
                        <View key={post.id} className="post-card">
                          <Text className="post-content">{post.content}</Text>

                          {post.images && post.images.length > 0 && (
                            <View className="post-images">
                              {post.images.map((img, idx) => (
                                <Image
                                  key={idx}
                                  src={img}
                                  className="post-image"
                                  mode="aspectFill"
                                />
                              ))}
                            </View>
                          )}

                          {post.videoUrl && (
                            <View className="post-video">
                              <Text className="post-video-text">📹 视频内容</Text>
                            </View>
                          )}

                          <View className="post-footer">
                            <View className="post-stat">
                              <Eye size={12} color="#94a3b8" />
                              <Text className="post-stat-value">{formatNumber(post.viewsCount)}</Text>
                            </View>
                            <View className="post-stat">
                              <Heart size={12} color="#94a3b8" />
                              <Text className="post-stat-value">{formatNumber(post.likesCount)}</Text>
                            </View>
                            <View className="post-stat">
                              <MessageCircle size={12} color="#94a3b8" />
                              <Text className="post-stat-value">{formatNumber(post.commentsCount)}</Text>
                            </View>
                            <Text className="post-time">{formatDate(post.createdAt)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {!avatar.publishFeedback && (!avatar.posts || avatar.posts.length === 0) && (
                    <View className="empty-posts">
                      <Text className="empty-posts-text">暂无提交内容</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ) : (
          <View className="empty-state">
            <Text className="empty-state-text">暂无分身参与</Text>
          </View>
        )}
      </ScrollView>

      {/* 验收按钮 */}
      {isReviewing && (
        <View className="bottom-actions">
          <Button
            variant="outline"
            onClick={() => setShowReject(true)}
            className="action-btn reject-btn"
          >
            <X size={18} color="#ef4444" />
            <Text>驳回修改</Text>
          </Button>
          <Button
            onClick={() => setShowRating(true)}
            className="action-btn approve-btn"
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
