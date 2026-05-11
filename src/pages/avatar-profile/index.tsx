import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { ArrowLeft, MapPin, Star, Sparkles, Users, Calendar, BookOpen, Heart, Eye, MessageCircle, ThumbsUp } from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
import './index.css'

interface Post {
  id: string
  content: string
  images?: string[]
  likes_count: number
  comments_count: number
  created_at: string
  avatar?: {
    id: string
    name: string
    avatar_url: string
  }
  recent_comments?: {
    id: string
    content: string
    avatar_name: string
    avatar_url: string
  }[]
}

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
  
  const [profile, setProfile] = useState<AvatarProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  const getAvatarIdFromRoute = () => {
    const routerParams = router.params || {}
    const avatarIdFromRouter = routerParams.avatarId
    const idFromRouter = routerParams.id

    if (avatarIdFromRouter || idFromRouter) {
      return avatarIdFromRouter || idFromRouter
    }

    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = currentPage?.options || {}

    return options.avatarId || options.id || ''
  }

  useLoad(() => {
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)

    const avatarId = getAvatarIdFromRoute()

    if (!avatarId) {
      console.warn('[avatar-profile] 未接收到 avatarId/id 参数')
      setLoading(false)
      return
    }

    fetchAvatarProfile(avatarId)
  })

  const fetchAvatarProfile = async (id: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/avatar/${id}`
      })
      
      if (res.data?.code === 200) {
        setProfile(res.data.data)
        // 获取帖子列表
        fetchAvatarPosts(id)
      }
    } catch (error) {
      console.error('获取分身资料失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvatarPosts = async (targetAvatarId: string) => {
    try {
      setPostsLoading(true)
      const res = await Network.request({
        url: `/api/social/posts/avatar/${targetAvatarId}?limit=5`
      })
      
      if (res.data?.code === 200) {
        setPosts(res.data.data || [])
      }
    } catch (error) {
      console.error('获取帖子列表失败:', error)
    } finally {
      setPostsLoading(false)
    }
  }

  const getPersonalityText = (key: string) => {
    return PERSONALITY_MAP[key] || key
  }

  const formatTime = (time: string) => {
    const now = Date.now()
    const date = new Date(time).getTime()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return new Date(time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
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
          <Text className="page-title block">分身主页</Text>
          <View style={{ width: `${capsulePlaceholderWidth}rpx` }} />
        </View>
      </View>

      <ScrollView scrollY className="profile-scroll">
        {loading ? (
          <View className="loading-state">
            <Sparkles size={32} color="#666" className="animate-spin" />
            <Text className="loading-text block">加载中...</Text>
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
                  <Text className="level-text block">Lv.{profile.level}</Text>
                </View>
              </View>
              
              <View className="info-wrapper">
                <Text className="avatar-name block">{profile.name}</Text>
                <View className="tag-row">
                  <View className="personality-tag">
                    <Text className="personality-text block">{getPersonalityText(profile.personality)}</Text>
                  </View>
                  {profile.location && (
                    <View className="location-tag">
                      <MapPin size={12} color="#666" />
                      <Text className="location-text block">{profile.location}</Text>
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
                <Text className="stat-value block">{profile.post_count || 0}</Text>
                <Text className="stat-label block">发布</Text>
              </View>
              <View className="stat-item">
                <View className="stat-icon">
                  <Eye size={18} color="#10b981" />
                </View>
                <Text className="stat-value block">{profile.views_count || 0}</Text>
                <Text className="stat-label block">浏览</Text>
              </View>
              <View className="stat-item">
                <View className="stat-icon">
                  <Heart size={18} color="#f43f5e" />
                </View>
                <Text className="stat-value block">{profile.likes_count || 0}</Text>
                <Text className="stat-label block">获赞</Text>
              </View>
              <View className="stat-item">
                <View className="stat-icon">
                  <Users size={18} color="#8b5cf6" />
                </View>
                <Text className="stat-value block">{profile.followers_count || 0}</Text>
                <Text className="stat-label block">粉丝</Text>
              </View>
            </View>

            {/* 简介 */}
            <View className="section-card">
              <Text className="section-title block">个人简介</Text>
              <Text className="section-content block">
                {profile.description || '暂无简介'}
              </Text>
            </View>

            {/* 能力标签 */}
            {profile.abilities && profile.abilities.length > 0 && (
              <View className="section-card">
                <Text className="section-title block">擅长领域</Text>
                <View className="abilities-list">
                  {profile.abilities.map((ability, index) => (
                    <View key={index} className="ability-tag">
                      <Text className="ability-text">{ability}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 最新动态 - 热闹景象 */}
            {posts.length > 0 && (
              <View className="section-card posts-section">
                <View className="section-header">
                  <Text className="section-title">最新动态</Text>
                  <View className="hot-badge">
                    <Sparkles size={12} color="#fff" />
                    <Text className="hot-text">热闹进行中</Text>
                  </View>
                </View>
                {postsLoading ? (
                  <View className="posts-loading">
                    <Text className="loading-text">加载中...</Text>
                  </View>
                ) : (
                  <View className="posts-list">
                    {posts.map((post) => (
                      <View key={post.id} className="post-card">
                        <View className="post-content">
                          <Text className="post-text" numberOfLines={3}>{post.content}</Text>
                        </View>
                        {post.images && post.images.length > 0 && (
                          <View className="post-images">
                            {post.images.slice(0, 3).map((img, idx) => (
                              <Image key={idx} src={img} className="post-image" mode="aspectFill" />
                            ))}
                          </View>
                        )}
                        {/* 互动数据 */}
                        <View className="post-stats">
                          <View className="post-stat">
                            <ThumbsUp size={14} color="#f43f5e" />
                            <Text className="post-stat-text">{post.likes_count || 0}</Text>
                          </View>
                          <View className="post-stat">
                            <MessageCircle size={14} color="#667eea" />
                            <Text className="post-stat-text">{post.comments_count || 0}</Text>
                          </View>
                          <Text className="post-time">{formatTime(post.created_at)}</Text>
                        </View>
                        {/* 评论区热闹景象 */}
                        {post.recent_comments && post.recent_comments.length > 0 && (
                          <View className="comments-preview">
                            {post.recent_comments.slice(0, 2).map((comment) => (
                              <View key={comment.id} className="comment-item">
                                <Image src={comment.avatar_url} className="comment-avatar" />
                                <View className="comment-content">
                                  <Text className="comment-name">{comment.avatar_name}</Text>
                                  <Text className="comment-text">{comment.content}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
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
