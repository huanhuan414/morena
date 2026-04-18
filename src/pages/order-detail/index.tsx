import Taro, { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  Sparkles, ChevronRight, ArrowLeft, Pencil, Save, Check, X, ExternalLink, Star,
  TrendingUp, MessageCircle, Share2, Eye, Loader, Circle, Bell, User,
  Clock, DollarSign, Tag, Calendar, Zap
} from 'lucide-react-taro'
import './index.css'

interface Order {
  id: string
  title: string
  description: string
  budget: number
  status: string
  requirements: {
    contentType?: string
    platforms?: string[]
    targetAudience?: string
    expectedResults?: string
    deadline?: string
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

interface ExecutionStep {
  id: string
  step_number: number
  step_name: string
  description: string
  status: string
  started_at?: string
  completed_at?: string
}

const PLATFORM_NAMES: Record<string, string> = {
  'wechat_mp': '微信公众号',
  'xiaohongshu': '小红书',
  'bilibili': 'B站',
  'weibo': '微博',
  'douyin': '抖音',
  'wechat_video': '视频号',
  'zhihu': '知乎',
  'toutiao': '今日头条',
  'baidu': '百度',
  'kuaishou': '快手'
}

const getPlatformName = (platform: string): string => {
  return PLATFORM_NAMES[platform] || platform
}

const STATUS_CONFIG = {
  open: { label: '待接单', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  in_progress: { label: '进行中', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
  reviewing: { label: '待验收', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
  completed: { label: '已完成', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)' },
  cancelled: { label: '已取消', color: '#6b7280', gradient: 'linear-gradient(135deg, #6b7280, #9ca3af)' }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const { id } = router.params

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'detail' | 'progress' | 'result'>('detail')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: 0
  })

  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [ratingComment, setRatingComment] = useState('')

  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [executions, setExecutions] = useState<ExecutionStep[]>([])
  const [dispatchStatus, setDispatchStatus] = useState<{
    acceptedAvatar?: any
    pendingRequest?: any
    executions: ExecutionStep[]
    currentStep?: ExecutionStep | null
  } | null>(null)

  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)

    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }

    if (id) {
      fetchOrder()
    }
  })

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/order/${id}` })
      if (res.data?.code === 200) {
        const orderData = res.data.data
        setOrder(orderData)
        setFormData({
          title: orderData.title,
          description: orderData.description,
          budget: orderData.budget
        })
        fetchDispatchStatus()
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const fetchDispatchStatus = async () => {
    try {
      const res = await Network.request({ url: `/api/order-dispatch/${id}/status` })
      if (res.data?.code === 200) {
        setDispatchStatus(res.data.data)
        setExecutions(res.data.data.executions || [])
      }
    } catch (error) {
      console.error('获取分配状态失败:', error)
    }
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showToast({ title: '请输入订单标题', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/order/${id}`,
        method: 'PUT',
        data: formData
      })

      if (res.data?.code === 200) {
        showToast({ title: '保存成功', icon: 'success' })
        setEditing(false)
        fetchOrder()
      } else {
        showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存订单失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
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

  const handleCancel = async () => {
    try {
      const res = await Network.request({
        url: `/api/order/${id}/cancel`,
        method: 'PUT'
      })

      if (res.data?.code === 200) {
        showToast({ title: '订单已取消', icon: 'success' })
        navigateBack()
      }
    } catch (error) {
      console.error('取消失败:', error)
      showToast({ title: '取消失败', icon: 'none' })
    }
  }

  const handleRetryDispatch = () => {
    navigateTo({
      url: `/pages/order-matching/index?orderId=${id}`
    })
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check size={20} color="#22c55e" />
      case 'in_progress':
        return <Loader size={20} color="#3b82f6" className="animate-spin" />
      case 'failed':
        return <X size={20} color="#ef4444" />
      default:
        return <Circle size={20} color="rgba(255,255,255,0.2)" />
    }
  }

  if (loading) {
    return (
      <View className="order-detail-page">
        <View className="loading-container">
          <View className="loading-spinner">
            <Loader size={48} color="#00f5ff" className="animate-spin" />
          </View>
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="order-detail-page">
        <View className="error-container">
          <Circle size={64} color="#ef4444" />
          <Text className="error-text">订单不存在</Text>
        </View>
      </View>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open
  const content = order.result?.content

  return (
    <View className="order-detail-page">
      {/* 背景特效 */}
      <View className="bg-effects">
        <View className="bg-orb orb-1"></View>
        <View className="bg-orb orb-2"></View>
        <View className="bg-orb orb-3"></View>
      </View>

      {/* 顶部导航 */}
      <View className="nav-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="nav-content">
          <View className="nav-left">
            <View className="back-btn" onClick={() => navigateBack()}>
              <ArrowLeft size={24} color="#fff" />
            </View>
            <Text className="nav-title">订单详情</Text>
          </View>
          {editing && (
            <View className="nav-actions">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <Text>取消</Text>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save size={16} color="#fff" />
              </Button>
            </View>
          )}
          {!editing && order?.status === 'open' && (
            <View className="edit-btn" onClick={() => setEditing(true)}>
              <Pencil size={20} color="#00f5ff" />
            </View>
          )}
        </View>
      </View>

      {/* 状态卡片 */}
      <View className="status-card">
        <View className="status-badge">
          <View className="status-dot" style={{ background: statusConfig.gradient }}></View>
          <Text className="status-label" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
        <View className="status-info">
          <Text className="order-title-text">{order.title}</Text>
          <View className="order-meta">
            <View className="meta-item">
              <DollarSign size={16} color="#00f5ff" />
              <Text className="meta-value">¥{order.budget || 0}</Text>
            </View>
            <View className="meta-item">
              <Calendar size={16} color="#00f5ff" />
              <Text className="meta-value">
                {new Date(order.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tab切换 */}
      <View className="tab-bar">
        {['detail', 'progress', 'result'].map((tab) => (
          <View
            key={tab}
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            <Text className="tab-text">
              {tab === 'detail' && '订单详情'}
              {tab === 'progress' && '执行进度'}
              {tab === 'result' && '成果展示'}
            </Text>
            {activeTab === tab && <View className="tab-indicator"></View>}
          </View>
        ))}
      </View>

      <ScrollView className="content-scroll" scrollY>
        {/* 订单详情 */}
        {activeTab === 'detail' && (
          <View className="detail-panel">
            {/* 描述卡片 */}
            <View className="info-card glass-card">
              <View className="card-header">
                <Sparkles size={20} color="#00f5ff" />
                <Text className="card-title">订单描述</Text>
              </View>
              <Text className="card-content">
                {editing ? (
                  <Textarea
                    value={formData.description}
                    onInput={(e: any) => setFormData({ ...formData, description: e.detail.value })}
                    placeholder="请输入订单描述"
                    className="edit-textarea"
                  />
                ) : (
                  <Text>{order.description || '暂无描述'}</Text>
                )}
              </Text>
            </View>

            {/* 需求卡片 */}
            {order.requirements && (
              <View className="info-card glass-card">
                <View className="card-header">
                  <Zap size={20} color="#00f5ff" />
                  <Text className="card-title">详细需求</Text>
                </View>
                <View className="requirement-list">
                  {order.requirements.platforms && order.requirements.platforms.length > 0 && (
                    <View className="requirement-item">
                      <Text className="req-label">发布平台</Text>
                      <View className="platform-chips">
                        {order.requirements.platforms.map((p, idx) => (
                          <View key={idx} className="platform-chip">
                            <Text className="chip-text">{getPlatformName(p)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {order.requirements.contentType && (
                    <View className="requirement-item">
                      <Text className="req-label">内容类型</Text>
                      <Text className="req-value">{order.requirements.contentType}</Text>
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
                      <Text className="req-label">预期效果</Text>
                      <Text className="req-value">{order.requirements.expectedResults}</Text>
                    </View>
                  )}
                  {order.requirements.deadline && (
                    <View className="requirement-item">
                      <Text className="req-label">截止日期</Text>
                      <View className="req-value-wrapper">
                        <Clock size={16} color="#f59e0b" />
                        <Text className="req-value">{order.requirements.deadline}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* 分身信息 */}
            {order.avatars && (
              <View className="info-card glass-card avatar-card">
                <View className="card-header">
                  <User size={20} color="#00f5ff" />
                  <Text className="card-title">执行分身</Text>
                </View>
                <View className="avatar-display">
                  <View className="avatar-image-wrapper">
                    {order.avatars.avatar_url ? (
                      <Image src={order.avatars.avatar_url} className="avatar-image" />
                    ) : (
                      <View className="avatar-placeholder">
                        <Sparkles size={32} color="#00f5ff" />
                      </View>
                    )}
                  </View>
                  <View className="avatar-details">
                    <Text className="avatar-name">{order.avatars.name}</Text>
                    {order.avatars.level && (
                      <View className="avatar-level-badge">
                        <Star size={12} color="#eab308" />
                        <Text className="level-text">Lv.{order.avatars.level}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* 操作按钮 */}
            <View className="action-buttons">
              {order.status === 'open' && !order.avatars && (
                <>
                  <Button onClick={handleRetryDispatch} className="primary-action-btn">
                    <Sparkles size={18} color="#fff" />
                    <Text>AI智能匹配分身</Text>
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="secondary-action-btn">
                    <Text style={{ color: '#ef4444' }}>取消订单</Text>
                  </Button>
                </>
              )}

              {order.status === 'reviewing' && (
                <>
                  <Button onClick={() => setShowRating(true)} className="primary-action-btn">
                    <Check size={18} color="#fff" />
                    <Text>验收通过</Text>
                  </Button>
                  <Button variant="outline" onClick={() => setShowReject(true)} className="secondary-action-btn">
                    <X size={18} color="#fff" />
                    <Text>驳回修改</Text>
                  </Button>
                </>
              )}
            </View>
          </View>
        )}

        {/* 执行进度 */}
        {activeTab === 'progress' && (
          <View className="progress-panel">
            {executions.length > 0 ? (
              <View className="timeline">
                {executions.map((step, idx) => (
                  <View key={step.id} className="timeline-item">
                    <View className="timeline-marker">
                      {getStepIcon(step.status)}
                      <View className={`timeline-line ${step.status === 'completed' ? 'completed' : ''}`} />
                    </View>
                    <View className={`timeline-content ${step.status === 'completed' ? 'completed' : ''}`}>
                      <Text className="timeline-title">{step.step_name}</Text>
                      {step.description && (
                        <Text className="timeline-desc">{step.description}</Text>
                      )}
                      <Text className="timeline-time">
                        {step.completed_at
                          ? `完成于 ${new Date(step.completed_at).toLocaleString()}`
                          : step.started_at
                          ? `开始于 ${new Date(step.started_at).toLocaleString()}`
                          : '待开始'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="empty-state">
                <Clock size={64} color="rgba(255,255,255,0.2)" />
                <Text className="empty-text">暂无执行进度</Text>
              </View>
            )}
          </View>
        )}

        {/* 成果展示 */}
        {activeTab === 'result' && (
          <View className="result-panel">
            {content ? (
              <View className="result-content">
                {content.title && (
                  <View className="result-title-card glass-card">
                    <Text className="result-title-text">{content.title}</Text>
                  </View>
                )}
                <View className="result-body-card glass-card">
                  <Text className="result-body-text">{content.content}</Text>
                </View>
                {content.images && content.images.length > 0 && (
                  <View className="result-images">
                    {content.images.map((img, idx) => (
                      <Image key={idx} src={img} className="result-image" mode="aspectFill" />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View className="empty-state">
                <Sparkles size={64} color="rgba(255,255,255,0.2)" />
                <Text className="empty-text">暂无成果内容</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 验收弹窗 */}
      {showRating && (
        <View className="modal-overlay" onClick={() => setShowRating(false)}>
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">验收评价</Text>
              <View className="modal-close" onClick={() => setShowRating(false)}>
                <X size={24} color="#fff" />
              </View>
            </View>
            <View className="rating-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <View
                  key={star}
                  className="star-item"
                  onClick={() => setRating(star)}
                >
                  <Star
                    size={40}
                    color={star <= rating ? '#eab308' : 'rgba(255,255,255,0.2)'}
                  />
                </View>
              ))}
            </View>
            <View className="modal-input">
              <Textarea
                value={ratingComment}
                onInput={(e: any) => setRatingComment(e.detail.value)}
                placeholder="请输入评价（选填）"
                className="comment-textarea"
              />
            </View>
            <View className="modal-footer">
              <Button variant="outline" onClick={() => setShowRating(false)}>
                <Text>取消</Text>
              </Button>
              <Button onClick={handleApprove}>
                <Check size={16} color="#fff" />
                <Text>确认验收</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 驳回弹窗 */}
      {showReject && (
        <View className="modal-overlay" onClick={() => setShowReject(false)}>
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">驳回原因</Text>
              <View className="modal-close" onClick={() => setShowReject(false)}>
                <X size={24} color="#fff" />
              </View>
            </View>
            <View className="modal-input">
              <Textarea
                value={rejectReason}
                onInput={(e: any) => setRejectReason(e.detail.value)}
                placeholder="请输入驳回原因，帮助分身更好地修改"
                className="reject-textarea"
              />
            </View>
            <View className="modal-footer">
              <Button variant="outline" onClick={() => setShowReject(false)}>
                <Text>取消</Text>
              </Button>
              <Button onClick={handleReject}>
                <X size={16} color="#fff" />
                <Text>确认驳回</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
