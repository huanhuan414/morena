import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/stores/user'
import Taro from '@tarojs/taro'
import {
  Sparkles,
  Search,
  TrendingUp,
  Package,
  Loader,
  UserPlus,
  ChevronDown,
  Check,
  Clock,
  Zap,
  Settings,
  Pencil,
  Share2,
  Crown,
  Grid3x3,
  List,
  Star
} from 'lucide-react-taro'
import './index.css'

interface Skill {
  id: string
  name: string
  description: string
  category?: string
  price: number
  icon?: string
  tags: string[]
  rating: number
  rating_count: number
  purchase_count: number
  capabilities?: any
  requirements?: string
  status: string
  tool_name?: string
  created_at: string
  updated_at: string
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  description?: string
  personality?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  '内容创作': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  '平台发布': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  '平台管理': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  '社交互动': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  '订阅管理': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  '图像生成': 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  '视频生成': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  '文本分析': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  '语音识别': 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'
}

const CATEGORY_BG_COLORS: Record<string, string> = {
  '内容创作': 'rgba(102, 126, 234, 0.1)',
  '平台发布': 'rgba(240, 147, 251, 0.1)',
  '平台管理': 'rgba(79, 172, 254, 0.1)',
  '社交互动': 'rgba(67, 233, 123, 0.1)',
  '订阅管理': 'rgba(250, 112, 154, 0.1)',
  '图像生成': 'rgba(161, 140, 209, 0.1)',
  '视频生成': 'rgba(255, 154, 158, 0.1)',
  '文本分析': 'rgba(102, 126, 234, 0.1)',
  '语音识别': 'rgba(137, 247, 254, 0.1)'
}

const CATEGORY_ICONS: Record<string, any> = {
  '内容创作': Pencil,
  '平台发布': Share2,
  '平台管理': Settings,
  '社交互动': UserPlus,
  '订阅管理': Crown,
  '图像生成': Sparkles,
  '视频生成': Zap,
  '文本分析': List,
  '语音识别': Grid3x3
}

export default function SkillsSquare() {
  const { userInfo, avatarId, setAvatarId } = useUserStore()

  const [skills, setSkills] = useState<Skill[]>([])
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [currentAvatar, setCurrentAvatar] = useState<Avatar | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filter, setFilter] = useState<any>({})
  const [categories, setCategories] = useState<string[]>([])
  const [mySkills, setMySkills] = useState<string[]>([])
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // 获取分身列表
  const fetchAvatars = async () => {
    if (!userInfo?.id) return

    try {
      const res = await Network.request({
        url: '/api/avatar',
        method: 'GET'
      })

      if (res.data?.code === 200) {
        const avatarList = res.data.data || []
        setAvatars(avatarList)

        if (avatarId) {
          const current = avatarList.find((a: Avatar) => a.id === avatarId)
          if (current) {
            setCurrentAvatar(current)
          }
        } else if (avatarList.length > 0) {
          const firstAvatar = avatarList[0]
          setCurrentAvatar(firstAvatar)
          setAvatarId?.(firstAvatar.id)
        }
      }
    } catch (error) {
      console.error('[SkillSquare] 获取分身列表失败:', error)
    }
  }

  // 获取技能列表
  const fetchSkills = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/skills',
        method: 'GET',
        data: {
          ...filter,
          search: searchKeyword || undefined
        }
      })

      if (res.data?.code === 200) {
        setSkills(res.data.data.skills || [])
      }
    } catch (error) {
      console.error('[SkillSquare] 获取技能列表失败:', error)
      Taro.showToast({ title: '获取技能列表失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 获取分类
  const fetchCategories = async () => {
    try {
      const res = await Network.request({
        url: '/api/skills/categories/list',
        method: 'GET'
      })

      if (res.data?.code === 200) {
        setCategories(res.data.data || [])
      }
    } catch (error) {
      console.error('[SkillSquare] 获取分类失败:', error)
    }
  }

  // 获取我的技能
  const fetchMySkills = async () => {
    if (!currentAvatar?.id) return

    try {
      const res = await Network.request({
        url: `/api/skills/avatar/${currentAvatar.id}`,
        method: 'GET'
      })

      if (res.data?.code === 200) {
        const skillIds = (res.data.data || []).map((item: any) => item.skillId).filter(Boolean)
        setMySkills(skillIds)
      }
    } catch (error) {
      console.error('[SkillSquare] 获取我的技能失败:', error)
    }
  }

  // 选择分身
  const handleSelectAvatar = (avatar: Avatar) => {
    setCurrentAvatar(avatar)
    setAvatarId?.(avatar.id)
    setShowAvatarSelector(false)
    fetchMySkills()
  }

  // 购买技能
  const handlePurchase = async () => {
    if (!selectedSkill || !currentAvatar?.id) return

    try {
      setPurchasing(true)

      const res = await Network.request({
        url: '/api/skills/purchase',
        method: 'POST',
        data: {
          avatarId: currentAvatar.id,
          skillId: selectedSkill.id
        }
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '技能添加成功！', icon: 'success' })
        setShowPurchaseDialog(false)
        fetchMySkills()
      } else {
        Taro.showToast({ title: res.data?.message || '添加失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[SkillSquare] 添加技能失败:', error)
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      setPurchasing(false)
    }
  }

  // 检查是否已拥有该技能
  const isOwned = (skillId: string) => mySkills.includes(skillId)

  // 搜索处理
  const handleSearch = () => {
    fetchSkills()
  }

  // 跳转到创建技能页面
  const goToCreateSkill = () => {
    Taro.navigateTo({ url: '/pages/skill-create/index' })
  }

  useEffect(() => {
    fetchAvatars()
    fetchSkills()
    fetchCategories()
  }, [])

  useEffect(() => {
    if (currentAvatar?.id) {
      fetchMySkills()
    }
  }, [currentAvatar?.id])

  return (
    <View className="skill-square-container">
      {/* 顶部背景装饰 */}
      <View className="background-decoration" />

      {/* 头部区域 */}
      <View className="skill-square-header">
        <View className="header-content">
          <View className="header-top">
            <View className="header-title-section">
              <View className="title-row">
                <Crown size={28} color="url(#crownGradient)" />
                <Text className="header-title">技能商城</Text>
              </View>
              <Text className="header-subtitle">为分身解锁强大能力</Text>
            </View>

            <View className="header-actions">
              <Button
                className="create-skill-btn premium"
                onClick={goToCreateSkill}
              >
                <Sparkles size={18} color="#fff" />
                <Text>创建技能</Text>
              </Button>
              <View className="avatar-selector" onClick={() => setShowAvatarSelector(true)}>
                {currentAvatar ? (
                  <>
                    <View className="current-avatar premium">
                      <Text className="avatar-emoji">{currentAvatar.name[0]}</Text>
                    </View>
                    <View className="avatar-info">
                      <Text className="avatar-name">{currentAvatar.name}</Text>
                      <Text className="avatar-skill-count">{mySkills.length}个技能</Text>
                    </View>
                    <ChevronDown size={16} color="rgba(255,255,255,0.7)" />
                  </>
                ) : (
                  <>
                    <UserPlus size={20} color="rgba(255,255,255,0.7)" />
                    <Text className="avatar-name">选择分身</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 搜索和筛选区域 */}
      <View className="search-filter-container">
        <View className="search-box glass-effect">
          <Search size={20} color="rgba(255,255,255,0.5)" />
          <Input
            className="search-input"
            placeholder="搜索技能名称、描述或标签"
            value={searchKeyword}
            onInput={(e) => setSearchKeyword(e.detail.value)}
            onConfirm={handleSearch}
          />
          {searchKeyword && (
            <Button className="search-btn" onClick={handleSearch}>
              搜索
            </Button>
          )}
        </View>

        <View className="filter-row">
          <View className="view-mode-switch">
            <Button
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 size={18} color={viewMode === 'grid' ? '#fff' : 'rgba(255,255,255,0.6)'} />
            </Button>
            <Button
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={18} color={viewMode === 'list' ? '#fff' : 'rgba(255,255,255,0.6)'} />
            </Button>
          </View>
        </View>

        <ScrollView className="category-scroll" scrollX>
          <View
            className={`category-chip ${!filter.category ? 'active' : ''}`}
            onClick={() => {
              setFilter({ ...filter, category: undefined })
              fetchSkills()
            }}
          >
            <Package size={16} color="rgba(255,255,255,0.8)" />
            <Text className="category-text">全部</Text>
            <Badge className="category-count">{skills.length}</Badge>
          </View>
          {categories.map((cat) => {
            const count = skills.filter(s => s.category === cat).length
            const Icon = CATEGORY_ICONS[cat]
            const gradient = CATEGORY_COLORS[cat] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            return (
              <View
                key={cat}
                className={`category-chip ${filter.category === cat ? 'active' : ''}`}
                style={{
                  background: filter.category === cat ? gradient : 'rgba(255,255,255,0.05)',
                  borderColor: filter.category === cat ? 'transparent' : 'rgba(255,255,255,0.1)'
                }}
                onClick={() => {
                  setFilter({ ...filter, category: cat })
                  fetchSkills()
                }}
              >
                {Icon && <Icon size={16} color={filter.category === cat ? '#fff' : 'rgba(255,255,255,0.6)'} />}
                <Text className="category-text">{cat}</Text>
                <Badge className="category-count" style={{ background: filter.category === cat ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}>
                  {count}
                </Badge>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {/* 技能列表 */}
      <ScrollView className="skills-list" scrollY>
        {loading ? (
          <View className="loading-container">
            <Loader size={48} color="url(#loaderGradient)" className="spinning" />
            <Text className="loading-text">加载技能中...</Text>
          </View>
        ) : !currentAvatar ? (
          <View className="empty-state">
            <View className="empty-icon-wrapper">
              <UserPlus size={64} color="url(#iconGradient)" />
            </View>
            <Text className="empty-title">请先选择分身</Text>
            <Text className="empty-desc">选择一个分身后，可以为它添加技能</Text>
            <Button
              className="primary-action-btn"
              onClick={() => Taro.navigateTo({ url: '/pages/avatar-create/index' })}
            >
              <Sparkles size={20} color="#fff" />
              <Text>创建分身</Text>
            </Button>
          </View>
        ) : skills.length === 0 ? (
          <View className="empty-state">
            <View className="empty-icon-wrapper">
              <Package size={64} color="url(#iconGradient)" />
            </View>
            <Text className="empty-title">暂无技能</Text>
            <Text className="empty-desc">换个关键词试试吧</Text>
          </View>
        ) : (
          <View className={`skills-${viewMode}`}>
            {skills.map((skill) => {
              const Icon = CATEGORY_ICONS[skill.category || '']
              const gradient = CATEGORY_COLORS[skill.category || ''] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              const bgColor = CATEGORY_BG_COLORS[skill.category || ''] || 'rgba(102, 126, 234, 0.1)'
              const owned = isOwned(skill.id)

              return (
                <View key={skill.id} className={`skill-card ${viewMode} ${owned ? 'owned' : ''} glass-effect`}>
                  {/* 卡片头部 - 图标和状态 */}
                  <View className="card-header">
                    <View className="skill-icon-wrapper" style={{ background: gradient }}>
                      <Text className="skill-icon">{skill.icon || '🎯'}</Text>
                    </View>
                    {owned && (
                      <View className="owned-badge premium">
                        <Check size={14} color="#fff" />
                        <Text className="owned-text">已添加</Text>
                      </View>
                    )}
                  </View>

                  {/* 卡片内容 */}
                  <View className="card-body">
                    {/* 分类标签 */}
                    <View className="skill-category-tag" style={{ background: bgColor }}>
                      {Icon && <Icon size={12} />}
                      <Text className="category-label">{skill.category}</Text>
                    </View>

                    {/* 技能名称 */}
                    <Text className="skill-name">{skill.name}</Text>

                    {/* 技能描述 */}
                    <Text className="skill-description">{skill.description}</Text>

                    {/* 标签 */}
                    {skill.tags && skill.tags.length > 0 && (
                      <View className="skill-tags">
                        {skill.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} className="skill-tag" variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </View>
                    )}

                    {/* 统计信息 */}
                    <View className="skill-stats">
                      <View className="stat-item">
                        <Star size={14} color="#ffb800" />
                        <Text className="stat-value">{skill.rating.toFixed(1)}</Text>
                        <Text className="stat-label">({skill.rating_count})</Text>
                      </View>
                      <View className="stat-item">
                        <TrendingUp size={14} color="rgba(255,255,255,0.5)" />
                        <Text className="stat-value">{skill.purchase_count}</Text>
                        <Text className="stat-label">人使用</Text>
                      </View>
                    </View>

                    {/* 要求提示 */}
                    {skill.requirements && skill.requirements !== '无' && (
                      <View className="requirement-notice">
                        <Clock size={12} color="rgba(255,107,107,0.8)" />
                        <Text className="requirement-text">{skill.requirements}</Text>
                      </View>
                    )}
                  </View>

                  {/* 卡片底部 - 操作按钮 */}
                  <View className="card-footer">
                    {owned ? (
                      <Button variant="outline" className="action-btn owned" disabled>
                        <Check size={16} color="rgba(255,255,255,0.5)" />
                        <Text>已添加</Text>
                      </Button>
                    ) : (
                      <Button
                        className="action-btn primary"
                        onClick={() => {
                          setSelectedSkill(skill)
                          setShowPurchaseDialog(true)
                        }}
                      >
                        <Zap size={16} color="#fff" />
                        <Text>添加技能</Text>
                      </Button>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* 分身选择器 */}
      <Dialog open={showAvatarSelector} onOpenChange={setShowAvatarSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择分身</DialogTitle>
          </DialogHeader>
          <ScrollView className="avatar-list-scroll" scrollY>
            {avatars.map((avatar) => (
              <View
                key={avatar.id}
                className={`avatar-card ${currentAvatar?.id === avatar.id ? 'active' : ''}`}
                onClick={() => handleSelectAvatar(avatar)}
              >
                <View className="avatar-card-icon premium">
                  <Text className="avatar-card-emoji">{avatar.name[0]}</Text>
                </View>
                <View className="avatar-card-info">
                  <Text className="avatar-card-name">{avatar.name}</Text>
                  {avatar.description && (
                    <Text className="avatar-card-desc">{avatar.description}</Text>
                  )}
                </View>
                {currentAvatar?.id === avatar.id && (
                  <Check size={24} color="url(#checkGradient)" />
                )}
              </View>
            ))}
            {avatars.length === 0 && (
              <View className="no-avatar-tip">
                <Text className="no-avatar-text">暂无分身</Text>
                <Button
                  className="create-btn premium"
                  onClick={() => {
                    setShowAvatarSelector(false)
                    Taro.navigateTo({ url: '/pages/avatar-create/index' })
                  }}
                >
                  <Sparkles size={18} color="#fff" />
                  <Text>创建分身</Text>
                </Button>
              </View>
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>

      {/* 添加技能确认弹窗 */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加技能</DialogTitle>
          </DialogHeader>

          {selectedSkill && currentAvatar && (
            <View className="purchase-confirm">
              <View className="skill-preview">
                <View className="skill-preview-icon" style={{ background: CATEGORY_COLORS[selectedSkill.category || ''] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  <Text className="skill-preview-emoji">{selectedSkill.icon || '🎯'}</Text>
                </View>
                <View className="skill-preview-info">
                  <Text className="skill-preview-name">{selectedSkill.name}</Text>
                  <Text className="skill-preview-desc">{selectedSkill.description}</Text>
                  {selectedSkill.requirements && selectedSkill.requirements !== '无' && (
                    <View className="preview-requirement">
                      <Clock size={14} color="rgba(255,107,107,0.9)" />
                      <Text className="preview-requirement-text">{selectedSkill.requirements}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="avatar-target">
                <Text className="target-label">目标分身</Text>
                <View className="target-avatar-card premium">
                  <View className="target-avatar-icon">
                    <Text className="target-avatar-emoji">{currentAvatar.name[0]}</Text>
                  </View>
                  <View className="target-avatar-info">
                    <Text className="target-avatar-name">{currentAvatar.name}</Text>
                    <Text className="target-avatar-desc">添加后将立即具备此能力</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              取消
            </Button>
            <Button className="premium" onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? '添加中...' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SVG 渐变定义 */}
      <svg width="0" height="0">
        <defs>
          <linearGradient id="crownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd700" />
            <stop offset="100%" stopColor="#ffed4e" />
          </linearGradient>
          <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(102, 126, 234, 0.4)" />
            <stop offset="100%" stopColor="rgba(118, 75, 162, 0.4)" />
          </linearGradient>
          <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
        </defs>
      </svg>
    </View>
  )
}
