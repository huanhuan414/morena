import Taro, { useDidShow, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { PLATFORM_UI_ORDER, getPlatformLabel, getPlatformMeta, canonicalizePlatform } from '@/constants/publish-platform'
import {
  ArrowLeft, ArrowUp,
  Clock, Star, Zap,
  Flame, TrendingUp, DollarSign, Users
} from 'lucide-react-taro'
import { checkOrderPermission } from '@/utils/permission'
import './index.css'

const PLATFORMS = [
  { key: 'all', label: '全部' },
  ...PLATFORM_UI_ORDER.map((key) => ({ key, label: getPlatformLabel(key) }))
]

const formatCreatedAt = (value?: string) => {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

// 精心设计的示例数据 — 刺激用户接单欲望
const DEMO_ORDERS = [
  {
    id: 'demo_1',
    title: '小红书美妆种草笔记撰写',
    description: '需要3篇原创种草笔记，要求真实感强、配图精美，符合小红书调性。提供产品资料包。',
    budget: 420,
    platform: 'xiaohongshu',
    contentType: 'content',
    estimatedEarning: 420,
    deliveryDays: 2,
    requirements: ['原创撰写', '3篇起', '配图3张/篇'],
    publisher: { nickname: '花西子品牌方', avatar: '', rating: 4.9 },
    createdAt: '30分钟前',
    urgency: 'urgent' as const,
    acceptCount: 3,
    matchScore: 95
  },
  {
    id: 'demo_2',
    title: '抖音短视频脚本创作',
    description: '为新品30秒短视频创作脚本，需突出产品卖点和使用场景，节奏感强。',
    budget: 680,
    platform: 'douyin',
    contentType: 'video',
    estimatedEarning: 680,
    deliveryDays: 3,
    requirements: ['脚本撰写', '分镜设计', '配音稿'],
    publisher: { nickname: '科技新品局', avatar: '', rating: 4.8 },
    createdAt: '1小时前',
    urgency: 'urgent' as const,
    acceptCount: 5,
    matchScore: 88
  },
  {
    id: 'demo_3',
    title: '微信公众号品牌推广软文',
    description: '撰写品牌推广软文，要求文笔流畅、传播力强，阅读量目标10w+。',
    budget: 560,
    platform: 'wechat_mp',
    contentType: 'marketing',
    estimatedEarning: 560,
    deliveryDays: 2,
    requirements: ['原创撰写', 'SEO优化', '配图设计'],
    publisher: { nickname: '新消费品牌', avatar: '', rating: 4.7 },
    createdAt: '2小时前',
    urgency: 'normal' as const,
    acceptCount: 2,
    matchScore: 82
  },
  {
    id: 'demo_4',
    title: 'B站数码产品深度测评',
    description: '数码产品深度测评内容，包含图文和视频脚本，需要专业性和可读性。',
    budget: 1200,
    platform: 'bilibili',
    contentType: 'content',
    estimatedEarning: 1200,
    deliveryDays: 5,
    requirements: ['深度测评', '对比分析', '实拍素材'],
    publisher: { nickname: '数码研究所', avatar: '', rating: 4.95 },
    createdAt: '3小时前',
    urgency: 'hot' as const,
    acceptCount: 8,
    matchScore: 91
  },
  {
    id: 'demo_5',
    title: '快手美食探店视频脚本',
    description: '探店短视频脚本创作，需要创意拍摄方案和剪辑建议，吸引本地流量。',
    budget: 380,
    platform: 'kuaishou',
    contentType: 'video',
    estimatedEarning: 380,
    deliveryDays: 2,
    requirements: ['脚本撰写', '拍摄方案', '剪辑建议'],
    publisher: { nickname: '城市美食家', avatar: '', rating: 4.6 },
    createdAt: '5小时前',
    urgency: 'normal' as const,
    acceptCount: 1,
    matchScore: 76
  },
  {
    id: 'demo_6',
    title: '小红书旅行攻略图文',
    description: '撰写热门旅行目的地攻略，包含行程规划、美食推荐、拍照打卡点。',
    budget: 350,
    platform: 'xiaohongshu',
    contentType: 'content',
    estimatedEarning: 350,
    deliveryDays: 3,
    requirements: ['原创撰写', '配图9张+', '行程规划'],
    publisher: { nickname: '旅行研究所', avatar: '', rating: 4.8 },
    createdAt: '8小时前',
    urgency: 'normal' as const,
    acceptCount: 4,
    matchScore: 79
  },
]

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
  urgency?: 'urgent' | 'hot' | 'normal'
  acceptCount?: number
  matchScore?: number
}

export default function OrderSquarePage() {
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [refresherTriggered, setRefresherTriggered] = useState(false)
  const [acceptingOrderIds, setAcceptingOrderIds] = useState<Record<string, true>>({})
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<Record<string, true>>({})


  useDidShow(() => {
    fetchOrders()
  })

  // 滚动监听（只用于显示按钮）
  const handleScroll = (e: any) => {
    const currentScrollTop = e.detail.scrollTop
    setShowBackToTop(currentScrollTop > 300)
  }

  // 回到顶部
  const scrollToTop = () => {
    setScrollTop(prev => prev + 1)
  }

  const fetchOrders = async (platform?: string) => {
    const currentPlatform = platform ?? selectedPlatform
    setRefresherTriggered(true)
    try {
      const res = await Network.request({
        url: '/api/order/open?page=1&pageSize=50'
      })

      if (res.data?.code === 200) {
        const data = res.data?.data
        const items = Array.isArray(data) ? data : (data?.items || data?.list || [])

        if (items.length > 0) {
          const mapped = items.map((item: any) => ({
            id: item.id,
            title: item.title || '未命名订单',
            description: item.description || '',
            budget: Number(item.budget || 0),
            platform: canonicalizePlatform(Array.isArray(item.platforms) && item.platforms.length > 0 ? item.platforms[0] : (item.platform || '')),
            contentType: item.contentType || item.content_type || 'content',
            estimatedEarning: Number(item.expectedEarnings || item.expected_earnings || 0) || (Number(item.budget || 0) / Math.max(Number(item.avatarCount || item.expected_quantity || 1), 1)),
            deliveryDays: item.deliveryDays || item.delivery_days || 3,
            requirements: Array.isArray(item.requirements?.requiredSkills) ? item.requirements.requiredSkills : (Array.isArray(item.requiredSkills) ? item.requiredSkills : []),
            publisher: { nickname: item.publisherNickname || item.publisher_nickname || '发布方', avatar: item.publisherAvatar || item.publisher_avatar || '', rating: item.publisherRating || 5 },
            createdAt: formatCreatedAt(item.createdAt || item.created_at),
            acceptCount: Number(item.acceptCount || item.accept_count || 0)
          })) as OrderItem[]

          const filtered = currentPlatform === 'all'
            ? mapped
            : mapped.filter((item) => item.platform === currentPlatform)
          
          setOrders(filtered)
          setIsDemo(false)
        } else {
          setOrders(getDemoOrdersForPlatform(currentPlatform))
          setIsDemo(true)
        }
      } else {
        setOrders(getDemoOrdersForPlatform(currentPlatform))
        setIsDemo(true)
      }
    } catch (error) {
      console.error('获取订单失败:', error)
      setOrders(getDemoOrdersForPlatform(currentPlatform))
      setIsDemo(true)
    } finally {
      setRefresherTriggered(false)
    }
  }

  const getDemoOrdersForPlatform = (platform: string) => {
    if (platform === 'all') return DEMO_ORDERS
    return DEMO_ORDERS.filter(o => o.platform === platform)
  }

  const handlePlatformChange = (key: string) => {
    setSelectedPlatform(key)
    if (isDemo) {
      setOrders(getDemoOrdersForPlatform(key))
    } else {
      fetchOrders(key)
    }
  }

  const handleAcceptOrder = async (orderId: string) => {
    if (orderId.startsWith('demo_')) {
      showToast({ title: '创建分身即可接单赚钱', icon: 'none' })
      return
    }
    // 调用后端权益校验 — 检查是否有接单权限
    const allowed = await checkOrderPermission()
    if (!allowed) return

    // 获取用户的活跃分身列表
    try {
      const userRes = await Network.request({ url: '/api/auth/me' })
      const userId = userRes.data?.data?.id
      if (!userId) {
        showToast({ title: '请先登录', icon: 'none' })
        return
      }
      const avatarRes = await Network.request({ url: `/api/avatar` })
      const avatars = avatarRes.data?.data || []
      const activeAvatars = avatars.filter((a: any) => a.status === 'active')
      if (!Array.isArray(activeAvatars) || activeAvatars.length === 0) {
        showToast({ title: '请先创建分身', icon: 'none' })
        return
      }
      // 如果只有一个分身，直接接单
      if (activeAvatars.length === 1) {
        doAcceptOrder(activeAvatars[0].id, orderId)
        return
      }
      // 多个分身时弹出选择
      const avatarNames = activeAvatars.map((a: any) => a.name || a.nickname || '未命名分身')
      Taro.showActionSheet({
        itemList: avatarNames,
        success: (res) => {
          doAcceptOrder(activeAvatars[res.tapIndex].id, orderId)
        }
      })
    } catch (error) {
      console.error('接单失败:', error)
      showToast({ title: '接单失败', icon: 'none' })
    }
  }

  const doAcceptOrder = async (avatarId: string, orderId: string) => {
    try {
      setAcceptingOrderIds((prev) => ({ ...prev, [orderId]: true }))
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${avatarId}/accept/${orderId}`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        showToast({ title: '接单成功', icon: 'success' })
        setAcceptedOrderIds((prev) => ({ ...prev, [orderId]: true }))
        setAcceptingOrderIds((prev) => {
          const { [orderId]: _, ...rest } = prev
          return rest
        })
        fetchOrders()
      } else {
        showToast({ title: res.data?.message || '接单失败', icon: 'none' })
        setAcceptingOrderIds((prev) => {
          const { [orderId]: _, ...rest } = prev
          return rest
        })
      }
    } catch (error) {
      console.error('接单失败:', error)
      showToast({ title: '接单失败', icon: 'none' })
      setAcceptingOrderIds((prev) => {
        const { [orderId]: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleOrderClick = (order: OrderItem) => {
    if (order.id.startsWith('demo_')) {
      showToast({ title: '创建分身即可查看详情', icon: 'none' })
      return
    }
    navigateTo({ url: `/package-order/pages/order-detail/index?id=${order.id}&source=square` })
  }

  const statusBarHeight = getStatusBarHeight()

  const getUrgencyTag = (order: OrderItem) => {
    if (order.urgency === 'urgent') return { text: '急单', color: '#EF4444', bg: '#FEF2F2' }
    if (order.urgency === 'hot') return { text: '热门', color: '#F59E0B', bg: '#FFFBEB' }
    return null
  }

  const getMatchColor = (score?: number) => {
    if (!score) return '#999'
    if (score >= 80) return '#10B981'
    if (score >= 60) return '#F59E0B'
    return '#999'
  }

  return (
    <View className="order-square-page">
      {/* 顶部背景 */}
      <View className="page-header" style={{ paddingTop: statusBarHeight + 'px' }}>
        <View className="header-decoration">
          <View className="deco-circle deco-circle-1" />
          <View className="deco-circle deco-circle-2" />
        </View>

        <View className="header-top">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={22} color="#fff" />
          </View>
          <View className="header-center">
            <Text className="header-title block">订单广场</Text>
            <Text className="header-sub block">接单赚钱，AI替你创作</Text>
          </View>
          <View className="header-right" />
        </View>

        {/* 统计概览 */}
        <View className="header-stats">
          <View className="header-stat">
            <Text className="header-stat-value block">{DEMO_ORDERS.length}+</Text>
            <Text className="header-stat-label block">在线订单</Text>
          </View>
          <View className="header-stat-divider" />
          <View className="header-stat">
            <Text className="header-stat-value block">¥{DEMO_ORDERS.reduce((s, o) => s + o.budget, 0)}+</Text>
            <Text className="header-stat-label block">总预算金额</Text>
          </View>
          <View className="header-stat-divider" />
          <View className="header-stat">
            <Text className="header-stat-value block">¥120~1200</Text>
            <Text className="header-stat-label block">单笔收益</Text>
          </View>
        </View>

        {/* 平台筛选 */}
        <ScrollView className="platform-scroll" scrollX scrollWithAnimation>
          <View className="platform-tags">
            {PLATFORMS.map(p => (
              <View
                key={p.key}
                className={`platform-tag ${selectedPlatform === p.key ? 'active' : ''}`}
                onClick={() => handlePlatformChange(p.key)}
              >
                <Text className="platform-tag-text">{p.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 示例数据提示 */}
      {isDemo && (
        <View className="demo-hint">
          <View className="demo-hint-badge">
            <Flame size={14} color="#7B3FE4" />
            <Text className="demo-hint-text">以下为热门示例订单，创建分身即可接单赚钱</Text>
          </View>
        </View>
      )}

      {/* 订单列表 */}
      <ScrollView
        className="order-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refresherTriggered}
        onRefresherRefresh={() => fetchOrders()}
        onScroll={handleScroll}
        scrollTop={scrollTop}
        scrollWithAnimation
      >
        <View className="order-list">
          {orders.map(order => {
            const platformConfig = getPlatformMeta(order.platform) || { color: '#7B3FE4', icon: '📋', name: order.platform }
            const urgencyTag = getUrgencyTag(order)

            return (
              <View
                key={order.id}
                className="order-card"
                onClick={() => handleOrderClick(order)}
              >
                {/* 卡片顶部条 */}
                {urgencyTag && (
                  <View className="card-top-strip" style={{ background: urgencyTag.color }} />
                )}
                {/* 卡片头部 */}
                <View className="card-header">
                  <View className="card-header-left">
                    <View className="platform-badge" style={{ background: `${platformConfig.color}15` }}>
                      <Text className="platform-icon">{platformConfig.icon}</Text>
                      <Text className="platform-name" style={{ color: platformConfig.color }}>
                        {getPlatformLabel(order.platform)}
                      </Text>
                    </View>
                    {urgencyTag && (
                      <View className="urgency-badge" style={{ background: urgencyTag.bg }}>
                        <Text className="urgency-text" style={{ color: urgencyTag.color }}>{urgencyTag.text}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="publish-time">{order.createdAt}</Text>
                </View>

                {/* 订单标题 */}
                <View className="order-title-row">
                  <Text className="order-title">{order.title}</Text>
                  {order.matchScore && order.matchScore >= 80 && (
                    <View className="match-badge" style={{ background: `${getMatchColor(order.matchScore)}15` }}>
                      <TrendingUp size={12} color={getMatchColor(order.matchScore)} />
                      <Text className="match-text" style={{ color: getMatchColor(order.matchScore) }}>
                        {order.matchScore}%匹配
                      </Text>
                    </View>
                  )}
                </View>

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
                    <Text className="stat-value earn">¥{order.estimatedEarning}</Text>
                    <Text className="stat-label">单笔收益</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-item">
                    <Clock size={14} color="#6366F1" />
                    <Text className="stat-value">{order.deliveryDays}天</Text>
                    <Text className="stat-label">交付周期</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-item">
                    <Users size={14} color="#10B981" />
                    <Text className="stat-value">{order.acceptCount || 0}人</Text>
                    <Text className="stat-label">已接单</Text>
                  </View>
                </View>

                {/* 卡片底部 */}
                <View className="card-footer">
                  <View className="publisher-info">
                    <View className="publisher-avatar">
                      <Users size={16} color="#999" />
                    </View>
                    <Text className="publisher-name">{order.publisher.nickname}</Text>
                    <View className="rating">
                      <Star size={12} color="#F59E0B" />
                      <Text className="rating-text">{order.publisher.rating}</Text>
                    </View>
                  </View>
                  <View
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <Button
                      size="sm"
                      className="accept-btn"
                      disabled={Boolean(acceptingOrderIds[order.id] || acceptedOrderIds[order.id])}
                      onClick={() => handleAcceptOrder(order.id)}
                    >
                      <Zap size={14} color="#fff" />
                      <Text className="accept-btn-text">
                        {acceptedOrderIds[order.id] ? '已接单' : (acceptingOrderIds[order.id] ? '接单中' : '接单')}
                      </Text>
                    </Button>
                  </View>
                </View>
              </View>
            )
          })}
        </View>

        {/* 底部CTA */}
        {isDemo && (
          <View className="bottom-cta">
            <View className="cta-card">
              <View className="cta-content">
                <Text className="cta-title block">创建分身，立即接单赚钱</Text>
                <Text className="cta-desc block">AI自动匹配订单，24h替你创作，轻松赚收益</Text>
              </View>
              <Button
                className="cta-btn"
                onClick={() => navigateTo({ url: '/package-avatar/pages/avatar-create/index' })}
              >
                <Text className="cta-btn-text">免费创建</Text>
              </Button>
            </View>
          </View>
        )}

        <View className="safe-bottom" />
      </ScrollView>

      {showBackToTop && (
        <View className="back-to-top" onClick={scrollToTop}>
          <ArrowUp size={20} color="#fff" />
        </View>
      )}
    </View>
  )
}
