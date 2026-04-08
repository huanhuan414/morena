import Taro, { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { 
  Sparkles, ChevronRight, Bot, Star, Zap, Check, 
  TrendingUp, Award, Cpu, Users,
  ArrowRight, Loader, X as CloseIcon,
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

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  'wechat_mp': '微信公众号',
  'xiaohongshu': '小红书',
  'bilibili': 'B站',
  'weibo': '微博',
  'douyin': '抖音',
  'wechat_video': '视频号',
  'zhihu': '知乎',
  'toutiao': '今日头条',
  'baidu': '百度',
  'kuaishou': '快手'
}

const getPlatformName = (platform: string): string => {
  return PLATFORM_NAMES[platform] || platform
}

export default function OrderMatchingPage() {
  const router = useRouter()
  const { orderId } = router.params
  
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<AlgorithmStep[]>(
    ALGORITHM_STEPS.map(s => ({ ...s, status: 'pending', details: s.details }))
  )
  const [matchedAvatars, setMatchedAvatars] = useState<MatchedAvatar[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<MatchedAvatar | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [avatarHistory, setAvatarHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
    
    if (orderId) {
      startMatching()
    }
  })

  const startMatching = async () => {
    setLoading(true)
    setMatchedAvatars([])
    
    // 逐步执行算法动画
    for (let i = 0; i < ALGORITHM_STEPS.length; i++) {
      // 更新当前步骤为 processing
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'processing' } : s
      ))
      
      // 模拟算法处理时间
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // 更新为 completed
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'completed' } : s
      ))
      
      setCurrentStep(i + 1)
    }
    
    // 获取匹配结果
    await fetchMatchingResults()
  }

  const fetchMatchingResults = async () => {
    try {
      // 获取所有推荐分身（不传limit，返回全部）
      const res = await Network.request({
        url: `/api/order-dispatch/recommend/${orderId}`
      })
      
      if (res.data?.code === 200) {
        const avatars = res.data.data || []
        
        if (avatars.length > 0) {
          // 逐步显示分身卡片
          for (let i = 0; i < avatars.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 300))
            setMatchedAvatars(prev => [...prev, avatars[i]])
          }
        } else {
          // 如果没有推荐，显示空状态
          setMatchedAvatars([])
        }
        setLoading(false)
      } else {
        setMatchedAvatars([])
        setLoading(false)
      }
    } catch (error) {
      console.error('获取匹配结果失败:', error)
      showToast({ title: '匹配失败', icon: 'none' })
      setLoading(false)
    }
  }

  const handleSelectAvatar = async (avatar: MatchedAvatar) => {
    setSelectedAvatar(avatar)
    setShowDetail(true)
    setLoadingHistory(true)
    
    try {
      // 获取分身历史订单
      const res = await Network.request({
        url: `/api/order?avatar_id=${avatar.id}&status=completed`
      })
      
      if (res.data?.code === 200) {
        const orders = res.data.data || []
        const history = orders.slice(0, 5).map((o: any) => ({
          id: o.id,
          title: o.title,
          rating: o.rating?.score || 0,
          completed_at: o.completed_at,
          platform: getPlatformName(o.requirements?.platforms?.[0] || '未知')
        }))
        setAvatarHistory(history)
      }
    } catch (error) {
      console.error('获取历史失败:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleConfirmDispatch = async () => {
    if (!selectedAvatar) return
    
    setDispatching(true)
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/dispatch`,
        method: 'POST',
        data: { avatarId: selectedAvatar.id }
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '分配成功', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: res.data?.message || '分配失败', icon: 'none' })
      }
    } catch (error) {
      console.error('分配失败:', error)
      showToast({ title: '分配失败', icon: 'none' })
    } finally {
      setDispatching(false)
    }
  }

  const handleQuickDispatch = async (avatar: MatchedAvatar) => {
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/dispatch`,
        method: 'POST',
        data: { avatarId: avatar.id }
      })
      
      if (res.data?.code === 200) {
        showToast({ title: `已分配给 ${avatar.name}`, icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('分配失败:', error)
      showToast({ title: '分配失败', icon: 'none' })
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
            url: `/api/order-dispatch/${orderId}/dispatch`,
            method: 'POST',
            data: { avatarId: avatar.id }
          })
          
          if (res.data?.code === 200) {
            successCount++
          }
        } catch {
          // 忽略单个失败，继续分配其他分身
        }
      }
      
      if (successCount > 0) {
        showToast({ title: `成功分配给 ${successCount} 个分身`, icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: '分配失败', icon: 'none' })
      }
    } catch (error) {
      console.error('批量分配失败:', error)
      showToast({ title: '分配失败', icon: 'none' })
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

  const getScoreLabel = (score: number) => {
    if (score >= 90) return '完美'
    if (score >= 80) return '优秀'
    if (score >= 70) return '良好'
    return '一般'
  }

  const getEffectColor = (effect: string) => {
    if (effect === '卓越' || effect === '优秀') return '#22c55e'
    if (effect === '良好') return '#3b82f6'
    return '#f59e0b'
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
            <ChevronRight size={24} color="#fff" style={{ transform: 'rotate(180deg)' }} />
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
        <View className="results-header">
          <View className="results-title-row">
            <Crown size={18} color="#fbbf24" />
            <Text className="results-title">推荐分身</Text>
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
                        <Text className="level-text">Lv.{avatar.level}</Text>
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
                      <View className="metric-sep" />
                      <View className="metric-item">
                        <Check size={12} color="#3b82f6" />
                        <Text className="metric-value">{avatar.completedOrders}单</Text>
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
                      {getScoreLabel(avatar.score)}
                    </Text>
                  </View>
                </View>

                {/* 预估效果 */}
                {avatar.estimatedEffect && (
                  <View className="estimated-effect">
                    <View className="effect-header">
                      <Sparkles size={12} color="#8b5cf6" />
                      <Text className="effect-title">预估效果</Text>
                    </View>
                    <View className="effect-grid">
                      <View className="effect-item">
                        <Text className="effect-label">预估曝光</Text>
                        <Text className="effect-value">{avatar.estimatedEffect.reach}</Text>
                      </View>
                      <View className="effect-item">
                        <Text className="effect-label">互动率</Text>
                        <Text className="effect-value">{avatar.estimatedEffect.engagement}</Text>
                      </View>
                      <View className="effect-item">
                        <Text className="effect-label">质量</Text>
                        <Text 
                          className="effect-value quality"
                          style={{ color: getEffectColor(avatar.estimatedEffect.quality) }}
                        >
                          {avatar.estimatedEffect.quality}
                        </Text>
                      </View>
                      <View className="effect-item">
                        <Text className="effect-label">完成时间</Text>
                        <Text className="effect-value">{avatar.estimatedEffect.time}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* 匹配理由 */}
                <View className="match-reasons">
                  {avatar.matchReasons.slice(0, 3).map((reason, i) => (
                    <View key={i} className="reason-tag">
                      <Zap size={10} color="#00f5ff" />
                      <Text className="reason-text">{reason}</Text>
                    </View>
                  ))}
                </View>

                {/* 操作区域 */}
                <View className="card-actions">
                  <View 
                    className="view-detail-btn"
                    onClick={() => handleSelectAvatar(avatar)}
                  >
                    <Text className="view-detail-text">查看详情</Text>
                    <ArrowRight size={14} color="#00f5ff" />
                  </View>
                  <View 
                    className="quick-dispatch-btn"
                    onClick={() => handleQuickDispatch(avatar)}
                  >
                    <Text className="quick-dispatch-text">快速分配</Text>
                  </View>
                </View>
              </View>
            ))}
            
            {/* 统一匹配给所有分身 */}
            {matchedAvatars.length > 0 && !loading && (
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
                    {dispatching ? '分配中...' : `统一匹配给所有分身（{matchedAvatars.length}个）`}
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

      {/* 分身详情弹窗 */}
      {showDetail && selectedAvatar && (
        <View className="detail-overlay" onClick={() => setShowDetail(false)}>
          <View className="detail-modal" onClick={(e: any) => e.stopPropagation()}>
            {/* 头部 */}
            <View className="detail-header">
              <View className="detail-avatar-section">
                <View className="detail-avatar">
                  {selectedAvatar.avatar_url ? (
                    <Image src={selectedAvatar.avatar_url} className="detail-avatar-img" />
                  ) : (
                    <View className="detail-avatar-placeholder">
                      <Bot size={48} color="#00f5ff" />
                    </View>
                  )}
                </View>
                <View className="detail-info">
                  <Text className="detail-name">{selectedAvatar.name}</Text>
                  <View className="detail-badges">
                    <View className="detail-level">
                      <Text className="detail-level-text">Lv.{selectedAvatar.level}</Text>
                    </View>
                    {selectedAvatar.isHosted && (
                      <View className="detail-hosted">
                        <Lightning size={12} color="#fff" />
                        <Text className="detail-hosted-text">已托管</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="detail-score" style={{ borderColor: getScoreColor(selectedAvatar.score) }}>
                  <Text className="detail-score-num" style={{ color: getScoreColor(selectedAvatar.score) }}>
                    {selectedAvatar.score}
                  </Text>
                  <Text className="detail-score-label">{getScoreLabel(selectedAvatar.score)}</Text>
                </View>
              </View>
              <View className="close-btn" onClick={() => setShowDetail(false)}>
                <CloseIcon size={20} color="rgba(255,255,255,0.5)" />
              </View>
            </View>

            {/* 统计数据 */}
            <View className="detail-stats">
              <View className="detail-stat">
                <TrendingUp size={20} color="#22c55e" />
                <Text className="detail-stat-value">{selectedAvatar.completionRate}%</Text>
                <Text className="detail-stat-label">完成率</Text>
              </View>
              <View className="detail-stat">
                <Star size={20} color="#fbbf24" />
                <Text className="detail-stat-value">{selectedAvatar.avgRating || 4.5}</Text>
                <Text className="detail-stat-label">平均评分</Text>
              </View>
              <View className="detail-stat">
                <Check size={20} color="#3b82f6" />
                <Text className="detail-stat-value">{selectedAvatar.completedOrders}</Text>
                <Text className="detail-stat-label">已完成</Text>
              </View>
              <View className="detail-stat">
                <Award size={20} color="#8b5cf6" />
                <Text className="detail-stat-value">¥{selectedAvatar.totalEarnings || 0}</Text>
                <Text className="detail-stat-label">累计收益</Text>
              </View>
            </View>

            {/* 预估效果 */}
            {selectedAvatar.estimatedEffect && (
              <View className="detail-section">
                <Text className="section-title">预估完成效果</Text>
                <View className="effect-cards">
                  <View className="effect-card">
                    <Text className="effect-card-label">预估曝光</Text>
                    <Text className="effect-card-value">{selectedAvatar.estimatedEffect.reach}</Text>
                  </View>
                  <View className="effect-card">
                    <Text className="effect-card-label">互动率</Text>
                    <Text className="effect-card-value">{selectedAvatar.estimatedEffect.engagement}</Text>
                  </View>
                  <View className="effect-card">
                    <Text className="effect-card-label">质量评级</Text>
                    <Text 
                      className="effect-card-value"
                      style={{ color: getEffectColor(selectedAvatar.estimatedEffect.quality) }}
                    >
                      {selectedAvatar.estimatedEffect.quality}
                    </Text>
                  </View>
                  <View className="effect-card">
                    <Text className="effect-card-label">预计工期</Text>
                    <Text className="effect-card-value">{selectedAvatar.estimatedEffect.time}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 技能标签 */}
            <View className="detail-section">
              <Text className="section-title">擅长技能</Text>
              <View className="skill-tags">
                {(selectedAvatar.avatarProfile?.expertise || ['文案创作', '图片设计', '内容策划']).map((skill, i) => (
                  <View key={i} className="skill-tag">
                    <Text className="skill-text">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 平台配置 */}
            <View className="detail-section">
              <Text className="section-title">已配置平台</Text>
              <View className="platform-tags">
                {(selectedAvatar.avatarProfile?.platforms || ['小红书', '微博']).map((platform, i) => (
                  <View key={i} className="platform-tag">
                    <Text className="platform-text">{platform}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 匹配理由 */}
            <View className="detail-section">
              <Text className="section-title">匹配理由</Text>
              <View className="reason-list">
                {selectedAvatar.matchReasons.map((reason, i) => (
                  <View key={i} className="reason-item">
                    <Check size={14} color="#22c55e" />
                    <Text className="reason-item-text">{reason}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 历史案例 */}
            <View className="detail-section">
              <Text className="section-title">完成案例</Text>
              {loadingHistory ? (
                <View className="history-loading">
                  <Loader size={20} color="#00f5ff" className="spin" />
                  <Text className="loading-text">加载中...</Text>
                </View>
              ) : avatarHistory.length > 0 ? (
                <View className="history-list">
                  {avatarHistory.map((item) => (
                    <View key={item.id} className="history-item">
                      <View className="history-info">
                        <Text className="history-title">{item.title}</Text>
                        <Text className="history-meta">{item.platform} · {new Date(item.completed_at).toLocaleDateString()}</Text>
                      </View>
                      <View className="history-rating">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star}
                            size={12}
                            color={star <= item.rating ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="history-empty">
                  <Text className="empty-text">暂无完成案例</Text>
                </View>
              )}
            </View>

            {/* 确认分配按钮 */}
            <View className="detail-actions">
              <Button 
                className="confirm-btn"
                onClick={handleConfirmDispatch}
                disabled={dispatching}
              >
                {dispatching ? (
                  <Loader size={18} color="#fff" className="spin" />
                ) : (
                  <Check size={18} color="#fff" />
                )}
                <Text className="confirm-btn-text">
                  {dispatching ? '分配中...' : `确认分配给 ${selectedAvatar.name}`}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
