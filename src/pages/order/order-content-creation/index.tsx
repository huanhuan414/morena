import { useLoad, useRouter, navigateBack, showToast, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { getSafeArea } from '@/utils/safe-area'
import { Clock, Loader, Check, X, Smartphone, Sparkles, Zap, ArrowLeft } from 'lucide-react-taro'
import './index.css'

// 订单处理状态类型
type ProcessStatus = 'queuing' | 'generating' | 'preview' | 'publishing' | 'completed' | 'failed'

interface OrderProcessingData {
  requestId: string
  orderId: string
  avatarId: string
  status: ProcessStatus
  queuePosition?: number
  estimatedTime?: number
  generatedContent?: {
    title: string
    content: string
    platforms: string[]
  }
  publishStatus?: {
    platform: string
    status: 'pending' | 'success' | 'failed' | 'manual'
    message?: string
  }
}

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '公众号',
  wechat_moments: '朋友圈',
  wechat_video: '视频号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

export default function OrderContentCreationPage() {
  const router = useRouter()
  const { requestId, avatarId, orderId } = router.params

  const [processingData, setProcessingData] = useState<OrderProcessingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userContent, setUserContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    // 初始化安全区域信息
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)

    if (requestId && avatarId && orderId) {
      console.log('[OrderProcessing] 页面加载，参数:', { requestId, avatarId, orderId })
      startPolling()
    } else {
      console.error('[OrderProcessing] 参数错误', { requestId, avatarId, orderId })
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  // 添加状态变化监听，用于调试
  useEffect(() => {
    console.log('[OrderProcessing] 状态变化:', {
      loading,
      hasProcessingData: !!processingData,
      status: processingData?.status,
      hasGeneratedContent: !!processingData?.generatedContent,
      hasContent: !!processingData?.generatedContent?.content
    })
  }, [loading, processingData])

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  const startPolling = () => {
    console.log('[OrderProcessing] 开始轮询状态')
    // 初始获取处理状态
    fetchProcessingStatus()

    // 每1秒轮询一次状态（从2秒改为1秒，更实时）
    const interval = setInterval(() => {
      fetchProcessingStatus()
    }, 1000)

    setPollInterval(interval)
  }

  const fetchProcessingStatus = async () => {
    try {
      console.log('[OrderProcessing] 开始获取状态:', { requestId })
      const res = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderProcessing] 状态响应:', res.data)

      if (res.data?.code === 200) {
        const data = res.data.data as OrderProcessingData

        // 第一次获取到数据时，设置 loading 为 false
        if (loading) {
          console.log('[OrderProcessing] 首次获取状态成功，取消加载状态')
          setLoading(false)
        }

        // 状态变化时记录日志
        if (processingData?.status && processingData.status !== data.status) {
          console.log('[OrderProcessing] 状态变化:', {
            from: processingData.status,
            to: data.status
          })
        }

        setProcessingData(data)
        setLastUpdateTime(new Date())  // 更新最后更新时间

        // 如果是预览状态且没有编辑过内容，自动填充生成的内容
        if (data.status === 'preview' && !userContent && data.generatedContent?.content) {
          console.log('[OrderProcessing] 自动填充生成的内容')
          setUserContent(data.generatedContent.content)
        }

        // 如果生成完成，停止轮询
        if (data.status === 'preview' || data.status === 'completed' || data.status === 'failed') {
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
          console.log('[OrderProcessing] 状态轮询停止，当前状态:', data.status)
        }
      } else {
        console.error('[OrderProcessing] 获取状态失败:', res.data?.message)
        const errorCount = (processingData as any)?.errorCount || 0
        if (errorCount >= 5) {
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
          showToast({ title: '获取状态失败，请刷新页面', icon: 'none' })
          if (loading) setLoading(false)
        }
        setProcessingData({ ...(processingData as any), errorCount: errorCount + 1 } as any)
      }
    } catch (error) {
      console.error('[OrderProcessing] 请求异常:', error)
      const errorCount = (processingData as any)?.errorCount || 0
      if (errorCount >= 5) {
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        showToast({ title: '网络异常，请刷新页面', icon: 'none' })
      }
      if (loading) setLoading(false)
      setProcessingData({ ...(processingData as any), errorCount: errorCount + 1 } as any)
    }
  }

  const handleConfirmContent = async () => {
    if (!userContent.trim()) {
      showToast({ title: '请确认内容', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await Network.request({
        url: `/api/order-processing/confirm/${requestId}`,
        method: 'POST',
        data: {
          content: userContent
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '已提交，正在发布', icon: 'success' })
        // 开始发布流程
        await startPublish()
      } else {
        showToast({ title: res.data?.message || '提交失败', icon: 'none' })
      }
    } catch (error) {
      console.error('确认内容失败:', error)
      showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const startPublish = async () => {
    try {
      const res = await Network.request({
        url: `/api/order-processing/publish/${requestId}`,
        method: 'POST'
      })

      if (res.data?.code === 200) {
        showToast({ title: '发布成功', icon: 'success' })
        // 跳转到订单详情页
        setTimeout(() => {
          navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
        }, 1500)
      } else {
        showToast({ title: res.data?.message || '发布失败', icon: 'none' })
      }
    } catch (error) {
      console.error('发布失败:', error)
      showToast({ title: '发布失败', icon: 'none' })
    }
  }

  const renderQueuingState = () => (
    <View className="status-card">
      <View className="status-icon queuing">
        <Clock size={48} color="#f59e0b" />
      </View>
      <Text className="status-title block">排队中</Text>
      <Text className="status-desc block">
        当前有 {processingData?.queuePosition || 0} 个任务在队列中
      </Text>
      {processingData?.estimatedTime && (
        <View className="time-estimate">
          <Text className="time-label block">预计等待时间</Text>
          <Text className="time-value block">{processingData.estimatedTime}秒</Text>
        </View>
      )}
      <View className="progress-wrapper">
        <View className="progress-bar queuing">
          <View 
            className="progress-fill" 
            style={{ 
              width: '0%',
              background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
            }}
          />
        </View>
        <Text className="progress-text block">0%</Text>
      </View>
      <Loader size={24} color="#f59e0b" className="loading-spinner" />
    </View>
  )

  const renderGeneratingState = () => (
    <View className="status-card">
      <View className="status-icon generating">
        <Sparkles size={48} color="#3b82f6" />
      </View>
      <Text className="status-title block">生成内容中</Text>
      <Text className="status-desc block">
        AI 正在为您生成优质内容，请稍候...
      </Text>
      <View className="progress-wrapper">
        <View className="progress-bar generating">
          <View 
            className="progress-fill animated" 
            style={{ 
              background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)'
            }}
          />
        </View>
        <Text className="progress-text">生成中...</Text>
      </View>
      <Loader size={24} color="#3b82f6" className="loading-spinner" />
    </View>
  )

  const renderPreviewState = () => {
    return (
      <View className="preview-section">
        <View className="preview-header">
          <Text className="preview-title block">内容预览</Text>
          <Text className="preview-subtitle block">请确认下方内容，如需修改可编辑后提交</Text>
        </View>

        <View className="content-editor">
          <Textarea
            className="content-textarea"
            placeholder="生成的内容将在这里显示"
            value={userContent || processingData?.generatedContent?.content || ''}
            onInput={(e) => setUserContent(e.detail.value)}
            maxlength={2000}
            style={{ width: '100%', minHeight: '200px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '14px', lineHeight: '1.6', color: '#1e293b' }}
          />
        </View>

        <View className="preview-actions">
          <Button
            className="action-btn confirm-btn"
            onClick={handleConfirmContent}
            disabled={submitting}
          >
            {submitting ? (
              <Text className="btn-text block">提交中...</Text>
            ) : (
              <>
                <Check size={20} color="#fff" />
                <Text className="btn-text block">确认并发布</Text>
              </>
            )}
          </Button>
        </View>
      </View>
    )
  }

  const renderPublishingState = () => (
    <View className="status-card">
      <View className="status-icon publishing">
        <Zap size={48} color="#10b981" />
      </View>
      <Text className="status-title block">发布中</Text>
      <Text className="status-desc block">
        正在发布到 {processingData?.generatedContent?.platforms?.map((p: string) => PLATFORM_NAMES[p] || p).join('、') || '目标平台'}...
      </Text>
      <View className="progress-wrapper">
        <View className="progress-bar publishing">
          <View 
            className="progress-fill animated" 
            style={{ 
              background: 'linear-gradient(90deg, #10b981 0%, #22c55e 100%)'
            }}
          />
        </View>
        <Text className="progress-text">发布中...</Text>
      </View>
      <Loader size={24} color="#10b981" className="loading-spinner" />
    </View>
  )

  const renderCompletedState = () => (
    <View className="status-card success">
      <View className="status-icon success">
        <Check size={48} color="#22c55e" />
      </View>
      <Text className="status-title block">发布成功</Text>
      {processingData?.publishStatus?.message && (
        <Text className="status-desc block">{processingData.publishStatus.message}</Text>
      )}
      <Button className="action-btn" onClick={() => navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })}>
        <Text className="btn-text block">查看订单详情</Text>
      </Button>
    </View>
  )

  const renderFailedState = () => (
    <View className="status-card error">
      <View className="status-icon error">
        <X size={48} color="#ef4444" />
      </View>
      <Text className="status-title block">处理失败</Text>
      <Text className="status-desc block">
        内容生成或发布失败，请稍后重试
      </Text>
      <Button className="action-btn" onClick={() => navigateBack()}>
        <Text className="btn-text block">返回</Text>
      </Button>
    </View>
  )

  const renderErrorState = () => (
    <View className="status-card error">
      <View className="status-icon error">
        <X size={48} color="#ef4444" />
      </View>
      <Text className="status-title block">获取状态失败</Text>
      <Text className="status-desc block">
        无法获取订单处理状态，请刷新页面重试
      </Text>
      <Button
        className="action-btn"
        onClick={() => {
          if (pollInterval) {
            clearInterval(pollInterval)
          }
          startPolling()
        }}
      >
        <Text className="btn-text">重新加载</Text>
      </Button>
    </View>
  )

  if (loading) {
    return (
      <View className="order-content-creation-page">
        <View className="loading-wrapper">
          <Loader size={32} color="#00f5ff" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="order-content-creation-page">
      {/* 背景装饰 */}
      <View className="bg-decoration bg-1" />
      <View className="bg-decoration bg-2" />

      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title block">订单处理</Text>
        <View className="header-right" style={{ width: `${capsulePlaceholderWidth}rpx` }} />
      </View>

      <ScrollView className="page-scroll" scrollY>
        {/* 订单基本信息 */}
        {processingData?.generatedContent && (
          <View className="order-info-card">
            <View className="info-header">
              <Sparkles size={20} color="#00f5ff" />
              <Text className="info-title block">订单信息</Text>
            </View>
            <Text className="info-order-title block">{processingData.generatedContent.title}</Text>
            <View className="info-meta">
              <View className="info-meta-item">
                <Smartphone size={16} color="#6366f1" />
                <Text className="info-meta-text block">
                  {processingData.generatedContent.platforms?.map((p: string) => PLATFORM_NAMES[p] || p).join('、') || '未知平台'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 状态展示 */}
        <View className="status-section">
          {/* 显示最后更新时间 */}
          {lastUpdateTime && (
            <View className="last-update-time">
              <Text className="update-time-text block">
                最后更新: {lastUpdateTime.toLocaleTimeString()}
              </Text>
            </View>
          )}

          {/* 如果有多次错误，显示错误状态 */}
          {(processingData as any)?.errorCount >= 5 && renderErrorState()}

          {/* 如果没有错误或错误次数不足5次，显示正常状态 */}
          {(!processingData || (processingData as any)?.errorCount < 5) && (
            <>
              {processingData?.status === 'queuing' && renderQueuingState()}
              {processingData?.status === 'generating' && renderGeneratingState()}
              {processingData?.status === 'preview' && renderPreviewState()}
              {processingData?.status === 'publishing' && renderPublishingState()}
              {processingData?.status === 'completed' && renderCompletedState()}
              {processingData?.status === 'failed' && renderFailedState()}

              {/* 如果有processingData但没有匹配的状态，显示默认状态 */}
              {processingData &&
               !['queuing', 'generating', 'preview', 'publishing', 'completed', 'failed'].includes(processingData.status) && (
                <View className="status-card">
                  <View className="status-icon">
                    <Clock size={48} color="#6366f1" />
                  </View>
                  <Text className="status-title block">等待处理</Text>
                  <Text className="status-desc block">
                    当前状态：{processingData.status}
                  </Text>
                  <View className="progress-wrapper">
                    <View className="progress-bar">
                      <View
                        className="progress-fill animated"
                        style={{
                          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)'
                        }}
                      />
                    </View>
                    <Text className="progress-text block">处理中...</Text>
                  </View>
                  <Loader size={24} color="#6366f1" className="loading-spinner" />
                </View>
              )}
            </>
          )}
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
