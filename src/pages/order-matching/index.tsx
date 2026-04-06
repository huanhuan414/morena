import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { 
  Sparkles, ChevronRight, Bot, Star, Zap, Target, Check, 
  TrendingUp, Award, Cpu, Users,
  ArrowRight, Loader, X as CloseIcon, ChartBarBig
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
  // 额外信息
  user_id?: string
  skills?: string[]
  platforms?: string[]
  totalEarnings?: number
  avgRating?: number
  completedCount?: number
}

interface AlgorithmStep {
  id: number
  name: string
  description: string
  status: 'pending' | 'processing' | 'completed'
  score?: number
}

interface CaseStudy {
  id: string
  title: string
  rating: number
  completed_at: string
  platform: string
}

const ALGORITHM_STEPS = [
  { id: 1, name: '订单解析', description: '分析订单需求、技能要求、平台偏好', icon: Target },
  { id: 2, name: '分身筛选', description: '过滤符合条件的活跃分身', icon: Users },
  { id: 3, name: '能力评估', description: '计算分身完成率、等级、经验值', icon: ChartBarBig },
  { id: 4, name: '技能匹配', description: '匹配订单技能与分身能力', icon: Zap },
  { id: 5, name: '平台适配', description: '评估分身平台配置匹配度', icon: Cpu },
  { id: 6, name: '综合评分', description: '加权计算最终匹配分数', icon: Award }
]

export default function OrderMatchingPage() {
  const router = useRouter()
  const { orderId } = router.params
  
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<AlgorithmStep[]>(
    ALGORITHM_STEPS.map(s => ({ ...s, status: 'pending' }))
  )
  const [matchedAvatars, setMatchedAvatars] = useState<MatchedAvatar[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<MatchedAvatar | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [avatarHistory, setAvatarHistory] = useState<CaseStudy[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useLoad(() => {
    if (orderId) {
      startMatching()
    }
  })

  const startMatching = async () => {
    setLoading(true)
    
    // 逐步执行算法动画
    for (let i = 0; i < ALGORITHM_STEPS.length; i++) {
      // 更新当前步骤为 processing
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'processing' } : s
      ))
      
      // 模拟算法处理时间
      await new Promise(resolve => setTimeout(resolve, 800))
      
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
      // 先获取推荐分身列表
      const res = await Network.request({
        url: `/api/order-dispatch/recommend/${orderId}`
      })
      
      if (res.data?.code === 200) {
        const avatars = res.data.data || []
        
        // 逐步显示分身卡片
        for (let i = 0; i < avatars.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 300))
          setMatchedAvatars(prev => [...prev, avatars[i]])
        }
        
        // 如果没有推荐，模拟一些示例数据
        if (avatars.length === 0) {
          const mockAvatars: MatchedAvatar[] = [
            {
              id: '1',
              name: '小雅',
              avatar_url: '',
              level: 8,
              score: 95,
              matchReasons: ['技能匹配度 98%', '平台配置完整', '完成率 96%', '响应速度快'],
              isHosted: true,
              completionRate: 96,
              completedOrders: 128,
              skills: ['文案创作', '小红书运营', '图片设计'],
              platforms: ['小红书', '微博'],
              totalEarnings: 15800,
              avgRating: 4.8
            },
            {
              id: '2',
              name: '墨渊',
              avatar_url: '',
              level: 12,
              score: 88,
              matchReasons: ['高级分身', '经验丰富', '擅长内容策划'],
              isHosted: true,
              completionRate: 92,
              completedOrders: 256,
              skills: ['内容策划', '视频创作', '社群运营'],
              platforms: ['B站', '抖音'],
              totalEarnings: 32600,
              avgRating: 4.9
            },
            {
              id: '3',
              name: '星尘',
              avatar_url: '',
              level: 5,
              score: 82,
              matchReasons: ['性价比高', '学习能力强', '创意丰富'],
              isHosted: false,
              completionRate: 88,
              completedOrders: 45,
              skills: ['文案创作', '图文设计'],
              platforms: ['小红书'],
              totalEarnings: 5600,
              avgRating: 4.6
            }
          ]
          
          for (let i = 0; i < mockAvatars.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 400))
            setMatchedAvatars(prev => [...prev, mockAvatars[i]])
          }
        }
        
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
        const history: CaseStudy[] = orders.slice(0, 5).map((o: any) => ({
          id: o.id,
          title: o.title,
          rating: o.rating?.score || 0,
          completed_at: o.completed_at,
          platform: o.requirements?.platforms?.[0] || '未知'
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
      }
    } catch (error) {
      console.error('分配失败:', error)
      showToast({ title: '分配失败', icon: 'none' })
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#22c55e'
    if (score >= 80) return '#3b82f6'
    if (score >= 70) return '#f59e0b'
    return '#6b7280'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return '完美匹配'
    if (score >= 80) return '优秀'
    if (score >= 70) return '良好'
    return '一般'
  }

  return (
    <View className="matching-page">
      {/* 背景粒子效果 */}
      <View className="particle-bg">
        {[...Array(20)].map((_, i) => (
          <View 
            key={i} 
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`
            }}
          />
        ))}
      </View>

      {/* 头部 */}
      <View className="matching-header">
        <View className="header-top">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ChevronRight size={24} color="#fff" style={{ transform: 'rotate(180deg)' }} />
          </View>
          <Text className="page-title">智能匹配中</Text>
          <View className="header-spacer" />
        </View>
        
        {/* 进度指示器 */}
        <View className="progress-indicator">
          <View className="progress-bar">
            <View 
              className="progress-fill"
              style={{ width: `${(currentStep / ALGORITHM_STEPS.length) * 100}%` }}
            />
          </View>
          <Text className="progress-text">
            {currentStep < ALGORITHM_STEPS.length 
              ? `正在执行: ${ALGORITHM_STEPS[currentStep]?.name || ''}` 
              : '匹配完成'}
          </Text>
        </View>
      </View>

      {/* 算法可视化区域 */}
      <View className="algorithm-section">
        <View className="algorithm-title">
          <Sparkles size={20} color="#00f5ff" />
          <Text className="title-text">AI智能匹配算法</Text>
        </View>
        
        <View className="algorithm-steps">
          {steps.map((step, idx) => {
            const StepIcon = ALGORITHM_STEPS[idx].icon
            return (
              <View key={step.id} className={`step-item ${step.status}`}>
                <View className="step-icon-wrapper">
                  {step.status === 'processing' ? (
                    <Loader size={20} color="#00f5ff" className="animate-spin" />
                  ) : step.status === 'completed' ? (
                    <Check size={20} color="#22c55e" />
                  ) : (
                    <StepIcon size={20} color="rgba(255,255,255,0.2)" />
                  )}
                </View>
                <View className="step-info">
                  <Text className="step-name">{step.name}</Text>
                  {step.status === 'processing' && (
                    <Text className="step-desc">{step.description}</Text>
                  )}
                </View>
                {step.score !== undefined && (
                  <View className="step-score">
                    <Text className="score-value">{step.score}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </View>

      {/* 匹配结果区域 */}
      <View className="results-section">
        <View className="results-header">
          <Text className="results-title">匹配结果</Text>
          <Text className="results-count">{matchedAvatars.length} 个推荐分身</Text>
        </View>

        {loading && matchedAvatars.length === 0 ? (
          <View className="loading-avatars">
            <Loader size={32} color="#00f5ff" className="animate-spin" />
            <Text className="loading-text">正在分析分身能力...</Text>
          </View>
        ) : (
          <ScrollView className="avatar-list" scrollY>
            {matchedAvatars.map((avatar, idx) => (
              <View 
                key={avatar.id} 
                className="avatar-card"
                style={{ animationDelay: `${idx * 0.1}s` }}
                onClick={() => handleSelectAvatar(avatar)}
              >
                {/* 排名标签 */}
                <View className={`rank-badge rank-${idx + 1}`}>
                  <Text className="rank-text">#{idx + 1}</Text>
                </View>

                <View className="avatar-main">
                  {/* 头像 */}
                  <View className="avatar-avatar">
                    {avatar.avatar_url ? (
                      <Image src={avatar.avatar_url} className="avatar-img" />
                    ) : (
                      <View className="avatar-placeholder">
                        <Bot size={28} color="#00f5ff" />
                      </View>
                    )}
                    {avatar.isHosted && (
                      <View className="hosted-badge">
                        <Sparkles size={10} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* 信息 */}
                  <View className="avatar-info">
                    <View className="avatar-name-row">
                      <Text className="avatar-name">{avatar.name}</Text>
                      <View className="level-badge">
                        <Text className="level-text">Lv.{avatar.level}</Text>
                      </View>
                    </View>
                    <View className="avatar-stats">
                      <View className="stat-item">
                        <TrendingUp size={12} color="#22c55e" />
                        <Text className="stat-value">{avatar.completionRate}%</Text>
                      </View>
                      <View className="stat-divider" />
                      <View className="stat-item">
                        <Star size={12} color="#eab308" />
                        <Text className="stat-value">{avatar.avgRating || 4.5}</Text>
                      </View>
                      <View className="stat-divider" />
                      <View className="stat-item">
                        <Check size={12} color="#3b82f6" />
                        <Text className="stat-value">{avatar.completedOrders}单</Text>
                      </View>
                    </View>
                  </View>

                  {/* 匹配分 */}
                  <View className="match-score" style={{ borderColor: getScoreColor(avatar.score) }}>
                    <Text className="score-num" style={{ color: getScoreColor(avatar.score) }}>
                      {avatar.score}
                    </Text>
                    <Text className="score-label">{getScoreLabel(avatar.score)}</Text>
                  </View>
                </View>

                {/* 匹配理由 */}
                <View className="match-reasons">
                  {avatar.matchReasons.slice(0, 3).map((reason, i) => (
                    <View key={i} className="reason-tag">
                      <Text className="reason-text">{reason}</Text>
                    </View>
                  ))}
                </View>

                <View className="card-arrow">
                  <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
                </View>
              </View>
            ))}
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
                        <Sparkles size={12} color="#fff" />
                        <Text className="detail-hosted-text">已托管</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="detail-score" style={{ background: `${getScoreColor(selectedAvatar.score)}20` }}>
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
                <TrendingUp size={24} color="#22c55e" />
                <Text className="detail-stat-value">{selectedAvatar.completionRate}%</Text>
                <Text className="detail-stat-label">完成率</Text>
              </View>
              <View className="detail-stat">
                <Star size={24} color="#eab308" />
                <Text className="detail-stat-value">{selectedAvatar.avgRating || 4.5}</Text>
                <Text className="detail-stat-label">平均评分</Text>
              </View>
              <View className="detail-stat">
                <Check size={24} color="#3b82f6" />
                <Text className="detail-stat-value">{selectedAvatar.completedOrders}</Text>
                <Text className="detail-stat-label">已完成订单</Text>
              </View>
              <View className="detail-stat">
                <Award size={24} color="#8b5cf6" />
                <Text className="detail-stat-value">¥{selectedAvatar.totalEarnings || 0}</Text>
                <Text className="detail-stat-label">累计收益</Text>
              </View>
            </View>

            {/* 技能标签 */}
            <View className="detail-section">
              <Text className="section-title">擅长技能</Text>
              <View className="skill-tags">
                {(selectedAvatar.skills || ['文案创作', '图片设计', '内容策划']).map((skill, i) => (
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
                {(selectedAvatar.platforms || ['小红书', '微博']).map((platform, i) => (
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
                  <Loader size={20} color="#00f5ff" className="animate-spin" />
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
                            color={star <= item.rating ? '#eab308' : 'rgba(255,255,255,0.2)'}
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
              >
                <Check size={18} color="#fff" />
                <Text>确认分配此分身</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
