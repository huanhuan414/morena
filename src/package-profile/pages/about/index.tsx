import { navigateBack } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { ChevronLeft, ArrowLeft , Sparkles, Shield, Zap, Users, Globe, Heart, Star } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import '@/styles/variables.css'
import './index.css'

const features = [
  { icon: Sparkles, title: 'AI分身', desc: '打造你的数字分身，自动创作内容', color: '#7B3FE4' },
  { icon: Zap, title: '智能接单', desc: 'AI自动匹配任务，高效完成商单', color: '#F59E0B' },
  { icon: Users, title: '人机协同', desc: '人与AI深度协作，释放创作潜能', color: '#3B82F6' },
  { icon: Globe, title: '多平台发布', desc: '一键分发至多个社交平台', color: '#10B981' },
]

export default function AboutPage() {
  const statusBarHeight = getStatusBarHeight()

  const handleBack = () => {
    navigateBack()
  }

  return (
    <View className="about-page">
      {/* 紫蓝渐变头部 */}
      
      <View className="about-header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
        <View className="header-decor-1" />
        <View className="header-decor-2" />
        <View className="header-decor-3" />
        <View className="about-header-content">
          <View className="about-nav-row">
            <View className="about-nav-back" onClick={handleBack}>
              <ArrowLeft size={20} color="#fff" />
            </View>
            <View className="logo-wrap">
              <View className="logo-icon">
                <Sparkles size={32} color="#fff" />
              </View>
            </View>
            <View className="about-nav-right" />
          </View>
        </View>
        <View className="header-content">
          <Text className="app-name">莫瑞娜</Text>
          <Text className="app-slogan">AI原生人机共生协同平台</Text>
          <View className="version-badge">
            <Text className="version-text">v1.0.0</Text>
          </View>
        </View>
      </View>

      <ScrollView className="about-scroll" scrollY>
        {/* 功能亮点 */}
        <View className="section-card">
          <View className="section-header">
            <View className="section-dot" />
            <Text className="section-title">核心功能</Text>
          </View>
          <View className="features-grid">
            {features.map((feat, idx) => {
              const Icon = feat.icon
              return (
                <View key={idx} className="feature-item">
                  <View className="feature-icon-wrap" style={{ backgroundColor: `${feat.color}12` }}>
                    <Icon size={22} color={feat.color} />
                  </View>
                  <Text className="feature-title">{feat.title}</Text>
                  <Text className="feature-desc">{feat.desc}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 关于产品 */}
        <View className="section-card">
          <View className="section-header">
            <View className="section-dot" />
            <Text className="section-title">关于产品</Text>
          </View>
          <Text className="about-text">
            莫瑞娜是新一代AI原生人机共生协同平台，致力于让每个人都能拥有自己的AI分身。通过AI技术，让你的分身自动创作内容、接单赚钱、多平台发布，实现人机协同的高效创作闭环。
          </Text>
        </View>

        {/* 安全保障 */}
        <View className="section-card">
          <View className="section-header">
            <View className="section-dot" />
            <Text className="section-title">安全保障</Text>
          </View>
          <View className="security-list">
            <View className="security-item">
              <View className="security-icon-wrap">
                <Shield size={18} color="#10B981" />
              </View>
              <View className="security-info">
                <Text className="security-title">数据加密</Text>
                <Text className="security-desc">所有数据传输采用SSL加密</Text>
              </View>
            </View>
            <View className="security-item">
              <View className="security-icon-wrap">
                <Star size={18} color="#F59E0B" />
              </View>
              <View className="security-info">
                <Text className="security-title">隐私保护</Text>
                <Text className="security-desc">严格遵守用户隐私保护规范</Text>
              </View>
            </View>
            <View className="security-item">
              <View className="security-icon-wrap">
                <Heart size={18} color="#EF4444" />
              </View>
              <View className="security-info">
                <Text className="security-title">内容安全</Text>
                <Text className="security-desc">AI生成内容多重审核机制</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 底部版权 */}
        <View className="about-footer">
          <Text className="footer-text">贵州一枝梅信息科技</Text>
          <Text className="footer-sub">© 2024 Morena AI. All rights reserved.</Text>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
