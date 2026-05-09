import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { 
  Users, 
  ShoppingBag, 
  FileText, 
  Coins, 
  LayoutGrid, 
  Cpu, 
  Rocket, 
  Library, 
  Share2,
  ChevronRight,
  Zap,
  Bell,
  Settings,
  Sparkles,
  Grid3x3,
  User
} from 'lucide-react-taro'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import './index.css'

const Index: React.FC = () => {
  const navigateTo = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  const stats = [
    { label: '我的分身', value: '3', unit: '个', icon: Users, bgColor: 'blue', change: '+12%' },
    { label: '待接订单', value: '12', unit: '单', icon: ShoppingBag, bgColor: 'amber', change: '+5%' },
    { label: '生成内容', value: '158', unit: '篇', icon: FileText, bgColor: 'emerald', change: '+8%' },
    { label: '累计收益', value: '2.4', unit: 'k', icon: Coins, bgColor: 'rose', change: '+15%' },
  ];

  const quickActions = [
    { label: '创建分身', icon: Sparkles, path: '/pages/avatar/avatar-create/index', bgColor: 'indigo' },
    { label: '订单广场', icon: LayoutGrid, path: '/pages/orders/index', bgColor: 'orange' },
    { label: 'AI做内容', icon: Cpu, path: '/pages/ai-content/index', bgColor: 'violet' },
    { label: '技能中心', icon: Rocket, path: '/pages/skills-square/index', bgColor: 'sky' },
    { label: '素材库', icon: Library, path: '/pages/assets/index', bgColor: 'emerald' },
    { label: '自动分发', icon: Share2, path: '/pages/distribution/index', bgColor: 'pink' },
  ];

  const getBgClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-50',
      amber: 'bg-amber-50',
      emerald: 'bg-emerald-50',
      rose: 'bg-rose-50',
      indigo: 'bg-indigo-500',
      orange: 'bg-orange-400',
      violet: 'bg-violet-500',
      sky: 'bg-sky-500',
      pink: 'bg-pink-500',
    }
    return colorMap[color] || 'bg-gray-50'
  }

  const getIconColor = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: '#2563EB',
      amber: '#D97706',
      emerald: '#059669',
      rose: '#E11D48',
    }
    return colorMap[color] || '#6B7280'
  }

  const renderStatIcon = (icon: any, color: string) => {
    const IconComponent = icon
    return (
      <View className={`stat-icon-wrapper ${getBgClass(color)}`}>
        <IconComponent size={20} color={getIconColor(color)} />
      </View>
    )
  }

  const renderActionIcon = (icon: any, bgColor: string) => {
    const IconComponent = icon
    return (
      <View className={`action-icon-wrapper ${getBgClass(bgColor)}`}>
        <IconComponent size={28} color="#fff" strokeWidth={2.5} />
      </View>
    )
  }

  return (
    <View className="page-container">
      {/* 顶部通栏 */}
      <View className="header-bar">
        <View className="header-left">
          <View className="user-avatar-wrapper">
            <Image 
              className="user-avatar" 
              src="https://via.placeholder.com/72/7B3FE4/ffffff?text=User" 
              mode="aspectFill"
            />
            <View className="online-indicator"></View>
          </View>
          <View className="user-info">
            <Text className="username">张小明</Text>
            <View className="status-badge">
              <View className="status-dot"></View>
              <Text className="status-text">在线</Text>
            </View>
          </View>
        </View>
        <View className="header-right">
          <View className="icon-btn" onClick={() => navigateTo('/pages/notifications/index')}>
            <Bell size={24} color="#fff" />
          </View>
          <View className="icon-btn" onClick={() => navigateTo('/pages/settings/index')}>
            <Settings size={24} color="#fff" />
          </View>
        </View>
      </View>

      {/* 主内容区 */}
      <ScrollView 
        className="main-content"
        scrollY
        enableBackToTop
      >
        <View className="content-inner">
          {/* 欢迎语 */}
          <View className="welcome-section">
            <Text className="welcome-title">早安，张小明</Text>
            <Text className="welcome-hint">今天你的分身已经为你工作了 4.5 小时</Text>
          </View>

          {/* 统计卡片 - 4宫格 */}
          <View className="stats-grid">
            {stats.map((stat) => (
              <View key={stat.label} className="stat-card">
                <Card className="stat-card-inner">
                  <CardContent className="stat-card-content">
                    {renderStatIcon(stat.icon, stat.bgColor)}
                    <View className="stat-info">
                      <Text className="stat-label">{stat.label}</Text>
                      <View className="stat-value-row">
                        <Text className="stat-value">{stat.value}</Text>
                        <Text className="stat-unit">{stat.unit}</Text>
                      </View>
                      <Text className="stat-change">{stat.change} ↑</Text>
                    </View>
                  </CardContent>
                </Card>
              </View>
            ))}
          </View>

          {/* 推广Banner */}
          <View className="promo-banner">
            <View className="promo-content">
              <Text className="promo-title">分身托管收益翻倍</Text>
              <Text className="promo-desc">开启 AI 自动抢单，不错过任何业务</Text>
              <Button 
                size="sm" 
                className="promo-btn"
                onClick={() => navigateTo('/pages/hosting/index')}
              >
                立即开启
              </Button>
            </View>
            <Zap className="promo-icon" size={80} color="rgba(255,255,255,0.1)" />
          </View>

          {/* 快捷功能 - 6宫格 */}
          <View className="quick-actions-section">
            <View className="section-header">
              <Text className="section-title">快捷功能</Text>
              <View className="view-all" onClick={() => navigateTo('/pages/all-services/index')}>
                <Text className="view-all-text">全部功能</Text>
                <ChevronRight size={12} color="#9CA3AF" />
              </View>
            </View>
            <View className="quick-actions-grid">
              {quickActions.map((action) => (
                <View 
                  key={action.label} 
                  className="action-item"
                  onClick={() => navigateTo(action.path)}
                >
                  {renderActionIcon(action.icon, action.bgColor)}
                  <Text className="action-label">{action.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 实时动态 */}
          <View className="activity-section">
            <View className="activity-header">
              <View className="activity-indicator"></View>
              <Text className="activity-title">实时动态</Text>
            </View>
            <View className="activity-list">
              {[1, 2].map((i) => (
                <View key={i} className="activity-item">
                  <View className="activity-avatar-placeholder"></View>
                  <View className="activity-content">
                    <View className="activity-title-placeholder"></View>
                    <View className="activity-desc-placeholder"></View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部TabBar */}
      <View className="custom-tabbar">
        <View 
          className="tabbar-item active"
          onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
        >
          <Grid3x3 size={24} color="#7B3FE4" />
          <Text className="tabbar-text active">首页</Text>
        </View>
        <View 
          className="tabbar-item"
          onClick={() => Taro.switchTab({ url: '/pages/social/index' })}
        >
          <Users size={24} color="#9CA3AF" />
          <Text className="tabbar-text">广场</Text>
        </View>
        <View className="tabbar-item center">
          <View className="tabbar-center-btn">
            <Sparkles size={32} color="#fff" />
          </View>
        </View>
        <View 
          className="tabbar-item"
          onClick={() => Taro.switchTab({ url: '/pages/mind-chat/index' })}
        >
          <User size={24} color="#9CA3AF" />
          <Text className="tabbar-text">分身</Text>
        </View>
        <View 
          className="tabbar-item"
          onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
        >
          <User size={24} color="#9CA3AF" />
          <Text className="tabbar-text">我的</Text>
        </View>
      </View>
    </View>
  )
}

export default Index
