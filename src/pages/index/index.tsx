import React, { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, ShoppingBag, FileText, Coins, Plus, Grid2x2, Rocket, Library, Share2, ChevronRight, Send } from 'lucide-react-taro'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { useNotifications } from '@/hooks/useNotifications'
import './index.css'

const Index: React.FC = () => {
  const [userName] = useState('用户')
  const [translateX, setTranslateX] = useState(0)
  const [mindClones, setMindClones] = useState(0) // 分身数量
  const [avatar] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=default')
  const { avatarId: currentAvatarId, setAvatarId } = useUserStore(state => state)
  const [stats, setStats] = useState([
    { label: '我的分身', value: '0', unit: '个', color: '#6366F1', bg: '#EEF2FF', trend: '', path: '/pages/mind-chat/index' },
    { label: '待接订单', value: '0', unit: '单', color: '#F59E0B', bg: '#FFFBEB', trend: '', path: '/pages/pending-order/index' },
    { label: '生成内容', value: '0', unit: '篇', color: '#10B981', bg: '#ECFDF5', trend: '', path: '/pages/generated-content/index' },
    { label: '累计收益', value: '0', unit: '元', color: '#EC4899', bg: '#FDF2F8', trend: '', path: '/pages/earning-center/index' },
  ])

  const [showOrderModal, setShowOrderModal] = useState(false) // 订单弹窗
  const [orderModalData, setOrderModalData] = useState<any>(null) // 订单数据
  const scrollRef = useRef(0)
  const loadUserFromStorage = useUserStore(state => state.loadUserFromStorage)

  // 通知 hook
  const { unreadCount, showModal, currentNotification, closeModal } = useNotifications({
    pollInterval: 10000 // 10 秒轮询
  })

  // 获取待接订单通知（从分派记录中获取，只显示状态为 pending 的订单）
  const fetchOrderNotifications = async () => {
    try {
      const res = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })
      console.log('[首页] 获取待接订单:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        // 转换分派请求数据为通知格式，按 orderId 去重（同一订单可能有多个分身）
        const seen = new Set<string>()
        const orders = (res.data.data || []).filter((item: any) => {
          const oid = item.orderId
          if (seen.has(oid)) return false
          seen.add(oid)
          return true
        }).map((item: any) => {
          // 处理平台信息
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
        
        // 如果有待接订单且弹窗未打开，自动显示第一个
        if (orders.length > 0 && !showOrderModal && !orderModalData) {
          setOrderModalData(orders[0])
          setShowOrderModal(true)
        }
      }
    } catch (err) {
      console.error('获取待接订单失败:', err)
    }
  }

  // 将英文平台名转换为中文
  const getPlatformName = (platform: string): string => {
    const nameMap: Record<string, string> = {
      'wechat': '微信',
      'wechat_mp': '公众号',
      'xiaohongshu': '小红书',
      'douyin': '抖音',
      'kuaishou': '快手',
      'bilibili': 'B站',
      'weibo': '微博',
      'zhihu': '知乎',
    }
    return nameMap[platform] || platform
  }

  // 根据平台返回颜色
  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      '微信': '#07C160',
      '公众号': '#07C160',
      '小红书': '#FF2442',
      '抖音': '#00F2EA',
      '微博': '#FF8200',
      '快手': '#FF4906',
      'B站': '#FB7299',
      '知乎': '#0084FF',
    }
    return colors[platform] || '#6366F1'
  }

  // 获取统计数据
  const fetchStats = async () => {
    try {
      // 调试：检查storage中的userInfo
      const storageInfo: any = await Taro.getStorageInfo()
      console.log('storage keys:', storageInfo.keys || [])
      const storedUserInfo = await Taro.getStorage({ key: 'userInfo' }).catch(() => null)
      console.log('userInfo:', storedUserInfo?.data)
      
      // 检查是否已登录
      if (!storedUserInfo?.data?.id) {
        console.log('用户未登录，静默跳转到登录页')
        Taro.navigateTo({ url: '/pages/login/index' })
        return
      }
      const userId = storedUserInfo.data.id
      console.log('用户ID:', userId)
      
      // 从用户统计接口获取所有分身的汇总数据（Network模块会自动添加userId）
      const res = await Network.request({ 
        url: '/api/user-stats/overview'
      })
      console.log('统计数据:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const statsData = res.data.data
        setMindClones(statsData.avatarCount || 0)
        setStats([
          { label: '我的分身', value: String(statsData.avatarCount || 0), unit: '个', color: '#6366F1', bg: '#EEF2FF', trend: '', path: '/pages/mind-chat/index' },
          { label: '待接订单', value: String(statsData.pendingOrders || 0), unit: '单', color: '#F59E0B', bg: '#FFFBEB', trend: '', path: '/pages/pending-order/index' },
          { label: '生成内容', value: String(statsData.generatedContents || 0), unit: '篇', color: '#10B981', bg: '#ECFDF5', trend: '', path: '/pages/generated-content/index' },
          { label: '累计收益', value: String(statsData.totalEarnings || 0), unit: '元', color: '#EC4899', bg: '#FDF2F8', trend: '', path: '/pages/earning-center/index' },
        ])
      }
    } catch (err) {
      console.error('获取统计数据失败:', err)
    }
  }

  // 实时动态
  const [activities, setActivities] = useState<any[]>([])

  // 获取实时动态
  const fetchActivities = async () => {
    try {
      const res = await Network.request({ url: '/api/activities/recent' })
      console.log('实时动态:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        // 将API数据转换为组件期望的格式
        const mappedActivities = res.data.data.map((item: any, index: number) => {
          // 根据type映射图标
          let ActivityIcon = Coins
          let activityAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user' + index
          if (item.type === 'chat') {
            ActivityIcon = Users
          } else if (item.type === 'content') {
            ActivityIcon = FileText
          } else if (item.type === 'order') {
            ActivityIcon = ShoppingBag
          } else if (item.type === 'earning') {
            ActivityIcon = Coins
          }
          
          // 计算相对时间
          const timeAgo = getTimeAgo(item.timestamp)
          
          return {
            name: item.title,
            action: item.type === 'earning' ? '收益到账' : item.type === 'chat' ? '对话' : item.type === 'content' ? '内容' : '订单',
            desc: item.description,
            icon: ActivityIcon,
            avatar: activityAvatar,
            time: timeAgo,
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
  
  // 计算相对时间
  const getTimeAgo = (timestamp: string): string => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 60) return diffMins + '分钟前'
    if (diffHours < 24) return diffHours + '小时前'
    return diffDays + '天前'
  }

  useEffect(() => {
    // 初始化加载数据 - 不阻塞页面渲染
    loadUserFromStorage().then(() => {
      fetchStats()
      fetchActivities()
      fetchOrderNotifications()
    }).catch(err => {
      console.error('初始化数据加载失败:', err)
    })
  }, [])

  // 页面重新显示时刷新数据（如从登录页返回）
  useDidShow(() => {
    loadUserFromStorage().then(() => {
      fetchStats()
      fetchActivities()
      fetchOrderNotifications()
    }).catch(err => {
      console.error('刷新数据失败:', err)
    })
  })

  // 快捷功能
  const quickActions = [
    { label: '创建分身', icon: Plus, color: '#6366F1', bg: 'linear-gradient(135deg, #EEF2FF 0%, #C7D2FE 100%)', path: '/pages/avatar/avatar-create/index' },
    { label: '订单广场', icon: Grid2x2, color: '#F97316', bg: 'linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%)', path: '/pages/order/order-square/index' },
    { label: '我要发单', icon: Send, color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)', path: '/pages/order/order-create/index' },
    { label: '技能中心', icon: Rocket, color: '#0EA5E9', bg: 'linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 100%)', path: '/pages/skills-square/index' },
    { label: '素材库', icon: Library, color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)', path: '/pages/avatar/avatar-manage/index' },
    { label: '自动分发', icon: Share2, color: '#EC4899', bg: 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 100%)', path: '/pages/order/order-create/index' },
  ]

  // 从API获取实时动态

  // 订单通知数据 - 已改为从API获取

  // 复制活动数据用于无缝滚动
  const allActivities = [...activities, ...activities]

  // 自动滚动效果 - 从右到左
  useEffect(() => {
    const cardWidth = 280 // 每个卡片宽度 + 间距
    const totalWidth = activities.length * cardWidth
    
    const timer = setInterval(() => {
      scrollRef.current -= 1
      setTranslateX(scrollRef.current)
      
      // 当滚动到一半时，重置位置实现无缝循环
      if (Math.abs(scrollRef.current) >= totalWidth) {
        scrollRef.current = 0
        setTranslateX(0)
      }
    }, 30)

    return () => clearInterval(timer)
  }, [activities.length])

  const goToPage = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  // 处理订单弹窗 - 先接受订单再跳转到内容生成页面
  const handleOrderAccept = async () => {
    if (orderModalData?.id) {
      try {
        // 获取当前分身ID，如果没有则查询用户的第一个分身
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
            console.log('[接单] 自动选择分身:', avatarIdToUse)
          } else {
            Taro.showToast({ title: '请先创建分身', icon: 'none' })
            return
          }
        }

        // 先调用接受订单接口
        const res = await Network.request({
          url: `/api/order-dispatch/avatar/${avatarIdToUse}/accept/${orderModalData.id}`,
          method: 'POST'
        })
        if (res.data?.code === 200) {
          setShowOrderModal(false)
          Taro.navigateTo({ url: `/pages/order/order-content-creation/index?orderId=${orderModalData.id}` })
        } else {
          Taro.showToast({ title: res.data?.message || '接单失败', icon: 'none' })
        }
      } catch (err) {
        console.error('接受订单失败:', err)
        Taro.showToast({ title: '接单失败，请重试', icon: 'none' })
      }
    }
  }

  const handleOrderDismiss = () => {
    setShowOrderModal(false)
  }

  // 一键开启所有分身托管
  const enableAllTrust = async () => {
    try {
      const res = await Network.request({
        url: '/api/avatar/trust/all',
        method: 'PUT',
        data: { trust_enabled: true }
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已开启所有分身托管', icon: 'success' })
        fetchStats() // 刷新统计数据
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
        <View className="header-content">
          <View className="header-left">
            <View className="avatar-wrapper">
              <Image className="avatar" src={avatar} />
              <View className="online-dot" />
            </View>
            <View className="header-info">
              <Text className="nickname">早安，{userName}</Text>
              <View className="subtitle-wrapper">
                <View className="subtitle-dot" />
                <Text className="subtitle">
                  {mindClones > 0 ? '分身已工作 4.5 小时' : '快创建你的第一个分身'}
                </Text>
              </View>
            </View>
          </View>
          <View className="header-right">
            <View className="icon-btn" onClick={() => Taro.navigateTo({ url: '/pages/notification/index' })}>
              <Bell size={44} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View className="notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </View>
              )}
            </View>
            <View className="icon-btn">
              <Settings size={44} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>

      {/* 主内容区 */}
      <ScrollView scrollY className="content" enhanced showScrollbar={false}>
        {/* 统计卡片区 - 4个一行 */}
        <View className="stats-section">
          <View className="stats-row">
            {stats.map((stat, idx) => (
              <View key={stat.label} className="stat-item" style={{ animationDelay: `${idx * 0.1}s` }} onClick={() => goToPage(stat.path)}>
                <View className="stat-icon-small" style={{ background: stat.bg }}>
                  {stat.label === '我的分身' && <Users size={28} color={stat.color} />}
                  {stat.label === '待接订单' && <ShoppingBag size={28} color={stat.color} />}
                  {stat.label === '生成内容' && <FileText size={28} color={stat.color} />}
                  {stat.label === '累计收益' && <Coins size={28} color={stat.color} />}
                </View>
                <Text className="stat-value-small" style={{ color: stat.color }}>{stat.value}{stat.unit}</Text>
                <Text className="stat-label-small">{stat.label}</Text>
                <Text className="stat-trend-small" style={{ color: stat.color }}>{stat.trend}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 推广Banner - 根据是否有分身显示不同内容 */}
        <View
          className="banner"
          onClick={() => {
            if (mindClones > 0) {
              enableAllTrust()
            } else {
              goToPage('/pages/avatar/avatar-create/index')
            }
          }}
        >
          <View className="banner-bg" />
          <View className="banner-content">
            {mindClones > 0 ? (
              // 有分身 - 显示托管收益翻倍
              <>
                <Text className="banner-title">分身托管收益翻倍</Text>
                <Text className="banner-desc">开启 AI 自动抢单，不错过任何业务</Text>
                <View className="banner-btn">
                  <Text className="banner-btn-text">立即开启</Text>
                  <ChevronRight size={24} color="#6366F1" />
                </View>
              </>
            ) : (
              // 无分身 - 显示创建分身
              <>
                <Text className="banner-title">创建你的第一个分身</Text>
                <Text className="banner-desc">AI智能分身，自动接单赚收益</Text>
                <View className="banner-btn create">
                  <Plus size={28} color="#6366F1" />
                  <Text className="banner-btn-text create">立即创建</Text>
                </View>
              </>
            )}
          </View>
          <View className="banner-decoration">
            <View className="deco-circle circle-1" />
            <View className="deco-circle circle-2" />
            <Rocket size={100} color="rgba(255,255,255,0.15)" />
          </View>
        </View>

        {/* 快捷功能 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">快捷功能</Text>
            <View className="section-more">
              <Text className="section-more-text">全部功能</Text>
              <ChevronRight size={24} color="#9CA3AF" />
            </View>
          </View>
          <View className="quick-grid">
            {quickActions.map((action, idx) => (
              <View 
                key={action.label} 
                className="quick-item" 
                onClick={() => goToPage(action.path)}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <View className="quick-icon" style={{ background: action.bg }}>
                  <action.icon size={40} color={action.color} />
                </View>
                <Text className="quick-label">{action.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 实时动态 - 从右到左自动滚动轮播 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">实时动态</Text>
            </View>
            <View className="live-indicator">
              <View className="live-dot" />
              <Text className="live-text">LIVE</Text>
            </View>
          </View>
          
          {/* 自动滚动容器 */}
          <View className="activity-carousel-container">
            {/* 左渐变遮罩 */}
            <View className="carousel-gradient carousel-gradient-left" />
            {/* 右渐变遮罩 */}
            <View className="carousel-gradient carousel-gradient-right" />
            
            {/* 滚动内容 - 从右到左滚动 */}
            <View 
              className="activity-carousel-track"
              style={{ transform: `translateX(${translateX}rpx)` }}
            >
              {allActivities.map((item, index) => (
                <View key={`${item.name}-${index}`} className="activity-card">
                  <View className="activity-card-header">
                    <Image className="activity-avatar" src={item.avatar} />
                    <View className="activity-time-badge">{item.time}</View>
                  </View>
                  <View className="activity-icon-wrapper" style={{ background: item.type === 'coin' ? '#ECFDF5' : item.type === 'order' ? '#EEF2FF' : '#F5F3FF' }}>
                    <item.icon size={28} color={item.type === 'coin' ? '#10B981' : item.type === 'order' ? '#6366F1' : '#8B5CF6'} />
                  </View>
                  <View className="activity-card-content">
                    <Text className="activity-name">{item.name}</Text>
                    <Text className="activity-action">{item.action}</Text>
                    <Text className="activity-desc">{item.desc}</Text>
                    {item.amount && (
                      <Text className="activity-amount" style={{ color: item.type === 'coin' ? '#10B981' : '#6366F1' }}>
                        {item.amount}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
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
