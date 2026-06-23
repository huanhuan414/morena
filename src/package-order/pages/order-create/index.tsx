import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Image, Video, Input as TaroInput } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Send, Check, ChevronRight, Loader, ArrowLeft,
  Users, Coins, Sparkles, Zap, ShieldCheck, Clock,
  Target, TrendingUp, Lightbulb, ClipboardList,
  Plus, X, Play, FileText, Pencil
} from 'lucide-react-taro'
import { Network } from '@/network'
import {
  PLATFORM_UI_ORDER,
  PLATFORM_META_MAP,
  canonicalizePlatform,
  canonicalizePlatforms
} from '@/constants/publish-platform'
import { CONTENT_STYLES, NICHE_TAGS } from '@/constants/avatar-tags'
import { getStatusBarHeight } from '@/utils/safe-area'
import { subscribePolling } from '@/utils/polling'
import './index.css'

// 中国省份列表
const PROVINCES = [
  '北京', '天津', '上海', '重庆',
  '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南',
  '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆',
  '香港', '澳门', '台湾'
]

// const DEFAULT_CONTENT_TYPES = [
//   { id: 'simple', label: '简单任务', icon: '✅', basePrice: 0.5, contentPrice: 0, desc: '关注/点赞/转发等', output: '个任务' },
//   { id: 'text', label: '纯文案', icon: '📝', basePrice: 2, contentPrice: 0, desc: '文字内容创作', output: '篇原创文案' },
//   { id: 'image', label: '图文笔记', icon: '🖼️', basePrice: 3, contentPrice: 1, desc: '图文搭配呈现', output: '篇图文笔记' },
//   { id: 'video', label: '短视频', icon: '🎬', basePrice: 5, contentPrice: 20, desc: 'AI生成真实视频', output: '条短视频' },
// ]

const PLATFORM_OPTIONS = PLATFORM_UI_ORDER
  .map((key) => ({ id: key, ...PLATFORM_META_MAP[key] }))
  .filter((item) => Array.isArray(item.requirements))

export default function OrderCreate() {
  const [contentTypes, setContentTypes] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    contentType: 'text',
    acceptRegions: [] as string[], // 接单区域（省份列表）
    acceptTimeout: 0, // 接单超时时间（分钟），默认 30 分钟
    acceptanceTimeout: 24, // 审核超时时间（小时），默认1天
    platform: '' as string,
    platforms: [] as string[],
    preferredStyle: '',
    preferredNiche: '',
    optionalRequirements: {} as Record<string, string>,
    platformRemarks: {} as Record<string, string>,
    avatarCount: 1,
    quantityPerAvatar: 1,
    aiAutoFill: false,
    assetDistributeMode: 'shared' as 'shared' | 'exclusive',
    useCustomCopywriting: false,
    customCopywriting: '',
    customBasePrice: 0, // 图文类型自定义基础单价
  })
  const [, setCustomBasePriceInput] = useState('') // 输入框显示值
  const [customAcceptanceTimeout, setCustomAcceptanceTimeout] = useState('')
  const [uploadedAssets, setUploadedAssets] = useState<{ id: string; url: string; type: 'image' | 'video'; filename: string; size: number; mimeType: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [zipProgress, setZipProgress] = useState<{ status: string; message: string; totalFiles: number; processedFiles: number } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPlatformReq, setShowPlatformReq] = useState(false)
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const [showAcceptanceTimeoutModal, setShowAcceptanceTimeoutModal] = useState(false)
  const [customAcceptanceInput, setCustomAcceptanceInput] = useState('')
  const [showAcceptTimeoutModal, setShowAcceptTimeoutModal] = useState(false)
  const [customAcceptTimeoutInput, setCustomAcceptTimeoutInput] = useState('')
  const aiPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 审核时间选项
  const ACCEPTANCE_TIMEOUT_OPTIONS = [
    { label: '1h', value: 1 },
    { label: '3h', value: 3 },
    { label: '12h', value: 12 },
    { label: '1天', value: 24 },
    { label: '3天', value: 72 },
    { label: '5天', value: 120 },
    { label: '7天', value: 168 },
  ]

  // 接单超时选项（分钟）
  const ACCEPT_TIMEOUT_OPTIONS = [
    { label: '不限时', value: 0 },
    { label: '30分钟', value: 30 },
    { label: '1小时', value: 60 },
    { label: '2小时', value: 120 },
    { label: '3小时', value: 180 },
    { label: '4小时', value: 240 },
    { label: '1天', value: 1440 },
    { label: '2天', value: 2880 },
    { label: '3天', value: 4320 },
  ]

  // 格式化接单超时显示
  const formatAcceptTimeout = (minutes: number): string => {
    if (minutes === 0) return '不限时'
    if (minutes < 60) return `${minutes}分钟`
    if (minutes < 1440) {
      const hours = minutes / 60
      return hours === Math.floor(hours) ? `${hours}小时` : `${hours}小时`
    }
    const days = Math.floor(minutes / 1440)
    const remainingHours = Math.floor((minutes % 1440) / 60)
    if (remainingHours === 0) return `${days}天`
    return `${days}天${remainingHours}小时`
  }
  const aiPollUnsubRef = useRef<null | (() => void)>(null)
  const repayInFlightRef = useRef(false)
  const statusBarHeight = getStatusBarHeight()

  const stopAiPolling = () => {
    if (aiPollUnsubRef.current) {
      aiPollUnsubRef.current()
      aiPollUnsubRef.current = null
    }
    if (aiPollTimerRef.current) {
      clearInterval(aiPollTimerRef.current)
      aiPollTimerRef.current = null
    }
  }

  useEffect(() => { return () => { stopAiPolling() } }, [])

  // AI自动补足状态管理
  useEffect(() => {
    const isVideo = form.contentType === 'video'
    const isImage = form.contentType === 'image'
    const isShared = form.assetDistributeMode === 'shared'
    const totalCount = uploadedAssets.length

    // 判断是否应该显示 AI 按钮
    let shouldShowAiButton = false
    // 判断 AI 按钮是否可切换（图文笔记和短视频无素材时固定为true，不可切换）
    let isAiButtonLocked = false

    if (form.contentType === 'text') {
      // 纯文案不显示 AI 按钮
      shouldShowAiButton = false
    } else if (isVideo) {
      // 短视频：只有不上传素材时才显示AI按钮，且固定为true不可切换
      shouldShowAiButton = totalCount === 0
      isAiButtonLocked = totalCount === 0
    } else if (isImage) {
      // 图文笔记：无素材时固定为true不可切换，有素材时按共享/独享模式判断
      if (totalCount === 0) {
        shouldShowAiButton = true
        isAiButtonLocked = true
      } else {
        isAiButtonLocked = false
        if (isShared) {
          // 共享模式：上传数量 < 3 时显示 AI 按钮
          shouldShowAiButton = totalCount < 3
        } else {
          // 独享模式：只有不上传素材时才显示 AI 按钮
          shouldShowAiButton = false
        }
      }
    } else {
      // 简单任务
      isAiButtonLocked = false
      if (isShared) {
        // 共享模式：上传数量 < 3 时显示 AI 按钮
        shouldShowAiButton = totalCount < 3
      } else {
        // 独享模式：只有不上传素材时才显示 AI 按钮
        shouldShowAiButton = totalCount === 0
      }
    }

    // 状态更新逻辑
    if (isAiButtonLocked) {
      // 图文笔记/短视频无素材时，固定为true
      if (!form.aiAutoFill) {
        setForm(prev => ({ ...prev, aiAutoFill: true }))
      }
    } else if (!shouldShowAiButton && form.aiAutoFill) {
      // 不显示 AI 按钮时，自动将 aiAutoFill 设置为 false
      setForm(prev => ({ ...prev, aiAutoFill: false }))
    }
  }, [form.contentType, form.assetDistributeMode, uploadedAssets.length, form.aiAutoFill])

  useEffect(() => {
    const fetchPriceConfig = async () => {
      try {
        const res = await Network.request({ url: '/api/order/price-config' })
        if (res.data?.code === 200 && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setContentTypes(res.data.data)
        } else {
          Taro.showToast({ title: '获取价格配置失败', icon: 'none', duration: 3000 })
          console.error('获取价格配置失败：返回数据格式不正确')
        }
      } catch (e) {
        Taro.showToast({ title: '获取价格配置失败', icon: 'none', duration: 3000 })
        console.error('获取价格配置失败:', e)
      }
    }
    fetchPriceConfig()
  }, [])

  // ========== 素材上传相关 ==========
  const totalCount = uploadedAssets.length
  const imageCount = uploadedAssets.filter(a => a.type === 'image').length
  // 独占模式：每个分身1张素材即可；共享/无分配：不需要固定数量
  const requiredImageCount = form.contentType !== 'text' && form.contentType !== 'simple' && form.assetDistributeMode === 'exclusive' ? form.avatarCount : 0

  /** 统一上传入口：选择图片/视频 */
  const handleUploadAsset = async () => {
    if (totalCount >= 20) {
      Taro.showToast({ title: '最多上传20个素材', icon: 'none' })
      return
    }
    try {
      // 根据内容类型决定素材类型
      // 简单任务(text)和图文笔记(image)只能上传图片，短视频(video)只能上传视频
      const mediaType = form.contentType === 'image' || form.contentType === 'text'
        ? ['image']
        : form.contentType === 'video'
          ? ['video']
          : ['image', 'video']

      const res = await Taro.chooseMedia({
        count: 9,
        mediaType: mediaType as ('image' | 'video')[],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        maxDuration: 60,
      })
      setIsUploading(true)
      for (const media of res.tempFiles) {
        try {
          const isVideo = media.fileType === 'video' || media.tempFilePath.endsWith('.mp4') || media.tempFilePath.endsWith('.mov')

          // 验证素材类型是否符合内容类型要求
          if ((form.contentType === 'image' || form.contentType === 'text') && isVideo) {
            Taro.showToast({ title: '图文笔记/简单任务只能上传图片', icon: 'none' })
            continue
          }
          if (form.contentType === 'video' && !isVideo) {
            Taro.showToast({ title: '短视频只能上传视频', icon: 'none' })
            continue
          }

          const uploadUrl = isVideo ? '/api/upload/video' : '/api/upload/image'
          const uploadRes = await Network.uploadFile({ url: uploadUrl, filePath: media.tempFilePath, name: 'file' })
          const data = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
          const url = data?.data?.url || data?.url
          if (url) {
            const assetType = isVideo ? 'video' : 'image'
            setUploadedAssets(prev => [...prev, {
              id: `${assetType === 'video' ? 'vid' : 'img'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              url,
              type: assetType,
              filename: media.tempFilePath.split('/').pop() || (isVideo ? 'video' : 'image'),
              size: media.size || 0,
              mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
            }])
          }
        } catch (e) { console.error('素材上传失败:', e) }
      }
    } catch (e) { /* 用户取消选择 */ }
    finally { setIsUploading(false) }
  }

  /** 上传压缩包批量导入（带实时进度） */
  const handleUploadZip = async () => {
    const env = Taro.getEnv()
    if (env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT) {
      try {
        const res = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['.zip', '.rar', '.7z'] })
        setIsUploading(true)
        setZipProgress({ status: 'uploading', message: '正在上传压缩包...', totalFiles: 0, processedFiles: 0 })

        // 生成taskId用于追踪进度
        const taskId = `zip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        try {
          // 开始上传，同时启动进度轮询
          const uploadPromise = Network.uploadFile({
            url: '/api/upload/zip',
            filePath: res.tempFiles[0].path,
            name: 'file',
            formData: { taskId },
          })

          // 轮询进度
          let pollTimer: ReturnType<typeof setInterval> | null = null
          const startPolling = () => {
            // 延迟1秒后开始轮询（等文件上传到服务器后才开始处理）
            setTimeout(() => {
              pollTimer = setInterval(async () => {
                try {
                  const progressRes = await Network.request({
                    url: `/api/upload/zip-progress/${taskId}`,
                  })
                  const progress = progressRes.data?.data
                  if (progress) {
                    setZipProgress({
                      status: progress.status,
                      message: progress.message,
                      totalFiles: progress.totalFiles,
                      processedFiles: progress.processedFiles,
                    })
                    if (progress.status === 'completed' || progress.status === 'failed') {
                      if (pollTimer) clearInterval(pollTimer)
                    }
                  }
                } catch (e) {
                  // 轮询失败不影响主流程
                }
              }, 1000)
            }, 1500)
          }

          startPolling()

          const uploadRes = await uploadPromise

          // 停止轮询
          if (pollTimer) clearInterval(pollTimer)

          const data = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data

          // 检查后端返回的错误码
          if (data?.code !== 200) {
            const errorMsg = data?.message || data?.msg || data?.error || '上传失败，请重试'
            throw new Error(errorMsg)
          }

          const extracted = data?.data
          if (extracted) {
            const newAssets: typeof uploadedAssets = []
              ; (extracted.images || []).forEach((img: { url: string; filename: string; size?: number; mimeType?: string }, idx: number) => {
                newAssets.push({ id: `zip_img_${Date.now()}_${idx}`, url: img.url, type: 'image', filename: img.filename, size: img.size || 0, mimeType: img.mimeType || 'image/jpeg' })
              })
              ; (extracted.videos || []).forEach((vid: { url: string; filename: string; size?: number; mimeType?: string }, idx: number) => {
                newAssets.push({ id: `zip_vid_${Date.now()}_${idx}`, url: vid.url, type: 'video', filename: vid.filename, size: vid.size || 0, mimeType: vid.mimeType || 'video/mp4' })
              })
            setUploadedAssets(prev => [...prev, ...newAssets])
            Taro.showToast({ title: `提取${newAssets.length}个文件`, icon: 'success' })
          }
        } catch (e: any) {
          console.error('压缩包上传失败:', e)
          // 提取后端返回的错误信息并显示给用户
          const errorMsg = e?.data?.msg || e?.data?.message || e?.message || '上传失败，请重试'
          Taro.showToast({ title: errorMsg, icon: 'none', duration: 3000 })
        }
        setZipProgress(null)
      } catch (e) { /* 用户取消 */ }
      finally { setIsUploading(false) }
    } else {
      Taro.showToast({ title: '请在小程序中上传压缩包', icon: 'none' })
    }
  }

  const handleRemoveAsset = (id: string) => {
    setUploadedAssets(prev => prev.filter(a => a.id !== id))
  }

  // ========== END 素材上传 ==========

  const selectedType = contentTypes.find(t => t.contentType === form.contentType)
  const basePricePerUnit = selectedType?.basePrice ?? 0
  void selectedType?.contentPrice // contentPricePerUnit (unused but kept for future use)

  // 获取不同内容类型的价格配置（用于计算内容费用）
  const imageTypeConfig = contentTypes.find(t => t.contentType === 'image')
  const videoTypeConfig = contentTypes.find(t => t.contentType === 'video')
  void contentTypes.find(t => t.contentType === 'text') // textTypeConfig (unused but kept for future use)
  const imageContentPrice = imageTypeConfig?.contentPrice ?? 0
  const videoContentPrice = videoTypeConfig?.contentPrice ?? 0

  // 计算内容费用：根据素材数量、分配模式、AI补足情况
  // 只有当 aiAutoFill 为 true 时才计算内容费用，否则为 0
  const calculateContentPrice = () => {
    // 纯文案内容费用为0
    if (form.contentType === 'text') {
      return 0
    }

    // AI自动补足未开启，内容费用为0
    if (!form.aiAutoFill) {
      return 0
    }

    const uploadedCount = uploadedAssets.length
    const isShared = form.assetDistributeMode === 'shared'

    // 简单任务和图文笔记需要3张素材，短视频需要1张素材
    const requiredCount = form.contentType === 'video' ? 1 : 3

    // 根据内容类型选择对应的价格
    // 简单任务和图文笔记使用 image 的 contentPrice
    // 短视频使用 video 的 contentPrice
    const pricePerUnit = form.contentType === 'video' ? videoContentPrice : imageContentPrice

    if (isShared) {
      // 共享模式：固定1个分身
      if (uploadedCount === 0) {
        // 不上传素材，AI补足
        return Number((pricePerUnit * requiredCount * 1).toFixed(2))
      } else {
        // 上传素材
        if (form.contentType === 'video') {
          // 短视频上传素材后内容费用为0
          return 0
        }
        // 其他类型AI补足剩余
        const aiCount = Math.max(0, requiredCount - uploadedCount)
        return Number((pricePerUnit * aiCount * 1).toFixed(2))
      }
    } else {
      // 独享模式：按分身数计算
      if (uploadedCount === 0) {
        // 不上传素材，AI补足（每个分身都需要）
        return Number((pricePerUnit * requiredCount * form.avatarCount).toFixed(2))
      } else {
        // 上传素材，不需要AI补足，内容费用为0
        return 0
      }
    }
  }

  // 计算基础费用：基础费用 × 分身数
  const calculateBasePrice = () => {
    const actualBasePrice = form.customBasePrice > basePricePerUnit
      ? form.customBasePrice
      : basePricePerUnit
    return Number((actualBasePrice * form.avatarCount).toFixed(2))
  }

  const totalPrice = {
    base: calculateBasePrice(),
    content: calculateContentPrice(),
    get total() { return this.base + this.content }
  }
  const totalOutput = form.quantityPerAvatar * form.avatarCount

  // 计算独占模式下最大分身数量
  const getMaxAvatarCount = () => {
    if (form.assetDistributeMode !== 'exclusive') return Infinity
    // 独占模式：每个分身至少分到1张素材，最大分身数 = 素材数量
    const uploadedCount = uploadedAssets.length
    if (uploadedCount > 0) {
      return uploadedCount
    }
    // 无上传素材时不限
    return 99
  }

  const maxAvatarCount = getMaxAvatarCount()

  const handleAIGenerate = async () => {
    if (aiLoading) return
    if (!form.title.trim()) {
      Taro.showToast({ title: '请先输入任务标题', icon: 'none' })
      return
    }
    if (form.platforms.length === 0) {
      Taro.showToast({ title: '请先选择发布平台', icon: 'none' })
      return
    }
    if (!form.contentType) {
      Taro.showToast({ title: '请先选择内容类型', icon: 'none' })
      return
    }

    setAiLoading(true)
    try {
      const platformNames = form.platforms.map((p) => PLATFORM_META_MAP[p as keyof typeof PLATFORM_META_MAP]?.name || p).join('、')
      const contentTypeName = selectedType?.label || '文案'
      const platformIds = form.platforms.join(',')

      const prompt = `你是一位短视频/图文内容策划专家，擅长为达人博主打造各平台爆款内容。

请根据以下【任务信息】生成一份【任务描述】，用于指导达人创作：

**【任务标题】** ${form.title}
**【目标平台】** ${platformNames}（平台ID: ${platformIds}）
**【内容类型】** ${contentTypeName}
${form.description ? `**【补充说明】** ${form.description}` : ''}

**【输出格式】** 生成一份专业的任务描述，要求：

【1. 产品/主题核心卖点】
- 列出2-3个最具吸引力的卖点
- 用具体数字或对比突出优势

【2. 目标用户画像】
- 描述目标受众的特征和需求
- 明确用户的痛点和期待

【3. 爆款内容方向】（3个具体可执行的方案）
- 方案A：...
- 方案B：...
- 方案C：...

【4. 开头3秒钩子设计】
- 提供2个抓人眼球的开头方式
- 运用悬念、冲突、数据等技巧

【5. 必须植入的关键词/话题】（5-8个热搜词）
- 贴合${platformNames}平台的热词

【6. 达人创作注意事项】
- 必须包含的内容点
- 禁止出现的内容/词汇

【7. 预期传播效果】
- 如：引发共鸣/促进互动/引导购买等

请生成专业、具体、可执行的任务描述，语言风格要符合达人博主的调性。`

      const res = await Network.request({
        url: '/api/ai/generate',
        method: 'POST',
        data: {
          prompt,
          platforms: form.platforms,
          contentType: form.contentType === 'text' ? 'copywriting' : form.contentType === 'video' ? 'video_script' : form.contentType === 'simple' ? 'simple' : 'copywriting',
        },
      })


      const payload: any = res.data
      const data = payload?.data
      if (payload?.code === 200 && data?.content) {
        setForm(prev => ({ ...prev, description: data.content }))
        Taro.showToast({ title: 'AI帮写成功', icon: 'success' })
      } else if (payload?.code === 200 && data?.requestId) {
        stopAiPolling()
        const requestId = data.requestId
        let attempts = 0
        const unsubscribe = subscribePolling({
          key: `ai-status:${requestId}`,
          intervalMs: 500,
          fetcher: async () => {
            attempts += 1
            if (attempts > 240) {
              return { __timeout: true } as any
            }
            const statusRes = await Network.request({
              url: `/api/ai/status/${requestId}`,
              method: 'GET',
              dedupKey: `ai-status:${requestId}`,
            })
            return statusRes.data
          },
          onData: (statusPayload: any) => {
            if (statusPayload?.__timeout) {
              stopAiPolling()
              setAiLoading(false)
              Taro.showToast({ title: 'AI生成超时，请稍后重试', icon: 'none' })
              return
            }
            const task = statusPayload?.data
            if (statusPayload?.code === 200) {
              if (task?.content) {
                setForm(prev => ({ ...prev, description: task.content }))
              }
              if (task?.status === 'completed') {
                stopAiPolling()
                setAiLoading(false)
                Taro.showToast({ title: 'AI帮写成功', icon: 'success' })
                return
              }
              if (task?.status === 'failed') {
                stopAiPolling()
                setAiLoading(false)
                Taro.showToast({ title: task?.error || 'AI帮写失败，请手动输入', icon: 'none' })
                return
              }
              return
            }
            if (statusPayload?.code === 404) {
              stopAiPolling()
              setAiLoading(false)
              Taro.showToast({ title: 'AI任务不存在，请重试', icon: 'none' })
            }
          },
        })
        aiPollUnsubRef.current = unsubscribe
      } else {
        const msg = Network.getMsg(payload, 'AI帮写失败，请手动输入')
        Taro.showToast({ title: msg, icon: 'none' })
      }
    } catch (error) {
      console.error('[AI生成] 错误:', error)
      stopAiPolling()
      setAiLoading(false)
      const err: any = error
      const errMsg: string = err?.errMsg || err?.message || ''
      const domainHint = /domain|域名|url not in domain list|request:fail/i.test(errMsg)
      const modalContent = errMsg ? String(errMsg).slice(0, 900) : '请检查网络、登录状态与小程序合法域名配置'
      Taro.showModal({
        title: domainHint ? '网络域名未配置' : 'AI帮写失败',
        content: modalContent,
        showCancel: false,
      })
    } finally {
      // 只有非轮询场景（同步返回结果或错误）才在此清除loading
      // 轮询场景由 onData/onError 回调负责清除
      if (!aiPollUnsubRef.current) {
        setAiLoading(false)
      }
    }
  }

  const handleTypeChange = (typeId: string) => {
    setForm(prev => ({ ...prev, contentType: typeId }))
    // 切换类型时清空自定义价格输入
    setCustomBasePriceInput('')
  }

  const handlePlatformToggle = (platformId: string) => {
    const canonicalId = canonicalizePlatform(platformId)
    setForm(prev => {
      // 单选：再次点击取消选中
      const newPlatform = prev.platform === canonicalId ? '' : canonicalId
      const platforms = newPlatform ? [newPlatform] : []
      // 清除其他平台的备注
      const newRemarks = { ...prev.platformRemarks }
      if (newPlatform) {
        // 只保留当前平台的备注
        Object.keys(newRemarks).forEach(key => {
          if (key !== newPlatform) delete newRemarks[key]
        })
      } else {
        Object.keys(newRemarks).forEach(key => delete newRemarks[key])
      }
      return { ...prev, platform: newPlatform, platforms, platformRemarks: newRemarks }
    })
  }

  const handleRequirementChange = (platformId: string, reqId: string, value: string) => {
    setForm(prev => ({
      ...prev,
      optionalRequirements: {
        ...prev.optionalRequirements,
        [`${platformId}_${reqId}`]: value
      }
    }))
  }

  const handlePlatformRemarkChange = (platformId: string, value: string) => {
    setForm(prev => ({
      ...prev,
      platformRemarks: {
        ...prev.platformRemarks,
        [platformId]: value
      }
    }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
      return
    }
    if (form.platforms.length === 0) {
      Taro.showToast({ title: '请选择发布平台', icon: 'none' })
      return
    }
    // 独占模式校验：分身数不能超过素材数
    if (form.assetDistributeMode === 'exclusive' && maxAvatarCount !== Infinity && form.avatarCount > maxAvatarCount) {
      if (maxAvatarCount === 0) {
        Taro.showToast({ title: '独占模式下请先上传素材或开启AI补足', icon: 'none' })
      } else {
        Taro.showToast({ title: `独占模式下最多${maxAvatarCount}个分身`, icon: 'none' })
      }
      return
    }
    // 自定义文案校验
    if (form.useCustomCopywriting && !form.customCopywriting.trim()) {
      Taro.showToast({ title: '请输入文案内容', icon: 'none' })
      return
    }

    setIsSubmitting(true)
    try {
      // 获取用户openid（微信小程序支付必须）
      let openid = ''
      try {
        const loginRes = await Taro.login()
        if (loginRes.code) {
          // 通过后端接口换取openid
          const openidRes = await Network.request({
            url: '/api/user/openid',
            method: 'GET',
            data: { code: loginRes.code },
          })
          openid = openidRes?.data?.data?.openid || ''
        }
      } catch (e) {
        console.warn('[OrderCreate] 获取openid失败:', e)
      }

      // simple -> simple 映射：前端用short id，后端存full id
      const backendContentType = form.contentType

      // 将 key 转换为显示名称（name）
      const styleName = form.preferredStyle
        ? CONTENT_STYLES.find(s => s.key === form.preferredStyle)?.name || form.preferredStyle
        : ''
      const nicheName = form.preferredNiche
        ? NICHE_TAGS.find(n => n.key === form.preferredNiche)?.name || form.preferredNiche
        : ''

      // 验证审核时间（必选）
      if (form.acceptanceTimeout <= 0) {
        Taro.showToast({ title: '请选择审核时间', icon: 'none' })
        return
      }
      const orderData = {
        title: form.title,
        description: form.description,
        content_type: backendContentType,
        accept_regions: form.acceptRegions,
        accept_timeout: form.acceptTimeout,
        acceptance_timeout: form.acceptanceTimeout,
        platforms: canonicalizePlatforms(form.platforms),
        preferred_style: form.preferredStyle,
        preferred_niche: form.preferredNiche,
        // 添加 personality 字段，保存风格偏好和领域偏好的显示名称
        personality: {
          tags: styleName,
          niches: nicheName,
        },
        avatar_count: form.avatarCount,
        quantity_per_avatar: form.quantityPerAvatar,
        base_price: totalPrice.base,
        content_price: totalPrice.content,
        total_price: totalPrice.total,
        // 实际使用的单价：用户自定义或默认值
        customBasePrice: form.customBasePrice > basePricePerUnit ? form.customBasePrice : basePricePerUnit,
        requirements: { ...form.optionalRequirements, platformRemarks: form.platformRemarks, ai_auto_fill: form.aiAutoFill, asset_distribute_mode: form.assetDistributeMode, use_custom_copywriting: form.useCustomCopywriting, custom_copywriting: form.customCopywriting },
        openid,
      }


      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: orderData,
      })


      const rawPayload = res?.data
      let payload = rawPayload
      if (typeof rawPayload === 'string') {
        try { payload = JSON.parse(rawPayload) } catch { payload = null }
      }
      const payloadObj = payload && typeof payload === 'object' ? payload : null

      if (payloadObj?.code === 200 && payloadObj?.data?.id) {
        const orderId = payloadObj.data.id
        const payment = payloadObj.data.payment

        // 将已上传的素材绑定到订单
        if (uploadedAssets.length > 0) {
          try {
            const assetData = uploadedAssets.map((a, idx) => ({
              id: `oa_${Date.now()}_${idx}`,
              assetType: a.type,
              source: 'user_uploaded',
              assetUrl: a.url,
              originalFilename: a.filename,
              fileSize: a.size,
              mimeType: a.mimeType,
              sortOrder: idx,
            }))
            await Network.request({
              url: '/api/order-assets/batch',
              method: 'POST',
              data: { orderId, assets: assetData },
            })
          } catch (assetErr) {
            console.error('[OrderCreate] 素材绑定失败:', assetErr)
            Taro.showToast({ title: '素材上传失败，请重试', icon: 'none' })
            setIsSubmitting(false)
            return
          }
        }

        if (payment && payment.packageValue) {
          // 有支付参数，唤起微信支付
          try {
            await Taro.requestPayment({
              timeStamp: payment.timeStamp,
              nonceStr: payment.nonceStr,
              package: payment.packageValue,
              signType: payment.signType || 'MD5',
              paySign: payment.paySign,
            })
            // 支付成功
            Taro.showToast({ title: '支付成功', icon: 'success' })
            setTimeout(() => {
              Taro.navigateTo({ url: `/package-order/pages/order-asset-waiting/index?orderId=${orderId}` })
            }, 1500)
          } catch (payErr: any) {
            console.warn('[OrderCreate] 支付结果:', payErr)
            const errMsg = String(payErr?.errMsg || payErr?.message || '')
            if (errMsg.includes('cancel') || errMsg.includes('取消')) {
              // 用户取消支付 → 跳转到订单详情，显示待支付状态
              Taro.showModal({
                title: '支付已取消',
                content: '您可以稍后在订单详情中继续支付',
                confirmText: '去支付',
                cancelText: '查看订单',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    // 重新支付
                    repayAndNavigate(orderId, openid)
                  } else {
                    Taro.navigateTo({ url: `/package-order/pages/order-detail/index?id=${orderId}&action=pay` })
                  }
                },
              })
            } else {
              // 支付失败
              Taro.showModal({
                title: '支付失败',
                content: '支付遇到问题，您可以稍后重试',
                confirmText: '重试',
                cancelText: '查看订单',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    repayAndNavigate(orderId, openid)
                  } else {
                    Taro.navigateTo({ url: `/package-order/pages/order-detail/index?id=${orderId}&action=pay` })
                  }
                },
              })
            }
          }
        } else {
          // 无需支付（金额为0或支付创建失败），直接跳转
          Taro.navigateTo({ url: `/package-order/pages/order-asset-waiting/index?orderId=${orderId}` })
        }
      } else {
        const msg = Network.getMsg(payloadObj, '创建订单失败')
        Taro.showToast({ title: msg, icon: 'none' })
      }
    } catch (err: any) {
      console.error('创建订单失败:', err)
      Taro.showToast({ title: err?.message || '网络错误，请重试', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const repayAndNavigate = async (orderId: string, openid: string) => {
    if (!openid) {
      Taro.showToast({ title: '请重新进入页面再试', icon: 'none' })
      return
    }
    if (repayInFlightRef.current) return
    repayInFlightRef.current = true
    try {
      Taro.showLoading({ title: '创建支付...' })
      const res = await Network.request({
        url: `/api/order/${orderId}/repay`,
        method: 'POST',
        data: { openid },
        dedupKey: `order:repay:${orderId}`,
      })
      Taro.hideLoading()
      const payload = res?.data
      if (payload?.code === 200 && payload?.data?.payment) {
        const payment = payload.data.payment
        await Taro.requestPayment({
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.packageValue,
          signType: payment.signType || 'MD5',
          paySign: payment.paySign,
        })
        Taro.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateTo({ url: `/package-order/pages/order-asset-waiting/index?orderId=${orderId}` })
        }, 1500)
      } else {
        Taro.showToast({ title: payload?.message || '创建支付失败', icon: 'none' })
      }
    } catch (payErr: any) {
      Taro.hideLoading()
      const errMsg = String(payErr?.errMsg || payErr?.message || '')
      if (!errMsg.includes('cancel')) {
        Taro.showToast({ title: '支付失败，请稍后重试', icon: 'none' })
      }
    } finally {
      repayInFlightRef.current = false
    }
  }

  // 格式化审核时间显示
  const formatAcceptanceTimeout = (hours: number): string => {
    if (hours < 24) {
      return `${hours}小时`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      if (remainingHours === 0) {
        return `${days}天`
      } else {
        return `${days}天${remainingHours}小时`
      }
    }
  }

  return (
    <View className="order-create-page">
      {/* 顶部渐变头部 */}
      <View className="order-page-header" style={{ paddingTop: `${statusBarHeight + 32}px` }}>
        <View className="header-decoration">
          <View className="deco-circle circle-1" />
          <View className="deco-circle circle-2" />
        </View>
        <View className="header-content">
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="header-center">
            <Text className="header-title">发布任务</Text>
            <Text className="header-desc">AI分身帮你创作，省时省力出爆款</Text>
          </View>
          <View className="records-btn" onClick={() => Taro.navigateTo({ url: '/package-order/pages/order-list/index' })}>
            <ClipboardList size={16} color="#fff" />
            <Text className="records-btn-text">发单记录</Text>
          </View>
        </View>
      </View>

      <ScrollView
        scrollY
        className="scroll-container"
        key="order-create-scroll"
      >
        {/* 核心价值引导 - 3步出结果 */}
        <View className="value-guide">
          <View className="guide-step">
            <View className="guide-step-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
              <Target size={14} color="#fff" />
            </View>
            <Text className="guide-step-text">描述需求</Text>
          </View>
          <View className="guide-arrow" />
          <View className="guide-step">
            <View className="guide-step-icon" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
              <Zap size={14} color="#fff" />
            </View>
            <Text className="guide-step-text">AI匹配分身</Text>
          </View>
          <View className="guide-arrow" />
          <View className="guide-step">
            <View className="guide-step-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <TrendingUp size={14} color="#fff" />
            </View>
            <Text className="guide-step-text">收获内容</Text>
          </View>
        </View>

        {/* 你将获得 - 动态产出预览 */}
        <View className="outcome-preview">
          <View className="outcome-header">
            <View className="outcome-header-left">
              <Sparkles size={16} color="#8B5CF6" />
              <Text className="outcome-header-text">你将获得</Text>
            </View>
            <View className="outcome-trust">
              <ShieldCheck size={12} color="#10B981" />
              <Text className="outcome-trust-text">不满意可退款</Text>
            </View>
          </View>
          <View className="outcome-items">
            <View className="outcome-item">
              <Text className="outcome-num">{totalOutput}</Text>
              <Text className="outcome-unit">{selectedType?.output || '篇文案'}</Text>
            </View>
            <View className="outcome-divider" />
            <View className="outcome-item">
              <Text className="outcome-num">{form.platforms.length || '-'}</Text>
              <Text className="outcome-unit">平台分发</Text>
            </View>
            <View className="outcome-divider" />
            <View className="outcome-item">
              <Text className="outcome-num">24h</Text>
              <Text className="outcome-unit">内交付</Text>
            </View>
          </View>
          {form.avatarCount > 1 && (
            <View className="outcome-bonus">
              <Lightbulb size={12} color="#F59E0B" />
              <Text className="outcome-bonus-text">{form.avatarCount}个分身同时创作，风格多样化，覆盖更广</Text>
            </View>
          )}
        </View>

        {/* 任务标题 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">任务标题</Text>
            </View>
            <View className="required-tag">
              <Text className="required-text">必填</Text>
            </View>
          </View>
          <View className="input-wrapper">
            <Input
              className="title-input"
              placeholder="例：小红书美妆种草笔记推广"
              value={form.title}
              onInput={e => setForm(prev => ({ ...prev, title: e.detail.value }))}
              maxlength={50}
            />
          </View>
          <Text className="field-hint">好的标题能帮AI更精准地匹配擅长该领域的分身</Text>
        </View>

        {/* 内容风格偏好 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot accent" />
              <Text className="section-title">风格偏好</Text>
            </View>
            <Text className="section-hint">精准匹配擅长此风格的分身</Text>
          </View>
          <View className="style-opts">
            <View
              className={`style-opt ${form.preferredStyle === '' ? 'active' : ''}`}
              onClick={() => setForm(prev => ({ ...prev, preferredStyle: '' }))}
            >
              <Text className={`style-opt-text ${form.preferredStyle === '' ? 'active' : ''}`}>不限</Text>
            </View>
            {CONTENT_STYLES.map(style => (
              <View
                key={style.key}
                className={`style-opt ${form.preferredStyle === style.key ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, preferredStyle: style.key }))}
              >
                <View className="style-opt-dot" style={{ background: style.color }} />
                <Text className={`style-opt-text ${form.preferredStyle === style.key ? 'active' : ''}`}>{style.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 行业领域偏好 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot accent" />
              <Text className="section-title">领域偏好</Text>
            </View>
            <Text className="section-hint">匹配该领域的专业分身</Text>
          </View>
          <View className="niche-opts">
            <View
              className={`niche-opt ${form.preferredNiche === '' ? 'active' : ''}`}
              onClick={() => setForm(prev => ({ ...prev, preferredNiche: '' }))}
            >
              <Text className={`niche-opt-text ${form.preferredNiche === '' ? 'active' : ''}`}>不限</Text>
            </View>
            {NICHE_TAGS.map(niche => (
              <View
                key={niche.key}
                className={`niche-opt ${form.preferredNiche === niche.key ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, preferredNiche: niche.key }))}
              >
                <Text className="niche-opt-icon">{niche.icon}</Text>
                <Text className={`niche-opt-text ${form.preferredNiche === niche.key ? 'active' : ''}`}>{niche.name}</Text>
              </View>
            ))}
          </View>
        </View>




        {/* 发布平台 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">发布平台</Text>
            </View>
            <View className="required-tag">
              <Text className="required-text">必填</Text>
            </View>
          </View>
          <Text className="field-hint mb-4">选择几个平台，分身就会按各平台调性分别创作</Text>
          <View className="platform-grid">
            {PLATFORM_OPTIONS.map((config) => (
              <View
                key={config.id}
                className={`platform-card ${form.platforms.includes(config.id) ? 'active' : ''}`}
                onClick={() => handlePlatformToggle(config.id)}
              >
                <View className="platform-icon-wrap" style={{ background: config.bgColor }}>
                  <Text className="platform-emoji">{config.icon}</Text>
                </View>
                <Text className="platform-name">{config.name}</Text>
                {form.platform === config.id && (
                  <View className="platform-check">
                    <Check size={10} color="#fff" />
                  </View>
                )}
              </View>
            ))}
          </View>

          {form.platform && (() => {
            const selectedPlatform = PLATFORM_META_MAP[form.platform as keyof typeof PLATFORM_META_MAP]
            const reqs = selectedPlatform?.requirements || []
            return (
              <View className="platform-requirements">
                <View className="req-header" onClick={() => setShowPlatformReq(!showPlatformReq)}>
                  <Text className="req-title">{selectedPlatform?.icon} {selectedPlatform?.name} 平台要求（可选）</Text>
                  <ChevronRight size={14} color="#94A3B8" className={`req-arrow ${showPlatformReq ? 'open' : ''}`} />
                </View>
                {showPlatformReq && (
                  <View className="req-content">
                    {reqs.map(req => (
                      <View key={req.id} className="req-item">
                        <Text className="req-label">{req.label}</Text>
                        <Input
                          className="req-input"
                          placeholder={req.placeholder}
                          value={form.optionalRequirements[`${form.platform}_${req.id}`] || ''}
                          onInput={e => handleRequirementChange(form.platform, req.id, e.detail.value)}
                        />
                      </View>
                    ))}
                    {/* 平台备注输入 */}
                    <View className="req-item">
                      <Text className="req-label">备注</Text>
                      <Input
                        className="req-input"
                        placeholder="特殊要求、商品链接、团购链接等"
                        value={form.platformRemarks[form.platform] || ''}
                        onInput={e => handlePlatformRemarkChange(form.platform, e.detail.value)}
                      />
                    </View>
                  </View>
                )}
              </View>
            )
          })()}
        </View>

        {/* 内容类型 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">内容类型

              </Text>
            </View>
            <View className="required-tag">
              <Text className="required-text">必填</Text>
            </View>
          </View>
          <View className="type-grid">
            {contentTypes.map(type => (
              <View
                key={type.contentType}
                className={`type-card ${form.contentType === type.contentType ? 'active' : ''}`}
                onClick={() => handleTypeChange(type.contentType)}
              >
                <Text className="type-icon">{type.icon}</Text>
                <Text className="type-label">{type.label}</Text>
                <Text className="type-desc">{type.desc}</Text>
                {/* <View className="type-price-row">
                  <Coins size={10} color="#6366F1" />
                  <View className="type-price-split">
                    <Text className="type-price-base">基础¥{type.basePrice.toFixed(2)}</Text>
                    <Text className="type-price-content">内容¥{type.contentPrice.toFixed(2)}</Text>
                  </View>
                </View> */}
                {form.contentType === type.contentType && (
                  <View className="type-check">
                    <Check size={10} color="#fff" />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
        {/* 自定义文案 - 简单任务不需要 */}
        {form.contentType !== 'simple' && (
          <View className="section">
            <View className="section-header">
              <View className="section-title-row">
                <View className="title-dot accent" />
                <FileText size={16} color="#6366F1" />
                <Text className="section-title">文案设置</Text>
              </View>
              <View
                className={`asset-ai-switch ${form.useCustomCopywriting ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, useCustomCopywriting: !prev.useCustomCopywriting }))}
              >
                <View className={`asset-ai-switch-dot ${form.useCustomCopywriting ? 'active' : ''}`} />
              </View>
            </View>
            <View className="asset-ai-toggle-row" style={{ marginTop: '8px', marginBottom: '8px' }}>
              <View className="asset-ai-toggle-left">
                <Sparkles size={14} color="#8B5CF6" />
                <Text className="asset-ai-toggle-label">
                  {form.useCustomCopywriting ? '自定义文案' : 'AI生成文案'}
                </Text>
              </View>
              <Text className="section-hint" style={{ fontSize: '12px' }}>
                {form.useCustomCopywriting ? '分身将使用您输入的文案' : '分身接单时AI自动生成'}
              </Text>
            </View>
            {form.useCustomCopywriting && (
              <View>
                <View className="textarea-wrapper">
                  <Textarea
                    className="desc-textarea"
                    style={{ height: '200px' }}
                    placeholder="请输入文案内容，分身将直接使用此文案发布..."
                    value={form.customCopywriting}
                    onInput={e => setForm(prev => ({ ...prev, customCopywriting: e.detail.value }))}
                    maxlength={5000}
                  />
                </View>
                <View className="desc-footer">
                  <View className="ai-hint">
                    <Lightbulb size={12} color="#8B5CF6" />
                    <Text className="ai-hint-text">每个分身将直接使用此文案，不再AI生成</Text>
                  </View>
                  <Text className="char-count">{form.customCopywriting.length}/5000</Text>
                </View>
              </View>
            )}
          </View>
        )}
        {/* 任务描述 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">任务描述</Text>
            </View>
            <View className="ai-button" onClick={handleAIGenerate}>
              {aiLoading ? (
                <Loader size={12} color="#fff" className="ai-loading" />
              ) : (
                <Sparkles size={12} color="#fff" />
              )}
              <Text className="ai-text">{aiLoading ? 'AI生成中...' : 'AI帮写'}</Text>
            </View>
          </View>
          <View className="textarea-wrapper">
            <Textarea
              className="desc-textarea"
              style={{ height: '240px' }}
              placeholder="详细描述任务要求，如：产品特点、推广重点、禁忌词等..."
              value={form.description}
              onInput={e => setForm(prev => ({ ...prev, description: e.detail.value }))}
              maxlength={2000}
            />
          </View>
          <View className="desc-footer">
            <View className="ai-hint">
              <Lightbulb size={12} color="#8B5CF6" />
              <Text className="ai-hint-text">不知道怎么写？点击AI帮写，一键生成专业任务描述</Text>
            </View>
            <Text className="char-count">{form.description.length}/2000</Text>
          </View>
        </View>
        {/* 接单区域选择 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">接单区域</Text>
            </View>
            <View className="region-trigger" onClick={() => setShowRegionPicker(true)}>
              <Text className="section-hint">
                {form.acceptRegions.length === 0
                  ? '不限区域'
                  : `已选${form.acceptRegions.length}个省份`}
              </Text>
              <ChevronRight size={14} color="#94A3B8" />
            </View>
          </View>
        </View>
        {/* 接单区域弹窗 */}
        {showRegionPicker && (
          <View className="region-picker-overlay" onClick={() => setShowRegionPicker(false)}>
            <View className="region-picker-content" onClick={e => e.stopPropagation()}>
              <View className="region-picker-header">
                <Text className="region-picker-title">选择接单区域</Text>
                <View className="region-picker-close" onClick={() => setShowRegionPicker(false)}>
                  <X size={18} color="#64748b" />
                </View>
              </View>
              <View className="region-picker-grid">
                {PROVINCES.map(province => (
                  <View
                    key={province}
                    className={`region-tag ${form.acceptRegions.includes(province) ? 'active' : ''}`}
                    onClick={() => {
                      if (form.acceptRegions.includes(province)) {
                        setForm(prev => ({ ...prev, acceptRegions: prev.acceptRegions.filter(r => r !== province) }))
                      } else {
                        setForm(prev => ({ ...prev, acceptRegions: [...prev.acceptRegions, province] }))
                      }
                    }}
                  >
                    <Text className="region-tag-text">{province}</Text>
                  </View>
                ))}
              </View>
              {form.acceptRegions.length > 0 && (
                <View className="region-selected-hint">
                  <Text className="region-selected-hint-text">
                    仅限所选省份的分身接单，不选则不限区域
                  </Text>
                </View>
              )}
              <View className="region-picker-footer">
                <View className="region-picker-clear" onClick={() => setForm(prev => ({ ...prev, acceptRegions: [] }))}>
                  <Text className="region-picker-clear-text">清空</Text>
                </View>
                <View className="region-picker-confirm" onClick={() => setShowRegionPicker(false)}>
                  <Text className="region-picker-confirm-text">确定</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 审核时间选择弹窗 */}
        {showAcceptanceTimeoutModal && (
          <View className="modal-mask" onClick={() => setShowAcceptanceTimeoutModal(false)}>
            <View className="modal-content" onClick={(e) => e.stopPropagation()}>
              <View className="modal-header">
                <Text className="modal-title">选择审核时间</Text>
                <View className="modal-close" onClick={() => setShowAcceptanceTimeoutModal(false)}>
                </View>
              </View>

              <View className="modal-body">
                {/* 预设选项 */}
                <View className="modal-options">
                  {ACCEPTANCE_TIMEOUT_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`modal-option ${form.acceptanceTimeout === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setForm(prev => ({ ...prev, acceptanceTimeout: option.value }))
                        setCustomAcceptanceInput(String(option.value))
                      }}
                    >
                      <Text className="option-label">{option.label}</Text>
                      {form.acceptanceTimeout === option.value && (
                        <Check size={16} color="#6366F1" />
                      )}
                    </View>
                  ))}
                </View>

                {/* 自定义输入 */}
                <View className="modal-custom-section">
                  <Text className="custom-label">自定义时间（小时）</Text>
                  <View className="custom-input-row">
                    <TaroInput
                      type="number"
                      className="custom-input"
                      placeholder="输入小时数"
                      value={customAcceptanceInput}
                      onInput={(e: any) => {
                        const value = e.detail.value
                        // 过滤非数字字符，只保留数字
                        const filteredValue = String(value || '').replace(/[^\d]/g, '')
                        setCustomAcceptanceInput(filteredValue)
                        if (filteredValue && filteredValue.trim() !== '') {
                          const numValue = parseInt(filteredValue, 10)
                          if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 168) {
                            setForm(prev => ({ ...prev, acceptanceTimeout: numValue }))
                          } else if (!Number.isNaN(numValue) && numValue > 168) {
                            setCustomAcceptanceInput('168')
                            setForm(prev => ({ ...prev, acceptanceTimeout: 168 }))
                          }
                        } else {
                          setForm(prev => ({ ...prev, acceptanceTimeout: 24 })) // 默认1天
                        }
                      }}
                    />
                    <Text className="custom-unit">小时</Text>
                  </View>
                  <Text className="custom-hint">范围：1-168小时（7天），仅支持整数</Text>
                </View>

              </View>

              <View className="modal-footer">
                <View
                  className="modal-confirm-btn"
                  onClick={() => setShowAcceptanceTimeoutModal(false)}
                >
                  <Text className="confirm-text">确定</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 接单超时选择弹窗 */}
        {showAcceptTimeoutModal && (
          <View className="modal-mask" onClick={() => setShowAcceptTimeoutModal(false)}>
            <View className="modal-content" onClick={(e) => e.stopPropagation()}>
              <View className="modal-header">
                <Text className="modal-title">选择接单超时</Text>
                <View className="modal-close" onClick={() => setShowAcceptTimeoutModal(false)}>
                </View>
              </View>

              <View className="modal-body">
                {/* 预设选项 */}
                <View className="modal-options">
                  {ACCEPT_TIMEOUT_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`modal-option ${form.acceptTimeout === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setForm(prev => ({ ...prev, acceptTimeout: option.value }))
                        // 不限时为0，但输入框显示空
                        setCustomAcceptTimeoutInput(option.value === 0 ? '' : String(option.value))
                      }}
                    >
                      <Text className="option-label">{option.label}</Text>
                      {form.acceptTimeout === option.value && (
                        <Check size={16} color="#6366F1" />
                      )}
                    </View>
                  ))}
                </View>

                {/* 自定义输入 */}
                <View className="modal-custom-section">
                  <Text className="custom-label">自定义时间（分钟）</Text>
                  <View className="custom-input-row">
                    <TaroInput
                      type="number"
                      className="custom-input"
                      placeholder="输入分钟数"
                      value={customAcceptTimeoutInput}
                      onInput={(e: any) => {
                        const value = e.detail.value
                        // 过滤非数字字符，只保留数字
                        const filteredValue = String(value || '').replace(/[^\d]/g, '')
                        setCustomAcceptTimeoutInput(filteredValue)
                      }}
                    />
                    <Text className="custom-unit">分钟</Text>
                  </View>
                  <Text className="custom-hint">范围：30-4320分钟（3天），仅支持整数</Text>
                </View>

              </View>

              <View className="modal-footer">
                <View
                  className="modal-confirm-btn"
                  onClick={() => {
                    // 校验输入值
                    const inputStr = customAcceptTimeoutInput.trim()
                    if (!inputStr) {
                      // 输入为空，保持当前选择
                      setShowAcceptTimeoutModal(false)
                      return
                    }
                    const inputValue = parseInt(inputStr, 10)
                    if (inputValue === 0) {
                      // 输入0视为不限时
                      setForm(prev => ({ ...prev, acceptTimeout: 0 }))
                      setShowAcceptTimeoutModal(false)
                    } else if (inputValue < 30) {
                      Taro.showToast({ title: '最小30分钟', icon: 'none' })
                      setCustomAcceptTimeoutInput('30')
                      setForm(prev => ({ ...prev, acceptTimeout: 30 }))
                      setShowAcceptTimeoutModal(false)
                    } else if (inputValue > 4320) {
                      Taro.showToast({ title: '最大3天', icon: 'none' })
                      setCustomAcceptTimeoutInput('4320')
                      setForm(prev => ({ ...prev, acceptTimeout: 4320 }))
                      setShowAcceptTimeoutModal(false)
                    } else {
                      setForm(prev => ({ ...prev, acceptTimeout: inputValue }))
                      setShowAcceptTimeoutModal(false)
                    }
                  }}
                >
                  <Text className="confirm-text">确定</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 接单超时设置 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">接单超时</Text>
            </View>
          </View>
          <View
            className="timeout-select-section"
            onClick={() => {
              setCustomAcceptTimeoutInput(form.acceptTimeout ? String(form.acceptTimeout) : '')
              setShowAcceptTimeoutModal(true)
            }}
          >
            <Text className="timeout-value">
              {formatAcceptTimeout(form.acceptTimeout)}
            </Text>
            <Text className="timeout-hint">超时未接单将自动取消订单</Text>
          </View>
        </View>

        {/* 审核时间设置 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">审核时间</Text>
            </View>
          </View>
          <View
            className="timeout-select-section"
            onClick={() => {
              setCustomAcceptanceInput(form.acceptanceTimeout ? String(form.acceptanceTimeout) : '')
              setShowAcceptanceTimeoutModal(true)
            }}
          >
            <Text className="timeout-value">
              {formatAcceptanceTimeout(form.acceptanceTimeout)}
            </Text>
            <Text className="timeout-hint">超时未审核将自动审核并结算收益</Text>
          </View>
        </View>

        {/* 素材上传（可选） */}
        {selectedType?.contentType != 'text' && (<View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot accent" />
              <Text className="section-title">素材上传</Text>
            </View>
            <Text className="section-hint">
              {totalCount === 0
                ? '可选，上传自定义素材'
                : `已选${totalCount}个素材`}
            </Text>
          </View>
          {/* 已上传的素材缩略图网格 */}
          {uploadedAssets.length > 0 && (
            <View className="asset-upload-grid">
              {uploadedAssets.map((asset, idx) => (
                <View key={asset.id + idx} className="asset-preview-item">
                  {asset.type === 'video' ? (
                    <View className="asset-preview-video-wrap">
                      <Video
                        src={asset.url}
                        className="asset-preview-video"
                        muted
                        autoplay={false}
                        showPlayBtn={false}
                        showFullscreenBtn={false}
                        showCenterPlayBtn={false}
                        controls={false}
                        objectFit="cover"
                      />
                      <View className="asset-video-play-icon">
                        <Play size={20} color="#fff" filled />
                      </View>
                      <Text className="asset-video-label">视频</Text>
                    </View>
                  ) : (
                    <Image src={asset.url} className="asset-preview-img" mode="aspectFill" />
                  )}
                  <View
                    className="asset-remove-btn"
                    onClick={() => handleRemoveAsset(asset.id)}
                  >
                    <X size={12} color="#fff" />
                  </View>
                </View>
              ))}
            </View>
          )}
          {/* 操作按钮行：添加素材 + 上传压缩包 */}
          <View className="asset-action-row">
            <View className="asset-add-main" onClick={handleUploadAsset}>
              <Plus size={16} color="#6366F1" />
              <Text className="asset-add-main-text">添加图片/视频</Text>
            </View>
            <View className="asset-zip-btn" onClick={handleUploadZip}>
              <Plus size={14} color="#8B5CF6" />
              <Text className="asset-zip-btn-text">压缩包</Text>
            </View>
          </View>
          {isUploading && (
            <View className="asset-uploading-bar">
              <Loader size={14} color="#6366F1" className="ai-loading" />
              <Text className="asset-uploading-bar-text">
                {zipProgress?.message || '上传中...'}
                {zipProgress && zipProgress.totalFiles > 0 ? ` (${zipProgress.processedFiles}/${zipProgress.totalFiles})` : ''}
              </Text>
            </View>
          )}
          {/* 素材分配模式 + AI自动补足开关 */}
          {form.contentType !== 'text' && (
            <>
              {/* 素材分配模式 */}
              <View className="asset-ai-toggle-row">
                <View className="asset-ai-toggle-left">
                  <Users size={14} color="#1890ff" />
                  <Text className="asset-ai-toggle-label">素材分配</Text>
                </View>
                <View className="asset-distribute-toggle">
                  <View
                    className={`asset-distribute-opt ${form.assetDistributeMode === 'shared' ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, assetDistributeMode: 'shared' }))}
                  >
                    <Text className={`asset-distribute-opt-text ${form.assetDistributeMode === 'shared' ? 'active' : ''}`}>共享</Text>
                  </View>
                  <View
                    className={`asset-distribute-opt ${form.assetDistributeMode === 'exclusive' ? 'active' : ''}`}
                    onClick={() => {
                      setForm(prev => {
                        const newForm = { ...prev, assetDistributeMode: 'exclusive' as const }
                        // 独占模式下，分身数不能超过素材可用数
                        if (newForm.assetDistributeMode === 'exclusive') {
                          const uploadedImages = uploadedAssets.filter(a => a.type === 'image').length
                          // 独占模式：最大分身数 = 素材数量（由getMaxAvatarCount计算）
                          if (uploadedImages > 0) {
                            const maxAvatars = uploadedImages
                            if (newForm.avatarCount > maxAvatars) {
                              newForm.avatarCount = maxAvatars
                              Taro.showToast({ title: `独占模式下最多${maxAvatars}个分身`, icon: 'none' })
                            }
                          }
                        }
                        return newForm
                      })
                    }}
                  >
                    <Text className={`asset-distribute-opt-text ${form.assetDistributeMode === 'exclusive' ? 'active' : ''}`}>独占</Text>
                  </View>
                </View>
              </View>
              {form.assetDistributeMode === 'shared' && (
                <View className="asset-mode-hint">
                  <Text className="asset-mode-hint-text">共享模式：所有分身使用相同的素材</Text>
                </View>
              )}
              {form.assetDistributeMode === 'exclusive' && (
                <View className="asset-mode-hint">
                  <Text className="asset-mode-hint-text">
                    独占模式：每个分身分配不同素材
                    {maxAvatarCount < 99 && maxAvatarCount > 0 && `，当前最多${maxAvatarCount}个分身`}
                    {maxAvatarCount === 0 && '，请先上传素材或开启AI补足'}
                    {maxAvatarCount === Infinity && '，AI将按分身数自动生成素材'}
                  </Text>
                </View>
              )}
              {/* AI自动补足开关：根据内容类型和素材数量决定是否显示 */}
              {/* 简单任务：共享模式上传数量 < 3 时显示；独享模式只有不上传素材时显示，可切换 */}
              {/* 图文笔记：无素材时显示且固定为true不可切换；共享模式上传数量 < 3 时显示可切换 */}
              {/* 短视频：无素材时显示且固定为true不可切换 */}
              {(() => {
                const isVideo = form.contentType === 'video'
                const isImage = form.contentType === 'image'
                const isShared = form.assetDistributeMode === 'shared'

                // 判断是否应该显示 AI 按钮
                let shouldShowAiButton = false
                // 判断 AI 按钮是否可切换
                let isAiButtonLocked = false

                if (isVideo) {
                  // 短视频：只有不上传素材时才显示AI按钮，且固定为true不可切换
                  shouldShowAiButton = totalCount === 0
                  isAiButtonLocked = totalCount === 0
                } else if (isImage) {
                  // 图文笔记
                  if (totalCount === 0) {
                    // 无素材时固定为true不可切换
                    shouldShowAiButton = true
                    isAiButtonLocked = true
                  } else {
                    isAiButtonLocked = false
                    if (isShared) {
                      // 共享模式：上传数量 < 3 时显示 AI 按钮
                      shouldShowAiButton = totalCount < 3
                    } else {
                      // 独享模式：不显示 AI 按钮
                      shouldShowAiButton = false
                    }
                  }
                } else {
                  // 简单任务
                  isAiButtonLocked = false
                  if (isShared) {
                    // 共享模式：上传数量 < 3 时显示 AI 按钮
                    shouldShowAiButton = totalCount < 3
                  } else {
                    // 独享模式：只有不上传素材时才显示 AI 按钮
                    shouldShowAiButton = totalCount === 0
                  }
                }

                return shouldShowAiButton && (
                  <View className="asset-ai-toggle-row" style={{ marginTop: '8px' }}>
                    <View className="asset-ai-toggle-left">
                      <Sparkles size={14} color="#8B5CF6" />
                      <Text className="asset-ai-toggle-label">AI自动补足素材</Text>
                    </View>
                    <View
                      className={`asset-ai-switch ${form.aiAutoFill ? 'active' : ''} ${isAiButtonLocked ? 'locked' : ''}`}
                      onClick={() => {
                        if (!isAiButtonLocked) {
                          setForm(prev => ({ ...prev, aiAutoFill: !prev.aiAutoFill }))
                        }
                      }}
                    >
                      <View className={`asset-ai-switch-dot ${form.aiAutoFill ? 'active' : ''}`} />
                    </View>
                  </View>
                )
              })()}
              {totalCount > 0 && form.aiAutoFill && requiredImageCount > 0 && imageCount < requiredImageCount && (
                <View className="asset-ai-hint">
                  <Sparkles size={14} color="#8B5CF6" />
                  <Text className="asset-ai-hint-text">不足的{requiredImageCount - imageCount}张图片支付后将由AI自动生成，分身接单时直接分配</Text>
                </View>
              )}
              {/* 无上传素材时的AI生成提示 */}
              {totalCount === 0 && (
                <View className="asset-ai-hint">
                  <Sparkles size={14} color="#8B5CF6" />
                  <Text className="asset-ai-hint-text">未上传素材，支付后将根据平台需求AI自动生成</Text>
                </View>
              )}
            </>
          )}
        </View>
        )}

        {/* 分身设置 - 增加价值说明 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">分身数量</Text>
            </View>
            <Users size={16} color="#6366F1" />
          </View>
          <Text className="field-hint mb-4">更多分身 = 更多风格 = 更大曝光，内容绝不撞车</Text>
          <View className="counter-row">
            <View className="counter-item">
              <Text className="counter-label">使用分身数</Text>
              <View className="counter-control">
                <View
                  className="counter-btn minus"
                  onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.max(1, prev.avatarCount - 1) }))}
                >
                  <Text>-</Text>
                </View>
                <Text className="counter-value">{form.avatarCount}</Text>
                <View
                  className="counter-btn plus"
                  onClick={() => {
                    const maxCount = getMaxAvatarCount()
                    if (maxCount !== Infinity && form.avatarCount >= maxCount) {
                      Taro.showToast({ title: `独占模式下最多${maxCount}个分身`, icon: 'none' })
                      return
                    }
                    setForm(prev => ({ ...prev, avatarCount: prev.avatarCount + 1 }))
                  }}
                >
                  <Text>+</Text>
                </View>
              </View>
              <Text className="counter-hint">
                {form.assetDistributeMode === 'exclusive' && getMaxAvatarCount() > 0
                  ? `${form.avatarCount}个分身各领不同素材（最多${getMaxAvatarCount()}个）`
                  : `${form.avatarCount}个分身各显特色`}
              </Text>
            </View>
            <View className="counter-item">
              <Text className="counter-label">每分身产出</Text>
              <View className="counter-control-static">
                <Text className="counter-value">1</Text>
              </View>
              <Text className="counter-hint">共{form.avatarCount}{selectedType?.output || '篇'}</Text>
            </View>
          </View>
        </View>

        {/* 价格预览 - 重新设计 */}
        <View className="price-card">
          <View className="price-header">
            <Coins size={16} color="#F59E0B" />
            <Text className="price-header-text">费用预估</Text>
          </View>
          <View className="price-row-container">
            <View className="price-row">
              <Text className="price-label">基础费用</Text>
              <Text className="price-value">¥{totalPrice.base.toFixed(2)}</Text>
            </View>
            <View className="price-label-detail-row">
              <Text className="price-label-detail">¥{(form.customBasePrice > basePricePerUnit ? form.customBasePrice : basePricePerUnit).toFixed(2)}</Text>
              <View
                className="price-edit-btn"
                onClick={() => {
                  const currentValue = form.customBasePrice > basePricePerUnit ? form.customBasePrice : basePricePerUnit
                  setCustomBasePriceInput(currentValue.toString())
                  const modalOptions: Record<string, any> = {
                    title: '自定义基础费用',
                    editable: true,
                    placeholderText: `最低¥${basePricePerUnit.toFixed(2)}`,
                    defaultValue: currentValue.toString(),
                    success: (res: any) => {
                      if (res.confirm && res.content) {
                        const contentValue = res.content.trim()
                        const newValue = parseFloat(contentValue)
                        const numValue = Number(newValue)
                        if (!Number.isNaN(numValue) && numValue >= basePricePerUnit && numValue > 0) {
                          setForm(prev => ({ ...prev, customBasePrice: numValue }))
                        } else {
                          Taro.showToast({ title: `请输入大于等于¥${basePricePerUnit.toFixed(2)}的有效金额`, icon: 'none' })
                        }
                      }
                    }
                  }
                  Taro.showModal(modalOptions)
                }}
              >
                <Pencil size={14} color="#6366F1" />
              </View>
              <Text className="price-label-detail"> × {form.avatarCount}个分身</Text>
            </View>
          </View>
          <View className="price-row-container">
            <View className="price-row">
              <Text className="price-label">内容费用</Text>
              <Text className="price-value">¥{totalPrice.content.toFixed(2)}</Text>
            </View>
            <Text className="price-label-detail-right">
              {(() => {
                // 纯文案内容费用为0
                if (form.contentType === 'text') {
                  return '无内容费用'
                }

                // AI自动补足未开启，内容费用为0
                if (!form.aiAutoFill) {
                  return '无内容费用'
                }

                const uploadedCount = uploadedAssets.length
                const isShared = form.assetDistributeMode === 'shared'
                const requiredCount = form.contentType === 'video' ? 1 : 3
                // 简单任务和图文笔记使用 image 的 contentPrice，短视频使用 video 的 contentPrice
                const pricePerUnit = form.contentType === 'video' ? videoContentPrice : imageContentPrice
                const avatarText = isShared ? '1个分身' : `${form.avatarCount}个分身`

                if (uploadedCount === 0) {
                  // 不上传素材，AI补足
                  return `¥${pricePerUnit.toFixed(2)} × ${requiredCount} × ${avatarText}`
                } else {
                  // 上传素材
                  if (form.contentType === 'video') {
                    // 短视频上传素材后内容费用为0
                    return '无内容费用'
                  }
                  const aiCount = Math.max(0, requiredCount - uploadedCount)
                  if (aiCount === 0) {
                    return '无内容费用'
                  }
                  return `¥${pricePerUnit.toFixed(2)} × ${aiCount} × ${avatarText}`
                }
              })()}
            </Text>
          </View>
          <View className="price-divider" />
          <View className="price-row total">
            <Text className="price-label">预计总价</Text>
            <Text className="price-value">¥{totalPrice.total.toFixed(2)}</Text>
          </View>
          <View className="price-value-row">
            <View className="price-value-item">
              <Clock size={12} color="rgba(255,255,255,0.5)" />
              <Text className="price-value-text">24h内交付</Text>
            </View>
            <View className="price-value-item">
              <ShieldCheck size={12} color="rgba(255,255,255,0.5)" />
              <Text className="price-value-text">不满意退款</Text>
            </View>
            <View className="price-value-item">
              <Zap size={12} color="rgba(255,255,255,0.5)" />
              <Text className="price-value-text">AI智能匹配</Text>
            </View>
          </View>
        </View>

        {/* 底部间距 */}
        <View style={{ height: '140px' }} />
      </ScrollView>

      {/* 底部提交按钮 */}
      <View className="submit-bar">
        <View className="submit-info">
          <Text className="submit-total-label">合计</Text>
          <Text className="submit-total-value">¥{totalPrice.total.toFixed(2)}</Text>
          <Text className="submit-output-hint">共{totalOutput}篇</Text>
        </View>
        <View
          className={`submit-button ${isSubmitting ? 'loading' : ''}`}
          onClick={isSubmitting || aiLoading ? undefined : handleSubmit}
        >
          {isSubmitting ? (
            <Loader size={16} color="#fff" className="btn-loading" />
          ) : (
            <>
              <Send size={14} color="#fff" />
              <Text className="submit-text">发布任务</Text>
            </>
          )}
        </View>
      </View>
    </View>
  )
}
