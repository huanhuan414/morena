import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, navigateTo, reLaunch, showModal, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { Settings, ChevronRight, LogOut, Sparkles, Bell, Shield, Info, Award, TrendingUp, CircleQuestionMark, Briefcase, Wallet, Gift, Zap } from 'lucide-react-taro'
import './index.css'

interface UserStats {
  avatarCount: number
  taskCount: number
  postCount: number
  followingCount: number
  followerCount: number
  totalXp: number
  level: number
}

export default function ProfilePage() {
  const { userInfo, logout, isLoggedIn } = useUserStore()
  const [stats, setStats] = useState<UserStats>({
    avatarCount: 0,
    taskCount: 0,
    postCount: 0,
    followingCount: 0,
    followerCount: 0,
    totalXp: 0,
    level: 1
  })

  useLoad(() => {
    if (!isLoggedIn) {
      navigateTo({ url: '/pages/login/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchStats()
    }
  })

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/user/stats' })
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  const handleLogout = () => {
    showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          reLaunch({ url: '/pages/login/index' })
        }
      }
    })
  }

  const menuItems = [
    { title: '我的分身', icon: Sparkles, desc: '管理AI分身', color: '#00f5ff', path: '/pages/avatar-manage/index' },
    { title: '订单管理', icon: Briefcase, desc: '查看和管理订单', color: '#00f5ff', path: '/pages/order-list/index' },
    { title: '任务大厅', icon: Zap, desc: '分身接单赚钱', color: '#bf00ff', path: '/pages/order-list/index?mode=avatar' },
    { title: '收益中心', icon: Wallet, desc: '查看收益和提现', color: '#00ff88', path: '/pages/earning-center/index' },
    { title: '邀请返利', icon: Gift, desc: '邀请好友得奖励', color: '#bf00ff', path: '/pages/referral-center/index' },
    { title: '学习记录', icon: TrendingUp, desc: '查看学习进度', color: '#bf00ff', path: '/pages/mind-chat/index' },
    { title: '成就徽章', icon: Award, desc: `${stats.level}级 · ${stats.totalXp}经验`, color: '#ffaa00', path: '/pages/mind-chat/index' },
    { title: '消息通知', icon: Bell, desc: '接收最新动态', color: '#00ff88', path: '/pages/profile/notifications' },
    { title: '账户安全', icon: Shield, desc: '隐私与安全设置', color: '#ff6b6b', path: '/pages/profile/security' },
    { title: '帮助中心', icon: CircleQuestionMark, desc: '常见问题解答', color: '#3b82f6', path: '/pages/profile/help' },
    { title: '关于我们', icon: Info, desc: '版本 v1.0.0', color: '#64748b', path: '/pages/profile/about' }
  ]

  if (!isLoggedIn) return null

  return (
    <View className="profile-page">
      {/* 顶部背景 */}
      <View className="profile-bg">
        <View className="bg-glow" />
      </View>

      {/* 用户信息卡片 */}
      <View className="user-card">
        <View className="user-header">
          <View className="user-avatar-wrap">
            {userInfo?.avatar ? (
              <Image src={userInfo.avatar} className="user-avatar" mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder">
                <Text className="avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
              </View>
            )}
            <View className="level-badge">
              <Text className="level-text">Lv.{stats.level}</Text>
            </View>
          </View>
          <View className="user-info">
            <Text className="user-name">{userInfo?.nickname || '探索者'}</Text>
            <Text className="user-id">ID: {userInfo?.id?.slice(-8) || 'guest'}</Text>
          </View>
          <Button className="settings-btn" onClick={() => navigateTo({ url: '/pages/profile/settings' })}>
            <Settings size={20} color="rgba(255,255,255,0.6)" />
          </Button>
        </View>

        {/* 统计数据 */}
        <View className="stats-row">
          <View className="stat-item" onClick={() => navigateTo({ url: '/pages/avatar-manage/index' })}>
            <Text className="stat-value">{stats.avatarCount}</Text>
            <Text className="stat-label">AI分身</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={() => navigateTo({ url: '/pages/task/index' })}>
            <Text className="stat-value">{stats.taskCount}</Text>
            <Text className="stat-label">任务</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={() => switchTab({ url: '/pages/social/index' })}>
            <Text className="stat-value">{stats.postCount}</Text>
            <Text className="stat-label">动态</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={() => navigateTo({ url: '/pages/profile/followers' })}>
            <Text className="stat-value">{stats.followerCount}</Text>
            <Text className="stat-label">粉丝</Text>
          </View>
        </View>

        {/* 经验进度 */}
        <View className="xp-section">
          <View className="xp-header">
            <Text className="xp-title">经验值</Text>
            <Text className="xp-value">{stats.totalXp} XP</Text>
          </View>
          <View className="xp-bar">
            <View className="xp-fill" style={{ width: '60%' }} />
          </View>
          <Text className="xp-hint">再获得 400 XP 升级</Text>
        </View>
      </View>

      <ScrollView className="menu-scroll" scrollY>
        {/* 功能菜单 */}
        <View className="menu-section">
          <View className="menu-grid">
            {menuItems.map((item, idx) => {
              const Icon = item.icon
              return (
                <View 
                  key={idx}
                  className="menu-item"
                  onClick={() => item.path && navigateTo({ url: item.path })}
                >
                  <View className="menu-left">
                    <View className="menu-icon" style={{ background: `${item.color}15` }}>
                      <Icon size={22} color={item.color} />
                    </View>
                    <View className="menu-text">
                      <Text className="menu-title">{item.title}</Text>
                      <Text className="menu-desc">{item.desc}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
                </View>
              )
            })}
          </View>
        </View>

        {/* 退出按钮 */}
        <View className="logout-section">
          <Button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} color="rgba(255,255,255,0.5)" />
            <Text className="logout-text">退出登录</Text>
          </Button>
        </View>

        {/* 版本信息 */}
        <View className="version-section">
          <Text className="version-text">莫瑞娜 v1.0.0</Text>
          <Text className="version-copyright">AI原生人机共生协同平台</Text>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
