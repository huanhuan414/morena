import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, CircleCheck, Plus, Coins, Users, Star } from 'lucide-react-taro'
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

  useDidShow(() => {
    loadSkills()
  })

  const loadSkills = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/skills' })
      const allSkills = res?.data?.data || []
      setSkills(allSkills)

      if (avatarId) {
        const avatarRes = await Network.request({ url: `/api/skills/avatar/${avatarId}` })
        const aSkills = avatarRes?.data?.data || []
        setAvatarSkills(aSkills.map((s: AvatarSkill) => s.skillId))
      }
    } catch (err) {
      console.log('[SkillsSquare] 加载技能失败:', err)
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
      console.log('[SkillsSquare] 添加技能失败:', err)
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
      console.log('[SkillsSquare] 移除技能失败:', err)
      Taro.showToast({ title: '移除失败', icon: 'none' })
    } finally {
      setAddingSkill(null)
    }
  }

  const getCategoryLabel = (category: string) => {
    const map: Record<string, string> = {
      content: '内容创作',
      video: '视频制作',
      image: '图片生成',
      audio: '音频处理',
      music: '音乐推荐',
      life: '生活服务',
    }
    return map[category] || '其他'
  }

  const getCategoryColor = (category: string) => {
    const map: Record<string, string> = {
      content: '#8B5CF6',
      video: '#EC4899',
      image: '#06B6D4',
      audio: '#F97316',
      music: '#10B981',
      life: '#EF4444',
    }
    return map[category] || '#6B7280'
  }

  const formatCount = (n: number) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
  }

  const isAdded = (skillId: string) => avatarSkills.includes(skillId)

  return (
    <View className="skills-page">
      {/* 顶部紫蓝渐变头部 */}
      <View className="skills-header" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
        <View className="skills-header-bg" />
        <View className="skills-header-content">
          <View className="skills-header-left" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="skills-header-center">
            <Text className="skills-header-title block">技能广场</Text>
            <Text className="skills-header-sub block">为分身选择技能，开启自动接单</Text>
          </View>
          <View className="skills-header-right" />
        </View>
      </View>

      <ScrollView scrollY className="skills-body">
        {/* 价值引导卡 */}
        <View className="skills-value-card">
          <View className="skills-value-items">
            <View className="skills-value-item">
              <View className="skills-value-icon-wrap skills-value-icon-1">
                <Coins size={18} color="#8B5CF6" />
              </View>
              <Text className="block skills-value-text">添加技能</Text>
              <Text className="block skills-value-desc">接单赚钱</Text>
            </View>
            <View className="skills-value-divider" />
            <View className="skills-value-item">
              <View className="skills-value-icon-wrap skills-value-icon-2">
                <Star size={18} color="#6366F1" />
              </View>
              <Text className="block skills-value-text">技能越多</Text>
              <Text className="block skills-value-desc">订单越多</Text>
            </View>
            <View className="skills-value-divider" />
            <View className="skills-value-item">
              <View className="skills-value-icon-wrap skills-value-icon-3">
                <Users size={18} color="#4F46E5" />
              </View>
              <Text className="block skills-value-text">精准匹配</Text>
              <Text className="block skills-value-desc">高效交付</Text>
            </View>
          </View>
        </View>

        {avatarId && avatarSkills.length > 0 && (
          <View className="skills-status-bar">
            <Text className="block skills-status-text">
              已选择 {avatarSkills.length} 项技能，继续添加可接更多类型的订单
            </Text>
          </View>
        )}

        {/* 技能列表 */}
        <View className="skills-list">
          {loading ? (
            <View className="skills-loading">
              <Text className="block skills-loading-text">加载中...</Text>
            </View>
          ) : (
            skills.map(skill => {
              const added = isAdded(skill.id)
              const catColor = getCategoryColor(skill.category)
              return (
                <View className="skill-card" key={skill.id}>
                  <View className="skill-card-main">
                    {/* 左侧图标+分类 */}
                    <View className="skill-card-left">
                      <View className="skill-icon-wrap" style={{ background: `${catColor}15` }}>
                        <Text className="skill-icon-text">{skill.icon}</Text>
                      </View>
                      <View className="skill-card-info">
                        <View className="skill-card-name-row">
                          <Text className="block skill-card-name">{skill.name}</Text>
                          <View className="skill-category-tag" style={{ background: `${catColor}18`, borderColor: `${catColor}30` }}>
                            <Text className="block skill-category-text" style={{ color: catColor }}>
                              {getCategoryLabel(skill.category)}
                            </Text>
                          </View>
                        </View>
                        <Text className="block skill-card-desc">{skill.description}</Text>
                        <View className="skill-card-meta">
                          <View className="skill-meta-item">
                            <Star size={11} color="#FBBF24" />
                            <Text className="block skill-meta-text">{Number(skill.rating).toFixed(1)}</Text>
                          </View>
                          <View className="skill-meta-item">
                            <Users size={11} color="#9CA3AF" />
                            <Text className="block skill-meta-text">{formatCount(Number(skill.usageCount))}人使用</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* 右侧操作按钮 */}
                    {avatarId && (
                      <View className="skill-card-action">
                        {added ? (
                          <View
                            className="skill-btn skill-btn-added"
                            onClick={() => handleRemoveSkill(skill.id)}
                          >
                            <CircleCheck size={14} color="#8B5CF6" />
                            <Text className="block skill-btn-text-added">已添加</Text>
                          </View>
                        ) : (
                          <View
                            className="skill-btn skill-btn-add"
                            onClick={() => handleAddSkill(skill.id)}
                          >
                            {addingSkill === skill.id ? (
                              <Text className="block skill-btn-text">添加中...</Text>
                            ) : (
                              <>
                                <Plus size={14} color="#fff" />
                                <Text className="block skill-btn-text">添加</Text>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )
            })
          )}
        </View>

        {/* 底部提示 */}
        {avatarId && avatarSkills.length > 0 && (
          <View className="skills-bottom-tip">
            <Text className="block skills-bottom-text">
              已选 {avatarSkills.length} 项技能 · 开启托管后分身将自动接单
            </Text>
          </View>
        )}

        <View style={{ height: '40px' }} />
      </ScrollView>
    </View>
  )
}
