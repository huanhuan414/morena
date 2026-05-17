import { useState, useEffect, useRef } from 'react'
import { View, Text, Image as TaroImage, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, Loader, RefreshCw, Send, FileText, Image as ImageIcon, Video as VideoIcon, Wallet, Users, Sparkles, CircleCheck } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
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
  contentType?: string
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
  rawStatus?: string
  generatedContent: GeneratedContent | null
}

/** rawStatus → 生成步骤映射 */
interface StepInfo { key: string; label: string; done: boolean; active: boolean }

function buildSteps(rawStatus: string, contentType: string): StepInfo[] {
  const isVideo = contentType === 'video'
  const s = rawStatus || ''

  const textDone = ['generating_images', 'generating_video', 'completed', 'preview', 'feedback_submitted', 'settled', 'awaiting_acceptance', 'published'].includes(s)
  const mediaDone = ['completed', 'preview', 'feedback_submitted', 'settled', 'awaiting_acceptance', 'published'].includes(s)
  const textActive = ['pending', 'processing', 'generating_text'].includes(s)
  const imageActive = s === 'generating_images'
  const videoActive = s === 'generating_video'

  return [
    { key: 'queuing', label: '排队等待', done: !['pending', 'queuing'].includes(s) && s !== '', active: ['pending', 'queuing'].includes(s) },
    { key: 'text', label: '文案创作', done: textDone, active: textActive },
    ...(isVideo
      ? [{ key: 'video', label: '视频生成（约1-3分钟）', done: mediaDone, active: videoActive }]
      : [{ key: 'images', label: '配图生成', done: mediaDone, active: imageActive }]
    ),
    { key: 'done', label: '生成完成', done: mediaDone, active: false },
  ]
}

/** rawStatus → 用户可读的描述文案 */
function getStatusDesc(rawStatus: string, contentType: string): string {
  const isVideo = contentType === 'video'
  const map: Record<string, string> = {
    'pending': '任务排队中，请稍候...',
    'queuing': '任务排队中，请稍候...',
    'processing': '正在准备生成任务...',
    'generating_text': 'AI 正在创作文案...',
    'generating_images': 'AI 正在生成配图...',
    'generating_video': isVideo ? 'AI 正在生成视频，通常需要1-3分钟...' : 'AI 正在生成视频...',
  }
  return map[rawStatus] || (isVideo ? 'AI 正在创作视频内容...' : 'AI 正在创作内容与配图...')
}

export default function OrderContentCreation() {
  const router = useRouter()
  const [orderId, setOrderId] = useState('')
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [pageStatus, setPageStatus] = useState<'loading' | 'generating' | 'completed' | 'failed'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const id = router.params.orderId || ''
    if (id) {
      setOrderId(id)
      fetchOrderInfo(id)
    }
    return () => stopPolling()
  }, [])

  const fetchOrderInfo = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/order/${id}` })
      console.log('[内容生成] 订单信息:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        const order = res.data.data as OrderInfo
        setOrderInfo(order)
        checkGenerationStatus(id, order)
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

  const checkGenerationStatus = async (id: string, order?: OrderInfo | null) => {
    try {
      const res = await Network.request({ url: `/api/order-processing/status/${id}` })
      console.log('[内容生成] 状态查询:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        const data = res.data.data as ProcessingData
        setProcessingData(data)
        const raw = data.rawStatus || data.status
        const finishedStatuses = ['completed', 'preview', 'feedback_submitted', 'settled', 'awaiting_acceptance', 'published']
        const generatingStatuses = ['pending', 'queuing', 'processing', 'generating_text', 'generating_images', 'generating_video', 'generating']

        if (finishedStatuses.includes(raw) || finishedStatuses.includes(data.status)) {
          setPageStatus('completed')
          stopPolling()
        } else if (data.status === 'failed') {
          setPageStatus('failed')
          setErrorMsg('内容生成失败')
          stopPolling()
        } else if (generatingStatuses.includes(raw) || generatingStatuses.includes(data.status)) {
          setPageStatus('generating')
          startPolling(id)
        } else {
          // 未知状态，继续轮询
          setPageStatus('generating')
          startPolling(id)
        }
      } else {
        console.log('[内容生成] 无生成记录，开始生成')
        startGeneration(id, order)
      }
    } catch (err) {
      console.error('[内容生成] 状态查询失败:', err)
      startGeneration(id, order)
    }
  }

  const startGeneration = async (id: string, orderParam?: OrderInfo | null) => {
    try {
      setPageStatus('generating')
      const order = orderParam || orderInfo
      const rawPlatforms = order?.platforms || (order as any)?.platform
      const platformArr: string[] = Array.isArray(rawPlatforms)
        ? rawPlatforms
        : (typeof rawPlatforms === 'string' && rawPlatforms ? rawPlatforms.split(',').map((s: string) => s.trim()) : [])
      const platforms = platformArr.length > 0
        ? platformArr.map((p: string) => p === 'general' ? 'wechat_channel' : p)
        : ['wechat_channel']
      const normalizedPlatforms = canonicalizePlatforms(platforms)

      const descText = order?.description || ''
      const audienceMatch = descText.match(/目标用户画像[）)]?\s*[：:\n]*\s*[-•]?\s*特征[：:]\s*([^\n]+)/)
        || descText.match(/目标人群[：:]\s*([^\n]+)/)
        || descText.match(/面向[：:]?\s*([^\n]+)/)
      const targetAudience = order?.targetAudience || audienceMatch?.[1]?.trim() || '年轻用户'

      const contentType = order?.contentType || (orderInfo as any)?.contentType || 'image_text'

      const params: Record<string, any> = {
        orderId: id,
        avatarId: router.params.avatarId || 'default',
        orderTitle: order?.title || '内容生成',
        orderDescription: order?.description || '',
        platforms: normalizedPlatforms,
        contentType,
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
      if (err?.errMsg?.includes('timeout') || err?.message?.includes('timeout')) {
        startPolling(id)
      } else {
        setErrorMsg('生成请求失败，请重试')
        setPageStatus('failed')
      }
    }
  }

  const startPolling = (id: string) => {
    stopPolling()
    setPageStatus('generating')
    pollTimer.current = setInterval(async () => {
      try {
        const res = await Network.request({ url: `/api/order-processing/status/${id}` })
        if (res.data?.code === 200 && res.data?.data) {
          const data = res.data.data as ProcessingData
          setProcessingData(data)
          const raw = data.rawStatus || data.status
          const finishedStatuses = ['completed', 'preview', 'feedback_submitted', 'settled', 'awaiting_acceptance', 'published']

          if (finishedStatuses.includes(raw) || finishedStatuses.includes(data.status)) {
            setPageStatus('completed')
            stopPolling()
          } else if (data.status === 'failed') {
            setPageStatus('failed')
            setErrorMsg('内容生成失败')
            stopPolling()
          }
          // 其他状态继续轮询
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

  const handleRegenerate = async () => {
    setPageStatus('generating')
    setProcessingData(null)
    setErrorMsg('')
    try {
      await Network.request({
        url: `/api/content-generation/clear/${orderId}`,
        method: 'DELETE',
      })
    } catch (e) { /* ignore */ }
    startGeneration(orderId)
  }

  const handlePublish = () => {
    const requestId = processingData?.requestId || ''
    const publishOrderId = processingData?.orderId || orderInfo?.id || orderId
    if (!requestId) {
      Taro.showToast({ title: '暂无可发布内容', icon: 'none' })
      return
    }
    // 通过 requestId 从后端获取完整数据，避免 URL 参数过长截断
    Taro.navigateTo({
      url: `/package-order/pages/order-publish-guide/index?contentId=${encodeURIComponent(requestId)}&orderId=${encodeURIComponent(publishOrderId)}`
    })
  }

  const playVideo = (url: string) => {
    console.log('播放视频:', url)
    Taro.previewMedia({
      sources: [{ url, type: 'video' }],
      current: 0
    }).catch(() => {
      Taro.setClipboardData({ data: url }).then(() => {
        Taro.showToast({ title: '视频链接已复制，请在浏览器中打开', icon: 'none', duration: 2000 })
      })
    })
  }

  // 平台信息
  const rawPlatformData = orderInfo?.platforms || (orderInfo as any)?.platform
  const orderPlatformArr: string[] = Array.isArray(rawPlatformData)
    ? rawPlatformData
    : (typeof rawPlatformData === 'string' && rawPlatformData ? rawPlatformData.split(',').map((s: string) => s.trim()) : [])
  const platformName = canonicalizePlatforms(orderPlatformArr.length > 0 ? orderPlatformArr : ['wechat_channel'])[0]
  const displayPlatformName = getPlatformLabel(platformName)
  const platformColor = getPlatformMeta(platformName)?.color || '#6366F1'

  const contentType = orderInfo?.contentType || 'image_text'
  const isVideoType = contentType === 'video'
  const rawStatus = processingData?.rawStatus || processingData?.status || ''
  const steps = buildSteps(rawStatus, contentType)

  const statusBarHeight = getStatusBarHeight()

  return (
    <View className="cc-page">
      {/* 顶部渐变头部 */}
      <View className="cc-header" style={{ paddingTop: statusBarHeight + 'px' }}>
        <View className="cc-header-deco">
          <View className="cc-header-circle circle-a" />
          <View className="cc-header-circle circle-b" />
        </View>
        <View className="cc-header-bar">
          <View className="cc-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="cc-header-center">
            <Text className="cc-header-title">内容生成</Text>
            <Text className="cc-header-desc">AI 智能创作，一键生成内容与配图</Text>
          </View>
          <View className="cc-header-placeholder" />
        </View>
      </View>

      <ScrollView scrollY className="cc-scroll">
        {/* 订单信息卡片 */}
        {orderInfo && (
          <View className="cc-order-card">
            <View className="cc-order-row">
              <View className="cc-order-badge" style={{ backgroundColor: platformColor }}>
                <Text className="cc-order-badge-text">{displayPlatformName}</Text>
              </View>
              <View className="cc-order-type">
                <FileText size={12} color="#6366F1" />
                <Text className="cc-order-type-text">{isVideoType ? '视频创作' : contentType === 'text' ? '文案创作' : '图文创作'}</Text>
              </View>
            </View>
            <Text className="cc-order-title">{orderInfo.title}</Text>
            <View className="cc-order-meta">
              <View className="cc-meta-chip">
                <Wallet size={13} color="#6366F1" />
                <Text className="cc-meta-label">预算</Text>
                <Text className="cc-meta-value">¥{orderInfo.budget}</Text>
              </View>
              <View className="cc-meta-chip">
                <ImageIcon size={13} color="#6366F1" />
                <Text className="cc-meta-label">数量</Text>
                <Text className="cc-meta-value">{orderInfo.quantityPerAvatar || orderInfo.expectedQuantity}条</Text>
              </View>
              <View className="cc-meta-chip">
                <Users size={13} color="#6366F1" />
                <Text className="cc-meta-label">受众</Text>
                <Text className="cc-meta-value">{orderInfo.targetAudience || '目标用户'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 加载中 */}
        {pageStatus === 'loading' && (
          <View className="cc-loading">
            <Loader size={32} color="#6366F1" className="spinning-icon" />
            <Text className="cc-loading-text">加载中...</Text>
          </View>
        )}

        {/* 生成中 - 带详细步骤 */}
        {pageStatus === 'generating' && (
          <View className="cc-generating-card">
            <View className="cc-gen-ring">
              <View className="cc-gen-ring-inner">
                <Sparkles size={40} color="#6366F1" />
              </View>
            </View>
            <Text className="cc-gen-title">AI 正在创作</Text>
            <Text className="cc-gen-desc">{getStatusDesc(rawStatus, contentType)}</Text>

            {/* 详细步骤进度 */}
            <View className="cc-gen-steps">
              {steps.map((step) => (
                <View key={step.key} className={`cc-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                  <View className="cc-step-dot">
                    {step.done && <View className="cc-step-check" />}
                  </View>
                  <Text className="cc-step-text">{step.label}</Text>
                  {step.active && <Loader size={12} color="#6366F1" className="spinning-icon" />}
                </View>
              ))}
            </View>

            {/* 文案已生成 - 实时预览 */}
            {processingData?.generatedContent?.content && ['generating_images', 'generating_video'].includes(rawStatus) && (
              <View className="cc-partial-preview">
                <View className="cc-partial-header">
                  <CircleCheck size={14} color="#22C55E" />
                  <Text className="cc-partial-title">文案已生成</Text>
                </View>
                <View className="cc-partial-body">
                  <MarkdownRenderer content={processingData.generatedContent.content} />
                </View>
              </View>
            )}

            {/* 配图部分生成中 - 实时预览 */}
            {processingData?.generatedContent?.images && processingData.generatedContent.images.length > 0 && rawStatus === 'generating_images' && (
              <View className="cc-partial-preview">
                <View className="cc-partial-header">
                  <ImageIcon size={14} color="#8B5CF6" />
                  <Text className="cc-partial-title">配图生成中 ({processingData.generatedContent.images.length}张已完成)</Text>
                </View>
                <View className="cc-images-grid">
                  {processingData.generatedContent.images.map((img: string, idx: number) => (
                    <View key={idx} className="cc-image-item">
                      <TaroImage
                        src={img}
                        mode="aspectFill"
                        className="cc-image-preview"
                        onClick={() => {
                          Taro.previewImage({ urls: processingData.generatedContent!.images, current: img })
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 生成完成 */}
        {pageStatus === 'completed' && processingData?.generatedContent && (
          <View className="cc-content-section">
            {/* 完成提示 */}
            <View className="cc-done-banner">
              <CircleCheck size={20} color="#22C55E" />
              <Text className="cc-done-text">内容生成完成</Text>
            </View>

            {/* 文案内容 */}
            {processingData.generatedContent.content && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <FileText size={15} color="#6366F1" />
                  <Text className="cc-card-title">文案内容</Text>
                </View>
                <View className="cc-markdown-body">
                  <MarkdownRenderer content={processingData.generatedContent.content} />
                </View>
              </View>
            )}

            {/* 配图 */}
            {processingData.generatedContent.images && processingData.generatedContent.images.length > 0 && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <ImageIcon size={15} color="#6366F1" />
                  <Text className="cc-card-title">配图 ({processingData.generatedContent.images.length}张)</Text>
                </View>
                <View className="cc-images-grid">
                  {processingData.generatedContent.images.map((img: string, idx: number) => (
                    <View key={idx} className="cc-image-item">
                      <TaroImage
                        src={img}
                        mode="aspectFill"
                        className="cc-image-preview"
                        onClick={() => {
                          Taro.previewImage({ urls: processingData.generatedContent!.images, current: img })
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 视频 */}
            {processingData.generatedContent.videos && processingData.generatedContent.videos.length > 0 && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <VideoIcon size={15} color="#6366F1" />
                  <Text className="cc-card-title">视频 ({processingData.generatedContent.videos.length}个)</Text>
                </View>
                {processingData.generatedContent.videos.map((v: string, idx: number) => (
                  <View
                    key={idx}
                    className="cc-video-cover"
                    onClick={() => playVideo(v)}
                  >
                    <View className="cc-video-play">
                      <View className="cc-play-circle">
                        <View className="cc-play-triangle" />
                      </View>
                    </View>
                    <Text className="cc-video-label">视频 {idx + 1} · 15秒 · 点击播放</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 无图片也无视频时的提示 */}
            {(!processingData.generatedContent.images || processingData.generatedContent.images.length === 0) &&
             (!processingData.generatedContent.videos || processingData.generatedContent.videos.length === 0) && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  {isVideoType ? <VideoIcon size={15} color="#F59E0B" /> : <ImageIcon size={15} color="#F59E0B" />}
                  <Text className="cc-card-title">{isVideoType ? '视频' : '配图'}</Text>
                </View>
                <View className="cc-media-empty">
                  <Text className="cc-media-empty-text">{isVideoType ? '视频生成中或生成失败，文案已保存' : '配图生成中或生成失败，文案已保存'}</Text>
                </View>
              </View>
            )}

            {/* 操作按钮 */}
            <View className="cc-action-bar">
              <View className="cc-action-btn cc-action-secondary" onClick={handleRegenerate}>
                <RefreshCw size={16} color="#6366F1" />
                <Text className="cc-action-secondary-text">重新生成</Text>
              </View>
              <View className="cc-action-btn cc-action-primary" onClick={handlePublish}>
                <Send size={16} color="#FFFFFF" />
                <Text className="cc-action-primary-text">发布内容</Text>
              </View>
            </View>
          </View>
        )}

        {/* 生成完成但无内容 */}
        {pageStatus === 'completed' && !processingData?.generatedContent && (
          <View className="cc-failed-card">
            <View className="cc-failed-icon">
              <ImageIcon size={40} color="#F59E0B" />
            </View>
            <Text className="cc-failed-title">内容为空</Text>
            <Text className="cc-failed-desc">生成完成但没有内容，请重新生成</Text>
            <View className="cc-failed-btn" onClick={handleRegenerate}>
              <RefreshCw size={16} color="#6366F1" />
              <Text className="cc-failed-btn-text">重新生成</Text>
            </View>
          </View>
        )}

        {/* 生成失败 */}
        {pageStatus === 'failed' && (
          <View className="cc-failed-card">
            <View className="cc-failed-icon">
              <ImageIcon size={40} color="#EF4444" />
            </View>
            <Text className="cc-failed-title">生成失败</Text>
            <Text className="cc-failed-desc">{errorMsg || '内容生成过程中出错，请重试'}</Text>
            <View className="cc-failed-btn" onClick={handleRegenerate}>
              <RefreshCw size={16} color="#6366F1" />
              <Text className="cc-failed-btn-text">重新生成</Text>
            </View>
          </View>
        )}

        <View className="cc-bottom-safe" />
      </ScrollView>
    </View>
  )
}
