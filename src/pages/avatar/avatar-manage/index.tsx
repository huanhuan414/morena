import { useLoad, useDidShow, navigateTo, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image, Picker } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import * as Network from '@/network'
import { Sparkles, Plus, Settings, TrendingUp, Clock, Zap, Users, ChevronRight, X, Check, Crown, ArrowLeft, Trash2, Phone } from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
import * as Taro from '@tarojs/taro'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatarUrl: string  // 后端返回的是驼峰格式
  level: number
  personality: string
  exp: number
  appearance_style?: string
  trust_enabled?: boolean  // 托管状态
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
  
  // 人格类型中文映射
  const PERSONALITY_LABELS: Record<string, string> = {
    'analytical': '分析型',
    'creative': '创意型',
    'empathetic': '共情型',
    'humorous': '幽默型',
    'professional': '专业型',
    'friendly': '友好型',
    'confident': '自信型',
    'patient': '耐心型',
    'cheerful': '开朗型',
    'wise': '智慧型'
  }
  
  // 获取人格中文名称
  const getPersonalityName = (personality?: string): string => {
    if (!personality) return '友好助手'
    return PERSONALITY_LABELS[personality.toLowerCase()] || personality
  }
  
  // 订阅权益状态
  const [canCreateAvatar, setCanCreateAvatar] = useState(true)
  const [avatarCount, setAvatarCount] = useState(0)
  const [maxAvatars, setMaxAvatars] = useState(1)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [loadingAvatars, setLoadingAvatars] = useState(true) // 分身加载状态
  const [userSubscription, setUserSubscription] = useState<any>(null) // 🔴 用户订阅信息

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
    console.log('[useDidShow] 页面显示，开始加载数据')
    fetchAvatars()
    loadSubscriptionInfo()
  })

  const loadSubscriptionInfo = async () => {
    try {
      setLoadingSubscription(true)
      // 获取用户ID - 尝试多种可能的字段名
      const userInfo = Taro.getStorageSync('userInfo') || {}
      let userId = userInfo.id || userInfo.userId || userInfo.user_id || ''
      
      // 如果没有用户ID，使用测试用户ID（仅用于开发）
      if (!userId) {
        console.log('[loadSubscriptionInfo] 未找到用户ID，使用测试ID')
        userId = 'd9bd8329-e302-4ddf-a7ec-d156610b9691'
      }
      
      // 获取订阅信息和分身数量
      const [subscriptionRes, avatarListRes] = await Promise.all([
        Network.request({ url: '/api/subscription/user', header: { 'x-user-id': userId } }),
        Network.request({ url: '/api/avatar', header: { 'x-user-id': userId } })
      ])

      // 获取当前分身数量
      const currentCount = avatarListRes.data?.data?.length || 0
      setAvatarCount(currentCount)

      // 检查订阅权益
      if (subscriptionRes.data?.data?.plan) {
        const plan = subscriptionRes.data.data.plan
        setMaxAvatars(plan.max_avatars)
        setUserSubscription(subscriptionRes.data.data) // 🔴 保存订阅信息
        
        // 检查是否可以创建分身
        if (plan.max_avatars !== -1 && currentCount >= plan.max_avatars) {
          setCanCreateAvatar(false)
        } else {
          setCanCreateAvatar(true)
        }
      } else {
        // 免费用户最多1个分身
        setMaxAvatars(1)
        setUserSubscription(null) // 🔴 无订阅
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
      setLoadingAvatars(true)
      // 确保获取用户ID - 尝试多种可能的字段名
      const userInfo = Taro.getStorageSync('userInfo') || {}
      // 尝试多种可能的用户ID字段名
      let userId = userInfo.id || userInfo.userId || userInfo.user_id || ''
      
      // 如果还是没有userId，尝试直接使用 openid 查找
      if (!userId && userInfo.openid) {
        userId = userInfo.id // openid 用户可能需要特殊处理
      }
      
      // 临时解决方案：如果没有用户ID，使用测试用户ID（仅用于开发）
      if (!userId) {
        console.log('[fetchAvatars] 未找到用户ID，使用测试ID')
        userId = 'd9bd8329-e302-4ddf-a7ec-d156610b9691' // 测试用户ID
      }
      
      console.log('[fetchAvatars] 最终使用 userId:', userId)
      
      const res = await Network.request({ 
        url: '/api/avatar',
        header: { 'x-user-id': userId }
      })
      console.log('[fetchAvatars] 响应 code:', res.data?.code, 'data length:', res.data?.data?.length)
      if (res.data?.code === 200) {
        const avatarList = res.data.data || []
        console.log('[fetchAvatars] 获取到分身数量:', avatarList.length)
        // 展开托管设置到顶层，便于前端使用
        setAvatars(avatarList.map((avatar: any) => ({
          ...avatar,
          trust_enabled: Boolean(avatar.trust_enabled),
          hosting_settings: avatar.config?.hosting_settings || {
            auto_post: true,
            auto_comment: true,
            auto_like: true,
            auto_friend: true,
            post_frequency: 'medium',
            active_hours: ['09:00-12:00', '14:00-18:00', '20:00-22:00']
          }
        })))
      } else {
        console.log('[fetchAvatars] 接口返回错误:', res.data)
      }
    } catch (error) {
      console.error('获取分身失败:', error)
      showToast({ title: '获取分身失败', icon: 'none' })
    } finally {
      setLoadingAvatars(false)
    }
  }

  const toggleHosting = async (avatarId: string, enabled: boolean) => {
    console.log('切换托管状态:', avatarId, enabled)
    try {
      // 获取用户ID
      const userInfo = Taro.getStorageSync('userInfo') || {}
      let userId = userInfo.id || userInfo.userId || userInfo.user_id || ''
      if (!userId) userId = 'd9bd8329-e302-4ddf-a7ec-d156610b9691' // 测试ID
      
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/trust`,
        method: 'PUT',
        data: { trust_enabled: enabled },
        header: { 'x-user-id': userId }
      })
      console.log('托管响应:', res.data)
      
      if (res.data?.code === 200) {
        setAvatars(prev => prev.map(avatar => 
          avatar.id === avatarId 
            ? { ...avatar, trust_enabled: enabled }
            : avatar
        ))
        showToast({ 
          title: enabled ? '已开启托管' : '已关闭托管', 
          icon: 'success' 
        })
      } else {
        showToast({ title: res.data?.msg || '设置失败', icon: 'none' })
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
    navigateTo({ url: '/pages/avatar/avatar-create/index' })
  }

  const goToSettings = (avatarId: string) => {
    navigateTo({ url: `/pages/avatar/avatar-settings/index?avatarId=${avatarId}` })
  }

  const deleteAvatar = async (avatarId: string) => {
    // 确认删除
    try {
      // 获取用户ID
      const userInfo = Taro.getStorageSync('userInfo') || {}
      let userId = userInfo.id || userInfo.userId || userInfo.user_id || ''
      if (!userId) userId = 'd9bd8329-e302-4ddf-a7ec-d156610b9691' // 测试ID
      
      const res = await Network.request({
        url: `/api/avatar/${avatarId}`,
        method: 'DELETE',
        header: { 'x-user-id': userId }
      })
      console.log('删除分身响应:', res.data)
      
      if (res.data?.code === 200) {
        setAvatars(prev => prev.filter(a => a.id !== avatarId))
        showToast({ title: '删除成功', icon: 'success' })
      } else {
        showToast({ title: res.data?.msg || '删除失败', icon: 'none' })
      }
    } catch (error) {
      console.error('删除分身失败:', error)
      showToast({ title: '删除失败', icon: 'none' })
    }
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
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#fff" />
          </View>
          <Text className="header-title">我的分身</Text>
          <Button className="create-btn-small" onClick={createNewAvatar}>
            <Plus size={16} color="#00f5ff" />
            <Text className="create-text-small">创建</Text>
          </Button>
        </View>
        <View className="header-right-placeholder" style={{ width: `${capsulePlaceholderWidth}rpx` }} />
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

        {/* 分身列表 - 加载中 */}
        {loadingAvatars ? (
          <View className="flex justify-center items-center py-20">
            <Text className="block text-gray-400">加载中...</Text>
          </View>
        ) : avatars.length === 0 ? (
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
                    {avatar.avatarUrl && avatar.avatarUrl.trim() !== '' ? (
                      <Image
                        src={avatar.avatarUrl}
                        className={`avatar-img style-${avatar.appearance_style || 'real'}`}
                        mode="aspectFill"
                      />
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
                    <Text className="avatar-personality">{getPersonalityName(avatar.personality)}</Text>
                  </View>
                  <View className="avatar-actions">
                    <View
                      className="action-btn delete-btn"
                      onClick={() => {
                        Taro.showModal({
                          title: '确认删除',
                          content: `确定要删除分身"${avatar.name}"吗？此操作不可恢复。`,
                          confirmColor: '#ff4444',
                          success: (res) => {
                            if (res.confirm) {
                              deleteAvatar(avatar.id)
                            }
                          }
                        })
                      }}
                    >
                      <Trash2 size={18} color="#ff4444" />
                    </View>
                    <View className="action-btn" onClick={() => goToSettings(avatar.id)}>
                      <Settings size={24} color="#ffffff" />
                    </View>
                  </View>
                </View>

                {/* 托管开关 */}
                <View className="hosting-section">
                  <View className="hosting-header">
                    <View className="hosting-title-wrap">
                      <Zap size={18} color={avatar.trust_enabled ? '#00f5ff' : 'rgba(255,255,255,0.3)'} />
                      <Text className="hosting-title">自动托管</Text>
                      {avatar.trust_enabled && (
                        <View className="hosting-badge">
                          <Text className="hosting-badge-text">运行中</Text>
                        </View>
                      )}
                    </View>
                    <Switch 
                      checked={avatar.trust_enabled || false}
                      onCheckedChange={(checked) => toggleHosting(avatar.id, checked)}
                    />
                  </View>
                  
                  {avatar.trust_enabled && (
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
                          <View className="feature-info">
                            <Text className="feature-text">自动发帖</Text>
                            {/* 🔴 添加等级/订阅提示 */}
                            {!userSubscription && (avatar.level || 1) < 8 && (
                              <Text className="feature-hint">Lv.8开启图文</Text>
                            )}
                            {userSubscription && (
                              <Text className="feature-hint premium">
                                {userSubscription.plan?.name?.includes('尊享') ? '尊享版' : 
                                 userSubscription.plan?.name?.includes('高级') ? '高级版' : '基本版'}
                              </Text>
                            )}
                          </View>
                          <Switch
                            checked={avatar.hosting_settings?.auto_post ?? false}
                            onCheckedChange={async (checked) => {
                              if (!avatar.trust_enabled) {
                                showToast({ title: '请先开启托管', icon: 'none' })
                                return
                              }
                              // 🔴 检查发帖权限
                              if (checked) {
                                const level = avatar.level || 1
                                const planName = userSubscription?.plan?.name?.toLowerCase() || ''
                                
                                // 无订阅且等级<8，只能发纯文字
                                if (!userSubscription && level < 8) {
                                  // 允许开启，但会有限制提示
                                  showToast({ title: `Lv.${level}每天限1条纯文字`, icon: 'none' })
                                } else if (level >= 8 && !userSubscription) {
                                  showToast({ title: `Lv.${level}每天2条文字+1条图文`, icon: 'success' })
                                } else if (planName.includes('尊享')) {
                                  showToast({ title: '尊享版：每天3条图文+每月2视频', icon: 'success' })
                                } else if (planName.includes('高级')) {
                                  showToast({ title: '高级版：每天2条图文+每月1视频', icon: 'success' })
                                } else if (planName.includes('基本')) {
                                  showToast({ title: '基本版：每天1条图文+每月1视频', icon: 'success' })
                                }
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
                              if (!avatar.trust_enabled) {
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
                              if (!avatar.trust_enabled) {
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
                              if (!avatar.trust_enabled) {
                                showToast({ title: '请先开启托管', icon: 'none' })
                                return
                              }
                              await updateHostingSettings(avatar.id, { auto_friend: checked })
                            }}
                          />
                        </View>

                        {/* 快速入口区域 */}
                        <View className="quick-entries">
                          <View
                            className="quick-entry-btn"
                            onClick={() => navigateTo({ url: `/pages/avatar/avatar-friends/index?avatarId=${avatar.id}` })}
                          >
                            <View className="quick-entry-icon">
                              <Users size={24} color="#06b6d4" />
                            </View>
                            <Text className="quick-entry-label">好友列表</Text>
                          </View>
                          <View
                            className="quick-entry-btn"
                            onClick={() => {
                              // 通话功能
                              showToast({ title: '通话功能开发中', icon: 'none' })
                            }}
                          >
                            <View className="quick-entry-icon">
                              <Phone size={24} color="#06b6d4" />
                            </View>
                            <Text className="quick-entry-label">通话</Text>
                          </View>
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
