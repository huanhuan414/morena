import Taro, { navigateBack, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Sparkles, Heart, Users, Zap, Shield, Star } from 'lucide-react-taro'
import './about.css'

export default function AboutPage() {
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
  })
  const features = [
    { icon: Sparkles, title: 'AI分身', desc: '创建你的数字孪生', color: '#00f5ff' },
    { icon: Zap, title: '自动托管', desc: '让AI帮你处理日常', color: '#bf00ff' },
    { icon: Heart, title: '心智成长', desc: 'AI越聊越懂你', color: '#ff6b6b' },
    { icon: Users, title: '社交互动', desc: '连接更多可能', color: '#00ff88' }
  ]

  const stats = [
    { value: '10万+', label: '用户' },
    { value: '50万+', label: 'AI对话' },
    { value: '100万+', label: '任务完成' }
  ]

  return (
    <View className="about-page">
      {/* 顶部导航 */}
      <View className="about-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">关于我们</Text>
        <View className="header-placeholder" style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      <ScrollView className="about-scroll" scrollY>
        {/* Logo区域 */}
        <View className="logo-section">
          <View className="logo-wrap">
            <Sparkles size={64} color="#00f5ff" />
          </View>
          <Text className="app-name">莫瑞娜</Text>
          <Text className="app-slogan">AI原生人机共生协同平台</Text>
          <Text className="version">v1.0.0</Text>
        </View>

        {/* 介绍 */}
        <View className="intro-section">
          <Text className="intro-text">
            莫瑞娜是一个AI原生的人机共生平台，我们相信每个人都可以拥有一个懂自己的AI分身。
            通过先进的AI技术，让你的数字分身帮助你更好地生活、工作和社交。
          </Text>
        </View>

        {/* 核心功能 */}
        <View className="features-section">
          <Text className="section-title">核心功能</Text>
          <View className="features-grid">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <View key={idx} className="feature-item">
                  <View className="feature-icon" style={{ background: `${feature.color}20` }}>
                    <Icon size={24} color={feature.color} />
                  </View>
                  <Text className="feature-title">{feature.title}</Text>
                  <Text className="feature-desc">{feature.desc}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 数据统计 */}
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

        {/* 价值观 */}
        <View className="values-section">
          <Text className="section-title">我们的愿景</Text>
          <View className="values-list">
            <View className="value-item">
              <Star size={20} color="#ffaa00" />
              <Text className="value-text">让AI成为每个人的得力助手</Text>
            </View>
            <View className="value-item">
              <Shield size={20} color="#00f5ff" />
              <Text className="value-text">保护用户隐私与数据安全</Text>
            </View>
            <View className="value-item">
              <Heart size={20} color="#ff6b6b" />
              <Text className="value-text">用技术创造美好生活</Text>
            </View>
          </View>
        </View>

        {/* 版权信息 */}
        <View className="copyright-section">
          <Text className="copyright-text">© 2024 莫瑞娜科技</Text>
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
