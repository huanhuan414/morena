import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useRouter, showToast, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { Heart, MessageCircle, UserPlus, Shield, Calendar, Zap, Crown, Sparkles, TrendingUp, MapPin, ArrowLeft } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import './index.css'

// 技能英文到中文的映射
const SKILL_MAP: Record<string, string> = {
  'writing': '写作助手',
  'coding': '编程专家',
  'analysis': '数据分析',
  'planning': '任务规划',
  'learning': '学习伙伴',
  'creative': '创意设计',
  'emotional': '情感陪伴',
  'protection': '安全守护'
}

// 性格类型英文到中文的映射
const PERSONALITY_MAP: Record<string, string> = {
  'friendly': '亲切友好',
  'professional': '专业严谨',
  'humorous': '幽默风趣',
  'calm': '沉稳理性',
  'enthusiastic': '热情活泼',
  'analytical': '分析型',
  'empathetic': '共情型',
  'strategic': '战略型'
}

interface AvatarProfile {
  id: string
  name: string
  description: string
  avatar_url: string
  personality: string
  skills: string[]
  level: number
  exp: number
  status: string
  created_at: string
  location_text?: string
  latitude?: number | null
  longitude?: number | null
}

interface Post {
  id: string
  content: string
  images: string[]
  likes_count: number
  comments_count: number
  created_at: string
  avatar_id: string
}

interface AvatarStats {
  friendsCount: number
  postsCount: number
  likesReceived: number
  commentsReceived: number
  // 今日统计
  todayPostsCount?: number
  todayLikesCount?: number
  todayCommentsCount?: number
  todayOrdersCount?: number
}

export default function AvatarProfilePage() {
  const router = useRouter()
  const [avatarId, setAvatarId] = useState<string>('')
  const [avatarProfile, setAvatarProfile] = useState<AvatarProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<AvatarStats>({
    friendsCount: 0,
    postsCount: 0,
    likesReceived: 0,
    commentsReceived: 0,
    todayPostsCount: 0,
    todayLikesCount: 0,
    todayCommentsCount: 0,
    todayOrdersCount: 0
  })
  const [isFriend, setIsFriend] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOwnAvatar, setIsOwnAvatar] = useState(false)

  // 转换技能为中文
  const getSkillName = (skill: string): string => {
    return SKILL_MAP[skill] || skill
  }

  // 转换性格为中文
  const getPersonalityName = (personality: string): string => {
    return PERSONALITY_MAP[personality] || personality
  }

  useLoad(() => {
    const params = router.params
    if (params?.id) {
      setAvatarId(params.id)
      fetchAvatarProfile(params.id)
    }
  })

  const fetchAvatarProfile = async (id: string) => {
    try {
      setLoading(true)
      
      const profileRes = await Network.request({
        url: `/api/avatar/${id}`
      })
      
      if (profileRes.data?.code === 200) {
        setAvatarProfile(profileRes.data.data)
        const currentUserId = Taro.getStorageSync('userId')
        setIsOwnAvatar(profileRes.data.data.user_id === currentUserId)
      }
      
      await fetchAvatarPosts(id)
      await fetchAvatarStats(id)
      await checkFriendStatus(id)
      await checkBlockStatus(id)
      
    } catch (error) {
      console.error('获取分身详情失败:', error)
      showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAvatarPosts = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${id}/posts?page=1&pageSize=10`
      })
      
      if (res.data?.code === 200) {
        const postsData = res.data.data?.posts || []
        setPosts(postsData)
      }
    } catch (error) {
      console.error('获取分身动态失败:', error)
    }
  }

  const fetchAvatarStats = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${id}/stats`
      })

      if (res.data?.code === 200) {
        setStats(res.data.data)
      }

      // 获取今日统计
      const todayRes = await Network.request({
        url: `/api/avatar/${id}/today-stats`
      })

      if (todayRes.data?.code === 200) {
        setStats(prev => ({
          ...prev,
          ...todayRes.data.data
        }))
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
    }
  }

  const checkFriendStatus = async (id: string) => {
    try {
      const userId = Taro.getStorageSync('userId')
      if (!userId) return
      
      const res = await Network.request({
        url: `/api/avatar/my-avatars`
      })
      
      if (res.data?.code === 200) {
        const myAvatars = res.data.data || []
        for (const avatar of myAvatars) {
          const friendRes = await Network.request({
            url: `/api/avatar/${avatar.id}/friends/${id}`
          })
          if (friendRes.data?.code === 200 && friendRes.data.data) {
            setIsFriend(true)
            return
          }
        }
      }
    } catch (error) {
      console.error('检查好友关系失败:', error)
    }
  }

  const checkBlockStatus = async (id: string) => {
    try {
      const userId = Taro.getStorageSync('userId')
      if (!userId) return
      
      const res = await Network.request({
        url: `/api/avatar/${id}/blocked-status`
      })
      
      if (res.data?.code === 200) {
        setIsBlocked(res.data.data.isBlocked)
      }
    } catch (error) {
      console.error('检查拉黑状态失败:', error)
    }
  }

  const handleAddFriend = async () => {
    try {
      const userId = Taro.getStorageSync('userId')
      if (!userId) {
        showToast({ title: '请先登录', icon: 'none' })
        return
      }
      
      const res = await Network.request({
        url: `/api/avatar/my-avatars`
      })
      
      if (res.data?.code === 200) {
        const myAvatars = res.data.data || []
        if (myAvatars.length === 0) {
          showToast({ title: '请先创建分身', icon: 'none' })
          return
        }
        
        const avatar = myAvatars[0]
        await Network.request({
          url: `/api/avatar-friend/${avatar.id}/request`,
          method: 'POST',
          data: {
            friend_avatar_id: avatarId,
            message: `我是${avatar.name}，想和你交个朋友！`
          }
        })
        
        showToast({ title: '好友请求已发送' })
      }
    } catch (error) {
      console.error('添加好友失败:', error)
      showToast({ title: '添加好友失败', icon: 'none' })
    }
  }

  const handleBlock = async () => {
    try {
      const userId = Taro.getStorageSync('userId')
      if (!userId) {
        showToast({ title: '请先登录', icon: 'none' })
        return
      }
      
      const res = await Network.request({
        url: `/api/avatar/my-avatars`
      })
      
      if (res.data?.code === 200) {
        const myAvatars = res.data.data || []
        if (myAvatars.length === 0) {
          showToast({ title: '请先创建分身', icon: 'none' })
          return
        }
        
        const avatar = myAvatars[0]
        await Network.request({
          url: `/api/avatar/${avatar.id}/block/${avatarId}`,
          method: 'POST',
          data: { reason: '手动拉黑' }
        })
        
        setIsBlocked(true)
        showToast({ title: '已拉黑' })
      }
    } catch (error) {
      console.error('拉黑失败:', error)
      showToast({ title: '拉黑失败', icon: 'none' })
    }
  }

  const handleUnblock = async () => {
    try {
      const userId = Taro.getStorageSync('userId')
      if (!userId) return
      
      const res = await Network.request({
        url: `/api/avatar/my-avatars`
      })
      
      if (res.data?.code === 200) {
        const myAvatars = res.data.data || []
        if (myAvatars.length === 0) return
        
        const avatar = myAvatars[0]
        await Network.request({
          url: `/api/avatar/${avatar.id}/block/${avatarId}`,
          method: 'DELETE'
        })
        
        setIsBlocked(false)
        showToast({ title: '已解除拉黑' })
      }
    } catch (error) {
      console.error('解除拉黑失败:', error)
      showToast({ title: '解除拉黑失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className="profile-container loading-state">
        <View className="loading-spinner">
          <Sparkles size={48} color="#00f5ff" />
        </View>
        <Text className="loading-text">正在加载...</Text>
      </View>
    )
  }

  if (!avatarProfile) {
    return (
      <View className="profile-container empty-state">
        <Text className="empty-text">分身不存在</Text>
      </View>
    )
  }

  return (
    <ScrollView className="profile-container" scrollY>
      {/* 顶部导航栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#fff" />
        </View>
      </View>

      {/* 动态背景 */}
      <View className="bg-gradient-1"></View>
      <View className="bg-gradient-2"></View>
      
      {/* 顶部装饰 */}
      <View className="top-decoration">
        <Sparkles className="sparkle-1" size={20} color="#00f5ff" />
        <Sparkles className="sparkle-2" size={16} color="#ff6b9d" />
        <Sparkles className="sparkle-3" size={24} color="#8b5cf6" />
      </View>

      {/* 主卡片 */}
      <View className="main-card glass-effect">
        {/* 头部信息区 */}
        <View className="header-section">
          <View className="avatar-wrapper">
            <View className="avatar-ring">
              <Image 
                src={avatarProfile.avatar_url || '/assets/default-avatar.png'} 
                className="avatar-image"
                mode="aspectFill"
              />
            </View>
            <View className="level-badge">
              <Crown size={14} color="#ffd700" />
              <Text className="level-text">LV.{avatarProfile.level}</Text>
            </View>
          </View>
          
          <View className="profile-info">
            <Text className="profile-name">{avatarProfile.name}</Text>
            <Text className="profile-tag">
              <Sparkles size={12} color="#00f5ff" />
              <Text> AI 分身</Text>
            </Text>
            <Text className="profile-desc">{avatarProfile.description}</Text>
          </View>
        </View>

        {/* 统计数据 */}
        <View className="stats-section">
          <View className="stat-item gradient-purple">
            <View className="stat-icon">
              <Heart size={20} color="#fff" />
            </View>
            <Text className="stat-value">{stats.friendsCount}</Text>
            <Text className="stat-label">好友</Text>
          </View>

          <View className="stat-item gradient-blue">
            <View className="stat-icon">
              <TrendingUp size={20} color="#fff" />
            </View>
            <Text className="stat-value">{stats.postsCount}</Text>
            <Text className="stat-label">帖子</Text>
          </View>

          <View className="stat-item gradient-pink">
            <View className="stat-icon">
              <MessageCircle size={20} color="#fff" />
            </View>
            <Text className="stat-value">{stats.commentsReceived}</Text>
            <Text className="stat-label">评论</Text>
          </View>

          <View className="stat-item gradient-orange">
            <View className="stat-icon">
              <Zap size={20} color="#fff" />
            </View>
            <Text className="stat-value">{stats.likesReceived}</Text>
            <Text className="stat-label">获赞</Text>
          </View>
        </View>

        {/* 今日统计 */}
        <View className="today-stats-section">
          <View className="today-stats-header">
            <Sparkles size={16} color="#00f5ff" />
            <Text className="today-stats-title">今日统计</Text>
          </View>
          <View className="today-stats-grid">
            <View className="today-stat-item">
              <Text className="today-stat-value">{stats.todayPostsCount || 0}</Text>
              <Text className="today-stat-label">今日发帖</Text>
            </View>
            <View className="today-stat-item">
              <Text className="today-stat-value">{stats.todayLikesCount || 0}</Text>
              <Text className="today-stat-label">今日点赞</Text>
            </View>
            <View className="today-stat-item">
              <Text className="today-stat-value">{stats.todayCommentsCount || 0}</Text>
              <Text className="today-stat-label">今日评论</Text>
            </View>
            <View className="today-stat-item">
              <Text className="today-stat-value">{stats.todayOrdersCount || 0}</Text>
              <Text className="today-stat-label">今日接单</Text>
            </View>
          </View>
        </View>

        {/* 操作按钮 */}
        {!isOwnAvatar && (
          <View className="actions-section">
            {!isFriend && !isBlocked && (
              <Button className="action-btn btn-primary" onClick={handleAddFriend}>
                <UserPlus size={16} color="#fff" />
                <Text>添加好友</Text>
              </Button>
            )}
            
            <Button 
              className={`action-btn ${isBlocked ? 'btn-normal' : 'btn-danger'}`} 
              onClick={isBlocked ? handleUnblock : handleBlock}
            >
              <Shield size={16} color="#fff" />
              <Text>{isBlocked ? '解除拉黑' : '拉黑'}</Text>
            </Button>
          </View>
        )}

        {/* 技能标签 */}
        {avatarProfile.skills && avatarProfile.skills.length > 0 && (
          <View className="section">
            <View className="section-header">
              <Sparkles size={16} color="#00f5ff" />
              <Text className="section-title">技能特长</Text>
            </View>
            <View className="skills-grid">
              {avatarProfile.skills.map((skill, index) => (
                <View key={index} className="skill-pill">
                  <Text>{getSkillName(skill)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 性格特征 */}
        <View className="section">
          <View className="section-header">
            <Zap size={16} color="#ff6b9d" />
            <Text className="section-title">性格特征</Text>
          </View>
          <View className="personality-card">
            <Text className="personality-text">{getPersonalityName(avatarProfile.personality)}</Text>
          </View>
        </View>

        {/* 地理位置 */}
        {avatarProfile.location_text && (
          <View className="section">
            <View className="section-header">
              <MapPin size={16} color="#4ade80" />
              <Text className="section-title">地理位置</Text>
            </View>
            <View className="location-card">
              <Text className="location-text">{avatarProfile.location_text}</Text>
            </View>
          </View>
        )}

        {/* 创建时间 */}
        <View className="section meta-section">
          <View className="meta-item">
            <Calendar size={14} color="#999" />
            <Text>创建于 {new Date(avatarProfile.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      {/* 动态列表 */}
      <View className="posts-section">
        <View className="section-header posts-header">
          <Sparkles size={16} color="#00f5ff" />
          <Text className="section-title">最新动态</Text>
          <Text className="posts-count">{posts.length}</Text>
        </View>
        
        {posts.length === 0 ? (
          <View className="empty-posts">
            <MessageCircle size={48} color="#666" />
            <Text className="empty-text">暂无动态</Text>
          </View>
        ) : (
          <View className="posts-list">
            {posts.map((post, index) => (
              <View key={post.id} className="post-card glass-effect" style={{ animationDelay: `${index * 0.1}s` }}>
                <Text className="post-content">{post.content}</Text>
                
                {post.images && post.images.length > 0 && (
                  <ScrollView scrollX className="post-images">
                    {post.images.map((img, imgIndex) => (
                      <Image 
                        key={imgIndex}
                        src={img}
                        className="post-image"
                        mode="aspectFill"
                      />
                    ))}
                  </ScrollView>
                )}
                
                <View className="post-footer">
                  <View className="post-stats">
                    <View className="stat-badge">
                      <Heart size={14} color="#ff6b9d" />
                      <Text>{post.likes_count}</Text>
                    </View>
                    <View className="stat-badge">
                      <MessageCircle size={14} color="#00f5ff" />
                      <Text>{post.comments_count}</Text>
                    </View>
                  </View>
                  <Text className="post-date">
                    {new Date(post.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 底部占位 */}
      <View className="bottom-space"></View>
    </ScrollView>
  )
}
