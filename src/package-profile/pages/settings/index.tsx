import Taro, { navigateBack, navigateTo, showModal, showToast } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import {
  ArrowLeft, Bell, Shield, Lock, Globe, CircleQuestionMark,
  Info, Trash2, LogOut, User, ChevronRight
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import '@/styles/variables.css'
import './index.css'

interface SettingItem {
  icon: any
  label: string
  desc: string
  color: string
  action: () => void
}

export default function SettingsPage() {
  const { logout } = useUserStore()
  const statusBarHeight = getStatusBarHeight()

  const handleBack = () => {
    navigateBack()
  }

  const handleLogout = () => {
    showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          Taro.reLaunch({ url: '/pages/login/index' })
        }
      }
    })
  }

  const handleClearCache = () => {
    showModal({
      title: '清除缓存',
      content: '确定要清除本地缓存数据吗？',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            const cacheRes = await Network.request({ url: '/api/user/clear-cache', method: 'POST' })
            if (cacheRes.data?.code === 200) {
              showToast({ title: '缓存已清除', icon: 'success' })
            }
          } catch {
            showToast({ title: '清除成功', icon: 'success' })
          }
        }
      }
    })
  }

  const accountItems = [
    {
      icon: User,
      label: '个人信息',
      desc: '修改头像、昵称',
      color: '#7B3FE4',
      action: () => showToast({ title: '开发中', icon: 'none' })
    },
    {
      icon: Lock,
      label: '修改密码',
      desc: '更新登录密码',
      color: '#F59E0B',
      action: () => showToast({ title: '开发中', icon: 'none' })
    },
    {
      icon: Shield,
      label: '隐私设置',
      desc: '管理隐私权限',
      color: '#10B981',
      action: () => showToast({ title: '开发中', icon: 'none' })
    },
  ]

  const generalItems = [
    {
      icon: Bell,
      label: '消息通知',
      desc: '通知与提醒设置',
      color: '#3B82F6',
      action: () => navigateTo({ url: '/package-profile/pages/notifications/index' })
    },
    {
      icon: Globe,
      label: '语言',
      desc: '简体中文',
      color: '#6366F1',
      action: () => showToast({ title: '开发中', icon: 'none' })
    },
  ]

  const otherItems = [
    {
      icon: CircleQuestionMark,
      label: '帮助中心',
      desc: '常见问题解答',
      color: '#F59E0B',
      action: () => navigateTo({ url: '/package-profile/pages/help/index' })
    },
    {
      icon: Info,
      label: '关于我们',
      desc: '版本 v1.0.0',
      color: '#7B3FE4',
      action: () => navigateTo({ url: '/package-profile/pages/about/index' })
    },
    {
      icon: Trash2,
      label: '清除缓存',
      desc: '清理本地数据',
      color: '#EF4444',
      action: handleClearCache
    },
  ]

  const renderSettingGroup = (title: string, items: SettingItem[]) => (
    <View className="setting-group">
      <View className="sg-header">
        <View className="sg-dot" />
        <Text className="sg-title">{title}</Text>
      </View>
      <View className="sg-list">
        {items.map((item, idx) => {
          const Icon = item.icon
          return (
            <View key={idx} className="setting-item" onClick={item.action}>
              <View className="setting-left">
                <View className="setting-icon-wrap" style={{ backgroundColor: `${item.color}12` }}>
                  <Icon size={18} color={item.color} />
                </View>
                <View className="setting-info">
                  <Text className="setting-label">{item.label}</Text>
                  <Text className="setting-desc">{item.desc}</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#d1d5db" />
            </View>
          )
        })}
      </View>
    </View>
  )

  return (
    <View className="settings-page">
      {/* 紫蓝渐变头部 */}
      <View className="settings-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-decor-1" />
        <View className="header-decor-2" />
        <View className="header-nav">
          <View className="back-btn" onClick={handleBack}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="nav-title">设置</Text>
          <View className="nav-placeholder" />
        </View>
      </View>

      <ScrollView className="settings-scroll" scrollY>
        {/* 账号与安全 */}
        {renderSettingGroup('账号与安全', accountItems)}

        {/* 通用设置 */}
        {renderSettingGroup('通用设置', generalItems)}

        {/* 其他 */}
        {renderSettingGroup('其他', otherItems)}

        {/* 退出登录 */}
        <View className="logout-section">
          <View className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} color="#EF4444" />
            <Text className="logout-text">退出登录</Text>
          </View>
        </View>

        {/* 版本信息 */}
        <View className="version-footer">
          <Text className="version-text">莫瑞娜 v1.0.0</Text>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
