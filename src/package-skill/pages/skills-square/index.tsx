import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, CircleCheckBig, Plus, Sparkles, TrendingUp, Zap, Star, Users, Coins, ChevronRight } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

interface Skill {
  id: string
  name: string
  description: string
  category: string
  icon: string
  rating: number
  usageCount: number
  price: number
  tags: string[]
}

interface AvatarSkill {
  skillId: string
  skillName: string
  category: string
  icon: string
}

const SKILL_ICON_MAP: Record<string, { bg: string; color: string; Icon: typeof Sparkles }> = {
  content: { bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', color: '#fff', Icon: Sparkles },
  image: { bg: 'linear-gradient(135deg, #06B6D4, #0891B2)', color: '#fff', Icon: Zap },
  video: { bg: 'linear-gradient(135deg, #EC4899, #DB2777)', color: '#fff', Icon: TrendingUp },
  life: { bg: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', Icon: Coins },
  audio: { bg: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', Icon: Star },
}

const CATEGORY_LABELS: Record<string, string> = {
  content: '内容创作',
  video: '视频制作',
  image: '图片生成',
  audio: '音频处理',
  music: '音乐推荐',
  life: '生活服务',
}

const EARNING_MAP: Record<string, string> = {
  content: '可赚¥3-15/单',
  image: '可赚¥2-10/单',
  video: '可赚¥5-30/单',
  life: '可赚¥2-8/单',
  audio: '可赚¥3-12/单',
}

export default function SkillsSquare() {
  const statusBarHeight = getStatusBarHeight()
  const avatarId = (() => {
    try {
      const instance = Taro.getCurrentInstance()
      return instance?.router?.params?.avatarId || ''
    } catch {
      return ''
    }
  })()

  const [skills, setSkills] = useState<Skill[]>([])
  const [avatarSkills, setAvatarSkills] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [addingSkill, setAddingSkill] = useState<string | null>(null)
  const [skillUsage, setSkillUsage] = useState<Record<string, {
    allowed: boolean
    reason?: string
    dailyLimit: number
    usedToday: number
    remaining: number
    speed?: string
    planName: string
  }>>({})

  useDidShow(() => {
    loadSkills()
  })

  const loadSkills = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/skills' })
      const rawSkills = res?.data?.data || []
      // 映射字段名：usage_count -> usageCount
      const allSkills = rawSkills.map((s: any) => ({
        ...s,
        usageCount: s.usage_count || s.usageCount || 0
      }))
      setSkills(allSkills)

      if (avatarId) {
        const avatarRes = await Network.request({ url: `/api/skills/avatar/${avatarId}` })
        const aSkills = avatarRes?.data?.data || []
        setAvatarSkills(aSkills.map((s: AvatarSkill) => s.skillId))
      }

      // 获取用户技能使用情况
      try {
        const userInfo = Taro.getStorageSync('userInfo')
        const userId = userInfo?.id
        if (userId && allSkills.length > 0) {
          const skillIds = allSkills.map((s: Skill) => s.id)
          const usageRes = await Network.request({
            url: '/api/subscription/batch-skill-usage',
            method: 'POST',
            data: { userId, skillTypes: skillIds }
          })
          const usageData = usageRes?.data?.data || {}
          setSkillUsage(usageData)
        }
      } catch (e) {
      }
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }

  const handleAddSkill = async (skillId: string) => {
    if (!avatarId || addingSkill) return
    try {
      setAddingSkill(skillId)
      await Network.request({
        url: `/api/skills/avatar/${avatarId}/${skillId}`,
        method: 'POST'
      })
      setAvatarSkills(prev => [...prev, skillId])
      Taro.showToast({ title: '添加成功', icon: 'success' })
    } catch (err) {
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      setAddingSkill(null)
    }
  }

  const handleRemoveSkill = async (skillId: string) => {
    if (!avatarId || addingSkill) return
    try {
      setAddingSkill(skillId)
      await Network.request({
        url: `/api/skills/avatar/${avatarId}/${skillId}`,
        method: 'DELETE'
      })
      setAvatarSkills(prev => prev.filter(id => id !== skillId))
      Taro.showToast({ title: '已移除', icon: 'success' })
    } catch (err) {
      Taro.showToast({ title: '移除失败', icon: 'none' })
    } finally {
      setAddingSkill(null)
    }
  }

  const handleTrySkill = (skill: Skill) => {
    // 次数用完仍可进入页面查看，仅在页面内生成时拦截
    const hexId = skill.id
    // 掌相阅读和衣品改造有专门的体验页面
    if (hexId === 'palm_reading') {
      Taro.navigateTo({
        url: `/package-skill/pages/palm-reading/index?skillId=${hexId}&skillName=${encodeURIComponent(skill.name)}`,
      })
      return
    }
    if (hexId === 'fashion_advice') {
      Taro.navigateTo({
        url: `/package-skill/pages/fashion-makeover/index?skillId=${hexId}&skillName=${encodeURIComponent(skill.name)}`,
      })
      return
    }
    if (hexId === 'content_writing') {
      Taro.navigateTo({
        url: `/package-skill/pages/wechat-mp-article/index?skillId=${hexId}&skillName=${encodeURIComponent(skill.name)}`,
      })
      return
    }
    Taro.navigateTo({
      url: `/package-skill/pages/skill-try/index?skillId=${hexId}&skillName=${encodeURIComponent(skill.name)}&category=${encodeURIComponent(skill.category)}`,
    })
  }

  const formatCount = (n: number) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
  }

  const visibleSkills = skills
  const isAdded = (skillId: string) => avatarSkills.includes(skillId)

  const getIconConfig = (category: string) => SKILL_ICON_MAP[category] || SKILL_ICON_MAP.content

  return (
    <View className="skills-page">
      {/* 顶部紫蓝渐变头部 - 与首页完全一致 */}
      <View className="skills-header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
        <View className="skills-header-bg" />
        {/* 装饰圆 */}
        <View className="skills-deco-circle skills-deco-1" />
        <View className="skills-deco-circle skills-deco-2" />
        <View className="skills-header-content">
          <View className="skills-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="skills-header-center">
            <Text className="block skills-header-title">技能广场</Text>
            <Text className="block skills-header-sub">为分身装配技能，自动接单赚钱</Text>
          </View>
          <View className="skills-header-right" />
        </View>
      </View>

      <View className="skills-body">
        {/* 价值引导 - 与首页新手攻略同风格 */}
        <View className="skills-guide-card">
          <View className="skills-guide-header">
            <View className="skills-guide-header-left">
              <View className="skills-title-dot" />
              <Text className="block skills-guide-title">为什么要添加技能</Text>
            </View>
            <View className="skills-guide-badge">
              <Text className="block skills-guide-badge-text">收益攻略</Text>
            </View>
          </View>
          <View className="skills-guide-steps">
            <View className="skills-guide-step">
              <View className="skills-step-num">
                <Text className="block skills-step-num-text">1</Text>
              </View>
              <View className="skills-step-content">
                <Text className="block skills-step-title">添加技能</Text>
                <Text className="block skills-step-desc">每个技能代表一种接单能力</Text>
              </View>
            </View>
            <View className="skills-step-connector" />
            <View className="skills-guide-step">
              <View className="skills-step-num skills-step-num-2">
                <Text className="block skills-step-num-text">2</Text>
              </View>
              <View className="skills-step-content">
                <Text className="block skills-step-title">开启托管</Text>
                <Text className="block skills-step-desc">分身24h自动接单，无需操作</Text>
              </View>
            </View>
            <View className="skills-step-connector" />
            <View className="skills-guide-step">
              <View className="skills-step-num skills-step-num-3">
                <Text className="block skills-step-num-text">3</Text>
              </View>
              <View className="skills-step-content">
                <Text className="block skills-step-title">持续收益</Text>
                <Text className="block skills-step-desc">技能越多，接单越多，收入越高</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 已选状态条 - 与首页收益高亮条同风格 */}
        {avatarId && avatarSkills.length > 0 && (
          <View className="skills-status-bar">
            <View className="skills-status-left">
              <CircleCheckBig size={16} color="#10B981" />
              <Text className="block skills-status-label">已选择</Text>
              <Text className="block skills-status-count">{avatarSkills.length}</Text>
              <Text className="block skills-status-label">项技能</Text>
            </View>
            <View className="skills-status-right">
              <Text className="block skills-status-hint">可接更多类型订单</Text>
              <ChevronRight size={14} color="#10B981" />
            </View>
          </View>
        )}

        {/* 技能列表区块 - 与首页section同风格 */}
        <View className="skills-section">
          <View className="skills-section-header">
            <View className="skills-section-title-row">
              <View className="skills-title-dot" />
              <Text className="block skills-section-title">全部技能</Text>
              <View className="skills-count-badge">
                <Text className="block skills-count-text">{visibleSkills.length}</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View className="skills-loading">
              <View className="skills-loading-spinner" />
              <Text className="block skills-loading-text">加载中...</Text>
            </View>
          ) : (
            <View className="skills-grid">
              {visibleSkills.map(skill => {
                const added = isAdded(skill.id)
                const iconConfig = getIconConfig(skill.category)
                const IconComp = iconConfig.Icon
                const catLabel = CATEGORY_LABELS[skill.category] || '其他'
                const earnLabel = EARNING_MAP[skill.category] || '可赚¥2-10/单'
                const skillPrice = Number(skill.price) || 0
                return (
                  <View className="skill-card" key={skill.id}>
                    {/* 卡片顶部渐变装饰 */}
                    <View className="skill-card-top-accent" style={{ background: iconConfig.bg }} />

                    <View className="skill-card-body">
                      {/* 图标+名称 */}
                      <View className="skill-card-header">
                        <View className="skill-icon-wrap" style={{ background: iconConfig.bg }}>
                          <IconComp size={22} color="#fff" />
                        </View>
                        <View className="skill-card-title-area">
                          <Text className="block skill-card-name">{skill.name}</Text>
                          <View className="skill-card-tags">
                            <View className="skill-tag skill-tag-cat">
                              <Text className="block skill-tag-text">{catLabel}</Text>
                            </View>
                            {skillPrice > 0 && (
                              <View className="skill-tag skill-tag-price">
                                <Coins size={10} color="#8B5CF6" />
                                <Text className="block skill-tag-text-price">{skillPrice}币/次</Text>
                              </View>
                            )}
                            <View className="skill-tag skill-tag-earn">
                              <Coins size={10} color="#F59E0B" />
                              <Text className="block skill-tag-text-earn">{earnLabel}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* 描述 */}
                      <Text className="block skill-card-desc">{skill.description}</Text>

                      {/* 数据行 */}
                      <View className="skill-card-stats">
                        <View className="skill-stat">
                          <Star size={12} color="#FBBF24" />
                          <Text className="block skill-stat-val">{Number(skill.rating).toFixed(1)}</Text>
                        </View>
                        <View className="skill-stat-divider" />
                        <View className="skill-stat">
                          <Users size={12} color="#94A3B8" />
                          <Text className="block skill-stat-val">{formatCount(Number(skill.usageCount))}人使用</Text>
                        </View>
                      </View>

                      {/* 会员权益信息 */}
                      {skillUsage[skill.id] && (
                        <View className="skill-benefit-row">
                          <View className="skill-benefit-plan">
                            <Text className="block skill-benefit-plan-text">{skillUsage[skill.id].planName}</Text>
                          </View>
                          {skillUsage[skill.id].speed && (
                            <View className="skill-benefit-speed">
                              <Text className="block skill-benefit-speed-text">
                                {skillUsage[skill.id].speed === 'normal' && '普通速度'}
                                {skillUsage[skill.id].speed === 'fast' && '⚡加速生成'}
                                {skillUsage[skill.id].speed === 'ultra' && '🚀超速生成'}
                              </Text>
                            </View>
                          )}
                          {skillUsage[skill.id].dailyLimit !== 0 && (
                            <View className="skill-benefit-limit">
                              <Text className="block skill-benefit-limit-text" style={{ color: skillUsage[skill.id].remaining === 0 ? '#EF4444' : '#10B981' }}>
                                今日 {skillUsage[skill.id].usedToday}/{skillUsage[skill.id].dailyLimit === -1 ? '不限' : skillUsage[skill.id].dailyLimit} 次
                              </Text>
                            </View>
                          )}
                          {!skillUsage[skill.id].allowed && skillUsage[skill.id].reason && (
                            <View className="skill-benefit-warning">
                              <Text className="block skill-benefit-warning-text">{skillUsage[skill.id].reason}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* 操作按钮 */}
                      <View className="skill-card-action">
                        <View
                          className="skill-btn-try"
                          onClick={() => handleTrySkill(skill)}
                        >
                          <Sparkles size={14} color="#8B5CF6" />
                          <Text className="block skill-btn-try-text">体验</Text>
                        </View>
                        {avatarId && (
                          added ? (
                            <View
                              className="skill-btn-added"
                              onClick={() => handleRemoveSkill(skill.id)}
                            >
                              <CircleCheckBig size={16} color="#8B5CF6" />
                              <Text className="block skill-btn-added-text">已添加</Text>
                            </View>
                          ) : (
                            <View
                              className="skill-btn-add"
                              onClick={() => handleAddSkill(skill.id)}
                            >
                              {addingSkill === skill.id ? (
                                <Text className="block skill-btn-add-text">添加中...</Text>
                              ) : (
                                <>
                                  <Plus size={16} color="#fff" />
                                  <Text className="block skill-btn-add-text">添加</Text>
                                </>
                              )}
                            </View>
                          )
                        )}
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* 底部收益提示 - 与首页Banner同风格 */}
        {avatarId && avatarSkills.length > 0 && (
          <View className="skills-bottom-banner">
            <View className="skills-bottom-banner-bg" />
            <View className="skills-deco-circle skills-deco-3" />
            <View className="skills-deco-circle skills-deco-4" />
            <View className="skills-bottom-content">
              <View className="skills-bottom-tag">
                <Text className="block skills-bottom-tag-text">赚钱秘籍</Text>
              </View>
              <Text className="block skills-bottom-title">已选{avatarSkills.length}项技能</Text>
              <Text className="block skills-bottom-desc">开启托管后，分身将24h自动接单赚钱</Text>
              <View className="skills-bottom-btn" onClick={() => Taro.switchTab({ url: '/pages/mind-chat/index' })}>
                <Text className="block skills-bottom-btn-text">去开启托管</Text>
                <ChevronRight size={14} color="#6366F1" />
              </View>
            </View>
          </View>
        )}

        <View style={{ height: '60px' }} />
      </View>
    </View>
  )
}
