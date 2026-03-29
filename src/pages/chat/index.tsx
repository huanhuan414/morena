import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useRouter, redirectTo, showToast, getEnv, ENV_TYPE } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { 
  Send, Sparkles, Plus, Bot, Loader, Check, FileText, Search, Image as ImageIcon, Video, ExternalLink,
  Mic, History, X, Settings, Copy
} from 'lucide-react-taro'
import './index.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
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

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
}

interface TaskLog {
  tool?: string
  action?: string
  success?: boolean
  thought?: string
  observation?: string
  timestamp: string
}

interface Task {
  id: string
  title: string
  description: string
  task_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  result?: {
    summary?: string
    title?: string
    content?: string
    type?: string
    url?: string
    style?: string
    size?: string
    duration?: number
    ratio?: string
    resolution?: string
    hasAudio?: boolean
  }
  logs: TaskLog[]
  created_at: string
  completed_at?: string
}

export default function ChatPage() {
  const router = useRouter()
  const { isLoggedIn, userInfo } = useUserStore()
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [newAvatarName, setNewAvatarName] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const scrollViewRef = useRef<string>('')
  const taskPollingRef = useRef<NodeJS.Timeout | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recorderManagerRef = useRef<Taro.RecorderManager | null>(null)

  const isWeapp = getEnv() === ENV_TYPE.WEAPP

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/home/index' })
    }
    
    // 初始化录音管理器
    if (isWeapp) {
      recorderManagerRef.current = Taro.getRecorderManager()
      recorderManagerRef.current.onStop((res) => {
        const { tempFilePath, duration } = res
        handleRecordingComplete(tempFilePath, duration)
      })
      recorderManagerRef.current.onError((err) => {
        console.error('录音失败:', err)
        showToast({ title: '录音失败', icon: 'none' })
        setIsRecording(false)
      })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      const avatarId = router.params.avatarId
      const command = router.params.command
      
      if (avatarId) {
        fetchAvatar(avatarId)
        fetchOrCreateConversation(avatarId)
      } else {
        fetchDefaultAvatar()
      }
      
      // 如果有快速指令，自动发送
      if (command) {
        setTimeout(() => {
          setInputText(decodeURIComponent(command))
        }, 500)
      }
      
      // 获取历史对话列表
      fetchConversations()
    }
  })

  // 清理任务轮询和录音定时器
  useEffect(() => {
    return () => {
      if (taskPollingRef.current) {
        clearInterval(taskPollingRef.current)
        taskPollingRef.current = null
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }, [])

  const fetchConversations = async () => {
    try {
      const res = await Network.request({ url: '/api/chat/conversations' })
      if (res.data?.code === 200) {
        setConversations(res.data.data || [])
      }
    } catch (error) {
      console.error('获取对话列表失败:', error)
    }
  }

  const fetchDefaultAvatar = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const defaultAvatar = res.data.data[0]
        setAvatar(defaultAvatar)
        fetchOrCreateConversation(defaultAvatar.id)
      } else {
        setShowCreate(true)
      }
    } catch (error) {
      setShowCreate(true)
    }
  }

  const fetchAvatar = async (avatarId: string) => {
    try {
      const res = await Network.request({ url: `/api/avatar/${avatarId}` })
      if (res.data?.code === 200) {
        setAvatar(res.data.data)
      }
    } catch (error) {
      console.error('获取分身失败:', error)
    }
  }

  const fetchOrCreateConversation = async (avatarId: string) => {
    try {
      const res = await Network.request({
        url: '/api/chat/conversation',
        method: 'POST',
        data: { avatar_id: avatarId }
      })
      if (res.data?.code === 200) {
        setConversation(res.data.data)
        fetchMessages(res.data.data.id)
      }
    } catch (error) {
      console.error('获取对话失败:', error)
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
      console.error('获取消息失败:', error)
    }
  }

  // 切换对话
  const switchConversation = async (conv: Conversation) => {
    setConversation(conv)
    await fetchMessages(conv.id)
    setShowHistory(false)
  }

  // 获取最新任务状态
  const fetchTaskStatus = async (taskId: string): Promise<Task | null> => {
    try {
      const res = await Network.request({ 
        url: `/api/task/${taskId}`
      })
      if (res.data?.code === 200) {
        return res.data.data
      }
      return null
    } catch (error) {
      console.error('获取任务状态失败:', error)
      return null
    }
  }

  // 开始轮询任务状态
  const startTaskPolling = (taskId: string) => {
    const poll = async () => {
      const task = await fetchTaskStatus(taskId)
      if (task) {
        setActiveTask(task)
        scrollToBottom()
        
        if (task.status === 'completed' || task.status === 'failed') {
          // 任务完成，停止轮询
          if (taskPollingRef.current) {
            clearInterval(taskPollingRef.current)
            taskPollingRef.current = null
          }
          
          // 刷新消息列表
          if (conversation) {
            fetchMessages(conversation.id)
          }
        }
      }
    }
    
    // 立即执行一次
    poll()
    // 每3秒轮询一次
    taskPollingRef.current = setInterval(poll, 3000)
  }

  const sendMessage = async () => {
    if (!inputText.trim() || !conversation || loading) {
      showToast({ title: '请输入消息', icon: 'none' })
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const messageText = inputText
    setInputText('')
    setLoading(true)
    scrollToBottom()

    try {
      const res = await Network.request({
        url: '/api/chat/send',
        method: 'POST',
        data: {
          conversation_id: conversation.id,
          avatar_id: avatar?.id,
          content: messageText
        }
      })

      if (res.data?.code === 200) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.data.content,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMessage])
        scrollToBottom()
        
        // 检查是否触发了 Agent 任务
        if (res.data.data.taskId) {
          startTaskPolling(res.data.data.taskId)
        }
        
        // 刷新对话列表
        fetchConversations()
      }
    } catch (error) {
      // 模拟AI回复
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `我收到了你的消息："${messageText}"。作为${avatar?.name || 'AI助手'}，我会尽力帮助你解决问题。有什么我可以为你做的吗？`,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMessage])
        scrollToBottom()
      }, 1000)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    scrollViewRef.current = Date.now().toString()
  }

  const createAvatar = async () => {
    if (!newAvatarName.trim()) {
      showToast({ title: '请输入分身名称', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        data: {
          name: newAvatarName,
          personality: 'friendly',
          abilities: ['chat', 'learning']
        }
      })

      if (res.data?.code === 200) {
        setAvatar(res.data.data)
        setShowCreate(false)
        setNewAvatarName('')
        fetchOrCreateConversation(res.data.data.id)
        showToast({ title: '创建成功', icon: 'success' })
      }
    } catch (error) {
      // 模拟创建
      const mockAvatar: Avatar = {
        id: 'mock-avatar-id',
        name: newAvatarName,
        avatar_url: '',
        level: 1,
        personality: 'friendly'
      }
      setAvatar(mockAvatar)
      setShowCreate(false)
      setNewAvatarName('')
      showToast({ title: '创建成功', icon: 'success' })
    }
  }

  // 语音录制
  const startRecording = async () => {
    if (!isWeapp) {
      showToast({ title: '语音输入仅支持小程序', icon: 'none' })
      return
    }

    try {
      setIsRecording(true)
      setRecordingDuration(0)
      
      // 开始计时
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
      
      // 开始录音
      recorderManagerRef.current?.start({
        format: 'mp3',
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000
      })
    } catch (error) {
      console.error('开始录音失败:', error)
      showToast({ title: '录音失败', icon: 'none' })
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (isRecording && recorderManagerRef.current) {
      recorderManagerRef.current.stop()
      setIsRecording(false)
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  // 录音完成处理
  const handleRecordingComplete = async (tempFilePath: string, duration: number) => {
    if (duration < 1000) {
      showToast({ title: '录音时间太短', icon: 'none' })
      return
    }

    showToast({ title: '正在识别...', icon: 'loading', duration: 5000 })
    
    try {
      // 上传音频文件进行识别
      const uploadRes = await Network.uploadFile({
        url: '/api/audio/asr',
        filePath: tempFilePath,
        name: 'audio'
      })
      
      console.log('[Chat] 语音识别响应:', uploadRes.data)
      
      // 解析响应数据
      let result: any = uploadRes.data
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result)
        } catch (e) {
          console.error('[Chat] 解析响应失败:', e)
        }
      }
      
      if (result?.code === 200 && result.data?.text) {
        setInputText(result.data.text)
        showToast({ title: '识别成功', icon: 'success' })
      } else {
        showToast({ title: '识别失败', icon: 'none' })
      }
    } catch (error) {
      console.error('语音识别失败:', error)
      showToast({ title: '识别失败', icon: 'none' })
    }
  }

  // 复制消息
  const copyMessage = (content: string) => {
    Taro.setClipboardData({
      data: content,
      success: () => {
        showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  if (!isLoggedIn) return null

  return (
    <View className="chat-page">
      {/* 背景效果 */}
      <View className="bg-glow" />
      <View className="grid-overlay" />

      {/* 顶部导航 */}
      <View className="chat-header">
        <View className="header-left">
          <Button className="header-btn" onClick={() => setShowHistory(true)}>
            <History size={22} color="#00f5ff" />
          </Button>
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
                    <Text className="status-text">在线</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text className="no-avatar">选择AI分身</Text>
            )}
          </View>
        </View>
        <View className="header-right">
          <Button className="header-btn" onClick={() => setShowCreate(true)}>
            <Plus size={22} color="#00f5ff" />
          </Button>
          <Button className="header-btn">
            <Settings size={22} color="rgba(255,255,255,0.6)" />
          </Button>
        </View>
      </View>

      {/* 历史记录抽屉 */}
      {showHistory && (
        <View className="history-drawer-mask" onClick={() => setShowHistory(false)}>
          <View className="history-drawer" onClick={e => e.stopPropagation()}>
            <View className="drawer-header">
              <Text className="drawer-title">历史对话</Text>
              <Button className="drawer-close" onClick={() => setShowHistory(false)}>
                <X size={24} color="rgba(255,255,255,0.6)" />
              </Button>
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
                      <Text className="history-time">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </Text>
                    </View>
                    {conversation?.id === conv.id && (
                      <View className="history-active-dot" />
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 创建分身弹窗 */}
      {showCreate && (
        <View className="create-modal" onClick={() => setShowCreate(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <Text className="modal-title">创建AI分身</Text>
            <View className="modal-input-wrap">
              <Input
                className="modal-input"
                placeholder="给分身起个名字"
                value={newAvatarName}
                onInput={e => setNewAvatarName(e.detail.value)}
              />
            </View>
            <View className="modal-actions">
              <Button className="modal-cancel" onClick={() => setShowCreate(false)}>
                <Text className="cancel-text">取消</Text>
              </Button>
              <Button className="modal-confirm" onClick={createAvatar}>
                <Text className="confirm-text">创建</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 消息区域 */}
      <ScrollView 
        className="messages-scroll"
        scrollY
        scrollIntoView={scrollViewRef.current}
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
            <Text className="empty-title">开始与{avatar?.name || 'AI'}对话</Text>
            <Text className="empty-desc">发送消息或使用语音输入</Text>
            
            {/* 快捷建议 */}
            <View className="quick-suggestions">
              <View 
                className="suggestion-chip"
                onClick={() => setInputText('帮我搜索最新的AI新闻')}
              >
                <Search size={16} color="#00f5ff" />
                <Text className="suggestion-text">搜索AI新闻</Text>
              </View>
              <View 
                className="suggestion-chip"
                onClick={() => setInputText('帮我生成一张创意图片')}
              >
                <ImageIcon size={16} color="#bf00ff" />
                <Text className="suggestion-text">生成图片</Text>
              </View>
              <View 
                className="suggestion-chip"
                onClick={() => setInputText('帮我写一份工作报告')}
              >
                <FileText size={16} color="#00ff88" />
                <Text className="suggestion-text">写工作报告</Text>
              </View>
            </View>
          </View>
        ) : (
          messages.map((msg) => (
            <View 
              key={msg.id} 
              id={msg.id}
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
                <Text className="message-text">{msg.content}</Text>
                <View className="message-footer">
                  <Text className="message-time">
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {msg.role === 'assistant' && (
                    <Button 
                      className="message-action"
                      onClick={() => copyMessage(msg.content)}
                    >
                      <Copy size={14} color="rgba(255,255,255,0.4)" />
                    </Button>
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
        
        {loading && (
          <View className="message-item assistant">
            <View className="message-avatar">
              {avatar?.avatar_url ? (
                <Image src={avatar.avatar_url} className="msg-avatar-img" mode="aspectFill" />
              ) : (
                <Sparkles size={24} color="#00f5ff" />
              )}
            </View>
            <View className="message-bubble typing">
              <View className="typing-dots">
                <View className="dot" />
                <View className="dot" />
                <View className="dot" />
              </View>
            </View>
          </View>
        )}
        
        {/* Agent 任务状态卡片 */}
        {activeTask && (activeTask.status === 'running' || activeTask.status === 'pending') && (
          <View className="task-card">
            <View className="task-header">
              <Loader size={18} className="animate-spin" color="#00f5ff" />
              <Text className="task-title">{activeTask.title}</Text>
            </View>
            <View className="task-progress">
              <View className="progress-bar">
                <View className="progress-fill" style={{ width: `${activeTask.progress}%` }} />
              </View>
              <Text className="progress-text">{activeTask.progress}%</Text>
            </View>
            {activeTask.logs && activeTask.logs.length > 0 && (
              <View className="task-logs">
                {activeTask.logs.filter(log => log.tool).slice(-3).map((log, idx) => (
                  <View key={idx} className="log-item">
                    {log.tool === 'search' && <Search size={14} color="#8b5cf6" />}
                    {log.tool === 'create_document' && <FileText size={14} color="#10b981" />}
                    {log.tool === 'generate_image' && <ImageIcon size={14} color="#bf00ff" />}
                    {log.tool === 'generate_video' && <Video size={14} color="#ff00aa" />}
                    <Text className="log-text">{log.action}</Text>
                    {log.success && <Check size={14} color="#10b981" />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        
        {/* 任务完成卡片 */}
        {activeTask && activeTask.status === 'completed' && (
          <View className="task-card completed">
            <View className="task-header">
              <Check size={18} color="#10b981" />
              <Text className="task-title">任务完成</Text>
            </View>
            
            {/* 图片结果展示 */}
            {activeTask.result?.type === 'image' && activeTask.result?.url && (
              <View className="result-image-container">
                <Image 
                  src={activeTask.result.url} 
                  className="result-image" 
                  mode="widthFix"
                  onClick={() => {
                    const imageUrl = activeTask.result?.url
                    if (imageUrl) {
                      Taro.previewImage({
                        current: imageUrl,
                        urls: [imageUrl]
                      })
                    }
                  }}
                />
                <View className="result-meta">
                  <ImageIcon size={14} color="#bf00ff" />
                  <Text className="meta-text">{activeTask.result.style || 'AI生成图片'}</Text>
                </View>
              </View>
            )}
            
            {/* 视频结果展示 */}
            {activeTask.result?.type === 'video' && activeTask.result?.url && (
              <View className="result-video-container">
                <video 
                  src={activeTask.result.url}
                  className="result-video"
                  controls
                  playsInline
                  poster=""
                />
                <View className="result-meta">
                  <Video size={14} color="#ff00aa" />
                  <Text className="meta-text">{activeTask.result.duration || 5}秒 · {activeTask.result.ratio || '16:9'}</Text>
                </View>
              </View>
            )}
            
            {/* 文档结果展示 */}
            {activeTask.result?.type === 'document' && activeTask.result?.title && (
              <View className="result-document">
                <FileText size={28} color="#00f5ff" />
                <View className="document-info">
                  <Text className="document-title">{activeTask.result.title}</Text>
                  <Text className="document-desc">{activeTask.result.summary || '点击查看详情'}</Text>
                </View>
                <ExternalLink size={18} color="#00f5ff" />
              </View>
            )}
            
            {/* 报告结果展示 */}
            {activeTask.result?.type === 'report' && activeTask.result?.content && (
              <View className="result-report">
                <Text className="report-content">{activeTask.result.content}</Text>
              </View>
            )}
            
            {/* 默认摘要展示 */}
            {activeTask.result?.summary && !['image', 'video', 'document', 'report'].includes(activeTask.result.type || '') && (
              <Text className="task-summary">{activeTask.result.summary}</Text>
            )}
          </View>
        )}
        
        <View className="messages-bottom" />
      </ScrollView>

      {/* 输入区域 */}
      <View className="input-area">
        <View className="input-wrap">
          {isWeapp && (
            <Button 
              className={`voice-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              onTouchStart={isRecording ? undefined : startRecording}
              onTouchEnd={isRecording ? stopRecording : undefined}
            >
              {isRecording ? (
                <View className="recording-indicator">
                  <View className="recording-wave" />
                  <Text className="recording-time">{recordingDuration}s</Text>
                </View>
              ) : (
                <Mic size={22} color="rgba(255,255,255,0.6)" />
              )}
            </Button>
          )}
          <View className="input-container">
            <Input
              className="chat-input"
              placeholder={isWeapp ? "输入或语音..." : "输入消息..."}
              value={inputText}
              onInput={e => setInputText(e.detail.value)}
              onConfirm={sendMessage}
              confirmType="send"
            />
          </View>
          <Button 
            className={`send-btn ${inputText.trim() ? 'active' : ''}`}
            onClick={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Send size={22} color={inputText.trim() ? '#0a0a0f' : 'rgba(255,255,255,0.3)'} />
          </Button>
        </View>
        
        {/* 录音提示 */}
        {isRecording && (
          <View className="recording-tip">
            <View className="tip-dot" />
            <Text className="tip-text">松开发送，上滑取消</Text>
          </View>
        )}
      </View>
    </View>
  )
}
