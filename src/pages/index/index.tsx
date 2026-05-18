import { useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, Plus, Zap, TrendingUp, Sparkles, Target, Eye, ShoppingBag, ChevronRight, Gift, Rocket, Clock, CircleCheckBig, ChevronDown, ChevronUp } from 'lucide-react-taro'
import { Network } from '@/network'
import { BANNER_TITLE, BANNER_DESC } from '@/constants/referral-rewards'
import { getPlatformLabel, getPlatformMeta, canonicalizePlatform } from '@/constants/publish-platform'
import { useUserStore } from '@/stores/user'
import { useNotifications } from '@/hooks/useNotifications'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

// 订单广场公开订单
interface SquareOrder {
  id: string
  title: string
  description: string
  platforms: string[]
  budget: number
  expectedQuantity: number
  contentType: string
  deliveryDays: number
  acceptCount: number
  requirements: string[]
  publisher: string
  createdAt: string
  priority: string
  targetAudience: string
  deadline: string
  status: string
}

// 内容类型映射
const CONTENT_TYPE_MAP: Record<string, { label: string; color: string; effort: string }> = {
  image_text: { label: '图文', color: '#3B82F6', effort: '约15分钟' },
  video: { label: '视频', color: '#8B5CF6', effort: '约20分钟' },
  text: { label: '纯文字', color: '#64748B', effort: '约10分钟' },
}

// 优先级映射
const PRIORITY_MAP: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  urgent: { label: '紧急', color: '#EF4444', icon: Zap },
  high: { label: '优先', color: '#F59E0B', icon: TrendingUp },
  normal: { label: '常规', color: '#6366F1', icon: Clock },
}

const platformTabs = [
  { key: 'all', label: '全部' },
  { key: 'douyin', label: '抖音' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'wechat_moments', label: '朋友圈' },
  { key: 'wechat_official', label: '公众号' },
  { key: 'wechat_channels', label: '视频号' },
  { key: 'bilibili', label: 'B站' },
  { key: 'kuaishou', label: '快手' },
  { key: 'zhihu', label: '知乎' },
  { key: 'toutiao', label: '今日头条' },
]

export default function IndexPage() {
  const { userInfo } = useUserStore()
  const { unreadCount } = useNotifications()
  const [statusBarHeight] = useState(getStatusBarHeight())

  // 用户分身信息
  const [mindClones, setMindClones] = useState(0)
  const [allHostingEnabled, setAllHostingEnabled] = useState(false)
  const [currentAvatarId, setCurrentAvatarId] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [invitedCount, setInvitedCount] = useState(0)

  // 订单广场
  const [orders, setOrders] = useState<SquareOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [activePlatform, setActivePlatform] = useState('all')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null)
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<Record<string, boolean>>({})

  // 增长活动
  const [growthCampaign, setGrowthCampaign] = useState<any>(null)

  useDidShow(() => {
    fetchAvatarInfo()
    fetchOrders()
    fetchGrowthCampaign()
    fetchReferralInfo()
  })

  const fetchAvatarInfo = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && Array.isArray(res.data?.data)) {
        const avatars = res.data.data
        setMindClones(avatars.length)
        setAllHostingEnabled(avatars.length > 0 && avatars.every((a: any) => a.is_hosted))
        if (avatars.length > 0) {
          setCurrentAvatarId(avatars[0].id)
        }
      }
    } catch (err) {
      console.error('获取分身信息失败:', err)
    }
  }

  const fetchReferralInfo = async () => {
    try {
      const res = await Network.request({ url: '/api/referral/code' })
      if (res.data?.code === 200) {
        setReferralCode(res.data.data?.code || '')
        setInvitedCount(res.data.data?.invitedCount || 0)
      }
    } catch (err) {
      console.error('获取邀请码失败:', err)
    }
  }

  const fetchGrowthCampaign = async () => {
    try {
      const res = await Network.request({ url: '/api/activities/campaign/active' })
      if (res.data?.code === 200 && res.data?.data) {
        setGrowthCampaign(res.data.data)
      }
    } catch (err) {
      console.error('获取活动信息失败:', err)
    }
  }

  // 获取订单广场数据
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await Network.request({
        url: '/api/order/open',
        data: activePlatform !== 'all' ? { platform: activePlatform } : {}
      })
      console.log('[首页] 订单广场 URL:/api/order/open, Method:GET, Params:', activePlatform !== 'all' ? { platform: activePlatform } : {}, 'Response:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const rawOrders = Array.isArray(res.data.data) ? res.data.data : (res.data.data.orders || res.data.data.list || [])
        const mapped: SquareOrder[] = rawOrders.map((o: any) => {
          let platforms = o.platforms || o.platform
          if (typeof platforms === 'string') {
            try { platforms = JSON.parse(platforms) } catch { platforms = [platforms] }
          }
          if (!Array.isArray(platforms)) platforms = platforms ? [platforms] : ['general']
          platforms = platforms.map(canonicalizePlatform)

          return {
            id: o.id,
            title: o.title || '未命名订单',
            description: o.description || o.requirements || '',
            platforms,
            budget: Number(o.budget || 0),
            expectedQuantity: Number(o.expected_quantity || o.expectedQuantity || 1),
            contentType: o.content_type || o.contentType || 'image_text',
            deliveryDays: o.delivery_days || o.deliveryDays || 3,
            acceptCount: o.accept_count || o.acceptCount || 0,
            requirements: Array.isArray(o.requirements) ? o.requirements : (o.tags ? o.tags.split(',').filter(Boolean) : []),
            publisher: o.publisher?.nickname || o.owner_nickname || o.publisher_name || '匿名',
            createdAt: o.created_at || o.createdAt || '',
            priority: o.priority || 'normal',
            targetAudience: o.target_audience || o.targetAudience || '',
            deadline: o.deadline || '',
            status: o.status || 'open',
          }
        })
        setOrders(mapped)
      } else {
        setOrders([])
      }
    } catch (err) {
      console.error('获取订单广场数据失败:', err)
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [activePlatform])

  const enableAllTrust = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && Array.isArray(res.data?.data)) {
        for (const avatar of res.data.data) {
          if (!avatar.is_hosted) {
            await Network.request({
              url: `/api/avatar/${avatar.id}/trust`,
              method: 'POST',
              data: { enabled: true }
            })
          }
        }
        setAllHostingEnabled(true)
        Taro.showToast({ title: '已全部开启托管', icon: 'success' })
      }
    } catch (err) {
      console.error('开启托管失败:', err)
    }
  }

  // 接单
  const handleAcceptOrder = async (orderId: string) => {
    if (acceptingOrderId || acceptedOrderIds[orderId]) return
    setAcceptingOrderId(orderId)
    try {
      const avatarId = currentAvatarId
      if (!avatarId) {
        Taro.showToast({ title: '请先创建分身', icon: 'none' })
        return
      }
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${avatarId}/accept/${orderId}`,
        method: 'POST',
      })
      console.log('[首页] 接单响应:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '接单成功', icon: 'success' })
        setAcceptedOrderIds(prev => ({ ...prev, [orderId]: true }))
      } else {
        Taro.showToast({ title: res.data?.msg || '接单失败', icon: 'none' })
      }
    } catch (err) {
      console.error('接单失败:', err)
      Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
    } finally {
      setAcceptingOrderId(null)
    }
  }

  const goToPage = (url: string) => Taro.navigateTo({ url })

  // 安全解析 requirements
  const safeParseRequirements = (req: any): string[] => {
    if (Array.isArray(req)) return req
    if (typeof req === 'string') {
      try { const p = JSON.parse(req); return Array.isArray(p) ? p : [req] } catch { return req.split(/[,，]/).filter(Boolean) }
    }
    return []
  }

  // 获取内容类型信息
  const getContentTypeInfo = (type: string) => CONTENT_TYPE_MAP[type] || CONTENT_TYPE_MAP.image_text

  // 筛选
  const filteredOrders = orders.filter(order => {
    if (activePlatform !== 'all' && !order.platforms.includes(activePlatform)) return false
    return true
  })

  return (
    <View className="index-page">
      {/* 顶部渐变Header */}
      <View className="index-header-gradient" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-grid-bg" />
        <View className="header-content">
          <View className="header-row">
            <View className="header-left">
              <Text className="header-greeting">Hi, {userInfo?.nickname || '探索者'}</Text>
              <Text className="header-sub">发现好订单，AI帮你赚</Text>
            </View>
            <View className="header-right">
              <View className="header-icon-btn" onClick={() => goToPage('/package-profile/pages/notifications/index')}>
                <Bell size={20} color="#fff" />
                {unreadCount > 0 && (
                  <View className="header-badge">
                    <Text className="header-badge-text">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </View>
              <View className="header-icon-btn" onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
                <Settings size={20} color="#fff" />
              </View>
            </View>
          </View>

          {/* 统计栏 */}
          <View className="header-stats">
            <View className="h-stat-item" onClick={() => Taro.switchTab({ url: '/pages/mind-chat/index' })}>
              <Text className="h-stat-value">{mindClones}</Text>
              <Text className="h-stat-label">AI分身</Text>
            </View>
            <View className="h-stat-divider" />
            <View className="h-stat-item" onClick={() => goToPage('/package-profile/pages/earning-center/index')}>
              <Text className="h-stat-value">{filteredOrders.length}</Text>
              <Text className="h-stat-label">可接订单</Text>
            </View>
            <View className="h-stat-divider" />
            <View className="h-stat-item" onClick={() => goToPage('/package-profile/pages/earning-center/index')}>
              <Text className="h-stat-value">¥{filteredOrders.reduce((s, o) => s + o.budget, 0).toFixed(0)}</Text>
              <Text className="h-stat-label">订单总额</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="main-scroll" scrollY>
        {/* ===== 增长活动 Banner ===== */}
        {growthCampaign && (
          <View
            className="banner"
            onClick={async () => {
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

        {/* ===== 核心操作 Banner ===== */}
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
          <View className="sq-section-header">
            <View className="sq-section-title-row">
              <ShoppingBag size={24} color="#6366F1" />
              <Text className="sq-section-title">订单广场</Text>
            </View>
            <View className="sq-section-more" onClick={() => goToPage('/package-order/pages/order-square/index')}>
              <Text className="sq-section-more-text">查看全部</Text>
              <ChevronRight size={24} color="#9CA3AF" />
            </View>
          </View>

          {/* 平台筛选 Tab */}
          <ScrollView scrollX className="sq-platform-scroll" enhanced showScrollbar={false}>
            <View className="sq-platform-tags">
              {platformTabs.map(tab => (
                <View
                  key={tab.key}
                  className={`sq-platform-tag ${activePlatform === tab.key ? 'active' : ''}`}
                  onClick={() => setActivePlatform(tab.key)}
                >
                  <Text className="sq-platform-tag-text">{tab.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* 订单列表 —— 复刻待接订单卡片样式 */}
          <View className="sq-order-list">
            {ordersLoading ? (
              <View className="sq-loading">
                <View className="sq-spinner" />
                <Text className="sq-loading-text">加载中...</Text>
              </View>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.slice(0, 10).map((order) => {
                const ctInfo = getContentTypeInfo(order.contentType)
                const isAccepting = acceptingOrderId === order.id
                const isExpanded = expandedCard === order.id
                const priorityInfo = PRIORITY_MAP[order.priority] || PRIORITY_MAP.normal
                const PriorityIcon = priorityInfo.icon
                const perUnitBudget = order.expectedQuantity > 0 ? (order.budget / order.expectedQuantity).toFixed(1) : order.budget.toFixed(1)
                const requirementList = safeParseRequirements(order.requirements)

                return (
                  <View
                    key={order.id}
                    className="sq-card"
                    onClick={() => {
                      if (!isExpanded) setExpandedCard(order.id)
                    }}
                  >
                    {/* 紧急度指示条 */}
                    {(order.priority === 'urgent' || order.priority === 'high') && (
                      <View className="sq-priority-bar" style={{ backgroundColor: priorityInfo.color }} />
                    )}

                    {/* 卡片头部：发布者 + 优先级 + 平台 + 类型 */}
                    <View className="sq-card-top">
                      <View className="sq-publisher-chip">
                        <View className="sq-publisher-dot">
                          <Text className="sq-publisher-letter">{(order.publisher || '匿').charAt(0)}</Text>
                        </View>
                        <Text className="sq-publisher-name">{order.publisher}</Text>
                        <Text className="sq-publisher-label">发布</Text>
                      </View>
                      <View className="sq-card-badges">
                        {order.priority !== 'normal' && (
                          <View className="sq-priority-pill" style={{ background: `${priorityInfo.color}15` }}>
                            <PriorityIcon size={12} color={priorityInfo.color} />
                            <Text className="sq-priority-pill-text" style={{ color: priorityInfo.color }}>{priorityInfo.label}</Text>
                          </View>
                        )}
                        {order.platforms.slice(0, 2).map(pKey => {
                          const meta = getPlatformMeta(pKey)
                          return (
                            <View key={pKey} className="sq-platform-pill" style={{ background: `${meta?.color || '#6366F1'}15` }}>
                              <Text className="sq-platform-pill-text" style={{ color: meta?.color || '#6366F1' }}>{getPlatformLabel(pKey)}</Text>
                            </View>
                          )
                        })}
                        <View className="sq-type-pill" style={{ background: `${ctInfo.color}15` }}>
                          <Text className="sq-type-pill-text" style={{ color: ctInfo.color }}>{ctInfo.label}</Text>
                        </View>
                      </View>
                    </View>

                    {/* 标题 */}
                    <Text className="sq-card-title">{order.title}</Text>

                    {/* 描述 */}
                    {order.description && (
                      <Text className="sq-card-desc" numberOfLines={isExpanded ? 100 : 2}>{order.description}</Text>
                    )}

                    {/* ===== 回报卡片 ===== */}
                    <View className="sq-reward-card">
                      <View className="sq-reward-left">
                        <View className="sq-reward-amount">
                          <Text className="sq-reward-symbol">¥</Text>
                          <Text className="sq-reward-value">{perUnitBudget}</Text>
                          <Text className="sq-reward-unit">/分身</Text>
                        </View>
                        <Text className="sq-reward-hint">共{order.expectedQuantity}个分身 · 总额¥{order.budget.toFixed(2)}</Text>
                      </View>
                      <View className="sq-reward-divider" />
                      <View className="sq-reward-right">
                        <View className="sq-reward-meta">
                          <Clock size={14} color="#6366F1" />
                          <Text className="sq-reward-meta-text">{ctInfo.effort}</Text>
                        </View>
                        <Text className="sq-reward-meta-sub">预计耗时</Text>
                      </View>
                    </View>

                    {/* ===== 接单后流程 ===== */}
                    <View className="sq-what-section">
                      <Text className="sq-section-label">接单后流程</Text>
                      <View className="sq-steps">
                        <View className="sq-step">
                          <View className="sq-step-dot sq-step-dot-1">
                            <Text className="sq-step-num">1</Text>
                          </View>
                          <Text className="sq-step-text">AI自动创作</Text>
                        </View>
                        <View className="sq-step-line" />
                        <View className="sq-step">
                          <View className="sq-step-dot sq-step-dot-2">
                            <Text className="sq-step-num">2</Text>
                          </View>
                          <Text className="sq-step-text">确认发布</Text>
                        </View>
                        <View className="sq-step-line" />
                        <View className="sq-step">
                          <View className="sq-step-dot sq-step-dot-3">
                            <Text className="sq-step-num">3</Text>
                          </View>
                          <Text className="sq-step-text">获得收益</Text>
                        </View>
                      </View>
                    </View>

                    {/* 目标受众 */}
                    {order.targetAudience && (
                      <View className="sq-audience-row">
                        <Target size={14} color="#8B5CF6" />
                        <Text className="sq-audience-label">目标受众：</Text>
                        <Text className="sq-audience-text">{order.targetAudience}</Text>
                      </View>
                    )}

                    {/* 已接单信息 */}
                    {order.acceptCount > 0 && (
                      <View className="sq-accept-info">
                        <Users size={14} color="#6366F1" />
                        <Text className="sq-accept-text">{order.acceptCount}人已接单</Text>
                      </View>
                    )}

                    {/* 展开更多 */}
                    <View className="sq-expand-row" onClick={(e) => { e.stopPropagation(); setExpandedCard(isExpanded ? null : order.id) }}>
                      <Text className="sq-expand-text">{isExpanded ? '收起详情' : '查看详情'}</Text>
                      {isExpanded ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
                    </View>

                    {/* 展开区：需求详情 */}
                    {isExpanded && (
                      <View className="sq-expand-area">
                        {requirementList.length > 0 && (
                          <View className="sq-req-block">
                            <Text className="sq-req-title">创作要求</Text>
                            {requirementList.slice(0, 5).map((req, idx) => (
                              <View key={idx} className="sq-req-item">
                                <View className="sq-req-dot" />
                                <Text className="sq-req-text">{req}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <View className="sq-cost-benefit">
                          <View className="sq-cost-side">
                            <Text className="sq-cb-title">你需要做</Text>
                            <View className="sq-cb-item">
                              <CircleCheckBig size={14} color="#6366F1" />
                              <Text className="sq-cb-text">AI自动生成{ctInfo.label}内容</Text>
                            </View>
                            <View className="sq-cb-item">
                              <CircleCheckBig size={14} color="#6366F1" />
                              <Text className="sq-cb-text">确认后一键发布到{order.platforms.map(p => getPlatformLabel(p)).join('、')}</Text>
                            </View>
                            <View className="sq-cb-item">
                              <CircleCheckBig size={14} color="#6366F1" />
                              <Text className="sq-cb-text">等待验收通过即可结算</Text>
                            </View>
                          </View>
                          <View className="sq-benefit-side">
                            <Text className="sq-cb-title">你将获得</Text>
                            <View className="sq-cb-item">
                              <TrendingUp size={14} color="#10B981" />
                              <Text className="sq-cb-text sq-cb-green">¥{perUnitBudget} 创作收益</Text>
                            </View>
                            <View className="sq-cb-item">
                              <TrendingUp size={14} color="#10B981" />
                              <Text className="sq-cb-text sq-cb-green">分身活跃度提升</Text>
                            </View>
                            <View className="sq-cb-item">
                              <TrendingUp size={14} color="#10B981" />
                              <Text className="sq-cb-text sq-cb-green">接单信誉加分</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* 接单按钮 */}
                    <View className="sq-card-actions">
                      <View
                        className={`sq-btn-accept ${acceptedOrderIds[order.id] ? 'accepted' : ''} ${isAccepting ? 'loading' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAcceptOrder(order.id)
                        }}
                      >
                        {isAccepting ? (
                          <>
                            <View className="sq-btn-mini-spinner" />
                            <Text className="sq-btn-label sq-btn-label-primary">接单中...</Text>
                          </>
                        ) : acceptedOrderIds[order.id] ? (
                          <>
                            <CircleCheckBig size={16} color="#fff" />
                            <Text className="sq-btn-label sq-btn-label-primary">已接单</Text>
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} color="#fff" />
                            <Text className="sq-btn-label sq-btn-label-primary">接单赚¥{perUnitBudget}</Text>
                            <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                )
              })
            ) : (
              <View className="sq-empty">
                <ShoppingBag size={48} color="#CBD5E1" />
                <Text className="sq-empty-title">暂无可接订单</Text>
                <Text className="sq-empty-desc">切换平台看看或稍后再来</Text>
              </View>
            )}
          </View>
        </View>

        {/* 底部留白 */}
        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  )
}
