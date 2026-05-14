import { useState, useEffect } from 'react'
import { View, Text, Image as TaroImage } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  ArrowLeft, Wallet, Users, Target, Calendar, ChevronRight, Eye,
  CircleCheck, Clock, TriangleAlert, CircleX,
  RefreshCw, MessageSquare, Zap, Timer, ArrowRightLeft, Info
} from 'lucide-react-taro'
import { Network } from '@/network'
import { getPlatformMeta, canonicalizePlatforms } from '@/constants/publish-platform'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import './index.css'

/* ── 状态映射 ── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending_payment: { label: '待支付', color: '#F59E0B', bg: '#FEF3C7', icon: '💰' },
    pending: { label: '待接单', color: '#3B82F6', bg: '#DBEAFE', icon: '📢' },
    pending_acceptance: { label: '等待接单', color: '#8B5CF6', bg: '#EDE9FE', icon: '⏳' },
    in_progress: { label: '进行中', color: '#6366F1', bg: '#EEF2FF', icon: '🔄' },
    content_generated: { label: '内容已生成', color: '#14B8A6', bg: '#CCFBF1', icon: '✍️' },
    submitted: { label: '已提交', color: '#14B8A6', bg: '#CCFBF1', icon: '📝' },
    awaiting_acceptance: { label: '待验收', color: '#F97316', bg: '#FFF7ED', icon: '✅' },
    published: { label: '已发布', color: '#22C55E', bg: '#DCFCE7', icon: '🚀' },
    publish_failed: { label: '发布失败', color: '#EF4444', bg: '#FEE2E2', icon: '⚠️' },
    publish_timeout: { label: '发布超时', color: '#F97316', bg: '#FFF7ED', icon: '⏰' },
    completed: { label: '已完成', color: '#22C55E', bg: '#DCFCE7', icon: '🎉' },
    cancelled: { label: '已取消', color: '#EF4444', bg: '#FEE2E2', icon: '❌' },
    auto_cancelled: { label: '自动取消', color: '#EF4444', bg: '#FEE2E2', icon: '🚫' },
    timeout: { label: '已超时', color: '#F97316', bg: '#FFF7ED', icon: '⏰' },
    expired: { label: '已过期', color: '#EF4444', bg: '#FEE2E2', icon: '🗑️' },
    accepted: { label: '已接单', color: '#6366F1', bg: '#EEF2FF', icon: '✅' },
  }

const AVATAR_STATUS_MAP = {
  pending: { label: '待接单', color: '#9CA3AF', bg: '#F3F4F6' },
  accepted: { label: '已接单', color: '#6366F1', bg: '#EEF2FF' },
  generating: { label: '生成中', color: '#6366F1', bg: '#EEF2FF' },
  preview: { label: '待发布', color: '#22C55E', bg: '#DCFCE7' },
  publishing: { label: '发布中', color: '#14B8A6', bg: '#CCFBF1' },
  published: { label: '已发布', color: '#14B8A6', bg: '#CCFBF1' },
  awaiting_acceptance: { label: '待验收', color: '#F97316', bg: '#FFF7ED' },
  failed: { label: '失败', color: '#EF4444', bg: '#FEE2E2' },
  declined: { label: '已婉拒', color: '#9CA3AF', bg: '#F3F4F6' },
  expired: { label: '已过期', color: '#EF4444', bg: '#FEE2E2' },
  timeout: { label: '已超时', color: '#F97316', bg: '#FFF7ED' },
  completed: { label: '已完成', color: '#22C55E', bg: '#DCFCE7' },
}

/* ── 事件图标 & 颜色映射 ── */
const EVENT_ICON_MAP = {
  created: { icon: Zap, color: '#6366F1' },
  dispatched: { icon: Users, color: '#3B82F6' },
  accepted: { icon: CircleCheck, color: '#22C55E' },
  rejected: { icon: CircleX, color: '#EF4444' },
  expired: { icon: Timer, color: '#F97316' },
  content_started: { icon: RefreshCw, color: '#6366F1' },
  content_completed: { icon: CircleCheck, color: '#22C55E' },
  content_failed: { icon: CircleX, color: '#EF4444' },
  publish_started: { icon: ArrowRightLeft, color: '#8B5CF6' },
  publish_completed: { icon: CircleCheck, color: '#22C55E' },
  publish_failed: { icon: CircleX, color: '#EF4444' },
  publish_verified: { icon: CircleCheck, color: '#14B8A6' },
  revision_requested: { icon: MessageSquare, color: '#F59E0B' },
  reassign: { icon: ArrowRightLeft, color: '#8B5CF6' },
  timeout_warning: { icon: TriangleAlert, color: '#F97316' },
  auto_cancel: { icon: CircleX, color: '#EF4444' },
  cancel: { icon: CircleX, color: '#EF4444' },
  completed: { icon: CircleCheck, color: '#22C55E' },
}

/* ── 进度管道阶段 ── */
const PIPELINE_STAGES = [
  { key: 'dispatched', label: '已派单' },
  { key: 'accepted', label: '已接单' },
  { key: 'content_completed', label: '内容就绪' },
  { key: 'publish_completed', label: '已发布' },
  { key: 'completed', label: '已完成' },
]

const CAN_VIEW_CONTENT = ['preview', 'publishing', 'published', 'awaiting_acceptance', 'completed', 'generating']
const CAN_VIEW_FEEDBACK = ['published', 'awaiting_acceptance', 'completed']

export default function OrderDetail() {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'content' | 'feedback'>('content')
  const [dialogAvatar, setDialogAvatar] = useState<any>(null)
  const [dialogContent, setDialogContent] = useState<any>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('avatars')

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const orderId = params.orderId || params.id
    if (orderId) {
      loadOrder(orderId)
      loadEvents(orderId)
    } else {
      setLoading(false)
    }
  }, [])

  const loadOrder = async (orderId: string) => {
    try {
      console.log('[订单详情] 加载订单:', orderId)
      const res = await Network.request({ url: `/api/order/${orderId}` })
      console.log('[订单详情] 响应:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setOrder(res.data.data)
      }
    } catch (err) {
      console.error('[订单详情] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async (orderId: string) => {
    setEventsLoading(true)
    try {
      console.log('[订单详情] 加载事件流:', orderId)
      const res = await Network.request({ url: `/api/order-dispatch/events/${orderId}?visibility=publisher&limit=50` })
      console.log('[订单详情] 事件响应:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setEvents(Array.isArray(res.data.data) ? res.data.data : [])
      }
    } catch (err) {
      console.error('[订单详情] 加载事件失败:', err)
    } finally {
      setEventsLoading(false)
    }
  }

  const getStatusInfo = (status: string) => STATUS_MAP[status] || { label: status, color: '#6B7280', bg: '#F3F4F6', icon: '📋' }
  const getAvatarStatusInfo = (status: string) => AVATAR_STATUS_MAP[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' }

  const safeStr = (v: unknown): string => {
    if (!v || typeof v !== 'string') return ''
    return v
  }

  const formatTime = (t: string | object) => {
    if (!t || typeof t !== 'string') return '--'
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return '--'
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatEventTime = (t: string | object) => {
    if (!t || typeof t !== 'string') return '--'
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return '--'
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}小时前`
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const platformNames = () => {
    if (!order?.platforms) return []
    const arr = canonicalizePlatforms(order.platforms)
    return arr.map(p => getPlatformMeta(p)?.name || p)
  }

  /* ── 计算进度管道当前阶段 ── */
  const getPipelineProgress = () => {
    const stats = order?.summary_stats || {}
    const total = stats.totalAvatars || order?.avatarCount || 1
    return {
      dispatched: Math.min(total, (stats.acceptedAvatars || 0) + (stats.pendingAvatars || 0)),
      accepted: stats.acceptedAvatars || 0,
      content_completed: stats.totalGenerated || 0,
      publish_completed: stats.totalPublished || 0,
      completed: stats.completedAvatars || 0,
    }
  }

  /* ── 异常统计 ── */
  const getAlertCount = () => {
    const stats = order?.summary_stats || {}
    return (stats.expiredAvatars || 0) + (stats.timeoutAvatars || 0) + (stats.failedAvatars || 0)
  }

  const handleAvatarClick = async (avatar: any) => {
    const status = avatar.status || avatar.contentStatus
    if (!CAN_VIEW_CONTENT.includes(status) && !CAN_VIEW_FEEDBACK.includes(status)) {
      Taro.showToast({ title: '该分身暂无内容可查看', icon: 'none' })
      return
    }

    setDialogAvatar(avatar)
    setDialogType(CAN_VIEW_FEEDBACK.includes(status) ? 'feedback' : 'content')
    setDialogOpen(true)
    setDialogLoading(true)
    setDialogContent(null)

    try {
      const res = await Network.request({
        url: `/api/content-generation/history/avatar/${avatar.avatarId}?orderId=${order.id}`
      })
      console.log('[订单详情] 查询分身内容:', res.data)
      const rawData = res.data?.data
      if (rawData) {
        const contentItem = Array.isArray(rawData) ? rawData[0] : rawData
        setDialogContent(contentItem)
      }
    } catch (err) {
      console.error('[订单详情] 加载内容失败:', err)
    } finally {
      setDialogLoading(false)
    }
  }

  const handleAcceptWork = async () => {
    if (!order) return
    Taro.navigateTo({
      url: `/package-order/pages/order-acceptance/index?orderId=${order.id}`
    })
  }

  const handleRepay = async () => {
    if (!order?.id) return
    try {
      Taro.showLoading({ title: '创建支付...' })
      // 先获取openid
      let openid = ''
      try {
        const loginRes = await Taro.login()
        if (loginRes.code) {
          const openidRes = await Network.request({
            url: '/api/user/openid',
            method: 'GET',
            data: { code: loginRes.code },
          })
          openid = openidRes?.data?.data?.openid || ''
        }
      } catch (e) {
        console.warn('[OrderDetail] 获取openid失败:', e)
      }
      if (!openid) {
        Taro.hideLoading()
        Taro.showToast({ title: '获取支付信息失败，请重试', icon: 'none' })
        return
      }
      // 调用重新支付接口
      const res = await Network.request({
        url: `/api/order/${order.id}/repay`,
        method: 'POST',
        data: { openid },
      })
      Taro.hideLoading()
      const payload = res?.data
      if (payload?.code === 200 && payload?.data?.payment) {
        const payment = payload.data.payment
        try {
          await Taro.requestPayment({
            timeStamp: payment.timeStamp,
            nonceStr: payment.nonceStr,
            package: payment.packageValue,
            signType: payment.signType || 'MD5',
            paySign: payment.paySign,
          })
          Taro.showToast({ title: '支付成功', icon: 'success' })
          // 开始轮询确认后端状态
          startStatusPolling(order.id)
        } catch (payErr: any) {
          const errMsg = String(payErr?.errMsg || payErr?.message || '')
          if (errMsg.includes('cancel') || errMsg.includes('取消')) {
            Taro.showToast({ title: '支付已取消', icon: 'none' })
          } else {
            Taro.showToast({ title: '支付失败，请稍后重试', icon: 'none' })
          }
        }
      } else {
        Taro.showToast({ title: payload?.message || '创建支付失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误，请重试', icon: 'none' })
    }
  }

  const handleViewFeedback = () => {
    if (!dialogAvatar || !dialogContent) return
    const requestId = dialogAvatar.requestId || dialogAvatar.contentId
    const orderId = order?.id
    const avatarId = dialogAvatar.avatarId || dialogAvatar.avatar_id
    Taro.navigateTo({
      url: `/package-order/pages/order-processing/index?requestId=${requestId}&orderId=${orderId}&avatarId=${avatarId}`
    })
    setDialogOpen(false)
  }

  /* ── 取消订单 ── */
  const handleCancel = async () => {
    if (!order?.id) return
    const confirmRes = await Taro.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？取消后不可恢复。',
      confirmColor: '#EF4444',
    })
    if (!confirmRes.confirm) return
    try {
      Taro.showLoading({ title: '取消中...' })
      const res = await Network.request({
        url: `/api/order/${order.id}/cancel`,
        method: 'POST',
      })
      Taro.hideLoading()
      if (res?.data?.code === 200) {
        Taro.showToast({ title: '订单已取消', icon: 'success' })
        setTimeout(() => loadOrder(order.id), 1500)
      } else {
        Taro.showToast({ title: res?.data?.message || '取消失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  /* ── 删除订单 ── */
  const handleDelete = async () => {
    if (!order?.id) return
    const confirmRes = await Taro.showModal({
      title: '删除订单',
      content: '确定要删除此订单吗？删除后不可恢复。',
      confirmColor: '#EF4444',
    })
    if (!confirmRes.confirm) return
    try {
      Taro.showLoading({ title: '删除中...' })
      const res = await Network.request({
        url: `/api/order/${order.id}`,
        method: 'DELETE',
      })
      Taro.hideLoading()
      if (res?.data?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        Taro.showToast({ title: res?.data?.message || '删除失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  /* ── 支付后状态轮询 ── */
  const startStatusPolling = (orderId: string) => {
    let pollCount = 0
    const maxPolls = 20 // 最多轮询20次（约30秒）
    const pollInterval = setInterval(async () => {
      pollCount++
      try {
        const res = await Network.request({ url: `/api/order/${orderId}` })
        const orderData = res?.data?.data
        if (orderData && orderData.status !== 'pending_payment') {
          clearInterval(pollInterval)
          setOrder(orderData)
          Taro.showToast({ title: '订单状态已更新', icon: 'success' })
          return
        }
      } catch (e) {
        console.warn('[OrderDetail] 轮询失败:', e)
      }
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval)
      }
    }, 1500)
  }

  /* ── 获取事件图标组件 ── */
  const getEventIcon = (eventType: string) => {
    const mapping = EVENT_ICON_MAP[eventType]
    if (!mapping) return Info
    return mapping.icon
  }
  const getEventColor = (eventType: string) => {
    const mapping = EVENT_ICON_MAP[eventType]
    return mapping?.color || '#6B7280'
  }

  if (loading) {
    return (
      <View className="od-page">
        <View className="od-loading">
          <Clock size={32} color="#6366F1" className="od-loading-icon" />
          <Text className="block od-loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="od-page">
        <View className="od-loading">
          <Text className="block od-loading-text">订单不存在</Text>
        </View>
      </View>
    )
  }

  const statusInfo = getStatusInfo(order.status)
  const stats = order.summary_stats || {}
  const avatarList = order.avatarStats || stats.avatarStats || []
  const canAccept = order.status === 'awaiting_acceptance'
  const canPay = order.status === 'pending_payment'
  const canCancel = ['pending_payment', 'pending'].includes(order.status)
  const canDelete = ['completed', 'cancelled', 'auto_cancelled', 'timeout', 'expired'].includes(order.status)
  const pipelineProgress = getPipelineProgress()
  const alertCount = getAlertCount()

  return (
    <View className="od-page">
      {/* Header */}
      <View className="od-header">
        <View className="od-header-deco1" />
        <View className="od-header-deco2" />
        <View className="od-header-bar">
          <View className="od-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#fff" />
          </View>
          <View className="od-header-center">
            <Text className="block od-header-title">订单详情</Text>
            <Text className="block od-header-sub">追踪订单进度，管理分身任务</Text>
          </View>
          <View className="od-header-right" />
        </View>
        {/* Status Banner */}
        <View className="od-status-banner">
          <Text className="od-status-emoji">{statusInfo.icon}</Text>
          <View className="od-status-pill" style={{ background: statusInfo.bg }}>
            <Text className="od-status-pill-text" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
          </View>
          {alertCount > 0 && (
            <View className="od-alert-pill">
              <TriangleAlert size={12} color="#fff" />
              <Text className="od-alert-pill-text">{alertCount}个异常</Text>
            </View>
          )}
        </View>
      </View>

      <View className="od-body">
        {/* Order Info Card */}
        <View className="od-card od-info-card">
          <Text className="block od-card-title">{order.title}</Text>
          {order.description ? <Text className="block od-card-desc">{order.description}</Text> : null}
          <View className="od-info-pills">
            {platformNames().map((name, i) => (
              <View className="od-pill od-pill-platform" key={i}>
                <Text className="od-pill-text">{name}</Text>
              </View>
            ))}
            {order.orderType ? (
              <View className="od-pill od-pill-type">
                <Text className="od-pill-text">{order.orderType === 'image_text' ? '图文' : order.orderType === 'video' ? '视频' : '文案'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Pipeline Progress — 5阶段管道 */}
        <View className="od-card od-pipeline-card">
          <Text className="block od-section-title">订单进度</Text>
          <View className="od-pipeline">
            {PIPELINE_STAGES.map((stage, idx) => {
              const count = pipelineProgress[stage.key] || 0
              const total = stats.totalAvatars || order.avatarCount || 1
              const isActive = count > 0
              const isLast = idx === PIPELINE_STAGES.length - 1
              return (
                <View className="od-pipe-stage" key={stage.key}>
                  <View className="od-pipe-node-wrap">
                    <View
                      className="od-pipe-node"
                      style={{
                        background: isActive ? 'linear-gradient(135deg, #6366F1, #A855F7)' : '#E5E7EB',
                      }}
                    >
                      {isActive ? (
                        <CircleCheck size={14} color="#fff" />
                      ) : (
                        <View className="od-pipe-node-empty" />
                      )}
                    </View>
                    {!isLast && (
                      <View
                        className="od-pipe-line"
                        style={{ background: isActive ? '#6366F1' : '#E5E7EB' }}
                      />
                    )}
                  </View>
                  <Text className="block od-pipe-label" style={{ color: isActive ? '#6366F1' : '#9CA3AF' }}>
                    {stage.label}
                  </Text>
                  {isActive && (
                    <Text className="block od-pipe-count">{count}/{total}</Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        {/* Stats Grid */}
        <View className="od-card od-stats-card">
          <View className="od-stats-row">
            <View className="od-stat-item">
              <Wallet size={16} color="#6366F1" className="od-stat-icon" />
              <Text className="block od-stat-value">¥{order.budget || '0'}</Text>
              <Text className="block od-stat-label">预算</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Users size={16} color="#6366F1" className="od-stat-icon" />
              <Text className="block od-stat-value">{stats.totalAvatars || order.avatarCount || 0}</Text>
              <Text className="block od-stat-label">分身</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Target size={16} color="#6366F1" className="od-stat-icon" />
              <Text className="block od-stat-value">{order.expectedQuantity || order.quantityPerAvatar || '-'}</Text>
              <Text className="block od-stat-label">数量/分身</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Calendar size={16} color="#6366F1" className="od-stat-icon" />
              <Text className="block od-stat-value">{formatTime(order.createdAt)}</Text>
              <Text className="block od-stat-label">创建时间</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher: Avatars / Events */}
        <View className="od-tab-card od-card">
          <View className="od-tab-header">
            <View
              className={`od-tab-btn ${activeTab === 'avatars' ? 'od-tab-active' : ''}`}
              onClick={() => setActiveTab('avatars')}
            >
              <Users size={14} color={activeTab === 'avatars' ? '#6366F1' : '#9CA3AF'} />
              <Text className="od-tab-text" style={{ color: activeTab === 'avatars' ? '#6366F1' : '#9CA3AF' }}>
                分身状态 ({avatarList.length})
              </Text>
            </View>
            <View
              className={`od-tab-btn ${activeTab === 'events' ? 'od-tab-active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <Clock size={14} color={activeTab === 'events' ? '#6366F1' : '#9CA3AF'} />
              <Text className="od-tab-text" style={{ color: activeTab === 'events' ? '#6366F1' : '#9CA3AF' }}>
                事件动态 ({events.length})
              </Text>
            </View>
          </View>

          {/* Avatar List Tab */}
          {activeTab === 'avatars' && (
            <View className="od-tab-content">
              {avatarList.length === 0 ? (
                <View className="od-empty">
                  <Text className="block od-empty-text">暂无分身分配</Text>
                </View>
              ) : (
                avatarList.map((avatar: any, idx: number) => {
                  const aStatus = getAvatarStatusInfo(avatar.status)
                  const canView = CAN_VIEW_CONTENT.includes(avatar.status) || CAN_VIEW_FEEDBACK.includes(avatar.status)
                  const isAbnormal = ['expired', 'timeout', 'failed', 'declined'].includes(avatar.status)
                  return (
                    <View
                      className={`od-avatar-item ${isAbnormal ? 'od-avatar-abnormal' : ''}`}
                      key={avatar.id || idx}
                      onClick={() => canView ? handleAvatarClick(avatar) : undefined}
                    >
                      <View className="od-avatar-left">
                        {avatar.avatarUrl ? (
                          <View className="od-avatar-img-wrap">
                            <TaroImage className="od-avatar-img" src={avatar.avatarUrl} mode="aspectFill" />
                          </View>
                        ) : (
                          <View className="od-avatar-fallback">
                            <Text className="od-avatar-fallback-text">{(avatar.avatarName || avatar.nickname || '?')[0]}</Text>
                          </View>
                        )}
                        <View className="od-avatar-info">
                          <Text className="block od-avatar-name">{avatar.avatarName || avatar.nickname || '分身'}</Text>
                          <View className="od-avatar-status-wrap">
                            {isAbnormal && <TriangleAlert size={10} color="#EF4444" />}
                            <View className="od-avatar-status-dot" style={{ background: aStatus.color }} />
                            <Text className="od-avatar-status-text" style={{ color: aStatus.color }}>{aStatus.label}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="od-avatar-right">
                        {canView ? (
                          <View className="od-avatar-view-btn" style={{ background: aStatus.bg }}>
                            <Eye size={14} color={aStatus.color} />
                            <Text className="od-avatar-view-text" style={{ color: aStatus.color }}>查看</Text>
                          </View>
                        ) : isAbnormal ? (
                          <View className="od-avatar-reassign-btn">
                            <RefreshCw size={12} color="#8B5CF6" />
                            <Text className="od-avatar-reassign-text">转派</Text>
                          </View>
                        ) : (
                          <ChevronRight size={16} color="#9CA3AF" />
                        )}
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          )}

          {/* Event Timeline Tab */}
          {activeTab === 'events' && (
            <View className="od-tab-content">
              {eventsLoading ? (
                <View className="od-events-loading">
                  <Clock size={20} color="#6366F1" />
                  <Text className="block od-events-loading-text">加载事件流...</Text>
                </View>
              ) : events.length === 0 ? (
                <View className="od-empty">
                  <Text className="block od-empty-text">暂无事件记录</Text>
                </View>
              ) : (
                <View className="od-timeline">
                  {events.map((event: any, idx: number) => {
                    const IconComp = getEventIcon(event.eventType)
                    const iconColor = getEventColor(event.eventType)
                    return (
                      <View className="od-timeline-item" key={event.id || idx}>
                        <View className="od-timeline-left">
                          <View className="od-timeline-dot" style={{ background: iconColor }}>
                            <IconComp size={10} color="#fff" />
                          </View>
                          {idx < events.length - 1 && <View className="od-timeline-line" />}
                        </View>
                        <View className="od-timeline-right">
                          <View className="od-timeline-header">
                            <Text className="block od-timeline-title" style={{ color: iconColor }}>{event.title}</Text>
                            <Text className="block od-timeline-time">{formatEventTime(event.createdAt)}</Text>
                          </View>
                          {event.content && (
                            <Text className="block od-timeline-desc">{event.content}</Text>
                          )}
                          {event.avatarName && (
                            <View className="od-timeline-avatar-tag">
                              <Users size={10} color="#6366F1" />
                              <Text className="od-timeline-avatar-name">{event.avatarName}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Requirements */}
        {(safeStr(order.requirements) || order.targetAudience) && (
          <View className="od-card od-req-card">
            <Text className="block od-section-title">订单要求</Text>
            {order.targetAudience ? (
              <View className="od-req-item">
                <Text className="block od-req-label">目标人群</Text>
                <Text className="block od-req-value">{order.targetAudience}</Text>
              </View>
            ) : null}
            {safeStr(order.requirements) ? (
              <View className="od-req-item">
                <Text className="block od-req-label">详细要求</Text>
                <Text className="block od-req-value">{safeStr(order.requirements)}</Text>
              </View>
            ) : null}
            {order.deadline ? (
              <View className="od-req-item">
                <Text className="block od-req-label">截止时间</Text>
                <Text className="block od-req-value">{formatTime(order.deadline)}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Bottom Actions */}
        {(canAccept || canPay || canCancel || canDelete) && (
          <View className="od-actions">
            {canDelete && (
              <View className="od-action-btn od-action-danger" onClick={handleDelete}>
                <CircleX size={16} color="#EF4444" />
                <Text className="od-action-text" style={{ color: '#EF4444' }}>删除订单</Text>
              </View>
            )}
            {canCancel && !canPay && (
              <View className="od-action-btn od-action-danger" onClick={handleCancel}>
                <CircleX size={16} color="#EF4444" />
                <Text className="od-action-text" style={{ color: '#EF4444' }}>取消订单</Text>
              </View>
            )}
            {canPay && (
              <View className="od-action-btn od-action-primary" onClick={handleRepay}>
                <Wallet size={16} color="#fff" />
                <Text className="od-action-text" style={{ color: '#fff' }}>立即支付 ¥{order.budget || order.totalPrice || '0'}</Text>
              </View>
            )}
            {canAccept && (
              <View className="od-action-btn od-action-primary" onClick={handleAcceptWork}>
                <CircleCheck size={16} color="#fff" />
                <Text className="od-action-text" style={{ color: '#fff' }}>进入验收</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Content/Feedback Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="od-dialog-content">
          <DialogHeader>
            <DialogTitle className="od-dialog-title">
              {dialogType === 'feedback' ? '发布反馈' : '生成内容'}
            </DialogTitle>
          </DialogHeader>
          <View className="od-dialog-body">
            {dialogLoading ? (
              <View className="od-dialog-loading">
                <Clock size={24} color="#6366F1" />
                <Text className="block od-dialog-loading-text">加载中...</Text>
              </View>
            ) : dialogContent ? (
              <View className="od-dialog-detail">
                <View className="od-dialog-avatar-row">
                  {dialogAvatar?.avatarUrl ? (
                    <TaroImage className="od-dialog-avatar-img" src={dialogAvatar.avatarUrl} mode="aspectFill" />
                  ) : (
                    <View className="od-dialog-avatar-fallback">
                      <Text className="od-dialog-avatar-fallback-text">{(dialogAvatar?.avatarName || '?')[0]}</Text>
                    </View>
                  )}
                  <Text className="block od-dialog-avatar-name">{dialogAvatar?.avatarName || '分身'}</Text>
                  <View className="od-dialog-avatar-pill" style={{ background: getAvatarStatusInfo(dialogAvatar?.status).bg }}>
                    <Text className="od-dialog-avatar-pill-text" style={{ color: getAvatarStatusInfo(dialogAvatar?.status).color }}>
                      {getAvatarStatusInfo(dialogAvatar?.status).label}
                    </Text>
                  </View>
                </View>

                {dialogContent.content && (
                  <View className="od-dialog-section">
                    <Text className="block od-dialog-label">文案内容</Text>
                    <View className="od-dialog-text-box">
                      <Text className="block od-dialog-text">{dialogContent.content}</Text>
                    </View>
                  </View>
                )}

                {dialogContent.images && Array.isArray(dialogContent.images) && dialogContent.images.length > 0 && (
                  <View className="od-dialog-section">
                    <Text className="block od-dialog-label">配图 ({dialogContent.images.length}张)</Text>
                    <View className="od-dialog-images">
                      {dialogContent.images.map((img: string, i: number) => (
                        <TaroImage key={i} className="od-dialog-img" src={img} mode="aspectFill" onClick={() => Taro.previewImage({ urls: dialogContent.images, current: img })} />
                      ))}
                    </View>
                  </View>
                )}

                {dialogType === 'feedback' && (
                  <View className="od-dialog-section">
                    <Text className="block od-dialog-label">发布状态</Text>
                    <Text className="block od-dialog-feedback-status">已提交发布反馈，等待发单方验收确认</Text>
                  </View>
                )}

                {dialogType === 'feedback' && (
                  <View className="od-dialog-actions">
                    <Button className="od-dialog-btn" onClick={handleViewFeedback}>
                      <Text>查看反馈详情</Text>
                    </Button>
                  </View>
                )}
              </View>
            ) : (
              <View className="od-dialog-empty">
                <Text className="block od-dialog-empty-text">暂无内容</Text>
              </View>
            )}
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
