import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateBack, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import {
  Sparkles, ArrowLeft, UserPlus, Heart, Phone,
  MessageCircle, Star, Zap, Users, Check, X, Bell, Clock, TriangleAlert
} from 'lucide-react-taro'
import { getAvatarStyleClass } from '@/utils/avatar-style'
import './index.css'

interface FriendInfo {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  appearance_style?: string
}

interface AvatarFriend {
  id: number
  avatar_id: string
  friend_id: string  // 后端返回的好友分身ID字段
  match_reason: string
  compatibility_score: number
  benefits?: string
  status?: string
  created_at: string
  isPending?: boolean  // 是否是待确认的好友请求
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
  const hasAvatarId = typeof avatarId === 'string' && avatarId.trim().length > 0
  
  const [friends, setFriends] = useState<AvatarFriend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState<AvatarFriend | null>(null)
  const [chatData, setChatData] = useState<FriendChat | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT
    if (isMiniApp) {
      try {
        const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
        if (menuButtonBoundingClientRect) {
          const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
          const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
          setCapsuleWidth(capsuleWidthWithMargins)
        }
      } catch (e) {
        console.warn('[AvatarFriends] getMenuButtonBoundingClientRect 失败:', e)
      }
    }
    
    if (hasAvatarId) {
      fetchFriends()
      return
    }

    setLoading(false)
    showToast({ title: '未找到分身信息，请从分身入口进入', icon: 'none' })
  })

  // 分离已接受的好友和待确认的好友请求
  const acceptedFriends = friends.filter(f => !f.isPending)
  const pendingRequests = friends.filter(f => f.isPending)

  const fetchFriends = async () => {
    if (!hasAvatarId) {
      setLoading(false)
      return
    }

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

  const openUserFriendshipManagement = () => {
    navigateTo({ url: '/package-avatar/pages/friendship-management/index' })
  }

  const openAvatarManage = () => {
    navigateTo({ url: '/package-avatar/pages/avatar-manage/index' })
  }

  // 接受好友请求
  const acceptFriendRequest = async (friend: AvatarFriend) => {
    const friendAvatarId = friend.friend?.id
    if (!friendAvatarId) {
      showToast({ title: '好友信息不完整', icon: 'none' })
      return
    }
    
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/friends/${friendAvatarId}/accept`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        showToast({ title: '已接受好友请求', icon: 'success' })
        fetchFriends() // 刷新列表
      } else {
        showToast({ title: res.data?.msg || '操作失败', icon: 'none' })
      }
    } catch (error) {
      console.error('接受好友请求失败:', error)
      showToast({ title: '操作失败', icon: 'none' })
    }
  }

  // 拒绝好友请求
  const rejectFriendRequest = async (friend: AvatarFriend) => {
    const friendAvatarId = friend.friend?.id
    if (!friendAvatarId) {
      showToast({ title: '好友信息不完整', icon: 'none' })
      return
    }
    
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/friends/${friendAvatarId}/reject`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        showToast({ title: '已拒绝好友请求', icon: 'success' })
        fetchFriends() // 刷新列表
      } else {
        showToast({ title: res.data?.msg || '操作失败', icon: 'none' })
      }
    } catch (error) {
      console.error('拒绝好友请求失败:', error)
      showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const viewChatHistory = async (friend: AvatarFriend) => {
    // 使用 friend.friend?.id 获取好友分身ID
    const friendAvatarId = friend.friend?.id
    if (!friendAvatarId) {
      showToast({ title: '好友信息不完整', icon: 'none' })
      return
    }
    
    try {
      setChatLoading(true)
      setSelectedFriend(friend)
      
      const res = await Network.request({ 
        url: `/api/avatar/${avatarId}/chat/${friendAvatarId}` 
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
    // 使用 friend.friend?.id 获取好友分身ID
    const friendAvatarId = friend.friend?.id
    const friendAvatarName = friend.friend?.name
    
    if (!friendAvatarId) {
      showToast({ title: '好友信息不完整', icon: 'none' })
      return
    }
    
    // 跳转到语音通话页面
    Taro.navigateTo({
      url: `/package-avatar/pages/voice-call/index?avatarId=${avatarId}&friendId=${friendAvatarId}&friendName=${encodeURIComponent(friendAvatarName || '好友')}`
    })
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

  // 渲染好友列表内容
  const renderFriendsList = () => {
    if (!hasAvatarId) {
      return (
        <View className="af-empty">
          <View className="af-empty-icon">
            <TriangleAlert size={64} color="rgba(255, 215, 0, 0.65)" />
          </View>
          <Text className="af-empty-title">缺少分身信息</Text>
          <Text className="af-empty-desc">
            当前页面需要带上 avatarId 才能查看某个分身的好友列表。
          </Text>
          <Text className="af-empty-desc">
            你可以先去用户级好友管理查看请求，或从“我的分身”中选择具体分身进入。
          </Text>
          <View className="mt-6 flex w-full gap-3">
            <Button className="flex-1" onClick={openUserFriendshipManagement}>
              <Text className="text-primary-foreground">去好友管理</Text>
            </Button>
            <Button className="flex-1" variant="outline" onClick={openAvatarManage}>
              <Text>去我的分身</Text>
            </Button>
          </View>
        </View>
      )
    }

    if (loading) {
      return (
        <View className="af-loading">
          <Text className="af-loading-text">加载中...</Text>
        </View>
      )
    }
    
    if (friends.length === 0) {
      return (
        <View className="af-empty">
          <View className="af-empty-icon">
            <UserPlus size={64} color="rgba(0, 245, 255, 0.3)" />
          </View>
          <Text className="af-empty-title">暂无好友</Text>
          <Text className="af-empty-desc">
            开启自动托管后，分身会自动寻找性格互补的好友
          </Text>
        </View>
      )
    }
    
    return (
      <View className="af-list">
        {/* 待确认的好友请求 */}
        {pendingRequests.length > 0 && (
          <View className="af-pending-section">
            <View className="af-section-header">
              <Bell size={18} color="#ffd700" />
              <Text className="af-section-title">待确认请求 ({pendingRequests.length})</Text>
            </View>
            
            {pendingRequests.map((friend, idx) => (
              <View key={friend.id || `pending-${idx}`} className="af-friend-card af-pending-card">
                {/* 好友头部信息 */}
                <View className="af-friend-header">
                  <View className="af-friend-avatar">
                    {friend.friend?.avatar_url ? (
                      <Image
                        src={friend.friend.avatar_url}
                        className={`af-friend-img ${getAvatarStyleClass(friend.friend.appearance_style)}`}
                        mode="aspectFill"
                      />
                    ) : (
                      <View className="af-friend-placeholder">
                        <Sparkles size={28} color="#ffd700" />
                      </View>
                    )}
                  </View>
                  
                  <View className="af-friend-info">
                    <View className="af-friend-name-row">
                      <Text className="af-friend-name">
                        {friend.friend?.name || '未知分身'}
                      </Text>
                      <View className="af-pending-badge">
                        <Clock size={12} color="#ffd700" />
                        <Text className="af-pending-text">待确认</Text>
                      </View>
                    </View>
                    <View className="af-friend-meta">
                      <Text className="af-friend-level">
                        Lv.{friend.friend?.level || 1}
                      </Text>
                      <Text className="af-friend-divider">·</Text>
                      <Text className="af-friend-date">
                        {formatDate(friend.created_at)}收到请求
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

                {/* 操作按钮 - 待确认状态 */}
                <View className="af-action-buttons">
                  <View 
                    className="af-action-btn af-accept-btn"
                    onClick={() => acceptFriendRequest(friend)}
                  >
                    <Check size={18} color="#00ff88" />
                    <Text className="af-action-btn-text">接受</Text>
                  </View>
                  <View 
                    className="af-action-btn af-reject-btn"
                    onClick={() => rejectFriendRequest(friend)}
                  >
                    <X size={18} color="#ff6b6b" />
                    <Text className="af-action-btn-text">拒绝</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 已接受的好友列表 */}
        {acceptedFriends.length > 0 && (
          <View className="af-accepted-section">
            <View className="af-count-section">
              <Text className="af-count-text">已接受好友 ({acceptedFriends.length})</Text>
            </View>
            
            {acceptedFriends.map((friend, idx) => (
              <View key={friend.id || idx} className="af-friend-card">
                {/* 好友头部信息 */}
                <View className="af-friend-header">
                  <View className="af-friend-avatar">
                    {friend.friend?.avatar_url ? (
                      <Image
                        src={friend.friend.avatar_url}
                        className={`af-friend-img ${getAvatarStyleClass(friend.friend.appearance_style)}`}
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
                    className="af-action-btn af-call-btn"
                    onClick={() => startVoiceCall(friend)}
                  >
                    <Phone size={18} color="#00ff88" />
                    <Text className="af-action-btn-text">语音通话</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  }

  // 渲染聊天内容
  const renderChatContent = () => {
    if (chatLoading) {
      return (
        <View className="af-chat-loading">
          <Text className="af-chat-loading-text">加载中...</Text>
        </View>
      )
    }
    
    if (chatData?.messages && chatData.messages.length > 0) {
      return (
        <ScrollView className="af-chat-messages" scrollY>
          {chatData.messages.map((msg, idx) => (
            <View key={idx} className={`af-chat-msg ${msg.role}`}>
              <Text className="af-chat-msg-content">{msg.content}</Text>
              <Text className="af-chat-msg-time">{formatTime(msg.created_at)}</Text>
            </View>
          ))}
        </ScrollView>
      )
    }
    
    return (
      <View className="af-chat-empty">
        <Text className="af-chat-empty-text">暂无聊天记录</Text>
        <Text className="af-chat-empty-hint">开启语音通话开始对话吧~</Text>
      </View>
    )
  }

  return (
    <View className="af-page">
      {/* 顶部导航 */}
      <View className="af-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="af-header-back" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#00f5ff" />
          <Text className="af-back-text">返回</Text>
        </View>
        <Text className="af-header-title">好友列表</Text>
        <View className="af-header-right" style={{ width: `${capsuleWidth}rpx` }}>
          <Heart size={20} color="#ff6b9d" />
        </View>
      </View>

      <ScrollView className="af-scroll" scrollY>
        {renderFriendsList()}

        {/* 聊天记录弹窗 */}
        {selectedFriend && (
          <View className="af-chat-modal" onClick={() => { setSelectedFriend(null); setChatData(null) }}>
            <View className="af-chat-content" onClick={(e) => e.stopPropagation()}>
              <View className="af-chat-header">
                <Text className="af-chat-title">与 {selectedFriend.friend?.name} 的对话</Text>
                <Text className="af-chat-close" onClick={() => { setSelectedFriend(null); setChatData(null) }}>关闭</Text>
              </View>
              {renderChatContent()}
            </View>
          </View>
        )}

        <View className="af-bottom-space" />
      </ScrollView>
    </View>
  )
}
