import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ArrowLeft, FileText, CircleCheck, Clock, LoaderCircle, Coins, Sparkles } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type TemplateInfo = {
  templateName: string
  templateDescription: string
  coverUrl: string
  useCount: number
}

type GenerationResult = {
  success: boolean
  output_type: 'text' | 'image' | 'video' | 'mixed' | null
  result: {
    text?: string
    images?: string[]
    video_url?: string
  }
  task_id: string | null
  error: string | null
}

export default function SkillCertifyResultPage() {
  const statusBarHeight = getStatusBarHeight()
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null)
  const [generating, setGenerating] = useState(true)
  const [genResult, setGenResult] = useState<GenerationResult | null>(null)
  const [paidPoints, setPaidPoints] = useState(0)
  const [completeFailed, setCompleteFailed] = useState(false)
  const completionTaskNoRef = useRef('')
  const [certTime] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)

  /** 流程步骤: creating_task → deducting → calling_model → polling → done / failed */
  type FlowStep = 'creating_task' | 'deducting' | 'calling_model' | 'polling' | 'done' | 'failed'
  const [currentStep, setCurrentStep] = useState<FlowStep>('creating_task')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** 启动读秒计时器 */
  const startElapsedTimer = useCallback(() => {
    setElapsedSeconds(0)
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)
  }, [])

  /** 停止读秒计时器 */
  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => { stopElapsedTimer() }
  }, [stopElapsedTimer])

  /** 格式化使用次数 */
  const formatUseCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}w`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count || 0)
  }

  /** 加载模板基本信息 */
  const loadTemplateInfo = useCallback(async (tplId: number) => {
    try {
      const res = await Network.request({ url: `/api/ai-avatar/templates/${tplId}/detail` })
      const data = (res.data as any)?.data
      if (data) {
        setTemplateInfo({
          templateName: data.templateName,
          templateDescription: data.templateDescription,
          coverUrl: data.coverUrl,
          useCount: data.useCount,
        })
      }
    } catch { /* ignore */ }
  }, [])

  /** 停止轮询 */
  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollCountRef.current = 0
  }

  /**
   * 提交模型结果到后端（仅用于手动重试场景——任务已有结果但落作品失败时）
   */
  const handleRetryComplete = async () => {
    const curTaskNo = completionTaskNoRef.current
    if (!curTaskNo) return

    setCompleteFailed(false)
    try {
      const res = await Network.request({
        url: `/api/ai-avatar/generation-tasks/${encodeURIComponent(curTaskNo)}/retry-save`,
        method: 'POST',
        timeout: 120000,
      })
      const resData = (res.data as any)
      if (resData?.code === 200) {
        setCompleteFailed(false)
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        setCompleteFailed(true)
        Taro.showToast({ title: resData?.msg || '保存失败，请重试', icon: 'none', duration: 3000 })
      }
    } catch {
      setCompleteFailed(true)
      Taro.showToast({ title: '网络错误，请重试', icon: 'none', duration: 3000 })
    }
  }

  /** 轮询异步任务（后端 pollGenerationTask 自动处理落作品） */
  const startPolling = useCallback((curTaskNo: string) => {
    pollCountRef.current = 0
    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current++
      if (pollCountRef.current > 60) {
        stopPolling()
        stopElapsedTimer()
        setCurrentStep('failed')
        setGenerating(false)
        setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: '轮询超时，任务可能仍在进行' })
        return
      }
      try {
        const res = await Network.request({
          url: `/api/ai-avatar/generation-tasks/${encodeURIComponent(curTaskNo)}/poll`,
        })
        const resData = (res.data as any)
        if (resData?.code === 200 && resData.data?.success) {
          stopPolling()
          stopElapsedTimer()
          setCurrentStep('done')
          setGenerating(false)
          setGenResult({ success: true, output_type: 'image', result: {}, task_id: null, error: null })
        } else if (resData?.data?.status === '生成失败') {
          stopPolling()
          stopElapsedTimer()
          setCurrentStep('failed')
          setGenerating(false)
          setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: resData.data?.error || '生成失败' })
        }
      } catch {
        stopPolling()
        stopElapsedTimer()
        setCurrentStep('failed')
        setGenerating(false)
        setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: '轮询网络错误' })
      }
    }, 3000)
  }, [stopElapsedTimer])

  /**
   * 核心流程：创建任务→扣积分→后端调用模型并落作品
   */
  const runFullFlow = useCallback(async (tplId: number, avId: number, filledPrompt: string, inputParams: Record<string, string>, materialValues: Record<string, string>) => {
    setGenerating(true)
    setGenResult(null)
    setCompleteFailed(false)
    setCurrentStep('creating_task')
    startElapsedTimer()

    // ── 步骤1：创建任务 + 扣积分 ──
    setCurrentStep('deducting')
    const idempotencyKey = `certify_${tplId}_${avId}_${Date.now()}`
    let curTaskNo = ''
    try {
      const taskRes = await Network.request({
        url: '/api/ai-avatar/generation-tasks',
        method: 'POST',
        data: { avatarId: avId, templateId: tplId, inputParams, idempotencyKey },
        timeout: 60000,
      })
      const taskData = (taskRes.data as any)?.data
      if (!taskData?.success) {
        setCurrentStep('failed')
        stopElapsedTimer()
        setGenerating(false)
        setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: taskData?.error || '创建任务失败' })
        return
      }
      curTaskNo = taskData.taskNo
      setPaidPoints(taskData.paidPoints || 0)
    } catch (err: any) {
      setCurrentStep('failed')
      stopElapsedTimer()
      setGenerating(false)
      const msg = err?.errMsg || err?.message || '网络错误'
      setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: msg.includes('积分余额不足') ? '积分不足，请先充值' : msg })
      return
    }

    // ── 步骤2：后端执行模型调用 + 落作品（一步到位） ──
    setCurrentStep('calling_model')
    try {
      const res = await Network.request({
        url: `/api/ai-avatar/generation-tasks/${encodeURIComponent(curTaskNo)}/execute`,
        method: 'POST',
        data: { filledPrompt, materialValues },
        timeout: 180000,
      })
      const resData = (res.data as any)
      if (resData?.code === 200) {
        setCurrentStep('done')
        stopElapsedTimer()
        setGenerating(false)
        const preview = resData.data?.preview || {}
        setGenResult({ success: true, output_type: preview.output_type || 'text', result: preview, task_id: null, error: null })
      } else if (resData?.code === 202 && resData.data?.pending) {
        setCurrentStep('polling')
        completionTaskNoRef.current = curTaskNo
        startPolling(curTaskNo)
      } else {
        const errorMsg = resData?.msg || '生成失败'
        const isSaveError = errorMsg.includes('作品保存失败')
        if (isSaveError) {
          setCurrentStep('done')
          completionTaskNoRef.current = curTaskNo
          setCompleteFailed(true)
          setGenResult({ success: true, output_type: null, result: {}, task_id: null, error: null })
        } else {
          setCurrentStep('failed')
          setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: errorMsg })
        }
        stopElapsedTimer()
        setGenerating(false)
      }
    } catch (err: any) {
      setCurrentStep('failed')
      stopElapsedTimer()
      setGenerating(false)
      const msg = err?.errMsg || err?.message || '网络错误'
      setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: msg.includes('timeout') ? '模型调用超时，请重试' : msg })
    }
  }, [startPolling, startElapsedTimer, stopElapsedTimer])

  useLoad((options) => {
    const tplId = Number(options?.templateId || 0)
    const avId = Number(options?.avatarId || 0)
    const filledPrompt = decodeURIComponent(options?.filledPrompt || '')
    let inputParams: Record<string, string> = {}
    try { inputParams = JSON.parse(decodeURIComponent(options?.inputParams || '{}')) } catch { /* ignore */ }
    let materialValues: Record<string, string> = {}
    try { materialValues = JSON.parse(decodeURIComponent(options?.materialValues || '{}')) } catch { /* ignore */ }

    if (tplId > 0) {
      void loadTemplateInfo(tplId)
    }

    if (tplId > 0 && avId > 0 && filledPrompt) {
      void runFullFlow(tplId, avId, filledPrompt, inputParams, materialValues)
    } else {
      setGenerating(false)
      setGenResult({ success: false, output_type: null, result: {}, task_id: null, error: '缺少生成参数' })
    }
  })

  /** 添加到分身（认证成功后模板已自动标记为已启用） */
  const handleAddToAvatar = () => {
    Taro.showToast({ title: '技能认证成功，已启用', icon: 'success' })
    setTimeout(() => {
      Taro.redirectTo({ url: '/package-my-avatar/pages/my-avatar/index' })
    }, 1500)
  }

  /** 提取生成标题（取前30字符） */
  const getResultTitle = () => {
    const text = genResult?.result?.text || ''
    const firstLine = text.split('\n').find(l => l.trim()) || ''
    if (firstLine.length > 30) return firstLine.substring(0, 30) + '...'
    return firstLine || '生成结果'
  }

  /** 提取摘要（去标题后取前100字符） */
  const getResultSummary = () => {
    const text = genResult?.result?.text || ''
    const lines = text.split('\n').filter(l => l.trim())
    const content = lines.slice(1).join('\n').trim()
    if (content.length > 100) return content.substring(0, 100) + '...'
    return content || text.substring(0, 100)
  }

  return (
    <View className="scr-page">
      {/* 顶部导航 */}
      <View className="scr-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="scr-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#1a1a2e" />
        </View>
        <Text className="scr-header-title">技能体验结果</Text>
      </View>

      {/* 模板信息卡片 */}
      {templateInfo && (
        <View className="scr-template-card">
          <View className="scr-template-row">
            <View className="scr-template-icon">
              {templateInfo.coverUrl ? (
                <Image className="scr-template-icon-img" src={templateInfo.coverUrl} mode="aspectFill" />
              ) : (
                <FileText size={32} color="#10b981" />
              )}
            </View>
            <View className="scr-template-info">
              <View className="scr-template-name-row">
                <Text className="scr-template-name">{templateInfo.templateName}</Text>
                {genResult?.success && (
                  <View className="scr-template-badge scr-badge-certified">
                    <Text>已认证</Text>
                  </View>
                )}
              </View>
              <Text className="scr-template-desc">{templateInfo.templateDescription}</Text>
            </View>
          </View>
          <View className="scr-template-footer">
            <Text className="scr-template-usage">{formatUseCount(templateInfo.useCount)} 人使用</Text>
            <Text className="scr-template-detail-btn">查看详情</Text>
          </View>
        </View>
      )}

      {/* 生成中状态 - 动态等待页 */}
      {generating && (
        <View className="scr-section">
          <Text className="scr-section-title">生成进度</Text>
          <View className="scr-result-card">
            <View className="scr-generating-dynamic">
              {/* 旋转图标 + 读秒器 */}
              <View className="scr-timer-area">
                <View className="scr-spinner-ring">
                  <LoaderCircle size={40} color="#7c3aed" className="scr-spin-icon" />
                </View>
                <Text className="scr-timer-text">{elapsedSeconds}s</Text>
                <Text className="scr-timer-hint">AI正在生成中，请耐心等待</Text>
              </View>

              {/* 流程步骤 */}
              <View className="scr-steps-progress">
                <View className={`scr-step-item ${currentStep === 'creating_task' ? 'active' : ''} ${['deducting','calling_model','polling','done'].includes(currentStep) ? 'completed' : ''}`}>
                  <View className="scr-step-dot">
                    {['deducting','calling_model','polling','done'].includes(currentStep)
                      ? <CircleCheck size={16} color="#10b981" />
                      : currentStep === 'creating_task'
                        ? <LoaderCircle size={16} color="#7c3aed" />
                        : <View className="scr-step-dot-empty" />
                    }
                  </View>
                  <Text className="scr-step-text">创建任务</Text>
                </View>

                <View className="scr-step-line" />

                <View className={`scr-step-item ${currentStep === 'deducting' ? 'active' : ''} ${['calling_model','polling','done'].includes(currentStep) ? 'completed' : ''}`}>
                  <View className="scr-step-dot">
                    {['calling_model','polling','done'].includes(currentStep)
                      ? <CircleCheck size={16} color="#10b981" />
                      : currentStep === 'deducting'
                        ? <Coins size={16} color="#7c3aed" />
                        : <View className="scr-step-dot-empty" />
                    }
                  </View>
                  <Text className="scr-step-text">扣除积分</Text>
                </View>

                <View className="scr-step-line" />

                <View className={`scr-step-item ${['calling_model','polling'].includes(currentStep) ? 'active' : ''} ${currentStep === 'done' ? 'completed' : ''}`}>
                  <View className="scr-step-dot">
                    {currentStep === 'done'
                      ? <CircleCheck size={16} color="#10b981" />
                      : ['calling_model','polling'].includes(currentStep)
                        ? <Sparkles size={16} color="#7c3aed" />
                        : <View className="scr-step-dot-empty" />
                    }
                  </View>
                  <Text className="scr-step-text">
                    {currentStep === 'polling' ? '等待结果...' : '调用模型'}
                  </Text>
                </View>

                <View className="scr-step-line" />

                <View className={`scr-step-item ${currentStep === 'done' ? 'completed' : ''}`}>
                  <View className="scr-step-dot">
                    {currentStep === 'done'
                      ? <CircleCheck size={16} color="#10b981" />
                      : <View className="scr-step-dot-empty" />
                    }
                  </View>
                  <Text className="scr-step-text">生成完成</Text>
                </View>
              </View>

              {/* 底部提示 */}
              <View className="scr-gen-tips">
                <Text className="scr-gen-tip-text">
                  {currentStep === 'creating_task' && '正在初始化任务...'}
                  {currentStep === 'deducting' && '正在验证并扣除积分...'}
                  {currentStep === 'calling_model' && '正在调用AI模型，生成时间取决于内容复杂度'}
                  {currentStep === 'polling' && '模型处理中，自动轮询结果...'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 生成失败 */}
      {!generating && genResult && !genResult.success && (
        <View className="scr-error-card">
          <Text className="scr-error-text">生成失败：{genResult.error || '未知错误'}</Text>
          {paidPoints > 0 && (
            <Text className="scr-error-refund">已自动退还 {paidPoints} 积分</Text>
          )}
        </View>
      )}

      {/* 生成成功 - 结果预览 */}
      {!generating && genResult?.success && (
        <>
          <View className="scr-section">
            <Text className="scr-section-title">生成结果预览</Text>
            <View className="scr-result-card">
              {/* 文字结果 */}
              {genResult.output_type === 'text' && (
                <View className="scr-result-content">
                  <View className="scr-result-ai-icon">
                    <Text className="scr-result-ai-text">AI</Text>
                  </View>
                  <View className="scr-result-body">
                    <Text className="scr-result-title">{getResultTitle()}</Text>
                    <Text className="scr-result-text">{getResultSummary()}</Text>
                  </View>
                </View>
              )}

              {/* 图片结果 */}
              {genResult.output_type === 'image' && genResult.result.images && (
                <View className="scr-result-images">
                  {genResult.result.images.map((url, idx) => (
                    <Image key={idx} className="scr-result-image" src={url} mode="aspectFill" />
                  ))}
                </View>
              )}

              <View className="scr-result-meta">
                <Text className="scr-result-time">{certTime}</Text>
                <Text className="scr-result-view-btn">查看全文</Text>
              </View>
            </View>
          </View>

          {/* 认证成功 */}
          <View className="scr-cert-success">
            <CircleCheck size={48} color="#10b981" />
            <Text className="scr-cert-success-title">认证成功</Text>
            <Text className="scr-cert-success-desc">你已成功使用一次该技能，可立即添加到分身</Text>
          </View>

          {/* 认证信息 */}
          <View className="scr-cert-info">
            <View className="scr-cert-info-title">
              <View className="scr-cert-info-bar" />
              <Text className="scr-cert-info-label">认证信息</Text>
            </View>
            <View className="scr-cert-info-row">
              <Clock size={14} color="#9ca3af" />
              <Text className="scr-cert-info-key">体验记录：</Text>
              <Text className="scr-cert-info-val">1次</Text>
            </View>
            {paidPoints > 0 && (
              <View className="scr-cert-info-row">
                <Clock size={14} color="#9ca3af" />
                <Text className="scr-cert-info-key">消耗积分：</Text>
                <Text className="scr-cert-info-val">{paidPoints} 积分</Text>
              </View>
            )}
            <View className="scr-cert-info-row">
              <Clock size={14} color="#9ca3af" />
              <Text className="scr-cert-info-key">认证时间：</Text>
              <Text className="scr-cert-info-val">刚刚</Text>
            </View>
            <View className="scr-cert-info-row">
              <CircleCheck size={14} color="#10b981" />
              <Text className="scr-cert-info-key">认证状态：</Text>
              <Text className="scr-cert-info-val scr-cert-info-status">已完成</Text>
            </View>
          </View>

          {/* complete 失败重试提示 */}
          {completeFailed && (
            <View className="scr-complete-retry">
              <Text className="block text-sm text-red-500 mb-2">作品保存失败（网络超时），生成内容不会丢失</Text>
              <View className="scr-complete-retry-btn" onClick={handleRetryComplete}>
                <Text className="block text-sm text-white font-medium">重新保存</Text>
              </View>
            </View>
          )}

          {/* 底部操作按钮 */}
          <View className="scr-footer">
            <View className="scr-footer-btn-full" onClick={handleAddToAvatar}>
              <FileText size={18} color="#ffffff" />
              <Text className="scr-footer-btn-full-text">添加到分身</Text>
            </View>
            <Text className="scr-footer-hint">该技能已加入你的已认证列表，可随时在「我的技能」中查看</Text>
          </View>
        </>
      )}
    </View>
  )
}
