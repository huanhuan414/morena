import { useLoad, useDidShow, useRouter, navigateTo, navigateBack, showToast } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import {
  Clock, ChevronRight, Sparkles, Plus,
  Check, RefreshCw, DollarSign,
  Package, Loader, Circle, SlidersHorizontal, ArrowLeft
} from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
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
  requirements?: {
    platforms?: string[]
    targetAudience?: string
    contentType?: string
  }
}

interface OrderStats {
  total: number
  open: number
  inProgress: number
  completed: number
  reviewing: number
}

interface ExecutionStep {
  id: string
  step_number: number
  step_name: string
  description: string
  status: string
  started_at?: string
  completed_at?: string
}

const STATUS_CONFIG = {
  open: { label: '待接单', color: '#f59e0b', icon: Clock },
  in_progress: { label: '进行中', color: '#3b82f6', icon: Loader },
  reviewing: { label: '待验收', color: '#8b5cf6', icon: Check },
  completed: { label: '已完成', color: '#22c55e', icon: Check },
  cancelled: { label: '已取消', color: '#6b7280', icon: Circle }
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

const getPlatformName = (platform: string): string => {
  return PLATFORM_NAMES[platform] || platform
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待接单' },
  { key: 'in_progress', label: '进行中' },
  { key: 'reviewing', label: '待验收' },
  { key: 'completed', label: '已完成' }
]

export default function OrderListPage() {
  const router = useRouter()
  const { mode } = router.params as { mode?: 'business' | 'avatar' }
  
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({ 
    total: 0, open: 0, inProgress: 0, completed: 0, reviewing: 0 
  })
  const [activeTab, setActiveTab] = useState(mode === 'avatar' ? 'open' : 'all')
  const [loading, setLoading] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [orderProgress, setOrderProgress] = useState<Record<string, ExecutionStep[]>>({})

  // 安全区域适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    // 初始化安全区域信息
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)
  })

  useDidShow(() => {
    fetchOrders()
    fetchStats()
  })

  // 监听 activeTab 变化，重新获取订单
  useEffect(() => {
    if (mode === 'avatar') return // 分身模式不需要筛选
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      let url = '/api/order'
      let queryParams: Record<string, any> = {}

      if (mode === 'avatar') {
        // 分身模式：只显示待接单的订单
        url = '/api/order/open'
      } else {
        // 商家模式：根据 activeTab 筛选
        if (activeTab !== 'all') {
          queryParams.status = activeTab
        }
      }

      const res = await Network.request({
        url,
        data: queryParams
      })

      if (res.data?.code === 200) {
        const ordersData = res.data.data?.orders || res.data.data || []
        setOrders(ordersData)

        // 获取每个订单的执行进度
        if (mode !== 'avatar') {
          fetchOrdersProgress(ordersData)
        }
      }
    } catch (error) {
      console.error('获取订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrdersProgress = async (ordersList: Order[]) => {
    const progressMap: Record<string, ExecutionStep[]> = {}
    
    for (const order of ordersList) {
      if (order.status === 'in_progress' || order.status === 'reviewing') {
        try {
          const res = await Network.request({ 
            url: `/api/order-dispatch/${order.id}/progress` 
          })
          if (res.data?.code === 200) {
            progressMap[order.id] = res.data.data
          }
        } catch (e) {
          console.error('获取进度失败:', e)
        }
      }
    }
    
    setOrderProgress(progressMap)
  }

  const fetchStats = async () => {
    if (mode === 'avatar') return
    
    try {
      const res = await Network.request({ url: '/api/order/stats' })
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

  const handleAcceptOrder = async (orderId: string) => {
    try {
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
        fetchStats()
      }
    } catch (error) {
      console.error('接单失败:', error)
      showToast({ title: '接单失败', icon: 'none' })
    }
  }

  const handleRetryDispatch = async (orderId: string) => {
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/dispatch`,
        method: 'POST'
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '重新分配成功', icon: 'success' })
        fetchOrders()
        fetchStats()
      }
    } catch (error) {
      console.error('重新分配失败:', error)
      showToast({ title: '重新分配失败', icon: 'none' })
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await Network.request({
        url: `/api/order/${orderId}/cancel`,
        method: 'PUT'
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '订单已取消', icon: 'success' })
        fetchOrders()
        fetchStats()
      }
    } catch (error) {
      console.error('取消订单失败:', error)
      showToast({ title: '取消失败', icon: 'none' })
    }
  }

  const getProgressPercent = (steps: ExecutionStep[]) => {
    if (!steps || steps.length === 0) return 0
    const completed = steps.filter(s => s.status === 'completed').length
    return Math.round((completed / steps.length) * 100)
  }

  const getCurrentStep = (steps: ExecutionStep[]) => {
    return steps?.find(s => s.status === 'in_progress') || 
           steps?.find(s => s.status === 'pending')
  }

  return (
    <View className="order-list-page">
      {/* 头部 */}
      <View className="page-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-top">
          <View className="back-button" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#1f2937" />
          </View>
          <View className="header-title-container">
            <Text className="page-title">
              {mode === 'avatar' ? '任务大厅' : '我的订单'}
            </Text>
          </View>
          {mode !== 'avatar' && (
            <View className="header-actions" style={{ width: `${capsulePlaceholderWidth}rpx` }}>
              <View
                className={`filter-btn ${showFilter ? 'active' : ''}`}
                onClick={() => setShowFilter(!showFilter)}
              >
                <SlidersHorizontal size={18} color={showFilter ? '#00f5ff' : '#fff'} />
              </View>
              <View
                className="add-btn"
                onClick={() => navigateTo({ url: '/pages/order-create/index' })}
              >
                <Plus size={18} color="#fff" />
                <Text className="add-btn-text">新建</Text>
              </View>
            </View>
          )}
        </View>
        
        {/* 统计卡片 */}
        {mode !== 'avatar' && (
          <View className="stats-row">
            <View className="stat-item" onClick={() => setActiveTab('open')}>
              <Text className="stat-num" style={{ color: '#f59e0b' }}>{stats.open}</Text>
              <Text className="stat-label">待接单</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item" onClick={() => setActiveTab('in_progress')}>
              <Text className="stat-num" style={{ color: '#3b82f6' }}>{stats.inProgress}</Text>
              <Text className="stat-label">进行中</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item" onClick={() => setActiveTab('reviewing')}>
              <Text className="stat-num" style={{ color: '#8b5cf6' }}>{stats.reviewing}</Text>
              <Text className="stat-label">待验收</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item" onClick={() => setActiveTab('completed')}>
              <Text className="stat-num" style={{ color: '#22c55e' }}>{stats.completed}</Text>
              <Text className="stat-label">已完成</Text>
            </View>
          </View>
        )}
        
        {/* Tab切换 */}
        <View className="tab-bar">
          {TABS.map(tab => (
            <View 
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className="tab-text">{tab.label}</Text>
              {tab.key === 'open' && stats.open > 0 && (
                <View className="tab-badge">
                  <Text className="tab-badge-text">{stats.open}</Text>
                </View>
              )}
              {tab.key === 'reviewing' && stats.reviewing > 0 && (
                <View className="tab-badge" style={{ background: '#8b5cf6' }}>
                  <Text className="tab-badge-text">{stats.reviewing}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* 订单列表 */}
      <ScrollView 
        className="order-scroll" 
        scrollY 
        refresherEnabled
        onRefresherRefresh={fetchOrders}
      >
        {loading && orders.length === 0 ? (
          <View className="loading-state">
            <Loader size={32} color="#00f5ff" className="animate-spin" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="empty-state">
            <Package size={64} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">暂无订单</Text>
            {mode !== 'avatar' && (
              <Button 
                className="mt-4"
                onClick={() => navigateTo({ url: '/pages/order-create/index' })}
              >
                <Plus size={16} color="#fff" />
                <Text>创建订单</Text>
              </Button>
            )}
          </View>
        ) : (
          <View className="order-list">
            {orders.map(order => {
              const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open
              const StatusIcon = config.icon
              const progress = orderProgress[order.id] || []
              const progressPercent = getProgressPercent(progress)
              const currentStep = getCurrentStep(progress)
              
              return (
                <View 
                  key={order.id}
                  className="order-card"
                  onClick={() => navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })}
                >
                  {/* 订单头部 */}
                  <View className="order-header">
                    <View className="order-status" style={{ background: `${config.color}20` }}>
                      <StatusIcon size={14} color={config.color} />
                      <Text className="order-status-text" style={{ color: config.color }}>
                        {config.label}
                      </Text>
                    </View>
                    <Text className="order-time">
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  {/* 订单标题 */}
                  <Text className="order-title">{order.title}</Text>
                  
                  {/* 订单描述 */}
                  {order.description && (
                    <Text className="order-desc" numberOfLines={2}>
                      {order.description}
                    </Text>
                  )}
                  
                  {/* 平台标签 */}
                  {order.requirements?.platforms && order.requirements.platforms.length > 0 && (
                    <View className="platform-tags">
                      {order.requirements.platforms.map((platform, idx) => (
                        <View key={idx} className="platform-tag">
                          <Text className="platform-tag-text">{getPlatformName(platform)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* 执行进度 */}
                  {progress.length > 0 && (
                    <View className="order-progress">
                      <View className="progress-header">
                        <Text className="progress-label">执行进度</Text>
                        <Text className="progress-percent">{progressPercent}%</Text>
                      </View>
                      <View className="progress-bar">
                        <View 
                          className="progress-fill" 
                          style={{ 
                            width: `${progressPercent}%`,
                            background: order.status === 'reviewing' ? '#8b5cf6' : '#00f5ff'
                          }} 
                        />
                      </View>
                      {currentStep && (
                        <Text className="current-step">
                          当前: {currentStep.step_name}
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {/* 分身信息 */}
                  {order.avatars && (
                    <View className="avatar-info">
                      <View className="avatar-avatar">
                        {order.avatars.avatar_url ? (
                          <Image 
                            src={order.avatars.avatar_url} 
                            className="avatar-img"
                            mode="aspectFill"
                          />
                        ) : (
                          <Sparkles size={20} color="#00f5ff" />
                        )}
                      </View>
                      <Text className="avatar-name">{order.avatars.name}</Text>
                    </View>
                  )}
                  
                  {/* 底部信息 */}
                  <View className="order-footer">
                    <View className="order-budget">
                      <DollarSign size={14} color="#f59e0b" />
                      <Text className="budget-text">¥{order.budget || 0}</Text>
                    </View>
                    
                    {mode === 'avatar' && order.status === 'open' && (
                      <View className="order-actions">
                        <Button 
                          size="sm" 
                          className="accept-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAcceptOrder(order.id)
                          }}
                        >
                          <Check size={14} color="#fff" />
                          <Text>接单</Text>
                        </Button>
                      </View>
                    )}
                    
                    {mode !== 'avatar' && order.status === 'open' && !order.avatars && (
                      <View className="order-actions">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRetryDispatch(order.id)
                          }}
                        >
                          <RefreshCw size={14} color="#fff" />
                          <Text>重新分配</Text>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelOrder(order.id)
                          }}
                        >
                          <Text style={{ color: '#ef4444' }}>取消</Text>
                        </Button>
                      </View>
                    )}
                    
                    {order.status === 'reviewing' && (
                      <View className="reviewing-tip">
                        <Circle size={14} color="#8b5cf6" />
                        <Text className="tip-text">内容已提交，请前往验收</Text>
                      </View>
                    )}
                    
                    <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
