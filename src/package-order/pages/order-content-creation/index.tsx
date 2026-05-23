import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Image as TaroImage, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidHide, useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { subscribeManagedPolling } from '@/utils/polling'
import { ArrowLeft, FileText, Image as ImageIcon, Video as VideoIcon, Sparkles, CircleCheck, Clock, Zap, Film, Loader, RefreshCw, CircleAlert } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { getStatusBarHeight } from '@/utils/safe-area'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { getPlatformLabel, getPlatformMeta } from '@/constants/publish-platform'
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
  status: string
  rawStatus: string
  requestId: string
  orderId: string
  avatarId: string
  avatarName: string
  orderTitle: string
  contentType: string
  generatedContent: GeneratedContent
  publishFeedback?: {
    rejectReason?: string
    [key: string]: any
  }
}

function parseStringArray(val: any): string[] {
  if (Array.isArray(val)) return val.filter((item): item is string => typeof item === 'string' && item.length > 0)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : (val ? [val] : [])
    } catch {
      return val ? [val] : []
    }
  }
  return []
}

function normalizeOrderInfo(raw: any): OrderInfo | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id || '',
    title: raw.title || '',
    description: raw.description || '',
    platforms: parseStringArray(raw.platforms),
    platform: raw.platform || '',
    budget: String(raw.budget || ''),
    expectedQuantity: Number(raw.expectedQuantity || raw.expected_quantity || 0),
    quantityPerAvatar: Number(raw.quantityPerAvatar || raw.quantity_per_avatar || 1),
    targetAudience: raw.targetAudience || raw.target_audience || '',
    status: raw.status || '',
    orderType: raw.orderType || raw.order_type || '',
    contentType: raw.contentType || raw.content_type || 'image_text',
  }
}

function normalizePublishFeedback(raw: any): ProcessingData['publishFeedback'] {
  if (!raw || typeof raw !== 'object') return {}
  return {
    ...raw,
    rejectReason: raw.rejectReason || raw.reject_reason || '',
  }
}

function normalizeProcessingData(raw: any): ProcessingData | null {
  if (!raw || typeof raw !== 'object') return null
  const generatedContent = raw.generatedContent || {}
  return {
    status: raw.status || '',
    rawStatus: raw.rawStatus || raw.status || 'pending',
    requestId: raw.requestId || '',
    orderId: raw.orderId || raw.order_id || '',
    avatarId: raw.avatarId || raw.avatar_id || '',
    avatarName: raw.avatarName || '',
    orderTitle: raw.orderTitle || '',
    contentType: raw.contentType || raw.content_type || 'image_text',
    generatedContent: {
      content: generatedContent.content || '',
      images: parseStringArray(generatedContent.images),
      videos: parseStringArray(generatedContent.videos || generatedContent.videoUrls || generatedContent.video_urls),
      platforms: parseStringArray(generatedContent.platforms),
    },
    publishFeedback: normalizePublishFeedback(raw.publishFeedback),
  }
}

// 步骤定义
interface StepDef {
  key: string
  label: string
  icon: string
  estTime: string // 预估耗时
  longEstTime: string // 长耗时（视频）
}

const STEPS_TEXT: StepDef[] = [
  { key: 'queued', label: '排队中', icon: 'clock', estTime: '约10秒', longEstTime: '约10秒' },
  { key: 'text', label: '生成文案', icon: 'text', estTime: '约30秒', longEstTime: '约40秒' },
  { key: 'done', label: '内容完成', icon: 'done', estTime: '', longEstTime: '' },
]

const STEPS_IMAGE: StepDef[] = [
  { key: 'queued', label: '排队中', icon: 'clock', estTime: '约10秒', longEstTime: '约10秒' },
  { key: 'text', label: '生成文案', icon: 'text', estTime: '约30秒', longEstTime: '约40秒' },
  { key: 'media', label: '生成配图', icon: 'image', estTime: '约60秒', longEstTime: '约60秒' },
  { key: 'done', label: '内容完成', icon: 'done', estTime: '', longEstTime: '' },
]

const STEPS_VIDEO: StepDef[] = [
  { key: 'queued', label: '排队中', icon: 'clock', estTime: '约10秒', longEstTime: '约10秒' },
  { key: 'text', label: '生成文案', icon: 'text', estTime: '约30秒', longEstTime: '约40秒' },
  { key: 'media', label: '生成视频', icon: 'video', estTime: '约10~20分钟', longEstTime: '约10~20分钟' },
  { key: 'done', label: '内容完成', icon: 'done', estTime: '', longEstTime: '' },
]

// 获取当前步骤列表
function getSteps(contentType?: string): StepDef[] {
  if (contentType === 'video' || contentType === 'video_text') return STEPS_VIDEO
  if (contentType === 'text') return STEPS_TEXT
  return STEPS_IMAGE
}

// rawStatus → 当前步骤索引 (0-based)
function getStepIndex(rawStatus: string): number {
  switch (rawStatus) {
    case 'pending':
    case 'processing':
      return 0
    case 'generating_text':
      return 1
    case 'generating_images':
      return 2
    case 'generating_video':
      return 2
    case 'completed':
    case 'published':
    case 'awaiting_acceptance':
    case 'feedback_submitted':
    case 'settled':
    case 'done':
    case 'preview':
    case 'partial_failed':
    case 'rejected':
      return 3
    default:
      return 0
  }
}

// 步骤状态：waiting / active / done
type StepState = 'waiting' | 'active' | 'done'

function getStepStates(currentStep: number, totalSteps?: number): StepState[] {
  const count = totalSteps || 4
  return Array.from({ length: count }, (_, i) => {
    if (i < currentStep) return 'done'
    if (i === currentStep) return 'active'
    return 'waiting'
  })
}

// 获取当前步骤描述文案
function getStepHint(rawStatus: string, contentType?: string, isTimeout?: boolean): string {
  if (isTimeout) return '生成时间较长，可稍后在生成内容页查看结果'
  const isVideo = contentType === 'video' || contentType === 'video_text'
  const isTextOnly = contentType === 'text'
  switch (rawStatus) {
    case 'pending':
    case 'processing':
      return '正在分配生成任务，请稍候...'
    case 'generating_text':
      return 'AI正在创作文案，根据您的风格和领域偏好定制内容...'
    case 'generating_images':
      if (isTextOnly) return 'AI正在创作文案...'
      return isVideo
        ? '正在根据文案提取视觉场景，准备视频素材...'
        : '正在逐张生成配图，每张生成后即可预览...'
    case 'generating_video':
      return '正在合成视频，视频生成通常需要10~20分钟，请耐心等待...'
    case 'completed':
      return '内容生成完成！'
    case 'published':
      return '内容已发布'
    case 'awaiting_acceptance':
    case 'feedback_submitted':
      return '等待发单方确认'
    case 'settled':
    case 'done':
      return '订单已完成'
    case 'partial_failed':
      return '部分内容生成失败，可点击重新生成'
    case 'failed':
      return '内容生成失败，可点击重新生成'
    case 'rejected':
      return '内容已被驳回，请查看驳回原因'
    default:
      return '处理中...'
  }
}

export default function OrderContentCreation() {
  const router = useRouter()
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0) // 已用秒数
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollCountRef = useRef(0) // 轮询计数
  const [isTimeout, setIsTimeout] = useState(false) // 轮询超时
  const startTimeRef = useRef<number>(Date.now())
  const retryInFlightRef = useRef<Record<string, true>>({})
  const fullFetchedRef = useRef(false)
  const pollCtlRef = useRef<{
    pause: () => void
    resume: () => void
    unsubscribe: () => void
    cancel: () => void
  } | null>(null)

  const orderId = router.params.orderId || ''
  const requestId = router.params.requestId || ''
  const queryId = requestId || orderId

  useDidHide(() => {
    pollCtlRef.current?.pause()
  })
  useDidShow(() => {
    pollCtlRef.current?.resume()
  })

  // 计时器
  useEffect(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 格式化耗时
  const formatElapsed = useCallback((sec: number) => {
    if (sec < 60) return `${sec}秒`
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${m}分${s}秒` : `${m}分钟`
  }, [])

  // 轮询状态
  useEffect(() => {
    if (!queryId) return

    const ctl = subscribeManagedPolling({
      key: `order-processing-status:${queryId}:lite`,
      baseIntervalMs: 2000,
      maxIntervalMs: 30_000,
      backoffFactor: 2,
      fetcher: async () => {
        pollCountRef.current += 1
        if (pollCountRef.current > 600 && !isTimeout) {
          setIsTimeout(true)
        }
        const res = await Network.request({
          url: `/api/order-processing/status/${queryId}?view=lite`,
          dedupKey: `order-processing-status:${queryId}:lite`,
        })
        return res.data
      },
      onData: (payload: any) => {
        const data = normalizeProcessingData(payload?.data)
        if (!data) return
        setProcessingData(data)

        const terminalStatuses = ['completed', 'published', 'awaiting_acceptance', 'feedback_submitted', 'settled', 'done', 'preview', 'failed', 'partial_failed', 'rejected']
        const reachedTerminal = terminalStatuses.includes(data.rawStatus) || terminalStatuses.includes(data.status)
        if (!reachedTerminal) return

        if (timerRef.current) clearInterval(timerRef.current)

        if (fullFetchedRef.current) {
          ctl.unsubscribe()
          return
        }

        fullFetchedRef.current = true
        Network.request({
          url: `/api/order-processing/status/${queryId}`,
          dedupKey: `order-processing-status:${queryId}:full`,
        })
          .then((res) => {
            const full = normalizeProcessingData(res.data?.data)
            if (full) setProcessingData(full)
            ctl.unsubscribe()
          })
          .catch(() => {
            fullFetchedRef.current = false
          })
      },
    })
    pollCtlRef.current = ctl

    return () => {
      ctl.unsubscribe()
      if (pollCtlRef.current === ctl) pollCtlRef.current = null
    }
  }, [queryId])

  // 获取订单信息
  useEffect(() => {
    if (!orderId) return
    Network.request({ url: `/api/order/${orderId}` })
      .then(res => {
        const data = normalizeOrderInfo(res.data?.data)
        if (data) setOrderInfo(data)
      })
      .catch(err => console.error('[content-creation] order error:', err))
      .finally(() => setLoading(false))
  }, [orderId])

  // 当前步骤
  const rawStatus = processingData?.rawStatus || 'pending'
  const contentType = processingData?.contentType || orderInfo?.contentType || 'image_text'
  const isVideo = contentType === 'video' || contentType === 'video_text'
  const steps = getSteps(contentType)
  const currentStep = getStepIndex(rawStatus)
  const stepStates = getStepStates(currentStep, steps.length)
  // 生成中的状态集合 —— 只有这些状态算"还在生成"
  const GENERATING_STATUSES = ['pending', 'processing', 'generating_text', 'generating_images', 'generating_video']
  const isPartialFailed = rawStatus === 'partial_failed'
  const isGenerating = GENERATING_STATUSES.includes(rawStatus)
  const isRejected = rawStatus === 'rejected'
  const rejectReason = processingData?.publishFeedback?.rejectReason || ''

  // 重试生成失败内容
  const handleRetry = useCallback(async () => {
    const retryRequestId = processingData?.requestId
    if (!retryRequestId) return
    if (retryInFlightRef.current[retryRequestId]) return
    retryInFlightRef.current[retryRequestId] = true
    try {
      Taro.showLoading({ title: '正在重新生成...' })
      const res = await Network.request({
        url: `/api/content-generation/retry/${retryRequestId}`,
        method: 'POST',
        dedupKey: `content-generation:retry:${retryRequestId}`,
      })
      console.log('[ContentCreation] retry response:', res.data)
      Taro.hideLoading()
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已开始重新生成', icon: 'success' })
        setProcessingData(prev => prev ? { ...prev, rawStatus: 'processing', status: 'generating' } : prev)
      } else {
        Taro.showToast({ title: res.data?.msg || '重试失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      Taro.showToast({ title: '重试请求失败', icon: 'none' })
    } finally {
      delete retryInFlightRef.current[retryRequestId]
    }
  }, [processingData?.requestId])

  // 内容数据
  const genContent = processingData?.generatedContent
  const textContent = genContent?.content || ''
  const images = genContent?.images || []
  const videos = genContent?.videos || []

  // preview 状态需额外检查：如果需要图片/视频但实际为空，视为部分失败
  const needImage = contentType === 'image_text' || contentType === 'image'
  const needVideo = contentType === 'video' || contentType === 'video_text'
  const imageEmpty = needImage && images.length === 0
  const videoEmpty = needVideo && videos.length === 0
  const isPreviewWithMissing = rawStatus === 'preview' && (imageEmpty || videoEmpty)
  const effectiveIsPartialFailed = isPartialFailed || isPreviewWithMissing
  const isCompleted = !GENERATING_STATUSES.includes(rawStatus) && rawStatus !== 'failed' && !effectiveIsPartialFailed && !isRejected

  // 完成状态文案
  const getCompletedLabel = useCallback((status: string) => {
    switch (status) {
      case 'completed': return '内容生成完成'
      case 'published': return '内容已发布'
      case 'awaiting_acceptance':
      case 'feedback_submitted': return '等待发单方确认'
      case 'settled':
      case 'done': return '订单已结算'
      case 'partial_failed': return '部分内容生成失败'
      default: return '内容生成完成'
    }
  }, [])
  const handlePublish = () => {
    if (!processingData?.requestId) return
    Taro.navigateTo({
      url: `/package-order/pages/order-publish-guide/index?contentId=${processingData.requestId}&orderId=${orderId}`
    })
  }

  const statusBarHeight = getStatusBarHeight()

  // 步骤图标
  const renderStepIcon = (step: StepDef, state: StepState) => {
    const size = 20
    const color = state === 'done' ? '#22C55E' : state === 'active' ? '#6366F1' : '#CBD5E1'
    switch (step.icon) {
      case 'clock': return <Clock size={size} color={color} />
      case 'text': return <FileText size={size} color={color} />
      case 'image': return isVideo ? <Film size={size} color={color} /> : <ImageIcon size={size} color={color} />
      case 'done': return <CircleCheck size={size} color={color} />
      default: return <Zap size={size} color={color} />
    }
  }

  return (
    <View className="cc-page">
      {/* 头部 */}
      <View className="cc-header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
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
            <Text className="cc-header-desc">
              {isCompleted ? '内容已生成完成' : effectiveIsPartialFailed ? '部分内容生成失败' : 'AI正在为你创作内容'}
            </Text>
          </View>
          <View className="cc-header-placeholder" />
        </View>
      </View>

      <ScrollView className="cc-scroll" scrollY>
        {/* 订单信息卡片 */}
        {orderInfo && (
          <View className="cc-order-card">
            <View className="cc-order-row">
              <View className="cc-order-badge" style={{ background: isCompleted ? '#22C55E' : effectiveIsPartialFailed ? '#EF4444' : '#6366F1' }}>
                <Text className="cc-order-badge-text">{isCompleted ? '已完成' : effectiveIsPartialFailed ? '部分失败' : '生成中'}</Text>
              </View>
              <View className="cc-order-type">
                <Text className="cc-order-type-text">{isVideo ? '视频' : '图文'}</Text>
              </View>
            </View>
            <Text className="cc-order-title">{orderInfo.title}</Text>
            <View className="cc-order-meta">
              {orderInfo.platforms?.map(p => (
                <View className="cc-meta-chip" key={p}>
                  <Text className="cc-meta-label">平台</Text>
                  <Text className="cc-meta-value">{getPlatformLabel(p)}</Text>
                </View>
              ))}
              <View className="cc-meta-chip">
                <Text className="cc-meta-label">数量</Text>
                <Text className="cc-meta-value">{orderInfo.quantityPerAvatar || 1}份</Text>
              </View>
              {processingData?.avatarName && (
                <View className="cc-meta-chip">
                  <Text className="cc-meta-label">分身</Text>
                  <Text className="cc-meta-value">{processingData.avatarName}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 生成进度区域 */}
        <View className="cc-generating-card">
          {/* 计时器 */}
          <View className="cc-timer-row">
            <Clock size={14} color="#94A3B8" />
            <Text className="cc-timer-text">已用时 {formatElapsed(elapsed)}</Text>
          </View>

          {/* 步骤进度条 */}
          <View className="cc-step-progress">
            {steps.map((step, i) => {
              const state = stepStates[i]
              const isActive = state === 'active'
              const isDone = state === 'done'
              const estTime = isVideo ? step.longEstTime : step.estTime
              const stepLabel = i === 2 && isVideo ? '生成视频' : step.label

              return (
                <View key={step.key} className={`cc-step-item ${state}`}>
                  {/* 连接线 */}
                  {i > 0 && <View className={`cc-step-line ${isDone || isActive ? 'cc-step-line-active' : ''}`} />}

                  {/* 节点 */}
                  <View className="cc-step-node-wrap">
                    <View className={`cc-step-node ${state}`}>
                      {isDone ? (
                        <CircleCheck size={18} color="#fff" />
                      ) : isActive ? (
                        <View className="cc-step-node-spinner">
                          {renderStepIcon(step, state)}
                        </View>
                      ) : (
                        renderStepIcon(step, state)
                      )}
                    </View>
                    {/* 活跃步骤的脉冲效果 */}
                    {isActive && <View className="cc-step-pulse" />}
                  </View>

                  {/* 标签 */}
                  <View className="cc-step-info">
                    <Text className={`cc-step-label ${state}`}>{stepLabel}</Text>
                    {isActive && estTime && (
                      <Text className="cc-step-est">预计{estTime}</Text>
                    )}
                    {isDone && (
                      <Text className="cc-step-done-mark">完成</Text>
                    )}
                  </View>
                </View>
              )
            })}
          </View>

          {/* 当前步骤提示 */}
          {isGenerating && (
            <View className="cc-step-hint">
              <Sparkles size={14} color="#8B5CF6" />
              <Text className="cc-step-hint-text">{getStepHint(rawStatus, contentType, isTimeout)}</Text>
            </View>
          )}

          {/* 视频生成进度特殊提示 */}
          {rawStatus === 'generating_video' && (
            <View className="cc-video-warn">
              <Film size={16} color="#F59E0B" />
              <Text className="cc-video-warn-text">视频合成需要5~8分钟，您可以返回查看其他内容，生成完成后会自动保存</Text>
            </View>
          )}

          {/* 实时预览：文案 */}
          {textContent && isGenerating && (
            <View className="cc-partial-preview">
              <View className="cc-partial-header">
                <FileText size={14} color="#8B5CF6" />
                <Text className="cc-partial-title">文案预览</Text>
              </View>
              <View className="cc-partial-body">
                <MarkdownRenderer content={textContent.substring(0, 500)} />
              </View>
            </View>
          )}

          {/* 实时预览：图片 */}
          {images.length > 0 && isGenerating && rawStatus !== 'generating_video' && (
            <View className="cc-partial-preview">
              <View className="cc-partial-header">
                <ImageIcon size={14} color="#8B5CF6" />
                <Text className="cc-partial-title">配图预览 ({images.length}张已生成)</Text>
              </View>
              <View className="cc-partial-body">
                <View className="cc-images-grid">
                  {images.map((img, i) => (
                    <View className="cc-image-item" key={i}>
                      <TaroImage
                        className="cc-image-preview" src={img} mode="aspectFill"
                        onClick={() => { Taro.previewImage({ urls: images, current: img }) }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 完成/部分失败状态 - 内容展示 */}
        {(isCompleted || effectiveIsPartialFailed) && (
          <View className="cc-content-section">
            {/* 完成/部分失败横幅 */}
            {effectiveIsPartialFailed ? (
              <View className="cc-done-banner" style={{ background: '#FEF2F2' }}>
                <RefreshCw size={20} color="#EF4444" />
                <Text className="block cc-done-text" style={{ color: '#EF4444' }}>
                  {(() => {
                    const missing: string[] = []
                    if (imageEmpty) missing.push('配图')
                    if (videoEmpty) missing.push('视频')
                    if (missing.length > 0) return `${missing.join('和')}生成失败，可点击重试`
                    return '部分内容生成失败，可点击重试'
                  })()}
                </Text>
              </View>
            ) : (
              <View className="cc-done-banner">
                <CircleCheck size={20} color="#16A34A" />
                <Text className="block cc-done-text">{getCompletedLabel(rawStatus)} · 耗时{formatElapsed(elapsed)}</Text>
              </View>
            )}

            {/* 重试按钮 */}
            {effectiveIsPartialFailed && (
              <View style={{ marginTop: '12rpx', marginBottom: '12rpx' }}>
                <Button size="sm" variant="outline" onClick={handleRetry}>
                  <Text>重新生成失败内容</Text>
                </Button>
              </View>
            )}

            {/* 平台标签 */}
            {genContent?.platforms && genContent.platforms.length > 0 && (
              <View className="cc-platform-bar">
                {genContent.platforms.map(p => {
                  const meta = getPlatformMeta(p)
                  return (
                    <View className="cc-platform-tag" key={p} style={{ background: meta?.color || '#6366F1' }}>
                      <Text className="cc-platform-name">{getPlatformLabel(p)}</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* 文案卡片 */}
            {textContent && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <FileText size={16} color="#6366F1" />
                  <Text className="cc-card-title">文案内容</Text>
                </View>
                <View className="cc-markdown-body">
                  <MarkdownRenderer content={textContent} />
                </View>
              </View>
            )}

            {/* 图片卡片 */}
            {images.length > 0 && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <ImageIcon size={16} color="#6366F1" />
                  <Text className="cc-card-title">配图 ({images.length})</Text>
                </View>
                <View className="cc-images-grid">
                  {images.map((img, i) => (
                    <View className="cc-image-item" key={i}>
                      <TaroImage className="cc-image-preview" src={img} mode="aspectFill" onClick={() => { Taro.previewImage({ urls: images, current: img }) }} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 视频卡片 */}
            {videos.length > 0 && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <VideoIcon size={16} color="#6366F1" />
                  <Text className="cc-card-title">视频</Text>
                </View>
                {videos.map((v, i) => (
                  <View className="cc-video-cover" key={i}>
                    <View className="cc-video-play" onClick={() => {
                      const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())
                      if (isMiniApp) {
                        Taro.previewMedia({ sources: [{ url: v, type: 'video' }] })
                      } else {
                        Taro.setClipboardData({ data: v })
                        Taro.showToast({ title: '视频链接已复制', icon: 'none' })
                      }
                    }}
                    >
                      <View className="cc-play-circle">
                        <View className="cc-play-triangle" />
                      </View>
                    </View>
                    <Text className="cc-video-label">15秒视频</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 驳回原因 */}
            {isRejected && rejectReason && (
              <View className="cc-content-card" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                <View className="cc-card-header">
                  <CircleAlert size={16} color="#EF4444" />
                  <Text className="cc-card-title" style={{ color: '#EF4444' }}>驳回原因</Text>
                </View>
                <View className="cc-markdown-body">
                  <Text style={{ color: '#DC2626' }}>{rejectReason}</Text>
                </View>
              </View>
            )}

            {/* 操作按钮 - 只有待发布状态才显示 */}
            {rawStatus === 'preview' && (
              <View className="cc-action-bar">
                <View className="cc-action-btn cc-action-secondary" onClick={handleRetry}>
                  <Text className="cc-action-secondary-text">重新生成</Text>
                </View>
                <View className="cc-action-btn cc-action-primary" onClick={handlePublish}>
                  <Text className="cc-action-primary-text">去发布</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 驳回状态单独显示 */}
        {isRejected && !isCompleted && !effectiveIsPartialFailed && (
          <View className="cc-content-section">
            <View className="cc-done-banner" style={{ background: '#FEF2F2' }}>
              <CircleAlert size={20} color="#EF4444" />
              <Text className="block cc-done-text" style={{ color: '#DC2626' }}>订单已被驳回</Text>
            </View>
            {rejectReason && (
              <View className="cc-content-card" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                <View className="cc-card-header">
                  <CircleAlert size={16} color="#EF4444" />
                  <Text className="cc-card-title" style={{ color: '#EF4444' }}>驳回原因</Text>
                </View>
                <View className="cc-markdown-body">
                  <Text style={{ color: '#DC2626' }}>{rejectReason}</Text>
                </View>
              </View>
            )}
            {textContent && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <FileText size={16} color="#6366F1" />
                  <Text className="cc-card-title">文案内容</Text>
                </View>
                <View className="cc-markdown-body">
                  <MarkdownRenderer content={textContent} />
                </View>
              </View>
            )}
            {images.length > 0 && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <ImageIcon size={16} color="#6366F1" />
                  <Text className="cc-card-title">配图 ({images.length})</Text>
                </View>
                <View className="cc-images-grid">
                  {images.map((img, i) => (
                    <View className="cc-image-item" key={i}>
                      <TaroImage className="cc-image-preview" src={img} mode="aspectFill" onClick={() => { Taro.previewImage({ urls: images, current: img }) }} />
                    </View>
                  ))}
                </View>
              </View>
            )}
            {videos.length > 0 && (
              <View className="cc-content-card">
                <View className="cc-card-header">
                  <VideoIcon size={16} color="#6366F1" />
                  <Text className="cc-card-title">视频</Text>
                </View>
                <View className="cc-video-cover-list">
                  {videos.map((v, i) => (
                    <View className="cc-video-cover" key={i}>
<<<<<<< HEAD
                      <View className="cc-video-play" onClick={() => {
                        const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())
                        if (isMiniApp) {
                          Taro.previewMedia({ sources: [{ url: v, type: 'video' }] })
                        } else {
                          Taro.setClipboardData({ data: v })
                          Taro.showToast({ title: '视频链接已复制', icon: 'none' })
                        }
                      }}
=======
                      <View
                        className="cc-video-play"
                        onClick={() => {
                          const isMiniApp = [Taro.ENV_TYPE.WEAPP as string, Taro.ENV_TYPE.TT as string].includes(Taro.getEnv())
                          if (isMiniApp) {
                            Taro.previewMedia({ sources: [{ url: v, type: 'video' }] })
                          } else {
                            Taro.setClipboardData({ data: v })
                            Taro.showToast({ title: '视频链接已复制', icon: 'none' })
                          }
                        }}
>>>>>>> 8af9a9f0e10919b8e6999a2d1138b8ac7c147180
                      >
                        <View className="cc-play-circle">
                          <View className="cc-play-triangle" />
                        </View>
                      </View>
                      <Text className="cc-video-label">15秒视频</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 加载中 */}
        {loading && (
          <View className="cc-loading">
            <Loader size={32} color="#6366F1" className="spinning-icon" />
            <Text className="cc-loading-text">加载中...</Text>
          </View>
        )}

        <View className="cc-bottom-safe" />
      </ScrollView>
    </View>
  )
}
