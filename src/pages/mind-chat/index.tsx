import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import { Bell, Settings, Users, TrendingUp, DollarSign, Shield, Plus, ChevronRight } from 'lucide-react-taro'
import './index.css'

// 模拟分身数据
const mockMyAvatars = [
  { 
    id: '1', 
    name: '小美', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', 
    online: true, 
    hosting: true,
    gender: '女', 
    age: 25, 
    todayEarnings: 128.50,
    totalPosts: 328,
    tags: ['温柔', '知性'] 
  },
  { 
    id: '2', 
    name: '智慧达人', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka', 
    online: true, 
    hosting: false,
    gender: '女', 
    age: 28, 
    todayEarnings: 0,
    totalPosts: 215,
    tags: ['知识', '职场'] 
  },
]

export default function MyAvatarPage() {
  const [avatars, setAvatars] = useState(mockMyAvatars)
  const [userInfo] = useState({
    name: '小明',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
  })

  const stats = {
    totalAvatars: avatars.length,
    totalPosts: avatars.reduce((sum, a) => sum + a.totalPosts, 0),
    totalEarnings: avatars.reduce((sum, a) => sum + a.todayEarnings, 0),
    hostingCount: avatars.filter(a => a.hosting).length,
  }

  const toggleHosting = (id: string) => {
    setAvatars(avatars.map(a => 
      a.id === id ? { ...a, hosting: !a.hosting } : a
    ))
  }

  return (
    <View className="avatar-container">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-left">
          <Image src={userInfo.avatar} className="user-avatar" />
          <View className="user-info">
            <Text className="username">{userInfo.name}</Text>
            <View className="online-badge">
              <Text className="online-dot" />
              <Text className="online-text">在线</Text>
            </View>
          </View>
        </View>
        <View className="header-right">
          <Bell size={44} color="#fff" />
          <Settings size={44} color="#fff" />
        </View>
      </View>

      {/* 数据统计卡片 */}
      <View className="stats-grid">
        <View className="stat-card">
          <Text className="stat-label">我的分身数量</Text>
          <Text className="stat-value">{stats.totalAvatars}</Text>
          <Text className="stat-hint">点击直达管理</Text>
        </View>
        <View className="stat-card">
          <Text className="stat-label">已生成内容</Text>
          <Text className="stat-value">{stats.totalPosts}</Text>
          <Text className="stat-hint">今日新增 +12</Text>
        </View>
        <View className="stat-card">
          <Text className="stat-label">累计收益</Text>
          <Text className="stat-value primary">¥{stats.totalEarnings.toFixed(2)}</Text>
          <Text className="stat-hint">今日收益</Text>
        </View>
        <View className="stat-card">
          <Text className="stat-label">托管中</Text>
          <Text className="stat-value">{stats.hostingCount}</Text>
          <Text className="stat-hint">正在运营</Text>
        </View>
      </View>

      {/* 我的分身列表 */}
      <View className="section-header">
        <Text className="section-title">我的分身</Text>
        <View className="section-action">
          <Text className="action-text">管理</Text>
          <ChevronRight size={28} color="#9CA3AF" />
        </View>
      </View>

      <ScrollView scrollY className="avatar-list">
        {avatars.map((avatar) => (
          <View key={avatar.id} className="avatar-card">
            <View className="avatar-main">
              <View className="avatar-left">
                <View className="avatar-wrapper">
                  <Image src={avatar.avatar} className="avatar-img" />
                  <View className={`online-indicator ${avatar.online ? 'online' : ''}`} />
                  {avatar.hosting && (
                    <View className="hosting-badge">
                      <Shield size={16} color="#fff" />
                    </View>
                  )}
                </View>
                <View className="avatar-details">
                  <View className="avatar-name-row">
                    <Text className="avatar-name">{avatar.name}</Text>
                    {avatar.hosting && (
                      <View className="hosting-tag">
                        <Text className="hosting-tag-text">托管中</Text>
                      </View>
                    )}
                  </View>
                  <View className="avatar-tags">
                    {avatar.tags.map((tag, idx) => (
                      <View key={idx} className="tag-badge">
                        <Text className="tag-text">{tag}</Text>
                      </View>
                    ))}
                    <View className="gender-badge">
                      <Text className="badge-text">{avatar.gender} · {avatar.age}岁</Text>
                    </View>
                  </View>
                  <View className="avatar-stats">
                    <View className="stat-item">
                      <DollarSign size={24} color="#10B981" />
                      <Text className="stat-text earnings">今日 ¥{avatar.todayEarnings.toFixed(2)}</Text>
                    </View>
                    <View className="stat-item">
                      <TrendingUp size={24} color="#6B7280" />
                      <Text className="stat-text">{avatar.totalPosts}帖</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View className="avatar-right">
                <View 
                  className={`hosting-toggle ${avatar.hosting ? 'active' : ''}`}
                  onClick={() => toggleHosting(avatar.id)}
                >
                  <View className="toggle-track">
                    <View className="toggle-thumb" />
                  </View>
                  <Text className={`toggle-label ${avatar.hosting ? 'active' : ''}`}>
                    {avatar.hosting ? '关闭托管' : '开启托管'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* 创建分身按钮 */}
        <View className="create-btn">
          <Plus size={48} color="#7B3FE4" />
          <Text className="create-text">创建新分身</Text>
          <Text className="create-hint">AI智能生成 · 10秒克隆</Text>
        </View>
      </ScrollView>

      {/* 底部TabBar */}
      <View className="tabbar">
        <View className="tabbar-item">
          <View className="tabbar-icon">
            <Users size={48} color="#9CA3AF" />
          </View>
          <Text className="tabbar-text">广场</Text>
        </View>
        <View className="tabbar-item active">
          <View className="tabbar-icon active">
            <Users size={48} color="#7B3FE4" />
          </View>
          <Text className="tabbar-text active">分身</Text>
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
