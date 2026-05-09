import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useDidShow, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { Bell, Settings, Plus, Bot, TrendingUp, Star, Zap, ChevronRight } from 'lucide-react-taro'
import './index.css'

// 模拟分身数据
const mockAvatars = [
  {
    id: '1',
    name: '小美',
    avatarUrl: '',
    avatarColor: '#FF6B9D',
    personality: '生活博主',
    status: 'active',
    earnings: '128.50',
    todayEarnings: '25.00',
    posts: 128,
    hostingEnabled: true
  },
  {
    id: '2',
    name: '阿杰',
    avatarUrl: '',
    avatarColor: '#4ECDC4',
    personality: '科技达人',
    status: 'active',
    earnings: '256.80',
    todayEarnings: '45.00',
    posts: 256,
    hostingEnabled: true
  },
  {
    id: '3',
    name: '小林',
    avatarUrl: '',
    avatarColor: '#9B59B6',
    personality: '职场精英',
    status: 'inactive',
    earnings: '89.20',
    todayEarnings: '0.00',
    posts: 89,
    hostingEnabled: false
  }
]

export default function MindChatPage() {
  const [avatars, setAvatars] = useState(mockAvatars)
  const [userInfo] = useState({
    nickname: '用户',
    avatar: '',
    avatarId: ''
  })

  useLoad(() => {
    console.log('分身页面加载')
    fetchAvatars()
  })

  useDidShow(() => {
    fetchAvatars()
  })

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar/my' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const formattedAvatars = res.data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          avatarUrl: item.avatar_url,
          avatarColor: '#7B3FE4',
          personality: item.personality || 'AI分身',
          status: item.status || 'inactive',
          earnings: item.total_earnings || '0.00',
          todayEarnings: item.today_earnings || '0.00',
          posts: item.total_posts || 0,
          hostingEnabled: item.hosting_enabled === 1
        }))
        setAvatars(formattedAvatars)
      }
    } catch (error) {
      console.log('使用模拟数据')
    }
  }

  const handleAvatarClick = (avatarId: string) => {
    Taro.navigateTo({
      url: `/pages/avatar-profile/index?id=${avatarId}`
    })
  }

  const handleCreateAvatar = () => {
    navigateTo({ url: '/pages/avatar/avatar-create/index' })
  }

  const handleToggleHosting = async (avatarId: string, currentStatus: boolean) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/hosting`,
        method: 'POST',
        data: { enabled: !currentStatus }
      })
      if (res.data?.code === 200) {
        setAvatars(prev => prev.map(avatar =>
          avatar.id === avatarId ? { ...avatar, hostingEnabled: !currentStatus } : avatar
        ))
        Taro.showToast({
          title: !currentStatus ? '托管已开启' : '托管已关闭',
          icon: 'success'
        })
      }
    } catch (error) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  // 计算总计数据
  const totalStats = {
    avatarCount: avatars.length,
    totalPosts: avatars.reduce((sum, a) => sum + a.posts, 0),
    totalEarnings: avatars.reduce((sum, a) => sum + parseFloat(a.earnings), 0),
    activeHosting: avatars.filter(a => a.hostingEnabled).length
  }

  return (
    <View className="mind-chat-page">
      {/* 顶部通栏 */}
      <View className="mind-header">
        <View className="header-content">
          {/* 左侧：头像 + 昵称 + 状态 */}
          <View className="header-left">
            <View className="user-avatar">
              {userInfo.avatar ? (
                <Image src={userInfo.avatar} className="avatar-img" mode="aspectFill" />
              ) : (
                <View className="avatar-placeholder">
                  <Text className="avatar-text">我</Text>
                </View>
              )}
            </View>
            <Text className="user-nickname">{userInfo.nickname}</Text>
            <View className="status-tag">
              <Text className="status-tag-text">在线</Text>
            </View>
          </View>

          {/* 右侧：消息 + 设置 */}
          <View className="header-right">
            <View className="header-icon-btn" onClick={() => navigateTo({ url: '/pages/notifications/index' })}>
              <Bell size={24} color="#333" />
            </View>
            <View className="header-icon-btn" onClick={() => navigateTo({ url: '/pages/settings/index' })}>
              <Settings size={24} color="#333" />
            </View>
          </View>
        </View>
      </View>

      {/* 数据统计卡片 */}
      <View className="stats-section">
        <View className="stats-grid">
          <View className="stat-card">
            <View className="stat-icon-wrapper" style={{ backgroundColor: '#f5f0ff' }}>
              <Bot size={20} color="#7B3FE4" />
            </View>
            <Text className="stat-value">{totalStats.avatarCount}</Text>
            <Text className="stat-label">分身数量</Text>
          </View>
          <View className="stat-card">
            <View className="stat-icon-wrapper" style={{ backgroundColor: '#fff7e6' }}>
              <TrendingUp size={20} color="#fa8c16" />
            </View>
            <Text className="stat-value">{totalStats.totalPosts}</Text>
            <Text className="stat-label">已发内容</Text>
          </View>
          <View className="stat-card">
            <View className="stat-icon-wrapper" style={{ backgroundColor: '#f6ffed' }}>
              <Star size={20} color="#52c41a" />
            </View>
            <Text className="stat-value">¥{totalStats.totalEarnings.toFixed(0)}</Text>
            <Text className="stat-label">累计收益</Text>
          </View>
          <View className="stat-card">
            <View className="stat-icon-wrapper" style={{ backgroundColor: '#fff1f0' }}>
              <Zap size={20} color="#ff4d4f" />
            </View>
            <Text className="stat-value">{totalStats.activeHosting}</Text>
            <Text className="stat-label">托管中</Text>
          </View>
        </View>
      </View>

      {/* 分身列表 */}
      <ScrollView className="avatar-list-scroll" scrollY>
        <View className="section-header">
          <Text className="section-title">我的分身</Text>
          <Text className="section-count">{avatars.length}个</Text>
        </View>

        {avatars.length === 0 ? (
          <View className="empty-state">
            <View className="empty-icon-wrapper">
              <Bot size={48} color="#ccc" />
            </View>
            <Text className="empty-title">还没有创建分身</Text>
            <Text className="empty-desc">创建你的第一个AI分身，开始智能社交之旅</Text>
          </View>
        ) : (
          <View className="avatar-list">
            {avatars.map((avatar) => (
              <View key={avatar.id} className="avatar-item" onClick={() => handleAvatarClick(avatar.id)}>
                {/* 左侧：头像 */}
                <View className="avatar-left">
                  <View className="avatar-avatar" style={{ backgroundColor: avatar.avatarColor }}>
                    {avatar.avatarUrl ? (
                      <Image src={avatar.avatarUrl} className="avatar-image" mode="aspectFill" />
                    ) : (
                      <Text className="avatar-text">{avatar.name.slice(0, 1)}</Text>
                    )}
                  </View>
                  {avatar.hostingEnabled && (
                    <View className="hosting-badge">
                      <Zap size={12} color="#fff" />
                    </View>
                  )}
                </View>

                {/* 中间：信息 */}
                <View className="avatar-center">
                  <View className="avatar-name-row">
                    <Text className="avatar-name">{avatar.name}</Text>
                    <View className={`status-indicator ${avatar.status === 'active' ? 'active' : ''}`}>
                      <Text className="status-text">{avatar.status === 'active' ? '活跃' : '待机'}</Text>
                    </View>
                  </View>
                  <Text className="avatar-personality">{avatar.personality}</Text>
                  <View className="avatar-stats-row">
                    <View className="mini-stat">
                      <TrendingUp size={12} color="#999" />
                      <Text className="mini-stat-text">{avatar.posts}篇</Text>
                    </View>
                    <View className="mini-stat">
                      <Star size={12} color="#999" />
                      <Text className="mini-stat-text">¥{avatar.todayEarnings}</Text>
                    </View>
                  </View>
                </View>

                {/* 右侧：操作 */}
                <View className="avatar-right">
                  <View 
                    className={`hosting-toggle ${avatar.hostingEnabled ? 'enabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleHosting(avatar.id, avatar.hostingEnabled)
                    }}
                  >
                    <Text className={`toggle-text ${avatar.hostingEnabled ? 'enabled' : ''}`}>
                      {avatar.hostingEnabled ? '托管中' : '开启托管'}
                    </Text>
                    <ChevronRight size={14} color={avatar.hostingEnabled ? '#7B3FE4' : '#999'} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 创建分身按钮 */}
        <View className="create-section">
          <View className="create-btn" onClick={handleCreateAvatar}>
            <Plus size={20} color="#7B3FE4" />
            <Text className="create-btn-text">创建新分身</Text>
          </View>
        </View>

        {/* 底部间距 */}
        <View className="scroll-bottom-spacer" />
      </ScrollView>

      {/* 底部TabBar已由系统提供 */}
    </View>
  )
}
