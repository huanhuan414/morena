import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import {
  Plus, Loader, Users,
  CircleCheck, CircleX, TriangleAlert,
  Wallet, FileText, Video, Zap, Trash2, CreditCard, Camera,
  Clock
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
const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
  icon: any
  phase: number
}> = {
  pending_payment:    { label: '待支付',   color: '#F59E0B', bgColor: '#FFFBEB', icon: Wallet,       phase: 0 },
  pending:            { label: '匹配中',   color: '#7C3AED', bgColor: '#F5F3FF', icon: Loader,       phase: 1 },
  awaiting_acceptance:{ label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', icon: Users,        phase: 1 },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', icon: Users,        phase: 1 },
  accepted:           { label: '已接单',   color: '#10B981', bgColor: '#ECFDF5', icon: CircleCheck,  phase: 2 },
  in_progress:        { label: '制作中',   color: '#10B981', bgColor: '#ECFDF5', icon: Loader,       phase: 2 },
  content_generated:  { label: '已生成',   color: '#8B5CF6', bgColor: '#F5F3FF', icon: FileText,     phase: 2 },
  submitted:          { label: '待发布',   color: '#8B5CF6', bgColor: '#F5F3FF', icon: FileText,     phase: 3 },
  published:          { label: '已发布',   color: '#059669', bgColor: '#ECFDF5', icon: CircleCheck,  phase: 3 },
  completed:          { label: '已完成',   color: '#059669', bgColor: '#ECFDF5', icon: CircleCheck,  phase: 4 },
  publish_failed:     { label: '发布失败', color: '#EF4444', bgColor: '#FEF2F2', icon: TriangleAlert, phase: -1 },
  publish_timeout:    { label: '发布超时', color: '#EF4444', bgColor: '#FEF2F2', icon: TriangleAlert, phase: -1 },
  cancelled:          { label: '已取消',   color: '#9CA3AF', bgColor: '#F9FAFB', icon: CircleX,       phase: -1 },
  auto_cancelled:     { label: '自动取消', color: '#9CA3AF', bgColor: '#F9FAFB', icon: CircleX,       phase: -1 },
  timeout:            { label: '已超时',   color: '#9CA3AF', bgColor: '#F9FAFB', icon: CircleX,       phase: -1 },
  expired:            { label: '已过期',   color: '#9CA3AF', bgColor: '#F9FAFB', icon: CircleX,       phase: -1 },
}

// Tab 配置
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'completed', label: '已完成' },
  { key: 'closed', label: '已关闭' },
]

function isStatusInTab(status: string, tabKey: string): boolean {
  if (tabKey === 'all') return true
  if (tabKey === 'active') return ['pending', 'awaiting_acceptance', 'pending_acceptance', 'accepted', 'in_progress', 'content_generated', 'submitted', 'published'].includes(status)
  if (tabKey === 'pending_payment') return status === 'pending_payment'
  if (tabKey === 'completed') return status === 'completed'
  if (tabKey === 'closed') return ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'publish_failed', 'publish_timeout'].includes(status)
  return false
}

// 从 dispatchSummary 提取进度
function getDispatchProgress(order: any) {
  const summary = order.dispatchSummary
  if (!Array.isArray(summary) || summary.length === 0) {
    const total = order.avatarCount || 0
    return { accepted: 0, total, published: 0 }
  }
  const total = summary.length
  const accepted = summary.filter((s: any) => ['accepted', 'in_progress', 'content_generated', 'submitted', 'published', 'completed'].includes(s.status)).length
  const published = summary.filter((s: any) => ['published', 'completed'].includes(s.status)).length
  return { accepted, total, published }
}

// 进度文案
function getPhaseText(order: any): string {
  const phase = STATUS_CONFIG[order.status]?.phase ?? -1
  const progress = getDispatchProgress(order)
  switch (phase) {
    case 0: return '等待支付'
    case 1: return progress.total > 0 ? `匹配 ${progress.total} 个分身中` : '匹配分身中'
    case 2: return `${progress.accepted}/${progress.total} 制作中`
    case 3: return `${progress.published}/${progress.total} 已发布`
    case 4: return '全部完成'
    default: return ''
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  } catch { return '' }
}

export default function OrderListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const statusBarHeight = getStatusBarHeight()

  const fetchOrders = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/order/list' })
      console.log('[OrderList] response:', JSON.stringify(res.data)?.substring(0, 300))
      const raw = res.data?.data
      const list = Array.isArray(raw) ? raw : []
      console.log('[OrderList] parsed list length:', list.length)
      setOrders(list)
    } catch (err) {
      console.error('[OrderList] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => { fetchOrders() })

  const onRefresh = useCallback(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  // 筛选 + 排序
  const filteredOrders = orders
    .filter(o => isStatusInTab(o.status, activeTab))
    .sort((a, b) => {
      const pa = STATUS_CONFIG[a.status]?.phase ?? 99
      const pb = STATUS_CONFIG[b.status]?.phase ?? 99
      if (pa !== pb) return pa - pb
      return new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()
    })

  // 统计数据
  const statsData = {
    total: orders.length,
    active: orders.filter(o => isStatusInTab(o.status, 'active')).length,
    pendingPayment: orders.filter(o => o.status === 'pending_payment').length,
  }

  // Tab 数量
  const tabCounts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.key] = orders.filter(o => isStatusInTab(o.status, tab.key)).length
    return acc
  }, {} as Record<string, number>)

  // ===== 操作 =====
  const handleGoToPay = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/package-order/pages/order-detail/index?id=${orderId}&action=pay` })
  }, [])

  const handleCancel = useCallback(async (orderId: string) => {
    const { confirm } = await Taro.showModal({ title: '取消订单', content: '确定要取消此订单吗？取消后可重新发单。' })
    if (!confirm) return
    try {
      const res = await Network.request({ url: `/api/order/${orderId}/cancel`, method: 'POST' })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已取消', icon: 'success' })
        fetchOrders()
      } else {
        Taro.showToast({ title: res.data?.message || '取消失败', icon: 'none' })
      }
    } catch { Taro.showToast({ title: '取消失败', icon: 'none' }) }
  }, [fetchOrders])

  const handleDelete = useCallback(async (orderId: string) => {
    const { confirm } = await Taro.showModal({ title: '删除订单', content: '删除后不可恢复，确定删除？', confirmColor: '#EF4444' })
    if (!confirm) return
    try {
      const res = await Network.request({ url: `/api/order/${orderId}`, method: 'DELETE' })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        fetchOrders()
      } else {
        Taro.showToast({ title: res.data?.message || '删除失败', icon: 'none' })
      }
    } catch { Taro.showToast({ title: '删除失败', icon: 'none' }) }
  }, [fetchOrders])

  const handleGoDetail = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/package-order/pages/order-detail/index?id=${orderId}` })
  }, [])

  const handleCreate = useCallback(() => {
    Taro.navigateTo({ url: '/package-order/pages/order-create/index' })
  }, [])

  // 渲染进度条色段
  const renderProgress = (order: any) => {
    const progress = getDispatchProgress(order)
    if (progress.total <= 0) return null
    const acceptedPct = (progress.accepted / progress.total) * 100
    const publishedPct = (progress.published / progress.total) * 100
    return (
      <View className="ol-avatar-progress">
        <View className="ol-progress-track">
          <View className="ol-progress-seg" style={{ width: `${publishedPct}%`, backgroundColor: '#059669' }} />
          <View className="ol-progress-seg" style={{ width: `${acceptedPct - publishedPct}%`, backgroundColor: '#10B981' }} />
          <View className="ol-progress-seg" style={{ flex: 1, backgroundColor: '#E5E7EB' }} />
        </View>
        <View className="ol-progress-labels">
          {progress.accepted > 0 && (
            <View className="ol-progress-label-item">
              <View style={{ width: '12rpx', height: '12rpx', borderRadius: '50%', backgroundColor: '#10B981' }} />
              <Text className="ol-progress-label-text" style={{ color: '#10B981' }}>{progress.accepted} 接单</Text>
            </View>
          )}
          {progress.published > 0 && (
            <View className="ol-progress-label-item">
              <View style={{ width: '12rpx', height: '12rpx', borderRadius: '50%', backgroundColor: '#059669' }} />
              <Text className="ol-progress-label-text" style={{ color: '#059669' }}>{progress.published} 已发布</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className="ol-page">
      {/* ===== 顶部渐变头部 ===== */}
      <View className="ol-header">
        <View className="ol-header-decor ol-header-decor-1" />
        <View className="ol-header-decor ol-header-decor-2" />
        <View className="ol-header-nav" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
          <View className="ol-back-btn" onClick={() => Taro.navigateBack()}>
            {/* 返回按钮 */}
          </View>
          <View className="ol-header-center">
            <Text className="block ol-header-title">我的订单</Text>
            <Text className="block ol-header-subtitle">管理你的全部发单</Text>
          </View>
          <View className="ol-header-right" onClick={handleCreate}>
            <Plus size={20} color="#fff" />
          </View>
        </View>
      </View>

      {/* ===== 统计栏 ===== */}
      <View className="ol-stats">
        <View className="ol-stat-item">
          <Text className="block ol-stat-num">{statsData.total}</Text>
          <Text className="block ol-stat-label">全部订单</Text>
        </View>
        <View className="ol-stat-divider" />
        <View className="ol-stat-item">
          <Text className="block ol-stat-num" style={{ color: '#7C3AED' }}>{statsData.active}</Text>
          <Text className="block ol-stat-label">进行中</Text>
        </View>
        <View className="ol-stat-divider" />
        <View className="ol-stat-item">
          <Text className="block ol-stat-num" style={{ color: '#F59E0B' }}>{statsData.pendingPayment}</Text>
          <Text className="block ol-stat-label">待支付</Text>
        </View>
      </View>

      {/* ===== Tab 筛选 ===== */}
      <ScrollView scrollX className="ol-tabs">
        {STATUS_TABS.map(tab => (
          <View
            key={tab.key}
            className={`ol-tab ${activeTab === tab.key ? 'ol-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className="block ol-tab-text">{tab.label}</Text>
            {tabCounts[tab.key] > 0 && (
              <View className="ol-tab-badge">
                <Text className="block ol-tab-badge-text">{tabCounts[tab.key]}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* ===== 内容区域 ===== */}
      {loading && orders.length === 0 ? (
        <View className="ol-loading">
          <Loader size={40} color="#7C3AED" className="ol-spin" />
          <Text className="block ol-loading-text">加载中...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View className="ol-empty">
          <FileText size={48} color="#D1D5DB" />
          <Text className="block ol-empty-text">
            {activeTab === 'all' ? '暂无订单，去发一单吧' : '该状态下暂无订单'}
          </Text>
          {activeTab === 'all' && (
            <View style={{ marginTop: '24rpx' }}>
              <Button size="sm" onClick={handleCreate}>
                <Text className="text-xs text-white">立即发单</Text>
              </Button>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          scrollY
          className="ol-list"
          refresherEnabled
          onRefresherRefresh={() => onRefresh()}
          refresherTriggered={loading}
        >
          {filteredOrders.map(order => {
            const statusCfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#9CA3AF', bgColor: '#F9FAFB', icon: FileText, phase: -1 }
            const StatusIcon = statusCfg.icon
            const ctConfig = CONTENT_TYPE_MAP[order.contentType] || CONTENT_TYPE_MAP.text
            const ContentTypeIcon = ctConfig.icon
            const phaseText = getPhaseText(order)
            const isPayable = order.status === 'pending_payment'
            const isCancellable = ['pending_payment', 'pending'].includes(order.status)
            const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status)
            const isAbnormal = ['publish_failed', 'publish_timeout'].includes(order.status)
            const budget = order.budget || order.totalPrice || 0

            return (
              <View key={order.id} className={`ol-card ${isAbnormal ? 'ol-card-abnormal' : ''}`} onClick={() => handleGoDetail(order.id)}>
                {/* 卡片头部：状态 + 标题 */}
                <View className="ol-card-header">
                  <View className="ol-card-header-left">
                    <View className="ol-status-dot" style={{ backgroundColor: statusCfg.color }} />
                    <Text className="block ol-card-title">{order.title || '未命名订单'}</Text>
                  </View>
                  <View className="ol-card-header-right">
                    {isAbnormal && (
                      <View className="ol-alert-badge">
                        <TriangleAlert size={16} color="#fff" />
                        <Text className="block ol-alert-badge-text">异常</Text>
                      </View>
                    )}
                    <View className="ol-status-pill" style={{ backgroundColor: statusCfg.bgColor }}>
                      <StatusIcon size={20} color={statusCfg.color} />
                      <Text className="block ol-status-pill-text" style={{ color: statusCfg.color }}>{statusCfg.label}</Text>
                    </View>
                  </View>
                </View>

                {/* 标签行：内容类型 + 平台 */}
                <View className="ol-card-pills">
                  <View className="ol-platform-pill" style={{ backgroundColor: 'rgba(139,92,246,0.08)' }}>
                    <ContentTypeIcon size={20} color="#7C3AED" />
                    <Text className="block ol-pill-text" style={{ color: '#7C3AED' }}>{ctConfig.label}</Text>
                  </View>
                  {Array.isArray(order.platforms) ? order.platforms.map((p: string, i: number) => (
                    <View key={i} className="ol-platform-pill">
                      <Text className="block ol-pill-text">{PLATFORM_MAP[p] || p}</Text>
                    </View>
                  )) : null}
                </View>

                {/* 分身进度条（活跃订单） */}
                {statusCfg.phase > 0 && renderProgress(order)}

                {/* 信息栏 */}
                <View className="ol-card-info">
                  <View className="ol-info-item">
                    <Wallet size={22} color="#F59E0B" />
                    <Text className="block ol-info-text">¥{budget}</Text>
                  </View>
                  <View className="ol-info-item">
                    <Users size={22} color="#7C3AED" />
                    <Text className="block ol-info-text">{order.avatarCount || 0} 个分身</Text>
                  </View>
                  <View className="ol-info-item">
                    <Clock size={22} color="#9CA3AF" />
                    <Text className="block ol-info-text">{formatTime(order.createdAt || order.created_at)}</Text>
                  </View>
                  {phaseText && statusCfg.phase > 0 && (
                    <View className="ol-info-item">
                      <Text className="block ol-info-text" style={{ color: statusCfg.color }}>{phaseText}</Text>
                    </View>
                  )}
                </View>

                {/* 操作按钮区 */}
                {(isPayable || isCancellable || isDeletable) && (
                  <View className="ol-card-actions" onClick={(e) => e.stopPropagation()}>
                    {isPayable && (
                      <View className="ol-action-btn ol-action-primary" onClick={() => handleGoToPay(order.id)}>
                        <CreditCard size={22} color="#fff" />
                        <Text className="block ol-action-btn-text" style={{ color: '#fff' }}>去支付</Text>
                      </View>
                    )}
                    {isCancellable && !isPayable && (
                      <View className="ol-action-btn ol-action-default" onClick={() => handleCancel(order.id)}>
                        <Text className="block ol-action-btn-text" style={{ color: '#7C3AED' }}>取消</Text>
                      </View>
                    )}
                    {isDeletable && (
                      <View className="ol-action-btn ol-action-default" onClick={() => handleDelete(order.id)}>
                        <Trash2 size={22} color="#EF4444" />
                        <Text className="block ol-action-btn-text" style={{ color: '#EF4444' }}>删除</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}

          {/* 底部安全区 */}
          <View style={{ height: '120rpx' }} />
        </ScrollView>
      )}

      {/* ===== 底部发单按钮 ===== */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '20rpx 32rpx', paddingBottom: '40rpx',
          backgroundColor: '#fff',
          borderTop: '1rpx solid #F3F4F6',
          zIndex: 100
        }}
      >
        <Button
          className="w-full"
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
            borderRadius: '48rpx',
            height: '88rpx'
          }}
          onClick={handleCreate}
        >
          <Zap size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', marginLeft: '8rpx' }}>发布新订单</Text>
        </Button>
      </View>
    </View>
  )
}
