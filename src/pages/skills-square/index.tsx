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
  Star,
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
  Share2
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
  '内容创作': '#00f5ff',
  '平台发布': '#ff6b6b',
  '平台管理': '#ffd700',
  '社交互动': '#bf00ff',
  '订阅管理': '#00ff88'
}

const CATEGORY_ICONS: Record<string, any> = {
  '内容创作': Pencil,
  '平台发布': Share2,
  '平台管理': Settings,
  '社交互动': UserPlus,
  '订阅管理': Sparkles
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
        const skillIds = (res.data.data || []).map((item: any) => item.skillId)
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
      {/* 头部 */}
      <View className="skill-square-header">
        <View className="header-content">
          <View className="header-top">
            <View className="header-left">
              <View>
                <Text className="header-title">技能广场</Text>
                <Text className="header-subtitle">为分身解锁更多能力</Text>
              </View>
              <Button
                className="create-skill-mini-btn"
                onClick={goToCreateSkill}
              >
                <Sparkles size={14} color="#fff" />
                <Text>创建</Text>
              </Button>
            </View>
            <View className="avatar-selector" onClick={() => setShowAvatarSelector(true)}>
              {currentAvatar ? (
                <>
                  <View className="current-avatar">
                    <Text className="avatar-emoji">{currentAvatar.name[0]}</Text>
                  </View>
                  <Text className="avatar-name">{currentAvatar.name}</Text>
                  <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
                </>
              ) : (
                <>
                  <UserPlus size={18} color="rgba(255,255,255,0.6)" />
                  <Text className="avatar-name">选择分身</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* 当前分身已具备的技能统计 */}
      {currentAvatar && mySkills.length > 0 && (
        <View className="my-skills-stats">
          <View className="stats-content">
            <Sparkles size={20} color="#00f5ff" />
            <View className="stats-info">
              <Text className="stats-title">{currentAvatar.name}</Text>
              <Text className="stats-count">已具备 {mySkills.length} 个技能</Text>
            </View>
          </View>
        </View>
      )}

      {/* 搜索栏 */}
      <View className="search-container">
        <View className="search-box">
          <Search size={20} color="rgba(255,255,255,0.4)" />
          <Input
            className="search-input"
            placeholder="搜索技能名称、描述或标签"
            value={searchKeyword}
            onInput={(e) => setSearchKeyword(e.detail.value)}
            onConfirm={handleSearch}
          />
          {searchKeyword && (
            <Button
              className="search-btn"
              size="sm"
              onClick={handleSearch}
            >
              搜索
            </Button>
          )}
        </View>
      </View>

      {/* 分类筛选 */}
      <View className="category-container">
        <ScrollView className="category-scroll" scrollX>
          <View
            className={`category-item ${!filter.category ? 'active' : ''}`}
            onClick={() => {
              setFilter({ ...filter, category: undefined })
              fetchSkills()
            }}
          >
            <Package size={16} color="rgba(255,255,255,0.8)" />
            <Text className="category-text">全部 ({skills.length})</Text>
          </View>
          {categories.map((cat) => {
            const count = skills.filter(s => s.category === cat).length
            const Icon = CATEGORY_ICONS[cat]
            const color = CATEGORY_COLORS[cat] || '#00f5ff'
            return (
              <View
                key={cat}
                className={`category-item ${filter.category === cat ? 'active' : ''}`}
                style={{ borderColor: filter.category === cat ? color : 'rgba(255,255,255,0.1)' }}
                onClick={() => {
                  setFilter({ ...filter, category: cat })
                  fetchSkills()
                }}
              >
                {Icon && <Icon size={16} color={filter.category === cat ? color : 'rgba(255,255,255,0.6)'} />}
                <Text className="category-text">{cat}</Text>
                <Badge className="category-badge">{count}</Badge>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {/* 技能列表 */}
      <ScrollView className="skills-list" scrollY>
        {loading ? (
          <View className="loading-container">
            <Loader size={32} color="#00f5ff" className="spinning" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : !currentAvatar ? (
          <View className="empty-container">
            <UserPlus size={64} color="rgba(255,255,255,0.3)" />
            <Text className="empty-title">请先选择分身</Text>
            <Text className="empty-desc">选择一个分身后，可以为它添加技能</Text>
            <Button
              className="create-avatar-btn"
              onClick={() => Taro.navigateTo({ url: '/pages/avatar-create/index' })}
            >
              <Sparkles size={18} color="#fff" />
              <Text>创建分身</Text>
            </Button>
          </View>
        ) : skills.length === 0 ? (
          <View className="empty-container">
            <Package size={64} color="rgba(255,255,255,0.3)" />
            <Text className="empty-title">暂无技能</Text>
            <Text className="empty-desc">换个关键词试试吧</Text>
          </View>
        ) : (
          <View className="skills-grid">
            {skills.map((skill) => {
              const CategoryIcon = CATEGORY_ICONS[skill.category || '']
              const categoryColor = CATEGORY_COLORS[skill.category || ''] || '#00f5ff'
              const owned = isOwned(skill.id)

              return (
                <View key={skill.id} className={`skill-card ${owned ? 'owned' : ''}`}>
                  {/* 卡片头部 */}
                  <View className="card-header">
                    <View className="skill-icon-large" style={{ background: `linear-gradient(135deg, ${categoryColor}22, ${categoryColor}44)` }}>
                      <Text className="skill-emoji-large">{skill.icon || '🎯'}</Text>
                    </View>
                    {owned && (
                      <View className="owned-badge">
                        <Check size={16} color="#00ff88" />
                        <Text className="owned-badge-text">已具备</Text>
                      </View>
                    )}
                  </View>

                  {/* 卡片内容 */}
                  <View className="card-body">
                    <View className="card-category">
                      {CategoryIcon && <CategoryIcon size={14} color={categoryColor} />}
                      <Text className="category-text" style={{ color: categoryColor }}>{skill.category}</Text>
                    </View>

                    <Text className="skill-name-large">{skill.name}</Text>

                    <Text className="skill-desc-full">{skill.description}</Text>

                    {/* 能力标签 */}
                    {skill.tags && skill.tags.length > 0 && (
                      <View className="skill-tags-row">
                        {skill.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="skill-tag-mini">
                            {tag}
                          </Badge>
                        ))}
                      </View>
                    )}

                    {/* 统计信息 */}
                    <View className="skill-stats-row">
                      <View className="stat-item">
                        <Star size={14} color="#ffb800" />
                        <Text className="stat-text">{skill.rating.toFixed(1)}</Text>
                        <Text className="stat-count">({skill.rating_count})</Text>
                      </View>
                      <View className="stat-item">
                        <TrendingUp size={14} color="rgba(255,255,255,0.5)" />
                        <Text className="stat-text">{skill.purchase_count}</Text>
                        <Text className="stat-label">人使用</Text>
                      </View>
                    </View>

                    {/* 要求提示 */}
                    {skill.requirements && skill.requirements !== '无' && (
                      <View className="requirement-tip">
                        <Clock size={12} color="rgba(255,255,255,0.5)" />
                        <Text className="requirement-text">{skill.requirements}</Text>
                      </View>
                    )}
                  </View>

                  {/* 卡片底部操作 */}
                  <View className="card-footer">
                    {owned ? (
                      <Button variant="outline" className="owned-btn" disabled>
                        <Check size={16} color="#00ff88" />
                        <Text>已添加</Text>
                      </Button>
                    ) : (
                      <Button
                        className="add-btn"
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
                className={`avatar-item ${currentAvatar?.id === avatar.id ? 'active' : ''}`}
                onClick={() => handleSelectAvatar(avatar)}
              >
                <View className="avatar-item-avatar">
                  <Text className="avatar-emoji">{avatar.name[0]}</Text>
                </View>
                <View className="avatar-item-info">
                  <Text className="avatar-item-name">{avatar.name}</Text>
                  {avatar.description && (
                    <Text className="avatar-item-desc">{avatar.description}</Text>
                  )}
                </View>
                {currentAvatar?.id === avatar.id && (
                  <Check size={20} color="#00f5ff" />
                )}
              </View>
            ))}
            {avatars.length === 0 && (
              <View className="no-avatar-tip">
                <Text className="no-avatar-text">暂无分身</Text>
                <Button
                  className="create-btn"
                  onClick={() => {
                    setShowAvatarSelector(false)
                    Taro.navigateTo({ url: '/pages/avatar-create/index' })
                  }}
                >
                  <Sparkles size={16} color="#fff" />
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
            <View className="purchase-content">
              <View className="purchase-skill-info">
                <View className="skill-icon extra-large">
                  <Text className="skill-emoji-extra-large">{selectedSkill.icon || '🎯'}</Text>
                </View>
                <View className="skill-detail">
                  <Text className="skill-name-extra-large">{selectedSkill.name}</Text>
                  <Text className="skill-desc-extra">{selectedSkill.description}</Text>
                  {selectedSkill.requirements && selectedSkill.requirements !== '无' && (
                    <View className="requirement-note">
                      <Clock size={14} color="#ff6b6b" />
                      <Text className="requirement-note-text">{selectedSkill.requirements}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="purchase-avatar">
                <Text className="purchase-label">目标分身</Text>
                <View className="purchase-avatar-card">
                  <View className="purchase-avatar-icon">
                    <Text className="purchase-avatar-emoji">{currentAvatar.name[0]}</Text>
                  </View>
                  <View className="purchase-avatar-detail">
                    <Text className="purchase-avatar-name">{currentAvatar.name}</Text>
                    <Text className="purchase-avatar-desc">添加后将立即具备此能力</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              取消
            </Button>
            <Button onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? '添加中...' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
