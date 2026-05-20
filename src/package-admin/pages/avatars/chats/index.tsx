import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

interface ConversationItem {
  id: string
  user_id: string
  avatar_id: string
  title: string
  updated_at?: string
  created_at?: string
  user_phone?: string
  user_nickname?: string
  message_count?: number | string
}

interface MessageItem {
  id: string
  conversation_id: string
  role: string
  content: string
  metadata?: any
  created_at: string
}

export default function AdminAvatarChats() {
  const avatarId = useMemo(() => {
    const { avatar_id } = Taro.getCurrentInstance().router?.params || {}
    return String(avatar_id || '').trim()
  }, [])

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [messages, setMessages] = useState<MessageItem[]>([])

  const formatDateTime = (value: any) => {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN')
  }

  const toNumber = (value: any) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  useEffect(() => {
    if (!avatarId) return
    fetchConversations()
  }, [avatarId])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }
    fetchMessages(selectedConversationId)
  }, [selectedConversationId])

  const fetchConversations = async () => {
    try {
      const res = await Network.request({
        url: `/api/admin/avatars/${avatarId}/conversations`,
        data: { page: 1, limit: 50 }
      })
      if (res.data.code === 200) {
        const list = Array.isArray(res.data.data?.list) ? res.data.data.list : []
        setConversations(list)
        if (list.length > 0 && !selectedConversationId) {
          setSelectedConversationId(String(list[0].id || ''))
        }
      }
    } catch (err) {
      console.error('获取聊天会话失败:', err)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await Network.request({ url: `/api/admin/conversations/${conversationId}/messages` })
      if (res.data.code === 200) {
        const list = Array.isArray(res.data.data) ? res.data.data : []
        setMessages(list)
      }
    } catch (err) {
      console.error('获取消息失败:', err)
    }
  }

  const handleGoBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="avatar-chats-page">
      <View className="detail-header">
        <View className="back-btn" onClick={handleGoBack}>
          <ArrowLeft size={24} color="#374151" />
        </View>
        <Text className="detail-title">聊天记录</Text>
        <View className="header-placeholder" />
      </View>

      <View className="conversations-card">
        {conversations.length === 0 ? (
          <Text className="empty-text">暂无会话</Text>
        ) : (
          <ScrollView scrollY style={{ maxHeight: '520rpx' }}>
            {conversations.map((conv) => {
              const active = String(conv.id) === String(selectedConversationId)
              const nickname = String(conv.user_nickname || '').trim()
              const phone = String(conv.user_phone || '').trim()
              const userText = nickname && phone ? `${nickname} / ${phone}` : nickname || phone || '-'
              return (
                <View
                  key={conv.id}
                  className={`conv-row ${active ? 'active' : ''}`}
                  onClick={() => setSelectedConversationId(String(conv.id))}
                >
                  <View className="conv-main">
                    <Text className="conv-title">{conv.title || '新对话'}</Text>
                    <Text className="conv-sub">{userText}</Text>
                  </View>
                  <View className="conv-meta">
                    <Text className="conv-time">{formatDateTime(conv.updated_at || conv.created_at)}</Text>
                    <Text className="conv-count">{toNumber(conv.message_count)}条</Text>
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}
      </View>

      <View className="messages-card">
        <View className="messages-header">
          <Text className="messages-title">消息</Text>
        </View>
        {selectedConversationId ? (
          <ScrollView className="messages-body" scrollY>
            {messages.length === 0 ? (
              <Text className="empty-text">暂无消息</Text>
            ) : (
              messages.map((msg) => (
                <View key={msg.id} className={`msg-row ${msg.role === 'assistant' ? 'assistant' : 'user'}`}>
                  <View>
                    <Text className="msg-bubble">{msg.content}</Text>
                    <Text className="msg-time">{formatDateTime(msg.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : (
          <Text className="empty-text">请选择一个会话</Text>
        )}
      </View>
    </View>
  )
}

