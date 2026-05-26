import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import {
  ArrowLeft, Wallet, Users, FileText,
  Zap, ChevronRight, CircleX, Sparkles,
  Image as ImageIcon, Video, Target,
  Clock, Timer, TrendingUp, CircleCheckBig,
  Flame, CircleAlert, ChevronDown, ChevronUp
} from 'lucide-react-taro'
import { canonicalizePlatforms, getPlatformMeta, getPlatformLabel, PLATFORM_UI_ORDER } from '@/constants/publish-platform'
import './index.css'

// 待接订单数据接口（与后端 API 对齐）
interface PendingOrder {
  dispatchId: string
  orderId: string
  avatarId: string
  avatarName?: string
  avatarUrl?: string
  title: string
  description: string
  contentType: string
  platforms: string[]
  budget: number
  expectedEarnings: number
  orderStatus: string
  dispatchStatus: string
  expiresAt?: string
  dispatchCreatedAt?: string
  expectedQuantity: number
  orderCreatedAt: string
  targetAudience?: string
  deadline?: string
  priority?: string
  requirements?: string
  matchScore?: number
  matchDetails?: {
    skillMatch: number
    styleMatch: number
    nicheMatch: number
    matchedSkills?: string[]
    matchedStyles?: string[]
    matchedNiches?: string[]
  }
  preferredStyles?: string[]
  industryTags?: string[]
}

// 内容类型配置
const CONTENT_TYPE_MAP: Record<string, { label: string; icon: any; color: string; effort: string }> = {
  simple_task: { label: '简单任务', icon: CircleCheckBig, color: '#06B6D4', effort: '约5分钟' },
  image_text: { label: '图文笔记', icon: FileText, color: '#6366F1', effort: '约15分钟' },
  article: { label: '长篇文章', icon: FileText, color: '#8B5CF6', effort: '约30分钟' },
  image: { label: '图片内容', icon: ImageIcon, color: '#10B981', effort: '约10分钟' },
  video: { label: '短视频', icon: Video, color: '#F59E0B', effort: '约20分钟' },
  text: { label: '纯文案', icon: FileText, color: '#3B82F6', effort: '约10分钟' },
}

// 优先级配置
const PRIORITY_MAP: Record<string, { label: string; color: string; icon: any }> = {
  urgent: { label: '紧急', color: '#EF4444', icon: Flame },
  high: { label: '优先', color: '#F59E0B', icon: CircleAlert },
  normal: { label: '普通', color: '#94A3B8', icon: Clock },
}

// 安全解析 JSON
function safeParseJSON(val: any): string[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { const r = JSON.parse(val); return Array.isArray(r) ? r : [val] } catch { return [val] }
  }
  return []
}

// 计算距离截止时间
function getTimeLeft(deadline?: string) {
  if (!deadline) return null
  const now = Date.now()
  const end = new Date(deadline).getTime()
  const diff = end - now
  if (diff <= 0) return '已过期'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return '不足1小时'
  if (hours < 24) return `${hours}小时`
  return `${Math.floor(hours / 24)}天${hours % 24}小时`
}

// 解析 requirements JSON
function safeParseRequirements(val: any): string[] {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    try {
      const r = JSON.parse(val)
      if (Array.isArray(r)) return r.filter(Boolean)
      if (typeof r === 'object' && r !== null) {
        // 可能是 { tone: '专业', style: '...'} 格式
        return Object.entries(r).map(([k, v]) => `${k}: ${v}`)
      }
      return [val]
    } catch { return [val] }
  }
  return []
}

// 派单响应倒计时组件
function DispatchCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calc = () => {
      const end = new Date(expiresAt).getTime()
      const now = Date.now()
      const diff = end - now
      if (diff <= 0) {
        setTimeLeft('已过期')
        return
      }
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${min}:${String(sec).padStart(2, '0')}`)
    }
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const isUrgent = timeLeft === '已过期' || (timeLeft && parseInt(timeLeft) < 10)

  return (
    <View
      className="po-deadline-row"
      style={{
        background: isUrgent ? '#FEF2F2' : '#EEF2FF',
      }}
    >
      <Timer size={14} color={isUrgent ? '#EF4444' : '#6366F1'} />
      <Text
        className="po-deadline-text"
        style={{ color: isUrgent ? '#EF4444' : '#6366F1' }}
      >
        {timeLeft === '已过期' ? '响应已超时' : `接单截止 ${timeLeft}`}
      </Text>
    </View>
  )
}

export default function PendingOrderListPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/order-dispatch/pending-requests' })
      const data = res.data?.data
      if (res.data?.code === 200 && Array.isArray(data)) {
        // 获取分身信息以映射 avatarName
        let avatarMap: Record<string, { name: string; avatarUrl?: string }> = {}
        try {
          const avatarRes = await Network.request({ url: '/api/avatar' })
          const avatarList = avatarRes.data?.data || []
          avatarList.forEach((a: any) => {
            avatarMap[a.id] = { name: a.name || '分身', avatarUrl: a.avatar_url || a.avatarUrl }
          })
        } catch (e) {
          console.error('[待接订单] 获取分身列表失败:', e)
        }

        const realOrders: PendingOrder[] = data.map((item: any) => {
          const avatar = avatarMap[item.avatarId] || {}
          return {
            dispatchId: item.dispatchId,
            orderId: item.orderId,
            avatarId: item.avatarId,
            avatarName: avatar.name || '分身',
            avatarUrl: avatar.avatarUrl || '',
            title: item.title || '订单内容',
            description: item.description || '',
            contentType: item.contentType || 'image_text',
            platforms: canonicalizePlatforms(safeParseJSON(item.platforms)),
            budget: parseFloat(item.budget) || 0,
            expectedEarnings: parseFloat(item.expectedEarnings) || 0,
            orderStatus: item.orderStatus || '',
            dispatchStatus: item.dispatchStatus || 'pending',
            expiresAt: item.expiresAt || '',
            dispatchCreatedAt: item.dispatchCreatedAt || '',
            expectedQuantity: item.expectedQuantity || 1,
            orderCreatedAt: item.orderCreatedAt || '',
            targetAudience: item.targetAudience || '',
            deadline: item.deadline || '',
            priority: item.priority || 'normal',
            requirements: item.requirements || '',
          }
        })
        setOrders(realOrders)
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error('[待接订单] 获取失败:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  // 接单
  const handleAccept = async (order: PendingOrder) => {
    if (accepting) return
    setAccepting(order.dispatchId)
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/avatar/${order.avatarId}/accept/${order.orderId}`,
        method: 'POST',
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '接单成功，正在生成内容', icon: 'success' })
        const result = res.data?.data || {}
        const nextRequestId = result.requestId || ''
        const nextAvatarId = result.avatarId || order.avatarId
        const nextOrderId = result.orderId || order.orderId
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
        // 从列表移除
        setOrders(prev => prev.filter(o => o.dispatchId !== order.dispatchId))
      } else {
        Taro.showToast({ title: res.data?.msg || '接单失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[待接订单] 接单失败:', error)
      Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
    } finally {
      setAccepting(null)
    }
  }

  // 婉拒
  const handleDecline = async (order: PendingOrder) => {
    try {
      await Network.request({
        url: `/api/order-dispatch/dispatch/${order.dispatchId}/decline`,
        method: 'POST',
      })
      Taro.showToast({ title: '已婉拒', icon: 'none' })
      setOrders(prev => prev.filter(o => o.dispatchId !== order.dispatchId))
    } catch (error) {
      console.error('[待接订单] 婉拒失败:', error)
    }
  }

  // 筛选订单
  const filteredOrders = orders.filter(order => {
    if (selectedPlatform && !order.platforms.includes(selectedPlatform)) return false
    return true
  })

  // 提取所有出现的平台，按发单页面的平台顺序排列
  const allPlatforms = PLATFORM_UI_ORDER.filter(p => new Set(orders.flatMap(o => o.platforms)).has(p))

  // 获取内容类型信息
  const getContentTypeInfo = (type: string) => {
    return CONTENT_TYPE_MAP[type] || CONTENT_TYPE_MAP.image_text
  }

  const statusBarHeight = getStatusBarHeight()

  return (
    <View className="po-page">
      {/* 顶部渐变 */}
      <View className="po-header" style={{ paddingTop: statusBarHeight + 'px' }}>
        <View className="po-header-deco">
          <View className="po-circle po-c1" />
          <View className="po-circle po-c2" />
          <View className="po-circle po-c3" />
        </View>
        <View className="po-header-row">
          <View className="po-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="po-header-center">
            <Text className="po-header-title">待接订单</Text>
            <Text className="po-header-sub">分身为您匹配的专属任务</Text>
          </View>
          <View className="po-header-right" />
        </View>
        {/* 统计 */}
        <View className="po-stat-bar">
          <View className="po-stat-chip">
            <Zap size={14} color="#FBBF24" />
            <Text className="po-stat-num">{orders.length}</Text>
            <Text className="po-stat-label">待接任务</Text>
          </View>
          <View className="po-stat-divider" />
          <View className="po-stat-chip">
            <Wallet size={14} color="#34D399" />
            <Text className="po-stat-num">¥{orders.reduce((s, o) => s + o.expectedEarnings, 0).toFixed(2)}</Text>
            <Text className="po-stat-label">预期收益</Text>
          </View>
          <View className="po-stat-divider" />
          <View className="po-stat-chip">
            <Users size={14} color="#A78BFA" />
            <Text className="po-stat-num">{new Set(orders.map(o => o.avatarId)).size}</Text>
            <Text className="po-stat-label">参与分身</Text>
          </View>
        </View>
      </View>

      {/* 平台筛选 */}
      {allPlatforms.length > 0 && (
        <View className="po-filter">
          <ScrollView className="po-filter-scroll" scrollX>
            <View
              className={`po-filter-tag ${!selectedPlatform ? 'active' : ''}`}
              onClick={() => setSelectedPlatform(null)}
            >
              <Text className="po-filter-text">全部</Text>
            </View>
            {allPlatforms.map(pKey => {
              const meta = getPlatformMeta(pKey)
              return (
                <View
                  key={pKey}
                  className={`po-filter-tag ${selectedPlatform === pKey ? 'active' : ''}`}
                  onClick={() => setSelectedPlatform(selectedPlatform === pKey ? null : pKey)}
                  style={selectedPlatform === pKey ? { background: `${meta?.color || '#6366F1'}18`, borderColor: meta?.color || '#6366F1' } : {}}
                >
                  <Text className="po-filter-text" style={selectedPlatform === pKey ? { color: meta?.color || '#6366F1' } : {}}>
                    {getPlatformLabel(pKey)}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* 订单列表 */}
      <ScrollView className="po-list" scrollY>
        {loading ? (
          <View className="po-loading">
            <View className="po-spinner" />
            <Text className="po-loading-text">加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="po-empty">
            <View className="po-empty-icon">
              <CircleCheckBig size={48} color="#CBD5E1" />
            </View>
            <Text className="po-empty-title">暂无待接订单</Text>
            <Text className="po-empty-desc">所有订单都已处理，稍后再来看看</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const ctInfo = getContentTypeInfo(order.contentType)
            const isAccepting = accepting === order.dispatchId
            const isExpanded = expandedCard === order.dispatchId
            const priorityInfo = PRIORITY_MAP[order.priority || 'normal'] || PRIORITY_MAP.normal
            const PriorityIcon = priorityInfo.icon
            const timeLeft = getTimeLeft(order.deadline)
            const requirementList = safeParseRequirements(order.requirements)
            const perUnitBudget = order.expectedEarnings.toFixed(1)

            return (
              <View key={order.dispatchId} className="po-card">
                {/* 紧急度指示条 */}
                {(order.priority === 'urgent' || order.priority === 'high') && (
                  <View className="po-priority-bar" style={{ backgroundColor: priorityInfo.color }} />
                )}

                {/* 卡片头部：分身 + 优先级 + 平台 */}
                <View className="po-card-top">
                  <View className="po-avatar-chip">
                    {order.avatarUrl ? (
                      <Image src={order.avatarUrl} className="po-avatar-img" mode="aspectFill" />
                    ) : (
                      <View className="po-avatar-dot" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        <Text className="po-avatar-letter">{(order.avatarName || '分').charAt(0)}</Text>
                      </View>
                    )}
                    <Text className="po-avatar-label">{order.avatarName}</Text>
                    <Text className="po-avatar-match">为你匹配</Text>
                  </View>
                  <View className="po-card-badges">
                    {order.priority !== 'normal' && (
                      <View className="po-priority-pill" style={{ background: `${priorityInfo.color}15` }}>
                        <PriorityIcon size={12} color={priorityInfo.color} />
                        <Text className="po-priority-pill-text" style={{ color: priorityInfo.color }}>
                          {priorityInfo.label}
                        </Text>
                      </View>
                    )}
                    {order.platforms.map(pKey => {
                      const meta = getPlatformMeta(pKey)
                      return (
                        <View key={pKey} className="po-platform-pill" style={{ background: `${meta?.color || '#6366F1'}15` }}>
                          <Text className="po-platform-pill-text" style={{ color: meta?.color || '#6366F1' }}>
                            {getPlatformLabel(pKey)}
                          </Text>
                        </View>
                      )
                    })}
                    <View className="po-type-pill" style={{ background: `${ctInfo.color}15` }}>
                      <Text className="po-type-pill-text" style={{ color: ctInfo.color }}>{ctInfo.label}</Text>
                    </View>
                  </View>
                </View>

                {/* 标题 */}
                <Text className="po-card-title">{order.title}</Text>

                {/* 描述 */}
                {order.description && (
                  <Text className="po-card-desc" numberOfLines={isExpanded ? 100 : 2}>{order.description}</Text>
                )}

                {/* ===== 核心决策区：回报卡片 ===== */}
                <View className="po-reward-card">
                  <View className="po-reward-left">
                    <View className="po-reward-amount">
                      <Text className="po-reward-symbol">¥</Text>
                      <Text className="po-reward-value">{perUnitBudget}</Text>
                      <Text className="po-reward-unit">/分身</Text>
                    </View>
                    <Text className="po-reward-hint">共{order.expectedQuantity}个分身 · 总额¥{order.budget.toFixed(2)}</Text>
                  </View>
                  <View className="po-reward-divider" />
                  <View className="po-reward-right">
                    <View className="po-reward-meta">
                      <Clock size={14} color="#6366F1" />
                      <Text className="po-reward-meta-text">{ctInfo.effort}</Text>
                    </View>
                    <Text className="po-reward-meta-sub">预计耗时</Text>
                  </View>
                </View>

                {/* ===== 接单后要做什么 ===== */}
                <View className="po-what-section">
                  <Text className="po-section-label">接单后流程</Text>
                  <View className="po-steps">
                    <View className="po-step">
                      <View className="po-step-dot po-step-dot-1">
                        <Text className="po-step-num">1</Text>
                      </View>
                      <Text className="po-step-text">AI自动创作</Text>
                    </View>
                    <View className="po-step-line" />
                    <View className="po-step">
                      <View className="po-step-dot po-step-dot-2">
                        <Text className="po-step-num">2</Text>
                      </View>
                      <Text className="po-step-text">确认发布</Text>
                    </View>
                    <View className="po-step-line" />
                    <View className="po-step">
                      <View className="po-step-dot po-step-dot-3">
                        <Text className="po-step-num">3</Text>
                      </View>
                      <Text className="po-step-text">获得收益</Text>
                    </View>
                  </View>
                </View>

                {/* 目标受众（如果有） */}
                {order.targetAudience && (
                  <View className="po-audience-row">
                    <Target size={14} color="#8B5CF6" />
                    <Text className="po-audience-label">目标受众：</Text>
                    <Text className="po-audience-text">{order.targetAudience}</Text>
                  </View>
                )}

                {/* 截止时间提醒 */}
                {timeLeft && (
                  <View
                    className="po-deadline-row"
                    style={{
                      background: timeLeft === '已过期' || timeLeft === '不足1小时'
                        ? '#FEF2F2' : timeLeft.includes('小时') && !timeLeft.includes('天')
                          ? '#FFFBEB' : '#F0F9FF'
                    }}
                  >
                    <Timer
                      size={14}
                      color={
                        timeLeft === '已过期' || timeLeft === '不足1小时'
                          ? '#EF4444' : timeLeft.includes('小时') && !timeLeft.includes('天')
                            ? '#F59E0B' : '#3B82F6'
                      }
                    />
                    <Text
                      className="po-deadline-text"
                      style={{
                        color: timeLeft === '已过期' || timeLeft === '不足1小时'
                          ? '#EF4444' : timeLeft.includes('小时') && !timeLeft.includes('天')
                            ? '#F59E0B' : '#3B82F6'
                      }}
                    >
                      {timeLeft === '已过期' ? '已过截止时间' : `剩余 ${timeLeft}`}
                    </Text>
                  </View>
                )}

                {/* 派单响应倒计时 */}
                {order.expiresAt && (
                  <DispatchCountdown expiresAt={order.expiresAt} />
                )}

                {/* 匹配度展示 */}
                {order.matchScore != null && order.matchScore > 0 && (
                  <View className="po-match-row">
                    <View className="po-match-score"
                      style={{
                        background: order.matchScore >= 80 ? '#F0FDF4' : order.matchScore >= 50 ? '#FFFBEB' : '#F8FAFC'
                      }}
                    >
                      <Text className="po-match-score-num"
                        style={{
                          color: order.matchScore >= 80 ? '#10B981' : order.matchScore >= 50 ? '#F59E0B' : '#64748B'
                        }}
                      >{order.matchScore}%</Text>
                      <Text className="po-match-score-label">匹配度</Text>
                    </View>
                    <View className="po-match-details">
                      {(order.matchDetails?.matchedSkills || []).length > 0 && (
                        <View className="po-match-detail-row">
                          <Text className="po-match-detail-label">技能匹配</Text>
                          <View className="po-match-tags">
                            {(order.matchDetails?.matchedSkills || []).map((s, i) => (
                              <Text key={i} className="po-match-tag po-match-tag-skill">{s}</Text>
                            ))}
                          </View>
                        </View>
                      )}
                      {(order.matchDetails?.matchedStyles || []).length > 0 && (
                        <View className="po-match-detail-row">
                          <Text className="po-match-detail-label">风格匹配</Text>
                          <View className="po-match-tags">
                            {(order.matchDetails?.matchedStyles || []).map((s, i) => (
                              <Text key={i} className="po-match-tag po-match-tag-style">{s}</Text>
                            ))}
                          </View>
                        </View>
                      )}
                      {(order.matchDetails?.matchedNiches || []).length > 0 && (
                        <View className="po-match-detail-row">
                          <Text className="po-match-detail-label">领域匹配</Text>
                          <View className="po-match-tags">
                            {(order.matchDetails?.matchedNiches || []).map((s, i) => (
                              <Text key={i} className="po-match-tag po-match-tag-niche">{s}</Text>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* 展开更多详情 */}
                <View className="po-expand-row" onClick={() => setExpandedCard(isExpanded ? null : order.dispatchId)}>
                  <Text className="po-expand-text">{isExpanded ? '收起详情' : '查看详情'}</Text>
                  {isExpanded ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
                </View>

                {/* 展开区：需求详情 + 要求 */}
                {isExpanded && (
                  <View className="po-expand-area">
                    {/* 特殊要求 */}
                    {requirementList.length > 0 && (
                      <View className="po-req-block">
                        <Text className="po-req-title">创作要求</Text>
                        {requirementList.slice(0, 5).map((req, idx) => (
                          <View key={idx} className="po-req-item">
                            <View className="po-req-dot" />
                            <Text className="po-req-text">{req}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* 付出与回报说明 */}
                    <View className="po-cost-benefit">
                      <View className="po-cost-side">
                        <Text className="po-cb-title">你需要做</Text>
                        <View className="po-cb-item">
                          <CircleCheckBig size={14} color="#6366F1" />
                          <Text className="po-cb-text">AI自动生成{ctInfo.label}内容</Text>
                        </View>
                        <View className="po-cb-item">
                          <CircleCheckBig size={14} color="#6366F1" />
                          <Text className="po-cb-text">确认后一键发布到{order.platforms.map(p => getPlatformLabel(p)).join('、')}</Text>
                        </View>
                        <View className="po-cb-item">
                          <CircleCheckBig size={14} color="#6366F1" />
                          <Text className="po-cb-text">等待验收通过即可结算</Text>
                        </View>
                      </View>
                      <View className="po-benefit-side">
                        <Text className="po-cb-title">你将获得</Text>
                        <View className="po-cb-item">
                          <TrendingUp size={14} color="#10B981" />
                          <Text className="po-cb-text po-cb-green">¥{order.expectedEarnings.toFixed(2)} 创作收益</Text>
                        </View>
                        <View className="po-cb-item">
                          <TrendingUp size={14} color="#10B981" />
                          <Text className="po-cb-text po-cb-green">分身活跃度提升</Text>
                        </View>
                        <View className="po-cb-item">
                          <TrendingUp size={14} color="#10B981" />
                          <Text className="po-cb-text po-cb-green">接单信誉加分</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* 操作按钮 */}
                <View className="po-card-actions">
                  <Button
                    className="po-btn po-btn-decline"
                    onClick={() => handleDecline(order)}
                  >
                    <CircleX size={16} color="#64748B" />
                    <Text className="po-btn-label po-btn-label-default">婉拒</Text>
                  </Button>
                  <Button
                    className="po-btn po-btn-accept"
                    onClick={() => handleAccept(order)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <View className="po-btn-mini-spinner" />
                        <Text className="po-btn-label po-btn-label-primary">接单中...</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} color="#fff" />
                        <Text className="po-btn-label po-btn-label-primary">接单赚¥{order.expectedEarnings.toFixed(2)}</Text>
                        <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                      </>
                    )}
                  </Button>
                </View>
              </View>
            )
          })
        )}
        <View className="po-bottom-space" />
      </ScrollView>
    </View>
  )
}
