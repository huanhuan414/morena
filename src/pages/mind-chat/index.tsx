import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useRouter, redirectTo, showToast } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { 
  Send, Sparkles, Bot, Copy, History, X, Settings, Brain, TrendingUp, Award, Target,
  MessageCircle
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
  }
}

interface LearningStats {
  messageCount: number
  learningDays: number
  masteryLevel: number
  avgMessageLength: number
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
  const [activeTab, setActiveTab] = useState<'chat' | 'learn'>('chat')
  const [learningStats, setLearningStats] = useState<LearningStats>({
    messageCount: 0,
    learningDays: 0,
    masteryLevel: 0,
    avgMessageLength: 0
  })
  
  const scrollViewRef = useRef<number>(0)
  const isFirstLoadRef = useRef<boolean>(true)

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

  const fetchConversations = async () => {
    try {
      console.log('[MindChat] 获取历史对话列表')
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
      console.log('[MindChat] fetchOrCreateConversation - avatarId:', avatarId)
      
      const conversationsRes = await Network.request({ url: '/api/chat/conversations' })
      
      if (conversationsRes.data?.code === 200 && conversationsRes.data.data?.length > 0) {
        const latestConv = conversationsRes.data.data[0]
        console.log('[MindChat] 加载最新对话:', latestConv.id)
        setConversation(latestConv)
        await fetchMessages(latestConv.id)
      } else {
        console.log('[MindChat] 创建新对话')
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
      console.log('[MindChat] 获取消息, 对话ID:', conversationId)
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
    console.log('[MindChat] 切换对话:', conv.id)
    setConversation(conv)
    setMessages([])
    await fetchMessages(conv.id)
    setShowHistory(false)
    showToast({ title: '已切换对话', icon: 'success', duration: 1000 })
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
        fetchConversations()
        fetchLearningStats()
      }
    } catch (error) {
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `我收到了你的消息："${messageText}"。作为${avatar?.name || 'AI助手'}，我会尽力帮助你。`,
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
    scrollViewRef.current = 999999
  }

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
    <View className="mind-chat-page">
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
          <Button className="header-btn">
            <Settings size={22} color="rgba(255,255,255,0.6)" />
          </Button>
        </View>
      </View>

      {/* Tab切换 */}
      <View className="tab-switcher">
        <View 
          className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageCircle size={18} color={activeTab === 'chat' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">对话</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'learn' ? 'active' : ''}`}
          onClick={() => setActiveTab('learn')}
        >
          <Brain size={18} color={activeTab === 'learn' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">学习</Text>
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
                      <Text className="history-time">{formatTime(conv.updated_at)}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 对话内容区 */}
      {activeTab === 'chat' && (
        <ScrollView 
          className="messages-scroll"
          scrollY
          scrollTop={scrollViewRef.current}
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
              <Text className="empty-desc">发送消息开始心智交流</Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View 
                key={msg.id} 
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
          
          <View className="messages-bottom" />
        </ScrollView>
      )}

      {/* 学习数据区 */}
      {activeTab === 'learn' && (
        <ScrollView className="learn-scroll" scrollY>
          <View className="learn-section">
            <View className="learn-header">
              <Brain size={24} color="#00f5ff" />
              <Text className="learn-title">心智成长</Text>
            </View>

            {/* 统计卡片 */}
            <View className="stats-grid">
              <View className="stat-card">
                <MessageCircle size={20} color="#bf00ff" />
                <Text className="stat-value">{learningStats.messageCount}</Text>
                <Text className="stat-label">对话次数</Text>
              </View>
              <View className="stat-card">
                <TrendingUp size={20} color="#00ff88" />
                <Text className="stat-value">{learningStats.learningDays}</Text>
                <Text className="stat-label">学习天数</Text>
              </View>
              <View className="stat-card">
                <Target size={20} color="#ff00aa" />
                <Text className="stat-value">{learningStats.masteryLevel}%</Text>
                <Text className="stat-label">掌握程度</Text>
              </View>
              <View className="stat-card">
                <Award size={20} color="#00f5ff" />
                <Text className="stat-value">Lv.{avatar?.level || 1}</Text>
                <Text className="stat-label">分身等级</Text>
              </View>
            </View>

            {/* 进度条 */}
            <View className="progress-section">
              <Text className="progress-label">成长进度</Text>
              <View className="progress-bar">
                <View 
                  className="progress-fill" 
                  style={{ width: `${learningStats.masteryLevel}%` }}
                />
              </View>
              <Text className="progress-text">{learningStats.masteryLevel}%</Text>
            </View>

            {/* 学习提示 */}
            <View className="learn-tips">
              <View className="tip-card">
                <Sparkles size={18} color="#00f5ff" />
                <Text className="tip-text">
                  你的AI分身正在学习中，多与它对话，它会越来越像你！
                </Text>
              </View>
              <View className="tip-card">
                <Brain size={18} color="#bf00ff" />
                <Text className="tip-text">
                  对话次数越多，分身的学习能力越强，模拟越准确。
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* 输入区域 */}
      {activeTab === 'chat' && (
        <View className="input-area">
          <View className="input-wrap">
            <View className="input-container">
              <Input
                className="chat-input"
                placeholder="输入消息..."
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
        </View>
      )}
    </View>
  )
}
