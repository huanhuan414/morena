import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Bell, Settings, Users, ShoppingBag, FileText, Coins, Plus, Grid2x2, Cpu, Rocket, Library, Share2, ChevronRight, Zap } from 'lucide-react-taro'
import './index.css'

const Index: React.FC = () => {
  const [userName] = useState('张小明')
  const [avatar] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang')

  const stats = [
    { label: '我的分身', value: '3', unit: '个', color: '#6366F1', bg: '#EEF2FF', trend: '+1' },
    { label: '待接订单', value: '12', unit: '单', color: '#F59E0B', bg: '#FFFBEB', trend: '+5' },
    { label: '生成内容', value: '158', unit: '篇', color: '#10B981', bg: '#ECFDF5', trend: '+8' },
    { label: '累计收益', value: '2.4', unit: 'k', color: '#EC4899', bg: '#FDF2F8', trend: '+15%' },
  ]

  const quickActions = [
    { label: '创建分身', icon: Plus, color: '#6366F1', bg: '#EEF2FF' },
    { label: '订单广场', icon: Grid2x2, color: '#F97316', bg: '#FFF7ED' },
    { label: 'AI做内容', icon: Cpu, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: '技能中心', icon: Rocket, color: '#0EA5E9', bg: '#F0F9FF' },
    { label: '素材库', icon: Library, color: '#10B981', bg: '#ECFDF5' },
    { label: '自动分发', icon: Share2, color: '#EC4899', bg: '#FDF2F8' },
  ]

  const activities = [
    { type: 'order', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=a1', name: '小美', action: '新订单接单', amount: '+¥28' },
    { type: 'coin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=a2', name: '小明', action: '收益到账', amount: '+¥15' },
    { type: 'order', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=a3', name: '小红', action: '待处理订单', amount: '¥35' },
    { type: 'file', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=a4', name: 'AI', action: '内容生成完成', amount: '' },
  ]

  const goToPage = (path: string) => {
    Taro.navigateTo({ url: path })
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
              <Text className="subtitle">分身已工作 4.5 小时</Text>
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
            {stats.map((stat) => (
              <View key={stat.label} className="stat-item">
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

        {/* 推广Banner */}
        <View className="banner" onClick={() => goToPage('/pages/avatar/create/index')}>
          <View className="banner-bg" />
          <View className="banner-content">
            <View className="banner-badge">
              <Zap size={24} color="#FBBF24" />
              <Text className="banner-badge-text">限时活动</Text>
            </View>
            <Text className="banner-title">分身托管收益翻倍</Text>
            <Text className="banner-desc">开启 AI 自动抢单</Text>
          </View>
          <View className="banner-decoration">
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
            {quickActions.map((action) => (
              <View 
                key={action.label} 
                className="quick-item" 
                onClick={() => goToPage('/pages/avatar/create/index')}
              >
                <View className="quick-icon" style={{ background: action.bg }}>
                  <action.icon size={40} color={action.color} />
                </View>
                <Text className="quick-label">{action.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 实时动态 */}
        <View className="section">
          <View className="section-header">
            <View className="live-indicator" />
            <Text className="section-title">实时动态</Text>
          </View>
          <View className="activities-scroll">
            {activities.map((item, idx) => (
              <View key={idx} className="activity-card">
                <Image className="activity-avatar" src={item.avatar} />
                <View className="activity-content">
                  <Text className="activity-name">{item.name}</Text>
                  <Text className="activity-action">{item.action}</Text>
                </View>
                {item.amount && <Text className="activity-amount">{item.amount}</Text>}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default Index
