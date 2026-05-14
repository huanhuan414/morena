import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import {
  ArrowLeft, Plus, Clock, LoaderCircle, Users,
  CircleCheck, CircleX, TriangleAlert, ChevronRight,
  Wallet, FileText, Video, Zap, Trash2, CreditCard
} from 'lucide-react-taro'

// ===== 状态映射（与 DB ENUM 对齐） =====
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; phase: number }> = {
  pending_payment: { label: '待支付', color: '#F59E0B', bgColor: '#FEF3C7', icon: Clock, phase: 0 },
  pending: { label: '匹配中', color: '#3B82F6', bgColor: '#DBEAFE', icon: LoaderCircle, phase: 1 },
  awaiting_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#E0E7FF', icon: Users, phase: 1 },
  pending_acceptance: { label: '等待接单', color: '#6366F1', bgColor: '#E0E7FF', icon: Users, phase: 1 },
  accepted: { label: '已接单', color: '#10B981', bgColor: '#D1FAE5', icon: CircleCheck, phase: 2 },
  in_progress: { label: '制作中', color: '#10B981', bgColor: '#D1FAE5', icon: LoaderCircle, phase: 2 },
  content_generated: { label: '已生成', color: '#8B5CF6', bgColor: '#EDE9FE', icon: FileText, phase: 2 },
  submitted: { label: '待发布', color: '#8B5CF6', bgColor: '#EDE9FE', icon: FileText, phase: 3 },
  published: { label: '已发布', color: '#059669', bgColor: '#D1FAE5', icon: CircleCheck, phase: 3 },
  completed: { label: '已完成', color: '#059669', bgColor: '#D1FAE5', icon: CircleCheck, phase: 4 },
  publish_failed: { label: '发布失败', color: '#EF4444', bgColor: '#FEE2E2', icon: TriangleAlert, phase: -1 },
  publish_timeout: { label: '发布超时', color: '#EF4444', bgColor: '#FEE2E2', icon: TriangleAlert, phase: -1 },
  cancelled: { label: '已取消', color: '#94A3B8', bgColor: '#F1F5F9', icon: CircleX, phase: -1 },
  auto_cancelled: { label: '自动取消', color: '#94A3B8', bgColor: '#F1F5F9', icon: CircleX, phase: -1 },
  timeout: { label: '已超时', color: '#94A3B8', bgColor: '#F1F5F9', icon: CircleX, phase: -1 },
  expired: { label: '已过期', color: '#94A3B8', bgColor: '#F1F5F9', icon: CircleX, phase: -1 },
}

// 内容类型图标
const CONTENT_TYPE_ICON: Record<string, any> = {
  text: FileText,
  image_text: Image,
  article: FileText,
  image: Image,
  video: Video,
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
  if (tabKey === 'completed') return ['completed'].includes(status)
  if (tabKey === 'closed') return ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'publish_failed', 'publish_timeout'].includes(status)
  return false
}

// 进度阶段文案
function getPhaseText(order: any): string {
  const phase = STATUS_CONFIG[order.status]?.phase ?? -1
  const summary = order.dispatchSummary
  if (!summary) {
    return ['', '正在匹配分身...', '等待分身接单', '分身制作中', '待发布', '已完成'][phase + 1] || ''
  }
  switch (phase) {
    case 0: return '等待支付'
    case 1: return '正在匹配分身...'
    case 2: {
      const accepted = summary.acceptedCount || 0
      const total = summary.totalCount || 0
      return `${accepted}/${total} 分身已接单`
    }
    case 3: {
      const published = summary.publishedCount || 0
      const total = summary.totalCount || 0
      return `${published}/${total} 已发布`
    }
    case 4: return '全部完成'
    default: return ''
  }
}

export default function OrderListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const statusBarHeight = getStatusBarHeight()

  const fetchOrders = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/order/list' })
      console.log('[OrderList] fetchOrders response:', res.data)
      const list = res.data?.data?.list || res.data?.list || []
      setOrders(list)
    } catch (err) {
      console.error('[OrderList] fetchOrders error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  // 筛选当前Tab的订单
  const filteredOrders = orders.filter(o => isStatusInTab(o.status, activeTab))
  // 待支付排在最前
  filteredOrders.sort((a, b) => {
    const pa = STATUS_CONFIG[a.status]?.phase ?? 99
    const pb = STATUS_CONFIG[b.status]?.phase ?? 99
    if (pa !== pb) return pa - pb
    return new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()
  })

  // 各Tab数量统计
  const tabCounts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.key] = orders.filter(o => isStatusInTab(o.status, tab.key)).length
    return acc
  }, {} as Record<string, number>)

  // ===== 操作 =====
  const handleGoToPay = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/package-order/pages/order-detail/index?id=${orderId}&action=pay` })
  }, [])

  const handleCancel = useCallback(async (orderId: string) => {
    const { confirm } = await Taro.showModal({ title: '取消订单', content: '确定要取消此订单吗？' })
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

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      {/* 顶部导航 */}
      <View className="bg-white" style={{ paddingTop: statusBarHeight }}>
        <View className="flex flex-row items-center justify-between px-4 py-3">
          <View className="flex flex-row items-center" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#333" />
            <Text className="block ml-2 text-lg font-semibold text-gray-900">我的订单</Text>
          </View>
          <View onClick={handleCreate}>
            <Button size="sm" className="rounded-full">
              <View className="flex flex-row items-center">
                <Plus size={14} color="#fff" className="mr-1" />
                <Text className="text-xs">发单</Text>
              </View>
            </Button>
          </View>
        </View>
      </View>

      {/* 状态Tab */}
      <View className="bg-white border-b border-gray-100">
        <ScrollView scrollX className="flex flex-row px-2 py-2">
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
                <View className={`ml-1 px-1 rounded-full ${activeTab === tab.key ? 'bg-blue-400' : 'bg-gray-200'}`}>
                  <Text className={`block text-[10px] ${activeTab === tab.key ? 'text-white' : 'text-gray-500'}`}>
                    {tabCounts[tab.key]}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 订单列表 */}
      <ScrollView
        scrollY
        className="flex-1 px-4 pt-3"
        refresherEnabled
        onRefresherRefresh={() => onRefresh()}
        refresherTriggered={loading}
      >
        {filteredOrders.length === 0 ? (
          <View className="flex items-center justify-center py-20">
            <FileText size={48} color="#D1D5DB" />
            <Text className="block mt-4 text-sm text-gray-400">
              {activeTab === 'all' ? '暂无订单，去发一单吧' : '该状态下暂无订单'}
            </Text>
            {activeTab === 'all' && (
              <View className="mt-4">
                <Button size="sm" onClick={handleCreate}>
                  <Text className="text-xs">立即发单</Text>
                </Button>
              </View>
            )}
          </View>
        ) : (
          filteredOrders.map(order => {
            const statusCfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#94A3B8', bgColor: '#F1F5F9', icon: FileText, phase: -1 }
            const StatusIcon = statusCfg.icon
            const ContentTypeIcon = CONTENT_TYPE_ICON[order.contentType] || FileText
            const phaseText = getPhaseText(order)
            const isPayable = order.status === 'pending_payment'
            const isCancellable = ['pending_payment', 'pending'].includes(order.status)
            const isDeletable = ['cancelled', 'auto_cancelled', 'timeout', 'expired', 'completed'].includes(order.status)

            return (
              <Card key={order.id} className="mb-3 overflow-hidden">
                <CardContent className="p-0">
                  {/* 状态条 */}
                  <View className="flex flex-row items-center justify-between px-4 py-2" style={{ backgroundColor: statusCfg.bgColor }}>
                    <View className="flex flex-row items-center">
                      <StatusIcon size={14} color={statusCfg.color} className="mr-1" />
                      <Text className="block text-xs font-medium" style={{ color: statusCfg.color }}>{statusCfg.label}</Text>
                    </View>
                    <Text className="block text-[10px] text-gray-400">
                      {formatTime(order.createdAt || order.created_at)}
                    </Text>
                  </View>

                  {/* 内容区 */}
                  <View className="px-4 py-3" onClick={() => handleGoDetail(order.id)}>
                    <View className="flex flex-row items-start">
                      <View className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 mt-1">
                        <ContentTypeIcon size={16} color="#3B82F6" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="block text-sm font-medium text-gray-900 truncate">
                          {order.title || '未命名订单'}
                        </Text>
                        <Text className="block text-xs text-gray-500 mt-1 truncate">
                          {order.contentType === 'text' ? '纯文案' : order.contentType === 'image_text' ? '图文笔记' : order.contentType === 'video' ? '短视频' : order.contentType === 'article' ? '长文' : '内容'} · {(order.platforms && Array.isArray(order.platforms)) ? order.platforms.join('、') : ''}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#D1D5DB" className="flex-shrink-0 ml-2 mt-1" />
                    </View>

                    {/* 进度摘要 */}
                    {phaseText && (
                      <View className="mt-2 flex flex-row items-center">
                        <View className="flex-1 h-1 bg-gray-100 rounded-full mr-2">
                          <View className="h-1 rounded-full" style={{ width: `${Math.max(10, (statusCfg.phase + 1) / 5 * 100)}%`, backgroundColor: statusCfg.color }} />
                        </View>
                        <Text className="block text-[10px] text-gray-400">{phaseText}</Text>
                      </View>
                    )}

                    {/* 金额 */}
                    <View className="mt-2 flex flex-row items-center justify-between">
                      <View className="flex flex-row items-center">
                        <Wallet size={12} color="#F59E0B" className="mr-1" />
                        <Text className="block text-xs text-gray-500">预算</Text>
                      </View>
                      <Text className="block text-sm font-semibold text-gray-900">
                        ¥{order.budget || order.totalPrice || 0}
                      </Text>
                    </View>
                  </View>

                  {/* 操作按钮区 */}
                  {(isPayable || isCancellable || isDeletable) && (
                    <View className="flex flex-row border-t border-gray-50 px-4 py-2 gap-2">
                      {isPayable && (
                        <View className="flex-1" onClick={() => handleGoToPay(order.id)}>
                          <Button size="sm" className="w-full bg-blue-500 text-white rounded-full">
                            <View className="flex flex-row items-center justify-center">
                              <CreditCard size={12} color="#fff" className="mr-1" />
                              <Text className="text-xs text-white">去支付</Text>
                            </View>
                          </Button>
                        </View>
                      )}
                      {isCancellable && (
                        <View className="flex-1" onClick={() => handleCancel(order.id)}>
                          <Button size="sm" variant="outline" className="w-full rounded-full">
                            <Text className="text-xs">取消</Text>
                          </Button>
                        </View>
                      )}
                      {isDeletable && (
                        <View className="flex-1" onClick={() => handleDelete(order.id)}>
                          <Button size="sm" variant="outline" className="w-full rounded-full border-red-200">
                            <View className="flex flex-row items-center justify-center">
                              <Trash2 size={12} color="#EF4444" className="mr-1" />
                              <Text className="text-xs text-red-500">删除</Text>
                            </View>
                          </Button>
                        </View>
                      )}
                    </View>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}

        {/* 底部安全区 */}
        <View className="h-20" />
      </ScrollView>

      {/* 底部发单按钮 */}
      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 24, backgroundColor: '#fff', borderTop: '1px solid #F3F4F6', zIndex: 100 }}>
        <Button className="w-full rounded-xl py-3" onClick={handleCreate}>
          <View className="flex flex-row items-center justify-center">
            <Zap size={16} color="#fff" className="mr-2" />
            <Text className="text-white font-medium">发布新订单</Text>
          </View>
        </Button>
      </View>
    </View>
  )
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
