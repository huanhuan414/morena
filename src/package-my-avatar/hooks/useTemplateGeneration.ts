import { useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * prompt_variables_json 中单个变量的结构（与 web 后台一致）
 * type 为中文枚举：单行文本 | 多行文本 | 下拉选择 | 单选 | 多选
 */
export type PromptVariable = {
  key: string
  name: string
  type: '单行文本' | '多行文本' | '下拉选择' | '单选' | '多选'
  required: boolean
  options?: string[]
}

export type TemplateDetail = {
  id: number
  templateName: string
  templateDescription: string
  coverUrl: string
  skillType: string
  tags: string[]
  promptText: string
  promptVariables: PromptVariable[]
  materialConfig: {
    enabled: boolean
    max_count: number
    max_size_mb: number
    allowed_types: string[]
  } | null
  creatorIncomePoints: number
  useCount: number
  modelApi: {
    id: number
    modelName: string
    providerName: string
    description: string
    iconUrl: string
    modelCostPoints: number
  } | null
}

/**
 * 模板生成共享逻辑 Hook
 * 供"技能认证页"和"模版使用页"复用：加载详情、管理表单、积分校验、图片上传、跳转结果
 */
export function useTemplateGeneration() {
  const [templateId, setTemplateId] = useState<number>(0)
  const [avatarId, setAvatarId] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<TemplateDetail | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [userBalance, setUserBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  /** 加载模板详情 */
  const loadDetail = useCallback(async (tplId: number) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/ai-avatar/templates/${tplId}/detail`,
      })
      const data = (res.data as any)?.data
      if (data) {
        setDetail(data)
        setFormValues({})
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  /** 初始化：解析页面参数并加载数据 */
  const init = useCallback((options: Record<string, string | undefined>) => {
    const tplId = Number(options?.templateId || 0)
    const avId = Number(options?.avatarId || 0)
    if (tplId > 0) {
      setTemplateId(tplId)
      void loadDetail(tplId)
    }
    if (avId > 0) setAvatarId(avId)
  }, [loadDetail])

  /** 更新表单值 */
  const updateFormValue = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
  }

  /** 切换多选值 */
  const toggleMultiSelectValue = (key: string, option: string) => {
    const current = formValues[key] || ''
    const selected = current ? current.split('、') : []
    const idx = selected.indexOf(option)
    if (idx >= 0) {
      selected.splice(idx, 1)
    } else {
      selected.push(option)
    }
    updateFormValue(key, selected.join('、'))
  }

  /** 格式化使用次数 */
  const formatUseCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}w`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count || 0)
  }

  /** 查询当前用户积分余额 */
  const fetchBalance = async (): Promise<number> => {
    const userInfo = Taro.getStorageSync('userInfo')
    const userId = userInfo?.id || userInfo?.userId || ''
    if (!userId) return 0
    try {
      const res = await Network.request({ url: `/api/coin/balance?userId=${userId}` })
      return Number((res.data as any)?.data?.balance ?? 0)
    } catch {
      return 0
    }
  }

  /** 校验表单必填项 */
  const validateForm = (): boolean => {
    if (!detail) return false
    const vars = detail.promptVariables || []
    for (const v of vars) {
      if (v.required && !formValues[v.key]?.trim()) {
        Taro.showToast({ title: `请填写${v.name}`, icon: 'none' })
        return false
      }
    }
    return true
  }

  /** 点击提交 → 校验表单 → 弹出积分确认弹框（若免费则直接跳转） */
  const handleSubmit = async (onNavigate: () => void) => {
    if (!detail) return
    if (!validateForm()) return

    const totalCost = (detail.modelApi?.modelCostPoints || 0) + (detail.creatorIncomePoints || 0)
    if (totalCost > 0) {
      setBalanceLoading(true)
      setUserBalance(null)
      setConfirmOpen(true)
      const balance = await fetchBalance()
      setUserBalance(balance)
      setBalanceLoading(false)
      return
    }

    onNavigate()
  }

  /** 构建跳转结果页所需的参数 */
  const buildResultParams = () => {
    if (!detail) return ''

    const materialValues: Record<string, string> = {}
    if (detail.materialConfig?.enabled) {
      materialValues.up_url = uploadedImageUrl || 'https://mrladmin.51webjs.com/static/image/10_10.png'
    }

    const filledPrompt = (detail.promptText || '').replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => formValues[key] ?? materialValues[key] ?? `{{${key}}}`
    )
    const encodedPrompt = encodeURIComponent(filledPrompt)
    const encodedParams = encodeURIComponent(JSON.stringify(formValues))
    const encodedMaterials = encodeURIComponent(JSON.stringify(materialValues))

    return `templateId=${templateId}&avatarId=${avatarId}&filledPrompt=${encodedPrompt}&inputParams=${encodedParams}&materialValues=${encodedMaterials}`
  }

  /** 选择并上传图片 */
  const handleChooseImage = async () => {
    if (uploading) return
    const maxSizeMb = detail?.materialConfig?.max_size_mb || 10
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const tempPath = chooseRes.tempFilePaths[0]
      if (!tempPath) return

      const fileInfo = await Taro.getFileInfo({ filePath: tempPath })
      if ((fileInfo as any).size > maxSizeMb * 1024 * 1024) {
        Taro.showToast({ title: `图片不能超过${maxSizeMb}MB`, icon: 'none' })
        return
      }

      setUploading(true)
      Taro.showLoading({ title: '上传中...' })
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/image',
        filePath: tempPath,
        name: 'file',
      })
      Taro.hideLoading()
      setUploading(false)

      const resData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      const imageUrl = resData?.data?.url || resData?.url || ''
      if (imageUrl) {
        setUploadedImageUrl(imageUrl)
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      setUploading(false)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    }
  }

  /** 删除已上传图片 */
  const handleRemoveImage = () => {
    setUploadedImageUrl('')
  }

  /** 计算合计费用 */
  const totalCost = (detail?.modelApi?.modelCostPoints || 0) + (detail?.creatorIncomePoints || 0)
  const insufficientBalance = userBalance !== null && userBalance < totalCost

  return {
    templateId,
    avatarId,
    loading,
    detail,
    formValues,
    uploadedImageUrl,
    uploading,
    confirmOpen,
    setConfirmOpen,
    userBalance,
    balanceLoading,
    totalCost,
    insufficientBalance,
    init,
    updateFormValue,
    toggleMultiSelectValue,
    formatUseCount,
    handleSubmit,
    buildResultParams,
    handleChooseImage,
    handleRemoveImage,
    validateForm,
  }
}
