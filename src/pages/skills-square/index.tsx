// eslint-disable-next-line no-restricted-syntax
import { View, Text, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/stores/user'
import {
  Sparkles,
  ShoppingCart,
  Star,
  Search,
  TrendingUp,
  Package,
  Crown,
  Zap,
  Check,
  Loader
} from 'lucide-react-taro'
import './index.css'

interface Skill {
  id: string
  name: string
  description: string
  type: 'prebuilt' | 'custom' | 'paid'
  price: number
  category?: string
  icon?: string
  tags: string[]
  rating: number
  ratingCount: number
  purchaseCount: number
  usageCount: number
  createdAt: string
}

interface SkillFilter {
  type?: 'prebuilt' | 'custom' | 'paid'
  category?: string
  search?: string
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
      showToast({ title: '获取技能列表失败', icon: 'none' })
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
    if (!avatarId) return

    try {
      const res = await Network.request({
        url: `/api/skills/avatar/${avatarId}`,
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

  // 购买技能
  const handlePurchase = async () => {
    if (!selectedSkill || !avatarId) return

    try {
      setPurchasing(true)

      const res = await Network.request({
        url: '/api/skills/purchase',
        method: 'POST',
        data: {
          avatarId,
          skillId: selectedSkill.id
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '购买成功！', icon: 'success' })
        setShowPurchaseDialog(false)
        // 刷新列表
        fetchMySkills()
      } else {
        showToast({ title: res.data?.message || '购买失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[SkillSquare] 购买技能失败:', error)
      showToast({ title: '购买失败', icon: 'none' })
    } finally {
      setPurchasing(false)
    }
  }

  // 检查是否已拥有该技能
  const isOwned = (skillId: string) => mySkills.includes(skillId)

  // 获取类型显示名称
  const getTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      prebuilt: '预置',
      custom: '自定义',
      paid: '付费'
    }
    return typeMap[type] || type
  }

  // 获取类型颜色
  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      prebuilt: 'bg-blue-500',
      custom: 'bg-purple-500',
      paid: 'bg-orange-500'
    }
    return colorMap[type] || 'bg-gray-500'
  }

  // 搜索处理
  const handleSearch = () => {
    fetchSkills()
  }

  return (
    <View className="skill-square-container">
      {/* 头部 */}
      <View className="skill-square-header">
        <View className="header-content">
          <Text className="header-title">技能广场</Text>
          <Text className="header-subtitle">为你的分身解锁更多能力</Text>
        </View>
      </View>

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
            <View className={`filter-item ${!filter.type ? 'active' : ''}`} onClick={() => {
              setFilter({ ...filter, type: undefined })
              fetchSkills()
            }}>
              <Text className="filter-text">全部</Text>
            </View>
            <View className={`filter-item ${filter.type === 'prebuilt' ? 'active' : ''}`} onClick={() => {
              setFilter({ ...filter, type: 'prebuilt' })
              fetchSkills()
            }}>
              <Sparkles size={14} />
              <Text className="filter-text">预置</Text>
            </View>
            <View className={`filter-item ${filter.type === 'custom' ? 'active' : ''}`} onClick={() => {
              setFilter({ ...filter, type: 'custom' })
              fetchSkills()
            }}>
              <Zap size={14} />
              <Text className="filter-text">自定义</Text>
            </View>
            <View className={`filter-item ${filter.type === 'paid' ? 'active' : ''}`} onClick={() => {
              setFilter({ ...filter, type: 'paid' })
              fetchSkills()
            }}>
              <Crown size={14} />
              <Text className="filter-text">付费</Text>
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
                  <Badge className={getTypeColor(skill.type)}>
                    {getTypeName(skill.type)}
                  </Badge>
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
                    <Text className="meta-text">{skill.rating.toFixed(1)} ({skill.ratingCount})</Text>
                  </View>
                  <View className="meta-item">
                    <TrendingUp size={14} color="rgba(255,255,255,0.6)" />
                    <Text className="meta-text">{skill.purchaseCount} 人购买</Text>
                  </View>
                </View>
              </View>

              <View className="skill-action">
                {skill.price === 0 ? (
                  isOwned(skill.id) ? (
                    <Badge className="bg-green-500">已拥有</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSkill(skill)
                        setShowPurchaseDialog(true)
                      }}
                    >
                      <Sparkles size={14} color="#fff" />
                      <Text>免费添加</Text>
                    </Button>
                  )
                ) : (
                  isOwned(skill.id) ? (
                    <Badge className="bg-green-500">已拥有</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSkill(skill)
                        setShowPurchaseDialog(true)
                      }}
                    >
                      <ShoppingCart size={14} color="#fff" />
                      <Text>¥{skill.price.toFixed(2)}</Text>
                    </Button>
                  )
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 购买确认弹窗 */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>购买技能</DialogTitle>
          </DialogHeader>

          {selectedSkill && (
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

              <View className="purchase-price">
                <Text className="price-label">价格：</Text>
                <Text className="price-value">
                  {selectedSkill.price === 0 ? '免费' : `¥${selectedSkill.price.toFixed(2)}`}
                </Text>
              </View>

              <View className="purchase-warning">
                <Text className="warning-text">购买后该技能将添加到当前分身，不可退款</Text>
              </View>
            </View>
          )}

