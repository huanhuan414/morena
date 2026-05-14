import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import {
  ArrowLeft, Clock, Loader, Users, CircleCheckBig, CircleX,
  Wallet, CreditCard, Send, Trash2,
  FileText, CircleDot
} from 'lucide-react-taro'

// ===== 状态配置 =====
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; phase: number }> = {
  pending_payment: { label: '待支付', color: '#F59E0B', bgColor: '#FEF3C7', phase: 0 },
  pending: { label: '匹配中', color: '#3B82F6', bgColor: '#DBEAFE', phase: 1 },
  awaiting_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#E0E7FF', phase: 1 },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#E0E7FF', phase: 1 },
  accepted: { label: '已接单', color: '#10B981', bgColor: '#D1FAE5', phase: 2 },
  in_progress: { label: '制作中', color: '#10B981', bgColor: '#D1FAE5', phase: 2 },
  content_generated: { label: '已生成', color: '#8B5CF6', bgColor: '#EDE9FE', phase: 2 },
  submitted: { label: '待发布', color: '#8B5CF6', bgColor: '#EDE9FE', phase: 3 },
  published: { label: '已发布', color: '#059669', bgColor: '#D1FAE5', phase: 3 },
  completed: { label: '已完成', color: '#059669', bgColor: '#D1FAE5', phase: 4 },
  publish_failed: { label: '发布失败', color: '#EF4444', bgColor: '#FEE2E2', phase: -1 },
  publish_timeout: { label: '发布超时', color: '#EF4444', bgColor: '#FEE2E2', phase: -1 },
  cancelled: { label: '已取消', color: '#94A3B8', bgColor: '#F1F5F9', phase: -1 },
  auto_cancelled: { label: '自动取消', color: '#94A3B8', bgColor: '#F1F5F9', phase: -1 },
  timeout: { label: '已超时', color: '#94A3B8', bgColor: '#F1F5F9', phase: -1 },
  expired: { label: '已过期', color: '#94A3B8', bgColor: '#F1F5F9', phase: -1 },
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
  if (phase <= 0) return -1 // 未支付或异常
  if (phase === 1) return 0 // 匹配中
  if (phase === 2) return 1 // 制作中
  if (phase === 3) return 2 // 发布中
  if (phase === 4) return 3 // 已完成
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
  order_cancelled: '#94A3B8',
  dispatch_timeout: '#F59E0B',
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
      // 最多轮询60秒
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
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Loader size={32} color="#3B82F6" className="animate-spin" />
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Text className="block text-gray-400">订单不存在</Text>
      </View>
    )
  }

  const statusCfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#94A3B8', bgColor: '#F1F5F9', phase: -1 }
  const currentPhase = getPhaseIndex(order.status)
  const isPayable = order.status === 'pending_payment'
  const isCancellable = ['pending_payment', 'pending'].includes(order.status)
  const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status)
  const isAbnormal = statusCfg.phase === -1 && order.status !== 'pending_payment'

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      {/* 顶部导航 */}
      <View className="bg-white" style={{ paddingTop: statusBarHeight }}>
        <View className="flex flex-row items-center px-4 py-3">
          <View onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#333" />
          </View>
          <Text className="block ml-2 text-lg font-semibold text-gray-900">订单详情</Text>
        </View>
      </View>

      <ScrollView scrollY className="flex-1">
        {/* ====== 状态横幅 ====== */}
        <View className="mx-4 mt-3 rounded-xl p-4" style={{ backgroundColor: statusCfg.bgColor }}>
          <View className="flex flex-row items-center">
            <View className="w-10 h-10 rounded-full flex items-center justify-center mr-3" style={{ backgroundColor: `${statusCfg.color}20` }}>
              {isPayable ? <Clock size={20} color={statusCfg.color} /> :
               currentPhase >= 0 ? <Loader size={20} color={statusCfg.color} /> :
               isAbnormal ? <CircleX size={20} color={statusCfg.color} /> :
               <CircleCheckBig size={20} color={statusCfg.color} />}
            </View>
            <View className="flex-1">
              <Text className="block text-base font-semibold" style={{ color: statusCfg.color }}>
                {statusCfg.label}
              </Text>
              <Text className="block text-xs mt-1" style={{ color: `${statusCfg.color}CC` }}>
                {isPayable ? '请尽快完成支付，超时订单将自动取消' :
                 currentPhase === 0 ? '正在为你匹配最合适的分身...' :
                 currentPhase === 1 ? '分身正在制作内容' :
                 currentPhase === 2 ? '内容准备发布到平台' :
                 currentPhase === 3 ? '订单已完成' :
                 isAbnormal ? '订单出现异常，请关注' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ====== 4阶段进度条（非pending_payment） ====== */}
        {currentPhase >= 0 && (
          <View className="mx-4 mt-3 bg-white rounded-xl p-4">
            <View className="flex flex-row items-center justify-between">
              {PHASES.map((phase, idx) => {
                const PhaseIcon = phase.icon
                const isActive = idx <= currentPhase
                const isCurrent = idx === currentPhase
                return (
                  <View key={phase.key} className="flex flex-row items-center flex-1">
                    <View className="flex flex-col items-center">
                      <View className={`w-8 h-8 rounded-full flex items-center justify-center ${isCurrent ? 'ring-2 ring-blue-200' : ''}`}
                        style={{ backgroundColor: isActive ? '#3B82F6' : '#F3F4F6' }}
                      >
                        <PhaseIcon size={14} color={isActive ? '#fff' : '#9CA3AF'} />
                      </View>
                      <Text className={`block text-xs mt-1 ${isActive ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {phase.label}
                      </Text>
                    </View>
                    {idx < PHASES.length - 1 && (
                      <View className="flex-1 h-1 mx-1 mt-[-12px]"
                        style={{ backgroundColor: idx < currentPhase ? '#3B82F6' : '#E5E7EB' }}
                      />
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* ====== 订单信息卡 ====== */}
        <Card className="mx-4 mt-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-gray-900 mb-3">订单信息</Text>

            <View className="flex flex-row items-center mb-2">
              <Text className="block text-xs text-gray-400 w-16">标题</Text>
              <Text className="block text-sm text-gray-700 flex-1">{order.title || '—'}</Text>
            </View>
            <View className="flex flex-row items-center mb-2">
              <Text className="block text-xs text-gray-400 w-16">类型</Text>
              <Text className="block text-sm text-gray-700 flex-1">
                {order.contentType === 'text' ? '纯文案' : order.contentType === 'image_text' ? '图文笔记' : order.contentType === 'video' ? '短视频' : order.contentType === 'article' ? '长文' : order.contentType || '—'}
              </Text>
            </View>
            <View className="flex flex-row items-center mb-2">
              <Text className="block text-xs text-gray-400 w-16">平台</Text>
              <Text className="block text-sm text-gray-700 flex-1">
                {Array.isArray(order.platforms) ? order.platforms.join('、') : order.platforms || '—'}
              </Text>
            </View>
            <View className="flex flex-row items-center mb-2">
              <Text className="block text-xs text-gray-400 w-16">分身</Text>
              <Text className="block text-sm text-gray-700 flex-1">{order.avatarCount || order.avatar_count || '—'} 个</Text>
            </View>
            {order.targetAudience && (
              <View className="flex flex-row items-center mb-2">
                <Text className="block text-xs text-gray-400 w-16">受众</Text>
                <Text className="block text-sm text-gray-700 flex-1">{order.targetAudience}</Text>
              </View>
            )}

            <Separator className="my-3" />

            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center">
                <Wallet size={14} color="#F59E0B" className="mr-1" />
                <Text className="block text-xs text-gray-400">订单金额</Text>
              </View>
              <Text className="block text-lg font-bold text-gray-900">¥{order.budget || order.totalPrice || 0}</Text>
            </View>
          </CardContent>
        </Card>

        {/* ====== 分身状态卡 ====== */}
        {dispatches.length > 0 && (
          <Card className="mx-4 mt-3">
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-gray-900 mb-3">分身进度</Text>
              {dispatches.map((d: any, idx: number) => {
                const dStatus = d.status || d.dispatchStatus || ''
                const dCfg = STATUS_CONFIG[dStatus] || { label: dStatus, color: '#94A3B8', bgColor: '#F1F5F9' }
                return (
                  <View key={d.id || idx} className="flex flex-row items-center py-2 border-b border-gray-50 last:border-0">
                    <View className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                      <Users size={14} color="#6B7280" />
                    </View>
                    <View className="flex-1">
                      <Text className="block text-sm text-gray-700">{d.avatarName || `分身 ${idx + 1}`}</Text>
                      <Text className="block text-xs text-gray-400 mt-1">{d.avatarPlatform || ''}</Text>
                    </View>
                    <Badge className="text-xs" style={{ backgroundColor: dCfg.bgColor, color: dCfg.color }}>
                      {dCfg.label}
                    </Badge>
                  </View>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* ====== 事件时间线 ====== */}
        {events.length > 0 && (
          <Card className="mx-4 mt-3 mb-6">
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-gray-900 mb-3">动态记录</Text>
              {events.map((evt: any, idx: number) => {
                const EventIcon = EVENT_ICONS[evt.eventType || evt.event_type] || CircleDot
                const eventColor = EVENT_COLORS[evt.eventType || evt.event_type] || '#94A3B8'
                return (
                  <View key={evt.id || idx} className="flex flex-row items-start mb-3 last:mb-0">
                    <View className="flex flex-col items-center mr-3">
                      <View className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${eventColor}15` }}>
                        <EventIcon size={12} color={eventColor} />
                      </View>
                      {idx < events.length - 1 && <View className="w-1 h-4 bg-gray-100 mt-1" />}
                    </View>
                    <View className="flex-1">
                      <Text className="block text-sm text-gray-700">{evt.eventTitle || evt.description || evt.eventType || ''}</Text>
                      <Text className="block text-xs text-gray-400 mt-1">
                        {formatTime(evt.createdAt || evt.created_at)}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* 底部安全区 */}
        <View className="h-24" />
      </ScrollView>

      {/* ====== 底部操作栏 ====== */}
      {(isPayable || isCancellable || isDeletable) && (
        <View style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'row', gap: '8px',
          padding: '12px 16px', paddingBottom: 24, backgroundColor: '#fff',
          borderTop: '1px solid #F3F4F6', zIndex: 100,
        }}
        >
          {isPayable && (
            <View style={{ flex: 2 }} onClick={handlePay}>
              <Button className="w-full rounded-xl py-3" disabled={paying}>
                <View className="flex flex-row items-center justify-center">
                  <CreditCard size={16} color="#fff" className="mr-2" />
                  <Text className="text-white font-medium">
                    {paying ? '支付中...' : `立即支付 ¥${order.budget || order.totalPrice || 0}`}
                  </Text>
                </View>
              </Button>
            </View>
          )}
          {isCancellable && (
            <View style={{ flex: 1 }} onClick={handleCancel}>
              <Button variant="outline" className="w-full rounded-xl py-3">
                <Text className="text-xs">取消订单</Text>
              </Button>
            </View>
          )}
          {isDeletable && (
            <View style={{ flex: 1 }} onClick={handleDelete}>
              <Button variant="outline" className="w-full rounded-xl py-3 border-red-200">
                <View className="flex flex-row items-center justify-center">
                  <Trash2 size={12} color="#EF4444" className="mr-1" />
                  <Text className="text-xs text-red-500">删除</Text>
                </View>
              </Button>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}
