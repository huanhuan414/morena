import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { ArrowLeft, MapPin, Star, Sparkles, Users, Calendar } from 'lucide-react-taro'
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
            <ArrowLeft size={24} color="#fff" />
          </View>
          <Text className="page-title">分身资料</Text>
          <View style={{ width: `${capsulePlaceholderWidth}rpx` }} />
        </View>
      </View>

      <ScrollView scrollY className="profile-scroll">
        {loading ? (
          <View className="loading-state">
            <Sparkles size={32} color="#00f5ff" className="animate-spin" />
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
                    <Sparkles size={48} color="#00f5ff" />
                  </View>
                )}
                <View className="level-badge">
                  <View style={{ color: '#fbbf24' }}>
                    <Star size={12} color="#fbbf24" />
                  </View>
                  <Text className="level-text">Lv.{profile.level}</Text>
                </View>
              </View>
              <Text className="avatar-name">{profile.name}</Text>
              <View className="personality-tag">
                <Text className="personality-text">
                  {getPersonalityText(profile.personality)}
                </Text>
              </View>
            </View>

            {/* 统计信息 */}
            <View className="stats-section">
              <View className="stat-item">
                <Text className="stat-value">{profile.post_count || 0}</Text>
                <Text className="stat-label">发布数</Text>
              </View>
              <View className="stat-divider" />
              <View className="stat-item">
                <Text className="stat-value">{profile.followers_count || 0}</Text>
                <Text className="stat-label">粉丝</Text>
              </View>
              <View className="stat-divider" />
              <View className="stat-item">
                <Text className="stat-value">{profile.exp || 0}</Text>
                <Text className="stat-label">经验值</Text>
              </View>
            </View>

            {/* 简介 */}
            <View className="info-section">
              <Text className="section-title">简介</Text>
              <Text className="section-content">
                {profile.description || '暂无简介'}
              </Text>
            </View>

            {/* 能力标签 */}
            {profile.abilities && profile.abilities.length > 0 && (
              <View className="info-section">
                <Text className="section-title">能力</Text>
                <View className="abilities-list">
                  {profile.abilities.map((ability, index) => (
                    <View key={index} className="ability-tag">
                      <Text className="ability-text">{ability}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 位置信息 */}
            {profile.location && (
              <View className="info-section">
                <View className="info-row">
                  <MapPin size={16} color="#999" />
                  <Text className="info-text">{profile.location}</Text>
                </View>
              </View>
            )}

            {/* 创建时间 */}
            {profile.created_at && (
              <View className="info-section">
                <View className="info-row">
                  <Calendar size={16} color="#999" />
                  <Text className="info-text">
                    创建于 {new Date(profile.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View className="empty-state">
            <Users size={64} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">未找到分身资料</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
