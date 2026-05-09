import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Bell, Settings, Users, ShoppingBag, FileText, Coins, Plus, Grid2x2, Cpu, Rocket, Library, Share2 } from 'lucide-react-taro'
import './index.css'

const Index: React.FC = () => {
  const [userName] = useState('张小明')
  const [avatar] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang')

  // 统计数据
  const stats = [
    { label: '我的分身', value: '3', unit: '个', color: '#3B82F6', bg: '#EFF6FF' },
    { label: '待接订单', value: '12', unit: '单', color: '#F59E0B', bg: '#FFFBEB' },
    { label: '生成内容', value: '158', unit: '篇', color: '#10B981', bg: '#ECFDF5' },
    { label: '累计收益', value: '2.4', unit: 'k', color: '#F43F5E', bg: '#FFF1F2' },
  ]

  // 快捷功能
  const quickActions = [
    { label: '创建分身', icon: Plus, color: '#6366F1', bg: '#EEF2FF' },
    { label: '订单广场', icon: Grid2x2, color: '#F97316', bg: '#FFF7ED' },
    { label: 'AI做内容', icon: Cpu, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: '技能中心', icon: Rocket, color: '#0EA5E9', bg: '#F0F9FF' },
    { label: '素材库', icon: Library, color: '#10B981', bg: '#ECFDF5' },
    { label: '自动分发', icon: Share2, color: '#EC4899', bg: '#FDF2F8' },
  ]

  // 实时动态
  const activities = [
    { type: 'order', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar1', name: '知识博主小美', action: '新订单接单成功', desc: '成功接单，获得收益', amount: '¥28.00', time: '刚刚' },
    { type: 'coin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar2', name: '职场达人小明', action: '收益到账提醒', desc: '完成内容分发，收益', amount: '+¥15.50', time: '5分钟前' },
    { type: 'clock', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar3', name: '泛娱乐小红', action: '待处理订单', desc: '有新订单等待确认，金额', amount: '¥35.00', time: '10分钟前' },
    { type: 'file', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar4', name: 'AI自动', action: '内容生成完成', desc: '已自动生成2篇种草笔记', amount: '', time: '15分钟前' },
  ]

  const goToPage = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  return (
    <View className="index-page">
      {/* 顶部通栏 */}
      <View className="header">
        <View className="header-left">
          <Image className="avatar" src={avatar} />
          <View className="header-info">
            <Text className="nickname">早安，{userName}</Text>
            <Text className="subtitle">今天你的分身已工作 4.5 小时</Text>
          </View>
        </View>
        <View className="header-right">
          <View className="icon-btn">
            <Bell size={44} color="#FFFFFF" />
          </View>
          <View className="icon-btn">
            <Settings size={44} color="#FFFFFF" />
          </View>
        </View>
      </View>

      {/* 主内容区 */}
      <View className="content">
        {/* 统计卡片区 */}
        <View className="stats-grid">
          <View className="stats-row">
            {stats.slice(0, 2).map((stat) => (
              <View key={stat.label} className="stat-card">
                <View className="stat-icon" style={{ backgroundColor: stat.bg }}>
                  {stat.label === '我的分身' && <Users size={36} color={stat.color} />}
                  {stat.label === '待接订单' && <ShoppingBag size={36} color={stat.color} />}
                </View>
                <View className="stat-info">
                  <Text className="stat-label">{stat.label}</Text>
                  <View className="stat-value-row">
                    <Text className="stat-value" style={{ color: stat.color }}>{stat.value}</Text>
                    <Text className="stat-unit">{stat.unit}</Text>
                  </View>
                  <Text className="stat-trend">+12% ↑</Text>
                </View>
              </View>
            ))}
          </View>
          <View className="stats-row">
            {stats.slice(2, 4).map((stat) => (
              <View key={stat.label} className="stat-card">
                <View className="stat-icon" style={{ backgroundColor: stat.bg }}>
                  {stat.label === '生成内容' && <FileText size={36} color={stat.color} />}
                  {stat.label === '累计收益' && <Coins size={36} color={stat.color} />}
                </View>
                <View className="stat-info">
                  <Text className="stat-label">{stat.label}</Text>
                  <View className="stat-value-row">
                    <Text className="stat-value" style={{ color: stat.color }}>{stat.value}</Text>
                    <Text className="stat-unit">{stat.unit}</Text>
                  </View>
                  <Text className="stat-trend">+12% ↑</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 推广Banner */}
        <View className="banner">
          <View className="banner-content">
            <Text className="banner-title">分身托管收益翻倍</Text>
            <Text className="banner-desc">开启 AI 自动抢单，不错过任何业务</Text>
            <View className="banner-btn">
              <Text className="banner-btn-text">立即开启</Text>
            </View>
          </View>
          <View className="banner-icon">
            <Rocket size={120} color="#FFFFFF" />
          </View>
        </View>

        {/* 快捷功能 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">快捷功能</Text>
            <View className="section-more">
              <Text className="section-more-text">全部功能</Text>
              <View className="arrow-icon" />
            </View>
          </View>
          <View className="quick-grid">
            {quickActions.map((action) => (
              <View key={action.label} className="quick-item" onClick={() => goToPage('/pages/avatar/create/index')}>
                <View className="quick-icon" style={{ backgroundColor: action.bg }}>
                  <action.icon size={48} color={action.color} />
                </View>
                <Text className="quick-label">{action.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 实时动态 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <View className="title-dot" />
              <Text className="section-title">实时动态</Text>
            </View>
          </View>
          <View className="activity-list">
            {activities.map((item, index) => (
              <View key={index} className="activity-item">
                <Image className="activity-avatar" src={item.avatar} />
                <View className="activity-content">
                  <View className="activity-header">
                    <Text className="activity-name">{item.name}</Text>
                    <Text className="activity-time">{item.time}</Text>
                  </View>
                  <Text className="activity-action">{item.action}</Text>
                  <Text className="activity-desc">
                    {item.desc}
                    {item.amount && <Text className="activity-amount" style={{ color: item.type === 'coin' ? '#10B981' : '#F59E0B' }}> {item.amount}</Text>}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

export default Index
