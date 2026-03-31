import { View, Text, ScrollView, Image, Switch } from '@tarojs/components'
import { useLoad, useDidShow, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Sparkles, Plus, Settings, TrendingUp, Clock, Zap } from 'lucide-react-taro'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  exp: number
  is_hosted?: boolean
  hosting_settings?: {
    auto_post: boolean
    auto_comment: boolean
    auto_like: boolean
    post_frequency: 'low' | 'medium' | 'high'
    active_hours: string[]
  }
}

export default function AvatarManagePage() {
  const [avatars, setAvatars] = useState<Avatar[]>([])

  useLoad(() => {})

  useDidShow(() => {
    fetchAvatars()
  })

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200) {
        const avatarList = res.data.data || []
        // 为每个分身添加托管设置
        setAvatars(avatarList.map((avatar: Avatar) => ({
          ...avatar,
          is_hosted: avatar.is_hosted || false,
          hosting_settings: avatar.hosting_settings || {
            auto_post: true,
            auto_comment: true,
            auto_like: true,
            post_frequency: 'medium',
            active_hours: ['09:00-12:00', '14:00-18:00', '20:00-22:00']
          }
        })))
      }
    } catch (error) {
      console.error('获取分身失败:', error)
      showToast({ title: '获取分身失败', icon: 'none' })
    }
  }

  const toggleHosting = async (avatarId: string, enabled: boolean) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/hosting`,
        method: 'POST',
        data: { enabled }
      })
      
      if (res.data?.code === 200) {
        setAvatars(prev => prev.map(avatar => 
          avatar.id === avatarId 
            ? { ...avatar, is_hosted: enabled }
            : avatar
        ))
        showToast({ 
          title: enabled ? '已开启托管' : '已关闭托管', 
          icon: 'success' 
        })
      }
    } catch (error) {
      console.error('托管设置失败:', error)
      showToast({ title: '设置失败', icon: 'none' })
    }
  }

  const updateHostingSettings = async (avatarId: string, settings: any) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/hosting/settings`,
        method: 'POST',
        data: settings
      })
      
      if (res.data?.code === 200) {
        setAvatars(prev => prev.map(avatar => 
          avatar.id === avatarId 
            ? { ...avatar, hosting_settings: { ...avatar.hosting_settings, ...settings } }
            : avatar
        ))
        showToast({ title: '设置已更新', icon: 'success' })
      }
    } catch (error) {
      console.error('更新设置失败:', error)
      showToast({ title: '更新失败', icon: 'none' })
    }
  }

  const createNewAvatar = () => {
    navigateTo({ url: '/pages/avatar-create/index' })
  }

  return (
    <View className="avatar-manage-page">
      {/* 顶部导航 */}
      <View className="manage-header">
        <Text className="header-title">我的分身</Text>
        <Button className="create-btn" onClick={createNewAvatar}>
          <Plus size={20} color="#00f5ff" />
          <Text className="create-text">创建分身</Text>
        </Button>
      </View>

      <ScrollView className="manage-scroll" scrollY>
        {/* 分身列表 */}
        {avatars.length === 0 ? (
          <View className="empty-section">
            <View className="empty-icon">
              <Sparkles size={64} color="rgba(0, 245, 255, 0.3)" />
            </View>
            <Text className="empty-title">还没有分身</Text>
            <Text className="empty-desc">创建你的第一个AI分身开始体验</Text>
            <Button className="empty-btn" onClick={createNewAvatar}>
              <Text className="empty-btn-text">立即创建</Text>
            </Button>
          </View>
        ) : (
          <View className="avatars-container">
            {avatars.map(avatar => (
              <View key={avatar.id} className="avatar-card">
                {/* 分身信息 */}
                <View className="avatar-info-section">
                  <View className="avatar-avatar">
                    {avatar.avatar_url ? (
                      <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                    ) : (
                      <View className="avatar-placeholder">
                        <Sparkles size={32} color="#00f5ff" />
                      </View>
                    )}
                  </View>
                  <View className="avatar-details">
                    <Text className="avatar-name">{avatar.name}</Text>
                    <View className="avatar-meta">
                      <Text className="meta-item">Lv.{avatar.level}</Text>
                      <Text className="meta-divider">·</Text>
                      <Text className="meta-item">{avatar.exp} EXP</Text>
                    </View>
                    <Text className="avatar-personality">{avatar.personality}</Text>
                  </View>
                  <Button className="settings-btn">
                    <Settings size={20} color="rgba(255,255,255,0.4)" />
                  </Button>
                </View>

                {/* 托管开关 */}
                <View className="hosting-section">
                  <View className="hosting-header">
                    <View className="hosting-title-wrap">
                      <Zap size={18} color={avatar.is_hosted ? '#00f5ff' : 'rgba(255,255,255,0.3)'} />
                      <Text className="hosting-title">自动托管</Text>
                    </View>
                    <Switch 
                      checked={avatar.is_hosted}
                      onChange={(e) => toggleHosting(avatar.id, e.detail.value)}
                      color="#00f5ff"
                    />
                  </View>
                  
                  {avatar.is_hosted && (
                    <View className="hosting-settings">
                      <Text className="settings-desc">
                        开启后，分身将自动帮你发帖、交友、互动
                      </Text>
                      
                      {/* 活跃时段 */}
                      <View className="setting-item">
                        <View className="setting-label">
                          <Clock size={16} color="rgba(255,255,255,0.6)" />
                          <Text className="setting-text">活跃时段</Text>
                        </View>
                        <Text className="setting-value">9:00-22:00</Text>
                      </View>

                      {/* 互动频率 */}
                      <View className="setting-item">
                        <View className="setting-label">
                          <TrendingUp size={16} color="rgba(255,255,255,0.6)" />
                          <Text className="setting-text">互动频率</Text>
                        </View>
                        <View className="frequency-options">
                          {['low', 'medium', 'high'].map(freq => (
                            <View 
                              key={freq}
                              className={`freq-option ${avatar.hosting_settings?.post_frequency === freq ? 'active' : ''}`}
                              onClick={() => updateHostingSettings(avatar.id, { post_frequency: freq })}
                            >
                              <Text className="freq-text">
                                {freq === 'low' ? '低' : freq === 'medium' ? '中' : '高'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* 自动功能 */}
                      <View className="auto-features">
                        <View className="feature-item">
                          <Text className="feature-text">自动发帖</Text>
                          <Switch 
                            checked={avatar.hosting_settings?.auto_post}
                            onChange={(e) => updateHostingSettings(avatar.id, { auto_post: e.detail.value })}
                            color="#00f5ff"
                          />
                        </View>
                        <View className="feature-item">
                          <Text className="feature-text">自动评论</Text>
                          <Switch 
                            checked={avatar.hosting_settings?.auto_comment}
                            onChange={(e) => updateHostingSettings(avatar.id, { auto_comment: e.detail.value })}
                            color="#00f5ff"
                          />
                        </View>
                        <View className="feature-item">
                          <Text className="feature-text">自动点赞</Text>
                          <Switch 
                            checked={avatar.hosting_settings?.auto_like}
                            onChange={(e) => updateHostingSettings(avatar.id, { auto_like: e.detail.value })}
                            color="#00f5ff"
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
