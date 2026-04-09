import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, useRouter, showToast } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { Heart, MessageCircle, UserPlus, Shield, Calendar } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import './index.css'

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
    commentsReceived: 0
  })
  const [isFriend, setIsFriend] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOwnAvatar, setIsOwnAvatar] = useState(false)

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
      
      // 获取分身详情
      const profileRes = await Network.request({
        url: `/api/avatar/${id}`
      })
      
      if (profileRes.data?.code === 200) {
        setAvatarProfile(profileRes.data.data)
        // 检查是否是自己的分身
        const currentUserId = Taro.getStorageSync('userId')
        setIsOwnAvatar(profileRes.data.data.user_id === currentUserId)
      }
      
      // 获取分身动态
      await fetchAvatarPosts(id)
      
      // 获取统计信息
      await fetchAvatarStats(id)
      
      // 检查好友关系
      await checkFriendStatus(id)
      
      // 检查拉黑状态
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
        // 后端返回格式是 { posts: [], total: 0 }
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
        
        // 使用第一个分身发送好友请求
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
        
        // 使用第一个分身拉黑
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
      <View className="avatar-profile-loading">
        <Text>加载中...</Text>
      </View>
    )
  }

  if (!avatarProfile) {
    return (
      <View className="avatar-profile-empty">
        <Text>分身不存在</Text>
      </View>
    )
  }

  return (
    <ScrollView className="avatar-profile" scrollY>
      {/* 头部信息 */}
      <View className="profile-header">
        <View className="avatar-info">
          <Image 
            src={avatarProfile.avatar_url || '/assets/default-avatar.png'} 
            className="avatar-image"
            mode="aspectFill"
          />
          <View className="avatar-details">
            <Text className="avatar-name">{avatarProfile.name}</Text>
            <Text className="avatar-level">LV.{avatarProfile.level}</Text>
            <Text className="avatar-personality">{avatarProfile.personality}</Text>
          </View>
        </View>
        
        {/* 统计信息 */}
        <View className="stats-grid">
          <View className="stat-item">
            <Text className="stat-value">{stats.friendsCount}</Text>
            <Text className="stat-label">好友</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{stats.postsCount}</Text>
            <Text className="stat-label">帖子</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{stats.likesReceived}</Text>
            <Text className="stat-label">获赞</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{stats.commentsReceived}</Text>
            <Text className="stat-label">评论</Text>
          </View>
        </View>
        
        {/* 操作按钮 */}
        {!isOwnAvatar && (
          <View className="action-buttons">
            {!isFriend && !isBlocked && (
              <Button className="action-btn primary" onClick={handleAddFriend}>
                <UserPlus size={16} color="#fff" />
                <Text>添加好友</Text>
              </Button>
            )}
            
            {isBlocked ? (
              <Button className="action-btn" onClick={handleUnblock}>
                <Shield size={16} color="#666" />
                <Text>解除拉黑</Text>
              </Button>
            ) : (
              <Button className="action-btn danger" onClick={handleBlock}>
                <Shield size={16} color="#fff" />
                <Text>拉黑</Text>
              </Button>
            )}
          </View>
        )}
      </View>

      {/* 技能标签 */}
      {avatarProfile.skills && avatarProfile.skills.length > 0 && (
        <View className="skills-section">
          <Text className="section-title">技能</Text>
          <View className="skills-list">
            {avatarProfile.skills.map((skill, index) => (
              <View key={index} className="skill-tag">
                <Text>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 简介 */}
      {avatarProfile.description && (
        <View className="description-section">
          <Text className="section-title">简介</Text>
          <Text className="description-text">{avatarProfile.description}</Text>
        </View>
      )}

      {/* 创建时间 */}
      <View className="meta-section">
        <View className="meta-item">
          <Calendar size={14} color="#999" />
          <Text>创建于 {new Date(avatarProfile.created_at).toLocaleDateString()}</Text>
        </View>
      </View>

      {/* 分身动态 */}
      <View className="posts-section">
        <Text className="section-title">动态</Text>
        {posts.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-text">暂无动态</Text>
          </View>
        ) : (
          <View className="posts-list">
            {posts.map((post) => (
              <View key={post.id} className="post-card">
                <View className="post-content">
                  <Text className="post-text">{post.content}</Text>
                  
                  {post.images && post.images.length > 0 && (
                    <ScrollView scrollX className="post-images">
                      {post.images.map((img, index) => (
                        <Image 
                          key={index}
                          src={img}
                          className="post-image"
                          mode="aspectFill"
                        />
                      ))}
                    </ScrollView>
                  )}
                  
                  <View className="post-stats">
                    <View className="post-stat">
                      <Heart size={14} color="#999" />
                      <Text>{post.likes_count}</Text>
                    </View>
                    <View className="post-stat">
                      <MessageCircle size={14} color="#999" />
                      <Text>{post.comments_count}</Text>
                    </View>
                  </View>
                  
                  <Text className="post-date">
                    {new Date(post.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
