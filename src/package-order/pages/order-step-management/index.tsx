import { useEffect, useMemo, useState, useRef } from 'react'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { ScrollView, Text, View, Image, Input as TaroInput, Video } from '@tarojs/components'
import { ArrowLeft, Check, GripVertical, Plus, X, Image as ImageIcon, Video as VideoIcon, Play, Users, Sparkles, Coins, Pencil } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type StepItem = {
  id: string
  group: string
  label: string
  type: string
  description?: string
  data?: {
    url?: string
    image?: string
    video?: string
    copyData?: string
    exampleImage?: string
    exampleText?: string
    exampleUrl?: string
    materials?: { type: 'text' | 'image' | 'video'; content: string }[]
    distributeMode?: 'shared' | 'exclusive'
    useAiMaterial?: boolean
    aiPrompt?: string
  }
  extConfig?: Record<string, string>
}

const truncateStr = (str: string | undefined, maxLen = 20) => {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
};

const STEP_EXT_CONFIG: Record<string, Record<string, string>> = {
  input_url: { open_button_text: '打开链接', copy_button_text: '一键复制' },
  upload_qrcode: { save_button_image: '一键保存' },
  copy_data: { copy_button_text: '一键复制' },
  collect_image: { upload_button_image: '上传图片' },
  // collect_url: { upload_button_image: '一键复制' },
  material_text: { copy_button_text: '一键复制' },
  material_image: { save_button_image: '一键保存' },
  material_video: { save_button_video: '一键保存' },
}

const MATERIAL_TYPES = ['material_text', 'material_image', 'material_video']

const transformTaskSteps = (steps: any[], materialRecord: any): StepItem[] => {
  return steps.map((row) => {
    const stepType = row.step_type || row.stepType || ''
    const mediaList = typeof row.media_list === 'string'
      ? (row.media_list ? JSON.parse(row.media_list) : [])
      : (row.mediaList || [])
    const extConfig = typeof row.ext_config === 'string'
      ? (row.ext_config ? JSON.parse(row.ext_config) : {})
      : (row.extConfig || {})
    const mainContent = row.main_content || row.mainContent || ''
    const stepDesc = row.step_desc || row.stepDesc || ''

    const data: Record<string, any> = {}

    if (stepType === 'input_url') {
      data.url = mainContent || ''
    } else if (stepType === 'upload_qrcode') {
      data.image = mediaList[0]?.url || ''
    } else if (stepType === 'copy_data') {
      data.copyData = mainContent || ''
    } else if (stepType === 'image_instruction') {
      data.image = mediaList[0]?.url || ''
    } else if (stepType === 'video_instruction') {
      data.video = mediaList[0]?.url || ''
    } else if (stepType === 'collect_image') {
      data.exampleImage = mediaList[0]?.url || ''
    } else if (stepType === 'collect_info') {
      data.exampleText = mainContent || ''
    } else if (stepType === 'collect_url') {
      data.exampleUrl = mainContent || ''
    } else if (stepType === 'material_text' && materialRecord) {
      const textContent = typeof materialRecord.text_content === 'string'
        ? (materialRecord.text_content ? JSON.parse(materialRecord.text_content) : [])
        : (materialRecord.textContent || [])
      data.materials = textContent
      data.useAiMaterial = (materialRecord.text_mode || materialRecord.textMode) === 'ai_prompt_only'
      data.aiPrompt = materialRecord.text_prompt || materialRecord.textPrompt || ''
      const textExt = typeof materialRecord.text_ext === 'string'
        ? (materialRecord.text_ext ? JSON.parse(materialRecord.text_ext) : {})
        : (materialRecord.textExt || {})
      data.distributeMode = textExt.distribute_mode || 'shared'
    } else if (stepType === 'material_image' && materialRecord) {
      const imageList = typeof materialRecord.image_list === 'string'
        ? (materialRecord.image_list ? JSON.parse(materialRecord.image_list) : [])
        : (materialRecord.imageList || [])
      data.materials = imageList
      data.useAiMaterial = (materialRecord.image_mode || materialRecord.imageMode) === 'ai_generate'
      data.aiPrompt = materialRecord.image_prompt || materialRecord.imagePrompt || ''
      const imageExt = typeof materialRecord.image_ext === 'string'
        ? (materialRecord.image_ext ? JSON.parse(materialRecord.image_ext) : {})
        : (materialRecord.imageExt || {})
      data.distributeMode = imageExt.distribute_mode || 'shared'
    } else if (stepType === 'material_video' && materialRecord) {
      const videoList = typeof materialRecord.video_list === 'string'
        ? (materialRecord.video_list ? JSON.parse(materialRecord.video_list) : [])
        : (materialRecord.videoList || [])
      data.materials = videoList
      data.useAiMaterial = (materialRecord.video_mode || materialRecord.videoMode) === 'ai_generate'
      data.aiPrompt = materialRecord.video_prompt || materialRecord.videoPrompt || ''
      const videoExt = typeof materialRecord.video_ext === 'string'
        ? (materialRecord.video_ext ? JSON.parse(materialRecord.video_ext) : {})
        : (materialRecord.videoExt || {})
      data.distributeMode = videoExt.distribute_mode || 'shared'
    }

    const resultStep: StepItem = {
      id: `step_${row.id}`,
      group: MATERIAL_TYPES.includes(stepType) ? '发布素材' : '任务入口',
      label: row.step_title || row.stepTitle || '',
      type: stepType,
      description: stepDesc || '',
    }

    if (Object.keys(data).length > 0) {
      resultStep.data = data
    }

    if (Object.keys(extConfig).length > 0) {
      resultStep.extConfig = extConfig
    }

    return resultStep
  })
}

const STEP_GROUPS = [
  {
    title: '任务说明',
    items: [
      { label: '输入网址', type: 'input_url' },
      { label: '传二维码', type: 'upload_qrcode' },
      { label: '文字说明', type: 'text_instruction' },
      { label: '图片说明', type: 'image_instruction' },
      { label: '视频说明', type: 'video_instruction' },
      { label: '复制数据', type: 'copy_data' },
    ],
  },
  {
    title: '发布素材',
    items: [
      { label: '文字素材', type: 'material_text' },
      { label: '图片素材', type: 'material_image' },
      { label: '视频素材', type: 'material_video' },
    ],
  },
  {
    title: '验收内容',
    items: [
      { label: '收集截图', type: 'collect_image' },
      { label: '收集信息', type: 'collect_info' },
      { label: '收集链接', type: 'collect_url' },
    ],
  },
]


const getStepsStorageKey = (orderId: string) => `order_steps_${orderId || 'draft'}`
const DRAFT_STORAGE_KEY = 'order_create_step_draft' // 上一步传递的订单信息 Taro.getStorageSync(storageKey)步骤管理页的步骤列表数据

const isValidUrl = (url: string): boolean => {
  const trimmedUrl = url.trim()
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
}

const getMaterialItemsByContentType = (contentType: string) => {
  switch (contentType) {
    case 'simple':
      return []
    case 'text':
      return [{ label: '文字素材', type: 'material_text' },]
    case 'image':
      return [
        { label: '文字素材', type: 'material_text' },
        { label: '图片素材', type: 'material_image' },
      ]
    case 'video':
      return [
        { label: '文字素材', type: 'material_text' },
        { label: '视频素材', type: 'material_video' },
      ]
    default:
      return [
        { label: '文字素材', type: 'material_text' },
        { label: '图片素材', type: 'material_image' },
        { label: '视频素材', type: 'material_video' },
      ]
  }
}

export default function OrderStepManagement() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()
  const orderId = String(router.params?.orderId || '')
  const storageKey = useMemo(() => getStepsStorageKey(orderId), [orderId])

  const [saveTemplate, setSaveTemplate] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [steps, setSteps] = useState<StepItem[]>(() => {
    const stored = Taro.getStorageSync(storageKey)
    return Array.isArray(stored) ? stored : []
  })

  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const repayInFlightRef = useRef(false)

  useDidShow(async () => {
    const draftData = Taro.getStorageSync(DRAFT_STORAGE_KEY)
    const storedSteps = Taro.getStorageSync(storageKey)
    //本地存储中已经保存了步骤数据就从本地获取，没有就从数据库
    if (storedSteps && Array.isArray(storedSteps) && storedSteps.length > 0) {
      return
    }

    if (orderId) {
      try {
        const res = await Network.request({
          url: `/api/order/${orderId}/task-steps`,
          method: 'GET',
        })
        const payload = res?.data
        if (payload?.code === 200 && payload?.data?.steps && payload.data.steps.length > 0) {
          const transformedSteps = transformTaskSteps(payload.data.steps, payload.data.material)
          persistSteps(transformedSteps)
          return
        }
      } catch (e) {
        console.error('[获取步骤] 错误:', e)
      }
    }

    if (draftData && draftData.payload) {
      const currentContentType = draftData.payload.contentType || draftData.payload.content_type || 'text'
      const currentSteps = stepsRef.current
      const expectedMaterialTypes = getMaterialItemsByContentType(currentContentType).map(item => item.type)

      const incompatibleIds = new Set<string>()
      currentSteps.forEach(step => {
        if (step.group === '发布素材') {
          if (currentContentType === 'simple') {
            incompatibleIds.add(step.id)
          } else if (expectedMaterialTypes.length > 0 && !expectedMaterialTypes.includes(step.type)) {
            incompatibleIds.add(step.id)
          }
        }
      })

      if (incompatibleIds.size > 0) {
        const updatedSteps = currentSteps.filter(step => !incompatibleIds.has(step.id))
        persistSteps(updatedSteps)
      }
    }
  })

  const [contentType] = useState(() => {
    const draftData = Taro.getStorageSync(DRAFT_STORAGE_KEY)
    if (draftData && draftData.payload) {
      return draftData.payload.contentType || draftData.payload.content_type || 'text'
    }
    return 'text'
  })

  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [modalGroup, setModalGroup] = useState('')
  const [modalLabel, setModalLabel] = useState('')
  const [modalDescription, setModalDescription] = useState('')
  const [modalUrl, setModalUrl] = useState('')
  const [modalImage, setModalImage] = useState('')
  const [modalVideo, setModalVideo] = useState('')
  const [modalCopyData, setModalCopyData] = useState('')
  const [modalExampleText, setModalExampleText] = useState('')
  const [modalMaterials, setModalMaterials] = useState<{ type: 'text' | 'image' | 'video'; content: string }[]>([])
  const [modalMaterialInput, setModalMaterialInput] = useState('')
  const [modalDistributeMode, setModalDistributeMode] = useState<'shared' | 'exclusive'>('shared')
  const [modalUseAiMaterial, setModalUseAiMaterial] = useState(true)
  const [modalAiPrompt, setModalAiPrompt] = useState('')
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [priceInfo, setPriceInfo] = useState({ baseUnit: 0, basePrice: 0, contentPrice: 0, totalPrice: 0, avatarCount: 0 })
  const [customBasePriceInput, setCustomBasePriceInput] = useState('')
  const [contentTypes, setContentTypes] = useState<any[]>([])
  const [basePricePerUnit, setBasePricePerUnit] = useState(0)

  // 监听 customBasePriceInput 变化，重新计算价格
  useEffect(() => {
    const actualBasePrice = customBasePriceInput ? Math.max(parseFloat(customBasePriceInput), basePricePerUnit) : basePricePerUnit
    const avatarCount = priceInfo.avatarCount || 1
    const basePrice = actualBasePrice * avatarCount
    setPriceInfo(prev => ({
      ...prev,
      baseUnit: actualBasePrice,
      basePrice: basePrice,
      totalPrice: basePrice,
    }))
  }, [customBasePriceInput, priceInfo.avatarCount])

  useDidShow(() => {
    fetchPriceConfig()
    loadFromStorage()
  })

  const fetchPriceConfig = async () => {
    try {
      const res = await Network.request({ url: '/api/order/price-config' })
      if (res.data?.code === 200 && Array.isArray(res.data.data)) {
        setContentTypes(res.data.data)
        const selectedType = res.data.data.find(t => t.contentType === contentType)
        if (selectedType) {
          setBasePricePerUnit(selectedType.basePrice)
        }
      }
    } catch (e) {
      console.error('[获取价格配置] 错误:', e)
    }
  }

  const loadFromStorage = () => {
    const draftData = Taro.getStorageSync(DRAFT_STORAGE_KEY)
    if (draftData?.payload) {
      setOrderInfo(draftData.payload)
      const basePrice = draftData.payload.baseAmount || draftData.payload.base_price || 0
      const contentPrice = draftData.payload.content_price || draftData.payload.contentPrice || 0
      const totalPrice = draftData.payload.total_price || draftData.payload.totalPrice || 0
      const baseUnit = draftData.payload.basePricePerUnit || 0
      // const contentPricePerUnit = draftData.payload.contentPricePerUnit || 0
      const avatarCount = draftData.payload.avatarCount || draftData.payload.avatar_count || 0
      setPriceInfo({
        baseUnit: baseUnit,
        basePrice: basePrice,
        contentPrice: contentPrice,
        totalPrice: totalPrice,
        avatarCount: avatarCount,
      })
      if (baseUnit > 0) {
        setCustomBasePriceInput(baseUnit.toString())
      }
    }
  }

  const calculatePrice = () => {
    const draftData = Taro.getStorageSync(DRAFT_STORAGE_KEY)
    const avatarCount = draftData?.payload?.avatarCount || draftData?.payload?.avatar_count || orderInfo?.avatarCount || 1
    const actualBasePrice = customBasePriceInput ? Math.max(parseFloat(customBasePriceInput), basePricePerUnit) : basePricePerUnit
    const basePrice = actualBasePrice * avatarCount
    return {
      baseUnit: actualBasePrice,
      basePrice: basePrice,
      contentPrice: 0,
      totalPrice: basePrice,
      avatarCount: avatarCount,
    }
  }

  const handlePublish = async () => {
    if (steps.length === 0) {
      Taro.showToast({ title: '请至少添加一个步骤', icon: 'none' })
      return
    }
    if (!orderId) {
      Taro.showToast({ title: '订单ID缺失', icon: 'none' })
      return
    }

    try {
      const stepsWithExtConfig = steps.map(step => ({
        ...step,
        extConfig: step.extConfig || STEP_EXT_CONFIG[step.type] || undefined,
      }))

      const res = await Network.request({
        url: `/api/order/${orderId}/task-steps`,
        method: 'POST',
        data: { steps: stepsWithExtConfig },
      })
      // Taro.hideLoading()

      const payload = res?.data
      if (payload?.code === 200) {
        // 直接显示支付弹窗，不再更新订单
        const newPriceInfo = calculatePrice()
        setPriceInfo(newPriceInfo)
        setShowPayModal(true)
      } else {
        Taro.showToast({ title: payload?.message || '保存步骤失败', icon: 'none' })
      }
    } catch (e) {
      // Taro.hideLoading()
      console.error('[步骤保存] 错误:', e)
      Taro.showToast({ title: '保存步骤失败', icon: 'none' })
    }
  }

  const handleCustomBasePriceChange = () => {
    const currentValue = customBasePriceInput ? parseFloat(customBasePriceInput) : basePricePerUnit
    const modalOptions: Record<string, any> = {
      title: '自定义基础费用',
      editable: true,
      placeholderText: `最低¥${basePricePerUnit.toFixed(2)}`,
      defaultValue: currentValue.toString(),
      success: (res: any) => {
        if (res.confirm && res.content) {
          const contentValue = res.content.trim()
          const newValue = parseFloat(contentValue)
          if (!Number.isNaN(newValue) && newValue >= basePricePerUnit && newValue > 0) {
            setCustomBasePriceInput(newValue.toString())
            const newPriceInfo = calculatePrice()
            setPriceInfo(newPriceInfo)
          } else {
            Taro.showToast({ title: `请输入大于等于¥${basePricePerUnit.toFixed(2)}的有效金额`, icon: 'none' })
          }
        }
      },
    }
    Taro.showModal(modalOptions)
  }

  const repayAndNavigate = async (targetOrderId: string, openid: string) => {
    if (!openid) {
      Taro.showToast({ title: '请重新进入页面再试', icon: 'none' })
      return
    }
    if (repayInFlightRef.current) return
    repayInFlightRef.current = true
    try {
      Taro.showLoading({ title: '创建支付...' })
      const res = await Network.request({
        url: `/api/order/${targetOrderId}/repay`,
        method: 'POST',
        data: { openid },
        dedupKey: `order:repay:${targetOrderId}`,
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
          Taro.navigateTo({ url: `/package-order/pages/order-asset-waiting/index?orderId=${targetOrderId}` })
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

  const handlePayConfirm = async () => {
    try {
      Taro.showLoading({ title: '创建支付...', mask: true })

      let openid = ''
      try {
        const loginRes = await Taro.login()
        if (loginRes.code) {
          const openidRes = await Network.request({
            url: '/api/user/openid',
            method: 'GET',
            data: { code: loginRes.code },
          })
          openid = openidRes?.data?.data?.openid || ''
        }
      } catch (e) {
        console.warn('[获取openid] 失败:', e)
      }

      const updateRes = await Network.request({
        url: `/api/order/${orderId}`,
        method: 'PUT',
        data: {
          status: 'pending_payment',
          base_price: priceInfo.basePrice,
          total_price: priceInfo.totalPrice,
          price: priceInfo.baseUnit,
          custom_base_price: priceInfo.baseUnit,
        },
      })

      if (updateRes.data?.code !== 200) {
        Taro.hideLoading()
        Taro.showToast({ title: '更新订单失败', icon: 'none' })
        return
      }

      const payRes = await Network.request({
        url: `/api/order/${orderId}/repay`,
        method: 'POST',
        data: { openid },
      })

      Taro.hideLoading()

      if (payRes.data?.code === 200 && payRes.data.data?.payment) {
        const payment = payRes.data.data.payment
        try {
          await Taro.requestPayment({
            timeStamp: payment.timeStamp,
            nonceStr: payment.nonceStr,
            package: payment.packageValue,
            signType: payment.signType || 'MD5',
            paySign: payment.paySign,
          })
          Taro.showToast({ title: '支付成功', icon: 'success' })
          setShowPayModal(false)
          setTimeout(() => {
            Taro.navigateTo({ url: `/package-order/pages/order-asset-waiting/index?orderId=${orderId}` })
          }, 1500)
        } catch (payErr: any) {
          console.warn('[支付] 结果:', payErr)
          const errMsg = String(payErr?.errMsg || payErr?.message || '')
          if (errMsg.includes('cancel') || errMsg.includes('取消')) {
            // Taro.showToast({ title: '支付已取消', icon: 'none' })
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
            // Taro.showToast({ title: '支付失败，请稍后重试', icon: 'none' })
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
        Taro.showToast({ title: payRes.data?.message || '创建支付失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[支付] 错误:', e)
      Taro.showToast({ title: '支付失败', icon: 'none' })
    }
  }

  const addedMaterialTypes = useMemo(() => {
    const types = new Set<string>()
    steps.forEach(step => {
      if (step.group === '发布素材' || ['material_text', 'material_image', 'material_video'].includes(step.type)) {
        types.add(step.type)
      }
    })
    return types
  }, [steps])

  const dynamicStepGroups = useMemo(() => {
    const materialItems = getMaterialItemsByContentType(contentType)
    const groups = [...STEP_GROUPS]
    const materialGroupIndex = groups.findIndex(g => g.title === '发布素材')
    if (materialGroupIndex !== -1) {
      if (materialItems.length === 0) {
        groups.splice(materialGroupIndex, 1)
      } else {
        const remainingItems = materialItems.filter(item => !addedMaterialTypes.has(item.type))
        if (remainingItems.length === 0) {
          groups.splice(materialGroupIndex, 1)
        } else {
          groups[materialGroupIndex] = { ...groups[materialGroupIndex], items: remainingItems }
        }
      }
    }
    return groups
  }, [contentType, addedMaterialTypes])

  const persistSteps = (nextSteps: StepItem[]) => {
    setSteps(nextSteps)
    Taro.setStorageSync(storageKey, nextSteps)
  }
  const editStep = (step: StepItem) => {
    setEditingStepId(step.id)
    setModalGroup(step.group)
    setModalLabel(step.label)
    setModalDescription(step.description || '')
    setModalType(step.type)

    if (step.data) {
      setModalUrl(step.data.url || '')
      setModalImage(step.data.image || '')
      setModalVideo(step.data.video || '')
      setModalCopyData(step.data.copyData || '')
      setModalExampleText(step.data.exampleText || '')
      setModalMaterials(step.data.materials || [])
      setModalMaterialInput('')
      setModalDistributeMode(step.data.distributeMode || 'shared')
      setModalUseAiMaterial(step.data.useAiMaterial ?? true)
      setModalAiPrompt(step.data.aiPrompt || '')
    } else {
      setModalUrl('')
      setModalImage('')
      setModalVideo('')
      setModalCopyData('')
      setModalExampleText('')
      setModalMaterials([])
      setModalMaterialInput('')
      setModalDistributeMode('shared')
      setModalUseAiMaterial(true)
      setModalAiPrompt('')
    }
    setShowModal(true)
  }

  const addStep = (group: string, item: { label: string; type: string }) => {
    setEditingStepId(null)
    setModalGroup(group)
    setModalLabel(item.label)
    setModalType(item.type)
    setModalDescription('')
    setModalUrl('')
    setModalImage('')
    setModalVideo('')
    setModalCopyData('')
    setModalExampleText('')
    setModalMaterials([])
    setModalMaterialInput('')
    setModalDistributeMode('shared')
    setModalUseAiMaterial(true)
    setModalAiPrompt('')
    setShowSheet(false)
    setShowModal(true)
  }

  const handleModalConfirm = () => {
    const data: StepItem['data'] = {}

    if (modalType === 'input_url') {
      if (!modalUrl.trim()) {
        Taro.showToast({ title: '请输入网址', icon: 'none' })
        return
      }
      if (!isValidUrl(modalUrl.trim())) {
        Taro.showToast({ title: '请输入正确的网址', icon: 'none' })
        return
      }
      data.url = modalUrl.trim()
    } else if (modalType === 'upload_qrcode') {
      if (!modalImage) {
        Taro.showToast({ title: '请上传二维码图片', icon: 'none' })
        return
      }
      data.image = modalImage
    } else if (modalType === 'text_instruction') {
      if (!modalDescription.trim()) {
        Taro.showToast({ title: '请输入说明', icon: 'none' })
        return
      }
    } else if (modalType === 'image_instruction') {
      if (!modalImage) {
        Taro.showToast({ title: '请上传说明图片', icon: 'none' })
        return
      }
      data.image = modalImage
    } else if (modalType === 'video_instruction') {
      if (!modalVideo) {
        Taro.showToast({ title: '请上传视频', icon: 'none' })
        return
      }
      data.video = modalVideo
    } else if (modalType === 'copy_data') {
      if (!modalCopyData.trim()) {
        Taro.showToast({ title: '请填写数据', icon: 'none' })
        return
      }
      data.copyData = modalCopyData.trim()
    } else if (modalType === 'collect_image') {
      if (!modalImage) {
        Taro.showToast({ title: '请上传图片示例', icon: 'none' })
        return
      }
      data.exampleImage = modalImage
    } else if (modalType === 'collect_info') {
      if (!modalExampleText.trim()) {
        Taro.showToast({ title: '请输入信息示例', icon: 'none' })
        return
      }
      data.exampleText = modalExampleText.trim()
    } else if (modalType === 'collect_url') {
      if (!modalUrl.trim()) {
        Taro.showToast({ title: '请输入链接地址', icon: 'none' })
        return
      }
      if (!isValidUrl(modalUrl.trim())) {
        Taro.showToast({ title: '请输入正确的链接地址', icon: 'none' })
        return
      }
      data.exampleUrl = modalUrl.trim()
    } else if (modalType === 'material_text' || modalType === 'material_image' || modalType === 'material_video') {
      if (!modalUseAiMaterial && modalMaterials.length === 0) {
        Taro.showToast({ title: '请至少添加一个素材', icon: 'none' })
        return
      }
      data.materials = modalMaterials
      data.distributeMode = modalDistributeMode
      if (modalType === 'material_text') {
        data.useAiMaterial = modalUseAiMaterial
        if (modalUseAiMaterial && modalAiPrompt.trim()) {
          data.aiPrompt = modalAiPrompt.trim()
        }
      }
    }

    let nextSteps: StepItem[]
    if (editingStepId) {
      nextSteps = steps.map(step => {
        if (step.id === editingStepId) {
          return {
            ...step,
            group: modalGroup,
            label: modalLabel,
            type: modalType,
            description: modalDescription,
            data: Object.keys(data).length > 0 ? data : undefined,
            extConfig: STEP_EXT_CONFIG[modalType] || undefined,
          }
        }
        return step
      })
    } else {
      nextSteps = [
        ...steps,
        {
          id: `step_${Date.now()}_${steps.length}`,
          group: modalGroup,
          label: modalLabel,
          type: modalType,
          description: modalDescription,
          data: Object.keys(data).length > 0 ? data : undefined,
          extConfig: STEP_EXT_CONFIG[modalType] || undefined,
        },
      ]
    }
    persistSteps(nextSteps)
    setShowModal(false)
    setEditingStepId(null)
  }

  const handleChooseImage = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      if (!res.tempFilePaths.length) return

      Taro.showLoading({ title: '上传中...', mask: true })
      const result = await Network.uploadFile({ url: '/api/upload/image', filePath: res.tempFilePaths[0], name: 'file' })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try {
          uploadData = JSON.parse(uploadData)
        } catch {
          uploadData = null
        }
      }

      if (uploadData?.code === 200 && uploadData?.data?.url) {
        setModalImage(uploadData.data.url)
      } else {
        Taro.showToast({ title: '图片上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[图片上传] 错误:', e)
      Taro.showToast({ title: '图片上传失败', icon: 'none' })
    }
  }

  const handleChooseVideo = async () => {
    try {
      const res = await Taro.chooseVideo({ sourceType: ['album', 'camera'], compressed: true })
      if (!res.tempFilePath) return

      if (res.size > 50 * 1024 * 1024) {
        Taro.showToast({ title: '视频大小不能超过50MB', icon: 'none' })
        return
      }

      Taro.showLoading({ title: '上传中...', mask: true })

      const result = await Network.uploadFile({
        url: '/api/upload/video',
        filePath: res.tempFilePath,
        name: 'file',
        timeout: 120000
      })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try {
          uploadData = JSON.parse(uploadData)
        } catch {
          uploadData = null
        }
      }

      if (uploadData?.code === 200 && uploadData?.data?.url) {
        setModalVideo(uploadData.data.url)
      } else {
        Taro.showToast({ title: '视频上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[视频上传] 错误:', e)
      Taro.showToast({ title: '视频上传失败', icon: 'none' })
    }
  }

  const removeStep = (id: string) => {
    persistSteps(steps.filter((item) => item.id !== id))
  }

  const handleAddMaterialText = () => {
    if (!modalMaterialInput.trim()) {
      Taro.showToast({ title: '请输入素材内容', icon: 'none' })
      return
    }
    if (modalMaterials.length >= 20) {
      Taro.showToast({ title: '最多只能添加20个素材', icon: 'none' })
      return
    }
    setModalMaterials(prev => [...prev, { type: 'text', content: modalMaterialInput.trim() }])
    setModalMaterialInput('')
  }

  const handleAddMaterialImage = async () => {
    if (modalMaterials.length >= 20) {
      Taro.showToast({ title: '最多只能添加20个素材', icon: 'none' })
      return
    }
    try {
      const remaining = 20 - modalMaterials.length
      const res = await Taro.chooseMedia({
        count: Math.min(9, remaining),
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      if (!res.tempFiles?.length) return

      Taro.showLoading({ title: '上传中...', mask: true })
      const newMaterials: { type: 'image'; content: string }[] = []
      for (const media of res.tempFiles) {
        try {
          const result = await Network.uploadFile({ url: '/api/upload/image', filePath: media.tempFilePath, name: 'file' })
          let uploadData: any = result?.data
          if (typeof uploadData === 'string') {
            try { uploadData = JSON.parse(uploadData) } catch { uploadData = null }
          }
          if (uploadData?.code === 200 && uploadData?.data?.url) {
            newMaterials.push({ type: 'image', content: uploadData.data.url })
          }
        } catch (e) { console.error('[图片上传] 错误:', e) }
      }
      Taro.hideLoading()
      if (newMaterials.length > 0) {
        setModalMaterials(prev => [...prev, ...newMaterials])
      }
      if (newMaterials.length < res.tempFiles.length) {
        Taro.showToast({ title: '部分图片上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[图片上传] 错误:', e)
    }
  }

  const handleAddMaterialVideo = async () => {
    if (modalMaterials.length >= 20) {
      Taro.showToast({ title: '最多只能添加20个素材', icon: 'none' })
      return
    }
    try {
      const remaining = 20 - modalMaterials.length
      const res = await Taro.chooseMedia({
        count: Math.min(9, remaining),
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
      })
      if (!res.tempFiles?.length) return

      for (const media of res.tempFiles) {
        if (media.size > 50 * 1024 * 1024) {
          Taro.showToast({ title: '视频大小不能超过50MB', icon: 'none' })
          return
        }
      }

      Taro.showLoading({ title: '上传中...', mask: true })
      const newMaterials: { type: 'video'; content: string }[] = []
      for (let i = 0; i < res.tempFiles.length; i++) {
        const media = res.tempFiles[i]
        try {
          const result = await Network.uploadFile({
            url: '/api/upload/video',
            filePath: media.tempFilePath,
            name: 'file',
            timeout: 120000
          })
          let uploadData: any = result?.data
          if (typeof uploadData === 'string') {
            try { uploadData = JSON.parse(uploadData) } catch { uploadData = null }
          }
          if (uploadData?.code === 200 && uploadData?.data?.url) {
            newMaterials.push({ type: 'video', content: uploadData.data.url })
          }
        } catch (e) { console.error('[视频上传] 错误:', e) }
      }
      Taro.hideLoading()
      if (newMaterials.length > 0) {
        setModalMaterials(prev => [...prev, ...newMaterials])
      }
      if (newMaterials.length < res.tempFiles.length) {
        Taro.showToast({ title: '部分视频上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[视频上传] 错误:', e)
    }
  }

  const handleRemoveMaterial = (index: number) => {
    setModalMaterials(prev => prev.filter((_, i) => i !== index))
  }

  const handlePreview = () => {
    if (steps.length === 0) {
      Taro.showToast({ title: '请先添加步骤', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/package-order/pages/order-step-preview/index?orderId=${orderId}`,
    })
  }

  const getModalTitle = () => {
    if (modalType === 'input_url') return '输入网址'
    if (modalType === 'upload_qrcode') return '传二维码'
    if (modalType === 'text_instruction') return '文字说明'
    if (modalType === 'image_instruction') return '图文说明'
    if (modalType === 'video_instruction') return '视频说明'
    if (modalType === 'copy_data') return '复制数据'
    if (modalType === 'collect_image') return '收集截图'
    if (modalType === 'collect_info') return '收集信息'
    if (modalType === 'collect_url') return '收集链接'
    if (modalType === 'material_text') return '文字素材'
    if (modalType === 'material_image') return '图片素材'
    if (modalType === 'material_video') return '视频素材'
    return ''
  }

  return (
    <View className="step-page">
      <View className="step-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="step-header-decoration">
          <View className="step-deco-circle step-circle-1" />
          <View className="step-deco-circle step-circle-2" />
        </View>
        <View className="step-header-content">
          <View className="step-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="step-header-center">
            <Text className="step-header-title">发布任务</Text>
            <Text className="step-header-desc">AI分身帮你创作，省时省力出爆款</Text>
          </View>
        </View>
      </View>

      <View className="step-toolbar">
        {/* <View className="template-row" onClick={() => setSaveTemplate(!saveTemplate)}> */}
        <View className="template-row">
          {/* <Checkbox checked={saveTemplate} onCheckedChange={setSaveTemplate} /> */}
          <Text className="template-text">设置步骤</Text>
        </View>
        <Button className="add-step-btn" onClick={() => setShowSheet(true)}>
          <Plus size={14} color="#fff" />
          <Text className="add-step-text">添加步骤</Text>
        </Button>
      </View>

      <Text className="drag-hint">长按“≡”拖动可以调整顺序，左滑删除</Text>

      <ScrollView scrollY className="step-content">
        {steps.length === 0 ? (
          <View className="empty-panel">
            <View className="empty-illustration">
              <View className="empty-paper paper-left" />
              <View className="empty-paper paper-main">
                <View className="paper-line short" />
                <View className="paper-line" />
                <View className="paper-line" />
                <View className="paper-line medium" />
              </View>
              <View className="empty-shadow" />
            </View>
            <Text className="empty-text">当前未添加步骤</Text>
          </View>
        ) : (
          <View className="step-list">
            {steps.map((step, index) => (
              <SwipeableStepCard
                key={step.id}
                step={step}
                index={index}
                onEdit={() => editStep(step)}
                onDelete={() => removeStep(step.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="step-bottom-bar">
        <Button variant="outline" className="preview-btn" onClick={handlePreview}>
          <Text className="preview-text">预览</Text>
        </Button>
        <Button className="publish-btn" onClick={handlePublish}>
          <Text className="publish-text">申请发布</Text>
        </Button>
      </View>

      {showSheet && (
        <View className="sheet-mask" onClick={() => setShowSheet(false)}>
          <View className="sheet-panel" onClick={(event) => event.stopPropagation()}>
            <View className="sheet-header">
              <Text className="sheet-title">添加步骤</Text>
              <View className="sheet-close" onClick={() => setShowSheet(false)}>
                <X size={18} color="#64748b" />
              </View>
            </View>
            <ScrollView scrollY className="sheet-body">
              {dynamicStepGroups.map((group) => (
                <View key={group.title} className="sheet-group">
                  <Text className="sheet-group-title">{group.title}</Text>
                  <View className="sheet-options">
                    {group.items.map((item) => (
                      <View key={item.label} className="sheet-option" onClick={() => addStep(group.title, item)}>
                        {/* <View className="sheet-option-icon">
                          <Check size={12} color="#1677ff" />
                        </View> */}
                        <Text className="sheet-option-text">{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {showModal && (
        <View className="step-modal-mask" onClick={() => setShowModal(false)}>
          <View className="step-modal-panel" onClick={(e) => e.stopPropagation()}>
            <View className="step-modal-header">
              <Text className="step-modal-title">{getModalTitle()}</Text>
              <View className="step-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} color="#64748b" />
              </View>
            </View>
            <ScrollView scrollY className="step-modal-body">
              <View className="step-modal-form">
                {(modalType === 'material_text' || modalType === 'material_image' || modalType === 'material_video') && (
                  <View className="step-modal-field">
                    <View className="step-modal-field-row">
                      <Text className="step-modal-field-label">分身数量：</Text>
                      <Text className="step-modal-field-value">{priceInfo.avatarCount}</Text>
                    </View>
                  </View>
                )}
                <View className="step-modal-field">
                  <Text className="step-modal-field-label">步骤说明</Text>
                  <Textarea
                    className="step-modal-textarea"
                    placeholder="请输入说明..."
                    value={modalDescription}
                    onInput={(e) => setModalDescription(e.detail.value)}
                    maxlength={500}
                  />
                </View>

                {(modalType === 'input_url' || modalType === 'collect_url') && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">
                      {modalType === 'input_url' ? '输入网址' : '链接地址'}
                    </Text>
                    <View className="step-modal-input-wrap">
                      <Input
                        className="step-modal-input"
                        placeholder={modalType === 'input_url' ? '请输入网址' : '请输入链接地址'}
                        value={modalUrl}
                        onInput={(e) => setModalUrl(e.detail.value)}
                      />
                    </View>
                  </View>
                )}

                {(modalType === 'upload_qrcode' || modalType === 'image_instruction' || modalType === 'collect_image') && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">
                      {modalType === 'upload_qrcode' ? '二维码图' : modalType === 'image_instruction' ? '图文说明' : '图片示例'}
                    </Text>
                    <View className="step-modal-image-picker" onClick={handleChooseImage}>
                      {modalImage ? (
                        <Image src={modalImage} className="step-modal-image-preview" mode="aspectFill" />
                      ) : (
                        <View className="step-modal-image-placeholder">
                          <ImageIcon size={40} color="#9ca3af" />
                          <Text className="step-modal-image-placeholder-text">选择图片</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {modalType === 'video_instruction' && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">视频</Text>
                    <View className="step-modal-video-picker" onClick={handleChooseVideo}>
                      {modalVideo ? (
                        <Video src={modalVideo} className="step-modal-video-preview" controls />
                      ) : (
                        <View className="step-modal-video-placeholder">
                          <VideoIcon size={40} color="#9ca3af" />
                          <Text className="step-modal-video-placeholder-text">选择视频</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {modalType === 'copy_data' && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">填写数据</Text>
                    <View className="step-modal-input-wrap">
                      <Input
                        className="step-modal-input"
                        placeholder="请输入要复制的数据"
                        value={modalCopyData}
                        onInput={(e) => setModalCopyData(e.detail.value)}
                      />
                    </View>
                  </View>
                )}

                {modalType === 'collect_info' && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">信息示例</Text>
                    <View className="step-modal-input-wrap">
                      <Input
                        className="step-modal-input"
                        placeholder="请输入信息示例"
                        value={modalExampleText}
                        onInput={(e) => setModalExampleText(e.detail.value)}
                      />
                    </View>
                  </View>
                )}
                {(modalType === 'material_text') && (
                  <View className="step-modal-field">
                    <View className="step-modal-field-header">
                      <Text className="step-modal-field-label">素材列表</Text>
                      <View
                        className={`material-ai-switch ${modalUseAiMaterial ? '' : 'active'}`}
                        onClick={() => setModalUseAiMaterial(!modalUseAiMaterial)}
                      >
                        <View className={`material-ai-switch-dot ${modalUseAiMaterial ? '' : 'active'}`} />
                      </View>
                    </View>

                    {/* AI 生成模式：显示参考提示词输入框 */}
                    {modalUseAiMaterial && (
                      <View className="material-ai-toggle-row">
                        <View className="material-ai-toggle-left">
                          <Sparkles size={14} color="#8B5CF6" />
                          <Text className="material-ai-toggle-label">AI分身时自动生成文案内容，无需手动上传</Text>
                        </View>
                      </View>
                    )}
                    {modalUseAiMaterial && (
                      <View className="material-prompt-row">
                        <Text className="material-prompt-label">参考提示词</Text>
                        <Input
                          className="step-modal-input material-prompt-input"
                          placeholder="输入参考提示词，AI将基于此生成素材内容"
                          value={modalAiPrompt}
                          onInput={(e) => setModalAiPrompt(e.detail.value)}
                        />
                      </View>
                    )}

                    {/* 自定义模式：显示素材列表 */}
                    {!modalUseAiMaterial && (<View className="material-ai-toggle-row">
                      <View className="material-ai-toggle-left">
                        <Sparkles size={14} color="#8B5CF6" />
                        <Text className="material-ai-toggle-label">自定义素材</Text>
                      </View>

                      <Text className="material-ai-toggle-hint">
                        {modalMaterials.length === 0 ? '可选，最多上传20个素材' : `已选${modalMaterials.length}个素材，还可上传${20 - modalMaterials.length}个素材`}
                      </Text>
                    </View>)}

                    {!modalUseAiMaterial && (
                      <>
                        {/* 已上传素材缩略图网格 */}
                        {modalMaterials.length > 0 && (
                          <View className="material-upload-grid">
                            {modalMaterials.map((material, idx) => (
                              <View key={idx} className="material-preview-item">
                                <View className="material-preview-text-wrap">
                                  <Text className="material-preview-text" numberOfLines={3}>{material.content}</Text>
                                </View>
                                <View
                                  className="material-remove-btn"
                                  onClick={() => handleRemoveMaterial(idx)}
                                >
                                  <X size={12} color="#fff" />
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* 操作按钮行 */}
                        <View className="material-action-row">
                          <View className="material-input-row">
                            <Input
                              className="step-modal-input material-input"
                              placeholder="请输入素材内容"
                              value={modalMaterialInput}
                              onInput={(e) => setModalMaterialInput(e.detail.value)}
                              onConfirm={handleAddMaterialText}
                            />
                            <View className="material-add-text-btn" onClick={handleAddMaterialText}>
                              <Plus size={14} color="#6366F1" />
                              <Text className="material-add-text-btn-text">添加文字</Text>
                            </View>
                          </View>
                        </View>

                        {/* 素材分配模式 */}
                        <View className="material-distribute-row">
                          <View className="material-distribute-left">
                            <Users size={14} color="#1890ff" />
                            <Text className="material-distribute-label">素材分配</Text>
                          </View>
                          <View className="material-distribute-toggle">
                            <View
                              className={`material-distribute-opt ${modalDistributeMode === 'shared' ? 'active' : ''}`}
                              onClick={() => setModalDistributeMode('shared')}
                            >
                              <Text className={`material-distribute-opt-text ${modalDistributeMode === 'shared' ? 'active' : ''}`}>共享</Text>
                            </View>
                            <View
                              className={`material-distribute-opt ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}
                              onClick={() => setModalDistributeMode('exclusive')}
                            >
                              <Text className={`material-distribute-opt-text ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}>独占</Text>
                            </View>
                          </View>
                        </View>
                        <View className="material-mode-hint">
                          <Text className="material-mode-hint-text">
                            {modalDistributeMode === 'shared' ? '共享模式：所有分身使用相同的素材' : '独占模式：每个分身分配不同素材'}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {(modalType === 'material_image' || modalType === 'material_video') && (
                  <View className="step-modal-field">
                    <View className="step-modal-field-header">
                      <Text className="step-modal-field-label">素材列表</Text>
                      <Text className="step-modal-field-count">
                        {modalMaterials.length === 0 ? '可选，最多上传20个素材' : `已选${modalMaterials.length}个素材，还可上传${20 - modalMaterials.length}个素材`}
                      </Text>
                    </View>

                    {/* 已上传素材缩略图网格 */}
                    {modalMaterials.length > 0 && (
                      <View className="material-upload-grid">
                        {modalMaterials.map((material, idx) => (
                          <View key={idx} className="material-preview-item">
                            {material.type === 'video' ? (
                              <View className="material-preview-video-wrap" onClick={() => Taro.previewMedia({ sources: [{ url: material.content, type: 'video' }], current: 0 })}>
                                <Video
                                  src={material.content}
                                  className="material-preview-video"
                                  muted
                                  autoplay={false}
                                  showPlayBtn={false}
                                  showFullscreenBtn={false}
                                  showCenterPlayBtn={false}
                                  controls={false}
                                  objectFit="cover"
                                />
                                <View className="material-video-play-icon">
                                  <Play size={20} color="#fff" filled />
                                </View>
                                <Text className="material-video-label">视频</Text>
                              </View>
                            ) : material.type === 'image' ? (
                              <Image src={material.content} className="material-preview-img" mode="aspectFill" />
                            ) : (
                              <View className="material-preview-text-wrap">
                                <Text className="material-preview-text" numberOfLines={3}>{material.content}</Text>
                              </View>
                            )}
                            <View
                              className="material-remove-btn"
                              onClick={() => handleRemoveMaterial(idx)}
                            >
                              <X size={12} color="#fff" />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 操作按钮行 */}
                    <View className="material-action-row">
                      <View
                        className="material-add-main"
                        onClick={modalType === 'material_image' ? handleAddMaterialImage : modalType === 'material_video' ? handleAddMaterialVideo : handleAddMaterialImage}
                      >
                        <Plus size={16} color="#6366F1" />
                        <Text className="material-add-main-text">
                          {modalType === 'material_video' ? '添加视频' : modalType === 'material_image' ? '添加图片' : '添加图片/视频'}
                        </Text>
                      </View>
                      {/* <View className="material-ai-btn" onClick={handleAiGenerateMaterial}>
                        <Text className="material-ai-btn-text">AI生成</Text>
                      </View> */}
                    </View>

                    {/* 素材分配模式 */}
                    <View className="material-distribute-row">
                      <View className="material-distribute-left">
                        <Users size={14} color="#1890ff" />
                        <Text className="material-distribute-label">素材分配</Text>
                      </View>
                      <View className="material-distribute-toggle">
                        <View
                          className={`material-distribute-opt ${modalDistributeMode === 'shared' ? 'active' : ''}`}
                          onClick={() => setModalDistributeMode('shared')}
                        >
                          <Text className={`material-distribute-opt-text ${modalDistributeMode === 'shared' ? 'active' : ''}`}>共享</Text>
                        </View>
                        <View
                          className={`material-distribute-opt ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}
                          onClick={() => setModalDistributeMode('exclusive')}
                        >
                          <Text className={`material-distribute-opt-text ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}>独占</Text>
                        </View>
                      </View>
                    </View>
                    <View className="material-mode-hint">
                      <Text className="material-mode-hint-text">
                        {modalDistributeMode === 'shared' ? '共享模式：所有分身使用相同的素材' : '独占模式：每个分身分配不同素材'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
            <View className="step-modal-footer">
              <Button className="step-modal-confirm" onClick={handleModalConfirm}>
                <Text className="step-modal-confirm-text">确定</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {showPayModal && (
        <View className="pay-modal-mask" onClick={() => setShowPayModal(false)}>
          <View className="pay-modal-panel" onClick={(e) => e.stopPropagation()}>
            <View className="pay-modal-header">
              <Text className="pay-modal-title">确认发布</Text>
              <View className="pay-modal-close" onClick={() => setShowPayModal(false)}>
                <X size={18} color="#64748b" />
              </View>
            </View>
            <ScrollView scrollY className="pay-modal-body">
              <View className="price-card">
                <View className="price-header">
                  <Coins size={16} color="#F59E0B" />
                  <Text className="price-header-text">费用预估</Text>
                </View>
                <View className="price-row-container">
                  <View className="price-row">
                    <Text className="price-label">基础费用</Text>
                    <Text className="price-value">¥{priceInfo.basePrice.toFixed(2)}</Text>
                  </View>
                  <View className="price-label-detail-row">
                    <Text className="price-label-detail">¥{(customBasePriceInput ? Math.max(parseFloat(customBasePriceInput), basePricePerUnit) : basePricePerUnit).toFixed(2)}</Text>
                    <View className="price-edit-btn" onClick={handleCustomBasePriceChange}>
                      <Pencil size={12} color="#6366F1" />
                      {/* <Text className="price-edit-text">调整</Text> */}
                    </View>
                    <Text className="price-label-detail"> × {priceInfo.avatarCount}个接单数量</Text>
                  </View>
                </View>
                <View className="price-divider" />
                <View className="price-row total">
                  <Text className="price-label">合计</Text>
                  <Text className="price-value">¥{priceInfo.totalPrice.toFixed(2)}</Text>
                </View>
              </View>
              <View className="pay-modal-tips">
                <Text className="pay-modal-tip-item">• 发布后将提交审核</Text>
                <Text className="pay-modal-tip-item">• 请确保任务步骤完整清晰</Text>
              </View>
            </ScrollView>
            <View className="pay-modal-footer">
              <Button variant="outline" className="pay-modal-cancel" onClick={() => setShowPayModal(false)}>
                <Text className="pay-modal-cancel-text">取消</Text>
              </Button>
              <Button className="pay-modal-confirm" onClick={handlePayConfirm}>
                <Text className="pay-modal-confirm-text">确认支付 ¥{priceInfo.totalPrice.toFixed(2)}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

interface SwipeableStepCardProps {
  step: StepItem
  index: number
  onEdit: () => void
  onDelete: () => void
}

function SwipeableStepCard({ step, index, onEdit, onDelete }: SwipeableStepCardProps) {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)

  const deleteBtnWidth = 140

  const onTouchStart = (e: any) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = translateX
    setIsDragging(true)
  }

  const onTouchMove = (e: any) => {
    if (!isDragging) return
    const diff = e.touches[0].clientX - startXRef.current
    let newTranslate = currentXRef.current + diff
    if (newTranslate > 0) newTranslate = 0
    if (newTranslate < -deleteBtnWidth) newTranslate = -deleteBtnWidth
    setTranslateX(newTranslate)
  }

  const onTouchEnd = () => {
    setIsDragging(false)
    if (translateX < -deleteBtnWidth / 2) {
      setTranslateX(-deleteBtnWidth)
    } else {
      setTranslateX(0)
    }
  }

  return (
    <View className="swipe-card-wrapper">
      <View className="swipe-card-delete" onClick={onDelete}>
        <Text className="swipe-card-delete-text">删除</Text>
      </View>
      <View
        className="swipe-card-content"
        style={{ transform: `translateX(${translateX}rpx)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onEdit}
      >
        <View className="step-drag">
          <GripVertical size={18} color="#9ca3af" />
        </View>
        <View className="step-index">
          <Text className="step-index-text">{index + 1}</Text>
        </View>
        <View className="step-info">
          <Text className="step-name">【{step.label}】{truncateStr(step.description, 8)}</Text>
          {/* <Text className="step-group">{step.group}</Text> */}
          {/* {step.description && (
            <Text className="step-desc">{truncateStr(step.description, 20)}</Text>
          )} */}
        </View>
      </View>
    </View>
  )
}
