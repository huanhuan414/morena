import Taro, { useDidShow, navigateBack, showToast, useLoad, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Switch } from '@/components/ui/switch'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { ChevronRight, Bell, Moon, Globe, Database, Trash2, Sparkles, Lock, Smartphone, Mail } from 'lucide-react-taro'
import './index.css'

interface UserSettings {
  notification_enabled: boolean
  dark_mode: boolean
  auto_backup: boolean
  language: string
}

export default function SettingsPage() {
  const { userInfo, isDarkMode, setDarkMode } = useUserStore()
  const [settings, setSettings] = useState<UserSettings>({
    notification_enabled: true,
    dark_mode: isDarkMode,
    auto_backup: true,
    language: 'zh-CN'
  })
  
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

  useDidShow(() => {
    fetchSettings()
    fetchSecurityStatus()
  })

  const fetchSettings = async () => {
    try {
      const res = await Network.request({ url: '/api/user/profile' })
      if (res.data?.code === 200 && res.data.data?.settings) {
        setSettings({
          notification_enabled: res.data.data.settings.notification_enabled ?? true,
          dark_mode: res.data.data.settings.dark_mode ?? isDarkMode,
          auto_backup: res.data.data.settings.auto_backup ?? true,
          language: res.data.data.settings.language || 'zh-CN'
        })
      }
    } catch (error) {
      console.error('获取设置失败:', error)
    }
  }

  const updateSettings = async (key: keyof UserSettings, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)

    // 如果是深色模式切换，同步到全局状态
    if (key === 'dark_mode') {
      setDarkMode(value)
    }

    try {
      const res = await Network.request({
        url: '/api/user/profile',
        method: 'PUT',
        data: { settings: newSettings }
      })
      if (res.data?.code === 200) {
        showToast({ title: '设置已保存', icon: 'success' })
      }
    } catch (error) {
      console.error('保存设置失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
      // 回滚
      setSettings(settings)
      if (key === 'dark_mode') {
        setDarkMode(settings.dark_mode)
      }
    }
  }

  const clearCache = () => {
    showToast({ title: '缓存已清除', icon: 'success' })
  }

  const fetchSecurityStatus = async () => {
    try {
      const res = await Network.request({ url: '/api/user/security-status' })
      if (res.data?.code === 200) {
        setSecurityStatus(res.data.data)
      }
    } catch (error) {
      console.error('获取安全状态失败:', error)
    }
  }

  const menuItems = [
    { title: '帮助中心', icon: Globe, desc: '常见问题解答', path: '/pages/profile/help' }
  ]

  const [securityStatus, setSecurityStatus] = useState({
    hasPassword: true,
    hasPhone: false,
    hasEmail: false
  })

  const securityItems = [
    { 
      title: '登录密码', 
      desc: securityStatus.hasPassword ? '已设置' : '未设置',
      icon: Lock, 
      color: '#00f5ff',
      action: () => showToast({ title: '请在安全中心修改', icon: 'none' })
    },
    { 
      title: '手机绑定', 
      desc: securityStatus.hasPhone ? '已绑定' : '未绑定',
      icon: Smartphone, 
      color: '#bf00ff',
      action: () => showToast({ title: '请在微信中绑定', icon: 'none' })
    },
    { 
      title: '邮箱绑定', 
      desc: securityStatus.hasEmail ? '已绑定' : '未绑定',
      icon: Mail, 
      color: '#00ff88',
      action: () => showToast({ title: '功能开发中', icon: 'none' })
    }
  ]

  return (
    <View className="settings-page">
      {/* 顶部导航 */}
      <View className="settings-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">设置</Text>
        <View className="header-placeholder" style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      <ScrollView className="settings-scroll" scrollY>
        {/* 用户信息 */}
        <View className="user-section">
          <View className="user-info-card">
            {userInfo?.avatar ? (
              <Image src={userInfo.avatar} className="user-avatar" mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder">
                <Text className="avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
              </View>
            )}
            <View className="user-details">
              <Text className="user-name">{userInfo?.nickname || '探索者'}</Text>
              <Text className="user-id">ID: {userInfo?.id?.slice(-8) || 'guest'}</Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
          </View>
        </View>

        {/* 快捷设置 */}
        <View className="settings-section">
          <Text className="section-title">快捷设置</Text>
          
          <View className="setting-item">
            <View className="setting-left">
              <Bell size={20} color="#00f5ff" />
              <Text className="setting-text">消息通知</Text>
            </View>
            <Switch 
              checked={settings.notification_enabled}
              onCheckedChange={(checked) => updateSettings('notification_enabled', checked)}
            />
          </View>

          <View className="setting-item">
            <View className="setting-left">
              <Moon size={20} color={isDarkMode ? '#00f5ff' : '#bf00ff'} />
              <Text className="setting-text">深色模式</Text>
            </View>
            <Switch
              checked={settings.dark_mode}
              onCheckedChange={(checked) => updateSettings('dark_mode', checked)}
            />
          </View>

          {/* 主题预览卡片 */}
          <View className="theme-preview-card">
            <View className="theme-preview-header">
              <Sparkles size={16} color={isDarkMode ? '#00f5ff' : '#2563eb'} />
              <Text className="theme-preview-title">
                {isDarkMode ? '霓虹科技风格' : '明亮高级风格'}
              </Text>
            </View>
            <View className="theme-preview-content">
              <View className="theme-color-dot" style={{ background: isDarkMode ? '#00f5ff' : '#2563eb' }} />
              <View className="theme-color-dot" style={{ background: isDarkMode ? '#bf00ff' : '#f59e0b' }} />
              <View className="theme-color-dot" style={{ background: isDarkMode ? '#00ff88' : '#10b981' }} />
            </View>
          </View>

          <View className="setting-item">
            <View className="setting-left">
              <Database size={20} color="#10b981" />
              <Text className="setting-text">自动备份</Text>
            </View>
            <Switch 
              checked={settings.auto_backup}
              onCheckedChange={(checked) => updateSettings('auto_backup', checked)}
            />
          </View>
        </View>

        {/* 账户安全 */}
        <View className="settings-section">
          <Text className="section-title">账户安全</Text>
          
          {securityItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <View 
                key={idx}
                className="menu-item"
                onClick={item.action}
              >
                <View className="menu-left">
                  <Icon size={20} color={item.color} />
                  <Text className="menu-text">{item.title}</Text>
                </View>
                <View className="menu-right">
                  <Text className="menu-desc">{item.desc}</Text>
                  <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
                </View>
              </View>
            )
          })}
        </View>

        {/* 功能菜单 */}
        <View className="settings-section">
          <Text className="section-title">功能</Text>
          
          {menuItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <View 
                key={idx}
                className="menu-item"
                onClick={() => item.path && navigateTo({ url: item.path })}
              >
                <View className="menu-left">
                  <Icon size={20} color="rgba(255,255,255,0.6)" />
                  <Text className="menu-text">{item.title}</Text>
                </View>
                <View className="menu-right">
                  <Text className="menu-desc">{item.desc}</Text>
                  <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
                </View>
              </View>
            )
          })}
        </View>

        {/* 数据管理 */}
        <View className="settings-section">
          <Text className="section-title">数据管理</Text>
          
          <View className="menu-item" onClick={clearCache}>
            <View className="menu-left">
              <Trash2 size={20} color="#ff6b6b" />
              <Text className="menu-text">清除缓存</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
          </View>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
