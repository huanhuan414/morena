import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, useRouter, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Briefcase, Clock, DollarSign, ChevronRight, Sparkles, Plus, TrendingUp, Check, BadgeAlert, Zap } from 'lucide-react-taro'
import './index.css'

interface Order {
  id: string
  title: string
  description: string
  budget: number
  status: string
  created_at: string
  updated_at: string
  avatars?: {
    id: string
    name: string
    avatar_url: string
  }
  users?: {
    nickname: string
    avatar: string
  }
}

interface OrderStats {
  total: number
  open: number
  inProgress: number
  completed: number
}

export default function OrderListPage() {
  const router = useRouter()
  const { mode } = router.params // 'business' | 'avatar'
  
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({ total: 0, open: 0, inProgress: 0, completed: 0 })
  const [activeTab, setActiveTab] = useState(mode === 'avatar' ? 'open' : 'all')
  const [loading, setLoading] = useState(false)

  useLoad(() => {})

  useDidShow(() => {
    fetchOrders()
    fetchStats()
  })

  const fetchOrders = async () => {
    setLoading(true)
    try {
      let url = '/api/order'
      if (mode === 'avatar') {
        // 任务大厅：获取所有待接单的订单
        url = '/api/order/open'
      }
      const res = await Network.request({
        url,
        data: mode === 'avatar' ? {} : (activeTab === 'all' ? {} : { status: activeTab })
      })
      if (res.data?.code === 200) {
        setOrders(res.data.data?.orders || res.data.data || [])
      }
    } catch (error) {
      console.error('获取订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (mode === 'avatar') return // 任务大厅不显示统计
    try {
      const res = await Network.request({ url: '/api/order/stats' })
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  const handleAcceptOrder = async (orderId: string) => {
    try {
      // 获取用户的第一个分身
      const avatarRes = await Network.request({ url: '/api/avatar' })
      const avatars = avatarRes.data?.data || []
      
      if (avatars.length === 0) {
        showToast({ title: '请先创建AI分身', icon: 'none' })
        return
      }
      
      const avatarId = avatars[0].id
      
      const res = await Network.request({
        url: `/api/order/${orderId}/accept`,
        method: 'PUT',
        data: { avatar_id: avatarId }
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '接单成功', icon: 'success' })
        fetchOrders()
      } else {
        showToast({ title: res.data?.message || '接单失败', icon: 'none' })
      }
    } catch (error) {
      console.error('接单失败:', error)
      showToast({ title: '接单失败', icon: 'none' })
    }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      open: { label: '待接单', color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.15)' },
      in_progress: { label: '进行中', color: '#00f5ff', bg: 'rgba(0, 245, 255, 0.15)' },
      reviewing: { label: '待审核', color: '#bf00ff', bg: 'rgba(191, 0, 255, 0.15)' },
      completed: { label: '已完成', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.15)' },
      cancelled: { label: '已取消', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
    }
    return statusMap[status] || { label: status, color: '#fff', bg: 'rgba(255,255,255,0.1)' }
  }

  const tabs = mode === 'avatar' 
    ? [{ key: 'open', label: '待接单', count: orders.length }]
    : [
        { key: 'all', label: '全部', count: stats.total },
        { key: 'open', label: '待接单', count: stats.open },
        { key: 'in_progress', label: '进行中', count: stats.inProgress },
        { key: 'completed', label: '已完成', count: stats.completed }
      ]

  return (
    <View className="order-list-page">
      {/* 顶部导航 */}
      <View className="list-header">
        <View className="header-title-wrap">
          <Briefcase size={24} color="#00f5ff" />
          <Text className="header-title">{mode === 'avatar' ? '任务大厅' : '我的订单'}</Text>
        </View>
        {mode !== 'avatar' && (
          <Button 
            className="create-btn"
            onClick={() => navigateTo({ url: '/pages/order-create/index' })}
          >
            <Plus size={18} color="#00f5ff" />
            <Text className="create-btn-text">发单</Text>
          </Button>
        )}
      </View>

      {/* 统计卡片 */}
      {mode !== 'avatar' && (
        <View className="stats-section">
          <View className="stats-card">
            <View className="stat-item">
              <TrendingUp size={20} color="#00f5ff" />
              <Text className="stat-value">{stats.total}</Text>
              <Text className="stat-label">总订单</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Clock size={20} color="#ffaa00" />
              <Text className="stat-value">{stats.open}</Text>
              <Text className="stat-label">待接单</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Sparkles size={20} color="#bf00ff" />
              <Text className="stat-value">{stats.inProgress}</Text>
              <Text className="stat-label">进行中</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Check size={20} color="#00ff88" />
              <Text className="stat-value">{stats.completed}</Text>
              <Text className="stat-label">已完成</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tab 切换 */}
      <View className="tabs-section">
        {tabs.map(tab => (
          <View 
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); fetchOrders(); }}
          >
            <Text className="tab-label">{tab.label}</Text>
            {tab.count > 0 && (
              <View className="tab-badge">
                <Text className="tab-badge-text">{tab.count}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      <ScrollView className="order-scroll" scrollY>
        {loading ? (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="empty-state">
            <BadgeAlert size={48} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">暂无订单</Text>
            {mode !== 'avatar' && (
              <Button 
                className="empty-btn"
                onClick={() => navigateTo({ url: '/pages/order-create/index' })}
              >
                <Text className="empty-btn-text">发布第一个订单</Text>
              </Button>
            )}
          </View>
        ) : (
          <View className="orders-container">
            {orders.map(order => {
              const statusInfo = getStatusInfo(order.status)
              return (
                <View 
                  key={order.id}
                  className="order-card"
                  onClick={() => mode !== 'avatar' && navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })}
                >
                  <View className="order-header">
                    <Text className="order-title">{order.title}</Text>
                    <View className="order-status" style={{ background: statusInfo.bg }}>
                      <Text className="status-text" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  
                  <Text className="order-desc">{order.description}</Text>
                  
                  {/* 发布者信息（任务大厅模式） */}
                  {mode === 'avatar' && order.users && (
                    <View className="order-user">
                      <Image 
                        src={order.users.avatar || 'https://placehold.co/40x40/1a1a2e/ffffff?text=U'}
                        className="user-avatar-sm"
                        mode="aspectFill"
                      />
                      <Text className="user-name-sm">{order.users.nickname}</Text>
                    </View>
                  )}
                  
                  <View className="order-footer">
                    <View className="order-budget">
                      <DollarSign size={16} color="#00ff88" />
                      <Text className="budget-text">¥{order.budget}</Text>
                    </View>
                    
                    {/* 任务大厅模式：显示接单按钮 */}
                    {mode === 'avatar' && order.status === 'open' && (
                      <Button 
                        className="accept-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAcceptOrder(order.id)
                        }}
                      >
                        <Zap size={16} color="#fff" />
                        <Text className="accept-text">立即接单</Text>
                      </Button>
                    )}
                    
                    {/* 普通模式：显示执行分身 */}
                    {mode !== 'avatar' && order.avatars && (
                      <View className="order-avatar">
                        {order.avatars.avatar_url ? (
                          <Image src={order.avatars.avatar_url} className="avatar-img" mode="aspectFill" />
                        ) : (
                          <Sparkles size={16} color="#00f5ff" />
                        )}
                        <Text className="avatar-name">{order.avatars.name}</Text>
                      </View>
                    )}
                    
                    {mode !== 'avatar' && <ChevronRight size={18} color="rgba(255,255,255,0.2)" />}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
