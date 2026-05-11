import { useState, useEffect, useRef } from 'react'
import { View, Text, Image as TaroImage, ScrollView, Video as TaroVideo } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { Loader, RefreshCw, Send, ChevronLeft, Image as ImageIcon, FileText, Video as VideoIcon, Wallet, Users } from 'lucide-react-taro'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { canonicalizePlatforms, getPlatformLabel, getPlatformMeta } from '@/constants/publish-platform'
import './index.css'

interface OrderInfo {
  id: string
  title: string
  description: string
  platforms: string[]
  platform?: string
  budget: string
  expectedQuantity: number
  quantityPerAvatar: number
  targetAudience: string
  status: string
  orderType: string
}

interface GeneratedContent {
  content: string
  images: string[]
  videos: string[]
  platforms: string[]
}

interface ProcessingData {
  requestId?: string
  avatarId?: string
  orderId: string
  orderTitle: string
  status: string
  generatedContent: GeneratedContent | null
}

export default function OrderContentCreation() {
  const router = useRouter()
  const [orderId, setOrderId] = useState('')
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [pageStatus, setPageStatus] = useState<'loading' | 'generating' | 'completed' | 'failed'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // 初始化
  useEffect(() => {
    const id = router.params.orderId || ''
    if (id) {
      setOrderId(id)
      fetchOrderInfo(id)
    }
  }, [])

  // 获取订单信息
  const fetchOrderInfo = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/order/${id}` })
      console.log('[内容生成] 订单信息:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setOrderInfo(res.data.data)
        // 获取订单信息后，检查是否已有生成内容
        checkGenerationStatus(id)
      } else {
        setErrorMsg('订单信息获取失败')
        setPageStatus('failed')
      }
    } catch (err) {
      console.error('[内容生成] 获取订单失败:', err)
      setErrorMsg('网络错误，请重试')
      setPageStatus('failed')
    }
  }

  // 检查生成状态
  const checkGenerationStatus = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/order-processing/status/${id}` })
      console.log('[内容生成] 状态查询:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        const data = res.data.data as ProcessingData
        setProcessingData(data)
        if (data.status === 'completed' && data.generatedContent) {
          setPageStatus('completed')
          stopPolling()
        } else if (data.status === 'failed') {
          setPageStatus('failed')
          setErrorMsg('内容生成失败')
          stopPolling()
        } else if (data.status === 'queuing' || data.status === 'processing' || data.status === 'pending') {
          // 排队中、处理中、等待中都视为生成中
          setPageStatus('generating')
          startPolling(id)
        } else if (data.status === 'publishing' || data.status === 'published') {
          // 发布状态也显示为已完成
          setPageStatus('completed')
          stopPolling()
        } else if (data.status === 'awaiting_acceptance') {
          // 等待验收也显示为已完成
          setPageStatus('completed')
          stopPolling()
        }
      } else {
        // 没有生成记录，自动开始生成
        console.log('[内容生成] 无生成记录，开始生成')
        startGeneration(id)
      }
    } catch (err) {
      console.error('[内容生成] 状态查询失败:', err)
      // 查询失败也尝试生成
      startGeneration(id)
    }
  }

  // 开始生成
  const startGeneration = async (id: string) => {
    try {
      setPageStatus('generating')
      const order = orderInfo
      // 从 platforms 数组取第一个平台，支持 "wechat"/"general" 等
      const platformList = order?.platforms || []
      const platforms = platformList.length > 0
        ? platformList.map((p: string) => p === 'general' ? 'wechat' : p)
        : ['wechat']
      const normalizedPlatforms = canonicalizePlatforms(platforms)

      // 从描述中智能提取目标受众
      const descText = order?.description || ''
      const audienceMatch = descText.match(/目标用户画像[）)]?\s*[：:\n]*\s*[-•]?\s*特征[：:]\s*([^\n]+)/)
        || descText.match(/目标人群[：:]\s*([^\n]+)/)
        || descText.match(/面向[：:]?\s*([^\n]+)/)
      const targetAudience = order?.targetAudience || audienceMatch?.[1]?.trim() || '年轻用户'

      const params: Record<string, any> = {
        orderId: id,
        avatarId: 'default',
        orderTitle: order?.title || '内容生成',
        orderDescription: order?.description || '',
        platforms: normalizedPlatforms,
        contentType: 'image_text',
        targetAudience,
        contentQuantity: order?.quantityPerAvatar || order?.expectedQuantity || 3,
      }
      console.log('[内容生成] 调用生成接口:', params)
      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: params,
      })
      console.log('[内容生成] 生成响应:', res.data)
      if (res.data?.code === 200) {
        startPolling(id)
      } else {
        setErrorMsg(res.data?.message || '生成请求失败')
        setPageStatus('failed')
      }
    } catch (err: any) {
      console.error('[内容生成] 生成失败:', err)
      // 网络超时也可能是因为后台在异步生成
      if (err?.errMsg?.includes('timeout') || err?.message?.includes('timeout')) {
        startPolling(id)
      } else {
        setErrorMsg('生成请求失败，请重试')
        setPageStatus('failed')
      }
    }
  }

  // 轮询
  const startPolling = (id: string) => {
    stopPolling()
    setPageStatus('generating')
    pollTimer.current = setInterval(async () => {
      try {
        const res = await Network.request({ url: `/api/order-processing/status/${id}` })
        if (res.data?.code === 200 && res.data?.data) {
          const data = res.data.data as ProcessingData
          setProcessingData(data)
          if (data.status === 'completed') {
            setPageStatus('completed')
            stopPolling()
          } else if (data.status === 'failed') {
            setPageStatus('failed')
            setErrorMsg('内容生成失败')
            stopPolling()
          } else if (data.status === 'publishing' || data.status === 'published' || data.status === 'awaiting_acceptance') {
            // 发布中、已发布、等待验收都视为已完成
            setPageStatus('completed')
            stopPolling()
          }
        }
      } catch (err) {
        console.error('[内容生成] 轮询错误:', err)
      }
    }, 5000)
  }

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  // 重新生成
  const handleRegenerate = async () => {
    setPageStatus('generating')
    setProcessingData(null)
    setErrorMsg('')
    // 清除旧数据
    try {
      await Network.request({
        url: `/api/content-generation/clear/${orderId}`,
        method: 'DELETE',
      })
    } catch (e) { /* ignore */ }
    startGeneration(orderId)
  }

  // 发布
  const handlePublish = () => {
    const content = processingData?.generatedContent
    if (!content) {
      Taro.showToast({ title: '暂无可发布内容', icon: 'none' })
      return
    }

    const targetPlatforms = content.platforms?.length
      ? canonicalizePlatforms(content.platforms)
      : orderInfo?.platforms?.length
        ? canonicalizePlatforms(orderInfo.platforms)
        : ['wechat_channel']

    const title = orderInfo?.title || processingData?.orderTitle || '内容发布'
    const requestId = processingData?.requestId || ''
    const avatarId = processingData?.avatarId || orderInfo?.id || ''
    const images = content.images || []

    const query = [
      `platforms=${encodeURIComponent(targetPlatforms.join(','))}`,
      `content=${encodeURIComponent(content.content || '')}`,
      `title=${encodeURIComponent(title)}`,
      `images=${encodeURIComponent(images.join(','))}`,
      `contentType=${encodeURIComponent('图文')}`,
      `orderId=${encodeURIComponent(orderId)}`,
      `requestId=${encodeURIComponent(requestId)}`,
      `avatarId=${encodeURIComponent(avatarId)}`,
    ].join('&')

    Taro.navigateTo({
      url: `/pages/order/order-publish-guide/index?${query}`
    })
  }

  const platformName = canonicalizePlatforms(orderInfo?.platforms || ['wechat_channel'])[0]
  const displayPlatformName = getPlatformLabel(platformName)
  const platformColor = getPlatformMeta(platformName)?.color || '#6366F1'

  // 渲染订单信息卡片
  const renderOrderCard = () => {
    if (!orderInfo) return null
    return (
      <View className="order-card">
        <View className="order-card-header">
          <View className="order-platform-badge" style={{ backgroundColor: platformColor }}>
            <Text className="order-platform-text">{displayPlatformName}</Text>
          </View>
          <View className="order-type-tag">
            <FileText size={12} color="#6366F1" />
            <Text className="order-type-text">图文创作</Text>
          </View>
        </View>
        <Text className="order-card-title">{orderInfo.title}</Text>
        <View className="order-card-meta">
          <View className="meta-item">
            <Wallet size={14} color="#6366F1" />
            <Text className="meta-label">预算</Text>
            <Text className="meta-value">¥{orderInfo.budget}</Text>
          </View>
          <View className="meta-item">
            <ImageIcon size={14} color="#6366F1" />
            <Text className="meta-label">数量</Text>
            <Text className="meta-value">{orderInfo.quantityPerAvatar || orderInfo.expectedQuantity}条</Text>
          </View>
          <View className="meta-item">
            <Users size={14} color="#6366F1" />
            <Text className="meta-label">受众</Text>
            <Text className="meta-value">{orderInfo.targetAudience || '目标用户'}</Text>
          </View>
        </View>
      </View>
    )
  }

  // 渲染生成中状态
  const renderGenerating = () => (
    <View className="generating-section">
      <View className="generating-animation">
        <View className="generating-ring">
          <Loader size={48} color="#6366F1" className="spinning-icon" />
        </View>
      </View>
      <Text className="generating-title">AI 正在创作内容</Text>
      <Text className="generating-desc">根据订单要求生成文案和配图，请稍候...</Text>
      <View className="generating-steps">
        <View className="step-item active">
          <View className="step-dot" />
          <Text className="step-text">分析订单需求</Text>
        </View>
        <View className="step-item active">
          <View className="step-dot" />
          <Text className="step-text">生成文案内容</Text>
        </View>
        <View className="step-item">
          <View className="step-dot" />
          <Text className="step-text">生成配图</Text>
        </View>
      </View>
    </View>
  )

  // 渲染生成完成内容
  const renderCompleted = () => {
    const content = processingData?.generatedContent
    if (!content) return null
    return (
      <View className="content-section">
        {/* 平台标签 */}
        <View className="content-platform-bar">
          {canonicalizePlatforms(content.platforms || []).map((p: string) => (
            <View key={p} className="content-platform-tag" style={{ backgroundColor: getPlatformMeta(p)?.color || '#6366F1' }}>
              <Text className="content-platform-name">{getPlatformLabel(p)}</Text>
            </View>
          ))}
        </View>

        {/* 文案内容 - Markdown 渲染 */}
        {content.content ? (
          <View className="content-text-card">
            <View className="content-card-header">
              <FileText size={16} color="#6366F1" />
              <Text className="content-card-title">文案内容</Text>
            </View>
            <View className="markdown-body">
              <MarkdownRenderer content={content.content} />
            </View>
          </View>
        ) : null}

        {/* 图片内容 */}
        {content.images && content.images.length > 0 ? (
          <View className="content-images-card">
            <View className="content-card-header">
              <ImageIcon size={16} color="#6366F1" />
              <Text className="content-card-title">配图 ({content.images.length}张)</Text>
            </View>
            <View className="images-grid">
              {content.images.map((img: string, idx: number) => (
                <View key={idx} className="image-item">
                  <TaroImage
                    src={img}
                    mode="aspectFill"
                    className="image-preview"
                    onClick={() => {
                      Taro.previewImage({ urls: content.images, current: img })
                    }}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 视频内容 */}
        {content.videos && content.videos.length > 0 ? (
          <View className="content-videos-card">
            <View className="content-card-header">
              <VideoIcon size={16} color="#6366F1" />
              <Text className="content-card-title">视频</Text>
            </View>
            {content.videos.map((v: string, idx: number) => (
              <View key={idx} className="video-item">
                <TaroVideo src={v} style={{ width: '100%' }} controls />
              </View>
            ))}
          </View>
        ) : null}

        {/* 操作按钮 */}
        <View className="action-bar">
          <View className="action-btn regenerate" onClick={handleRegenerate}>
            <RefreshCw size={16} color="#6366F1" />
            <Text className="action-btn-text regenerate-text">重新生成</Text>
          </View>
          <View className="action-btn publish" onClick={handlePublish}>
            <Send size={16} color="#FFFFFF" />
            <Text className="action-btn-text publish-text">发布内容</Text>
          </View>
        </View>
      </View>
    )
  }

  // 渲染失败状态
  const renderFailed = () => (
    <View className="failed-section">
      <View className="failed-icon-wrap">
        <ImageIcon size={48} color="#EF4444" />
      </View>
      <Text className="failed-title">生成失败</Text>
      <Text className="failed-desc">{errorMsg || '内容生成过程中出错，请重试'}</Text>
      <View className="failed-retry-btn" onClick={handleRegenerate}>
        <RefreshCw size={16} color="#6366F1" />
        <Text className="failed-retry-text">重新生成</Text>
      </View>
    </View>
  )

  return (
    <View className="page-container">
      {/* 顶部导航 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={() => Taro.navigateBack()}>
          <ChevronLeft size={24} color="#1E293B" />
        </View>
        <Text className="nav-title">内容生成</Text>
        <View className="nav-placeholder" />
      </View>

      <ScrollView scrollY className="page-scroll">
        {/* 订单信息卡片 */}
        {renderOrderCard()}

        {/* 状态内容 */}
        {pageStatus === 'loading' && (
          <View className="loading-section">
            <Loader size={32} color="#6366F1" className="spinning-icon" />
            <Text className="loading-text">加载中...</Text>
          </View>
        )}
        {pageStatus === 'generating' && renderGenerating()}
        {pageStatus === 'completed' && renderCompleted()}
        {pageStatus === 'failed' && renderFailed()}

        {/* 底部安全距离 */}
        <View className="bottom-safe" />
      </ScrollView>
    </View>
  )
}
