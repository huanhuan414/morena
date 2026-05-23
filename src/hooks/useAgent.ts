/**
 * Agent Hook
 * 用于管理 Agent 执行状态、配置弹窗等
 */

import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { PlatformType } from '@/components/agent/PlatformConfigDialog'
import type { AgentResult, ReActStep } from '@/components/agent/AgentMessageView'

interface AgentExecuteOptions {
  avatarId: string
  taskDescription: string
  conversationId?: string
  taskId?: string
}

interface AgentState {
  loading: boolean
  result: AgentResult | null
  error: string | null
  steps: ReActStep[]
  requiresConfig: boolean
  configPlatform: PlatformType | null
}

export function useAgent() {
  const [state, setState] = useState<AgentState>({
    loading: false,
    result: null,
    error: null,
    steps: [],
    requiresConfig: false,
    configPlatform: null
  })

  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [pendingPlatform, setPendingPlatform] = useState<PlatformType | null>(null)

  /**
   * 执行 Agent 任务
   */
  const executeTask = useCallback(async (options: AgentExecuteOptions): Promise<AgentResult | null> => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      steps: [],
      result: null
    }))

    try {
      console.log('执行 Agent 任务:', options)

      const res = await Network.request({
        url: '/api/agent/execute',
        method: 'POST',
        data: {
          avatar_id: options.avatarId,
          task_description: options.taskDescription,
          conversation_id: options.conversationId,
          task_id: options.taskId
        }
      })

      const taskId = String(res.data?.data?.taskId || '')
      if (!taskId) {
        throw new Error(res.data?.message || '任务提交失败')
      }

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
      for (let i = 0; i < 120; i++) {
        await sleep(1000)
        const resultRes = await Network.request({
          url: `/api/agent/result/${encodeURIComponent(taskId)}`,
          method: 'GET',
        })
        if (resultRes.data?.code === 404) {
          continue
        }
        if (resultRes.data?.code !== 200) {
          continue
        }

        const task = resultRes.data?.data
        const status = String(task?.status || '').toLowerCase()
        if (status === 'pending' || status === 'running') {
          continue
        }

        if (status === 'failed') {
          throw new Error(task?.error || '执行失败')
        }

        const result = task?.result as AgentResult
        if (!result) {
          throw new Error('任务结果为空')
        }

        setState(prev => ({
          ...prev,
          loading: false,
          result,
          steps: result.steps || [],
          requiresConfig: result.requiresConfig || false,
          configPlatform: result.configPlatform || null
        }))

        if (result.requiresConfig && result.configPlatform) {
          setPendingPlatform(result.configPlatform)
          setConfigDialogOpen(true)
        }

        return result
      }

      throw new Error('任务执行超时')
    } catch (err: any) {
      console.error('Agent 执行失败:', err)
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || '执行失败'
      }))
      return null
    }
  }, [])

  /**
   * 检查平台配置
   */
  const checkPlatformConfig = useCallback(async (platform: PlatformType): Promise<{
    configured: boolean
    requiredFields?: any[]
  }> => {
    try {
      const res = await Network.request({
        url: `/api/agent/platform-config/${platform}`,
        method: 'GET'
      })

      return res.data?.data || { configured: false }
    } catch (err) {
      console.error('检查平台配置失败:', err)
      return { configured: false }
    }
  }, [])

  /**
   * 保存平台配置
   */
  const savePlatformConfig = useCallback(async (
    platform: PlatformType,
    configData: Record<string, string>
  ): Promise<boolean> => {
    try {
      const res = await Network.request({
        url: `/api/agent/platform-config/${platform}`,
        method: 'POST',
        data: configData
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '配置成功', icon: 'success' })
        return true
      }

      Taro.showToast({ title: res.data?.message || '配置失败', icon: 'error' })
      return false
    } catch (err) {
      console.error('保存平台配置失败:', err)
      Taro.showToast({ title: '配置失败', icon: 'error' })
      return false
    }
  }, [])

  /**
   * 打开平台配置弹窗
   */
  const openPlatformConfig = useCallback((platform: PlatformType) => {
    setPendingPlatform(platform)
    setConfigDialogOpen(true)
  }, [])

  /**
   * 关闭配置弹窗
   */
  const closeConfigDialog = useCallback(() => {
    setConfigDialogOpen(false)
    setPendingPlatform(null)
  }, [])

  /**
   * 获取平台配置列表
   */
  const getPlatformConfigs = useCallback(async (): Promise<any[]> => {
    try {
      const res = await Network.request({
        url: '/api/agent/platform-configs',
        method: 'GET'
      })

      return res.data?.data || []
    } catch (err) {
      console.error('获取平台配置列表失败:', err)
      return []
    }
  }, [])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      loading: false,
      result: null,
      error: null,
      steps: [],
      requiresConfig: false,
      configPlatform: null
    })
  }, [])

  return {
    // 状态
    ...state,
    configDialogOpen,
    pendingPlatform,

    // 方法
    executeTask,
    checkPlatformConfig,
    savePlatformConfig,
    openPlatformConfig,
    closeConfigDialog,
    getPlatformConfigs,
    reset
  }
}

// 导出类型
export type { AgentResult, ReActStep }
