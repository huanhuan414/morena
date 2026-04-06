import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { 
  Sparkles, ChevronRight, 
  Pencil, Save, Check, X, ExternalLink, Star, ThumbsUp,
  TrendingUp, MessageCircle, Share2, Eye, Loader, Circle,
  Sparkle, ArrowRight
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

interface PlatformConfig {
  platform: string
  hasApi: boolean
  color: string
  name: string
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  { platform: 'wechat_mp', hasApi: true, color: '#07c160', name: '微信小程序' },
  { platform: 'xiaohongshu', hasApi: false, color: '#fe2c55', name: '小红书' },
  { platform: 'bilibili', hasApi: false, color: '#00a1d6', name: 'B站' },
  { platform: 'weibo', hasApi: false, color: '#ff8200', name: '微博' },
  { platform: 'douyin', hasApi: false, color: '#161823', name: '抖音' },
  { platform: 'wechat_video', hasApi: false, color: '#1aad19', name: '视频号' }
]

const STATUS_CONFIG = {
  open: { label: '待接单', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  reviewing: { label: '待验收', color: '#8b5cf6' },
  completed: { label: '已完成', color: '#22c55e' },
  cancelled: { label: '已取消', color: '#6b7280' }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const { id } = router.params
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'detail' | 'content' | 'feedback'>('detail')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: 0
  })
  
  // 验收评分
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  
  // 驳回
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  
  // 执行进度
  const [executions, setExecutions] = useState<ExecutionStep[]>([])
  
  // 数据反馈
  const [feedback, setFeedback] = useState<any>(null)

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
        const orderData = res.data.data
        setOrder(orderData)
        setFormData({
          title: orderData.title,
          description: orderData.description,
          budget: orderData.budget
        })
        
        // 获取执行进度
        if (orderData.status === 'in_progress' || orderData.status === 'reviewing') {
          fetchExecutionProgress()
        }
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const fetchExecutionProgress = async () => {
    try {
      const res = await Network.request({ url: `/api/order-dispatch/${id}/progress` })
      if (res.data?.code === 200) {
        setExecutions(res.data.data || [])
      }
    } catch (error) {
      console.error('获取执行进度失败:', error)
    }
  }

  const fetchFeedback = async () => {
    try {
      const res = await Network.request({ url: `/api/order/${id}/feedback` })
      if (res.data?.code === 200) {
        setFeedback(res.data.data)
      }
    } catch (error) {
      console.error('获取数据反馈失败:', error)
    }
  }

  useEffect(() => {
    if (activeTab === 'feedback' && !feedback) {
      fetchFeedback()
    }
  }, [activeTab])

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
    // 跳转到匹配页面重新分配
    navigateTo({
      url: `/pages/order-matching/index?orderId=${id}`
    })
  }

  const handleOpenPlatform = (url: string) => {
    if (url) {
      showToast({ title: '链接: ' + url, icon: 'none' })
    }
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check size={18} color="#22c55e" />
      case 'in_progress':
        return <Loader size={18} color="#3b82f6" className="animate-spin" />
      case 'failed':
        return <X size={18} color="#ef4444" />
      default:
        return <Circle size={18} color="rgba(255,255,255,0.3)" />
    }
  }

  if (loading) {
    return (
      <View className="order-detail-page">
        <View className="loading-state">
          <Loader size={32} color="#00f5ff" className="animate-spin" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="order-detail-page">
        <View className="error-state">
          <Circle size={48} color="#ef4444" />
          <Text className="error-text">订单不存在</Text>
        </View>
      </View>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open
  const content = order.result?.content

  return (
    <View className="order-detail-page">
      {/* 头部 */}
      <View className="detail-header">
        <View className="header-top">
          <View 
            className="back-btn"
            onClick={() => navigateBack()}
          >
            <ChevronRight size={24} color="#fff" style={{ transform: 'rotate(180deg)' }} />
          </View>
          <Text className="page-title">订单详情</Text>
          <View className="header-right">
            {!editing && order.status === 'open' && (
              <View className="edit-btn" onClick={() => setEditing(true)}>
                <Pencil size={18} color="#00f5ff" />
              </View>
            )}
          </View>
        </View>
        
        {/* 状态标签 */}
        <View className="status-badge" style={{ background: `${statusConfig.color}20` }}>
          <Text className="status-text" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Tab切换 */}
      <View className="detail-tabs">
        <View 
          className={`detail-tab ${activeTab === 'detail' ? 'active' : ''}`}
          onClick={() => setActiveTab('detail')}
        >
          <Text className="tab-text">订单详情</Text>
        </View>
        {order.result && (
          <View 
            className={`detail-tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <Text className="tab-text">内容</Text>
          </View>
        )}
        {(order.status === 'completed' || feedback) && (
          <View 
            className={`detail-tab ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            <Text className="tab-text">数据</Text>
          </View>
        )}
      </View>

      <ScrollView className="detail-content" scrollY>
        {/* 订单详情 */}
        {activeTab === 'detail' && (
          <View className="tab-panel">
            {/* 基本信息 */}
            <View className="info-section">
              <Text className="section-title">基本信息</Text>
              
              {editing ? (
                <View className="edit-form">
                  <View className="form-item">
                    <Text className="form-label">标题</Text>
                    <Input 
                      value={formData.title}
                      onInput={(e: any) => setFormData({...formData, title: e.detail.value})}
                      placeholder="请输入订单标题"
                      className="mt-2"
                    />
                  </View>
                  <View className="form-item">
                    <Text className="form-label">描述</Text>
                    <Textarea
                      value={formData.description}
                      onInput={(e: any) => setFormData({...formData, description: e.detail.value})}
                      placeholder="请输入订单描述"
                      className="mt-2"
                    />
                  </View>
                  <View className="form-actions">
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      <Text>取消</Text>
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      <Save size={16} color="#fff" />
                      <Text>{saving ? '保存中...' : '保存'}</Text>
                    </Button>
                  </View>
                </View>
              ) : (
                <>
                  <View className="info-row">
                    <Text className="info-label">标题</Text>
                    <Text className="info-value">{order.title}</Text>
                  </View>
                  <View className="info-row">
                    <Text className="info-label">描述</Text>
                    <Text className="info-value">{order.description || '暂无描述'}</Text>
                  </View>
                  <View className="info-row">
                    <Text className="info-label">预算</Text>
                    <Text className="info-value budget">¥{order.budget || 0}</Text>
                  </View>
                </>
              )}
            </View>

            {/* 需求 */}
            {order.requirements && (
              <View className="info-section">
                <Text className="section-title">需求</Text>
                {order.requirements.platforms && order.requirements.platforms.length > 0 && (
                  <View className="info-row">
                    <Text className="info-label">发布平台</Text>
                    <View className="platform-tags">
                      {order.requirements.platforms.map((p, idx) => (
                        <View key={idx} className="platform-tag">
                          <Text className="tag-text">{p}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {order.requirements.targetAudience && (
                  <View className="info-row">
                    <Text className="info-label">目标受众</Text>
                    <Text className="info-value">{order.requirements.targetAudience}</Text>
                  </View>
                )}
                {order.requirements.contentType && (
                  <View className="info-row">
                    <Text className="info-label">内容类型</Text>
                    <Text className="info-value">{order.requirements.contentType}</Text>
                  </View>
                )}
                {order.requirements.expectedResults && (
                  <View className="info-row">
                    <Text className="info-label">预期效果</Text>
                    <Text className="info-value">{order.requirements.expectedResults}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 执行进度 */}
            {executions.length > 0 && (
              <View className="info-section">
                <Text className="section-title">执行进度</Text>
                <View className="exec-steps">
                  {executions.map((step, idx) => (
                    <View key={step.id} className="exec-step">
                      <View className="step-indicator">
                        {getStepIcon(step.status)}
                        {idx < executions.length - 1 && (
                          <View className={`step-line ${step.status === 'completed' ? 'completed' : ''}`} />
                        )}
                      </View>
                      <View className="step-content">
                        <Text className="step-name">{step.step_name}</Text>
                        {step.description && (
                          <Text className="step-desc">{step.description}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 驳回原因 */}
            {order.rejection && (
              <View className="info-section rejection">
                <View className="rejection-header">
                  <Circle size={18} color="#f59e0b" />
                  <Text className="rejection-title">被驳回</Text>
                </View>
                <Text className="rejection-reason">{order.rejection.reason}</Text>
              </View>
            )}

            {/* 评分 */}
            {order.rating && (
              <View className="info-section">
                <Text className="section-title">您的评分</Text>
                <View className="rating-display">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star}
                      size={24}
                      color={star <= order.rating!.score ? '#eab308' : 'rgba(255,255,255,0.2)'}
                    />
                  ))}
                </View>
                {order.rating.comment && (
                  <Text className="rating-comment">{order.rating.comment}</Text>
                )}
              </View>
            )}

            {/* 分身信息 */}
            {order.avatars && (
              <View className="info-section">
                <Text className="section-title">执行分身</Text>
                <View className="avatar-card">
                  <View className="avatar-avatar">
                    {order.avatars.avatar_url ? (
                      <Image src={order.avatars.avatar_url} className="avatar-img" />
                    ) : (
                      <Sparkles size={24} color="#00f5ff" />
                    )}
                  </View>
                  <View className="avatar-info">
                    <Text className="avatar-name">{order.avatars.name}</Text>
                    {order.avatars.level && (
                      <Text className="avatar-level">Lv.{order.avatars.level}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* 时间信息 */}
            <View className="info-section">
              <View className="info-row">
                <Text className="info-label">创建时间</Text>
                <Text className="info-value">{new Date(order.created_at).toLocaleString()}</Text>
              </View>
              {order.completed_at && (
                <View className="info-row">
                  <Text className="info-label">完成时间</Text>
                  <Text className="info-value">{new Date(order.completed_at).toLocaleString()}</Text>
                </View>
              )}
            </View>

            {/* 操作按钮 */}
            <View className="action-section">
              {order.status === 'open' && !order.avatars && (
                <>
                  <Button onClick={handleRetryDispatch} className="dispatch-btn">
                    <Sparkle size={18} color="#fff" />
                    <Text className="dispatch-btn-text">AI智能匹配分身</Text>
                    <View className="dispatch-btn-arrow">
                      <ArrowRight size={16} color="#fff" />
                    </View>
                  </Button>
                  <Button variant="ghost" onClick={handleCancel}>
                    <Text style={{ color: '#ef4444' }}>取消订单</Text>
                  </Button>
                </>
              )}
              
              {order.status === 'reviewing' && (
                <>
                  <Button onClick={() => setShowRating(true)} className="w-full approve-btn">
                    <Check size={16} color="#fff" />
                    <Text>验收通过</Text>
                  </Button>
                  <Button variant="outline" onClick={() => setShowReject(true)}>
                    <X size={16} color="#fff" />
                    <Text>驳回修改</Text>
                  </Button>
                </>
              )}
            </View>
          </View>
        )}

        {/* 内容 */}
        {activeTab === 'content' && content && (
          <View className="tab-panel">
            <View className="content-section">
              {content.title && (
                <Text className="content-title">{content.title}</Text>
              )}
              <Text className="content-text">{content.content}</Text>
              
              {content.images && content.images.length > 0 && (
                <View className="content-images">
                  {content.images.map((img, idx) => (
                    <Image key={idx} src={img} className="content-image" mode="aspectFill" />
                  ))}
                </View>
              )}
              
              {content.platform_results && content.platform_results.length > 0 && (
                <View className="publish-results">
                  <Text className="section-title">发布结果</Text>
                  {content.platform_results.map((result, idx) => {
                    const config = PLATFORM_CONFIGS.find(p => p.platform === result.platform)
                    return (
                      <View key={idx} className="publish-item">
                        <View className="publish-platform">
                          <Text className="platform-name">{config?.name || result.platform}</Text>
                          <View className={`publish-status ${result.status}`}>
                            <Text className="status-text">
                              {result.status === 'published' ? '已发布' : '待发布'}
                            </Text>
                          </View>
                        </View>
                        {result.post_url && (
                          <View 
                            className="publish-link"
                            onClick={() => handleOpenPlatform(result.post_url!)}
                          >
                            <Text className="link-text">查看链接</Text>
                            <ExternalLink size={14} color="#00f5ff" />
                          </View>
                        )}
                        {!config?.hasApi && !result.post_url && (
                          <View className="manual-publish">
                            <Text className="publish-tip">需要手动发布</Text>
                            <Button size="sm" variant="outline">
                              <ExternalLink size={14} color="#fff" />
                              <Text>获取指引</Text>
                            </Button>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* 数据反馈 */}
        {activeTab === 'feedback' && (
          <View className="tab-panel">
            {feedback ? (
              <View className="feedback-section">
                <View className="summary-cards">
                  <View className="summary-card">
                    <Eye size={24} color="#3b82f6" />
                    <Text className="summary-num">{feedback.summary?.totalReach || 0}</Text>
                    <Text className="summary-label">总曝光</Text>
                  </View>
                  <View className="summary-card">
                    <ThumbsUp size={24} color="#22c55e" />
                    <Text className="summary-num">{feedback.summary?.totalLikes || 0}</Text>
                    <Text className="summary-label">总点赞</Text>
                  </View>
                  <View className="summary-card">
                    <MessageCircle size={24} color="#8b5cf6" />
                    <Text className="summary-num">{feedback.summary?.totalComments || 0}</Text>
                    <Text className="summary-label">总评论</Text>
                  </View>
                  <View className="summary-card">
                    <Share2 size={24} color="#f59e0b" />
                    <Text className="summary-num">{feedback.summary?.totalShares || 0}</Text>
                    <Text className="summary-label">总转发</Text>
                  </View>
                </View>
                
                {feedback.platformStats && feedback.platformStats.length > 0 && (
                  <View className="platform-stats">
                    <Text className="section-title">各平台数据</Text>
                    {feedback.platformStats.map((stat: any, idx: number) => (
                      <View key={idx} className="platform-stat-item">
                        <View className="platform-stat-header">
                          <Text className="stat-platform">{stat.platform}</Text>
                        </View>
                        <View className="stat-details">
                          <View className="stat-item">
                            <Text className="stat-label">曝光</Text>
                            <Text className="stat-value">{stat.reach || 0}</Text>
                          </View>
                          <View className="stat-item">
                            <Text className="stat-label">点赞</Text>
                            <Text className="stat-value">{stat.likes || 0}</Text>
                          </View>
                          <View className="stat-item">
                            <Text className="stat-label">评论</Text>
                            <Text className="stat-value">{stat.comments || 0}</Text>
                          </View>
                          <View className="stat-item">
                            <Text className="stat-label">转发</Text>
                            <Text className="stat-value">{stat.shares || 0}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View className="empty-feedback">
                <TrendingUp size={48} color="rgba(255,255,255,0.2)" />
                <Text className="empty-text">暂无数据反馈</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 验收弹窗 */}
      {showRating && (
        <View className="modal-overlay" onClick={() => setShowRating(false)}>
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <Text className="modal-title">验收评价</Text>
            
            <View className="rating-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <View 
                  key={star}
                  className="star-btn"
                  onClick={() => setRating(star)}
                >
                  <Star 
                    size={36}
                    color={star <= rating ? '#eab308' : 'rgba(255,255,255,0.2)'}
                  />
                </View>
              ))}
            </View>
            
            <View className="comment-input">
              <Textarea
                value={ratingComment}
                onInput={(e: any) => setRatingComment(e.detail.value)}
                placeholder="请输入评价（选填）"
              />
            </View>
            
            <View className="modal-actions">
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
            <Text className="modal-title">驳回原因</Text>
            
            <View className="reject-input">
              <Textarea
                value={rejectReason}
                onInput={(e: any) => setRejectReason(e.detail.value)}
                placeholder="请输入驳回原因，帮助分身更好地修改"
              />
            </View>
            
            <View className="modal-actions">
              <Button variant="outline" onClick={() => setShowReject(false)}>
                <Text>取消</Text>
              </Button>
              <Button onClick={handleReject}>
                <Text>确认驳回</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
