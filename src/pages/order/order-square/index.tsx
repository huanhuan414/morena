import { useDidShow, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import {
  ArrowLeft, 
  TrendingUp, DollarSign, Users,
  Clock, Star, Zap, ChevronRight
} from 'lucide-react-taro'
import './index.css'

// 平台配置
const PLATFORMS = [
  { key: 'all', label: '全部' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'douyin', label: '抖音' },
  { key: 'wechat_mp', label: '公众号' },
  { key: 'weibo', label: '微博' },
  { key: 'bilibili', label: 'B站' },
  { key: 'kuaishou', label: '快手' },
]

// 订单类型
const ORDER_TYPES = [
  { key: 'all', label: '全部' },
  { key: 'content', label: '内容创作' },
  { key: 'marketing', label: '营销推广' },
  { key: 'video', label: '视频制作' },
]

// 预算区间
const BUDGET_RANGES = [
  { key: 'all', label: '全部预算' },
  { key: '0-100', label: '100以下' },
  { key: '100-500', label: '100-500' },
  { key: '500-1000', label: '500-1000' },
  { key: '1000+', label: '1000+' },
]

// 平台图标映射
const PLATFORM_CONFIG: Record<string, { color: string; icon: string }> = {
  xiaohongshu: { color: '#FF2442', icon: '📕' },
  douyin: { color: '#000000', icon: '🎵' },
  wechat_mp: { color: '#07C160', icon: '💬' },
  weibo: { color: '#E6162D', icon: '🌐' },
  bilibili: { color: '#FB7299', icon: '📺' },
  kuaishou: { color: '#FF4906', icon: '📱' },
}

const formatCreatedAt = (value?: string) => {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

interface OrderItem {
  id: string
  title: string
  description: string
  budget: number
  platform: string
  contentType: string
  estimatedEarning: number
  deliveryDays: number
  requirements: string[]
  publisher: {
    nickname: string
    avatar: string
    rating: number
  }
  createdAt: string
}

export default function OrderSquarePage() {
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [selectedType] = useState('all')
  const [selectedBudget, setSelectedBudget] = useState('all')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  useDidShow(() => {
    fetchOrders()
  })

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/order/open',
        data: {
          page: 1,
          pageSize: 50
        }
      })
      
      if (res.data?.code === 200) {
        const data = res.data?.data
        const items = Array.isArray(data) ? data : (data?.items || [])
        const mapped = items.map((item: any) => ({
          id: item.id,
          title: item.title || '未命名订单',
          description: item.description || '',
          budget: Number(item.budget || 0),
          platform: Array.isArray(item.platforms) && item.platforms.length > 0 ? item.platforms[0] : 'all',
          contentType: item.contentType || 'content',
          estimatedEarning: Number(item.budget || 0),
          deliveryDays: 3,
          requirements: Array.isArray(item.requirements?.requiredSkills) ? item.requirements.requiredSkills : [],
          publisher: { nickname: '发布方', avatar: '', rating: 5 },
          createdAt: formatCreatedAt(item.createdAt)
        })) as OrderItem[]

        const filteredByPlatform = selectedPlatform === 'all'
          ? mapped
          : mapped.filter((item) => item.platform === selectedPlatform)

        const filtered = selectedBudget === 'all'
          ? filteredByPlatform
          : filteredByPlatform.filter((item) => {
            if (selectedBudget === '0-100') return item.budget <= 100
            if (selectedBudget === '100-500') return item.budget > 100 && item.budget <= 500
            if (selectedBudget === '500-1000') return item.budget > 500 && item.budget <= 1000
            if (selectedBudget === '1000+') return item.budget > 1000
            return true
          })

        setOrders(filtered)
      } else {
        // 模拟数据
        setOrders(getMockOrders())
      }
    } catch (error) {
      console.error('获取订单失败:', error)
      setOrders(getMockOrders())
    } finally {
      setLoading(false)
    }
  }

  // 模拟数据
  const getMockOrders = (): OrderItem[] => {
    return [
      {
        id: '1',
        title: '美妆产品种草笔记撰写',
        description: '需要撰写小红书种草笔记，要求原创度高，符合平台风格',
        budget: 280,
        platform: 'xiaohongshu',
        contentType: 'content',
        estimatedEarning: 280,
        deliveryDays: 2,
        requirements: ['原创', '配图', '热门关键词'],
        publisher: { nickname: '美妆达人小雅', avatar: '', rating: 4.8 },
        createdAt: '2小时前'
      },
      {
        id: '2',
        title: '新品上市短视频脚本',
        description: '为新品创作30秒短视频脚本，需要突出产品卖点',
        budget: 500,
        platform: 'douyin',
        contentType: 'video',
        estimatedEarning: 500,
        deliveryDays: 3,
        requirements: ['脚本', '分镜', '配音稿'],
        publisher: { nickname: '创意工坊', avatar: '', rating: 4.9 },
        createdAt: '5小时前'
      },
      {
        id: '3',
        title: '品牌推广软文代写',
        description: '撰写品牌推广软文，要求文笔流畅，传播力强',
        budget: 380,
        platform: 'wechat_mp',
        contentType: 'marketing',
        estimatedEarning: 380,
        deliveryDays: 2,
        requirements: ['原创', 'SEO优化', '配图'],
        publisher: { nickname: '营销精英', avatar: '', rating: 4.7 },
        createdAt: '1天前'
      },
      {
        id: '4',
        title: '数码产品测评内容',
        description: '数码产品深度测评内容，包含图文和视频素材',
        budget: 800,
        platform: 'bilibili',
        contentType: 'content',
        estimatedEarning: 800,
        deliveryDays: 5,
        requirements: ['深度测评', '对比分析', '实拍素材'],
        publisher: { nickname: '科技大咖', avatar: '', rating: 4.95 },
        createdAt: '1天前'
      },
      {
        id: '5',
        title: '美食探店视频脚本',
        description: '探店短视频脚本，需要有创意，吸引眼球',
        budget: 350,
        platform: 'kuaishou',
        contentType: 'video',
        estimatedEarning: 350,
        deliveryDays: 2,
        requirements: ['脚本', '拍摄指导', '剪辑建议'],
        publisher: { nickname: '美食探索家', avatar: '', rating: 4.6 },
        createdAt: '2天前'
      },
    ]
  }

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const res = await Network.request({
        url: `/api/order/${orderId}/accept`,
        method: 'PUT'
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '接单成功', icon: 'success' })
        fetchOrders()
      }
    } catch (error) {
      console.error('接单失败:', error)
      showToast({ title: '接单失败', icon: 'none' })
    }
  }

  const handleOrderClick = (order: OrderItem) => {
    navigateTo({ url: `/pages/order/order-detail/index?id=${order.id}&source=square` })
  }

  return (
    <View className="order-square-page">
      {/* 顶部背景 */}
      <View className="page-header">
        {/* 装饰元素 */}
        <View className="header-decoration">
          <View className="deco-circle deco-circle-1" />
          <View className="deco-circle deco-circle-2" />
        </View>
        
        {/* 标题栏 */}
        <View className="header-top">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={22} color="#fff" />
          </View>
          <Text className="header-title">订单广场</Text>
          <View className="header-right" />
        </View>
        
        {/* 平台筛选 */}
        <ScrollView 
          className="platform-scroll" 
          scrollX 
          scrollWithAnimation
        >
          <View className="platform-tags">
            {PLATFORMS.map(p => (
              <View 
                key={p.key}
                className={`platform-tag ${selectedPlatform === p.key ? 'active' : ''}`}
                onClick={() => setSelectedPlatform(p.key)}
              >
                <Text className="platform-tag-text">{p.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 筛选区域 */}
      <View className="filter-bar">
        <View 
          className={`filter-item ${showFilter ? 'active' : ''}`}
          onClick={() => setShowFilter(!showFilter)}
        >
          <Text className="filter-text">
            {selectedType === 'all' ? '类型' : ORDER_TYPES.find(t => t.key === selectedType)?.label}
          </Text>
          <ChevronRight size={14} color={showFilter ? '#7B3FE4' : '#999'} className={showFilter ? 'rotate-90' : ''} />
        </View>
        <View className="filter-divider" />
        <View 
          className="filter-item"
          onClick={() => setSelectedBudget(selectedBudget === 'all' ? '500-1000' : 'all')}
        >
          <Text className="filter-text">
            {selectedBudget === 'all' ? '预算' : BUDGET_RANGES.find(b => b.key === selectedBudget)?.label}
          </Text>
          <ChevronRight size={14} color="#999" />
        </View>
        <View className="filter-divider" />
        <View className="filter-item">
          <Text className="filter-text">智能排序</Text>
          <ChevronRight size={14} color="#999" />
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
            <View className="loading-spinner" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : (
          <View className="order-list">
            {orders.map(order => {
              const platformConfig = PLATFORM_CONFIG[order.platform] || { color: '#7B3FE4', icon: '📋' }
              
              return (
                <View 
                  key={order.id}
                  className="order-card"
                  onClick={() => handleOrderClick(order)}
                >
                  {/* 卡片头部 */}
                  <View className="card-header">
                    <View className="platform-badge" style={{ background: `${platformConfig.color}15` }}>
                      <Text className="platform-icon">{platformConfig.icon}</Text>
                      <Text className="platform-name" style={{ color: platformConfig.color }}>
                        {PLATFORMS.find(p => p.key === order.platform)?.label || order.platform}
                      </Text>
                    </View>
                    <Text className="publish-time">{order.createdAt}</Text>
                  </View>

                  {/* 订单标题 */}
                  <Text className="order-title">{order.title}</Text>

                  {/* 订单描述 */}
                  <Text className="order-desc">{order.description}</Text>

                  {/* 需求标签 */}
                  <View className="requirement-tags">
                    {order.requirements.slice(0, 3).map((req, idx) => (
                      <View key={idx} className="req-tag">
                        <Text className="req-tag-text">{req}</Text>
                      </View>
                    ))}
                  </View>

                  {/* 数据统计 */}
                  <View className="stats-row">
                    <View className="stat-item">
                      <DollarSign size={14} color="#F59E0B" />
                      <Text className="stat-value">¥{order.budget}</Text>
                      <Text className="stat-label">预算</Text>
                    </View>
                    <View className="stat-divider" />
                    <View className="stat-item">
                      <TrendingUp size={14} color="#10B981" />
                      <Text className="stat-value">¥{order.estimatedEarning}</Text>
                      <Text className="stat-label">预估收益</Text>
                    </View>
                    <View className="stat-divider" />
                    <View className="stat-item">
                      <Clock size={14} color="#6366F1" />
                      <Text className="stat-value">{order.deliveryDays}天</Text>
                      <Text className="stat-label">交付周期</Text>
                    </View>
                  </View>

                  {/* 卡片底部 */}
                  <View className="card-footer">
                    <View className="publisher-info">
                      <View className="publisher-avatar">
                        {order.publisher.avatar ? (
                          <Image src={order.publisher.avatar} className="avatar-img" />
                        ) : (
                          <Users size={16} color="#999" />
                        )}
                      </View>
                      <Text className="publisher-name">{order.publisher.nickname}</Text>
                      <View className="rating">
                        <Star size={12} color="#F59E0B" />
                        <Text className="rating-text">{order.publisher.rating}</Text>
                      </View>
                    </View>
                    <Button 
                      size="sm"
                      className="accept-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAcceptOrder(order.id)
                      }}
                    >
                      <Zap size={14} color="#fff" />
                      <Text className="accept-btn-text">接单</Text>
                    </Button>
                  </View>
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
