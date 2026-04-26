import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Shield, Lock, Smartphone } from 'lucide-react-taro'
import './index.css'

export default function SecurityPage() {
  const handleBack = () => {
    Taro.navigateBack()
  }

  const securityItems = [
    { icon: Lock, label: '修改密码', action: () => Taro.showToast({ title: '开发中', icon: 'none' }) },
    { icon: Smartphone, label: '手机绑定', value: '已绑定', action: () => Taro.showToast({ title: '开发中', icon: 'none' }) },
    { icon: Shield, label: '账号安全', action: () => Taro.showToast({ title: '开发中', icon: 'none' }) }
  ]

  return (
    <View className="security-page">
      {/* 导航栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={handleBack}>
          <ChevronLeft size={24} color="#1f2937" />
        </View>
        <Text className="nav-title">账号安全</Text>
        <View className="nav-placeholder" />
      </View>

      {/* 安全状态卡片 */}
      <View className="security-card">
        <View className="security-icon">
          <Shield size={48} color="#10b981" />
        </View>
        <Text className="security-status">账号安全状态良好</Text>
        <Text className="security-tip">建议定期修改密码保护账号安全</Text>
      </View>

      {/* 安全设置列表 */}
      <View className="security-list">
        {securityItems.map((item, index) => (
          <View key={index} className="security-item" onClick={item.action}>
            <View className="security-item-left">
              <item.icon size={20} color="#6b7280" />
              <Text className="security-item-label">{item.label}</Text>
            </View>
            <View className="security-item-right">
              {item.value && <Text className="security-item-value">{item.value}</Text>}
              <Text className="security-arrow">›</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
