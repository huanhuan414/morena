import React, { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, ShoppingBag, FileText, Coins, Plus, Grid2x2, Rocket, ChevronRight, Send, Gift, Zap, TrendingUp, Wallet, Sparkles, Target, ArrowRight, CircleDollarSign, HandCoins, Eye } from 'lucide-react-taro'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { useNotifications } from '@/hooks/useNotifications'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

const Index: React.FC = () => {
  const [userName, setUserName] = useState('用户')
  const [mindClones, setMindClones] = useState(0)
  const [userAvatar, setUserAvatar] = useState('')
  const [workHours, setWorkHours] = useState(0)
  const [allHostingEnabled, setAllHostingEnabled] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [invitedCount, setInvitedCount] = useState(0)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [generatedContents, setGeneratedContents] = useState(0)
  const { avatarId: currentAvatarId, setAvatarId } = useUserStore(state => state)

  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderModalData, setOrderModalData] = useState<any>(null)
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage)

  const { unreadCount, showModal, currentNotification, closeModal } = useNotifications({
    pollInterval: 10000
  })

  // 获取待接订单通知
  const fetchOrderNotifications = async () => {
    try {
      const res = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })
      console.log('[首页] 获取待接订单:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const seen = new Set<string>()
        const orders = (res.data.data || []).filter((item: any) => {
          const oid = item.orderId
          if (seen.has(oid)) return false
          seen.add(oid)
          return true
        }).map((item: any) => {
          let platforms = item.platforms
          if (typeof platforms === 'string') {
            try { platforms = JSON.parse(platforms) } catch { platforms = [platforms] }
          }
          if (!Array.isArray(platforms)) platforms = platforms ? [platforms] : ['通用']
          const platformKey = platforms[0] || '通用'
          const platformName = getPlatformName(platformKey)
          
          return {
            id: item.orderId,
            dispatchId: item.dispatchId,
            avatarId: item.avatarId,
            platform: platformName,
            platformColor: getPlatformColor(platformName),
            title: item.title || '新订单',
            budget: item.budget ? `¥${item.budget}` : '待定',
            deadline: '长期有效'
          }
        })
        
        if (orders.length > 0 && !showOrderModal && !orderModalData) {
          setOrderModalData(orders[0])
          setShowOrderModal(true)
        }
      }
    } catch (err) {
      console.error('获取待接订单失败:', err)
    }
  }

  const getPlatformName = (platform: string): string => {
    const nameMap: Record<string, string> = {
      'wechat': '微信', 'wechat_mp': '公众号', 'xiaohongshu': '小红书',
      'douyin': '抖音', 'kuaishou': '快手', 'bilibili': 'B站',
      'weibo': '微博', 'zhihu': '知乎',
    }
    return nameMap[platform] || platform
  }

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      '微信': '#07C160', '公众号': '#07C160', '小红书': '#FF2442',
      '抖音': '#00F2EA', '微博': '#FF8200', '快手': '#FF4906',
      'B站': '#FB7299', '知乎': '#0084FF',
    }
    return colors[platform] || '#6366F1'
  }

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const storedUserInfo = await Taro.getStorage({ key: 'userInfo' }).catch(() => null)
      if (!storedUserInfo?.data?.id) {
        console.log('用户未登录，静默跳转到登录页')
        Taro.navigateTo({ url: '/pages/login/index' })
        return
      }
      
      const res = await Network.request({ url: '/api/user-stats/overview' })
      console.log('统计数据:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const d = res.data.data
        setMindClones(d.avatarCount || 0)
        setUserName(d.nickname || '用户')
        setUserAvatar(d.avatarUrl || '')
        setWorkHours(d.totalWorkHours || 0)
        setAllHostingEnabled(d.allHostingEnabled || false)
        setReferralCode(d.referralCode || '')
        setInvitedCount(d.invitedCount || 0)
        setTotalEarnings(Number(d.totalEarnings || 0))
        setPendingOrders(d.pendingOrders || 0)
        setGeneratedContents(d.generatedContents || 0)
      }
    } catch (err) {
      console.error('获取统计数据失败:', err)
    }
  }

  // 实时动态
  const [activities, setActivities] = useState<any[]>([])

  const fetchActivities = async () => {
    try {
      const res = await Network.request({ url: '/api/activities/recent' })
      if (res.data?.code === 200 && res.data?.data) {
        const mappedActivities = res.data.data.map((item: any) => {
          let ActivityIcon = Coins
          if (item.type === 'chat') ActivityIcon = Users
          else if (item.type === 'content') ActivityIcon = FileText
          else if (item.type === 'order') ActivityIcon = ShoppingBag
          else if (item.type === 'earning') ActivityIcon = Coins
          
          return {
            name: item.title,
            action: item.type === 'earning' ? '收益到账' : item.type === 'chat' ? '对话完成' : item.type === 'content' ? '内容生成' : '订单完成',
            desc: item.description,
            icon: ActivityIcon,
            time: getTimeAgo(item.timestamp),
            amount: item.type === 'earning' ? '+¥' + (Math.random() * 100 + 50).toFixed(2) : null,
            type: item.type === 'earning' ? 'coin' : item.type === 'order' ? 'order' : 'chat'
          }
        })
        setActivities(mappedActivities)
      }
    } catch (err) {
      console.error('获取实时动态失败:', err)
    }
  }
  
  const getTimeAgo = (timestamp: string): string => {
    const diffMs = Date.now() - new Date(timestamp).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return diffMins <= 1 ? '刚刚' : diffMins + '分钟前'
    const diffHours = Math.floor(diffMs / 3600000)
    if (diffHours < 24) return diffHours + '小时前'
    return Math.floor(diffMs / 86400000) + '天前'
  }

  useEffect(() => {
    loadUserFromStorage().then(() => {
      fetchStats()
      fetchActivities()
      fetchOrderNotifications()
    }).catch(err => console.error('初始化数据加载失败:', err))
  }, [])

  useDidShow(() => {
    loadUserFromStorage().then(() => {
      fetchStats()
      fetchActivities()
      fetchOrderNotifications()
    }).catch(err => console.error('刷新数据失败:', err))
  })

  // 根据用户状态决定快捷功能 - 核心转化路径
  const quickActions = mindClones === 0 ? [
    { label: '创建分身', icon: Plus, color: '#6366F1', bg: 'linear-gradient(135deg, #EEF2FF 0%, #C7D2FE 100%)', path: '/package-avatar/pages/avatar-create/index', tag: '0元开始', tagColor: '#6366F1' },
    { label: '接单赚钱', icon: HandCoins, color: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 100%)', path: '/package-order/pages/pending-order/index', tag: '高薪急单', tagColor: '#F59E0B' },
    { label: '订单广场', icon: Grid2x2, color: '#0EA5E9', bg: 'linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 100%)', path: '/package-order/pages/order-square/index', tag: '更多机会', tagColor: '#0EA5E9' },
    { label: '我要发单', icon: Send, color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)', path: '/package-order/pages/order-create/index', tag: '推广引流', tagColor: '#8B5CF6' },
    { label: '邀请赚钱', icon: Gift, color: '#EC4899', bg: 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 100%)', path: '/package-profile/pages/referral-center/index', tag: '每邀5元', tagColor: '#EC4899' },
    { label: '收益提现', icon: Wallet, color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)', path: '/package-profile/pages/earning-center/index', tag: '秒到账', tagColor: '#10B981' },
  ] : [
    { label: '创建分身', icon: Plus, color: '#6366F1', bg: 'linear-gradient(135deg, #EEF2FF 0%, #C7D2FE 100%)', path: '/package-avatar/pages/avatar-create/index', tag: mindClones + '个', tagColor: '#6366F1' },
    { label: '接单赚钱', icon: HandCoins, color: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 100%)', path: '/package-order/pages/pending-order/index', tag: pendingOrders > 0 ? pendingOrders + '单待接' : '去接单', tagColor: '#F59E0B' },
    { label: '我要发单', icon: Send, color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)', path: '/package-order/pages/order-create/index', tag: '推广引流', tagColor: '#8B5CF6' },
    { label: '订单广场', icon: Grid2x2, color: '#0EA5E9', bg: 'linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 100%)', path: '/package-order/pages/order-square/index', tag: '更多机会', tagColor: '#0EA5E9' },
    { label: '邀请赚钱', icon: Gift, color: '#EC4899', bg: 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 100%)', path: '/package-profile/pages/referral-center/index', tag: '每邀5元', tagColor: '#EC4899' },
    { label: '收益提现', icon: Wallet, color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)', path: '/package-profile/pages/earning-center/index', tag: '秒到账', tagColor: '#10B981' },
  ]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 9) return '早上好'
    if (hour < 12) return '上午好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    if (hour < 22) return '晚上好'
    return '夜深了'
  }

  // 获取价值主张文案 - 根据用户状态动态调整
  const getValueProp = () => {
    if (mindClones === 0) return '创建AI分身，开始自动赚钱'
    if (!allHostingEnabled) return '开启托管，让分身24h替你接单'
    if (pendingOrders > 0) return `${pendingOrders}个新订单等你来接`
    return '分身正在努力为你赚钱中'
  }

  const goToPage = (path: string) => {
    if (path === "/pages/mind-chat/index" || path === "/pages/index/index" || path === "/pages/profile/index") {
      Taro.switchTab({ url: path })
      return
    }
    Taro.navigateTo({ url: path })
  }

  const handleOrderAccept = async () => {
    if (orderModalData?.id) {
      try {
        let avatarIdToUse = currentAvatarId
        if (!avatarIdToUse || avatarIdToUse === 'undefined') {
          const avatarRes = await Network.request({ url: '/api/avatar' })
          if (avatarRes.data?.code === 200 && avatarRes.data?.data?.length > 0) {
            avatarIdToUse = avatarRes.data.data[0].id || ''
            if (!avatarIdToUse) {
              Taro.showToast({ title: '分身数据异常', icon: 'none' })
              return
            }
            setAvatarId(avatarIdToUse)
          } else {
            Taro.showToast({ title: '请先创建分身', icon: 'none' })
            return
          }
        }
        const res = await Network.request({
          url: `/api/order-dispatch/avatar/${avatarIdToUse}/accept/${orderModalData.id}`,
          method: 'POST'
        })
        if (res.data?.code === 200) {
          setShowOrderModal(false)
          Taro.navigateTo({ url: `/package-order/pages/order-content-creation/index?orderId=${orderModalData.id}` })
        } else {
          Taro.showToast({ title: res.data?.message || '接单失败', icon: 'none' })
        }
      } catch (err) {
        console.error('接受订单失败:', err)
        Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
      }
    }
  }

  const handleOrderDismiss = () => { setShowOrderModal(false) }

  const enableAllTrust = async () => {
    try {
      const res = await Network.request({
        url: '/api/avatar/trust/all',
        method: 'PUT',
        data: { trust_enabled: true }
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已开启所有分身托管', icon: 'success' })
        fetchStats()
      } else {
        Taro.showToast({ title: res.data?.msg || '开启失败', icon: 'none' })
      }
    } catch (err) {
      console.error('开启托管失败:', err)
      Taro.showToast({ title: '开启失败', icon: 'none' })
    }
  }

  return (
    <View className="index-page">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-bg" />
        <View className="header-content" style={{ paddingTop: `${getStatusBarHeight() + 25}px` }}>
          <View className="header-left">
            <View className="avatar-wrapper">
              <Image className="avatar" src={userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} />
              <View className="online-dot" />
            </View>
            <View className="header-info">
              <Text className="nickname">{getGreeting()}，{userName}</Text>
              <View className="subtitle-wrapper">
                <Sparkles size={22} color="rgba(255,255,255,0.9)" />
                <Text className="subtitle">{getValueProp()}</Text>
              </View>
            </View>
          </View>
          <View className="header-right">
            <View className="icon-btn" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/notifications/index' })}>
              <Bell size={44} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View className="notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </View>
              )}
            </View>
            <View className="icon-btn" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/settings/index' })}>
              <Settings size={44} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>

      {/* 主内容区 */}
      <ScrollView scrollY className="content" enhanced showScrollbar={false}>

        {/* 新用户引导：赚钱攻略（仅无分身时显示） */}
        {mindClones === 0 && (
          <View className="guide-section">
            <View className="guide-header">
              <View className="guide-header-left">
                <Target size={28} color="#6366F1" />
                <Text className="guide-title">3步开始赚钱</Text>
              </View>
              <View className="guide-badge">新手必看</View>
            </View>
            <View className="guide-steps">
              <View className="guide-step" onClick={() => goToPage('/package-avatar/pages/avatar-create/index')}>
                <View className="step-number">1</View>
                <View className="step-content">
                  <Text className="step-title">创建AI分身</Text>
                  <Text className="step-desc">打造你的数字分身，0成本起步</Text>
                </View>
                <ArrowRight size={28} color="#94A3B8" />
              </View>
              <View className="step-connector" />
              <View className="guide-step" onClick={enableAllTrust}>
                <View className="step-number">2</View>
                <View className="step-content">
                  <Text className="step-title">开启自动托管</Text>
                  <Text className="step-desc">AI自动接单，24h不间断赚钱</Text>
                </View>
                <ArrowRight size={28} color="#94A3B8" />
              </View>
              <View className="step-connector" />
              <View className="guide-step">
                <View className="step-number step-number-done">3</View>
                <View className="step-content">
                  <Text className="step-title">坐享收益</Text>
                  <Text className="step-desc">内容发布后自动结算，随时提现</Text>
                </View>
                <CircleDollarSign size={32} color="#10B981" />
              </View>
            </View>
          </View>
        )}

        {/* 核心数据区 - 根据用户状态展示不同重点 */}
        <View className="stats-section">
          {/* 有收益时突出显示 */}
          {totalEarnings > 0 && (
            <View className="earning-highlight" onClick={() => goToPage('/package-profile/pages/earning-center/index')}>
              <View className="earning-highlight-left">
                <TrendingUp size={32} color="#10B981" />
                <Text className="earning-highlight-label">累计收益</Text>
              </View>
              <View className="earning-highlight-right">
                <Text className="earning-highlight-value">¥{totalEarnings.toFixed(2)}</Text>
                <ChevronRight size={28} color="#10B981" />
              </View>
            </View>
          )}
          <View className="stats-row">
            <View className="stat-item" onClick={() => goToPage('/pages/mind-chat/index')}>
              <View className="stat-icon-small" style={{ background: '#EEF2FF' }}>
                <Users size={28} color="#6366F1" />
              </View>
              <Text className="stat-value-small" style={{ color: '#6366F1' }}>{mindClones}</Text>
              <Text className="stat-label-small">我的分身</Text>
              <Text className="stat-hint" style={{ color: '#6366F1' }}>
                {mindClones === 0 ? '立即创建' : workHours > 0 ? `已工作${workHours}h` : '管理分身'}
              </Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-order/pages/pending-order/index')}>
              <View className="stat-icon-small" style={{ background: '#FFFBEB' }}>
                <ShoppingBag size={28} color="#F59E0B" />
              </View>
              <Text className="stat-value-small" style={{ color: '#F59E0B' }}>{pendingOrders}</Text>
              <Text className="stat-label-small">待接订单</Text>
              <Text className="stat-hint" style={{ color: pendingOrders > 0 ? '#F59E0B' : '#94A3B8' }}>
                {pendingOrders > 0 ? '去接单赚钱' : '暂无待接'}
              </Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-avatar/pages/generated-content/index')}>
              <View className="stat-icon-small" style={{ background: '#ECFDF5' }}>
                <FileText size={28} color="#10B981" />
              </View>
              <Text className="stat-value-small" style={{ color: '#10B981' }}>{generatedContents}</Text>
              <Text className="stat-label-small">生成内容</Text>
              <Text className="stat-hint" style={{ color: generatedContents > 0 ? '#10B981' : '#94A3B8' }}>
                {generatedContents > 0 ? '去发布' : '暂无内容'}
              </Text>
            </View>
            <View className="stat-item" onClick={() => goToPage('/package-profile/pages/earning-center/index')}>
              <View className="stat-icon-small" style={{ background: '#FDF2F8' }}>
                <Coins size={28} color="#EC4899" />
              </View>
              <Text className="stat-value-small" style={{ color: '#EC4899' }}>¥{totalEarnings > 0 ? totalEarnings.toFixed(0) : '0'}</Text>
              <Text className="stat-label-small">累计收益</Text>
              <Text className="stat-hint" style={{ color: totalEarnings > 0 ? '#EC4899' : '#94A3B8' }}>
                {totalEarnings > 0 ? '去提现' : '开始赚取'}
              </Text>
            </View>
          </View>
        </View>

        {/* 推广Banner - 根据用户阶段精准引导 */}
        <View
          className="banner"
          onClick={() => {
            if (mindClones === 0) {
              goToPage('/package-avatar/pages/avatar-create/index')
            } else if (!allHostingEnabled) {
              enableAllTrust()
            } else {
              goToPage('/package-profile/pages/referral-center/index')
            }
          }}
        >
          <View className="banner-bg" />
          <View className="banner-content">
            {mindClones === 0 ? (
              <>
                <View className="banner-tag">
                  <Sparkles size={20} color="#FBBF24" />
                  <Text className="banner-tag-text">0成本创业</Text>
                </View>
                <Text className="banner-title">创建AI分身 开始自动赚钱</Text>
                <Text className="banner-desc">AI帮你接单+生成内容+自动发布，你只管收钱</Text>
                <View className="banner-btn create">
                  <Plus size={28} color="#6366F1" />
                  <Text className="banner-btn-text create">免费创建，立即赚钱</Text>
                </View>
              </>
            ) : !allHostingEnabled ? (
              <>
                <View className="banner-tag">
                  <Zap size={20} color="#FBBF24" />
                  <Text className="banner-tag-text">收益翻倍</Text>
                </View>
                <Text className="banner-title">开启托管 让分身24h赚钱</Text>
                <Text className="banner-desc">自动抢单+自动生成+自动发布，不错过任何收益</Text>
                <View className="banner-btn">
                  <Text className="banner-btn-text">一键开启</Text>
                  <ChevronRight size={24} color="#6366F1" />
                </View>
              </>
            ) : (
              <>
                <View className="banner-referral-header">
                  <Gift size={32} color="#FBBF24" />
                  <Text className="banner-title-referral">邀请好友 双方各赚5元</Text>
                </View>
                <Text className="banner-desc-referral">每邀请1位好友注册，双方各得5元奖励！已邀请 {invitedCount} 人</Text>
                <View className="banner-referral-bottom">
                  <View className="referral-code-tag">
                    <Text className="referral-code-text">邀请码：{referralCode || '加载中...'}</Text>
                  </View>
                  <View className="banner-btn-referral">
                    <Text className="banner-btn-text-referral">立即邀请</Text>
                    <ChevronRight size={20} color="#FFFFFF" />
                  </View>
                </View>
              </>
            )}
          </View>
          <View className="banner-decoration">
            <View className="deco-circle circle-1" />
            <View className="deco-circle circle-2" />
            {mindClones === 0 ? (
              <Rocket size={100} color="rgba(255,255,255,0.15)" />
            ) : !allHostingEnabled ? (
              <Zap size={100} color="rgba(255,255,255,0.15)" />
            ) : (
              <Gift size={100} color="rgba(255,255,255,0.15)" />
            )}
          </View>
        </View>

        {/* 快捷功能 - 每项附带利益点 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">赚钱工具</Text>
            <View className="section-more">
              <Text className="section-more-text">全部功能</Text>
              <ChevronRight size={24} color="#9CA3AF" />
            </View>
          </View>
          <View className="quick-grid">
            {quickActions.map((action) => (
              <View 
                key={action.label} 
                className="quick-item" 
                onClick={() => goToPage(action.path)}
              >
                <View className="quick-icon" style={{ background: action.bg }}>
                  <action.icon size={40} color={action.color} />
                </View>
                <Text className="quick-label">{action.label}</Text>
                <Text className="quick-tag" style={{ color: action.tagColor, background: action.tagColor + '15' }}>{action.tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 实时动态 - 社交证明，激发行动 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">实时收益</Text>
            </View>
            <View className="live-indicator">
              <View className="live-dot" />
              <Text className="live-text">LIVE</Text>
            </View>
          </View>
          
          <ScrollView scrollX className="activity-scroll-container" enhanced showScrollbar={false}>
            <View className="activity-scroll-track">
              {activities.length > 0 ? activities.map((item, index) => (
                <View key={`${item.name}-${index}`} className="activity-card">
                  <View className="activity-card-header">
                    <View className="activity-icon-wrapper" style={{ background: item.type === 'coin' ? '#ECFDF5' : item.type === 'order' ? '#EEF2FF' : '#F5F3FF' }}>
                      <item.icon size={28} color={item.type === 'coin' ? '#10B981' : item.type === 'order' ? '#6366F1' : '#8B5CF6'} />
                    </View>
                    <View className="activity-time-badge">{item.time}</View>
                  </View>
                  <View className="activity-card-content">
                    <Text className="activity-name">{item.name}</Text>
                    <Text className="activity-action">{item.action}</Text>
                    {item.amount && (
                      <Text className="activity-amount" style={{ color: item.type === 'coin' ? '#10B981' : '#6366F1' }}>
                        {item.amount}
                      </Text>
                    )}
                    {!item.amount && item.desc && (
                      <Text className="activity-desc">{item.desc}</Text>
                    )}
                  </View>
                </View>
              )) : (
                <View className="activity-empty">
                  <Eye size={40} color="#CBD5E1" />
                  <Text className="activity-empty-text">其他用户正在赚钱中...</Text>
                  <Text className="activity-empty-hint">创建分身即可开始</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* 底部留白 */}
        <View className="bottom-spacer" />
      </ScrollView>

      {/* 订单通知弹窗 */}
      {showOrderModal && orderModalData && (
        <View className="order-modal-overlay" onClick={handleOrderDismiss}>
          <View className="order-modal" onClick={(e) => e.stopPropagation()}>
            <View className="order-modal-header">
              <Text className="order-modal-title">新订单通知</Text>
              <View className="order-modal-close" onClick={handleOrderDismiss}>
                <Text className="order-modal-close-text">×</Text>
              </View>
            </View>
            
            <View className="order-modal-content">
              <View className="order-modal-platform" style={{ background: orderModalData.platformColor }}>
                {orderModalData.platform}
              </View>
              <Text className="order-modal-order-title">{orderModalData.title}</Text>
              
              <View className="order-modal-info">
                <View className="order-modal-info-item">
                  <Text className="order-modal-info-label">预算</Text>
                  <Text className="order-modal-info-value" style={{ color: '#F59E0B' }}>{orderModalData.budget}</Text>
                </View>
                <View className="order-modal-info-item">
                  <Text className="order-modal-info-label">截止</Text>
                  <Text className="order-modal-info-value" style={{ color: '#EF4444' }}>{orderModalData.deadline}</Text>
                </View>
              </View>
            </View>
            
            <View className="order-modal-actions">
              <View className="order-modal-btn dismiss" onClick={handleOrderDismiss}>
                <Text className="order-modal-btn-text dismiss">暂不接单</Text>
              </View>
              <View className="order-modal-btn accept" onClick={handleOrderAccept}>
                <Text className="order-modal-btn-text accept">立即接单</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 通知弹窗 */}
      {showModal && currentNotification && (
        <View className="notification-modal-overlay" onClick={closeModal}>
          <View className="notification-modal" onClick={(e) => e.stopPropagation()}>
            <View className="notification-modal-header">
              <Text className="notification-modal-title">{currentNotification.title}</Text>
              <View className="notification-modal-close" onClick={closeModal}>
                <Text className="notification-modal-close-text">×</Text>
              </View>
            </View>
            <View className="notification-modal-content">
              <Text className="notification-modal-text">{currentNotification.content}</Text>
              <Text className="notification-modal-time">
                {new Date(currentNotification.createdAt).toLocaleString()}
              </Text>
            </View>
            <View className="notification-modal-footer">
              <View className="notification-modal-btn" onClick={closeModal}>
                <Text className="notification-modal-btn-text">我知道了</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default Index
