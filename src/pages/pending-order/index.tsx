import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import * as Network from '@/network'
import { Clock, TrendingUp, Wallet, Users, Image, Video, FileText, ChevronRight } from 'lucide-react-taro'
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
  avatar_level?: number
  target_audience?: string
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
    target_audience: '18-25岁女性'
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
    target_audience: '数码爱好者'
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
    target_audience: '美食爱好者'
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
    target_audience: '职场人士'
  }
]

export default function PendingOrderListPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })
      if (res.data?.code === 200) {
        setOrders(res.data.data || [])
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
  const filteredOrders = selectedPlatform
    ? orders.filter(order => order.platforms.includes(selectedPlatform))
    : orders

  // 获取平台信息
  const getPlatformInfo = (key: string) => {
    return PLATFORMS.find(p => p.key === key) || { name: key, color: '#6366F1', icon: FileText }
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
        <View className="header-title-area">
          <Text className="header-title">待接订单</Text>
          <Text className="header-subtitle">智能匹配 · AI辅助 · 自动生成</Text>
        </View>

        {/* 自动接单开关 */}
        <View className="auto-accept-bar">
          <View className="auto-accept-left">
            <Clock size={16} color="#6366F1" />
            <Text className="auto-accept-text">自动接单</Text>
          </View>
          <Switch
            checked={autoAccept}
            onCheckedChange={(checked) => setAutoAccept(checked)}
          />
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
          filteredOrders.map((order) => (
            <View key={order.id} className="order-card">
              {/* 卡片头部 - 平台标签 */}
              <View className="card-header">
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
                <View className="deadline-badge">
                  <Clock size={12} color="#94A3B8" />
                  <Text className="deadline-text">
                    {new Date(order.deadline).toLocaleDateString()}
                  </Text>
                </View>
              </View>

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
                <Button className="action-btn accept">
                  <Text className="btn-text">立即接单</Text>
                  <ChevronRight size={16} color="#fff" />
                </Button>
              </View>
            </View>
          ))
        )}
        
        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
