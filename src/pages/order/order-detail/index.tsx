import Taro, { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  Sparkles, ArrowLeft, Pencil, Save, Check, X, Star,
  Loader, Circle, User, Clock, DollarSign, Calendar, Zap, Users, FileText, TrendingUp
} from 'lucide-react-taro'
import './index.css'

interface Order {
  id: string
  title: string
  description: string
  budget: number
  status: string
  expected_quantity?: number
  accepted_count?: number
  deadline?: string
  requirements: {
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
  summary_stats?: {
    totalAvatars: number
    acceptedAvatars: number
    submittedAvatars: number
    totalPosts: number
    totalPlatforms: number
    totalPublished: number
    totalManual: number
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    avatarStats: AvatarStat[]
  }
}

interface AvatarStat {
  requestId: string
  avatarId: string
  avatarName: string
  avatarUrl: string
  status: string
  postCount: number
  platformCount: number
  publishedCount: number
  manualCount: number
  feedbackCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  publishFeedback: any
  posts: any[]
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
  const [selectedRequestId, setSelectedRequestId] = useState<string>('')

  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [statusBarHeight, setStatusBarHeight] = useState(20)

  // 格式化日期显示
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${year}/${month}/${day}`
    } catch {
      return dateStr
    }
  }

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
        // 分发状态数据已更新
      }
    } catch (error) {
      console.error('获取分配状态失败:', error)
    }
  }

  // 计算是否有待验收的分身
  const avatarStats = order?.summary_stats?.avatarStats || []
  // 计算是否所有分身都验收完成
  const allAvatarsCompleted = avatarStats.length > 0 && avatarStats.every((s: any) => s.status === 'completed')
  // 待验收的分身列表
  const pendingAvatars = avatarStats.filter((s: any) => s.status === 'awaiting_acceptance')

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
      if (selectedRequestId) {
        // 验收选中的分身
        const res = await Network.request({
          url: `/api/order-processing/accept/${selectedRequestId}`,
          method: 'PUT'
        })

        if (res.data?.code === 200) {
          const avatar = pendingAvatars.find(a => a.requestId === selectedRequestId)
          showToast({ title: `已验收「${avatar?.avatarName || '分身'}」`, icon: 'success' })
          setShowRating(false)
          setSelectedRequestId('')
          fetchOrder()
        }
      } else if (pendingAvatars.length > 0) {
        // 没有选中特定分身，验收第一个
        const pendingAvatar = pendingAvatars[0]
        try {
          const res = await Network.request({
            url: `/api/order-processing/accept/${pendingAvatar.requestId}`,
            method: 'PUT'
          })

          if (res.data?.code === 200) {
            showToast({ title: `已验收「${pendingAvatar.avatarName}」`, icon: 'success' })
            setShowRating(false)
            fetchOrder()
          }
        } catch (error) {
          console.error('验收分身失败:', error)
          showToast({ title: '验收失败', icon: 'none' })
        }
      } else {
        // 所有分身都验收了，验收整个订单
        const res = await Network.request({
          url: `/api/order/${id}/approve`,
          method: 'PUT',
          data: rating > 0 ? { rating: { score: rating, comment: ratingComment } } : {}
        })

        if (res.data?.code === 200) {
          showToast({ title: '订单验收通过', icon: 'success' })
          setShowRating(false)
          fetchOrder()
        }
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
      url: `/pages/order/order-matching/index?orderId=${id}`
    })
  }

  if (loading) {
    return (
      <View className="order-detail-page">
        <View className="loading-container">
          <View className="loading-spinner">
            <Loader size={48} color="#00f5ff" className="animate-spin" />
          </View>
          <Text className="loading-text block">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="order-detail-page">
        <View className="error-container">
          <Circle size={64} color="#ef4444" />
          <Text className="error-text block">订单不存在</Text>
        </View>
      </View>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open
  const content = order.result?.content

  // 获取状态样式类名
  const getStatusClass = (status: string): string => {
    const classMap: Record<string, string> = {
      'open': 'status-open',
      'in_progress': 'status-in_progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    }
    return classMap[status] || 'status-open'
  }

  return (
    <View className="order-detail-page">
      {/* 顶部导航 */}
      <View className="nav-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="nav-content">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#475569" />
          </View>
          <Text className="page-title">订单详情</Text>
          <View className="header-actions">
            {editing ? (
              <>
                <View className="action-btn" onClick={() => setEditing(false)}>
                  <X size={18} color="#64748b" />
                </View>
                <View className="action-btn" onClick={handleSave} style={{ background: saving ? '#94a3b8' : '#0f172a' }}>
                  {saving ? <Loader size={18} color="#ffffff" /> : <Save size={18} color="#ffffff" />}
                </View>
              </>
            ) : order?.status === 'open' ? (
              <View className="action-btn" onClick={() => setEditing(true)}>
                <Pencil size={18} color="#64748b" />
              </View>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>
        </View>
      </View>

      {/* 主内容区域 */}
      <View className="main-content">
        {/* 订单头部卡片 */}
        <View className="order-header-card">
          <View className="order-title-wrap">
            <Text className="order-title block">{order.title}</Text>
            <View className={`order-status-badge ${getStatusClass(order.status)}`}>
              <Text className="status-text">{statusConfig.label}</Text>
            </View>
          </View>
          <View className="order-meta-row">
            <View className="meta-item">
              <DollarSign size={16} color="#64748b" />
              <Text className="meta-value">¥{order.budget || 0}</Text>
            </View>
            <View className="meta-item">
              <Calendar size={16} color="#64748b" />
              <Text className="meta-value">{formatDate(order.deadline) || formatDate(order.created_at)}</Text>
            </View>
            <View className="meta-item">
              <Users size={16} color="#64748b" />
              <Text className="meta-value">{order.expected_quantity || 1} 人</Text>
            </View>
          </View>
        </View>

        {/* Tab 切换 */}
        <View className="tab-section">
          <View className="tab-bar">
            <View
              className={`tab-item ${activeTab === 'detail' ? 'active' : ''}`}
              onClick={() => setActiveTab('detail')}
            >
              <Text className="tab-item-text">订单详情</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <Text className="tab-item-text">执行进度</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 'result' ? 'active' : ''}`}
              onClick={() => setActiveTab('result')}
            >
              <Text className="tab-item-text">成果展示</Text>
            </View>
          </View>
        </View>

        <ScrollView className="content-scroll" scrollY>
          {/* 订单详情 */}
          {activeTab === 'detail' && (
            <View className="detail-panel">
              {/* 描述卡片 */}
              <View className="card">
                <View className="card-header">
                  <View className="card-icon">
                    <FileText size={18} color="#64748b" />
                  </View>
                  <Text className="card-title">订单描述</Text>
                </View>
                {editing ? (
                  <Textarea
                    value={formData.description}
                    onInput={(e: any) => setFormData({ ...formData, description: e.detail.value })}
                    placeholder="请输入订单描述"
                    className="edit-textarea"
                  />
              ) : (
                <Text className="description-text block">{order.description || '暂无描述'}</Text>
              )}
            </View>

            {/* 需求卡片 */}
            {order.requirements && (
              <View className="card">
                <View className="card-header">
                  <View className="card-icon">
                    <Zap size={18} color="#64748b" />
                  </View>
                  <Text className="card-title">详细需求</Text>
                </View>
                <View className="requirement-list">
                  {order.requirements.platforms && order.requirements.platforms.length > 0 && (
                    <View className="requirement-item">
                      <Text className="req-label block">发布平台</Text>
                      <View className="platform-chips">
                        {order.requirements.platforms.map((p, idx) => (
                          <View key={idx} className="platform-chip">
                            <Text className="chip-text block">{getPlatformName(p)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {order.requirements.contentType && (
                    <View className="requirement-item">
                      <Text className="req-label block">内容类型</Text>
                      <Text className="req-value block">{order.requirements.contentType}</Text>
                    </View>
                  )}
                  {order.requirements.targetAudience && (
                    <View className="requirement-item">
                      <Text className="req-label block">目标受众</Text>
                      <Text className="req-value block">{order.requirements.targetAudience}</Text>
                    </View>
                  )}
                  {order.requirements.expectedResults && (
                    <View className="requirement-item">
                      <Text className="req-label block">预期效果</Text>
                      <Text className="req-value block">{order.requirements.expectedResults}</Text>
                    </View>
                  )}
                  {order.deadline && (
                    <View className="requirement-item">
                      <Text className="req-label block">截止日期</Text>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={16} color="#64748b" />
                        <Text className="req-value block">{formatDate(order.deadline)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* 单个分身信息 */}
            {order.avatars && !order.summary_stats && (
              <View className="card">
                <View className="card-header">
                  <View className="card-icon">
                    <User size={18} color="#64748b" />
                  </View>
                  <Text className="card-title">执行分身</Text>
                </View>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {order.avatars.avatar_url ? (
                      <Image src={order.avatars.avatar_url} style={{ width: 48, height: 48, borderRadius: 24 }} />
                    ) : (
                      <Text style={{ fontSize: 18, fontWeight: 600, color: '#ffffff' }}>{order.avatars.name?.charAt(0) || '?'}</Text>
                    )}
                  </View>
                  <View style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }} className="block">{order.avatars.name}</Text>
                    {order.avatars.level && (
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Star size={12} color="#eab308" />
                        <Text style={{ fontSize: 12, color: '#64748b' }} className="block">Lv.{order.avatars.level}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* 操作按钮 */}
            <View className="action-section">
              {order.status === 'open' && !order.avatars && (
                <>
                  <View className="primary-btn" onClick={handleRetryDispatch}>
                    <Sparkles size={18} color="#ffffff" />
                    <Text className="primary-btn-text">AI智能匹配分身</Text>
                  </View>
                  <View className="secondary-btn" onClick={handleCancel}>
                    <Text className="secondary-btn-text" style={{ color: '#ef4444' }}>取消订单</Text>
                  </View>
                </>
              )}
              {allAvatarsCompleted && (
                <View className="primary-btn" onClick={() => setShowRating(true)}>
                  <Check size={18} color="#ffffff" />
                  <Text className="primary-btn-text">验收订单</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 执行进度 */}
        {activeTab === 'progress' && (
          <View className="progress-panel">
            {order.summary_stats?.avatarStats && order.summary_stats.avatarStats.length > 0 && (
              <View>
                {/* 汇总统计 */}
                <View className="stats-summary">
                  <View className="stat-item">
                    <Text className="stat-value block">{order.summary_stats.totalAvatars}</Text>
                    <Text className="stat-label block">总分身</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-item">
                    <Text className="stat-value block">{order.summary_stats.acceptedAvatars}</Text>
                    <Text className="stat-label block">已接受</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-item">
                    <Text className="stat-value block">{order.summary_stats.submittedAvatars}</Text>
                    <Text className="stat-label block">已提交</Text>
                  </View>
                </View>

                {/* 分身列表 */}
                <View className="avatar-list-header">
                  <Text className="avatar-list-title block">分身列表</Text>
                  <Text className="avatar-list-count block">{order.summary_stats.totalAvatars}个分身</Text>
                </View>

                {order.summary_stats.avatarStats.map((stat: any, index: number) => (
                  <View
                    key={index}
                    className="avatar-item"
                    onClick={() => {
                      if (stat.status === 'pending') {
                        Taro.navigateTo({ url: `/pages/avatar-profile/index?id=${stat.avatarId}` })
                      } else if (['accepted', 'generating', 'preview', 'publishing'].includes(stat.status)) {
                        Taro.navigateTo({ url: `/pages/order/order-content-creation/index?requestId=${stat.requestId}&orderId=${id}` })
                      } else if (['published', 'feedback_submitted'].includes(stat.status)) {
                        Taro.navigateTo({ url: `/pages/order-publish-feedback/index?requestId=${stat.requestId}&orderId=${id}` })
                      } else if (stat.status === 'awaiting_acceptance') {
                        Taro.navigateTo({ url: `/pages/order-acceptance-feedback/index?requestId=${stat.requestId}&orderId=${id}` })
                      } else if (stat.status === 'completed') {
                        Taro.navigateTo({ url: `/pages/order-completed/index?requestId=${stat.requestId}&orderId=${id}` })
                      }
                    }}
                  >
                    <View className="avatar-info">
                      <View className="avatar-avatar">
                        {stat.avatarUrl ? (
                          <Image src={stat.avatarUrl} className="avatar-avatar-image" />
                        ) : (
                          <Text className="avatar-avatar-text block">{stat.avatarName?.charAt(0) || '?'}</Text>
                        )}
                      </View>
                      <View className="avatar-details">
                        <Text className="avatar-name block">{stat.avatarName}</Text>
                        <View className="avatar-meta">
                          {stat.postCount > 0 && (
                            <Text className="avatar-meta-item block">{stat.postCount}个作品</Text>
                          )}
                          {stat.totalViews > 0 && (
                            <Text className="avatar-meta-item block">曝光{stat.totalViews}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                    {stat.status === 'completed' && (
                      <View className="completed-badge">
                        <Check size={14} color="#16a34a" />
                        <Text className="completed-badge-text block">已完成</Text>
                      </View>
                    )}
                    {stat.status === 'awaiting_acceptance' && (
                      <View className="pending-btn">
                        <Text className="pending-btn-text block">待验收</Text>
                      </View>
                    )}
                    {stat.status === 'pending' && (
                      <View className="status-tag pending">
                        <Text className="block">待接单</Text>
                      </View>
                    )}
                    {['accepted', 'generating', 'preview', 'publishing'].includes(stat.status) && (
                      <View className="status-tag" style={{ background: '#eff6ff' }}>
                        <Text className="block" style={{ color: '#2563eb' }}>进行中</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* 空状态 */}
            {(!order.summary_stats?.avatarStats || order.summary_stats.avatarStats.length === 0) && (
              <View className="empty-state">
                <View className="empty-icon">
                  <User size={48} color="#cbd5e1" />
                </View>
                <Text className="empty-text block">暂无分身执行</Text>
              </View>
            )}
          </View>
        )}

        {/* 成果展示 */}
        {activeTab === 'result' && (
          <View className="result-panel">
            {content ? (
              <View>
                {content.title && (
                  <View className="card">
                    <Text style={{ fontSize: 18, fontWeight: 600, color: '#1e293b' }} className="block">{content.title}</Text>
                  </View>
                )}
                <View className="card">
                  <View className="card-header">
                    <View className="card-icon">
                      <TrendingUp size={18} color="#64748b" />
                    </View>
                    <Text className="card-title">内容详情</Text>
                  </View>
                  <Text className="result-content-text block">{content.content}</Text>
                </View>
                {content.images && content.images.length > 0 && (
                  <View className="card">
                    <View className="card-header">
                      <View className="card-icon">
                        <FileText size={18} color="#64748b" />
                      </View>
                      <Text className="card-title">配图</Text>
                    </View>
                    <View className="images-grid">
                      {content.images.map((img, idx) => (
                        <Image
                          key={idx}
                          src={img}
                          className="grid-image"
                          mode="aspectFill"
                          onClick={() => {
                            Taro.previewImage({ urls: content.images || [], current: img })
                          }}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View className="empty-state">
                <View className="empty-icon">
                  <Sparkles size={48} color="#cbd5e1" />
                </View>
                <Text className="empty-text block">暂无成果内容</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </View>

      {/* 验收弹窗 */}
      {showRating && (
        <View
          className="modal-overlay"
          style={{ position: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowRating(false)}
        >
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title block">{allAvatarsCompleted ? '验收订单' : '验收分身'}</Text>
              <View className="modal-close" onClick={() => setShowRating(false)}>
                <X size={20} color="#64748b" />
              </View>
            </View>
            {pendingAvatars.length > 0 ? (
              <>
                <View className="pending-avatar-list">
                  {pendingAvatars.map(stat => (
                    <View key={stat.requestId} className="pending-avatar-item">
                      <View className="pending-avatar-info">
                        <View className="avatar-avatar">
                          <Text className="avatar-avatar-text block">{stat.avatarName?.charAt(0) || '?'}</Text>
                        </View>
                        <View style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Text className="pending-avatar-name block">{stat.avatarName}</Text>
                          <Text style={{ fontSize: 12, color: '#d97706' }} className="block">待验收</Text>
                        </View>
                      </View>
                      <View
                        className="accept-single-btn"
                        onClick={() => {
                          setSelectedRequestId(stat.requestId)
                          handleApprove()
                        }}
                      >
                        <Text className="block">验收</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View className="modal-footer">
                  <Button variant="outline" onClick={() => setShowRating(false)}>
                    <Text className="block">关闭</Text>
                  </Button>
                </View>
              </>
            ) : (
              <>
                <View className="rating-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <View
                      key={star}
                      className="star-item"
                      onClick={() => setRating(star)}
                    >
                      <Star
                        size={32}
                        color={star <= rating ? '#eab308' : '#e2e8f0'}
                      />
                    </View>
                  ))}
                </View>
                <Textarea
                  value={ratingComment}
                  onInput={(e: any) => setRatingComment(e.detail.value)}
                  placeholder="请输入评价（选填）"
                  className="rating-textarea"
                />
                <View className="modal-actions">
                  <View className="modal-btn modal-btn-cancel" onClick={() => setShowRating(false)}>
                    <Text className="modal-btn-cancel-text block">取消</Text>
                  </View>
                  <View className="modal-btn modal-btn-confirm" onClick={handleApprove}>
                    <Text className="modal-btn-confirm-text block">确认验收</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* 驳回弹窗 */}
      {showReject && (
        <View
          className="modal-overlay"
          style={{ position: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowReject(false)}
        >
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title block">驳回原因</Text>
              <View className="modal-close" onClick={() => setShowReject(false)}>
                <X size={20} color="#64748b" />
              </View>
            </View>
            <Textarea
              value={rejectReason}
              onInput={(e: any) => setRejectReason(e.detail.value)}
              placeholder="请输入驳回原因，帮助分身更好地修改"
              className="rating-textarea"
            />
            <View className="modal-actions">
              <View className="modal-btn modal-btn-cancel" onClick={() => setShowReject(false)}>
                <Text className="modal-btn-cancel-text block">取消</Text>
              </View>
              <View className="modal-btn modal-btn-confirm" onClick={handleReject} style={{ background: '#ef4444' }}>
                <Text className="modal-btn-confirm-text block">确认驳回</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
