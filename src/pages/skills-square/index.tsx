import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import * as Network from '@/network'
import { Sparkles, Star, TrendingUp, Zap, Film, Mic, PenTool, Camera, Music, Check, Plus, ChevronRight, Search } from 'lucide-react-taro'
import './index.css'

// 技能分类
const SKILL_CATEGORIES = [
  { key: 'all', name: '全部', icon: Sparkles },
  { key: 'content', name: '内容创作', icon: PenTool },
  { key: 'video', name: '视频制作', icon: Film },
  { key: 'audio', name: '音频处理', icon: Mic },
  { key: 'image', name: '图片生成', icon: Camera },
  { key: 'music', name: '音乐推荐', icon: Music },
]

// 技能数据接口
interface Skill {
  id: string
  name: string
  description: string
  category: string
  icon: string
  rating: number
  usage_count: number
  price: number
  is_owned: boolean
  tags: string[]
}

// 模拟技能数据
const MOCK_SKILLS: Skill[] = [
  {
    id: '1',
    name: '短剧剧本生成',
    description: '一键生成高质量短剧剧本，支持多种题材和风格',
    category: 'content',
    icon: '📝',
    rating: 4.9,
    usage_count: 15680,
    price: 0,
    is_owned: true,
    tags: ['AI', '短剧', '剧本']
  },
  {
    id: '2',
    name: '分镜脚本生成',
    description: '智能生成分镜头脚本，让视频创作更高效',
    category: 'video',
    icon: '🎬',
    rating: 4.8,
    usage_count: 12350,
    price: 0,
    is_owned: true,
    tags: ['AI', '分镜', '视频']
  },
  {
    id: '3',
    name: '视频配音生成',
    description: '自然流畅的AI配音，支持多种声音风格',
    category: 'audio',
    icon: '🎙️',
    rating: 4.7,
    usage_count: 9850,
    price: 0,
    is_owned: false,
    tags: ['AI', '配音', '音频']
  },
  {
    id: '4',
    name: '背景音乐推荐',
    description: '智能推荐与内容匹配的背景音乐',
    category: 'music',
    icon: '🎵',
    rating: 4.6,
    usage_count: 8760,
    price: 0,
    is_owned: false,
    tags: ['AI', 'BGM', '音乐']
  },
  {
    id: '5',
    name: '字幕生成',
    description: '自动识别语音并生成精准字幕',
    category: 'video',
    icon: '💬',
    rating: 4.9,
    usage_count: 15680,
    price: 0,
    is_owned: true,
    tags: ['AI', '字幕', '视频']
  },
  {
    id: '6',
    name: '图片生成',
    description: 'AI智能生成高质量图片，支持多种风格',
    category: 'image',
    icon: '🖼️',
    rating: 4.8,
    usage_count: 11230,
    price: 0,
    is_owned: true,
    tags: ['AI', '图片', '绘画']
  },
  {
    id: '7',
    name: '短剧视频编辑',
    description: '专业的视频剪辑和后期处理能力',
    category: 'video',
    icon: '✂️',
    rating: 4.7,
    usage_count: 7680,
    price: 0,
    is_owned: false,
    tags: ['AI', '剪辑', '后期']
  },
  {
    id: '8',
    name: '多集短剧生成',
    description: '批量生成多集短剧内容，提升创作效率',
    category: 'content',
    icon: '📺',
    rating: 4.9,
    usage_count: 6540,
    price: 0,
    is_owned: false,
    tags: ['AI', '批量', '短剧']
  },
  {
    id: '9',
    name: '分身声音创建',
    description: '为分身克隆独特的声音特征',
    category: 'audio',
    icon: '🎭',
    rating: 4.8,
    usage_count: 5430,
    price: 0,
    is_owned: false,
    tags: ['AI', '克隆', '声音']
  },
  {
    id: '10',
    name: '自动发帖助手',
    description: '让分身自动在首页发布动态帖子',
    category: 'content',
    icon: '📤',
    rating: 4.5,
    usage_count: 4320,
    price: 0,
    is_owned: false,
    tags: ['AI', '自动', '发帖']
  }
]

export default function SkillsCenterPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [ownedSkills, setOwnedSkills] = useState<string[]>([])

  useEffect(() => {
    fetchSkills()
  }, [])

  const fetchSkills = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/skills'
      })
      if (res.data?.code === 200) {
        setSkills(res.data.data || [])
      } else {
        setSkills(MOCK_SKILLS)
        setOwnedSkills(MOCK_SKILLS.filter(s => s.is_owned).map(s => s.id))
      }
    } catch (error) {
      console.error('获取技能列表失败:', error)
      setSkills(MOCK_SKILLS)
      setOwnedSkills(MOCK_SKILLS.filter(s => s.is_owned).map(s => s.id))
    } finally {
      setLoading(false)
    }
  }

  // 筛选技能
  const filteredSkills = skills.filter(skill => {
    const categoryMatch = selectedCategory === 'all' || skill.category === selectedCategory
    const searchMatch = !searchKeyword || 
      skill.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchKeyword.toLowerCase())
    return categoryMatch && searchMatch
  })

  // 统计信息
  const totalSkills = skills.length
  const ownedCount = skills.filter(s => s.is_owned).length

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  return (
    <View className="skills-center-page">
      {/* 顶部背景 */}
      <View className="page-header">
        {/* 装饰圆形 */}
        <View className="header-decoration">
          <View className="decoration-circle circle-1" />
          <View className="decoration-circle circle-2" />
          <View className="decoration-circle circle-3" />
        </View>
        
        {/* 页面标题 */}
        <View className="header-title-area">
          <Text className="header-title">技能中心</Text>
          <Text className="header-subtitle">解锁AI能力 · 提升创作效率</Text>
        </View>

        {/* 技能统计 */}
        <View className="skills-stats">
          <View className="stat-card">
            <View className="stat-icon owned">
              <Check size={20} color="#10B981" />
            </View>
            <View className="stat-info">
              <Text className="stat-number">{ownedCount}</Text>
              <Text className="stat-label">已拥有</Text>
            </View>
          </View>
          <View className="stat-card">
            <View className="stat-icon total">
              <Sparkles size={20} color="#6366F1" />
            </View>
            <View className="stat-info">
              <Text className="stat-number">{totalSkills}</Text>
              <Text className="stat-label">全部技能</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 搜索框 */}
      <View className="search-area">
        <View className="search-wrapper">
          <Search size={18} color="#94A3B8" />
          <input
            className="search-input"
            type="text"
            placeholder="搜索技能..."
            placeholder-class="search-placeholder"
            value={searchKeyword}
            onInput={(e: any) => setSearchKeyword(e.detail.value)}
          />
        </View>
      </View>

      {/* 分类筛选 */}
      <View className="category-filter">
        <ScrollView className="category-scroll" scrollX>
          {SKILL_CATEGORIES.map((category) => {
            const IconComponent = category.icon
            return (
              <View
                key={category.key}
                className={`category-tag ${selectedCategory === category.key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.key)}
              >
                <IconComponent size={16} color={selectedCategory === category.key ? '#6366F1' : '#64748B'} />
                <Text className="category-tag-text">{category.name}</Text>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {/* 技能列表 */}
      <ScrollView className="skills-list" scrollY>
        {loading ? (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredSkills.length === 0 ? (
          <View className="empty-state">
            <Sparkles size={64} color="#CBD5E1" />
            <Text className="empty-title">暂无相关技能</Text>
            <Text className="empty-desc">换个关键词试试吧</Text>
          </View>
        ) : (
          <>
            {/* 已拥有技能 */}
            {selectedCategory === 'all' && (
              <View className="section">
                <View className="section-header">
                  <View className="section-title-wrapper">
                    <Check size={18} color="#10B981" />
                    <Text className="section-title">我的技能</Text>
                  </View>
                  <Text className="section-count">{ownedSkills.length}个</Text>
                </View>
                <View className="skills-grid">
                  {filteredSkills.filter(s => s.is_owned).map((skill) => (
                    <View key={skill.id} className="skill-card owned">
                      <View className="skill-icon-wrapper">
                        <Text className="skill-icon">{skill.icon}</Text>
                        <View className="owned-badge">
                          <Check size={10} color="#fff" />
                        </View>
                      </View>
                      <Text className="skill-name">{skill.name}</Text>
                      <Text className="skill-desc">{skill.description}</Text>
                      <View className="skill-tags">
                        {skill.tags.slice(0, 2).map((tag, index) => (
                          <Text key={index} className="skill-tag">{tag}</Text>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 可解锁技能 */}
            <View className="section">
              <View className="section-header">
                <View className="section-title-wrapper">
                  <Zap size={18} color="#F59E0B" />
                  <Text className="section-title">
                    {selectedCategory === 'all' ? '可解锁技能' : '全部技能'}
                  </Text>
                </View>
                <Text className="section-count">
                  {filteredSkills.filter(s => !s.is_owned).length}个
                </Text>
              </View>
              <View className="skills-grid">
                {filteredSkills.filter(s => !s.is_owned || selectedCategory !== 'all').map((skill) => (
                  <View key={skill.id} className="skill-card">
                    <View className="skill-icon-wrapper">
                      <Text className="skill-icon">{skill.icon}</Text>
                    </View>
                    <Text className="skill-name">{skill.name}</Text>
                    <Text className="skill-desc">{skill.description}</Text>
                    <View className="skill-meta">
                      <View className="skill-rating">
                        <Star size={12} color="#F59E0B" />
                        <Text className="rating-text">{skill.rating}</Text>
                      </View>
                      <View className="skill-usage">
                        <TrendingUp size={12} color="#94A3B8" />
                        <Text className="usage-text">{formatNumber(skill.usage_count)}</Text>
                      </View>
                    </View>
                    <View className="skill-tags">
                      {skill.tags.slice(0, 2).map((tag, index) => (
                        <Text key={index} className="skill-tag">{tag}</Text>
                      ))}
                    </View>
                    <View className="skill-action">
                      <View className="action-btn unlock">
                        <Plus size={14} color="#6366F1" />
                        <Text className="action-text">解锁</Text>
                      </View>
                      <ChevronRight size={14} color="#94A3B8" />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
