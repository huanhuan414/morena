import Taro, { useLoad, useDidShow, navigateTo, reLaunch, showModal } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import {
  Settings, ChevronRight, LogOut, Bell, Info,
  Wallet, Crown, Trophy, Sparkles, FileText
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import '@/styles/variables.css'
import './index.css' 

interface UserStats {
  avatarCount: number
  totalEarnings: number
  totalWithdraw: number
  level: number
}

// 菜单项配置
const menuItems = [
  // { title: '我的分身', icon: Sparkles, desc: '管理AI分身', type: 'primary', path: '/package-avatar/pages/avatar-manage/index' },
  { title: '工资墙', icon: Trophy, desc: '收益排行榜', type: 'primary', path: '/package-profile/pages/earnings-wall/index' },
  { title: '技能广场', icon: Sparkles, desc: '解锁更多能力', type: 'success', path: '/package-skill/pages/skills-square/index' },
  { title: '我要发单', icon: FileText, desc: '发布和管理订单', type: 'info', path: '/package-order/pages/order-list/index' },
  { title: '收益中心', icon: Wallet, desc: '查看收益和提现', type: 'warning', path: '/package-profile/pages/earning-center/index' },
  { title: '订阅中心', icon: Crown, desc: '升级解锁更多功能', type: 'primary', path: '/package-avatar/pages/subscription/index' },
  // { title: '帮助中心', icon: CircleQuestionMark, desc: '常见问题解答', type: 'info', path: '/package-profile/pages/help/index' },
  { title: '关于我们', icon: Info, desc: '版本 v1.0.0', type: 'default', path: '/package-profile/pages/about/index' }
]

const typeColorMap: Record<string, string> = {
  primary: '#7B3FE4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  default: '#64748B'
}

const typeBgMap: Record<string, string> = {
  primary: '#F3E8FF',
  success: '#D1FAE5',
  warning: '#FEF3C7',
  danger: '#FEE2E2',
  info: '#E0F2FE',
  default: '#F1F5F9'
}

export default function ProfilePage() {
  const { userInfo, logout, isLoggedIn } = useUserStore()
  const [stats, setStats] = useState<UserStats>({
    avatarCount: 0,
    totalEarnings: 0,
    totalWithdraw: 0,
    level: 1
  })
  const [statusBarHeight] = useState(getStatusBarHeight())
  const [unreadCount, setUnreadCount] = useState(0)

  useLoad(() => {
    if (!isLoggedIn) {
      navigateTo({ url: '/pages/login/index?redirect=/pages/profile/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchStats()
      fetchUnreadCount()
    }
  })

  const fetchStats = async () => {
    try {
      const [statsRes, earningsRes] = await Promise.all([
        Network.request({ url: '/api/user-stats/overview' }),
        Network.request({ url: '/api/earnings/overview' })
      ])
      console.log('[Profile] stats response:', statsRes.data)
      console.log('[Profile] earnings response:', earningsRes.data)
      const data = statsRes.data?.code === 200 ? statsRes.data.data : {}
      const earningsData = earningsRes.data?.code === 200 ? earningsRes.data.data : {}
      setStats({
        avatarCount: data.avatarCount || 0,
        totalEarnings: earningsData.totalEarnings || 0,
        totalWithdraw: 0,
        level: 1
      })
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await Network.request({ url: '/api/notifications/unread-count' })
      if (res.data?.code === 200) {
        setUnreadCount(res.data.data?.count || 0)
      }
    } catch (error) {
      console.error('获取未读消息数失败:', error)
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

  if (!isLoggedIn) return null

  return (
    <View className="profile-page">
      {/* 顶部渐变Header */}
      <View 
        className="profile-header-gradient"
        style={{ paddingTop: `${statusBarHeight}px` }}
      >
        <View className="header-grid-bg" />
        <View className="header-stars">
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
        </View>
      </View>

      {/* 白色卡片区域 - 覆盖在header上 */}
      <View className="profile-floating-card">
        {/* 用户信息 + 操作按钮 */}
        <View className="card-top-row">
          <View className="header-user-info">
            <View className="user-avatar-wrap">
              {userInfo?.avatar ? (
                <Image src={userInfo.avatar} className="user-avatar" mode="aspectFill" />
              ) : (
                <View className="avatar-placeholder">
                  <Text className="avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
                </View>
              )}
              <View className="level-badge">
                <Text className="level-badge-text">Lv.{stats.level}</Text>
              </View>
            </View>
            <View className="user-text-info">
              <Text className="user-name">{userInfo?.nickname || '探索者'}</Text>
              <Text className="user-id">ID: {userInfo?.id?.slice(-8) || 'guest'}</Text>
            </View>
          </View>

          <View className="card-actions">
            <View className="action-btn-light" onClick={() => navigateTo({ url: '/package-profile/pages/notifications/index' })}>
              <Bell size={20} color="#666" />
              {unreadCount > 0 && (
                <View className="action-badge">
                  <Text className="action-badge-text">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <View className="action-btn-light" onClick={() => navigateTo({ url: '/package-profile/pages/settings/index' })}>
              <Settings size={20} color="#666" />
            </View>
          </View>
        </View>

        {/* 统计数据 */}
        <View className="header-stats">
          <View className="h-stat-item" onClick={() => Taro.switchTab({ url: '/pages/mind-chat/index' })}>
            <Text className="h-stat-value">{stats.avatarCount}</Text>
            <Text className="h-stat-label">AI分身</Text>
          </View>
          <View className="h-stat-item" onClick={() => navigateTo({ url: '/package-profile/pages/earning-center/index' })}>
            <Text className="h-stat-value">¥{stats.totalEarnings.toFixed(2)}</Text>
            <Text className="h-stat-label">累计收益</Text>
          </View>
          <View className="h-stat-item" onClick={() => navigateTo({ url: '/package-profile/pages/earning-center/index' })}>
            <Text className="h-stat-value">¥{stats.totalWithdraw.toFixed(2)}</Text>
            <Text className="h-stat-label">累计提现</Text>
          </View>
        </View>
      </View>

      <ScrollView className="menu-scroll" scrollY>
        {/* 功能菜单 */}
        <View className="menu-section">
          {menuItems.map((item, idx) => {
            const Icon = item.icon
            const iconColor = typeColorMap[item.type]
            const bgColor = typeBgMap[item.type]
            return (
              <View 
                key={idx}
                className="menu-item"
                onClick={() => item.path && navigateTo({ url: item.path })}
              >
                <View className="menu-icon-wrap" style={{ backgroundColor: bgColor }}>
                  <Icon size={20} color={iconColor} />
                </View>
                <View className="menu-content">
                  <Text className="menu-title">{item.title}</Text>
                  <Text className="menu-desc">{item.desc}</Text>
                </View>
                <ChevronRight size={20} color="#cccccc" />
              </View>
            )
          })}
        </View>

        {/* 退出按钮 */}
        <View className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text className="logout-text">退出登录</Text>
        </View>

        {/* 版本信息 */}
        <View className="version-section">
          <Text className="version-text">莫瑞娜 v1.0.0</Text>
          <Text className="version-copyright">AI原生人机共生协同平台</Text>
        </View>

        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
