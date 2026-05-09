import React, { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, ShoppingBag, FileText, Coins, Plus, Grid2x2, Cpu, Rocket, Library, Share2, ChevronRight, TrendingUp, Sparkles } from 'lucide-react-taro'
import './index.css'

const Index: React.FC = () => {
  const [userName] = useState('张小明')
  const [avatar] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang')
  const [translateX, setTranslateX] = useState(0)
  const [mindClones] = useState(0) // 分身数量，0表示没有分身
  const [showOrderModal, setShowOrderModal] = useState(false) // 订单弹窗
  const [orderModalData, setOrderModalData] = useState<any>(null) // 订单数据
  const scrollRef = useRef(0)

  // 统计数据
  const stats = [
    { label: '我的分身', value: mindClones.toString(), unit: '个', color: '#6366F1', bg: '#EEF2FF', trend: '+1 本月', path: '/pages/mind-chat/index' },
    { label: '待接订单', value: '12', unit: '单', color: '#F59E0B', bg: '#FFFBEB', trend: '+5 今日', path: '/pages/pending-order/index' },
    { label: '生成内容', value: '158', unit: '篇', color: '#10B981', bg: '#ECFDF5', trend: '+8 本周', path: '/pages/generated-content/index' },
    { label: '累计收益', value: '2.4', unit: 'k', color: '#EC4899', bg: '#FDF2F8', trend: '+15.8%', path: '/pages/earning-center/index' },
  ]

  // 快捷功能
  const quickActions = [
    { label: '创建分身', icon: Plus, color: '#6366F1', bg: 'linear-gradient(135deg, #EEF2FF 0%, #C7D2FE 100%)', path: '/pages/avatar/avatar-create/index' },
    { label: '订单广场', icon: Grid2x2, color: '#F97316', bg: 'linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%)', path: '/pages/order/order-square/index' },
    { label: 'AI做内容', icon: Cpu, color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)', path: '/pages/generated-content/index' },
    { label: '技能中心', icon: Rocket, color: '#0EA5E9', bg: 'linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 100%)', path: '/pages/skills-square/index' },
    { label: '素材库', icon: Library, color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)', path: '/pages/avatar/avatar-manage/index' },
    { label: '自动分发', icon: Share2, color: '#EC4899', bg: 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 100%)', path: '/pages/order/order-create/index' },
  ]

  // 实时动态
  const activities = [
    { type: 'order', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar1', name: '知识博主小美', action: '新订单接单成功', desc: '成功接单，获得收益', amount: '+¥28.00', time: '刚刚', icon: ShoppingBag },
    { type: 'coin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar2', name: '职场达人小明', action: '收益到账提醒', desc: '完成内容分发，收益', amount: '+¥15.50', time: '5分钟前', icon: Coins },
    { type: 'clock', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar3', name: '泛娱乐小红', action: '待处理订单', desc: '有新订单等待确认，金额', amount: '¥35.00', time: '10分钟前', icon: FileText },
    { type: 'file', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar4', name: 'AI自动', action: '内容生成完成', desc: '已自动生成2篇种草笔记', amount: '', time: '15分钟前', icon: Cpu },
    { type: 'trending', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar5', name: '生活博主大白', action: '粉丝突破1000', desc: '恭喜！本月新增粉丝', amount: '+328', time: '30分钟前', icon: TrendingUp },
  ]

  // 订单通知数据
  const orderNotifications = [
    { id: 1, platform: '小红书', platformColor: '#FF2442', title: '美妆种草笔记', budget: '¥150-200', deadline: '剩余2小时', desc: '需要突出产品功效，配图3张以上' },
    { id: 2, platform: '抖音', platformColor: '#00F2EA', title: '探店视频脚本', budget: '¥80-120', deadline: '剩余5小时', desc: '脚本时长1-2分钟，需包含热门元素' },
  ]

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

  // 模拟收到订单通知
  useEffect(() => {
    // 3秒后显示订单弹窗（演示用）
    const timer = setTimeout(() => {
      if (mindClones > 0) {
        setOrderModalData(orderNotifications[0])
        setShowOrderModal(true)
      }
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [mindClones])

  const goToPage = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  // 处理订单弹窗
  const handleOrderAccept = () => {
    setShowOrderModal(false)
    Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })
  }

  const handleOrderDismiss = () => {
    setShowOrderModal(false)
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
            <View className="icon-btn">
              <Bell size={44} color="#FFFFFF" />
              <View className="notification-badge">3</View>
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

        {/* 无分身空状态提示 */}
        {mindClones === 0 && (
          <View className="empty-minds-section">
            <View className="empty-minds-card">
              <View className="empty-minds-icon">
                <Sparkles size={60} color="#6366F1" />
              </View>
              <Text className="empty-minds-title">还没有创建分身</Text>
              <Text className="empty-minds-desc">创建AI分身，让它帮你自动接单、生成内容、赚取收益</Text>
              <View className="empty-minds-btn" onClick={() => goToPage('/pages/avatar/avatar-create/index')}>
                <Plus size={32} color="#FFFFFF" />
                <Text className="empty-minds-btn-text">立即创建分身</Text>
              </View>
            </View>
          </View>
        )}

        {/* 推广Banner */}
        <View className="banner" onClick={() => goToPage('/pages/avatar/avatar-create/index')}>
          <View className="banner-bg" />
          <View className="banner-content">
            <View className="banner-top">
              <Text className="banner-title">分身托管收益翻倍</Text>
              <Text className="banner-desc">开启 AI 自动抢单，不错过任何业务</Text>
            </View>
            <View className="banner-bottom">
              <Text className="banner-btn-text">立即开启</Text>
              <ChevronRight size={24} color="#6366F1" />
            </View>
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
              <Text className="order-modal-desc">{orderModalData.desc}</Text>
              
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
    </View>
  )
}

export default Index
