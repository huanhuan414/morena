import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

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

/** 流程步骤 */
export type FlowStep = 'creating_task' | 'deducting' | 'calling_model' | 'polling' | 'done' | 'failed'

/**
 * 生成结果共享逻辑 Hook
 * 供"技能认证结果页"和"模版使用结果页"复用
 */
export function useGenerationResult() {
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

  /** 重试保存 */
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

  /** 轮询异步任务 */
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

  /** 核心流程：创建任务→扣积分→后端调用模型并落作品 */
  const runFullFlow = useCallback(async (tplId: number, avId: number, filledPrompt: string, inputParams: Record<string, string>, materialValues: Record<string, string>) => {
    setGenerating(true)
    setGenResult(null)
    setCompleteFailed(false)
    setCurrentStep('creating_task')
    startElapsedTimer()

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

  /** 初始化并执行 */
  const initAndRun = useCallback((options: Record<string, string | undefined>) => {
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
  }, [loadTemplateInfo, runFullFlow])

  /** 提取生成标题 */
  const getResultTitle = () => {
    const text = genResult?.result?.text || ''
    const firstLine = text.split('\n').find(l => l.trim()) || ''
    if (firstLine.length > 30) return firstLine.substring(0, 30) + '...'
    return firstLine || '生成结果'
  }

  /** 提取摘要 */
  const getResultSummary = () => {
    const text = genResult?.result?.text || ''
    const lines = text.split('\n').filter(l => l.trim())
    const content = lines.slice(1).join('\n').trim()
    if (content.length > 100) return content.substring(0, 100) + '...'
    return content || text.substring(0, 100)
  }

  return {
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
  }
}
