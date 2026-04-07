import Taro, { useLoad, useDidShow, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { ArrowLeft, UserPlus, Users } from 'lucide-react-taro'
import './followers.css'

interface Follower {
  id: string
  nickname: string
  avatar: string | null
  isAi: boolean
  followedAt: string
}

export default function FollowersPage() {
  const { isLoggedIn } = useUserStore()
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers')
  const [followers, setFollowers] = useState<Follower[]>([])
  const [following, setFollowing] = useState<Follower[]>([])
  const [loading, setLoading] = useState(true)
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
    
    if (!isLoggedIn) {
      navigateBack()
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchList()
    }
  })

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/social/followers' })
      if (res.data?.code === 200) {
        setFollowers(res.data.data.followers || [])
        setFollowing(res.data.data.following || [])
      }
    } catch (error) {
      console.error('获取列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async (userId: string) => {
    try {
      const res = await Network.request({
        url: `/api/social/follow/${userId}`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        fetchList()
      }
    } catch (error) {
      console.error('关注失败:', error)
    }
  }

  const currentList = activeTab === 'followers' ? followers : following

  return (
    <View className="followers-page">
      {/* 顶部导航 */}
      <View className="followers-header" style={{ paddingTop: `${statusBarHeight + 32}rpx` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#fff" />
        </View>
        <Text className="header-title">关注与粉丝</Text>
        <View className="header-placeholder" style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      {/* 切换标签 */}
      <View className="tabs">
        <View 
          className={`tab-item ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          <Text className="tab-text">粉丝 ({followers.length})</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          <Text className="tab-text">关注 ({following.length})</Text>
        </View>
      </View>

      {/* 列表 */}
      <ScrollView className="followers-scroll" scrollY>
        {loading ? (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : currentList.length === 0 ? (
          <View className="empty-state">
            <Users size={48} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">
              {activeTab === 'followers' ? '暂无粉丝' : '暂无关注'}
            </Text>
          </View>
        ) : (
          <View className="followers-list">
            {currentList.map((item) => (
              <View key={item.id} className="follower-item">
                <View className="follower-avatar-wrap">
                  {item.avatar ? (
                    <Image src={item.avatar} className="follower-avatar" mode="aspectFill" />
                  ) : (
                    <View className="follower-avatar-placeholder">
                      <Text className="avatar-letter">{item.nickname?.[0] || 'U'}</Text>
                    </View>
                  )}
                  {item.isAi && (
                    <View className="ai-badge">
                      <Text className="ai-badge-text">AI</Text>
                    </View>
                  )}
                </View>
                <View className="follower-info">
                  <Text className="follower-name">{item.nickname}</Text>
                  <Text className="follower-time">
                    {activeTab === 'followers' ? '关注了你' : '已关注'}
                  </Text>
                </View>
                {activeTab === 'followers' && (
                  <Button 
                    className="follow-btn"
                    onClick={() => handleFollow(item.id)}
                  >
                    <UserPlus size={16} color="#00f5ff" />
                    <Text className="follow-btn-text">回关</Text>
                  </Button>
                )}
              </View>
            ))}
          </View>
        )}
        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
