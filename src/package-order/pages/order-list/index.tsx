import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import {
  Plus, LoaderCircle, Users,
  CircleCheck, CircleX, TriangleAlert,
  Wallet, FileText, Video, Zap, Trash2, CreditCard, Camera,
  Clock
} from 'lucide-react-taro'

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
  pending:            { label: '匹配中',   color: '#3B82F6', bgColor: '#EFF6FF', icon: LoaderCircle, phase: 1 },
  awaiting_acceptance:{ label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', icon: Users,        phase: 1 },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#EEF2FF', icon: Users,        phase: 1 },
  accepted:           { label: '已接单',   color: '#10B981', bgColor: '#ECFDF5', icon: CircleCheck,  phase: 2 },
  in_progress:        { label: '制作中',   color: '#10B981', bgColor: '#ECFDF5', icon: LoaderCircle, phase: 2 },
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

// 进度百分比
function getProgressPercent(order: any): number {
  const phase = STATUS_CONFIG[order.status]?.phase ?? -1
  if (phase <= 0) return 0
  if (phase >= 4) return 100
  const progress = getDispatchProgress(order)
  if (phase === 1) return 25
  if (phase === 2) return 25 + (progress.total > 0 ? (progress.accepted / progress.total) * 50 : 25)
  if (phase === 3) return 75 + (progress.total > 0 ? (progress.published / progress.total) * 25 : 12)
  return 0
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

  const fetchOrders = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/order/list' })
      console.log('[OrderList] response:', JSON.stringify(res.data)?.substring(0, 300))
      // 后端返回 { code: 200, data: [...], message: "..." }，data 是数组
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

  useEffect(() => { fetchOrders() }, [fetchOrders])

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

  // 渲染平台标签
  const renderPlatformTags = (platforms: string[] | string) => {
    if (!platforms) return null
    const arr = Array.isArray(platforms) ? platforms : [platforms]
    return arr.map((p: string, i: number) => (
      <View key={i} className="px-2 py-1 rounded bg-gray-100 mr-1">
        <Text className="block text-xs text-gray-500">{PLATFORM_MAP[p] || p}</Text>
      </View>
    ))
  }

  return (
    <View className="flex flex-col bg-gray-50" style={{ minHeight: '100vh' }}>
      {/* 顶部标题栏 */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View className="flex flex-row items-center justify-between">
          <Text className="block text-lg font-bold text-gray-900">我的订单</Text>
          <View onClick={handleCreate}>
            <Button size="sm" className="rounded-full">
              <Plus size={14} color="#fff" />
              <Text className="text-xs text-white ml-1">发单</Text>
            </Button>
          </View>
        </View>
      </View>

      {/* Tab 栏 */}
      <View className="bg-white border-b border-gray-100">
        <ScrollView scrollX className="flex flex-row px-3 py-2">
          {STATUS_TABS.map(tab => (
            <View
              key={tab.key}
              className={`flex flex-row items-center px-3 py-2 rounded-full mr-2 ${activeTab === tab.key ? 'bg-blue-500' : 'bg-gray-100'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className={`block text-xs ${activeTab === tab.key ? 'text-white font-medium' : 'text-gray-600'}`}>
                {tab.label}
              </Text>
              {tabCounts[tab.key] > 0 && (
                <Text className={`block text-xs ml-1 ${activeTab === tab.key ? 'text-blue-100' : 'text-gray-400'}`}>
                  {tabCounts[tab.key]}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 内容区域 */}
      {loading && orders.length === 0 ? (
        // 加载态
        <View className="flex items-center justify-center py-20">
          <LoaderCircle size={32} color="#9CA3AF" />
          <Text className="block mt-3 text-sm text-gray-400">加载中...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        // 空状态
        <View className="flex items-center justify-center py-20">
          <FileText size={48} color="#D1D5DB" />
          <Text className="block mt-4 text-sm text-gray-400">
            {activeTab === 'all' ? '暂无订单，去发一单吧' : '该状态下暂无订单'}
          </Text>
          {activeTab === 'all' && (
            <View className="mt-4">
              <Button size="sm" onClick={handleCreate}>
                <Text className="text-xs text-white">立即发单</Text>
              </Button>
            </View>
          )}
        </View>
      ) : (
        // 订单列表
        <ScrollView
          scrollY
          style={{ height: 'calc(100vh - 180rpx)' }}
          refresherEnabled
          onRefresherRefresh={() => onRefresh()}
          refresherTriggered={loading}
        >
          <View className="px-4 pt-3 pb-24">
            {filteredOrders.map(order => {
              const statusCfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#9CA3AF', bgColor: '#F9FAFB', icon: FileText, phase: -1 }
              const StatusIcon = statusCfg.icon
              const ctConfig = CONTENT_TYPE_MAP[order.contentType] || CONTENT_TYPE_MAP.text
              const ContentTypeIcon = ctConfig.icon
              const phaseText = getPhaseText(order)
              const progressPercent = getProgressPercent(order)
              const isPayable = order.status === 'pending_payment'
              const isCancellable = ['pending_payment', 'pending'].includes(order.status)
              const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status)
              const budget = order.budget || order.totalPrice || 0

              return (
                <View key={order.id} className="bg-white rounded-xl mb-3 shadow-sm overflow-hidden">
                  {/* 顶部状态条 */}
                  <View className="flex flex-row items-center justify-between px-4 py-2" style={{ backgroundColor: statusCfg.bgColor }}>
                    <View className="flex flex-row items-center">
                      <StatusIcon size={14} color={statusCfg.color} />
                      <Text className="block text-xs font-medium ml-1" style={{ color: statusCfg.color }}>{statusCfg.label}</Text>
                    </View>
                    <View className="flex flex-row items-center">
                      <Clock size={10} color="#9CA3AF" />
                      <Text className="block text-xs text-gray-400 ml-1">{formatTime(order.createdAt || order.created_at)}</Text>
                    </View>
                  </View>

                  {/* 主内容 - 点击跳转详情 */}
                  <View className="px-4 py-3" onClick={() => handleGoDetail(order.id)}>
                    {/* 标题行：类型图标 + 标题 + 箭头 */}
                    <View className="flex flex-row items-center">
                      <View className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: statusCfg.bgColor }}>
                        <ContentTypeIcon size={16} color={statusCfg.color} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="block text-sm font-medium text-gray-900">
                          {order.title || '未命名订单'}
                        </Text>
                      </View>
                    </View>

                    {/* 标签行：内容类型 + 平台 */}
                    <View className="flex flex-row items-center mt-2 ml-11">
                      <Badge variant="secondary" className="mr-1">
                        <Text className="text-xs">{ctConfig.label}</Text>
                      </Badge>
                      {renderPlatformTags(order.platforms)}
                    </View>

                    {/* 进度条（仅活跃状态显示） */}
                    {phaseText && statusCfg.phase > 0 && (
                      <View className="mt-3 ml-11">
                        <View className="flex flex-row items-center justify-between mb-1">
                          <Text className="block text-xs text-gray-500">{phaseText}</Text>
                          <Text className="block text-xs text-gray-400">{progressPercent}%</Text>
                        </View>
                        <View className="w-full h-2 bg-gray-100 rounded-full">
                          <View className="h-2 rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: statusCfg.color }} />
                        </View>
                      </View>
                    )}

                    {/* 金额行 */}
                    <View className="mt-3 ml-11 flex flex-row items-center justify-between">
                      <View className="flex flex-row items-center">
                        <Wallet size={12} color="#F59E0B" />
                        <Text className="block text-xs text-gray-400 ml-1">预算</Text>
                      </View>
                      <Text className="block text-base font-bold text-gray-900">¥{budget}</Text>
                    </View>
                  </View>

                  {/* 操作按钮区 */}
                  {(isPayable || isCancellable || isDeletable) && (
                    <View className="border-t border-gray-100 px-4 py-2 flex flex-row justify-end gap-2">
                      {isPayable && (
                        <Button size="sm" className="rounded-full" onClick={() => handleGoToPay(order.id)}>
                          <CreditCard size={12} color="#fff" />
                          <Text className="text-xs text-white ml-1">去支付</Text>
                        </Button>
                      )}
                      {isCancellable && !isPayable && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleCancel(order.id)}>
                          <Text className="text-xs">取消</Text>
                        </Button>
                      )}
                      {isDeletable && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleDelete(order.id)}>
                          <Trash2 size={12} color="#EF4444" />
                          <Text className="text-xs text-red-500 ml-1">删除</Text>
                        </Button>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </ScrollView>
      )}

      {/* 底部发单按钮 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px', paddingBottom: 24,
          backgroundColor: '#fff',
          borderTop: '1px solid #F3F4F6',
          zIndex: 100
        }}
      >
        <Button className="w-full rounded-xl py-3" onClick={handleCreate}>
          <Zap size={16} color="#fff" />
          <Text className="text-white font-medium ml-2">发布新订单</Text>
        </Button>
      </View>
    </View>
  )
}
