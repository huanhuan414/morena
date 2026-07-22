/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState, useCallback, useRef } from 'react'
import Taro, { useDidShow, navigateBack } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Users, ArrowLeft, ArrowUp, Sparkles, ShoppingBag, ChevronRight, Clock, CircleCheckBig, ChevronDown } from 'lucide-react-taro'
import { Network } from '@/network'
import { PLATFORM_UI_ORDER, getPlatformLabel, getPlatformMeta, canonicalizePlatform } from '@/constants/publish-platform'
import { useUserStore } from '@/stores/user'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

interface OrderItem {
  id: string
  title: string
  description: string
  platform: string
  platforms: string[]
  rawPlatform?: string
  estimatedEarning: number
  budget: number
  customBasePrice: number  // 自定义基础费用
  avatarCountRaw: number
  deliveryDays: number
  acceptCount: number
  requirements: any
  targetAudience: string
  priority: number
  deadline: string | null
  contentDeadlineAt: string | null
  contentType: string
  acceptRegions: string[]
  publisher: { nickname: string; rating: number; avatar?: string }
  matchScore?: number
  createdAt: string
  avatarCount: number
  quantityPerAvatar: number
  urgency: 'urgent' | 'high' | 'normal' | 'low'
  isAcceptedByMe?: boolean
  acceptedAvatarId?: string
  requestId?: string
  acceptanceTimeout?: number
}

interface EarningPlanInfo {
  currentPlanId: string
  currentPlanName: string
  currentRate: number
  freeName: string
  freeRate: number
  basicName: string
  basicRate: number
  proName: string
  proRate: number
  enterpriseName: string
  enterpriseRate: number
}

interface AcceptConfirmData {
  title: string
  bountyPrice: number
  currentAmount: number
  currentPlanName: string
  targetAmount: number
  targetPlanName: string
  targetDesc: string
  actionText: string
  showUpgrade: boolean
  remainingSlots: number
  reviewDays: string
  resolve: (confirmed: boolean) => void
}

const Index: React.FC = () => {
  const isAvailableMode = Taro.getCurrentInstance().router?.params?.mode === 'available'
  const [, setUserName] = useState('用户')
  const [, setMindClones] = useState(0)
  const [, setUserAvatar] = useState('')
  const [, setAllHostingEnabled] = useState(false)
  const [, setReferralCode] = useState('')
  const [, setInvitedCount] = useState(0)
  const [, setTotalEarnings] = useState(0)
  const [, setPendingOrders] = useState(0)
  const [, setGeneratedContents] = useState(0)
  const { setAvatarId } = useUserStore(state => state)

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)


  // ===== 订单广场相关状态 =====
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [avatarPickerData, setAvatarPickerData] = useState<{ avatars: any[], resolve: ((idx: number) => void) | null }>({ avatars: [], resolve: null })
  const [acceptConfirmData, setAcceptConfirmData] = useState<AcceptConfirmData | null>(null)
  const [activePlatform, setActivePlatform] = useState('all')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [acceptingOrderIds, setAcceptingOrderIds] = useState<Record<string, boolean>>({})
  const [orderPage, setOrderPage] = useState(1)
  const [orderTotal, setOrderTotal] = useState(0)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const ordersFetchInFlightRef = useRef(false)
  const lastOrdersFetchAtRef = useRef(0)
  const skipNextDidShowRefreshRef = useRef(false)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const [earningPlanInfo, setEarningPlanInfo] = useState<EarningPlanInfo>({
    currentPlanId: 'plan_free',
    currentPlanName: '免费版',
    currentRate: 0.20,
    freeName: '免费版',
    freeRate: 0.20,
    basicName: '基础版',
    basicRate: 0.15,
    proName: '专业版',
    proRate: 0.10,
    enterpriseName: '企业版',
    enterpriseRate: 0.15,
  })
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage)
  // 计算实际收益范围
  const calcEarningRange = (customBasePrice: number) => {
    const priceCents = Math.round(Number(customBasePrice || 0) * 100)
    const feeAmount = Math.round(priceCents * (1 - earningPlanInfo.freeRate)) / 100
    return feeAmount
  }

  const calcNetAmount = (amount: number, rate: number) => {
    const cents = Math.round(Number(amount || 0) * 100)
    return Math.round(cents * (1 - Number(rate || 0))) / 100
  }

  const totalBudget = orders.reduce((sum, order) => sum + Number(order.budget || 0), 0)
  const netEarnings = orders
    .filter(order => order.customBasePrice > 0)
    .map(order => calcNetAmount(order.customBasePrice, earningPlanInfo.currentRate))
  const minEarning = netEarnings.length > 0 ? Math.min(...netEarnings) : 0
  const maxEarning = netEarnings.length > 0 ? Math.max(...netEarnings) : 0


  const netAmount = (amount: number, rate: number) => {
    const cents = Math.round(Number(amount || 0) * 100)
    return Math.round(cents * Number(rate || 0)) / 100
  }

  const formatMoney = (amount: number) => {
    return `¥${Number(amount || 0).toFixed(2)}`
  }

  const getPlanName = (plans: any[], planId: string, fallback: string) => {
    const plan = plans.find((item) => (item.id || item.planId || item.plan_id) === planId)
    return plan?.name || plan?.planName || plan?.plan_name || fallback
  }

  const formatReviewTime = (hours: number): string => {
    const safeHours = Math.max(Number(hours || 0), 0)
    if (safeHours >= 24) {
      return `${Math.ceil(safeHours / 24)}天`
    }
    return `${Math.ceil(safeHours)}小时`
  }

  const showAcceptConfirm = (data: Omit<AcceptConfirmData, 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      setAcceptConfirmData({ ...data, resolve })
    })
  }

  const platformTabs = [
    { key: 'all', label: '全部' },
    ...PLATFORM_UI_ORDER.map((key) => ({ key, label: getPlatformLabel(key) }))
      .filter((item) => {
        const meta = getPlatformMeta(item.key)
        return Array.isArray(meta?.requirements)
      })
  ]

  // 精心设计的示例数据 — 刺激用户接单欲望
  const DEMO_ORDERS = [
    {
      id: 'demo_1',
      title: '小红书美妆种草笔记撰写',
      description: '需要3篇原创种草笔记，要求真实感强、配图精美，符合小红书调性。提供产品资料包。',
      budget: 420,
      platform: ['xiaohongshu'],
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
      platform: ['douyin'],
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
      platform: ['wechat_mp'],
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
      platform: ['bilibili'],
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
      platform: ['kuaishou'],
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
      platform: ['xiaohongshu'],
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
          ...(isAvailableMode ? { availableOnly: 1 } : {}),
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
          rawPlatform: o.platform || '',
          platforms: Array.isArray(o.platforms) ? o.platforms : (o.platform ? [o.platform] : []),
          budget: Number(o.budget || o.price || 0),
          customBasePrice: Number(o.customBasePrice || o.custom_base_price),
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
          isAcceptedByMe: Boolean(o.isAcceptedByMe || o.is_accepted_by_me),
          acceptedAvatarId: o.acceptedAvatarId || o.accepted_avatar_id || o.odrAvatarId || o.odr_avatar_id || '',
          requestId: o.requestId || o.request_id || '',
          acceptanceTimeout: Number(o.acceptanceTimeout || o.acceptance_timeout || 0),
          acceptRegions: Array.isArray(o.acceptRegions || o.accept_regions) ? (o.acceptRegions || o.accept_regions) : []
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
  }, [activePlatform, isAvailableMode])


  // 接单
  const buildAcceptTaskQuery = (content: any) => ([
    `orderId=${encodeURIComponent(content.orderId || content.order_id || '')}`,
    content.avatarId || content.avatar_id ? `avatarId=${encodeURIComponent(content.avatarId || content.avatar_id)}` : '',
    content.id || content.requestId || content.request_id ? `requestId=${encodeURIComponent(content.id || content.requestId || content.request_id)}` : '',
  ].filter(Boolean).join('&'))

  const handleAcceptedOrderClick = (order: OrderItem) => {
    if (order.rawPlatform !== 'special') {
      Taro.showModal({
        title: '提示',
        content: '您已接单，请到我的订单页面查看',
        cancelText: '取消',
        confirmText: '我的订单',
        success: (res) => {
          if (res.confirm) {
            skipNextDidShowRefreshRef.current = true
            Taro.navigateTo({
              url: '/package-avatar/pages/generated-content/index',
              fail: () => {
                skipNextDidShowRefreshRef.current = false
              },
            })
          }
        },
      })
      return
    }

    if (!order.requestId) {
      Taro.showToast({ title: '未找到接单记录', icon: 'none' })
      return
    }

    skipNextDidShowRefreshRef.current = true
    Taro.navigateTo({
      url: `/package-order/pages/order-accept-task/index?${buildAcceptTaskQuery({
        orderId: order.id,
        avatarId: order.acceptedAvatarId,
        requestId: order.requestId,
      })}`,
      fail: () => {
        skipNextDidShowRefreshRef.current = false
      },
    })
  }
  const handleAcceptOrder = async (orderId: string, orderInfo?: OrderItem) => {
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
      let avatars = avatarRes.data.data
      // 1. 调用后端接口检查名额是否已满
      const quotaRes = await Network.request({
        url: `/api/order-dispatch/${orderId}/quota`,
        method: 'GET'
      })
      if (quotaRes.data?.code === 200 && quotaRes.data?.data?.isFull) {
        Taro.showToast({ title: quotaRes.data?.message || '名额已满，请抢其他订单', icon: 'none' })
        return
      }

      // 2. 获取用户会员信息和抽成比例
      const userId = useUserStore.getState().userInfo?.id
      let planId = 'plan_free'
      let planName = '免费版'
      let platformFeeRate = 0.20
      const planInfo = earningPlanInfo
      if (userId) {
        planId = planInfo.currentPlanId || 'plan_free'
        planName = planInfo.currentPlanName || '免费版'
        platformFeeRate = Number(planInfo.currentRate || 0.20)
      }

      // 3. 弹出抽成确认框
      const orderPrice = Number(orderInfo?.customBasePrice || 0)
      const isFreePlan = planId === 'plan_free'
      const targetPlanName = planId === 'plan_free' ? planInfo.basicName : planId === 'plan_basic' ? planInfo.proName : planInfo.enterpriseName
      const targetRate = planId === 'plan_free' ? planInfo.basicRate : planId === 'plan_basic' ? planInfo.proRate : planInfo.enterpriseRate
      const remainingSlots = Math.max(0, Number(orderInfo?.avatarCount || 1) - Number(orderInfo?.acceptCount || 0))
      const maxSubsidy = netAmount(orderPrice, Math.max(0, planInfo.freeRate - planInfo.enterpriseRate))
      const confirmResult = await showAcceptConfirm({
        title: orderInfo?.title || '新订单',
        bountyPrice: calcEarningRange(orderPrice),
        currentAmount: calcNetAmount(orderPrice, platformFeeRate),
        currentPlanName: planName,
        targetAmount: calcNetAmount(orderPrice, targetRate),
        targetPlanName,
        targetDesc: `官方补贴${targetRate * 100}%，每单最高补贴${maxSubsidy}元`,
        actionText: isFreePlan ? '开通会员' : '升级会员',
        showUpgrade: true,
        remainingSlots,
        reviewDays: formatReviewTime(orderInfo?.acceptanceTimeout || 0),
      })

      if (!confirmResult) {
        return
      }



      // 检查订单区域限制
      if (orderInfo?.acceptRegions && orderInfo.acceptRegions.length > 0) {
        // 筛选出地址在订单限制区域内的分身
        const avatarsWithProvince = avatars.map((avatar: any) => {
          const locationText = avatar.locationText || avatar.location_text || ''
          // 提取省份（与后端逻辑一致：split(/[省市区县]/) 取第一个部分）
          const parts = locationText.split(/[省市区县]/)
          const province = parts.length > 0 ? parts[0].trim() : ''
          return { ...avatar, province }
        })

        // 篮选出地址在订单限制区域内的分身
        const matchedAvatars = avatarsWithProvince.filter((avatar: any) => {
          if (!avatar.province) return false
          return orderInfo.acceptRegions.some(region =>
            avatar.province.includes(region) || region.includes(avatar.province)
          )
        })

        if (matchedAvatars.length === 0) {
          Taro.showModal({
            title: '无法接单',
            content: `该订单限制了接单区域：${orderInfo.acceptRegions.join('、')}\n您的分身地址不在这些区域内，无法接单`,
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }

        // 使用筛选后的分身
        avatars = matchedAvatars
      }

      const isPro = planId === 'plan_pro' || planId === 'plan_enterprise'

      let avatarIdToUse: string

      if (avatars.length === 1) {
        avatarIdToUse = avatars[0].id
      } else if (isPro) {
        const selectedIndex = await new Promise<number>((resolve) => {
          setAvatarPickerData({ avatars, resolve })
          setShowAvatarPicker(true)
        })
        setShowAvatarPicker(false)
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
        const targetPage = orderInfo?.rawPlatform === 'special' ? 'order-accept-task' : 'order-processing'
        setTimeout(() => {
          Taro.navigateTo({
            url: `/package-order/pages/${targetPage}/index?${query}`
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


  const statusBarHeight = getStatusBarHeight()

  // 获取统计数据
  const fetchStats = async () => {
    try {
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
  const fetchFeeRateRange = useCallback(async () => {
    try {
      const userId = useUserStore.getState().userInfo?.id
      let currentPlanId = 'plan_free'
      let currentPlanName = '免费版'
      let currentRate = 0.20
      if (userId) {
        const subRes = await Network.request({
          url: `/api/subscription/status?userId=${userId}`,
          method: 'GET',
        })
        const plan = subRes?.data?.data?.plan
        currentPlanId = plan?.id || 'plan_free'
        currentPlanName = plan?.name || '免费版'
        currentRate = Number(plan?.platformFeeRate || plan?.platform_fee_rate || 0.20)
      }

      const res = await Network.request({ url: '/api/subscription/plans' })
      if (res.data?.code === 200 && res.data?.data?.length > 0) {
        const plans = res.data.data || []
        const freePlan = plans.find((p: any) => (p.id || p.planId || p.plan_id) === 'plan_free')
        const basicPlan = plans.find((p: any) => (p.id || p.planId || p.plan_id) === 'plan_basic')
        const proPlan = plans.find((p: any) => (p.id || p.planId || p.plan_id) === 'plan_pro')
        const enterprisePlan = plans.find((p: any) => (p.id || p.planId || p.plan_id) === 'plan_enterprise')
        setEarningPlanInfo({
          currentPlanId,
          currentPlanName,
          currentRate,
          freeName: getPlanName(plans, 'plan_free', '免费版'),
          freeRate: Number(freePlan?.platformFeeRate || freePlan?.platform_fee_rate || 0.20),
          basicName: getPlanName(plans, 'plan_basic', '基础版'),
          basicRate: Number(basicPlan?.platformFeeRate || basicPlan?.platform_fee_rate || 0.15),
          proName: proPlan?.name || proPlan?.planName || proPlan?.plan_name || '专业版',
          proRate: Number(proPlan?.platformFeeRate || proPlan?.platform_fee_rate || 0.10),
          enterpriseName: getPlanName(plans, 'plan_enterprise', '企业版'),
          enterpriseRate: Number(enterprisePlan?.platformFeeRate || enterprisePlan?.platform_fee_rate || 0.15),
        })
      }
    } catch (err) {
      console.error('获取抽成比例失败:', err)
    }
  }, [])

  useDidShow(() => {
    if (skipNextDidShowRefreshRef.current) {
      skipNextDidShowRefreshRef.current = false
      return
    }

    loadUserFromStorage().then(() => {
      fetchStats()
      fetchOrders()
      fetchFeeRateRange()
    }).catch(err => console.error('刷新数据失败:', err))
  })
  // useDidShow(() => {
  //   fetchOrders()
  // })

  // 切换时重新获取订单
  useEffect(() => {
    fetchOrders()
  }, [activePlatform])


  // 滚动监听（只用于显示按钮）
  const handleScroll = (e: any) => {
    const currentScrollTop = e.detail.scrollTop
    setShowBackToTop(currentScrollTop > 300)
  }
  // 通过增强型 ScrollView 实例执行一次性滚动，不使用受控滚动属性
  const scrollToTop = () => {
    Taro.createSelectorQuery()
      .select('#order-square-content-scroll')
      .node()
      .exec((res) => {
        const scrollView = res?.[0]?.node
        scrollView?.scrollTo?.({
          top: 0,
          animated: true,
          duration: 300,
        })
      })
  }
  // 切换平台并回到顶部
  const handlePlatformChange = (platform: string) => {
    setActivePlatform(platform)
    scrollToTop()
  }
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
  // 截止时间格式化 - 暂时禁用期限功能
  const formatDeadline = (_deadline: string | null): { color: string; text: string } | null => {
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

  const formatEarningAmount = (amount: number): string => Number(amount || 0).toFixed(2)

  const formatPlanEarningRatio = (rate: number, freeRate: number): string => {
    const diff = Number(freeRate || 0) - Number(rate || 0)
    if (Math.abs(diff) < 0.000001) return ''
    return `(+${Math.round((1 + diff) * 100)}%)`
  }

  const closeAcceptConfirm = (confirmed: boolean) => {
    if (acceptConfirmData?.resolve) {
      acceptConfirmData.resolve(confirmed)
    }
    setAcceptConfirmData(null)
  }

  const handleAcceptConfirmUpgrade = () => {
    closeAcceptConfirm(false)
    Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
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
            <Text className="header-title block">{isAvailableMode ? '可接订单' : '订单广场'}</Text>
            <Text className="header-sub block">接单赚钱，AI替你创作</Text>
          </View>
          <View className="header-right" />
        </View>

        {/* 统计概览 */}
        {true && <View className="header-stats">
          <View className="header-stat">
            <Text className="header-stat-value block">{orderTotal}+</Text>
            <Text className="header-stat-label block">在线订单</Text>
          </View>
          <View className="header-stat-divider" />
          <View className="header-stat">
            <Text className="header-stat-value block">¥{totalBudget}+</Text>
            <Text className="header-stat-label block">总预算金额</Text>
          </View>
          <View className="header-stat-divider" />
          <View className="header-stat">
            <Text className="header-stat-value block">¥{minEarning.toFixed(2)}~{maxEarning.toFixed(2)}</Text>
            <Text className="header-stat-label block">单笔收益</Text>
          </View>
        </View>}

        {/* 平台筛选 */}
        <View className="order-square-filter">
          <ScrollView className="order-square-scroll" scrollX>
            {platformTabs.map(p => (
              <View
                key={p.key}
                className={`order-square-tag ${activePlatform === p.key ? 'active' : ''}`}
                onClick={() => handlePlatformChange(p.key)}
              >
                <Text className={`order-square-tag-text ${activePlatform === p.key ? 'active' : ''}`}>{p.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
      {/* 主内容区 */}
      <ScrollView
        id="order-square-content-scroll"
        scrollY
        className="content"
        enhanced
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={isRefreshing}
        onRefresherRefresh={handleRefresh}
        onScrollToLower={handleLoadMore}
        lowerThreshold={200}
        onScroll={handleScroll}
        scrollWithAnimation
      >
        {/* ===== 订单广场板块 ===== */}
        <View className="order-square-section">
          <View className="home-order-list">
            {ordersLoading ? (
              <View className="po-loading">
                <View className="po-spinner" />
                <Text className="po-loading-text">加载中...</Text>
              </View>
            ) : orders.length > 0 ? (
              orders.map(order => {
                const urgencyTag = getUrgencyTag(order)
                const contentTypeTag = getContentTypeTag(order)
                const priorityColor = urgencyTag ? urgencyTag.color : '#6366F1'
                const isExpanded = expandedOrderId === order.id
                const earningPlans = [
                  { planId: 'plan_free', name: earningPlanInfo.freeName.replace('版', '用户'), rate: earningPlanInfo.freeRate },
                  { planId: 'plan_basic', name: earningPlanInfo.basicName.replace('版', '用户'), rate: earningPlanInfo.basicRate },
                  { planId: 'plan_pro', name: earningPlanInfo.proName.replace('版', '用户'), rate: earningPlanInfo.proRate },
                  { planId: 'plan_enterprise', name: earningPlanInfo.enterpriseName.replace('版', '用户'), rate: earningPlanInfo.enterpriseRate },
                ]
                void formatDeadline(order.deadline || order.contentDeadlineAt) // deadlineInfo (unused)

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
                          {/* 区域限制标签 */}
                          {order.acceptRegions && order.acceptRegions.length > 0 && (
                            <View className="po-region-pill" style={{ background: '#F59E0B15' }}>
                              <Text className="po-region-pill-text" style={{ color: '#F59E0B' }}>
                                📍 {order.acceptRegions.join('、')}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <ChevronDown size={16} color="#9CA3AF" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </View>
                    <View
                      className="po-card-accepted-zone"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (order.isAcceptedByMe) {
                          handleAcceptedOrderClick(order)
                        }
                        else if (!acceptingOrderIds[order.id]) {
                          handleAcceptOrder(order.id, order)
                        }
                      }}
                    >
                      {/* 标题 */}
                      <Text className="po-card-title">{order.title}</Text>

                      {/* 描述 */}
                      {order.description && (
                        <Text className="po-card-desc">{order.description}</Text>
                      )}

                      {/* 订单收益与关键指标 */}
                      <View className="po-order-summary-panel">
                        <View className="po-earning-compare">
                          {earningPlans.map((plan) => {
                            const amount = calcNetAmount(order.customBasePrice, plan.rate)
                            const isCurrent = earningPlanInfo.currentPlanId === plan.planId
                            return (
                              <View key={plan.planId} className={`po-earning-tier ${isCurrent ? 'current' : ''}`}>
                                {isCurrent && <Text className="po-earning-current-tag">当前收益</Text>}
                                <Text className="po-earning-plan-name">{plan.name}</Text>
                                <Text className="po-earning-plan-amount">收益¥{formatEarningAmount(amount)}</Text>
                                <Text className="po-earning-plan-ratio">{formatPlanEarningRatio(plan.rate, earningPlanInfo.freeRate)}</Text>
                              </View>
                            )
                          })}
                        </View>
                        <View className="po-summary-metrics">
                          <View className="po-summary-metric">
                            <View className="po-summary-metric-value-row">
                              <Clock size={18} color="#6366F1" />
                              <Text className="po-summary-metric-value">{formatReviewTime(Number(order.acceptanceTimeout || 0))}</Text>
                            </View>
                            <Text className="po-summary-metric-label">审核时间</Text>
                          </View>
                          <View className="po-summary-separator" />
                          <View className="po-summary-metric">
                            <View className="po-summary-metric-value-row">
                              <Users size={18} color="#6366F1" />
                              <Text className="po-summary-metric-value">{order.acceptCount || 0}/{order.avatarCount || 1}</Text>
                            </View>
                            <Text className="po-summary-metric-label">已接单</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* 展开详情区 */}
                    {isExpanded && (
                      <View className="po-expanded-area" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
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
                      <View
                        className="po-btn po-btn-accept"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (order.isAcceptedByMe) {
                            handleAcceptedOrderClick(order)
                          }
                          else if (!acceptingOrderIds[order.id]) {
                            handleAcceptOrder(order.id, order)
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
                            {/* <Text className="po-btn-label po-btn-label-primary">接单赚¥{order.estimatedEarning.toFixed(2)}</Text> */}
                            <Text className="po-btn-label po-btn-label-primary">立即接单</Text>
                            <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                          </>
                        )}
                      </View>
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


      <View
        className="accept-confirm-overlay"
        style={{ display: acceptConfirmData ? 'flex' : 'none' }}
        onClick={() => closeAcceptConfirm(false)}
      >
        {acceptConfirmData && (
          <View className="accept-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <View className="accept-confirm-main">
              <View className="accept-confirm-row">
                <View className="accept-confirm-title-wrap">
                  <Text className="accept-confirm-title">标题:{acceptConfirmData.title}</Text>
                </View>
                <View className="accept-confirm-amount">
                  <Text className="accept-confirm-amount-label">赏</Text>
                  <Text className="accept-confirm-amount-value">{formatMoney(acceptConfirmData.bountyPrice)}</Text>
                </View>
              </View>
              <Text className="accept-confirm-desc">
                提交后{acceptConfirmData.reviewDays}内未审核，将自动通过！
              </Text>
              <View className="accept-confirm-plan-row">
                <Text className="accept-confirm-plan-label">当前套餐：</Text>
                <Text className="accept-confirm-plan-name">{acceptConfirmData.currentPlanName}</Text>
                <Text className="accept-confirm-plan-spacer" />
                <Text className="accept-confirm-plan-label">实收：</Text>
                <Text className="accept-confirm-plan-value">{acceptConfirmData.currentAmount}元</Text>
              </View>
            </View>

            <View className="accept-confirm-member">
              <View className="accept-confirm-crown">
                <Text className="accept-confirm-crown-text">♕</Text>
              </View>
              <View className="accept-confirm-member-body">
                <View className="accept-confirm-member-title-row">
                  <Text className="accept-confirm-member-title">{acceptConfirmData.targetPlanName}价：</Text>
                  <Text className="accept-confirm-member-price">{acceptConfirmData.targetAmount.toFixed(2)}</Text>
                  <Text className="accept-confirm-member-unit">元</Text>
                </View>
                <Text className="accept-confirm-member-desc">{acceptConfirmData.targetDesc}</Text>
              </View>
              {acceptConfirmData.showUpgrade && (
                <View className="accept-confirm-upgrade" onClick={handleAcceptConfirmUpgrade}>
                  <Text className="accept-confirm-upgrade-text">{acceptConfirmData.actionText}</Text>
                </View>
              )}
            </View>

            <View className="accept-confirm-actions">
              <View className="accept-confirm-btn accept-confirm-btn-cancel" onClick={() => closeAcceptConfirm(false)}>
                <Text className="accept-confirm-btn-cancel-text">取消</Text>
              </View>
              <View className="accept-confirm-btn accept-confirm-btn-ok" onClick={() => closeAcceptConfirm(true)}>
                <Text className="accept-confirm-btn-ok-text">确认接单</Text>
              </View>
            </View>
          </View>
        )}
      </View>


      {showBackToTop && (
        <View className="back-to-top" onClick={scrollToTop}>
          <ArrowUp size={20} color="#fff" />
        </View>
      )}

      {/* 分身选择弹窗 */}
      {showAvatarPicker && avatarPickerData.avatars.length > 0 && (
        <View className="avatar-picker-overlay" onClick={() => {
          if (avatarPickerData.resolve) {
            avatarPickerData.resolve(-1)
          }
        }}
        >
          <View className="avatar-picker-modal" onClick={(e) => e.stopPropagation()}>
            <View className="avatar-picker-header">
              <Text className="avatar-picker-title">选择分身</Text>
              <View className="avatar-picker-close" onClick={() => {
                if (avatarPickerData.resolve) {
                  avatarPickerData.resolve(-1)
                }
              }}
              >
                <Text className="avatar-picker-close-text">×</Text>
              </View>
            </View>
            <ScrollView scrollY className="avatar-picker-list">
              {avatarPickerData.avatars.map((avatar: any, idx: number) => (
                <View
                  key={avatar.id}
                  className="avatar-picker-item"
                  onClick={() => {
                    if (avatarPickerData.resolve) {
                      avatarPickerData.resolve(idx)
                    }
                  }}
                >
                  <Text className="avatar-picker-item-text">{avatar.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}

export default Index
