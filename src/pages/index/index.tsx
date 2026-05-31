import React, { useEffect, useState, useCallback, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, FileText, Coins, Plus, Zap, TrendingUp, Sparkles, Target, ArrowRight, CircleDollarSign, Eye, ShoppingBag, ChevronRight, Gift, Rocket, Clock, CircleCheckBig, ChevronDown } from 'lucide-react-taro'
import { Network } from '@/network'
import { BANNER_TITLE, BANNER_DESC } from '@/constants/referral-rewards'
import { PLATFORM_UI_ORDER, getPlatformLabel, getPlatformMeta, canonicalizePlatform } from '@/constants/publish-platform'
import { useUserStore } from '@/stores/user'
import { useNotifications } from '@/hooks/useNotifications'
import { Avatar as UiAvatar } from '@/components/ui/avatar'
import { getCapsuleButtonBottom } from '@/utils/safe-area'
import './index.css'

interface OrderItem {
  id: string
  title: string
  description: string
  platform: string
  platforms: string[]
  estimatedEarning: number
  budget: number
  avatarCountRaw: number
  deliveryDays: number
  acceptCount: number
  requirements: any
  targetAudience: string
  priority: number
  deadline: string | null
  contentDeadlineAt: string | null
  contentType: string
  publisher: { nickname: string; rating: number; avatar?: string }
  matchScore?: number
  createdAt: string
  avatarCount: number
  quantityPerAvatar: number
  urgency: 'urgent' | 'high' | 'normal' | 'low'
  isAcceptedByMe?: boolean
}

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
  const [trustAllLoading, setTrustAllLoading] = useState(false)
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(() => {
    try {
      const stored = Taro.getStorageSync('dismissed_order_ids')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage)

  const { unreadCount, showModal, currentNotification, closeModal } = useNotifications({
    pollInterval: 10000
  })

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  // ===== 订单广场相关状态 =====
  const [activePlatform, setActivePlatform] = useState('all')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [acceptingOrderIds, setAcceptingOrderIds] = useState<Record<string, boolean>>({})
  const [orderPage, setOrderPage] = useState(1)
  const [, setOrderTotal] = useState(0)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const ordersFetchInFlightRef = useRef(false)
  const lastOrdersFetchAtRef = useRef(0)

  const platformTabs = [
    { key: 'all', label: '全部' },
    ...PLATFORM_UI_ORDER.map((key) => ({ key, label: getPlatformLabel(key) }))
  ]

  // 获取公开订单列表（订单广场数据）
  const fetchOrders = useCallback(async (page = 1, append = false) => {
    if (ordersFetchInFlightRef.current) return
    const now = Date.now()
    if (now - lastOrdersFetchAtRef.current < 800 && page === 1 && !append) return
    ordersFetchInFlightRef.current = true
    lastOrdersFetchAtRef.current = now
    try {
      if (page === 1) setOrdersLoading(true)
      const pageSize = 10
      const res = await Network.request({
        url: '/api/order/open',
        data: {
          page,
          pageSize,
          ...(activePlatform !== 'all' ? { platform: activePlatform } : {})
        }
      })
      if (res.data?.code === 200 && res.data?.data) {
        const apiData = res.data.data
        const rawOrders = Array.isArray(apiData) ? apiData : (apiData.items || apiData.orders || apiData.list || [])
        const total = apiData.total || rawOrders.length
        const mapped: OrderItem[] = rawOrders.map((o: any) => ({
          id: o.id,
          title: o.title || '未命名订单',
          description: o.description || '',
          platform: canonicalizePlatform(o.primaryPlatform || o.platforms?.[0] || o.platform),
          platforms: Array.isArray(o.platforms) ? o.platforms : (o.platform ? [o.platform] : []),
          budget: Number(o.budget || o.price || 0),
          avatarCountRaw: Number(o.avatarCount || o.avatar_count || 0),
          estimatedEarning: Number(o.expectedEarnings || o.expected_earnings || 0),
          deliveryDays: o.deliveryDays || o.delivery_days || 3,
          acceptCount: o.acceptCount || o.accept_count || 0,
          requirements: o.requirements || {},
          targetAudience: o.targetAudience || o.target_audience || '',
          priority: Number(o.priority || 0),
          deadline: o.deadline || null,
          contentDeadlineAt: o.contentDeadlineAt || o.content_deadline_at || null,
          contentType: o.contentType || o.content_type || 'image',
          publisher: { nickname: o.publisherNickname || o.publisher?.nickname || o.owner_nickname || '匿名', rating: o.publisher?.rating || 5.0, avatar: o.publisherAvatar || o.publisher?.avatar || '' },
          matchScore: o.matchScore || o.match_score,
          createdAt: o.createdAt || o.created_at || '',
          avatarCount: o.avatarCount || o.avatar_count || 1,
          quantityPerAvatar: o.quantityPerAvatar || o.quantity_per_avatar || 1,
          urgency: o.urgency || (o.priority >= 4 ? 'urgent' : o.priority >= 3 ? 'high' : o.priority >= 2 ? 'normal' : 'low'),
          isAcceptedByMe: Boolean(o.isAcceptedByMe || o.is_accepted_by_me)
        }))
        let nextLength = 0
        setOrders(prev => {
          const next = append ? [...prev, ...mapped] : mapped
          nextLength = next.length
          return next
        })
        setOrderTotal(total)
        setOrderPage(page)
        setHasMoreOrders(nextLength < total)
      } else {
        if (!append) setOrders([])
      }
    } catch (err) {
      console.error('获取公开订单失败:', err)
      if (!append) setOrders([])
    } finally {
      setOrdersLoading(false)
      setIsRefreshing(false)
      ordersFetchInFlightRef.current = false
    }
  }, [activePlatform])

  // 获取分配给当前用户的待接订单（仅弹窗通知用）
  const fetchAssignedOrders = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/order-dispatch/pending-requests' })
      if (res.data?.code === 200 && res.data?.data) {
        const seen = new Set<string>()
        const items = (res.data.data || []).filter((item: any) => {
          const oid = item.orderId || item.order_id
          if (!item.avatarId && !item.avatar_id) return false
          if (!item.avatarName && !item.avatar_name) return false
          if (seen.has(oid)) return false
          if (dismissedOrderIds.has(oid)) return false
          seen.add(oid)
          return true
        })

        // 弹窗通知
        if (items.length > 0 && !showOrderModal && !orderModalData) {
          const item = items[0]
          const orderId = item.orderId || item.order_id
          let platforms = item.platforms
          if (typeof platforms === 'string') {
            try { platforms = JSON.parse(platforms) } catch { platforms = [platforms] }
          }
          if (!Array.isArray(platforms)) platforms = platforms ? [platforms] : ['通用']
          const platformName = getPlatformName(platforms[0] || '通用')

          setOrderModalData({
            id: orderId,
            dispatchId: item.dispatchId || item.dispatch_id,
            avatarId: item.avatarId || item.avatar_id,
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
  }, [dismissedOrderIds, showOrderModal, orderModalData])

  // 接单
  const handleAcceptOrder = async (orderId: string) => {
    if (orderId.startsWith('demo_')) {
      Taro.showToast({ title: '示例订单，请先创建分身', icon: 'none' })
      return
    }
    if (acceptingOrderIds[orderId]) return
    setAcceptingOrderIds(prev => ({ ...prev, [orderId]: true }))
    
    try {
      const avatarRes = await Network.request({ url: '/api/avatar' })
      if (avatarRes.data?.code !== 200 || !avatarRes.data?.data?.length) {
        Taro.showToast({ title: '请先创建分身', icon: 'none' })
        return
      }
      const avatars = avatarRes.data.data
      
      const userId = useUserStore.getState().userInfo?.id
      let planId = 'plan_free'
      if (userId) {
        const subRes = await Network.request({
          url: `/api/subscription/status?userId=${userId}`,
          method: 'GET',
        })
        planId = subRes?.data?.data?.plan?.id || 'plan_free'
      }
      const isPro = planId === 'plan_pro' || planId === 'plan_enterprise'
      
      let avatarIdToUse: string
      
      if (avatars.length === 1) {
        avatarIdToUse = avatars[0].id
      } else if (isPro) {
        const avatarNames = avatars.map((a: any) => a.name)
        const selectedIndex = await new Promise<number>((resolve) => {
          Taro.showActionSheet({
            itemList: avatarNames,
            success: (r) => resolve(r.tapIndex),
            fail: () => resolve(-1),
          })
        })
        if (selectedIndex === -1) {
          return
        }
        avatarIdToUse = avatars[selectedIndex].id
      } else {
        const goToUpgrade = await new Promise<boolean>((resolve) => {
          Taro.showModal({
            title: '升级解锁分身选择',
            content: `您有${avatars.length}个分身，升级专业版后可选择特定分身接单\n\n当前将使用默认分身「${avatars[0].name}」接单`,
            confirmText: '立即升级',
            cancelText: '继续接单',
            success: (r) => resolve(r.confirm),
            fail: () => resolve(false),
          })
        })
        if (goToUpgrade) {
          Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
          return
        }
        avatarIdToUse = avatars[0].id
      }
      
      setAvatarId(avatarIdToUse)
      
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${avatarIdToUse}/accept/${orderId}`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '接单成功，正在生成内容', icon: 'success' })
        fetchOrders()
        fetchStats()
        const result = res.data?.data || {}
        const nextRequestId = result.requestId || ''
        const nextAvatarId = result.avatarId || avatarIdToUse
        const nextOrderId = result.orderId || orderId
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
      // const storedUserInfo = await Taro.getStorage({ key: 'userInfo' }).catch(() => null)
      // if (!storedUserInfo?.data?.id) {
      //   Taro.showModal({
      //     title: '提示',
      //     content: '您还未登录，是否前往登录？',
      //     confirmText: '去登录',
      //     cancelText: '取消',
      //     success: (res) => {
      //       if (res.confirm) {
      //         Taro.navigateTo({ url: '/pages/login/index' })
      //       } else {
      //         setHasCancelledLogin(true)
      //       }
      //     }
      //   })
      //   return
      // }

      const res = await Network.request({ url: '/api/user-stats/overview' })

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

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await fetchOrders(1, false)
    setIsRefreshing(false)
  }, [activePlatform])

  // 上拉加载更多
  const handleLoadMore = useCallback(() => {
    if (!ordersLoading && hasMoreOrders) {
      fetchOrders(orderPage + 1, true)
    }
  }, [ordersLoading, hasMoreOrders, orderPage, activePlatform])

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
    const storedUserInfo = Taro.getStorageSync('userInfo')
    if (!storedUserInfo?.id) {
      Taro.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(path)}` })
      return
    }
    if (path === "/pages/mind-chat/index" || path === "/pages/index/index" || path === "/pages/profile/index") {
      Taro.switchTab({ url: path })
      return
    }
    Taro.navigateTo({ url: path })
  }

  const handleOrderAccept = async () => {
    if (orderModalData?.id) {
      const orderId = orderModalData.id
      await handleAcceptOrder(orderId)
      setShowOrderModal(false)
      const newDismissed = new Set(dismissedOrderIds)
      newDismissed.add(orderId)
      setDismissedOrderIds(newDismissed)
      try {
        Taro.setStorageSync('dismissed_order_ids', JSON.stringify([...newDismissed]))
      } catch { }
      Taro.navigateTo({ url: `/package-order/pages/order-content-creation/index?orderId=${orderId}` })
    }
  }

  const handleOrderDismiss = () => {
    if (orderModalData?.id) {
      const newDismissed = new Set(dismissedOrderIds)
      newDismissed.add(orderModalData.id)
      setDismissedOrderIds(newDismissed)
      try {
        Taro.setStorageSync('dismissed_order_ids', JSON.stringify([...newDismissed]))
      } catch { }
    }
    setShowOrderModal(false)
  }

  const enableAllTrust = async () => {
    if (trustAllLoading) return
    setTrustAllLoading(true)
    try {
      const res = await Network.request({
        url: '/api/avatar/trust/all',
        method: 'PUT',
        data: { trust_enabled: true },
        dedupKey: 'avatar:trust:all:on',
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
    } finally {
      setTrustAllLoading(false)
    }
  }

  // 紧急程度标签
  // 截止时间格式化 - 暂时禁用期限功能
  const formatDeadline = (deadline: string | null) => {
    return null
  }

  const getUrgencyTag = (order: OrderItem) => {
    if (order.urgency === 'urgent') return { text: '紧急', color: '#EF4444', bg: '#FEF2F2' }
    if (order.deliveryDays <= 1) return { text: '紧急', color: '#EF4444', bg: '#FEF2F2' }
    if (order.deliveryDays <= 3) return { text: '较急', color: '#F59E0B', bg: '#FFFBEB' }
    if (order.urgency === 'high') return { text: '优先', color: '#F97316', bg: '#FFF7ED' }
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
      'image_text': { text: '图文', color: '#6366F1', bg: '#EEF2FF' },
      'image': { text: '图片', color: '#6366F1', bg: '#EEF2FF' },
      'text': { text: '纯文案', color: '#10B981', bg: '#ECFDF5' },
      'video': { text: '视频', color: '#EC4899', bg: '#FDF2F8' },
      'marketing': { text: '营销', color: '#F59E0B', bg: '#FFFBEB' },
    }
    return typeMap[order.contentType || ''] || { text: '图文', color: '#6366F1', bg: '#EEF2FF' }
  }

  return (
    <View className="index-page">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-bg" />
        <View className="header-content" style={{ paddingTop: `${getCapsuleButtonBottom() + 10}px` }}>
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
      <ScrollView
        scrollY
        className="content"
        enhanced
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={isRefreshing}
        onRefresherRefresh={handleRefresh}
        onScrollToLower={handleLoadMore}
        lowerThreshold={200}
      >

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

          {/* 订单列表 - 待接订单风格卡片 orders.length=${orders.length} */}
          <View className="home-order-list">
            {ordersLoading ? (
              <View className="po-loading">
                <View className="po-spinner" />
                <Text className="po-loading-text">加载中...</Text>
              </View>
            ) : orders.length > 0 ? (
              orders.slice(0, 6).map(order => {
                const urgencyTag = getUrgencyTag(order)
                const contentTypeTag = getContentTypeTag(order)
                const priorityColor = urgencyTag ? urgencyTag.color : '#6366F1'
                const isExpanded = expandedOrderId === order.id
                const deadlineInfo = formatDeadline(order.deadline || order.contentDeadlineAt)
                const reqTags = Array.isArray(order.requirements)
                  ? (order.requirements as string[]).slice(0, 4)
                  : (typeof order.requirements === 'object' && order.requirements?.skills)
                    ? (order.requirements.skills as string[]).slice(0, 4)
                    : []

                return (
                  <View
                    key={order.id}
                    className="po-card"
                  >
                    {/* 优先级色条 */}
                    <View className="po-priority-bar" style={{ background: priorityColor }} />

                    {/* 卡片头部：分身+匹配度 | 平台pill+类型pill+优先级pill */}
                    <View className="po-card-top" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8rpx' }}>
                        {order.matchScore != null && order.matchScore > 0 && (
                          <View className="po-avatar-match" style={{ background: `${getMatchColor(order.matchScore)}15`, color: getMatchColor(order.matchScore) }}>
                            {order.matchScore}%匹配
                          </View>
                        )}
                        <View className="po-card-badges">
                          {(order.platforms && order.platforms.length > 0 ? order.platforms : [order.platform]).map((p: string, idx: number) => {
                            const pc = getPlatformMeta(p) || { color: '#7B3FE4', icon: '📋', name: p }
                            return (
                              <View key={idx} className="po-platform-pill" style={{ background: `${pc.color}15` }}>
                                <Text className="po-platform-pill-text" style={{ color: pc.color }}>
                                  {pc.icon} {getPlatformLabel(p)}
                                </Text>
                              </View>
                            )
                          })}
                          {contentTypeTag && (
                            <View className="po-type-pill" style={{ background: contentTypeTag.bg }}>
                              <Text className="po-type-pill-text" style={{ color: contentTypeTag.color }}>{contentTypeTag.text}</Text>
                            </View>
                          )}
                          {urgencyTag && (
                            <View className="po-priority-pill" style={{ background: urgencyTag.bg }}>
                              <Text className="po-priority-pill-text" style={{ color: urgencyTag.color }}>{urgencyTag.text}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <ChevronDown size={16} color="#9CA3AF" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </View>

                    {/* 标题 */}
                    <Text className="po-card-title" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>{order.title}</Text>

                    {/* 描述 */}
                    {order.description && (
                      <Text className="po-card-desc" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>{order.description}</Text>
                    )}

                    {/* 回报卡片：收益 + 交付周期 */}
                    <View className="po-reward-card" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                      <View className="po-reward-left">
                        <View className="po-reward-amount">
                          <Text className="po-reward-symbol">¥</Text>
                          <Text className="po-reward-value">{order.estimatedEarning.toFixed(2)}</Text>
                          <Text className="po-reward-unit">/单</Text>
                        </View>
                        <Text className="po-reward-hint">预计创作收益</Text>
                      </View>
                      <View className="po-reward-divider" />
                      <View className="po-reward-right">
                        <View className="po-reward-meta">
                          <Clock size={16} color="#6366F1" />
                          <Text className="po-reward-meta-text">{order.deliveryDays}天</Text>
                        </View>
                        <Text className="po-reward-meta-sub">交付周期</Text>
                      </View>
                      <>
                        <View className="po-reward-divider" />
                        <View className="po-reward-right">
                          <View className="po-reward-meta">
                            <Users size={16} color="#6366F1" />
                            <Text className="po-reward-meta-text">{order.acceptCount || 0}/{order.avatarCount || 1}</Text>
                          </View>
                          <Text className="po-reward-meta-sub">已接单</Text>
                        </View>
                      </>
                    </View>

                    {/* 需求标签 */}
                    {reqTags.length > 0 && (
                      <View className="po-match-tags" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                        {reqTags.map((req: string, idx: number) => (
                          <Text key={idx} className="po-match-tag po-match-tag-skill">{req}</Text>
                        ))}
                      </View>
                    )}

                    {/* 目标受众行 */}
                    {order.targetAudience && (
                      <View className="po-audience-row" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                        <Users size={14} color="#9CA3AF" />
                        <Text className="po-audience-text">目标受众：{order.targetAudience}</Text>
                      </View>
                    )}

                    {/* 截止时间行 */}
                    {deadlineInfo && (
                      <View className="po-deadline-row" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                        <Clock size={14} color={deadlineInfo.color} />
                        <Text className="po-deadline-text" style={{ color: deadlineInfo.color }}>
                          截止：{deadlineInfo.text}
                        </Text>
                      </View>
                    )}

                    {/* 接单后流程（始终可见，一行展示） */}
                    <View className="po-steps">
                      <View className="po-step">
                        <View className="po-step-dot po-step-dot-1"><Text className="po-step-num">1</Text></View>
                        <Text className="po-step-text">AI自动创作</Text>
                      </View>
                      <View className="po-step-line" />
                      <View className="po-step">
                        <View className="po-step-dot po-step-dot-2"><Text className="po-step-num">2</Text></View>
                        <Text className="po-step-text">确认发布</Text>
                      </View>
                      <View className="po-step-line" />
                      <View className="po-step">
                        <View className="po-step-dot po-step-dot-3"><Text className="po-step-num">3</Text></View>
                        <Text className="po-step-text">获得收益</Text>
                      </View>
                    </View>

                    {/* 付出与回报（始终可见） */}
                    <View className="po-cost-benefit">
                      <View className="po-cb-card po-cb-cost">
                        <Text className="block po-cb-card-label">创作数量</Text>
                        <Text className="block po-cb-card-value">{order.quantityPerAvatar || 1}条/分身</Text>
                      </View>
                      <View className="po-cb-card po-cb-benefit">
                        <Text className="block po-cb-card-label">预计收益</Text>
                        <Text className="block po-cb-card-value po-cb-card-value-hl">¥{(order.estimatedEarning || 0).toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* 展开详情区 */}
                    {isExpanded && (
                      <View className="po-expanded-area">
                        {/* 创作要求 */}
                        {order.description && (
                          <View className="po-req-block">
                            <Text className="po-req-block-title">📝 创作要求</Text>
                            {order.description.split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                              const cleaned = line.replace(/^#{1,6}\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^[-*]\s+/, '• ').replace(/^\d+\.\s+/, (m) => m)
                              return <Text key={idx} className="block po-req-block-content">{cleaned}</Text>
                            })}
                          </View>
                        )}
                      </View>
                    )}

                    {/* 操作按钮 */}
                    <View className="po-card-actions">
                      {deadlineInfo?.text === '已截止' ? (
                        <View className="po-btn po-btn-disabled">
                          <>
                            <Text className="po-btn-label po-btn-label-primary">已截止</Text>
                          </>

                        </View>
                      ) : (
                        <View
                          className="po-btn po-btn-accept"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!order.isAcceptedByMe && !acceptingOrderIds[order.id]) {
                              handleAcceptOrder(order.id)
                            }
                          }}
                        >
                          {acceptingOrderIds[order.id] ? (
                            <>
                              <View className="po-btn-mini-spinner" />
                              <Text className="po-btn-label po-btn-label-primary">接单中...</Text>
                            </>
                          ) : order.isAcceptedByMe ? (
                            <>
                              <CircleCheckBig size={16} color="#fff" />
                              <Text className="po-btn-label po-btn-label-primary">已接单</Text>
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} color="#fff" />
                              <Text className="po-btn-label po-btn-label-primary">接单赚¥{order.estimatedEarning.toFixed(2)}</Text>
                              <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                            </>
                          )}
                        </View>)}
                    </View>
                  </View>
                )
              })
            ) : (
              <View className="po-empty">
                <View className="po-empty-icon">
                  <ShoppingBag size={48} color="#CBD5E1" />
                </View>
                <Text className="po-empty-title">暂无可接订单</Text>
                <Text className="po-empty-desc">切换平台看看或稍后再来</Text>
              </View>
            )}
          </View>
        </View>

        {/* 加载更多提示 */}
        {orders.length > 0 && (
          <View className="load-more-wrapper">
            {ordersLoading && orderPage > 1 ? (
              <Text className="load-more-text">加载中...</Text>
            ) : hasMoreOrders ? (
              <Text className="load-more-text">上拉加载更多</Text>
            ) : (
              <Text className="load-more-text">没有更多订单了</Text>
            )}
          </View>
        )}

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
