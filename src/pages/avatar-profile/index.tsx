import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { ArrowLeft, MapPin, Star, Sparkles, Users, Calendar, BookOpen, Heart, Eye } from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
import './index.css'

interface AvatarProfile {
  id: string
  name: string
  avatar_url: string
  level: number
  exp: number
  personality: string
  abilities: string[]
  appearance_style?: string
  description: string
  post_count?: number
  followers_count?: number
  location?: string
  created_at?: string
  views_count?: number
  likes_count?: number
  shares_count?: number
}

const PERSONALITY_MAP: Record<string, string> = {
  'warm': '温暖型',
  'humorous': '幽默型',
  'professional': '专业型',
  'creative': '创意型',
  'caring': '关怀型',
  'confident': '自信型',
  'optimistic': '乐观型',
  'steady': '稳重型'
}

export default function AvatarProfilePage() {
  const router = useRouter()
  const avatarId = router.params.id
  
  const [profile, setProfile] = useState<AvatarProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)
    if (avatarId) {
      fetchAvatarProfile(avatarId)
    }
  })

  const fetchAvatarProfile = async (id: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/avatar/${id}`
      })
      
      if (res.data?.code === 200) {
        setProfile(res.data.data)
      }
    } catch (error) {
      console.error('获取分身资料失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPersonalityText = (key: string) => {
    return PERSONALITY_MAP[key] || key
  }

  return (
    <View className="avatar-profile-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-top">
          <View 
            className="back-button" 
            style={{ width: `${capsulePlaceholderWidth}rpx` }}
            onClick={() => navigateBack()}
          >
            <ArrowLeft size={24} color="#333" />
          </View>
          <Text className="page-title">分身主页</Text>
          <View style={{ width: `${capsulePlaceholderWidth}rpx` }} />
        </View>
      </View>

      <ScrollView scrollY className="profile-scroll">
        {loading ? (
          <View className="loading-state">
            <Sparkles size={32} color="#666" className="animate-spin" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : profile ? (
          <View className="profile-content">
            {/* 头像区域 */}
            <View className="avatar-section">
              <View className="avatar-wrapper">
                {profile.avatar_url ? (
                  <Image 
                    src={profile.avatar_url} 
                    className="avatar-image"
                    mode="aspectFill"
                  />
                ) : (
                  <View className="avatar-placeholder">
                    <Sparkles size={64} color="#999" />
                  </View>
                )}
                <View className="level-badge">
                  <Star size={12} color="#fff" />
                  <Text className="level-text">Lv.{profile.level}</Text>
                </View>
              </View>
              
              <View className="info-wrapper">
                <Text className="avatar-name">{profile.name}</Text>
                <View className="tag-row">
                  <View className="personality-tag">
                    <Text className="personality-text">{getPersonalityText(profile.personality)}</Text>
                  </View>
                  {profile.location && (
                    <View className="location-tag">
                      <MapPin size={12} color="#666" />
                      <Text className="location-text">{profile.location}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* 数据统计 - 横向卡片 */}
            <View className="stats-card">
              <View className="stat-item">
                <View className="stat-icon">
                  <BookOpen size={18} color="#667eea" />
                </View>
                <Text className="stat-value">{profile.post_count || 0}</Text>
                <Text className="stat-label">发布</Text>
              </View>
              <View className="stat-item">
                <View className="stat-icon">
                  <Eye size={18} color="#10b981" />
                </View>
                <Text className="stat-value">{profile.views_count || 0}</Text>
                <Text className="stat-label">浏览</Text>
              </View>
              <View className="stat-item">
                <View className="stat-icon">
                  <Heart size={18} color="#f43f5e" />
                </View>
                <Text className="stat-value">{profile.likes_count || 0}</Text>
                <Text className="stat-label">获赞</Text>
              </View>
              <View className="stat-item">
                <View className="stat-icon">
                  <Users size={18} color="#8b5cf6" />
                </View>
                <Text className="stat-value">{profile.followers_count || 0}</Text>
                <Text className="stat-label">粉丝</Text>
              </View>
            </View>

            {/* 简介 */}
            <View className="section-card">
              <Text className="section-title">个人简介</Text>
              <Text className="section-content">
                {profile.description || '暂无简介'}
              </Text>
            </View>

            {/* 能力标签 */}
            {profile.abilities && profile.abilities.length > 0 && (
              <View className="section-card">
                <Text className="section-title">擅长领域</Text>
                <View className="abilities-list">
                  {profile.abilities.map((ability, index) => (
                    <View key={index} className="ability-tag">
                      <Text className="ability-text">{ability}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 入驻时间 */}
            {profile.created_at && (
              <View className="time-card">
                <Calendar size={16} color="#999" />
                <Text className="time-text">
                  于 {new Date(profile.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })} 入驻
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="empty-state">
            <Users size={64} color="#ddd" />
            <Text className="empty-text">未找到分身资料</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
