import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import {
  Users,
  ShoppingBag,
  FileText,
  Coins,
  Plus,
  Grid2x2,
  Cpu,
  Rocket,
  Library,
  Share2,
  ChevronRight,
  Zap,
  Bell,
  Settings,
  MessageCircle,
  ShoppingCart,
} from 'lucide-react-taro'

import './index.css'

// 用户数据
const userData = {
  nickname: '张小明',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar1',
  isOnline: true,
}

// 统计数据
const stats = [
  { label: '我的分身', value: '3', icon: Users, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  { label: '待接订单', value: '12', icon: ShoppingBag, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { label: '生成内容', value: '158', icon: FileText, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  { label: '累计收益', value: '2.4k', icon: Coins, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
]

// 快捷功能
const quickActions = [
  { label: '创建分身', icon: Plus, bg: 'rgba(99,102,241,0.15)', color: '#6366F1' },
  { label: '订单广场', icon: Grid2x2, bg: 'rgba(251,146,60,0.15)', color: '#FB923C' },
  { label: 'AI做内容', icon: Cpu, bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' },
  { label: '技能中心', icon: Rocket, bg: 'rgba(14,165,233,0.15)', color: '#0EA5E9' },
  { label: '素材库', icon: Library, bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
  { label: '自动分发', icon: Share2, bg: 'rgba(236,72,153,0.15)', color: '#EC4899' },
]

// 实时动态
const liveActivities = [
  { id: 1, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s1', name: '知识博主小美', type: 'order', title: '新订单接单成功', desc: '成功接单，获得收益', amount: '¥28.00', time: '刚刚' },
  { id: 2, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s2', name: '职场达人小明', type: 'earning', title: '收益到账提醒', desc: '内容分发完成，收益+', amount: '¥15.50', time: '2分钟前' },
  { id: 3, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s3', name: '泛娱乐小红', type: 'pending', title: '待处理订单', desc: '有新订单等待确认，金额', amount: '¥35.00', time: '5分钟前' },
  { id: 4, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s4', name: '生活博主小雪', type: 'content', title: '内容生成完成', desc: 'AI自动生成2篇种草笔记', amount: '', time: '8分钟前' },
]

const Index: React.FC = () => {
  const scrollRef = useRef<any>(null)
  const [scrollX, setScrollX] = useState(0)
  

  // 页面跳转
  const goToPage = (url: string) => {
    if (url.startsWith('/pages')) {
      Taro.switchTab({ url }).catch(() => {
        Taro.navigateTo({ url })
      })
    } else {
      Taro.navigateTo({ url })
    }
  }

  // 从右到左自动滚动
  useEffect(() => {
    // 等待DOM渲染完成后开始滚动
    setTimeout(() => {
      // 卡片宽度 280, 间距 20
      // 用于循环滚动计算
      
    }, 100)

    const interval = setInterval(() => {
      setScrollX(prev => {
        const maxScroll = (280 + 20) * liveActivities.length
        if (prev >= maxScroll) {
          return 0
        }
        return prev + 1
      })
    }, 30)

    return () => clearInterval(interval)
  }, [])

  // 获取动态图标
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={24} color="#F59E0B" />
      case 'earning': return <Coins size={24} color="#10B981" />
      case 'pending': return <ShoppingCart size={24} color="#EF4444" />
      case 'content': return <FileText size={24} color="#8B5CF6" />
      default: return <MessageCircle size={24} color="#6366F1" />
    }
  }

  return (
    <View className="index-page">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-left">
          <View className="avatar-wrapper">
            <Image
              className="avatar-img"
              src={userData.avatar}
              mode="aspectFill"
            />
            <View className={`online-dot ${userData.isOnline ? 'online' : ''}`} />
          </View>
          <View className="user-info">
            <Text className="user-name">早安，{userData.nickname}</Text>
            <View className="user-status">
              <View className="status-dot" />
              <Text className="status-text">在线</Text>
            </View>
          </View>
        </View>
        <View className="header-right">
          <View className="action-btn">
            <Bell size={22} color="#9CA3AF" />
          </View>
          <View className="action-btn">
            <Settings size={22} color="#9CA3AF" />
          </View>
        </View>
      </View>

      <ScrollView scrollY className="main-content" enhanced >
        <View className="page-content">
          {/* 统计卡片 */}
          <View className="stats-grid">
            {stats.map((stat, idx) => (
              <View key={idx} className="stat-card">
                <View className="stat-icon" style={{ background: stat.bg }}>
                  <stat.icon size={22} color={stat.color} />
                </View>
                <View className="stat-info">
                  <Text className="stat-value">{stat.value}</Text>
                  <Text className="stat-label">{stat.label}</Text>
                </View>
                <View className="stat-trend">
                  <Text className="trend-text">+12%</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 推广Banner */}
          <View className="banner" onClick={() => goToPage('/pages/avatar/create/index')}>
            <View className="banner-bg" />
            <View className="banner-content">
              <View className="banner-badge">
                <Zap size={20} color="#FBBF24" />
                <Text className="banner-badge-text">限时活动</Text>
              </View>
              <Text className="banner-title">分身托管收益翻倍</Text>
              <Text className="banner-desc">开启 AI 自动抢单，不错过任何业务</Text>
              <View className="banner-btn">
                <Text className="banner-btn-text">立即开启</Text>
                <ChevronRight size={20} color="#6366F1" />
              </View>
            </View>
            <View className="banner-decoration">
              <View className="deco-circle circle-1" />
              <View className="deco-circle circle-2" />
              <View className="banner-rocket"><Rocket size={80} color="rgba(255,255,255,0.15)" /></View>
            </View>
          </View>

          {/* 快捷功能 */}
          <View className="section">
            <View className="section-header">
              <Text className="section-title">快捷功能</Text>
              <View className="section-more">
                <Text className="section-more-text">全部功能</Text>
                <ChevronRight size={18} color="#9CA3AF" />
              </View>
            </View>
            <View className="quick-grid">
              {quickActions.map((action, idx) => (
                <View 
                  key={idx}
                  className="quick-item" 
                  onClick={() => goToPage('/pages/avatar/create/index')}
                >
                  <View className="quick-icon" style={{ background: action.bg }}>
                    <action.icon size={28} color={action.color} />
                  </View>
                  <Text className="quick-label">{action.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 实时动态 */}
          <View className="section">
            <View className="section-header">
              <View className="live-indicator">
                <View className="live-dot" />
                <Text className="section-title">实时动态</Text>
              </View>
              <Text className="section-more-text">更多</Text>
            </View>
            <View className="live-scroll-wrapper">
              <View 
                className="live-scroll" 
                ref={scrollRef}
                style={{ transform: `translateX(${-scrollX}px)` }}
              >
                {[...liveActivities, ...liveActivities].map((activity, idx) => (
                  <View key={`${activity.id}-${idx}`} className="live-card">
                    <View className="live-card-header">
                      <Image
                        className="live-avatar"
                        src={activity.avatar}
                        mode="aspectFill"
                      />
                      <View className="live-meta">
                        <Text className="live-name">{activity.name}</Text>
                        <Text className="live-time">{activity.time}</Text>
                      </View>
                      <View className="live-icon-wrap">
                        {getActivityIcon(activity.type)}
                      </View>
                    </View>
                    <Text className="live-title">{activity.title}</Text>
                    <Text className="live-desc">
                      {activity.desc}
                      {activity.amount && (
                        <Text className="live-amount">{activity.amount}</Text>
                      )}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="scroll-gradient-left" />
              <View className="scroll-gradient-right" />
            </View>
          </View>
        </View>
        <View className="bottom-safe" />
      </ScrollView>
    </View>
  )
}

export default Index
