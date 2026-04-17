import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, navigateTo } from '@tarojs/taro'
import * as Network from '@/network'
import { User, MapPin, Star, Zap, Heart, Sparkles, Send } from 'lucide-react-taro'
import './index.css'

interface RecommendedAvatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  abilities: string[]
  exp: number
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
  const [userLocation, setUserLocation] = useState<{
    latitude: number | null
    longitude: number | null
  }>({
    latitude: null,
    longitude: null
  })

  useLoad(() => {
    loadRecommendations()
  })

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      
      // 获取用户位置
      try {
        const locationRes = await Taro.getLocation({
          type: 'wgs84'
        })
        setUserLocation({
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        })
      } catch (error) {
        console.warn('获取位置失败:', error)
      }

      // 请求推荐分身
      const res = await Network.request({
        url: '/api/avatar/recommendations',
        method: 'POST',
        data: {
          location: userLocation,
          limit: 20
        }
      })

      if (res.data?.code === 200) {
        setAvatars(res.data.data || [])
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

  const sendFriendRequest = async (avatarId: string) => {
    try {
      const res = await Network.request({
        url: '/api/avatar/friend-request',
        method: 'POST',
        data: { targetAvatarId: avatarId }
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
      url: `/pages/avatar-detail/index?avatarId=${avatarId}`
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
          <View className="filter-tag active">
            <Sparkles size={16} color="#06b6d4" />
            <Text className="filter-text">综合推荐</Text>
          </View>
          <View className="filter-tag">
            <Star size={16} color="#94a3b8" />
            <Text className="filter-text">高等级</Text>
          </View>
          <View className="filter-tag">
            <MapPin size={16} color="#94a3b8" />
            <Text className="filter-text">距离近</Text>
          </View>
          <View className="filter-tag">
            <Heart size={16} color="#94a3b8" />
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
        ) : avatars.length === 0 ? (
          <View className="empty-container">
            <User size={64} color="#cbd5e1" />
            <Text className="empty-text">暂无推荐分身</Text>
            <Text className="empty-hint">稍后再来看看吧</Text>
          </View>
        ) : (
          avatars.map((avatar, index) => (
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
                    className="avatar-avatar-img"
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
