import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Image, ScrollView, Text, Video, View } from '@tarojs/components'
import { ArrowLeft, Camera, ExternalLink, Save, ShieldAlert } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { canonicalizePlatform, canonicalizePlatforms, getPlatformLabel } from '@/constants/publish-platform'
import { getStepTypeColor } from '@/constants/stepTypes'
import './index.css'

type MaterialItem = {
  type: 'text' | 'image' | 'video'
  content: string
}

type AssignedMaterialGroup = {
  mode?: 'shared' | 'exclusive'
  sourceMode?: string
  items?: MaterialItem[]
  prompt?: string
}

type TaskInfo = {
  orderId?: string
  platform?: string
  platforms?: string[]
  title?: string
  description?: string
}

type TaskStep = {
  id: string
  stepType?: string
  step_type?: string
  stepTitle?: string
  step_title?: string
  stepDesc?: string
  step_desc?: string
  mainContent?: string
  main_content?: string
  mediaList?: any[]
  media_list?: any[]
  extConfig?: Record<string, string>
  ext_config?: Record<string, string>
  isMaterial?: boolean
  materialType?: 'text' | 'image' | 'video'
  assignedMaterial?: AssignedMaterialGroup
}

const getStepType = (step: TaskStep) => step.stepType || step.step_type || ''
const getStepTitle = (step: TaskStep) => step.stepTitle || step.step_title || ''
const getStepDesc = (step: TaskStep) => step.stepDesc || step.step_desc || ''
const getMainContent = (step: TaskStep) => step.mainContent || step.main_content || ''
const getMediaList = (step: TaskStep) => step.mediaList || step.media_list || []
const getExtConfig = (step: TaskStep) => step.extConfig || step.ext_config || {}
const PREVIEW_ONLY_STATUSES = ['awaiting_acceptance', 'settled', 'cancelled', 'failed', 'rejected']
const VERIFY_REQUIRED_PLATFORMS = ['douyin', 'kuaishou', 'xiaohongshu', 'wechat_mp', 'wechat_channel']
const REQUIRED_COLLECT_STEP_LABELS: Record<string, string> = {
  collect_image: '收集截图',
  collect_info: '收集信息',
  collect_url: '收集链接',
}
const getStepResult = (stepResults: Record<string, any>, step: TaskStep) => stepResults[step.id] || stepResults[String(step.id)] || {}
const hasStepResultValue = (value: any) => {
  if (Array.isArray(value)) {
    return value.some((item) => String(item || '').trim())
  }
  return String(value || '').trim().length > 0
}
const COPY_TEXT_PREVIEW_LENGTH = 120

const getAiTextStatusLabel = (status?: string) => {
  if (status === 'completed') return '已完成'
  if (status === 'generating') return '生成中'
  return '排队中'
}

export default function OrderAcceptTask() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()
  const requestId = String(router.params?.requestId || router.params?.id || '')
  const routeOrderId = String(router.params?.orderId || router.params?.order_id || '')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [urgingReview, setUrgingReview] = useState(false)
  const [savingAllStepId, setSavingAllStepId] = useState('')
  const submitLockRef = useRef(false)
  const [taskStatus, setTaskStatus] = useState('')
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [stepResults, setStepResults] = useState<Record<string, any>>({})
  const [expandedCopyTexts, setExpandedCopyTexts] = useState<Record<string, boolean>>({})
  const [copyScrollTarget, setCopyScrollTarget] = useState('')
  const [assignedMaterials, setAssignedMaterials] = useState<Record<string, AssignedMaterialGroup & { status?: string }>>({})
  const [taskInfo, setTaskInfo] = useState<TaskInfo>({})
  const [collectUrlVerifyStatus, setCollectUrlVerifyStatus] = useState<Record<string, 'idle' | 'verifying' | 'success' | 'failed'>>({})
  const [collectUrlVerifyMessage, setCollectUrlVerifyMessage] = useState<Record<string, string>>({})
  const collectUrlVerifyTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const collectUrlVerifySeqRef = useRef<Record<string, number>>({})
  const [revisionReason, setRevisionReason] = useState<string>('')
  const previewOnly = PREVIEW_ONLY_STATUSES.includes(taskStatus)
  const textMaterial = assignedMaterials.text
  const isAiTextGenerating = textMaterial?.sourceMode === 'ai_prompt_only' && textMaterial?.status !== 'completed'

  const CHINESE_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

  const getChineseNumber = (num: number): string => {
    if (num <= 10) {
      return CHINESE_NUMBERS[num]
    }
    const tens = Math.floor(num / 10)
    const ones = num % 10
    if (ones === 0) {
      return CHINESE_NUMBERS[tens] + '十'
    }
    return CHINESE_NUMBERS[tens] + '十' + CHINESE_NUMBERS[ones]
  }
  const fetchTaskView = async (silent = false) => {
    if (!requestId) return
    if (!silent) setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/order-processing/${requestId}/task-view`,
      })
      const data = res.data?.data
      if (res.data?.code === 200 && data) {
        setSteps(Array.isArray(data.steps) ? data.steps : [])
        setTaskStatus(data.request?.status || data.status || '')
        setStepResults(data.stepResults || {})
        setAssignedMaterials(data.assignedMaterials || {})
        const config = data.config || {}
        const request = data.request || {}
        setTaskInfo({
          orderId: request.orderId || request.order_id || config.orderId || config.order_id || routeOrderId,
          platform: request.platform || config.platform || '',
          platforms: canonicalizePlatforms(config.platforms || request.platforms || []),
          title: config.title || data.title || '',
          description: config.description || data.description || '',
        })
        // 获取整改原因
        const publishFeedback = data.publishFeedback || data.publish_feedback || {}
        const reason = publishFeedback.rejectReason || publishFeedback.reject_reason || ''
        setRevisionReason(reason)
      } else {
        Taro.showToast({ title: res.data?.message || '获取任务失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[接单任务] 获取失败:', error)
      Taro.showToast({ title: '获取任务失败', icon: 'none' })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaskView()
  }, [requestId])

  useEffect(() => {
    if (!requestId || !isAiTextGenerating) return
    const timer = setInterval(() => fetchTaskView(true), 2000)
    return () => clearInterval(timer)
  }, [requestId, isAiTextGenerating])

  useEffect(() => {
    return () => {
      Object.values(collectUrlVerifyTimerRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer)
      })
    }
  }, [])

  const getTargetPlatform = () => {
    const platforms = canonicalizePlatforms(taskInfo.platforms || [])
    return platforms[0] || canonicalizePlatform(taskInfo.platform || '')
  }

  const getTargetPlatformLabel = () => {
    const platform = getTargetPlatform()
    return platform ? getPlatformLabel(platform) : ''
  }

  const isVerifyRequiredPlatform = (platform: string) => VERIFY_REQUIRED_PLATFORMS.includes(platform)


  const setCollectVerifyState = (stepId: string, status: 'idle' | 'verifying' | 'success' | 'failed', message = '') => {
    setCollectUrlVerifyStatus(prev => ({ ...prev, [stepId]: status }))
    setCollectUrlVerifyMessage(prev => ({ ...prev, [stepId]: message }))
  }

  const verifyCollectUrl = async (stepId: string, platform: string, postUrl: string, seq: number) => {
    const keywords = [taskInfo.title, taskInfo.description].filter(Boolean).map(String)
    try {
      const response = await Network.request({
        url: '/api/tikhub/verify-post',
        method: 'POST',
        data: { platform, postUrl, keywords },
      })
      if (seq !== collectUrlVerifySeqRef.current[stepId]) return
      const data = response.data
      if (data?.code === 200 && data?.data) {
        setCollectVerifyState(stepId, data.data.verified ? 'success' : 'failed', data.data.message || (data.data.verified ? '验证通过' : '验证失败'))
      } else {
        setCollectVerifyState(stepId, 'failed', data?.message || '验证失败，请重试')
      }
    } catch {
      if (seq !== collectUrlVerifySeqRef.current[stepId]) return
      setCollectVerifyState(stepId, 'failed', '网络异常，请重试')
    }
  }

  const scheduleCollectUrlVerify = (step: TaskStep, value: string) => {
    const stepId = step.id
    if (collectUrlVerifyTimerRef.current[stepId]) {
      clearTimeout(collectUrlVerifyTimerRef.current[stepId]!)
      collectUrlVerifyTimerRef.current[stepId] = null
    }
    const seq = (collectUrlVerifySeqRef.current[stepId] || 0) + 1
    collectUrlVerifySeqRef.current[stepId] = seq

    const postUrl = value.trim()
    if (!postUrl) {
      setCollectVerifyState(stepId, 'idle', '')
      return
    }
    const platform = getTargetPlatform()
    if (!platform) {
      setCollectVerifyState(stepId, 'failed', '缺少目标平台')
      return
    }
    if (!isVerifyRequiredPlatform(platform)) {
      setCollectVerifyState(stepId, 'success', '链接格式正确')
      return
    }

    setCollectVerifyState(stepId, 'verifying', '验证中...')
    collectUrlVerifyTimerRef.current[stepId] = setTimeout(() => verifyCollectUrl(stepId, platform, postUrl, seq), 600)
  }

  // useEffect(() => {
  //   if (previewOnly) return
  //   steps.forEach((step) => {
  //     if (getStepType(step) !== 'collect_url') return
  //     const result = getStepResult(stepResults, step)
  //     const value = String(result.value || '').trim()
  //     if (!value || collectUrlVerifyStatus[step.id]) return
  //     scheduleCollectUrlVerify(step, value)
  //   })
  // }, [steps, stepResults, taskInfo, previewOnly])
  const saveStepResult = async (step: TaskStep, valueType: string, value: any) => {
    const stepId = step.id
    const next = {
      ...(stepResults || {}),
      [stepId]: {
        stepId,
        stepType: getStepType(step),
        valueType,
        value,
      },
    }
    setStepResults(next)
    try {
      const res = await Network.request({
        url: `/api/order-processing/${requestId}/step-results`,
        method: 'PUT',
        data: {
          stepId,
          stepType: getStepType(step),
          valueType,
          value,
        },
      })
      if (res.data?.code !== 200) {
        Taro.showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[接单任务] 保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const getImageMaterialItems = (step: TaskStep) => {
    const items = step.assignedMaterial?.items || []
    return items.filter((item) => item.type === 'image' && item.content)
  }
  const handleUploadImage = async (step: TaskStep) => {
    try {
      const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      if (!selected.tempFilePaths.length) return
      Taro.showLoading({ title: '上传中...', mask: true })
      const result = await Network.uploadFile({
        url: '/api/upload/image',
        filePath: selected.tempFilePaths[0],
        name: 'file',
      })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try { uploadData = JSON.parse(uploadData) } catch { uploadData = null }
      }
      const url = uploadData?.data?.url
      if (uploadData?.code === 200 && url) {
        await saveStepResult(step, 'image', [url])
        Taro.showToast({ title: '上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('[接单任务] 图片上传失败:', error)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    }
  }

  const copyText = (text: string) => {
    if (!text) return
    Taro.setClipboardData({ data: text, success: () => Taro.showToast({ title: '已复制', icon: 'success' }) })
  }

  const openUrl = (url: string) => {
    if (!url) return
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
  }

  const requestAlbumPermission = async () => {
    try {
      const settingRes = await Taro.getSetting()
      const authSetting = settingRes.authSetting || {}
      if (authSetting['scope.writePhotosAlbum'] === true) return true
      if (authSetting['scope.writePhotosAlbum'] === false) return false
      await Taro.authorize({ scope: 'scope.writePhotosAlbum' })
      return true
    } catch {
      return false
    }
  }

  const handleSaveImage = async (imageUrl: string) => {
    if (!imageUrl) return
    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存图片，请前往设置开启',
        showCancel: true,
        success: (res) => {
          if (res.confirm) Taro.openSetting()
        },
      })
      return
    }

    Taro.showLoading({ title: '保存中...', mask: true })
    try {
      const res: any = await Network.downloadFile({ url: imageUrl })
      if (res.statusCode === 200) {
        Taro.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '已保存到相册', icon: 'success' })
          },
          fail: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '保存失败', icon: 'none' })
          },
        })
      } else {
        Taro.hideLoading()
        Taro.showToast({ title: '下载图片失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '下载图片失败', icon: 'none' })
    }
  }


  const handleSaveAllImages = async (step: TaskStep) => {
    const images = getImageMaterialItems(step).map((item) => item.content)
    if (images.length === 0 || savingAllStepId) return

    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      const { confirm } = await Taro.showModal({
        title: '需要相册权限',
        content: '请在设置中开启相册权限，才能保存图片到本地',
        confirmText: '去设置',
        confirmColor: '#6366F1',
      })
      if (confirm) Taro.openSetting()
      return
    }

    setSavingAllStepId(step.id)
    Taro.showLoading({ title: '准备保存...', mask: true })
    let savedCount = 0
    let failedCount = 0

    for (let i = 0; i < images.length; i++) {
      Taro.showLoading({ title: `保存中 ${i + 1}/${images.length}`, mask: true })
      try {
        const res: any = await Network.downloadFile({ url: images[i], timeout: 60000 })
        if (res.statusCode === 200) {
          try {
            await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
            savedCount++
          } catch (saveErr) {
            console.error(`[接单任务] 第${i + 1}张保存到相册失败:`, saveErr)
            failedCount++
          }
        } else {
          console.error(`[接单任务] 第${i + 1}张下载失败, statusCode:`, res.statusCode)
          failedCount++
        }
      } catch (downloadErr) {
        console.error(`[接单任务] 第${i + 1}张下载异常:`, downloadErr)
        failedCount++
      }
    }

    Taro.hideLoading()
    setSavingAllStepId('')
    if (savedCount === 0 && failedCount > 0) {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } else if (failedCount === 0) {
      Taro.showToast({ title: `已保存${savedCount}张图片`, icon: 'success' })
    } else {
      Taro.showToast({ title: `已保存${savedCount}张，${failedCount}张失败`, icon: 'none' })
    }
  }
  const handleSaveVideo = async (videoUrl: string) => {
    if (!videoUrl) return
    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存视频，请前往设置开启',
        showCancel: true,
        success: (res) => {
          if (res.confirm) Taro.openSetting()
        },
      })
      return
    }

    Taro.showLoading({ title: '保存中...', mask: true })
    try {
      const res: any = await Network.downloadFile({ url: videoUrl })
      if (res.statusCode === 200) {
        Taro.saveVideoToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '已保存到相册', icon: 'success' })
          },
          fail: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '保存失败', icon: 'none' })
          },
        })
      } else {
        Taro.hideLoading()
        Taro.showToast({ title: '下载视频失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '下载视频失败', icon: 'none' })
    }
  }

  const handleUrgeReview = async () => {
    const targetOrderId = taskInfo.orderId || routeOrderId
    if (!targetOrderId || urgingReview) return
    setUrgingReview(true)
    try {
      const res = await Network.request({
        url: '/api/notifications/urge-review',
        method: 'POST',
        data: { orderId: targetOrderId, contentTitle: taskInfo.title?.substring(0, 20) || '' },
      })
      if (res?.data?.code === 200) {
        Taro.showToast({ title: '催验收提醒已发送', icon: 'success' })
      } else {
        Taro.showToast({ title: res?.data?.message || '发送失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' })
    } finally {
      setUrgingReview(false)
    }
  }
  const handlePublishTask = async () => {
    if (!requestId || submitting || submitLockRef.current) return
    submitLockRef.current = true
    const missingStep = steps.find((step) => {
      const stepType = getStepType(step)
      if (!REQUIRED_COLLECT_STEP_LABELS[stepType]) return false
      const result = getStepResult(stepResults, step)
      return !hasStepResultValue(result.value)
    })
    if (missingStep) {
      const stepIndex = steps.findIndex((step) => step.id === missingStep.id)
      Taro.showToast({
        title: `步骤${stepIndex + 1}：需要您提供对应收集信息!`,
        icon: 'none',
        duration: 2400,
      })
      submitLockRef.current = false
      return
    }

    // const invalidCollectUrlStep = steps.find((step) => {
    //   if (getStepType(step) !== 'collect_url') return false
    //   const result = getStepResult(stepResults, step)
    //   if (!hasStepResultValue(result.value)) return false
    //   return collectUrlVerifyStatus[step.id] !== 'success'
    // })
    // if (invalidCollectUrlStep) {
    //   const stepIndex = steps.findIndex((step) => step.id === invalidCollectUrlStep.id)
    //   Taro.showToast({
    //     title: `步骤${stepIndex + 1}：请先输入有效的目标平台链接!`,
    //     icon: 'none',
    //     duration: 2400,
    //   })
    //   submitLockRef.current = false
    //   return
    // }
    const confirm = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '确认发布',
        content: '发布后将提交给商家验收，确认发布吗？',
        cancelText: '再检查下',
        confirmText: '确认发布',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })

    if (!confirm) {
      submitLockRef.current = false
      return
    }

    setSubmitting(true)
    Taro.showLoading({ title: '发布中...', mask: true })
    try {
      const res = await Network.request({
        url: `/api/order-processing/${requestId}/task-submit`,
        method: 'POST',
        data: { stepResults },
      })
      Taro.hideLoading()
      if (res.data?.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/package-avatar/pages/generated-content/index' })
        }, 600)
      } else {
        Taro.showToast({ title: res.data?.message || '发布失败', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('[接单任务] 发布失败:', error)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }


  const renderCopyBox = (copyKey: string | number, text: string, buttonText?: string) => {
    const normalizedCopyKey = String(copyKey)
    const chars = Array.from(text || '')
    const expanded = !!expandedCopyTexts[normalizedCopyKey]
    const shouldCollapse = chars.length > COPY_TEXT_PREVIEW_LENGTH
    const displayText = expanded || !shouldCollapse ? text : `${chars.slice(0, COPY_TEXT_PREVIEW_LENGTH).join('')}...`
    const copyBoxId = `copy-box-${normalizedCopyKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`

    const handleToggleCopyText = () => {
      setExpandedCopyTexts(prev => ({ ...prev, [normalizedCopyKey]: !expanded }))
      if (expanded) {
        setCopyScrollTarget('')
        setTimeout(() => setCopyScrollTarget(copyBoxId), 30)
      }
    }

    return (
      <View id={copyBoxId} className="accept-copy-box">
        <Text className="accept-copy-text">{displayText}</Text>
        {(shouldCollapse || (!previewOnly && buttonText)) && (
          <View className="accept-copy-footer">
            {shouldCollapse ? (
              <Text
                className="accept-copy-toggle"
                onClick={handleToggleCopyText}
              >
                {expanded ? '收起' : '展开'}
              </Text>
            ) : <View />}
            {!previewOnly && buttonText && (
              <Button className="accept-copy-btn" onClick={() => copyText(text)}>
                <Text className="accept-copy-btn-text">{buttonText}</Text>
              </Button>
            )}
          </View>
        )}
      </View>
    )
  }

  const renderMaterialContent = (step: TaskStep, extConfig: Record<string, string>) => {
    const materialGroup = step.assignedMaterial || {}
    const items = materialGroup.items || []
    const imageUrls = items.filter((item) => item.type === 'image' && item.content).map((item) => item.content)
    const hasPrompt = !!materialGroup.prompt && items.length === 0

    if (items.length === 0 && !hasPrompt) return null

    if (hasPrompt) {
      return (
        <View className="accept-ai-box">
          <Text className="accept-ai-text">{materialGroup.prompt}</Text>
        </View>
      )
    }

    return (
      <View className="accept-material-grid">
        {items.map((item, index) => (
          <View key={`${step.id}-${index}`} className={item.type === 'text' ? 'accept-material-box' : 'accept-material-item'}>
            {item.type === 'text' && renderCopyBox(`${step.id}-${index}`, item.content, extConfig.copy_button_text)}
            {item.type === 'image' && (
              <>
                <Image src={item.content} className="accept-material-image" mode="aspectFill" onClick={() => Taro.previewImage({ urls: imageUrls, current: item.content })} />
                {!previewOnly && extConfig.save_button_image && (
                  <Button className="accept-material-btn accept-material-btn-save accept-material-action" onClick={() => handleSaveImage(item.content)}>
                    <Text className="accept-material-btn-text">{extConfig.save_button_image}</Text>
                  </Button>
                )}
              </>
            )}
            {item.type === 'video' && (
              <>
                <Video src={item.content} className="accept-material-video" controls />
                {!previewOnly && extConfig.save_button_video && (
                  <Button className="accept-material-btn accept-material-btn-save accept-material-action" onClick={() => handleSaveVideo(item.content)}>
                    <Text className="accept-material-btn-text">{extConfig.save_button_video}</Text>
                  </Button>
                )}
              </>
            )}
          </View>
        ))}
      </View>
    )
  }

  const renderStepContent = (step: TaskStep) => {
    const stepType = getStepType(step)

    if (stepType === 'material_text' && isAiTextGenerating) {
      return (
        <View className="accept-ai-box">
          <Text className="accept-ai-text">
            AI {getAiTextStatusLabel(textMaterial?.status)}...
          </Text>
        </View>
      )
    }

    const mainContent = getMainContent(step)
    const mediaList = getMediaList(step)
    const extConfig = getExtConfig(step)
    const result = getStepResult(stepResults, step)
    const inputUrlActionCount = ['open_button_text', 'copy_button_text'].filter(key => !!extConfig[key]).length
    const sampleImage = mediaList.find((item: any) => item.type === 'sample_image' || item.type === 'image' || item.type === 'qrcode')?.url
    const video = mediaList.find((item: any) => item.type === 'video')?.url

    return (
      <>
        {step.isMaterial && renderMaterialContent(step, extConfig)}
        {mainContent && ['input_url'].includes(stepType) && (
          <View className={`accept-url-box ${inputUrlActionCount === 1 ? 'single-action' : ''}`}>
            <Text className="accept-url-text">{mainContent}</Text>
            <View className={`accept-action-row ${inputUrlActionCount === 1 ? 'single-action' : ''}`}>
              {!previewOnly && extConfig.open_button_text && (
                <Button className="accept-action-btn" onClick={() => openUrl(mainContent)}>
                  <ExternalLink size={14} color="#fff" />
                  <Text className="accept-action-btn-text">{extConfig.open_button_text}</Text>
                </Button>
              )}
              {!previewOnly && extConfig.copy_button_text && (
                <Button variant="outline" className="accept-action-btn accept-action-btn-light" onClick={() => copyText(mainContent)}>
                  <Text className="accept-action-btn-secondary">{extConfig.copy_button_text}</Text>
                </Button>
              )}
            </View>
          </View>
        )}
        {mainContent && stepType === 'copy_data' && renderCopyBox(step.id, mainContent, extConfig.copy_button_text)}
        {sampleImage && !stepType.includes('collect_image') && (
          <View className="accept-qrcode-grid">
            <View className="accept-qrcode-item">
              <Image src={sampleImage} className="accept-qrcode-image" mode="widthFix" onClick={() => Taro.previewImage({ urls: [sampleImage], current: sampleImage })} />
              <View className="accept-qrcode-action">
                {!previewOnly && extConfig.save_button_image && (
                  <Button className={stepType === 'upload_qrcode' ? 'accept-action-btn-qrcode' : 'accept-action-btn'} onClick={() => handleSaveImage(sampleImage)}>
                    <Text className="accept-action-btn-text">{extConfig.save_button_image}</Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        )}
        {/* // && stepType === 'upload_qrcode'  */}
        {/* {sampleImage && !stepType.includes('collect_image') && stepType !== 'upload_qrcode' && <Image src={sampleImage} className="accept-image" mode="widthFix" />}
        {!previewOnly && sampleImage && extConfig.save_button_image && stepType !== 'upload_qrcode' && (
          <Button className="accept-action-btn" onClick={() => handleSaveImage(sampleImage)}>
            <Text className="accept-action-btn-text">{extConfig.save_button_image}</Text>
          </Button>
        )} */}
        {video && <Video src={video} className="accept-video" controls />}
        {!previewOnly && video && extConfig.save_button_video && (
          <Button className="accept-action-btn" onClick={() => handleSaveVideo(video)}>
            <Text className="accept-action-btn-text">{extConfig.save_button_video}</Text>
          </Button>
        )}
        {stepType === 'collect_image' && (
          <View className="accept-collect-box">
            <View className="accept-collect-grid">
              <View className="accept-collect-item">
                {sampleImage ? (
                  <>
                    <Image src={sampleImage} className="accept-collect-sample" mode="widthFix" onClick={() => Taro.previewImage({ urls: [sampleImage], current: sampleImage })} />
                    <Text className="accept-collect-label">示例图片</Text>
                  </>
                ) : (
                  <Text className="accept-copy-text">暂无示例图片</Text>
                )}
              </View>
              <View className="accept-collect-item">
                <View className="accept-upload" onClick={() => !previewOnly && handleUploadImage(step)}>
                  {Array.isArray(result.value) && result.value[0] ? (
                    <Image src={result.value[0]} className="accept-uploaded-image" mode="widthFix" />
                  ) : previewOnly ? (
                    <Text className="accept-copy-text">暂无收集图片</Text>
                  ) : (
                    !previewOnly && extConfig.upload_button_image && (
                      <View className="accept-upload-placeholder">
                        <Camera size={40} color="#1677ff" />
                        <Text className="accept-upload-text">{extConfig.upload_button_image}</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
        {stepType === 'collect_info' && previewOnly && (
          <>
            {mainContent && (
              <View className="accept-example-row">
                <Text className="accept-example-label">示例：</Text>
                <Text className="accept-example-text">{mainContent}</Text>
              </View>
            )}
            <View className="accept-info-preview">
              <Text className="accept-info-preview-text">{result.value}</Text>
            </View>
          </>
        )}
        {stepType === 'collect_info' && !previewOnly && (
          <>
            {mainContent && (
              <View className="accept-example-row">
                <Text className="accept-example-label">示例：</Text>
                <Text className="accept-example-text">{mainContent}</Text>
              </View>
            )}
            <Input
              className="accept-input"
              placeholder="请提供商家要求的收集信息"
              value={result.value || ''}
              onInput={(event) => saveStepResult(step, 'text', event.detail.value)}
            />
          </>
        )}
        {stepType === 'collect_url' && previewOnly && (
          <>
            {mainContent && (
              <View className="accept-example-row">
                <Text className="accept-example-label">示例链接：</Text>
                <Text className="accept-example-text">{mainContent}</Text>
              </View>
            )}
            <View className="accept-url-box">
              <Text className="accept-url-text">{result.value}</Text>
            </View>
          </>
        )}
        {stepType === 'collect_url' && !previewOnly && (
          <>
            {mainContent && (
              // <View className="accept-example-row" onClick={() => copyText(mainContent)}>
              <View className="accept-example-row">
                <Text className="accept-example-label">示例链接：</Text>
                <Text className="accept-example-text">{mainContent}</Text>
              </View>
            )}
            <Input
              className="accept-input"
              placeholder="请提供商家要求的收集链接"
              value={result.value || ''}
              onInput={(event) => {
                const value = event.detail.value
                saveStepResult(step, 'url', value)
                // scheduleCollectUrlVerify(step, value)
              }}
            />
            {collectUrlVerifyStatus[step.id] && collectUrlVerifyStatus[step.id] !== 'idle' && (
              <View className={`accept-url-verify ${collectUrlVerifyStatus[step.id]}`}>
                <Text className={`accept-url-verify-text ${collectUrlVerifyStatus[step.id]}`}>{collectUrlVerifyMessage[step.id]}</Text>
              </View>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <View className="accept-page">
      <View className="accept-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="accept-header-content">
          <View className="accept-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="accept-header-title">发布任务引导</Text>
          <Text className="accept-header-desc">按步骤完成任务并提交验收信息</Text>
        </View>
      </View>

      <ScrollView scrollY className="accept-content" scrollIntoView={copyScrollTarget} scrollWithAnimation>
        {loading ? (
          <View className="accept-empty"><Text className="accept-empty-text">加载中...</Text></View>
        ) : (
          <View className="accept-section">
            {/* <Text className="accept-section-title">发布步骤</Text> */}
            <View className="accept-step-list">
              {steps.map((step, index) => (
                <View key={step.id} className="accept-step-card">
                  <View className="accept-step-header">
                    <View className="accept-step-index">
                      <Text className="accept-step-index-text">{index + 1}</Text>
                    </View>
                    <View className="accept-step-info">
                      <View className="accept-step-title-row">
                        <View className="accept-step-type-tag" style={{ color: getStepTypeColor(getStepType(step)).color, backgroundColor: getStepTypeColor(getStepType(step)).bgColor }}>
                          <Text className="accept-step-type-tag-text">步骤{getChineseNumber(index + 1)}：</Text>
                        </View>
                        <Text className="accept-step-name">{getStepType(step) === 'upload_qrcode' ? '二维码识别' : getStepTitle(step)}</Text>

                        <View className="accept-step-title-actions">
                          {getStepType(step) === 'material_image' && !previewOnly && getImageMaterialItems(step).length > 1 && (
                            <View className={`accept-save-all-btn ${savingAllStepId === step.id ? 'disabled' : ''}`} onClick={() => handleSaveAllImages(step)}>
                              <Save size={13} color="#3B82F6" />
                              <Text className="accept-save-all-text">{savingAllStepId === step.id ? '保存中' : '保存全部'}</Text>
                            </View>
                          )}
                          {getStepType(step) === 'collect_url' && getTargetPlatformLabel() && (
                            <Text className="accept-platform-badge">{getTargetPlatformLabel()}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                  <View >{getStepDesc(step) && <Text className="accept-step-desc">{getStepDesc(step)}</Text>}</View>
                  <View className="accept-step-content">
                    {renderStepContent(step)}
                  </View>
                </View>
              ))}
            </View>

            {/* 整改内容 - 仅 revision_requested 状态显示 */}
            {taskStatus === 'revision_requested' && revisionReason && (
              <View className="accept-revision-box">
                <View className="accept-revision-header">
                  <ShieldAlert size={18} color="#EA580C" />
                  <Text className="accept-revision-title">整改要求</Text>
                </View>
                <Text className="accept-revision-text">{revisionReason}</Text>
              </View>
            )}
            {/* 已拒绝 - 仅 rejected 状态显示 */}
            {taskStatus === 'rejected' && revisionReason && (
              <View className="accept-revision-box">
                <View className="accept-revision-header">
                  <ShieldAlert size={18} color="#EA580C" />
                  <Text className="accept-revision-title">已拒绝原因</Text>
                </View>
                <Text className="accept-revision-text">{revisionReason}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {(taskStatus === 'awaiting_acceptance' || (!previewOnly && !isAiTextGenerating)) && (
        <View
          className="accept-bottom-bar"
          style={{ position: 'fixed', display: 'flex' }}
        >
          {taskStatus === 'awaiting_acceptance' ? (
            <Button className="accept-submit-btn" onClick={handleUrgeReview} disabled={loading || urgingReview}>
              <Text className="accept-submit-text">{urgingReview ? '发送中...' : '催验收'}</Text>
            </Button>
          ) : (
            <Button className="accept-submit-btn" onClick={handlePublishTask} disabled={loading || submitting}>
              <Text className="accept-submit-text">{submitting ? '发布中...' : '发布'}</Text>
            </Button>
          )}
        </View>
      )}
    </View>
  )
}
