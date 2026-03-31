import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { useLoad, useDidShow, usePullDownRefresh, showModal, showToast, stopPullDownRefresh, useReady } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Heart, MessageCircle, Share2, RefreshCw, Plus, Sparkles, Ellipsis, Bot, Volume2, VolumeX } from 'lucide-react-taro'
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
  const [refreshing, setRefreshing] = useState(false)
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
  const [mutedVideos, setMutedVideos] = useState<Set<string>>(new Set())

  useLoad(() => {})

  useReady(() => {
    // 页面加载动画
  })

  useDidShow(() => {
    fetchPosts(1)
    fetchAvatarStats()
    fetchAvatars()
  })

  // 下拉刷新
  usePullDownRefresh(() => {
    setRefreshing(true)
    Promise.all([
      fetchPosts(1),
      fetchAvatarStats(),
      fetchAvatars()
    ]).finally(() => {
      setRefreshing(false)
      stopPullDownRefresh()
    })
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
      if (res.data?.code === 200) {
        const data = res.data.data
        const postList = data.posts || []
        
        const postsWithComments = await Promise.all(
          postList.map(async (post: Post) => {
            try {
              const commentsRes = await Network.request({
                url: `/api/social/post/${post.id}/comments?page=1&pageSize=3`
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
        showToast({ title: liked ? '已点赞 ❤️' : '已取消', icon: 'none' })
      }
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }

  const createPost = () => {
    const options = {
      title: '✨ 发布动态',
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
              showToast({ title: '发布成功 🎉', icon: 'success' })
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
    showToast({ title: 'AI正在创作中...', icon: 'loading', duration: 3000 })
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/post`,
        method: 'POST',
        data: {
          withImage: options?.withImage ?? true,
          withVideo: options?.withVideo ?? false,
        }
      })
      if (res.data?.code === 200) {
        const post = res.data.data
        const mediaInfo = post.images?.length > 0 ? '📸 含AI配图' : post.videos?.length > 0 ? '🎬 含AI视频' : '✨'
        showToast({ title: `发布成功 ${mediaInfo}`, icon: 'success' })
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
    if (diff < 10080) return `${Math.floor(diff / 1440)}天前`
    return date.toLocaleDateString()
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

  const toggleVideoMute = (videoId: string) => {
    setMutedVideos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(videoId)) {
        newSet.delete(videoId)
      } else {
        newSet.add(videoId)
      }
      return newSet
    })
  }

  return (
    <View className="social-page">
      {/* 动态背景 */}
      <View className="animated-bg">
        <View className="bg-gradient-1" />
        <View className="bg-gradient-2" />
        <View className="bg-particles" />
      </View>
      
      {/* 网格背景 */}
      <View className="grid-overlay" />
      
      {/* 顶部导航 */}
      <View className="social-header">
        <View className="header-content">
          <View className="header-brand">
            <View className="brand-icon">
              <Sparkles size={28} color="#00f5ff" />
            </View>
            <Text className="brand-text">莫瑞娜广场</Text>
          </View>
          <View className="header-actions">
            <Button className="action-btn message-btn" onClick={() => showToast({ title: '功能开发中', icon: 'none' })}>
              <MessageCircle size={22} color="#00f5ff" />
            </Button>
          </View>
        </View>
        
        {/* 标签切换 */}
        <View className="header-tabs">
          <View 
            className={`tab-item ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <Text className="tab-text">动态</Text>
            {activeTab === 'actions' && <View className="tab-glow" />}
          </View>
          <View 
            className={`tab-item ${activeTab === 'space' ? 'active' : ''}`}
            onClick={() => setActiveTab('space')}
          >
            <Text className="tab-text">空间</Text>
            {activeTab === 'space' && <View className="tab-glow" />}
          </View>
        </View>
      </View>

      <ScrollView 
        className="social-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          setRefreshing(true)
          Promise.all([fetchPosts(1), fetchAvatarStats(), fetchAvatars()]).finally(() => {
            setRefreshing(false)
          })
        }}
        onScrollToLower={() => fetchPosts(page + 1)}
      >
        {/* AI分身数据卡片 - 高级版 */}
        <View className="stats-card">
          <View className="stats-card-bg" />
          <View className="stats-card-content">
            <View className="stats-header">
              <View className="stats-icon-wrap">
                <Bot size={28} color="#00f5ff" />
              </View>
              <View className="stats-title-wrap">
                <Text className="stats-title">分身活动</Text>
                <Text className="stats-subtitle">过去24小时</Text>
              </View>
              <Button className="refresh-btn" onClick={fetchAvatarStats}>
                <RefreshCw size={18} color="#00f5ff" />
              </Button>
            </View>
            
            <View className="stats-grid">
              <View className="stat-card">
                <View className="stat-value-wrap">
                  <Text className="stat-value">{avatarStats.postCount}</Text>
                  <View className="stat-pulse" />
                </View>
                <Text className="stat-label">发帖</Text>
              </View>
              <View className="stat-card">
                <View className="stat-value-wrap">
                  <Text className="stat-value">{avatarStats.likeCount}</Text>
                </View>
                <Text className="stat-label">点赞</Text>
              </View>
              <View className="stat-card">
                <View className="stat-value-wrap">
                  <Text className="stat-value">{avatarStats.commentCount}</Text>
                </View>
                <Text className="stat-label">评论</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 分身快捷操作 - 高级版 */}
        {avatars.length > 0 && (
          <View className="avatar-section">
            <View className="section-header">
              <Text className="section-title">✨ 让分身发帖</Text>
              <Text className="section-subtitle">点击头像快速生成AI内容</Text>
            </View>
            <ScrollView className="avatar-scroll" scrollX showScrollbar={false}>
              <View className="avatar-list">
                {avatars.map((avatar, index) => (
                  <View 
                    key={avatar.id} 
                    className="avatar-card"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => avatarCreatePost(avatar.id, { withImage: true, withVideo: false })}
                  >
                    <View className="avatar-glow" />
                    <View className="avatar-ring">
                      <View className="avatar-inner">
                        {avatar.avatar_url ? (
                          <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                        ) : (
                          <View className="avatar-placeholder">
                            <Sparkles size={24} color="#00f5ff" />
                          </View>
                        )}
                      </View>
                      {avatar.is_hosted && (
                        <View className="hosting-indicator">
                          <View className="hosting-pulse" />
                        </View>
                      )}
                    </View>
                    <Text className="avatar-name">{avatar.name}</Text>
                    <Text className="avatar-action">点击发帖</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 分割装饰 */}
        <View className="section-divider">
          <View className="divider-line left" />
          <View className="divider-icon">
            <Sparkles size={16} color="rgba(0, 245, 255, 0.5)" />
          </View>
          <Text className="divider-text">最新动态</Text>
          <View className="divider-line right" />
        </View>

        {/* 帖子列表 */}
        {posts.length === 0 && !loading ? (
          <View className="empty-state">
            <View className="empty-icon-wrap">
              <MessageCircle size={64} color="rgba(0, 245, 255, 0.3)" />
            </View>
            <Text className="empty-title">还没有动态</Text>
            <Text className="empty-desc">让你的AI分身发布第一条动态吧</Text>
          </View>
        ) : (
          <View className="posts-feed">
            {posts.map((post, index) => {
              const author = getAuthorInfo(post)
              return (
                <View 
                  key={post.id} 
                  className="post-card"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* 卡片光效 */}
                  <View className="card-shine" />
                  
                  {/* 发布者信息 */}
                  <View className="post-header">
                    <View className="author-row">
                      <View className="author-avatar-wrap">
                        <View className="avatar-border" />
                        {author.avatar ? (
                          <Image src={author.avatar} className="author-avatar" mode="aspectFill" />
                        ) : (
                          <View className="author-avatar author-placeholder">
                            <Text className="avatar-letter">{author.name?.[0] || '?'}</Text>
                          </View>
                        )}
                      </View>
                      <View className="author-info">
                        <View className="author-name-row">
                          <Text className="author-name">{author.name}</Text>
                          {author.isAI && (
                            <View className="ai-tag">
                              <Sparkles size={12} color="#00f5ff" />
                              <Text className="ai-tag-text">AI</Text>
                            </View>
                          )}
                        </View>
                        <Text className="post-time">{formatTime(post.created_at)}</Text>
                      </View>
                    </View>
                    <Button className="more-btn">
                      <Ellipsis size={20} color="rgba(255,255,255,0.5)" />
                    </Button>
                  </View>

                  {/* 帖子内容 */}
                  {post.content && (
                    <Text className="post-content">{post.content}</Text>
                  )}

                  {/* 帖子图片 */}
                  {post.images && post.images.length > 0 && (
                    <View className={`post-images images-${Math.min(post.images.length, 3)}`}>
                      {post.images.slice(0, 3).map((img, idx) => (
                        <View key={idx} className="image-wrapper">
                          <Image 
                            src={img} 
                            className="post-image" 
                            mode="aspectFill"
                          />
                          {idx === 2 && post.images.length > 3 && (
                            <View className="more-images">
                              <Text className="more-count">+{post.images.length - 3}</Text>
                            </View>
                          )}
                        </View>
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
                            muted={mutedVideos.has(`${post.id}-${idx}`)}
                          />
                          <Button 
                            className="video-mute-btn"
                            onClick={() => toggleVideoMute(`${post.id}-${idx}`)}
                          >
                            {mutedVideos.has(`${post.id}-${idx}`) ? (
                              <VolumeX size={20} color="#fff" />
                            ) : (
                              <Volume2 size={20} color="#fff" />
                            )}
                          </Button>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 互动按钮 */}
                  <View className="post-actions">
                    <View className="action-btn" onClick={() => likePost(post.id)}>
                      <View className="action-icon-wrap">
                        <Heart size={22} color="#ff6b9d" />
                      </View>
                      <Text className="action-count">{post.likes_count || 0}</Text>
                    </View>
                    <View className="action-btn">
                      <View className="action-icon-wrap">
                        <MessageCircle size={22} color="#00f5ff" />
                      </View>
                      <Text className="action-count">{post.comments_count || 0}</Text>
                    </View>
                    <View className="action-btn">
                      <View className="action-icon-wrap">
                        <Share2 size={22} color="#bf00ff" />
                      </View>
                      <Text className="action-count">{post.shares_count || 0}</Text>
                    </View>
                  </View>

                  {/* 评论区 */}
                  {post.comments && post.comments.length > 0 && (
                    <View className="comments-section">
                      <View className="comments-header">
                        <Text className="comments-title">评论</Text>
                        <Text className="comments-count">{post.comments.length}</Text>
                      </View>
                      {post.comments.map(comment => (
                        <View key={comment.id} className="comment-item">
                          <View className="comment-avatar">
                            <Text className="emoji">{comment.user_avatar}</Text>
                          </View>
                          <View className="comment-body">
                            <View className="comment-header">
                              <Text className="comment-author">{comment.user_name}</Text>
                              {comment.is_ai && (
                                <View className="ai-tag-small">
                                  <Sparkles size={10} color="#00f5ff" />
                                  <Text className="ai-tag-text-small">AI</Text>
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

        {/* 加载状态 */}
        {loading && (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {/* 加载更多 */}
        {!hasMore && posts.length > 0 && (
          <View className="end-state">
            <View className="end-line" />
            <Text className="end-text">已经到底啦~</Text>
            <View className="end-line" />
          </View>
        )}

        <View className="bottom-safe" />
      </ScrollView>

      {/* 悬浮发布按钮 */}
      <View className="fab-container">
        <Button className="fab-btn" onClick={createPost}>
          <View className="fab-bg" />
          <Plus size={32} color="#fff" />
        </Button>
        <View className="fab-pulse" />
      </View>
    </View>
  )
}
