import Taro, { useLoad, useRouter, navigateBack, showToast, showModal, navigateTo, getLocation } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import * as Network from '@/network'
import {
  ChevronRight, Sparkles, Settings, Trash2,
  Volume2, Bell, Moon, Zap, Shield, MapPin
} from 'lucide-react-taro'
import './index.css'

interface AvatarSettings {
  id: string
  name: string
  avatar_url: string
  personality: string
  level: number
  exp: number
  is_hosted: boolean
  latitude?: number | null
  longitude?: number | null
  location_text?: string | null
  config?: {
    voice_enabled?: boolean
    notification_enabled?: boolean
    night_mode?: boolean
    auto_learning?: boolean
    privacy_mode?: boolean
    [key: string]: any
  }
}

export default function AvatarSettingsPage() {
  const router = useRouter()
  const { avatarId } = router.params
  
  const [avatar, setAvatar] = useState<AvatarSettings | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPersonality, setEditPersonality] = useState('')
  
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
    
    if (avatarId) {
      fetchAvatar()
    }
  })

  const fetchAvatar = async () => {
    try {
      const res = await Network.request({ url: `/api/avatar/${avatarId}` })
      if (res.data?.code === 200) {
        setAvatar(res.data.data)
        setEditName(res.data.data.name)
        setEditPersonality(res.data.data.personality || '')
      }
    } catch (error) {
      console.error('获取分身失败:', error)
      showToast({ title: '获取失败', icon: 'none' })
    }
  }

  const saveSettings = async (key: string, value: any) => {
    if (!avatar) return
    
    try {
      const newConfig = {
        ...avatar.config,
        [key]: value
      }
      
      const res = await Network.request({
        url: `/api/avatar/${avatarId}`,
        method: 'PUT',
        data: { config: newConfig }
      })
      
      if (res.data?.code === 200) {
        setAvatar({ ...avatar, config: newConfig })
        showToast({ title: '已保存', icon: 'success', duration: 1000 })
      }
    } catch (error) {
      console.error('保存失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const saveProfile = async () => {
    if (!editName.trim()) {
      showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}`,
        method: 'PUT',
        data: {
          name: editName,
          personality: editPersonality
        }
      })
      
      if (res.data?.code === 200) {
        setAvatar({ ...avatar!, name: editName, personality: editPersonality })
        setEditing(false)
        showToast({ title: '保存成功', icon: 'success' })
      }
    } catch (error) {
      console.error('保存失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const updateLocation = async () => {
    if (!avatar) return

    try {
      showToast({ title: '正在获取位置...', icon: 'loading', duration: 2000 })

      const locationRes = await getLocation({
        type: 'wgs84'
      })

      // 只传递经纬度，让后端自动进行逆地理编码
      const locationData = {
        latitude: locationRes.latitude,
        longitude: locationRes.longitude
      }

      const res = await Network.request({
        url: `/api/avatar/${avatarId}`,
        method: 'PUT',
        data: locationData
      })

      if (res.data?.code === 200) {
        // 后端返回的数据包含逆地理编码后的详细地址
        setAvatar({ ...avatar, ...res.data.data })
        showToast({ title: '位置已更新', icon: 'success', duration: 2000 })
      }
    } catch (error) {
      console.error('更新位置失败:', error)
      showToast({ title: '更新失败，请检查定位权限', icon: 'none' })
    }
  }

  const deleteAvatar = () => {
    showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个分身吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/avatar/${avatarId}`,
              method: 'DELETE'
            })
            showToast({ title: '已删除', icon: 'success' })
            navigateBack()
          } catch (error) {
            console.error('删除失败:', error)
            showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const settingItems = [
    { 
      key: 'voice_enabled', 
      title: '语音回复', 
      desc: '分身用语音回复你',
      icon: Volume2, 
      color: '#00f5ff',
      enabled: avatar?.config?.voice_enabled ?? false
    },
    { 
      key: 'notification_enabled', 
      title: '消息通知', 
      desc: '分身主动提醒你',
      icon: Bell, 
      color: '#bf00ff',
      enabled: avatar?.config?.notification_enabled ?? true
    },
    { 
      key: 'night_mode', 
      title: '夜间模式', 
      desc: '夜间自动降低活跃度',
      icon: Moon, 
      color: '#6366f1',
      enabled: avatar?.config?.night_mode ?? true
    },
    { 
      key: 'auto_learning', 
      title: '自动学习', 
      desc: '从对话中学习你的习惯',
      icon: Zap, 
      color: '#00ff88',
      enabled: avatar?.config?.auto_learning ?? true
    },
    { 
      key: 'privacy_mode', 
      title: '隐私模式', 
      desc: '增强对话隐私保护',
      icon: Shield, 
      color: '#ff6b6b',
      enabled: avatar?.config?.privacy_mode ?? false
    }
  ]

  if (!avatar) {
    return (
      <View className="avatar-settings-page loading">
        <Text className="as-loading-text">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="avatar-settings-page">
      {/* 顶部导航 */}
      <View className="as-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="as-header-back" onClick={() => navigateBack()}>
          <Text className="as-back-text">← 返回</Text>
        </View>
        <Text className="as-header-title">分身设置</Text>
        <View className="as-header-action" style={{ width: `${capsuleWidth}rpx` }} onClick={() => editing ? saveProfile() : setEditing(true)}>
          <Text className="as-action-text">{editing ? '保存' : '编辑'}</Text>
        </View>
      </View>

      <ScrollView 
        className="as-scroll" 
        scrollY
        style={{ paddingTop: `${statusBarHeight + 90}rpx` }}
      >
        {/* 分身信息 */}
        <View className="as-avatar-section">
          <View className="as-avatar-card">
            <View className="as-avatar-avatar">
              {avatar.avatar_url ? (
                <Image src={avatar.avatar_url} className="as-avatar-img" mode="aspectFill" />
              ) : (
                <View className="as-avatar-placeholder">
                  <Sparkles size={40} color="#00f5ff" />
                </View>
              )}
            </View>
            
            {editing ? (
              <View className="as-edit-form">
                <View className="as-edit-item">
                  <Text className="as-edit-label">名称</Text>
                  <Input 
                    className="as-edit-input"
                    value={editName}
                    onInput={e => setEditName(e.detail.value)}
                    placeholder="输入分身名称"
                  />
                </View>
                <View className="as-edit-item">
                  <Text className="as-edit-label">性格</Text>
                  <Textarea 
                    className="as-edit-textarea"
                    value={editPersonality}
                    onInput={e => setEditPersonality(e.detail.value)}
                    placeholder="描述分身性格特点"
                    maxlength={200}
                  />
                </View>
              </View>
            ) : (
              <View className="as-avatar-info">
                <Text className="as-avatar-name">{avatar.name}</Text>
                <View className="as-avatar-meta">
                  <Text className="as-meta-item">Lv.{avatar.level}</Text>
                  <Text className="as-meta-divider">·</Text>
                  <Text className="as-meta-item">{avatar.exp || 0} EXP</Text>
                </View>
                <Text className="as-avatar-personality">{avatar.personality || '友好助手'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 功能设置 */}
        <View className="as-section">
          <Text className="as-section-title">功能设置</Text>

          {settingItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <View key={idx} className="as-setting-item">
                <View className="as-setting-left">
                  <View className="as-setting-icon" style={{ background: `${item.color}20` }}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <View className="as-setting-info">
                    <Text className="as-setting-title">{item.title}</Text>
                    <Text className="as-setting-desc">{item.desc}</Text>
                  </View>
                </View>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(checked) => saveSettings(item.key, checked)}
                />
              </View>
            )
          })}
        </View>

        {/* 地理位置 */}
        <View className="as-section">
          <Text className="as-section-title">地理位置</Text>

          <View className="as-location-card">
            <View className="as-location-info">
              <View className="as-location-icon">
                <MapPin size={20} color="#ff6b6b" />
              </View>
              <View className="as-location-details">
                <Text className="as-location-label">当前位置</Text>
                {avatar?.location_text ? (
                  <Text className="as-location-value">{avatar.location_text}</Text>
                ) : (
                  <Text className="as-location-placeholder">未设置位置</Text>
                )}
              </View>
            </View>
            <Button
              className="as-location-btn"
              onClick={updateLocation}
            >
              <Text className="as-location-btn-text">更新位置</Text>
            </Button>
          </View>
        </View>

        {/* 托管设置 */}
        <View className="as-section">
          <Text className="as-section-title">托管设置</Text>
          
          <View 
            className="as-menu-item"
            onClick={() => navigateTo({ url: '/pages/avatar/avatar-manage/index' })}
          >
            <View className="as-menu-left">
              <Settings size={20} color="#00f5ff" />
              <Text className="as-menu-text">托管配置</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
          </View>
        </View>

        {/* 危险操作 */}
        <View className="as-danger-section">
          <Button className="as-delete-btn" onClick={deleteAvatar}>
            <Trash2 size={18} color="#ff6b6b" />
            <Text className="as-delete-text">删除分身</Text>
          </Button>
        </View>

        <View className="as-bottom-space" />
      </ScrollView>
    </View>
  )
}
