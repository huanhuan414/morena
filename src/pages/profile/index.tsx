import { useLoad, useDidShow, navigateTo, reLaunch, showModal, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { Settings, ChevronRight, LogOut, Sparkles, Bell, Shield, Info, CircleQuestionMark, Briefcase, Wallet, Gift, Zap, Crown, Box, X } from 'lucide-react-taro'
import { LevelDetailDialog } from '@/components/level-detail-dialog'
import { getSafeArea } from '@/utils/safe-area'
import './index.css'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信小程序',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

// 获取平台中文名称
const getPlatformNames = (platforms?: string[]): string => {
  if (!platforms || platforms.length === 0) return '全平台'
  return platforms.map(p => PLATFORM_NAMES[p] || p).join('、')
}

interface UserStats {
  avatarCount: number
  taskCount: number      // B端订单数量
  postCount: number      // 帖子数量
  friendCount: number    // 好友数量
  totalXp: number
  level: number
}

interface PendingRequest {
  id: string
  orders: {
    id: string
    title: string
    description: string
    budget: number
    content_type: string
    platforms: string[]
    target_audience: string
    deadline: string
    created_at: string
  }
  avatars: {
    id: string
    name: string
    avatar_url: string
    level: number
    completion_rate: number
    avg_rating: number
    is_hosted: boolean
  }
  created_at: string
  expires_at: string
}

export default function ProfilePage() {
  const { userInfo, logout, isLoggedIn } = useUserStore()
  const [stats, setStats] = useState<UserStats>({
    avatarCount: 0,
    taskCount: 0,
    postCount: 0,
    friendCount: 0,
    totalXp: 0,
    level: 1
  })
  const [showLevelDialog, setShowLevelDialog] = useState(false)
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [showPendingDialog, setShowPendingDialog] = useState(false)

  useLoad(() => {
    if (!isLoggedIn) {
      navigateTo({ url: '/pages/login/index' })
    }
    // 获取安全区域信息
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchStats()
      fetchPendingRequests()
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

  const fetchPendingRequests = async () => {
    try {
      const res = await Network.request({ url: '/api/order-dispatch/pending-requests' })
      if (res.data?.code === 200 && res.data.data.length > 0) {
        setPendingRequests(res.data.data)
        setShowPendingDialog(true)
      }
    } catch (error) {
      console.error('获取待确认订单失败:', error)
    }
  }

  const handleViewRequest = (request: PendingRequest) => {
    setShowPendingDialog(false)
    navigateTo({
      url: `/pages/pending-order/index?requestId=${request.id}`
    })
  }

  const handleCloseDialog = () => {
    setShowPendingDialog(false)
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
    { title: '技能广场', icon: Box, desc: '为分身解锁更多能力', color: '#ff6b6b', path: '/pages/skills-square/index' },
    { title: '订阅中心', icon: Crown, desc: '升级解锁更多功能', color: '#ffd700', path: '/pages/subscription/index' },
    { title: '订单管理', icon: Briefcase, desc: '查看和管理订单', color: '#00f5ff', path: '/pages/order-list/index' },
    { title: '任务大厅', icon: Zap, desc: '分身接单赚钱', color: '#bf00ff', path: '/pages/order-list/index?mode=avatar' },
    { title: '收益中心', icon: Wallet, desc: '查看收益和提现', color: '#00ff88', path: '/pages/earning-center/index' },
    { title: '邀请返利', icon: Gift, desc: '邀请好友得奖励', color: '#bf00ff', path: '/pages/referral-center/index' },
    { title: '消息通知', icon: Bell, desc: '接收最新动态', color: '#00ff88', path: '/pages/profile/notifications' },
    { title: '账户安全', icon: Shield, desc: '隐私与安全设置', color: '#ff6b6b', path: '/pages/profile/security' },
    { title: '帮助中心', icon: CircleQuestionMark, desc: '常见问题解答', color: '#3b82f6', path: '/pages/profile/help' },
    { title: '关于我们', icon: Info, desc: '版本 v1.0.0', color: '#64748b', path: '/pages/profile/about' }
  ]

  if (!isLoggedIn) return null

  return (
    <View className="profile-page">
      {/* 状态栏占位 */}
      <View className="status-bar-placeholder" style={{ height: `${statusBarHeight}px` }} />
      
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
          <View className="stat-item" onClick={() => navigateTo({ url: '/pages/order-list/index?mode=avatar' })}>
            <Text className="stat-value">{stats.taskCount}</Text>
            <Text className="stat-label">任务</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={() => switchTab({ url: '/pages/social/index' })}>
            <Text className="stat-value">{stats.postCount}</Text>
            <Text className="stat-label">动态</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item" onClick={() => navigateTo({ url: '/pages/avatar-friends/index' })}>
            <Text className="stat-value">{stats.friendCount}</Text>
            <Text className="stat-label">好友</Text>
          </View>
        </View>

        {/* 经验进度 */}
        <View className="xp-section" onClick={() => setShowLevelDialog(true)}>
          <View className="xp-header">
            <Text className="xp-level">Lv.{stats.level}</Text>
            <Text className="xp-value">
              {stats.level >= 10 ? '已满' : `${stats.totalXp} / ${stats.level * 100} XP`}
            </Text>
          </View>
          <View className="xp-bar">
            <View
              className="xp-fill"
              style={{
                width: `${stats.level >= 10 ? 100 : Math.min(100, stats.totalXp - (stats.level - 1) * 100)}%`
              }}
            />
          </View>
          <Text className="xp-hint">
            {stats.level >= 10 ? '已达到最高等级' : `距离 Lv.${stats.level + 1} 还需 ${stats.level * 100 - stats.totalXp} XP`}
          </Text>
        </View>
      </View>

      {/* 等级详情弹窗 */}
      <LevelDetailDialog
        open={showLevelDialog}
        onClose={() => setShowLevelDialog(false)}
        currentLevel={stats.level}
        currentExp={stats.totalXp}
      />

      {/* 待确认订单弹窗 */}
      {showPendingDialog && pendingRequests.length > 0 && (
        <View className="pending-dialog-overlay" onClick={handleCloseDialog}>
          <View className="pending-dialog" onClick={(e: any) => e.stopPropagation()}>
            <View className="pending-dialog-header">
              <View className="pending-dialog-title-row">
                <Bell size={20} color="#00f5ff" />
                <Text className="pending-dialog-title">新订单分配</Text>
              </View>
              <View className="pending-dialog-close" onClick={handleCloseDialog}>
                <X size={20} color="rgba(255,255,255,0.5)" />
              </View>
            </View>

            <ScrollView className="pending-dialog-content" scrollY>
              {pendingRequests.map((request) => (
                <View key={request.id} className="pending-request-card">
                  <View className="request-avatar-section">
                    <View className="request-avatar">
                      {request.avatars.avatar_url ? (
                        <Image src={request.avatars.avatar_url} className="request-avatar-img" mode="aspectFill" />
                      ) : (
                        <View className="request-avatar-placeholder">
                          <Sparkles size={24} color="#00f5ff" />
                        </View>
                      )}
                    </View>
                    <View className="request-info">
                      <Text className="request-avatar-name">{request.avatars.name}</Text>
                      <Text className="request-order-title">{request.orders.title}</Text>
                    </View>
                  </View>

                  <View className="request-budget">
                    <Text className="budget-label">预算</Text>
                    <Text className="budget-value">¥{request.orders.budget}</Text>
                  </View>

                  <View className="request-meta">
                    <Text className="meta-item">📱 {getPlatformNames(request.orders.platforms)}</Text>
                    <Text className="meta-item">📅 {request.orders.deadline ? new Date(request.orders.deadline).toLocaleDateString() : '不限'}</Text>
                  </View>

                  <Button
                    className="view-request-btn"
                    onClick={() => handleViewRequest(request)}
                  >
                    <Text className="view-request-text">查看详情并确认</Text>
                    <ChevronRight size={16} color="#00f5ff" />
                  </Button>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

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
