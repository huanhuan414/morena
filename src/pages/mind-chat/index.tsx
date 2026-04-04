// eslint-disable-next-line no-restricted-syntax
import { View, Text, ScrollView, Image, Video, Input } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useRouter, redirectTo, showToast } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { PlatformConfigDialog, PlatformType } from '@/components/agent/PlatformConfigDialog'
import { PublishGuideDialog, PLATFORM_CONFIGS } from '@/components/agent/PublishGuideDialog'
import MarkdownRender from '@/components/markdown-render'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Send, Sparkles, Bot, Copy, History, X, Brain, TrendingUp, Award, Target,
  MessageCircle, Mic, Keyboard, Loader, Zap, Check, Download, ChevronDown, ChevronUp
} from 'lucide-react-taro'
import './index.css'

interface MessageMedia {
  type: 'image' | 'video' | 'article'
  url?: string
  key?: string
  content?: string
  title?: string
  coverImage?: string  // 文章封面图
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  metadata?: {
    media_keys?: string[]
    media_urls?: Record<string, string>
    media?: MessageMedia[]
    agent_result?: AgentResult
    agent_steps?: AgentStepDisplay[]
  }
}

// Agent 步骤展示
interface AgentStepDisplay {
  action: string
  displayName: string
  status: 'success' | 'failed' | 'running'
  message: string
}

interface Conversation {
  id: string
  title: string
  avatar_id: string
  avatars?: {
    name: string
    avatar_url: string
  }
  created_at: string
  updated_at: string
}

// Agent 执行步骤
interface ReActStep {
  step_index: number
  thought: string
  action?: string
  action_input?: any
  observation?: any
  requires_config?: boolean
  config_platform?: PlatformType
  config_fields?: any[]
}

// Agent 执行结果
interface AgentResult {
  success: boolean
  finalAnswer: string
  steps: ReActStep[]
  requiresConfig: boolean
  configPlatform?: PlatformType
  configFields?: any[]
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  exp?: number
  config?: {
    learning?: {
      messageCount: number
      avgMessageLength: number
      commonPhrases: string[]
      emotions: string[]
      topics: string[]
    }
    style?: string
    skills?: string[]  // 分身技能列表
  }
}

interface LearningStats {
  messageCount: number
  learningDays: number
  masteryLevel: number
  avgMessageLength: number
  styleMatch: number
  // 学习特征
  toneProfile?: {
    formal: number
    casual: number
    humorous: number
    emotional: number
  }
  personalityTraits?: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  }
  communicationStyle?: {
    direct: number
    polite: number
    detailed: number
    concise: number
  }
  interests?: string[]
  commonPhrases?: string[]
  userIdentity?: {
    occupation?: string
    education?: string
    personalityType?: string
    lifeEvents?: string[]
  }
}

// 工具名称映射（用于友好展示）
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'write_wechat_mp_article': '撰写公众号图文',
  'write_xiaohongshu_note': '撰写小红书笔记',
  'write_article': '撰写文章',
  'generate_image': '生成图片',
  'generate_video': '生成视频',
  'publish_wechat_mp': '发布到公众号',
  'publish_xiaohongshu': '发布到小红书',
  'publish_bilibili': '发布到B站',
  'publish_weibo': '发布到微博',
  'publish_douyin': '发布到抖音',
  'publish_wechat_video': '发布到视频号',
  'check_platform_config': '检查平台配置',
  'app_create_task': '创建任务',
  'app_list_tasks': '查看任务列表',
  'app_create_order': '创建订单'
}

// 进度事件类型
interface TaskProgressEvent {
  taskId: string
  userId: string
  type: 'start' | 'progress' | 'thinking' | 'action' | 'observation' | 'complete' | 'error'
  message: string
  data?: {
    action?: string
    displayName?: string
    success?: boolean
    params?: any
    message?: string
    data?: any
  }
  timestamp: number
}

// 解析 Markdown 为段落数组，用于分段渲染
export default function MindChatPage() {
  const router = useRouter()
  const { isLoggedIn, userInfo } = useUserStore()
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)  // 用于在闭包中获取最新的 loading 状态
  const [showHistory, setShowHistory] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [learningStats, setLearningStats] = useState<LearningStats>({
    messageCount: 0,
    learningDays: 0,
    masteryLevel: 0,
    avgMessageLength: 0,
    styleMatch: 0
  })
  
  // 学习动画状态
  const [showLearningEffect, setShowLearningEffect] = useState(false)
  const [learningProgress, setLearningProgress] = useState<{
    oldCount: number
    newCount: number
    expGained: number
  } | null>(null)
  const [learnPanelCollapsed, setLearnPanelCollapsed] = useState(false)
  const [learnPanelExpanded, setLearnPanelExpanded] = useState(false) // 控制详细内容的展开/折叠
  
  // 记录发送消息前的 messageCount，用于检测学习进度
  const messageCountBeforeSendRef = useRef<number>(0)
  
  // 学习详情弹窗
  const [showLearningDetail, setShowLearningDetail] = useState<'dialog' | 'days' | 'mastery' | 'level' | 'identity' | 'style' | 'interests' | 'phrases' | null>(null)
  
  // Agent 实时状态（每个分身都是 Agent）
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [agentSteps, setAgentSteps] = useState<AgentStepDisplay[]>([])
  
  // 轮询定时器
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProgressCountRef = useRef<number>(0)
  
  const [scrollIntoView, setScrollIntoView] = useState('')
  const isFirstLoadRef = useRef<boolean>(true)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 使用 scrollTop 滚动到底部
  const [scrollTop, setScrollTop] = useState(0)
  // 滚动计数器，确保每次 scrollTop 值都不同
  const scrollCounterRef = useRef(0)
  
  // 消息加载状态
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // 平台配置弹窗
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [configPlatform, setConfigPlatform] = useState<PlatformType | null>(null)
  
  // 配置成功后待重试的消息
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  
  // 待发布的内容（用于发布确认）
  const [pendingPublish, setPendingPublish] = useState<{
    platform: PlatformType
    content: {
      title?: string
      content?: string
      coverImage?: string
      images?: string[]
      tags?: string[]
    }
  } | null>(null)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  
  // 发布引导弹窗（用于无 API 的平台）
  const [showPublishGuide, setShowPublishGuide] = useState(false)
  const [publishGuideData, setPublishGuideData] = useState<{
    platform: keyof typeof PLATFORM_CONFIGS
    content: {
      title?: string
      content?: string
      images?: string[]
      tags?: string[]
      videoUrl?: string
    }
  } | null>(null)
  
  // H5链接弹窗（小程序环境）
  const [showH5PublishDialog, setShowH5PublishDialog] = useState(false)
  const [h5PublishUrl, setH5PublishUrl] = useState('')

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/login/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchConversations()
      
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false
        const avatarId = router.params.avatarId
        if (avatarId) {
          fetchAvatar(avatarId)
          fetchOrCreateConversation(avatarId)
        } else {
          fetchDefaultAvatar()
        }
      }
      
      // 延迟获取学习数据，确保 avatar 已加载
      setTimeout(() => {
        fetchLearningStats()
      }, 500)
    }
  })
  
  // 当前任务的 taskId（用于轮询时传递）
  const currentTaskIdRef = useRef<string | null>(null)
  
  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      stopProgressPolling()
      stopResultPolling()
    }
  }, [])
  
  /**
   * 开始轮询进度
   */
  const startProgressPolling = (taskId: string) => {
    // 先清除之前的定时器
    stopProgressPolling()
    currentTaskIdRef.current = taskId
    lastProgressCountRef.current = 0
    
    // 立即查询一次
    fetchProgress(taskId)
    
    // 每 500ms 轮询一次
    pollingTimerRef.current = setInterval(() => {
      fetchProgress(taskId)
    }, 500)
  }
  
  /**
   * 停止轮询进度
   */
  const stopProgressPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    currentTaskIdRef.current = null
  }
  
  /**
   * 获取进度（指定 taskId）
   */
  const fetchProgress = async (taskId: string) => {
    try {
      const res = await Network.request({ 
        url: `/api/agent/progress?taskId=${taskId}` 
      })
      
      if (res.data?.code === 200) {
        const progressData = res.data.data || {}
        const { progress, latest } = progressData
        
        // 处理所有进度（从上次处理的位置开始）
        if (progress && Array.isArray(progress) && progress.length > 0) {
          // 找到未处理的进度
          const startIndex = lastProgressCountRef.current
          const newProgress = progress.slice(startIndex)
          
          // 更新已处理的进度数量
          lastProgressCountRef.current = progress.length
          
          // 处理每个新的进度
          newProgress.forEach((p: TaskProgressEvent) => {
            console.log('[MindChat] 处理进度:', p.type, p.message)
            handleTaskProgress(p)
          })
        }
        
        // 如果任务完成，停止轮询
        if (latest?.type === 'complete' || latest?.type === 'error') {
          stopProgressPolling()
        }
      }
    } catch (err) {
      console.error('[MindChat] 获取进度失败:', err)
    }
  }
  
  /**
   * 处理任务进度
   */
  const handleTaskProgress = (progress: TaskProgressEvent) => {
    console.log('[MindChat] 收到进度:', progress.type, progress.message)
    
    switch (progress.type) {
      case 'start':
        setCurrentStatus('开始分析任务...')
        break
        
      case 'progress':
        setCurrentStatus(progress.message)
        break
        
      case 'thinking':
        setCurrentStatus(`🤔 ${progress.message}`)
        break
        
      case 'action':
        // 执行工具时，添加新的步骤
        setCurrentStatus(`⚡ 正在执行: ${progress.data?.displayName || progress.message}`)
        if (progress.data?.action) {
          const actionName = progress.data.action
          const displayName = progress.data.displayName || actionName
          setAgentSteps(prev => {
            const newStep: AgentStepDisplay = {
              action: actionName,
              displayName: displayName,
              status: 'running',
              message: progress.message
            }
            // 检查是否已存在相同的 action，避免重复添加
            const exists = prev.some(s => s.action === newStep.action)
            if (!exists) {
              return [...prev, newStep]
            }
            return prev
          })
        }
        break
        
      case 'observation':
        // 工具执行完成，更新步骤状态
        setCurrentStatus(progress.data?.success ? '✅ 执行成功' : '❌ 执行失败')
        if (progress.data?.action) {
          setAgentSteps(prev => prev.map(step => 
            step.action === progress.data!.action 
              ? { 
                  ...step, 
                  status: progress.data!.success ? 'success' : 'failed',
                  message: progress.data!.message || ''
                }
              : step
          ))
        }
        break
        
      case 'complete':
        setCurrentStatus('✅ 任务完成')
        // 如果 HTTP 请求失败但收到了 complete 事件，关闭 loading
        // HTTP 请求成功时会调用 processAgentResult 关闭 loading
        setTimeout(() => {
          if (loadingRef.current) {
            console.log('[MindChat] HTTP 请求未返回，但从轮询收到 complete，关闭 loading')
            setLoading(false)
            loadingRef.current = false
            // 添加一条简单的完成消息
            const aiMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: '任务已完成，请查看上方步骤详情或刷新页面查看结果。',
              created_at: new Date().toISOString()
            }
            setMessages(prev => [...prev, aiMessage])
            scrollToBottom()
          }
        }, 1000)
        break
        
      case 'error':
        setCurrentStatus(`❌ ${progress.message}`)
        // 错误时也关闭 loading
        setLoading(false)
        loadingRef.current = false
        break
    }
  }

  // 新消息时滚动到底部（排除加载历史消息的情况）
  const shouldScrollToBottomRef = useRef(true)
  
  useEffect(() => {
    // 只有在需要滚动到底部时才滚动（新消息、发送消息时）
    if (shouldScrollToBottomRef.current && messages.length > 0) {
      // 延迟确保消息完全渲染
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [messages.length, loading, currentStatus])

  const fetchConversations = async () => {
    try {
      const res = await Network.request({ url: '/api/chat/conversations' })
      if (res.data?.code === 200) {
        setConversations(res.data.data || [])
      }
    } catch (error) {
      console.error('[MindChat] 获取对话列表失败:', error)
    }
  }

  const fetchLearningStats = async (showEffect: boolean = false) => {
    console.log('[MindChat] fetchLearningStats 被调用, showEffect:', showEffect)
    try {
      // 获取当前分身ID（优先使用当前选中的分身）
      let targetAvatarId = avatar?.id
      
      // 如果没有选中的分身，获取用户第一个分身
      if (!targetAvatarId) {
        const res = await Network.request({ url: '/api/avatar' })
        if (res.data?.code === 200 && res.data.data?.length > 0) {
          targetAvatarId = res.data.data[0].id
          setAvatar(res.data.data[0])
        }
      }
      
      if (!targetAvatarId) return
      
      const res = await Network.request({ url: `/api/avatar/${targetAvatarId}/learning` })
      if (res.data?.code === 200 && res.data.data) {
        const { learning, metrics } = res.data.data
        if (learning && metrics) {
          const newStats = {
            messageCount: learning.messageCount || 0,
            learningDays: metrics.learningDays || 1,
            masteryLevel: metrics.masteryLevel || 0,
            styleMatch: metrics.styleMatch || 0,
            avgMessageLength: learning.avgMessageLength || 0,
            toneProfile: learning.toneProfile,
            personalityTraits: learning.personalityTraits,
            communicationStyle: learning.communicationStyle,
            interests: learning.interests,
            commonPhrases: learning.commonPhrases,
            userIdentity: learning.userIdentity
          }
          
          // 如果显示学习特效且有消息数量变化
          // 使用 messageCountBeforeSendRef 来检测变化（发送消息前记录的值）
          const oldMessageCount = messageCountBeforeSendRef.current
          console.log('[MindChat] 学习数据:', { 
            oldMessageCount, 
            newMessageCount: newStats.messageCount,
            showEffect,
            willShowEffect: showEffect && newStats.messageCount > oldMessageCount
          })
          
          if (showEffect && newStats.messageCount > oldMessageCount) {
            console.log('[MindChat] 🎉 触发学习特效!')
            setLearningProgress({
              oldCount: oldMessageCount,
              newCount: newStats.messageCount,
              expGained: 10 // 每条消息获得10经验
            })
            setShowLearningEffect(true)
            
            // 3秒后隐藏特效
            setTimeout(() => {
              setShowLearningEffect(false)
              setLearningProgress(null)
            }, 3000)
          }
          
          setLearningStats(newStats)
        }
      }
    } catch (error) {
      console.error('[MindChat] 获取学习数据失败:', error)
    }
  }

  const fetchDefaultAvatar = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const defaultAvatar = res.data.data[0]
        setAvatar(defaultAvatar)
        fetchOrCreateConversation(defaultAvatar.id)
      }
    } catch (error) {
      console.error('[MindChat] 获取分身失败:', error)
    }
  }

  const fetchAvatar = async (avatarId: string) => {
    try {
      const res = await Network.request({ url: `/api/avatar/${avatarId}` })
      if (res.data?.code === 200) {
        setAvatar(res.data.data)
      }
    } catch (error) {
      console.error('[MindChat] 获取分身失败:', error)
    }
  }

  const fetchOrCreateConversation = async (avatarId: string) => {
    try {
      const conversationsRes = await Network.request({ url: '/api/chat/conversations' })
      
      if (conversationsRes.data?.code === 200 && conversationsRes.data.data?.length > 0) {
        const latestConv = conversationsRes.data.data[0]
        setConversation(latestConv)
        // 启用滚动到底部
        shouldScrollToBottomRef.current = true
        await fetchMessages(latestConv.id)
      } else {
        const res = await Network.request({
          url: '/api/chat/conversation',
          method: 'POST',
          data: { avatar_id: avatarId }
        })
        if (res.data?.code === 200) {
          setConversation(res.data.data)
          setMessages([])
        }
      }
    } catch (error) {
      console.error('[MindChat] 获取对话失败:', error)
    }
  }

  // 获取最新消息（初始加载）
  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await Network.request({
        url: `/api/chat/conversation/${conversationId}/messages?limit=20`
      })
      if (res.data?.code === 200) {
        const data = res.data.data || []
        setMessages(data)
        setHasMoreMessages(data.length >= 20)
        // 确保启用滚动到底部
        shouldScrollToBottomRef.current = true
        // useEffect 会在 messages 变化时自动滚动
        // 这里额外延迟滚动确保成功（双重保障）
        setTimeout(() => {
          scrollToBottom()
        }, 200)
        setTimeout(() => {
          scrollToBottom()
        }, 500)
      }
    } catch (error) {
      console.error('[MindChat] 获取消息失败:', error)
    }
  }

  // 加载更多历史消息（下拉刷新）
  const loadMoreMessages = async () => {
    if (!conversation || !hasMoreMessages || isLoadingMore) return
    
    setIsLoadingMore(true)
    // 加载历史消息时，禁止滚动到底部
    shouldScrollToBottomRef.current = false
    try {
      const oldestMessage = messages[0]
      const res = await Network.request({
        url: `/api/chat/conversation/${conversation.id}/messages?limit=20&before=${oldestMessage?.id}`
      })
      if (res.data?.code === 200) {
        const newMessages = res.data.data || []
        if (newMessages.length > 0) {
          setMessages(prev => [...newMessages, ...prev])
          setHasMoreMessages(newMessages.length >= 20)
        } else {
          setHasMoreMessages(false)
        }
      }
    } catch (error) {
      console.error('[MindChat] 加载更多消息失败:', error)
    } finally {
      setIsLoadingMore(false)
      setRefreshing(false)
      // 恢复滚动到底部的行为
      setTimeout(() => {
        shouldScrollToBottomRef.current = true
      }, 500)
    }
  }

  const switchConversation = async (conv: Conversation) => {
    setConversation(conv)
    setMessages([])
    // 切换对话时，启用滚动到底部
    shouldScrollToBottomRef.current = true
    await fetchMessages(conv.id)
    setShowHistory(false)
    showToast({ title: '已切换对话', icon: 'success', duration: 1000 })
  }

  const scrollToBottom = () => {
    // 方法1：使用 scrollTop 滚动到底部
    scrollCounterRef.current += 1
    const newScrollTop = 999999 + scrollCounterRef.current
    setScrollTop(newScrollTop)
    
    // 方法2：使用 scrollIntoView 滚动到最后一条消息
    // 计算最后一条消息的 id
    if (messages.length > 0) {
      const lastMsgId = `msg-${messages.length - 1}`
      setScrollIntoView(lastMsgId)
    }
  }

  // 发送消息 - 每个分身都是 Agent，默认启用 Agent 能力
  const sendMessage = async (text?: string) => {
    const messageText = text || inputText
    if (!messageText.trim() || !conversation || loading) {
      showToast({ title: '请输入消息', icon: 'none' })
      return
    }

    // 发送消息前，记录当前的 messageCount
    messageCountBeforeSendRef.current = learningStats.messageCount
    console.log('[MindChat] 发送消息前记录 messageCount:', learningStats.messageCount)

    // 发送消息时，确保滚动到底部
    shouldScrollToBottomRef.current = true

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setLoading(true)
    loadingRef.current = true
    setAgentSteps([])  // 清空之前的步骤
    setCurrentStatus('思考中...')
    
    // 立即滚动到底部，显示新消息
    setTimeout(() => {
      scrollToBottom()
    }, 50)

    try {
      // 所有消息都通过 Agent 处理，Agent 会自动判断是简单对话还是需要执行工具
      await executeAsAgent(messageText)
    } catch (error) {
      console.error('Agent 执行失败:', error)
      // 降级为普通对话
      await fallbackToNormalChat(messageText)
    }
  }

  // Agent 执行 - 纯轮询模式（解决 HTTP 超时问题）
  const executeAsAgent = async (content: string) => {
    try {
      // 先停止之前的轮询，避免旧任务干扰
      stopProgressPolling()
      stopResultPolling()
      setAgentSteps([])
      lastProgressCountRef.current = 0
      
      console.log('[MindChat] 开始执行 Agent 任务:', content)
      console.log('[MindChat] 当前环境:', Taro.getEnv())
      console.log('[MindChat] 分身信息:', avatar)
      console.log('[MindChat] 会话信息:', conversation)
      
      // 发送 HTTP 请求（异步模式，立即返回 taskId）
      console.log('[MindChat] 准备发送请求...')
      const res = await Network.request({
        url: '/api/agent/execute',
        method: 'POST',
        data: {
          avatar_id: avatar?.id,
          task_description: content,
          conversation_id: conversation?.id
        }
      })
      
      console.log('[MindChat] 请求完成，statusCode:', res.statusCode)
      console.log('[MindChat] 任务已提交，完整响应:', JSON.stringify(res))
      console.log('[MindChat] 响应数据:', JSON.stringify(res.data))
      
      // 检查 HTTP 状态码
      if (res.statusCode !== 200) {
        console.error('[MindChat] HTTP 错误:', res.statusCode)
        throw new Error(`HTTP 错误: ${res.statusCode}`)
      }
      
      // 兼容不同的响应结构
      const responseData = res.data?.data || res.data
      const taskId = responseData?.taskId || responseData?.task_id
      
      console.log('[MindChat] 解析的 taskId:', taskId)
      
      if (!taskId) {
        console.error('[MindChat] taskId 获取失败，响应结构:', {
          'res.data': res.data,
          'res.data?.data': res.data?.data,
          'res.statusCode': res.statusCode
        })
        throw new Error('任务提交失败：无法获取 taskId')
      }
      
      // 启动结果轮询
      startResultPolling(taskId, content)
      
    } catch (err: any) {
      console.error('[MindChat] Agent 执行失败:', err)
      console.error('[MindChat] 错误详情:', {
        message: err.message,
        errMsg: err.errMsg,
        stack: err.stack,
        name: err.name
      })
      setLoading(false)
      loadingRef.current = false
      setCurrentStatus('')
      
      // 显示更具体的错误信息
      const errorMsg = err.errMsg || err.message || '执行失败，请重试'
      showToast({ title: errorMsg, icon: 'none', duration: 3000 })
      
      // 抛出异常，让外层处理
      throw err
    }
  }
  
  // 结果轮询定时器
  const resultPollingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  /**
   * 启动结果轮询
   */
  const startResultPolling = (taskId: string, originalContent: string) => {
    // 先启动进度轮询（传递 taskId，确保只获取当前任务的进度）
    startProgressPolling(taskId)
    
    // 结果轮询
    const pollResult = async () => {
      try {
        const res = await Network.request({
          url: `/api/agent/result/${taskId}`
        })
        
        const code = res.data?.code
        
        // 任务不存在或已过期
        if (code === 404) {
          console.log('[MindChat] 任务不存在或已过期:', taskId)
          stopResultPolling()
          stopProgressPolling()
          setLoading(false)
          loadingRef.current = false
          setCurrentStatus('')
          showToast({ title: '任务已过期，请重新提交', icon: 'none' })
          return
        }
        
        if (code === 200) {
          const taskResult = res.data?.data || {}
          
          // 任务完成
          if (taskResult.status === 'completed') {
            stopResultPolling()
            stopProgressPolling()
            handleTaskComplete(taskResult.result, originalContent)
          }
          // 任务失败
          else if (taskResult.status === 'failed') {
            stopResultPolling()
            stopProgressPolling()
            setLoading(false)
            loadingRef.current = false
            setCurrentStatus('')
            showToast({ title: taskResult.error || '执行失败', icon: 'none' })
          }
        }
      } catch (err) {
        console.error('[MindChat] 获取任务结果失败:', err)
        // 网络错误时继续轮询，不中断
      }
    }
    
    // 每 1 秒轮询一次结果
    resultPollingTimerRef.current = setInterval(pollResult, 1000)
  }
  
  /**
   * 停止结果轮询
   */
  const stopResultPolling = () => {
    if (resultPollingTimerRef.current) {
      clearInterval(resultPollingTimerRef.current)
      resultPollingTimerRef.current = null
    }
  }
  
  /**
   * 处理任务完成
   */
  const handleTaskComplete = (result: AgentResult, originalContent: string) => {
    console.log('[MindChat] 任务完成:', result)
    
    if (!result) {
      setLoading(false)
      loadingRef.current = false
      setCurrentStatus('')
      showToast({ title: '执行结果为空', icon: 'none' })
      return
    }
    
    // 从轮询结果中获取步骤
    const steps: AgentStepDisplay[] = agentSteps.length > 0 
      ? agentSteps 
      : (result.steps || [])
          .filter(s => s.action)
          .map(s => ({
            action: s.action || '',
            displayName: TOOL_DISPLAY_NAMES[s.action || ''] || s.action || '执行操作',
            // success 字段可能在 observation 顶层，也可能在 observation.data 里面
            status: (s.observation?.success ?? s.observation?.data?.success ?? false) ? 'success' : 'failed',
            message: s.observation?.message || s.observation?.data?.message || s.observation?.error || ''
          }))
    
    // 提取媒体内容
    const media: MessageMedia[] = []
    ;(result.steps || []).forEach(step => {
      if (step.observation?.data) {
        const data = step.observation.data
        console.log('[MindChat] 步骤数据:', step.action, data)
        
        // 文章内容
        if (data.content && data.title) {
          media.push({
            type: 'article',
            title: data.title,
            content: data.content,
            coverImage: data.cover_image_url
          })
        }
        
        // 图片
        if (data.image_urls && Array.isArray(data.image_urls) && data.image_urls.length > 0) {
          console.log('[MindChat] 提取图片:', data.image_urls)
          data.image_urls.forEach((url: string) => {
            if (url && typeof url === 'string') {
              media.push({ type: 'image', url })
            }
          })
        }
        
        // 封面图
        if (data.cover_image_url && !data.content) {
          media.push({ type: 'image', url: data.cover_image_url })
        }
        
        // 视频
        if (data.video_url) {
          media.push({ type: 'video', url: data.video_url })
        }
      }
    })
    
    console.log('[MindChat] 最终提取的媒体内容:', media)
    
    processAgentResult(result, media, steps, originalContent)
  }
  
  // 处理 Agent 执行结果
  const processAgentResult = (
    result: AgentResult, 
    media: MessageMedia[], 
    steps: AgentStepDisplay[],
    _originalContent: string
  ) => {
    // 构建回复消息
    let replyContent = result.finalAnswer || ''
    
    // 当有媒体内容时，清理 finalAnswer 中的链接文本
    if (media.length > 0 && replyContent) {
      replyContent = replyContent.replace(/https?:\/\/[^\s，。！？]+/g, '')
      replyContent = replyContent
        .replace(/[，,]?\s*(图片|文章|视频)?链接为[：:]\s*/gi, '')
        .replace(/[，,]\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!replyContent || replyContent.length < 5) {
        const articleCount = media.filter(m => m.type === 'article').length
        const imageCount = media.filter(m => m.type === 'image').length
        const videoCount = media.filter(m => m.type === 'video').length
        
        const parts: string[] = []
        if (articleCount > 0) parts.push(`${articleCount}篇文章`)
        if (imageCount > 0) parts.push(`${imageCount}张图片`)
        if (videoCount > 0) parts.push(`${videoCount}个视频`)
        
        replyContent = `已完成任务，为你生成了${parts.join('、')}`
      }
    }
    
    // 检查是否有小红书笔记内容（提供一键发布功能）
    const xiaohongshuStep = (result.steps || []).find(s => 
      s.observation?.data?.xiaohongshu_content || 
      (s.action === 'write_xiaohongshu_note' && s.observation?.data?.content)
    )
    if (xiaohongshuStep?.observation?.data) {
      const data = xiaohongshuStep.observation.data
      const xhsContent = data.xiaohongshu_content || data
      
      // 添加发布提示
      replyContent += `\n\n💡 内容已生成完成！点击下方「一键发布」按钮可快速发布到小红书。`
      
      // 将小红书笔记内容添加到媒体数组
      media.push({
        type: 'article',
        title: xhsContent.title,
        content: xhsContent.content,
        coverImage: undefined
      })
      
      // 设置 requiresConfig 和 configPlatform，让发布按钮能够显示
      result.requiresConfig = true
      result.configPlatform = 'xiaohongshu'
      
      // 存储待发布内容
      setPendingPublish({
        platform: 'xiaohongshu',
        content: {
          title: xhsContent.title,
          content: xhsContent.content,
          images: []
        }
      })
    }
    // 如果需要配置且有媒体内容，提示用户可以发布（排除小红书，已在上面处理）
    else if (result.requiresConfig && result.configPlatform && media.length > 0) {
      const article = media.find(m => m.type === 'article')
      const images = media.filter(m => m.type === 'image').map(m => m.url).filter(Boolean) as string[]
      
      replyContent += `\n\n💡 内容已生成完成！点击下方「发布」按钮即可发布到${getPlatformName(result.configPlatform)}。`
      
      // 存储待发布内容
      setPendingPublish({
        platform: result.configPlatform,
        content: {
          title: article?.title,
          content: article?.content,
          coverImage: article?.coverImage,
          images
        }
      })
    }
    
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: replyContent,
      created_at: new Date().toISOString(),
      metadata: { 
        agent_result: result,
        agent_steps: steps,
        media: media.length > 0 ? media : undefined
      }
    }
    
    setMessages(prev => [...prev, aiMessage])
    setLoading(false)
    loadingRef.current = false
    setCurrentStatus('')
    scrollToBottom()
    // 对话完成后刷新学习数据并显示学习特效
    // 延迟 1.5 秒确保后端学习分析完成
    setTimeout(() => {
      fetchLearningStats(true)
    }, 1500)
  }
  
  // 获取平台名称
  const getPlatformName = (platform: PlatformType): string => {
    const names: Record<PlatformType, string> = {
      wechat_mp: '微信公众号',
      xiaohongshu: '小红书',
      bilibili: 'B站',
      weibo: '微博',
      douyin: '抖音',
      wechat_video: '微信视频号'
    }
    return names[platform] || platform
  }
  
  // 处理发布请求
  const handlePublish = async () => {
    if (!pendingPublish) return
    
    const { platform, content } = pendingPublish
    
    // 判断是否是支持 API 发布的平台
    const apiSupportedPlatforms: PlatformType[] = ['wechat_mp']
    
    if (!apiSupportedPlatforms.includes(platform)) {
      // 不支持 API 发布的平台，一键发布到对应APP
      const env = Taro.getEnv()
      
      // 构建发布内容
      const publishContent = content.title 
        ? `【${content.title}】\n\n${content.content}`
        : content.content || ''
      
      if (env === Taro.ENV_TYPE.WEB) {
        // H5环境：跳转到中转页面
        const encodedContent = encodeURIComponent(publishContent)
        const encodedTitle = content.title ? encodeURIComponent(content.title) : ''
        const url = `/pages/publish-redirect/index?platform=${platform}&content=${encodedContent}&title=${encodedTitle}`
        Taro.navigateTo({ url })
      } else {
        // 小程序环境：显示H5链接弹窗
        // 生成H5链接（使用项目域名）
        const h5Url = `${window.location.origin}/pages/publish-redirect/index?platform=${platform}&content=${encodeURIComponent(publishContent)}&title=${content.title ? encodeURIComponent(content.title) : ''}`
        setH5PublishUrl(h5Url)
        setShowH5PublishDialog(true)
      }
      setShowPublishConfirm(false)
      return
    }
    
    try {
      setLoading(true)
      setCurrentStatus('正在检查平台配置...')
      
      // 先检查平台配置
      const checkRes = await Network.request({
        url: `/api/agent/platform-config/${platform}`
      })
      
      const isConfigured = checkRes.data?.data?.configured
      
      if (!isConfigured) {
        // 未配置，打开配置弹窗
        setShowPublishConfirm(false)
        setConfigPlatform(platform)
        setShowConfigDialog(true)
        setLoading(false)
        setCurrentStatus('')
        return
      }
      
      // 已配置，直接发布
      setCurrentStatus(`正在发布到${getPlatformName(platform)}...`)
      
      const publishRes = await Network.request({
        url: `/api/agent/publish/${platform}`,
        method: 'POST',
        data: {
          title: content.title,
          content: content.content,
          cover_url: content.coverImage,
          images: content.images
        }
      })
      
      if (publishRes.data?.code === 200) {
        const publishData = publishRes.data.data
        
        // 检查是否需要手动发布
        if (publishData?.manual_publish_required) {
          // 需要手动发布，显示引导弹窗
          setShowPublishConfirm(false)
          setPublishGuideData({
            platform: platform as keyof typeof PLATFORM_CONFIGS,
            content: {
              title: publishData.title || content.title,
              content: publishData.content || content.content,
              images: publishData.images || content.images,
              tags: publishData.tags
            }
          })
          setShowPublishGuide(true)
        } else {
          // 发布成功
          showToast({ title: '发布成功！', icon: 'success' })
          setPendingPublish(null)
          
          // 添加一条发布成功的消息
          const successMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `✅ 内容已成功发布到${getPlatformName(platform)}！\n\n${publishData?.url ? `查看链接：${publishData.url}` : ''}`,
            created_at: new Date().toISOString()
          }
          setMessages(prev => [...prev, successMsg])
          scrollToBottom()
        }
      } else {
        showToast({ title: publishRes.data?.message || '发布失败', icon: 'none' })
      }
    } catch (err) {
      console.error('发布失败:', err)
      showToast({ title: '发布失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
      setCurrentStatus('')
    }
  }

  // 降级为普通对话
  const fallbackToNormalChat = async (content: string) => {
    try {
      const res = await Network.request({
        url: '/api/chat/send',
        method: 'POST',
        data: {
          conversation_id: conversation?.id,
          avatar_id: avatar?.id,
          content
        }
      })

      if (res.data?.code === 200) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.data.content,
          created_at: new Date().toISOString(),
          metadata: res.data.data.metadata
        }
        setMessages(prev => [...prev, aiMessage])
        scrollToBottom()
        fetchConversations()
        // 对话完成后刷新学习数据并显示学习特效
        // 延迟 1.5 秒确保后端学习分析完成
        setTimeout(() => {
          fetchLearningStats(true)
        }, 1500)
      }
    } catch (error) {
      // 最后的降级方案
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `我是${avatar?.name || 'AI分身'}，我已收到你的消息。作为你的智能分身，我可以帮你写文章、生成图片、发布内容到各大平台。你可以直接告诉我要做什么，比如"帮我写一篇公众号文章"。`,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMessage])
        scrollToBottom()
      }, 1000)
    } finally {
      setLoading(false)
      loadingRef.current = false
      setCurrentStatus('')
    }
  }

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode)
    if (isRecording) {
      stopRecording()
    }
  }

  const startRecording = () => {
    const env = Taro.getEnv()
    
    if (env !== Taro.ENV_TYPE.WEAPP) {
      // H5 端不支持录音，提示用户使用文字输入
      showToast({ title: 'H5端暂不支持语音输入，请使用文字输入', icon: 'none', duration: 2000 })
      setIsVoiceMode(false)  // 自动切换回文字模式
      return
    }
    
    const recorderManager = Taro.getRecorderManager()
    
    recorderManager.onStart(() => {
      setIsRecording(true)
      setRecordingTime(0)
      showToast({ title: '开始录音...', icon: 'none', duration: 60000 })
    })
    
    recorderManager.onStop((res) => {
      setIsRecording(false)
      const { tempFilePath } = res
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      
      recognizeSpeech(tempFilePath)
    })
    
    recorderManager.onError((err) => {
      console.error('录音失败:', err)
      showToast({ title: '录音失败', icon: 'none' })
      setIsRecording(false)
    })
    
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
    
    try {
      recorderManager.start({
        format: 'mp3',
        duration: 60000
      })
    } catch (error) {
      console.error('启动录音失败:', error)
      showToast({ title: '启动录音失败', icon: 'none' })
    }
  }

  const stopRecording = () => {
    if (!isRecording) return
    
    setIsRecording(false)
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    
    const env = Taro.getEnv()
    
    if (env === Taro.ENV_TYPE.WEAPP) {
      const recorderManager = Taro.getRecorderManager()
      recorderManager.stop()
    }
    
    setRecordingTime(0)
  }

  const recognizeSpeech = async (filePath: string) => {
    try {
      showToast({ title: '识别中...', icon: 'loading', duration: 10000 })
      
      const res = await Network.uploadFile({
        url: '/api/chat/speech-to-text',
        filePath: filePath,
        name: 'audio'
      })
      
      const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      
      if (responseData?.code === 200) {
        const text = responseData.data?.text || ''
        setInputText(text)
        showToast({ title: '识别完成', icon: 'success', duration: 1000 })
        
        if (text.trim()) {
          setTimeout(() => {
            sendMessage(text)
          }, 500)
        }
      } else {
        showToast({ title: '识别失败', icon: 'none' })
      }
    } catch (error) {
      console.error('语音识别失败:', error)
      const fallbackText = '我发了一条语音消息'
      setInputText(fallbackText)
      showToast({ title: '语音功能暂不可用', icon: 'none' })
    }
  }

  const copyMessage = (content: string) => {
    Taro.setClipboardData({
      data: content,
      success: () => {
        showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 渲染消息内容（支持富媒体）
  const renderMessageContent = (msg: Message) => {
    return (
      <View className="message-content-wrapper">
        {/* Agent 执行步骤展示 */}
        {msg.metadata?.agent_steps && msg.metadata.agent_steps.length > 0 && (
          <View className="agent-steps-display">
            {msg.metadata.agent_steps.map((step, idx) => (
              <View key={idx} className={`agent-step-item ${step.status}`}>
                <View className="step-icon">
                  {step.status === 'success' ? (
                    <Check size={14} color="#00ff88" />
                  ) : (
                    <X size={14} color="#ff4444" />
                  )}
                </View>
                <Text className="step-name">{step.displayName}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* 文本内容 */}
        <Text className="message-text">{msg.content}</Text>
        
        {/* 富媒体内容 */}
        {(() => {
          // 优先使用 metadata.media
          let mediaList = msg.metadata?.media || []
          
          // 如果没有 media，尝试从 agent_result 中提取
          if (mediaList.length === 0 && msg.metadata?.agent_result?.steps) {
            const steps = msg.metadata.agent_result.steps || []
            steps.forEach((step: ReActStep) => {
              if (step.observation?.data) {
                const data = step.observation.data
                
                // 图片
                if (data.image_urls && Array.isArray(data.image_urls)) {
                  data.image_urls.forEach((url: string) => {
                    if (url && typeof url === 'string') {
                      mediaList.push({ type: 'image', url })
                    }
                  })
                }
                
                // 文章
                if (data.content && data.title) {
                  mediaList.push({
                    type: 'article',
                    title: data.title,
                    content: data.content,
                    coverImage: data.cover_image_url
                  })
                }
                
                // 视频
                if (data.video_url) {
                  mediaList.push({ type: 'video', url: data.video_url })
                }
                
                // 封面图
                if (data.cover_image_url && !data.content) {
                  mediaList.push({ type: 'image', url: data.cover_image_url })
                }
              }
            })
          }
          
          if (mediaList.length === 0) return null
          
          return (
            <View className="media-container">
              {mediaList.map((media, idx) => {
                if (media.type === 'image') {
                  return (
                    <View key={idx} className="media-item image">
                      <Image 
                        src={media.url || ''} 
                        className="media-image" 
                        mode="widthFix"
                        onClick={() => {
                          Taro.previewImage({
                            current: media.url,
                            urls: [media.url || '']
                          })
                        }}
                      />
                      {/* 图片操作按钮 */}
                      <View className="image-actions">
                        <View 
                          className="image-action-btn"
                          onClick={async (e) => {
                            e.stopPropagation()
                            // 下载图片到相册
                            Taro.showLoading({ title: '保存中...' })
                            try {
                              const res = await Network.downloadFile({
                                url: media.url || ''
                              }) as any
                              await Taro.saveImageToPhotosAlbum({
                                filePath: res.tempFilePath
                              })
                              Taro.hideLoading()
                              Taro.showToast({ title: '已保存到相册', icon: 'success' })
                            } catch (err) {
                              Taro.hideLoading()
                              console.error('保存失败:', err)
                              Taro.showToast({ title: '保存失败', icon: 'none' })
                            }
                          }}
                        >
                          <Download size={16} color="#fff" />
                        </View>
                      </View>
                    </View>
                  )
                }
                
                if (media.type === 'video') {
                  // H5 环境使用原生 video 标签，小程序使用 Taro Video 组件
                  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
                  const videoUrl = media.url || ''

                  return (
                    <View key={idx} className="media-item video">
                      {isH5 ? (
                        <video
                          src={videoUrl}
                          className="media-video"
                          controls
                          playsInline
                          webkit-playsinline="true"
                          x5-playsinline="true"
                          style={{ width: '100%', height: '200px', borderRadius: '8px', backgroundColor: '#000' }}
                        />
                      ) : (
                        <Video
                          src={videoUrl}
                          className="media-video"
                          controls
                          showFullscreenBtn
                          showPlayBtn
                          showCenterPlayBtn
                          enableProgressGesture
                          objectFit="contain"
                          style={{ width: '100%', height: '400rpx', borderRadius: '16rpx' }}
                          onError={(e) => {
                            console.error('小程序视频播放错误:', e)
                            Taro.showToast({ title: '视频加载失败', icon: 'none' })
                          }}
                          onPlay={() => console.log('视频开始播放')}
                        />
                      )}
                    </View>
                  )
                }
                
                if (media.type === 'article') {
                  return (
                    <View key={idx} className="media-item article">
                      {media.coverImage && (
                        <Image src={media.coverImage} className="article-cover" mode="widthFix" />
                      )}
                      <View className="article-content">
                        <Text className="article-title">{media.title}</Text>
                        <MarkdownRender content={media.content || ''} />
                      </View>
                    </View>
                  )
                }
                
                return null
              })}
            </View>
          )
        })()}
        
        {/* 发布按钮 - 当有待发布内容时显示 */}
        {msg.metadata?.agent_result?.requiresConfig && 
         msg.metadata?.agent_result?.configPlatform && 
         msg.metadata?.media && 
         msg.metadata.media.length > 0 && (
          <View className="publish-action-bar">
            <Button
              className="publish-btn"
              onClick={() => {
                // 恢复待发布内容
                const mediaList = msg.metadata?.media || []
                const article = mediaList.find((m: MessageMedia) => m.type === 'article')
                const images = mediaList.filter((m: MessageMedia) => m.type === 'image').map((m: MessageMedia) => m.url).filter(Boolean) as string[]
                
                setPendingPublish({
                  platform: msg.metadata?.agent_result?.configPlatform as PlatformType,
                  content: {
                    title: article?.title,
                    content: article?.content,
                    coverImage: article?.coverImage,
                    images
                  }
                })
                setShowPublishConfirm(true)
              }}
            >
              <Text className="publish-btn-text">
                {['wechat_mp'].includes(msg.metadata?.agent_result?.configPlatform as PlatformType) 
                  ? `🚀 发布到${getPlatformName(msg.metadata?.agent_result?.configPlatform as PlatformType)}`
                  : '⚡ 一键发布'
                }
              </Text>
            </Button>
          </View>
        )}
      </View>
    )
  }

  if (!isLoggedIn) return null

  return (
    <View className="mind-chat-page">
      <View className="bg-glow" />
      <View className="grid-overlay" />

      {/* 顶部导航 */}
      <View className="chat-header">
        <View className="header-left">
          <View className="history-btn" onClick={() => setShowHistory(true)}>
            <History size={22} color="#00f5ff" />
          </View>
          <View className="avatar-info">
            {avatar ? (
              <>
                <View className="avatar-avatar">
                  {avatar.avatar_url ? (
                    <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                  ) : (
                    <Sparkles size={24} color="#00f5ff" />
                  )}
                </View>
                <View className="avatar-text">
                  <Text className="avatar-name">{avatar.name}</Text>
                  <View className="avatar-status">
                    <View className="status-dot" />
                    <Text className="status-text">Agent 就绪</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text className="no-avatar">选择AI分身</Text>
            )}
          </View>
        </View>
        <View className="header-right">
          <View className="agent-badge">
            <Zap size={16} color="#00ff88" />
            <Text className="agent-badge-text">Agent</Text>
          </View>
        </View>
      </View>

      {/* 心智成长面板 */}
      <View className={`learn-panel ${learnPanelCollapsed ? 'collapsed' : ''}`}>
        <View className="learn-panel-header" onClick={() => setLearnPanelCollapsed(!learnPanelCollapsed)}>
          <Brain size={20} color="#00f5ff" />
          <Text className="learn-panel-title">心智成长</Text>
          <View className="learn-panel-toggle">
            {learnPanelCollapsed ? <ChevronDown size={18} color="#00f5ff" /> : <ChevronUp size={18} color="#00f5ff" />}
          </View>
        </View>
        
        {!learnPanelCollapsed && (
        <>
        <View className="learn-stats-row">
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('dialog')}>
            <MessageCircle size={16} color="#bf00ff" />
            <Text className="learn-stat-value">{learningStats.messageCount}</Text>
            <Text className="learn-stat-label">对话</Text>
          </View>
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('days')}>
            <TrendingUp size={16} color="#00ff88" />
            <Text className="learn-stat-value">{learningStats.learningDays}</Text>
            <Text className="learn-stat-label">天数</Text>
          </View>
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('mastery')}>
            <Target size={16} color="#ff00aa" />
            <Text className="learn-stat-value">{learningStats.masteryLevel}%</Text>
            <Text className="learn-stat-label">掌握</Text>
          </View>
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('level')}>
            <Award size={16} color="#00f5ff" />
            <Text className="learn-stat-value">Lv.{avatar?.level || 1}</Text>
            <Text className="learn-stat-label">等级</Text>
          </View>
        </View>
        
        {/* 用户画像 - 始终显示 */}
        {(learningStats.userIdentity?.occupation || learningStats.userIdentity?.education || learningStats.userIdentity?.personalityType || learningStats.userIdentity?.lifeEvents?.length) && (
          <View className="learn-identity-section clickable" onClick={() => setShowLearningDetail('identity')}>
            <Text className="learn-section-title">我的画像</Text>
            <View className="learn-identity-cards">
              {learningStats.userIdentity?.occupation && (
                <View className="learn-identity-card">
                  <Text className="learn-identity-label">职业</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.occupation}</Text>
                </View>
              )}
              {learningStats.userIdentity?.education && (
                <View className="learn-identity-card">
                  <Text className="learn-identity-label">学历</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.education}</Text>
                </View>
              )}
              {learningStats.userIdentity?.personalityType && (
                <View className="learn-identity-card">
                  <Text className="learn-identity-label">性格</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.personalityType}</Text>
                </View>
              )}
              {learningStats.userIdentity?.lifeEvents && learningStats.userIdentity.lifeEvents.length > 0 && (
                <View className="learn-identity-card full-width">
                  <Text className="learn-identity-label">生活大事</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.lifeEvents.join('、')}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* 展开/折叠更多按钮 */}
        <View className="learn-expand-btn" onClick={() => setLearnPanelExpanded(!learnPanelExpanded)}>
          <Text className="learn-expand-text">{learnPanelExpanded ? '收起详情' : '展开更多'}</Text>
          {learnPanelExpanded ? <ChevronUp size={16} color="#00f5ff" /> : <ChevronDown size={16} color="#00f5ff" />}
        </View>
        
        {/* 详细内容 - 默认折叠，可滚动 */}
        {learnPanelExpanded && (
        <ScrollView className="learn-panel-content" scrollY style={{ height: '300rpx' }}>
        <View className="learn-progress-section clickable" onClick={() => setShowLearningDetail('mastery')}>
          <Text className="learn-progress-label">成长进度</Text>
          <View className="learn-progress-bar">
            <View 
              className="learn-progress-fill" 
              style={{ width: `${learningStats.masteryLevel}%` }}
            />
          </View>
          <Text className="learn-progress-hint">
            {learningStats.masteryLevel < 20 
              ? '继续对话，我会更了解你' 
              : learningStats.masteryLevel < 50 
                ? '我已经开始学习你的风格了' 
                : learningStats.masteryLevel < 80 
                  ? '越来越像你了！' 
                  : '我们已经心意相通了 🎉'}
          </Text>
        </View>
        
        {/* 风格匹配度 */}
        {(learningStats.styleMatch || 0) > 0 && (
          <View className="learn-style-section clickable" onClick={() => setShowLearningDetail('style')}>
            <Text className="learn-style-label">风格匹配度</Text>
            <View className="learn-style-bar">
              <View 
                className="learn-style-fill" 
                style={{ width: `${learningStats.styleMatch}%` }}
              />
            </View>
            <Text className="learn-style-value">{learningStats.styleMatch}%</Text>
          </View>
        )}
        
        {/* 兴趣话题 */}
        {learningStats.interests && learningStats.interests.length > 0 && (
          <View className="learn-interests-section clickable" onClick={() => setShowLearningDetail('interests')}>
            <Text className="learn-section-title">兴趣话题</Text>
            <View className="learn-tags">
              {learningStats.interests.slice(0, 5).map((interest, idx) => (
                <View key={idx} className="learn-tag">
                  <Text className="learn-tag-text">{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* 常用表达 */}
        {learningStats.commonPhrases && learningStats.commonPhrases.length > 0 && (
          <View className="learn-phrases-section clickable" onClick={() => setShowLearningDetail('phrases')}>
            <Text className="learn-section-title">你的常用表达</Text>
            <View className="learn-phrases">
              {learningStats.commonPhrases.slice(0, 3).map((phrase, idx) => (
                <Text key={idx} className="learn-phrase">&ldquo;{phrase}&rdquo;</Text>
              ))}
            </View>
          </View>
        )}
        </ScrollView>
        )}
        </>
        )}
      </View>
      
      {/* 学习详情弹窗 */}
      {showLearningDetail && (
        <View className="learning-detail-overlay" onClick={() => setShowLearningDetail(null)}>
          <View className="learning-detail-modal" onClick={e => e.stopPropagation()}>
            <View className="learning-detail-header">
              <Text className="learning-detail-title">
                {showLearningDetail === 'dialog' && '对话统计'}
                {showLearningDetail === 'days' && '学习天数'}
                {showLearningDetail === 'mastery' && '掌握度分析'}
                {showLearningDetail === 'level' && '等级成长'}
                {showLearningDetail === 'identity' && '我的画像'}
                {showLearningDetail === 'style' && '风格分析'}
                {showLearningDetail === 'interests' && '兴趣话题'}
                {showLearningDetail === 'phrases' && '常用表达'}
              </Text>
              <View className="learning-detail-close" onClick={() => setShowLearningDetail(null)}>
                <X size={24} color="rgba(255,255,255,0.6)" />
              </View>
            </View>
            <ScrollView className="learning-detail-content" scrollY>
              {/* 对话统计详情 */}
              {showLearningDetail === 'dialog' && (
                <View className="detail-section">
                  <View className="detail-stat-card">
                    <Text className="detail-stat-value">{learningStats.messageCount}</Text>
                    <Text className="detail-stat-label">累计对话数</Text>
                  </View>
                  <View className="detail-stat-card">
                    <Text className="detail-stat-value">{learningStats.avgMessageLength.toFixed(0)}</Text>
                    <Text className="detail-stat-label">平均消息长度</Text>
                  </View>
                  <Text className="detail-hint">
                    每一次对话都是我学习你的机会。对话越多，我越了解你的说话风格、思维方式和个性特点。
                  </Text>
                  <Text className="detail-tip">
                    💡 提示：多分享你的想法、观点和经历，可以帮助我更快地学习你的风格。
                  </Text>
                </View>
              )}
              
              {/* 学习天数详情 */}
              {showLearningDetail === 'days' && (
                <View className="detail-section">
                  <View className="detail-stat-card large">
                    <Text className="detail-stat-value">{learningStats.learningDays}</Text>
                    <Text className="detail-stat-label">学习天数</Text>
                  </View>
                  <Text className="detail-hint">
                    我已经连续学习你 {learningStats.learningDays} 天了！每天的学习都让我更了解你。
                  </Text>
                  <View className="detail-milestones">
                    <View className="milestone-item">
                      <View className="milestone-dot completed" />
                      <Text className="milestone-text">第1天：初次相识</Text>
                    </View>
                    <View className="milestone-item">
                      <View className={`milestone-dot ${learningStats.learningDays >= 7 ? 'completed' : ''}`} />
                      <Text className="milestone-text">第7天：渐入佳境</Text>
                    </View>
                    <View className="milestone-item">
                      <View className={`milestone-dot ${learningStats.learningDays >= 30 ? 'completed' : ''}`} />
                      <Text className="milestone-text">第30天：心有灵犀</Text>
                    </View>
                    <View className="milestone-item">
                      <View className={`milestone-dot ${learningStats.learningDays >= 100 ? 'completed' : ''}`} />
                      <Text className="milestone-text">第100天：心意相通</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* 掌握度详情 */}
              {showLearningDetail === 'mastery' && (
                <View className="detail-section">
                  <View className="detail-stat-card large">
                    <Text className="detail-stat-value">{learningStats.masteryLevel}%</Text>
                    <Text className="detail-stat-label">风格掌握度</Text>
                  </View>
                  <View className="detail-progress-section">
                    <View className="detail-progress-bar">
                      <View className="detail-progress-fill" style={{ width: `${learningStats.masteryLevel}%` }} />
                    </View>
                  </View>
                  <Text className="detail-hint">
                    掌握度反映了我在学习你的说话风格、思维方式和个性特点方面的进度。
                  </Text>
                  <View className="detail-breakdown">
                    <Text className="detail-breakdown-title">学习维度</Text>
                    <View className="breakdown-item">
                      <Text className="breakdown-label">语气风格</Text>
                      <View className="breakdown-bar">
                        <View className="breakdown-fill" style={{ width: `${Math.min(100, (learningStats.toneProfile?.formal || 0.5) * 100)}%` }} />
                      </View>
                    </View>
                    <View className="breakdown-item">
                      <Text className="breakdown-label">性格特征</Text>
                      <View className="breakdown-bar">
                        <View className="breakdown-fill" style={{ width: `${Math.min(100, (learningStats.personalityTraits?.extraversion || 0.5) * 100)}%` }} />
                      </View>
                    </View>
                    <View className="breakdown-item">
                      <Text className="breakdown-label">沟通风格</Text>
                      <View className="breakdown-bar">
                        <View className="breakdown-fill" style={{ width: `${Math.min(100, (learningStats.communicationStyle?.direct || 0.5) * 100)}%` }} />
                      </View>
                    </View>
                  </View>
                </View>
              )}
              
              {/* 等级详情 */}
              {showLearningDetail === 'level' && (
                <View className="detail-section">
                  <View className="detail-stat-card large">
                    <Text className="detail-stat-value">Lv.{avatar?.level || 1}</Text>
                    <Text className="detail-stat-label">当前等级</Text>
                  </View>
                  <View className="detail-level-info">
                    <Text className="detail-level-exp">经验值：{avatar?.exp || 0} / {(avatar?.level || 1) * 100}</Text>
                    <View className="detail-level-bar">
                      <View className="detail-level-fill" style={{ width: `${((avatar?.exp || 0) % 100)}%` }} />
                    </View>
                  </View>
                  <Text className="detail-hint">
                    通过对话积累经验值，提升等级。等级越高，我的能力越强，对你的理解也越深。
                  </Text>
                  <View className="detail-level-benefits">
                    <Text className="detail-benefits-title">等级特权</Text>
                    <View className="benefit-item">
                      <Text className="benefit-level">Lv.1-5</Text>
                      <Text className="benefit-desc">基础对话能力</Text>
                    </View>
                    <View className="benefit-item">
                      <Text className="benefit-level">Lv.6-10</Text>
                      <Text className="benefit-desc">风格学习 + 个性化回复</Text>
                    </View>
                    <View className="benefit-item">
                      <Text className="benefit-level">Lv.11-20</Text>
                      <Text className="benefit-desc">深度理解 + 情感共鸣</Text>
                    </View>
                    <View className="benefit-item">
                      <Text className="benefit-level">Lv.21+</Text>
                      <Text className="benefit-desc">心意相通 + 完美契合</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* 用户画像详情 */}
              {showLearningDetail === 'identity' && (
                <View className="detail-section">
                  <Text className="detail-section-title">我认识的你</Text>
                  {learningStats.userIdentity?.occupation && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">职业身份</Text>
                      <Text className="identity-detail-value">{learningStats.userIdentity.occupation}</Text>
                    </View>
                  )}
                  {learningStats.userIdentity?.education && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">学历背景</Text>
                      <Text className="identity-detail-value">{learningStats.userIdentity.education}</Text>
                    </View>
                  )}
                  {learningStats.userIdentity?.personalityType && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">性格特点</Text>
                      <Text className="identity-detail-value">{learningStats.userIdentity.personalityType}</Text>
                    </View>
                  )}
                  {learningStats.userIdentity?.lifeEvents && learningStats.userIdentity.lifeEvents.length > 0 && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">生活大事</Text>
                      <View className="life-events-list">
                        {learningStats.userIdentity.lifeEvents.map((event, idx) => (
                          <Text key={idx} className="life-event-item">• {event}</Text>
                        ))}
                      </View>
                    </View>
                  )}
                  <Text className="detail-hint">
                    我会记住你告诉我的重要信息，在对话中自然地体现对你的了解。
                  </Text>
                </View>
              )}
              
              {/* 风格分析详情 */}
              {showLearningDetail === 'style' && (
                <View className="detail-section">
                  <Text className="detail-section-title">你的风格画像</Text>
                  {learningStats.toneProfile && (
                    <View className="style-analysis-card">
                      <Text className="style-analysis-label">语气风格</Text>
                      <View className="style-bars">
                        <View className="style-bar-item">
                          <Text className="style-bar-label">正式</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.toneProfile?.formal || 0) * 100}%` }} />
                          </View>
                          <Text className="style-bar-value">{Math.round((learningStats.toneProfile?.formal || 0) * 100)}%</Text>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">随性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.toneProfile?.casual || 0) * 100}%` }} />
                          </View>
                          <Text className="style-bar-value">{Math.round((learningStats.toneProfile?.casual || 0) * 100)}%</Text>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">幽默</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.toneProfile?.humorous || 0) * 100}%` }} />
                          </View>
                          <Text className="style-bar-value">{Math.round((learningStats.toneProfile?.humorous || 0) * 100)}%</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {learningStats.personalityTraits && (
                    <View className="style-analysis-card">
                      <Text className="style-analysis-label">性格特质（大五人格）</Text>
                      <View className="style-bars">
                        <View className="style-bar-item">
                          <Text className="style-bar-label">开放性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.personalityTraits?.openness || 0) * 100}%` }} />
                          </View>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">外向性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.personalityTraits?.extraversion || 0) * 100}%` }} />
                          </View>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">尽责性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.personalityTraits?.conscientiousness || 0) * 100}%` }} />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
              
              {/* 兴趣话题详情 */}
              {showLearningDetail === 'interests' && (
                <View className="detail-section">
                  <Text className="detail-section-title">你感兴趣的话题</Text>
                  <View className="interests-cloud">
                    {learningStats.interests?.map((interest, idx) => (
                      <View key={idx} className="interest-tag-large">
                        <Text className="interest-tag-text">{interest}</Text>
                      </View>
                    ))}
                  </View>
                  <Text className="detail-hint">
                    我会关注你感兴趣的话题，在对话中主动提及相关内容。
                  </Text>
                </View>
              )}
              
              {/* 常用表达详情 */}
              {showLearningDetail === 'phrases' && (
                <View className="detail-section">
                  <Text className="detail-section-title">你的常用表达</Text>
                  <View className="phrases-list">
                    {learningStats.commonPhrases?.map((phrase, idx) => (
                      <View key={idx} className="phrase-item">
                        <Text className="phrase-text">&ldquo;{phrase}&rdquo;</Text>
                      </View>
                    ))}
                  </View>
                  <Text className="detail-hint">
                    我会学习你的口头禅和常用表达，让对话更自然。
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
      
      {/* 学习特效提示 */}
      {showLearningEffect && learningProgress && (
        <View className="learning-effect-overlay">
          <View className="learning-effect-card">
            <View className="learning-effect-icon">
              <Brain size={32} color="#00f5ff" />
            </View>
            <Text className="learning-effect-title">正在学习你的风格...</Text>
            <Text className="learning-effect-desc">
              对话数：{learningProgress.oldCount} → {learningProgress.newCount}
            </Text>
            <View className="learning-effect-exp">
              <Text className="exp-text">+{learningProgress.expGained} 经验</Text>
            </View>
            <View className="learning-effect-progress">
              <View className="learning-progress-bar">
                <View className="learning-progress-fill" style={{ width: `${Math.min(100, learningProgress.newCount * 5)}%` }} />
              </View>
              <Text className="learning-progress-text">掌握度 {Math.min(100, learningProgress.newCount * 5)}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* 历史记录抽屉 */}
      {showHistory && (
        <View className="history-drawer-mask" onClick={() => setShowHistory(false)}>
          <View className="history-drawer" onClick={e => e.stopPropagation()}>
            <View className="drawer-header">
              <Text className="drawer-title">历史对话</Text>
              <View className="drawer-close" onClick={() => setShowHistory(false)}>
                <X size={24} color="rgba(255,255,255,0.6)" />
              </View>
            </View>
            <ScrollView className="drawer-content" scrollY>
              {conversations.length === 0 ? (
                <View className="empty-history">
                  <Bot size={48} color="rgba(255,255,255,0.2)" />
                  <Text className="empty-text">暂无历史对话</Text>
                </View>
              ) : (
                conversations.map(conv => (
                  <View 
                    key={conv.id} 
                    className={`history-item ${conversation?.id === conv.id ? 'active' : ''}`}
                    onClick={() => switchConversation(conv)}
                  >
                    <View className="history-icon">
                      <Sparkles size={18} color="#00f5ff" />
                    </View>
                    <View className="history-info">
                      <Text className="history-title">{conv.title || '新对话'}</Text>
                      <Text className="history-time">{formatTime(conv.updated_at)}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 消息区域 */}
      <ScrollView 
        className="messages-scroll"
        scrollY
        scrollTop={scrollTop}
        scrollIntoView={scrollIntoView}
        scrollWithAnimation
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          setRefreshing(true)
          loadMoreMessages()
        }}
      >
        {/* 加载更多提示 */}
        {isLoadingMore && (
          <View className="loading-more-tip">
            <Text className="loading-more-text">加载中...</Text>
          </View>
        )}
        {!hasMoreMessages && messages.length > 0 && (
          <View className="no-more-tip">
            <Text className="no-more-text">没有更多消息了</Text>
          </View>
        )}
        {messages.length === 0 ? (
          <View className="empty-chat">
            <View className="empty-icon">
              <View className="empty-avatar-glow">
                {avatar?.avatar_url ? (
                  <Image src={avatar.avatar_url} className="empty-avatar-img" mode="aspectFill" />
                ) : (
                  <Sparkles size={64} color="#00f5ff" />
                )}
              </View>
            </View>
            <Text className="empty-title">我是{avatar?.name || 'AI分身'}</Text>
            <Text className="empty-desc">我可以帮你写文章、生成图片、发布内容</Text>
            <View className="empty-hints">
              <Text className="hint-item">「帮我写一篇公众号文章」</Text>
              <Text className="hint-item">「生成一张风景图片」</Text>
              <Text className="hint-item">「发布到小红书」</Text>
            </View>
          </View>
        ) : (
          messages.map((msg, index) => (
            <View 
              key={msg.id} 
              id={`msg-${index}`}
              className={`message-item ${msg.role}`}
            >
              {msg.role === 'assistant' && (
                <View className="message-avatar">
                  {avatar?.avatar_url ? (
                    <Image src={avatar.avatar_url} className="msg-avatar-img" mode="aspectFill" />
                  ) : (
                    <Sparkles size={24} color="#00f5ff" />
                  )}
                </View>
              )}
              <View className="message-bubble">
                {renderMessageContent(msg)}
                <View className="message-footer">
                  <Text className="message-time">
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {msg.role === 'assistant' && (
                    <View 
                      className="message-action"
                      onClick={() => copyMessage(msg.content)}
                    >
                      <Copy size={14} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                </View>
              </View>
              {msg.role === 'user' && (
                <View className="message-user-avatar">
                  {userInfo?.avatar ? (
                    <Image src={userInfo.avatar} className="msg-avatar-img" mode="aspectFill" />
                  ) : (
                    <Text className="user-avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
        
        {/* Agent 实时状态显示 */}
        {loading && (
          <View id="msg-loading" className="message-item assistant">
            <View className="message-avatar">
              {avatar?.avatar_url ? (
                <Image src={avatar.avatar_url} className="msg-avatar-img" mode="aspectFill" />
              ) : (
                <Sparkles size={24} color="#00f5ff" />
              )}
            </View>
            <View className="message-bubble typing">
              <View className="typing-status">
                <Loader size={18} color="#00f5ff" className="spinning" />
                <Text className="status-message">{currentStatus || '思考中...'}</Text>
              </View>
              {agentSteps.length > 0 && (
                <View className="agent-steps-live">
                  {agentSteps.map((step, idx) => (
                    <View key={idx} className={`step-live ${step.status}`}>
                      <Text className="step-live-name">{step.displayName}</Text>
                      {step.status === 'running' ? (
                        <Loader size={14} color="#00f5ff" className="spinning" />
                      ) : step.status === 'success' ? (
                        <Check size={14} color="#00ff88" />
                      ) : (
                        <X size={14} color="#ff4444" />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* 底部锚点 */}
        <View id="scroll-bottom-anchor" className="messages-bottom" />
      </ScrollView>

      {/* 底部输入栏 */}
      <View className="input-bar">
        <View className="input-left">
          <View className="quick-action" onClick={toggleVoiceMode}>
            {isVoiceMode ? (
              <Keyboard size={24} color="rgba(255,255,255,0.6)" />
            ) : (
              <Mic size={24} color="#00f5ff" />
            )}
          </View>
        </View>

        <View className="input-center">
          {isVoiceMode ? (
            <View 
              className={`voice-input-area ${isRecording ? 'recording' : ''}`}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              onTouchCancel={stopRecording}
            >
              {isRecording ? (
                <View className="recording-indicator">
                  <View className="recording-wave">
                    <View className="wave-bar" />
                    <View className="wave-bar" />
                    <View className="wave-bar" />
                    <View className="wave-bar" />
                    <View className="wave-bar" />
                  </View>
                  <Text className="recording-time">{formatRecordingTime(recordingTime)}</Text>
                  <Text className="recording-hint">松开发送</Text>
                </View>
              ) : (
                <View className="voice-prompt">
                  <Mic size={28} color="rgba(255,255,255,0.8)" />
                  <Text className="voice-prompt-text">按住说话</Text>
                </View>
              )}
            </View>
          ) : (
            <View className="text-input-box">
              <Input
                className="text-input-control"
                placeholder="告诉我要做什么..."
                placeholderClass="text-input-placeholder"
                value={inputText}
                onInput={(e: any) => setInputText(e.detail.value)}
                onConfirm={() => sendMessage()}
                confirmType="send"
              />
              <View className="agent-mode-indicator">
                <Text className="agent-mode-text">Agent</Text>
              </View>
            </View>
          )}
        </View>

        <View className="input-right">
          {!isVoiceMode && (
            <View 
              className={`send-action ${inputText.trim() ? 'active' : ''}`}
              onClick={() => sendMessage()}
            >
              <Send size={22} color={inputText.trim() ? '#0a0a0f' : 'rgba(255,255,255,0.3)'} />
            </View>
          )}
        </View>
      </View>
      
      {/* 平台配置弹窗 */}
      {configPlatform && (
        <PlatformConfigDialog
          open={showConfigDialog}
          platform={configPlatform}
          onClose={() => {
            setShowConfigDialog(false)
            setConfigPlatform(null)
            setPendingMessage(null)  // 清除待重试消息
          }}
          onSuccess={() => {
            setShowConfigDialog(false)
            setConfigPlatform(null)
            showToast({ title: '配置成功，正在重新执行任务...', icon: 'success' })
            
            // 自动重试之前失败的任务
            if (pendingMessage) {
              const messageToRetry = pendingMessage
              setPendingMessage(null)  // 清除待重试消息
              setTimeout(() => {
                sendMessage(messageToRetry)
              }, 500)
            }
          }}
        />
      )}
      
      {/* 发布确认弹窗 */}
      <Dialog open={showPublishConfirm} onOpenChange={(isOpen) => { if (!isOpen) setShowPublishConfirm(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Text>确认发布</Text>
            </DialogTitle>
          </DialogHeader>
          
          <View className="publish-preview">
            <Text className="publish-platform">
              将发布到：{pendingPublish ? getPlatformName(pendingPublish.platform) : ''}
            </Text>
            
            {pendingPublish?.content.title && (
              <View className="publish-title">
                <Text className="publish-label">标题：</Text>
                <Text className="publish-value">{pendingPublish.content.title}</Text>
              </View>
            )}
            
            {pendingPublish?.content.coverImage && (
              <View className="publish-cover">
                <Text className="publish-label">封面图：</Text>
                <Image src={pendingPublish.content.coverImage} className="publish-cover-img" mode="widthFix" />
              </View>
            )}
            
            {pendingPublish?.content.images && pendingPublish.content.images.length > 0 && (
              <View className="publish-images">
                <Text className="publish-label">图片：{pendingPublish.content.images.length}张</Text>
              </View>
            )}
          </View>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)} className="mr-2">
              <Text>取消</Text>
            </Button>
            <Button
              onClick={() => {
                setShowPublishConfirm(false)
                handlePublish()
              }}
            >
              <Text>确认发布</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 发布引导弹窗（用于无 API 的平台） */}
      {publishGuideData && (
        <PublishGuideDialog
          open={showPublishGuide}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowPublishGuide(false)
              setPendingPublish(null)
            }
          }}
          platform={publishGuideData.platform}
          content={publishGuideData.content}
        />
      )}
      
      {/* H5链接弹窗（小程序环境） */}
      <Dialog open={showH5PublishDialog} onOpenChange={setShowH5PublishDialog}>
        <DialogContent className="h5-publish-dialog">
          <DialogHeader>
            <DialogTitle>一键发布</DialogTitle>
          </DialogHeader>
          <View className="h5-publish-content">
            <Text className="h5-publish-tip">
              请复制下方链接，在浏览器中打开即可调起APP发布
            </Text>
            <View className="h5-url-box">
              <Text className="h5-url-text">{h5PublishUrl}</Text>
            </View>
            <Button 
              className="copy-url-btn"
              onClick={() => {
                Taro.setClipboardData({
                  data: h5PublishUrl,
                  success: () => {
                    showToast({ title: '链接已复制', icon: 'success' })
                  }
                })
              }}
            >
              <Copy size={18} color="#fff" />
              <Text className="copy-url-btn-text">复制链接</Text>
            </Button>
          </View>
          <DialogFooter>
            <Button className="dialog-cancel-btn" onClick={() => setShowH5PublishDialog(false)}>
              <Text className="dialog-btn-text">关闭</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
