import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import {
  ArrowLeft, Loader, Users, CircleCheckBig, CircleX, Clock,
  CreditCard, Send, Trash2,
  FileText, CircleDot, Camera, Video, Eye, Image as ImageIcon,
  ExternalLink, ThumbsUp, MessageCircle, Calendar, Package, ChevronDown, TriangleAlert, Phone
} from 'lucide-react-taro'
import {
  normalizeOrderDetail,
  normalizeTimelineEvents,
  type OrderDetailDto,
  type TimelineEventDto,
} from '@/adapters/core-chain-dto'
import { getStatusBarHeight } from '@/utils/safe-area'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { MarkdownRenderer } from '@/components/markdown-renderer'
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
  simple: { label: '简单任务', icon: CircleCheckBig },
  text: { label: '纯文案', icon: FileText },
  image_text: { label: '图文', icon: Camera },
  article: { label: '长文', icon: FileText },
  image: { label: '图片', icon: Camera },
  video: { label: '短视频', icon: Video },
}

// ===== 状态配置 =====
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; phase: number; desc: string }> = {
  pending_payment: { label: '待支付', color: '#F59E0B', bgColor: '#FEF3C7', phase: 0, desc: '请尽快完成支付，超时订单将自动取消' },
  pending: { label: '匹配中', color: '#7C3AED', bgColor: '#F5F3FF', phase: 1, desc: '系统正在为你匹配合适的分身' },
  awaiting_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', phase: 1, desc: '分身正在确认接单' },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', phase: 1, desc: '分身正在确认接单' },
  accepted: { label: '已接单', color: '#10B981', bgColor: '#ECFDF5', phase: 2, desc: '分身已接单，正在制作内容' },
  in_progress: { label: '制作中', color: '#10B981', bgColor: '#ECFDF5', phase: 2, desc: '分身正在创作内容' },
  content_generated: { label: '已生成', color: '#8B5CF6', bgColor: '#F5F3FF', phase: 2, desc: '内容已生成，等待发布' },
  submitted: { label: '待发布', color: '#8B5CF6', bgColor: '#F5F3FF', phase: 3, desc: '内容已提交，即将发布' },
  published: { label: '已发布', color: '#059669', bgColor: '#ECFDF5', phase: 3, desc: '内容已成功发布' },
  pending_verify: { label: '待验收', color: '#F59E0B', bgColor: '#FEF3C7', phase: 4, desc: '内容已发布，请验收确认' },
  revision_requested: { label: '待修改', color: '#F97316', bgColor: '#FFF7ED', phase: 2, desc: '已发起修改，请等待分身重新提交' },
  completed: { label: '已完成', color: '#059669', bgColor: '#ECFDF5', phase: 5, desc: '订单已全部完成' },
  publish_failed: { label: '发布失败', color: '#EF4444', bgColor: '#FEF2F2', phase: -1, desc: '发布遇到问题，请查看详情' },
  publish_timeout: { label: '发布超时', color: '#EF4444', bgColor: '#FEF2F2', phase: -1, desc: '发布超时，请查看详情' },
  cancelled: { label: '已取消', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单已取消' },
  auto_cancelled: { label: '自动取消', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单因超时自动取消' },
  timeout: { label: '已超时', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单已超时' },
  expired: { label: '已过期', color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '订单已过期' },
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
  const [order, setOrder] = useState<OrderDetailDto | null>(null)
  const [events, setEvents] = useState<TimelineEventDto[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTab, setDialogTab] = useState('content')
  const [assetSummary, setAssetSummary] = useState<{ total: number; ready: number; generating: number; failed: number; images: number; videos: number; user_uploaded: number; ai_generated: number } | null>(null)
  const [assetImages, setAssetImages] = useState<string[]>([])
  const [assetVideos, setAssetVideos] = useState<string[]>([])
  const [assetTotal, setAssetTotal] = useState(0)
  const [assetPage, setAssetPage] = useState(1)
  const [assetHasMore, setAssetHasMore] = useState(false)
  const [assetLoading, setAssetLoading] = useState(false)
  const pollingRef = useRef<any>(null)
  const statusBarHeight = getStatusBarHeight()

  const orderId = Taro.getCurrentInstance().router?.params?.id
  const action = Taro.getCurrentInstance().router?.params?.action
  const userInfo = Taro.getStorageSync('userInfo')
  const currentUserId = userInfo?.id

  const fetchDetail = useCallback(async () => {
    if (!orderId) return
    try {
      const [orderRes, eventRes] = await Promise.all([
        Network.request({ url: `/api/order/${orderId}` }),
        Network.request({ url: `/api/order-dispatch/${orderId}/timeline` }).catch(() => ({ data: { data: [] } })),
      ])
      const orderData = normalizeOrderDetail(orderRes.data?.data)
      setOrder(orderData)

      const eventData = normalizeTimelineEvents(eventRes.data?.data)
      setEvents(eventData)
    } catch (err) {
      console.error('[OrderDetail] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  // ===== 素材池数据 =====
  const fetchAssetSummary = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await Network.request({ url: `/api/order-assets/${orderId}/summary` })
      if (res.data?.code === 200 && res.data?.data) {
        setAssetSummary(res.data.data)
      }
    } catch (err) {
      console.error('[OrderDetail] asset summary error:', err)
    }
  }, [orderId])

  const fetchAssetImages = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!orderId) return
    setAssetLoading(true)
    try {
      const res = await Network.request({ url: `/api/order-assets/${orderId}?type=image&pageSize=12&page=${page}` })
      if (res.data?.code === 200 && res.data?.data) {
        const d = res.data.data
        const urls = (d.list || []).map((a: any) => a.asset_url).filter(Boolean)
        setAssetImages(prev => append ? [...prev, ...urls] : urls)
        setAssetTotal(d.total || 0)
        setAssetPage(page)
        setAssetHasMore(page * (d.pageSize || 12) < (d.total || 0))
      }
    } catch (err) {
      console.error('[OrderDetail] asset images error:', err)
    } finally {
      setAssetLoading(false)
    }
  }, [orderId])

  const fetchAssetVideos = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await Network.request({ url: `/api/order-assets/${orderId}?type=video&pageSize=100&page=1` })
      if (res.data?.code === 200 && res.data?.data) {
        const d = res.data.data
        const urls = (d.list || []).map((a: any) => a.asset_url).filter(Boolean)
        setAssetVideos(urls)
      }
    } catch (err) {
      console.error('[OrderDetail] asset videos error:', err)
    }
  }, [orderId])

  useEffect(() => {
    fetchAssetSummary()
    fetchAssetImages(1, false)
    fetchAssetVideos()
  }, [fetchAssetSummary, fetchAssetImages, fetchAssetVideos])

  // 如果是从支付跳转过来的，轮询状态
  useEffect(() => {
    if (action === 'pay' && order?.status === 'pending_payment') {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await Network.request({ url: `/api/order/${orderId}` })
          const data = normalizeOrderDetail(res.data?.data)
          if (data && (data.isPaid || (data.status && data.status !== 'pending_payment'))) {
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
        dedupKey: `order:repay:${orderId}`,
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

  const handleKickAvatar = useCallback(async (avatarId: string, avatarName: string) => {
    try {
      const { confirm } = await Taro.showModal({
        title: '踢出分身',
        content: `确定踢出分身"${avatarName}"吗？踢出后名额将释放给其他分身接单。`,
        confirmText: '确定踢出',
        confirmColor: '#DC2626',
        cancelText: '取消'
      })
      if (!confirm) return
      Taro.showLoading({ title: '处理中...' })
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/kick/${avatarId}`,
        method: 'POST'
      })
      Taro.hideLoading()
      console.log('踢出分身结果:', res.data)
      if (res.data?.code === 200 || res.data?.data) {
        Taro.showToast({ title: '已踢出', icon: 'success' })
        fetchDetail()
      } else {
        Taro.showToast({ title: res.data?.msg || '踢出失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('踢出分身失败:', err)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [orderId, fetchDetail])

  const handleVerify = useCallback(() => {
    Taro.navigateTo({ url: `/package-order/pages/order-acceptance/index?orderId=${orderId}` })
  }, [orderId])

  const openAvatarDetail = useCallback((avatar: any) => {
    setSelectedAvatar(avatar)
    setDialogTab('content')
    setDialogOpen(true)
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
  const hasAwaitingAcceptance = avatarStats.some((a: any) =>
    ['submitted', 'awaiting_acceptance', 'feedback_submitted', 'preview'].includes(a.status)
  )
  const isAllVerified = avatarStats.length > 0 && avatarStats.every((a: any) =>
    ['completed', 'rejected'].includes(a.status)
  )

  const effectiveStatus = order.status
  const statusCfg = STATUS_CONFIG[effectiveStatus] || { label: effectiveStatus, color: '#9CA3AF', bgColor: '#F9FAFB', phase: -1, desc: '' }
  const currentPhase = getPhaseIndex(effectiveStatus)
  const orderUserId = order.userId
  const isOrderOwner = orderUserId && currentUserId && orderUserId === currentUserId
  const isPayable = order.status === 'pending_payment' && isOrderOwner
  const isCancellable = ['pending_payment', 'pending'].includes(order.status) && isOrderOwner
  const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status) && isOrderOwner
  const isVerifiable = hasAwaitingAcceptance && !isAllVerified && !['cancelled', 'auto_cancelled', 'timeout', 'expired'].includes(order.status) && isOrderOwner
  const isAbnormal = statusCfg.phase === -1 && order.status !== 'pending_payment'
  const ctConfig = CONTENT_TYPE_MAP[order.contentType] || CONTENT_TYPE_MAP.text

  // 分身统计 — 使用 normalizedStatus（avatarStats.status），不使用 raw dispatchStatus
  const totalAvatars = order.summaryStats.totalAvatars
  const acceptedCount = order.summaryStats.acceptedAvatars
  const completedCount = order.summaryStats.completedAvatars
  const pendingCount = order.summaryStats.pendingAvatars
  const rejectedCount = order.summaryStats.rejectedAvatars

  // 去匹配：已支付但还没有分配分身
  const isNeedMatching = order.status === 'pending' && totalAvatars === 0

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
          <Text className="block od-status-desc">
            {isNeedMatching ? '订单已支付，请匹配分身开始创作' : statusCfg.desc}
          </Text>
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
              <Text className="block od-stat-value od-stat-budget">¥{order.budget || 0}</Text>
              <Text className="block od-stat-label">订单金额</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Text className="block od-stat-value">{totalAvatars}</Text>
              <Text className="block od-stat-label">分身数量</Text>
            </View>
            <View className="od-stat-divider" />
            <View className="od-stat-item">
              <Text className="block od-stat-value">{formatTime(order.createdAt)}</Text>
              <Text className="block od-stat-label">创建时间</Text>
            </View>
          </View>
        </View>

        {/* 素材池卡 */}
        {(assetSummary || assetImages.length > 0) && (
          <View className="od-card">
            <View className="od-section-header">
              <Package size={16} color="#6366F1" />
              <Text className="block od-section-title" style={{ marginLeft: '6rpx' }}>素材池</Text>
            </View>

            {/* 素材概要统计 */}
            {assetSummary && (
              <View className="od-asset-summary">
                {(() => {
                  const s = assetSummary
                  return (
                    <View className="od-asset-stats">
                      <View className="od-asset-stat-item">
                        <Text className="block od-asset-stat-num" style={{ color: '#10B981' }}>{s.ready}</Text>
                        <Text className="block od-asset-stat-label">已就绪</Text>
                      </View>
                      {s.generating > 0 && (
                        <View className="od-asset-stat-item">
                          <Text className="block od-asset-stat-num" style={{ color: '#F59E0B' }}>{s.generating}</Text>
                          <Text className="block od-asset-stat-label">生成中</Text>
                        </View>
                      )}
                      {s.failed > 0 && (
                        <View className="od-asset-stat-item">
                          <Text className="block od-asset-stat-num" style={{ color: '#EF4444' }}>{s.failed}</Text>
                          <Text className="block od-asset-stat-label">失败</Text>
                        </View>
                      )}
                      {s.user_uploaded > 0 && (
                        <View className="od-asset-stat-item">
                          <Text className="block od-asset-stat-num" style={{ color: '#3B82F6' }}>{s.user_uploaded}</Text>
                          <Text className="block od-asset-stat-label">已上传</Text>
                        </View>
                      )}
                      {s.ai_generated > 0 && (
                        <View className="od-asset-stat-item">
                          <Text className="block od-asset-stat-num" style={{ color: '#8B5CF6' }}>{s.ai_generated}</Text>
                          <Text className="block od-asset-stat-label">AI生成</Text>
                        </View>
                      )}
                    </View>
                  )
                })()}
                {/* 图片/视频分类小标签 */}
                {assetSummary && (assetSummary.images > 0 || assetSummary.videos > 0) && (
                  <View className="od-asset-type-pills">
                    {assetSummary.images > 0 && (
                      <View className="od-asset-pill">
                        <Camera size={12} color="#F59E0B" />
                        <Text className="block od-asset-pill-text">{assetSummary.images}张图片</Text>
                      </View>
                    )}
                    {assetSummary.videos > 0 && (
                      <View className="od-asset-pill">
                        <Video size={12} color="#EC4899" />
                        <Text className="block od-asset-pill-text">{assetSummary.videos}个视频</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 素材缩略图网格 */}
            {assetImages.length > 0 && (
              <View className="od-asset-grid">
                {assetImages.map((url: string, idx: number) => (
                  <View key={idx} className="od-asset-thumb-wrap" onClick={() => Taro.previewImage({ current: url, urls: assetImages })}>
                    <Image src={url} className="od-asset-thumb" mode="aspectFill" />
                  </View>
                ))}
              </View>
            )}

            {/* 视频列表 */}
            {assetVideos.length > 0 && (
              <View className="od-asset-grid">
                {assetVideos.map((url: string, idx: number) => (
                  <View key={idx} className="od-asset-video-wrap" onClick={() => Taro.previewMedia({ sources: [{ url, type: 'video' }] })}>
                    <Image src="" className="od-asset-video-thumb" mode="aspectFill" />
                    <View className="od-asset-video-overlay" />
                    <View className="od-asset-video-play">
                      <Text className="block od-asset-video-play-icon">▶</Text>
                    </View>
                    <Text className="block od-asset-video-label">点击播放视频</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 加载更多 */}
            {assetHasMore && (
              <View className="od-asset-more" onClick={() => !assetLoading && fetchAssetImages(assetPage + 1, true)}>
                {assetLoading ? (
                  <Loader size={14} color="#6366F1" />
                ) : (
                  <ChevronDown size={14} color="#6366F1" />
                )}
                <Text className="block od-asset-more-text">{assetLoading ? '加载中...' : `加载更多 (已显示${assetImages.length}/${assetTotal})`}</Text>
              </View>
            )}

            {/* 无素材但AI正在生成 */}
            {(!assetSummary || (assetSummary.ready === 0 && assetSummary.generating > 0)) && (
              <View className="od-asset-generating">
                <Loader size={16} color="#F59E0B" />
                <Text className="block od-asset-generating-text">AI素材生成中，分身接单时将自动分配...</Text>
              </View>
            )}

            {/* 全部失败提示 */}
            {assetSummary && assetSummary.ready === 0 && assetSummary.generating === 0 && assetSummary.failed > 0 && (
              <View className="od-asset-failed">
                <TriangleAlert size={16} color="#EF4444" />
                <Text className="block od-asset-failed-text">素材生成失败，分身接单时会自动补生成</Text>
              </View>
            )}
          </View>
        )}

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
                submitted: { label: '待验收', color: '#8B5CF6', icon: '🔍' },
                publishing: { label: '发布中', color: '#6366F1', icon: '📤' },
                published: { label: '已发布', color: '#059669', icon: '📡' },
                awaiting_acceptance: { label: '待验收', color: '#EF4444', icon: '🔍' },
                feedback_submitted: { label: '已提交反馈', color: '#F97316', icon: '📋' },
                completed: { label: '已验收', color: '#10B981', icon: '✅' },
                rejected: { label: '已拒绝', color: '#EF4444', icon: '❌' },
                expired: { label: '已过期', color: '#9CA3AF', icon: '⏰' },
                cancelled: { label: '已过期', color: '#9CA3AF', icon: '⏰' },
              }
              const cfg = statusConfig[avatarStatus] || statusConfig.pending
              const hasContent = ['preview', 'publishing', 'submitted', 'published', 'awaiting_acceptance', 'feedback_submitted', 'completed'].includes(avatarStatus)
              const contentTypeLabel = avatar.contentType === 'image_text' || avatar.contentType === 'image' ? '图文' : avatar.contentType === 'video' ? '视频' : avatar.contentType === 'text' ? '纯文案' : avatar.contentType

              return (
                <View key={avatar.avatarId || idx} className="od-av-wrap" onClick={() => openAvatarDetail(avatar)}>
                  <View className="od-av-item">
                    {avatar.avatarUrl ? (
                      <Image src={avatar.avatarUrl} className="od-av-img" mode="aspectFill" />
                    ) : (
                      <View className="od-av-placeholder">
                        <Text className="block od-av-placeholder-text">{(avatar.avatarName || '?')[0]}</Text>
                      </View>
                    )}
                    <View className="od-av-info">
                      <Text className="block od-av-name">{avatar.avatarName || `分身${idx + 1}`}</Text>
                      {avatar.phone && (
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', marginTop: '2px' }} onClick={(e) => { e.stopPropagation() }}>
                          <Phone size={12} color="#6B7280" />
                          <Text className="block" style={{ fontSize: '12px', color: '#6B7280' }}>{avatar.phone}</Text>
                          <View
                            style={{ marginLeft: '4px', padding: '1px 8px', backgroundColor: '#EEF2FF', borderRadius: '10px' }}
                            onClick={(e) => { e.stopPropagation(); Taro.makePhoneCall({ phoneNumber: avatar.phone }) }}
                          >
                            <Text style={{ fontSize: '11px', color: '#4F46E5' }}>拨打</Text>
                          </View>
                        </View>
                      )}
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
                        <View className="od-av-view-hint">
                          <Eye size={14} color="#6366F1" />
                        </View>
                      )}
                      {isOrderOwner && !['pending', 'expired', 'cancelled', 'submitted', 'settled', 'completed'].includes(avatarStatus) && (() => {
                        const kickTime = avatar.acceptedAt || avatar.updatedAt || avatar.createdAt
                        return kickTime && (Date.now() - new Date(kickTime).getTime() > 5 * 60 * 1000)
                      })() && (
                          <View
                            style={{ marginTop: '6px', padding: '2px 8px', backgroundColor: '#FEF2F2', borderRadius: '10px', border: '1px solid #FECACA' }}
                            onClick={(e) => { e.stopPropagation(); handleKickAvatar(avatar.avatarId, avatar.avatarName || `分身${idx + 1}`) }}
                          >
                            <Text style={{ fontSize: '11px', color: '#DC2626' }}>踢出</Text>
                          </View>
                        )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* ===== 分身详情弹窗 ===== */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="od-dialog-content"
            closeClassName="od-dialog-close-btn"
            overlayClassName="od-dialog-overlay"
            style={{ width: '660rpx', maxWidth: 'calc(100vw - 64rpx)', height: '72vh', padding: 0, gap: 0 }}
          >
            {selectedAvatar && (() => {
              const av = selectedAvatar
              const avatarStatus = av.status || 'pending'
              const hasContent = ['preview', 'publishing', 'submitted', 'published', 'awaiting_acceptance', 'feedback_submitted', 'completed'].includes(avatarStatus)
              const avatarImages: string[] = Array.isArray(av.images) ? av.images : []
              const avatarVideoUrls = av.videoUrls
              const publishFeedback = av.publishFeedback || {}
              const hasFeedback = publishFeedback && Object.keys(publishFeedback).length > 0
              const contentTypeLabel = av.contentType === 'image_text' || av.contentType === 'image' ? '图文' : av.contentType === 'video' ? '视频' : av.contentType === 'text' ? '纯文案' : av.contentType || '内容'
              const avatarStatusCfg = STATUS_CONFIG[avatarStatus] || { label: avatarStatus, color: '#9CA3AF', bgColor: '#F9FAFB' }
              const previewCount = (av.content ? 1 : 0) + avatarImages.length + avatarVideoUrls.length
              const feedbackPlatformCount = hasFeedback ? Object.keys(publishFeedback).length : 0

              return (
                <View className="od-dialog-body">
                  {/* 弹窗头部 - 渐变背景 */}
                  <View className="od-dialog-header">
                    <View className="od-dialog-header-bg" />
                    <View className="od-dialog-header-content">
                      {av.avatarUrl ? (
                        <Image src={av.avatarUrl} className="od-dialog-avatar" mode="aspectFill" />
                      ) : (
                        <View className="od-dialog-avatar-ph">
                          <Text className="block od-dialog-avatar-ph-text">{(av.avatarName || '?')[0]}</Text>
                        </View>
                      )}
                      <View className="od-dialog-avatar-info">
                        <Text className="block od-dialog-title">{av.avatarName || '分身'}</Text>
                        <View className="od-dialog-meta-row">
                          <View className="od-dialog-type-tag">
                            <Text className="block od-dialog-type-tag-text">{contentTypeLabel}</Text>
                          </View>
                          <View className="od-dialog-status-dot" style={{ backgroundColor: avatarStatusCfg.color }} />
                          <Text className="block od-dialog-status-text" style={{ color: avatarStatusCfg.color }}>{avatarStatusCfg.label}</Text>
                        </View>
                        {av.phone && (
                          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            <Phone size={13} color="#6B7280" />
                            <Text style={{ fontSize: '13px', color: '#374151' }}>{av.phone}</Text>
                            <View
                              style={{ padding: '2px 10px', backgroundColor: '#4F46E5', borderRadius: '12px' }}
                              onClick={() => Taro.makePhoneCall({ phoneNumber: av.phone })}
                            >
                              <Text style={{ fontSize: '12px', color: '#fff' }}>一键拨打</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {hasContent ? (
                    <View className="od-dialog-main">
                      {/* Tab 切换栏 */}
                      <View className="od-dialog-tabs-bar">
                        <View
                          className={`od-dialog-tab-item ${dialogTab === 'content' ? 'od-dialog-tab-active' : ''}`}
                          onClick={() => setDialogTab('content')}
                        >
                          <FileText size={14} color={dialogTab === 'content' ? '#6366F1' : '#9CA3AF'} />
                          <Text className="block od-dialog-tab-text" style={{ color: dialogTab === 'content' ? '#6366F1' : '#6B7280' }}>
                            生成内容
                          </Text>
                          {previewCount > 0 && (
                            <View className="od-dialog-tab-badge">
                              <Text className="block od-dialog-tab-badge-text">{previewCount}</Text>
                            </View>
                          )}
                        </View>
                        <View
                          className={`od-dialog-tab-item ${dialogTab === 'feedback' ? 'od-dialog-tab-active' : ''}`}
                          onClick={() => setDialogTab('feedback')}
                        >
                          <Send size={14} color={dialogTab === 'feedback' ? '#6366F1' : '#9CA3AF'} />
                          <Text className="block od-dialog-tab-text" style={{ color: dialogTab === 'feedback' ? '#6366F1' : '#6B7280' }}>
                            发布反馈
                          </Text>
                          {feedbackPlatformCount > 0 && (
                            <View className="od-dialog-tab-badge">
                              <Text className="block od-dialog-tab-badge-text">{feedbackPlatformCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* 内容区域 */}
                      <ScrollView scrollY className="od-dialog-scroll">
                        {dialogTab === 'content' && (
                          <View className="od-dialog-content-inner">
                            {/* 文案内容 - Markdown 渲染 */}
                            {av.content && (
                              <View className="od-dialog-card">
                                <View className="od-dialog-card-header">
                                  <View className="od-dialog-card-icon-wrap" style={{ backgroundColor: '#EEF2FF' }}>
                                    <FileText size={14} color="#6366F1" />
                                  </View>
                                  <Text className="block od-dialog-card-title">生成文案</Text>
                                </View>
                                <View className="od-dialog-markdown-body">
                                  <MarkdownRenderer content={av.content} />
                                </View>
                              </View>
                            )}

                            {/* 图片 */}
                            {avatarImages.length > 0 && (
                              <View className="od-dialog-card">
                                <View className="od-dialog-card-header">
                                  <View className="od-dialog-card-icon-wrap" style={{ backgroundColor: '#FEF3C7' }}>
                                    <ImageIcon size={14} color="#F59E0B" />
                                  </View>
                                  <Text className="block od-dialog-card-title">生成配图</Text>
                                  <Text className="block od-dialog-card-count">{avatarImages.length}张</Text>
                                </View>
                                <View className="od-dialog-images-grid">
                                  {avatarImages.map((img: string, imgIdx: number) => (
                                    <View key={imgIdx} className="od-dialog-img-wrap">
                                      <Image
                                        src={img}
                                        className="od-dialog-img-thumb"
                                        mode="aspectFill"
                                        onClick={() => {
                                          Taro.previewImage({ current: img, urls: avatarImages })
                                        }}
                                      />
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}

                            {/* 视频 */}
                            {avatarVideoUrls.length > 0 && (
                              <View className="od-dialog-card">
                                <View className="od-dialog-card-header">
                                  <View className="od-dialog-card-icon-wrap" style={{ backgroundColor: '#FCE7F3' }}>
                                    <Video size={14} color="#EC4899" />
                                  </View>
                                  <Text className="block od-dialog-card-title">生成视频</Text>
                                </View>
                                {avatarVideoUrls.map((vUrl: string, vIdx: number) => (
                                  <View
                                    key={vIdx}
                                    className="od-dialog-video-card"
                                    onClick={() => {
                                      const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv())
                                      if (isMiniApp) {
                                        Taro.previewMedia({ sources: [{ url: vUrl, type: 'video' }] })
                                      }
                                    }}
                                  >
                                    <View className="od-dialog-video-overlay" />
                                    <View className="od-dialog-video-play">
                                      <Text className="block od-dialog-video-play-icon">▶</Text>
                                    </View>
                                    <Text className="block od-dialog-video-label">点击播放视频</Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            {/* 无内容提示 */}
                            {!av.content && avatarImages.length === 0 && avatarVideoUrls.length === 0 && (
                              <View className="od-dialog-empty">
                                <View className="od-dialog-empty-icon-wrap">
                                  <FileText size={32} color="#D1D5DB" />
                                </View>
                                <Text className="block od-dialog-empty-text">暂无生成内容</Text>
                                <Text className="block od-dialog-empty-sub">内容生成后将在此展示</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {dialogTab === 'feedback' && (
                          <View className="od-dialog-content-inner">
                            {hasFeedback ? (
                              Object.keys(publishFeedback).map(platformKey => {
                                const pf = publishFeedback[platformKey]
                                if (!pf || typeof pf !== 'object') return null
                                const pName = PLATFORM_MAP[platformKey] || platformKey
                                return (
                                  <View key={platformKey} className="od-dialog-card">
                                    <View className="od-dialog-card-header">
                                      <View className="od-dialog-card-icon-wrap" style={{ backgroundColor: '#ECFDF5' }}>
                                        <Send size={14} color="#059669" />
                                      </View>
                                      <Text className="block od-dialog-card-title">{pName}</Text>
                                    </View>
                                    <View className="od-dialog-feedback-data">
                                      {pf.publishUrl && (
                                        <View className="od-dialog-feedback-item">
                                          <ExternalLink size={13} color="#6366F1" />
                                          <Text className="block od-dialog-feedback-key">发布链接</Text>
                                          <Text
                                            className="block od-dialog-feedback-val od-dialog-feedback-link"
                                            onClick={() => {
                                              Taro.setClipboardData({ data: pf.publishUrl }).then(() => {
                                                Taro.showToast({ title: '链接已复制', icon: 'success', duration: 1500 })
                                              }).catch(() => {
                                                Taro.showToast({ title: '复制失败', icon: 'none', duration: 1500 })
                                              })
                                            }}
                                          >
                                            {pf.publishUrl}
                                          </Text>
                                        </View>
                                      )}
                                      {pf.publishTime && (
                                        <View className="od-dialog-feedback-item">
                                          <Calendar size={13} color="#9CA3AF" />
                                          <Text className="block od-dialog-feedback-key">发布时间</Text>
                                          <Text className="block od-dialog-feedback-val">{formatTime(pf.publishTime)}</Text>
                                        </View>
                                      )}
                                      {pf.views !== undefined && (
                                        <View className="od-dialog-feedback-item">
                                          <Eye size={13} color="#3B82F6" />
                                          <Text className="block od-dialog-feedback-key">浏览量</Text>
                                          <Text className="block od-dialog-feedback-val od-dialog-feedback-num">{pf.views?.toLocaleString?.() || pf.views}</Text>
                                        </View>
                                      )}
                                      {pf.likes !== undefined && (
                                        <View className="od-dialog-feedback-item">
                                          <ThumbsUp size={13} color="#F59E0B" />
                                          <Text className="block od-dialog-feedback-key">点赞数</Text>
                                          <Text className="block od-dialog-feedback-val od-dialog-feedback-num">{pf.likes?.toLocaleString?.() || pf.likes}</Text>
                                        </View>
                                      )}
                                      {pf.comments !== undefined && (
                                        <View className="od-dialog-feedback-item">
                                          <MessageCircle size={13} color="#10B981" />
                                          <Text className="block od-dialog-feedback-key">评论数</Text>
                                          <Text className="block od-dialog-feedback-val od-dialog-feedback-num">{pf.comments?.toLocaleString?.() || pf.comments}</Text>
                                        </View>
                                      )}
                                      {pf.remark && (
                                        <View className="od-dialog-feedback-item">
                                          <FileText size={13} color="#9CA3AF" />
                                          <Text className="block od-dialog-feedback-key">备注</Text>
                                          <Text className="block od-dialog-feedback-val">{pf.remark}</Text>
                                        </View>
                                      )}
                                    </View>
                                    {/* 反馈截图 */}
                                    {Array.isArray(pf.images) && pf.images.length > 0 && (
                                      <View className="od-dialog-feedback-screenshots">
                                        <Text className="block od-dialog-feedback-ss-label">发布截图</Text>
                                        <View className="od-dialog-images-grid">
                                          {pf.images.map((img: string, imgIdx: number) => (
                                            <View key={imgIdx} className="od-dialog-img-wrap">
                                              <Image
                                                src={img}
                                                className="od-dialog-img-thumb"
                                                mode="aspectFill"
                                                onClick={() => {
                                                  Taro.previewImage({ current: img, urls: pf.images })
                                                }}
                                              />
                                            </View>
                                          ))}
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                )
                              })
                            ) : (
                              <View className="od-dialog-empty">
                                <View className="od-dialog-empty-icon-wrap">
                                  <Send size={32} color="#D1D5DB" />
                                </View>
                                <Text className="block od-dialog-empty-text">暂无发布反馈</Text>
                                <Text className="block od-dialog-empty-sub">发布后将在此展示反馈数据</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  ) : (
                    <View className="od-dialog-no-content">
                      <View className="od-dialog-no-content-icon">
                        {avatarStatus === 'generating' ? <Loader size={40} color="#8B5CF6" /> :
                          avatarStatus === 'pending' ? <Clock size={40} color="#9CA3AF" /> :
                            <CircleX size={40} color="#EF4444" />}
                      </View>
                      <Text className="block od-dialog-no-content-title">
                        {avatarStatus === 'generating' ? '内容生成中' :
                          avatarStatus === 'accepted' ? '准备生成中' :
                            avatarStatus === 'pending' ? '等待接单' :
                              avatarStatus === 'rejected' ? '已拒绝订单' :
                                avatarStatus === 'expired' ? '接单已过期' :
                                  '暂无内容'}
                      </Text>
                      <Text className="block od-dialog-no-content-desc">
                        {avatarStatus === 'generating' ? '分身正在创作内容，请稍后查看' :
                          avatarStatus === 'accepted' ? '分身已接单，即将开始创作' :
                            avatarStatus === 'pending' ? '等待分身确认接单' :
                              avatarStatus === 'rejected' ? '该分身已拒绝此订单' :
                                avatarStatus === 'expired' ? '分身未在规定时间内接单' :
                                  '内容生成后将在此展示'}
                      </Text>
                    </View>
                  )}
                </View>
              )
            })()}
          </DialogContent>
        </Dialog>

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
                const evtType = evt.eventType || ''
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
                        <Text className="block od-timeline-time">{formatTime(evt.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        {(isPayable || isCancellable || isDeletable || isVerifiable || isNeedMatching) && (
          <View className="od-actions">
            {isPayable && (
              <View className="od-action-btn od-action-primary" onClick={handlePay}>
                <CreditCard size={16} color="#fff" />
                <Text className="block od-action-text" style={{ color: '#fff' }}>
                  {paying ? '支付中...' : `立即支付 ¥${order.budget || 0}`}
                </Text>
              </View>
            )}
            {isNeedMatching && (
              <View
                className="od-action-btn od-action-primary"
                onClick={() => {
                  Taro.navigateTo({ url: `/package-order/pages/order-matching/index?orderId=${orderId}` })
                }}
              >
                <Users size={16} color="#fff" />
                <Text className="block od-action-text" style={{ color: '#fff' }}>匹配分身</Text>
              </View>
            )}
            {isVerifiable && (
              <View className="od-action-btn od-action-primary" onClick={handleVerify}>
                <CircleCheckBig size={16} color="#fff" />
                <Text className="block od-action-text" style={{ color: '#fff' }}>去验收</Text>
              </View>
            )}
            {isCancellable && !isPayable && !isNeedMatching && (
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
