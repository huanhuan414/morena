// @ts-nocheck
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { 
  Users, ShoppingBag, FileText, Coins, Plus, Grid2x2, 
  Cpu, Rocket, Library, Share2, ChevronRight, Zap,
  Bell, Settings, Zap as CoinIcon, ShoppingBag as OrderIcon,
  FileText as ContentIcon
} from 'lucide-react-taro'
import './index.css'

// 统计数据
const stats = [
  { label: '我的分身', value: '3', unit: '个', icon: Users, color: '#3B82F6', bg: '#EFF6FF' },
  { label: '待接订单', value: '12', unit: '单', icon: ShoppingBag, color: '#F59E0B', bg: '#FFFBEB' },
  { label: '生成内容', value: '158', unit: '篇', icon: FileText, color: '#10B981', bg: '#ECFDF5' },
  { label: '累计收益', value: '2.4', unit: 'k', icon: Coins, color: '#EF4444', bg: '#FEF2F2' },
]

// 快捷功能
const quickActions = [
  { label: '创建分身', icon: Plus, color: '#7C3AED', gradient: 'from-violet-500 to-purple-600' },
  { label: '订单广场', icon: Grid2x2, color: '#F59E0B', gradient: 'from-amber-400 to-orange-500' },
  { label: 'AI做内容', icon: Cpu, color: '#8B5CF6', gradient: 'from-violet-500 to-indigo-600' },
  { label: '技能中心', icon: Rocket, color: '#06B6D4', gradient: 'from-sky-500 to-blue-600' },
  { label: '素材库', icon: Library, color: '#10B981', gradient: 'from-emerald-500 to-teal-600' },
  { label: '自动分发', icon: Share2, color: '#EC4899', gradient: 'from-pink-500 to-rose-600' },
]

// 实时动态数据
const activities = [
  { name: '知识博主小美', action: '成功接单', desc: '获得新订单', time: '刚刚', icon: OrderIcon, type: 'order', amount: '+¥28.00', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=female1' },
  { name: '职场达人小明', action: '收益到账', desc: '内容分发完成', time: '5分钟前', icon: CoinIcon, type: 'coin', amount: '+¥15.50', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=male1' },
  { name: '生活博主小雪', action: '新订单待确认', desc: '等待审核中', time: '10分钟前', icon: OrderIcon, type: 'order', amount: '¥35.00', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=female2' },
  { name: 'AI助手', action: '内容生成完成', desc: '已自动发布', time: '15分钟前', icon: ContentIcon, type: 'content', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bot' },
  { name: '泛娱乐小红', action: '收益到账', desc: '广告分成', time: '20分钟前', icon: CoinIcon, type: 'coin', amount: '+¥8.80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=female3' },
]

export default function Index() {
  // 复制数据用于无缝滚动
  const duplicatedActivities = [...activities, ...activities, ...activities]
  
  const goToPage = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  return (
    <View className="index-page">
      {/* 顶部通栏 */}
      <View className="top-bar">
        <View className="user-info">
          <Image 
            className="user-avatar" 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" 
          />
          <View className="user-status" />
          <View className="user-text">
            <Text className="user-name">张小明</Text>
            <View className="user-tag">
              <Text className="tag-text">在线</Text>
            </View>
          </View>
        </View>
        <View className="top-actions">
          <View className="action-btn">
            <Bell size={44} color="#FFFFFF" />
          </View>
          <View className="action-btn">
            <Settings size={44} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <View className="page-content">
        {/* 欢迎语 */}
        <View className="welcome-section">
          <Text className="welcome-title">早安，张小明</Text>
          <Text className="welcome-sub">今天你的分身已经为你工作了 4.5 小时</Text>
        </View>

        {/* 统计卡片 - 4个一行 */}
        <View className="stats-grid">
          {stats.map((stat, idx) => (
            <View key={stat.label} className="stat-card">
              <View className="stat-icon-bg" style={{ background: stat.bg }}>
                <stat.icon size={36} color={stat.color} />
              </View>
              <View className="stat-info">
                <Text className="stat-label">{stat.label}</Text>
                <Text className="stat-value">{stat.value}<Text className="stat-unit">{stat.unit}</Text></Text>
                <View className="stat-trend">
                  <Text className="trend-text">+12%</Text>
                </View>
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
            <View className="banner-btn-row">
              <View className="banner-btn">
                <Text className="banner-btn-text">立即开启</Text>
                <ChevronRight size={24} color="#6366F1" />
              </View>
            </View>
          </View>
          <View className="banner-decoration">
            <View className="deco-circle circle-1" />
            <View className="deco-circle circle-2" />
            <Rocket size={96} color="rgba(255,255,255,0.15)" />
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
                onClick={() => goToPage('/pages/avatar/create/index')}
              >
                <View className={`quick-icon gradient-${idx}`}>
                  <action.icon size={32} color="#FFFFFF" />
                </View>
                <Text className="quick-label">{action.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 实时动态 - 横向滚动轮播 */}
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
            <View className="activity-carousel-track">
              {duplicatedActivities.map((item, index) => (
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
      </View>

      {/* 底部占位 */}
      <View className="bottom-space" />
    </View>
  )
}
