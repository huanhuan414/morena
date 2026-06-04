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
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)

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


  useDidShow(() => {
    fetchOrders()
  })

  // 切换时重新获取订单
  useEffect(() => {
    fetchOrders()
  }, [activePlatform])

  // 滚动监听（只用于显示按钮）
  const handleScroll = (e: any) => {
    const currentScrollTop = e.detail.scrollTop
    setShowBackToTop(currentScrollTop > 300)
  }
  // 回到顶部（通过改变 scrollTop 值触发滚动）
  const scrollToTop = () => {
    setScrollTop(prev => prev === 0 ? 0.001 : 0)
  }
  // 切换平台并回到顶部
  const handlePlatformChange = (platform: string) => {
    setActivePlatform(platform)
    setScrollTop(prev => prev === 0 ? 0.001 : 0)
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
        scrollTop={scrollTop}
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
                          {deadlineInfo?.text === '已截止' ? (
                            <>
                              <Text className="po-btn-label po-btn-label-primary">已截止</Text>
                            </>
                          ) : acceptingOrderIds[order.id] ? (
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
      {showBackToTop && (
        <View className="back-to-top" onClick={scrollToTop}>
          <ArrowUp size={20} color="#fff" />
        </View>
      )}
    </View>
  )
}

export default Index
