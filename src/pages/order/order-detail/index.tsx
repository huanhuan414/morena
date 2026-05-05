import Taro, { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: '待接单', className: 'status-pending' },
  in_progress: { label: '进行中', className: 'status-accepted' },
  reviewing: { label: '待验收', className: 'status-generating' },
  completed: { label: '已完成', className: 'status-completed' },
  cancelled: { label: '已取消', className: 'status-cancelled' }
}

const AVATAR_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: '待接单', className: 'avatar-status-pending' },
  accepted: { label: '已接受', className: 'avatar-status-accepted' },
  generating: { label: '创作中', className: 'avatar-status-generating' },
  preview: { label: '待发布', className: 'avatar-status-generating' },
  published: { label: '已发布', className: 'avatar-status-generating' },
  awaiting_acceptance: { label: '待验收', className: 'avatar-status-awaiting' },
  completed: { label: '已完成', className: 'avatar-status-completed' }
}

// Markdown 解析函数
const parseContent = (content: string) => {
  if (!content) return []
  
  const lines = content.split('\n')
  const result: Array<{ type: string; content?: string; level?: number; items?: string[]; alt?: string; url?: string }> = []
  
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    
    // 图片 ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      result.push({ type: 'image', alt: imgMatch[1], url: imgMatch[2] })
      i++
      continue
    }
    
    // 标题
    const h3Match = line.match(/^###\s+(.+)/)
    if (h3Match) {
      result.push({ type: 'heading', content: h3Match[1], level: 3 })
      i++
      continue
    }
    
    const h2Match = line.match(/^##\s+(.+)/)
    if (h2Match) {
      result.push({ type: 'heading', content: h2Match[1], level: 2 })
      i++
      continue
    }
    
    const h1Match = line.match(/^#\s+(.+)/)
    if (h1Match) {
      result.push({ type: 'heading', content: h1Match[1], level: 1 })
      i++
      continue
    }
    
    // 无序列表
    const ulMatch = line.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      const items = [ulMatch[1]]
      i++
      while (i < lines.length) {
        const nextMatch = lines[i].match(/^[-*]\s+(.+)/)
        if (nextMatch) {
          items.push(nextMatch[1])
          i++
        } else {
          break
        }
      }
      result.push({ type: 'list', items, content: '' })
      continue
    }
    
    // 有序列表
    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      const items = [olMatch[1]]
      i++
      while (i < lines.length) {
        const nextMatch = lines[i].match(/^\d+\.\s+(.+)/)
        if (nextMatch) {
          items.push(nextMatch[1])
          i++
        } else {
          break
        }
      }
      result.push({ type: 'olist', items, content: '' })
      continue
    }
    
    // 普通段落
    if (line.trim()) {
      result.push({ type: 'paragraph', content: line })
    }
    
    i++
  }
  
  return result
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

  const [statusBarHeight, setStatusBarHeight] = useState(20)

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
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const avatarStats = order?.summary_stats?.avatarStats || []
  const allAvatarsCompleted = avatarStats.length > 0 && avatarStats.every((s: AvatarStat) => s.status === 'completed')
  const pendingAvatars = avatarStats.filter((s: AvatarStat) => s.status === 'awaiting_acceptance')

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
        const pendingAvatar = pendingAvatars[0]
        const res = await Network.request({
          url: `/api/order-processing/accept/${pendingAvatar.requestId}`,
          method: 'PUT'
        })

        if (res.data?.code === 200) {
          showToast({ title: `已验收「${pendingAvatar.avatarName}」`, icon: 'success' })
          setShowRating(false)
          fetchOrder()
        }
      } else {
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

  const handleAvatarClick = (stat: AvatarStat) => {
    const routes: Record<string, string> = {
      'pending': `/pages/avatar-profile/index?id=${stat.avatarId}`,
      'accepted': `/pages/order/order-content-creation/index?requestId=${stat.requestId}&orderId=${id}`,
      'generating': `/pages/order/order-content-creation/index?requestId=${stat.requestId}&orderId=${id}`,
      'preview': `/pages/order/order-content-creation/index?requestId=${stat.requestId}&orderId=${id}`,
      'publishing': `/pages/order/order-content-creation/index?requestId=${stat.requestId}&orderId=${id}`,
      'published': `/pages/order-publish-feedback/index?requestId=${stat.requestId}&orderId=${id}`,
      'feedback_submitted': `/pages/order-publish-feedback/index?requestId=${stat.requestId}&orderId=${id}`,
      'awaiting_acceptance': `/pages/order-acceptance-feedback/index?requestId=${stat.requestId}&orderId=${id}`,
      'completed': `/pages/order-completed/index?requestId=${stat.requestId}&orderId=${id}`
    }
    
    const route = routes[stat.status]
    if (route) {
      Taro.navigateTo({ url: route })
    }
  }

  if (loading) {
    return (
      <View className="order-detail-page">
        <View className="loading-container">
          <Loader size={48} color="#7B3FE4" className="animate-spin" />
          <Text className="loading-text block">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="order-detail-page">
        <View className="error-container">
          <Circle size={64} color="#EF4444" />
          <Text className="error-text block">订单不存在</Text>
        </View>
      </View>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.open
  const content = order.result?.content

  return (
    <View className="order-detail-page">
      {/* 顶部导航 */}
      <View className="nav-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="nav-content">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </View>
          <Text className="nav-title">订单详情</Text>
          <View className="nav-actions">
            {editing ? (
              <>
                <View className="edit-btn edit-btn-default" onClick={() => setEditing(false)}>
                  <X size={20} color="#FFFFFF" />
                </View>
                <View className="edit-btn edit-btn-save" onClick={handleSave}>
                  {saving ? <Loader size={20} color="#7B3FE4" /> : <Save size={20} color="#7B3FE4" />}
                </View>
              </>
            ) : order?.status === 'open' ? (
              <View className="edit-btn edit-btn-default" onClick={() => setEditing(true)}>
                <Pencil size={20} color="#FFFFFF" />
              </View>
            ) : (
              <View style={{ width: '72rpx' }} />
            )}
          </View>
        </View>
      </View>

      <ScrollView className="main-scroll" scrollY>
        {/* 订单头部卡片 */}
        <View className="order-header-card">
          <View className="order-title-row">
            <Text className="order-title block">{order.title}</Text>
            <View className={`status-badge ${statusConfig.className}`}>
              <Text className="block">{statusConfig.label}</Text>
            </View>
          </View>
          <View className="order-info-row">
            <View className="info-item">
              <DollarSign size={18} color="#7B3FE4" />
              <Text className="info-label">预算</Text>
              <Text className="info-value info-value-budget">¥{order.budget || 0}</Text>
            </View>
            <View className="info-item">
              <Calendar size={18} color="#666666" />
              <Text className="info-label">{formatDate(order.deadline || order.created_at)}</Text>
            </View>
            <View className="info-item">
              <Users size={18} color="#666666" />
              <Text className="info-label">{order.expected_quantity || 1}人</Text>
            </View>
          </View>
        </View>

        {/* Tab 切换器 */}
        <View className="tab-container">
          <View className="tab-list">
            <View
              className={`tab-item ${activeTab === 'detail' ? 'tab-item-active' : ''}`}
              onClick={() => setActiveTab('detail')}
            >
              <FileText 
                size={28} 
                color={activeTab === 'detail' ? '#FFFFFF' : '#7B3FE4'} 
                className="tab-item-icon"
              />
              <Text className="tab-item-text block">订单详情</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 'progress' ? 'tab-item-active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <Users 
                size={28} 
                color={activeTab === 'progress' ? '#FFFFFF' : '#7B3FE4'} 
                className="tab-item-icon"
              />
              <Text className="tab-item-text block">执行进度</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 'result' ? 'tab-item-active' : ''}`}
              onClick={() => setActiveTab('result')}
            >
              <Sparkles 
                size={28} 
                color={activeTab === 'result' ? '#FFFFFF' : '#7B3FE4'} 
                className="tab-item-icon"
              />
              <Text className="tab-item-text block">成果展示</Text>
            </View>
          </View>
        </View>

        {/* 订单详情 */}
        {activeTab === 'detail' && (
          <View className="content-section">
            {/* 订单描述 */}
            <View className="section-card">
              <View className="section-header">
                <View className="section-icon">
                  <FileText size={24} color="#7B3FE4" />
                </View>
                <Text className="section-title block">订单描述</Text>
              </View>
              {editing ? (
                <Textarea
                  value={formData.description}
                  onInput={(e: any) => setFormData({ ...formData, description: e.detail.value })}
                  placeholder="请输入订单描述"
                  className="edit-textarea"
                />
              ) : (
                <View className="markdown-content">
                  {order.description ? (
                    parseContent(order.description).map((block, idx) => {
                      if (block.type === 'heading') {
                        return (
                          <Text key={idx} className={`block markdown-h${block.level}`}>
                            {block.content}
                          </Text>
                        )
                      }
                      if (block.type === 'paragraph') {
                        return (
                          <Text key={idx} className="block markdown-paragraph">
                            {block.content}
                          </Text>
                        )
                      }
                      if (block.type === 'list' || block.type === 'olist') {
                        return (
                          <View key={idx} className="markdown-list">
                            {block.items?.map((item, i) => (
                              <View key={i} className="markdown-list-item">
                                <Text className="block markdown-bullet">{block.type === 'olist' ? `${i + 1}.` : '•'}</Text>
                                <Text className="block markdown-list-text">{item}</Text>
                              </View>
                            ))}
                          </View>
                        )
                      }
                      if (block.type === 'image' && block.url) {
                        return (
                          <View key={idx} className="markdown-image-wrapper">
                            <Image
                              className="markdown-image"
                              src={block.url}
                              mode="widthFix"
                              onClick={() => {
                                Taro.previewImage({ current: block.url, urls: [block.url!] })
                              }}
                            />
                          </View>
                        )
                      }
                      return null
                    })
                  ) : (
                    <Text className="block detail-value-empty">暂无描述</Text>
                  )}
                </View>
              )}
            </View>

            {/* 需求详情 */}
            {order.requirements && (
              <View className="section-card">
                <View className="section-header">
                  <View className="section-icon">
                    <Zap size={24} color="#7B3FE4" />
                  </View>
                  <Text className="section-title block">需求详情</Text>
                </View>
                
                {order.requirements.platforms && order.requirements.platforms.length > 0 && (
                  <View className="detail-row">
                    <Text className="detail-label block">发布平台</Text>
                    <View className="platform-tags">
                      {order.requirements.platforms.map((p, idx) => (
                        <View key={idx} className="platform-tag platform-tag-active">
                          <Text className="block">{getPlatformName(p)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                
                {order.requirements.contentType && (
                  <View className="detail-row">
                    <Text className="detail-label block">内容类型</Text>
                    <Text className="detail-value block">{order.requirements.contentType}</Text>
                  </View>
                )}
                
                {order.requirements.targetAudience && (
                  <View className="detail-row">
                    <Text className="detail-label block">目标受众</Text>
                    <Text className="detail-value block">{order.requirements.targetAudience}</Text>
                  </View>
                )}
                
                {order.requirements.expectedResults && (
                  <View className="detail-row">
                    <Text className="detail-label block">预期效果</Text>
                    <Text className="detail-value block">{order.requirements.expectedResults}</Text>
                  </View>
                )}
                
                {order.deadline && (
                  <View className="detail-row">
                    <Text className="detail-label block">截止日期</Text>
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8rpx' }}>
                      <Clock size={18} color="#7B3FE4" />
                      <Text className="detail-value block">{formatDate(order.deadline)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 执行分身 */}
            {order.avatars && !order.summary_stats && (
              <View className="section-card">
                <View className="section-header">
                  <View className="section-icon">
                    <User size={24} color="#7B3FE4" />
                  </View>
                  <Text className="section-title block">执行分身</Text>
                </View>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24rpx' }}>
                  <View className="avatar-avatar">
                    {order.avatars.avatar_url ? (
                      <Image src={order.avatars.avatar_url} className="avatar-avatar-image" />
                    ) : (
                      <Text className="avatar-avatar-text block">{order.avatars.name?.charAt(0) || '?'}</Text>
                    )}
                  </View>
                  <View style={{ display: 'flex', flexDirection: 'column', gap: '8rpx' }}>
                    <Text style={{ fontSize: '32rpx', fontWeight: 600, color: '#1A1A2E' }} className="block">{order.avatars.name}</Text>
                    {order.avatars.level && (
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8rpx' }}>
                        <Star size={16} color="#F59E0B" />
                        <Text style={{ fontSize: '24rpx', color: '#666666' }} className="block">Lv.{order.avatars.level}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* 操作按钮 */}
            {order.status === 'open' && !order.avatars && (
              <View className="action-section">
                <View className="action-btn action-btn-primary" onClick={() => navigateTo({ url: `/pages/order/order-matching/index?orderId=${id}` })}>
                  <Sparkles size={22} color="#FFFFFF" />
                  <Text className="block">AI智能匹配分身</Text>
                </View>
                <View className="action-btn action-btn-secondary" onClick={handleCancel}>
                  <Text className="block" style={{ color: '#EF4444' }}>取消订单</Text>
                </View>
              </View>
            )}

            {allAvatarsCompleted && (
              <View className="action-section">
                <View className="action-btn action-btn-primary" onClick={() => setShowRating(true)}>
                  <Check size={22} color="#FFFFFF" />
                  <Text className="block">验收订单</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 执行进度 */}
        {activeTab === 'progress' && (
          <View className="content-section">
            {avatarStats.length > 0 && (
              <>
                {/* 统计卡片 */}
                <View className="stats-card">
                  <View className="stats-row">
                    <View className="stat-item">
                      <Text className="stat-value block">{order.summary_stats?.totalAvatars || 0}</Text>
                      <Text className="stat-label block">总分身</Text>
                    </View>
                    <View className="stat-item">
                      <Text className="stat-value block">{order.summary_stats?.acceptedAvatars || 0}</Text>
                      <Text className="stat-label block">已接受</Text>
                    </View>
                    <View className="stat-item">
                      <Text className="stat-value block">{order.summary_stats?.submittedAvatars || 0}</Text>
                      <Text className="stat-label block">已提交</Text>
                    </View>
                  </View>
                </View>

                {/* 分身列表 */}
                <View className="section-card">
                  <View className="section-header">
                    <View className="section-icon">
                      <Users size={24} color="#7B3FE4" />
                    </View>
                    <Text className="section-title block">分身列表</Text>
                  </View>
                  
                  <View className="avatar-list">
                    {avatarStats.map((stat: AvatarStat, index: number) => {
                      const avatarStatus = AVATAR_STATUS_CONFIG[stat.status] || AVATAR_STATUS_CONFIG.pending
                      return (
                        <View
                          key={index}
                          className="avatar-item"
                          onClick={() => handleAvatarClick(stat)}
                        >
                          <View className="avatar-avatar">
                            {stat.avatarUrl ? (
                              <Image src={stat.avatarUrl} className="avatar-avatar-image" />
                            ) : (
                              <Text className="avatar-avatar-text block">{stat.avatarName?.charAt(0) || '?'}</Text>
                            )}
                          </View>
                          <View className="avatar-info">
                            <Text className="avatar-name block">{stat.avatarName}</Text>
                            <Text className="avatar-meta block">
                              {stat.postCount > 0 && `${stat.postCount}个作品`}
                              {stat.totalViews > 0 && ` · ${stat.totalViews}次曝光`}
                            </Text>
                          </View>
                          {stat.status === 'completed' && (
                            <View className="avatar-status avatar-status-completed">
                              <Check size={16} color="#10B981" />
                              <Text className="block">已完成</Text>
                            </View>
                          )}
                          {stat.status === 'awaiting_acceptance' && (
                            <View className="pending-btn">
                              <Text className="block">待验收</Text>
                            </View>
                          )}
                          {stat.status !== 'completed' && stat.status !== 'awaiting_acceptance' && (
                            <View className={`avatar-status ${avatarStatus.className}`}>
                              <Text className="block">{avatarStatus.label}</Text>
                            </View>
                          )}
                        </View>
                      )
                    })}
                  </View>
                </View>
              </>
            )}

            {/* 空状态 */}
            {avatarStats.length === 0 && (
              <View className="empty-state">
                <User size={64} color="#CBD5E1" />
                <Text className="empty-text block">暂无分身执行</Text>
              </View>
            )}
          </View>
        )}

        {/* 成果展示 */}
        {activeTab === 'result' && (
          <View className="content-section">
            {content ? (
              <>
                {content.title && (
                  <View className="section-card">
                    <Text style={{ fontSize: '36rpx', fontWeight: 700, color: '#1A1A2E' }} className="block">{content.title}</Text>
                  </View>
                )}
                
                <View className="section-card">
                  <View className="section-header">
                    <View className="section-icon">
                      <TrendingUp size={24} color="#7B3FE4" />
                    </View>
                    <Text className="section-title block">内容详情</Text>
                  </View>
                  <Text className="detail-value block" style={{ lineHeight: 1.8 }}>{content.content}</Text>
                </View>
                
                {content.images && content.images.length > 0 && (
                  <View className="section-card">
                    <View className="section-header">
                      <View className="section-icon">
                        <FileText size={24} color="#7B3FE4" />
                      </View>
                      <Text className="section-title block">配图展示</Text>
                    </View>
                    <View className="images-grid">
                      {content.images.map((img, idx) => (
                        <Image
                          key={idx}
                          src={img}
                          className="grid-image"
                          mode="aspectFill"
                          onClick={() => Taro.previewImage({ urls: content.images || [], current: img })}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View className="empty-state">
                <Sparkles size={64} color="#CBD5E1" />
                <Text className="empty-text block">暂无成果内容</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 验收弹窗 */}
      {showRating && (
        <View className="modal-overlay" onClick={() => setShowRating(false)}>
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <Text className="modal-title block">{allAvatarsCompleted ? '验收订单' : '验收分身'}</Text>
            
            {pendingAvatars.length > 0 ? (
              <>
                <View className="pending-list">
                  {pendingAvatars.map((stat: AvatarStat) => (
                    <View key={stat.requestId} className="pending-item">
                      <View className="avatar-avatar">
                        <Text className="avatar-avatar-text block">{stat.avatarName?.charAt(0) || '?'}</Text>
                      </View>
                      <View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4rpx' }}>
                        <Text style={{ fontSize: '30rpx', fontWeight: 600, color: '#1A1A2E' }} className="block">{stat.avatarName}</Text>
                        <Text style={{ fontSize: '24rpx', color: '#F59E0B' }} className="block">待验收</Text>
                      </View>
                      <View
                        className="pending-btn"
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
                <View className="modal-actions">
                  <View className="modal-btn modal-btn-cancel" onClick={() => setShowRating(false)}>
                    <Text className="block">关闭</Text>
                  </View>
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
                      <Star size={40} color={star <= rating ? '#F59E0B' : '#E2E8F0'} />
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
                    <Text className="block">取消</Text>
                  </View>
                  <View className="modal-btn modal-btn-confirm" onClick={handleApprove}>
                    <Text className="block">确认验收</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
