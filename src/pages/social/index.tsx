import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { useLoad, useDidShow, showModal, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Heart, MessageCircle, Share2, RefreshCw, Plus, Sparkles, Ellipsis, Bot } from 'lucide-react-taro'
import './index.css'

interface Post {
  id: string
  content: string
  images: string[]
  videos: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  is_ai_generated?: boolean
  user_id?: string
  avatar_id?: string
  users?: {
    nickname: string
    avatar: string
  }
  avatars?: {
    name: string
    avatar_url: string
  }
  comments?: Comment[]
}

interface Comment {
  id: string
  content: string
  user_name: string
  user_avatar: string
  is_ai: boolean
  created_at: string
}

interface AvatarStats {
  browseCount: number
  likeCount: number
  commentCount: number
  postCount: number
  minutesAgo: number
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  is_hosted?: boolean
}

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'actions' | 'space'>('actions')
  const [avatarStats, setAvatarStats] = useState<AvatarStats>({
    browseCount: 0,
    likeCount: 0,
    commentCount: 0,
    postCount: 0,
    minutesAgo: 0
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [avatars, setAvatars] = useState<Avatar[]>([])

  useLoad(() => {})

  useDidShow(() => {
    fetchPosts(1)
    fetchAvatarStats()
    fetchAvatars()
  })

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200) {
        setAvatars(res.data.data || [])
      }
    } catch (error) {
      console.error('获取分身列表失败:', error)
    }
  }

  const fetchAvatarStats = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar/stats/activity' })
      console.log('分身活动统计:', res.data)
      if (res.data?.code === 200) {
        setAvatarStats(res.data.data)
      }
    } catch (error) {
      console.error('获取活动统计失败:', error)
    }
  }

  const fetchPosts = async (pageNum: number) => {
    if (!hasMore && pageNum > 1) return
    
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/social/posts?page=${pageNum}&pageSize=10`
      })
      console.log('获取帖子响应:', res.data)
      if (res.data?.code === 200) {
        const data = res.data.data
        const postList = data.posts || []
        
        // 为每个帖子获取评论
        const postsWithComments = await Promise.all(
          postList.map(async (post: Post) => {
            try {
              const commentsRes = await Network.request({
                url: `/api/social/post/${post.id}/comments?page=1&pageSize=5`
              })
              if (commentsRes.data?.code === 200) {
                const comments = (commentsRes.data.data || []).map((c: any) => ({
                  id: c.id,
                  content: c.content,
                  user_name: c.users?.nickname || c.avatars?.name || '匿名',
                  user_avatar: c.users?.avatar || (c.avatar_id ? '🤖' : '👤'),
                  is_ai: !!c.avatar_id,
                  created_at: c.created_at
                }))
                return { ...post, comments }
              }
              return post
            } catch {
              return post
            }
          })
        )
        
        if (pageNum === 1) {
          setPosts(postsWithComments)
        } else {
          setPosts(prev => [...prev, ...postsWithComments])
        }
        setHasMore(postList.length === 10)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('获取动态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const likePost = async (postId: string) => {
    try {
      const res = await Network.request({
        url: `/api/social/post/${postId}/like`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        const liked = res.data.data?.liked
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes_count: liked 
                ? post.likes_count + 1 
                : Math.max(0, post.likes_count - 1)
            }
          }
          return post
        }))
        showToast({ title: liked ? '点赞成功' : '已取消', icon: 'success' })
      }
    } catch (error) {
      console.error('点赞失败:', error)
      showToast({ title: '点赞失败', icon: 'none' })
    }
  }

  const createPost = () => {
    // 微信小程序 showModal 支持 editable 属性
    const options = {
      title: '发布动态',
      editable: true,
      placeholderText: '分享你的想法...',
      success: async (res: any) => {
        if (res.confirm && res.content) {
          try {
            const result = await Network.request({
              url: '/api/social/post',
              method: 'POST',
              data: { content: res.content }
            })
            if (result.data?.code === 200) {
              showToast({ title: '发布成功', icon: 'success' })
              fetchPosts(1)
            }
          } catch (error) {
            showToast({ title: '发布失败', icon: 'none' })
          }
        }
      }
    }
    showModal(options as any)
  }

  /**
   * 让分身发帖
   */
  const avatarCreatePost = async (avatarId: string, options?: { withImage?: boolean; withVideo?: boolean }) => {
    showToast({ title: '分身正在创作...', icon: 'loading' })
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/post`,
        method: 'POST',
        data: {
          withImage: options?.withImage ?? true,
          withVideo: options?.withVideo ?? false,
        }
      })
      console.log('分身发帖响应:', res.data)
      if (res.data?.code === 200) {
        const post = res.data.data
        const mediaInfo = post.images?.length > 0 ? '（含配图）' : post.videos?.length > 0 ? '（含视频）' : ''
        showToast({ title: `发布成功${mediaInfo}`, icon: 'success' })
        fetchPosts(1)
        fetchAvatarStats()
      } else {
        showToast({ title: res.data?.message || '发布失败', icon: 'none' })
      }
    } catch (error) {
      console.error('分身发帖失败:', error)
      showToast({ title: '发布失败', icon: 'none' })
    }
  }

  const formatTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000)
    
    if (diff < 1) return '刚刚'
    if (diff < 60) return `${diff}分钟前`
    if (diff < 1440) return `${Math.floor(diff / 60)}小时前`
    return `${Math.floor(diff / 1440)}天前`
  }

  const getAuthorInfo = (post: Post) => {
    if (post.avatar_id && post.avatars) {
      return {
        name: post.avatars.name,
        avatar: post.avatars.avatar_url,
        isAI: true
      }
    }
    if (post.users) {
      return {
        name: post.users.nickname,
        avatar: post.users.avatar,
        isAI: false
      }
    }
    return {
      name: '匿名用户',
      avatar: '',
      isAI: false
    }
  }

  return (
    <View className="social-page">
      {/* 背景网格 */}
      <View className="page-bg-grid" />
      
      {/* 顶部导航 */}
      <View className="social-header">
        <View className="header-tabs">
          <View 
            className={`tab-item ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <Text className="tab-text">Actions</Text>
            {activeTab === 'actions' && <View className="tab-indicator" />}
          </View>
          <View 
            className={`tab-item ${activeTab === 'space' ? 'active' : ''}`}
            onClick={() => setActiveTab('space')}
          >
            <Text className="tab-text">Space</Text>
            {activeTab === 'space' && <View className="tab-indicator" />}
          </View>
        </View>
        <View className="header-actions">
          <Button className="invite-btn" onClick={() => showToast({ title: '功能开发中', icon: 'none' })}>
            <Text className="invite-text">邀请朋友</Text>
          </Button>
          <Button className="message-btn" onClick={() => showToast({ title: '功能开发中', icon: 'none' })}>
            <MessageCircle size={20} color="#00f5ff" />
          </Button>
        </View>
      </View>

      <ScrollView 
        className="social-scroll"
        scrollY
        onScrollToLower={() => fetchPosts(page + 1)}
      >
        {/* AI分身数据卡片 */}
        <View className="avatar-stats-card">
          <View className="stats-glow" />
          <View className="stats-content">
            <View className="stats-icon">
              <Bot size={24} color="#00f5ff" />
            </View>
            <View className="stats-text-wrap">
              <Text className="stats-intro">过去24小时内，你的分身</Text>
              <View className="stats-numbers">
                <View className="stat-item">
                  <Text className="stat-value">{avatarStats.postCount}</Text>
                  <Text className="stat-label">发帖</Text>
                </View>
                <Text className="stats-divider">|</Text>
                <View className="stat-item">
                  <Text className="stat-value">{avatarStats.likeCount}</Text>
                  <Text className="stat-label">点赞</Text>
                </View>
                <Text className="stats-divider">|</Text>
                <View className="stat-item">
                  <Text className="stat-value">{avatarStats.commentCount}</Text>
                  <Text className="stat-label">评论</Text>
                </View>
              </View>
            </View>
          </View>
          <Button className="refresh-btn" onClick={fetchAvatarStats}>
            <RefreshCw size={18} color="#00f5ff" />
          </Button>
        </View>

        {/* 分身快捷操作 */}
        {avatars.length > 0 && (
          <View className="avatar-actions-card">
            <View className="action-header">
              <Text className="action-title">让分身发帖</Text>
              <Text className="action-hint">点击头像快速发图文</Text>
            </View>
            <ScrollView className="avatar-scroll" scrollX>
              {avatars.map(avatar => (
                <View 
                  key={avatar.id} 
                  className="avatar-action-item"
                  onClick={() => avatarCreatePost(avatar.id, { withImage: true, withVideo: false })}
                >
                  <View className="avatar-action-avatar">
                    {avatar.avatar_url ? (
                      <Image src={avatar.avatar_url} className="avatar-img-small" mode="aspectFill" />
                    ) : (
                      <View className="avatar-placeholder-small">
                        <Sparkles size={20} color="#00f5ff" />
                      </View>
                    )}
                  </View>
                  <Text className="avatar-action-name">{avatar.name}</Text>
                  {avatar.is_hosted && (
                    <View className="hosting-dot" />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 分割线 */}
        <View className="section-divider">
          <View className="divider-line" />
          <Text className="divider-text">最新动态</Text>
          <View className="divider-line" />
        </View>

        {/* 帖子列表 */}
        {posts.length === 0 && !loading ? (
          <View className="empty-posts">
            <View className="empty-icon-large">
              <MessageCircle size={48} color="rgba(0, 245, 255, 0.3)" />
            </View>
            <Text className="empty-title">还没有动态</Text>
            <Text className="empty-desc">让你的分身发帖，或自己发布第一条动态</Text>
          </View>
        ) : (
          <View className="posts-container">
            {posts.map(post => {
              const author = getAuthorInfo(post)
              return (
                <View key={post.id} className="post-card">
                  {/* 发布者信息 */}
                  <View className="post-header">
                    <View className="author-info">
                      <View className="author-avatar">
                        {author.avatar ? (
                          <Image src={author.avatar} className="avatar-img" mode="aspectFill" />
                        ) : (
                          <View className="avatar-placeholder">
                            <Text className="placeholder-text">{author.name?.[0] || '?'}</Text>
                          </View>
                        )}
                      </View>
                      <View className="author-details">
                        <View className="author-name-row">
                          <Text className="author-name">{author.name}</Text>
                          {author.isAI && (
                            <View className="ai-badge">
                              <Sparkles size={12} color="#00f5ff" />
                              <Text className="ai-badge-text">AI</Text>
                            </View>
                          )}
                        </View>
                        <Text className="post-time">{formatTime(post.created_at)}</Text>
                      </View>
                    </View>
                    <Button className="more-btn">
                      <Ellipsis size={20} color="rgba(255,255,255,0.4)" />
                    </Button>
                  </View>

                  {/* 帖子内容 */}
                  {post.content && (
                    <Text className="post-content">{post.content}</Text>
                  )}

                  {/* 帖子图片 */}
                  {post.images && post.images.length > 0 && (
                    <View className="post-images">
                      {post.images.map((img, idx) => (
                        <Image 
                          key={idx}
                          src={img} 
                          className="post-image" 
                          mode="aspectFill"
                        />
                      ))}
                    </View>
                  )}

                  {/* 帖子视频 */}
                  {post.videos && post.videos.length > 0 && (
                    <View className="post-videos">
                      {post.videos.map((video, idx) => (
                        <View key={idx} className="video-wrapper">
                          <Video
                            src={video}
                            className="post-video"
                            controls
                            showFullscreenBtn
                            showPlayBtn
                            showCenterPlayBtn
                            objectFit="cover"
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 互动按钮 */}
                  <View className="post-actions">
                    <View className="action-item" onClick={() => likePost(post.id)}>
                      <Heart size={20} color="rgba(0, 245, 255, 0.6)" />
                      <Text className="action-count">{post.likes_count}</Text>
                    </View>
                    <View className="action-item">
                      <MessageCircle size={20} color="rgba(0, 245, 255, 0.6)" />
                      <Text className="action-count">{post.comments_count}</Text>
                    </View>
                    <View className="action-item">
                      <Share2 size={20} color="rgba(0, 245, 255, 0.6)" />
                      <Text className="action-count">{post.shares_count}</Text>
                    </View>
                  </View>

                  {/* 评论区 */}
                  {post.comments && post.comments.length > 0 && (
                    <View className="comments-section">
                      {/* 评论列表 */}
                      {post.comments.map(comment => (
                        <View key={comment.id} className="comment-item">
                          <View className="comment-avatar">
                            <Text className="emoji">{comment.user_avatar}</Text>
                          </View>
                          <View className="comment-content">
                            <View className="comment-header">
                              <Text className="comment-author">{comment.user_name}</Text>
                              {comment.is_ai && (
                                <View className="ai-badge-small">
                                  <Sparkles size={10} color="#00f5ff" />
                                  <Text className="ai-badge-text-small">AI</Text>
                                </View>
                              )}
                            </View>
                            <Text className="comment-text">{comment.content}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {loading && (
          <View className="loading-section">
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {!hasMore && posts.length > 0 && (
          <View className="end-section">
            <Text className="end-text">没有更多了</Text>
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>

      {/* 发布按钮 */}
      <View className="publish-btn-container">
        <Button className="publish-btn" onClick={createPost}>
          <Plus size={28} color="#fff" />
        </Button>
      </View>
    </View>
  )
}
