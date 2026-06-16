import Taro, { useDidShow, navigateTo, reLaunch, showModal } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import {
  Settings, ChevronRight, LogOut, Bell, Info,
  Wallet, Crown, Trophy, Sparkles, FileText, Coins
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import '@/styles/variables.css'
import logoImage from '@/static/logo.jpg'
import './index.css'

// 格式化静默时间
const formatSilenceDuration = (ms: number) => {
  if (ms < 60 * 1000) {
    return `${Math.round(ms / 1000)}秒`
  } else if (ms < 60 * 60 * 1000) {
    return `${Math.round(ms / (60 * 1000))}分钟`
  } else if (ms < 24 * 60 * 60 * 1000) {
    const hours = Math.round(ms / (60 * 60 * 1000))
    return `${hours}小时`
  } else {
    const days = Math.round(ms / (24 * 60 * 60 * 1000))
    return `${days}天`
  }
}

interface UserStats {
  avatarCount: number
  totalEarnings: number
  totalWithdraw: number
  level: number
}

interface UserSubscription {
  id: string
  status: 'active' | 'expired' | 'cancelled'
  plan?: {
    id: string
    name: string
  }
  endDate: string
}

// 菜单项配置（定义基础菜单）
const menuItems = [
  { title: '订阅中心', icon: Crown, desc: '升级解锁更多功能', type: 'primary', path: '/package-avatar/pages/subscription/index', requireLogin: true, key: 'subscription_center' },
  { title: '币中心', icon: Coins, desc: '充值和交易记录', type: 'warning', path: '/package-coin/pages/index/index', requireLogin: true, key: 'coin_center' },
  { title: '收益中心', icon: Wallet, desc: '查看收益和提现', type: 'warning', path: '/package-profile/pages/earning-center/index', requireLogin: true, key: 'earning_center' },
  { title: '技能广场', icon: Sparkles, desc: '解锁更多能力', type: 'success', path: '/package-skill/pages/skills-square/index', requireLogin: true, key: 'skill_square' },
  { title: '我要发单', icon: FileText, desc: '发布和管理订单', type: 'info', path: '/package-order/pages/order-list/index', requireLogin: true, key: 'order_publish' },
  { title: '工资墙', icon: Trophy, desc: '收益排行榜', type: 'primary', path: '/package-profile/pages/earnings-wall/index', requireLogin: false, key: 'earnings_wall' },
  { title: '关于我们', icon: Info, desc: '版本 v1.0.0', type: 'default', path: '/package-profile/pages/about/index', requireLogin: false, key: 'about_us' }
]

const typeColorMap: Record<string, string> = {
  primary: '#7B3FE4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  default: '#64748B',
  silver: '#9CA3AF'
}

const typeBgMap: Record<string, string> = {
  primary: '#F3E8FF',
  success: '#D1FAE5',
  warning: '#FEF3C7',
  danger: '#FEE2E2',
  info: '#E0F2FE',
  default: '#F1F5F9',
  silver: '#F3F4F6'
}

export default function ProfilePage() {
  const { userInfo, logout, isLoggedIn } = useUserStore()
  const [stats, setStats] = useState<UserStats>({
    avatarCount: 0,
    totalEarnings: 0,
    totalWithdraw: 0,
    level: 1
  })
  const [coinBalance, setCoinBalance] = useState<number>(0)
  const [statusBarHeight] = useState(getStatusBarHeight())
  const [unreadCount, setUnreadCount] = useState(0)
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null)
  const [silenceUntil, setSilenceUntil] = useState<string | null>(null) // 用户静默截止时间
  const [enabledMenuKeys, setEnabledMenuKeys] = useState<string[]>([]) // 从后端获取的启用菜单key列表

  useDidShow(() => {
    fetchStats()
    fetchUnreadCount()
    fetchMenuConfig()
  })

  const fetchMenuConfig = async () => {
    try {
      const res = await Network.request({ url: '/api/menu-feature/enabled' })
      if (res.data?.code === 200) {
        setEnabledMenuKeys(res.data.data || [])
      }
    } catch (error) {
      console.error('获取菜单配置失败:', error)
      // 如果获取失败，默认显示所有菜单
      setEnabledMenuKeys(menuItems.map(item => item.key))
    }
  }

  const fetchStats = async () => {
    try {
      const userId = userInfo?.id
      const [statsRes, earningsRes, coinRes, subscriptionRes] = await Promise.all([
        Network.request({ url: '/api/user-stats/overview' }),
        Network.request({ url: '/api/earnings/overview' }),
        Network.request({ url: `/api/coin/balance?userId=${userId}` }),
        Network.request({ url: '/api/subscription/current' })
      ])
      const data = statsRes.data?.code === 200 ? statsRes.data.data : {}
      const earningsData = earningsRes.data?.code === 200 ? earningsRes.data.data : {}
      const coinData = coinRes.data?.code === 200 ? coinRes.data.data : {}
      const subscriptionData = subscriptionRes.data?.code === 200 ? subscriptionRes.data.data : null
      setStats({
        avatarCount: data.avatarCount || 0,
        totalEarnings: earningsData.totalEarnings || 0,
        totalWithdraw: earningsData.completedAmount || 0,
        level: 1
      })
      setCoinBalance(coinData.balance || 0)
      setUserSubscription(subscriptionData)

      // 从 overview 接口获取静默信息
      if (data.silenceUntil) {
        setSilenceUntil(data.silenceUntil)
      }
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
            {isLoggedIn ? (
              <>
                <View className="user-avatar-wrap">
                  {userInfo?.avatar ? (
                    <Image src={userInfo.avatar} className="user-avatar" mode="aspectFill" />
                  ) : (
                    <Image src={logoImage} className="user-avatar" mode="aspectFill" />
                  )}
                  <View className="level-badge">
                    <Text className="level-badge-text">Lv.{stats.level}</Text>
                  </View>
                </View>
                <View className="user-text-info">
                  <Text className="user-name">{userInfo?.nickname}</Text>
                  <View className="user-id-row">
                    <Text className="user-id">ID: {userInfo?.id?.slice(-8)}</Text>
                    {silenceUntil && new Date(silenceUntil).getTime() > Date.now() && (() => {
                      const remainingMs = new Date(silenceUntil).getTime() - Date.now()
                      return (
                        <Text className="user-silence-badge">
                          静默{formatSilenceDuration(remainingMs)}
                        </Text>
                      )
                    })()}
                  </View>
                  <View className="user-subscription-row">
                    <Crown size={14} color={userSubscription?.status === 'active' ? '#7B3FE4' : '#999'} />
                    <Text className="user-subscription-text">
                      {userSubscription?.status === 'active' ? (userSubscription.plan?.name || '订阅会员') : '免费用户'}
                    </Text>
                    {userSubscription?.status === 'active' && (
                      <Text className="user-subscription-expire">至 {new Date(userSubscription.endDate).toLocaleDateString('zh-CN')}</Text>
                    )}
                  </View>
                  {enabledMenuKeys.length === 0 || enabledMenuKeys.includes('earning_center') ? (
                    <View className="user-coin-row" onClick={() => navigateTo({ url: '/package-coin/pages/index/index' })}>
                      <Coins size={14} color="#F59E0B" />
                      <Text className="user-coin-text">{coinBalance.toLocaleString()} 币</Text>
                    </View>) : null}
                </View>
              </>
            ) : (
              <>
                <View className="user-avatar-wrap" onClick={() => navigateTo({ url: '/pages/login/index?redirect=/pages/profile/index' })}>
                  <Image src={logoImage} className="user-avatar" mode="aspectFill" />
                  <Text className="login-text">去登录</Text>
                </View>
              </>
            )}
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

        {/* 统计数据 - 仅当收益中心菜单启用时显示 */}
        {enabledMenuKeys.length === 0 || enabledMenuKeys.includes('earning_center') ? (
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
        ) : null}
      </View>

      <ScrollView className="menu-scroll" scrollY>
        {/* 功能菜单 */}
        <View className="menu-section">
          {menuItems
            .filter(item => enabledMenuKeys.length === 0 || enabledMenuKeys.includes(item.key))
            .map((item, idx) => {
              const Icon = item.icon
              const iconColor = typeColorMap[item.type]
              const bgColor = typeBgMap[item.type]
              const handleMenuClick = () => {
                if (!item.path) return
                if (item.requireLogin && !isLoggedIn) {
                  navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(item.path)}` })
                  return
                }
                navigateTo({ url: item.path })
              }
              return (
                <View
                  key={idx}
                  className="menu-item"
                  onClick={handleMenuClick}
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

        {/* 退出按钮 - 仅登录后显示 */}
        {isLoggedIn && (
          <View className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} color="#EF4444" />
            <Text className="logout-text">退出登录</Text>
          </View>
        )}

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
