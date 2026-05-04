import { useLoad, useDidShow, navigateTo, reLaunch, showModal, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { 
  Settings, ChevronRight, LogOut, Sparkles, Bell, Info, 
  CircleQuestionMark, Briefcase, Wallet, Crown, Package, X
} from 'lucide-react-taro'
import { LevelDetailDialog } from '@/components/level-detail-dialog'
import { getSafeArea } from '@/utils/safe-area'
import '../../styles/variables.css'
import './index.css' 

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_moments: '微信朋友圈',
  wechat_video: '微信视频号',
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
  taskCount: number
  postCount: number
  friendCount: number
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

// 菜单项配置
const menuItems = [
  { title: '我的分身', icon: Sparkles, desc: '管理AI分身', type: 'primary', path: '/pages/avatar/avatar-manage/index' },
  { title: '技能广场', icon: Package, desc: '解锁更多能力', type: 'success', path: '/pages/skills-square/index' },
  { title: '我要推广', icon: Briefcase, desc: '订单管理', type: 'info', path: '/pages/order/order-list/index' },
  { title: '收益中心', icon: Wallet, desc: '查看收益和提现', type: 'warning', path: '/pages/earning-center/index' },
  { title: '订阅中心', icon: Crown, desc: '升级解锁更多功能', type: 'primary', path: '/pages/subscription/index' },
  { title: '帮助中心', icon: CircleQuestionMark, desc: '常见问题解答', type: 'info', path: '/pages/profile/help/index' },
  { title: '关于我们', icon: Info, desc: '版本 v1.0.0', type: 'default', path: '/pages/profile/about/index' }
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
  const [unreadCount, setUnreadCount] = useState(0)

  useLoad(() => {
    if (!isLoggedIn) {
      navigateTo({ url: '/pages/login/index' })
    }
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchStats()
      fetchPendingRequests()
      fetchUnreadCount()
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

  const fetchUnreadCount = async () => {
    try {
      const res = await Network.request({ url: '/api/notifications/unread-count' })
      if (res.data?.code === 200) {
        setUnreadCount(res.data.data.count || 0)
      }
    } catch (error) {
      console.error('获取未读消息数失败:', error)
    }
  }

  const handleViewRequest = (request: PendingRequest) => {
    setShowPendingDialog(false)
    navigateTo({
      url: `/pages/order/pending-order/index?requestId=${request.id}`
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

  if (!isLoggedIn) return null

  return (
    <View className="profile-page">
      {/* 顶部渐变Header - 包含导航栏区域 */}
      <View 
        className="profile-header-gradient"
        style={{ paddingTop: `${statusBarHeight}px` }}
      >
        {/* 自定义导航栏 - Tab页面不需要返回按钮 */}
        <View className="custom-nav-bar">
          <View className="nav-bar-content">
            <View className="nav-bar-left" />
            <View className="nav-bar-right" />
          </View>
        </View>
        {/* 网格背景 */}
        <View className="header-grid-bg" />
        
        {/* 闪烁星星 */}
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
        {/* 卡片顶部：用户信息和操作按钮 */}
        <View className="card-top-row">
          {/* 用户信息 */}
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

          {/* 操作按钮 */}
          <View className="card-actions">
            <View className="action-btn-light" onClick={() => navigateTo({ url: '/pages/profile/notifications/index' })}>
              <Bell size={28} color="#666" />
              {unreadCount > 0 && (
                <View className="action-badge">
                  <Text className="action-badge-text">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <View className="action-btn-light" onClick={() => navigateTo({ url: '/pages/profile/settings/index' })}>
              <Settings size={28} color="#666" />
            </View>
          </View>
        </View>

        {/* 统计数据 */}
        <View className="header-stats">
          <View className="h-stat-item" onClick={() => navigateTo({ url: '/pages/avatar/avatar-manage/index' })}>
            <Text className="h-stat-value">{stats.avatarCount}</Text>
            <Text className="h-stat-label">AI分身</Text>
          </View>
          <View className="h-stat-item" onClick={() => navigateTo({ url: '/pages/order/order-list/index?mode=avatar' })}>
            <Text className="h-stat-value">{stats.taskCount}</Text>
            <Text className="h-stat-label">任务</Text>
          </View>
          <View className="h-stat-item" onClick={() => switchTab({ url: '/pages/social/index' })}>
            <Text className="h-stat-value">{stats.postCount}</Text>
            <Text className="h-stat-label">动态</Text>
          </View>
          <View className="h-stat-item" onClick={() => navigateTo({ url: '/pages/avatar/avatar-friends/index' })}>
            <Text className="h-stat-value">{stats.friendCount}</Text>
            <Text className="h-stat-label">好友</Text>
          </View>
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
                <Bell size={40} color="#7B3FE4" />
                <Text className="pending-dialog-title">新订单分配</Text>
              </View>
              <View className="pending-dialog-close" onClick={handleCloseDialog}>
                <X size={36} color="#999999" />
              </View>
            </View>

            <ScrollView className="pending-dialog-content" scrollY>
              {pendingRequests.map((request) => (
                <View key={request.id} className="pending-request-card">
                  <View className="request-header">
                    <Sparkles size={36} color="#7B3FE4" />
                    <Text className="request-order-title">{request.orders.title}</Text>
                  </View>

                  <View className="request-budget">
                    <Text className="budget-label">预算</Text>
                    <Text className="budget-value">¥{request.orders.budget}</Text>
                  </View>

                  <View className="request-meta">
                    <Text className="meta-item">{getPlatformNames(request.orders.platforms)}</Text>
                    <Text className="meta-item">{request.orders.deadline ? new Date(request.orders.deadline).toLocaleDateString() : '不限'}</Text>
                  </View>

                  <Button
                    className="view-request-btn"
                    onClick={() => handleViewRequest(request)}
                  >
                    <Text className="view-request-text">查看详情并确认</Text>
                    <ChevronRight size={32} color="#ffffff" />
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
                  <Icon size={36} color={iconColor} />
                </View>
                <View className="menu-content">
                  <Text className="menu-title">{item.title}</Text>
                  <Text className="menu-desc">{item.desc}</Text>
                </View>
                <ChevronRight size={36} color="#cccccc" />
              </View>
            )
          })}
        </View>

        {/* 退出按钮 */}
        <View className="logout-btn" onClick={handleLogout}>
          <LogOut size={36} color="#EF4444" />
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
