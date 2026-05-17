import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Image as TaroImage, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, FileText, Image as ImageIcon, Video as VideoIcon, Sparkles, CircleCheck, Clock, Zap, Film, Loader } from 'lucide-react-taro'
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
  requestId?: string
  orderId?: string
  avatarId?: string
  avatarName?: string
  orderTitle?: string
  contentType?: string
  generatedContent?: GeneratedContent
}

// 步骤定义
interface StepDef {
  key: string
  label: string
  icon: string
  estTime: string // 预估耗时
  longEstTime: string // 长耗时（视频）
}

const STEPS: StepDef[] = [
  { key: 'queued', label: '排队中', icon: 'clock', estTime: '约10秒', longEstTime: '约10秒' },
  { key: 'text', label: '生成文案', icon: 'text', estTime: '约30秒', longEstTime: '约40秒' },
  { key: 'media', label: '生成配图', icon: 'image', estTime: '约60秒', longEstTime: '约5~8分钟' },
  { key: 'done', label: '内容完成', icon: 'done', estTime: '', longEstTime: '' },
]

// rawStatus → 当前步骤索引 (0-based)
function getStepIndex(rawStatus: string, contentType?: string): number {
  const isVideo = contentType === 'video' || contentType === 'video_text'
  switch (rawStatus) {
    case 'pending':
    case 'processing':
      return 0
    case 'generating_text':
      return 1
    case 'generating_images':
      return isVideo ? 2 : 2 // 图片/视频都在这一步
    case 'generating_video':
      return 2
    case 'completed':
      return 3
    default:
      return 0
  }
}

// 步骤状态：waiting / active / done
type StepState = 'waiting' | 'active' | 'done'

function getStepStates(currentStep: number): StepState[] {
  return STEPS.map((_, i) => {
    if (i < currentStep) return 'done'
    if (i === currentStep) return 'active'
    return 'waiting'
  })
}

// 获取当前步骤描述文案
function getStepHint(rawStatus: string, contentType?: string): string {
  const isVideo = contentType === 'video' || contentType === 'video_text'
  switch (rawStatus) {
    case 'pending':
    case 'processing':
      return '正在分配生成任务，请稍候...'
    case 'generating_text':
      return 'AI正在创作文案，根据您的风格和领域偏好定制内容...'
    case 'generating_images':
      return isVideo
        ? '正在根据文案提取视觉场景，准备视频素材...'
        : '正在根据文案生成配图，确保图片风格与内容匹配...'
    case 'generating_video':
      return '正在合成15秒视频，这个过程需要5~8分钟，请耐心等待...'
    case 'completed':
      return '内容生成完成！'
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
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const orderId = router.params.orderId || ''
  const isVideo = processingData?.contentType === 'video' || processingData?.contentType === 'video_text'

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
    if (!orderId) return

    const fetchStatus = async () => {
      try {
        const res = await Network.request({ url: `/api/order-processing/status?orderId=${orderId}` })
        console.log('[content-creation] status response:', JSON.stringify(res.data))
        const data = res.data?.data || res.data
        if (data) {
          setProcessingData({
            status: data.status,
            rawStatus: data.rawStatus || data.status,
            requestId: data.requestId,
            orderId: data.orderId,
            avatarId: data.avatarId,
            avatarName: data.avatarName,
            orderTitle: data.orderTitle,
            contentType: data.contentType,
            generatedContent: data.generatedContent,
          })

          // 完成后停止计时
          if (data.rawStatus === 'completed' || data.status === 'completed' || data.status === 'preview') {
            if (timerRef.current) clearInterval(timerRef.current)
            if (pollRef.current) clearInterval(pollRef.current)
          }
        }
      } catch (err) {
        console.error('[content-creation] poll error:', err)
      }
    }

    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 2000) // 2秒轮询
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [orderId])

  // 获取订单信息
  useEffect(() => {
    if (!orderId) return
    Network.request({ url: `/api/order/${orderId}` })
      .then(res => {
        const data = res.data?.data || res.data
        if (data) setOrderInfo(data)
      })
      .catch(err => console.error('[content-creation] order error:', err))
      .finally(() => setLoading(false))
  }, [orderId])

  // 当前步骤
  const rawStatus = processingData?.rawStatus || 'pending'
  const currentStep = getStepIndex(rawStatus, processingData?.contentType)
  const stepStates = getStepStates(currentStep)
  const isCompleted = rawStatus === 'completed'
  const isGenerating = !isCompleted

  // 内容数据
  const genContent = processingData?.generatedContent
  const textContent = genContent?.content || ''
  const images = genContent?.images || []
  const videos = genContent?.videos || []

  // 发布按钮
  const handlePublish = () => {
    if (!processingData?.requestId) return
    Taro.navigateTo({
      url: `/package-order/pages/order-publish-guide/index?contentId=${processingData.requestId}&orderId=${orderId}`
    })
  }

  // 重试
  const handleRetry = () => {
    Taro.navigateBack()
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
              {isCompleted ? '内容已生成完成' : 'AI正在为你创作内容'}
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
              <View className="cc-order-badge" style={{ background: isCompleted ? '#22C55E' : '#6366F1' }}>
                <Text className="cc-order-badge-text">{isCompleted ? '已完成' : '生成中'}</Text>
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
            {STEPS.map((step, i) => {
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
              <Text className="cc-step-hint-text">{getStepHint(rawStatus, processingData?.contentType)}</Text>
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
                <Text className="cc-partial-title">配图预览 ({images.length})</Text>
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

        {/* 完成状态 - 内容展示 */}
        {isCompleted && genContent && (
          <View className="cc-content-section">
            {/* 完成横幅 */}
            <View className="cc-done-banner">
              <CircleCheck size={20} color="#16A34A" />
              <Text className="cc-done-text">内容生成完成 · 耗时{formatElapsed(elapsed)}</Text>
            </View>

            {/* 平台标签 */}
            {genContent.platforms && genContent.platforms.length > 0 && (
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

            {/* 操作按钮 */}
            <View className="cc-action-bar">
              <View className="cc-action-btn cc-action-secondary" onClick={handleRetry}>
                <Text className="cc-action-secondary-text">返回</Text>
              </View>
              <View className="cc-action-btn cc-action-primary" onClick={handlePublish}>
                <Text className="cc-action-primary-text">去发布</Text>
              </View>
            </View>
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
