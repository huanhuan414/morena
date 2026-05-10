import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { 
  ChevronLeft, Sparkles, Brain, Target, Zap, Users, Crown, 
  Star, TrendingUp, Check, Loader, Bot, ArrowRight, Clock
} from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

// 平台配置
const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  douyin: { label: '抖音', color: '#FF4757' },
  xiaohongshu: { label: '小红书', color: '#FF2442' },
  wechat_mp: { label: '公众号', color: '#07C160' },
  kuaishou: { label: '快手', color: '#FF6B00' },
  bilibili: { label: 'B站', color: '#00A1D6' },
}

// 算法步骤
const STEPS = [
  { id: 1, name: '需求解析', icon: Brain },
  { id: 2, name: '分身筛选', icon: Users },
  { id: 3, name: '智能排序', icon: Target },
  { id: 4, name: '推荐完成', icon: Sparkles },
]

interface OrderData {
  id: string
  title: string
  description?: string
  platforms?: string[]
  contentType?: string
  avatarCount?: number
  budget?: number
}

interface Avatar {
  id: string
  name: string
  avatar_url?: string
  score: number
  completionRate: number
  avgRating: number
  level: number
  matchReasons: string[]
}

export default function OrderMatching() {
  const router = useRouter()
  const [orderId, setOrderId] = useState<string>('')
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  // 获取订单ID
  useEffect(() => {
    const id = router.params.orderId
    if (id) {
      setOrderId(id)
      loadOrder(id)
    } else {
      // H5环境从URL参数获取
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        const params = new URLSearchParams(window.location.search)
        const orderIdFromUrl = params.get('orderId')
        if (orderIdFromUrl) {
          setOrderId(orderIdFromUrl)
          loadOrder(orderIdFromUrl)
        } else {
          // 从hash获取
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
          const hashId = hashParams.get('orderId')
          if (hashId) {
            setOrderId(hashId)
            loadOrder(hashId)
          }
        }
      }
    }
  }, [])

  // 加载订单
  const loadOrder = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/order/${id}`,
        method: 'GET',
      })
      
      if (res.data?.code === 200 && res.data?.data) {
        const order = res.data.data
        
        // 处理JSON字段
        let platforms = order.platforms
        if (typeof platforms === 'string') {
          try { platforms = JSON.parse(platforms) } catch { platforms = [] }
        }
        
        let requirements = order.requirements
        if (typeof requirements === 'string') {
          try { requirements = JSON.parse(requirements) } catch { requirements = {} }
        }
        
        setOrderData({
          id: order.id,
          title: order.title || '',
          description: order.description || '',
          platforms: platforms || [],
          contentType: order.contentType || order.content_type || '',
          avatarCount: order.avatarCount || order.avatar_count || 3,
          budget: order.budget || 0,
        })
        
        // 开始算法流程
        runMatchingAlgorithm(platforms, order.contentType || order.content_type, requirements)
      }
    } catch (err) {
      console.error('加载订单失败:', err)
      setLoading(false)
    }
  }

  // 运行匹配算法
  const runMatchingAlgorithm = async (platforms: string[], contentType: string, requirements: any) => {
    // 模拟算法步骤
    for (let i = 0; i < STEPS.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 600))
      setCurrentStep(i + 1)
    }
    
    // 获取推荐分身
    try {
      const res = await Network.request({
        url: '/api/recommendation/recommendations',
        method: 'POST',
        data: {
          platforms: platforms,
          contentType: contentType,
          limit: 6,
          requirements: requirements
        }
      })
      
      if (res.data?.code === 200 && res.data?.data) {
        setAvatars(res.data.data || [])
      }
    } catch (err) {
      console.error('获取推荐失败:', err)
    }
    
    setLoading(false)
  }

  // 选择分身
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id)
      }
      const max = orderData?.avatarCount || 3
      if (prev.length >= max) {
        Taro.showToast({ title: `最多选择${max}个分身`, icon: 'none' })
        return prev
      }
      return [...prev, id]
    })
  }

  // 发布订单
  const handlePublish = async () => {
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    setPublishing(true)
    try {
      // 分配分身
      for (const avatarId of selectedIds) {
        await Network.request({
          url: `/api/order-dispatch/${orderId}/dispatch-avatar`,
          method: 'POST',
          data: { avatarId }
        })
      }

      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err) {
      console.error('发布失败:', err)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setPublishing(false)
    }
  }

  // 返回
  const handleBack = () => Taro.navigateBack()

  // 匹配度颜色
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981'
    if (score >= 80) return '#3B82F6'
    if (score >= 70) return '#F59E0B'
    return '#6B7280'
  }

  return (
    <View className="matching-page">
      {/* 顶部导航 */}
      <View className="header">
        <View className="header-bg" />
        <View className="header-content">
          <View className="back-btn" onClick={handleBack}>
            <ChevronLeft size={24} color="#fff" />
          </View>
          <Text className="header-title">AI智能匹配</Text>
          <View className="header-right" />
        </View>
      </View>

      {/* 订单信息 */}
      {orderData && (
        <View className="order-card">
          <Text className="order-title">{orderData.title}</Text>
          <View className="order-meta">
            {orderData.platforms?.map((p: string) => {
              const config = PLATFORM_CONFIG[p] || { label: p, color: '#6366F1' }
              return (
                <View key={p} className="platform-tag" style={{ backgroundColor: config.color + '20', color: config.color }}>
                  <Text className="platform-tag-text">{config.label}</Text>
                </View>
              )
            })}
          </View>
          <View className="order-stats">
            <View className="stat-item">
              <Text className="stat-num">{orderData.avatarCount || 0}</Text>
              <Text className="stat-label">需要分身</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-num selected">{selectedIds.length}</Text>
              <Text className="stat-label">已选分身</Text>
            </View>
          </View>
        </View>
      )}

      {/* 算法进度 */}
      <View className="algorithm-card">
        <View className="card-header">
          <Brain size={16} color="#6366F1" />
          <Text className="card-title">AI匹配算法</Text>
        </View>
        <View className="steps-row">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon
            const isComplete = currentStep > idx
            const isProcessing = currentStep === idx + 1
            return (
              <View key={step.id} className="step-item">
                {idx > 0 && (
                  <View className={`step-line ${isComplete ? 'complete' : ''}`} />
                )}
                <View className={`step-icon ${isComplete ? 'complete' : ''} ${isProcessing ? 'processing' : ''}`}>
                  {isComplete ? (
                    <Check size={14} color="#fff" />
                  ) : isProcessing ? (
                    <Loader size={14} color="#6366F1" className="spin" />
                  ) : (
                    <StepIcon size={14} color="#CBD5E1" />
                  )}
                </View>
                <Text className={`step-name ${isComplete ? 'complete' : ''}`}>{step.name}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* 推荐结果 */}
      <View className="results-section">
        <View className="section-header">
          <View className="section-title-group">
            <Target size={16} color="#F59E0B" />
            <Text className="card-title">推荐分身</Text>
          </View>
          <Text className="results-count">{avatars.length}位候选</Text>
        </View>

        {loading && avatars.length === 0 ? (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">AI正在分析分身能力...</Text>
          </View>
        ) : avatars.length === 0 && !loading ? (
          <View className="empty-state">
            <Users size={40} color="#CBD5E1" />
            <Text className="empty-text">暂无可用分身</Text>
          </View>
        ) : (
          <ScrollView className="avatar-list" scrollY>
            {avatars.map((avatar, idx) => {
              const isSelected = selectedIds.includes(avatar.id)
              const scoreColor = getScoreColor(avatar.score)
              return (
                <View 
                  key={avatar.id} 
                  className={`avatar-card ${isSelected ? 'selected' : ''} ${idx === 0 ? 'top' : ''}`}
                  onClick={() => toggleSelect(avatar.id)}
                >
                  {idx === 0 && (
                    <View className="top-badge">
                      <Crown size={12} color="#F59E0B" />
                      <Text className="top-badge-text">最佳推荐</Text>
                    </View>
                  )}

                  <View className="card-main">
                    {/* 头像 */}
                    <View className="avatar-avatar">
                      {avatar.avatar_url ? (
                        <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                      ) : (
                        <View className="avatar-fallback">
                          <Bot size={24} color="#6366F1" />
                        </View>
                      )}
                    </View>

                    {/* 信息 */}
                    <View className="avatar-info">
                      <View className="name-row">
                        <Text className="avatar-name">{avatar.name}</Text>
                        <View className="level-tag">
                          <Text className="level-text">Lv.{Math.min(avatar.level, 10)}</Text>
                        </View>
                      </View>
                      
                      <View className="metrics-row">
                        <View className="metric">
                          <TrendingUp size={12} color="#10B981" />
                          <Text className="metric-val">{avatar.completionRate}%</Text>
                        </View>
                        <View className="metric-sep" />
                        <View className="metric">
                          <Star size={12} color="#F59E0B" />
                          <Text className="metric-val">{avatar.avgRating?.toFixed(1) || '4.5'}</Text>
                        </View>
                      </View>

                      <View className="reasons-row">
                        {avatar.matchReasons?.slice(0, 2).map((reason, i) => (
                          <View key={i} className="reason-tag">
                            <Zap size={10} color="#6366F1" />
                            <Text className="reason-text">{reason}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* 匹配分 */}
                    <View className="score-section">
                      <View className="score-circle" style={{ borderColor: scoreColor }}>
                        <Text className="score-num" style={{ color: scoreColor }}>{avatar.score}</Text>
                      </View>
                      <Text className="score-label" style={{ color: scoreColor }}>匹配度</Text>
                    </View>
                  </View>

                  {/* 选择状态 */}
                  <View className={`select-row ${isSelected ? 'selected' : ''}`}>
                    {isSelected ? (
                      <>
                        <Check size={14} color="#fff" />
                        <Text className="select-text">已选择</Text>
                      </>
                    ) : (
                      <>
                        <Text className="select-hint">点击选择</Text>
                        <ArrowRight size={14} color="#94A3B8" />
                      </>
                    )}
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}
      </View>

      {/* 底部操作 */}
      {orderData && !loading && avatars.length > 0 && (
        <View className="bottom-bar">
          <View className="bottom-info">
            <Clock size={14} color="#64748B" />
            <Text className="bottom-tip">已选 {selectedIds.length}/{orderData.avatarCount || 0} 个分身</Text>
          </View>
          <View 
            className={`publish-btn ${selectedIds.length > 0 ? 'active' : ''}`}
            onClick={selectedIds.length > 0 ? handlePublish : undefined}
          >
            {publishing ? (
              <Loader size={18} color="#fff" className="spin" />
            ) : (
              <Sparkles size={18} color="#fff" />
            )}
            <Text className="publish-text">
              {publishing ? '发布中...' : `确认发布 (${selectedIds.length})`}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
