import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ArrowLeft, CircleCheck, Clock, LoaderCircle, Coins, Sparkles, FileText } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { getStatusBarHeight } from '@/utils/safe-area'
import { useGenerationResult } from '../../hooks/useGenerationResult'
import './index.css'

/**
 * 模版使用结果页面
 * 逻辑复用 useGenerationResult hook，全新 UI 设计
 * 步骤条标记为第3步"生成结果"
 */
export default function TemplateUseResultPage() {
  const statusBarHeight = getStatusBarHeight()

  const {
    templateInfo,
    generating,
    genResult,
    paidPoints,
    completeFailed,
    certTime,
    currentStep,
    elapsedSeconds,
    formatUseCount,
    initAndRun,
    handleRetryComplete,
    getResultTitle,
    getResultSummary,
  } = useGenerationResult()

  useLoad((options) => {
    initAndRun(options as Record<string, string | undefined>)
  })

  /** 返回模版详情 */
  const goBack = () => {
    Taro.navigateBack({ delta: 2 })
  }

  /** 步骤条（第3步固定高亮） */
  const renderStepBar = () => {
    const steps = [
      { num: 1, label: '填写参数' },
      { num: 2, label: '预览确认' },
      { num: 3, label: '生成结果' },
    ]
    return (
      <View className="tur-step-bar">
        <View className="tur-step-bar-back" onClick={goBack}>
          <ArrowLeft size={18} color="#6b21a8" />
        </View>
        <View className="tur-step-bar-items">
          {steps.map((s, idx) => (
            <View key={s.num} className="tur-step-bar-item-wrap">
              <View className="tur-step-bar-item">
                <View className={`tur-step-bar-num ${s.num === 3 ? 'active' : 'completed'}`}>
                  {s.num < 3 ? (
                    <CircleCheck size={16} color="#ffffff" />
                  ) : (
                    <Text className="tur-step-bar-num-text">{s.num}</Text>
                  )}
                </View>
                <Text className={`tur-step-bar-label ${s.num === 3 ? 'active' : 'completed'}`}>
                  {s.label}
                </Text>
              </View>
              {idx < steps.length - 1 && <View className="tur-step-bar-connector completed" />}
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View className="tur-page">
      {/* 步骤条 */}
      <View style={{ paddingTop: `${statusBarHeight}px` }}>
        {renderStepBar()}
      </View>

      {/* 模板信息 */}
      {templateInfo && (
        <View className="tur-template-card">
          <View className="tur-template-row">
            <View className="tur-template-icon">
              {templateInfo.coverUrl ? (
                <Image className="tur-template-icon-img" src={templateInfo.coverUrl} mode="aspectFill" />
              ) : (
                <View className="tur-template-icon-fallback">
                  <FileText size={28} color="#8b5cf6" />
                </View>
              )}
            </View>
            <View className="tur-template-info">
              <Text className="tur-template-name">{templateInfo.templateName}</Text>
              <Text className="tur-template-desc">{templateInfo.templateDescription}</Text>
              <Text className="tur-template-usage">{formatUseCount(templateInfo.useCount)} 人使用</Text>
            </View>
          </View>
        </View>
      )}

      {/* 生成中状态 */}
      {generating && (
        <View className="tur-progress-card">
          <View className="tur-progress-header">
            <View className="tur-spinner-ring">
              <LoaderCircle size={36} color="#7c3aed" className="tur-spin-icon" />
            </View>
            <Text className="tur-timer">{elapsedSeconds}s</Text>
            <Text className="tur-timer-hint">AI 正在生成中，请耐心等待</Text>
          </View>

          <View className="tur-flow-steps">
            <View className={`tur-flow-step ${['deducting', 'calling_model', 'polling', 'done'].includes(currentStep) ? 'completed' : currentStep === 'creating_task' ? 'active' : ''}`}>
              <View className="tur-flow-step-dot">
                {['deducting', 'calling_model', 'polling', 'done'].includes(currentStep)
                  ? <CircleCheck size={18} color="#10b981" />
                  : currentStep === 'creating_task'
                    ? <LoaderCircle size={18} color="#7c3aed" />
                    : <View className="tur-flow-step-dot-empty" />
                }
              </View>
              <Text className="tur-flow-step-text">创建任务</Text>
            </View>

            <View className="tur-flow-step-line" />

            <View className={`tur-flow-step ${['calling_model', 'polling', 'done'].includes(currentStep) ? 'completed' : currentStep === 'deducting' ? 'active' : ''}`}>
              <View className="tur-flow-step-dot">
                {['calling_model', 'polling', 'done'].includes(currentStep)
                  ? <CircleCheck size={18} color="#10b981" />
                  : currentStep === 'deducting'
                    ? <Coins size={18} color="#7c3aed" />
                    : <View className="tur-flow-step-dot-empty" />
                }
              </View>
              <Text className="tur-flow-step-text">扣除积分</Text>
            </View>

            <View className="tur-flow-step-line" />

            <View className={`tur-flow-step ${currentStep === 'done' ? 'completed' : ['calling_model', 'polling'].includes(currentStep) ? 'active' : ''}`}>
              <View className="tur-flow-step-dot">
                {currentStep === 'done'
                  ? <CircleCheck size={18} color="#10b981" />
                  : ['calling_model', 'polling'].includes(currentStep)
                    ? <Sparkles size={18} color="#7c3aed" />
                    : <View className="tur-flow-step-dot-empty" />
                }
              </View>
              <Text className="tur-flow-step-text">
                {currentStep === 'polling' ? '等待结果...' : '调用模型'}
              </Text>
            </View>

            <View className="tur-flow-step-line" />

            <View className={`tur-flow-step ${currentStep === 'done' ? 'completed' : ''}`}>
              <View className="tur-flow-step-dot">
                {currentStep === 'done'
                  ? <CircleCheck size={18} color="#10b981" />
                  : <View className="tur-flow-step-dot-empty" />
                }
              </View>
              <Text className="tur-flow-step-text">生成完成</Text>
            </View>
          </View>

          <View className="tur-progress-tip">
            <Text className="tur-progress-tip-text">
              {currentStep === 'creating_task' && '正在初始化任务...'}
              {currentStep === 'deducting' && '正在验证并扣除积分...'}
              {currentStep === 'calling_model' && '正在调用AI模型，生成时间取决于内容复杂度'}
              {currentStep === 'polling' && '模型处理中，自动轮询结果...'}
            </Text>
          </View>
        </View>
      )}

      {/* 生成失败 */}
      {!generating && genResult && !genResult.success && (
        <View className="tur-error-card">
          <Text className="tur-error-title">生成失败</Text>
          <Text className="tur-error-text">{genResult.error || '未知错误'}</Text>
          {paidPoints > 0 && (
            <Text className="tur-error-refund">已自动退还 {paidPoints} 积分</Text>
          )}
          <View className="tur-error-actions">
            <Button className="tur-error-btn-back" onClick={goBack}>
              <ArrowLeft size={16} color="#ffffff" />
              <Text>返回重试</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 生成成功 */}
      {!generating && genResult?.success && (
        <>
          {/* 成功提示 */}
          <View className="tur-success-banner">
            <CircleCheck size={44} color="#10b981" />
            <Text className="tur-success-title">生成成功</Text>
            <Text className="tur-success-desc">内容已成功生成并保存</Text>
          </View>

          {/* 生成结果预览 */}
          <View className="tur-result-card">
            <Text className="tur-result-section-title">生成结果预览</Text>

            {genResult.output_type === 'text' && (
              <View className="tur-result-content">
                <View className="tur-result-ai-badge">
                  <Text className="tur-result-ai-text">AI</Text>
                </View>
                <View className="tur-result-body">
                  <Text className="tur-result-title">{getResultTitle()}</Text>
                  <Text className="tur-result-text">{getResultSummary()}</Text>
                </View>
              </View>
            )}

            {genResult.output_type === 'image' && genResult.result.images && (
              <View className="tur-result-images">
                {genResult.result.images.map((url, idx) => (
                  <Image key={idx} className="tur-result-image" src={url} mode="aspectFill" />
                ))}
              </View>
            )}

            <View className="tur-result-meta">
              <View className="tur-result-meta-row">
                <Clock size={14} color="#9ca3af" />
                <Text className="tur-result-meta-text">{certTime}</Text>
              </View>
              {paidPoints > 0 && (
                <View className="tur-result-meta-row">
                  <Coins size={14} color="#9ca3af" />
                  <Text className="tur-result-meta-text">消耗 {paidPoints} 积分</Text>
                </View>
              )}
            </View>
          </View>

          {/* complete 失败重试 */}
          {completeFailed && (
            <View className="tur-retry-card">
              <Text className="block text-sm text-red-500 mb-2">作品保存失败（网络超时），生成内容不会丢失</Text>
              <View className="tur-retry-btn" onClick={handleRetryComplete}>
                <Text className="block text-sm text-white font-medium">重新保存</Text>
              </View>
            </View>
          )}

          {/* 底部操作 */}
          <View className="tur-footer">
            <Button className="tur-footer-btn-back" onClick={goBack}>
              <ArrowLeft size={16} color="#ffffff" />
              <Text>返回模版</Text>
            </Button>
          </View>
        </>
      )}
    </View>
  )
}
