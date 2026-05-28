import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Bot,
  Send,
  User,
  Sparkles,
  Pencil,
  MessageSquare,
  RefreshCw,
} from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

interface Message {
  id: string
  senderName: string
  content: string
  msgType: 'user' | 'avatar' | 'system'
  avatarReply?: string
  userCorrection?: string
  correctionDiff?: string
  learnedFromCorrection?: string
  timestamp: string
  isCorrecting?: boolean
}

const GroupChat = () => {
  const [groupId, setGroupId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [correctingMsgId, setCorrectingMsgId] = useState<string | null>(null)
  const [correctionText, setCorrectionText] = useState('')

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.groupId) {
      setGroupId(params.groupId)
    }
  }, [])

  useEffect(() => {
    if (groupId) {
      loadMessages()
    }
  }, [groupId])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/group-bot/groups/${groupId}/messages`,
        method: 'GET',
      })
      console.log('[group-chat] loadMessages response:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setMessages(res.data.data)
        if (res.data.data.groupName) {
          setGroupName(res.data.data.groupName)
        }
      }
    } catch (err) {
      console.error('[group-chat] loadMessages error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendAsAvatar = async () => {
    if (!inputText.trim()) return
    try {
      const res = await Network.request({
        url: `/api/group-bot/groups/${groupId}/send`,
        method: 'POST',
        data: {
          content: inputText,
          asAvatar: true,
        },
      })
      console.log('[group-chat] sendAsAvatar response:', res.data)
      if (res.data?.code === 200) {
        setInputText('')
        loadMessages()
      }
    } catch (err) {
      console.error('[group-chat] sendAsAvatar error:', err)
    }
  }

  const startCorrection = (msg: Message) => {
    setCorrectingMsgId(msg.id)
    setCorrectionText(msg.avatarReply || msg.content)
  }

  const submitCorrection = async () => {
    if (!correctingMsgId || !correctionText.trim()) return
    try {
      const res = await Network.request({
        url: `/api/group-bot/groups/${groupId}/correct`,
        method: 'POST',
        data: {
          messageId: correctingMsgId,
          correction: correctionText,
        },
      })
      console.log('[group-chat] correct response:', res.data)
      if (res.data?.code === 200) {
        setCorrectingMsgId(null)
        setCorrectionText('')
        loadMessages()
      }
    } catch (err) {
      console.error('[group-chat] correct error:', err)
    }
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const renderMessage = (msg: Message) => {
    const isAvatar = msg.msgType === 'avatar'
    const isSystem = msg.msgType === 'system'

    if (isSystem) {
      return (
        <View key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '16rpx 0' }}>
          <Text className="text-xs text-gray-400" style={{ backgroundColor: '#f3f4f6', padding: '4rpx 24rpx', borderRadius: '999rpx' }}>
            {msg.content}
          </Text>
        </View>
      )
    }

    return (
      <View key={msg.id} className={`msg-bubble ${isAvatar ? 'msg-avatar' : 'msg-user'}`}>
        {/* 头像和名字 */}
        <View className="msg-sender">
          {isAvatar ? (
            <View className="msg-sender-icon msg-sender-icon-avatar">
              <Bot size={14} color="#3b82f6" />
            </View>
          ) : (
            <View className="msg-sender-icon msg-sender-icon-user">
              <User size={14} color="#6b7280" />
            </View>
          )}
          <Text className="msg-sender-name">{msg.senderName}</Text>
          {isAvatar && (
            <Badge variant="outline" className="msg-badge">
              <Text className="text-xs text-blue-500">分身</Text>
            </Badge>
          )}
          <Text className="msg-time">{formatTime(msg.timestamp)}</Text>
        </View>

        {/* 消息内容 */}
        <View className={`msg-content ${isAvatar ? 'msg-content-avatar' : 'msg-content-user'}`}>
          <Text className="msg-text">{msg.content}</Text>

          {/* 分身回复内容 */}
          {isAvatar && msg.avatarReply && msg.avatarReply !== msg.content && (
            <View className="msg-reply-area">
              <Text className="msg-reply-label">分身回复</Text>
              <Text className="msg-reply-text">{msg.avatarReply}</Text>
            </View>
          )}

          {/* 用户纠正 */}
          {msg.userCorrection && (
            <View className="msg-correction-area">
              <View className="msg-correction-header">
                <Pencil size={12} color="#f97316" />
                <Text className="msg-correction-label">你的纠正</Text>
              </View>
              <Text className="msg-correction-text">{msg.userCorrection}</Text>

              {/* 学习结果 */}
              {msg.learnedFromCorrection && (
                <View className="msg-learned">
                  <View className="msg-learned-header">
                    <Sparkles size={12} color="#22c55e" />
                    <Text className="msg-learned-label">分身学到了</Text>
                  </View>
                  <Text className="msg-learned-text">
                    {msg.learnedFromCorrection}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 纠正输入框 */}
          {correctingMsgId === msg.id && (
            <View className="msg-correct-input">
              <Text className="msg-correct-label">纠正分身回复：</Text>
              <View className="msg-correct-textarea-wrap">
                <Textarea
                  style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }}
                  value={correctionText}
                  onInput={e => setCorrectionText(e.detail.value)}
                  placeholder="输入你觉得正确的回复..."
                />
              </View>
              <View className="msg-correct-actions">
                <View className="msg-correct-action">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setCorrectingMsgId(null)}
                  >
                    <Text>取消</Text>
                  </Button>
                </View>
                <View className="msg-correct-action">
                  <Button size="sm" className="w-full" onClick={submitCorrection}>
                    <Text>提交纠正</Text>
                  </Button>
                </View>
              </View>
            </View>
          )}

          {/* 操作按钮 */}
          {isAvatar && !correctingMsgId && !msg.userCorrection && (
            <View className="msg-actions">
              <View className="msg-action-btn" onClick={() => startCorrection(msg)}>
                <Pencil size={12} color="#f97316" />
                <Text className="msg-action-text">纠正</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className="chat-page">
      <PageHeader title={groupName || '群聊'} showBack background="#f8fafc" />

      {/* 消息列表 */}
      <ScrollView scrollY className="chat-scroll" scrollIntoView="">
        {/* 群信息条 */}
        <View className="chat-status-bar">
          <View className="chat-status-row">
            <View className="chat-status-left">
              <Bot size={14} color="#3b82f6" />
              <Text className="chat-status-text">分身值守中</Text>
            </View>
            <View className="chat-status-right" onClick={loadMessages}>
              <RefreshCw size={12} color="#9ca3af" />
              <Text className="chat-status-refresh">刷新</Text>
            </View>
          </View>
        </View>

        {/* 提示条 */}
        <View className="chat-tip">
          <View className="chat-tip-inner">
            <Text className="chat-tip-text">
              群里@分身时，分身会用你的风格自动回复。点击「纠正」可以教分身更好地模仿你。
            </Text>
          </View>
        </View>

        {/* 消息 */}
        <View className="chat-messages">
          {loading ? (
            <View className="chat-loading">
              <Text className="chat-loading-text">加载中...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View className="chat-empty">
              <MessageSquare size={48} color="#d1d5db" />
              <Text className="chat-empty-title">还没有消息</Text>
              <Text className="chat-empty-desc">在群里@分身，分身会自动回复</Text>
            </View>
          ) : (
            messages.map(msg => renderMessage(msg))
          )}
        </View>
      </ScrollView>

      {/* 底部输入栏 */}
      <View
        className="chat-input-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#fff',
          borderTop: '1px solid #f1f5f9',
          zIndex: 100,
        }}
      >
        <View
          className="chat-input-wrap"
        >
          <Input
            style={{ width: '100%', fontSize: '14px' }}
            placeholder="以分身身份发消息..."
            value={inputText}
            onInput={e => setInputText(e.detail.value)}
            onConfirm={handleSendAsAvatar}
          />
        </View>
        <View className="chat-input-btn">
          <Button size="sm" onClick={handleSendAsAvatar} disabled={!inputText.trim()}>
            <Send size={14} color="#fff" />
          </Button>
        </View>
      </View>
    </View>
  )
}

export default GroupChat
