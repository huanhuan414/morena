import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, navigateTo } from '@tarojs/taro'
import * as Network from '@/network'
import { User, MapPin, Star, Zap, Heart, Sparkles, Send } from 'lucide-react-taro'
import { getAvatarStyleClass } from '@/utils/avatar-style'
import './index.css'

interface RecommendedAvatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  abilities: string[]
  exp: number
  appearance_style?: string
  distance?: number
  matchScore: number
  description: string
  location?: {
    latitude: number
    longitude: number
  }
}

export default function AvatarRecommendPage() {
  const [avatars, setAvatars] = useState<RecommendedAvatar[]>([])
  const [loading, setLoading] = useState(true)
  const [currentAvatarId, setCurrentAvatarId] = useState<string>('')
  const [userLocation, setUserLocation] = useState<{
    latitude: number | null
    longitude: number | null
  }>({
    latitude: null,
    longitude: null
  })
  const [activeFilter, setActiveFilter] = useState<'all' | 'level' | 'distance' | 'personality'>('all')

  useLoad(() => {
    loadCurrentAvatar()
    loadRecommendations()
  })

  const loadCurrentAvatar = async () => {
    try {
      const res = await Network.request({
        url: '/api/avatar/my'
      })
      console.log('获取分身列表:', res.data)
      if (res.data?.data?.length > 0) {
        setCurrentAvatarId(res.data.data[0].id)
      }
    } catch (err) {
      console.error('获取分身失败:', err)
    }
  }

  const loadRecommendations = async () => {
    try {
      setLoading(true)

      // 1. 先获取用户位置
      let location = userLocation
      try {
        const locationRes = await Taro.getLocation({
          type: 'wgs84'
        })
        location = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
        setUserLocation(location)
        console.log('获取用户位置成功:', location)
      } catch (error) {
        console.warn('获取位置失败，将使用默认推荐:', error)
      }

      // 2. 请求推荐分身（使用获取到的位置）
      console.log('请求推荐分身，location:', location)
      const res = await Network.request({
        url: '/api/avatar/recommendations',
        method: 'POST',
        data: {
          location: location,
          limit: 20
        }
      })

      console.log('推荐分身响应:', res)

      if (res.data?.code === 200) {
        const recommendations = res.data.data || []
        console.log('获取到推荐分身数量:', recommendations.length)
        setAvatars(recommendations)

        if (recommendations.length === 0) {
          Taro.showToast({
            title: '暂无推荐分身',
            icon: 'none',
            duration: 2000
          })
        }
      } else {
        console.error('推荐分身API返回错误:', res.data)
        Taro.showToast({
          title: res.data?.msg || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载推荐失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getFilteredAvatars = () => {
    if (activeFilter === 'all') return avatars

    return avatars.filter(avatar => {
      switch (activeFilter) {
        case 'level':
          return avatar.level >= 1
        case 'distance':
          return avatar.distance !== undefined && avatar.distance < 500
        case 'personality':
          return avatar.matchScore >= 50
        default:
          return true
      }
    })
  }

  const filteredAvatars = getFilteredAvatars()

  const sendFriendRequest = async (avatarId: string) => {
    if (!currentAvatarId) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }
    try {
      const res = await Network.request({
        url: '/api/avatar/friend-request',
        method: 'POST',
        data: { 
          avatar_id: currentAvatarId,
          target_avatar_id: avatarId 
        }
      })

      if (res.data?.code === 200) {
        Taro.showToast({
          title: '已发送好友请求',
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: res.data?.msg || '发送失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('发送好友请求失败:', error)
      Taro.showToast({
        title: '发送失败',
        icon: 'none'
      })
    }
  }

  const viewAvatar = (avatarId: string) => {
    navigateTo({
      url: `/pages/avatar-profile/index?avatarId=${avatarId}`
    })
  }

  const getMatchReason = (avatar: RecommendedAvatar): string => {
    const reasons: string[] = []

    if (avatar.distance !== undefined && avatar.distance < 50) {
      reasons.push('距离近')
    }

    if (avatar.matchScore >= 80) {
      reasons.push('性格匹配度高')
    }

    if (avatar.abilities.length > 0) {
      reasons.push('技能互补')
    }

    if (avatar.level >= 10) {
      reasons.push('优质分身')
    }

    return reasons.join(' · ')
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return '#06b6d4' // 青色
    if (score >= 60) return '#ffaa00' // 橙色
    return '#94a3b8' // 灰色
  }

  return (
    <View className="recommend-page">
      {/* 头部 */}
      <View className="page-header">
        <Text className="page-title">推荐分身</Text>
        <Text className="page-subtitle">为你精选的优质AI分身</Text>
      </View>

      {/* 推荐理由标签 */}
      <ScrollView className="filter-scroll" scrollX>
        <View className="filter-tags">
          <View
            className={`filter-tag ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <Sparkles size={16} color={activeFilter === 'all' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">综合推荐</Text>
          </View>
          <View
            className={`filter-tag ${activeFilter === 'level' ? 'active' : ''}`}
            onClick={() => setActiveFilter('level')}
          >
            <Star size={16} color={activeFilter === 'level' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">高等级</Text>
          </View>
          <View
            className={`filter-tag ${activeFilter === 'distance' ? 'active' : ''}`}
            onClick={() => setActiveFilter('distance')}
          >
            <MapPin size={16} color={activeFilter === 'distance' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">距离近</Text>
          </View>
          <View
            className={`filter-tag ${activeFilter === 'personality' ? 'active' : ''}`}
            onClick={() => setActiveFilter('personality')}
          >
            <Heart size={16} color={activeFilter === 'personality' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">性格匹配</Text>
          </View>
        </View>
      </ScrollView>

      {/* 分身列表 */}
      <ScrollView className="avatar-list" scrollY>
        {loading ? (
          <View className="loading-container">
            <Text className="loading-text">正在为你推荐...</Text>
          </View>
        ) : filteredAvatars.length === 0 ? (
          <View className="empty-container">
            <User size={64} color="#cbd5e1" />
            <Text className="empty-text">
              {activeFilter === 'all' ? '暂无推荐分身' : '没有符合条件的分身'}
            </Text>
            <Text className="empty-hint">
              {activeFilter === 'all' ? '稍后再来看看吧' : '试试其他筛选条件'}
            </Text>
          </View>
        ) : (
          filteredAvatars.map((avatar, index) => (
            <View 
              key={avatar.id} 
              className="avatar-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* 左侧头像和基本信息 */}
              <View className="avatar-info-section">
                <View className="avatar-avatar-container">
                  <View className="avatar-glow" />
                  <Image 
                    src={avatar.avatar_url}
                    className={`avatar-avatar-img ${getAvatarStyleClass(avatar.appearance_style)}`}
                    mode="aspectFill"
                  />
                  <View className="avatar-level-badge">
                    <Text className="level-text">Lv.{avatar.level}</Text>
                  </View>
                </View>

                <View className="avatar-details">
                  <Text className="avatar-name">{avatar.name}</Text>
                  <View className="avatar-meta">
                    <View className="meta-tag">
                      <Star size={12} color="#fbbf24" />
                      <Text className="meta-text">{avatar.exp} EXP</Text>
                    </View>
                    {avatar.distance !== undefined && (
                      <View className="meta-tag">
                        <MapPin size={12} color="#06b6d4" />
                        <Text className="meta-text">{avatar.distance.toFixed(1)}km</Text>
                      </View>
                    )}
                  </View>
                  <View className="personality-tags">
                    <Text className="personality-tag">{avatar.personality}</Text>
                  </View>
                  <Text className="avatar-desc">{avatar.description}</Text>
                </View>
              </View>

              {/* 匹配度分数 */}
              <View className="match-score-section">
                <View className="match-score-circle" style={{ borderColor: getMatchScoreColor(avatar.matchScore) }}>
                  <Text className="match-score-text" style={{ color: getMatchScoreColor(avatar.matchScore) }}>
                    {avatar.matchScore}
                  </Text>
                  <Text className="match-score-label">匹配度</Text>
                </View>
                <Text className="match-reason">{getMatchReason(avatar)}</Text>
              </View>

              {/* 技能标签 */}
              <View className="abilities-section">
                {avatar.abilities.slice(0, 3).map((ability, idx) => (
                  <View key={idx} className="ability-badge">
                    <Zap size={12} color="#06b6d4" />
                    <Text className="ability-text">{ability}</Text>
                  </View>
                ))}
              </View>

              {/* 操作按钮 */}
              <View className="action-buttons">
                <View 
                  className="action-btn secondary"
                  onClick={() => viewAvatar(avatar.id)}
                >
                  <Text className="action-text">查看动态</Text>
                </View>
                <View 
                  className="action-btn primary"
                  onClick={() => sendFriendRequest(avatar.id)}
                >
                  <Send size={16} color="#ffffff" />
                  <Text className="action-text">添加好友</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
