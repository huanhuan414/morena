import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/stores/user'
import Taro from '@tarojs/taro'
import { Star, Check, ShoppingCart, Search } from 'lucide-react-taro'
import './index.css'

interface Skill {
  id: string
  name: string
  description: string
  category: string
  price: number
  icon: string
  tags: string[]
  rating: number
  rating_count: number
  purchase_count: number
  requirements?: string
  status: string
  tool_name?: string
}

interface Avatar {
  id: string
  name: string
  avatar_url?: string
}

export default function SkillsSquare() {
  const { userInfo, avatarId, setAvatarId } = useUserStore()
  const [skills, setSkills] = useState<Skill[]>([])
  const [currentAvatar, setCurrentAvatar] = useState<Avatar | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [mySkills, setMySkills] = useState<string[]>([])
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

  // 打印环境信息
  useEffect(() => {
    console.log('[SkillSquare] 环境信息:')
    console.log('[SkillSquare] PROJECT_DOMAIN:', typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : 'undefined')
    console.log('[SkillSquare] window.location.hostname:', typeof window !== 'undefined' ? window.location.hostname : 'undefined')
  }, [])

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

      console.log('[SkillSquare] 开始获取技能列表，搜索关键词:', searchKeyword)

      // 构建请求参数，只传递有值的参数
      const params: any = {
        pageSize: 100,
        _t: Date.now()
      }
      if (searchKeyword && searchKeyword.trim()) {
        params.search = searchKeyword.trim()
      }

      // 使用 Network.request 发送请求
      const res = await Network.request({
        url: '/api/skills',
        method: 'GET',
        data: params
      })

      console.log('[SkillSquare] 完整响应:', res)
      console.log('[SkillSquare] res.data:', res.data)
      console.log('[SkillSquare] res.statusCode:', res.statusCode)

      // 直接使用已验证的方式：res.data.data.skills
      if (res.statusCode === 200 && res.data?.data?.skills && Array.isArray(res.data.data.skills)) {
        const skillsList = res.data.data.skills
        console.log('[SkillSquare] 技能列表长度:', skillsList.length)
        console.log('[SkillSquare] 技能列表内容:', skillsList.slice(0, 2))
        console.log('[SkillSquare] 即将调用 setSkills')
        setSkills(skillsList)
        console.log('[SkillSquare] 已调用 setSkills，skillsList 长度:', skillsList.length)
      } else {
        console.log('[SkillSquare] 未获取到技能数据')
        console.log('[SkillSquare] statusCode:', res.statusCode)
        console.log('[SkillSquare] res.data.code:', res.data?.code)
        console.log('[SkillSquare] res.data.data?.skills:', res.data?.data?.skills)
        console.log('[SkillSquare] 即将调用 setSkills([])')
        setSkills([])
        console.log('[SkillSquare] 已调用 setSkills([])')
      }
    } catch (error) {
      console.error('[SkillSquare] 获取技能列表失败:', error)
      Taro.showToast({ title: '获取技能列表失败', icon: 'none' })
      setSkills([])
    } finally {
      setLoading(false)
    }
  }

  // 获取我的技能
  const fetchMySkills = async () => {
    if (!currentAvatar?.id) return

    try {
      console.log('[SkillSquare] 开始获取分身技能，分身ID:', currentAvatar.id)
      const res = await Network.request({
        url: `/api/skills/avatar/${currentAvatar.id}`,
        method: 'GET'
      })

      console.log('[SkillSquare] 分身技能响应:', res)
      console.log('[SkillSquare] 分身技能数据:', res.data?.data)

      if (res.data?.code === 200) {
        const mySkillsList = res.data.data || []
        console.log('[SkillSquare] 技能列表数组:', mySkillsList)
        console.log('[SkillSquare] 第一个技能项:', mySkillsList[0])

        // 提取技能ID，尝试多种可能的字段名
        const skillIds = mySkillsList.map((s: any) => {
          // 尝试多种可能的字段名
          if (s.skillId) return s.skillId
          if (s.skill_id) return s.skill_id
          if (s.id) return s.id
          if (s.skill) return s.skill?.id || s.skill?.skillId || s.skill?.skill_id
          return s
        })
        console.log('[SkillSquare] 提取的技能ID列表:', skillIds)
        setMySkills(skillIds)
      }
    } catch (error) {
      console.error('[SkillSquare] 获取我的技能失败:', error)
    }
  }

  // 检查是否已拥有
  const isOwned = (skillId: string) => {
    const result = mySkills.includes(skillId)
    console.log('[SkillSquare] 检查技能是否已拥有:', {
      skillId,
      mySkills,
      result,
      mySkillsLength: mySkills.length
    })
    return result
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
          skillId: selectedSkill.id,
          avatarId: currentAvatar.id
        }
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '添加成功', icon: 'success' })
        setShowPurchaseDialog(false)
        setSelectedSkill(null)
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

  // 搜索
  const handleSearch = () => {
    fetchSkills()
  }

  useEffect(() => {
    fetchAvatars()
    fetchSkills()
  }, [])

  useEffect(() => {
    if (currentAvatar?.id) {
      fetchMySkills()
    }
  }, [currentAvatar?.id])

  // 追踪 skills 状态变化
  useEffect(() => {
    console.log('[SkillSquare] skills 状态变化，长度:', skills.length)
  }, [skills])

  // 追踪 mySkills 状态变化
  useEffect(() => {
    console.log('[SkillSquare] mySkills 状态变化:', mySkills)
    console.log('[SkillSquare] mySkills 长度:', mySkills.length)
  }, [mySkills])

  return (
    <View className="skills-square-container">
      {/* 头部 */}
      <View className="skills-header">
        <Text className="header-title">技能广场</Text>
        {currentAvatar && (
          <View className="avatar-selector">
            <Text className="avatar-name">{currentAvatar.name}</Text>
            <Text className="avatar-count">{mySkills.length} 个技能</Text>
          </View>
        )}
      </View>

      {/* 搜索框 */}
      <View className="search-container">
        <Search size={18} color="rgba(255,255,255,0.5)" />
        <Input
          className="search-input"
          placeholder="搜索技能名称"
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

      {/* 技能列表 */}
      <ScrollView className="skills-scroll" scrollY>
        {loading ? (
          <View className="loading-container">
            <Text>加载中...</Text>
          </View>
        ) : !currentAvatar ? (
          <View className="empty-container">
            <Text>请先创建分身</Text>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/avatar-create/index' })}>
              创建分身
            </Button>
          </View>
        ) : skills.length === 0 ? (
          <View className="empty-container">
            <Text>暂无技能</Text>
          </View>
        ) : (
          <View className="skills-grid">
            {skills.map((skill) => {
              const owned = isOwned(skill.id)
              console.log('[SkillSquare] 渲染技能卡片:', {
                skillId: skill.id,
                skillName: skill.name,
                owned,
                mySkills
              })
              return (
                <View key={skill.id} className={`skill-card ${owned ? 'owned' : ''}`}>
                  {/* 图标和分类 */}
                  <View className="card-top">
                    <View className="icon-wrapper">
                      <Text className="skill-icon">{skill.icon || '🎯'}</Text>
                    </View>
                    {owned && (
                      <View className="owned-badge">
                        <Check size={14} color="#00ff88" />
                        <Text className="owned-text">已添加</Text>
                      </View>
                    )}
                  </View>

                  {/* 内容 */}
                  <View className="card-content">
                    <Text className="category-tag">{skill.category}</Text>
                    <Text className="skill-name">{skill.name}</Text>
                    <Text className="skill-description">{skill.description}</Text>

                    {/* 标签 */}
                    {skill.tags && skill.tags.length > 0 && (
                      <View className="tags-container">
                        {skill.tags.slice(0, 2).map((tag, idx) => (
                          <View key={idx} className="tag">
                            <Text className="tag-text">{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* 底部 */}
                  <View className="card-footer">
                    <View className="stats">
                      <View className="stat-item">
                        <Star size={14} color="#ffb800" />
                        <Text className="stat-value">{skill.rating}</Text>
                        <Text className="stat-label">({skill.rating_count})</Text>
                      </View>
                      <View className="stat-item">
                        <Text className="stat-value">{skill.purchase_count}</Text>
                        <Text className="stat-label">人使用</Text>
                      </View>
                    </View>
                    {owned ? (
                      <Button className="action-btn owned" disabled>
                        <Check size={16} color="#00ff88" />
                        <Text>已添加</Text>
                      </Button>
                    ) : (
                      <Button
                        className="action-btn"
                        onClick={() => {
                          setSelectedSkill(skill)
                          setShowPurchaseDialog(true)
                        }}
                      >
                        <ShoppingCart size={16} color="#fff" />
                        <Text>添加</Text>
                      </Button>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* 购买弹窗 */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加技能</DialogTitle>
          </DialogHeader>
          {selectedSkill && (
            <View className="dialog-content">
              <View className="skill-preview">
                <Text className="preview-icon">{selectedSkill.icon || '🎯'}</Text>
                <View className="preview-info">
                  <Text className="preview-name">{selectedSkill.name}</Text>
                  <Text className="preview-desc">{selectedSkill.description}</Text>
                </View>
              </View>
              <View className="target-avatar">
                <Text className="target-label">目标分身</Text>
                <Text className="target-name">{currentAvatar?.name}</Text>
              </View>
            </View>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              <Text>取消</Text>
            </Button>
            <Button onClick={handlePurchase} disabled={purchasing}>
              <Text>{purchasing ? '添加中...' : '确认添加'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
