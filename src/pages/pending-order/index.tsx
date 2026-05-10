import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image as TaroImage } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { Clock, TrendingUp, Wallet, Users, Image, Video, FileText, ChevronRight, Info, Zap, ArrowLeft } from 'lucide-react-taro'
import './index.css'

// 待接订单数据接口
interface PendingOrder {
  id: string
  title: string
  description: string
  budget: number
  platforms: string[]
  deadline: string
  status: string
  avatar_name?: string
  avatar_url?: string
  avatar_level?: number
  target_audience?: string
  hints?: string[]
  countdown_seconds?: number
}

// 平台配置
const PLATFORMS = [
  { key: 'xiaohongshu', name: '小红书', color: '#FF2442', icon: Image },
  { key: 'douyin', name: '抖音', color: '#00F2EA', icon: Video },
  { key: 'wechat_mp', name: '公众号', color: '#07C160', icon: FileText },
  { key: 'weibo', name: '微博', color: '#FF8200', icon: Users },
  { key: 'bilibili', name: 'B站', color: '#FB7299', icon: Video },
  { key: 'kuaishou', name: '快手', color: '#FF4906', icon: Video },
]

// 平台提示配置
const PLATFORM_HINTS: Record<string, string[]> = {
  douyin: ['需开通团购功能'],
  xiaohongshu: ['需认证专业号'],
  wechat_mp: ['需开通流量主'],
  weibo: ['需满1000粉丝'],
  bilibili: ['需UP主身份'],
  kuaishou: ['需开通小店'],
}

// 模拟数据
const MOCK_ORDERS: PendingOrder[] = [
  {
    id: '1',
    title: '春季美妆护肤种草笔记',
    description: '需要撰写关于春季护肤的产品种草笔记，要求突出产品功效和使用感受',
    budget: 500,
    platforms: ['xiaohongshu'],
    deadline: '2024-03-15',
    status: 'pending',
    avatar_name: '小美',
    avatar_level: 3,
    target_audience: '18-25岁女性',
    hints: ['需认证专业号'],
    countdown_seconds: 3600 * 5 + 1234,
  },
  {
    id: '2',
    title: '科技产品测评视频脚本',
    description: '为新款蓝牙耳机创作测评视频脚本，包含开箱、功能介绍、使用体验',
    budget: 800,
    platforms: ['douyin', 'bilibili'],
    deadline: '2024-03-20',
    status: 'pending',
    avatar_name: '科技达人',
    avatar_level: 5,
    target_audience: '数码爱好者',
    hints: ['需开通团购功能', '热门订单'],
    countdown_seconds: 3600 * 2 + 4521,
  },
  {
    id: '3',
    title: '美食探店图文推荐',
    description: '周末探店美食推荐，需要精美的图片和生动的文字描述',
    budget: 350,
    platforms: ['xiaohongshu', 'weibo'],
    deadline: '2024-03-18',
    status: 'pending',
    avatar_name: '吃货小分队',
    avatar_level: 2,
    target_audience: '美食爱好者',
    hints: ['需满1000粉丝'],
    countdown_seconds: 3600 * 12 + 2345,
  },
  {
    id: '4',
    title: '职场成长干货文章',
    description: '撰写职场晋升、沟通技巧相关的干货文章，适合职场人群阅读',
    budget: 600,
    platforms: ['wechat_mp'],
    deadline: '2024-03-25',
    status: 'pending',
    avatar_name: '职场导师',
    avatar_level: 4,
    target_audience: '职场人士',
    hints: ['需开通流量主'],
    countdown_seconds: 3600 * 24 + 5678,
  },
  {
    id: '5',
    title: '健身打卡短视频',
    description: '创作健身打卡类短视频，展示训练动作和计划，适合健身爱好者',
    budget: 450,
    platforms: ['douyin'],
    deadline: '2024-03-16',
    status: 'pending',
    avatar_name: '健身教练',
    avatar_level: 4,
    target_audience: '健身人群',
    hints: ['需开通团购功能', '紧急订单'],
    countdown_seconds: 3600 + 890,
  },
  {
    id: '6',
    title: '旅行打卡攻略图文',
    description: '分享热门旅游景点打卡攻略，包含拍照技巧和路线推荐',
    budget: 700,
    platforms: ['xiaohongshu', 'kuaishou'],
    deadline: '2024-03-22',
    status: 'pending',
    avatar_name: '旅行家',
    avatar_level: 5,
    target_audience: '旅行爱好者',
    hints: ['需开通小店'],
    countdown_seconds: 3600 * 8 + 3456,
  },
]

// 格式化倒计时
const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return '已截止'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}小时${minutes}分`
  }
  return `${minutes}分${secs}秒`
}

export default function PendingOrderListPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [avatars, setAvatars] = useState<any[]>([])
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchOrders()
    fetchAvatars()
  }, [])

  // 倒计时更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns(prev => {
        const newCountdowns = { ...prev }
        Object.keys(newCountdowns).forEach(id => {
          if (newCountdowns[id] > 0) {
            newCountdowns[id] -= 1
          }
        })
        return newCountdowns
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // 初始化订单倒计时
  useEffect(() => {
    if (orders.length > 0) {
      const initial: Record<string, number> = {}
      orders.forEach(order => {
        initial[order.id] = order.countdown_seconds || 3600
      })
      setCountdowns(initial)
    }
  }, [orders])

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200) {
        setAvatars(res.data.data || [])
      }
    } catch (error) {
      console.error('获取分身列表失败:', error)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    try {
      // 优先获取用户订单（带分身信息）
      const res = await Network.request({ url: '/api/user-stats/orders' })
      if (res.data?.code === 200 && res.data.data?.orders?.length > 0) {
        // 使用真实数据，转换为组件格式
        const realOrders = res.data.data.orders.map((order: any) => ({
          id: order.id,
          title: order.title || '订单内容',
          description: order.description || '',
          budget: order.budget || 0,
          platforms: JSON.parse(order.platforms || '[]'),
          deadline: order.deadline || '',
          status: order.status,
          avatar_name: order.avatar_name || '我的分身',
          avatar_url: order.avatar_url || '',
          countdown_seconds: 3600
        }))
        setOrders(realOrders)
      } else {
        setOrders(MOCK_ORDERS)
      }
    } catch (error) {
      console.error('获取待接订单失败:', error)
      setOrders(MOCK_ORDERS)
    } finally {
      setLoading(false)
    }
  }

  // 筛选订单
  const filteredOrders = orders.filter(order => {
    const platformMatch = !selectedPlatform || order.platforms.includes(selectedPlatform)
    const avatarMatch = !selectedAvatar || order.avatar_name === avatars.find(a => a.id === selectedAvatar)?.name
    return platformMatch && avatarMatch
  })

  // 获取平台信息
  const getPlatformInfo = (key: string) => {
    return PLATFORMS.find(p => p.key === key) || { name: key, color: '#6366F1', icon: FileText }
  }

  // 获取订单提示
  const getOrderHints = (order: PendingOrder): string[] => {
    const hints: string[] = [...(order.hints || [])]
    // 自动添加平台相关提示
    order.platforms.forEach(p => {
      const platformHints = PLATFORM_HINTS[p]
      if (platformHints) {
        platformHints.forEach(h => {
          if (!hints.includes(h)) {
            hints.push(h)
          }
        })
      }
    })
    return hints
  }

  return (
    <View className="pending-order-page">
      {/* 顶部背景 */}
      <View className="page-header">
        {/* 装饰圆形 */}
        <View className="header-decoration">
          <View className="decoration-circle circle-1" />
          <View className="decoration-circle circle-2" />
        </View>
        
        {/* 页面标题 */}
        <View className="header-title-row">
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="header-title-area">
            <Text className="header-title">待接订单</Text>
            <Text className="header-subtitle">智能匹配 · AI辅助 · 自动生成</Text>
          </View>
        </View>

      </View>
      {/* 平台筛选 */}
      <View className="platform-filter">
        <ScrollView className="platform-scroll" scrollX>
          <View
            className={`platform-tag ${selectedPlatform === null ? 'active' : ''}`}
            onClick={() => setSelectedPlatform(null)}
          >
            <Text className="platform-tag-text">全部</Text>
          </View>
          {PLATFORMS.map((platform) => {
            const IconComponent = platform.icon
            return (
              <View
                key={platform.key}
                className={`platform-tag ${selectedPlatform === platform.key ? 'active' : ''}`}
                onClick={() => setSelectedPlatform(
                  selectedPlatform === platform.key ? null : platform.key
                )}
                style={selectedPlatform === platform.key ? {
                  background: `linear-gradient(135deg, ${platform.color}20, ${platform.color}10)`,
                  borderColor: platform.color
                } : {}}
              >
                <IconComponent size={14} color={selectedPlatform === platform.key ? platform.color : '#64748B'} />
                <Text 
                  className="platform-tag-text" 
                  style={selectedPlatform === platform.key ? { color: platform.color } : {}}
                >
                {platform.name}
              </Text>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {/* 分身筛选 */}
      {avatars.length > 0 && (
        <View className="platform-filter">
          <ScrollView className="platform-scroll" scrollX>
            <View
              className={`platform-tag ${selectedAvatar === null ? 'active' : ''}`}
              onClick={() => setSelectedAvatar(null)}
            >
              <Users size={14} color={selectedAvatar === null ? '#6366F1' : '#64748B'} />
              <Text className="platform-tag-text" style={selectedAvatar === null ? { color: '#6366F1' } : {}}>全部分身</Text>
            </View>
            {avatars.map((avatar) => (
              <View
                key={avatar.id}
                className={`platform-tag ${selectedAvatar === avatar.id ? 'active' : ''}`}
                onClick={() => setSelectedAvatar(selectedAvatar === avatar.id ? null : avatar.id)}
                style={selectedAvatar === avatar.id ? { background: 'rgba(99, 102, 241, 0.1)', borderColor: '#6366F1' } : {}}
              >
                {avatar.avatar_url ? (
                  <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    <TaroImage src={avatar.avatar_url} className="w-full h-full" />
                  </View>
                ) : (
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#fff' }}>{avatar.name?.charAt(0) || '?'}</Text>
                  </View>
                )}
                <Text className="platform-tag-text" style={selectedAvatar === avatar.id ? { color: '#6366F1' } : {}}>
                  {avatar.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 订单列表 */}
      <ScrollView className="order-list" scrollY>
        {loading ? (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="empty-state">
            <Clock size={64} color="#CBD5E1" />
            <Text className="empty-title">暂无待接订单</Text>
            <Text className="empty-desc">稍后再来看看吧</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const hints = getOrderHints(order)
            const countdown = countdowns[order.id] || 0
            const isUrgent = countdown < 3600 // 少于1小时

            return (
              <View key={order.id} className="order-card">
                {/* 卡片头部 - 分身标签 + 平台标签 + 倒计时 */}
                <View className="card-header">
                  {/* 分身标签 */}
                  {order.avatar_name && (
                    <View className="avatar-tag">
                      <View className="avatar-avatar">
                        {order.avatar_url ? (
                          <TaroImage src={order.avatar_url} className="avatar-img" />
                        ) : (
                          <Text className="avatar-initial">{order.avatar_name.charAt(0)}</Text>
                        )}
                      </View>
                      <Text className="avatar-name">{order.avatar_name}</Text>
                    </View>
                  )}
                  <View className="platform-tags">
                    {order.platforms.map((platformKey) => {
                      const platform = getPlatformInfo(platformKey)
                      const IconComponent = platform.icon
                      return (
                        <View
                          key={platformKey}
                          className="platform-badge"
                          style={{
                            background: `${platform.color}15`,
                            borderColor: `${platform.color}30`
                          }}
                        >
                          <IconComponent size={12} color={platform.color} />
                          <Text className="platform-badge-text" style={{ color: platform.color }}>
                            {platform.name}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                  {/* 接单倒计时 */}
                  <View className="countdown-badge">
                    <Zap size={12} color={isUrgent ? '#EF4444' : '#6366F1'} />
                    <Text className={`countdown-text ${isUrgent ? 'urgent' : ''}`}>
                      {formatCountdown(countdown)}
                    </Text>
                  </View>
                </View>

                {/* 提示标签 */}
                {hints.length > 0 && (
                  <View className="hint-tags">
                    {hints.map((hint, idx) => (
                      <View 
                        key={idx} 
                        className={`hint-tag ${hint.includes('热门') || hint.includes('紧急') || hint.includes('高收益') ? 'hot' : hint.includes('需') ? 'warning' : 'info'}`}
                      >
                        <Info size={10} color="#6366F1" />
                        <Text>{hint}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 订单标题 */}
                <Text className="order-title">{order.title}</Text>
                <Text className="order-desc">{order.description}</Text>

                {/* 目标受众 */}
                {order.target_audience && (
                  <View className="audience-tag">
                    <Users size={12} color="#8B5CF6" />
                    <Text className="audience-text">{order.target_audience}</Text>
                  </View>
                )}

                {/* 数据统计 */}
                <View className="stats-row">
                  <View className="stat-item">
                    <Wallet size={16} color="#F59E0B" />
                    <View className="stat-content">
                      <Text className="stat-label">预算</Text>
                      <Text className="stat-value budget">¥{order.budget}</Text>
                    </View>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-item">
                    <TrendingUp size={16} color="#10B981" />
                    <View className="stat-content">
                      <Text className="stat-label">预估收益</Text>
                      <Text className="stat-value earnings">¥{Math.floor(order.budget * 0.8)}</Text>
                    </View>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-item">
                    <Clock size={16} color="#6366F1" />
                    <View className="stat-content">
                      <Text className="stat-label">交付周期</Text>
                      <Text className="stat-value">3天</Text>
                    </View>
                  </View>
                </View>

                {/* 分身信息 */}
                {order.avatar_name && (
                  <View className="avatar-info">
                    <View className="avatar-avatar">
                      <Text className="avatar-initial">{order.avatar_name.charAt(0)}</Text>
                    </View>
                    <Text className="avatar-name">{order.avatar_name}</Text>
                    <View className="avatar-level">
                      <Text className="level-text">L{order.avatar_level}</Text>
                    </View>
                  </View>
                )}

                {/* 操作按钮 */}
                <View className="card-actions">
                  <Button className="action-btn decline">
                    <Text className="btn-text">婉拒</Text>
                  </Button>
                  <Button 
                    className="action-btn accept"
                    onClick={() => Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })}
                    disabled={countdown <= 0}
                  >
                    <Text className="btn-text">{countdown <= 0 ? '已截止' : '立即接单'}</Text>
                    {countdown > 0 && <ChevronRight size={16} color="#fff" />}
                  </Button>
                </View>
              </View>
            )
          })
        )}
        
        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
