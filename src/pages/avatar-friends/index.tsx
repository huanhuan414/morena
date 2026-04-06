import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { Sparkles, ArrowLeft, UserPlus, Heart } from 'lucide-react-taro'
import './index.css'

interface AvatarFriend {
  id: string
  avatar_id: string
  friend_id: string
  reason: string
  created_at: string
  friend?: {
    id: string
    name: string
    avatar_url: string
    level: number
    personality: string
  }
}

export default function AvatarFriendsPage() {
  const router = useRouter()
  const { avatarId } = router.params
  
  const [friends, setFriends] = useState<AvatarFriend[]>([])
  const [loading, setLoading] = useState(true)

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
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
                  <Text className="af-friend-name">
                    {friend.friend?.name || '未知分身'}
                  </Text>
                  <View className="af-friend-meta">
                    <Text className="af-friend-level">
                      Lv.{friend.friend?.level || 1}
                    </Text>
                    <Text className="af-friend-divider">·</Text>
                    <Text className="af-friend-date">
                      {formatDate(friend.created_at)}成为好友
                    </Text>
                  </View>
                  
                  {friend.reason && (
                    <View className="af-reason-tag">
                      <Text className="af-reason-text">{friend.reason}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="af-bottom-space" />
      </ScrollView>
    </View>
  )
}
