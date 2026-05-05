import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import './index.css'

interface AvatarStat {
  avatarId: string
  avatarName: string
  avatarAvatar: string // 后端返回的是 avatarUrl，需要映射
  avatarUrl?: string
  status: string
  statusText?: string
  postCount: number
  platformCount: number
  publishedCount: number
  feedbackCount: number
  publishFeedback?: Record<string, any>
}

interface ExecutionResult {
  avatarId: string
  avatarName: string
  avatarAvatar: string
  content: string
  url: string
  submittedAt: string
}

interface OrderDetail {
  id: string
  title: string
  description: string
  status: string
  requirements: {
    contentType: string
    platforms: string[]
    targetAudience: string
    expectedResults: string
  }
  createdAt: string
}

interface OrderStats {
  avatarStats: AvatarStat[]
  executionResults: ExecutionResult[]
  acceptedCount: number
  submittedCount: number
  completedCount: number
}

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  wechat_moments: '朋友圈',
  wechat_public: '公众号'
}

const CONTENT_TYPE_NAMES: Record<string, string> = {
  image: '图片',
  图文: '图文',
  video: '视频',
  文章: '文章'
}

// 发单者视角：分发请求状态映射
const DISPATCH_STATUS_NAMES: Record<string, string> = {
  pending: '待接受',
  accepted: '制作中',
  generating: '生成中',
  preview: '预览中',
  published: '待反馈', // 分身需要上传反馈截图和链接
  awaiting_acceptance: '待验收', // 已提交反馈，等待发单者验收
  completed: '已完成',
  cancelled: '已取消'
}

// 主订单状态映射
const ORDER_STATUS_NAMES: Record<string, string> = {
  pending: '待处理',
  accepted: '已接受',
  generating: '生成中',
  preview: '预览中',
  published: '待反馈', // 主订单需要等待所有分身反馈
  awaiting_acceptance: '待验收',
  reviewing: '审核中',
  completed: '已完成',
  cancelled: '已取消'
}

// 获取分发请求状态文本（发单者视角）
const getDispatchStatusText = (status: string) => {
  return DISPATCH_STATUS_NAMES[status] || status
}

// 获取主订单状态文本
const getOrderStatusText = (status: string) => {
  return ORDER_STATUS_NAMES[status] || status
}

export default function OrderDetail() {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'avatars' | 'results'>('overview')
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarStat | null>(null)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadOrderDetail()
  }, [])

  const loadOrderDetail = async () => {
    try {
      setLoading(true)
      const id = Taro.getStorageSync('orderId') || (Taro.getCurrentInstance().router?.params.id as string)
      if (!id) {
        setError('订单ID不存在')
        return
      }
      const res = await Network.request({
        url: `/api/order/${id}`
      })
      console.log('订单详情响应:', res.data)
      if (res.data.code === 200) {
        setOrder(res.data.data)
        // 处理 stats 数据，映射字段
        const statsData = res.data.data.stats || {
          avatarStats: [],
          executionResults: [],
          acceptedCount: 0,
          submittedCount: 0,
          completedCount: 0
        }
        // 映射 avatarUrl -> avatarAvatar
        if (statsData.avatarStats) {
          statsData.avatarStats = statsData.avatarStats.map((avatar: any) => ({
            ...avatar,
            avatarAvatar: avatar.avatarAvatar || avatar.avatarUrl || ''
          }))
        }
        setStats(statsData)
      } else {
        setError(res.data.message || '获取订单详情失败')
      }
    } catch (err: any) {
      console.error('获取订单详情失败:', err)
      setError(err.message || '获取订单详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarClick = (avatar: AvatarStat) => {
    // 根据分身状态决定跳转行为（发单者视角）
    if (avatar.status === 'pending') {
      // 未接受订单 → 查看分身主页
      Taro.navigateTo({
        url: `/pages/avatar-detail/index?id=${avatar.avatarId}`
      })
    } else if (['accepted', 'generating', 'preview'].includes(avatar.status)) {
      // 已接受订单 → 查看内容创作页面
      Taro.navigateTo({
        url: `/pages/order/order-content-creation/index?requestId=${avatar.avatarId}&orderId=${order?.id}`
      })
    } else if (['published', 'awaiting_acceptance', 'completed'].includes(avatar.status)) {
      // 已提交反馈 → 查看发布内容（发布反馈页面）
      Taro.navigateTo({
        url: `/pages/order/order-publish-feedback/index?requestId=${avatar.avatarId}&orderId=${order?.id}`
      })
    } else {
      // 默认显示弹窗
      setSelectedAvatar(avatar)
      setShowAvatarModal(true)
    }
  }

  const handleApprove = async () => {
    if (!selectedAvatar || !order) return
    try {
      setSubmitting(true)
      const res = await Network.request({
        url: `/api/order/avatar/${selectedAvatar.avatarId}/orders/${order.id}/approve`,
        method: 'POST'
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '验收成功', icon: 'success' })
        setShowAvatarModal(false)
        loadOrderDetail()
      } else {
        Taro.showToast({ title: res.data.message || '验收失败', icon: 'none' })
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '验收失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#999'
      case 'accepted':
      case 'generating': return '#ff9500'
      case 'preview': return '#007aff'
      case 'published': return '#34c759'
      case 'awaiting_acceptance': return '#5856d6'
      case 'completed': return '#00c7be'
      case 'cancelled': return '#ff3b30'
      default: return '#999'
    }
  }

  if (loading) {
    return (
      <View className="detail-container">
        <View className="loading-state">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (error || !order) {
    return (
      <View className="detail-container">
        <View className="error-state">
          <Text className="error-text">{error || '订单不存在'}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="detail-container">
      {/* 顶部导航 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={() => Taro.navigateBack()}>
          <Text className="nav-back-text">←</Text>
        </View>
        <Text className="nav-title">订单详情</Text>
        <View className="nav-share">
          <Text className="nav-share-text">...</Text>
        </View>
      </View>

      {/* Tab切换 */}
      <View className="tab-bar">
        <View 
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Text className="tab-text">订单详情</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'avatars' ? 'active' : ''}`}
          onClick={() => setActiveTab('avatars')}
        >
          <Text className="tab-text">分身进度 ({stats?.avatarStats?.length || 0})</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <Text className="tab-text">发布成果</Text>
        </View>
      </View>

      {/* Tab内容 */}
      {activeTab === 'overview' && (
        <ScrollView scrollY className="tab-scroll">
          {/* 订单状态卡片 */}
          <View className="status-card">
            <View className="status-header">
              <Text className="status-title">{order.title}</Text>
              <View className="status-badge" style={{ backgroundColor: getStatusColor(order.status) }}>
                <Text className="status-badge-text">{getOrderStatusText(order.status)}</Text>
              </View>
            </View>
            <View className="status-info">
              <Text className="status-info-text">创建时间: {new Date(order.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>

          {/* 订单要求 */}
          <View className="section-card">
            <Text className="section-title">订单要求</Text>
            <View className="info-row">
              <Text className="info-label">内容类型</Text>
              <Text className="info-value">
                {CONTENT_TYPE_NAMES[order.requirements.contentType || ''] || order.requirements.contentType || '-'}
              </Text>
            </View>
            <View className="info-row">
              <Text className="info-label">目标平台</Text>
              <View className="platform-tags">
                {order.requirements.platforms?.map(p => (
                  <View key={p} className="platform-tag">
                    <Text className="platform-text">{PLATFORM_NAMES[p] || p}</Text>
                  </View>
                )) || '-'}
              </View>
            </View>
            <View className="info-row">
              <Text className="info-label">目标受众</Text>
              <Text className="info-value">{order.requirements.targetAudience || '-'}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">预期效果</Text>
              <Text className="info-value">{order.requirements.expectedResults || '-'}</Text>
            </View>
          </View>

          {/* 订单描述 */}
          <View className="section-card">
            <Text className="section-title">订单描述</Text>
            <Text className="description-text">{order.description}</Text>
          </View>

          {/* 验收按钮 */}
          {order.status === 'awaiting_acceptance' && stats?.submittedCount && stats.submittedCount > 0 && (
            <View className="action-card">
              <View className="action-btn primary" onClick={() => setActiveTab('avatars')}>
                <Text className="action-btn-text">查看并验收分身成果</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'avatars' && (
        <ScrollView scrollY className="tab-scroll">
          {/* 分身进度列表 */}
          {stats?.avatarStats?.map(avatar => (
            <View 
              key={avatar.avatarId} 
              className="avatar-card"
              onClick={() => handleAvatarClick(avatar)}
            >
              <View className="avatar-info">
                <Image 
                  className="avatar-avatar" 
                  src={avatar.avatarAvatar || 'https://via.placeholder.com/100'} 
                />
                <View className="avatar-details">
                  <Text className="avatar-name">{avatar.avatarName}</Text>
                  <Text className="avatar-status" style={{ color: getStatusColor(avatar.status) }}>
                    {avatar.statusText || getDispatchStatusText(avatar.status)}
                  </Text>
                </View>
              </View>
              <View className="avatar-arrow">
                <Text className="arrow-text">›</Text>
              </View>
            </View>
          ))}

          {!stats?.avatarStats?.length && (
            <View className="empty-state">
              <Text className="empty-text">暂无分身接单</Text>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'results' && (
        <ScrollView scrollY className="tab-scroll">
          {stats?.executionResults?.map(result => (
            <View key={result.avatarId} className="result-card">
              <View className="result-header">
                <Image 
                  className="result-avatar" 
                  src={result.avatarAvatar || 'https://via.placeholder.com/80'} 
                />
                <View className="result-info">
                  <Text className="result-name">{result.avatarName}</Text>
                  <Text className="result-time">{new Date(result.submittedAt).toLocaleDateString()}</Text>
                </View>
              </View>
              <View className="result-content">
                <Text className="result-content-text">{result.content}</Text>
              </View>
              {result.url && (
                <View className="result-url">
                  <Text className="result-url-label">链接:</Text>
                  <Text className="result-url-text">{result.url}</Text>
                </View>
              )}
            </View>
          ))}

          {!stats?.executionResults?.length && (
            <View className="empty-state">
              <Text className="empty-text">暂无发布成果</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* 分身详情弹窗 */}
      {showAvatarModal && selectedAvatar && (
        <View className="modal-overlay" onClick={() => setShowAvatarModal(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">分身详情</Text>
              <View className="modal-close" onClick={() => setShowAvatarModal(false)}>
                <Text className="modal-close-text">×</Text>
              </View>
            </View>
            <View className="modal-body">
              <View className="modal-avatar-section">
                <Image 
                  className="modal-avatar" 
                  src={selectedAvatar.avatarAvatar || 'https://via.placeholder.com/150'} 
                />
                <Text className="modal-avatar-name">{selectedAvatar.avatarName}</Text>
                <View className="modal-status-badge" style={{ backgroundColor: getStatusColor(selectedAvatar.status) }}>
                  <Text className="modal-status-text">{selectedAvatar.statusText || getDispatchStatusText(selectedAvatar.status)}</Text>
                </View>
              </View>

              <View className="modal-stats">
                <View className="modal-stat-item">
                  <Text className="modal-stat-value">{selectedAvatar.postCount || 0}</Text>
                  <Text className="modal-stat-label">已发布</Text>
                </View>
                <View className="modal-stat-item">
                  <Text className="modal-stat-value">{selectedAvatar.publishedCount || 0}</Text>
                  <Text className="modal-stat-label">成功发布</Text>
                </View>
                <View className="modal-stat-item">
                  <Text className="modal-stat-value">{selectedAvatar.feedbackCount || 0}</Text>
                  <Text className="modal-stat-label">已反馈</Text>
                </View>
              </View>

              {selectedAvatar.publishFeedback && (
                <View className="modal-content-section">
                  <Text className="modal-section-title">发布反馈</Text>
                  <Text className="modal-content-text">{JSON.stringify(selectedAvatar.publishFeedback)}</Text>
                </View>
              )}
            </View>

            {order?.status === 'awaiting_acceptance' && selectedAvatar.feedbackCount && selectedAvatar.feedbackCount > 0 && (
              <View className="modal-footer">
                <View 
                  className="modal-btn primary" 
                  onClick={handleApprove}
                >
                  <Text className="modal-btn-text">{submitting ? '验收中...' : '验收通过'}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
