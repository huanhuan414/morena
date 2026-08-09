import { useCallback, useState } from 'react'
import { View, Text, Image, Input, Textarea, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ArrowLeft, ChevronDown, FileText, ShieldCheck, Sparkles, Info } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

/**
 * prompt_variables_json 中单个变量的结构（与 web 后台一致）
 * type 为中文枚举：单行文本 | 多行文本 | 下拉选择 | 单选 | 多选
 */
type PromptVariable = {
  key: string
  name: string
  type: '单行文本' | '多行文本' | '下拉选择' | '单选' | '多选'
  required: boolean
  options?: string[]
}

type TemplateDetail = {
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

export default function SkillCertifyPage() {
  const statusBarHeight = getStatusBarHeight()
  const [templateId, setTemplateId] = useState<number>(0)
  const [avatarId, setAvatarId] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<TemplateDetail | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)

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

  useLoad((options) => {
    const tplId = Number(options?.templateId || 0)
    const avId = Number(options?.avatarId || 0)
    if (tplId > 0) {
      setTemplateId(tplId)
      void loadDetail(tplId)
    }
    if (avId > 0) setAvatarId(avId)
  })

  /** 更新表单值 */
  const updateFormValue = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
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

  /** 点击"立即使用并认证" → 校验表单 → 弹出积分确认弹框 */
  const handleSubmit = async () => {
    if (!detail) return

    const vars = detail.promptVariables || []
    for (const v of vars) {
      if (v.required && !formValues[v.key]?.trim()) {
        Taro.showToast({ title: `请填写${v.name}`, icon: 'none' })
        return
      }
    }

    const totalCost = (detail.modelApi?.modelCostPoints || 0) + (detail.creatorIncomePoints || 0)
    if (totalCost > 0) {
      const balance = await fetchBalance()
      if (balance < totalCost) {
        await Taro.showModal({
          title: '积分不足',
          content: `当前余额 ${balance} 积分，本次使用需要 ${totalCost} 积分`,
          showCancel: false,
          confirmText: '知道了',
        })
        return
      }

      const result = await Taro.showModal({
        title: '积分确认',
        content: `本次使用将消耗 ${totalCost} 积分（模型成本 ${detail.modelApi?.modelCostPoints || 0} + 创作者收益 ${detail.creatorIncomePoints || 0}），确认继续？`,
        confirmText: '确认使用',
        cancelText: '取消',
      })
      if (result.confirm) navigateToResult()
      return
    }

    navigateToResult()
  }

  /** 确认使用后跳转结果页 */
  const navigateToResult = () => {
    if (!detail) return

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
    Taro.navigateTo({
      url: `/package-my-avatar/pages/skill-certify-result/index?templateId=${templateId}&avatarId=${avatarId}&filledPrompt=${encodedPrompt}&inputParams=${encodedParams}&materialValues=${encodedMaterials}`,
    })
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

  /** 渲染表单项（与 web 后台调试弹框逻辑一致） */
  const renderFormItem = (variable: PromptVariable) => {
    const value = formValues[variable.key] || ''
    const requiredMark = variable.required
    const placeholder = `请输入${variable.name}`

    // 下拉选择 / 单选 → Picker
    if ((variable.type === '下拉选择' || variable.type === '单选') && variable.options?.length) {
      return (
        <View key={variable.key} className="sc-form-item">
          <Text className="sc-form-label">
            {variable.name}
            {!requiredMark && <Text className="sc-form-label-optional">（可选）</Text>}
          </Text>
          <Picker
            mode="selector"
            range={variable.options}
            value={variable.options.indexOf(value) >= 0 ? variable.options.indexOf(value) : 0}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              updateFormValue(variable.key, variable.options![idx])
            }}
          >
            <View className="sc-form-select">
              <Text className={`sc-form-select-text ${!value ? 'sc-form-select-placeholder' : ''}`}>
                {value || placeholder}
              </Text>
              <ChevronDown size={14} color="#9ca3af" />
            </View>
          </Picker>
        </View>
      )
    }

    // 多选 → checkbox 按钮组
    if (variable.type === '多选' && variable.options?.length) {
      const selectedArr = value ? value.split('、') : []
      return (
        <View key={variable.key} className="sc-form-item sc-form-item-multi">
          <Text className="sc-form-label">
            {variable.name}
            {!requiredMark && <Text className="sc-form-label-optional">（可选）</Text>}
          </Text>
          <View className="sc-multi-options">
            {variable.options.map(opt => (
              <View
                key={opt}
                className={`sc-multi-option ${selectedArr.includes(opt) ? 'active' : ''}`}
                onClick={() => toggleMultiSelectValue(variable.key, opt)}
              >
                <Text className="sc-multi-option-text">{opt}</Text>
              </View>
            ))}
          </View>
        </View>
      )
    }

    // 多行文本 → Textarea
    if (variable.type === '多行文本') {
      return (
        <View key={variable.key} className="sc-form-item sc-form-item-textarea">
          <Text className="sc-form-label">
            {variable.name}
            {!requiredMark && <Text className="sc-form-label-optional">（可选）</Text>}
          </Text>
          <View className="sc-form-textarea-wrap">
            <Textarea
              className="sc-form-textarea"
              placeholder={placeholder}
              value={value}
              onInput={(e) => updateFormValue(variable.key, e.detail.value)}
              maxlength={500}
              autoHeight
            />
          </View>
        </View>
      )
    }

    // 单行文本 / 默认 → Input
    return (
      <View key={variable.key} className="sc-form-item">
        <Text className="sc-form-label">
          {variable.name}
          {!requiredMark && <Text className="sc-form-label-optional">（可选）</Text>}
        </Text>
        <View className="sc-form-input-wrap">
          <Input
            className="sc-form-input"
            placeholder={placeholder}
            value={value}
            onInput={(e) => updateFormValue(variable.key, e.detail.value)}
          />
        </View>
      </View>
    )
  }

  return (
    <View className="sc-page">
      {/* 顶部导航 */}
      <View className="sc-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="sc-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#1a1a2e" />
        </View>
        <Text className="sc-header-title">技能认证</Text>
      </View>

      {loading ? (
        <View className="sc-loading">
          <Text className="sc-loading-text">加载中...</Text>
        </View>
      ) : detail ? (
        <>
          {/* 模板信息卡片 */}
          <View className="sc-template-card">
            <View className="sc-template-row">
              <View className="sc-template-icon">
                {detail.coverUrl ? (
                  <Image className="sc-template-icon-img" src={detail.coverUrl} mode="aspectFill" />
                ) : (
                  <FileText size={32} color="#10b981" />
                )}
              </View>
              <View className="sc-template-info">
                <View className="sc-template-name-row">
                  <Text className="sc-template-name">{detail.templateName}</Text>
                  <View className="sc-template-badge sc-badge-uncertified">
                    <Text>未认证</Text>
                  </View>
                </View>
                <Text className="sc-template-desc">{detail.templateDescription}</Text>
              </View>
            </View>
            <View className="sc-template-footer">
              <Text className="sc-template-usage">{formatUseCount(detail.useCount)} 人使用</Text>
            </View>
          </View>

          {/* 认证方式 */}
          <View className="sc-section">
            <View className="sc-section-title">
              <View className="sc-section-title-bar" />
              <Text className="sc-section-title-text">认证方式</Text>
            </View>
            <Text className="sc-cert-hint">体验并成功使用一次该技能，即可完成认证</Text>

            <View className="sc-steps">
              <View className="sc-step">
                <View className="sc-step-icon">
                  <FileText size={24} color="#7c3aed" />
                </View>
                <Text className="sc-step-num">1</Text>
                <Text className="sc-step-label">选择场景</Text>
              </View>
              <Text className="sc-step-arrow">→</Text>
              <View className="sc-step">
                <View className="sc-step-icon">
                  <Sparkles size={24} color="#7c3aed" />
                </View>
                <Text className="sc-step-num">2</Text>
                <Text className="sc-step-label">体验技能</Text>
              </View>
              <Text className="sc-step-arrow">→</Text>
              <View className="sc-step">
                <View className="sc-step-icon">
                  <ShieldCheck size={24} color="#7c3aed" />
                </View>
                <Text className="sc-step-num">3</Text>
                <Text className="sc-step-label">认证完成</Text>
              </View>
            </View>
          </View>

          {/* 体验设置（真实使用体验） */}
          <View className="sc-section">
            <View className="sc-section-title">
              <View className="sc-section-title-bar" />
              <Text className="sc-section-title-text">体验设置（真实使用体验）</Text>
            </View>

            {Array.isArray(detail.promptVariables) && detail.promptVariables.length > 0 ? (
              detail.promptVariables.map(v => renderFormItem(v))
            ) : (
              <Text style={{ fontSize: '26rpx', color: '#9ca3af', padding: '20rpx 0' }}>
                该模板暂无需要配置的参数
              </Text>
            )}

            {/* 上传附件区域（根据 materialConfig.enabled 动态显示） */}
            {detail.materialConfig?.enabled && (
              <View className="sc-form-item sc-form-item-upload">
                <View className="sc-form-label-group">
                  <Text className="sc-form-label">上传图片</Text>
                  <Text className="sc-form-label-optional">（可选）</Text>
                </View>
                {uploadedImageUrl ? (
                  <View className="sc-upload-preview">
                    <Image className="sc-upload-thumb" src={uploadedImageUrl} mode="widthFix" />
                    <View className="sc-upload-preview-actions">
                      <View className="sc-upload-action-btn sc-upload-action-replace" onClick={handleChooseImage}>
                        <Text className="sc-upload-action-text">{uploading ? '上传中...' : '重选'}</Text>
                      </View>
                      <View className="sc-upload-action-btn sc-upload-action-remove" onClick={handleRemoveImage}>
                        <Text className="sc-upload-action-text">删除</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="sc-upload-area" onClick={handleChooseImage}>
                    <View className="sc-upload-icon-circle">
                      <Text className="sc-upload-icon">+</Text>
                    </View>
                    <Text className="sc-upload-text">
                      {uploading ? '上传中...' : '点击上传图片'}
                    </Text>
                    <Text className="sc-upload-hint">
                      支持 JPG/PNG，最大 {detail.materialConfig.max_size_mb || 10}MB
                    </Text>
                    <Text className="sc-upload-hint">不上传将使用默认图片</Text>
                  </View>
                )}
              </View>
            )}

            <View className="sc-form-hint">
              <Info size={14} color="#9ca3af" />
              <Text className="sc-form-hint-text">
                这是一次真实的技能使用体验，生成的内容将基于你的输入自动生成，结果可直接查看。
              </Text>
            </View>
          </View>

          {/* 积分提示 */}
          {detail.modelApi && (
            <View className="sc-section">
              <View className="sc-section-title">
                <View className="sc-section-title-bar" />
                <Text className="sc-section-title-text">费用说明</Text>
              </View>
              <View className="sc-cost-info">
                <View className="sc-cost-row">
                  <Text className="sc-cost-label">模型成本</Text>
                  <Text className="sc-cost-value">{detail.modelApi.modelCostPoints} 积分</Text>
                </View>
                {detail.creatorIncomePoints > 0 && (
                  <View className="sc-cost-row">
                    <Text className="sc-cost-label">创作者收益</Text>
                    <Text className="sc-cost-value">{detail.creatorIncomePoints} 积分</Text>
                  </View>
                )}
                <View className="sc-cost-row sc-cost-total">
                  <Text className="sc-cost-label">合计</Text>
                  <Text className="sc-cost-value sc-cost-value-total">
                    {(detail.modelApi.modelCostPoints || 0) + (detail.creatorIncomePoints || 0)} 积分
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 底部按钮 */}
          <View className="sc-footer">
            <View className="sc-submit-btn" onClick={handleSubmit}>
              <Text className="sc-submit-btn-text">立即使用并认证</Text>
              <Sparkles size={18} color="#ffffff" />
            </View>
            <Text className="sc-footer-hint">完成一次成功生成后，该技能将自动标记为已认证</Text>
          </View>
        </>
      ) : (
        <View className="sc-loading">
          <Text className="sc-loading-text">模板信息加载失败</Text>
        </View>
      )}

    </View>
  )
}
