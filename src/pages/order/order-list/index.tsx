import Taro, { useDidShow, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import {
  ArrowLeft, Clock, Wallet, Users, FileText, Eye,
  Loader, CircleCheck
} from 'lucide-react-taro'
import { canonicalizePlatforms, getPlatformLabel } from '@/constants/publish-platform'
import './index.css'

// 订单状态映射（发单方视角）
const ORDER_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  pending_payment: { label: '待支付', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  pending: { label: '待处理', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  open: { label: '进行中', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  pending_dispatch: { label: '待分派', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
  pending_acceptance: { label: '等待接单', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
  in_progress: { label: '进行中', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  submitted: { label: '已提交', color: '#06b6d4', bgColor: 'rgba(6,182,212,0.1)' },
  awaiting_acceptance: { label: '待验收', color: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
  completed: { label: '已完成', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  cancelled: { label: '已取消', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  failed: { label: '失败', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
}

// Tab 筛选
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'in_progress', label: '进行中', includes: ['pending', 'open', 'pending_dispatch', 'pending_acceptance', 'in_progress'] },
  { key: 'submitted', label: '已提交', includes: ['submitted'] },
  { key: 'awaiting_acceptance', label: '待验收', includes: ['awaiting_acceptance'] },
  { key: 'completed', label: '已完成', includes: ['completed'] },
]

function getPlatformNames(platforms: any): string[] {
  if (!platforms) return []
  let arr: string[] = []
  if (typeof platforms === 'string') {
    try { arr = JSON.parse(platforms) } catch { arr = platforms.split(',').map((s: string) => s.trim()).filter(Boolean) }
  } else if (Array.isArray(platforms)) { arr = platforms }
  return canonicalizePlatforms(arr).map((p) => getPlatformLabel(p))
}

function getStatusInfo(status: string) {
  return ORDER_STATUS_MAP[status] || { label: status, color: '#999', bgColor: 'rgba(153,153,153,0.1)' }
}

export default function OrderListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useDidShow(() => { loadOrders() })
  useEffect(() => { loadOrders() }, [])

  const loadOrders = async () => {
    try {
      const res = await Network.request({ url: '/api/order/list' })
      console.log('[订单列表] res.data:', res.data)
      const list = res.data?.data || []
      setOrders(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('[订单列表] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter(o => {
        const tab = STATUS_TABS.find(t => t.key === activeTab)
        return tab?.includes?.includes(o.status) || o.status === activeTab
      })

  // 统计
  const stats = {
    total: orders.length,
    inProgress: orders.filter(o => ['pending', 'open', 'pending_dispatch', 'pending_acceptance', 'in_progress'].includes(o.status)).length,
    submitted: orders.filter(o => o.status === 'submitted').length,
    awaiting: orders.filter(o => o.status === 'awaiting_acceptance').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }

  const handleOrderClick = (order: any) => {
    const status = order.status
    if (['completed'].includes(status)) {
      navigateTo({ url: `/pages/order/order-detail/index?id=${order.id}` })
    } else if (['submitted', 'awaiting_acceptance'].includes(status)) {
      navigateTo({ url: `/pages/order/order-detail/index?id=${order.id}` })
    } else {
      navigateTo({ url: `/pages/order/order-detail/index?id=${order.id}` })
    }
  }

  const handleVerify = (order: any) => {
    navigateTo({ url: `/pages/order/order-detail/index?id=${order.id}&action=verify` })
  }

  return (
    <View className="ol-page">
      {/* 头部渐变 */}
      <View className="ol-header">
        <View className="ol-header-decor ol-header-decor-1" />
        <View className="ol-header-decor ol-header-decor-2" />
        <View className="ol-header-nav">
          <View className="ol-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#fff" />
          </View>
          <View className="ol-header-center">
            <Text className="ol-header-title block">我的订单</Text>
            <Text className="ol-header-subtitle block">管理发布订单，跟踪交付进度</Text>
          </View>
          <View className="ol-header-right" />
        </View>
      </View>

      {/* 统计栏 */}
      <View className="ol-stats">
        <View className="ol-stat-item">
          <Text className="ol-stat-num block">{stats.inProgress}</Text>
          <Text className="ol-stat-label block">进行中</Text>
        </View>
        <View className="ol-stat-divider" />
        <View className="ol-stat-item">
          <Text className="ol-stat-num block">{stats.submitted}</Text>
          <Text className="ol-stat-label block">已提交</Text>
        </View>
        <View className="ol-stat-divider" />
        <View className="ol-stat-item">
          <Text className="ol-stat-num block">{stats.awaiting}</Text>
          <Text className="ol-stat-label block">待验收</Text>
        </View>
        <View className="ol-stat-divider" />
        <View className="ol-stat-item">
          <Text className="ol-stat-num block">{stats.completed}</Text>
          <Text className="ol-stat-label block">已完成</Text>
        </View>
      </View>

      {/* Tab 筛选 */}
      <View className="ol-tabs">
        {STATUS_TABS.map(tab => (
          <View
            key={tab.key}
            className={`ol-tab ${activeTab === tab.key ? 'ol-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className="ol-tab-text block">{tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      <ScrollView scrollY className="ol-list">
        {loading ? (
          <View className="ol-loading">
            <Loader size={24} color="#8b5cf6" className="ol-spin" />
            <Text className="ol-loading-text block">加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="ol-empty">
            <FileText size={48} color="#d1d5db" />
            <Text className="ol-empty-text block">暂无相关订单</Text>
          </View>
        ) : (
          filteredOrders.map(order => {
            const si = getStatusInfo(order.status)
            const platforms = getPlatformNames(order.platforms)
            return (
              <View key={order.id} className="ol-card" onClick={() => handleOrderClick(order)}>
                {/* 卡片头部 */}
                <View className="ol-card-header">
                  <View className="ol-card-header-left">
                    <View className="ol-status-dot" style={{ backgroundColor: si.color }} />
                    <Text className="ol-card-title block">{order.title || '未命名订单'}</Text>
                  </View>
                  <View className="ol-status-pill" style={{ backgroundColor: si.bgColor }}>
                    <Text className="ol-status-pill-text block" style={{ color: si.color }}>{si.label}</Text>
                  </View>
                </View>

                {/* 平台和类型 */}
                <View className="ol-card-pills">
                  {platforms.slice(0, 3).map((p, i) => (
                    <View key={i} className="ol-platform-pill">
                      <Text className="ol-pill-text block">{p}</Text>
                    </View>
                  ))}
                  {platforms.length > 3 && (
                    <View className="ol-platform-pill">
                      <Text className="ol-pill-text block">+{platforms.length - 3}</Text>
                    </View>
                  )}
                </View>

                {/* 信息栏 */}
                <View className="ol-card-info">
                  <View className="ol-info-item">
                    <Wallet size={12} color="#9ca3af" />
                    <Text className="ol-info-text block">¥{order.budget || 0}</Text>
                  </View>
                  <View className="ol-info-item">
                    <FileText size={12} color="#9ca3af" />
                    <Text className="ol-info-text block">{order.expectedQuantity || 1}篇</Text>
                  </View>
                  <View className="ol-info-item">
                    <Users size={12} color="#9ca3af" />
                    <Text className="ol-info-text block">{order.quantityPerAvatar || 1}篇/人</Text>
                  </View>
                  <View className="ol-info-item">
                    <Clock size={12} color="#9ca3af" />
                    <Text className="ol-info-text block">{formatTime(order.createdAt || order.created_at)}</Text>
                  </View>
                </View>

                {/* 操作按钮 */}
                <View className="ol-card-actions">
                  {order.status === 'awaiting_acceptance' && (
                    <View className="ol-action-btn ol-action-primary" onClick={(e) => { e.stopPropagation(); handleVerify(order) }}>
                      <CircleCheck size={14} color="#fff" />
                      <Text className="ol-action-btn-text block" style={{ color: '#fff' }}>验收</Text>
                    </View>
                  )}
                  <View className="ol-action-btn ol-action-default" onClick={(e) => { e.stopPropagation(); handleOrderClick(order) }}>
                    <Eye size={14} color="#8b5cf6" />
                    <Text className="ol-action-btn-text block" style={{ color: '#8b5cf6' }}>详情</Text>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
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
