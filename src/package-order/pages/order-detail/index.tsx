import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import {
  ArrowLeft, Clock, Loader, Users, CircleCheckBig, CircleX,
  Wallet, CreditCard, Send, Trash2,
  FileText, CircleDot
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

// ===== 状态配置 =====
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; phase: number }> = {
  pending_payment: { label: '待支付', color: '#F59E0B', bgColor: '#FEF3C7', phase: 0 },
  pending: { label: '匹配中', color: '#7C3AED', bgColor: '#F5F3FF', phase: 1 },
  awaiting_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', phase: 1 },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', phase: 1 },
  accepted: { label: '已接单', color: '#10B981', bgColor: '#ECFDF5', phase: 2 },
  in_progress: { label: '制作中', color: '#10B981', bgColor: '#ECFDF5', phase: 2 },
  content_generated: { label: '已生成', color: '#8B5CF6', bgColor: '#F5F3FF', phase: 2 },
  submitted: { label: '待发布', color: '#8B5CF6', bgColor: '#F5F3FF', phase: 3 },
  published: { label: '已发布', color: '#059669', bgColor: '#ECFDF5', phase: 3 },
  completed: { label: '已完成', color: '#059669', bgColor: '#ECFDF5', phase: 4 },
  publish_failed: { label: '发布失败', color: '#EF4444', bgColor: '#FEF2F2', phase: -1 },
  publish_timeout: { label: '发布超时', color: '#EF4444', bgColor: '#FEF2F2', phase: -1 },
  cancelled: { label: '已取消', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1 },
  auto_cancelled: { label: '自动取消', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1 },
  timeout: { label: '已超时', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1 },
  expired: { label: '已过期', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1 },
}

// 4阶段进度定义
const PHASES = [
  { key: 'match', label: '匹配', icon: Users },
  { key: 'create', label: '制作', icon: FileText },
  { key: 'publish', label: '发布', icon: Send },
  { key: 'done', label: '完成', icon: CircleCheckBig },
]

function getPhaseIndex(status: string): number {
  const phase = STATUS_CONFIG[status]?.phase ?? -1
  if (phase <= 0) return -1
  if (phase === 1) return 0
  if (phase === 2) return 1
  if (phase === 3) return 2
  if (phase === 4) return 3
  return -1
}

// 事件图标映射
const EVENT_ICONS: Record<string, any> = {
  order_created: CircleDot,
  payment_success: CircleCheckBig,
  dispatch_created: Users,
  dispatch_accepted: CircleCheckBig,
  dispatch_rejected: CircleX,
  content_generated: FileText,
  content_submitted: Send,
  content_published: CircleCheckBig,
  publish_failed: CircleX,
  order_completed: CircleCheckBig,
  order_cancelled: CircleX,
  dispatch_timeout: Clock,
}

const EVENT_COLORS: Record<string, string> = {
  order_created: '#3B82F6',
  payment_success: '#10B981',
  dispatch_created: '#6366F1',
  dispatch_accepted: '#10B981',
  dispatch_rejected: '#EF4444',
  content_generated: '#8B5CF6',
  content_submitted: '#F59E0B',
  content_published: '#059669',
  publish_failed: '#EF4444',
  order_completed: '#059669',
  order_cancelled: '#9CA3AF',
  dispatch_timeout: '#F59E0B',
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
  const [dispatches, setDispatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
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
      console.log('[OrderDetail] order:', orderRes.data, 'events:', eventRes.data)
      const orderData = orderRes.data?.data || orderRes.data
      setOrder(orderData)
      const evts = eventRes.data?.data?.events || eventRes.data?.events || []
      setEvents(evts)

      // 分身派单信息
      const dispatchData = orderData?.dispatches || orderData?.dispatchSummary?.dispatches || []
      setDispatches(dispatchData)
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
      // 获取openid
      const loginRes = await Taro.login()
      const openidRes = await Network.request({ url: `/api/user/openid?code=${loginRes.code}` })
      const openid = openidRes.data?.data?.openid
      if (!openid) {
        Taro.showToast({ title: '获取支付信息失败', icon: 'none' })
        return
      }

      // 创建支付
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

      // 唤起微信支付
      await Taro.requestPayment({
        timeStamp: payment.timeStamp,
        nonceStr: payment.nonceStr,
        package: payment.packageValue,
        signType: payment.signType || 'MD5',
        paySign: payment.paySign,
      })

      // 支付成功，轮询确认
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

  if (loading) {
    return (
      <View className="od-page od-loading">
        <Loader size={40} color="#6366F1" className="od-loading-icon" />
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

  const statusCfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1 }
  const currentPhase = getPhaseIndex(order.status)
  const isPayable = order.status === 'pending_payment'
  const isCancellable = ['pending_payment', 'pending'].includes(order.status)
  const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status)
  const isAbnormal = statusCfg.phase === -1 && order.status !== 'pending_payment'

  return (
    <View className="od-page">
      {/* ===== 顶部渐变头部 ===== */}
      <View className="od-header">
        <View className="od-header-deco1" />
        <View className="od-header-deco2" />
        <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
          <View className="od-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="od-header-center">
            <Text className="block od-header-title">订单详情</Text>
            <Text className="block od-header-sub">{order.title || '未命名订单'}</Text>
          </View>
          <View className="od-header-right" />
        </View>

        {/* 状态 Banner */}
        <View className="od-status-banner">
          <View className="od-status-dot" style={{ backgroundColor: statusCfg.color }} />
          <Text className="block od-status-label" style={{ color: statusCfg.color }}>
            {statusCfg.label}
          </Text>
          {isAbnormal && (
            <View className="od-alert-pill">
              <CircleX size={20} color="#fff" />
              <Text className="block od-alert-pill-text">异常</Text>
            </View>
          )}
        </View>
      </View>

      {/* ===== 内容区 ===== */}
      <View className="od-body">
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
                        <View
                          className="od-pipe-line"
                          style={{ backgroundColor: idx <= currentPhase ? '#6366F1' : '#D1D5DB' }}
                        />
                      )}
                      <View
                        className="od-pipe-node"
                        style={{ backgroundColor: isActive ? '#6366F1' : '#F3F4F6' }}
                      >
                        {isActive ? (
                          <PhaseIcon size={16} color="#fff" />
                        ) : (
                          <View className="od-pipe-node-empty" />
                        )}
                      </View>
                      {idx < PHASES.length - 1 && (
                        <View
                          className="od-pipe-line"
                          style={{ backgroundColor: idx < currentPhase ? '#6366F1' : '#D1D5DB' }}
                        />
                      )}
                    </View>
                    <Text
                      className="block od-pipe-label"
                      style={{ color: isActive ? '#6366F1' : '#9CA3AF', fontWeight: isCurrent ? '600' : '400' }}
                    >
                      {phase.label}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* 订单信息卡 */}
        <View className="od-card od-info-card">
          <Text className="block od-card-title">{order.title || '未命名订单'}</Text>
          {order.description && (
            <Text className="block od-card-desc">{order.description}</Text>
          )}

          {/* 标签 */}
          <View className="od-info-pills">
            <View className="od-pill od-pill-type">
              <Text className="block od-pill-text">
                {order.contentType === 'text' ? '纯文案' : order.contentType === 'image_text' ? '图文' : order.contentType === 'video' ? '短视频' : order.contentType === 'article' ? '长文' : order.contentType || '—'}
              </Text>
            </View>
            {Array.isArray(order.platforms) ? order.platforms.map((p: string, i: number) => (
              <View key={i} className="od-pill od-pill-platform">
                <Text className="block od-pill-text">{p}</Text>
              </View>
            )) : null}
          </View>
        </View>

        {/* 统计卡 */}
        <View className="od-card">
          <View className="od-stats-row">
            <View className="od-stat-item">
              <View className="od-stat-icon"><Wallet size={28} color="#F59E0B" /></View>
              <Text className="block od-stat-value">¥{order.budget || order.totalPrice || 0}</Text>
              <Text className="block od-stat-label">订单金额</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <View className="od-stat-icon"><Users size={28} color="#7C3AED" /></View>
              <Text className="block od-stat-value">{order.avatarCount || order.avatar_count || 0}</Text>
              <Text className="block od-stat-label">分身数量</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <View className="od-stat-icon"><Clock size={28} color="#6B7280" /></View>
              <Text className="block od-stat-value">{formatTime(order.createdAt || order.created_at)}</Text>
              <Text className="block od-stat-label">创建时间</Text>
            </View>
          </View>
        </View>

        {/* 分身状态卡 */}
        {dispatches.length > 0 && (
          <View className="od-card">
            <Text className="block od-section-title">分身进度</Text>
            {dispatches.map((d: any, idx: number) => {
              const dStatus = d.status || d.dispatchStatus || ''
              const dCfg = STATUS_CONFIG[dStatus] || { label: dStatus, color: '#9CA3AF', bgColor: '#F9FAFB' }
              const avatarName = d.avatarName || `分身 ${idx + 1}`
              return (
                <View key={d.id || idx} className="od-avatar-item">
                  <View className="od-avatar-left">
                    <View className="od-avatar-fallback">
                      <Text className="block od-avatar-fallback-text">{avatarName.charAt(0)}</Text>
                    </View>
                    <View className="od-avatar-info">
                      <Text className="block od-avatar-name">{avatarName}</Text>
                      <View className="od-avatar-status-wrap">
                        <View className="od-avatar-status-dot" style={{ backgroundColor: dCfg.color }} />
                        <Text className="block od-avatar-status-text" style={{ color: dCfg.color }}>{dCfg.label}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="od-avatar-right">
                    <View className="od-avatar-status-pill" style={{ backgroundColor: dCfg.bgColor }}>
                      <Text className="block od-avatar-status-pill-text" style={{ color: dCfg.color }}>{dCfg.label}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* 事件时间线 */}
        {events.length > 0 && (
          <View className="od-card">
            <Text className="block od-section-title">动态记录</Text>
            <View className="od-timeline">
              {events.map((evt: any, idx: number) => {
                const EventIcon = EVENT_ICONS[evt.eventType || evt.event_type] || CircleDot
                const eventColor = EVENT_COLORS[evt.eventType || evt.event_type] || '#9CA3AF'
                return (
                  <View key={evt.id || idx} className="od-timeline-item">
                    <View className="od-timeline-left">
                      <View className="od-timeline-dot" style={{ backgroundColor: `${eventColor}20` }}>
                        <EventIcon size={14} color={eventColor} />
                      </View>
                      {idx < events.length - 1 && <View className="od-timeline-line" />}
                    </View>
                    <View className="od-timeline-right">
                      <View className="od-timeline-header">
                        <Text className="block od-timeline-title">{evt.eventTitle || evt.description || evt.eventType || ''}</Text>
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
        {(isPayable || isCancellable || isDeletable) && (
          <View className="od-actions">
            {isPayable && (
              <View className="od-action-btn od-action-primary" onClick={handlePay}>
                <CreditCard size={22} color="#fff" />
                <Text className="block od-action-text" style={{ color: '#fff' }}>
                  {paying ? '支付中...' : `立即支付 ¥${order.budget || order.totalPrice || 0}`}
                </Text>
              </View>
            )}
            {isCancellable && !isPayable && (
              <View className="od-action-btn od-action-secondary" onClick={handleCancel}>
                <Text className="block od-action-text" style={{ color: '#6366F1' }}>取消订单</Text>
              </View>
            )}
            {isDeletable && (
              <View className="od-action-btn od-action-secondary" onClick={handleDelete}>
                <Trash2 size={22} color="#EF4444" />
                <Text className="block od-action-text" style={{ color: '#EF4444' }}>删除订单</Text>
              </View>
            )}
          </View>
        )}

        {/* 底部安全区 */}
        <View style={{ height: '40rpx' }} />
      </View>
    </View>
  )
}
