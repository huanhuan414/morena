import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { ChevronLeft, Bell, Moon, Globe, Shield, CircleQuestionMark } from 'lucide-react-taro'
import { Switch } from '@/components/ui/switch'
import './index.css'

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  const handleBack = () => {
    Taro.navigateBack()
  }

  const menuItems = [
    { icon: Bell, label: '消息通知', value: notifications, onChange: setNotifications },
    { icon: Moon, label: '深色模式', value: darkMode, onChange: setDarkMode },
    { icon: Globe, label: '语言', action: () => Taro.showToast({ title: '开发中', icon: 'none' }) },
    { icon: Shield, label: '隐私设置', action: () => Taro.showToast({ title: '开发中', icon: 'none' }) },
    { icon: CircleQuestionMark, label: '关于我们', action: () => Taro.navigateTo({ url: '/package-profile/pages/about/index' }) }
  ]

  return (
    <View className="settings-page">
      {/* 导航栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={handleBack}>
          <ChevronLeft size={24} color="#1f2937" />
        </View>
        <Text className="nav-title">设置</Text>
        <View className="nav-placeholder" />
      </View>

      {/* 设置列表 */}
      <View className="settings-list">
        {menuItems.map((item, index) => (
          <View key={index} className="settings-item">
            <View className="settings-item-left">
              <item.icon size={20} color="#6b7280" />
              <Text className="settings-item-label">{item.label}</Text>
            </View>
            <View className="settings-item-right">
              {'value' in item ? (
                <Switch checked={item.value} onCheckedChange={item.onChange} />
              ) : (
                <Text className="settings-arrow">›</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* 版本信息 */}
      <View className="version-info">
        <Text className="version-text">版本 v1.0.0</Text>
      </View>
    </View>
  )
}
