import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Search, Plus, Check, X, Sparkles, Camera, Film, Mic, PenTool, Eye, Hand, Heart, Music, TrendingUp } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

// 技能分类配置
const CATEGORY_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  all: { name: '全部', icon: '✨', color: '#7c3aed' },
  content: { name: '内容创作', icon: '✍️', color: '#8b5cf6' },
  video: { name: '视频制作', icon: '🎬', color: '#ec4899' },
  image: { name: '图片生成', icon: '🖼️', color: '#06b6d4' },
  audio: { name: '音频处理', icon: '🎙️', color: '#f97316' },
  life: { name: '生活技能', icon: '🌟', color: '#10b981' },
  music: { name: '音乐推荐', icon: '🎵', color: '#6366f1' },
  marketing: { name: '营销推广', icon: '📢', color: '#ef4444' },
}

// 技能图标映射
const SKILL_ICON_MAP: Record<string, any> = {
  content_writing: PenTool,
  video_gen: Film,
  image_gen: Camera,
  audio_gen: Mic,
  palm_reading: Hand,
  fashion_advice: Heart,
  music_recommend: Music,
  data_analysis: TrendingUp,
  script_writing: PenTool,
  storyboard: Film,
  subtitle_gen: Eye,
  voice_clone: Mic,
}

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
  sortOrder: number
  isActive: number
}

interface AvatarSkill {
  skillId: string
  skillName: string
  category: string
  icon: string
}

export default function SkillsSquare() {
  const statusBarHeight = getStatusBarHeight()
  const avatarId = Taro.getCurrentInstance().router?.params?.avatarId || ''

  const [skills, setSkills] = useState<Skill[]>([])
  const [avatarSkills, setAvatarSkills] = useState<AvatarSkill[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [addingSkillId, setAddingSkillId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 加载技能数据
  const loadSkills = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/skills' })
      console.log('[SkillsSquare] 技能列表响应:', res.data)
      const data = res.data?.data || []
      setSkills(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[SkillsSquare] 加载技能失败:', err)
    }
  }, [])

  // 加载分身已有技能
  const loadAvatarSkills = useCallback(async () => {
    if (!avatarId) return
    try {
      const res = await Network.request({ url: `/api/skills/avatar/${avatarId}` })
      console.log('[SkillsSquare] 分身技能响应:', res.data)
      const data = res.data?.data || []
      setAvatarSkills(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[SkillsSquare] 加载分身技能失败:', err)
    }
  }, [avatarId])

  // 页面加载
  Taro.useDidShow(() => {
    if (!loaded) {
      setLoading(true)
      Promise.all([loadSkills(), loadAvatarSkills()]).finally(() => {
        setLoading(false)
        setLoaded(true)
      })
    }
  })

  // 已有技能ID集合
  const ownedSkillIds = new Set(avatarSkills.map(s => s.skillId))

  // 筛选技能
  const filteredSkills = skills.filter(s => {
    const matchCategory = activeCategory === 'all' || s.category === activeCategory
    const matchSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  // 添加技能到分身
  const handleAddSkill = async (skillId: string) => {
    if (!avatarId) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }
    if (ownedSkillIds.has(skillId)) return
    setAddingSkillId(skillId)
    try {
      const res = await Network.request({
        url: `/api/skills/avatar/${avatarId}/${skillId}`,
        method: 'POST'
      })
      console.log('[SkillsSquare] 添加技能响应:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '技能添加成功', icon: 'success' })
        await loadAvatarSkills()
      } else {
        Taro.showToast({ title: res.data?.msg || '添加失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[SkillsSquare] 添加技能失败:', err)
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      setAddingSkillId(null)
    }
  }

  // 移除技能
  const handleRemoveSkill = async (skillId: string) => {
    if (!avatarId) return
    try {
      const res = await Network.request({
        url: `/api/skills/avatar/${avatarId}/${skillId}`,
        method: 'DELETE'
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已移除技能', icon: 'success' })
        await loadAvatarSkills()
      }
    } catch (err) {
      console.error('[SkillsSquare] 移除技能失败:', err)
    }
  }

  // 获取技能图标组件
  const getSkillIcon = (skillId: string, size = 18, color = '#7c3aed') => {
    const IconComp = SKILL_ICON_MAP[skillId]
    return IconComp ? <IconComp size={size} color={color} /> : <Sparkles size={size} color={color} />
  }

  // 获取分类颜色
  const getCategoryColor = (category: string) => {
    return CATEGORY_CONFIG[category]?.color || '#7c3aed'
  }

  return (
    <View className="skills-square-page">
      {/* 自定义导航栏 */}
      <View className="skills-nav" style={{ paddingTop: statusBarHeight + 'px' }}>
        <View className="skills-nav-content">
          <View className="skills-nav-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="skills-nav-title block">技能广场</Text>
          {avatarId && (
            <Text className="skills-nav-subtitle block">为分身添加技能</Text>
          )}
        </View>
      </View>

      {/* 已有技能栏 */}
      {avatarId && avatarSkills.length > 0 && (
        <View className="owned-skills-bar">
          <Text className="owned-skills-label block">已添加技能</Text>
          <ScrollView scrollX className="owned-skills-scroll">
            <View className="owned-skills-list">
              {avatarSkills.map(skill => (
                <View key={skill.skillId} className="owned-skill-tag" style={{ borderColor: getCategoryColor(skill.category) }}>
                  <Text className="owned-skill-icon">{skill.icon}</Text>
                  <Text className="owned-skill-name">{skill.skillName}</Text>
                  <View className="owned-skill-remove" onClick={() => handleRemoveSkill(skill.skillId)}>
                    <X size={12} color="#999" />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* 搜索栏 */}
      <View className="skills-search">
        <View className="search-input-wrap">
          <Search size={16} color="#999" />
          <View className="search-input-inner">
            <input
              style={{ width: '100%', fontSize: '14px', border: 'none', outline: 'none', backgroundColor: 'transparent' }}
              placeholder="搜索技能..."
              value={searchQuery}
              onInput={e => setSearchQuery((e as any).detail.value)}
            />
          </View>
        </View>
      </View>

      {/* 分类标签 */}
      <ScrollView scrollX className="category-scroll">
        <View className="category-tabs">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <View
              key={key}
              className={`category-tab ${activeCategory === key ? 'active' : ''}`}
              onClick={() => setActiveCategory(key)}
              style={activeCategory === key ? { backgroundColor: config.color, borderColor: config.color } : {}}
            >
              <Text className="category-tab-icon">{config.icon}</Text>
              <Text className="category-tab-name">{config.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 技能列表 */}
      <ScrollView scrollY className="skills-list-scroll">
        {loading ? (
          <View className="skills-loading">
            <Text className="block text-gray-400">加载中...</Text>
          </View>
        ) : filteredSkills.length === 0 ? (
          <View className="skills-empty">
            <Sparkles size={48} color="#d1d5db" />
            <Text className="block text-gray-400 mt-4">暂无技能</Text>
          </View>
        ) : (
          <View className="skills-grid">
            {filteredSkills.map(skill => {
              const isOwned = ownedSkillIds.has(skill.id)
              const isAdding = addingSkillId === skill.id
              const catColor = getCategoryColor(skill.category)
              const catConfig = CATEGORY_CONFIG[skill.category]

              return (
                <View key={skill.id} className="skill-card" style={{ borderLeftColor: catColor }}>
                  <View className="skill-card-header">
                    <View className="skill-icon-wrap" style={{ backgroundColor: catColor + '15' }}>
                      {getSkillIcon(skill.id, 22, catColor)}
                    </View>
                    <View className="skill-card-info">
                      <Text className="skill-card-name block">{skill.name}</Text>
                      <View className="skill-card-meta">
                        <Text className="skill-card-category" style={{ color: catColor, backgroundColor: catColor + '15' }}>
                          {catConfig?.icon} {catConfig?.name}
                        </Text>
                        {Number(skill.rating) > 0 && (
                          <Text className="skill-card-rating">⭐ {skill.rating}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <Text className="skill-card-desc block">{skill.description}</Text>

                  <View className="skill-card-footer">
                    <Text className="skill-card-usage">
                      {Number(skill.usageCount) > 0 ? `${Number(skill.usageCount).toLocaleString()}人使用` : '新技能'}
                    </Text>
                    {avatarId && (
                      isOwned ? (
                        <View className="skill-added-btn">
                          <Check size={14} color="#10b981" />
                          <Text className="skill-added-text">已添加</Text>
                        </View>
                      ) : (
                        <View
                          className="skill-add-btn"
                          style={{ backgroundColor: catColor }}
                          onClick={() => handleAddSkill(skill.id)}
                        >
                          {isAdding ? (
                            <Text className="skill-add-text block text-white">添加中...</Text>
                          ) : (
                            <>
                              <Plus size={14} color="#fff" />
                              <Text className="skill-add-text block text-white">添加</Text>
                            </>
                          )}
                        </View>
                      )
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* 底部安全距离 */}
        <View style={{ height: '40px' }} />
      </ScrollView>
    </View>
  )
}
