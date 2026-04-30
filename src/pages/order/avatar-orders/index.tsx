import { useLoad, useDidShow, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import * as Network from '@/network'
import { ArrowLeft, Package } from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
import './index.css'

interface AvatarOrder {
  id: string
  title: string
  status: string
  budget: number
  created_at: string
  platform?: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: '待接单', color: '#1890ff' },
  accepted: { label: '进行中', color: '#faad14' },
  submitted: { label: '待验收', color: '#722ed1' },
  completed: { label: '已完成', color: '#52c41a' },
  cancelled: { label: '已取消', color: '#ff4d4f' },
}

export default function AvatarOrdersPage() {
  const router = useRouter()
  const avatarId = router.params.avatarId || ''
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [orders, setOrders] = useState<AvatarOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useLoad(() => {
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
  })

  useDidShow(() => {
    fetchOrders()
  })

  const fetchOrders = async () => {
    if (!avatarId) {
      showToast({ title: '缺少分身ID', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/order/list',
        data: { avatar_id: avatarId }
      })
      if (res.data?.code === 200) {
        setOrders(res.data.data || [])
      }
    } catch (error) {
      console.error('获取订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(o => o.status === filterStatus)

  const getStatusInfo = (status: string) => STATUS_MAP[status] || { label: status, color: '#999' }

  return (
    <View className="avatar-orders-page">
      {/* 顶部导航 */}
      <View className="orders-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="#333" />
        </View>
        <Text className="header-title">分身商单</Text>
        <View className="header-right" />
      </View>

      {/* 筛选标签 */}
      <View className="filter-tabs">
        <View 
          className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          全部
        </View>
        {Object.entries(STATUS_MAP).map(([key, info]) => (
          <View 
            key={key}
            className={`filter-tab ${filterStatus === key ? 'active' : ''}`}
            onClick={() => setFilterStatus(key)}
          >
            {info.label}
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      <ScrollView 
        className="orders-scroll"
        scrollY
        onScrollToLower={fetchOrders}
      >
        {loading ? (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="empty-state">
            <Package size={48} color="#ccc" />
            <Text className="empty-text">暂无订单</Text>
          </View>
        ) : (
          filteredOrders.map(order => {
            const statusInfo = getStatusInfo(order.status)
            return (
              <View key={order.id} className="order-card">
                <View className="order-header">
                  <Text className="order-title">{order.title}</Text>
                  <View className="order-status" style={{ color: statusInfo.color }}>
                    {statusInfo.label}
                  </View>
                </View>
                <View className="order-info">
                  <Text className="order-budget">预算: ¥{order.budget}</Text>
                  {order.platform && (
                    <Text className="order-platform">{order.platform}</Text>
                  )}
                </View>
                <View className="order-footer">
                  <Text className="order-time">
                    {new Date(order.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
