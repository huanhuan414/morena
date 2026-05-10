import Taro, { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import {
  Sparkles, ChevronRight, Bot, Star, Zap, Check,
  TrendingUp, Cpu, Users,
  ArrowRight, Loader,
  Brain, Layers, Gauge, Crown, Shield, Zap as Lightning
} from 'lucide-react-taro'
import './index.css'

interface MatchedAvatar {
  id: string
  name: string
  avatar_url: string
  level: number
  score: number
  matchReasons: string[]
  isHosted: boolean
  completionRate: number
  completedOrders: number
  // 预估效果
  estimatedEffect?: {
    reach: string      // 预估曝光
    engagement: string  // 预估互动率
    quality: string    // 预估质量评分
    time: string       // 预估完成时间
  }
  // 额外信息
  avgRating?: number
  totalEarnings?: number
  // 新增：预估收益和任务分配
  estimatedIncome?: number    // 预估收益（元）
  estimatedTaskRatio?: string // 预估任务占比
  // 深度分析数据
  skillMatchScore?: number
  platformMatchScore?: number
  semanticSimilarity?: number
  personalityFit?: number
  experienceMatch?: number
  // 分身画像
  avatarProfile?: {
    expertise?: string[]
    speakingStyle?: string[]
    platforms?: string[]
  }
  // 订单分析
  orderAnalysis?: {
    coreRequirement?: string
    category?: string
    requiredSkills?: string[]
    complexityLevel?: number
  }
}

interface AlgorithmStep {
  id: number
  name: string
  description: string
  status: 'pending' | 'processing' | 'completed'
  score?: number
  details?: string[]
}

const ALGORITHM_STEPS = [
  { 
    id: 1, 
    name: '订单解析', 
    description: '深度理解订单需求', 
    icon: Brain,
    details: ['提取关键词', '分析目标受众', '识别平台偏好']
  },
  { 
    id: 2, 
    name: '分身筛选', 
    description: '智能匹配活跃分身', 
    icon: Users,
    details: ['状态检查', '能力验证', '可用性评估']
  },
  { 
    id: 3, 
    name: '能力评估', 
    description: '量化分身核心指标', 
    icon: Gauge,
    details: ['完成率计算', '等级权重', '经验加成']
  },
  { 
    id: 4, 
    name: '技能匹配', 
    description: '精准技能需求对接', 
    icon: Layers,
    details: ['技能覆盖率', '熟练度评估', '历史表现']
  },
  { 
    id: 5, 
    name: '平台适配', 
    description: '评估平台配置契合', 
    icon: Cpu,
    details: ['平台覆盖', 'API权限', '历史数据']
  },
  { 
    id: 6, 
    name: '综合评分', 
    description: '加权计算最终排名', 
    icon: Shield,
    details: ['权重分配', '分数归一化', '排序输出']
  }
]

export default function OrderMatchingPage() {
  const router = useRouter()
  const { orderId } = router.params

  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<AlgorithmStep[]>(
    ALGORITHM_STEPS.map(s => ({ ...s, status: 'pending', details: s.details }))
  )
  const [matchedAvatars, setMatchedAvatars] = useState<MatchedAvatar[]>([])
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [orderParams, setOrderParams] = useState<any>(null)  // 从创建订单页面传递的参数
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])  // 选中的分身

  const [recommendedCount, setRecommendedCount] = useState(0)  // 推荐分身数量
  const [resolvedOrderId, setResolvedOrderId] = useState<string>('')  // 解析后的订单ID

  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  // 根据订单ID获取订单详情
  const fetchOrderDetails = async (orderIdParam: string) => {
    console.log('[OrderMatching] fetchOrderDetails 开始获取订单:', orderId)
    setLoading(true)
    
    try {
      const res = await Network.request({
        url: `/api/order/${orderIdParam}`,
        method: 'GET'
      })
      
      console.log('[OrderMatching] 获取订单响应:', res.data)
      
      if (res.data.code === 200 && res.data.data) {
        const order = res.data.data
        console.log('[OrderMatching] 获取订单成功:', order)
        
        setOrderParams({
          title: order.title,
          description: order.description,
          platforms: order.platforms,
          requirements: order.requirements || {},
          avatarCount: order.avatar_count || 1,
          totalPrice: order.budget || 0
        })
        
        // 开始匹配流程
        startMatchingWithParams({
          title: order.title,
          description: order.description,
          platforms: order.platforms,
          requirements: order.requirements || {},
          avatarCount: order.avatar_count || 1,
          totalPrice: order.budget || 0
        })
      } else {
        console.error('[OrderMatching] 获取订单失败:', res.data.msg)
        Taro.showToast({ title: '获取订单信息失败', icon: 'none' })
        setLoading(false)
      }
    } catch (err) {
      console.error('[OrderMatching] 获取订单异常:', err)
      Taro.showToast({ title: '网络错误', icon: 'none' })
      setLoading(false)
    }
  }

  useLoad(() => {
    console.log('[OrderMatching] 页面加载')

    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)

    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }

    // 解析订单ID参数（从创建订单页面传递）
    let parsedOrderId = ''
    
    // H5 模式
    const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
    if (isH5) {
      const fullUrl = window.location.href
      console.log('[OrderMatching] H5 URL:', fullUrl)
      
      // 查找 orderId= 的位置
      const questionMarkIndex = fullUrl.indexOf('?')
      if (questionMarkIndex !== -1) {
        const queryString = fullUrl.substring(questionMarkIndex + 1)
        const orderIdMatch = queryString.match(/orderId=([^&]*)/)
        if (orderIdMatch) {
          parsedOrderId = decodeURIComponent(orderIdMatch[1])
        }
      }
      
      // 备用：从 hash 格式获取
      if (!parsedOrderId && fullUrl.includes('#/')) {
        const hashPart = fullUrl.split('#/')[1] || ''
        const hashQuestionMark = hashPart.indexOf('?')
        if (hashQuestionMark !== -1) {
          const hashQuery = hashPart.substring(hashQuestionMark + 1)
          const orderIdMatch = hashQuery.match(/orderId=([^&]*)/)
          if (orderIdMatch) {
            parsedOrderId = decodeURIComponent(orderIdMatch[1])
          }
        }
      }
    } else {
      // 小程序模式
      const pages = Taro.getCurrentPages()
      const currentPage = pages[pages.length - 1]
      parsedOrderId = currentPage?.options?.orderId || ''
    }
    
    console.log('[OrderMatching] 获取到订单ID:', parsedOrderId)
    
    if (!parsedOrderId) {
      console.error('[OrderMatching] 未获取到订单ID')
      Taro.showToast({ title: '订单ID无效', icon: 'none' })
      Taro.navigateBack()
      return
    }
    
    // 根据订单ID获取订单详情
    setResolvedOrderId(parsedOrderId)
    fetchOrderDetails(parsedOrderId)
  })

  // 使用订单参数开始匹配（从创建订单页面跳转）
  const startMatchingWithParams = async (params: any) => {
    console.log('[OrderMatching] startMatchingWithParams 开始执行')
    setLoading(true)
    setMatchedAvatars([])

    // 逐步执行算法动画
    for (let i = 0; i < ALGORITHM_STEPS.length; i++) {
      console.log(`[OrderMatching] 执行步骤 ${i + 1}/${ALGORITHM_STEPS.length}: ${ALGORITHM_STEPS[i].name}`)
      setSteps(prev => prev.map((s, idx) =>
        idx === i ? { ...s, status: 'processing' } : s
      ))
      await new Promise(resolve => setTimeout(resolve, 600))
      setSteps(prev => prev.map((s, idx) =>
        idx === i ? { ...s, status: 'completed' } : s
      ))
      setCurrentStep(i + 1)
    }

    console.log('[OrderMatching] 算法步骤完成，开始获取匹配结果')
    // 获取匹配结果
    await fetchMatchingResultsWithParams(params)
  }

  // 使用订单参数获取匹配结果
  const fetchMatchingResultsWithParams = async (params: any) => {
    try {
      console.log('[OrderMatching] fetchMatchingResultsWithParams 开始执行')
      
      // 调用推荐分身接口，传入订单参数
      const avatarCount = params.avatarCount || 1
      console.log('[OrderMatching] 请求推荐分身，数量:', avatarCount)
      
      const recommendRes = await Network.request({
        url: '/api/recommendation/recommendations',
        method: 'POST',
        data: {
          platforms: params.platforms,
          contentType: params.contentType,
          limit: avatarCount * 3,  // 多获取一些供选择
          requirements: params.requirements
        }
      })
      console.log('[OrderMatching] 推荐分身响应:', recommendRes.data)

      if (recommendRes.data?.code === 200) {
        const avatars = recommendRes.data.data || []
        const totalAvatars = avatars.length
        console.log('[OrderMatching] 推荐分身数量:', totalAvatars)
        setRecommendedCount(totalAvatars)

        // 为每个分身添加预估收益
        const orderBudget = params.totalPrice || 0
        const distributableAmount = orderBudget * 0.8
        const incomePerAvatar = totalAvatars > 0 ? distributableAmount / totalAvatars : 0

        const avatarsWithIncome = avatars.map((avatar: any) => ({
          ...avatar,
          estimatedIncome: incomePerAvatar,
          estimatedTaskRatio: `${Math.round(100 / totalAvatars)}%`,
        }))

        if (totalAvatars > 0) {
          console.log('[OrderMatching] 开始显示分身卡片')
          for (let i = 0; i < totalAvatars; i++) {
            await new Promise(resolve => setTimeout(resolve, 300))
            setMatchedAvatars(prev => [...prev, avatarsWithIncome[i]])
          }
          console.log('[OrderMatching] 分身卡片显示完成')
        } else {
          setMatchedAvatars([])
        }
        setLoading(false)
      } else {
        console.error('[OrderMatching] 推荐分身接口返回失败:', recommendRes.data)
        showToast({ title: recommendRes.data?.message || '获取推荐分身失败', icon: 'none' })
        setMatchedAvatars([])
        setLoading(false)
      }
    } catch (error) {
      console.error('[OrderMatching] 获取匹配结果失败:', error)
      showToast({ title: '匹配失败', icon: 'none' })
      setLoading(false)
    }
  }

  // 切换分身选择
  const toggleAvatarSelection = (avatarId: string) => {
    setSelectedAvatars(prev => {
      if (prev.includes(avatarId)) {
        return prev.filter(id => id !== avatarId)
      } else {
        const maxCount = orderParams?.avatarCount || 1
        if (prev.length >= maxCount) {
          showToast({ title: `最多选择${maxCount}个分身`, icon: 'none' })
          return prev
        }
        return [...prev, avatarId]
      }
    })
  }

  // 发布订单并分配分身
  const handlePublishAndDispatch = async () => {
    if (selectedAvatars.length === 0) {
      showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    setDispatching(true)
    try {
      // 1. 先创建订单
      const orderRes = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: {
          title: orderParams?.title,
          description: orderParams?.description,
          content_type: orderParams?.contentType,
          platforms: orderParams?.platforms,
          requirements: orderParams?.requirements,
          avatar_count: selectedAvatars.length,
          quantity_per_avatar: orderParams?.quantityPerAvatar || 1,
          total_price: orderParams?.totalPrice || 0,
        },
      })

      if (orderRes.data?.code !== 200 && orderRes.data?.code !== 0) {
        showToast({ title: orderRes.data?.msg || '创建订单失败', icon: 'none' })
        setDispatching(false)
        return
      }

      const newOrderId = orderRes.data?.data?.id || resolvedOrderId
      console.log('[OrderMatching] 订单创建成功，订单ID:', newOrderId)

      // 2. 分配选中的分身
      for (const avatarId of selectedAvatars) {
        await Network.request({
          url: `/api/order-dispatch/${newOrderId}/dispatch-avatar`,
          method: 'POST',
          data: { avatarId }
        })
      }

      showToast({ title: '订单发布成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/order/order-list/index' })
      }, 1500)
    } catch (error) {
      console.error('[OrderMatching] 发布订单失败:', error)
      showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  const handleQuickDispatch = async (avatar: MatchedAvatar) => {
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/dispatch-avatar`,
        method: 'POST',
        data: { avatarId: avatar.id }
      })

      if (res.data?.code === 200) {
        showToast({ title: `已分配给 ${avatar.name}，已发送短信通知`, icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: res.data?.message || '分配失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('分配失败:', error)
      // 尝试从错误响应中提取后端返回的错误信息
      let errorMsg = '分配失败'
      if (error?.response?.data?.message) {
        errorMsg = error.response.data.message
      } else if (error?.data?.message) {
        errorMsg = error.data.message
      } else if (error?.message) {
        errorMsg = error.message
      }
      showToast({ title: errorMsg, icon: 'none' })
    }
  }

  // 统一匹配给所有推荐分身
  const handleBatchDispatch = async () => {
    if (matchedAvatars.length === 0) return

    setDispatching(true)
    let successCount = 0

    try {
      for (const avatar of matchedAvatars) {
        try {
          const res = await Network.request({
            url: `/api/order-dispatch/${orderId}/dispatch-avatar`,
            method: 'POST',
            data: { avatarId: avatar.id }
          })

          if (res.data?.code === 200) {
            successCount++
          }
        } catch (error: any) {
          // 忽略单个失败，继续分配其他分身，但记录错误信息用于最后提示
          let errorMsg = '分配失败'
          if (error?.response?.data?.message) {
            errorMsg = error.response.data.message
          } else if (error?.data?.message) {
            errorMsg = error.data.message
          } else if (error?.message) {
            errorMsg = error.message
          }
          console.error(`分配给 ${avatar.name} 失败:`, errorMsg)
        }
      }

      if (successCount > 0) {
        showToast({ title: `成功分配给 ${successCount} 个分身，已发送短信通知`, icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: '分配失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('批量分配失败:', error)
      let errorMsg = '分配失败'
      if (error?.response?.data?.message) {
        errorMsg = error.response.data.message
      } else if (error?.data?.message) {
        errorMsg = error.data.message
      } else if (error?.message) {
        errorMsg = error.message
      }
      showToast({ title: errorMsg, icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#22c55e'
    if (score >= 80) return '#3b82f6'
    if (score >= 70) return '#f59e0b'
    return '#6b7280'
  }

  return (
    <View className="matching-page">
      {/* 背景光效 */}
      <View className="bg-gradient" />
      <View className="bg-grid" />
      
      {/* 粒子效果 */}
      <View className="particle-container">
        {[...Array(30)].map((_, i) => (
          <View 
            key={i} 
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${8 + Math.random() * 7}s`
            }}
          />
        ))}
      </View>

      {/* 头部 */}
      <View className="matching-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-top">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ChevronRight size={24} color="#334155" style={{ transform: 'rotate(180deg)' }} />
          </View>
          <View className="header-title-wrap">
            <Sparkles size={20} color="#00f5ff" />
            <Text className="page-title">AI智能匹配</Text>
          </View>
          <View className="header-spacer" style={{ width: `${capsuleWidth}rpx` }} />
        </View>
        
        {/* 进度条 */}
        <View className="progress-container">
          <View className="progress-track">
            <View 
              className="progress-fill"
              style={{ width: `${(currentStep / ALGORITHM_STEPS.length) * 100}%` }}
            />
            <View 
              className="progress-glow"
              style={{ left: `${(currentStep / ALGORITHM_STEPS.length) * 100}%` }}
            />
          </View>
          <Text className="progress-text">
            {currentStep < ALGORITHM_STEPS.length 
              ? `第 ${currentStep + 1} 步：${ALGORITHM_STEPS[currentStep]?.name}` 
              : '匹配完成'}
          </Text>
        </View>
      </View>

      {/* 算法可视化区域 */}
      <View className="algorithm-section">
        <View className="algorithm-header">
          <View className="algorithm-title-row">
            <Brain size={18} color="#00f5ff" />
            <Text className="algorithm-title">智能匹配引擎</Text>
          </View>
          <View className="algorithm-badge">
            <Text className="badge-text">实时分析中</Text>
          </View>
        </View>
        
        <View className="algorithm-steps">
          {steps.map((step, idx) => {
            const StepIcon = ALGORITHM_STEPS[idx].icon
            return (
              <View 
                key={step.id} 
                className={`step-item step-${step.status}`}
              >
                {/* 连接线 */}
                {idx > 0 && (
                  <View className={`step-connector ${steps[idx - 1].status === 'completed' ? 'active' : ''}`} />
                )}
                
                {/* 步骤图标 */}
                <View className="step-icon-ring">
                  <View className={`step-icon-bg ${step.status}`}>
                    {step.status === 'processing' ? (
                      <Loader size={18} color="#00f5ff" className="spin" />
                    ) : step.status === 'completed' ? (
                      <Check size={18} color="#22c55e" />
                    ) : (
                      <StepIcon size={18} color="rgba(255,255,255,0.3)" />
                    )}
                  </View>
                </View>
                
                {/* 步骤内容 */}
                <View className="step-content">
                  <View className="step-header">
                    <Text className={`step-name ${step.status}`}>{step.name}</Text>
                    {step.status === 'completed' && (
                      <View className="step-check">
                        <Check size={12} color="#22c55e" />
                      </View>
                    )}
                  </View>
                  <Text className="step-desc">{step.description}</Text>
                  
                  {/* 子步骤详情 */}
                  {step.status === 'completed' && step.details && (
                    <View className="step-details">
                      {step.details.map((detail, i) => (
                        <View key={i} className="detail-item">
                          <View className="detail-dot" />
                          <Text className="detail-text">{detail}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                
                {/* 步骤编号 */}
                <View className={`step-number ${step.status}`}>
                  <Text className="number-text">{step.id}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 匹配结果区域 */}
      <View className="results-section">
        {/* 订单信息头部（从创建订单页面跳转时显示） */}
        {orderParams && (
          <View className="order-info-banner">
            <View className="order-info-content">
              <Text className="order-info-title">{orderParams.title}</Text>
              <View className="order-info-tags">
                {orderParams.platforms?.map((p: string) => (
                  <Text key={p} className="order-tag">{p}</Text>
                ))}
              </View>
            </View>
            <View className="selection-summary">
              <Text className="selection-label">已选</Text>
              <Text className="selection-count">{selectedAvatars.length}/{orderParams.avatarCount || 1}</Text>
            </View>
          </View>
        )}

        <View className="results-header">
          <View className="results-title-row">
            <Crown size={18} color="#fbbf24" />
            <Text className="results-title">{orderParams ? '选择接单分身' : '推荐分身'}</Text>
          </View>
          <Text className="results-count">{matchedAvatars.length} 位候选</Text>
        </View>

        {loading && matchedAvatars.length === 0 ? (
          <View className="loading-avatars">
            <View className="loading-ring" />
            <Text className="loading-text">AI正在分析分身能力...</Text>
          </View>
        ) : matchedAvatars.length === 0 ? (
          <View className="empty-avatars">
            <Users size={48} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">暂无可用分身</Text>
          </View>
        ) : (
          <ScrollView className="avatar-list" scrollY>
            {matchedAvatars.map((avatar, idx) => (
              <View 
                key={avatar.id} 
                className={`avatar-card ${idx === 0 ? 'rank-1-card' : ''}`}
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                {/* 第一名最佳推荐标签 */}
                {idx === 0 && (
                  <View className="best-match-badge">
                    <Text className="best-match-text">最佳推荐</Text>
                  </View>
                )}

                {/* 排名 */}
                <View className={`rank-badge rank-${idx + 1}`}>
                  {idx === 0 ? (
                    <Crown size={14} color="#fff" />
                  ) : (
                    <Text className="rank-num">#{idx + 1}</Text>
                  )}
                </View>

                {/* 主内容 */}
                <View className="avatar-main">
                  {/* 头像区域 */}
                  <View className="avatar-avatar-wrap">
                    <View className="avatar-avatar">
                      {avatar.avatar_url ? (
                        <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                      ) : (
                        <View className="avatar-placeholder">
                          <Bot size={32} color="#00f5ff" />
                        </View>
                      )}
                    </View>
                    {avatar.isHosted && (
                      <View className="hosted-indicator">
                        <Lightning size={10} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* 信息区域 */}
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
                  </View>

                  {/* 匹配分 */}
                  <View className="match-score-wrap">
                    <View
                      className="match-score-ring"
                      style={{ borderColor: getScoreColor(avatar.score) }}
                    >
                      <Text
                        className="score-num"
                        style={{ color: getScoreColor(avatar.score) }}
                      >
                        {avatar.score}
                      </Text>
                    </View>
                    <Text
                      className="score-label"
                      style={{ color: getScoreColor(avatar.score) }}
                    >
                      匹配度
                    </Text>
                  </View>
                </View>

                {/* 匹配理由 */}
                <View className="match-reasons">
                  {avatar.matchReasons.slice(0, 2).map((reason, i) => (
                    <View key={i} className="reason-tag">
                      <Zap size={10} color="#00f5ff" />
                      <Text className="reason-text">{reason}</Text>
                    </View>
                  ))}
                </View>

                {/* 操作区域 */}
                <View className="card-actions">
                  {orderParams ? (
                    // 选择模式
                    <View
                      className={`select-avatar-btn ${selectedAvatars.includes(avatar.id) ? 'selected' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => toggleAvatarSelection(avatar.id)}
                    >
                      {selectedAvatars.includes(avatar.id) ? (
                        <>
                          <Check size={16} color="#fff" />
                          <Text className="select-text selected">已选择</Text>
                        </>
                      ) : (
                        <>
                          <Text className="select-text">选择此分身</Text>
                          <ArrowRight size={14} color="#00f5ff" />
                        </>
                      )}
                    </View>
                  ) : (
                    // 分配模式
                    <View
                      className="view-detail-btn"
                      style={{ flex: 1 }}
                      onClick={() => handleQuickDispatch(avatar)}
                    >
                      <Text className="view-detail-text">分配给此分身</Text>
                      <ArrowRight size={14} color="#00f5ff" />
                    </View>
                  )}
                </View>
              </View>
            ))}
            
            {/* 发布订单按钮（从创建订单页面跳转时显示） */}
            {orderParams && matchedAvatars.length > 0 && !loading && (
              <View className="publish-order-section">
                <Button 
                  className={`publish-order-btn ${selectedAvatars.length > 0 ? 'active' : 'disabled'}`}
                  onClick={selectedAvatars.length > 0 ? handlePublishAndDispatch : undefined}
                  disabled={dispatching || selectedAvatars.length === 0}
                >
                  {dispatching ? (
                    <Loader size={20} color="#fff" className="spin" />
                  ) : (
                    <Sparkles size={20} color="#fff" />
                  )}
                  <Text className="publish-text">
                    {dispatching ? '发布中...' : `确认发布（已选 ${selectedAvatars.length} 个分身）`}
                  </Text>
                </Button>
                <Text className="publish-tip">
                  订单将自动分配给选中的分身
                </Text>
              </View>
            )}

            {/* 统一匹配给所有分身（无订单参数时显示） */}
            {!orderParams && matchedAvatars.length > 0 && !loading && (
              <View className="batch-dispatch-section">
                <Button 
                  className="batch-dispatch-btn"
                  onClick={handleBatchDispatch}
                  disabled={dispatching}
                >
                  {dispatching ? (
                    <Loader size={20} color="#fff" className="spin" />
                  ) : (
                    <Users size={20} color="#fff" />
                  )}
                  <Text className="batch-dispatch-text">
                    {dispatching ? '分配中...' : `统一匹配给所有分身（${recommendedCount}个）`}
                  </Text>
                </Button>
                <Text className="batch-dispatch-tip">
                  系统将按匹配度自动分配给所有推荐分身
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

    </View>
  )
}
