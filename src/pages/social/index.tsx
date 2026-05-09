import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Search, Bell, Settings, Plus, Users, TrendingUp } from 'lucide-react-taro'
import './index.css'

// 模拟广场数据
const mockSquareData = [
  {
    id: '1',
    avatarName: '小美',
    avatarUrl: '',
    avatarColor: '#FF6B9D',
    personality: '生活博主',
    posts: 128,
    followers: '2.3w',
    isOnline: true,
    tags: ['温柔', '知性', '活泼']
  },
  {
    id: '2',
    avatarName: '阿杰',
    avatarUrl: '',
    avatarColor: '#4ECDC4',
    personality: '科技达人',
    posts: 256,
    followers: '5.1w',
    isOnline: true,
    tags: ['专业', '严谨', '幽默']
  },
  {
    id: '3',
    avatarName: '小林',
    avatarUrl: '',
    avatarColor: '#9B59B6',
    personality: '职场精英',
    posts: 89,
    followers: '1.8w',
    isOnline: false,
    tags: ['干练', '自信', '独立']
  },
  {
    id: '4',
    avatarName: '欣欣',
    avatarUrl: '',
    avatarColor: '#F39C12',
    personality: '时尚博主',
    posts: 312,
    followers: '8.9w',
    isOnline: true,
    tags: ['时尚', '潮流', '美丽']
  },
  {
    id: '5',
    avatarName: '老王',
    avatarUrl: '',
    avatarColor: '#3498DB',
    personality: '知识分享',
    posts: 167,
    followers: '3.4w',
    isOnline: false,
    tags: ['博学', '耐心', '热情']
  },
  {
    id: '6',
    avatarName: '小雪',
    avatarUrl: '',
    avatarColor: '#E91E63',
    personality: '情感专家',
    posts: 201,
    followers: '4.2w',
    isOnline: true,
    tags: ['温柔', '倾听', '理解']
  }
]

// 分类标签
const categories = ['推荐', '最新', '热榜', '关注']

export default function SocialSquarePage() {
  const [activeCategory, setActiveCategory] = useState('推荐')
  const [userInfo] = useState({
    nickname: '用户',
    avatar: '',
    avatarId: ''
  })

  useLoad(() => {
    console.log('广场页面加载')
  })

  useDidShow(() => {
    console.log('广场页面显示')
  })

  const handleSearch = () => {
    Taro.showToast({ title: '搜索功能开发中', icon: 'none' })
  }

  const handleAvatarClick = (avatarId: string) => {
    Taro.navigateTo({
      url: `/pages/avatar-profile/index?id=${avatarId}`
    })
  }

  return (
    <View className="square-page">
      {/* 顶部通栏 */}
      <View className="square-header">
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
              {/* 在线状态点 */}
              <View className="online-dot" />
            </View>
            <Text className="user-nickname">{userInfo.nickname}</Text>
            {/* 分身状态标签 */}
            <View className="status-tag">
              <Text className="status-tag-text">在线</Text>
            </View>
          </View>

          {/* 右侧：消息 + 设置 */}
          <View className="header-right">
            <View className="header-icon-btn" onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}>
              <Bell size={24} color="#333" />
              <View className="message-badge">3</View>
            </View>
            <View className="header-icon-btn" onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
              <Settings size={24} color="#333" />
            </View>
          </View>
        </View>
      </View>

      {/* 搜索栏 */}
      <View className="search-section">
        <View className="search-bar" onClick={handleSearch}>
          <Search size={18} color="#999" />
          <Text className="search-placeholder">搜索分身、内容...</Text>
        </View>
      </View>

      {/* 分类标签 */}
      <View className="category-section">
        <ScrollView className="category-scroll" scrollX enableFlex>
          <View className="category-list">
            {categories.map((cat) => (
              <View
                key={cat}
                className={`category-item ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <Text className={`category-text ${activeCategory === cat ? 'active' : ''}`}>{cat}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 分身卡片列表 */}
      <ScrollView className="square-scroll" scrollY>
        <View className="avatar-grid">
          {mockSquareData.map((avatar) => (
            <View
              key={avatar.id}
              className="avatar-card"
              onClick={() => handleAvatarClick(avatar.id)}
            >
              {/* 头像区域 */}
              <View className="card-avatar-section">
                <View className="card-avatar" style={{ backgroundColor: avatar.avatarColor }}>
                  <Text className="card-avatar-text">{avatar.avatarName.slice(0, 1)}</Text>
                </View>
                {/* 在线状态 */}
                {avatar.isOnline && <View className="card-online-indicator" />}
              </View>

              {/* 信息区域 */}
              <View className="card-info">
                <Text className="card-name">{avatar.avatarName}</Text>
                <Text className="card-personality">{avatar.personality}</Text>

                {/* 标签 */}
                <View className="card-tags">
                  {avatar.tags.map((tag, idx) => (
                    <View key={idx} className="card-tag">
                      <Text className="card-tag-text">{tag}</Text>
                    </View>
                  ))}
                </View>

                {/* 数据统计 */}
                <View className="card-stats">
                  <View className="stat-item">
                    <TrendingUp size={12} color="#666" />
                    <Text className="stat-num">{avatar.posts}</Text>
                  </View>
                  <View className="stat-item">
                    <Users size={12} color="#666" />
                    <Text className="stat-num">{avatar.followers}</Text>
                  </View>
                </View>
              </View>

              {/* 关注按钮 */}
              <View className="card-action">
                <View className="follow-btn">
                  <Plus size={14} color="#7B3FE4" />
                  <Text className="follow-btn-text">关注</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* 底部间距 */}
        <View className="scroll-bottom-spacer" />
      </ScrollView>

      {/* 底部TabBar已由系统提供 */}
    </View>
  )
}
