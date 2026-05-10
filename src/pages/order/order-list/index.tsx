import Taro, { useLoad, useDidShow, navigateTo, navigateBack, showToast, showActionSheet, showLoading, hideLoading } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import {
  Plus, Loader, ArrowLeft, Settings, FileText, Users
} from 'lucide-react-taro'
import './index.css'

// 订单接口
interface Order {
  id: string
  title: string
  description?: string
  budget?: string | number
  status: string
  createdAt?: string | Date | { toDateString?: () => string }
  updatedAt?: string | Date
  platforms?: string | string[]
  requirements?: string | { platforms?: string[] }
  avatarCount?: number
  contentType?: string
  // 兼容字段
  created_at?: string | Date
  updated_at?: string | Date
  avatar_count?: number
}

// 订单统计
interface OrderStats {
  total: number
  open: number
  inProgress: number
  completed: number
  reviewing: number
}

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending_payment: { label: '待支付', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  open: { label: '待接单', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  in_progress: { label: '进行中', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' },
  reviewing: { label: '待验收', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.1)' },
  completed: { label: '已完成', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)' },
  cancelled: { label: '已取消', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' }
}

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  'wechat_mp': '微信公众号',
  'xiaohongshu': '小红书',
  'bilibili': 'B站',
  'weibo': '微博',
  'douyin': '抖音',
  'wechat_video': '视频号',
  'zhihu': '知乎',
  'toutiao': '今日头条',
  'baidu': '百度',
  'kuaishou': '快手'
}

// Tab配置
const TABS = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待接单' },
  { key: 'in_progress', label: '进行中' },
  { key: 'reviewing', label: '待验收' },
  { key: 'completed', label: '已完成' }
]

// 格式化日期
const formatDate = (dateStr: any): string => {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return ''
  try {
    // 如果是字符串
    if (typeof dateStr === 'string') {
      // 跳过无效字符串
      if (dateStr.length < 8) return ''
      const date = new Date(dateStr)
      if (Number.isNaN(date.getTime())) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}.${month}.${day}`
    }
    // 如果是 Date 对象
    if (dateStr instanceof Date) {
      const year = dateStr.getFullYear()
      const month = String(dateStr.getMonth() + 1).padStart(2, '0')
      const day = String(dateStr.getDate()).padStart(2, '0')
      return `${year}.${month}.${day}`
    }
    return ''
  } catch {
    return ''
  }
}

// 获取平台列表
const getPlatformList = (platforms: string | string[] | undefined): string[] => {
  if (!platforms) return []
  if (Array.isArray(platforms)) return platforms
  try {
    return JSON.parse(platforms)
  } catch {
    return []
  }
}

// 获取平台名称
const getPlatformName = (platform: string): string => {
  return PLATFORM_NAMES[platform] || platform
}

export default function OrderListPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({ 
    total: 0, open: 0, inProgress: 0, completed: 0, reviewing: 0 
  })
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // 检查用户登录状态
  const checkUserLogin = (): { userId: string | null; isLoggedIn: boolean } => {
    try {
      const userInfoStr = Taro.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = typeof userInfoStr === 'string' ? JSON.parse(userInfoStr) : userInfoStr
        console.log('[OrderList] Storage中的userInfo:', userInfo)
        if (userInfo?.id) {
          return { userId: userInfo.id, isLoggedIn: true }
        }
      }
      console.log('[OrderList] 未找到用户登录信息')
      return { userId: null, isLoggedIn: false }
    } catch (e) {
      console.error('[OrderList] 获取用户信息失败:', e)
      return { userId: null, isLoggedIn: false }
    }
  }

  useLoad(() => {
    // 页面加载
  })

  useDidShow(() => {
    // 每次显示页面时检查登录状态并获取数据
    const { isLoggedIn } = checkUserLogin()
    if (!isLoggedIn) {
      showToast({ title: '请先登录', icon: 'none' })
    }
    fetchOrders()
    fetchStats()
  })

  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  // 获取订单列表
  const fetchOrders = async () => {
    setLoading(true)
    try {
      // Network模块会自动从Storage获取userId并设置header
      const res = await Network.request({
        url: '/api/order/list',
        data: activeTab !== 'all' ? { status: activeTab } : {}
      })

      console.log('[OrderList] API响应:', res.data)
      if (res.data?.code === 200) {
        // 后端返回格式: { code: 200, data: [...orders] }
        const ordersData = res.data.data || []
        console.log('[OrderList] 订单数据条数:', ordersData.length)
        setOrders(ordersData)
      } else if (res.data?.code === 401) {
        showToast({ title: '请先登录', icon: 'none' })
      }
    } catch (error) {
      console.error('获取订单失败:', error)
      showToast({ title: '获取订单失败', icon: 'none' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 获取统计数据
  const fetchStats = async () => {
    try {
      // Network模块会自动从Storage获取userId并设置header
      const res = await Network.request({ 
        url: '/api/order/stats'
      })
      if (res.data?.code === 200) {
        setStats({
          ...res.data.data,
          reviewing: res.data.data.reviewing || 0
        })
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  // 下拉刷新
  const handleRefresh = () => {
    setRefreshing(true)
    fetchOrders()
    fetchStats()
  }

  // 处理订单点击
  const handleOrderClick = (order: Order) => {
    navigateTo({ url: `/pages/order/order-detail/index?id=${order.id}` })
  }

  // 更多操作
  const handleMoreAction = (order: Order, e: any) => {
    e.stopPropagation()
    showActionSheet({
      itemList: ['查看详情', '再次发布', '删除订单'],
      success: (res) => {
        const action = ['查看详情', '再次发布', '删除订单'][res.tapIndex]
        if (action === '查看详情') {
          handleOrderClick(order)
        } else if (action === '再次发布') {
          navigateTo({ url: `/pages/order/order-create/index?copy=${order.id}` })
        } else if (action === '删除订单') {
          handleDeleteOrder(order.id)
        }
      }
    })
  }

  // 删除订单
  const handleDeleteOrder = async (orderId: string) => {
    try {
      showLoading({ title: '删除中...' })
      const res = await Network.request({
        url: `/api/order/${orderId}`,
        method: 'DELETE'
      })
      hideLoading()
      
      if (res.data?.code === 200) {
        showToast({ title: '删除成功', icon: 'success' })
        fetchOrders()
      } else {
        showToast({ title: '删除失败', icon: 'none' })
      }
    } catch (error) {
      hideLoading()
      console.error('删除订单失败:', error)
      showToast({ title: '删除失败', icon: 'none' })
    }
  }

  return (
    <View className="order-list-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-top">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={22} color="#1e293b" />
          </View>
          <Text className="page-title">发单记录</Text>
          <View 
            className="create-btn"
            onClick={() => navigateTo({ url: '/pages/order/order-create/index' })}
          >
            <Plus size={18} color="#fff" />
            <Text className="create-btn-text">新建</Text>
          </View>
        </View>

        {/* 统计卡片 */}
        <View className="stats-cards">
          <View className="stat-card">
            <Text className="stat-num">{stats.total}</Text>
            <Text className="stat-label">全部订单</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-card">
            <Text className="stat-num" style={{ color: '#f59e0b' }}>{stats.open}</Text>
            <Text className="stat-label">待接单</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-card">
            <Text className="stat-num" style={{ color: '#22c55e' }}>{stats.completed}</Text>
            <Text className="stat-label">已完成</Text>
          </View>
        </View>

        {/* Tab切换 */}
        <ScrollView className="tab-scroll" scrollX enableFlex>
          <View className="tab-bar">
            {TABS.map(tab => (
              <View
                key={tab.key}
                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text className="tab-text">{tab.label}</Text>
                {tab.key !== 'all' && stats[tab.key as keyof OrderStats] > 0 && (
                  <View className="tab-count">
                    <Text className="tab-count-text">{stats[tab.key as keyof OrderStats]}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 订单列表 */}
      <ScrollView 
        className="order-scroll" 
        scrollY 
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        {loading && orders.length === 0 ? (
          <View className="loading-state">
            <Loader size={36} color="#6366f1" className="animate-spin" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="empty-state">
            <View className="empty-icon">
              <FileText size={48} color="#cbd5e1" />
            </View>
            <Text className="empty-title">暂无订单</Text>
            <Text className="empty-desc">点击右上角&quot;新建&quot;创建您的第一个订单</Text>
            <Button 
              className="empty-btn"
              onClick={() => navigateTo({ url: '/pages/order/order-create/index' })}
            >
              <Plus size={16} color="#fff" />
              <Text>创建订单</Text>
            </Button>
          </View>
        ) : (
          <View className="order-list">
            {orders.map((order, index) => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.open
              const platforms = getPlatformList(order.platforms || order.requirements as any)
              
              return (
                <View 
                  key={order.id}
                  className="order-card"
                  onClick={() => handleOrderClick(order)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* 卡片顶部 */}
                  <View className="card-top">
                    <View className="card-left">
                      <View className="status-badge" style={{ background: config.bgColor }}>
                        <Text className="status-text" style={{ color: config.color }}>{config.label}</Text>
                      </View>
                    </View>
                    <View className="card-right">
                      <Text className="card-date">{formatDate(order.createdAt || order.created_at)}</Text>
                      <View 
                        className="more-btn"
                        onClick={(e) => handleMoreAction(order, e)}
                      >
                        <Settings size={18} color="#94a3b8" />
                      </View>
                    </View>
                  </View>

                  {/* 订单标题 */}
                  <Text className="card-title">{order.title}</Text>

                  {/* 平台标签 */}
                  {platforms.length > 0 && (
                    <View className="platform-row">
                      {platforms.slice(0, 3).map((platform, idx) => (
                        <View key={idx} className="platform-tag">
                          <Text className="platform-text">{getPlatformName(platform)}</Text>
                        </View>
                      ))}
                      {platforms.length > 3 && (
                        <Text className="platform-more">+{platforms.length - 3}</Text>
                      )}
                    </View>
                  )}

                  {/* 卡片底部 */}
                  <View className="card-bottom">
                    <View className="card-info">
                      <Users size={14} color="#94a3b8" />
                      <Text className="info-text">
                        已分配 {order.dispatchedCount || 0}/{order.avatarCount || order.avatar_count || 1} 个分身
                      </Text>
                    </View>
                    <View className="card-price">
                      <Text className="price-symbol">¥</Text>
                      <Text className="price-value">{order.budget || 0}</Text>
                    </View>
                  </View>

                  {/* 底部装饰线 */}
                  <View className="card-accent" style={{ background: config.color }} />
                </View>
              )
            })}
          </View>
        )}
        
        {/* 底部安全区 */}
        <View className="safe-bottom" />
      </ScrollView>
    </View>
  )
}
