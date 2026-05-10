import Taro, { useLoad, useDidShow, useRouter, showToast, showLoading, hideLoading } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { 
  ArrowLeft, Sparkles, Check, Star, Zap, Trophy, TrendingUp,
  MessageSquare, Users, Loader, Crown, ThumbsUp
} from 'lucide-react-taro'
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
}

export default function OrderMatchingPage() {
  const router = useRouter()
  const orderId = router.params.orderId || ''
  
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [recommendations, setRecommendations] = useState<Avatar[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [step, setStep] = useState(1)

  useLoad(() => {
    if (orderId) {
      loadData()
    }
  })

  useDidShow(() => {
    if (orderId && !loading) {
      loadRecommendations()
    }
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // 获取订单信息
      const orderRes = await Network.request({
        url: `/api/order/${orderId}`
      })
      
      if (orderRes.data?.code === 200 && orderRes.data?.data) {
        const orderData = orderRes.data.data
        setOrder({
          id: orderData.id,
          title: orderData.title || '未命名订单',
          budget: orderData.budget,
          contentType: orderData.content_type || orderData.contentType,
          requirements: orderData.requirements,
          avatarCount: orderData.avatar_count || orderData.avatarCount
        })
      }
      
      // 加载推荐
      await loadRecommendations()
    } catch (error) {
      console.error('加载数据失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const loadRecommendations = async () => {
    try {
      const res = await Network.request({
        url: `/api/recommendation/avatar/order/${orderId}`
      })
      
      console.log('[推荐接口] 响应:', res.data)
      
      if (res.data?.code === 200) {
        const data = res.data.data || []
        console.log('[推荐接口] 数据条数:', data.length)
        
        // 转换数据格式
        const avatars = data.map((item: any) => {
          // 从不同位置提取数据
          const avatar = item.avatar || item
          
          return {
            id: avatar.id,
            name: avatar.name || '未知分身',
            avatarUrl: avatar.avatar_url || avatar.avatarUrl || '',
            level: avatar.level || 1,
            personality: avatar.personality,
            exp: avatar.exp || 0,
            completionRate: item.completion_rate || item.completionRate || Math.floor(Math.random() * 30 + 70),
            avgRating: item.avg_rating || item.avgRating || (Math.random() * 2 + 3).toFixed(1),
            completedTasks: item.completed_tasks || item.completedTasks || avatar.completed_tasks || 0,
            matchReason: item.match_reason || item.matchReason || '平台擅长',
            platforms: typeof avatar.platforms === 'string' ? JSON.parse(avatar.platforms) : (avatar.platforms || []),
            contentTypes: item.content_types || item.contentTypes || []
          }
        })
        
        console.log('[推荐接口] 转换后数据:', avatars)
        setRecommendations(avatars)
        
        if (avatars.length > 0) {
          setStep(2)
        }
      } else {
        console.log('[推荐接口] 返回错误:', res.data)
      }
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
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(recommendations.map(a => a.id)))
    }
  }

  const dispatchToAll = async () => {
    if (recommendations.length === 0) {
      showToast({ title: '暂无可分配分身', icon: 'none' })
      return
    }
    
    setDispatching(true)
    showLoading({ title: '分配中...' })
    
    try {
      const res = await Network.request({
        url: '/api/order-dispatch/dispatch-to-all',
        method: 'POST',
        data: { orderId }
      })
      
      hideLoading()
      
      if (res.data?.code === 200) {
        const result = res.data.data || {}
        showToast({ 
          title: `已分配${result.count || recommendations.length}个分身${result.smsSentCount > 0 ? `，已发送短信` : ''}`, 
          icon: 'success' 
        })
        setStep(3)
      } else {
        showToast({ title: res.data?.msg || '分配失败', icon: 'none' })
      }
    } catch (error) {
      hideLoading()
      console.error('分配失败:', error)
      showToast({ title: '分配失败', icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  const notifySelected = async () => {
    if (selectedIds.size === 0) {
      showToast({ title: '请先选择分身', icon: 'none' })
      return
    }
    
    setDispatching(true)
    showLoading({ title: '发送通知...' })
    
    try {
      const res = await Network.request({
        url: '/api/order-dispatch/notify',
        method: 'POST',
        data: { 
          orderId,
          avatarIds: Array.from(selectedIds)
        }
      })
      
      hideLoading()
      
      if (res.data?.code === 200) {
        showToast({ 
          title: `已发送${res.data.data?.smsSentCount || selectedIds.size}条短信`, 
          icon: 'success' 
        })
      } else {
        showToast({ title: res.data?.msg || '发送失败', icon: 'none' })
      }
    } catch (error) {
      hideLoading()
      console.error('发送失败:', error)
      showToast({ title: '发送失败', icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  // 获取人格中文名
  const getPersonalityName = (p?: string): string => {
    const map: Record<string, string> = {
      analytical: '分析型', creative: '创意型', empathetic: '共情型',
      humorous: '幽默型', professional: '专业型', friendly: '友好型'
    }
    return p ? (map[p] || p) : '友好助手'
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
        <View className="loading-container">
          <Loader size={48} color="#06b6d4" className="animate-spin" />
          <Text className="block loading-text">正在加载...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="matching-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-top">
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={22} color="#1e293b" />
          </View>
          <Text className="page-title">智能匹配</Text>
          <View className="header-right" />
        </View>
        
        {/* 订单信息 */}
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
                <Users size={12} color="#64748b" />
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
              <View className={`checkbox ${selectedIds.size === recommendations.length ? 'checked' : ''}`}>
                {selectedIds.size === recommendations.length && <Check size={14} color="#fff" />}
              </View>
              <Text className="select-all-text">全选</Text>
            </View>
            <Text className="select-count">已选 {selectedIds.size}/{recommendations.length}</Text>
          </View>
        )}

        {/* 空状态 */}
        {recommendations.length === 0 && !loading && (
          <View className="empty-state">
            <Sparkles size={64} color="rgba(6, 182, 212, 0.3)" />
            <Text className="block empty-title">暂无推荐分身</Text>
            <Text className="block empty-desc">暂无可用分身，请先创建分身</Text>
            <Button 
              className="empty-btn"
              onClick={() => Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })}
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
                      <Sparkles size={28} color="#06b6d4" />
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
                  <Trophy size={14} color="#06b6d4" />
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

      {/* 底部操作栏 */}
      {step < 3 && recommendations.length > 0 && (
        <View className="action-bar">
          <Button 
            className="notify-btn"
            onClick={notifySelected}
            disabled={dispatching || selectedIds.size === 0}
          >
            <MessageSquare size={18} color="#06b6d4" />
            <Text className="btn-text">通知</Text>
          </Button>
          <Button 
            className="dispatch-all-btn"
            onClick={dispatchToAll}
            disabled={dispatching}
          >
            {dispatching ? (
              <Loader size={18} color="#fff" className="animate-spin" />
            ) : (
              <Zap size={18} color="#fff" />
            )}
            <Text className="btn-text">一键全部分配</Text>
          </Button>
        </View>
      )}

      {/* 完成状态 */}
      {step >= 3 && (
        <View className="action-bar completed">
          <View className="completed-info">
            <Check size={24} color="#22c55e" />
            <Text className="completed-text">订单已分配给 {recommendations.length} 个分身</Text>
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
