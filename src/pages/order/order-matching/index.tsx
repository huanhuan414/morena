import { useState, useEffect, useMemo } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import Taro, { useRouter } from '@tarojs/taro'
import { 
  ChevronLeft, Sparkles, Brain, Target, Zap, Users, Crown, 
  Star, TrendingUp, Check, Loader, Bot
} from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

// 平台配置
const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  douyin: { label: '抖音', color: '#ff4757' },
  xiaohongshu: { label: '小红书', color: '#ff6b81' },
  wechat_mp: { label: '公众号', color: '#2ed573' },
  kuaishou: { label: '快手', color: '#ffa502' },
  bilibili: { label: 'B站', color: '#ff6348' },
}

// 订单参数接口
interface OrderParams {
  id?: string
  title: string
  description?: string
  platforms?: string[]
  contentType?: string
  requirements?: any
  avatarCount?: number
  quantityPerAvatar?: number
  totalPrice?: number
}

interface MatchedAvatar {
  id: string
  name: string
  avatar_url?: string
  score: number
  completionRate: number
  avgRating: number
  level: number
  isHosted: boolean
  matchReasons: string[]
}

export default function OrderMatching() {
  const router = useRouter()
  const [orderId, setOrderId] = useState<string>('')
  const [orderParams, setOrderParams] = useState<OrderParams | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [matchedAvatars, setMatchedAvatars] = useState<MatchedAvatar[]>([])
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])
  const [dispatching, setDispatching] = useState(false)

  const steps = useMemo(() => [
    { id: 1, name: '需求分析', description: '解析订单需求', status: currentStep >= 0 ? 'completed' : 'pending' },
    { id: 2, name: '分身筛选', description: '匹配优质分身', status: currentStep >= 1 ? 'completed' : currentStep === 1 ? 'processing' : 'pending' },
    { id: 3, name: '智能排序', description: '计算匹配度', status: currentStep >= 2 ? 'completed' : currentStep === 2 ? 'processing' : 'pending' },
    { id: 4, name: '推荐完成', description: '展示最优结果', status: currentStep >= 3 ? 'completed' : currentStep === 3 ? 'processing' : 'pending' },
  ], [currentStep])

  // 获取订单ID
  useEffect(() => {
    const resolvedOrderId = router.params.orderId
    if (resolvedOrderId) {
      setOrderId(resolvedOrderId)
      fetchOrderDetails(resolvedOrderId)
    } else {
      // 尝试从URL参数获取
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        const params = new URLSearchParams(window.location.search)
        const id = params.get('orderId')
        if (id) {
          setOrderId(id)
          fetchOrderDetails(id)
        } else {
          // 尝试从hash获取
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
          const hashId = hashParams.get('orderId')
          if (hashId) {
            setOrderId(hashId)
            fetchOrderDetails(hashId)
          }
        }
      }
    }
  }, [router.params])

  // 获取订单详情
  const fetchOrderDetails = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/order/${id}`,
        method: 'GET',
      })
      
      if (res.data?.code === 200) {
        const order = res.data.data
        
        // 处理 platforms
        let platforms = order.platforms || []
        if (typeof platforms === 'string') {
          try {
            platforms = JSON.parse(platforms)
          } catch (e) {
            platforms = []
          }
        }
        
        // 处理 requirements
        let requirements = order.requirements || {}
        if (typeof requirements === 'string') {
          try {
            requirements = JSON.parse(requirements)
          } catch (e) {
            requirements = {}
          }
        }
        
        const params: OrderParams = {
          id: order.id,
          title: order.title || '',
          description: order.description || '',
          platforms: platforms,
          contentType: order.contentType || order.content_type || '',
          requirements: requirements,
          avatarCount: order.avatarCount || order.avatar_count || 3,
          quantityPerAvatar: order.quantityPerAvatar || order.quantity_per_avatar || 1,
          totalPrice: order.budget || order.total_price || 0,
        }
        
        setOrderParams(params)
        startMatching(params)
      }
    } catch (error) {
      console.error('获取订单失败:', error)
      setLoading(false)
    }
  }

  // 开始匹配
  const startMatching = async (params: OrderParams) => {
    // 模拟算法步骤
    const stepDuration = 800
    
    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration))
      setCurrentStep(i)
    }
    
    // 调用推荐分身接口
    await fetchMatchingResults(params)
  }

  // 获取匹配结果
  const fetchMatchingResults = async (params: OrderParams) => {
    try {
      const avatarCount = params.avatarCount || 3
      
      const recommendRes = await Network.request({
        url: '/api/recommendation/recommendations',
        method: 'POST',
        data: {
          platforms: params.platforms,
          contentType: params.contentType,
          limit: avatarCount * 2,
          requirements: params.requirements
        }
      })

      if (recommendRes.data?.code === 200) {
        const avatars = recommendRes.data.data || []
        const totalAvatars = avatars.length

        if (totalAvatars > 0) {
          // 逐步显示分身
          for (let i = 0; i < totalAvatars; i++) {
            await new Promise(resolve => setTimeout(resolve, 200))
            setMatchedAvatars(prev => [...prev, avatars[i]])
          }
        }
      }
    } catch (error) {
      console.error('获取推荐分身失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 切换分身选择
  const toggleAvatarSelection = (avatarId: string) => {
    setSelectedAvatars(prev => {
      if (prev.includes(avatarId)) {
        return prev.filter(id => id !== avatarId)
      } else {
        const maxCount = orderParams?.avatarCount || 3
        if (prev.length >= maxCount) {
          Taro.showToast({ title: `最多选择${maxCount}个分身`, icon: 'none' })
          return prev
        }
        return [...prev, avatarId]
      }
    })
  }

  // 确认发布
  const handlePublish = async () => {
    if (selectedAvatars.length === 0) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    setDispatching(true)
    try {
      // 分配分身
      for (const avatarId of selectedAvatars) {
        await Network.request({
          url: `/api/order-dispatch/${orderId}/dispatch-avatar`,
          method: 'POST',
          data: { avatarId }
        })
      }

      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('发布失败:', error)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  // 返回
  const handleBack = () => {
    Taro.navigateBack()
  }

  // 获取平台标签
  const getPlatformTag = (platform: string) => {
    const config = PLATFORM_CONFIG[platform] || { label: platform, color: '#6366f1' }
    return config
  }

  // 获取匹配度颜色
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#22c55e'
    if (score >= 80) return '#3b82f6'
    if (score >= 70) return '#f59e0b'
    return '#6b7280'
  }

  // 计算已选分身
  const selectedCount = matchedAvatars.filter(a => selectedAvatars.includes(a.id)).length

  return (
    <View className="matching-page">
      {/* 顶部导航 */}
      <View className="matching-header">
        <View className="header-nav">
          <View className="back-btn" onClick={handleBack}>
            <ChevronLeft size={24} color="#fff" />
          </View>
          <Text className="header-title">AI智能匹配</Text>
          <View className="header-spacer" />
        </View>
        
        {/* 订单信息 */}
        {orderParams && (
          <View className="order-info-card">
            <View className="order-info-main">
              <Text className="order-title">{orderParams.title}</Text>
              <View className="order-meta">
                {orderParams.platforms?.map((p: string) => {
                  const tag = getPlatformTag(p)
                  return (
                    <View key={p} className="platform-tag" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                      <Text className="platform-tag-text">{tag.label}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
            <View className="order-stats">
              <View className="stat-item">
                <Text className="stat-value">{orderParams.avatarCount || 0}</Text>
                <Text className="stat-label">需要分身</Text>
              </View>
              <View className="stat-divider" />
              <View className="stat-item">
                <Text className="stat-value">{selectedCount}</Text>
                <Text className="stat-label">已选分身</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 算法步骤 */}
      <View className="algorithm-section">
        <View className="section-title">
          <Brain size={18} color="#6366f1" />
          <Text className="section-title-text">匹配算法</Text>
        </View>
        <View className="steps-container">
          {steps.map((step, idx) => (
            <View key={step.id} className={`step-item step-${step.status}`}>
              {idx > 0 && <View className={`step-line ${step.status !== 'pending' ? 'active' : ''}`} />}
              <View className="step-icon-wrap">
                {step.status === 'completed' ? (
                  <Check size={16} color="#22c55e" />
                ) : step.status === 'processing' ? (
                  <Loader size={16} color="#6366f1" className="spin" />
                ) : (
                  <View className="step-dot" />
                )}
              </View>
              <Text className="step-name">{step.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 推荐结果 */}
      <View className="results-section">
        <View className="section-header">
          <View className="section-title">
            <Target size={18} color="#f59e0b" />
            <Text className="section-title-text">推荐分身</Text>
          </View>
          <Text className="results-count">{matchedAvatars.length} 位候选</Text>
        </View>

        {loading && matchedAvatars.length === 0 ? (
          <View className="loading-state">
            <Loader size={32} color="#6366f1" className="spin" />
            <Text className="loading-text">AI正在分析分身...</Text>
          </View>
        ) : matchedAvatars.length === 0 ? (
          <View className="empty-state">
            <Users size={48} color="rgba(255,255,255,0.3)" />
            <Text className="empty-text">暂无可用分身</Text>
          </View>
        ) : (
          <ScrollView className="avatar-list" scrollY>
            {matchedAvatars.map((avatar, idx) => {
              const isSelected = selectedAvatars.includes(avatar.id)
              const scoreColor = getScoreColor(avatar.score)
              
              return (
                <View 
                  key={avatar.id} 
                  className={`avatar-card ${isSelected ? 'selected' : ''} ${idx === 0 ? 'top-ranked' : ''}`}
                  onClick={() => toggleAvatarSelection(avatar.id)}
                >
                  {idx === 0 && (
                    <View className="top-badge">
                      <Crown size={12} color="#fbbf24" />
                      <Text className="top-badge-text">最佳推荐</Text>
                    </View>
                  )}
                  
                  <View className="avatar-main-row">
                    {/* 头像 */}
                    <View className="avatar-avatar">
                      {avatar.avatar_url ? (
                        <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                      ) : (
                        <View className="avatar-placeholder">
                          <Bot size={24} color="#6366f1" />
                        </View>
                      )}
                    </View>
                    
                    {/* 信息 */}
                    <View className="avatar-info">
                      <View className="avatar-name-row">
                        <Text className="avatar-name">{avatar.name}</Text>
                        <View className="level-badge">
                          <Text className="level-text">Lv.{Math.min(avatar.level, 10)}</Text>
                        </View>
                      </View>
                      
                      <View className="avatar-metrics">
                        <View className="metric-item">
                          <TrendingUp size={12} color="#22c55e" />
                          <Text className="metric-value">{avatar.completionRate}%</Text>
                        </View>
                        <View className="metric-sep" />
                        <View className="metric-item">
                          <Star size={12} color="#fbbf24" />
                          <Text className="metric-value">{avatar.avgRating?.toFixed(1) || '4.5'}</Text>
                        </View>
                      </View>
                      
                      <View className="match-reasons">
                        {avatar.matchReasons.slice(0, 2).map((reason, i) => (
                          <View key={i} className="reason-tag">
                            <Zap size={10} color="#6366f1" />
                            <Text className="reason-text">{reason}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    
                    {/* 匹配分 */}
                    <View className="match-score">
                      <View className="score-circle" style={{ borderColor: scoreColor }}>
                        <Text className="score-num" style={{ color: scoreColor }}>{avatar.score}</Text>
                      </View>
                      <Text className="score-label" style={{ color: scoreColor }}>匹配度</Text>
                    </View>
                  </View>
                  
                  {/* 选择状态 */}
                  <View className={`select-indicator ${isSelected ? 'selected' : ''}`}>
                    {isSelected ? (
                      <>
                        <Check size={16} color="#fff" />
                        <Text className="select-text">已选</Text>
                      </>
                    ) : (
                      <Text className="select-hint">点击选择</Text>
                    )}
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}
      </View>

      {/* 底部操作栏 */}
      {orderParams && matchedAvatars.length > 0 && !loading && (
        <View className="bottom-bar">
          <View className="bottom-info">
            <Text className="bottom-tip">已选 {selectedCount}/{orderParams.avatarCount || 0} 个分身</Text>
          </View>
          <Button 
            className={`confirm-btn ${selectedCount > 0 ? 'active' : ''}`}
            onClick={selectedCount > 0 ? handlePublish : undefined}
            disabled={dispatching || selectedCount === 0}
          >
            {dispatching ? (
              <Loader size={20} color="#fff" className="spin" />
            ) : (
              <Sparkles size={20} color="#fff" />
            )}
            <Text className="btn-text">
              {dispatching ? '发布中...' : `确认发布 (${selectedCount})`}
            </Text>
          </Button>
        </View>
      )}
    </View>
  )
}
