// eslint-disable-next-line no-restricted-syntax
import { View, Text, ScrollView, Image, Video, Input } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useRouter, redirectTo, showToast } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { PlatformConfigDialog, PlatformType } from '@/components/agent/PlatformConfigDialog'
import MarkdownRender from '@/components/markdown-render'
import { 
  Send, Sparkles, Bot, Copy, History, X, Brain, TrendingUp, Award, Target,
  MessageCircle, Mic, Keyboard, Loader, Zap, Check, Download
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
    avgMessageLength: 0
  })
  
  // Agent 实时状态（每个分身都是 Agent）
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [agentSteps, setAgentSteps] = useState<AgentStepDisplay[]>([])
  
  // 轮询定时器
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProgressCountRef = useRef<number>(0)
  
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollIntoView, setScrollIntoView] = useState('')
  const isFirstLoadRef = useRef<boolean>(true)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 平台配置弹窗
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [configPlatform, setConfigPlatform] = useState<PlatformType | null>(null)
  
  // 配置成功后待重试的消息
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/login/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchConversations()
      fetchLearningStats()
      
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
    }
  })
  
  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      stopProgressPolling()
    }
  }, [])
  
  /**
   * 开始轮询进度
   */
  const startProgressPolling = () => {
    // 先清除之前的定时器
    stopProgressPolling()
    lastProgressCountRef.current = 0
    
    // 立即查询一次
    fetchProgress()
    
    // 每 500ms 轮询一次
    pollingTimerRef.current = setInterval(() => {
      fetchProgress()
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
  }
  
  /**
   * 获取进度
   */
  const fetchProgress = async () => {
    try {
      const res = await Network.request({ url: '/api/agent/progress' })
      
      if (res.data?.code === 200) {
        const { progress, latest } = res.data.data
        
        // 处理所有进度（从上次处理的位置开始）
        if (progress && progress.length > 0) {
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

  useEffect(() => {
    scrollToBottom()
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

  const fetchLearningStats = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const userAvatar = res.data.data[0]
        const learning = userAvatar.config?.learning || {}
        setLearningStats({
          messageCount: learning.messageCount || 0,
          learningDays: Math.floor((learning.messageCount || 0) / 10) + 1,
          masteryLevel: Math.min(100, Math.floor((learning.messageCount || 0) / 5)),
          avgMessageLength: learning.avgMessageLength || 0
        })
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

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await Network.request({
        url: `/api/chat/conversation/${conversationId}/messages`
      })
      if (res.data?.code === 200) {
        setMessages(res.data.data || [])
        scrollToBottom()
      }
    } catch (error) {
      console.error('[MindChat] 获取消息失败:', error)
    }
  }

  const switchConversation = async (conv: Conversation) => {
    setConversation(conv)
    setMessages([])
    await fetchMessages(conv.id)
    setShowHistory(false)
    showToast({ title: '已切换对话', icon: 'success', duration: 1000 })
  }

  const scrollToBottom = () => {
    Taro.nextTick(() => {
      setScrollIntoView('scroll-bottom-anchor')
      setScrollTop(prev => prev + 99999)
      
      setTimeout(() => {
        setScrollIntoView('scroll-bottom-anchor')
        setScrollTop(prev => prev + 99999)
      }, 200)
    })
  }

  // 发送消息 - 每个分身都是 Agent，默认启用 Agent 能力
  const sendMessage = async (text?: string) => {
    const messageText = text || inputText
    if (!messageText.trim() || !conversation || loading) {
      showToast({ title: '请输入消息', icon: 'none' })
      return
    }

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
    scrollToBottom()

    try {
      // 所有消息都通过 Agent 处理，Agent 会自动判断是简单对话还是需要执行工具
      await executeAsAgent(messageText)
    } catch (error) {
      console.error('Agent 执行失败:', error)
      // 降级为普通对话
      await fallbackToNormalChat(messageText)
    }
  }

  // Agent 执行 - 分身的核心能力（HTTP 请求 + 轮询进度）
  const executeAsAgent = async (content: string) => {
    try {
      setAgentSteps([])
      
      // 启动进度轮询
      startProgressPolling()
      
      console.log('[MindChat] 开始执行 Agent 任务:', content)
      
      // 发送 HTTP 请求
      const res = await Network.request({
        url: '/api/agent/execute',
        method: 'POST',
        data: {
          avatar_id: avatar?.id,
          task_description: content,
          conversation_id: conversation?.id
        }
      })
      
      // 停止轮询
      stopProgressPolling()
      
      console.log('[MindChat] Agent 执行结果:', res.data)
      
      const result = res.data?.data as AgentResult
      if (!result) {
        throw new Error('执行结果为空')
      }
      
      // 从轮询结果中获取步骤（如果有的话）
      const steps: AgentStepDisplay[] = agentSteps.length > 0 
        ? agentSteps 
        : result.steps
            .filter(s => s.action)
            .map(s => ({
              action: s.action || '',
              displayName: TOOL_DISPLAY_NAMES[s.action || ''] || s.action || '执行操作',
              status: s.observation?.success ? 'success' : 'failed',
              message: s.observation?.message || s.observation?.error || ''
            }))
      
      // 提取媒体内容
      const media: MessageMedia[] = []
      result.steps.forEach(step => {
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
          
          // 图片 - 确保正确提取
          if (data.image_urls && Array.isArray(data.image_urls) && data.image_urls.length > 0) {
            console.log('[MindChat] 提取图片:', data.image_urls)
            data.image_urls.forEach((url: string) => {
              if (url && typeof url === 'string') {
                media.push({ type: 'image', url })
              }
            })
          }
          
          // 封面图（如果没有文章内容，单独展示）
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
      
      processAgentResult(result, media, steps, content)
      
    } catch (err) {
      console.error('[MindChat] Agent 执行失败:', err)
      setLoading(false)
      loadingRef.current = false
      setCurrentStatus('')
      showToast({ title: '执行失败，请重试', icon: 'none' })
    }
  }
  
  // 处理 Agent 执行结果
  const processAgentResult = (
    result: AgentResult, 
    media: MessageMedia[], 
    steps: AgentStepDisplay[],
    originalContent: string
  ) => {
    // 构建回复消息
    let replyContent = result.finalAnswer
    
    // 当有媒体内容时，清理 finalAnswer 中的链接文本
    if (media.length > 0) {
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
    fetchLearningStats()
    
    // 如果需要配置，保存消息并打开配置弹窗
    if (result.requiresConfig && result.configPlatform) {
      setPendingMessage(originalContent)
      setConfigPlatform(result.configPlatform)
      setShowConfigDialog(true)
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
        fetchLearningStats()
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
            msg.metadata.agent_result.steps.forEach((step: ReActStep) => {
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
                          onClick={(e) => {
                            e.stopPropagation()
                            // 下载图片到相册
                            Taro.showLoading({ title: '保存中...' })
                            Network.downloadFile({
                              url: media.url || '',
                              success: (res) => {
                                Taro.saveImageToPhotosAlbum({
                                  filePath: res.tempFilePath,
                                  success: () => {
                                    Taro.hideLoading()
                                    Taro.showToast({ title: '已保存到相册', icon: 'success' })
                                  },
                                  fail: (err) => {
                                    Taro.hideLoading()
                                    console.error('保存失败:', err)
                                    Taro.showToast({ title: '保存失败', icon: 'none' })
                                  }
                                })
                              },
                              fail: (err) => {
                                Taro.hideLoading()
                                console.error('下载失败:', err)
                                Taro.showToast({ title: '下载失败', icon: 'none' })
                              }
                            })
                          }}
                        >
                          <Download size={16} color="#fff" />
                        </View>
                      </View>
                    </View>
                  )
                }
                
                if (media.type === 'video') {
                  return (
                    <View key={idx} className="media-item video">
                      <Video 
                        src={media.url || ''} 
                        className="media-video"
                        controls
                        showFullscreenBtn
                        showPlayBtn
                      />
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
      <View className="learn-panel">
        <View className="learn-panel-header">
          <Brain size={20} color="#00f5ff" />
          <Text className="learn-panel-title">心智成长</Text>
        </View>
        
        <View className="learn-stats-row">
          <View className="learn-stat-item">
            <MessageCircle size={16} color="#bf00ff" />
            <Text className="learn-stat-value">{learningStats.messageCount}</Text>
            <Text className="learn-stat-label">对话</Text>
          </View>
          <View className="learn-stat-item">
            <TrendingUp size={16} color="#00ff88" />
            <Text className="learn-stat-value">{learningStats.learningDays}</Text>
            <Text className="learn-stat-label">天数</Text>
          </View>
          <View className="learn-stat-item">
            <Target size={16} color="#ff00aa" />
            <Text className="learn-stat-value">{learningStats.masteryLevel}%</Text>
            <Text className="learn-stat-label">掌握</Text>
          </View>
          <View className="learn-stat-item">
            <Award size={16} color="#00f5ff" />
            <Text className="learn-stat-value">Lv.{avatar?.level || 1}</Text>
            <Text className="learn-stat-label">等级</Text>
          </View>
        </View>
        
        <View className="learn-progress-section">
          <Text className="learn-progress-label">成长进度</Text>
          <View className="learn-progress-bar">
            <View 
              className="learn-progress-fill" 
              style={{ width: `${learningStats.masteryLevel}%` }}
            />
          </View>
        </View>
      </View>

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
      >
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
    </View>
  )
}
