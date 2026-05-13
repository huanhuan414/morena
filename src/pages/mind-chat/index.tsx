// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getStatusBarHeight } from '@/utils/safe-area'
import { AVATAR_SKILL_MAP, CONTENT_STYLES, NICHE_TAGS } from '@/constants/avatar-tags'
import {
  Search,
  Plus,
  Phone,
  Zap,
  Loader,
  Sparkles,
  Users,
  Trash2,
  Coins,
  Crown,
  Flame,
  Star,
  Rocket,
  Award,
  ChevronsRight,
  Bot,
  Eye
} from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import './index.css'

type CloneType = 'my' | 'square'

// 分身等级计算
function getAvatarLevel(totalPosts: number, totalEarnings: number): { level: number; title: string; color: string; nextTitle: string; progress: number } {
  const score = totalPosts * 2 + Number(totalEarnings || 0) * 10
  if (score >= 1000) return { level: 5, title: '传奇分身', color: '#f59e0b', nextTitle: '已满级', progress: 100 }
  if (score >= 500) return { level: 4, title: '精英分身', color: '#8b5cf6', nextTitle: '传奇分身', progress: Math.min(100, (score - 500) / 500 * 100) }
  if (score >= 200) return { level: 3, title: '资深分身', color: '#3b82f6', nextTitle: '精英分身', progress: Math.min(100, (score - 200) / 300 * 100) }
  if (score >= 50) return { level: 2, title: '进阶分身', color: '#14b8a6', nextTitle: '资深分身', progress: Math.min(100, (score - 50) / 150 * 100) }
  return { level: 1, title: '新手分身', color: '#94a3b8', nextTitle: '进阶分身', progress: Math.min(100, score / 50 * 100) }
}

interface AvatarSkill {
  id: number
  skillName: string
  skillDescription?: string
  skillType?: string
  skillLevel?: number
  usageCount?: number
}

interface Avatar {
  id: string
  name: string
  role: string
  status: '在线' | '忙碌' | '离线'
  task: string
  income: string
  image: string
  hosting: boolean
  type: 'my' | 'square'
  posts: number
  followers?: number
  isFollowing?: boolean
  voice_id?: string
  personality?: string
  skills?: string
  created_at?: string
  totalEarnings?: number
  todayEarnings?: number
  tags?: string[]
  abilities?: string[]
  avatarSkills?: AvatarSkill[]
  contentStyles?: string[]
  nicheTags?: string[]
  parsedSkills?: string[]
}

const MindChat: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CloneType>('my')
  const [searchValue, setSearchValue] = useState('')
  const [myClones, setMyClones] = useState<Avatar[]>([])
  const [squareClones, setSquareClones] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false)
  const [newAvatarId, setNewAvatarId] = useState('')
  const { isLoggedIn } = useUserStore()
  const hasPageShownRef = useRef(false)
  const activeTabRef = useRef<CloneType>('my')

  const loadAvatarSkills = async (avatarId: string): Promise<AvatarSkill[]> => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/skills`,
        method: 'GET',
      })
      if (res.data?.code === 200 && res.data?.data?.data) {
        const rawSkills = res.data.data.data
        return (Array.isArray(rawSkills) ? rawSkills : []).map((s: any) => ({
          id: s.id,
          skillName: s.skillName || s.skill_name || '',
          skillDescription: s.skillDescription || s.skill_description || '',
          skillType: s.skillType || s.skill_type || '',
          skillLevel: Number(s.skillLevel || s.skill_level || 1),
          usageCount: Number(s.usageCount || s.usage_count || 0),
        }))
      }
      return []
    } catch {
      return []
    }
  }

  const parsePersonality = (personality: any) => {
    try {
      const p = typeof personality === 'string' ? JSON.parse(personality) : personality
      const tags = p?.tags || []
      const abilities = Object.entries(p?.abilities || {})
        .filter(([_, v]) => v)
        .map(([k]) => k)
      return { tags, abilities }
    } catch {
      return { tags: [], abilities: [] }
    }
  }

  const loadMyClones = useCallback(async () => {
    try {
      setLoading(true)
      if (!isLoggedIn) {
        setMyClones([])
        setLoading(false)
        return
      }

      const res = await Network.request({
        url: '/api/avatar',
        method: 'GET',
      })
      console.log('加载分身列表:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const rawData = res.data.data
        const data = Array.isArray(rawData) ? rawData : []
        // 并行加载所有分身的技能
        const skillsPromises = data.map((item: any) => loadAvatarSkills(item.id))
        const skillsResults = await Promise.all(skillsPromises)

        const avatars = data.map((item: any, idx: number) => {
          const { tags, abilities } = parsePersonality(item.personality)
          let roleLabel = '通用助手'
          if (tags.length) roleLabel = tags.slice(0, 3).join('·')
          
          return {
            id: item.id || '',
            name: item.name || '未命名分身',
            role: item.description || roleLabel,
            status: (item.isHosted || item.trustEnabled || item.trust_enabled || item.hostingEnabled) ? '在线' as const : '离线' as const,
            task: '待命中',
            income: `¥${item.totalEarnings || item.todayEarnings || '0.00'}`,
            image: item.avatarUrl || item.avatar_url || item.photo || '',
            hosting: Boolean(item.isHosted || item.trustEnabled || item.trust_enabled || item.hostingEnabled),
            type: 'my',
            posts: item.totalPosts || 0,
            voice_id: item.voiceId || item.voice_id,
            personality: item.personality,
            skills: item.skills,
            created_at: item.createdAt || item.created_at,
            totalEarnings: Number(item.totalEarnings || 0),
            todayEarnings: Number(item.todayEarnings || 0),
            tags,
            abilities,
            avatarSkills: skillsResults[idx] || [],
            contentStyles: Array.isArray(item.contentStyles) ? item.contentStyles : (typeof item.contentStyles === 'string' ? JSON.parse(item.contentStyles || '[]') : []),
            nicheTags: Array.isArray(item.nicheTags) ? item.nicheTags : (typeof item.nicheTags === 'string' ? JSON.parse(item.nicheTags || '[]') : []),
            parsedSkills: (() => {
              try {
                const s = typeof item.skills === 'string' ? JSON.parse(item.skills) : item.skills
                if (s && typeof s === 'object') {
                  return Object.keys(s).filter(k => s[k] === true)
                }
                return []
              } catch { return [] }
            })()
          }
        })
        console.log('处理后的分身列表:', avatars)
        setMyClones(avatars)
      } else {
        setMyClones([])
      }
    } catch (error) {
      console.error('加载分身失败:', error)
      setMyClones([])
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  const loadSquareClones = useCallback(async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/avatar/list',
        method: 'GET'
      })
      console.log('加载分身广场:', res.data)
      
      if (res.data?.code === 200) {
        const listData = res.data?.data?.data?.list || res.data?.data?.list || []
        const avatars = listData.slice(0, 6).map((item: any) => {
          const { tags, abilities } = parsePersonality(item.personality)
          let roleLabel = '通用助手'
          if (tags.length) roleLabel = tags.slice(0, 3).join('·')
          
          return {
            id: item.id || '',
            name: item.name || '未命名分身',
            role: roleLabel,
            tags,
            abilities,
            posts: item.posts || 0,
            followers: item.followers || 0,
            image: item.avatarUrl || item.avatar_url || item.photo || '',
            type: 'square' as const,
            isFollowing: false,
            status: '在线' as const,
            task: '待命中',
            hosting: false,
            totalEarnings: 0,
            todayEarnings: 0
          }
        })
        setSquareClones(avatars)
      } else {
        setSquareClones([])
      }
    } catch (error) {
      console.error('加载分身广场失败:', error)
      setSquareClones([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCurrentTabData = useCallback(async () => {
    if (activeTabRef.current === 'my') {
      await loadMyClones()
      return
    }
    await loadSquareClones()
  }, [loadMyClones, loadSquareClones])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    hasPageShownRef.current = true
    void loadCurrentTabData()
  }, [])

  useDidShow(() => {
    if (hasPageShownRef.current) {
      void loadCurrentTabData()
    }
    hasPageShownRef.current = true

    // 检测是否从创建分身页面跳转过来（引导开启托管）
    // switchTab 不支持 query 参数，使用 Storage 传递
    const newAvatarIdFromStorage = Taro.getStorageSync('onboarding_new_avatar_id')
    if (newAvatarIdFromStorage) {
      Taro.removeStorageSync('onboarding_new_avatar_id')
      setNewAvatarId(newAvatarIdFromStorage)
      // 延迟显示引导弹窗，等数据加载完
      setTimeout(() => {
        setShowOnboardingDialog(true)
      }, 1500)
    }
  })

  useEffect(() => {
    if (!hasPageShownRef.current) return
    void loadCurrentTabData()
  }, [activeTab, loadCurrentTabData])

  const filteredClones = (activeTab === 'my' ? myClones : squareClones).filter(clone =>
    clone.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleToggleHosting = async (id: string, checked: boolean) => {
    const previous = myClones
    setMyClones(prev =>
      prev.map(clone =>
        clone.id === id
          ? { ...clone, hosting: checked, status: checked ? '在线' : '离线' }
          : clone
      )
    )

    try {
      const res = await Network.request({
        url: `/api/avatar/${id}/trust`,
        method: 'PUT',
        data: { trust_enabled: checked },
      })
      if (res.data?.code !== 200) {
        throw new Error(res.data?.msg || '更新失败')
      }
      console.log('更新托管状态成功:', id, checked)
      if (checked) {
        Taro.showToast({ title: '托管已开启，分身将自动接单赚钱', icon: 'none', duration: 2000 })
      }
    } catch (error) {
      setMyClones(previous)
      console.error('更新托管状态失败:', error)
      Taro.showToast({ title: '更新失败', icon: 'none' })
    }
  }

  const openAvatarFriends = (_avatarId: string) => {
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const handleMyCloneVoice = (avatarId: string) => {
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const handleSquareConnect = () => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const handleSquareVoice = () => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const deleteAvatar = async (avatarId: string) => {
    const res = await Taro.showModal({ title: '确认删除', content: '删除后无法恢复，确定要删除这个分身吗？' })
    if (!res.confirm) return
    try {
      const result = await Network.request({
        url: `/api/avatar/${avatarId}`,
        method: 'DELETE'
      })
      console.log('deleteAvatar result:', result)
      Taro.showToast({ title: '删除成功', icon: 'success' })
      loadMyClones()
    } catch (err) {
      console.error('deleteAvatar error:', err)
      Taro.showToast({ title: '删除失败', icon: 'error' })
    }
  }

  // 总收益统计
  const totalEarningsAll = myClones.reduce((sum, c) => sum + (c.totalEarnings || 0), 0)
  const todayEarningsAll = myClones.reduce((sum, c) => sum + (c.todayEarnings || 0), 0)
  const hostingCount = myClones.filter(c => c.hosting).length
  const hasAnyClone = myClones.length > 0

  return (
    <View className="mind-chat-page">
      {/* 顶部渐变背景 */}
      <View className="page-header" style={{ paddingTop: `${getStatusBarHeight() + 25}px` }}>
        <View className="header-decoration">
          <View className="decoration-circle circle-1" />
          <View className="decoration-circle circle-2" />
        </View>
        
        {/* Tab切换 */}
        <View className="header-tabs">
          <View
            className={cn('header-tab', activeTab === 'my' && 'active')}
            onClick={() => setActiveTab('my')}
          >
            <Text className="tab-label">我的分身</Text>
            {activeTab === 'my' && <View className="tab-indicator" />}
          </View>
          <View
            className={cn('header-tab', activeTab === 'square' && 'active')}
            onClick={() => setActiveTab('square')}
          >
            <Text className="tab-label">分身广场</Text>
            {activeTab === 'square' && <View className="tab-indicator" />}
          </View>
        </View>

        {/* 搜索和操作栏 */}
        <View className="search-section">
          <View className="search-wrapper">
            <View className="search-icon-wrapper">
              <Search size={16} />
            </View>
            <Input
              className="search-input"
              placeholder="搜索分身..."
              value={searchValue}
              onInput={(e: any) => setSearchValue(e.detail.value)}
            />
          </View>
          {activeTab === 'my' && (
            <View 
              className="add-button"
              onClick={() => Taro.navigateTo({ url: '/package-avatar/pages/avatar-create/index' })}
            >
              <Plus size={18} color="#ffffff" />
              <Text className="add-button-text">新建</Text>
            </View>
          )}
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="content-scroll" scrollY>
        {loading ? (
          <View className="loading-state">
            <Loader size={32} className="animate-spin" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : activeTab === 'my' ? (
          /* ====== 我的分身 Tab ====== */
          <View className="my-tab-content">
            {/* 收益概览条 - 有分身时显示 */}
            {hasAnyClone && (
              <View className="earnings-overview">
                <View className="earnings-overview-left">
                  <Coins size={18} color="#f59e0b" />
                  <View className="earnings-overview-info">
                    <Text className="earnings-overview-label">今日收益</Text>
                    <Text className="earnings-overview-value">¥{todayEarningsAll.toFixed(2)}</Text>
                  </View>
                </View>
                <View className="earnings-overview-right">
                  <View className="earnings-overview-stat">
                    <Text className="earnings-overview-stat-value">¥{totalEarningsAll.toFixed(2)}</Text>
                    <Text className="earnings-overview-stat-label">累计</Text>
                  </View>
                  <View className="earnings-overview-divider" />
                  <View className="earnings-overview-stat">
                    <Text className="earnings-overview-stat-value">{hostingCount}/{myClones.length}</Text>
                    <Text className="earnings-overview-stat-label">托管中</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 空状态 - 新手引导 */}
            {filteredClones.length === 0 ? (
              <View className="empty-state">
                <View className="empty-icon-wrap">
                  <Sparkles size={56} color="rgba(99, 102, 241, 0.8)" />
                </View>
                <Text className="empty-title">
                  {searchValue ? '没有匹配结果' : isLoggedIn ? '创建你的第一个AI分身' : '请先登录'}
                </Text>
                {!searchValue && isLoggedIn && (
                  <View className="onboarding-guide">
                    <Text className="onboarding-guide-title">AI分身能为你做什么？</Text>
                    
                    <View className="guide-step">
                      <View className="guide-step-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <Bot size={20} color="#6366f1" />
                      </View>
                      <View className="guide-step-content">
                        <Text className="guide-step-title">替你接单赚钱</Text>
                        <Text className="guide-step-desc">开启托管后，分身自动帮你接单创作内容</Text>
                      </View>
                    </View>

                    <View className="guide-step">
                      <View className="guide-step-icon" style={{ background: 'rgba(245,158,11,0.1)' }}>
                        <Coins size={20} color="#f59e0b" />
                      </View>
                      <View className="guide-step-content">
                        <Text className="guide-step-title">24小时不间断</Text>
                        <Text className="guide-step-desc">睡觉也在赚钱，真正的睡后收入</Text>
                      </View>
                    </View>

                    <View className="guide-step">
                      <View className="guide-step-icon" style={{ background: 'rgba(236,72,153,0.1)' }}>
                        <Crown size={20} color="#ec4899" />
                      </View>
                      <View className="guide-step-content">
                        <Text className="guide-step-title">越用越强</Text>
                        <Text className="guide-step-desc">分身等级提升，接单能力越强，收益越高</Text>
                      </View>
                    </View>

                    <View className="guide-step">
                      <View className="guide-step-icon" style={{ background: 'rgba(20,184,166,0.1)' }}>
                        <Flame size={20} color="#14b8a6" />
                      </View>
                      <View className="guide-step-content">
                        <Text className="guide-step-title">丰富技能随你选</Text>
                        <Text className="guide-step-desc">看手相/衣品改造/图片生成/视频生成，打造全能分身</Text>
                      </View>
                    </View>

                    <View
                      className="guide-create-btn"
                      onClick={() => Taro.navigateTo({ url: '/package-avatar/pages/avatar-create/index' })}
                    >
                      <Rocket size={16} color="#ffffff" />
                      <Text className="guide-create-btn-text">0元创建 · 立即开始赚钱</Text>
                    </View>
                  </View>
                )}
                {!isLoggedIn && activeTab === 'my' && !searchValue && (
                  <View
                    className="login-redirect-btn"
                    onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
                  >
                    <Text className="login-redirect-text">去登录</Text>
                  </View>
                )}
              </View>
            ) : (
              /* 分身卡片列表 */
              <View className="my-clones-list">
                {filteredClones.map((clone, index) => {
                  const levelInfo = getAvatarLevel(clone.posts, clone.totalEarnings || 0)
                  return (
                    <View key={clone.id} className="clone-card" style={{ animationDelay: `${index * 0.1}s` }}>
                      {/* 封面 */}
                      <View className="clone-cover">
                        <Image className="cover-image" src={clone.image} mode="aspectFill" />
                        <View className="cover-gradient" />
                        
                        {/* 等级标签 */}
                        <View className="level-badge" style={{ background: levelInfo.color }}>
                          <Crown size={11} color="#ffffff" />
                          <Text className="level-badge-text">Lv.{levelInfo.level} {levelInfo.title}</Text>
                        </View>

                        {/* 托管状态 */}
                        <View className={cn('status-badge', clone.hosting ? 'hosting' : 'offline')}>
                          <View className={cn('status-dot', clone.hosting ? 'hosting' : 'offline')} />
                          <Text className="status-label">{clone.hosting ? '托管中' : '未托管'}</Text>
                        </View>

                        {/* 收益指示 */}
                        <View className="earning-indicator">
                          <Coins size={11} color="#fbbf24" />
                          <Text className="earning-indicator-text">今日 ¥{(clone.todayEarnings || 0).toFixed(2)}</Text>
                        </View>

                        {/* 底部信息 */}
                        <View className="cover-footer">
                          <View className="clone-profile">
                            <Image className="profile-avatar" src={clone.image} />
                            <View className="profile-info">
                              <Text className="profile-name">{clone.name}</Text>
                              <Text className="profile-total-earn">累计 ¥{(clone.totalEarnings || 0).toFixed(2)}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* 技能展示区 */}
                      <View className="skills-section">
                        <View className="skills-header">
                          <Sparkles size={13} color="#8b5cf6" />
                          <Text className="skills-title">技能</Text>
                          {clone.parsedSkills.length === 0 && (
                            <View 
                              className="add-skill-btn"
                              onClick={() => Taro.navigateTo({ url: `/package-skill/pages/skills-square/index?avatarId=${clone.id}` })}
                            >
                              <Plus size={11} color="#8b5cf6" />
                              <Text className="add-skill-text">添加技能</Text>
                            </View>
                          )}
                        </View>
                        <View className="skills-tags">
                          {clone.parsedSkills.length > 0 ? (
                            <>
                              {clone.parsedSkills.slice(0, 4).map((skillKey) => {
                                const skillInfo = AVATAR_SKILL_MAP[skillKey] || { label: skillKey, color: '#6366f1', icon: 'Sparkles' }
                                return (
                                  <View className="skill-tag" key={skillKey} style={{ background: `${skillInfo.color}18` }}>
                                    <Sparkles size={10} color={skillInfo.color} />
                                    <Text className="skill-tag-text" style={{ color: skillInfo.color }}>{skillInfo.label}</Text>
                                  </View>
                                )
                              })}
                              {clone.parsedSkills.length > 4 && (
                                <View className="skill-tag more-tag">
                                  <Text className="skill-tag-text" style={{ color: '#94a3b8' }}>+{clone.parsedSkills.length - 4}</Text>
                                </View>
                              )}
                              <View 
                                className="skill-tag add-skill-tag"
                                onClick={() => Taro.navigateTo({ url: `/package-skill/pages/skills-square/index?avatarId=${clone.id}` })}
                              >
                                <Plus size={10} color="#8b5cf6" />
                                <Text className="skill-tag-text" style={{ color: '#8b5cf6' }}>添加</Text>
                              </View>
                            </>
                          ) : (
                            <View 
                              className="skill-tag add-skill-tag"
                              onClick={() => Taro.navigateTo({ url: `/package-skill/pages/skills-square/index?avatarId=${clone.id}` })}
                            >
                              <Plus size={10} color="#8b5cf6" />
                              <Text className="skill-tag-text" style={{ color: '#8b5cf6' }}>添加技能</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* 内容风格 + 专业领域 */}
                      {(clone.contentStyles?.length > 0 || clone.nicheTags?.length > 0) && (
                        <View className="tags-section">
                          {clone.contentStyles?.length > 0 && (
                            <View className="tags-row">
                              <Text className="tags-label">风格</Text>
                              <View className="tags-list">
                                {clone.contentStyles.slice(0, 3).map((style) => {
                                  const styleInfo = CONTENT_STYLES.find(s => s.key === style)
                                  return (
                                    <View className="avatar-style-tag" key={style} style={{ background: 'rgba(168,85,247,0.1)' }}>
                                      <Text className="avatar-style-tag-text" style={{ color: '#a855f7' }}>{styleInfo?.label || style}</Text>
                                    </View>
                                  )
                                })}
                              </View>
                            </View>
                          )}
                          {clone.nicheTags?.length > 0 && (
                            <View className="tags-row">
                              <Text className="tags-label">领域</Text>
                              <View className="tags-list">
                                {clone.nicheTags.slice(0, 3).map((niche) => {
                                  const nicheInfo = NICHE_TAGS.find(n => n.key === niche)
                                  return (
                                    <View className="avatar-niche-tag" key={niche} style={{ background: 'rgba(249,115,22,0.1)' }}>
                                      <Text className="avatar-niche-tag-text" style={{ color: '#f97316' }}>{nicheInfo?.label || niche}</Text>
                                    </View>
                                  )
                                })}
                              </View>
                            </View>
                          )}
                        </View>
                      )}

                      {/* 等级进度条 */}
                      <View className="level-progress-section">
                        <View className="level-progress-header">
                          <Text className="level-progress-current" style={{ color: levelInfo.color }}>{levelInfo.title}</Text>
                          <Text className="level-progress-next">
                            {levelInfo.nextTitle !== '已满级' ? `下一级: ${levelInfo.nextTitle}` : '已满级'}
                          </Text>
                        </View>
                        <View className="level-progress-bar">
                          <View className="level-progress-fill" style={{ width: `${levelInfo.progress}%`, background: levelInfo.color }} />
                        </View>
                        <View className="level-progress-stats">
                          <Text className="level-progress-stat">{clone.posts}篇内容</Text>
                          <Text className="level-progress-stat">{levelInfo.progress.toFixed(0)}%</Text>
                        </View>
                      </View>

                      {/* 操作栏 - 重设计 */}
                      <View className="clone-toolbar">
                        <View className="toolbar-actions">
                          <View className="toolbar-btn toolbar-btn-primary" onClick={() => Taro.navigateTo({ url: `/package-avatar/pages/generated-content/index?avatarId=${clone.id}` })}>
                            <Eye size={14} color="#6366f1" />
                            <Text className="toolbar-label-primary">作品</Text>
                          </View>
                          <View className="toolbar-btn" onClick={() => openAvatarFriends(clone.id)}>
                            <Users size={14} />
                            <Text className="toolbar-label">好友</Text>
                          </View>
                          <View className="toolbar-btn" onClick={() => handleMyCloneVoice(clone.id)}>
                            <Phone size={14} />
                            <Text className="toolbar-label">通话</Text>
                          </View>
                          <View className="toolbar-btn toolbar-btn-danger" onClick={() => deleteAvatar(clone.id)}>
                            <Trash2 size={14} />
                            <Text className="toolbar-label-danger">删除</Text>
                          </View>
                        </View>
                        <View className={cn('hosting-control', clone.hosting && 'hosting-active')}>
                          <Zap size={12} color={clone.hosting ? '#f59e0b' : '#8b5cf6'} />
                          <Text className={cn('hosting-label', clone.hosting && 'hosting-label-active')}>
                            {clone.hosting ? '托管赚钱中' : '开启托管'}
                          </Text>
                          <Switch
                            checked={clone.hosting || false}
                            onCheckedChange={(checked) => handleToggleHosting(clone.id, checked)}
                          />
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        ) : (
          /* ====== 分身广场 Tab ====== */
          <View className="square-tab-content">
            {/* 广场头部引导 */}
            <View className="square-hero">
              <View className="square-hero-left">
                <Star size={18} color="#f59e0b" />
                <View className="square-hero-info">
                  <Text className="square-hero-title">发现有趣的AI分身</Text>
                  <Text className="square-hero-desc">关注、交友、一起玩耍</Text>
                </View>
              </View>
              {hasAnyClone && (
                <View className="square-hero-badge">
                  <Award size={14} color="#8b5cf6" />
                  <Text className="square-hero-badge-text">已有{myClones.length}个分身</Text>
                </View>
              )}
            </View>

            {squareClones.length === 0 ? (
              <View className="empty-state">
                <View className="empty-icon-wrap">
                  <Users size={56} color="rgba(99, 102, 241, 0.6)" />
                </View>
                <Text className="empty-title">暂无内容</Text>
                <Text className="empty-desc">稍后再来看看吧</Text>
              </View>
            ) : (
              <View className="square-cards-grid">
                {squareClones.map((clone) => (
                  <View key={clone.id} className="square-card">
                    {/* 头像区 */}
                    <View className="square-card-top">
                      <View className="square-avatar-wrapper">
                        <Image className="square-avatar" src={clone.image} mode="aspectFill" />
                        <View className="avatar-online-dot" />
                      </View>
                      <Text className="square-card-name">{clone.name}</Text>
                      
                      {/* 技能标签 */}
                      <View className="square-card-tags">
                        {(clone.parsedSkills || []).slice(0, 2).map((skillKey) => {
                          const skillInfo = AVATAR_SKILL_MAP[skillKey] || { label: skillKey, color: '#6366f1' }
                          return (
                            <View className="square-skill-tag" key={skillKey} style={{ background: `${skillInfo.color}18` }}>
                              <Text className="square-skill-tag-text" style={{ color: skillInfo.color }}>{skillInfo.label}</Text>
                            </View>
                          )
                        })}
                        {(clone.contentStyles || []).slice(0, 1).map((style) => {
                          const styleInfo = CONTENT_STYLES.find(s => s.value === style)
                          return styleInfo ? (
                            <View className="square-skill-tag" key={style} style={{ background: `${styleInfo.color}18` }}>
                              <Text className="square-skill-tag-text" style={{ color: styleInfo.color }}>{styleInfo.label}</Text>
                            </View>
                          ) : null
                        })}
                      </View>

                      {/* 能力图标 */}
                      <View className="square-card-abilities">
                        {(clone.parsedSkills || []).slice(0, 3).map((skillKey) => {
                          const skillInfo = AVATAR_SKILL_MAP[skillKey]
                          return skillInfo ? <Sparkles key={skillKey} size={14} color={skillInfo.color} /> : null
                        })}
                      </View>
                    </View>

                    {/* 操作 */}
                    <View className="square-card-actions">
                      <View className="square-action-btn square-voice-btn" onClick={handleSquareVoice}>
                        <Phone size={13} color="#6366f1" />
                        <Text className="square-action-text">通话</Text>
                      </View>
                      <View className="square-action-btn square-follow-btn" onClick={handleSquareConnect}>
                        <ChevronsRight size={13} color="#ffffff" />
                        <Text className="square-action-text-white">交友</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        
        <View className="bottom-spacer" />
      </ScrollView>

      {/* 创建成功引导弹窗 */}
      {showOnboardingDialog && (
        <View className="onboarding-overlay" onClick={() => setShowOnboardingDialog(false)}>
          <View className="onboarding-dialog" onClick={(e) => e.stopPropagation()}>
            <View className="onboarding-dialog-header">
              <Coins size={28} color="#f59e0b" />
              <Text className="onboarding-dialog-title">分身创建成功！</Text>
            </View>
            <Text className="onboarding-dialog-desc">
              开启托管后，你的AI分身将24小时自动接单赚钱，即使你睡觉也在为你创造收益
            </Text>
            <View className="onboarding-dialog-benefits">
              <View className="onboarding-benefit-item">
                <Sparkles size={16} color="#8b5cf6" />
                <Text className="onboarding-benefit-text">自动接单，无需手动操作</Text>
              </View>
              <View className="onboarding-benefit-item">
                <Coins size={16} color="#f59e0b" />
                <Text className="onboarding-benefit-text">24小时不间断赚钱</Text>
              </View>
              <View className="onboarding-benefit-item">
                <Crown size={16} color="#3b82f6" />
                <Text className="onboarding-benefit-text">接单越多能力越强</Text>
              </View>
            </View>
            <View className="onboarding-dialog-actions">
              <View
                className="onboarding-btn onboarding-btn-primary"
                onClick={async () => {
                  // 开启托管
                  if (newAvatarId) {
                    try {
                      await Network.request({
                        url: `/api/avatar/${newAvatarId}/hosting`,
                        method: 'POST',
                        data: { enabled: true },
                      })
                      Taro.showToast({ title: '托管已开启，开始赚钱！', icon: 'success' })
                      void loadMyClones()
                    } catch {
                      Taro.showToast({ title: '开启失败，请稍后重试', icon: 'none' })
                    }
                  }
                  setShowOnboardingDialog(false)
                }}
              >
                <Text className="onboarding-btn-primary-text">立即开启托管</Text>
              </View>
              <View
                className="onboarding-btn onboarding-btn-secondary"
                onClick={() => setShowOnboardingDialog(false)}
              >
                <Text className="onboarding-btn-secondary-text">稍后再说</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default MindChat
