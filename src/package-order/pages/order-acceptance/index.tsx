/* eslint-disable @typescript-eslint/no-unused-vars */
import Taro, { useLoad, useRouter, navigateBack, showToast, previewImage } from '@tarojs/taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import { useState } from 'react'
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import { Network } from '@/network'
import {
  ArrowLeft, Check, CircleAlert, Image as ImageIcon, ExternalLink,
  ChevronRight, TrendingUp, CircleCheckBig, Video, FileText, Play
} from 'lucide-react-taro'
import { getPlatformLabel } from '@/constants/publish-platform'
import '../order-detail/index.css'

const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

const AVATAR_STATUS_LABELS: Record<string, string> = {
  pending: '等待接单',
  accepted: '已接单',
  generating: '生成中',
  preview: '内容已生成',
  publishing: '发布中',
  published: '已发布',
  awaiting_acceptance: '待验收',
  feedback_submitted: '已提交',
  completed: '已验收',
  rejected: '已拒绝',
  expired: '已过期'
}

const AVATAR_STATUS_STYLES: Record<string, { color: string; bgColor: string }> = {
  pending: { color: '#9CA3AF', bgColor: '#F3F4F6' },
  accepted: { color: '#3B82F6', bgColor: '#DBEAFE' },
  generating: { color: '#8B5CF6', bgColor: '#F5F3FF' },
  preview: { color: '#F59E0B', bgColor: '#FEF3C7' },
  publishing: { color: '#6366F1', bgColor: '#EEF2FF' },
  published: { color: '#059669', bgColor: '#ECFDF5' },
  awaiting_acceptance: { color: '#F59E0B', bgColor: '#FEF3C7' },
  feedback_submitted: { color: '#F97316', bgColor: '#FFF7ED' },
  completed: { color: '#10B981', bgColor: '#D1FAE5' },
  rejected: { color: '#EF4444', bgColor: '#FEE2E2' },
  expired: { color: '#9CA3AF', bgColor: '#F3F4F6' }
}

function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

const COLLECT_STEP_TYPES = ['collect_info', 'collect_url', 'collect_image']

const getSpecialStepResult = (stepResults: Record<string, any>, step: any) => (
  stepResults?.[String(step?.id)] || stepResults?.[step?.id] || {}
)

const getSpecialResultValue = (result: any) => {
  if (result && typeof result === 'object' && 'value' in result) return result.value
  return result
}

const getSpecialResultImages = (value: any) => {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

interface AvatarStat {
  requestId?: string
  avatarId: string
  avatarName: string
  avatarUrl: string
  status: string
  publishFeedback: any
  orderId: string
  dispatchStatus?: string
  contentStatus?: string
  rejectReason?: string
  contentType?: string
  acceptanceTimeoutAt?: string  // 审核超时截止时间
}

export default function OrderAcceptance() {
  const router = useRouter()
  const { orderId } = router.params
  const [avatars, setAvatars] = useState<AvatarStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarStat | null>(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedReasonIdx, setSelectedReasonIdx] = useState(-1)
  const [silenceDurationMs, setSilenceDurationMs] = useState(86400000)  // 默认24小时（毫秒）
  const [isSilence, setIsSilence] = useState(false)  // 是否静默

  // 格式化静默时间显示（根据配置的毫秒数动态计算单位）
  const formatSilenceDuration = (ms: number) => {
    if (ms < 60 * 1000) {
      return `${Math.round(ms / 1000)}秒`
    } else if (ms < 60 * 60 * 1000) {
      return `${Math.round(ms / (60 * 1000))}分钟`
    } else if (ms < 24 * 60 * 60 * 1000) {
      const hours = Math.round(ms / (60 * 60 * 1000))
      return `${hours}小时`
    } else {
      const days = Math.round(ms / (24 * 60 * 60 * 1000))
      return `${days}天`
    }
  }

  // 预设驳回理由
  const REJECT_REASONS = [
    '未按要求发布',
    '未按要求整改',
    '内容质量不达标',
    '文案与要求不符',
    '配图/视频与要求不符',
    '发布平台不正确',
    '其他',
  ]
  const [generatedContent, setGeneratedContent] = useState<{ content?: string; images?: string[]; videos?: string[]; status?: string } | null>(null)
  const [rawOrderPlatform, setRawOrderPlatform] = useState('')
  const [specialTaskView, setSpecialTaskView] = useState<{ loading: boolean; steps: any[]; stepResults: Record<string, any> }>({
    loading: false,
    steps: [],
    stepResults: {},
  })
  const [hasPermission, setHasPermission] = useState(true)
  const [acceptanceTimeout, setAcceptanceTimeout] = useState<number>(24)  // 审核超时时间（小时）
  const [countdowns, setCountdowns] = useState<Record<string, { timeoutAt: string; display: string }>>({})  // 各分身的倒计时
  const statusBarHeight = getStatusBarHeight()

  // 格式化审核超时时间显示
  const formatAcceptanceTimeout = (hours: number) => {
    if (hours < 24) {
      return `${hours}小时`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      if (remainingHours > 0) {
        return `${days}天${remainingHours}小时`
      }
      return `${days}天`
    }
  }

  // 计算倒计时
  const calculateCountdown = (timeoutAt: string): string => {
    if (!timeoutAt) return ''
    const now = new Date().getTime()
    const timeoutTime = new Date(timeoutAt).getTime() + 90 * 1000 // 加 90 秒缓冲
    const diff = timeoutTime - now

    if (diff <= 0) {
      return '已超时'
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (days > 0) {
      if (hours > 0) {
        return `${days}天${hours}小时${minutes}分${seconds}秒`
      }
      return `${days}天${minutes}分${seconds}秒`
    } else if (hours > 0) {
      return `${hours}小时${minutes}分${seconds}秒`
    } else if (minutes > 0) {
      return `${minutes}分${seconds}秒`
    } else {
      return `${seconds}秒`
    }
  }

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: `/api/order/${orderId}` })
      if (res.data?.code === 200 && res.data.data?.summary_stats?.avatarStats) {
        const orderData = res.data.data
        setRawOrderPlatform(orderData.platform || '')
        const userInfo = Taro.getStorageSync('userInfo')
        const currentUserId = userInfo?.id
        const orderUserId = orderData.userId || orderData.user_id
        if (orderUserId && currentUserId && orderUserId !== currentUserId) {
          setHasPermission(false)
          showToast({ title: '无权限验收此订单', icon: 'none' })
          setTimeout(() => navigateBack(), 1500)
          return
        }
        // 设置审核超时时间
        if (orderData.acceptanceTimeout || orderData.acceptance_timeout) {
          setAcceptanceTimeout(Number(orderData.acceptanceTimeout || orderData.acceptance_timeout))
        }
        // 获取各分身的审核超时时间
        const allAvatars = orderData.summary_stats.avatarStats.map((a: any) => ({
          ...a,
          orderId,
          acceptanceTimeoutAt: a.acceptanceTimeoutAt || a.acceptance_timeout_at
        }))
        setAvatars(allAvatars)
        // 更新倒计时
        updateCountdowns(allAvatars)
        // 设置静默时间配置
        if (orderData.silenceDurationMs) {
          setSilenceDurationMs(orderData.silenceDurationMs)
        }
      }
    } catch (error) {
      console.error('获取分身列表失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 更新所有倒计时
  const updateCountdowns = (avatarList: AvatarStat[]) => {
    const newCountdowns: Record<string, { timeoutAt: string; display: string }> = {}
    avatarList.forEach(avatar => {
      if (avatar.acceptanceTimeoutAt) {
        newCountdowns[avatar.avatarId] = {
          timeoutAt: avatar.acceptanceTimeoutAt,
          display: calculateCountdown(avatar.acceptanceTimeoutAt)
        }
      }
    })
    setCountdowns(newCountdowns)
  }

  // 启动倒计时定时器
  useLoad(() => {
    if (orderId) fetchAvatars()
    const timer = setInterval(() => {
      setCountdowns(prev => {
        const newCountdowns: Record<string, { timeoutAt: string; display: string }> = {}
        Object.keys(prev).forEach(avatarId => {
          const item = prev[avatarId]
          if (item?.timeoutAt) {
            newCountdowns[avatarId] = {
              timeoutAt: item.timeoutAt,
              display: calculateCountdown(item.timeoutAt)
            }
          }
        })
        return newCountdowns
      })
    }, 1000)
    return () => clearInterval(timer)
  })

  const handleSelectAvatar = async (avatar: AvatarStat) => {
    setSelectedAvatar(avatar)
    setGeneratedContent(null)
    setSpecialTaskView({ loading: false, steps: [], stepResults: {} })
    if (avatar.requestId) {
      try {
        const isSpecialOrder = rawOrderPlatform === 'special'
        if (isSpecialOrder) {
          setSpecialTaskView(prev => ({ ...prev, loading: true }))
          const res = await Network.request({ url: `/api/order-processing/${avatar.requestId}/task-view` })
          const data = res.data?.data || {}
          if (res.data?.code === 200) {
            setSpecialTaskView({
              loading: false,
              steps: Array.isArray(data.steps) ? data.steps : [],
              stepResults: data.stepResults || data.step_results || {},
            })
          } else {
            setSpecialTaskView({ loading: false, steps: [], stepResults: {} })
            showToast({ title: res.data?.message || '收集信息加载失败', icon: 'none' })
          }
          return
        }

        const res = await Network.request({ url: `/api/content-generation/content/${avatar.requestId}` })
        if (res.data?.code === 200 && res.data.data) {
          const data = res.data.data
          setGeneratedContent({
            content: data.content || data.textContent || '',
            images: Array.isArray(data.images) ? data.images : [],
            videos: Array.isArray(data.videos) ? data.videos : (Array.isArray(data.videoUrl) ? data.videoUrl : (data.videoUrl ? [data.videoUrl] : [])),
            status: data.status
          })
        }
      } catch (error) {
        setSpecialTaskView({ loading: false, steps: [], stepResults: {} })
        console.error('获取生成内容失败:', error)
      }
    }
  }

  const handleApprove = async () => {
    if (!selectedAvatar) return

    // 防重复点击
    if ((handleApprove as any).isLoading) return;
    (handleApprove as any).isLoading = true

    try {
      const requestId = selectedAvatar.requestId
      if (!requestId) {
        showToast({ title: '缺少请求ID，无法验收', icon: 'none' })
        return
      }
      const res = await Network.request({
        url: `/api/order-processing/accept/${requestId}`,
        method: 'PUT'
      })
      if (res.data?.code === 200) {
        const rewardAmount = res.data?.data?.rewardAmount
        const message = rewardAmount
          ? `验收通过！分身已获得 ${rewardAmount.toFixed(2)} 元奖励`
          : '已验收通过'
        showToast({ title: message, icon: 'success', duration: 2500 })
        setShowApprove(false)
        setSelectedAvatar(null)
        fetchAvatars()
      } else {
        // 显示后端返回的具体错误信息
        showToast({ title: res.data?.message || '验收失败', icon: 'none' })
      }
    } catch (error) {
      console.error('验收失败:', error)
      showToast({ title: '验收失败，请重试', icon: 'none' })
    } finally {
      (handleApprove as any).isLoading = false
    }
  }

  const handleReject = async () => {
    if (!selectedAvatar) {
      showToast({ title: '请先选择分身', icon: 'none' })
      return
    }
    const isOther = selectedReasonIdx === REJECT_REASONS.length - 1
    const finalReason = isOther ? rejectReason.trim() : (selectedReasonIdx >= 0 ? REJECT_REASONS[selectedReasonIdx] : '')
    if (!finalReason) {
      showToast({ title: isOther ? '请输入驳回原因' : '请选择驳回原因', icon: 'none' })
      return
    }

    // 检查是否是第2次驳回（通过 revisionHistory 判断）
    const publishFeedback = selectedAvatar.publishFeedback || {}
    const revisionHistory = publishFeedback.revisionHistory || []
    const isSecondReject = revisionHistory.length >= 1  // 已有1次驳回记录，这次是第2次
    console.log('isSilence', isSilence)
    // 如果选择静默，则走二次驳回条件（直接静默）
    if (isSilence) {
      const modalRes = await Taro.showModal({
        title: '确认驳回',
        content: `驳回后该接单者将被静默${formatSilenceDuration(silenceDurationMs)}，期间无法接单。确定要驳回吗？`,
        confirmText: '确认驳回',
        cancelText: '取消',
      })
      if (!modalRes.confirm) return
    } else if (isSecondReject) {
      const modalRes = await Taro.showModal({
        title: '确认最终驳回',
        content: `这是第2次驳回，驳回后该接单者将被静默${formatSilenceDuration(silenceDurationMs)}，期间无法接单。确定要驳回吗？`,
        confirmText: '确认驳回',
        cancelText: '取消',
      })

      if (!modalRes.confirm) return
    }

    try {
      const requestId = selectedAvatar.requestId
      if (!requestId) {
        showToast({ title: '缺少请求ID，无法驳回', icon: 'none' })
        return
      }
      // 根据 isSilence 决定是否静默
      const res = await Network.request({
        url: `/api/order-processing/revision/${requestId}`,
        method: 'POST',
        data: {
          feedback: { rejectReason: finalReason, status: 'revision_requested' },
          silence: isSilence,
        }
      })
      if (res.data?.code === 200) {
        showToast({ title: '已驳回', icon: 'success' })
        setShowReject(false)
        setRejectReason('')
        setSelectedReasonIdx(-1)
        setIsSilence(false)
        setSelectedAvatar(null)
        fetchAvatars()
      }
    } catch (error) {
      console.error('驳回失败:', error)
      showToast({ title: '驳回失败', icon: 'none' })
    }
  }

  // @ts-ignore
  const _handleLinkClick = (url: string) => {
    if (!url) {
      showToast({ title: '链接为空', icon: 'none' })
      return
    }
    try {
      const isFullUrl = url.startsWith('http://') || url.startsWith('https://')
      if (!isFullUrl) {
        showToast({ title: '链接格式不正确', icon: 'none' })
        return
      }
      if (isH5) {
        window.open(url, '_blank')
      } else {
        Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
      }
    } catch (error) {
      showToast({ title: '打开链接失败', icon: 'none' })
    }
  }

  const handleImagePreview = (imageUrl: string) => {
    if (!imageUrl) return
    try {
      previewImage({ urls: [imageUrl], current: imageUrl })
    } catch (error) {
      showToast({ title: '预览图片失败', icon: 'none' })
    }
  }

  void acceptanceTimeout
  void formatAcceptanceTimeout

  const isSelectedSpecialOrder = rawOrderPlatform === 'special'
  const specialSteps = specialTaskView.steps.filter(step => COLLECT_STEP_TYPES.includes(step.step_type || step.stepType))

  if (loading) {
    return (
      <View className="od-page">
        <View className="od-header">
          <View className="od-header-deco1" />
          <View className="od-header-deco2" />
          <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
            <View className="od-back-btn" onClick={() => navigateBack()}>
              <ArrowLeft size={18} color="#fff" />
            </View>
            <View className="od-header-center">
              <Text className="block od-header-title">验收中</Text>
            </View>
            <View className="od-header-right" />
          </View>
        </View>
        <View className="od-loading">
          <Text className="block od-loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!hasPermission) {
    return (
      <View className="od-page">
        <View className="od-header">
          <View className="od-header-deco1" />
          <View className="od-header-deco2" />
          <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
            <View className="od-back-btn" onClick={() => navigateBack()}>
              <ArrowLeft size={18} color="#fff" />
            </View>
            <View className="od-header-center">
              <Text className="block od-header-title">验收中</Text>
            </View>
            <View className="od-header-right" />
          </View>
        </View>
        <View className="od-loading">
          <Text className="block od-loading-text">无权限验收此订单</Text>
        </View>
      </View>
    )
  }

  if (selectedAvatar) {
    return (
      <View className="od-page">
        {/* 头部 */}
        <View className="od-header">
          <View className="od-header-deco1" />
          <View className="od-header-deco2" />
          <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
            <View className="od-back-btn" onClick={() => { setSelectedAvatar(null); setGeneratedContent(null) }}>
              <ArrowLeft size={18} color="#fff" />
            </View>
            <View className="od-header-center">
              <Text className="block od-header-title">验收详情</Text>
            </View>
            <View className="od-header-right" />
          </View>
          <View className="od-status-section">
            {(() => {
              const st = selectedAvatar.status
              const style = AVATAR_STATUS_STYLES[st] || AVATAR_STATUS_STYLES.pending
              const label = AVATAR_STATUS_LABELS[st] || '未知状态'
              const isAwaiting = st === 'awaiting_acceptance' || st === 'preview' || st === 'feedback_submitted'
              return (
                <>
                  <View className="od-status-badge" style={{ backgroundColor: style.bgColor }}>
                    <Text className="block od-status-badge-text" style={{ color: style.color }}>{label}</Text>
                  </View>
                  <Text className="block od-status-desc">
                    {isAwaiting ? '请检查分身提交的内容并确认验收' :
                      st === 'completed' ? '此分身内容已验收通过' :
                        st === 'generating' || st === 'accepted' ? '分身正在创作内容，请耐心等待' :
                          st === 'rejected' ? '此分身已拒绝接单' :
                            st === 'pending' ? '等待分身确认接单' :
                              '分身状态：' + label}
                  </Text>
                </>
              )
            })()}
          </View>
        </View>

        {/* 内容 */}
        <ScrollView scrollY className="od-body">
          {/* 分身信息卡 */}
          <View className="od-card">
            <View className="od-avatar-header">
              <Image src={selectedAvatar.avatarUrl || ''} className="od-avatar-large" mode="aspectFill" />
              <View className="od-avatar-info">
                <Text className="block od-avatar-name">{selectedAvatar.avatarName}</Text>
                {(() => {
                  const st = selectedAvatar.status
                  const style = AVATAR_STATUS_STYLES[st] || AVATAR_STATUS_STYLES.pending
                  const label = AVATAR_STATUS_LABELS[st] || '未知'
                  return (
                    <View className="od-status-badge" style={{ backgroundColor: style.bgColor }}>
                      <Check size={12} color={style.color} />
                      <Text className="block od-status-badge-text" style={{ color: style.color, fontSize: '12px' }}>
                        {label}
                      </Text>
                    </View>
                  )
                })()}
              </View>
            </View>
          </View>

          {/* 生成内容 */}
          {(isSelectedSpecialOrder || generatedContent) && (
            <View className="od-card">
              <View className="od-stats-header" style={{ marginBottom: 12 }}>
                <FileText size={16} color="#6366F1" />
                <Text className="block od-stats-title">分身创作内容</Text>
              </View>

              {/* 文案内容 */}
              {isSelectedSpecialOrder ? (
                <View>
                  {specialTaskView.loading && (
                    <View className="od-dialog-empty">
                      <FileText size={28} color="#6366F1" />
                      <Text className="block od-dialog-empty-text">收集信息加载中</Text>
                    </View>
                  )}
                  {!specialTaskView.loading && specialSteps.map((step: any) => {
                    const stepType = step.step_type || step.stepType
                    const result = getSpecialStepResult(specialTaskView.stepResults, step)
                    const value = getSpecialResultValue(result)
                    const images = getSpecialResultImages(value)
                    const textValue = Array.isArray(value) ? value.filter(Boolean).join('\n') : String(value || '')
                    return (
                      <View key={step.id} className="od-card" style={{ marginBottom: 12, padding: 12, boxShadow: 'none', border: '1px solid #F0F0F5' }}>
                        <View className="od-stats-header" style={{ marginBottom: 8 }}>
                          {stepType === 'collect_image' ? <ImageIcon size={14} color="#F59E0B" /> : <FileText size={14} color="#6366F1" />}
                          <Text className="block od-stats-title">{step.step_title || step.stepTitle || '收集信息'}</Text>
                        </View>
                        {(step.step_desc || step.stepDesc) && (
                          <Text className="block" style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>
                            {step.step_desc || step.stepDesc}
                          </Text>
                        )}
                        {stepType === 'collect_image' ? (
                          images.length > 0 ? (
                            <View className="od-images-grid">
                              {images.map((img: string, idx: number) => (
                                <Image
                                  key={idx}
                                  src={img}
                                  className="od-preview-image"
                                  mode="aspectFill"
                                  onClick={() => handleImagePreview(img)}
                                />
                              ))}
                            </View>
                          ) : (
                            <Text className="block" style={{ fontSize: '13px', color: '#9CA3AF' }}>暂无收集图片</Text>
                          )
                        ) : textValue ? (
                          <View
                            style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 }}
                            onClick={() => Taro.setClipboardData({ data: textValue, success: () => showToast({ title: '已复制', icon: 'success' }) })}
                          >
                            <Text className="block" style={{ fontSize: '14px', color: '#1F2937', lineHeight: 1.6, wordBreak: 'break-all' }}>
                              {textValue}
                            </Text>
                          </View>
                        ) : (
                          <Text className="block" style={{ fontSize: '13px', color: '#9CA3AF' }}>暂无收集内容</Text>
                        )}
                      </View>
                    )
                  })}
                  {!specialTaskView.loading && specialSteps.length === 0 && (
                    <Text className="block" style={{ fontSize: '13px', color: '#9CA3AF' }}>暂无收集信息</Text>
                  )}
                </View>
              ) : (
                <>
              {generatedContent?.content && (
                <View style={{ marginBottom: 12 }}>
                  <Text className="block" style={{ fontSize: '13px', color: '#6B7280', marginBottom: 4 }}>文案</Text>
                  <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                    <Text className="block" style={{ fontSize: '14px', color: '#1F2937', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {generatedContent.content}
                    </Text>
                  </View>
                </View>
              )}

              {/* 图片内容 */}
              {generatedContent?.images && generatedContent.images.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <ImageIcon size={14} color="#6366F1" />
                    <Text className="block" style={{ fontSize: '13px', color: '#6B7280', marginLeft: 4 }}>配图 ({generatedContent.images.length})</Text>
                  </View>
                  <View className="od-images-grid">
                    {generatedContent.images.map((img: string, idx: number) => (
                      <Image
                        key={idx}
                        src={img}
                        className="od-preview-image"
                        mode="aspectFill"
                        onClick={() => handleImagePreview(img)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 视频内容 - 封面卡点击播放 */}
              {generatedContent?.videos && generatedContent.videos.length > 0 && (
                <View>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Video size={14} color="#6366F1" />
                    <Text className="block" style={{ fontSize: '13px', color: '#6B7280', marginLeft: 4 }}>视频 ({generatedContent.videos.length})</Text>
                  </View>
                  {generatedContent.videos.map((url: string, idx: number) => (
                    <View key={idx} className="gc-video-cover-card" onClick={() => {
                      Taro.previewMedia({
                        sources: [{ url, type: 'video' }],
                        current: 0,
                      }).catch(() => {
                        Taro.setClipboardData({ data: url })
                        Taro.showToast({ title: '视频链接已复制', icon: 'none' })
                      })
                    }}
                    >
                      <View className="gc-video-cover-bg">
                        <View className="gc-video-play-btn">
                          <Play size={32} color="#fff" style={{ marginLeft: 4 }} />
                        </View>
                        <View className="gc-video-cover-label">
                          <Text className="gc-video-cover-text">视频 {idx + 1} · 点击播放</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
                </>
              )}
            </View>
          )}

          {/* 发布反馈 */}
          {selectedAvatar.publishFeedback && (() => {
            const pf = selectedAvatar.publishFeedback
            // 分离元数据字段和平台数据（包括大小写变体）
            const metadataKeys = [
              'rejectreason', 'reject_reason',
              'revisionhistory', 'revision_history',
              'status',
              'feedback_submitted_at', 'submitted_at',
              'revision_count',
              'stepresults', 'step_results',
              'tasksubmittedat', 'task_submitted_at',
            ]
            const platformEntries = Object.entries(pf).filter(([key, value]) => {
              if (metadataKeys.includes(key.toLowerCase())) return false
              if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
              return true
            })

            return (
              <>
                {/* 驳回信息（如果有） */}
                {(pf.rejectReason || pf.reject_reason || pf.revisionHistory) && (
                  <View className="od-card" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: 12 }}>
                    <View style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <CircleAlert size={16} color="#EA580C" />
                      <Text style={{ marginLeft: 8, color: '#C2410C', fontWeight: 600 }}>整改要求</Text>
                    </View>
                    {(pf.rejectReason || pf.reject_reason) && (
                      <Text style={{ color: '#C2410C', fontSize: 14, lineHeight: 1.6 }}>
                        {pf.rejectReason || pf.reject_reason}
                      </Text>
                    )}
                    {pf.revisionHistory && pf.revisionHistory.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>历史整改记录</Text>
                        {pf.revisionHistory.map((item: any, idx: number) => (
                          <View key={idx} style={{ marginBottom: 8, padding: 10, backgroundColor: '#fff', borderRadius: 6 }}>
                            <View style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                              <Text style={{ color: '#EF4444', fontSize: 12 }}>第{item.count}次</Text>
                              <Text style={{ color: '#9CA3AF', fontSize: 11, marginLeft: 8 }}>{item.time ? new Date(item.time).toLocaleString('zh-CN') : ''}</Text>
                            </View>
                            <Text style={{ color: '#374151', fontSize: 13, marginBottom: 6 }}>{item.reason || '无'}</Text>
                            {item.snapshot && Object.keys(item.snapshot).length > 0 && (
                              <>
                                {/* 数据统计 */}
                                {Object.entries(item.snapshot).map(([platform, data]: [string, any]) => (
                                  (data.views !== undefined || data.likes !== undefined || data.comments !== undefined || data.shares !== undefined) && (
                                    <View key={platform} className="od-card od-stats-card" style={{ marginTop: 8 }}>
                                      <View className="od-stats-header">
                                        <TrendingUp size={16} color="#6366F1" />
                                        <Text className="block od-stats-title">{getPlatformLabel(platform)}</Text>
                                      </View>
                                      <View className="od-stats-row">
                                        {data.views !== undefined && (
                                          <View className="od-stat-item">
                                            <Text className="block od-stat-value">{formatNumber(data.views)}</Text>
                                            <Text className="block od-stat-label">浏览</Text>
                                          </View>
                                        )}
                                        {data.likes !== undefined && (
                                          <View className="od-stat-item">
                                            <Text className="block od-stat-value">{formatNumber(data.likes)}</Text>
                                            <Text className="block od-stat-label">点赞</Text>
                                          </View>
                                        )}
                                        {data.comments !== undefined && (
                                          <View className="od-stat-item">
                                            <Text className="block od-stat-value">{formatNumber(data.comments)}</Text>
                                            <Text className="block od-stat-label">评论</Text>
                                          </View>
                                        )}
                                        {data.shares !== undefined && (
                                          <View className="od-stat-item">
                                            <Text className="block od-stat-value">{formatNumber(data.shares)}</Text>
                                            <Text className="block od-stat-label">分享</Text>
                                          </View>
                                        )}
                                      </View>
                                    </View>
                                  )
                                ))}
                                {/* 链接和截图 */}
                                {Object.entries(item.snapshot).map(([platform, data]: [string, any]) => (
                                  (data.link || (data.images && data.images.length > 0)) && (
                                    <View key={`link-${platform}`} className="od-card" style={{ marginTop: 8 }}>
                                      <Text className="block od-section-title">{getPlatformLabel(platform)}</Text>
                                      {data.link && (
                                        <View className="od-link-item" onClick={() => {
                                          Taro.setClipboardData({ data: data.link }).then(() => {
                                            Taro.showToast({ title: '链接已复制', icon: 'success', duration: 1500 })
                                          }).catch(() => {
                                            Taro.showToast({ title: '复制失败', icon: 'none', duration: 1500 })
                                          })
                                        }}
                                        >
                                          <View className="od-link-icon">
                                            <ExternalLink size={14} color="#6366F1" />
                                          </View>
                                          <View className="od-link-content">
                                            <Text className="block od-link-label">发布链接</Text>
                                            <Text className="block od-link-url">{data.link}</Text>
                                          </View>
                                          <ChevronRight size={16} color="#9CA3AF" />
                                        </View>
                                      )}
                                      {data.images && data.images.length > 0 && (
                                        <View className="od-images-section">
                                          <View className="od-images-header">
                                            <ImageIcon size={14} color="#6366F1" />
                                            <Text className="block od-images-label">发布截图</Text>
                                          </View>
                                          <View className="od-images-grid">
                                            {data.images.map((img: string, imgIdx: number) => (
                                              <Image
                                                key={imgIdx}
                                                src={img}
                                                className="od-preview-image"
                                                mode="aspectFill"
                                                onClick={() => handleImagePreview(img)}
                                              />
                                            ))}
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                  )
                                ))}
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* 数据统计 */}
                {platformEntries.map(([platform, feedback]: [string, any]) => (
                  <View key={platform}>
                    {(feedback.views !== undefined || feedback.likes !== undefined || feedback.comments !== undefined || feedback.shares !== undefined) && (
                      <View className="od-card od-stats-card">
                        <View className="od-stats-header">
                          <TrendingUp size={16} color="#6366F1" />
                          <Text className="block od-stats-title">{getPlatformLabel(platform)}</Text>
                        </View>
                        <View className="od-stats-row">
                          {feedback.views !== undefined && (
                            <View className="od-stat-item">
                              <Text className="block od-stat-value">{formatNumber(feedback.views)}</Text>
                              <Text className="block od-stat-label">浏览</Text>
                            </View>
                          )}
                          {feedback.likes !== undefined && (
                            <View className="od-stat-item">
                              <Text className="block od-stat-value">{formatNumber(feedback.likes)}</Text>
                              <Text className="block od-stat-label">点赞</Text>
                            </View>
                          )}
                          {feedback.comments !== undefined && (
                            <View className="od-stat-item">
                              <Text className="block od-stat-value">{formatNumber(feedback.comments)}</Text>
                              <Text className="block od-stat-label">评论</Text>
                            </View>
                          )}
                          {feedback.shares !== undefined && (
                            <View className="od-stat-item">
                              <Text className="block od-stat-value">{formatNumber(feedback.shares)}</Text>
                              <Text className="block od-stat-label">分享</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                ))}

                {/* 链接和截图 */}
                {platformEntries.map(([platform, feedback]: [string, any]) => (
                  <View key={`link-${platform}`} className="od-card">
                    <Text className="block od-section-title">{getPlatformLabel(platform)}</Text>
                    {feedback.link && (
                      <View className="od-link-item" onClick={() => {
                        Taro.setClipboardData({ data: feedback.link }).then(() => {
                          Taro.showToast({ title: '链接已复制', icon: 'success', duration: 1500 })
                        }).catch(() => {
                          Taro.showToast({ title: '复制失败', icon: 'none', duration: 1500 })
                        })
                      }}
                      >
                        <View className="od-link-icon">
                          <ExternalLink size={14} color="#6366F1" />
                        </View>
                        <View className="od-link-content">
                          <Text className="block od-link-label">发布链接</Text>
                          <Text className="block od-link-url">{feedback.link}</Text>
                        </View>
                        <ChevronRight size={16} color="#9CA3AF" />
                      </View>
                    )}
                    {feedback.images && feedback.images.length > 0 && (
                      <View className="od-images-section">
                        <View className="od-images-header">
                          <ImageIcon size={14} color="#6366F1" />
                          <Text className="block od-images-label">截图 ({feedback.images.length})</Text>
                        </View>
                        <View className="od-images-grid">
                          {feedback.images.map((img: string, idx: number) => (
                            <Image key={idx} src={img} className="od-preview-image" mode="aspectFill" onClick={() => handleImagePreview(img)} />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )
          })()}
        </ScrollView>

        {/* 底部操作 - 仅待验收状态(含preview)显示验收/驳回按钮 */}
        {
          ['awaiting_acceptance', 'feedback_submitted', 'preview'].includes(selectedAvatar.status) && (
            <View className="od-actions">
              <View className="od-action-btn od-action-danger" onClick={() => setShowReject(true)}>
                <CircleAlert size={16} color="#EF4444" />
                <Text className="block od-action-text" style={{ color: '#EF4444' }}>驳回</Text>
              </View>
              {(() => {
                const isPublished = isSelectedSpecialOrder
                  ? ['awaiting_acceptance', 'feedback_submitted', 'preview'].includes(selectedAvatar.status)
                  : generatedContent?.status === 'awaiting_acceptance'
                return isPublished ? (
                  <View className="od-action-btn od-action-primary" onClick={() => setShowApprove(true)}>
                    <CircleCheckBig size={16} color="#fff" />
                    <Text className="block od-action-text" style={{ color: '#fff' }}>验收通过</Text>
                  </View>
                ) : (
                  <View
                    className="od-action-btn od-action-primary od-action-disabled"
                    onClick={() => showToast({ title: '请等待分身发布内容后再验收', icon: 'none' })}
                  >
                    <CircleCheckBig size={16} color="#fff" />
                    <Text className="block od-action-text" style={{ color: '#fff' }}>验收通过</Text>
                  </View>
                )
              })()}
            </View>
          )
        }

        {/* 驳回弹窗 */}
        {
          showReject && (
            <View className="od-modal-overlay" onClick={() => { setShowReject(false); setSelectedReasonIdx(-1); setRejectReason('') }}>
              <View className="od-modal" onClick={(e) => e.stopPropagation()}>
                <View className="od-modal-icon" style={{ backgroundColor: '#FEE2E2' }}>
                  <CircleAlert size={24} color="#EF4444" />
                </View>
                <Text className="block od-modal-title">驳回修改</Text>
                <Text className="block od-modal-desc">请选择驳回原因，方便分身修改</Text>
                {/* 静默选项 */}
                <View
                  style={{ marginBottom: '10px', padding: '8px 10px', backgroundColor: isSilence ? '#FEF3C7' : '#F3F4F6', borderRadius: '6px', border: `1px solid ${isSilence ? '#FCD34D' : '#E5E7EB'}` }}
                  onClick={() => setIsSilence(!isSilence)}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: '16px', height: '16px', borderRadius: '4px',
                      backgroundColor: isSilence ? '#F59E0B' : 'transparent',
                      border: isSilence ? 'none' : '2px solid #D1D5DB',
                      marginRight: '8px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    >
                      {isSilence && <Text style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: '13px', color: isSilence ? '#92400E' : '#6B7280', fontWeight: '500' }}>同时静默该接单者（{formatSilenceDuration(silenceDurationMs)}）</Text>
                  </View>
                </View>
                <View style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {REJECT_REASONS.map((reason, idx) => (
                    <View
                      key={idx}
                      className="od-reject-reason-item"
                      style={{
                        display: 'flex', flexDirection: 'row', alignItems: 'center',
                        padding: '10px 12px', marginBottom: '6px', borderRadius: '8px',
                        backgroundColor: selectedReasonIdx === idx ? '#FEF2F2' : '#F9FAFB',
                        border: selectedReasonIdx === idx ? '1px solid #EF4444' : '1px solid #E5E7EB',
                      }}
                      onClick={() => setSelectedReasonIdx(idx)}
                    >
                      <View style={{
                        width: '18px', height: '18px', borderRadius: '9px',
                        border: selectedReasonIdx === idx ? '5px solid #EF4444' : '2px solid #D1D5DB',
                        marginRight: '10px', flexShrink: 0,
                      }}
                      />
                      <Text className="block" style={{ fontSize: '14px', color: selectedReasonIdx === idx ? '#EF4444' : '#374151' }}>
                        {reason}
                      </Text>
                    </View>
                  ))}
                  {selectedReasonIdx === REJECT_REASONS.length - 1 && (
                    <View className="od-modal-input-wrap" style={{ marginTop: '4px' }}>
                      <Input className="od-modal-input" placeholder="请详细描述问题..." value={rejectReason} onInput={(e: any) => setRejectReason(e.detail.value)} />
                    </View>
                  )}
                </View>
                <View className="od-modal-actions">
                  <View className="od-modal-btn od-modal-btn-cancel" onClick={() => { setShowReject(false); setSelectedReasonIdx(-1); setRejectReason('') }}>
                    <Text className="block">取消</Text>
                  </View>
                  <View className="od-modal-btn od-modal-btn-danger" onClick={handleReject}>
                    <Text className="block" style={{ color: '#fff' }}>确认驳回</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        }

        {/* 验收通过弹窗 */}
        {
          showApprove && (
            <View className="od-modal-overlay" onClick={() => setShowApprove(false)}>
              <View className="od-modal" onClick={(e) => e.stopPropagation()}>
                <View className="od-modal-icon" style={{ backgroundColor: '#D1FAE5' }}>
                  <Check size={24} color="#10B981" />
                </View>
                <Text className="block od-modal-title">确认验收通过？</Text>
                <Text className="block od-modal-desc">验收通过后将无法撤回，请仔细检查</Text>
                <View className="od-modal-actions">
                  <View className="od-modal-btn od-modal-btn-cancel" onClick={() => setShowApprove(false)}>
                    <Text className="block">取消</Text>
                  </View>
                  <View className="od-modal-btn od-modal-btn-primary" onClick={handleApprove}>
                    <Text className="block" style={{ color: '#fff' }}>确认通过</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        }
      </View >
    )
  }

  return (
    <View className="od-page">
      {/* 头部 */}
      <View className="od-header">
        <View className="od-header-deco1" />
        <View className="od-header-deco2" />
        <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
          <View className="od-back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={18} color="#fff" />
          </View>
          <View className="od-header-center">
            <Text className="block od-header-title">验收中</Text>
          </View>
          <View className="od-header-right" />
        </View>
        <View className="od-status-section">
          <View className="od-status-badge" style={{ backgroundColor: '#FEF3C7' }}>
            <Text className="block od-status-badge-text" style={{ color: '#F59E0B' }}>待验收</Text>
          </View>
          <Text className="block od-status-desc">
            {(() => {
              const awaiting = avatars.filter(a => ['awaiting_acceptance', 'feedback_submitted', 'preview'].includes(a.status)).length
              const generating = avatars.filter(a => a.status === 'generating' || a.status === 'accepted').length
              const completed = avatars.filter(a => a.status === 'completed').length
              return `${awaiting}个待验收 · ${generating}个制作中 · ${completed}个已验收`
            })()}
          </Text>
        </View>
      </View>

      {/* 内容 */}
      <ScrollView scrollY className="od-body">
        {/* 待验收分身 */}
        {(() => {
          const awaitingAvatars = avatars.filter(a => ['awaiting_acceptance', 'feedback_submitted', 'preview'].includes(a.status))
          const generatingAvatars = avatars.filter(a => a.status === 'generating' || a.status === 'accepted')
          const completedAvatars = avatars.filter(a => a.status === 'completed')
          const pendingAvatars = avatars.filter(a => a.status === 'pending')
          const rejectedAvatars = avatars.filter(a => a.status === 'rejected')

          return (
            <>
              {/* 待验收 */}
              {awaitingAvatars.length > 0 && (
                <View className="od-card">
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 8 }} />
                    <Text className="block od-section-title" style={{ marginBottom: 0 }}>待验收 ({awaitingAvatars.length})</Text>
                  </View>
                  {awaitingAvatars.map((avatar, index) => {
                    const countdownItem = countdowns[avatar.avatarId]
                    const countdown = countdownItem?.display || ''
                    const isExpired = countdown === '已超时'
                    return (
                      <View key={avatar.avatarId} className="od-avatar-item" onClick={() => handleSelectAvatar(avatar)}>
                        <View className="od-avatar-left">
                          <View className="od-avatar-num" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>{index + 1}</View>
                          <Image src={avatar.avatarUrl || ''} className="od-avatar-thumb" mode="aspectFill" />
                          <View className="od-avatar-text">
                            <Text className="block od-avatar-name">{avatar.avatarName}</Text>
                            <Text className="block od-avatar-hint">
                              {avatar.status === 'preview' ? '内容已生成，请验收' : avatar.publishFeedback ? '已提交发布内容' : '等待提交'}
                            </Text>
                            {countdown && (
                              <View style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                                <CircleAlert size={12} color={isExpired ? '#EF4444' : '#F59E0B'} />
                                <Text className="block" style={{ fontSize: '12px', color: isExpired ? '#EF4444' : '#F59E0B', marginLeft: 4 }}>
                                  {isExpired ? '审核超时，已自动验收' : `审核倒计时: ${countdown}`}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <ChevronRight size={18} color="#9CA3AF" />
                      </View>
                    )
                  })}
                </View>
              )}

              {/* 制作中 */}
              {generatingAvatars.length > 0 && (
                <View className="od-card">
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 8 }} />
                    <Text className="block od-section-title" style={{ marginBottom: 0 }}>制作中 ({generatingAvatars.length})</Text>
                  </View>
                  {generatingAvatars.map(avatar => (
                    <View key={avatar.avatarId} className="od-avatar-item" style={{ opacity: 0.7 }}>
                      <View className="od-avatar-left">
                        <View className="od-avatar-num" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>⏳</View>
                        <Image src={avatar.avatarUrl || ''} className="od-avatar-thumb" mode="aspectFill" />
                        <View className="od-avatar-text">
                          <Text className="block od-avatar-name">{avatar.avatarName}</Text>
                          <Text className="block od-avatar-hint" style={{ color: '#3B82F6' }}>
                            {avatar.status === 'generating' ? '内容生成中...' : avatar.status === 'accepted' ? '已接单，即将开始创作' : '内容已完成，待发布'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 已完成 */}
              {completedAvatars.length > 0 && (
                <View className="od-card">
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 8 }} />
                    <Text className="block od-section-title" style={{ marginBottom: 0 }}>已验收 ({completedAvatars.length})</Text>
                  </View>
                  {completedAvatars.map(avatar => (
                    <View key={avatar.avatarId} className="od-avatar-item" onClick={() => handleSelectAvatar(avatar)}>
                      <View className="od-avatar-left">
                        <View className="od-avatar-num" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>✓</View>
                        <Image src={avatar.avatarUrl || ''} className="od-avatar-thumb" mode="aspectFill" />
                        <View className="od-avatar-text">
                          <Text className="block od-avatar-name">{avatar.avatarName}</Text>
                          <Text className="block od-avatar-hint" style={{ color: '#10B981' }}>已验收通过</Text>
                        </View>
                      </View>
                      <ChevronRight size={18} color="#9CA3AF" />
                    </View>
                  ))}
                </View>
              )}

              {/* 未接单 */}
              {pendingAvatars.length > 0 && (
                <View className="od-card">
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CA3AF', marginRight: 8 }} />
                    <Text className="block od-section-title" style={{ marginBottom: 0 }}>未接单 ({pendingAvatars.length})</Text>
                  </View>
                  {pendingAvatars.map(avatar => (
                    <View key={avatar.avatarId} className="od-avatar-item" style={{ opacity: 0.5 }}>
                      <View className="od-avatar-left">
                        <View className="od-avatar-num" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>·</View>
                        <Image src={avatar.avatarUrl || ''} className="od-avatar-thumb" mode="aspectFill" />
                        <View className="od-avatar-text">
                          <Text className="block od-avatar-name">{avatar.avatarName}</Text>
                          <Text className="block od-avatar-hint" style={{ color: '#9CA3AF' }}>等待接单</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 已拒绝 */}
              {rejectedAvatars.length > 0 && (
                <View className="od-card">
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 }} />
                    <Text className="block od-section-title" style={{ marginBottom: 0 }}>已拒绝 ({rejectedAvatars.length})</Text>
                  </View>
                  {rejectedAvatars.map(avatar => (
                    <View key={avatar.avatarId} className="od-avatar-item" style={{ opacity: 0.5 }}>
                      <View className="od-avatar-left">
                        <View className="od-avatar-num" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>✕</View>
                        <Image src={avatar.avatarUrl || ''} className="od-avatar-thumb" mode="aspectFill" />
                        <View className="od-avatar-text">
                          <Text className="block od-avatar-name">{avatar.avatarName}</Text>
                          <Text className="block od-avatar-hint" style={{ color: '#EF4444' }}>
                            {avatar.rejectReason || '已拒绝接单'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 无分身 */}
              {avatars.length === 0 && (
                <View className="od-card od-empty-card">
                  <View className="od-empty-icon">
                    <CircleCheckBig size={48} color="#10B981" />
                  </View>
                  <Text className="block od-empty-title">暂无分身</Text>
                  <Text className="block od-empty-desc">还没有分身被分配到这个订单</Text>
                </View>
              )}
            </>
          )
        })()}
      </ScrollView>
    </View>
  )
}
