import { useState, useEffect } from 'react'
import { View, Text, Image as TaroImage } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Wallet, Users, Target, ChevronRight, Bell, Loader, Calendar } from 'lucide-react-taro'
import { Network } from '@/network'
import { getPlatformMeta, canonicalizePlatforms } from '@/constants/publish-platform'
import './index.css'

const STATUS_MAP = {
  pending_payment: { label: '待支付', color: '#F59E0B', bg: '#FEF3C7' },
  open: { label: '待接单', color: '#3B82F6', bg: '#DBEAFE' },
  pending_dispatch: { label: '待分配', color: '#3B82F6', bg: '#DBEAFE' },
  pending_acceptance: { label: '等待接单', color: '#8B5CF6', bg: '#EDE9FE' },
  in_progress: { label: '进行中', color: '#6366F1', bg: '#EEF2FF' },
  submitted: { label: '已提交', color: '#14B8A6', bg: '#CCFBF1' },
  awaiting_acceptance: { label: '待验收', color: '#F97316', bg: '#FFF7ED' },
  completed: { label: '已完成', color: '#22C55E', bg: '#DCFCE7' },
  cancelled: { label: '已取消', color: '#EF4444', bg: '#FEE2E2' },
  failed: { label: '失败', color: '#EF4444', bg: '#FEE2E2' },
}

const AVATAR_STATUS_MAP = {
  pending: { label: '待接单', color: '#9CA3AF', bg: '#F3F4F6' },
  accepted: { label: '已接单', color: '#6366F1', bg: '#EEF2FF' },
  in_progress: { label: '生成中', color: '#6366F1', bg: '#EEF2FF' },
  processing: { label: '生成中', color: '#6366F1', bg: '#EEF2FF' },
  generating_images: { label: '配图生成中', color: '#6366F1', bg: '#EEF2FF' },
  completed: { label: '已完成', color: '#22C55E', bg: '#DCFCE7' },
  published: { label: '已发布', color: '#14B8A6', bg: '#CCFBF1' },
  feedback_submitted: { label: '已提交反馈', color: '#F97316', bg: '#FFF7ED' },
  reviewing: { label: '待验收', color: '#F97316', bg: '#FFF7ED' },
  settled: { label: '已结算', color: '#22C55E', bg: '#DCFCE7' },
  done: { label: '已完成', color: '#22C55E', bg: '#DCFCE7' },
  failed: { label: '失败', color: '#EF4444', bg: '#FEE2E2' },
  declined: { label: '已婉拒', color: '#9CA3AF', bg: '#F3F4F6' },
}

export default function OrderDetail() {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const orderId = params.orderId || params.id
    if (orderId) {
      loadOrder(orderId)
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

  const getStatusInfo = (status: string) => STATUS_MAP[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' }
  const getAvatarStatusInfo = (status: string) => AVATAR_STATUS_MAP[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' }

  // Safe string check — objects/dates converted to {} by convertKeysToCamel are not valid React children
  const safeStr = (v: unknown): string => {
    if (!v || typeof v !== 'string') return ''
    return v
  }

  const formatTime = (t: string | object) => {
    if (!t || typeof t !== 'string') return '--'
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return '--'
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const platformNames = () => {
    if (!order?.platforms) return []
    const arr = canonicalizePlatforms(order.platforms)
    return arr.map(p => getPlatformMeta(p)?.name || p)
  }

  const handleUrgeAcceptance = async () => {
    if (!order) return
    try {
      await Network.request({
        url: '/api/notifications/urge-review',
        method: 'POST',
        data: { orderId: order.id, contentTitle: `订单「${order.title}」催验收提醒` }
      })
      Taro.showToast({ title: '催验收提醒已发送', icon: 'success' })
    } catch {
      Taro.showToast({ title: '发送失败', icon: 'none' })
    }
  }

  const handleNavigateToContent = (avatarId: string) => {
    Taro.navigateTo({ url: `/pages/generated-content/index?avatarId=${avatarId}` })
  }

  if (loading) {
    return (
      <View className="od-page">
        <View className="od-loading">
          <Loader size={32} color="#6366F1" className="od-loading-icon" />
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
          <View className="od-status-dot" style={{ background: statusInfo.color }} />
          <Text className="od-status-label" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
          <View className="od-status-pill" style={{ background: statusInfo.bg }}>
            <Text className="od-status-pill-text" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
          </View>
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

        {/* Progress Summary */}
        <View className="od-card od-progress-card">
          <Text className="block od-section-title">任务进度</Text>
          <View className="od-progress-bar-track">
            <View className="od-progress-bar-fill" style={{ width: `${Math.min(100, ((stats.totalPublished || 0) / Math.max(1, stats.totalAvatars || 1)) * 100)}%` }} />
          </View>
          <View className="od-progress-steps">
            <View className="od-progress-step">
              <Text className="block od-step-value">{stats.acceptedAvatars || 0}</Text>
              <Text className="block od-step-label">已接单</Text>
            </View>
            <View className="od-progress-step">
              <Text className="block od-step-value">{stats.totalPublished || 0}</Text>
              <Text className="block od-step-label">已发布</Text>
            </View>
            <View className="od-progress-step">
              <Text className="block od-step-value">{stats.completedAvatars || 0}</Text>
              <Text className="block od-step-label">已完成</Text>
            </View>
          </View>
        </View>

        {/* Requirements */}
        {(order.requirements || order.targetAudience) && (
          <View className="od-card od-req-card">
            <Text className="block od-section-title">订单要求</Text>
            {order.targetAudience ? (
              <View className="od-req-item">
                <Text className="block od-req-label">目标人群</Text>
                <Text className="block od-req-value">{order.targetAudience}</Text>
              </View>
            ) : null}
            {(safeStr(order.requirements)) ? (
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

        {/* Avatar List */}
        {avatarList.length > 0 && (
          <View className="od-card od-avatar-card">
            <Text className="block od-section-title">分身执行情况</Text>
            {avatarList.map((avatar: any, idx: number) => {
              const aStatus = getAvatarStatusInfo(avatar.status)
              return (
                <View className="od-avatar-item" key={avatar.id || idx} onClick={() => handleNavigateToContent(avatar.avatarId)}>
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
                        <View className="od-avatar-status-dot" style={{ background: aStatus.color }} />
                        <Text className="od-avatar-status-text" style={{ color: aStatus.color }}>{aStatus.label}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="od-avatar-right">
                    <View className="od-avatar-status-pill" style={{ background: aStatus.bg }}>
                      <Text className="od-avatar-status-pill-text" style={{ color: aStatus.color }}>{aStatus.label}</Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View className="od-actions">
          {order.status === 'awaiting_acceptance' && (
            <View className="od-action-btn od-action-primary" onClick={handleUrgeAcceptance}>
              <Bell size={16} color="#fff" className="od-action-icon" />
              <Text className="od-action-text" style={{ color: '#fff' }}>催促验收</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
