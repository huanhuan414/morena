import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Brain,
  ChevronDown
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
  const [showCreateSkillDialog, setShowCreateSkillDialog] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [creatingSkill, setCreatingSkill] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillDescription, setNewSkillDescription] = useState('')

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

        // 如果有当前分身，设置为当前分身
        if (avatarId) {
          const current = avatarList.find((a: Avatar) => a.id === avatarId)
          if (current) {
            setCurrentAvatar(current)
          }
        } else if (avatarList.length > 0) {
          // 如果没有当前分身，使用第一个分身
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
        // 刷新列表
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

  // 创建自定义技能
  const handleCreateSkill = async () => {
    if (!newSkillName.trim() || !newSkillDescription.trim()) {
      Taro.showToast({ title: '请填写技能名称和描述', icon: 'none' })
      return
    }

    if (!userInfo?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    try {
      setCreatingSkill(true)

      // 使用 AI 生成技能的详细描述和标签
      const res = await Network.request({
        url: '/api/skills/ai-generate',
        method: 'POST',
        data: {
          name: newSkillName,
          description: newSkillDescription
        }
      })

      if (res.data?.code === 200) {
        const generatedSkill = res.data.data

        // 保存技能到数据库
        const saveRes = await Network.request({
          url: '/api/skills',
          method: 'POST',
          data: {
            name: generatedSkill.name,
            description: generatedSkill.description,
            type: 'custom',
            category: '自定义',
            icon: '🤖',
            tags: generatedSkill.tags || [],
            capabilities: generatedSkill.capabilities || {},
            requirements: generatedSkill.requirements || '无'
          }
        })

        if (saveRes.data?.code === 200) {
          Taro.showToast({ title: '技能创建成功！', icon: 'success' })
          setShowCreateSkillDialog(false)
          setNewSkillName('')
          setNewSkillDescription('')
          // 刷新技能列表
          fetchSkills()
        } else {
          Taro.showToast({ title: saveRes.data?.message || '保存失败', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: res.data?.message || 'AI 生成失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[SkillSquare] 创建技能失败:', error)
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setCreatingSkill(false)
    }
  }

  // 搜索处理
  const handleSearch = () => {
    fetchSkills()
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
            <Text className="header-title">技能广场</Text>
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
          <Text className="header-subtitle">为分身解锁更多能力</Text>
        </View>
      </View>

      {/* 当前分身已具备的技能 */}
      {currentAvatar && mySkills.length > 0 && (
        <View className="my-skills-section">
          <View className="section-header">
            <Sparkles size={16} color="#00f5ff" />
            <Text className="section-title">{currentAvatar.name} 已具备 {mySkills.length} 个技能</Text>
          </View>
          <ScrollView className="my-skills-scroll" scrollX>
            {skills.filter(s => mySkills.includes(s.id)).map((skill) => (
              <View key={skill.id} className="my-skill-tag">
                <Text className="my-skill-icon">{skill.icon}</Text>
                <Text className="my-skill-name">{skill.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 搜索和筛选 */}
      <View className="search-section">
        <View className="search-bar">
          <Search size={18} color="rgba(255,255,255,0.6)" />
          <Input
            className="search-input"
            placeholder="搜索技能名称或描述"
            value={searchKeyword}
            onInput={(e) => setSearchKeyword(e.detail.value)}
            onConfirm={handleSearch}
          />
        </View>

        <View className="filter-bar">
          <ScrollView className="filter-scroll" scrollX>
            <View
              className={`filter-item ${!filter.category ? 'active' : ''}`}
              onClick={() => {
                setFilter({ ...filter, category: undefined })
                fetchSkills()
              }}
            >
              <Text className="filter-text">全部</Text>
            </View>
            {categories.slice(0, 5).map((cat) => (
              <View
                key={cat}
                className={`filter-item ${filter.category === cat ? 'active' : ''}`}
                onClick={() => {
                  setFilter({ ...filter, category: cat })
                  fetchSkills()
                }}
              >
                <Text className="filter-text">{cat}</Text>
              </View>
            ))}
            <View className="create-skill-filter-item" onClick={() => setShowCreateSkillDialog(true)}>
              <Brain size={14} color="#bf00ff" />
              <Text className="filter-text">创建技能</Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* 技能列表 */}
      <ScrollView className="skills-list" scrollY>
        {loading ? (
          <View className="loading-container">
            <Loader size={24} color="#00f5ff" className="spinning" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : !currentAvatar ? (
          <View className="empty-container">
            <UserPlus size={48} color="rgba(255,255,255,0.3)" />
            <Text className="empty-text">请先选择分身</Text>
            <Button
              className="create-avatar-btn"
              onClick={() => Taro.navigateTo({ url: '/pages/avatar-create/index' })}
            >
              <Sparkles size={16} color="#fff" />
              <Text>创建分身</Text>
            </Button>
          </View>
        ) : skills.length === 0 ? (
          <View className="empty-container">
            <Package size={48} color="rgba(255,255,255,0.3)" />
            <Text className="empty-text">暂无技能</Text>
          </View>
        ) : (
          skills.map((skill) => (
            <View key={skill.id} className="skill-card">
              <View className="skill-icon">
                <Text className="skill-icon-text">{skill.icon || '🎯'}</Text>
              </View>

              <View className="skill-info">
                <View className="skill-header">
                  <Text className="skill-name">{skill.name}</Text>
                  <Badge className="bg-blue-500">{skill.category}</Badge>
                </View>

                <Text className="skill-description">{skill.description}</Text>

                <View className="skill-tags">
                  {skill.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </View>

                <View className="skill-meta">
                  <View className="meta-item">
                    <Star size={14} color="#ffb800" />
                    <Text className="meta-text">{skill.rating.toFixed(1)} ({skill.rating_count})</Text>
                  </View>
                  <View className="meta-item">
                    <TrendingUp size={14} color="rgba(255,255,255,0.6)" />
                    <Text className="meta-text">{skill.purchase_count} 人添加</Text>
                  </View>
                </View>
              </View>

              <View className="skill-action">
                {isOwned(skill.id) ? (
                  <Badge className="bg-green-500">
                    <Sparkles size={12} color="#fff" />
                    <Text className="owned-text">已具备</Text>
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedSkill(skill)
                      setShowPurchaseDialog(true)
                    }}
                  >
                    <Sparkles size={14} color="#fff" />
                    <Text>添加技能</Text>
                  </Button>
                )}
              </View>
            </View>
          ))
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
                  <Star size={18} color="#00f5ff" />
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
                <View className="skill-icon large">
                  <Text className="skill-icon-text large">{selectedSkill.icon || '🎯'}</Text>
                </View>
                <View className="skill-detail">
                  <Text className="skill-name large">{selectedSkill.name}</Text>
                  <Text className="skill-description">{selectedSkill.description}</Text>
                </View>
              </View>

              <View className="purchase-avatar">
                <Text className="purchase-label">目标分身：</Text>
                <View className="purchase-avatar-info">
                  <Text className="purchase-avatar-emoji">{currentAvatar.name[0]}</Text>
                  <Text className="purchase-avatar-name">{currentAvatar.name}</Text>
                </View>
              </View>

              <View className="purchase-info">
                <Text className="purchase-hint">
                  添加后，{currentAvatar.name} 将具备 {selectedSkill.name} 能力，可以执行相关任务
                </Text>
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

      {/* 创建自定义技能弹窗 */}
      <Dialog open={showCreateSkillDialog} onOpenChange={setShowCreateSkillDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Brain size={20} color="#00f5ff" style={{ display: 'inline', marginRight: '8px' }} />
              创建自定义技能
            </DialogTitle>
          </DialogHeader>

          <View className="create-skill-content">
            <View className="form-item">
              <Text className="form-label">技能名称 *</Text>
              <Input
                className="form-input"
                placeholder="例如：智能客服助手"
                value={newSkillName}
                onInput={(e) => setNewSkillName(e.detail.value)}
              />
            </View>

            <View className="form-item">
              <Text className="form-label">技能描述 *</Text>
              <Textarea
                className="form-input form-textarea"
                placeholder="描述这个技能的功能和用途..."
                value={newSkillDescription}
                onInput={(e) => setNewSkillDescription(e.detail.value)}
                maxlength={500}
              />
            </View>

            <View className="ai-tip">
              <Sparkles size={14} color="#00f5ff" />
              <Text className="ai-tip-text">
                AI 将自动优化你的描述，生成技能标签和能力定义
              </Text>
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSkillDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateSkill} disabled={creatingSkill || !newSkillName.trim() || !newSkillDescription.trim()}>
              {creatingSkill ? 'AI 生成中...' : 'AI 生成并创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
