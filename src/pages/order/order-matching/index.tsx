import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { 
  ChevronLeft, Sparkles, Brain, Target, Zap, Users, Crown, 
  Star, TrendingUp, Check, Loader, Bot, ArrowRight,
  Bell, Shuffle, UserPlus
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

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  text: { label: '文字', icon: 'T' },
  image: { label: '图文', icon: 'I' },
  video: { label: '视频', icon: 'V' },
  audio: { label: '音频', icon: 'A' },
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
  quantityPerAvatar?: number
  deadline?: string
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
  taskCount?: number
  earnings?: number
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
  const [dispatchingAll, setDispatchingAll] = useState(false)
  const [notifying, setNotifying] = useState(false)

  // 获取订单ID
  useEffect(() => {
    const id = router.params.orderId
    if (id) {
      setOrderId(id)
      loadOrder(id)
    } else {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        const params = new URLSearchParams(window.location.search)
        const orderIdFromUrl = params.get('orderId')
        if (orderIdFromUrl) {
          setOrderId(orderIdFromUrl)
          loadOrder(orderIdFromUrl)
        } else {
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
          budget: order.budget || order.total_price || 0,
          quantityPerAvatar: order.quantityPerAvatar || order.quantity_per_avatar || 1,
          deadline: order.deadline || requirements?.deadline,
        })
        
        runMatchingAlgorithm(platforms, order.contentType || order.content_type, requirements)
      }
    } catch (err) {
      console.error('加载订单失败:', err)
      setLoading(false)
    }
  }

  // 运行匹配算法
  const runMatchingAlgorithm = async (platforms: string[], contentType: string, requirements: any) => {
    for (let i = 0; i < STEPS.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))
      setCurrentStep(i + 1)
    }
    
    try {
      const res = await Network.request({
        url: '/api/recommendation/recommendations',
        method: 'POST',
        data: {
          platforms: platforms,
          contentType: contentType,
          limit: 10,
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

  // 选择/取消选择分身
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

  // 全选分身
  const selectAll = () => {
    setSelectedIds(avatars.map(a => a.id))
    Taro.showToast({ title: `已选择全部 ${avatars.length} 个分身`, icon: 'none' })
  }

  // 发布订单（分配给选中的分身）
  const handlePublish = async () => {
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    setPublishing(true)
    try {
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

  // 一键分配给所有分身
  const handleDispatchAll = async () => {
    if (avatars.length === 0) {
      Taro.showToast({ title: '暂无可分配分身', icon: 'none' })
      return
    }

    setDispatchingAll(true)
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/dispatch-all`,
        method: 'POST'
      })

      if (res.data?.code === 200) {
        const count = res.data?.data?.count || 0
        Taro.showToast({ title: `已分配给 ${count} 个分身`, icon: 'success' })
        // 发送短信通知
        setTimeout(() => {
          handleNotify(avatars.map(a => a.id))
        }, 500)
      }
    } catch (err) {
      console.error('分配失败:', err)
      Taro.showToast({ title: '分配失败', icon: 'none' })
    } finally {
      setDispatchingAll(false)
    }
  }

  // 发送短信通知
  const handleNotify = async (avatarIds?: string[]) => {
    const ids = avatarIds || selectedIds
    if (ids.length === 0) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    setNotifying(true)
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/${orderId}/notify`,
        method: 'POST',
        data: { avatarIds: ids }
      })

      if (res.data?.code === 200) {
        const count = res.data?.data?.count || 0
        Taro.showToast({ title: `已发送 ${count} 条通知`, icon: 'success' })
      }
    } catch (err) {
      console.error('通知发送失败:', err)
      Taro.showToast({ title: '通知发送失败', icon: 'none' })
    } finally {
      setNotifying(false)
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

  // 获取内容类型标签
  const getContentTypeLabel = (type?: string) => {
    return CONTENT_TYPE_CONFIG[type || '']?.label || type || '综合'
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
          <View className="header-actions">
            {avatars.length > 0 && (
              <View className="action-btn" onClick={selectAll}>
                <UserPlus size={18} color="#fff" />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 订单信息卡片 */}
      {orderData && (
        <View className="order-card">
          <View className="order-header">
            <View className="order-title-wrap">
              <Text className="order-title">{orderData.title}</Text>
              <View className="content-type-badge">
                <Text className="content-type-text">{getContentTypeLabel(orderData.contentType)}</Text>
              </View>
            </View>
            <View className="order-price">
              <Text className="price-symbol">¥</Text>
              <Text className="price-value">{orderData.budget}</Text>
            </View>
          </View>
          
          <View className="order-meta-row">
            <View className="platform-tags">
              {orderData.platforms?.map((p: string) => {
                const config = PLATFORM_CONFIG[p] || { label: p, color: '#6366F1' }
                return (
                  <View key={p} className="platform-tag" style={{ backgroundColor: config.color + '15', borderColor: config.color + '40' }}>
                    <Text className="platform-tag-text" style={{ color: config.color }}>{config.label}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View className="order-stats-row">
            <View className="stat-item">
              <Users size={14} color="#6366F1" />
              <Text className="stat-num">{orderData.avatarCount || 0}</Text>
              <Text className="stat-label">需要</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-num selected">{selectedIds.length}</Text>
              <Text className="stat-label">已选</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-num">{avatars.length}</Text>
              <Text className="stat-label">候选</Text>
            </View>
            {orderData.quantityPerAvatar && orderData.quantityPerAvatar > 1 && (
              <>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Text className="stat-num">{orderData.quantityPerAvatar}</Text>
                  <Text className="stat-label">份/分身</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* 算法进度 */}
      <View className="algorithm-card">
        <View className="card-header">
          <Brain size={16} color="#6366F1" />
          <Text className="card-title">智能匹配算法</Text>
          {currentStep === STEPS.length && (
            <View className="algorithm-badge">
              <Check size={12} color="#10B981" />
              <Text className="badge-text">完成</Text>
            </View>
          )}
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
            <Text className="section-title">推荐分身</Text>
          </View>
          <View className="results-meta">
            <Text className="results-count">{avatars.length} 位候选</Text>
            {selectedIds.length > 0 && (
              <View className="selected-badge">
                <Check size={12} color="#fff" />
                <Text className="selected-text">已选 {selectedIds.length}</Text>
              </View>
            )}
          </View>
        </View>

        {loading && avatars.length === 0 ? (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">AI正在分析分身能力...</Text>
            <Text className="loading-sub">正在匹配最佳分身</Text>
          </View>
        ) : avatars.length === 0 && !loading ? (
          <View className="empty-state">
            <Users size={48} color="#CBD5E1" />
            <Text className="empty-text">暂无可用分身</Text>
            <Text className="empty-sub">请先创建分身</Text>
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
                          <Bot size={28} color="#6366F1" />
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
                        {avatar.taskCount !== undefined && avatar.taskCount > 0 && (
                          <>
                            <View className="metric-sep" />
                            <View className="metric">
                              <Text className="metric-val secondary">{avatar.taskCount}单</Text>
                            </View>
                          </>
                        )}
                      </View>

                      <View className="reasons-row">
                        {avatar.matchReasons?.slice(0, 3).map((reason, i) => (
                          <View key={i} className="reason-tag">
                            <Zap size={10} color="#6366F1" />
                            <Text className="reason-text">{reason}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* 匹配分 */}
                    <View className="score-section">
                      <View className="score-circle" style={{ borderColor: scoreColor, backgroundColor: scoreColor + '10' }}>
                        <Text className="score-num" style={{ color: scoreColor }}>{avatar.score}</Text>
                      </View>
                      <Text className="score-label" style={{ color: scoreColor }}>匹配度</Text>
                    </View>
                  </View>

                  {/* 选择状态 */}
                  <View className={`select-row ${isSelected ? 'selected' : ''}`}>
                    {isSelected ? (
                      <>
                        <Check size={16} color="#fff" />
                        <Text className="select-text">已选择</Text>
                      </>
                    ) : (
                      <>
                        <Text className="select-hint">点击选择接单</Text>
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

      {/* 底部操作栏 */}
      {orderData && !loading && avatars.length > 0 && (
        <View className="bottom-bar">
          {/* 快速操作 */}
          <View className="quick-actions">
            <View 
              className={`quick-btn ${dispatchingAll ? 'loading' : ''}`}
              onClick={dispatchingAll ? undefined : handleDispatchAll}
            >
              {dispatchingAll ? (
                <Loader size={16} color="#6366F1" className="spin" />
              ) : (
                <Shuffle size={16} color="#6366F1" />
              )}
              <Text className="quick-btn-text">一键全部分配</Text>
            </View>
            
            {selectedIds.length > 0 && (
              <View 
                className={`quick-btn notify ${notifying ? 'loading' : ''}`}
                onClick={notifying ? undefined : () => handleNotify()}
              >
                {notifying ? (
                  <Loader size={16} color="#F59E0B" className="spin" />
                ) : (
                  <Bell size={16} color="#F59E0B" />
                )}
                <Text className="quick-btn-text warn">通知 ({selectedIds.length})</Text>
              </View>
            )}
          </View>
          
          {/* 确认发布 */}
          <View className="publish-row">
            <View className="publish-info">
              <Text className="publish-tip">已选 {selectedIds.length}/{orderData.avatarCount || 0} 个</Text>
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
                {publishing ? '发布中...' : `确认发布`}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
