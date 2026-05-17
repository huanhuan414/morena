import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import {
  ArrowLeft, Loader, Users, CircleCheckBig, CircleX, Clock,
  CreditCard, Send, Trash2,
  FileText, CircleDot, Camera, Video, ChevronDown, ChevronUp, Play, Eye, Image as ImageIcon
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

// ===== 平台名称映射 =====
const PLATFORM_MAP: Record<string, string> = {
  xiaohongshu: '小红书',
  wechat_moments: '朋友圈',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  zhihu: '知乎',
  kuaishou: '快手',
}

// ===== 内容类型映射 =====
const CONTENT_TYPE_MAP: Record<string, { label: string; icon: any }> = {
  text: { label: '纯文案', icon: FileText },
  image_text: { label: '图文', icon: Camera },
  article: { label: '长文', icon: FileText },
  image: { label: '图片', icon: Camera },
  video: { label: '短视频', icon: Video },
}

// ===== 状态配置 =====
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; phase: number; desc: string }> = {
  pending_payment:    { label: '待支付',   color: '#F59E0B', bgColor: '#FEF3C7', phase: 0, desc: '请尽快完成支付，超时订单将自动取消' },
  pending:            { label: '匹配中',   color: '#7C3AED', bgColor: '#F5F3FF', phase: 1, desc: '系统正在为你匹配合适的分身' },
  awaiting_acceptance:{ label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', phase: 1, desc: '分身正在确认接单' },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', phase: 1, desc: '分身正在确认接单' },
  accepted:           { label: '已接单',   color: '#10B981', bgColor: '#ECFDF5', phase: 2, desc: '分身已接单，正在制作内容' },
  in_progress:        { label: '制作中',   color: '#10B981', bgColor: '#ECFDF5', phase: 2, desc: '分身正在创作内容' },
  content_generated:  { label: '已生成',   color: '#8B5CF6', bgColor: '#F5F3FF', phase: 2, desc: '内容已生成，等待发布' },
  submitted:          { label: '待发布',   color: '#8B5CF6', bgColor: '#F5F3FF', phase: 3, desc: '内容已提交，即将发布' },
  published:          { label: '已发布',   color: '#059669', bgColor: '#ECFDF5', phase: 3, desc: '内容已成功发布' },
  pending_verify:     { label: '待验收',   color: '#F59E0B', bgColor: '#FEF3C7', phase: 4, desc: '内容已发布，请验收确认' },
  revision_requested: { label: '待修改',   color: '#F97316', bgColor: '#FFF7ED', phase: 2, desc: '已发起修改，请等待分身重新提交' },
  completed:          { label: '已完成',   color: '#059669', bgColor: '#ECFDF5', phase: 5, desc: '订单已全部完成' },
  publish_failed:     { label: '发布失败', color: '#EF4444', bgColor: '#FEF2F2', phase: -1, desc: '发布遇到问题，请查看详情' },
  publish_timeout:    { label: '发布超时', color: '#EF4444', bgColor: '#FEF2F2', phase: -1, desc: '发布超时，请查看详情' },
  cancelled:          { label: '已取消',   color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单已取消' },
  auto_cancelled:     { label: '自动取消', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单因超时自动取消' },
  timeout:            { label: '已超时',   color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单已超时' },
  expired:            { label: '已过期',   color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单已过期' },
}

// 5阶段进度定义
const PHASES = [
  { key: 'match', label: '匹配', icon: Users },
  { key: 'create', label: '制作', icon: FileText },
  { key: 'publish', label: '发布', icon: Send },
  { key: 'verify', label: '验收', icon: CircleCheckBig },
  { key: 'done', label: '完成', icon: CircleCheckBig },
]

function getPhaseIndex(status: string): number {
  const phase = STATUS_CONFIG[status]?.phase ?? -1
  if (phase <= 0) return -1
  if (phase === 1) return 0
  if (phase === 2) return 1
  if (phase === 3) return 2
  if (phase === 4) return 3
  if (phase === 5) return 4
  return -1
}

// 事件图标映射
const EVENT_ICONS: Record<string, any> = {
  created: CircleDot,
  dispatched: Send,
  accepted: CircleCheckBig,
  rejected: CircleX,
  completed: CircleCheckBig,
  cancelled: CircleX,
  payment_success: CircleCheckBig,
  content_generated: FileText,
  content_submitted: Send,
  content_published: CircleCheckBig,
  publish_failed: CircleX,
  timeout: Clock,
}

const EVENT_COLORS: Record<string, string> = {
  created: '#3B82F6',
  dispatched: '#6366F1',
  accepted: '#10B981',
  rejected: '#EF4444',
  completed: '#059669',
  cancelled: '#9CA3AF',
  payment_success: '#10B981',
  content_generated: '#8B5CF6',
  content_submitted: '#F59E0B',
  content_published: '#059669',
  publish_failed: '#EF4444',
  timeout: '#F59E0B',
}

const EVENT_LABELS: Record<string, string> = {
  created: '订单已创建',
  dispatched: '已派单',
  accepted: '分身已接单',
  rejected: '分身已拒绝',
  completed: '订单已完成',
  cancelled: '订单已取消',
  payment_success: '支付成功',
  content_generated: '内容已生成',
  content_submitted: '内容已提交',
  content_published: '内容已发布',
  publish_failed: '发布失败',
  timeout: '派单超时',
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

export default function OrderDetailPage() {
  const [order, setOrder] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [expandedAvatarIds, setExpandedAvatarIds] = useState<Set<string>>(new Set())
  const pollingRef = useRef<any>(null)
  const statusBarHeight = getStatusBarHeight()

  const orderId = Taro.getCurrentInstance().router?.params?.id
  const action = Taro.getCurrentInstance().router?.params?.action

  const fetchDetail = useCallback(async () => {
    if (!orderId) return
    try {
      const [orderRes, eventRes] = await Promise.all([
        Network.request({ url: `/api/order/${orderId}` }),
        Network.request({ url: `/api/order-dispatch/${orderId}/timeline` }).catch(() => ({ data: { data: [] } })),
      ])
      console.log('[OrderDetail] order:', JSON.stringify(orderRes.data)?.substring(0, 200))
      const orderData = orderRes.data?.data || orderRes.data
      setOrder(orderData)

      // 事件时间线 - 后端返回的是数组
      const evtData = eventRes.data?.data
      const evts = Array.isArray(evtData) ? evtData : (evtData?.events || [])
      setEvents(evts)
    } catch (err) {
      console.error('[OrderDetail] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  // 如果是从支付跳转过来的，轮询状态
  useEffect(() => {
    if (action === 'pay' && order?.status === 'pending_payment') {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await Network.request({ url: `/api/order/${orderId}` })
          const data = res.data?.data || res.data
          if (data?.isPaid || data?.is_paid || (data?.status && data.status !== 'pending_payment')) {
            setOrder(data)
            clearInterval(pollingRef.current)
          }
        } catch { /* ignore */ }
      }, 3000)
      setTimeout(() => clearInterval(pollingRef.current), 60000)
    }
    return () => clearInterval(pollingRef.current)
  }, [action, order?.status, orderId])

  // ===== 支付 =====
  const handlePay = useCallback(async () => {
    if (paying) return
    setPaying(true)
    try {
      const loginRes = await Taro.login()
      const openidRes = await Network.request({ url: `/api/user/openid?code=${loginRes.code}` })
      const openid = openidRes.data?.data?.openid
      if (!openid) {
        Taro.showToast({ title: '获取支付信息失败', icon: 'none' })
        return
      }

      const payRes = await Network.request({
        url: `/api/order/${orderId}/repay`,
        method: 'POST',
        data: { openid },
      })
      const payment = payRes.data?.data?.payment
      if (!payment) {
        Taro.showToast({ title: payRes.data?.message || '创建支付失败', icon: 'none' })
        return
      }

      await Taro.requestPayment({
        timeStamp: payment.timeStamp,
        nonceStr: payment.nonceStr,
        package: payment.packageValue,
        signType: payment.signType || 'MD5',
        paySign: payment.paySign,
      })

      Taro.showToast({ title: '支付成功', icon: 'success' })
      setTimeout(() => fetchDetail(), 1000)

    } catch (err: any) {
      console.error('[OrderDetail] pay error:', err)
      if (err.errMsg?.includes('cancel')) {
        Taro.showModal({ title: '支付取消', content: '订单已创建，可稍后在订单详情中继续支付', showCancel: false })
      } else {
        Taro.showToast({ title: '支付失败', icon: 'none' })
      }
    } finally {
      setPaying(false)
    }
  }, [orderId, paying, fetchDetail])

  // ===== 取消 =====
  const handleCancel = useCallback(async () => {
    const { confirm } = await Taro.showModal({ title: '取消订单', content: '确定要取消此订单吗？取消后可重新发单。' })
    if (!confirm) return
    try {
      const res = await Network.request({ url: `/api/order/${orderId}/cancel`, method: 'POST' })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已取消', icon: 'success' })
        fetchDetail()
      } else {
        Taro.showToast({ title: res.data?.message || '取消失败', icon: 'none' })
      }
    } catch { Taro.showToast({ title: '取消失败', icon: 'none' }) }
  }, [orderId, fetchDetail])

  // ===== 删除 =====
  const handleDelete = useCallback(async () => {
    const { confirm } = await Taro.showModal({ title: '删除订单', content: '删除后不可恢复，确定？', confirmColor: '#EF4444' })
    if (!confirm) return
    try {
      const res = await Network.request({ url: `/api/order/${orderId}`, method: 'DELETE' })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1000)
      } else {
        Taro.showToast({ title: res.data?.message || '删除失败', icon: 'none' })
      }
    } catch { Taro.showToast({ title: '删除失败', icon: 'none' }) }
  }, [orderId])

  const handleVerify = useCallback(() => {
    Taro.navigateTo({ url: `/package-order/pages/order-acceptance/index?orderId=${orderId}` })
  }, [orderId])

  const toggleAvatarExpand = useCallback((avatarId: string) => {
    setExpandedAvatarIds(prev => {
      const next = new Set(prev)
      if (next.has(avatarId)) {
        next.delete(avatarId)
      } else {
        next.add(avatarId)
      }
      return next
    })
  }, [])

  if (loading) {
    return (
      <View className="od-page od-loading">
        <Loader size={36} color="#6366F1" className="od-loading-icon" />
        <Text className="block od-loading-text">加载中...</Text>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="od-page od-loading">
        <Text className="block od-loading-text">订单不存在</Text>
      </View>
    )
  }

  const avatarStats = order.avatarStats || []
  // 有待验收或已验收的分身
  const hasVerifiableAvatars = avatarStats.some((a: any) =>
    ['awaiting_acceptance', 'feedback_submitted', 'preview', 'completed'].includes(a.status)
  )
  const hasAwaitingAcceptance = avatarStats.some((a: any) =>
    ['awaiting_acceptance', 'feedback_submitted', 'preview'].includes(a.status)
  )
  const isAllVerified = avatarStats.length > 0 && avatarStats.every((a: any) =>
    ['completed', 'rejected'].includes(a.status)
  )
  console.log('[OrderDetail] avatarStats:', JSON.stringify(avatarStats))
  console.log('[OrderDetail] hasVerifiableAvatars:', hasVerifiableAvatars, 'hasAwaitingAcceptance:', hasAwaitingAcceptance, 'isAllVerified:', isAllVerified, 'order.status:', order.status)

  const effectiveStatus = order?.summary_stats?.effectiveStatus || order.status
  const statusCfg = STATUS_CONFIG[effectiveStatus] || { label: effectiveStatus, color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '' }
  const currentPhase = getPhaseIndex(effectiveStatus)
  const isPayable = order.status === 'pending_payment'
  const isCancellable = ['pending_payment', 'pending'].includes(order.status)
  const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status)
  // 去验收：有分身处于 preview/awaiting_acceptance/feedback_submitted 状态，且尚未全部完成
  const isVerifiable = hasAwaitingAcceptance && !isAllVerified && !['cancelled', 'auto_cancelled', 'timeout', 'expired'].includes(order.status)
  const isAbnormal = statusCfg.phase === -1 && order.status !== 'pending_payment'
  const ctConfig = CONTENT_TYPE_MAP[order.contentType] || CONTENT_TYPE_MAP.text

  // 分身统计 — 使用 normalizedStatus（avatarStats.status），不使用 raw dispatchStatus
  const totalAvatars = order?.summary_stats?.totalAvatars ?? order.avatarCount ?? 0
  const acceptedCount = order?.summary_stats?.acceptedAvatars ?? avatarStats.filter((a: any) =>
    ['accepted', 'generating', 'preview', 'publishing', 'published', 'awaiting_acceptance', 'feedback_submitted', 'completed'].includes(a.status)
  ).length
  const completedCount = order?.summary_stats?.completedAvatars ?? avatarStats.filter((a: any) => a.status === 'completed').length
  const pendingCount = order?.summary_stats?.pendingAvatars ?? avatarStats.filter((a: any) => a.status === 'pending').length
  const rejectedCount = order?.summary_stats?.rejectedAvatars ?? avatarStats.filter((a: any) => a.status === 'rejected').length

  return (
    <View className="od-page">
      {/* ===== 顶部渐变头部 ===== */}
      <View className="od-header">
        <View className="od-header-deco1" />
        <View className="od-header-deco2" />
        <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
          <View className="od-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#fff" />
          </View>
          <View className="od-header-center">
            <Text className="block od-header-title">订单详情</Text>
          </View>
          <View className="od-header-right" />
        </View>

        {/* 状态信息 */}
        <View className="od-status-section">
          <View className="od-status-badge" style={{ backgroundColor: statusCfg.bgColor }}>
            <Text className="block od-status-badge-text" style={{ color: statusCfg.color }}>{statusCfg.label}</Text>
          </View>
          {isAbnormal && (
            <View className="od-alert-pill">
              <CircleX size={14} color="#fff" />
              <Text className="block od-alert-pill-text">异常</Text>
            </View>
          )}
          <Text className="block od-status-desc">{statusCfg.desc}</Text>
        </View>
      </View>

      {/* ===== 内容区 ===== */}
      <ScrollView scrollY className="od-body">
        {/* 4阶段进度条 */}
        {currentPhase >= 0 && (
          <View className="od-card od-pipeline-card">
            <View className="od-pipeline">
              {PHASES.map((phase, idx) => {
                const PhaseIcon = phase.icon
                const isActive = idx <= currentPhase
                const isCurrent = idx === currentPhase
                return (
                  <View key={phase.key} className="od-pipe-stage">
                    <View className="od-pipe-node-wrap">
                      {idx > 0 && (
                        <View className="od-pipe-line" style={{ backgroundColor: idx <= currentPhase ? '#6366F1' : '#D1D5DB' }} />
                      )}
                      <View className="od-pipe-node" style={{ backgroundColor: isActive ? '#6366F1' : '#F3F4F6' }}>
                        {isActive ? (
                          <PhaseIcon size={14} color="#fff" />
                        ) : (
                          <View className="od-pipe-node-empty" />
                        )}
                      </View>
                      {idx < PHASES.length - 1 && (
                        <View className="od-pipe-line" style={{ backgroundColor: idx < currentPhase ? '#6366F1' : '#D1D5DB' }} />
                      )}
                    </View>
                    <Text className="block od-pipe-label" style={{ color: isActive ? '#6366F1' : '#9CA3AF', fontWeight: isCurrent ? '600' : '400' }}>
                      {phase.label}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* 订单信息卡 */}
        <View className="od-card">
          <Text className="block od-card-title">{order.title || '未命名订单'}</Text>
          {order.description && (
            <Text className="block od-card-desc">{order.description}</Text>
          )}
          {/* 标签 */}
          <View className="od-info-pills">
            <View className="od-pill od-pill-type">
              {(() => { const CTIcon = ctConfig.icon; return <CTIcon size={12} color="#9333EA" /> })()}
              <Text className="block od-pill-text od-pill-type-text">{ctConfig.label}</Text>
            </View>
            {Array.isArray(order.platforms) ? order.platforms.map((p: string, i: number) => (
              <View key={i} className="od-pill od-pill-platform">
                <Text className="block od-pill-text od-pill-platform-text">{PLATFORM_MAP[p] || p}</Text>
              </View>
            )) : null}
          </View>
        </View>

        {/* 统计卡 */}
        <View className="od-card">
          <View className="od-stats-row">
            <View className="od-stat-item">
              <Text className="block od-stat-value od-stat-budget">¥{order.budget || order.totalPrice || 0}</Text>
              <Text className="block od-stat-label">订单金额</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Text className="block od-stat-value">{totalAvatars}</Text>
              <Text className="block od-stat-label">分身数量</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Text className="block od-stat-value">{formatTime(order.createdAt || order.created_at)}</Text>
              <Text className="block od-stat-label">创建时间</Text>
            </View>
          </View>
        </View>

        {/* 分身列表卡 */}
        {order.avatarStats && order.avatarStats.length > 0 && (
          <View className="od-card">
            <Text className="block od-section-title">分身详情</Text>
            {order.avatarStats.map((avatar: any, idx: number) => {
              const avatarStatus = avatar.status || 'pending'
              const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
                pending: { label: '待接单', color: '#9CA3AF', icon: '⏳' },
                accepted: { label: '已接单', color: '#3B82F6', icon: '✅' },
                generating: { label: '内容生成中', color: '#8B5CF6', icon: '🎨' },
                preview: { label: '内容已生成', color: '#F59E0B', icon: '📝' },
                publishing: { label: '发布中', color: '#6366F1', icon: '📤' },
                published: { label: '已发布', color: '#059669', icon: '📡' },
                awaiting_acceptance: { label: '待验收', color: '#EF4444', icon: '🔍' },
                feedback_submitted: { label: '已提交反馈', color: '#F97316', icon: '📋' },
                completed: { label: '已验收', color: '#10B981', icon: '✅' },
                rejected: { label: '已拒绝', color: '#EF4444', icon: '❌' },
                expired: { label: '已过期', color: '#9CA3AF', icon: '⏰' },
              }
              const cfg = statusConfig[avatarStatus] || statusConfig.pending
              const hasContent = ['preview', 'publishing', 'published', 'awaiting_acceptance', 'feedback_submitted', 'completed'].includes(avatarStatus)
              const isExpanded = expandedAvatarIds.has(avatar.avatarId)
              const contentTypeLabel = avatar.contentType === 'image_text' || avatar.contentType === 'image' ? '图文' : avatar.contentType === 'video' ? '视频' : avatar.contentType === 'text' ? '纯文案' : avatar.contentType
              // 解析图片和视频
              const avatarImages: string[] = Array.isArray(avatar.images) ? avatar.images : []
              const avatarVideoUrls: string[] = Array.isArray(avatar.videoUrl) ? avatar.videoUrl : []
              const publishFeedback = avatar.publishFeedback || {}
              const hasFeedback = publishFeedback && Object.keys(publishFeedback).length > 0

              return (
                <View key={avatar.avatarId || idx} className="od-av-wrap">
                  {/* 分身主行 */}
                  <View className="od-av-item" onClick={() => hasContent && toggleAvatarExpand(avatar.avatarId)}>
                    {avatar.avatarUrl ? (
                      <Image src={avatar.avatarUrl} className="od-av-img" mode="aspectFill" />
                    ) : (
                      <View className="od-av-placeholder">
                        <Text className="block od-av-placeholder-text">{(avatar.avatarName || '?')[0]}</Text>
                      </View>
                    )}
                    <View className="od-av-info">
                      <Text className="block od-av-name">{avatar.avatarName || `分身${idx + 1}`}</Text>
                      {avatar.rejectReason && (
                        <Text className="block od-av-reason">拒绝原因: {avatar.rejectReason}</Text>
                      )}
                      {avatar.contentType && avatarStatus !== 'pending' && avatarStatus !== 'rejected' && avatarStatus !== 'expired' && (
                        <Text className="block od-av-meta">{contentTypeLabel}</Text>
                      )}
                      {avatar.contentUpdatedAt && (
                        <Text className="block od-av-time">更新于 {formatTime(avatar.contentUpdatedAt)}</Text>
                      )}
                    </View>
                    <View className="od-av-right">
                      <View className="od-av-badge" style={{ backgroundColor: `${cfg.color}15`, borderColor: cfg.color }}>
                        <Text className="block od-av-badge-text" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</Text>
                      </View>
                      {hasContent && (
                        <View className="od-av-expand-icon">
                          {isExpanded ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* 展开内容区 */}
                  {hasContent && isExpanded && (
                    <View className="od-av-content">
                      {/* 文案内容 */}
                      {avatar.content && (
                        <View className="od-av-content-block">
                          <View className="od-av-content-header">
                            <FileText size={14} color="#6366F1" />
                            <Text className="block od-av-content-label">生成文案</Text>
                          </View>
                          <Text className="block od-av-content-text">{avatar.content}</Text>
                        </View>
                      )}

                      {/* 图片 */}
                      {avatarImages.length > 0 && (
                        <View className="od-av-content-block">
                          <View className="od-av-content-header">
                            <ImageIcon size={14} color="#6366F1" />
                            <Text className="block od-av-content-label">生成配图 ({avatarImages.length})</Text>
                          </View>
                          <View className="od-av-images-grid">
                            {avatarImages.map((img: string, imgIdx: number) => (
                              <Image
                                key={imgIdx}
                                src={img}
                                className="od-av-img-thumb"
                                mode="aspectFill"
                                onClick={() => {
                                  Taro.previewImage({ current: img, urls: avatarImages })
                                }}
                              />
                            ))}
                          </View>
                        </View>
                      )}

                      {/* 视频 */}
                      {avatarVideoUrls.length > 0 && (
                        <View className="od-av-content-block">
                          <View className="od-av-content-header">
                            <Video size={14} color="#6366F1" />
                            <Text className="block od-av-content-label">生成视频</Text>
                          </View>
                          {avatarVideoUrls.map((vUrl: string, vIdx: number) => (
                            <View
                              key={vIdx}
                              className="od-av-video-card"
                              onClick={() => {
                                const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv())
                                if (isMiniApp) {
                                  Taro.previewMedia({ sources: [{ url: vUrl, type: 'video' }] })
                                } else {
                                  window.open(vUrl, '_blank')
                                }
                              }}
                            >
                              <View className="od-av-video-play">
                                <Play size={32} color="#fff" />
                              </View>
                              <Text className="block od-av-video-label">点击播放视频</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* 发布反馈 */}
                      {hasFeedback && (
                        <View className="od-av-content-block">
                          <View className="od-av-content-header">
                            <Eye size={14} color="#059669" />
                            <Text className="block od-av-content-label od-av-content-label-green">发布反馈</Text>
                          </View>
                          {/* 按平台遍历反馈 */}
                          {Object.keys(publishFeedback).map(platformKey => {
                            const pf = publishFeedback[platformKey]
                            if (!pf || typeof pf !== 'object') return null
                            return (
                              <View key={platformKey} className="od-av-feedback-platform">
                                <Text className="block od-av-feedback-platform-name">{PLATFORM_MAP[platformKey] || platformKey}</Text>
                                {pf.link && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">发布链接</Text>
                                    <Text className="block od-av-feedback-val od-av-feedback-link">{pf.link}</Text>
                                  </View>
                                )}
                                {pf.publishUrl && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">发布链接</Text>
                                    <Text className="block od-av-feedback-val od-av-feedback-link">{pf.publishUrl}</Text>
                                  </View>
                                )}
                                {pf.publishTime && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">发布时间</Text>
                                    <Text className="block od-av-feedback-val">{formatTime(pf.publishTime)}</Text>
                                  </View>
                                )}
                                {pf.views !== undefined && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">浏览量</Text>
                                    <Text className="block od-av-feedback-val">{pf.views}</Text>
                                  </View>
                                )}
                                {pf.likes !== undefined && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">点赞数</Text>
                                    <Text className="block od-av-feedback-val">{pf.likes}</Text>
                                  </View>
                                )}
                                {pf.comments !== undefined && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">评论数</Text>
                                    <Text className="block od-av-feedback-val">{pf.comments}</Text>
                                  </View>
                                )}
                                {pf.remark && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">备注</Text>
                                    <Text className="block od-av-feedback-val">{pf.remark}</Text>
                                  </View>
                                )}
                                {/* 反馈中的图片 */}
                                {Array.isArray(pf.images) && pf.images.length > 0 && (
                                  <View className="od-av-feedback-item">
                                    <Text className="block od-av-feedback-key">截图</Text>
                                    <View className="od-av-images-grid">
                                      {pf.images.map((img: string, imgIdx: number) => (
                                        <Image
                                          key={imgIdx}
                                          src={img}
                                          className="od-av-img-thumb"
                                          mode="aspectFill"
                                          onClick={() => {
                                            Taro.previewImage({ current: img, urls: pf.images })
                                          }}
                                        />
                                      ))}
                                    </View>
                                  </View>
                                )}
                              </View>
                            )
                          })}
                        </View>
                      )}

                      {/* 无内容提示 */}
                      {!avatar.content && avatarImages.length === 0 && avatarVideoUrls.length === 0 && !hasFeedback && (
                        <View className="od-av-empty-content">
                          <Text className="block od-av-empty-content-text">暂无详细内容</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* 分身状态卡（统计概览） */}
        {totalAvatars > 0 && (acceptedCount > 0 || pendingCount > 0 || completedCount > 0) && (
          <View className="od-card">
            <Text className="block od-section-title">分身进度</Text>
            <View className="od-dispatch-row">
              <View className="od-dispatch-item">
                <Text className="block od-dispatch-num" style={{ color: '#10B981' }}>{completedCount}</Text>
                <Text className="block od-dispatch-label">已验收</Text>
              </View>
              <View className="od-dispatch-item">
                <Text className="block od-dispatch-num" style={{ color: '#3B82F6' }}>{acceptedCount - completedCount}</Text>
                <Text className="block od-dispatch-label">进行中</Text>
              </View>
              <View className="od-dispatch-item">
                <Text className="block od-dispatch-num" style={{ color: '#9CA3AF' }}>{pendingCount}</Text>
                <Text className="block od-dispatch-label">待接单</Text>
              </View>
              {rejectedCount > 0 && (
                <View className="od-dispatch-item">
                  <Text className="block od-dispatch-num" style={{ color: '#EF4444' }}>{rejectedCount}</Text>
                  <Text className="block od-dispatch-label">已拒绝</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 事件时间线 */}
        {events.length > 0 && (
          <View className="od-card">
            <Text className="block od-section-title">动态记录</Text>
            <View className="od-timeline">
              {events.map((evt: any, idx: number) => {
                const evtType = evt.eventType || evt.event_type || ''
                const EventIcon = EVENT_ICONS[evtType] || CircleDot
                const eventColor = EVENT_COLORS[evtType] || '#9CA3AF'
                const eventLabel = evt.title || EVENT_LABELS[evtType] || evtType
                return (
                  <View key={evt.id || idx} className="od-timeline-item">
                    <View className="od-timeline-left">
                      <View className="od-timeline-dot" style={{ backgroundColor: `${eventColor}20` }}>
                        <EventIcon size={12} color={eventColor} />
                      </View>
                      {idx < events.length - 1 && <View className="od-timeline-line" />}
                    </View>
                    <View className="od-timeline-right">
                      <View className="od-timeline-header">
                        <Text className="block od-timeline-title">{eventLabel}</Text>
                        <Text className="block od-timeline-time">{formatTime(evt.createdAt || evt.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        {(isPayable || isCancellable || isDeletable || isVerifiable) && (
          <View className="od-actions">
            {isPayable && (
              <View className="od-action-btn od-action-primary" onClick={handlePay}>
                <CreditCard size={16} color="#fff" />
                <Text className="block od-action-text" style={{ color: '#fff' }}>
                  {paying ? '支付中...' : `立即支付 ¥${order.budget || order.totalPrice || 0}`}
                </Text>
              </View>
            )}
            {isVerifiable && (
              <View className="od-action-btn od-action-primary" onClick={handleVerify}>
                <CircleCheckBig size={16} color="#fff" />
                <Text className="block od-action-text" style={{ color: '#fff' }}>去验收</Text>
              </View>
            )}
            {isCancellable && !isPayable && (
              <View className="od-action-btn od-action-secondary" onClick={handleCancel}>
                <Text className="block od-action-text" style={{ color: '#6366F1' }}>取消订单</Text>
              </View>
            )}
            {isDeletable && (
              <View className="od-action-btn od-action-danger" onClick={handleDelete}>
                <Trash2 size={16} color="#EF4444" />
                <Text className="block od-action-text" style={{ color: '#EF4444' }}>删除订单</Text>
              </View>
            )}
          </View>
        )}

        {/* 底部安全区 */}
        <View style={{ height: '40rpx' }} />
      </ScrollView>
    </View>
  )
}
