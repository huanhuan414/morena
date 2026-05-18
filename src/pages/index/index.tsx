import React, { useEffect, useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, FileText, Coins, Plus, Zap, TrendingUp, Sparkles, Target, ArrowRight, CircleDollarSign, Eye, ShoppingBag, ChevronRight, Gift, Rocket, Clock } from 'lucide-react-taro'
import { Network } from '@/network'
import { BANNER_TITLE, BANNER_DESC } from '@/constants/referral-rewards'
import { PLATFORM_UI_ORDER, getPlatformLabel, getPlatformMeta, canonicalizePlatform } from '@/constants/publish-platform'
import { useUserStore } from '@/stores/user'
import { useNotifications } from '@/hooks/useNotifications'
import { Avatar as UiAvatar } from '@/components/ui/avatar'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

interface OrderItem {
  id: string
  title: string
  description: string
  platform: string
  estimatedEarning: number
  deliveryDays: number
  acceptCount: number
  requirements: string[]
  publisher: { nickname: string; rating: number }
  matchScore?: number
  createdAt: string
  isDemo?: boolean
  urgency?: string
  contentType?: string
}

// 精心设计的示例数据 — 刺激用户接单欲望
const DEMO_ORDERS: OrderItem[] = [
  {
    id: 'demo_1', title: '小红书美妆种草笔记撰写',
    description: '需要3篇原创种草笔记，要求真实感强、配图精美，符合小红书调性。',
    platform: 'xiaohongshu', estimatedEarning: 420, deliveryDays: 2,
    requirements: ['原创撰写', '3篇起', '配图3张/篇'],
    publisher: { nickname: '花西子品牌方', rating: 4.9 },
    createdAt: '30分钟前', isDemo: true, urgency: 'urgent', acceptCount: 3, matchScore: 95, contentType: 'content'
  },
  {
    id: 'demo_2', title: '抖音短视频脚本创作',
    description: '为新品30秒短视频创作脚本，需突出产品卖点和使用场景，节奏感强。',
    platform: 'douyin', estimatedEarning: 680, deliveryDays: 3,
    requirements: ['脚本撰写', '分镜设计', '配音稿'],
    publisher: { nickname: '科技新品局', rating: 4.8 },
    createdAt: '1小时前', isDemo: true, urgency: 'urgent', acceptCount: 5, matchScore: 88, contentType: 'video'
  },
  {
    id: 'demo_3', title: '微信公众号品牌推广软文',
    description: '撰写品牌推广软文，要求文笔流畅、传播力强，阅读量目标10w+。',
    platform: 'wechat_mp', estimatedEarning: 560, deliveryDays: 2,
    requirements: ['原创撰写', 'SEO优化', '配图设计'],
    publisher: { nickname: '新消费品牌', rating: 4.7 },
    createdAt: '2小时前', isDemo: true, urgency: 'normal', acceptCount: 2, matchScore: 82, contentType: 'marketing'
  },
  {
    id: 'demo_4', title: 'B站数码产品深度测评',
    description: '数码产品深度测评内容，包含图文和视频脚本，需要专业性和可读性。',
    platform: 'bilibili', estimatedEarning: 1200, deliveryDays: 5,
    requirements: ['深度测评', '对比分析', '实拍素材'],
    publisher: { nickname: '数码研究所', rating: 4.95 },
    createdAt: '3小时前', isDemo: true, urgency: 'hot', acceptCount: 8, matchScore: 91, contentType: 'content'
  },
  {
    id: 'demo_5', title: '快手美食探店视频脚本',
    description: '探店短视频脚本创作，需要创意拍摄方案和剪辑建议，吸引本地流量。',
    platform: 'kuaishou', estimatedEarning: 380, deliveryDays: 2,
    requirements: ['脚本撰写', '拍摄方案', '剪辑建议'],
    publisher: { nickname: '城市美食家', rating: 4.6 },
    createdAt: '5小时前', isDemo: true, urgency: 'normal', acceptCount: 1, matchScore: 76, contentType: 'video'
  },
  {
    id: 'demo_6', title: '小红书旅行攻略图文',
    description: '撰写热门旅行目的地攻略，包含行程规划、美食推荐、拍照打卡点。',
    platform: 'xiaohongshu', estimatedEarning: 350, deliveryDays: 3,
    requirements: ['原创撰写', '配图9张+', '行程规划'],
    publisher: { nickname: '旅行研究所', rating: 4.8 },
    createdAt: '6小时前', isDemo: true, urgency: 'normal', acceptCount: 0, matchScore: 73, contentType: 'content'
  }
]

const Index: React.FC = () => {
  const [userName, setUserName] = useState('用户')
  const [mindClones, setMindClones] = useState(0)
  const [userAvatar, setUserAvatar] = useState('')
  const [allHostingEnabled, setAllHostingEnabled] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [invitedCount, setInvitedCount] = useState(0)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [generatedContents, setGeneratedContents] = useState(0)
  const [growthCampaign, setGrowthCampaign] = useState<any>(null)
  const [trackedCampaignId, setTrackedCampaignId] = useState('')
  const { avatarId: currentAvatarId, setAvatarId } = useUserStore(state => state)

  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderModalData, setOrderModalData] = useState<any>(null)
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage)

  const { unreadCount, showModal, currentNotification, closeModal } = useNotifications({
    pollInterval: 10000
  })

  // ===== 订单广场相关状态 =====
  const [activePlatform, setActivePlatform] = useState('all')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [acceptingOrderIds, setAcceptingOrderIds] = useState<Record<string, boolean>>({})
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<Record<string, boolean>>({})

  const platformTabs = [
    { key: 'all', label: '全部' },
    ...PLATFORM_UI_ORDER.map((key) => ({ key, label: getPlatformLabel(key) }))
  ]

  // 获取公开订单列表（订单广场数据）
  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true)
      const res = await Network.request({
        url: '/api/order/open',
        data: activePlatform !== 'all' ? { platform: activePlatform } : {}
      })
      console.log('[首页] 获取公开订单 URL:/api/order/open, Method:GET, Params:', activePlatform !== 'all' ? { platform: activePlatform } : {}, 'Response:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const rawOrders = Array.isArray(res.data.data) ? res.data.data : (res.data.data.orders || res.data.data.list || [])
        if (rawOrders.length > 0) {
          const mapped: OrderItem[] = rawOrders.map((o: any) => ({
            id: o.id,
            title: o.title || '未命名订单',
            description: o.description || o.requirements || '',
            platform: canonicalizePlatform(o.platform || o.platforms?.[0]),
            estimatedEarning: Number(o.budget || o.estimatedEarning || 0),
            deliveryDays: o.deliveryDays || o.delivery_days || 3,
            acceptCount: o.acceptCount || o.accept_count || 0,
            requirements: Array.isArray(o.requirements) ? o.requirements : (o.tags ? o.tags.split(',').filter(Boolean) : []),
            publisher: { nickname: o.publisher?.nickname || o.owner_nickname || '匿名', rating: o.publisher?.rating || 5.0 },
            matchScore: o.matchScore || o.match_score,
            createdAt: o.createdAt || o.created_at || '',
          }))
          setOrders(mapped)
        } else {
          // API 无数据时用 demo 兜底
          setOrders(filterDemoByPlatform(activePlatform))
        }
      } else {
        setOrders(filterDemoByPlatform(activePlatform))
      }
    } catch (err) {
      console.error('获取公开订单失败:', err)
      setOrders(filterDemoByPlatform(activePlatform))
    } finally {
      setOrdersLoading(false)
    }
  }, [activePlatform])

  // 根据 Tab 筛选 demo 数据
  const filterDemoByPlatform = (platform: string) => {
    if (platform === 'all') return DEMO_ORDERS
    return DEMO_ORDERS.filter(o => o.platform === platform).length > 0
      ? DEMO_ORDERS.filter(o => o.platform === platform)
      : DEMO_ORDERS
  }

  // 获取分配给当前用户的待接订单（仅弹窗通知用）
  const fetchAssignedOrders = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/order-dispatch/pending-requests' })
      if (res.data?.code === 200 && res.data?.data) {
        const seen = new Set<string>()
        const items = (res.data.data || []).filter((item: any) => {
          const oid = item.orderId
          if (!item.avatarId && !item.avatar_id) return false
          if (!item.avatarName && !item.avatar_name) return false
          if (seen.has(oid)) return false
          seen.add(oid)
          return true
        })

        // 弹窗通知
        if (items.length > 0 && !showOrderModal && !orderModalData) {
          const item = items[0]
          let platforms = item.platforms
          if (typeof platforms === 'string') {
            try { platforms = JSON.parse(platforms) } catch { platforms = [platforms] }
          }
          if (!Array.isArray(platforms)) platforms = platforms ? [platforms] : ['通用']
          const platformName = getPlatformName(platforms[0] || '通用')

          setOrderModalData({
            id: item.orderId,
            dispatchId: item.dispatchId,
            avatarId: item.avatarId,
            platform: platformName,
            platformColor: getPlatformColor(platformName),
            title: item.title || '新订单',
            budget: item.budget ? `¥${item.budget}` : '待定',
            deadline: '长期有效'
          })
          setShowOrderModal(true)
        }
      }
    } catch (err) {
      console.error('获取待接订单失败:', err)
    }
  }, [])

  // 接单
  const handleAcceptOrder = async (orderId: string) => {
    // demo 订单不能真正接单
    if (orderId.startsWith('demo_')) {
      Taro.showToast({ title: '示例订单，请先创建分身', icon: 'none' })
      return
    }
    if (acceptingOrderIds[orderId] || acceptedOrderIds[orderId]) return
    setAcceptingOrderIds(prev => ({ ...prev, [orderId]: true }))
    try {
      let avatarIdToUse = currentAvatarId
      if (!avatarIdToUse || avatarIdToUse === 'undefined') {
        const avatarRes = await Network.request({ url: '/api/avatar' })
        if (avatarRes.data?.code === 200 && avatarRes.data?.data?.length > 0) {
          avatarIdToUse = avatarRes.data.data[0].id || ''
          if (!avatarIdToUse) {
            Taro.showToast({ title: '分身数据异常', icon: 'none' })
            return
          }
          setAvatarId(avatarIdToUse)
        } else {
          Taro.showToast({ title: '请先创建分身', icon: 'none' })
          return
        }
      }
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${avatarIdToUse}/accept/${orderId}`,
        method: 'POST'
      })
      console.log('[首页] 接单 URL:', `/api/order-dispatch/avatar/${avatarIdToUse}/accept/${orderId}`, 'Method:POST', 'Response:', res.data)
      if (res.data?.code === 200) {
        setAcceptedOrderIds(prev => ({ ...prev, [orderId]: true }))
        Taro.showToast({ title: '接单成功', icon: 'success' })
        fetchOrders()
        fetchStats()
      } else {
        Taro.showToast({ title: res.data?.message || '接单失败', icon: 'none' })
      }
    } catch (err) {
      console.error('接单失败:', err)
      Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
    } finally {
      setAcceptingOrderIds(prev => ({ ...prev, [orderId]: false }))
    }
  }

  const getPlatformName = (platform: string): string => {
    const nameMap: Record<string, string> = {
      'wechat': '微信', 'wechat_mp': '公众号', 'xiaohongshu': '小红书',
      'douyin': '抖音', 'kuaishou': '快手', 'bilibili': 'B站',
      'weibo': '微博', 'zhihu': '知乎',
    }
    return nameMap[platform] || platform
  }

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      '微信': '#07C160', '公众号': '#07C160', '小红书': '#FF2442',
      '抖音': '#00F2EA', '微博': '#FF8200', '快手': '#FF4906',
      'B站': '#FB7299', '知乎': '#0084FF',
    }
    return colors[platform] || '#6366F1'
  }

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const storedUserInfo = await Taro.getStorage({ key: 'userInfo' }).catch(() => null)
      if (!storedUserInfo?.data?.id) {
        console.log('用户未登录，静默跳转到登录页')
        Taro.navigateTo({ url: '/pages/login/index' })
        return
      }

      const res = await Network.request({ url: '/api/user-stats/overview' })
      console.log('统计数据:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const d = res.data.data
        setMindClones(d.avatarCount || 0)
        setUserName(d.nickname || '用户')
        setUserAvatar(d.avatarUrl || '')
        setAllHostingEnabled(d.allHostingEnabled || false)
        setReferralCode(d.referralCode || '')
        setInvitedCount(d.invitedCount || 0)
        setTotalEarnings(Number(d.totalEarnings || 0))
        setPendingOrders(d.pendingOrders || 0)
        setGeneratedContents(d.generatedContents || 0)
      }
    } catch (err) {
      console.error('获取统计数据失败:', err)
    }
  }

  const trackGrowthCampaign = async (eventType: 'exposure' | 'click') => {
    try {
      await Network.request({
        url: '/api/activities/campaign/track',
        method: 'POST',
        data: { eventType }
      })
    } catch (err) {
      console.error('记录活动事件失败:', err)
    }
  }

  const fetchGrowthCampaign = async () => {
    try {
      const res = await Network.request({ url: '/api/activities/campaign/active' })
      const campaign = res.data?.data || null
      setGrowthCampaign(campaign)
      if (campaign?.id && trackedCampaignId !== campaign.id) {
        await trackGrowthCampaign('exposure')
        setTrackedCampaignId(campaign.id)
      }
    } catch (err) {
      console.error('获取增长活动失败:', err)
      setGrowthCampaign(null)
    }
  }

  useEffect(() => {
    loadUserFromStorage().then(() => {
      fetchStats()
      fetchGrowthCampaign()
      fetchAssignedOrders()
      fetchOrders()
    }).catch(err => console.error('初始化数据加载失败:', err))
  }, [])

  useDidShow(() => {
    loadUserFromStorage().then(() => {
      fetchStats()
      fetchGrowthCampaign()
      fetchAssignedOrders()
      fetchOrders()
    }).catch(err => console.error('刷新数据失败:', err))
  })

  // 平台切换时重新获取订单
  useEffect(() => {
    fetchOrders()
  }, [activePlatform])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 9) return '早上好'
    if (hour < 12) return '上午好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    if (hour < 22) return '晚上好'
    return '夜深了'
  }

  const getValueProp = () => {
    if (mindClones === 0) return '创建AI分身，开始自动赚钱'
    if (!allHostingEnabled) return '开启托管，让分身24h替你接单'
    if (pendingOrders > 0) return `${pendingOrders}个新订单等你来接`
    return '分身正在努力为你赚钱中'
  }

  const goToPage = (path: string) => {
    if (path === "/pages/mind-chat/index" || path === "/pages/index/index" || path === "/pages/profile/index") {
      Taro.switchTab({ url: path })
      return
    }
    Taro.navigateTo({ url: path })
  }

  const handleOrderAccept = async () => {
    if (orderModalData?.id) {
      await handleAcceptOrder(orderModalData.id)
      setShowOrderModal(false)
      if (acceptedOrderIds[orderModalData.id]) {
        Taro.navigateTo({ url: `/package-order/pages/order-content-creation/index?orderId=${orderModalData.id}` })
      }
    }
  }

  const handleOrderDismiss = () => { setShowOrderModal(false) }

  const enableAllTrust = async () => {
    try {
      const res = await Network.request({
        url: '/api/avatar/trust/all',
        method: 'PUT',
        data: { trust_enabled: true }
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已开启所有分身托管', icon: 'success' })
        fetchStats()
      } else {
        Taro.showToast({ title: res.data?.msg || '开启失败', icon: 'none' })
      }
    } catch (err) {
      console.error('开启托管失败:', err)
      Taro.showToast({ title: '开启失败', icon: 'none' })
    }
  }

  // 紧急程度标签
  const getUrgencyTag = (order: OrderItem) => {
    if (order.urgency === 'urgent' || order.urgency === 'hot') return { text: order.urgency === 'hot' ? '热门' : '紧急', color: '#EF4444', bg: '#FEF2F2' }
    if (order.deliveryDays <= 1) return { text: '紧急', color: '#EF4444', bg: '#FEF2F2' }
    if (order.deliveryDays <= 3) return { text: '较急', color: '#F59E0B', bg: '#FFFBEB' }
    if (order.urgency === 'hot') return { text: '热门', color: '#F97316', bg: '#FFF7ED' }
    return null
  }

  // 匹配度颜色
  const getMatchColor = (score?: number) => {
    if (!score) return '#6366F1'
    if (score >= 80) return '#10B981'
    if (score >= 60) return '#F59E0B'
    return '#6366F1'
  }

  // 内容类型标签
  const getContentTypeTag = (order: OrderItem) => {
    const typeMap: Record<string, { text: string; color: string; bg: string }> = {
      'content': { text: '图文', color: '#6366F1', bg: '#EEF2FF' },
      'video': { text: '视频', color: '#EC4899', bg: '#FDF2F8' },
      'marketing': { text: '营销', color: '#F59E0B', bg: '#FFFBEB' },
    }
    return typeMap[order.contentType || ''] || null
  }

  return (
    <View className="index-page">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-bg" />
        <View className="header-content" style={{ paddingTop: `${getStatusBarHeight() + 50}px` }}>
          <View className="header-left">
            <View className="avatar-wrapper">
              <UiAvatar src={userAvatar || ''} name={userName} size={96} />
              <View className="online-dot" />
            </View>
            <View className="header-info">
              <Text className="nickname">{getGreeting()}，{userName}</Text>
              <View className="subtitle-wrapper">
                <Sparkles size={22} color="rgba(255,255,255,0.9)" />
                <Text className="subtitle">{getValueProp()}</Text>
              </View>
            </View>
          </View>
          <View className="header-right">
            <View className="icon-btn" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/notifications/index' })}>
              <Bell size={32} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View className="notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </View>
              )}
            </View>
            <View className="icon-btn" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/settings/index' })}>
              <Settings size={32} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>

      {/* 主内容区 */}
      <ScrollView scrollY className="content" enhanced showScrollbar={false}>

        {/* 新用户引导（仅无分身时显示） */}
        {mindClones === 0 && (
          <View className="guide-section">
            <View className="guide-header">
              <View className="guide-header-left">
                <Target size={28} color="#6366F1" />
                <Text className="guide-title">3步开始赚钱</Text>
              </View>
              <View className="guide-badge">新手必看</View>
            </View>
            <View className="guide-steps">
              <View className="guide-step" onClick={() => goToPage('/package-avatar/pages/avatar-create/index')}>
                <View className="step-number">1</View>
                <View className="step-content">
                  <Text className="step-title">创建AI分身</Text>
                  <Text className="step-desc">打造你的数字分身，0成本起步</Text>
                </View>
                <ArrowRight size={28} color="#94A3B8" />
              </View>
              <View className="step-connector" />
              <View className="guide-step" onClick={enableAllTrust}>
                <View className="step-number">2</View>
                <View className="step-content">
                  <Text className="step-title">开启自动托管</Text>
                  <Text className="step-desc">AI自动接单，24h不间断赚钱</Text>
                </View>
                <ArrowRight size={28} color="#94A3B8" />
              </View>
              <View className="step-connector" />
              <View className="guide-step">
                <View className="step-number step-number-done">3</View>
                <View className="step-content">
                  <Text className="step-title">坐享收益</Text>
                  <Text className="step-desc">内容发布后自动结算，随时提现</Text>
                </View>
                <CircleDollarSign size={32} color="#10B981" />
              </View>
            </View>
          </View>
        )}

        {/* 核心数据区 */}
        <View className="stats-section">
          {totalEarnings > 0 && (
            <View className="earning-highlight" onClick={() => goToPage('/package-profile/pages/earning-center/index')}>
              <View className="earning-highlight-left">
                <TrendingUp size={32} color="#10B981" />
                <Text className="earning-highlight-label">累计收益</Text>
              </View>
              <View className="earning-highlight-right">
                <Text className="earning-highlight-value">¥{totalEarnings.toFixed(2)}</Text>
                <ChevronRight size={28} color="#10B981" />
              </View>
            </View>
          )}
          <View className="stats-row">
            <View className="stat-item" onClick={() => goToPage('/pages/mind-chat/index')}>
              <View className="stat-icon-small" style={{ background: '#EEF2FF' }}>
                <Users size={28} color="#6366F1" />
              </View>
              <Text className="stat-value-small" style={{ color: '#6366F1' }}>{mindClones}</Text>
              <Text className="stat-label-small">我的分身</Text>
              <Text className="stat-hint" style={{ color: mindClones > 0 ? '#6366F1' : '#94A3B8' }}>
                {mindClones > 0 ? '管理分身' : '创建分身'}
              </Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-order/pages/pending-order/index')}>
              <View className="stat-icon-small" style={{ background: '#FFFBEB' }}>
                <ShoppingBag size={28} color="#F59E0B" />
              </View>
              <Text className="stat-value-small" style={{ color: '#F59E0B' }}>{pendingOrders}</Text>
              <Text className="stat-label-small">待接订单</Text>
              <Text className="stat-hint" style={{ color: pendingOrders > 0 ? '#F59E0B' : '#94A3B8' }}>
                {pendingOrders > 0 ? '去接单赚钱' : '暂无待接'}
              </Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-avatar/pages/generated-content/index')}>
              <View className="stat-icon-small" style={{ background: '#ECFDF5' }}>
                <FileText size={28} color="#10B981" />
              </View>
              <Text className="stat-value-small" style={{ color: '#10B981' }}>{generatedContents}</Text>
              <Text className="stat-label-small">我的订单</Text>
              <Text className="stat-hint" style={{ color: generatedContents > 0 ? '#10B981' : '#94A3B8' }}>
                {generatedContents > 0 ? '去发布' : '暂无内容'}
              </Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-profile/pages/earning-center/index')}>
              <View className="stat-icon-small" style={{ background: '#FDF2F8' }}>
                <Coins size={28} color="#EC4899" />
              </View>
              <Text className="stat-value-small" style={{ color: '#EC4899' }}>¥{totalEarnings > 0 ? totalEarnings.toFixed(0) : '0'}</Text>
              <Text className="stat-label-small">累计收益</Text>
              <Text className="stat-hint" style={{ color: totalEarnings > 0 ? '#EC4899' : '#94A3B8' }}>
                {totalEarnings > 0 ? '去提现' : '开始赚取'}
              </Text>
            </View>
          </View>
        </View>

        {/* 推广Banner */}
        {growthCampaign && (
          <View
            className="banner"
            onClick={async () => {
              await trackGrowthCampaign('click')
              goToPage('/package-profile/pages/referral-center/index')
            }}
          >
            <View className="banner-bg" />
            <View className="banner-content">
              <View className="banner-tag">
                <Eye size={20} color="#FBBF24" />
                <Text className="banner-tag-text">活动进行中</Text>
              </View>
              <Text className="banner-title">{growthCampaign.title || '限时增长活动'}</Text>
              <Text className="banner-desc">{growthCampaign.description || '立即参与，查看活动详情与奖励说明'}</Text>
              <View className="banner-btn">
                <Text className="banner-btn-text">立即参与</Text>
                <ChevronRight size={24} color="#6366F1" />
              </View>
            </View>
            <View className="banner-decoration">
              <View className="deco-circle circle-1" />
              <View className="deco-circle circle-2" />
              <TrendingUp size={100} color="rgba(255,255,255,0.15)" />
            </View>
          </View>
        )}

        <View
          className="banner"
          onClick={() => {
            if (mindClones === 0) {
              goToPage('/package-avatar/pages/avatar-create/index')
            } else if (!allHostingEnabled) {
              enableAllTrust()
            } else {
              goToPage('/package-profile/pages/referral-center/index')
            }
          }}
        >
          <View className="banner-bg" />
          <View className="banner-content">
            {mindClones === 0 ? (
              <>
                <View className="banner-tag">
                  <Sparkles size={20} color="#FBBF24" />
                  <Text className="banner-tag-text">0成本创业</Text>
                </View>
                <Text className="banner-title">创建AI分身 开始自动赚钱</Text>
                <Text className="banner-desc">AI帮你接单+生成内容+自动发布，你只管收钱</Text>
                <View className="banner-btn create">
                  <Plus size={28} color="#6366F1" />
                  <Text className="banner-btn-text create">免费创建，立即赚钱</Text>
                </View>
              </>
            ) : !allHostingEnabled ? (
              <>
                <View className="banner-tag">
                  <Zap size={20} color="#FBBF24" />
                  <Text className="banner-tag-text">收益翻倍</Text>
                </View>
                <Text className="banner-title">开启托管 让分身24h赚钱</Text>
                <Text className="banner-desc">自动抢单+自动生成+自动发布，不错过任何收益</Text>
                <View className="banner-btn">
                  <Text className="banner-btn-text">一键开启</Text>
                  <ChevronRight size={24} color="#6366F1" />
                </View>
              </>
            ) : (
              <>
                <View className="banner-referral-header">
                  <Gift size={32} color="#FBBF24" />
                  <Text className="banner-title-referral">{BANNER_TITLE}</Text>
                </View>
                <Text className="banner-desc-referral">{BANNER_DESC(invitedCount)}</Text>
                <View className="banner-referral-bottom">
                  <View className="referral-code-tag">
                    <Text className="referral-code-text">邀请码：{referralCode || '加载中...'}</Text>
                  </View>
                  <View className="banner-btn-referral">
                    <Text className="banner-btn-text-referral">立即邀请</Text>
                    <ChevronRight size={20} color="#FFFFFF" />
                  </View>
                </View>
              </>
            )}
          </View>
          <View className="banner-decoration">
            <View className="deco-circle circle-1" />
            <View className="deco-circle circle-2" />
            {mindClones === 0 ? (
              <Rocket size={100} color="rgba(255,255,255,0.15)" />
            ) : !allHostingEnabled ? (
              <Zap size={100} color="rgba(255,255,255,0.15)" />
            ) : (
              <Gift size={100} color="rgba(255,255,255,0.15)" />
            )}
          </View>
        </View>

        {/* ===== 订单广场板块 ===== */}
        <View className="order-square-section">
          {/* 板块标题 */}
          <View className="section-header">
            <View className="section-title-row">
              <ShoppingBag size={24} color="#6366F1" />
              <Text className="section-title">订单广场</Text>
            </View>
            <View className="section-more" onClick={() => goToPage('/package-order/pages/order-square/index')}>
              <Text className="section-more-text">查看全部</Text>
              <ChevronRight size={24} color="#9CA3AF" />
            </View>
          </View>

          {/* 平台筛选 Tab */}
          <ScrollView scrollX className="platform-scroll" enhanced showScrollbar={false}>
            <View className="platform-tags">
              {platformTabs.map(tab => (
                <View
                  key={tab.key}
                  className={`platform-tag ${activePlatform === tab.key ? 'active' : ''}`}
                  onClick={() => setActivePlatform(tab.key)}
                >
                  <Text className="platform-tag-text">{tab.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* 订单列表 */}
          <View className="home-order-list">
            {ordersLoading ? (
              <View className="order-loading">
                <Text className="order-loading-text">加载中...</Text>
              </View>
            ) : orders.length > 0 ? (
              orders.slice(0, 6).map(order => {
                const platformConfig = getPlatformMeta(order.platform) || { color: '#7B3FE4', icon: '📋', name: order.platform }
                const urgencyTag = getUrgencyTag(order)
                const contentTypeTag = getContentTypeTag(order)
                const isDemo = order.isDemo

                return (
                  <View
                    key={order.id}
                    className="home-order-card"
                    onClick={() => {
                      if (isDemo) {
                        goToPage('/package-order/pages/order-square/index')
                      } else {
                        Taro.navigateTo({ url: `/package-order/pages/order-detail/index?orderId=${order.id}` })
                      }
                    }}
                  >
                    {/* 卡片顶部条 */}
                    {urgencyTag && (
                      <View className="home-card-strip" style={{ background: urgencyTag.color }} />
                    )}
                    {isDemo && (
                      <View className="home-card-strip demo-strip" />
                    )}

                    {/* 头部：平台 + 紧急 + 内容类型 */}
                    <View className="home-card-header">
                      <View className="home-card-header-left">
                        <View className="home-platform-badge" style={{ background: `${platformConfig.color}15` }}>
                          <Text className="home-platform-icon">{platformConfig.icon}</Text>
                          <Text className="home-platform-name" style={{ color: platformConfig.color }}>
                            {getPlatformLabel(order.platform)}
                          </Text>
                        </View>
                        {urgencyTag && (
                          <View className="home-urgency-badge" style={{ background: urgencyTag.bg }}>
                            <Text className="home-urgency-text" style={{ color: urgencyTag.color }}>{urgencyTag.text}</Text>
                          </View>
                        )}
                        {contentTypeTag && (
                          <View className="home-content-type-badge" style={{ background: contentTypeTag.bg }}>
                            <Text className="home-content-type-text" style={{ color: contentTypeTag.color }}>{contentTypeTag.text}</Text>
                          </View>
                        )}
                      </View>
                      <Text className="home-publish-time">{order.createdAt}</Text>
                    </View>

                    {/* 标题 + 匹配度 */}
                    <View className="home-order-title-row">
                      <Text className="home-order-title">{order.title}</Text>
                      {order.matchScore && order.matchScore >= 70 && (
                        <View className="home-match-badge" style={{ background: `${getMatchColor(order.matchScore)}15` }}>
                          <TrendingUp size={12} color={getMatchColor(order.matchScore)} />
                          <Text className="home-match-text" style={{ color: getMatchColor(order.matchScore) }}>
                            {order.matchScore}%
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* 描述 */}
                    {order.description && (
                      <Text className="home-order-desc">{order.description}</Text>
                    )}

                    {/* 信息行：交付周期 + 已接单 + 发布者 */}
                    <View className="home-order-info-row">
                      <View className="home-info-item">
                        <Clock size={12} color="#94A3B8" />
                        <Text className="home-info-text">{order.deliveryDays}天交付</Text>
                      </View>
                      {order.acceptCount > 0 && (
                        <View className="home-info-item">
                          <Users size={12} color="#94A3B8" />
                          <Text className="home-info-text">{order.acceptCount}人已接</Text>
                        </View>
                      )}
                      <View className="home-info-item">
                        <Text className="home-info-text">{order.publisher?.nickname || '匿名'}</Text>
                      </View>
                    </View>

                    {/* 标签 + 收益 + 接单按钮 */}
                    <View className="home-card-bottom">
                      <View className="home-card-bottom-left">
                        {order.requirements.slice(0, 2).map((req, idx) => (
                          <View key={idx} className="home-req-tag">
                            <Text className="home-req-tag-text">{req}</Text>
                          </View>
                        ))}
                        <View className="home-earn-tag">
                          <Coins size={14} color="#F59E0B" />
                          <Text className="home-earn-value">¥{order.estimatedEarning}</Text>
                        </View>
                      </View>
                      <View onClick={(e) => e.stopPropagation()}>
                        <View
                          className={`home-accept-btn ${isDemo ? 'demo' : ''} ${acceptedOrderIds[order.id] ? 'accepted' : ''} ${acceptingOrderIds[order.id] ? 'loading' : ''}`}
                          onClick={() => handleAcceptOrder(order.id)}
                        >
                          <Text className="home-accept-btn-text">
                            {isDemo ? '去接单' : (acceptedOrderIds[order.id] ? '已接单' : (acceptingOrderIds[order.id] ? '接单中' : '接单'))}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })
            ) : (
              <View className="home-order-empty">
                <ShoppingBag size={48} color="#CBD5E1" />
                <Text className="home-order-empty-text">暂无可接订单</Text>
                <Text className="home-order-empty-hint">切换平台看看或稍后再来</Text>
              </View>
            )}
          </View>
        </View>

        {/* 底部留白 */}
        <View className="bottom-spacer" />
      </ScrollView>

      {/* 订单通知弹窗 */}
      {showOrderModal && orderModalData && (
        <View className="order-modal-overlay" onClick={handleOrderDismiss}>
          <View className="order-modal" onClick={(e) => e.stopPropagation()}>
            <View className="order-modal-header">
              <Text className="order-modal-title">新订单通知</Text>
              <View className="order-modal-close" onClick={handleOrderDismiss}>
                <Text className="order-modal-close-text">×</Text>
              </View>
            </View>

            <View className="order-modal-content">
              <View className="order-modal-platform" style={{ background: orderModalData.platformColor }}>
                {orderModalData.platform}
              </View>
              <Text className="order-modal-order-title">{orderModalData.title}</Text>

              <View className="order-modal-info">
                <View className="order-modal-info-item">
                  <Text className="order-modal-info-label">预算</Text>
                  <Text className="order-modal-info-value" style={{ color: '#F59E0B' }}>{orderModalData.budget}</Text>
                </View>
                <View className="order-modal-info-item">
                  <Text className="order-modal-info-label">截止</Text>
                  <Text className="order-modal-info-value" style={{ color: '#EF4444' }}>{orderModalData.deadline}</Text>
                </View>
              </View>
            </View>

            <View className="order-modal-actions">
              <View className="order-modal-btn dismiss" onClick={handleOrderDismiss}>
                <Text className="order-modal-btn-text dismiss">暂不接单</Text>
              </View>
              <View className="order-modal-btn accept" onClick={handleOrderAccept}>
                <Text className="order-modal-btn-text accept">立即接单</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 通知弹窗 */}
      {showModal && currentNotification && (
        <View className="notification-modal-overlay" onClick={closeModal}>
          <View className="notification-modal" onClick={(e) => e.stopPropagation()}>
            <View className="notification-modal-header">
              <Text className="notification-modal-title">{currentNotification.title}</Text>
              <View className="notification-modal-close" onClick={closeModal}>
                <Text className="notification-modal-close-text">×</Text>
              </View>
            </View>
            <View className="notification-modal-content">
              <Text className="notification-modal-text">{currentNotification.content}</Text>
              <Text className="notification-modal-time">
                {new Date(currentNotification.createdAt).toLocaleString()}
              </Text>
            </View>
            <View className="notification-modal-footer">
              <View className="notification-modal-btn" onClick={closeModal}>
                <Text className="notification-modal-btn-text">我知道了</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default Index
