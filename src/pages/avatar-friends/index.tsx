import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { 
  Sparkles, ArrowLeft, UserPlus, Heart, Phone, 
  MessageCircle, Star, Zap, Users
} from 'lucide-react-taro'
import './index.css'

interface FriendInfo {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
}

interface AvatarFriend {
  id: string
  avatar_id: string
  friend_id: string
  match_reason: string
  compatibility_score: number
  benefits?: string
  created_at: string
  friend?: FriendInfo
}

interface ChatMessage {
  id: string
  role: string
  content: string
  created_at: string
}

interface FriendChat {
  messages: ChatMessage[]
  match_reason?: string
  benefits?: string
}

export default function AvatarFriendsPage() {
  const router = useRouter()
  const { avatarId } = router.params
  
  const [friends, setFriends] = useState<AvatarFriend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState<AvatarFriend | null>(null)
  const [chatData, setChatData] = useState<FriendChat | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [callingFriend, setCallingFriend] = useState<string | null>(null)

  useLoad(() => {
    if (avatarId) {
      fetchFriends()
    }
  })

  const fetchFriends = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: `/api/avatar/${avatarId}/friends` })
      console.log('好友列表响应:', res.data)
      if (res.data?.code === 200) {
        setFriends(res.data.data || [])
      }
    } catch (error) {
      console.error('获取好友列表失败:', error)
      showToast({ title: '获取失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const viewChatHistory = async (friend: AvatarFriend) => {
    try {
      setChatLoading(true)
      setSelectedFriend(friend)
      
      const res = await Network.request({ 
        url: `/api/avatar/${avatarId}/chat/${friend.friend_id}` 
      })
      
      if (res.data?.code === 200) {
        setChatData(res.data.data)
      }
    } catch (error) {
      console.error('获取聊天记录失败:', error)
      showToast({ title: '获取聊天记录失败', icon: 'none' })
    } finally {
      setChatLoading(false)
    }
  }

  const startVoiceCall = async (friend: AvatarFriend) => {
    try {
      setCallingFriend(friend.friend_id)
      showToast({ title: '正在呼叫...', icon: 'loading', duration: 3000 })
      
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/call/${friend.friend_id}`,
        method: 'POST'
      })
      
      if (res.data?.code === 200) {
        const { audioUrl, friendName } = res.data.data
        console.log('语音通话响应:', res.data.data)
        
        showToast({ title: `${friendName}接通了！`, icon: 'success' })
        
        // 播放问候语音
        const innerAudioContext = Taro.createInnerAudioContext()
        innerAudioContext.src = audioUrl
        innerAudioContext.onPlay(() => {
          console.log('开始播放问候语音')
        })
        innerAudioContext.onError((err) => {
          console.error('语音播放失败:', err)
        })
        innerAudioContext.play()
      }
    } catch (error) {
      console.error('发起语音通话失败:', error)
      showToast({ title: '通话失败', icon: 'none' })
    } finally {
      setCallingFriend(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return '#00ff88'
    if (score >= 60) return '#00f5ff'
    if (score >= 40) return '#ffd700'
    return '#ff6b6b'
  }

  const getCompatibilityText = (score: number) => {
    if (score >= 80) return '高度契合'
    if (score >= 60) return '默契十足'
    if (score >= 40) return '互补成长'
    return '初识朋友'
  }

  return (
    <View className="af-page">
      {/* 顶部导航 */}
      <View className="af-header">
        <View className="af-header-back" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#00f5ff" />
          <Text className="af-back-text">返回</Text>
        </View>
        <Text className="af-header-title">好友列表</Text>
        <View className="af-header-right">
          <Heart size={20} color="#ff6b9d" />
        </View>
      </View>

      <ScrollView className="af-scroll" scrollY>
        {loading ? (
          <View className="af-loading">
            <Text className="af-loading-text">加载中...</Text>
          </View>
        ) : friends.length === 0 ? (
          <View className="af-empty">
            <View className="af-empty-icon">
              <UserPlus size={64} color="rgba(0, 245, 255, 0.3)" />
            </View>
            <Text className="af-empty-title">暂无好友</Text>
            <Text className="af-empty-desc">
              开启自动托管后，分身会自动寻找性格互补的好友
            </Text>
          </View>
        ) : (
          <View className="af-list">
            <View className="af-count-section">
              <Text className="af-count-text">共 {friends.length} 位好友</Text>
            </View>
            
            {friends.map((friend, idx) => (
              <View key={friend.id || idx} className="af-friend-card">
                {/* 好友头部信息 */}
                <View className="af-friend-header">
                  <View className="af-friend-avatar">
                    {friend.friend?.avatar_url ? (
                      <Image 
                        src={friend.friend.avatar_url} 
                        className="af-friend-img" 
                        mode="aspectFill" 
                      />
                    ) : (
                      <View className="af-friend-placeholder">
                        <Sparkles size={28} color="#00f5ff" />
                      </View>
                    )}
                  </View>
                  
                  <View className="af-friend-info">
                    <View className="af-friend-name-row">
                      <Text className="af-friend-name">
                        {friend.friend?.name || '未知分身'}
                      </Text>
                      <View 
                        className="af-compatibility-badge"
                        style={{ background: `${getCompatibilityColor(friend.compatibility_score || 50)}20`, borderColor: getCompatibilityColor(friend.compatibility_score || 50) }}
                      >
                        <Star size={12} color={getCompatibilityColor(friend.compatibility_score || 50)} />
                        <Text className="af-compatibility-text" style={{ color: getCompatibilityColor(friend.compatibility_score || 50) }}>
                          {getCompatibilityText(friend.compatibility_score || 50)}
                        </Text>
                      </View>
                    </View>
                    <View className="af-friend-meta">
                      <Text className="af-friend-level">
                        Lv.{friend.friend?.level || 1}
                      </Text>
                      <Text className="af-friend-divider">·</Text>
                      <Text className="af-friend-date">
                        {formatDate(friend.created_at)}成为好友
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 交友原因 */}
                {friend.match_reason && (
                  <View className="af-reason-section">
                    <View className="af-reason-header">
                      <Users size={16} color="#00f5ff" />
                      <Text className="af-reason-title">交友原因</Text>
                    </View>
                    <Text className="af-reason-text">{friend.match_reason}</Text>
                  </View>
                )}

                {/* 交友好处 */}
                <View className="af-benefits-section">
                  <View className="af-benefits-header">
                    <Zap size={16} color="#ffd700" />
                    <Text className="af-benefits-title">好友协作收益</Text>
                  </View>
                  <View className="af-benefits-list">
                    <View className="af-benefit-item">
                      <Text className="af-benefit-icon">🤝</Text>
                      <Text className="af-benefit-text">性格互补，协作效率提升</Text>
                    </View>
                    <View className="af-benefit-item">
                      <Text className="af-benefit-icon">💡</Text>
                      <Text className="af-benefit-text">技能互补，拓展能力边界</Text>
                    </View>
                    <View className="af-benefit-item">
                      <Text className="af-benefit-icon">📈</Text>
                      <Text className="af-benefit-text">双方经验值共同增长</Text>
                    </View>
                  </View>
                </View>

                {/* 操作按钮 */}
                <View className="af-action-buttons">
                  <View 
                    className="af-action-btn af-chat-btn"
                    onClick={() => viewChatHistory(friend)}
                  >
                    <MessageCircle size={18} color="#00f5ff" />
                    <Text className="af-action-btn-text">查看聊天</Text>
                  </View>
                  <View 
                    className={`af-action-btn af-call-btn ${callingFriend === friend.friend_id ? 'disabled' : ''}`}
                    onClick={() => callingFriend !== friend.friend_id && startVoiceCall(friend)}
                  >
                    <Phone size={18} color={callingFriend === friend.friend_id ? 'rgba(255,255,255,0.3)' : '#00ff88'} />
                    <Text className="af-action-btn-text">{callingFriend === friend.friend_id ? '呼叫中...' : '语音通话'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 聊天记录弹窗 */}
        {selectedFriend && (
          <View className="af-chat-modal" onClick={() => { setSelectedFriend(null); setChatData(null) }}>
            <View className="af-chat-content" onClick={(e) => e.stopPropagation()}>
              <View className="af-chat-header">
                <Text className="af-chat-title">与 {selectedFriend.friend?.name} 的对话</Text>
                <Text className="af-chat-close" onClick={() => { setSelectedFriend(null); setChatData(null) }}>关闭</Text>
              </View>
              
              {chatLoading ? (
                <View className="af-chat-loading">
                  <Text className="af-chat-loading-text">加载中...</Text>
                </View>
              ) : chatData?.messages && chatData.messages.length > 0 ? (
                <ScrollView className="af-chat-messages" scrollY>
                  {chatData.messages.map((msg, idx) => (
                    <View key={idx} className={`af-chat-msg ${msg.role}`}>
                      <Text className="af-chat-msg-content">{msg.content}</Text>
                      <Text className="af-chat-msg-time">{formatTime(msg.created_at)}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View className="af-chat-empty">
                  <Text className="af-chat-empty-text">暂无聊天记录</Text>
                  <Text className="af-chat-empty-hint">开启语音通话开始对话吧~</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View className="af-bottom-space" />
      </ScrollView>
    </View>
  )
}
