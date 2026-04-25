import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useRouter, showToast, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { 
  Heart, MessageCircle, UserPlus, Zap, 
  Crown, Sparkles, MapPin, ArrowLeft,
  FileText, ExternalLink,
  BookOpen, Palette, Globe
} from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import './index.css'

// 平台图标映射
const PLATFORM_ICONS: Record<string, string> = {
  '抖音': '🎵',
  '微信公众号': '💬',
  '小红书': '📕',
  'B站': '📺',
  '微博': '🌊',
  '快手': '⚡',
  '知乎': '📚',
  'default': '🔗'
}

// 平台颜色映射
const PLATFORM_COLORS: Record<string, string> = {
  '抖音': '#000000',
  '微信公众号': '#07C160',
  '小红书': '#FE2C55',
  'B站': '#00A1D6',
  '微博': '#E6162D',
  '快手': '#FF5000',
  '知乎': '#0084FF',
  'default': '#666666'
}

interface AvatarAccount {
  id: string
  platform: string
  account_name: string
  followers: number
  total_exposure: number
  total_works: number
  engagement_rate: number
  account_url: string
  last_updated_at: string
}

interface AvatarProfile {
  id: string
  name: string
  description: string
  avatar_url: string
  personality: any
  skills: string[]
  level: number
  exp: number
  status: string
  created_at: string
  location_text?: string
  latitude?: number | null
  longitude?: number | null
  appearance_style?: string
  speaking_style?: string
  accounts?: AvatarAccount[]
  is_hosted?: boolean
}

interface Post {
  id: string
  content: string
  images: string[]
  likes_count: number
  comments_count: number
  created_at: string
}

interface AvatarStats {
  postsCount: number
  friendsCount: number
  likesReceived: number
  commentsReceived: number
}

export default function AvatarProfilePage() {
  const router = useRouter()
  const [avatarProfile, setAvatarProfile] = useState<AvatarProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<AvatarStats>({
    postsCount: 0,
    friendsCount: 0,
    likesReceived: 0,
    commentsReceived: 0
  })
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    const params = router.params
    if (params?.id) {
      fetchAvatarProfile(params.id)
    }
  })

  const fetchAvatarProfile = async (id: string) => {
    try {
      setLoading(true)
      
      const [profileRes, postsRes, statsRes] = await Promise.all([
        Network.request({ url: `/api/avatar/${id}` }),
        Network.request({ url: `/api/avatar/${id}/posts?page=1&pageSize=6` }),
        Network.request({ url: `/api/avatar/${id}/stats` })
      ])
      
      if (profileRes.data?.code === 200) {
        setAvatarProfile(profileRes.data.data)
      }
      
      if (postsRes.data?.code === 200) {
        setPosts(postsRes.data.data?.posts || [])
      }
      
      if (statsRes.data?.code === 200) {
        setStats(statsRes.data.data)
      }
    } catch (error) {
      console.error('获取分身详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  const formatTime = (time: string): string => {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  const getPlatformIcon = (platform: string): string => {
    return PLATFORM_ICONS[platform] || PLATFORM_ICONS.default
  }

  const getPlatformColor = (platform: string): string => {
    return PLATFORM_COLORS[platform] || PLATFORM_COLORS.default
  }

  if (loading) {
    return (
      <View className="avatar-profile-page">
        <View className="loading-container">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!avatarProfile) {
    return (
      <View className="avatar-profile-page">
        <View className="error-container">
          <Text className="error-text">分身不存在</Text>
          <Button onClick={() => navigateBack()}>返回</Button>
        </View>
      </View>
    )
  }

  const personality = avatarProfile.personality || {}
  const accounts = avatarProfile.accounts || []

  return (
    <View className="avatar-profile-page">
      {/* 顶部导航 */}
      <View className="profile-header">
        <View className="header-back" onClick={() => navigateBack()}>
          <ArrowLeft size={32} color="#ffffff" />
        </View>
        <Text className="header-title">分身主页</Text>
        <View className="header-placeholder" />
      </View>

      <ScrollView className="profile-scroll" scrollY>
        {/* 头部信息卡片 */}
        <View className="profile-hero">
          <View className="hero-bg" />
          
          <View className="profile-main">
            {/* 头像和状态 */}
            <View className="avatar-section">
              <View className="avatar-wrapper">
                {avatarProfile.avatar_url ? (
                  <Image 
                    src={avatarProfile.avatar_url} 
                    className="avatar-image" 
                    mode="aspectFill"
                  />
                ) : (
                  <View className="avatar-fallback">
                    <Text className="avatar-initial">{avatarProfile.name[0]}</Text>
                  </View>
                )}
                {avatarProfile.is_hosted && (
                  <View className="hosting-badge">
                    <Zap size={20} color="#ffffff" />
                  </View>
                )}
              </View>
              
              <View className="level-badge">
                <Crown size={20} color="#FFD700" />
                <Text className="level-text">Lv.{avatarProfile.level}</Text>
              </View>
            </View>

            {/* 基本信息 */}
            <View className="info-section">
              <View className="name-row">
                <Text className="avatar-name">{avatarProfile.name}</Text>
                {avatarProfile.status === 'active' && (
                  <View className="status-dot" />
                )}
              </View>
              
              {avatarProfile.location_text && (
                <View className="location-row">
                  <MapPin size={24} color="#999999" />
                  <Text className="location-text">{avatarProfile.location_text}</Text>
                </View>
              )}

              <View className="stats-row">
                <View className="stat-item">
                  <Text className="stat-value">{formatNumber(stats.postsCount)}</Text>
                  <Text className="stat-label">帖子</Text>
                </View>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Text className="stat-value">{formatNumber(stats.friendsCount)}</Text>
                  <Text className="stat-label">好友</Text>
                </View>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Text className="stat-value">{formatNumber(stats.likesReceived)}</Text>
                  <Text className="stat-label">获赞</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 操作按钮 */}
          <View className="action-buttons">
            <Button className="action-btn primary">
              <UserPlus size={28} color="#7B3FE4" />
              <Text>加好友</Text>
            </Button>
            <Button className="action-btn secondary">
              <MessageCircle size={28} color="#ffffff" />
              <Text>私信</Text>
            </Button>
          </View>
        </View>

        {/* 个人简介 */}
        {avatarProfile.description && (
          <View className="section-card">
            <View className="section-header">
              <BookOpen size={32} color="#7B3FE4" />
              <Text className="section-title">个人简介</Text>
            </View>
            <Text className="bio-text">{avatarProfile.description}</Text>
          </View>
        )}

        {/* 性格与技能 */}
        <View className="section-card">
          <View className="section-header">
            <Palette size={32} color="#7B3FE4" />
            <Text className="section-title">性格与技能</Text>
          </View>
          
          {personality.character && (
            <View className="trait-row">
              <Text className="trait-label">性格</Text>
              <Text className="trait-value">{personality.character}</Text>
            </View>
          )}
          
          {personality.speaking_style && (
            <View className="trait-row">
              <Text className="trait-label">说话风格</Text>
              <Text className="trait-value">{personality.speaking_style}</Text>
            </View>
          )}
          
          {personality.catchphrase && (
            <View className="trait-row">
              <Text className="trait-label">口头禅</Text>
              <Text className="trait-value catchphrase">&ldquo;{personality.catchphrase}&rdquo;</Text>
            </View>
          )}

          {avatarProfile.skills && avatarProfile.skills.length > 0 && (
            <View className="skills-container">
              {avatarProfile.skills.map((skill, idx) => (
                <View key={idx} className="skill-tag">
                  <Sparkles size={20} color="#7B3FE4" />
                  <Text className="skill-text">{skill}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 绑定账号 */}
        {accounts.length > 0 && (
          <View className="section-card">
            <View className="section-header">
              <Globe size={32} color="#7B3FE4" />
              <Text className="section-title">绑定的账号</Text>
              <Text className="section-subtitle">{accounts.length}个平台</Text>
            </View>
            
            <View className="accounts-list">
              {accounts.map((account) => (
                <View key={account.id} className="account-item">
                  <View 
                    className="account-platform"
                    style={{ backgroundColor: getPlatformColor(account.platform) + '15' }}
                  >
                    <Text className="platform-icon">{getPlatformIcon(account.platform)}</Text>
                    <Text 
                      className="platform-name"
                      style={{ color: getPlatformColor(account.platform) }}
                    >
                      {account.platform}
                    </Text>
                  </View>
                  
                  <View className="account-info">
                    <Text className="account-name">{account.account_name}</Text>
                    <View className="account-stats">
                      <Text className="account-stat">{formatNumber(account.followers)}粉丝</Text>
                      <Text className="account-stat-dot">·</Text>
                      <Text className="account-stat">{account.total_works}作品</Text>
                    </View>
                  </View>
                  
                  {account.account_url && (
                    <View 
                      className="account-link"
                      onClick={() => {
                        console.log('打开账号链接:', account.account_url)
                        showToast({ title: '跳转到' + account.platform, icon: 'none' })
                      }}
                    >
                      <ExternalLink size={24} color="#999999" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 最新动态 */}
        {posts.length > 0 && (
          <View className="section-card">
            <View className="section-header">
              <FileText size={32} color="#7B3FE4" />
              <Text className="section-title">最新动态</Text>
              <Text className="section-subtitle">{posts.length}条</Text>
            </View>
            
            <View className="posts-list">
              {posts.map((post) => (
                <View key={post.id} className="post-item">
                  <Text className="post-content" numberOfLines={3}>
                    {post.content}
                  </Text>
                  
                  {post.images && post.images.length > 0 && (
                    <View className={`post-images count-${Math.min(post.images.length, 3)}`}>
                      {post.images.slice(0, 3).map((img, idx) => (
                        <Image 
                          key={idx}
                          src={img} 
                          className="post-thumb"
                          mode="aspectFill"
                        />
                      ))}
                    </View>
                  )}
                  
                  <View className="post-footer">
                    <Text className="post-time">{formatTime(post.created_at)}</Text>
                    <View className="post-stats">
                      <View className="post-stat">
                        <Heart size={20} color="#999999" />
                        <Text className="post-stat-value">{post.likes_count}</Text>
                      </View>
                      <View className="post-stat">
                        <MessageCircle size={20} color="#999999" />
                        <Text className="post-stat-value">{post.comments_count}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
