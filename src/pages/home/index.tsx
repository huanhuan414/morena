import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, navigateTo, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Sparkles, MessageCircle, GraduationCap, Plus, Bot, Brain, Target, Zap, ChevronRight, TrendingUp, Award } from 'lucide-react-taro'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  conversation_count: number
}

interface LearningProgress {
  total_hours: number
  courses_completed: number
  skills_learned: number
  streak_days: number
}

export default function HomePage() {
  const { userInfo, isLoggedIn } = useUserStore()
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [learningProgress, setLearningProgress] = useState<LearningProgress>({
    total_hours: 0,
    courses_completed: 0,
    skills_learned: 0,
    streak_days: 0
  })

  useLoad(() => {
    if (!isLoggedIn) {
      navigateTo({ url: '/pages/login/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchAvatars()
      fetchLearningProgress()
    }
  })

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200) {
        setAvatars(res.data.data || [])
      }
    } catch (error) {
      console.error('获取分身列表失败:', error)
    }
  }

  const fetchLearningProgress = async () => {
    try {
      const res = await Network.request({ url: '/api/user/learning-progress' })
      if (res.data?.code === 200) {
        setLearningProgress(res.data.data)
      }
    } catch (error) {
      console.error('获取学习进度失败:', error)
    }
  }

  const quickActions = [
    { icon: MessageCircle, label: '开始对话', desc: '与AI分身交流', color: '#00f5ff', path: '/pages/chat/index', isTab: true },
    { icon: GraduationCap, label: '学习中心', desc: '探索新知识', color: '#bf00ff', path: '/pages/learn/index', isTab: true },
    { icon: Target, label: '任务管理', desc: '追踪目标进度', color: '#ff6b6b', path: '/pages/task/index', isTab: false }
  ]

  const features = [
    { icon: Brain, title: 'AI分身', desc: '打造专属智能助手' },
    { icon: Zap, title: '自动协同', desc: '任务自动执行' },
    { icon: TrendingUp, title: '持续进化', desc: '能力不断提升' }
  ]

  const handleCreateAvatar = () => {
    navigateTo({ url: '/pages/avatar-create/index' })
  }

  const handleStartChat = (avatarId?: string) => {
    if (avatarId) {
      navigateTo({ url: `/pages/chat/index?avatarId=${avatarId}` })
    } else {
      switchTab({ url: '/pages/chat/index' })
    }
  }

  if (!isLoggedIn) {
    return null
  }

  return (
    <View className="home-page">
      {/* 顶部背景装饰 */}
      <View className="bg-glow" />

      {/* 欢迎区域 */}
      <View className="welcome-section">
        <View className="user-info">
          <View className="avatar-wrap">
            {userInfo?.avatar ? (
              <Image src={userInfo.avatar} className="user-avatar" mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder">
                <Text className="avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
              </View>
            )}
          </View>
          <View className="user-greeting">
            <Text className="greeting-text">你好，{userInfo?.nickname || '探索者'}</Text>
            <Text className="greeting-sub">今天想和AI分身做什么？</Text>
          </View>
        </View>

        {/* 学习进度概览 */}
        <View className="progress-card">
          <View className="progress-header">
            <Text className="progress-title">学习进度</Text>
            <View className="streak-badge">
              <Award size={14} color="#ffaa00" />
              <Text className="streak-text">{learningProgress.streak_days}天连续</Text>
            </View>
          </View>
          <View className="progress-stats">
            <View className="stat-item">
              <Text className="stat-value">{learningProgress.total_hours}</Text>
              <Text className="stat-label">学习小时</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{learningProgress.courses_completed}</Text>
              <Text className="stat-label">完成课程</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{learningProgress.skills_learned}</Text>
              <Text className="stat-label">技能解锁</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="main-scroll" scrollY>
        {/* AI分身区域 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-wrap">
              <Sparkles size={20} color="#00f5ff" />
              <Text className="section-title">我的AI分身</Text>
            </View>
            <View className="section-action" onClick={handleCreateAvatar}>
              <Text className="action-text">创建分身</Text>
              <Plus size={16} color="#00f5ff" />
            </View>
          </View>

          {avatars.length === 0 ? (
            <View className="empty-avatars" onClick={handleCreateAvatar}>
              <View className="empty-icon">
                <Bot size={48} color="rgba(255,255,255,0.3)" />
              </View>
              <Text className="empty-title">还没有AI分身</Text>
              <Text className="empty-desc">点击创建你的第一个AI分身</Text>
              <Button className="create-btn">
                <Plus size={18} color="#0a0a0f" />
                <Text className="create-btn-text">立即创建</Text>
              </Button>
            </View>
          ) : (
            <ScrollView className="avatars-scroll" scrollX>
              {avatars.map(avatar => (
                <View 
                  key={avatar.id} 
                  className="avatar-card"
                  onClick={() => handleStartChat(avatar.id)}
                >
                  <View className="avatar-avatar">
                    {avatar.avatar_url ? (
                      <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                    ) : (
                      <Sparkles size={32} color="#00f5ff" />
                    )}
                  </View>
                  <Text className="avatar-name">{avatar.name}</Text>
                  <View className="avatar-level">
                    <Text className="level-text">Lv.{avatar.level}</Text>
                  </View>
                  <View className="chat-count">
                    <MessageCircle size={12} color="rgba(255,255,255,0.4)" />
                    <Text className="count-text">{avatar.conversation_count || 0}次对话</Text>
                  </View>
                </View>
              ))}
              <View className="avatar-card add-card" onClick={handleCreateAvatar}>
                <View className="add-icon">
                  <Plus size={32} color="rgba(255,255,255,0.3)" />
                </View>
                <Text className="add-text">创建分身</Text>
              </View>
            </ScrollView>
          )}
        </View>

        {/* 快捷操作 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">快捷操作</Text>
          </View>
          <View className="quick-actions">
            {quickActions.map((action, idx) => {
              const Icon = action.icon
              return (
                <View 
                  key={idx}
                  className="action-card"
                  onClick={() => action.isTab ? switchTab({ url: action.path }) : navigateTo({ url: action.path })}
                >
                  <View 
                    className="action-icon"
                    style={{ 
                      background: `${action.color}15`,
                      boxShadow: `0 0 20px ${action.color}20`
                    }}
                  >
                    <Icon size={24} color={action.color} />
                  </View>
                  <Text className="action-label">{action.label}</Text>
                  <Text className="action-desc">{action.desc}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 功能亮点 */}
        <View className="section features-section">
          <View className="section-header">
            <Text className="section-title">平台能力</Text>
          </View>
          <View className="features-grid">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <View key={idx} className="feature-item">
                  <View className="feature-icon">
                    <Icon size={22} color="#00f5ff" />
                  </View>
                  <View className="feature-content">
                    <Text className="feature-title">{feature.title}</Text>
                    <Text className="feature-desc">{feature.desc}</Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
                </View>
              )
            })}
          </View>
        </View>

        {/* 底部留白 */}
        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
