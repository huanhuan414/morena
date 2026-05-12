import { useState, useEffect } from 'react'
import { View, Text, Image as TaroImage } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Wallet, Users, Target, Calendar, ChevronRight, Eye, CircleCheck, Clock } from 'lucide-react-taro'
import { Network } from '@/network'
import { getPlatformMeta, canonicalizePlatforms } from '@/constants/publish-platform'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import './index.css'

const STATUS_MAP = {
  pending_payment: { label: '待支付', color: '#F59E0B', bg: '#FEF3C7', icon: '💰' },
  open: { label: '待接单', color: '#3B82F6', bg: '#DBEAFE', icon: '📢' },
  pending_dispatch: { label: '待分配', color: '#3B82F6', bg: '#DBEAFE', icon: '📋' },
  pending_acceptance: { label: '等待接单', color: '#8B5CF6', bg: '#EDE9FE', icon: '⏳' },
  in_progress: { label: '进行中', color: '#6366F1', bg: '#EEF2FF', icon: '🔄' },
  submitted: { label: '已提交', color: '#14B8A6', bg: '#CCFBF1', icon: '📝' },
  awaiting_acceptance: { label: '待验收', color: '#F97316', bg: '#FFF7ED', icon: '✅' },
  completed: { label: '已完成', color: '#22C55E', bg: '#DCFCE7', icon: '🎉' },
  cancelled: { label: '已取消', color: '#EF4444', bg: '#FEE2E2', icon: '❌' },
  failed: { label: '失败', color: '#EF4444', bg: '#FEE2E2', icon: '⚠️' },
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
  completed: { label: '已完成', color: '#22C55E', bg: '#DCFCE7' },
}

// 点击分身卡片时，哪些状态可以查看内容
const CAN_VIEW_CONTENT = ['preview', 'publishing', 'published', 'awaiting_acceptance', 'completed', 'generating']
// 哪些状态可以查看反馈
const CAN_VIEW_FEEDBACK = ['published', 'awaiting_acceptance', 'completed']

export default function OrderDetail() {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'content' | 'feedback'>('content')
  const [dialogAvatar, setDialogAvatar] = useState<any>(null)
  const [dialogContent, setDialogContent] = useState<any>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

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

  const platformNames = () => {
    if (!order?.platforms) return []
    const arr = canonicalizePlatforms(order.platforms)
    return arr.map(p => getPlatformMeta(p)?.name || p)
  }

  // 点击分身卡片 — 弹窗查看内容/反馈
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
      // 通过 orderId + avatarId 查询内容
      const res = await Network.request({
        url: `/api/content-generation/history/avatar/${avatar.avatarId}?orderId=${order.id}`
      })
      console.log('[订单详情] 查询分身内容:', res.data)
      const rawData = res.data?.data
      if (rawData) {
        // API 可能返回单条对象或数组
        const contentItem = Array.isArray(rawData) ? rawData[0] : rawData
        setDialogContent(contentItem)
      }
    } catch (err) {
      console.error('[订单详情] 加载内容失败:', err)
    } finally {
      setDialogLoading(false)
    }
  }

  // 统一进入验收页
  const handleAcceptWork = async () => {
    if (!order) return
    Taro.navigateTo({
      url: `/pages/order/order-acceptance/index?orderId=${order.id}`
    })
  }

  // 查看发布反馈页面
  const handleViewFeedback = () => {
    if (!dialogAvatar || !dialogContent) return
    const requestId = dialogAvatar.requestId || dialogAvatar.contentId
    const orderId = order?.id
    const avatarId = dialogAvatar.avatarId || dialogAvatar.avatar_id
    Taro.navigateTo({
      url: `/pages/order/order-processing/index?requestId=${requestId}&orderId=${orderId}&avatarId=${avatarId}`
    })
    setDialogOpen(false)
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

  // 判断是否可以验收 — 发单方在待验收状态下可以确认验收
  const canAccept = order.status === 'awaiting_acceptance'

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
        {/* Status Banner — 只显示一个状态 pill */}
        <View className="od-status-banner">
          <Text className="od-status-emoji">{statusInfo.icon}</Text>
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

        {/* Avatar List — 点击弹窗查看内容/反馈 */}
        {avatarList.length > 0 && (
          <View className="od-card od-avatar-card">
            <Text className="block od-section-title">分身执行情况</Text>
            {avatarList.map((avatar: any, idx: number) => {
              const aStatus = getAvatarStatusInfo(avatar.status)
              const canView = CAN_VIEW_CONTENT.includes(avatar.status) || CAN_VIEW_FEEDBACK.includes(avatar.status)
              return (
                <View className="od-avatar-item" key={avatar.id || idx} onClick={() => canView ? handleAvatarClick(avatar) : undefined}>
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
                    {canView ? (
                      <View className="od-avatar-view-btn" style={{ background: aStatus.bg }}>
                        <Eye size={14} color={aStatus.color} />
                        <Text className="od-avatar-view-text" style={{ color: aStatus.color }}>查看</Text>
                      </View>
                    ) : (
                      <ChevronRight size={16} color="#9CA3AF" />
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Bottom Actions — 发单方视角 */}
        {canAccept && (
          <View className="od-actions">
            <View className="od-action-btn od-action-primary" onClick={handleAcceptWork}>
              <CircleCheck size={16} color="#fff" />
              <Text className="od-action-text" style={{ color: '#fff' }}>进入验收</Text>
            </View>
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
                {/* Avatar info */}
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

                {/* Content */}
                {dialogContent.content && (
                  <View className="od-dialog-section">
                    <Text className="block od-dialog-label">文案内容</Text>
                    <View className="od-dialog-text-box">
                      <Text className="block od-dialog-text">{dialogContent.content}</Text>
                    </View>
                  </View>
                )}

                {/* Images */}
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

                {/* Feedback info */}
                {dialogType === 'feedback' && (
                  <View className="od-dialog-section">
                    <Text className="block od-dialog-label">发布状态</Text>
                    <Text className="block od-dialog-feedback-status">已提交发布反馈，等待发单方验收确认</Text>
                  </View>
                )}

                {/* Action */}
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
