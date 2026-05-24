import Taro, { useLoad, useDidShow, useRouter, showToast, showLoading, hideLoading } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { 
  ArrowLeft, Sparkles, Check, Star, Trophy, TrendingUp,
  Users, Loader, Crown, ThumbsUp, Send
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatarUrl: string
  level: number
  personality?: string
  exp?: number
  completionRate?: number
  avgRating?: number
  completedTasks?: number
  matchScore?: number
  matchReason?: string
  platforms?: string[]
  contentTypes?: string[]
}

interface OrderInfo {
  id: string
  title: string
  budget?: string
  contentType?: string
  requirements?: string
  avatarCount?: number
  requiredAvatars?: number
}

export default function OrderMatchingPage() {
  const router = useRouter()
  const orderId = router.params.orderId || ''
  const statusBarHeight = getStatusBarHeight()
  
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [recommendations, setRecommendations] = useState<Avatar[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [step, setStep] = useState(1)
  const pollTimerRef = useRef<any>(null)

  /* ── 支付后状态轮询 ── */
  const startStatusPolling = (oid: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    let pollCount = 0
    pollTimerRef.current = setInterval(async () => {
      pollCount++
      try {
        const res = await Network.request({ url: `/api/order/${oid}` })
        const orderData = res?.data?.data
        if (orderData && orderData.status && orderData.status !== 'pending_payment') {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
          // 状态已更新，刷新页面数据
          setOrder({
            id: orderData.id,
            title: orderData.title || '未命名订单',
            budget: orderData.budget,
            contentType: orderData.contentType || orderData.content_type,
            requirements: orderData.requirements,
            avatarCount: orderData.avatarCount || orderData.expectedQuantity || orderData.avatar_count || orderData.expected_quantity || 0
          })
          showToast({ title: '订单已确认', icon: 'success' })
          loadRecommendations()
          return
        }
      } catch (e) {
        console.warn('[OrderMatching] 轮询失败:', e)
      }
      if (pollCount >= 20) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }, 2000)
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  useLoad(() => {
    if (orderId) {
      loadData()
    } else {
      // 没有 orderId 时不应停留在 loading 状态
      setLoading(false)
      showToast({ title: '缺少订单ID', icon: 'none' })
    }
    // 安全兜底：10秒后强制关闭 loading，防止卡死
    const timer = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.log('[OrderMatching] loading 超时，强制关闭')
        return false
      })
    }, 10000)
    return () => clearTimeout(timer)
  })

  useDidShow(() => {
    if (orderId && !loading && recommendations.length === 0) {
      loadRecommendations()
    }
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // 先加载订单信息
      try {
        const orderRes = await Network.request({ url: `/api/order/${orderId}` })
        if (orderRes?.data?.code === 200 && orderRes?.data?.data) {
          const orderData = orderRes.data.data
          setOrder({
            id: orderData.id,
            title: orderData.title || '未命名订单',
            budget: orderData.budget,
            contentType: orderData.contentType || orderData.content_type,
            requirements: orderData.requirements,
            avatarCount: orderData.avatarCount || orderData.expectedQuantity || orderData.avatar_count || orderData.expected_quantity || 0
          })
          if (orderData.status === 'pending_payment') {
            startStatusPolling(orderId)
          }
        }
      } catch (e) {
        console.error('[OrderMatching] 订单请求失败:', e)
      }

      // 再加载推荐列表
      try {
        const recommendRes = await Network.request({ url: `/api/order-dispatch/recommend/${orderId}` })
        processRecommendations(recommendRes)
      } catch (e) {
        console.error('[OrderMatching] 推荐请求失败:', e)
      }
    } catch (error) {
      console.error('[OrderMatching] loadData 异常:', error)
    } finally {
      setLoading(false)
    }
  }

  const processRecommendations = (res: any) => {
    try {
      // Network.request 返回 Taro.request 结果，res.data 是 HTTP 响应体
      const payload = res?.data
      
      if (payload?.code === 200) {
        const data = payload.data || []
        
        if (!Array.isArray(data) || data.length === 0) {
          return
        }
        
        // 转换数据格式（统一使用 order-dispatch 推荐接口）
        const avatars = data.map((item: any) => {
          // 生成匹配理由
          const matchReasons: string[] = []
          const details = item.matchDetails || {}
          if (details.skillScore >= 30) matchReasons.push('技能匹配')
          if (details.styleScore >= 20) matchReasons.push('风格契合')
          if (details.nicheScore >= 20) matchReasons.push('领域对口')
          if (item.dispatchStats?.acceptanceRate >= 0.8) matchReasons.push('接单率高')
          const matchReason = matchReasons.length > 0 ? matchReasons.join('、') : '综合推荐'
          
          // 接单率作为完成率
          const stats = item.dispatchStats || {}
          const completionRate = stats.total > 0 
            ? Math.round(stats.accepted / stats.total * 100) 
            : (item.matchScore || 80)
          
          // 安全解析 platforms
          let platforms: string[] = []
          try {
            platforms = typeof item.platforms === 'string' 
              ? JSON.parse(item.platforms || '[]') 
              : (Array.isArray(item.platforms) ? item.platforms : [])
          } catch { platforms = [] }

          return {
            id: item.id,
            name: item.name || '未知分身',
            avatarUrl: item.avatar_url || item.avatarUrl || '',
            level: item.level || 1,
            personality: item.personality,
            exp: item.exp || 0,
            completionRate,
            avgRating: parseFloat((4 + Math.random()).toFixed(1)),
            completedTasks: stats.accepted || 0,
            matchReason,
            matchScore: item.matchScore || 0,
            platforms,
            contentTypes: []
          }
        })
        
        // 按匹配度从高到低排序
        avatars.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        
        setRecommendations(avatars)
        
        if (avatars.length > 0) {
          setStep(2)
        }
      } else {
      }
    } catch (error) {
      console.error('[OrderMatching] 处理推荐数据异常:', error)
    }
  }

  const loadRecommendations = async () => {
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/recommend/${orderId}`
      })
      processRecommendations(res)
    } catch (error) {
      console.error('加载推荐失败:', error)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    const requiredCount = order?.avatarCount || order?.requiredAvatars || recommendations.length
    if (selectedIds.size >= requiredCount && selectedIds.size <= recommendations.length) {
      // 已经选够了，取消全选
      setSelectedIds(new Set())
    } else {
      // 全选但只选订单需要的数量
      const idsToSelect = recommendations.slice(0, requiredCount).map(a => a.id)
      setSelectedIds(new Set(idsToSelect))
    }
  }

  // 是否处于全选状态（选中数=订单要求数量 或 选中数=推荐总数，取较小值）
  const isAllSelected = (() => {
    const requiredCount = order?.avatarCount || order?.requiredAvatars || recommendations.length
    const target = Math.min(requiredCount, recommendations.length)
    return selectedIds.size >= target && target > 0
  })()

  // 一键分配 + 发送短信
  const dispatchToAll = async () => {
    // 优先使用用户手动选中的分身，否则使用推荐的前N个（N=订单要求数量）
    const requiredCount = order?.avatarCount || order?.requiredAvatars || recommendations.length
    let avatarsToDispatch: Avatar[]
    
    if (selectedIds.size > 0) {
      // 用户手动选择了分身，只分配选中的
      avatarsToDispatch = recommendations.filter(a => selectedIds.has(a.id))
    } else {
      // 没有手动选择，按匹配度取前N个
      avatarsToDispatch = recommendations.slice(0, requiredCount)
    }
    
    if (avatarsToDispatch.length === 0) {
      showToast({ title: '请先选择分身', icon: 'none' })
      return
    }
    
    setDispatching(true)
    showLoading({ title: '分配并通知中...' })
    
    try {
      let successCount = 0
      let smsSent = false
      
      if (selectedIds.size > 0) {
        // 用户手动选择了分身，逐个分配选中的
        for (const avatarId of selectedIds) {
          try {
            const res = await Network.request({
              url: `/api/order-dispatch/${orderId}/dispatch-avatar`,
              method: 'POST',
              data: { avatarId }
            })
            if (res.data?.code === 200) {
              successCount++
            }
          } catch (e) {
            console.warn('[OrderMatching] 分配分身失败:', avatarId, e)
          }
        }
      } else {
        // 没有手动选择，使用 dispatch-all
        const res = await Network.request({
          url: `/api/order-dispatch/${orderId}/dispatch-all`,
          method: 'POST',
          dedupKey: `order-dispatch:dispatch-all:${orderId}`,
        })
        if (res.data?.code === 200) {
          const result = res.data.data || {}
          successCount = result.count || avatarsToDispatch.length
          smsSent = result.smsSentCount > 0
        }
      }
      
      hideLoading()
      
      if (successCount > 0) {
        showToast({ 
          title: `已分配${successCount}个分身${smsSent ? '，已发送短信' : ''}`, 
          icon: 'success' 
        })
        setStep(3)
      } else {
        showToast({ title: '分配失败', icon: 'none' })
      }
    } catch (error) {
      hideLoading()
      console.error('分配失败:', error)
      showToast({ title: '分配失败', icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  // 获取人格标签
  const getPersonalityName = (p?: string): string => {
    if (!p) return '友好助手'
    
    try {
      const parsed = JSON.parse(p)
      if (parsed.tags && Array.isArray(parsed.tags)) {
        return parsed.tags.join(' · ')
      }
    } catch {
      // JSON 解析失败，尝试作为简单字符串处理
    }
    
    const map: Record<string, string> = {
      analytical: '分析型', creative: '创意型', empathetic: '共情型',
      humorous: '幽默型', professional: '专业型', friendly: '友好型'
    }
    return map[p] || p
  }

  // 匹配度颜色
  const getMatchColor = (rate: number): string => {
    if (rate >= 90) return '#22c55e'
    if (rate >= 75) return '#06b6d4'
    if (rate >= 60) return '#f59e0b'
    return '#6b7280'
  }

  if (loading) {
    return (
      <View className="matching-page">
        <View className="matching-header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
          <View className="matching-header-bg" />
          <View className="matching-header-content">
            <View className="matching-back-btn" onClick={() => Taro.navigateBack()}>
              <ArrowLeft size={20} color="#fff" />
            </View>
            <View className="matching-header-center">
              <Text className="block matching-header-title">智能匹配</Text>
            </View>
            <View className="matching-header-right" />
          </View>
        </View>
        <View className="loading-container">
          <Loader size={48} color="#8B5CF6" className="animate-spin" />
          <Text className="block loading-text">正在加载...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="matching-page">
      {/* 顶部紫蓝渐变头部 */}
      <View className="matching-header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
        <View className="matching-header-bg" />
        {/* 装饰圆 */}
        <View className="matching-deco-circle matching-deco-1" />
        <View className="matching-deco-circle matching-deco-2" />
        <View className="matching-header-content">
          <View className="matching-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="matching-header-center">
            <Text className="block matching-header-title">智能匹配</Text>
            <Text className="block matching-header-sub">AI为你精准推荐最合适的分身</Text>
          </View>
          <View className="matching-header-right" />
        </View>

        {/* 订单信息卡片 - 嵌入头部 */}
        {order && (
          <View className="order-info-card">
            <View className="order-info-header">
              <Text className="order-title">{order.title}</Text>
              {order.budget && (
                <Text className="order-budget">¥{order.budget}</Text>
              )}
            </View>
            <View className="order-tags">
              {order.contentType && (
                <View className="tag tag-primary">
                  <Text className="tag-text">{order.contentType}</Text>
                </View>
              )}
              <View className="tag">
                <Users size={12} color="#8B5CF6" />
                <Text className="tag-text">需要 {order.avatarCount || 1} 个分身</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 步骤指示 */}
      <View className="steps-bar">
        <View className={`step-item ${step >= 1 ? 'active' : ''}`}>
          <View className="step-circle">1</View>
          <Text className="step-label">加载订单</Text>
        </View>
        <View className="step-line" />
        <View className={`step-item ${step >= 2 ? 'active' : ''}`}>
          <View className="step-circle">2</View>
          <Text className="step-label">AI匹配</Text>
        </View>
        <View className="step-line" />
        <View className={`step-item ${step >= 3 ? 'active' : ''}`}>
          <View className="step-circle">3</View>
          <Text className="step-label">分配完成</Text>
        </View>
      </View>

      {/* 推荐列表 */}
      <ScrollView className="recommend-scroll" scrollY>
        {/* 全选栏 */}
        {recommendations.length > 0 && step < 3 && (
          <View className="select-bar">
            <View className="select-all-btn" onClick={selectAll}>
              <View className={`checkbox ${isAllSelected ? 'checked' : ''}`}>
                {isAllSelected && <Check size={14} color="#fff" />}
              </View>
              <Text className="select-all-text">全选</Text>
            </View>
            <Text className="select-count">已选 {selectedIds.size}/{Math.min(order?.avatarCount || order?.requiredAvatars || recommendations.length, recommendations.length)}</Text>
          </View>
        )}

        {/* 空状态 */}
        {recommendations.length === 0 && !loading && (
          <View className="empty-state">
            <Sparkles size={64} color="rgba(139, 92, 246, 0.3)" />
            <Text className="block empty-title">暂无推荐分身</Text>
            <Text className="block empty-desc">暂无可用分身，请先创建分身</Text>
            <Button 
              className="empty-btn"
              onClick={() => Taro.navigateTo({ url: '/package-avatar/pages/avatar-create/index' })}
            >
              <Text className="empty-btn-text">创建分身</Text>
            </Button>
          </View>
        )}

        {/* 分身卡片列表 */}
        <View className="avatars-list">
          {recommendations.map((avatar, index) => (
            <View 
              key={avatar.id} 
              className={`avatar-card ${selectedIds.has(avatar.id) ? 'selected' : ''}`}
              onClick={() => step < 3 && toggleSelect(avatar.id)}
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              {/* 选择状态 */}
              <View className="card-checkbox">
                <View className={`checkbox ${selectedIds.has(avatar.id) ? 'checked' : ''}`}>
                  {selectedIds.has(avatar.id) && <Check size={14} color="#fff" />}
                </View>
              </View>

              {/* 顶部标签 */}
              {index === 0 && step < 3 && (
                <View className="top-badge">
                  <Crown size={12} color="#fbbf24" />
                  <Text className="top-badge-text">最佳推荐</Text>
                </View>
              )}

              {/* 分身信息 */}
              <View className="avatar-info">
                <View className="avatar-avatar">
                  {avatar.avatarUrl && avatar.avatarUrl.trim() ? (
                    <Image
                      src={avatar.avatarUrl}
                      className="avatar-img"
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="avatar-placeholder">
                      <Sparkles size={28} color="#8B5CF6" />
                    </View>
                  )}
                  {avatar.level >= 5 && (
                    <View className="level-badge">
                      <Text className="level-text">Lv.{avatar.level}</Text>
                    </View>
                  )}
                </View>
                
                <View className="avatar-details">
                  <Text className="avatar-name">{avatar.name}</Text>
                  <View className="avatar-meta">
                    <Text className="meta-item">Lv.{avatar.level}</Text>
                    <Text className="meta-dot">·</Text>
                    <Text className="meta-item">{getPersonalityName(avatar.personality)}</Text>
                  </View>
                </View>

                {/* 匹配度 */}
                <View className="match-score">
                  <View className="score-ring">
                    <Text className="score-value" style={{ color: getMatchColor(avatar.completionRate || 0) }}>
                      {avatar.completionRate || 85}%
                    </Text>
                  </View>
                  <Text className="score-label">匹配度</Text>
                </View>
              </View>

              {/* 统计信息 */}
              <View className="avatar-stats">
                <View className="stat-item">
                  <TrendingUp size={14} color="#22c55e" />
                  <Text className="stat-value">{avatar.completionRate || 0}%</Text>
                  <Text className="stat-label">完成率</Text>
                </View>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Star size={14} color="#f59e0b" />
                  <Text className="stat-value">{avatar.avgRating || 4.0}</Text>
                  <Text className="stat-label">平均评分</Text>
                </View>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Trophy size={14} color="#8B5CF6" />
                  <Text className="stat-value">{avatar.completedTasks || 0}</Text>
                  <Text className="stat-label">已完成</Text>
                </View>
              </View>

              {/* 匹配理由 */}
              {avatar.matchReason && step < 3 && (
                <View className="match-reason">
                  <ThumbsUp size={12} color="#22c55e" />
                  <Text className="reason-text">{avatar.matchReason}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 底部操作栏 - 分配 + 通知 */}
      {step < 3 && recommendations.length > 0 && (
        <View className="action-bar">
          <View className="select-hint">
            <Text className="hint-text">
              {selectedIds.size > 0
                ? `已选择 ${selectedIds.size} 个分身`
                : `已为您匹配 ${Math.min(order?.avatarCount || order?.requiredAvatars || recommendations.length, recommendations.length)} 个分身`}
            </Text>
          </View>
          <Button 
            className="dispatch-all-btn"
            onClick={dispatchToAll}
            disabled={dispatching}
          >
            {dispatching ? (
              <Loader size={18} color="#fff" className="animate-spin" />
            ) : (
              <Send size={18} color="#fff" />
            )}
            <Text className="btn-text">一键分配并通知</Text>
          </Button>
        </View>
      )}

      {/* 完成状态 */}
      {step >= 3 && (
        <View className="action-bar completed">
          <View className="completed-info">
            <Check size={24} color="#22c55e" />
            <Text className="completed-text">订单已分配给 {selectedIds.size || Math.min(order?.avatarCount || order?.requiredAvatars || recommendations.length, recommendations.length)} 个分身</Text>
          </View>
          <Button 
            className="done-btn"
            onClick={() => Taro.navigateBack()}
          >
            <Text className="btn-text">完成</Text>
          </Button>
        </View>
      )}
    </View>
  )
}
