import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { View, Text, ScrollView, Image, Video, Input as TaroInput } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Send, Check, ChevronRight, Loader, ArrowLeft,
  Coins, Sparkles, Zap, ShieldCheck, Clock,
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

// 审核时间选项
const ACCEPTANCE_TIMEOUT_OPTIONS = [
  { label: '1h', value: 1 },
  { label: '3h', value: 3 },
  { label: '12h', value: 12 },
  { label: '1天', value: 24 },
  { label: '3天', value: 72 },
  // { label: '5天', value: 120 },
  // { label: '7天', value: 168 },
]

// 接单超时选项（分钟）
const ACCEPT_TIMEOUT_OPTIONS = [
  // { label: '不限时', value: 0 },
  { label: '30分钟', value: 30 },
  { label: '1小时', value: 60 },
  { label: '2小时', value: 120 },
  { label: '3小时', value: 180 },
  { label: '4小时', value: 240 },
  { label: '1天', value: 1440 },
  { label: '2天', value: 2880 },
  { label: '3天', value: 4320 },
]

const PLATFORM_OPTIONS = PLATFORM_UI_ORDER
  .map((key) => ({ id: key, ...PLATFORM_META_MAP[key] }))
  .filter((item) => Array.isArray(item.requirements))
// base_price: 'base_amount',
// content_price: 'content_amount',
// total_price: 'budget',
type FormState = {
  title: string
  description: string
  contentType: string
  acceptRegions: string[]
  acceptTimeout: number
  acceptanceTimeout: number
  platforms: string[]
  avatarCount: number
  basePricePerUnit: number
  contentPricePerUnit: number
  // personality: {
  //   tags: string
  //   niches: string
  // }
}
const initialForm: FormState = {
  title: '',
  description: '',
  contentType: 'text',
  acceptRegions: [],
  acceptTimeout: 120,
  acceptanceTimeout: 24,
  platforms: [],
  avatarCount: 0,
  basePricePerUnit: 0,
  contentPricePerUnit: 0,
  // personality: {
  //   tags: '',
  //   niches: '',
  // },
}
const STEP_PAGE_URL = '/package-order/pages/order-step-management/index'
const DRAFT_STORAGE_KEY = 'order_create_step_draft'
const stringifyPayload = (payload: Record<string, any>) => JSON.stringify(payload)

export default function OrderCreate() {
  const router = useRouter()
  const [contentTypes, setContentTypes] = useState<any[]>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [, setCustomBasePriceInput] = useState('') // 输入框显示值
  const [uploadedAssets, setUploadedAssets] = useState<{ id: string; url: string; type: 'image' | 'video'; filename: string; size: number; mimeType: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showNichePicker, setShowNichePicker] = useState(false)
  const [showAcceptanceTimeoutModal, setShowAcceptanceTimeoutModal] = useState(false)
  const [customAcceptanceInput, setCustomAcceptanceInput] = useState('')
  const [showAcceptTimeoutModal, setShowAcceptTimeoutModal] = useState(false)
  const [customAcceptTimeoutInput, setCustomAcceptTimeoutInput] = useState('')
  const aiPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [orderId, setOrderId] = useState('')
  const orderIdRef = useRef('')
  const submittedPayloadRef = useRef('')
  const submitLockRef = useRef(false)

  // 格式化接单超时显示
  const formatAcceptTimeout = (minutes: number): string => {
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

  useEffect(() => {
    const fetchPriceConfig = async () => {
      try {
        const res = await Network.request({ url: '/api/order/price-config' })
        if (res.data?.code === 200 && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setContentTypes(res.data.data)
          // 设置默认内容类型的价格
          const defaultType = res.data.data.find((t: any) => t.contentType === 'text')
          if (defaultType) {
            setForm(prev => ({
              ...prev,
              basePricePerUnit: defaultType.basePrice ?? 0,
              contentPricePerUnit: defaultType.contentPrice ?? 0,
            }))
          }
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

  useDidShow(async () => {
    const routeOrderId = String(router.params?.orderId || '')
    if (routeOrderId) {
      try {
        const res = await Network.request({ url: `/api/order/${routeOrderId}` })
        const data = res.data?.data
        if (data) {
          orderIdRef.current = routeOrderId
          setOrderId(routeOrderId)
          const savedPayload: Record<string, any> = {
            title: data.title || '',
            description: data.description || '',
            content_type: data.contentType || data.content_type || 'text',
            accept_regions: data.acceptRegions || data.accept_regions || [],
            accept_timeout: data.acceptTimeout || data.accept_timeout || 0,
            acceptance_timeout: data.acceptanceTimeout || data.acceptance_timeout || 24,
            platforms: data.platforms || [],
            // preferred_styles: data.preferredStyles || data.preferred_styles || '',
            // industry_tags: data.industryTags || data.industry_tags || '',
            avatar_count: data.avatarCount ?? data.avatar_count ?? 0,
            base_price: data.baseAmount || data.base_price || 0,
            content_price: data.contentAmount || data.content_price || 0,
            total_price: data.budget || data.totalPrice || data.total_price || 0,
          }
          submittedPayloadRef.current = stringifyPayload(savedPayload)
          Taro.setStorageSync(DRAFT_STORAGE_KEY, { orderId: routeOrderId, payload: savedPayload })

          const basePricePerUnit = data.price || data.customBasePrice || data.custom_base_price || 0

          setForm({
            title: data.title || '',
            description: data.description || '',
            contentType: data.contentType || data.content_type || 'text',
            acceptRegions: data.acceptRegions || data.accept_regions || [],
            acceptTimeout: data.acceptTimeout || data.accept_timeout || 0,
            acceptanceTimeout: data.acceptanceTimeout || data.acceptance_timeout || 24,
            platforms: data.platforms || [],
            avatarCount: data.avatarCount ?? data.avatar_count ?? 0,
            basePricePerUnit: basePricePerUnit,
            contentPricePerUnit: data.contentPricePerUnit || data.content_price_per_unit || 0,
            // personality: {
            //   tags: data.personality?.tags || '',
            //   niches: data.personality?.niches || '',
            // },
          })
        }
      } catch (e) {
        console.error('加载订单数据失败:', e)
      }
    } else {
      // Keep the order id created in this page when returning from the next step.
    }
  })
  // ========== 素材上传相关 ==========
  const selectedType = contentTypes.find(t => t.contentType === form.contentType)
  const basePricePerUnit = form.basePricePerUnit
  const contentPricePerUnit = form.contentPricePerUnit

  // 获取不同内容类型的价格配置（用于计算内容费用）
  const imageTypeConfig = contentTypes.find(t => t.contentType === 'image')
  const videoTypeConfig = contentTypes.find(t => t.contentType === 'video')
  void contentTypes.find(t => t.contentType === 'text') // textTypeConfig (unused but kept for future use)

  // ========== ai帮写 ==========
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
    // 获取新类型的价格配置
    const newType = contentTypes.find(t => t.contentType === typeId)
    const defaultBasePrice = newType?.basePrice ?? 0
    const defaultContentPrice = newType?.contentPrice ?? 0

    setForm(prev => ({
      ...prev,
      contentType: typeId,
      basePricePerUnit: defaultBasePrice,
      contentPricePerUnit: defaultContentPrice,
    }))
    // 切换类型时清空自定义价格输入
    setCustomBasePriceInput('')
  }

  const togglePlatform = (platformId: string) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platformId) ? [] : [platformId],
    }))
  }
  const buildOrderPayload = () => {
    // 计算基础价格和内容价格
    const basePrice = form.basePricePerUnit * form.avatarCount
    // const contentPrice = form.contentPricePerUnit * form.avatarCount
    const totalPrice = basePrice

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      content_type: form.contentType,
      accept_regions: form.acceptRegions,
      accept_timeout: form.acceptTimeout,
      acceptance_timeout: form.acceptanceTimeout,
      platforms: canonicalizePlatforms(form.platforms),
      // personality: {
      //   tags: form.personality.tags,
      //   niches: form.personality.niches,
      // },
      avatar_count: form.avatarCount,
      basePricePerUnit: form.basePricePerUnit,
      contentPricePerUnit: form.contentPricePerUnit,
      base_price: basePrice,
      content_price: 0,
      total_price: totalPrice,
      platform: 'special',
      status: 'draft',
      price: form.basePricePerUnit,
      custom_base_price: form.basePricePerUnit,
    }
  }
  const validateForm = () => {
    if (form.platforms.length === 0) {
      Taro.showToast({ title: '请选择发布平台', icon: 'none' })
      return false
    }
    if (!form.contentType) {
      Taro.showToast({ title: '请选择内容类型', icon: 'none' })
      return false
    }
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
      return false
    }
    if (!form.description.trim()) {
      Taro.showToast({ title: '请输入任务描述', icon: 'none' })
      return false
    }
    if (form.acceptanceTimeout <= 0) {
      Taro.showToast({ title: '请选择审核时间', icon: 'none' })
      return false
    }
    if (form.avatarCount < 1) {
      Taro.showToast({ title: '请输入接单数量', icon: 'none' })
      return false
    }
    return true
  }
  const goStepManagement = (nextOrderId: string, payload: Record<string, any>) => {
    Taro.setStorageSync(DRAFT_STORAGE_KEY, { orderId: nextOrderId, payload })
    Taro.navigateTo({ url: `${STEP_PAGE_URL}?orderId=${encodeURIComponent(nextOrderId)}` })
  }
  const handleSubmit = async () => {
    if (submitLockRef.current || isSubmitting) return
    if (!validateForm()) return
    submitLockRef.current = true
    const payload = buildOrderPayload()
    const nextSnapshot = stringifyPayload(payload)
    const draft = Taro.getStorageSync(DRAFT_STORAGE_KEY)
    const draftOrderId = draft?.orderId ? String(draft.orderId) : ''
    const draftSnapshot = draftOrderId && draft?.payload ? stringifyPayload(draft.payload) : ''
    const effectiveOrderId = orderId || orderIdRef.current || (draftSnapshot === nextSnapshot ? draftOrderId : '')
    const submittedSnapshot = submittedPayloadRef.current || draftSnapshot

    if (effectiveOrderId && submittedSnapshot === nextSnapshot) {
      orderIdRef.current = effectiveOrderId
      setOrderId(effectiveOrderId)
      submittedPayloadRef.current = submittedSnapshot
      goStepManagement(effectiveOrderId, payload)
      submitLockRef.current = false
      return
    }

    setIsSubmitting(true)
    try {
      if (effectiveOrderId) {
        const res = await Network.request({
          url: `/api/order/${effectiveOrderId}`,
          method: 'PUT',
          data: payload,
        })
        const data = res?.data
        if (data?.code !== 200) {
          Taro.showToast({ title: Network.getMsg(data, '更新订单失败'), icon: 'none' })
          return
        }
        orderIdRef.current = effectiveOrderId
        setOrderId(effectiveOrderId)
        submittedPayloadRef.current = nextSnapshot
        goStepManagement(effectiveOrderId, payload)
        return
      }
      const ires = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: payload,
      })
      const data = ires?.data
      const nextOrderId = data?.data?.id
      if (data?.code === 200 && nextOrderId) {
        orderIdRef.current = nextOrderId
        setOrderId(nextOrderId)
        submittedPayloadRef.current = nextSnapshot
        goStepManagement(nextOrderId, payload)
      } else {
        Taro.showToast({ title: Network.getMsg(data, '创建订单失败'), icon: 'none' })
      }
    } catch (err: any) {
      console.error('创建订单失败:', err)
      Taro.showToast({ title: err?.message || '网络错误，请重试', icon: 'none' })
    } finally {
      submitLockRef.current = false
      setIsSubmitting(false)
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
      <View className="order-page-header" style={{ paddingTop: `${statusBarHeight}px` }}>
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
          {/* <View className="records-btn" onClick={() => Taro.navigateTo({ url: '/package-order/pages/order-list/index' })}>
            <ClipboardList size={16} color="#fff" />
            <Text className="records-btn-text">发单记录</Text>
          </View> */}
        </View>
      </View>

      <ScrollView
        scrollY
        className="scroll-container"
        key="order-create-scroll"
      >
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
                onClick={() => togglePlatform(config.id)}
              >
                <View className="platform-icon-wrap" style={{ background: config.bgColor }}>
                  <Text className="platform-emoji">{config.icon}</Text>
                </View>
                <Text className="platform-name">{config.name}</Text>
                {form.platforms.includes(config.id) && (
                  <View className="platform-check">
                    <Check size={10} color="#fff" />
                  </View>
                )}
              </View>
            ))}
          </View>
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
                {form.contentType === type.contentType && (
                  <View className="type-check">
                    <Check size={10} color="#fff" />
                  </View>
                )}
              </View>
            ))}
          </View>
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
              setCustomAcceptTimeoutInput(form.acceptTimeout ? String(form.acceptTimeout / 60) : '')
              setShowAcceptTimeoutModal(true)
            }}
          >
            <Text className="timeout-value">
              {formatAcceptTimeout(form.acceptTimeout)}
            </Text>
            <Text className="timeout-hint">超时未发布将自动取消订单</Text>
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
          {form.acceptRegions.length > 0 && (
            <View className="region-value-row">
              <View className="region-value-tags">
                {form.acceptRegions.map((region, index) => (
                  <Text key={region} className="region-value-tag">
                    {region}{index < form.acceptRegions.length - 1 ? '、' : ''}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 内容风格偏好 */}
        {/* <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot accent" />
              <Text className="section-title">风格偏好</Text>
            </View>
            <View className="region-trigger" onClick={() => setShowStylePicker(true)}>
              <Text className="section-hint">
                {form.personality.tags === ''
                  ? '不限风格'
                  : form.personality.tags}
              </Text>
              <ChevronRight size={14} color="#94A3B8" />
            </View>
          </View>
          {form.personality.tags !== '' && (
            <View className="region-value-row">
              <View className="region-value-tags">
                <Text className="region-value-tag">
                  {form.personality.tags}
                </Text>
              </View>
            </View>
          )}
        </View> */}

        {/* 行业领域偏好 */}
        {/* <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot accent" />
              <Text className="section-title">领域偏好</Text>
            </View>
            <View className="region-trigger" onClick={() => setShowNichePicker(true)}>
              <Text className="section-hint">
                {form.personality.niches === ''
                  ? '不限领域'
                  : form.personality.niches}
              </Text>
              <ChevronRight size={14} color="#94A3B8" />
            </View>
          </View>
          {form.personality.niches !== '' && (
            <View className="region-value-row">
              <View className="region-value-tags">
                <Text className="region-value-tag">
                  {form.personality.niches}
                </Text>
              </View>
            </View>
          )}
        </View> */}

        {/* 分身设置 - 增加价值说明 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">接单数量</Text>
            </View>
            <View className="avatar-count-control">
              <View
                className="counter-btn minus"
                onClick={() => form.avatarCount > 1 && setForm(prev => ({ ...prev, avatarCount: prev.avatarCount - 1 }))}
              >
                <Text>-</Text>
              </View>
              <View className="counter-input-wrap">
                <TaroInput
                  className="counter-input"
                  type="number"
                  value={form.avatarCount === 0 ? '' : String(form.avatarCount)}
                  placeholder=""
                  onInput={e => {
                    const val = e.detail.value.replace(/[^\d]/g, '')
                    const num = parseInt(val, 10)
                    if (!Number.isNaN(num) && num >= 1) {
                      setForm(prev => ({ ...prev, avatarCount: num }))
                    } else if (val === '' || Number.isNaN(num)) {
                      setForm(prev => ({ ...prev, avatarCount: 0 }))
                    }
                  }}
                  onBlur={e => {
                    const val = e.detail.value.replace(/[^\d]/g, '')
                    const num = parseInt(val, 10)
                    if (Number.isNaN(num) || num < 1) {
                      setForm(prev => ({ ...prev, avatarCount: 0 }))
                    }
                  }}
                />
              </View>
              <View
                className="counter-btn plus"
                onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.min(99, prev.avatarCount + 1) }))}
              >
                <Text>+</Text>
              </View>
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

        {/* 风格偏好选择弹窗 */}
        {/* {showStylePicker && (
          <View className="region-picker-overlay" onClick={() => setShowStylePicker(false)}>
            <View className="region-picker-content" onClick={e => e.stopPropagation()}>
              <View className="region-picker-header">
                <Text className="region-picker-title">选择风格偏好</Text>
                <View className="region-picker-close" onClick={() => setShowStylePicker(false)}>
                  <X size={18} color="#64748b" />
                </View>
              </View>
              <View className="region-picker-grid">
                <View
                  key="none"
                  className={`region-tag ${form.personality.tags === '' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, personality: { ...prev.personality, tags: '' } }))}
                >
                  <Text className="region-tag-text">不限</Text>
                </View>
                {CONTENT_STYLES.map(style => (
                  <View
                    key={style.key}
                    className={`region-tag ${form.personality.tags === style.name ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, personality: { ...prev.personality, tags: style.name } }))}
                  >
                    <Text className="region-tag-text">{style.name}</Text>
                  </View>
                ))}
              </View>
              <View className="region-picker-footer">
                <View className="region-picker-confirm" onClick={() => setShowStylePicker(false)}>
                  <Text className="region-picker-confirm-text">确定</Text>
                </View>
              </View>
            </View>
          </View>
        )} */}

        {/* 领域偏好选择弹窗 */}
        {/* {showNichePicker && (
          <View className="region-picker-overlay" onClick={() => setShowNichePicker(false)}>
            <View className="region-picker-content" onClick={e => e.stopPropagation()}>
              <View className="region-picker-header">
                <Text className="region-picker-title">选择领域偏好</Text>
                <View className="region-picker-close" onClick={() => setShowNichePicker(false)}>
                  <X size={18} color="#64748b" />
                </View>
              </View>
              <View className="region-picker-grid">
                <View
                  key="none"
                  className={`region-tag ${form.personality.niches === '' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, personality: { ...prev.personality, niches: '' } }))}
                >
                  <Text className="region-tag-text">不限</Text>
                </View>
                {NICHE_TAGS.map(niche => (
                  <View
                    key={niche.key}
                    className={`region-tag ${form.personality.niches === niche.name ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, personality: { ...prev.personality, niches: niche.name } }))}
                  >
                    <Text className="region-tag-text">{niche.name}</Text>
                  </View>
                ))}
              </View>
              <View className="region-picker-footer">
                <View className="region-picker-confirm" onClick={() => setShowNichePicker(false)}>
                  <Text className="region-picker-confirm-text">确定</Text>
                </View>
              </View>
            </View>
          </View>
        )} */}

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
                          if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 72) {
                            setForm(prev => ({ ...prev, acceptanceTimeout: numValue }))
                          } else if (!Number.isNaN(numValue) && numValue > 72) {
                            setCustomAcceptanceInput('72')
                            setForm(prev => ({ ...prev, acceptanceTimeout: 72 }))
                          }
                        } else {
                          setForm(prev => ({ ...prev, acceptanceTimeout: 24 })) // 默认1天
                        }
                      }}
                    />
                    <Text className="custom-unit">小时</Text>
                  </View>
                  <Text className="custom-hint">范围：1-72小时（3天），仅支持整数</Text>
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
                        setCustomAcceptTimeoutInput(String(option.value / 60))
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
                  <Text className="custom-label">自定义时间（小时）</Text>
                  <View className="custom-input-row">
                    <TaroInput
                      type="digit"
                      className="custom-input"
                      placeholder="输入小时数"
                      value={customAcceptTimeoutInput}
                      onInput={(e: any) => {
                        const value = e.detail.value
                        // 过滤非数字字符，仅保留数字和一个小数点
                        const filteredValue = String(value || '')
                          .replace(/[^\d.]/g, '')
                          .replace(/(\..*)\./g, '$1')
                        setCustomAcceptTimeoutInput(filteredValue)
                      }}
                    />
                    <Text className="custom-unit">小时</Text>
                  </View>
                  <Text className="custom-hint">范围：0.5-72小时（3天）</Text>
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
                    const inputValue = parseFloat(inputStr)
                    if (!Number.isFinite(inputValue) || inputValue < 0.5) {
                      Taro.showToast({ title: '最小0.5小时', icon: 'none' })
                      setCustomAcceptTimeoutInput('0.5')
                      setForm(prev => ({ ...prev, acceptTimeout: 30 }))
                      setShowAcceptTimeoutModal(false)
                    } else if (inputValue > 72) {
                      Taro.showToast({ title: '最大3天', icon: 'none' })
                      setCustomAcceptTimeoutInput('72')
                      setForm(prev => ({ ...prev, acceptTimeout: 4320 }))
                      setShowAcceptTimeoutModal(false)
                    } else {
                      setForm(prev => ({ ...prev, acceptTimeout: Math.round(inputValue * 60) }))
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
        {/* 底部间距 */}
        <View style={{ height: '140px' }} />
      </ScrollView>

      {/* 底部提交按钮 */}
      <View className="submit-bar">
        <View
          className={`submit-button ${isSubmitting ? 'loading' : ''}`}
          onClick={isSubmitting || aiLoading ? undefined : handleSubmit}
        >
          {isSubmitting ? (
            <Loader size={16} color="#fff" className="btn-loading" />
          ) : (
            <>
              <Send size={14} color="#fff" />
              <Text className="submit-text">下一步</Text>
            </>
          )}
        </View>
      </View>
    </View>
  )
}
