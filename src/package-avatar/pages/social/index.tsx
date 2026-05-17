import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import { Bell, Settings, Search, Users, TrendingUp, Clock, Heart, Plus } from 'lucide-react-taro'
import './index.css'

// 模拟分身数据
const mockAvatars = [
  { id: '1', name: '小美', avatar: '', online: true, gender: '女', age: 25, followers: 12580, posts: 328, tags: ['温柔', '知性'], onlineTime: '在线' },
  { id: '2', name: '智慧达人', avatar: '', online: true, gender: '女', age: 28, followers: 8960, posts: 215, tags: ['知识', '职场'], onlineTime: '在线' },
  { id: '3', name: '生活家', avatar: '', online: false, gender: '女', age: 30, followers: 15890, posts: 456, tags: ['生活', '美食'], onlineTime: '2小时前' },
  { id: '4', name: '旅行家', avatar: '', online: true, gender: '男', age: 26, followers: 21350, posts: 589, tags: ['旅行', '摄影'], onlineTime: '在线' },
  { id: '5', name: '时尚博主', avatar: '', online: false, gender: '女', age: 24, followers: 45670, posts: 892, tags: ['时尚', '美妆'], onlineTime: '5分钟前' },
  { id: '6', name: '科技控', avatar: '', online: true, gender: '男', age: 27, followers: 6780, posts: 156, tags: ['科技', '数码'], onlineTime: '在线' },
]

export default function SocialSquare() {
  const [activeTab, setActiveTab] = useState('推荐')
  const [userInfo] = useState({
    name: '小明',
    avatar: '',
  })

  const tabs = ['推荐', '最新', '热榜', '关注']

  return (
    <View className="social-container">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-left">
          <Image src={userInfo.avatar} className="user-avatar" />
          <View className="user-info">
            <Text className="username">{userInfo.name}</Text>
            <View className="online-badge">
              <Text className="online-text">在线</Text>
            </View>
          </View>
        </View>
        <View className="header-right">
          <Bell size={44} color="#fff" />
          <Settings size={44} color="#fff" />
        </View>
      </View>

      {/* 搜索栏 */}
      <View className="search-bar">
        <Search size={32} color="#9CA3AF" />
        <Text className="search-placeholder">搜索分身、内容...</Text>
      </View>

      {/* 分类标签 */}
      <View className="category-tabs">
        {tabs.map((tab) => (
          <View
            key={tab}
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <Text className={`tab-text ${activeTab === tab ? 'active' : ''}`}>{tab}</Text>
          </View>
        ))}
      </View>

      {/* 分身列表 */}
      <ScrollView scrollY className="avatar-list">
        {mockAvatars.map((avatar) => (
          <View key={avatar.id} className="avatar-card">
            <View className="avatar-main">
              <View className="avatar-left">
                <View className="avatar-wrapper">
                  <Image src={avatar.avatar} className="avatar-img" />
                  <View className={`online-indicator ${avatar.online ? 'online' : ''}`} />
                </View>
                <View className="avatar-details">
                  <View className="avatar-name-row">
                    <Text className="avatar-name">{avatar.name}</Text>
                    <View className="gender-badge">
                      <Text className="badge-text">{avatar.gender}</Text>
                    </View>
                    <View className="age-badge">
                      <Text className="badge-text">{avatar.age}岁</Text>
                    </View>
                  </View>
                  <View className="avatar-tags">
                    {avatar.tags.map((tag, idx) => (
                      <View key={idx} className="tag-badge">
                        <Text className="tag-text">{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View className="avatar-stats">
                    <View className="stat-item">
                      <Users size={24} color="#6B7280" />
                      <Text className="stat-text">{avatar.followers}</Text>
                    </View>
                    <View className="stat-item">
                      <TrendingUp size={24} color="#6B7280" />
                      <Text className="stat-text">{avatar.posts}帖</Text>
                    </View>
                    <View className="stat-item online-time">
                      <Clock size={24} color={avatar.online ? '#10B981' : '#9CA3AF'} />
                      <Text className={`stat-text ${avatar.online ? 'online' : ''}`}>{avatar.onlineTime}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View className="avatar-right">
                <View className="follow-btn">
                  <Heart size={24} color="#fff" />
                  <Text className="follow-text">关注</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 底部TabBar */}
      <View className="tabbar">
        <View className="tabbar-item active">
          <View className="tabbar-icon active">
            <Users size={48} color="#7B3FE4" />
          </View>
          <Text className="tabbar-text active">广场</Text>
        </View>
        <View className="tabbar-item">
          <View className="tabbar-icon">
            <TrendingUp size={48} color="#9CA3AF" />
          </View>
          <Text className="tabbar-text">分身</Text>
        </View>
        <View className="tabbar-item">
          <View className="tabbar-icon center">
            <Plus size={48} color="#fff" />
          </View>
          <Text className="tabbar-text">发布</Text>
        </View>
        <View className="tabbar-item">
          <View className="tabbar-icon">
            <Bell size={48} color="#9CA3AF" />
          </View>
          <Text className="tabbar-text">消息</Text>
        </View>
        <View className="tabbar-item">
          <View className="tabbar-icon">
            <Users size={48} color="#9CA3AF" />
          </View>
          <Text className="tabbar-text">我的</Text>
        </View>
      </View>
    </View>
  )
}
