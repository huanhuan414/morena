import { useLoad, useDidShow, navigateTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image, Picker } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import * as Network from '@/network'
import { Sparkles, Plus, Settings, TrendingUp, Clock, Zap, Users, ChevronRight, X, Check, Crown, Bell } from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  exp: number
  is_hosted?: boolean
  config?: {
    hosting_settings?: {
      auto_post?: boolean
      auto_comment?: boolean
      auto_like?: boolean
      auto_friend?: boolean
      post_frequency?: 'low' | 'medium' | 'high'
      active_hours?: string[]
    }
    [key: string]: any
  }
  // 展开后的托管设置（前端使用）
  hosting_settings?: {
    auto_post?: boolean
    auto_comment?: boolean
    auto_like?: boolean
    auto_friend?: boolean
    post_frequency?: 'low' | 'medium' | 'high'
    active_hours?: string[]
  }
}

// 预设时段选项
const TIME_SLOT_PRESETS = [
  { id: 'all', label: '全天', slots: ['00:00-24:00'] },
  { id: 'daytime', label: '白天', slots: ['08:00-18:00'] },
  { id: 'work', label: '工作时间', slots: ['09:00-12:00', '14:00-18:00'] },
  { id: 'evening', label: '晚间', slots: ['18:00-22:00'] },
  { id: 'night', label: '夜间', slots: ['20:00-24:00'] },
  { id: 'custom', label: '自定义', slots: [] },
]

export default function AvatarManagePage() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [editingAvatarId, setEditingAvatarId] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string>('all')
  const [customSlots, setCustomSlots] = useState<string[]>(['09:00', '18:00'])
  
  // 订阅权益状态
  const [canCreateAvatar, setCanCreateAvatar] = useState(true)
  const [avatarCount, setAvatarCount] = useState(0)
  const [maxAvatars, setMaxAvatars] = useState(1)
  const [loadingSubscription, setLoadingSubscription] = useState(true)

  // 安全区域适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    // 初始化安全区域信息
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)
  })

  useDidShow(() => {
    fetchAvatars()
    loadSubscriptionInfo()
  })

  const loadSubscriptionInfo = async () => {
    try {
      setLoadingSubscription(true)
      // 获取订阅信息和分身数量
      const [subscriptionRes, avatarListRes] = await Promise.all([
        Network.request({ url: '/api/subscription/user' }),
        Network.request({ url: '/api/avatar' })
      ])

      // 获取当前分身数量
      const currentCount = avatarListRes.data?.data?.length || 0
      setAvatarCount(currentCount)

      // 检查订阅权益
      if (subscriptionRes.data?.data?.plan) {
        const plan = subscriptionRes.data.data.plan
        setMaxAvatars(plan.max_avatars)
        
        // 检查是否可以创建分身
        if (plan.max_avatars !== -1 && currentCount >= plan.max_avatars) {
          setCanCreateAvatar(false)
        } else {
          setCanCreateAvatar(true)
        }
      } else {
        // 免费用户最多1个分身
        setMaxAvatars(1)
        if (currentCount >= 1) {
          setCanCreateAvatar(false)
        } else {
          setCanCreateAvatar(true)
        }
      }
    } catch (error) {
      console.error('加载订阅信息失败:', error)
      setCanCreateAvatar(true) // 加载失败时允许创建，避免阻塞用户
    } finally {
      setLoadingSubscription(false)
    }
  }

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      console.log('获取分身响应:', res.data)
      if (res.data?.code === 200) {
        const avatarList = res.data.data || []
        // 展开托管设置到顶层，便于前端使用
        setAvatars(avatarList.map((avatar: Avatar) => ({
          ...avatar,
          is_hosted: avatar.is_hosted || false,
          hosting_settings: avatar.config?.hosting_settings || {
            auto_post: true,
            auto_comment: true,
            auto_like: true,
            auto_friend: true,
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
    console.log('切换托管状态:', avatarId, enabled)
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/hosting`,
        method: 'POST',
        data: { enabled }
      })
      console.log('托管响应:', res.data)
      
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
      } else {
        showToast({ title: res.data?.message || '设置失败', icon: 'none' })
      }
    } catch (error) {
      console.error('托管设置失败:', error)
      showToast({ title: '设置失败', icon: 'none' })
    }
  }

  const updateHostingSettings = async (avatarId: string, settings: Partial<Avatar['hosting_settings']>) => {
    console.log('更新托管设置:', avatarId, settings)
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/hosting/settings`,
        method: 'POST',
        data: settings
      })
      console.log('更新设置响应:', res.data)
      
      if (res.data?.code === 200) {
        setAvatars(prev => prev.map(avatar => 
          avatar.id === avatarId 
            ? { ...avatar, hosting_settings: { ...avatar.hosting_settings, ...settings } }
            : avatar
        ))
        showToast({ title: '设置已更新', icon: 'success' })
      } else {
        showToast({ title: res.data?.message || '更新失败', icon: 'none' })
      }
    } catch (error) {
      console.error('更新设置失败:', error)
      showToast({ title: '更新失败', icon: 'none' })
    }
  }

  const createNewAvatar = () => {
    // 检查是否可以创建分身
    if (!canCreateAvatar) {
      showToast({ 
        title: `当前订阅最多支持 ${maxAvatars} 个分身，请升级订阅`,
        icon: 'none',
        duration: 3000
      })
      navigateTo({ url: '/pages/subscription/index' })
      return
    }
    navigateTo({ url: '/pages/avatar-create/index' })
  }

  const goToSettings = (avatarId: string) => {
    navigateTo({ url: `/pages/avatar-settings/index?avatarId=${avatarId}` })
  }

  // 打开时间选择弹窗
  const openTimeModal = (avatarId: string) => {
    setEditingAvatarId(avatarId)
    const avatar = avatars.find(a => a.id === avatarId)
    const currentSlots = avatar?.hosting_settings?.active_hours || ['00:00-24:00']
    
    // 检查是否匹配预设
    const matchedPreset = TIME_SLOT_PRESETS.find(p => 
      JSON.stringify(p.slots) === JSON.stringify(currentSlots)
    )
    
    if (matchedPreset) {
      setSelectedPreset(matchedPreset.id)
      setCustomSlots(['09:00', '18:00'])
    } else {
      setSelectedPreset('custom')
      // 解析自定义时段
      if (currentSlots.length > 0 && currentSlots[0].includes('-')) {
        const [start, end] = currentSlots[0].split('-')
        setCustomSlots([start, end])
      }
    }
    
    setShowTimeModal(true)
  }

  // 选择预设时段
  const selectPreset = (presetId: string) => {
    setSelectedPreset(presetId)
  }

  // 保存时段设置
  const saveTimeSlots = async () => {
    if (!editingAvatarId) return
    
    let activeHours: string[]
    
    if (selectedPreset === 'custom') {
      activeHours = [`${customSlots[0]}-${customSlots[1]}`]
    } else {
      const preset = TIME_SLOT_PRESETS.find(p => p.id === selectedPreset)
      activeHours = preset?.slots || ['00:00-24:00']
    }
    
    await updateHostingSettings(editingAvatarId, { active_hours: activeHours })
    setShowTimeModal(false)
  }

  // 格式化时段显示
  const formatActiveHours = (slots?: string[]) => {
    if (!slots || slots.length === 0) return '全天'
    return slots.join(', ').replace(/-/g, ' ~ ')
  }

  return (
    <View className="avatar-manage-page">
      {/* 顶部导航 */}
      <View className="manage-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-left-wrap">
          <Text className="header-title">我的分身</Text>
        </View>
        <View className="header-right-wrap" style={{ width: `${capsulePlaceholderWidth}rpx` }}>
          <Button className="create-btn" onClick={createNewAvatar}>
            <Plus size={20} color="#00f5ff" />
            <Text className="create-text">创建分身</Text>
          </Button>
        </View>
      </View>

      <ScrollView className="manage-scroll" scrollY>
        {/* 订阅权益提示 */}
        {!loadingSubscription && (
          <View className="subscription-info-card">
            <View className="subscription-info-header">
              <Crown className="subscription-icon" size={20} color="#fbbf24" />
              <Text className="subscription-info-title">分身配额</Text>
            </View>
            <View className="subscription-info-content">
              <Text className="subscription-info-text">
                当前已有 <Text className="highlight">{avatarCount}</Text> 个分身
                {maxAvatars === -1 ? (
                  <Text className="highlight"> · 无限</Text>
                ) : (
                  <Text>，还可创建 <Text className="highlight">{maxAvatars - avatarCount}</Text> 个</Text>
                )}
              </Text>
              {!canCreateAvatar && (
                <View 
                  className="subscription-upgrade-btn"
                  onClick={() => navigateTo({ url: '/pages/subscription/index' })}
                >
                  <Text className="subscription-upgrade-text">升级订阅以创建更多</Text>
                  <ChevronRight size={16} color="#fbbf24" />
                </View>
              )}
            </View>
          </View>
        )}

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
                      <Text className="meta-item">{avatar.exp || 0} EXP</Text>
                    </View>
                    <Text className="avatar-personality">{avatar.personality || '友好助手'}</Text>
                  </View>
                  <Button className="settings-btn" onClick={() => goToSettings(avatar.id)}>
                    <Settings size={20} color="rgba(255,255,255,0.4)" />
                  </Button>
                </View>

                {/* 托管开关 */}
                <View className="hosting-section">
                  <View className="hosting-header">
                    <View className="hosting-title-wrap">
                      <Zap size={18} color={avatar.is_hosted ? '#00f5ff' : 'rgba(255,255,255,0.3)'} />
                      <Text className="hosting-title">自动托管</Text>
                      {avatar.is_hosted && (
                        <View className="hosting-badge">
                          <Text className="hosting-badge-text">运行中</Text>
                        </View>
                      )}
                    </View>
                    <Switch 
                      checked={avatar.is_hosted || false}
                      onCheckedChange={(checked) => toggleHosting(avatar.id, checked)}
                    />
                  </View>
                  
                  {avatar.is_hosted && (
                    <View className="hosting-settings">
                      <Text className="settings-desc">
                        开启后，分身将自动帮你发帖、交友、互动
                      </Text>
                      
                      {/* 活跃时段 */}
                      <View className="setting-item" onClick={() => openTimeModal(avatar.id)}>
                        <View className="setting-label">
                          <Clock size={16} color="rgba(255,255,255,0.6)" />
                          <Text className="setting-text">活跃时段</Text>
                        </View>
                        <View className="setting-value-wrap">
                          <Text className="setting-value">{formatActiveHours(avatar.hosting_settings?.active_hours)}</Text>
                          <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
                        </View>
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
                              onClick={() => updateHostingSettings(avatar.id, { post_frequency: freq as 'low' | 'medium' | 'high' })}
                            >
                              <Text className="freq-text">
                                {freq === 'low' ? '低' : freq === 'medium' ? '中' : '高'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* 自动功能 - 独立子功能开关 */}
                      <View className="auto-features">
                        <View className="feature-item">
                          <Text className="feature-text">自动发帖</Text>
                          <Switch
                            checked={avatar.hosting_settings?.auto_post ?? false}
                            onCheckedChange={async (checked) => {
                              if (!avatar.is_hosted) {
                                showToast({ title: '请先开启托管', icon: 'none' })
                                return
                              }
                              await updateHostingSettings(avatar.id, { auto_post: checked })
                            }}
                          />
                        </View>
                        <View className="feature-item">
                          <Text className="feature-text">自动评论</Text>
                          <Switch
                            checked={avatar.hosting_settings?.auto_comment ?? false}
                            onCheckedChange={async (checked) => {
                              if (!avatar.is_hosted) {
                                showToast({ title: '请先开启托管', icon: 'none' })
                                return
                              }
                              await updateHostingSettings(avatar.id, { auto_comment: checked })
                            }}
                          />
                        </View>
                        <View className="feature-item">
                          <Text className="feature-text">自动点赞</Text>
                          <Switch
                            checked={avatar.hosting_settings?.auto_like ?? false}
                            onCheckedChange={async (checked) => {
                              if (!avatar.is_hosted) {
                                showToast({ title: '请先开启托管', icon: 'none' })
                                return
                              }
                              await updateHostingSettings(avatar.id, { auto_like: checked })
                            }}
                          />
                        </View>
                        <View className="feature-item">
                          <Text className="feature-text">自动交友</Text>
                          <Switch
                            checked={avatar.hosting_settings?.auto_friend ?? false}
                            onCheckedChange={async (checked) => {
                              if (!avatar.is_hosted) {
                                showToast({ title: '请先开启托管', icon: 'none' })
                                return
                              }
                              await updateHostingSettings(avatar.id, { auto_friend: checked })
                            }}
                          />
                        </View>

                        {/* 好友列表入口 */}
                        <View
                          className="friend-list-entry"
                          onClick={() => navigateTo({ url: `/pages/avatar-friends/index?avatarId=${avatar.id}` })}
                        >
                          <View className="friend-entry-left">
                            <Users size={18} color="#00f5ff" />
                            <Text className="friend-entry-text">查看好友列表</Text>
                          </View>
                          <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 商单区块 */}
                  <View className="orders-section">
                    <View
                      className="orders-header"
                      onClick={() => navigateTo({ url: `/pages/avatar-orders/index?avatarId=${avatar.id}` })}
                    >
                      <View className="orders-title-wrap">
                        <Bell size={18} color="#00f5ff" />
                        <Text className="orders-title">商单</Text>
                      </View>
                      <ChevronRight size={20} color="rgba(255,255,255,0.4)" />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>

      {/* 时间选择弹窗 */}
      {showTimeModal && (
        <View className="time-modal-overlay" onClick={() => setShowTimeModal(false)}>
          <View className="time-modal" onClick={(e) => e.stopPropagation()}>
            <View className="time-modal-header">
              <Text className="time-modal-title">选择活跃时段</Text>
              <View className="time-modal-close" onClick={() => setShowTimeModal(false)}>
                <X size={24} color="rgba(255,255,255,0.6)" />
              </View>
            </View>

            <View className="time-modal-content">
              {/* 预设选项 */}
              <View className="preset-section">
                <Text className="section-title">快速选择</Text>
                <View className="preset-grid">
                  {TIME_SLOT_PRESETS.filter(p => p.id !== 'custom').map(preset => (
                    <View 
                      key={preset.id}
                      className={`preset-item ${selectedPreset === preset.id ? 'active' : ''}`}
                      onClick={() => selectPreset(preset.id)}
                    >
                      {selectedPreset === preset.id && (
                        <View className="preset-check">
                          <Check size={14} color="#00f5ff" />
                        </View>
                      )}
                      <Text className="preset-label">{preset.label}</Text>
                      <Text className="preset-time">{preset.slots.join(', ')}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 自定义时段 */}
              <View className="custom-section">
                <View 
                  className={`custom-header ${selectedPreset === 'custom' ? 'active' : ''}`}
                  onClick={() => selectPreset('custom')}
                >
                  <Text className="custom-title">自定义时段</Text>
                  {selectedPreset === 'custom' && (
                    <Check size={18} color="#00f5ff" />
                  )}
                </View>

                {selectedPreset === 'custom' && (
                  <View className="custom-time-picker">
                    <View className="time-picker-row">
                      <Text className="time-label">开始时间</Text>
                      <View className="time-select-wrap">
                        <Picker 
                          mode="time" 
                          value={customSlots[0]}
                          onChange={(e) => setCustomSlots([e.detail.value, customSlots[1]])}
                        >
                          <View className="time-select">
                            <Text className="time-value">{customSlots[0]}</Text>
                            <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
                          </View>
                        </Picker>
                      </View>
                    </View>
                    <View className="time-picker-row">
                      <Text className="time-label">结束时间</Text>
                      <View className="time-select-wrap">
                        <Picker 
                          mode="time" 
                          value={customSlots[1]}
                          onChange={(e) => setCustomSlots([customSlots[0], e.detail.value])}
                        >
                          <View className="time-select">
                            <Text className="time-value">{customSlots[1]}</Text>
                            <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
                          </View>
                        </Picker>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View className="time-modal-footer">
              <Button className="time-cancel-btn" onClick={() => setShowTimeModal(false)}>
                <Text className="time-cancel-text">取消</Text>
              </Button>
              <Button className="time-confirm-btn" onClick={saveTimeSlots}>
                <Text className="time-confirm-text">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
