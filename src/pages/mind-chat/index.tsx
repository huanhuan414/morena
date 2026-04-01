// eslint-disable-next-line no-restricted-syntax
import { View, Text, ScrollView, Image, Video, RichText, Input } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useRouter, redirectTo, showToast } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { PlatformConfigDialog, PlatformType } from '@/components/agent/PlatformConfigDialog'
import { 
  Send, Sparkles, Bot, Copy, History, X, Brain, TrendingUp, Award, Target,
  MessageCircle, Mic, Keyboard, Loader, FileText, Zap, Check
} from 'lucide-react-taro'
import './index.css'

interface MessageMedia {
  type: 'image' | 'video' | 'article'
  url?: string
  key?: string
  content?: string
  title?: string
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
  status: 'success' | 'failed' | 'pending'
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

// Markdown 转换为小程序可用的节点
const markdownToNodes = (text: string): string => {
  if (!text) return ''
  
  return text
    // 标题
    .replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="md-h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="md-h1">$1</div>')
    // 引用块
    .replace(/^> (.+)$/gm, '<div class="md-quote">$1</div>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 分隔线
    .replace(/^---$/gm, '<div class="md-hr"></div>')
    // 段落
    .replace(/\n\n/g, '</div><div class="md-para">')
    // 换行
    .replace(/\n/g, '<br/>')
}

export default function MindChatPage() {
  const router = useRouter()
  const { isLoggedIn, userInfo } = useUserStore()
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
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

  // Agent 执行 - 分身的核心能力
  const executeAsAgent = async (content: string) => {
    try {
      setCurrentStatus('分析任务...')
      
      // 构建对话历史
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      setCurrentStatus('执行中...')
      
      const res = await Network.request({
        url: '/api/agent/execute',
        method: 'POST',
        data: {
          avatar_id: avatar?.id,
          task_description: content,
          conversation_id: conversation?.id,
          conversation_history: conversationHistory
        }
      })
      
      console.log('[MindChat] Agent 执行结果:', res)
      
      const result = res.data?.data as AgentResult
      
      if (result) {
        // 更新执行步骤展示
        const steps: AgentStepDisplay[] = result.steps
          .filter(s => s.action)
          .map(s => ({
            action: s.action || '',
            displayName: TOOL_DISPLAY_NAMES[s.action || ''] || s.action || '执行操作',
            status: s.observation?.success ? 'success' : 'failed',
            message: s.observation?.message || s.observation?.error || ''
          }))
        
        setAgentSteps(steps)
        
        // 构建回复消息
        let replyContent = result.finalAnswer
        
        // 如果有媒体内容，提取出来
        const media: MessageMedia[] = []
        result.steps.forEach(step => {
          if (step.observation?.data) {
            const data = step.observation.data
            // 封面图
            if (data.cover_image_url) {
              media.push({ type: 'image', url: data.cover_image_url })
            }
            // 生成的图片
            if (data.image_urls?.length) {
              data.image_urls.forEach((url: string) => {
                media.push({ type: 'image', url })
              })
            }
            // 生成的视频
            if (data.video_url) {
              media.push({ type: 'video', url: data.video_url })
            }
            // 文章内容
            if (data.content && data.title) {
              media.push({ 
                type: 'article', 
                title: data.title,
                content: data.content 
              })
            }
          }
        })
        
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
        setCurrentStatus('')
        scrollToBottom()
        
        // 更新学习数据
        fetchLearningStats()
        
        // 如果需要配置，保存消息并打开配置弹窗
        if (result.requiresConfig && result.configPlatform) {
          setPendingMessage(content)  // 保存待重试的消息
          setConfigPlatform(result.configPlatform)
          setShowConfigDialog(true)
        }
      }
    } catch (err) {
      console.error('[MindChat] Agent 执行失败:', err)
      throw err
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
        {msg.metadata?.media && msg.metadata.media.length > 0 && (
          <View className="media-container">
            {msg.metadata.media.map((media, idx) => {
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
                      objectFit="cover"
                    />
                  </View>
                )
              }
              
              if (media.type === 'article') {
                return (
                  <View key={idx} className="media-item article">
                    <View className="article-header">
                      <FileText size={20} color="#00f5ff" />
                      <Text className="article-title">{media.title || '文章'}</Text>
                    </View>
                    <View className="article-body">
                      <RichText 
                        nodes={markdownToNodes(media.content || '')}
                        className="article-content"
                      />
                    </View>
                  </View>
                )
              }
              
              return null
            })}
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
                      {step.status === 'success' ? (
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
