import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import {
  ArrowLeft, Wallet, Users, FileText,
  Zap, ChevronRight, CircleX, CircleCheck, Sparkles,
  Image as ImageIcon, Video, Target, Calendar
} from 'lucide-react-taro'
import { canonicalizePlatforms, getPlatformMeta, getPlatformLabel, PLATFORM_UI_ORDER } from '@/constants/publish-platform'
import './index.css'

// 待接订单数据接口（与后端 API 对齐）
interface PendingOrder {
  dispatchId: string
  orderId: string
  avatarId: string
  avatarName?: string
  avatarUrl?: string
  title: string
  description: string
  contentType: string
  platforms: string[]
  budget: number
  orderStatus: string
  dispatchStatus: string
  quantityPerAvatar: number
  expectedQuantity: number
  orderCreatedAt: string
  targetAudience?: string
  sellingPoints?: string
}

// 内容类型配置
const CONTENT_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  image_text: { label: '图文', icon: FileText, color: '#6366F1' },
  article: { label: '文章', icon: FileText, color: '#8B5CF6' },
  image: { label: '图片', icon: ImageIcon, color: '#10B981' },
  video: { label: '视频', icon: Video, color: '#F59E0B' },
  text: { label: '文案', icon: FileText, color: '#3B82F6' },
}

// 安全解析 JSON
function safeParseJSON(val: any): string[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { const r = JSON.parse(val); return Array.isArray(r) ? r : [val] } catch { return [val] }
  }
  return []
}

export default function PendingOrderListPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      console.log('[待接订单] 开始获取数据')
      const res = await Network.request({ url: '/api/order-dispatch/pending-requests' })
      console.log('[待接订单] API 响应:', res.data)
      const data = res.data?.data
      if (res.data?.code === 200 && Array.isArray(data)) {
        // 获取分身信息以映射 avatarName
        let avatarMap: Record<string, { name: string; avatarUrl?: string }> = {}
        try {
          const avatarRes = await Network.request({ url: '/api/avatar' })
          const avatarList = avatarRes.data?.data || []
          avatarList.forEach((a: any) => {
            avatarMap[a.id] = { name: a.name || '分身', avatarUrl: a.avatar_url || a.avatarUrl }
          })
        } catch (e) {
          console.error('[待接订单] 获取分身列表失败:', e)
        }

        const realOrders: PendingOrder[] = data.map((item: any) => {
          const avatar = avatarMap[item.avatarId] || {}
          return {
            dispatchId: item.dispatchId,
            orderId: item.orderId,
            avatarId: item.avatarId,
            avatarName: avatar.name || '分身',
            avatarUrl: avatar.avatarUrl || '',
            title: item.title || '订单内容',
            description: item.description || '',
            contentType: item.contentType || 'image_text',
            platforms: canonicalizePlatforms(safeParseJSON(item.platforms)),
            budget: parseFloat(item.budget) || 0,
            orderStatus: item.orderStatus || '',
            dispatchStatus: item.dispatchStatus || 'pending',
            quantityPerAvatar: item.quantityPerAvatar || 1,
            expectedQuantity: item.expectedQuantity || 1,
            orderCreatedAt: item.orderCreatedAt || '',
          }
        })
        console.log('[待接订单] 解析后数据:', realOrders.length, '条')
        setOrders(realOrders)
      } else {
        console.log('[待接订单] 无数据')
        setOrders([])
      }
    } catch (error) {
      console.error('[待接订单] 获取失败:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  // 接单
  const handleAccept = async (order: PendingOrder) => {
    if (accepting) return
    setAccepting(order.dispatchId)
    try {
      console.log('[待接订单] 接单:', order.avatarId, order.orderId)
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${order.avatarId}/accept/${order.orderId}`,
        method: 'POST',
      })
      console.log('[待接订单] 接单响应:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '接单成功', icon: 'success' })
        const result = res.data?.data || {}
        const nextRequestId = result.requestId || ''
        const nextAvatarId = result.avatarId || order.avatarId
        const nextOrderId = result.orderId || order.orderId
        const query = [
          `orderId=${encodeURIComponent(nextOrderId)}`,
          `avatarId=${encodeURIComponent(nextAvatarId)}`,
          nextRequestId ? `requestId=${encodeURIComponent(nextRequestId)}` : '',
        ].filter(Boolean).join('&')

        setTimeout(() => {
          Taro.navigateTo({
            url: `/package-order/pages/order-processing/index?${query}`
          })
        }, 500)
        // 从列表移除
        setOrders(prev => prev.filter(o => o.dispatchId !== order.dispatchId))
      } else {
        Taro.showToast({ title: res.data?.msg || '接单失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[待接订单] 接单失败:', error)
      Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
    } finally {
      setAccepting(null)
    }
  }

  // 婉拒
  const handleDecline = async (order: PendingOrder) => {
    try {
      await Network.request({
        url: `/api/order-dispatch/dispatch/${order.dispatchId}/decline`,
        method: 'POST',
      })
      Taro.showToast({ title: '已婉拒', icon: 'none' })
      setOrders(prev => prev.filter(o => o.dispatchId !== order.dispatchId))
    } catch (error) {
      console.error('[待接订单] 婉拒失败:', error)
    }
  }

  // 筛选订单
  const filteredOrders = orders.filter(order => {
    if (selectedPlatform && !order.platforms.includes(selectedPlatform)) return false
    return true
  })

  // 提取所有出现的平台，按发单页面的平台顺序排列
  const allPlatforms = PLATFORM_UI_ORDER.filter(p => new Set(orders.flatMap(o => o.platforms)).has(p))

  // 获取内容类型信息
  const getContentTypeInfo = (type: string) => {
    return CONTENT_TYPE_MAP[type] || CONTENT_TYPE_MAP.image_text
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const statusBarHeight = getStatusBarHeight()

  return (
    <View className="po-page">
      {/* 顶部渐变 */}
      <View className="po-header" style={{ paddingTop: statusBarHeight + 'px' }}>
        <View className="po-header-deco">
          <View className="po-circle po-c1" />
          <View className="po-circle po-c2" />
          <View className="po-circle po-c3" />
        </View>
        <View className="po-header-row">
          <View className="po-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="po-header-center">
            <Text className="po-header-title">待接订单</Text>
            <Text className="po-header-sub">匹配分身 · AI 智能创作 · 自动发布</Text>
          </View>
          <View className="po-header-right" />
        </View>
        {/* 统计 */}
        <View className="po-stat-bar">
          <View className="po-stat-chip">
            <Zap size={14} color="#FBBF24" />
            <Text className="po-stat-num">{orders.length}</Text>
            <Text className="po-stat-label">待接</Text>
          </View>
          <View className="po-stat-divider" />
          <View className="po-stat-chip">
            <Wallet size={14} color="#34D399" />
            <Text className="po-stat-num">¥{orders.reduce((s, o) => s + o.budget, 0).toFixed(0)}</Text>
            <Text className="po-stat-label">总预算</Text>
          </View>
          <View className="po-stat-divider" />
          <View className="po-stat-chip">
            <Users size={14} color="#A78BFA" />
            <Text className="po-stat-num">{new Set(orders.map(o => o.avatarId)).size}</Text>
            <Text className="po-stat-label">分身</Text>
          </View>
        </View>
      </View>

      {/* 平台筛选 */}
      {allPlatforms.length > 0 && (
        <View className="po-filter">
          <ScrollView className="po-filter-scroll" scrollX>
            <View
              className={`po-filter-tag ${!selectedPlatform ? 'active' : ''}`}
              onClick={() => setSelectedPlatform(null)}
            >
              <Text className="po-filter-text">全部</Text>
            </View>
            {allPlatforms.map(pKey => {
              const meta = getPlatformMeta(pKey)
              return (
                <View
                  key={pKey}
                  className={`po-filter-tag ${selectedPlatform === pKey ? 'active' : ''}`}
                  onClick={() => setSelectedPlatform(selectedPlatform === pKey ? null : pKey)}
                  style={selectedPlatform === pKey ? { background: `${meta?.color || '#6366F1'}18`, borderColor: meta?.color || '#6366F1' } : {}}
                >
                  <Text className="po-filter-text" style={selectedPlatform === pKey ? { color: meta?.color || '#6366F1' } : {}}>
                    {getPlatformLabel(pKey)}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* 订单列表 */}
      <ScrollView className="po-list" scrollY>
        {loading ? (
          <View className="po-loading">
            <View className="po-spinner" />
            <Text className="po-loading-text">加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="po-empty">
            <View className="po-empty-icon">
              <CircleCheck size={48} color="#CBD5E1" />
            </View>
            <Text className="po-empty-title">暂无待接订单</Text>
            <Text className="po-empty-desc">所有订单都已处理，稍后再来看看</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const ctInfo = getContentTypeInfo(order.contentType)
            const isAccepting = accepting === order.dispatchId
            return (
              <View key={order.dispatchId} className="po-card">
                {/* 卡片头部：分身 + 平台 + 类型 */}
                <View className="po-card-top">
                  <View className="po-avatar-chip">
                    {order.avatarUrl ? (
                      <Image src={order.avatarUrl} className="po-avatar-img" mode="aspectFill" />
                    ) : (
                      <View className="po-avatar-dot" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        <Text className="po-avatar-letter">{(order.avatarName || '分').charAt(0)}</Text>
                      </View>
                    )}
                    <Text className="po-avatar-label">{order.avatarName}</Text>
                  </View>
                  <View className="po-card-badges">
                    {order.platforms.map(pKey => {
                      const meta = getPlatformMeta(pKey)
                      return (
                        <View key={pKey} className="po-platform-pill" style={{ background: `${meta?.color || '#6366F1'}15` }}>
                          <Text className="po-platform-pill-text" style={{ color: meta?.color || '#6366F1' }}>
                            {getPlatformLabel(pKey)}
                          </Text>
                        </View>
                      )
                    })}
                    <View className="po-type-pill" style={{ background: `${ctInfo.color}15` }}>
                      <Text className="po-type-pill-text" style={{ color: ctInfo.color }}>{ctInfo.label}</Text>
                    </View>
                  </View>
                </View>

                {/* 标题 */}
                <Text className="po-card-title">{order.title}</Text>

                {/* 描述 */}
                {order.description && (
                  <Text className="po-card-desc" numberOfLines={3}>{order.description}</Text>
                )}

                {/* 信息栏 */}
                <View className="po-card-info">
                  <View className="po-info-item">
                    <Wallet size={14} color="#F59E0B" />
                    <Text className="po-info-text po-info-budget">¥{order.budget}</Text>
                  </View>
                  <View className="po-info-sep" />
                  <View className="po-info-item">
                    <Target size={14} color="#6366F1" />
                    <Text className="po-info-text">{order.quantityPerAvatar}条/分身</Text>
                  </View>
                  <View className="po-info-sep" />
                  <View className="po-info-item">
                    <Calendar size={14} color="#94A3B8" />
                    <Text className="po-info-text">{formatTime(order.orderCreatedAt)}</Text>
                  </View>
                </View>

                {/* 操作按钮 */}
                <View className="po-card-actions">
                  <Button
                    className="po-btn po-btn-decline"
                    onClick={() => handleDecline(order)}
                  >
                    <CircleX size={16} color="#64748B" />
                    <Text className="po-btn-label po-btn-label-default">婉拒</Text>
                  </Button>
                  <Button
                    className="po-btn po-btn-accept"
                    onClick={() => handleAccept(order)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <View className="po-btn-mini-spinner" />
                        <Text className="po-btn-label po-btn-label-primary">接单中...</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} color="#fff" />
                        <Text className="po-btn-label po-btn-label-primary">立即接单</Text>
                        <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                      </>
                    )}
                  </Button>
                </View>
              </View>
            )
          })
        )}
        <View className="po-bottom-space" />
      </ScrollView>
    </View>
  )
}
