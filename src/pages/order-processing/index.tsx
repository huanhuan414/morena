import { useLoad, useRouter, navigateBack, showToast, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { Clock, Loader, Check, X, Smartphone, Calendar, Sparkles, Zap, ArrowLeft } from 'lucide-react-taro'
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
    platform: string
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

export default function OrderProcessingPage() {
  const router = useRouter()
  const { requestId, avatarId, orderId } = router.params

  const [orderData, setOrderData] = useState<any>(null)
  const [processingData, setProcessingData] = useState<OrderProcessingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userContent, setUserContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  useLoad(() => {
    if (requestId && avatarId && orderId) {
      fetchOrderData()
      startPolling()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  const startPolling = () => {
    // 初始获取处理状态
    fetchProcessingStatus()

    // 每2秒轮询一次状态
    const interval = setInterval(() => {
      fetchProcessingStatus()
    }, 2000)

    setPollInterval(interval)
  }

  const fetchOrderData = async () => {
    try {
      const res = await Network.request({ url: `/api/order-dispatch/pending-requests` })
      if (res.data?.code === 200) {
        const requests = res.data.data
        const request = requests.find((r: any) => r.id === requestId)
        if (request) {
          setOrderData(request)
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('获取订单数据失败:', error)
    }
  }

  const fetchProcessingStatus = async () => {
    try {
      const res = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderProcessing] 状态响应:', res.data)

      if (res.data?.code === 200) {
        const data = res.data.data as OrderProcessingData
        setProcessingData(data)

        // 如果生成完成，停止轮询
        if (data.status === 'preview' || data.status === 'completed' || data.status === 'failed') {
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
        }
      } else {
        console.error('[OrderProcessing] 获取状态失败:', res.data?.message)
        // 如果连续失败多次，停止轮询
        const errorCount = (processingData as any)?.errorCount || 0
        if (errorCount >= 5) {
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
          showToast({ title: '获取状态失败，请刷新页面', icon: 'none' })
        }
        setProcessingData({ ...(processingData as any), errorCount: errorCount + 1 } as any)
      }
    } catch (error) {
      console.error('[OrderProcessing] 请求异常:', error)
      // 如果连续失败多次，停止轮询
      const errorCount = (processingData as any)?.errorCount || 0
      if (errorCount >= 5) {
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        showToast({ title: '网络异常，请刷新页面', icon: 'none' })
      }
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
      <Text className="status-title">排队中</Text>
      <Text className="status-desc">
        当前有 {processingData?.queuePosition || 0} 个任务在队列中
      </Text>
      {processingData?.estimatedTime && (
        <View className="time-estimate">
          <Text className="time-label">预计等待时间</Text>
          <Text className="time-value">{processingData.estimatedTime}秒</Text>
        </View>
      )}
      <Loader size={24} color="#f59e0b" className="loading-spinner" />
    </View>
  )

  const renderGeneratingState = () => (
    <View className="status-card">
      <View className="status-icon generating">
        <Sparkles size={48} color="#3b82f6" />
      </View>
      <Text className="status-title">生成内容中</Text>
      <Text className="status-desc">
        AI 正在为您生成优质内容，请稍候...
      </Text>
      <Loader size={24} color="#3b82f6" className="loading-spinner" />
    </View>
  )

  const renderPreviewState = () => (
    <View className="preview-section">
      <View className="preview-header">
        <Text className="preview-title">内容预览</Text>
        <Text className="preview-subtitle">请确认下方内容，如需修改可编辑后提交</Text>
      </View>

      <View className="content-editor">
        <Textarea
          className="content-textarea"
          placeholder="生成的内容将在这里显示"
          value={userContent || processingData?.generatedContent?.content || ''}
          onInput={(e) => setUserContent(e.detail.value)}
          maxlength={2000}
        />
      </View>

      <View className="preview-actions">
        <Button
          className="action-btn confirm-btn"
          onClick={handleConfirmContent}
          disabled={submitting}
        >
          {submitting ? (
            <Text className="btn-text">提交中...</Text>
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text className="btn-text">确认并发布</Text>
            </>
          )}
        </Button>
      </View>
    </View>
  )

  const renderPublishingState = () => (
    <View className="status-card">
      <View className="status-icon publishing">
        <Zap size={48} color="#10b981" />
      </View>
      <Text className="status-title">发布中</Text>
      <Text className="status-desc">
        正在发布到 {PLATFORM_NAMES[processingData?.generatedContent?.platform || '目标平台']}...
      </Text>
      <Loader size={24} color="#10b981" className="loading-spinner" />
    </View>
  )

  const renderCompletedState = () => (
    <View className="status-card success">
      <View className="status-icon success">
        <Check size={48} color="#22c55e" />
      </View>
      <Text className="status-title">发布成功</Text>
      {processingData?.publishStatus?.message && (
        <Text className="status-desc">{processingData.publishStatus.message}</Text>
      )}
      <Button className="action-btn" onClick={() => navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })}>
        <Text className="btn-text">查看订单详情</Text>
      </Button>
    </View>
  )

  const renderFailedState = () => (
    <View className="status-card error">
      <View className="status-icon error">
        <X size={48} color="#ef4444" />
      </View>
      <Text className="status-title">处理失败</Text>
      <Text className="status-desc">
        内容生成或发布失败，请稍后重试
      </Text>
      <Button className="action-btn" onClick={() => navigateBack()}>
        <Text className="btn-text">返回</Text>
      </Button>
    </View>
  )

  const renderErrorState = () => (
    <View className="status-card error">
      <View className="status-icon error">
        <X size={48} color="#ef4444" />
      </View>
      <Text className="status-title">获取状态失败</Text>
      <Text className="status-desc">
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
      <View className="order-processing-page">
        <View className="loading-wrapper">
          <Loader size={32} color="#00f5ff" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="order-processing-page">
      {/* 背景装饰 */}
      <View className="bg-decoration bg-1" />
      <View className="bg-decoration bg-2" />

      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title">订单处理</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="page-scroll" scrollY>
        {/* 订单基本信息 */}
        {orderData && (
          <View className="order-info-card">
            <View className="info-header">
              <Sparkles size={20} color="#00f5ff" />
              <Text className="info-title">订单信息</Text>
            </View>
            <Text className="info-order-title">{orderData.orders.title}</Text>
            <View className="info-meta">
              <View className="info-meta-item">
                <Smartphone size={16} color="#6366f1" />
                <Text className="info-meta-text">
                  {PLATFORM_NAMES[orderData.orders.platforms[0]] || orderData.orders.platforms[0]}
                </Text>
              </View>
              <View className="info-meta-item">
                <Calendar size={16} color="#f59e0b" />
                <Text className="info-meta-text">
                  {orderData.orders.deadline
                    ? new Date(orderData.orders.deadline).toLocaleDateString()
                    : '不限'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 状态展示 */}
        <View className="status-section">
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
                  <Text className="status-title">等待处理</Text>
                  <Text className="status-desc">
                    当前状态：{processingData.status}
                  </Text>
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
