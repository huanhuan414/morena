import { navigateBack } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Sparkles, Heart, Users, Zap, Shield, Star, ArrowLeft } from 'lucide-react-taro'
import './about.css'

export default function AboutPage() {
  const features = [
    { icon: Sparkles, title: 'AI分身', desc: '创建你的数字孪生' },
    { icon: Zap, title: '自动托管', desc: '让AI帮你处理日常' },
    { icon: Heart, title: '心智成长', desc: 'AI越聊越懂你' },
    { icon: Users, title: '社交互动', desc: '连接更多可能' }
  ]

  const stats = [
    { value: '170万+', label: '用户' },
    { value: '500万+', label: 'AI对话' },
    { value: '1000万+', label: '任务完成' }
  ]

  return (
    <View className="about-page">
      {/* 顶部导航 - 统一风格 */}
      <View className="about-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={36} color="#7B3FE4" />
        </View>
        <Text className="header-title">关于我们</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="about-scroll" scrollY>
        {/* Logo区域 */}
        <View className="logo-section">
          <View className="logo-wrap">
            <Sparkles size={64} color="#7B3FE4" />
          </View>
          <Text className="app-name">莫瑞娜</Text>
          <Text className="app-slogan">AI原生人机共生协同平台</Text>
          <Text className="version">v2.0.0</Text>
        </View>

        {/* 介绍 */}
        <View className="intro-section">
          <Text className="intro-text">
            莫瑞娜（原魔法画师团队）是一个AI原生人机共生平台，我们相信每个人都可以拥有一个懂自己的AI分身。
            通过先进的AI技术，让你的数字分身帮助你更好地生活、工作和社交。
          </Text>
        </View>

        {/* 数据统计 - 突出显示 */}
        <Text className="section-title">平台数据</Text>
        <View className="stats-section">
          <View className="stats-card">
            {stats.map((stat, idx) => (
              <View key={idx} className="stat-item">
                <Text className="stat-value">{stat.value}</Text>
                <Text className="stat-label">{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 核心功能 */}
        <View className="features-section">
          <Text className="section-title">核心功能</Text>
          <View className="features-grid">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <View key={idx} className="feature-item">
                  <View className="feature-icon">
                    <Icon size={28} color="#7B3FE4" />
                  </View>
                  <Text className="feature-title">{feature.title}</Text>
                  <Text className="feature-desc">{feature.desc}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 价值观 */}
        <View className="values-section">
          <Text className="section-title">我们的愿景</Text>
          <View className="values-list">
            <View className="value-item">
              <View className="value-icon">
                <Sparkles size={20} color="#7B3FE4" />
              </View>
              <Text className="value-text">利用AI留存人类智慧，让人类实现数字永生</Text>
            </View>
            <View className="value-item">
              <View className="value-icon">
                <Star size={20} color="#7B3FE4" />
              </View>
              <Text className="value-text">让AI成为每个人的得力助手</Text>
            </View>
            <View className="value-item">
              <View className="value-icon">
                <Shield size={20} color="#7B3FE4" />
              </View>
              <Text className="value-text">保护用户隐私与数据安全</Text>
            </View>
            <View className="value-item">
              <View className="value-icon">
                <Heart size={20} color="#7B3FE4" />
              </View>
              <Text className="value-text">用技术创造美好生活</Text>
            </View>
          </View>
        </View>

        {/* 版权信息 */}
        <View className="copyright-section">
          <Text className="copyright-text">© 2026 莫瑞娜科技</Text>
          <Text className="copyright-text">保留所有权利</Text>
          <View className="links">
            <Text className="link-text">用户协议</Text>
            <Text className="link-divider">|</Text>
            <Text className="link-text">隐私政策</Text>
          </View>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
