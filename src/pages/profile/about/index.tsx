import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Sparkles, Heart, Shield } from 'lucide-react-taro'
import './index.css'

export default function AboutPage() {
  const handleBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="about-page">
      {/* 自定义导航栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={handleBack}>
          <ChevronLeft size={24} color="#1f2937" />
        </View>
        <View className="nav-title">关于我们</View>
        <View className="nav-placeholder" />
      </View>

      {/* 品牌区域 */}
      <View className="brand-section">
        <View className="brand-logo">
          <Sparkles size={48} color="#3b82f6" />
        </View>
        <Text className="brand-name">莫瑞娜</Text>
        <Text className="brand-slogan">AI原生人机共生协同平台</Text>
        <Text className="brand-version">版本 v1.0.0</Text>
      </View>

      {/* 功能特性 */}
      <View className="features-section">
        <View className="section-title">核心功能</View>
        <View className="feature-list">
          <View className="feature-item">
            <View className="feature-icon">
              <Sparkles size={24} color="#3b82f6" />
            </View>
            <View className="feature-info">
              <Text className="feature-name">AI分身</Text>
              <Text className="feature-desc">创建专属AI分身，7x24小时在线服务</Text>
            </View>
          </View>
          <View className="feature-item">
            <View className="feature-icon" style={{ background: '#fef3c7' }}>
              <Heart size={24} color="#f59e0b" />
            </View>
            <View className="feature-info">
              <Text className="feature-name">智能托管</Text>
              <Text className="feature-desc">分身自动托管，轻松赚取收益</Text>
            </View>
          </View>
          <View className="feature-item">
            <View className="feature-icon" style={{ background: '#ecfdf5' }}>
              <Shield size={24} color="#10b981" />
            </View>
            <View className="feature-info">
              <Text className="feature-name">隐私保护</Text>
              <Text className="feature-desc">端到端加密，保护您的数据安全</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 联系信息 */}
      <View className="contact-section">
        <View className="section-title">联系我们</View>
        <View className="contact-list">
          <View className="contact-item">
            <Text className="contact-label">客服邮箱</Text>
            <Text className="contact-value">support@morena.ai</Text>
          </View>
          <View className="contact-item">
            <Text className="contact-label">官方网站</Text>
            <Text className="contact-value">www.morena.ai</Text>
          </View>
        </View>
      </View>

      {/* 版权信息 */}
      <View className="footer-section">
        <Text className="copyright">© 2024 莫瑞娜. All rights reserved.</Text>
      </View>
    </View>
  )
}
