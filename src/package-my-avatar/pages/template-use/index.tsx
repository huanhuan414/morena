import { useState } from 'react'
import { View, Text, Image, Input, Textarea, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ArrowLeft, ChevronDown, ArrowRight, Info, CircleCheck } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { getStatusBarHeight } from '@/utils/safe-area'
import { useTemplateGeneration, type PromptVariable } from '../../hooks/useTemplateGeneration'
import './index.css'

/**
 * 模版使用页面
 * 带 3 步骤条：填写参数 → 预览确认 → 生成结果
 * 逻辑复用 useTemplateGeneration hook
 */
export default function TemplateUsePage() {
  const statusBarHeight = getStatusBarHeight()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)

  const {
    detail,
    loading,
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
    handleSubmit,
    buildResultParams,
    handleChooseImage,
    handleRemoveImage,
  } = useTemplateGeneration()

  useLoad((options) => {
    init(options as Record<string, string | undefined>)
  })

  /** 进入预览确认步骤 */
  const goToPreview = () => {
    if (!detail) return
    const vars = detail.promptVariables || []
    for (const v of vars) {
      if (v.required && !formValues[v.key]?.trim()) {
        Taro.showToast({ title: `请填写${v.name}`, icon: 'none' })
        return
      }
    }
    setCurrentStep(2)
  }

  /** 确认使用后跳转结果页 */
  const navigateToResult = () => {
    const params = buildResultParams()
    if (!params) return
    Taro.navigateTo({
      url: `/package-my-avatar/pages/template-use-result/index?${params}`,
    })
  }

  /** 弹框确认使用 */
  const handleConfirmUse = () => {
    setConfirmOpen(false)
    navigateToResult()
  }

  /** 渲染步骤条 */
  const renderStepBar = () => {
    const steps = [
      { num: 1, label: '填写参数' },
      { num: 2, label: '预览确认' },
      { num: 3, label: '生成结果' },
    ]
    return (
      <View className="tu-step-bar">
        <View className="tu-step-bar-back" onClick={() => {
          if (currentStep === 2) setCurrentStep(1)
          else Taro.navigateBack()
        }}>
          <ArrowLeft size={18} color="#6b21a8" />
        </View>
        <View className="tu-step-bar-items">
          {steps.map((s, idx) => (
            <View key={s.num} className="tu-step-bar-item-wrap">
              <View className={`tu-step-bar-item ${s.num === currentStep ? 'active' : ''} ${s.num < currentStep ? 'completed' : ''}`}>
                <View className={`tu-step-bar-num ${s.num === currentStep ? 'active' : ''} ${s.num < currentStep ? 'completed' : ''}`}>
                  {s.num < currentStep ? (
                    <CircleCheck size={16} color="#ffffff" />
                  ) : (
                    <Text className="tu-step-bar-num-text">{s.num}</Text>
                  )}
                </View>
                <Text className={`tu-step-bar-label ${s.num === currentStep ? 'active' : ''} ${s.num < currentStep ? 'completed' : ''}`}>
                  {s.label}
                </Text>
              </View>
              {idx < steps.length - 1 && <View className="tu-step-bar-connector" />}
            </View>
          ))}
        </View>
      </View>
    )
  }

  /** 渲染表单项 */
  const renderFormItem = (variable: PromptVariable) => {
    const value = formValues[variable.key] || ''
    const maxLen = variable.type === '多行文本' ? 500 : (variable.type === '单行文本' ? 100 : 50)

    if ((variable.type === '下拉选择' || variable.type === '单选') && variable.options?.length) {
      return (
        <View key={variable.key} className="tu-field">
          <View className="tu-field-header">
            <Text className="tu-field-label">
              {variable.name}
              {variable.required && <Text className="tu-field-required"> *</Text>}
            </Text>
          </View>
          <Picker
            mode="selector"
            range={variable.options}
            value={variable.options.indexOf(value) >= 0 ? variable.options.indexOf(value) : 0}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              updateFormValue(variable.key, variable.options![idx])
            }}
          >
            <View className="tu-field-select">
              <Text className={`tu-field-select-text ${!value ? 'placeholder' : ''}`}>
                {value || `请选择${variable.name}`}
              </Text>
              <ChevronDown size={16} color="#9ca3af" />
            </View>
          </Picker>
        </View>
      )
    }

    if (variable.type === '多选' && variable.options?.length) {
      const selectedArr = value ? value.split('、') : []
      return (
        <View key={variable.key} className="tu-field">
          <View className="tu-field-header">
            <Text className="tu-field-label">
              {variable.name}
              {variable.required && <Text className="tu-field-required"> *</Text>}
            </Text>
          </View>
          <View className="tu-multi-options">
            {variable.options.map(opt => (
              <View
                key={opt}
                className={`tu-multi-option ${selectedArr.includes(opt) ? 'active' : ''}`}
                onClick={() => toggleMultiSelectValue(variable.key, opt)}
              >
                <Text className="tu-multi-option-text">{opt}</Text>
              </View>
            ))}
          </View>
        </View>
      )
    }

    if (variable.type === '多行文本') {
      return (
        <View key={variable.key} className="tu-field">
          <View className="tu-field-header">
            <Text className="tu-field-label">
              {variable.name}
              {variable.required && <Text className="tu-field-required"> *</Text>}
            </Text>
            <Text className="tu-field-counter">{value.length}/{maxLen}</Text>
          </View>
          <View className="tu-field-textarea-wrap">
            <Textarea
              className="tu-field-textarea"
              placeholder={`请输入${variable.name}`}
              value={value}
              onInput={(e) => updateFormValue(variable.key, e.detail.value)}
              maxlength={maxLen}
              autoHeight
            />
          </View>
        </View>
      )
    }

    return (
      <View key={variable.key} className="tu-field">
        <View className="tu-field-header">
          <Text className="tu-field-label">
            {variable.name}
            {variable.required && <Text className="tu-field-required"> *</Text>}
          </Text>
          <Text className="tu-field-counter">{value.length}/{maxLen}</Text>
        </View>
        <View className="tu-field-input-wrap">
          <Input
            className="tu-field-input"
            placeholder={`请输入${variable.name}`}
            value={value}
            onInput={(e) => updateFormValue(variable.key, e.detail.value)}
            maxlength={maxLen}
          />
        </View>
      </View>
    )
  }

  /** 渲染步骤1: 填写参数 */
  const renderStep1 = () => (
    <View className="tu-step-content">
      {/* 模板信息卡片 */}
      <View className="tu-template-card">
        <View className="tu-template-cover">
          {detail!.coverUrl ? (
            <Image className="tu-template-cover-img" src={detail!.coverUrl} mode="aspectFill" />
          ) : (
            <View className="tu-template-cover-fallback">
              <Text className="tu-template-cover-emoji">✏️</Text>
            </View>
          )}
        </View>
        <View className="tu-template-info">
          <Text className="tu-template-name">{detail!.templateName}</Text>
          <Badge className="tu-template-badge">
            <Text>{detail!.skillType || '文案内容生成'}</Text>
          </Badge>
          <Text className="tu-template-price">价格: {totalCost} 积分 / 次</Text>
        </View>
      </View>

      {/* 提示信息 */}
      {!detail!.materialConfig?.enabled && (
        <View className="tu-notice">
          <Info size={14} color="#6b7280" />
          <Text className="tu-notice-text">该模板无需上传限制，填写参数即可生成</Text>
        </View>
      )}

      {/* 填写参数区域 */}
      <View className="tu-form-section">
        <Text className="tu-form-section-title">填写参数</Text>

        {Array.isArray(detail!.promptVariables) && detail!.promptVariables.length > 0 ? (
          detail!.promptVariables.map(v => renderFormItem(v))
        ) : (
          <Text className="tu-form-empty">该模板暂无需要配置的参数</Text>
        )}

        {/* 上传附件区域 */}
        {detail!.materialConfig?.enabled && (
          <View className="tu-field">
            <View className="tu-field-header">
              <Text className="tu-field-label">上传图片<Text className="tu-field-optional">（可选）</Text></Text>
            </View>
            {uploadedImageUrl ? (
              <View className="tu-upload-preview">
                <Image className="tu-upload-thumb" src={uploadedImageUrl} mode="widthFix" />
                <View className="tu-upload-actions">
                  <View className="tu-upload-action replace" onClick={handleChooseImage}>
                    <Text className="tu-upload-action-text">{uploading ? '上传中...' : '重选'}</Text>
                  </View>
                  <View className="tu-upload-action remove" onClick={handleRemoveImage}>
                    <Text className="tu-upload-action-text">删除</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="tu-upload-area" onClick={handleChooseImage}>
                <Text className="tu-upload-icon">+</Text>
                <Text className="tu-upload-text">{uploading ? '上传中...' : '点击上传图片'}</Text>
                <Text className="tu-upload-hint">
                  支持 JPG/PNG，最大 {detail!.materialConfig.max_size_mb || 10}MB
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 必填提示 */}
      <View className="tu-required-hint">
        <Text className="tu-required-hint-mark">*</Text>
        <Text className="tu-required-hint-text"> 为必填项</Text>
      </View>

      {/* 底部按钮 */}
      <View className="tu-footer">
        <Button className="tu-footer-btn" onClick={goToPreview}>
          <Text>下一步：预览确认</Text>
          <ArrowRight size={18} color="#ffffff" />
        </Button>
      </View>
    </View>
  )

  /** 渲染步骤2: 预览确认 */
  const renderStep2 = () => (
    <View className="tu-step-content">
      {/* 模板信息 */}
      <View className="tu-preview-template">
        <View className="tu-preview-template-row">
          {detail!.coverUrl ? (
            <Image className="tu-preview-template-img" src={detail!.coverUrl} mode="aspectFill" />
          ) : (
            <View className="tu-preview-template-fallback">
              <Text>✏️</Text>
            </View>
          )}
          <View className="tu-preview-template-info">
            <Text className="tu-preview-template-name">{detail!.templateName}</Text>
            <Text className="tu-preview-template-desc">{detail!.templateDescription}</Text>
          </View>
        </View>
      </View>

      {/* 已填参数预览 */}
      <View className="tu-preview-params">
        <Text className="tu-preview-section-title">已填参数</Text>
        {detail!.promptVariables?.map(v => (
          <View key={v.key} className="tu-preview-param-row">
            <Text className="tu-preview-param-label">{v.name}</Text>
            <Text className="tu-preview-param-value">{formValues[v.key] || '—'}</Text>
          </View>
        ))}
        {uploadedImageUrl && (
          <View className="tu-preview-param-row">
            <Text className="tu-preview-param-label">上传图片</Text>
            <Image className="tu-preview-param-img" src={uploadedImageUrl} mode="aspectFill" />
          </View>
        )}
      </View>

      {/* 费用说明 */}
      {detail!.modelApi && (
        <View className="tu-preview-cost">
          <Text className="tu-preview-section-title">费用说明</Text>
          <View className="tu-preview-cost-row">
            <Text className="tu-preview-cost-label">模型成本</Text>
            <Text className="tu-preview-cost-value">{detail!.modelApi.modelCostPoints} 积分</Text>
          </View>
          {detail!.creatorIncomePoints > 0 && (
            <View className="tu-preview-cost-row">
              <Text className="tu-preview-cost-label">创作者收益</Text>
              <Text className="tu-preview-cost-value">{detail!.creatorIncomePoints} 积分</Text>
            </View>
          )}
          <View className="tu-preview-cost-row total">
            <Text className="tu-preview-cost-label">合计</Text>
            <Text className="tu-preview-cost-value total">{totalCost} 积分</Text>
          </View>
        </View>
      )}

      {/* 底部操作 */}
      <View className="tu-footer">
        <Button variant="outline" className="tu-footer-btn-back" onClick={() => setCurrentStep(1)}>
          <Text>返回修改</Text>
        </Button>
        <Button className="tu-footer-btn-confirm" onClick={() => handleSubmit(navigateToResult)}>
          <Text>确认生成</Text>
          <ArrowRight size={16} color="#ffffff" />
        </Button>
      </View>
    </View>
  )

  return (
    <View className="tu-page">
      {/* 步骤条 */}
      <View style={{ paddingTop: `${statusBarHeight}px` }}>
        {renderStepBar()}
      </View>

      {loading ? (
        <View className="tu-loading">
          <Text className="tu-loading-text">加载中...</Text>
        </View>
      ) : detail ? (
        currentStep === 1 ? renderStep1() : renderStep2()
      ) : (
        <View className="tu-loading">
          <Text className="tu-loading-text">模板信息加载失败</Text>
        </View>
      )}

      {/* 积分确认弹框 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Text className="block text-lg font-semibold text-center">积分确认</Text>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Text className="block text-sm text-muted-foreground text-center leading-relaxed">
                本次使用将消耗 {totalCost} 积分（模型成本 {detail?.modelApi?.modelCostPoints || 0} + 创作者收益 {detail?.creatorIncomePoints || 0}），确认继续？
              </Text>
              {!balanceLoading && insufficientBalance && (
                <Text className="block text-xs text-destructive text-center mt-2">
                  当前余额 {userBalance} 积分，不足以支付本次消费
                </Text>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-3 mt-2">
            <AlertDialogCancel className="flex-1">
              <Text className="block text-center text-sm">取消</Text>
            </AlertDialogCancel>
            {balanceLoading ? (
              <View className="flex-1 flex items-center justify-center rounded-md bg-muted py-2">
                <Text className="block text-center text-sm text-muted-foreground">查询中...</Text>
              </View>
            ) : insufficientBalance ? (
              <View className="flex-1 flex items-center justify-center rounded-md bg-muted py-2 opacity-50">
                <Text className="block text-center text-sm text-muted-foreground">积分不足</Text>
              </View>
            ) : (
              <AlertDialogAction className="flex-1" onClick={handleConfirmUse}>
                <Text className="block text-center text-sm text-primary-foreground">确认使用</Text>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
