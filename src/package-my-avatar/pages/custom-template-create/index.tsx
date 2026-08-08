import { useCallback, useRef, useState } from 'react'
import { View, Text, Input, Textarea, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import {
  ArrowLeft, Plus, X, Check, Trash2, Pencil,
  Info, Cpu, Settings, FileText, Paperclip,
  ChevronDown, ImagePlus, Eye,
} from 'lucide-react-taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type StepKey = 1 | 2 | 3 | 4

const STEPS = [
  { key: 1 as StepKey, label: '基础信息' },
  { key: 2 as StepKey, label: '模型选择' },
  { key: 3 as StepKey, label: '参数设置' },
  { key: 4 as StepKey, label: '提示词模版' },
]

const VAR_TYPE_OPTIONS = ['单行文本', '多行文本', '下拉选择', '单选', '多选']
const MATERIAL_TYPE_OPTIONS = ['图片', '视频', '音频', '文档']


type PromptVariable = {
  key: string
  name: string
  type: string
  required: boolean
  placeholder?: string
  helpText?: string
  defaultValue?: string
  options?: string[]
}

type MaterialConfig = {
  enabled: boolean
  max_count: number
  allowed_types: string[]
  max_size_mb: number
}

type ModelApiOption = {
  id: number
  providerName: string
  modelName: string
  label: string
  skillType: string
  description: string
  iconUrl: string
  modelCostPoints: number
  imageSizes: string[] | null
  attachmentConfig: Record<string, any> | null
  hasModelParams: boolean
}

export default function CustomTemplateCreatePage() {
  const statusBarHeight = getStatusBarHeight()
  const [avatarId, setAvatarId] = useState(0)
  const [templateId, setTemplateId] = useState(0)
  const [skillType, setSkillType] = useState('')
  const [currentStep, setCurrentStep] = useState<StepKey>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isEditMode = templateId > 0

  // Step1: 基础信息
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // Step2: 模型选择
  const [modelApis, setModelApis] = useState<ModelApiOption[]>([])
  const [selectedModelId, setSelectedModelId] = useState(0)
  const [creatorIncomePoints, setCreatorIncomePoints] = useState(0)
  const selectedModelRef = useRef<ModelApiOption | null>(null)

  // Step3: 参数设置
  const [promptVars, setPromptVars] = useState<PromptVariable[]>([])
  const [editingVarIndex, setEditingVarIndex] = useState(-1)
  const [editForm, setEditForm] = useState<Partial<PromptVariable>>({})
  const [editOptions, setEditOptions] = useState<string[]>([])
  const [showAddParam, setShowAddParam] = useState(false)

  // Step4: 提示词模版
  const [promptText, setPromptText] = useState('')
  const [materialConfig, setMaterialConfig] = useState<MaterialConfig>({
    enabled: false, max_count: 3, allowed_types: ['图片'], max_size_mb: 10,
  })
  const [maxTokens, setMaxTokens] = useState('')
  const [temperature, setTemperature] = useState('')
  const [resultCount, setResultCount] = useState('')
  const [imageSize, setImageSize] = useState('')
  const [videoDuration, setVideoDuration] = useState('')
  const [videoRatio, setVideoRatio] = useState('')

  const selectedModel = selectedModelRef.current

  const loadModelApis = useCallback(async (st: string) => {
    try {
      const res = await Network.request({
        url: '/api/ai-avatar/model-apis',
        data: { skill_type: st },
      })
      const data = (res.data as any)?.data
      if (Array.isArray(data)) setModelApis(data)
    } catch {
      console.error('[custom-template] 加载模型API失败')
    }
  }, [])

  /** 编辑模式：加载已有模版数据填充表单 */
  const loadTemplateData = useCallback(async (tid: number, st: string) => {
    setIsLoading(true)
    try {
      const res = await Network.request({ url: `/api/ai-avatar/templates/${tid}/detail` })
      const d = (res.data as any)?.data
      if (!d) { Taro.showToast({ title: '模版数据加载失败', icon: 'none' }); return }
      setTemplateName(d.templateName || '')
      setTemplateDesc(d.templateDescription || '')
      setCoverUrl(d.coverUrl || '')
      if (Array.isArray(d.tags)) setTags(d.tags)
      if (d.modelApiId) {
        setSelectedModelId(d.modelApiId)
        const apis = await Network.request({ url: '/api/ai-avatar/model-apis', data: { skill_type: st } })
        const apiList = (apis.data as any)?.data
        if (Array.isArray(apiList)) {
          setModelApis(apiList)
          const matched = apiList.find((a: ModelApiOption) => a.id === d.modelApiId)
          if (matched) selectedModelRef.current = matched
        }
      }
      setCreatorIncomePoints(d.creatorIncomePoints || 0)
      if (Array.isArray(d.promptVariables)) setPromptVars(d.promptVariables)
      setPromptText(d.promptText || '')
      if (d.materialConfig) setMaterialConfig(d.materialConfig)
      const mp = d.modelParams
      if (mp) {
        if (mp.max_tokens) setMaxTokens(String(mp.max_tokens))
        if (mp.temperature) setTemperature(String(mp.temperature))
        if (mp.result_count) setResultCount(String(mp.result_count))
        if (mp.size) setImageSize(mp.size)
        if (mp.duration) setVideoDuration(String(mp.duration))
        if (mp.ratio) setVideoRatio(mp.ratio)
      }
    } catch {
      Taro.showToast({ title: '加载模版失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useLoad((options) => {
    const id = Number(options?.avatarId || 0)
    const tid = Number(options?.templateId || 0)
    const st = decodeURIComponent(options?.skillType || '')
    if (id > 0) setAvatarId(id)
    if (tid > 0) setTemplateId(tid)
    if (st) {
      setSkillType(st)
      if (tid > 0) {
        void loadTemplateData(tid, st)
      } else {
        void loadModelApis(st)
      }
    }
  })

  // ===== 步骤导航 =====
  const goStep = (step: StepKey) => {
    if (step === 2 && !templateName.trim()) {
      Taro.showToast({ title: '请先填写模版名称', icon: 'none' }); return
    }
    if (step === 3 && !selectedModelId) {
      Taro.showToast({ title: '请先选择模型', icon: 'none' }); return
    }
    setCurrentStep(step)
  }

  // ===== Step1: 封面上传 =====
  const handleUploadCover = async () => {
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const filePath = chooseRes.tempFilePaths[0]
      if (!filePath) return

      setIsUploading(true)
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/image',
        filePath,
        name: 'file',
      })
      const resData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      const url = resData?.data?.url || resData?.url
      if (url) {
        setCoverUrl(url)
        Taro.showToast({ title: '上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      setIsUploading(false)
    }
  }

  // ===== Step1: 标签 =====
  const handleAddTag = () => {
    const val = tagInput.trim()
    if (!val) return
    if (tags.includes(val)) { Taro.showToast({ title: '标签已存在', icon: 'none' }); return }
    if (tags.length >= 5) { Taro.showToast({ title: '最多5个标签', icon: 'none' }); return }
    setTags(prev => [...prev, val])
    setTagInput('')
  }

  // ===== Step2: 模型选择 =====
  const handleSelectModel = (api: ModelApiOption) => {
    setSelectedModelId(api.id)
    selectedModelRef.current = api
  }

  // ===== Step3: 参数管理 =====
  const generateKey = (name: string): string => {
    const trimmed = name.trim()
    if (!trimmed) return `param_${Date.now() % 10000}`
    const key = trimmed.toLowerCase().replace(/[\u4e00-\u9fa5]/g, '').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    return key || `param_${Date.now() % 10000}`
  }

  const startEditParam = (index: number) => {
    const v = promptVars[index]
    setEditingVarIndex(index)
    setEditForm({ ...v })
    setEditOptions(v.options ? [...v.options] : [])
    setShowAddParam(false)
  }

  const startAddParam = () => {
    setEditingVarIndex(-1)
    setEditForm({ name: '', key: '', type: '单行文本', required: true, placeholder: '', helpText: '', defaultValue: '' })
    setEditOptions([])
    setShowAddParam(true)
  }

  const saveParam = () => {
    if (!editForm.name?.trim()) { Taro.showToast({ title: '请输入参数名称', icon: 'none' }); return }
    const key = editForm.key?.trim() || generateKey(editForm.name!)
    if (showAddParam && promptVars.some(v => v.key === key)) { Taro.showToast({ title: 'key已存在', icon: 'none' }); return }

    const needOpts = ['下拉选择', '单选', '多选'].includes(editForm.type || '')
    const param: PromptVariable = {
      key,
      name: editForm.name!.trim(),
      type: editForm.type || '单行文本',
      required: editForm.required !== false,
      placeholder: editForm.placeholder?.trim() || undefined,
      helpText: editForm.helpText?.trim() || undefined,
      defaultValue: editForm.defaultValue?.trim() || undefined,
      options: needOpts ? editOptions.filter(Boolean) : undefined,
    }

    if (showAddParam) {
      setPromptVars(prev => [...prev, param])
      setShowAddParam(false)
    } else {
      setPromptVars(prev => prev.map((v, i) => i === editingVarIndex ? param : v))
      setEditingVarIndex(-1)
    }
    setEditForm({})
  }

  const removeParam = (index: number) => {
    setPromptVars(prev => prev.filter((_, i) => i !== index))
    if (editingVarIndex === index) setEditingVarIndex(-1)
  }

  // ===== Step4: 提示词 =====
  const insertVar = (key: string) => setPromptText(prev => prev + `{{${key}}}`)

  const toggleMaterialType = (type: string) => {
    setMaterialConfig(prev => ({
      ...prev,
      allowed_types: prev.allowed_types.includes(type)
        ? prev.allowed_types.filter(t => t !== type)
        : [...prev.allowed_types, type],
    }))
  }

  // ===== 提交 =====
  const buildModelParams = (): Record<string, any> | null => {
    const p: Record<string, any> = {}
    if (skillType === '文字生成' || skillType === '图文生成') {
      if (maxTokens) p.max_tokens = Number(maxTokens)
      if (temperature) p.temperature = Number(temperature)
    }
    if (skillType === '图片生成' || skillType === '图文生成') {
      if (resultCount) p.result_count = Number(resultCount)
      if (imageSize) p.size = imageSize
    }
    if (skillType === '视频生成') {
      if (videoDuration) p.duration = Number(videoDuration)
      if (videoRatio) p.ratio = videoRatio
    }
    return Object.keys(p).length > 0 ? p : null
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    if (!templateName.trim()) { Taro.showToast({ title: '请填写模版名称', icon: 'none' }); return }
    if (!selectedModelId) { Taro.showToast({ title: '请选择模型', icon: 'none' }); return }

    setIsSubmitting(true)
    Taro.showLoading({ title: isEditMode ? '保存中...' : '创建中...' })
    try {
      const payload = {
        templateName: templateName.trim(),
        templateDescription: templateDesc.trim() || undefined,
        skillType,
        tagsJson: tags.length > 0 ? tags : undefined,
        coverUrl: coverUrl || undefined,
        modelApiId: selectedModelId,
        promptText: promptText.trim() || undefined,
        promptVariablesJson: promptVars.length > 0 ? promptVars : undefined,
        materialConfigJson: materialConfig.enabled ? materialConfig : undefined,
        modelParamsJson: buildModelParams(),
        creatorIncomePoints,
      }

      const res = isEditMode
        ? await Network.request({
            url: `/api/ai-avatar/custom-templates/${templateId}`,
            method: 'PUT',
            data: payload,
          })
        : await Network.request({
            url: '/api/ai-avatar/custom-templates',
            method: 'POST',
            data: { ...payload, avatarId },
          })

      Taro.hideLoading()
      const resData = res.data as any
      if (resData?.code === 200) {
        const tid = resData?.data?.templateId || templateId
        Taro.showToast({ title: isEditMode ? '保存成功' : '创建成功', icon: 'success' })
        setTimeout(() => {
          if (tid && avatarId) {
            Taro.redirectTo({ url: `/package-my-avatar/pages/skill-certify/index?templateId=${tid}&avatarId=${avatarId}` })
          } else {
            Taro.navigateBack()
          }
        }, 1500)
      } else {
        Taro.showToast({ title: resData?.msg || (isEditMode ? '保存失败' : '创建失败'), icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isTextSkill = skillType === '文字生成' || skillType === '图文生成'
  const isImageSkill = skillType === '图片生成' || skillType === '图文生成'
  const isVideoSkill = skillType === '视频生成'
  const imageSizeOptions: string[] = selectedModel?.imageSizes || []
  const supportsAttachment = !!selectedModel?.attachmentConfig

  // ===================== 渲染各步骤 =====================

  const renderStep1 = () => (
    <View>
      <View className="ctc-card">
        <View className="ctc-card-title">
          <Info size={18} color="#7c3aed" />
          <Text className="ctc-card-title-text">基础信息</Text>
        </View>

        {/* 模版封面 */}
        <View className="ctc-field">
          <Text className="ctc-label">模版封面</Text>
          <View className="ctc-cover-area">
            <View className="ctc-cover-box" onClick={handleUploadCover}>
              {coverUrl ? (
                <Image className="ctc-cover-img" src={coverUrl} mode="aspectFill" />
              ) : (
                <>
                  <ImagePlus size={28} color="#9ca3af" />
                  <Text className="ctc-cover-placeholder-text">
                    {isUploading ? '上传中...' : '点击上传'}
                  </Text>
                </>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text className="block text-xs text-gray-500">支持 JPG、PNG、WebP</Text>
              <Text className="block text-xs text-gray-400 mt-1">建议正方形，不超过 5MB</Text>
              {coverUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-red-200 text-red-500"
                  onClick={() => setCoverUrl('')}
                >
                  <X size={12} color="#ef4444" />
                  <Text className="block text-xs text-red-500 ml-1">移除</Text>
                </Button>
              )}
            </View>
          </View>
        </View>

        {/* 模版名称 */}
        <View className="ctc-field">
          <Text className="ctc-label">模版名称<Text className="ctc-label-required">*</Text></Text>
          <View className="ctc-input-wrap">
            <Input
              value={templateName}
              onInput={e => setTemplateName(e.detail.value)}
              placeholder="请输入模版名称，最多100个字符"
              maxlength={100}
              style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
            />
          </View>
        </View>

        {/* 模版介绍 */}
        <View className="ctc-field">
          <Text className="ctc-label">模版介绍</Text>
          <View className="ctc-input-wrap">
            <Textarea
              value={templateDesc}
              onInput={e => setTemplateDesc(e.detail.value)}
              placeholder="请输入模版介绍，最多500个字符"
              maxlength={500}
              style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent', fontSize: '14px' }}
            />
          </View>
        </View>

        {/* 标签 */}
        <View className="ctc-field">
          <Text className="ctc-label">模版标签<Text className="ctc-label-hint">（最多5个）</Text></Text>
          {tags.length > 0 && (
            <View className="ctc-tags-area">
              {tags.map((tag, idx) => (
                <View key={idx} className="ctc-tag-item">
                  <Text className="ctc-tag-text">{tag}</Text>
                  <View className="ctc-tag-remove" onClick={() => setTags(prev => prev.filter((_, i) => i !== idx))}>
                    <X size={12} color="#6d28d9" />
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <View style={{ flex: 1 }}>
              <View className="ctc-input-wrap">
                <Input
                  value={tagInput}
                  onInput={e => setTagInput(e.detail.value)}
                  onConfirm={handleAddTag}
                  placeholder="输入标签，按回车添加"
                  maxlength={20}
                  style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
                />
              </View>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Button variant="outline" size="sm" className="h-full border-violet-300 text-violet-600" onClick={handleAddTag}>
                <Plus size={14} color="#7c3aed" />
                <Text className="block text-xs text-violet-600 ml-1">添加</Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </View>
  )

  const renderStep2 = () => (
    <View>
      <View className="ctc-card">
        <View className="ctc-card-title">
          <Cpu size={18} color="#7c3aed" />
          <Text className="ctc-card-title-text">选择模型</Text>
          <Text className="ctc-card-title-badge">{skillType}</Text>
        </View>

        {modelApis.length === 0 ? (
          <Text className="block text-sm text-gray-400 py-8 text-center">
            当前技能类型暂无可用模型
          </Text>
        ) : (
          modelApis.map(api => {
            const isSelected = selectedModelId === api.id
            return (
              <View
                key={api.id}
                className={`ctc-model-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectModel(api)}
              >
                <View className="ctc-model-icon">
                  {api.iconUrl ? (
                    <Image className="ctc-model-icon-img" src={api.iconUrl} mode="aspectFill" />
                  ) : (
                    <Cpu size={28} color="#7c3aed" />
                  )}
                </View>
                <View className="ctc-model-info">
                  <Text className="ctc-model-name">{api.modelName}</Text>
                  <Text className="ctc-model-desc">{api.description || api.providerName}</Text>
                  <View className="ctc-model-tags">
                    <Text className="ctc-model-tag">{api.skillType}</Text>
                    {api.imageSizes && <Text className="ctc-model-tag">图片尺寸</Text>}
                    {api.attachmentConfig && <Text className="ctc-model-tag">支持附件</Text>}
                  </View>
                </View>
                <View className="ctc-model-cost">
                  <Text className="ctc-model-cost-value">{api.modelCostPoints}</Text>
                  <Text>积分/次</Text>
                </View>
                <View className={`ctc-model-radio ${isSelected ? 'selected' : ''}`}>
                  {isSelected && <Check size={16} color="#ffffff" />}
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* 创作者收益积分 */}
      <View className="ctc-card">
        <View className="ctc-field" style={{ marginBottom: 0 }}>
          <Text className="ctc-label">创作者收益积分<Text className="ctc-label-hint">（每次使用额外收益）</Text></Text>
          <View className="ctc-input-wrap">
            <Input
              type="number"
              value={String(creatorIncomePoints)}
              onInput={e => setCreatorIncomePoints(Number(e.detail.value) || 0)}
              placeholder="建议填 0"
              style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
            />
          </View>
        </View>
      </View>

      {/* 价格合计 */}
      {selectedModelId > 0 && (
        <View className="ctc-price-summary">
          <View className="ctc-price-row">
            <Text className="ctc-price-label">模型成本</Text>
            <Text className="ctc-price-value">{selectedModel?.modelCostPoints || 0} 积分</Text>
          </View>
          <View className="ctc-price-row">
            <Text className="ctc-price-label">创作者收益</Text>
            <Text className="ctc-price-value">{creatorIncomePoints} 积分</Text>
          </View>
          <View className="ctc-price-total">
            <Text className="ctc-price-total-label">用户单次消耗</Text>
            <Text className="ctc-price-total-value">
              {(selectedModel?.modelCostPoints || 0) + creatorIncomePoints} 积分
            </Text>
          </View>
        </View>
      )}
    </View>
  )

  const renderParamEditPanel = () => {
    const isEditing = editingVarIndex >= 0
    const needOpts = ['下拉选择', '单选', '多选'].includes(editForm.type || '')

    return (
      <View className="ctc-param-edit">
        {/* 标题栏 */}
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24rpx' }}>
          <Text className="block text-sm font-semibold text-gray-900">
            {isEditing ? '编辑参数' : '添加参数'}
          </Text>
          <View
            style={{ padding: '8rpx' }}
            onClick={() => { setEditingVarIndex(-1); setShowAddParam(false) }}
          >
            <X size={16} color="#9ca3af" />
          </View>
        </View>

        {/* 参数名称 + 变量标识 */}
        <View className="ctc-field">
          <Text className="block text-xs font-medium text-gray-600 mb-2">
            参数名称 <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>
          <View className="ctc-input-wrap">
            <Input
              value={editForm.name || ''}
              onInput={e => {
                const n = e.detail.value
                setEditForm(prev => ({
                  ...prev,
                  name: n,
                  key: prev.key || generateKey(n),
                }))
              }}
              placeholder="如：风格、产品名、目标人群"
              style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
            />
          </View>
          {editForm.key && (
            <Text className="block text-xs text-violet-500 mt-1" style={{ fontFamily: 'monospace' }}>
              变量标识：{`{{${editForm.key}}}`}
            </Text>
          )}
        </View>

        {/* 输入类型 + 是否必填 */}
        <View style={{ display: 'flex', gap: '16rpx', marginBottom: '24rpx' }}>
          <View style={{ flex: 1 }}>
            <Text className="block text-xs font-medium text-gray-600 mb-2">输入类型</Text>
            <View
              className="ctc-input-wrap"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => {
                Taro.showActionSheet({
                  itemList: VAR_TYPE_OPTIONS,
                  success: (res) => setEditForm(prev => ({ ...prev, type: VAR_TYPE_OPTIONS[res.tapIndex] })),
                })
              }}
            >
              <Text className="block text-sm text-gray-900">{editForm.type || '单行文本'}</Text>
              <ChevronDown size={14} color="#9ca3af" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text className="block text-xs font-medium text-gray-600 mb-2">是否必填</Text>
            <View style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
              <Switch
                checked={editForm.required !== false}
                onCheckedChange={(v) => setEditForm(prev => ({ ...prev, required: v }))}
              />
              <Text className="block text-xs text-gray-500 ml-2">
                {editForm.required !== false ? '必填' : '选填'}
              </Text>
            </View>
          </View>
        </View>

        {/* 占位提示 */}
        <View className="ctc-field">
          <Text className="block text-xs font-medium text-gray-600 mb-2">占位提示文案</Text>
          <View className="ctc-input-wrap">
            <Input
              value={editForm.placeholder || ''}
              onInput={e => setEditForm(prev => ({ ...prev, placeholder: e.detail.value }))}
              placeholder="如：如治愈、专业、活泼"
              style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
            />
          </View>
        </View>

        {/* 帮助说明 */}
        <View className="ctc-field">
          <Text className="block text-xs font-medium text-gray-600 mb-2">
            帮助说明 <Text className="text-gray-400">（用户可见）</Text>
          </Text>
          <View className="ctc-input-wrap">
            <Input
              value={editForm.helpText || ''}
              onInput={e => setEditForm(prev => ({ ...prev, helpText: e.detail.value }))}
              placeholder="如：请选择符合内容调性的风格类型"
              style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
            />
          </View>
        </View>

        {/* 可选项配置 */}
        {needOpts && (
          <View className="ctc-field">
            <Text className="block text-xs font-medium text-gray-600 mb-2">可选项配置</Text>
            <View style={{ display: 'flex', flexDirection: 'column', gap: '12rpx' }}>
              {editOptions.map((opt, idx) => (
                <View key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                  <View style={{ flex: 1 }}>
                    <View className="ctc-input-wrap" style={{ padding: '12rpx 16rpx' }}>
                      <Input
                        value={opt}
                        onInput={e => {
                          const newOpts = [...editOptions]
                          newOpts[idx] = e.detail.value
                          setEditOptions(newOpts)
                        }}
                        placeholder={`选项 ${idx + 1}`}
                        style={{ width: '100%', fontSize: '13px', backgroundColor: 'transparent' }}
                      />
                    </View>
                  </View>
                  <View
                    style={{ padding: '8rpx' }}
                    onClick={() => setEditOptions(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <X size={14} color="#d1d5db" />
                  </View>
                </View>
              ))}
              <View
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx',
                  padding: '16rpx', border: '2rpx dashed #d1d5db', borderRadius: '10rpx',
                }}
                onClick={() => setEditOptions(prev => [...prev, ''])}
              >
                <Plus size={14} color="#9ca3af" />
                <Text className="block text-xs text-gray-500">添加选项</Text>
              </View>
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        <View style={{ display: 'flex', flexDirection: 'row', gap: '16rpx', marginTop: '8rpx' }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setEditingVarIndex(-1); setShowAddParam(false) }}
            >
              <Text className="block text-sm text-gray-600">取消</Text>
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button className="w-full bg-violet-600" onClick={saveParam}>
              <Text className="block text-sm text-white">{isEditing ? '保存' : '确认添加'}</Text>
            </Button>
          </View>
        </View>
      </View>
    )
  }

  const renderStep3 = () => (
    <View>
      {/* 提示 */}
      <View className="ctc-card" style={{ background: '#faf5ff', border: '2rpx solid #ede9fe' }}>
        <Text className="block text-xs text-violet-700">
          配置用户填写的参数，用于生成个性化内容。{'\n'}
          支持设置输入方式、是否必填、提示说明与默认值。
        </Text>
      </View>

      {/* 参数列表 */}
      <View className="ctc-card">
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20rpx' }}>
          <Text className="ctc-card-title-text">参数列表</Text>
          <Button variant="outline" size="sm" className="border-violet-300 text-violet-600" onClick={startAddParam}>
            <Plus size={14} color="#7c3aed" />
            <Text className="block text-xs text-violet-600 ml-1">添加参数</Text>
          </Button>
        </View>

        {promptVars.length > 0 ? (
          <View className="ctc-param-list">
            {promptVars.map((v, idx) => (
              <View
                key={v.key}
                className={`ctc-param-item ${editingVarIndex === idx ? 'active' : ''}`}
                onClick={() => startEditParam(idx)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx', flexWrap: 'wrap' }}>
                    <Text className="block text-sm font-medium text-gray-900">{v.name}</Text>
                    <Text className="block text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{v.type}</Text>
                    <Text className={`block text-xs px-2 py-1 rounded ${v.required ? 'text-violet-600 bg-violet-50' : 'text-gray-400 bg-gray-50'}`}>
                      {v.required ? '必填' : '选填'}
                    </Text>
                  </View>
                  <Text className="block text-xs text-gray-400 mt-1">{`{{${v.key}}}`}</Text>
                </View>
                <View style={{ display: 'flex', gap: '20rpx', flexShrink: 0, alignItems: 'center' }}>
                  <View
                    style={{ padding: '8rpx' }}
                    onClick={(e) => { e.stopPropagation(); startEditParam(idx) }}
                  >
                    <Pencil size={15} color="#9ca3af" />
                  </View>
                  <View
                    style={{ padding: '8rpx' }}
                    onClick={(e) => { e.stopPropagation(); removeParam(idx) }}
                  >
                    <Trash2 size={15} color="#d1d5db" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : !showAddParam && (
          <View style={{ padding: '40rpx 0', textAlign: 'center' }}>
            <Text className="block text-sm text-gray-400">暂无参数，点击上方「添加参数」开始配置</Text>
          </View>
        )}
      </View>

      {/* 编辑/新增面板 */}
      {(editingVarIndex >= 0 || showAddParam) && renderParamEditPanel()}

      {/* 用户填写预览 */}
      {promptVars.length > 0 && (
        <View className="ctc-preview-section">
          <View className="ctc-preview-header">
            <Text className="ctc-preview-title">用户填写预览</Text>
            <Eye size={18} color="#7c3aed" />
          </View>
          {promptVars.map(v => (
            <View key={v.key} className="ctc-preview-field">
              <Text className="ctc-preview-label">
                {v.name} {v.required && <Text style={{ color: '#ef4444' }}>*</Text>}
              </Text>
              {['下拉选择', '单选'].includes(v.type) ? (
                <View className="ctc-preview-input ctc-preview-select">
                  <Text className="ctc-preview-placeholder">
                    {v.placeholder || `请选择${v.name}`}
                  </Text>
                  <ChevronDown size={14} color="#9ca3af" />
                </View>
              ) : v.type === '多选' ? (
                <View>
                  <View style={{ display: 'flex', flexWrap: 'wrap', gap: '8rpx' }}>
                    {(v.options || []).map((opt, oi) => (
                      <View key={oi} style={{ padding: '6rpx 16rpx', border: '2rpx solid #e5e7eb', borderRadius: '8rpx', background: '#f9fafb' }}>
                        <Text className="block text-xs text-gray-600">{opt}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : v.type === '多行文本' ? (
                <View className="ctc-preview-input" style={{ minHeight: '120rpx' }}>
                  <Text className="ctc-preview-placeholder">
                    {v.placeholder || `请输入${v.name}`}
                  </Text>
                </View>
              ) : (
                <View className="ctc-preview-input">
                  <Text className="ctc-preview-placeholder">
                    {v.placeholder || `请输入${v.name}`}
                  </Text>
                </View>
              )}
              {v.helpText && (
                <Text className="block text-xs text-gray-400 mt-1">{v.helpText}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )

  const renderStep4 = () => (
    <View>
      {/* 提示词模版 */}
      <View className="ctc-card">
        <View className="ctc-card-title">
          <FileText size={18} color="#7c3aed" />
          <Text className="ctc-card-title-text">提示词模版</Text>
        </View>
        <Text className="block text-xs text-gray-500 mb-3">
          清晰准确的描述，有助于生成更优质的内容。
        </Text>
        <View className="ctc-prompt-editor">
          <Textarea
            value={promptText}
            onInput={e => setPromptText(e.detail.value)}
            placeholder={`# 角色\n你是一位专业的内容创作者...\n\n# 任务\n根据用户提供的信息，创作内容。\n\n# 产品信息\n产品名：{{产品名}}`}
            maxlength={2000}
            style={{ width: '100%', minHeight: '300px', backgroundColor: 'transparent', fontSize: '14px', lineHeight: '1.8' }}
          />
        </View>
        <Text className="ctc-prompt-counter">{promptText.length}/2000</Text>
      </View>

      {/* 变量列表 */}
      {promptVars.length > 0 && (
        <View className="ctc-card">
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16rpx' }}>
            <Text className="ctc-card-title-text">变量列表</Text>
            <Text className="block text-xs text-gray-400">（点击可插入变量）</Text>
          </View>
          <View className="ctc-var-list">
            {promptVars.map(v => {
              const isUsed = promptText.includes(`{{${v.key}}}`)
              return (
                <View key={v.key} className="ctc-var-chip" onClick={() => insertVar(v.key)}>
                  <Text className="ctc-var-chip-key">{`{{${v.key}}}`}</Text>
                  <Text className="ctc-var-chip-name">{v.name}</Text>
                  {isUsed && <Text className="ctc-var-chip-check">✓</Text>}
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* 素材上传设置（仅模型支持附件时显示） */}
      {supportsAttachment && (
        <View className="ctc-card">
          <View className="ctc-card-title">
            <Paperclip size={18} color="#7c3aed" />
            <Text className="ctc-card-title-text">素材上传设置</Text>
          </View>

          <View className="ctc-switch-row">
            <Text className="ctc-switch-label">是否允许上传素材</Text>
            <Switch
              checked={materialConfig.enabled}
              onCheckedChange={(v) => setMaterialConfig(prev => ({ ...prev, enabled: v }))}
            />
          </View>

          {materialConfig.enabled && (
            <View style={{ marginTop: '16rpx' }}>
              <View className="ctc-field">
                <Text className="ctc-label">素材类型</Text>
                <View className="ctc-mc-types">
                  {MATERIAL_TYPE_OPTIONS.map(type => (
                    <View
                      key={type}
                      className={`ctc-mc-type-item ${materialConfig.allowed_types.includes(type) ? 'active' : ''}`}
                      onClick={() => toggleMaterialType(type)}
                    >
                      {materialConfig.allowed_types.includes(type) && <Check size={14} color="#7c3aed" />}
                      <Text className="ctc-mc-type-text">{type}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="ctc-field">
                <Text className="ctc-label">上传数量</Text>
                <View className="ctc-mc-count-options">
                  {[1, 3, 5, 9].map(n => (
                    <View
                      key={n}
                      className={`ctc-mc-count-btn ${materialConfig.max_count === n ? 'active' : ''}`}
                      onClick={() => setMaterialConfig(prev => ({ ...prev, max_count: n }))}
                    >
                      <Text style={{ fontSize: '13px', color: materialConfig.max_count === n ? '#fff' : '#374151' }}>
                        最多 {n} 个
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <Text className="block text-xs text-gray-400 mt-1">
                单个素材大小限制：图片 10MB / 视频 50MB
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 模型调用参数（仅需要时显示） */}
      {(isTextSkill || isImageSkill || isVideoSkill) && (
        <View className="ctc-card">
          <View className="ctc-card-title">
            <Settings size={18} color="#7c3aed" />
            <Text className="ctc-card-title-text">模型调用参数</Text>
            <Text className="ctc-card-title-badge">高级</Text>
          </View>

          {isTextSkill && (
            <View className="ctc-mc-row">
              <View className="ctc-mc-half">
                <Text className="ctc-label">最大输出长度</Text>
                <View className="ctc-input-wrap">
                  <Input type="number" value={maxTokens} onInput={e => setMaxTokens(e.detail.value)} placeholder="如 2000"
                    style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
                  />
                </View>
              </View>
              <View className="ctc-mc-half">
                <Text className="ctc-label">随机度(0~2)</Text>
                <View className="ctc-input-wrap">
                  <Input type="digit" value={temperature} onInput={e => setTemperature(e.detail.value)} placeholder="如 0.8"
                    style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
                  />
                </View>
              </View>
            </View>
          )}

          {isImageSkill && (
            <View className="ctc-mc-row">
              <View className="ctc-mc-half">
                <Text className="ctc-label">生成数量</Text>
                <View className="ctc-input-wrap">
                  <Input type="number" value={resultCount} onInput={e => setResultCount(e.detail.value)} placeholder="如 4"
                    style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
                  />
                </View>
              </View>
              {imageSizeOptions.length > 0 && (
                <View className="ctc-mc-half">
                  <Text className="ctc-label">图片尺寸</Text>
                  <View
                    className="ctc-input-wrap"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => {
                      Taro.showActionSheet({
                        itemList: ['不设定', ...imageSizeOptions],
                        success: (r) => setImageSize(r.tapIndex === 0 ? '' : imageSizeOptions[r.tapIndex - 1]),
                      })
                    }}
                  >
                    <Text style={{ fontSize: '14px', color: imageSize ? '#1a1a2e' : '#9ca3af' }}>
                      {imageSize || '不设定'}
                    </Text>
                    <ChevronDown size={14} color="#9ca3af" />
                  </View>
                </View>
              )}
            </View>
          )}

          {isVideoSkill && (
            <View className="ctc-mc-row">
              <View className="ctc-mc-half">
                <Text className="ctc-label">期望时长(秒)</Text>
                <View className="ctc-input-wrap">
                  <Input type="number" value={videoDuration} onInput={e => setVideoDuration(e.detail.value)} placeholder="如 15"
                    style={{ width: '100%', fontSize: '14px', backgroundColor: 'transparent' }}
                  />
                </View>
              </View>
              <View className="ctc-mc-half">
                <Text className="ctc-label">视频比例</Text>
                <View
                  className="ctc-input-wrap"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => {
                    Taro.showActionSheet({
                      itemList: ['不设定', '16:9', '9:16', '1:1', '4:3'],
                      success: (r) => setVideoRatio(['', '16:9', '9:16', '1:1', '4:3'][r.tapIndex]),
                    })
                  }}
                >
                  <Text style={{ fontSize: '14px', color: videoRatio ? '#1a1a2e' : '#9ca3af' }}>
                    {videoRatio || '不设定'}
                  </Text>
                  <ChevronDown size={14} color="#9ca3af" />
                </View>
              </View>
            </View>
          )}

          <Text className="block text-xs text-gray-400 mt-2">
            空字段将使用模型默认值。
          </Text>
        </View>
      )}
    </View>
  )

  // ===== 底部按钮 =====
  const renderFooter = () => {
    const prevLabels: Record<StepKey, string> = { 1: '', 2: '上一步：基础信息', 3: '上一步：模型选择', 4: '上一步：参数设置' }
    const nextLabels: Record<StepKey, string> = { 1: '下一步：模型选择', 2: '下一步：参数设置', 3: '下一步：提示词模版', 4: isEditMode ? '保存修改' : '完成模版创建' }

    const canNext =
      (currentStep === 1 && !!templateName.trim()) ||
      (currentStep === 2 && selectedModelId > 0) ||
      currentStep === 3 ||
      (currentStep === 4 && !isSubmitting)

    return (
      <View className="ctc-footer">
        <View className="ctc-footer-btns">
          {currentStep > 1 && (
            <View
              className="ctc-footer-btn-prev"
              onClick={() => goStep((currentStep - 1) as StepKey)}
            >
              <Text className="ctc-footer-btn-prev-text">{prevLabels[currentStep]}</Text>
            </View>
          )}
          <View
            className={`ctc-footer-btn-next ${!canNext ? 'disabled' : ''}`}
            onClick={() => {
              if (!canNext) return
              if (currentStep < 4) goStep((currentStep + 1) as StepKey)
              else void handleSubmit()
            }}
          >
            <Text className="ctc-footer-btn-next-text">
              {currentStep === 4 && isSubmitting ? (isEditMode ? '保存中...' : '创建中...') : nextLabels[currentStep]}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="ctc-page">
      <View className="ctc-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View
          className="ctc-back"
          onClick={() => {
            if (currentStep > 1) goStep((currentStep - 1) as StepKey)
            else Taro.navigateBack()
          }}
        >
          <ArrowLeft size={20} color="#1a1a2e" />
        </View>
        <Text className="ctc-header-title">{isEditMode ? '编辑自定义模版' : '创建自定义模版'}</Text>
        <View className="ctc-header-right" />
      </View>

      {/* 步骤指示器 */}
      <View className="ctc-steps">
        {STEPS.map((step, idx) => (
          <View key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}>
            <View className="ctc-step-item">
              <View className={`ctc-step-dot ${currentStep === step.key ? 'active' : currentStep > step.key ? 'done' : ''}`}>
                {currentStep > step.key ? (
                  <Check size={14} color="#ffffff" />
                ) : (
                  <Text className="ctc-step-dot-text">{step.key}</Text>
                )}
              </View>
              <Text className={`ctc-step-label ${currentStep === step.key ? 'active' : ''}`}>{step.label}</Text>
            </View>
            {idx < STEPS.length - 1 && (
              <View className={`ctc-step-line ${currentStep > step.key ? 'done' : ''}`} />
            )}
          </View>
        ))}
      </View>

      <ScrollView scrollY className="ctc-content">
        <View className="ctc-content-inner">
          {isLoading ? (
            <View style={{ padding: '120rpx 0', textAlign: 'center' }}>
              <Text className="block text-sm text-gray-400">加载模版数据中...</Text>
            </View>
          ) : (
            <>
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
            </>
          )}
        </View>
      </ScrollView>

      {renderFooter()}
    </View>
  )
}
