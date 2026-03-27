import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, useRouter, redirectTo, showToast } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Send, Mic, Sparkles, ArrowLeft } from 'lucide-react-taro'
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
    const { avatarId, create } = router.params
    if (create === 'true') {
      setShowCreate(true)
    } else if (avatarId) {
      loadAvatarAndConversation(avatarId)
    } else {
      loadConversations()
    }
  })

  const loadAvatarAndConversation = async (avatarId: string) => {
    try {
      const avatarRes = await Network.request({ url: `/api/avatar/${avatarId}` })
      if (avatarRes.data?.code === 200) {
        setAvatar(avatarRes.data.data)
      }

      const convRes = await Network.request({
        url: '/api/chat/conversation',
        method: 'POST',
        data: { avatar_id: avatarId }
      })
      if (convRes.data?.code === 200) {
        setConversation(convRes.data.data)
        loadMessages(convRes.data.data.id)
      }
    } catch (error) {
      console.error('加载失败:', error)
    }
  }

  const loadConversations = async () => {
    try {
      const res = await Network.request({ url: '/api/chat/conversations' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const firstConv = res.data.data[0]
        setConversation(firstConv)
        if (firstConv.avatar_id) {
          loadAvatarAndConversation(firstConv.avatar_id)
        }
        loadMessages(firstConv.id)
      }
    } catch (error) {
      console.error('加载对话列表失败:', error)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await Network.request({
        url: `/api/chat/conversation/${conversationId}/messages`
      })
      if (res.data?.code === 200) {
        setMessages(res.data.data || [])
        scrollViewRef.current = `msg-${Date.now()}`
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputText.trim() || !conversation || !avatar || loading) return

    const text = inputText.trim()
    setInputText('')
    setLoading(true)

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await Network.request({
        url: '/api/chat/send',
        method: 'POST',
        data: {
          conversation_id: conversation.id,
          avatar_id: avatar.id,
          content: text
        }
      })

      if (res.data?.code === 200) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.data.data.content,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      showToast({ title: '发送失败', icon: 'none' })
    } finally {
      setLoading(false)
      scrollViewRef.current = `msg-${Date.now()}`
    }
  }

  const createAvatar = async () => {
    if (!newAvatarName.trim()) return

    try {
      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        data: {
          name: newAvatarName,
          description: '我的AI分身',
          personality: '友善、专业、乐于助人'
        }
      })

      if (res.data?.code === 200) {
        const newAvatar = res.data.data
        setAvatar(newAvatar)
        setShowCreate(false)
        loadAvatarAndConversation(newAvatar.id)
        showToast({ title: '创建成功', icon: 'success' })
      }
    } catch (error) {
      console.error('创建分身失败:', error)
      showToast({ title: '创建失败', icon: 'none' })
    }
  }

  if (showCreate) {
    return (
      <View className="chat-container min-h-screen bg-slate-900 p-4">
        <View className="flex items-center mb-6">
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
            <ArrowLeft size={24} color="#f8fafc" />
          </Button>
          <Text className="text-lg font-semibold text-white ml-2">创建AI分身</Text>
        </View>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <View className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Sparkles size={40} color="#fff" />
            </View>
            
            <Text className="block text-white text-lg font-medium text-center mb-2">
              给你的AI分身起个名字
            </Text>
            <Text className="block text-slate-400 text-sm text-center mb-6">
              它将成为你的智能助手和伙伴
            </Text>

            <View className="bg-slate-700 rounded-xl p-3 mb-6">
              <Input
                className="w-full bg-transparent text-white placeholder-slate-400"
                placeholder="例如：小助手、智慧星..."
                value={newAvatarName}
                onInput={(e) => setNewAvatarName(e.detail.value)}
              />
            </View>

            <Button 
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
              onClick={createAvatar}
              disabled={!newAvatarName.trim()}
            >
              开始创建
            </Button>
          </CardContent>
        </Card>
      </View>
    )
  }

  return (
    <View className="chat-container flex flex-col h-screen bg-slate-900">
      {avatar && (
        <View className="flex items-center p-4 border-b border-slate-700 bg-slate-900">
          <View className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mr-3">
            {avatar.avatar_url ? (
              <Image src={avatar.avatar_url} className="w-full h-full rounded-full" mode="aspectFill" />
            ) : (
              <Text className="text-white font-bold">{avatar.name[0]}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white font-medium">{avatar.name}</Text>
            <Text className="text-slate-400 text-xs">Lv.{avatar.level} · {avatar.personality || '智能助手'}</Text>
          </View>
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
            <Sparkles size={20} color="#818cf8" />
          </Button>
        </View>
      )}

      <ScrollView 
        className="flex-1 p-4"
        scrollY
        scrollIntoView={scrollViewRef.current}
        scrollWithAnimation
      >
        {messages.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <View className="w-16 h-16 mb-4 rounded-full bg-indigo-500 bg-opacity-20 flex items-center justify-center">
              <Sparkles size={32} color="#818cf8" />
            </View>
            <Text className="text-slate-400 text-center">
              开始和 {avatar?.name || 'AI分身'} 对话吧{'\n'}可以说任何你想说的话
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {messages.map((msg, idx) => (
              <View 
                key={msg.id || idx}
                id={`msg-${idx}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <View className={`max-w-percent-80 ${msg.role === 'user' ? 'order-2' : ''}`}>
                  <View
                    className={`rounded-2xl p-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  >
                    <Text className={`text-sm leading-relaxed ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-200'
                    }`}
                    >
                      {msg.content}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-xs mt-1 px-2">
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
            
            {loading && (
              <View className="flex justify-start">
                <View
                  className="bg-slate-800 border border-slate-700 rounded-2xl p-3"
                >
                  <View className="flex space-x-1">
                    <View className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <View className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <View className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View className="p-4 border-t border-slate-700 bg-slate-900">
        <View className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Mic size={20} color="#64748b" />
          </Button>
          <View className="flex-1 bg-slate-800 rounded-full px-4 py-2">
            <Input
              className="w-full bg-transparent text-white text-sm placeholder-slate-400"
              placeholder="说点什么..."
              value={inputText}
              onInput={(e) => setInputText(e.detail.value)}
              onConfirm={sendMessage}
              confirmType="send"
            />
          </View>
          <Button 
            size="icon"
            className="shrink-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            onClick={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Send size={18} color="#fff" />
          </Button>
        </View>
      </View>
    </View>
  )
}
