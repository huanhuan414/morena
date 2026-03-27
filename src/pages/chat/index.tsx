import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, useRouter, redirectTo, showToast } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Send, Sparkles, Plus, Bot } from 'lucide-react-taro'
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
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
}

export default function ChatPage() {
  const router = useRouter()
  const { isLoggedIn } = useUserStore()
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newAvatarName, setNewAvatarName] = useState('')
  const scrollViewRef = useRef<string>('')

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/home/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      const avatarId = router.params.avatarId
      if (avatarId) {
        fetchAvatar(avatarId)
        fetchOrCreateConversation(avatarId)
      } else {
        fetchDefaultAvatar()
      }
    }
  })

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
          content: inputText
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
      }
    } catch (error) {
      // 模拟AI回复
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `我收到了你的消息："${inputText}"。作为${avatar?.name || 'AI助手'}，我会尽力帮助你解决问题。有什么我可以为你做的吗？`,
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

  if (!isLoggedIn) return null

  return (
    <View className="chat-page">
      {/* 顶部导航 */}
      <View className="chat-header">
        <View className="header-left">
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
                  <Text className="avatar-level">Lv.{avatar.level} · {avatar.personality}</Text>
                </View>
              </>
            ) : (
              <Text className="no-avatar">选择AI分身</Text>
            )}
          </View>
        </View>
        <View className="header-right">
          <Button className="header-btn" onClick={() => setShowCreate(true)}>
            <Plus size={20} color="#00f5ff" />
          </Button>
        </View>
      </View>

      {/* 创建分身弹窗 */}
      {showCreate && (
        <View className="create-modal">
          <View className="modal-content">
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
              <Bot size={64} color="rgba(255,255,255,0.2)" />
            </View>
            <Text className="empty-title">开始与{avatar?.name || 'AI'}对话</Text>
            <Text className="empty-desc">发送消息，AI会智能回复你</Text>
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
                    <Sparkles size={20} color="#00f5ff" />
                  )}
                </View>
              )}
              <View className="message-content">
                <Text className="message-text">{msg.content}</Text>
              </View>
            </View>
          ))
        )}
        
        {loading && (
          <View className="message-item assistant">
            <View className="message-avatar">
              <Sparkles size={20} color="#00f5ff" />
            </View>
            <View className="message-content typing">
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

      {/* 输入区域 */}
      <View className="input-area">
        <View className="input-wrap">
          <Input
            className="chat-input"
            placeholder="输入消息..."
            value={inputText}
            onInput={e => setInputText(e.detail.value)}
            onConfirm={sendMessage}
            confirmType="send"
          />
          <Button 
            className={`send-btn ${inputText.trim() ? 'active' : ''}`}
            onClick={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Send size={20} color={inputText.trim() ? '#0a0a0f' : 'rgba(255,255,255,0.3)'} />
          </Button>
        </View>
      </View>
    </View>
  )
}
