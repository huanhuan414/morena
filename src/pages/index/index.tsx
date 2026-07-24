import React, { useEffect, useState, useCallback, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Settings, Users, FileText, TrendingUp, Sparkles, Target, ArrowRight, CircleDollarSign, Eye, ShoppingBag, ChevronRight, Gift, Clock, CircleCheckBig, ChevronDown, ImagePlus, MessagesSquare, Video, Shirt, Hand } from 'lucide-react-taro'
import { Network } from '@/network'
import { BANNER_TITLE, BANNER_DESC } from '@/constants/referral-rewards'
import { PLATFORM_UI_ORDER, getPlatformLabel, getPlatformMeta, canonicalizePlatform } from '@/constants/publish-platform'
import { useUserStore } from '@/stores/user'
import { useNotifications } from '@/hooks/useNotifications'
import { Avatar as UiAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { WeappButton } from '@/components/ui/weapp-button'
import { getCapsuleButtonBottom } from '@/utils/safe-area'
import { APP_VERSION } from '@/constants/app'
import supportAgentIcon from '@/assets/support_agent.png'
import './index.css'

const getMiniProgramVersionParams = () => {
  try {
    const miniProgram = Taro.getAccountInfoSync?.()?.miniProgram
    return {
      version: miniProgram?.version || APP_VERSION,
      envVersion: miniProgram?.envVersion || '',
    }
  } catch {
    return { version: APP_VERSION, envVersion: '' }
  }
}
interface OrderItem {
  id: string
  title: string
  description: string
  platform: string
  rawPlatform?: string
  platforms: string[]
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
  publisher: { nickname: string; rating: number; avatar?: string }
  matchScore?: number
  createdAt: string
  avatarCount: number
  quantityPerAvatar: number
  urgency: 'urgent' | 'high' | 'normal' | 'low'
  isAcceptedByMe?: boolean
  acceptedAvatarId?: string
  requestId?: string
  acceptRegions?: string[]  // 接单区域限制
  acceptanceTimeout?: number  // 接单超时时间（小时）
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
  reviewDays: string  // 格式化后的时间，如 "1天" 或 "12小时"
  resolve: (confirmed: boolean) => void
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
  const [enabledMenuKeys, setEnabledMenuKeys] = useState<string[]>([])
  const { setAvatarId, isLoggedIn, userInfo } = useUserStore(state => state)

  // 计算实际收益范围
  const calcEarningRange = (customBasePrice: number) => {
    const priceCents = Math.round(customBasePrice * 100)
    const feeAmount = Math.round((priceCents * (1 - earningPlanInfo.freeRate))) / 100
    return feeAmount
    // const minEarning = (customBasePrice * (1 - feeRateRange.max)).toFixed(2)
    // const maxEarning = (customBasePrice * (1 - feeRateRange.min)).toFixed(2)
    // return `¥${minEarning} ~ ¥${maxEarning}`
  }

  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderModalData, setOrderModalData] = useState<any>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [avatarPickerData, setAvatarPickerData] = useState<{ avatars: any[], resolve: ((idx: number) => void) | null }>({ avatars: [], resolve: null })
  const [acceptConfirmData, setAcceptConfirmData] = useState<AcceptConfirmData | null>(null)
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

  const normalizeRate = (value: any, fallback = 0.20) => {
    const rate = Number(value)
    return Number.isFinite(rate) && rate >= 0 ? rate : fallback
  }

  const calcNetAmount = (amount: number, rate: number) => {
    const cents = Math.round(Number(amount || 0) * 100)
    const baseCents = Math.round(cents * (1 - rate))
    return baseCents / 100
  }

  const netAmount = (amount: number, rate: number) => {
    const cents = Math.round(Number(amount || 0) * 100)
    const baseCents = Math.round(cents * rate)
    return baseCents / 100
  }

  const formatMoney = (amount: number) => {
    return `¥${Number(amount || 0).toFixed(2)}`
  }

  const getPlanRate = (plans: any[], planId: string, fallback: number) => {
    const plan = plans.find((item) => (item.id || item.planId || item.plan_id) === planId)
    return normalizeRate(plan?.platformFeeRate || plan?.platform_fee_rate, fallback)
  }

  const getPlanName = (plans: any[], planId: string, fallback: string) => {
    const plan = plans.find((item) => (item.id || item.planId || item.plan_id) === planId)
    return plan?.name || plan?.planName || plan?.plan_name || fallback
  }

  // 格式化审核时间（小时转天数）
  const formatReviewTime = (hours: number): string => {
    const safeHours = Math.max(Number(hours || 0), 0)
    if (safeHours >= 24) {
      return `${Math.ceil(safeHours / 24)}天`
    }
    return `${Math.ceil(safeHours)}小时`
  }

  const formatEarningAmount = (amount: number): string => Number(amount || 0).toFixed(2)

  const formatPlanEarningRatio = (rate: number, freeRate: number): string => {
    const diff = Number(freeRate || 0) - Number(rate || 0)
    if (Math.abs(diff) < 0.000001) return ''
    return `(+${Math.round((1 + diff) * 100)}%)`
  }

  const fetchEarningPlanInfo = useCallback(async (): Promise<EarningPlanInfo> => {
    const userId = useUserStore.getState().userInfo?.id
    let currentPlanId = 'plan_free'
    let currentPlanName = '免费版'
    let currentRate = 0.20
    let plans: any[] = []

    if (userId) {
      const subRes = await Network.request({
        url: `/api/subscription/status?userId=${userId}`,
        method: 'GET',
      })
      const plan = subRes?.data?.data?.plan
      currentPlanId = plan?.id || 'plan_free'
      currentPlanName = plan?.name || '免费版'
      currentRate = normalizeRate(plan?.platformFeeRate || plan?.platform_fee_rate, 0.20)
    }

    try {
      const plansRes = await Network.request({ url: '/api/subscription/plans' })
      plans = plansRes?.data?.data || []
    } catch (err) {
      console.error('获取会员价格失败:', err)
    }

    const nextInfo = {
      currentPlanId,
      currentPlanName,
      currentRate,
      freeName: getPlanName(plans, 'plan_free', '免费版'),
      freeRate: getPlanRate(plans, 'plan_free', 0.20),
      basicName: getPlanName(plans, 'plan_basic', '基础版'),
      basicRate: getPlanRate(plans, 'plan_basic', 0.15),
      proName: getPlanName(plans, 'plan_pro', '专业版'),
      proRate: getPlanRate(plans, 'plan_pro', 0.10),
      enterpriseName: getPlanName(plans, 'plan_enterprise', '企业版'),
      enterpriseRate: getPlanRate(plans, 'plan_enterprise', 0.15),
    }
    setEarningPlanInfo(nextInfo)
    return nextInfo
  }, [])

  const showAcceptConfirm = (data: Omit<AcceptConfirmData, 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      setAcceptConfirmData({ ...data, resolve })
    })
  }


  // 静默时间状态
  const [silenceUntil, setSilenceUntil] = useState<string | null>(null)

  // 格式化静默时间
  const formatSilenceDuration = (ms: number) => {
    if (ms < 60 * 1000) {
      return `${Math.round(ms / 1000)}秒`
    } else if (ms < 60 * 60 * 1000) {
      return `${Math.round(ms / (60 * 1000))}分钟`
    } else if (ms < 24 * 60 * 60 * 1000) {
      return `${Math.round(ms / (60 * 60 * 1000))}小时`
    } else {
      const days = Math.round(ms / (24 * 60 * 60 * 1000))
      return `${days}天`
    }
  }

  // 获取抽成比例范围
  const fetchFeeRateRange = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/subscription/plans' })
      if (res.data?.code === 200 && res.data?.data?.length > 0) {
        const rates = res.data.data.map((p: any) => {
          // 支持下划线和驼峰两种格式，默认为 0.20（免费版抽成）
          const rate = p.platform_fee_rate || p.platformFeeRate || 0.20
          return Number(rate)
        }).filter(r => r > 0)

        if (rates.length > 0) {
          const minRate = Math.min(...rates)
          const maxRate = Math.max(...rates)
          setFeeRateRange({ min: minRate, max: maxRate })
        }
      }
    } catch (err) {
      console.error('获取抽成比例失败:', err)
    }
  }, [])

  //#region 通知相关状态
  // const { unreadCount, showModal, currentNotification, closeModal } = useNotifications({
  //   pollInterval: 10000
  // })

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [feeRateRange, setFeeRateRange] = useState<{ min: number; max: number }>({ min: 0.05, max: 0.20 })

  // ===== 订单广场相关状态 =====
  const [activePlatform, setActivePlatform] = useState('all')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [acceptingOrderIds, setAcceptingOrderIds] = useState<Record<string, boolean>>({})
  const [, setOrderPage] = useState(1)
  const [, setOrderTotal] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const ordersFetchInFlightRef = useRef(false)
  const lastOrdersFetchAtRef = useRef(0)
  const skipNextDidShowRefreshRef = useRef(false)

  const scrollToTop = () => {
    Taro.createSelectorQuery()
      .select('#home-content-scroll')
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

  const platformTabs = [
    { key: 'all', label: '全部' },
    ...PLATFORM_UI_ORDER.map((key) => ({ key, label: getPlatformLabel(key) }))
      .filter((item) => {
        const meta = getPlatformMeta(item.key)
        return Array.isArray(meta?.requirements)
      })
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
      const pageSize = 20
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
          acceptRegions: Array.isArray(o.acceptRegions || o.accept_regions) ? (o.acceptRegions || o.accept_regions) : [],
          acceptanceTimeout: Number(o.acceptanceTimeout || o.acceptance_timeout || 0)
        }))
        setOrders(prev => {
          const next = append ? [...prev, ...mapped] : mapped
          return next
        })
        setOrderTotal(total)
        setOrderPage(page)
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
            rawPlatform: item.rawPlatform || '',
            platform: platformName,
            platformColor: getPlatformColor(platformName),
            title: item.title || '新订单',
            budget: item.expectedEarnings ? `¥${item.expectedEarnings}` : '待定',
            deadline: '长期有效',
            acceptTimeoutText: item.acceptTimeoutText || '',

          })
          setShowOrderModal(true)
        }
      }
    } catch (err) {
      console.error('获取待接订单失败:', err)
    }
  }, [dismissedOrderIds, showOrderModal, orderModalData])

  //接单
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
      // 1. 获取分身列表
      const avatarRes = await Network.request({ url: '/api/avatar' })
      if (avatarRes.data?.code !== 200 || !avatarRes.data?.data?.length) {
        Taro.showToast({ title: '请先创建分身', icon: 'none' })
        return
      }
      const avatars = avatarRes.data.data

      // 2. 调用后端接口检查名额是否已满
      const quotaRes = await Network.request({
        url: `/api/order-dispatch/${orderId}/quota`,
        method: 'GET'
      })
      if (quotaRes.data?.code === 200 && quotaRes.data?.data?.isFull) {
        Taro.showToast({ title: quotaRes.data?.message || '名额已满，请抢其他订单', icon: 'none' })
        return
      }

      // 3. 获取用户会员信息和抽成比例
      const userId = useUserStore.getState().userInfo?.id
      let planId = 'plan_free'
      let planName = '免费版'
      let platformFeeRate = 0.20
      let planInfo = earningPlanInfo
      // 直接使用之前获取的会员信息（页面加载时已获取）
      if (userId) {
        planId = planInfo?.currentPlanId || 'plan_free'
        planName = planInfo?.currentPlanName || '免费版'
        platformFeeRate = Number(planInfo?.currentRate || 0.20)
      }

      // 3. 弹出抽成确认框
      const orderPrice = Number(orderInfo?.customBasePrice || 0)
      const isFreePlan = planId === 'plan_free'
      const targetPlanName = planId === 'plan_free' ? earningPlanInfo.basicName : planId === 'plan_basic' ? earningPlanInfo.proName : planId === 'plan_pro' ? earningPlanInfo.enterpriseName : earningPlanInfo.enterpriseName
      const targetRate = planId === 'plan_free' ? earningPlanInfo.basicRate : planId === 'plan_basic' ? earningPlanInfo.proRate : planId === 'plan_pro' ? earningPlanInfo.enterpriseRate : earningPlanInfo.enterpriseRate
      const remainingSlots = Math.max(0, Number(orderInfo?.avatarCount || 1) - Number(orderInfo?.acceptCount || 0))
      const maxSubsidy = netAmount(orderPrice, Math.max(0, earningPlanInfo.freeRate - earningPlanInfo.enterpriseRate))
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


      // 5. 选择分身
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

      // 6. 检查订单区域限制
      if (orderInfo?.acceptRegions && orderInfo.acceptRegions.length > 0) {
        const selectedAvatar = avatars.find((a: any) => a.id === avatarIdToUse)
        const locationText = selectedAvatar?.locationText || selectedAvatar?.location_text || ''
        const parts = locationText.split(/[省市区县]/)
        const avatarProvince = parts.length > 0 ? parts[0].trim() : ''

        const isInRegion = avatarProvince && orderInfo.acceptRegions.some(region =>
          avatarProvince.includes(region) || region.includes(avatarProvince)
        )

        if (!isInRegion) {
          Taro.showModal({
            title: '无法接单',
            content: `该订单限制了接单区域：【${orderInfo.acceptRegions.join('、')}】\n您的分身地址【${avatarProvince || ''}】不在这些区域内，无法接单`,
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }
      }

      setAvatarId(avatarIdToUse)

      // 7. 调用后端接单接口
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
        Taro.showToast({
          title: res.data?.message
            || '接单失败', icon: 'none'
        })
      }
    } catch (err) {
      console.error('接单失败:', err)
      Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
    } finally {
      setAcceptingOrderIds(prev => ({ ...prev, [orderId]: false }))
    }
  }

  const getPlatformName = (platform: string): string => {
    // 使用 publish-platform 中的 getPlatformLabel
    return getPlatformLabel(platform)
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
        // 获取静默信息
        if (d.silenceUntil) {
          setSilenceUntil(d.silenceUntil)
        }
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

  const fetchMenuConfig = async () => {
    try {
      const res = await Network.request({ url: '/api/menu-feature/enabled', data: getMiniProgramVersionParams() })
      if (res.data?.code === 200) {
        setEnabledMenuKeys(res.data.data || [])
      }
    } catch (error) {
      console.error('获取菜单配置失败:', error)
      // 如果获取失败，默认显示所有菜单
      setEnabledMenuKeys(['subscription_center', 'coin_center', 'earning_center', 'skill_square', 'order_publish', 'earnings_wall', 'about_us'])
    }
  }

  useDidShow(() => {
    if (skipNextDidShowRefreshRef.current) {
      skipNextDidShowRefreshRef.current = false
      return
    }

    loadUserFromStorage().then(() => {
      fetchStats()
      fetchGrowthCampaign()
      fetchAssignedOrders()
      fetchOrders()
      fetchFeeRateRange()
      fetchEarningPlanInfo()
      fetchMenuConfig()
      checkAvatarReminder()
    }).catch(err => console.error('刷新数据失败:', err))
  })

  const checkAvatarReminder = async () => {
    if (!isLoggedIn || !userInfo?.id) return

    try {
      // 检查用户是否有分身及是否已领取奖励
      const res = await Network.request({
        url: '/api/avatar/has-avatar',
        method: 'GET'
      })

      if (res.data?.code === 200) {
        const { hasAvatar, firstAvatarGifted } = res.data.data || {}

        // 只有当用户没有分身且未领取过奖励时才弹窗提醒
        if (!hasAvatar && !firstAvatarGifted) {
          const modalRes = await Taro.showModal({
            title: '创建分身领取奖励！',
            content: '完成分身创建，送100积分，解锁技能广场新玩法，享永久免费接单权益。',
            confirmText: '去创建',
            cancelText: '稍后',
            showCancel: true
          })

          if (modalRes.confirm) {
            Taro.navigateTo({ url: '/package-avatar/pages/avatar-create/index' })
          }
        }
      }
    } catch (err) {
      console.error('[Index] 检查分身状态失败:', err)
    }
  }

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
    if (!allHostingEnabled) return '分身添加技能，自动创收'
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

  // 立即接单
  const handleOrderAccept = async () => {
    if (!orderModalData?.id || !orderModalData?.avatarId) return

    const orderId = orderModalData.id
    const avatarId = orderModalData.avatarId

    try {
      // 1. 检查订单区域限制
      if (orderModalData.acceptRegions && orderModalData.acceptRegions.length > 0) {
        const locationText = orderModalData.locationText || ''
        const parts = locationText.split(/[省市区县]/)
        const avatarProvince = parts.length > 0 ? parts[0].trim() : ''
        const isInRegion = avatarProvince && orderModalData.acceptRegions.some(region =>
          avatarProvince.includes(region) || region.includes(avatarProvince)
        )
        if (!isInRegion) {
          Taro.showModal({
            title: '无法接单',
            content: `该订单限制了接单区域：【${orderModalData.acceptRegions.join('、')}】\n您的分身地址【${avatarProvince || locationText}】不在这些区域内，无法接单`,
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }
      }

      // 2. 调用接单接口
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${avatarId}/accept/${orderId}/${orderModalData.dispatchId}`,
        method: 'POST',
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '接单成功，正在生成内容', icon: 'success' })
        const result = res.data?.data || {}
        const nextRequestId = result.requestId || ''
        const nextAvatarId = result.avatarId || avatarId
        const nextOrderId = result.orderId || orderId

        const query = [
          `orderId=${encodeURIComponent(nextOrderId)}`,
          `avatarId=${encodeURIComponent(nextAvatarId)}`,
          nextRequestId ? `requestId=${encodeURIComponent(nextRequestId)}` : '',
        ].filter(Boolean).join('&')
        const targetPage = orderModalData.rawPlatform === 'special' ? 'order-accept-task' : 'order-processing'

        setTimeout(() => {
          Taro.navigateTo({
            url: `/package-order/pages/${targetPage}/index?${query}`
          })
        }, 500)

        // 关闭弹窗并记录已忽略
        setShowOrderModal(false)
        const newDismissed = new Set(dismissedOrderIds)
        newDismissed.add(orderId)
        setDismissedOrderIds(newDismissed)
        try {
          Taro.setStorageSync('dismissed_order_ids', JSON.stringify([...newDismissed]))
        } catch { }
      } else {
        Taro.showToast({ title: res.data?.message || '接单失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[新订单通知] 接单失败:', error)
      Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
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
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index?redirect=/pages/index/index' })
      return
    }
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
      } else if (res.data?.data?.type === 'hosting_limit') {
        Taro.showModal({
          title: '托管数量已达上限',
          content: res.data.msg || '当前套餐托管数量已达上限，请升级套餐',
          confirmText: '去升级',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
            }
          }
        })
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
              {/* 静默时间显示 */}
              {silenceUntil && new Date(silenceUntil).getTime() > Date.now() && (() => {
                const remainingMs = new Date(silenceUntil).getTime() - Date.now()
                return (
                  <View className="silence-badge">
                    <Text className="silence-badge-text">静默中 · {formatSilenceDuration(remainingMs)}不能接单</Text>
                  </View>
                )
              })()}
            </View>
          </View>
          <View className="header-right">
            <WeappButton
              className="icon-btn"
              openType="contact"
              hoverClass="none"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                lineHeight: 'normal',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Image className="support-agent-icon" src={supportAgentIcon} mode="aspectFit" />
            </WeappButton>
            <View className="icon-btn" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/settings/index' })}>
              <Settings size={32} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>

      {/* 主内容区 */}
      <ScrollView
        id="home-content-scroll"
        scrollY
        className="content"
        enhanced
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={isRefreshing}
        onRefresherRefresh={handleRefresh}
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
          {/* 收益高亮 - 仅当收益中心菜单启用时显示 */}
          {totalEarnings > 0 && (
            <View className="earning-highlight" onClick={() => (enabledMenuKeys.length === 0 || enabledMenuKeys.includes('earning_center')) && goToPage('/package-profile/pages/earning-center/index')}>
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
            <View className="stat-item" onClick={() => goToPage('/package-order/pages/order-square/index?mode=available')}>
              <View className="stat-icon-small" style={{ background: '#FFFBEB' }}>
                <ShoppingBag size={28} color="#F59E0B" />
                <Badge className="stat-count-badge stat-count-badge-pending">
                  <Text className="stat-count-text">{pendingOrders > 99 ? '99+' : pendingOrders}</Text>
                </Badge>
              </View>
              <Text className="stat-label-small">接单赚钱</Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-avatar/pages/generated-content/index')}>
              <View className="stat-icon-small" style={{ background: '#ECFDF5' }}>
                <FileText size={28} color="#10B981" />
                <Badge className="stat-count-badge stat-count-badge-orders">
                  <Text className="stat-count-text">{generatedContents > 99 ? '99+' : generatedContents}</Text>
                </Badge>
              </View>
              <Text className="stat-label-small">我的订单</Text>
            </View>
            <View
              className="stat-item"
              onClick={() => goToPage(`/package-skill/pages/skill-try/index?skillId=image_gen&skillName=${encodeURIComponent('图片生成')}&category=image`)}
            >
              <View className="stat-icon-small" style={{ background: '#ECFEFF' }}>
                <ImagePlus size={28} color="#8B5CF6" />
              </View>
              <Text className="stat-label-small">图片生成</Text>
            </View>
            <View
              className="stat-item"
              onClick={() => goToPage(`/package-skill/pages/wechat-mp-article/index?skillId=content_writing&skillName=${encodeURIComponent('公众号文章')}`)}
            >
              <View className="stat-icon-small" style={{ background: '#F5F3FF' }}>
                <MessagesSquare size={28} color="#10B981" />
              </View>
              <Text className="stat-label-small">公众号图文</Text>
            </View>
            <View
              className="stat-item"
              onClick={() => goToPage(`/package-skill/pages/skill-try/index?skillId=video_gen&skillName=${encodeURIComponent('视频生成')}&category=video`)}
            >
              <View className="stat-icon-small" style={{ background: '#FDF2F8' }}>
                <Video size={28} color="#FB7185" />
              </View>
              <Text className="stat-label-small">视频生成</Text>
            </View>
            <View
              className="stat-item"
              onClick={() => goToPage(`/package-skill/pages/fashion-makeover/index?skillId=fashion_advice&skillName=${encodeURIComponent('衣品改造')}`)}
            >
              <View className="stat-icon-small" style={{ background: '#FFF1F2' }}>
                <Shirt size={28} color="#F59E0B" />
              </View>
              <Text className="stat-label-small">衣品改造</Text>
            </View>
            <View
              className="stat-item"
              onClick={() => goToPage(`/package-skill/pages/palm-reading/index?skillId=palm_reading&skillName=${encodeURIComponent('看手相')}`)}
            >
              <View className="stat-icon-small" style={{ background: '#ECFDF5' }}>
                <Hand size={28} color="#7C3AED" />
              </View>
              <Text className="stat-label-small">看手相</Text>
            </View>
            <View
              className="stat-item"
              onClick={() => (enabledMenuKeys.length === 0 || enabledMenuKeys.includes('earning_center')) && goToPage('/package-profile/pages/earning-center/index')}
            >
              <View className="stat-icon-small" style={{ background: '#FDF2F8' }}>
                <CircleDollarSign size={28} color="#EC4899" />
              </View>
              <Text className="stat-label-small">收益中心</Text>
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

        {/* 邀请好友Banner */}
        <View
          className="banner"
          onClick={() => {
            goToPage('/package-profile/pages/referral-center/index')
          }}
        >
          <View className="banner-bg" />
          <View className="banner-content">
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
          </View>
          <View className="banner-decoration">
            <View className="deco-circle circle-1" />
            <View className="deco-circle circle-2" />
            <Gift size={100} color="rgba(255,255,255,0.15)" />
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
          <View className="platform-tab-filter">
            <View className="platform-tab-scroll">
              {platformTabs.map(tab => (
                <View
                  key={tab.key}
                  className={`platform-tab-item ${activePlatform === tab.key ? 'active' : ''}`}
                  onClick={() => setActivePlatform(tab.key)}
                >
                  <Text className={`platform-tab-text ${activePlatform === tab.key ? 'active' : ''}`}>{tab.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 订单列表 - 待接订单风格卡片 orders.length=${orders.length} */}
          <View className="home-order-list">
            {ordersLoading && orders.length === 0 ? (
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
                {orderModalData.acceptTimeoutText && (
                  <View className="order-modal-info-item">
                    <Text className="order-modal-info-label">接单截止</Text>
                    <Text className="order-modal-info-value" style={{ color: '#EF4444' }}>{orderModalData.acceptTimeoutText}</Text>
                  </View>
                )}
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
      {/* {showModal && currentNotification && (
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
      )} */}

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
