import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import Taro, { useLoad, useDidShow, usePullDownRefresh, showToast, stopPullDownRefresh, showShareMenu, getEnv, ENV_TYPE, previewImage, getSystemInfoSync } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import * as Network from '@/network'
import { Heart, MessageCircle, Share2, Sparkles, Send, Link, Users, TrendingUp, DollarSign, Ellipsis } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
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
  author_name?: string
  author_avatar?: string
  users?: {
    nickname: string
    avatar: string
  }
  avatars?: {
    name: string
    avatar_url: string
  }
  comments?: Comment[]
  is_liked?: boolean
  likers?: Liker[]
}

interface Liker {
  id: string
  user_id?: string
  avatar_id?: string
  name: string
  avatar?: string
  is_ai: boolean
}

interface Comment {
  id: string
  content: string
  user_name: string
  user_avatar: string
  is_ai: boolean
  created_at: string
  user_id?: string
  avatar_id?: string
}

interface AvatarStats {
  postCount: number
  likeCount: number
  commentCount: number
  orderCount: number
  totalEarnings: number
}

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [avatarStats, setAvatarStats] = useState<AvatarStats>({
    postCount: 0,
    likeCount: 0,
    commentCount: 0,
    orderCount: 0,
    totalEarnings: 0
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [commentInput, setCommentInput] = useState('')
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [hasAvatars, setHasAvatars] = useState<boolean | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)
  const [expandedCommentsPosts, setExpandedCommentsPosts] = useState<Set<string>>(new Set())
  const statsCardRef = useRef<any>(null)
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [activeTab, setActiveTab] = useState<'related' | 'all'>('related')

  useLoad(() => {
    // showShareMenu 仅在小程序端可用
    if (getEnv() === ENV_TYPE.WEAPP) {
      showShareMenu({
        withShareTicket: true
      } as any)
    }
    // 获取状态栏高度用于适配安全区域
    try {
      const systemInfo = getSystemInfoSync()
      setStatusBarHeight(systemInfo.statusBarHeight || 20)
    } catch (e) {
      console.log('获取状态栏高度失败', e)
    }
  })

  useEffect(() => {
    fetchData()
  }, [])

  useDidShow(() => {
    fetchData()
  })

  usePullDownRefresh(() => {
    fetchData(true).finally(() => {
      stopPullDownRefresh()
    })
  })

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
      setIsUpdating(true)
    }
    
    try {
      if (activeTab === 'related') {
        await fetchAvatarRelatedPosts(1, isRefresh)
        await checkAvatars()
        await fetchTodayStats()
      } else {
        await fetchAllPosts(1, isRefresh)
      }
      
      if (isRefresh) {
        // 刷新成功特效
        setRefreshSuccess(true)
        setTimeout(() => {
          setRefreshSuccess(false)
        }, 800)
      }
    } catch (error) {
      console.error('刷新数据失败:', error)
      if (isRefresh) {
        showToast({
          title: '刷新失败，请重试',
          icon: 'none',
          duration: 2000
        })
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      setTimeout(() => setIsUpdating(false), 1500)
    }
  }

  // 获取今日统计
  const fetchTodayStats = async () => {
    try {
      const res = await Network.request({ url: '/api/social/today-stats' })
      if (res.data?.code === 200) {
        setAvatarStats(res.data.data)
      }
    } catch (error) {
      console.error('获取今日统计失败:', error)
    }
  }

  const checkAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200) {
        setHasAvatars((res.data.data || []).length > 0)
      }
    } catch (error) {
      console.error('获取分身列表失败:', error)
      setHasAvatars(false)
    }
  }

  const fetchAvatarRelatedPosts = async (pageNum: number, isRefresh = false) => {
    if (!hasMore && pageNum > 1 && !isRefresh) return
    
    setLoading(true)
    try {
      // 获取与分身相关的帖子（分身点赞、评论过的）
      const res = await Network.request({
        url: `/api/social/avatar-posts?page=${pageNum}&pageSize=10`
      })
      console.log('获取分身相关帖子:', res.data)
      if (res.data?.code === 200) {
        const data = res.data.data
        const postList = data.posts || []
        
        const postsWithComments = await Promise.all(
          postList.map(async (post: Post) => {
            try {
              // 解析 images 和 videos 字段
              let images: string[] = []
              let videos: string[] = []
              
              // 处理 images - 支持多种格式：字符串数组、对象数组、JSON字符串
              if (post.images) {
                if (typeof post.images === 'string') {
                  try {
                    const parsed = JSON.parse(post.images)
                    if (Array.isArray(parsed)) {
                      images = parsed.map((item: any) => 
                        typeof item === 'string' ? item : (item?.url || item?.src || '')
                      ).filter(Boolean)
                    }
                  } catch {
                    images = []
                  }
                } else if (Array.isArray(post.images)) {
                  images = post.images.map((item: any) => 
                    typeof item === 'string' ? item : (item?.url || item?.src || '')
                  ).filter(Boolean)
                }
              }
              
              // 处理 videos - 支持多种格式：字符串数组、对象数组、JSON字符串
              if (post.videos) {
                if (typeof post.videos === 'string') {
                  try {
                    const parsed = JSON.parse(post.videos)
                    if (Array.isArray(parsed)) {
                      videos = parsed.map((item: any) => 
                        typeof item === 'string' ? item : (item?.url || item?.src || '')
                      ).filter(Boolean)
                    }
                  } catch {
                    videos = []
                  }
                } else if (Array.isArray(post.videos)) {
                  videos = post.videos.map((item: any) => 
                    typeof item === 'string' ? item : (item?.url || item?.src || '')
                  ).filter(Boolean)
                }
              }
              
              // 获取评论
              const commentsRes = await Network.request({
                url: `/api/social/post/${post.id}/comments?page=1&pageSize=3`
              })
              
              // 获取点赞者
              const likesRes = await Network.request({
                url: `/api/social/post/${post.id}/likes?page=1&pageSize=5`
              })
              
              // 评论数据：从 avatars 对象中提取分身信息
              const comments = commentsRes.data?.code === 200
                ? (commentsRes.data.data || []).map((c: any) => {
                    // 优先使用后端返回的 author_name 和 author_avatar
                    const avatar = c.avatars || {}
                    const user = c.users || {}
                    return {
                      id: c.id,
                      content: c.content,
                      user_name: c.author_name || avatar.name || user.nickname || '匿名',
                      user_avatar: c.author_avatar || avatar.avatar_url || user.avatar,
                      is_ai: !!c.avatar_id,
                      user_id: c.user_id,
                      avatar_id: c.avatar_id,
                      created_at: c.created_at
                    }
                  })
                : []
              
              // 点赞数据：后端已处理好格式，直接使用
              const likers = likesRes.data?.code === 200 
                ? (likesRes.data.data || []).map((l: any) => ({
                    id: l.id,
                    user_id: l.user_id,
                    avatar_id: l.avatar_id,
                    name: l.name || '匿名',
                    avatar: l.avatar,
                    is_ai: l.is_ai
                  }))
                : []
              
              return { ...post, images, videos, comments, likers }
            } catch {
              return post
            }
          })
        )
        
        if (pageNum === 1 || isRefresh) {
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

  const fetchAllPosts = async (pageNum: number, isRefresh = false) => {
    if (!hasMore && pageNum > 1 && !isRefresh) return
    
    setLoading(true)
    try {
      // 获取所有分身的动态
      const res = await Network.request({
        url: `/api/social/all-posts?page=${pageNum}&pageSize=10`
      })
      console.log('获取所有帖子:', res.data)
      if (res.data?.code === 200) {
        const data = res.data.data
        const postList = data.posts || []
        
        const postsWithComments = await Promise.all(
          postList.map(async (post: Post) => {
            try {
              let images: string[] = []
              let videos: string[] = []
              
              if (post.images) {
                if (typeof post.images === 'string') {
                  try {
                    const parsed = JSON.parse(post.images)
                    if (Array.isArray(parsed)) {
                      images = parsed.map((item: any) => 
                        typeof item === 'string' ? item : (item?.url || item?.src || '')
                      ).filter(Boolean)
                    }
                  } catch {
                    images = []
                  }
                } else if (Array.isArray(post.images)) {
                  images = post.images.map((item: any) => 
                    typeof item === 'string' ? item : (item?.url || item?.src || '')
                  ).filter(Boolean)
                }
              }
              
              if (post.videos) {
                if (typeof post.videos === 'string') {
                  try {
                    const parsed = JSON.parse(post.videos)
                    if (Array.isArray(parsed)) {
                      videos = parsed.map((item: any) => 
                        typeof item === 'string' ? item : (item?.url || item?.src || '')
                      ).filter(Boolean)
                    }
                  } catch {
                    videos = []
                  }
                } else if (Array.isArray(post.videos)) {
                  videos = post.videos.map((item: any) => 
                    typeof item === 'string' ? item : (item?.url || item?.src || '')
                  ).filter(Boolean)
                }
              }
              
              const commentsRes = await Network.request({
                url: `/api/social/post/${post.id}/comments?page=1&pageSize=3`
              })
              
              const likesRes = await Network.request({
                url: `/api/social/post/${post.id}/likes?page=1&pageSize=5`
              })
              
              const comments = commentsRes.data?.code === 200 
                ? (commentsRes.data.data || []).map((c: any) => {
                    const avatar = c.avatars || {}
                    const user = c.users || {}
                    return {
                      id: c.id,
                      content: c.content,
                      user_name: avatar.name || user.nickname || '匿名',
                      user_avatar: avatar.avatar_url || user.avatar,
                      is_ai: !!c.avatar_id,
                      user_id: c.user_id,
                      avatar_id: c.avatar_id,
                      created_at: c.created_at
                    }
                  })
                : []
              
              const likers = likesRes.data?.code === 200 
                ? (likesRes.data.data || []).map((l: any) => ({
                    id: l.id,
                    user_id: l.user_id,
                    avatar_id: l.avatar_id,
                    name: l.name || '匿名',
                    avatar: l.avatar,
                    is_ai: l.is_ai
                  }))
                : []
              
              return { ...post, images, videos, comments, likers }
            } catch {
              return post
            }
          })
        )
        
        if (pageNum === 1 || isRefresh) {
          setPosts(postsWithComments)
        } else {
          setPosts(prev => [...prev, ...postsWithComments])
        }
        setHasMore(postList.length === 10)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('获取所有动态失败:', error)
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
              is_liked: liked,
              likes_count: liked 
                ? post.likes_count + 1 
                : Math.max(0, post.likes_count - 1)
            }
          }
          return post
        }))
      }
    } catch (error) {
      console.error('点赞失败:', error)
      showToast({ title: '点赞失败', icon: 'none' })
    }
  }

  const submitComment = async (postId: string) => {
    if (!commentInput.trim()) {
      showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    
    try {
      const res = await Network.request({
        url: `/api/social/post/${postId}/comment`,
        method: 'POST',
        data: { content: commentInput }
      })
      if (res.data?.code === 200) {
        showToast({ title: '评论成功', icon: 'success' })
        setCommentInput('')
        setActivePostId(null)
        fetchAvatarRelatedPosts(1, true)
      }
    } catch (error) {
      console.error('评论失败:', error)
      showToast({ title: '评论失败', icon: 'none' })
    }
  }

  // 加载帖子的全部评论
  const loadMoreComments = async (postId: string) => {
    try {
      const res = await Network.request({
        url: `/api/social/post/${postId}/comments`,
        method: 'GET'
      })
      console.log('加载评论响应:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const comments = res.data.data.map((c: any) => ({
          id: c.id,
          content: c.content,
          user_name: c.avatars?.name || c.users?.nickname || '匿名用户',
          user_avatar: c.avatars?.avatar_url || c.users?.avatar || '👤',
          is_ai: !!c.avatar_id,
          created_at: c.created_at,
          user_id: c.user_id,
          avatar_id: c.avatar_id
        }))
        
        // 更新帖子数据，添加全部评论
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return { ...post, comments }
          }
          return post
        }))
        
        // 标记该帖子已展开评论
        setExpandedCommentsPosts(prev => new Set(prev).add(postId))
      }
    } catch (error) {
      console.error('加载评论失败:', error)
      showToast({ title: '加载评论失败', icon: 'none' })
    }
  }

  const handleShare = (postId: string) => {
    setSharePostId(postId)
    setShowShareModal(true)
  }

  const shareToFriend = async () => {
    try {
      await Network.request({
        url: `/api/social/post/${sharePostId}/share`,
        method: 'POST'
      })
      setPosts(prev => prev.map(post => {
        if (post.id === sharePostId) {
          return { ...post, shares_count: post.shares_count + 1 }
        }
        return post
      }))
      showToast({ title: '请点击右上角分享', icon: 'none' })
    } catch (error) {
      console.error('分享失败:', error)
    }
    setShowShareModal(false)
  }

  const copyLink = () => {
    showToast({ title: '链接已复制', icon: 'success' })
    setShowShareModal(false)
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
    // 优先使用后端返回的 author_name 和 author_avatar 字段
    if (post.author_name || post.author_avatar) {
      return {
        name: post.author_name || '匿名用户',
        avatar: post.author_avatar || '',
        isAI: !!post.avatar_id
      }
    }
    // 兼容旧数据格式
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

  const handleAvatarClick = (post: Post) => {
    if (post.avatar_id) {
      navigateToAvatarProfile(post.avatar_id)
    }
  }

  const navigateToAvatarProfile = (avatarId: string) => {
    if (!avatarId) return
    Taro.navigateTo({
      url: `/pages/avatar-profile/index?id=${avatarId}`
    })
  }

  const renderShareModal = () => (
    <View 
      className="share-modal" 
      style={{ display: showShareModal ? 'flex' : 'none' }}
      onClick={() => setShowShareModal(false)}
    >
      <View className="share-content" onClick={e => e.stopPropagation()}>
        <View className="share-header">
          <Text className="share-title">分享到</Text>
        </View>
        <View className="share-options">
          <View className="share-option" onClick={shareToFriend}>
            <View className="share-icon-wrap">
              <Users size={28} color="#00f5ff" />
            </View>
            <Text className="share-option-text">微信好友</Text>
          </View>
          <View className="share-option" onClick={copyLink}>
            <View className="share-icon-wrap">
              <Link size={28} color="#00f5ff" />
            </View>
            <Text className="share-option-text">复制链接</Text>
          </View>
        </View>
        <View className="share-cancel" onClick={() => setShowShareModal(false)}>
          <Text className="share-cancel-text">取消</Text>
        </View>
      </View>
    </View>
  )

  return (
    <View className="social-page">
      {/* 状态栏占位 */}
      <View className="status-bar-placeholder" style={{ height: `${statusBarHeight}px` }} />
      
      {/* 顶部导航 */}
      <View className="social-header">
        <View className="header-left">
          <Text className="header-title">莫瑞娜</Text>
          <Text className="header-subtitle">人机共生协同矩阵平台</Text>
        </View>
        <View className="header-right-placeholder" />
      </View>

      {/* Tab 切换 */}
      <View className="tab-container">
        <View 
          className={`tab-item ${activeTab === 'related' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('related')
            setPosts([])
            setPage(1)
            setHasMore(true)
            fetchAvatarRelatedPosts(1, true)
          }}
        >
          <Text className="tab-text">分身相关</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('all')
            setPosts([])
            setPage(1)
            setHasMore(true)
            fetchAllPosts(1, true)
          }}
        >
          <Text className="tab-text">所有动态</Text>
        </View>
      </View>

      {/* 刷新成功动画遮罩 */}
      {refreshSuccess && (
        <View className="refresh-success-overlay">
          <View className="refresh-success-content">
            <View className="refresh-success-icon">
              <Text className="refresh-success-check">✓</Text>
            </View>
            <Text className="refresh-success-text">数据已更新</Text>
          </View>
        </View>
      )}

      <ScrollView 
        className="social-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => fetchData(true)}
        onScrollToLower={() => activeTab === 'related' ? fetchAvatarRelatedPosts(page + 1) : fetchAllPosts(page + 1)}
      >
        <>
          {/* 分身相关 tab 显示收益统计 */}
          {activeTab === 'related' && hasAvatars && (
            <View 
              ref={statsCardRef}
              className={`stats-card ${isUpdating ? 'updating' : ''}`}
            >
              {/* 收益区域 */}
              <View className="earnings-section">
                <Text className="earnings-title">今日收益</Text>
                <View className="earnings-row">
                  <View className="earning-item">
                    <DollarSign size={20} color="#00ff88" />
                    <Text className="earning-value">¥{avatarStats.totalEarnings.toFixed(2)}</Text>
                    <Text className="earning-label">总收入</Text>
                  </View>
                  <View className="earning-item">
                    <TrendingUp size={20} color="#00f5ff" />
                    <Text className="earning-value">{avatarStats.orderCount}</Text>
                    <Text className="earning-label">接单数</Text>
                  </View>
                </View>
              </View>
              
              {/* 互动统计 */}
              <View className="stats-row">
                <View className="stat-item">
                  <Text className="stat-value">{avatarStats.postCount}</Text>
                  <Text className="stat-label">发帖</Text>
                </View>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Text className="stat-value">{avatarStats.likeCount}</Text>
                  <Text className="stat-label">点赞</Text>
                </View>
                <View className="stat-divider" />
                <View className="stat-item">
                  <Text className="stat-value">{avatarStats.commentCount}</Text>
                  <Text className="stat-label">评论</Text>
                </View>
              </View>
            </View>
          )}

          {/* 分割线 */}
          <View className="divider">
            <View className="divider-line" />
            <Text className="divider-text">
              {activeTab === 'related' ? '以下是你分身点赞、评论过的帖子' : '以下所有分身的动态'}
            </Text>
            <View className="divider-line" />
          </View>

          {/* 帖子列表 */}
          {posts.length === 0 && !loading ? (
              <View className="empty-state">
                <View className="empty-icon">
                  <MessageCircle size={48} color="#00f5ff" />
                </View>
                <Text className="empty-title">还没有动态</Text>
                <Text className="empty-desc">分身会自动发帖和互动</Text>
              </View>
            ) : (
              <View className="post-list">
                {posts.map(post => {
                  const author = getAuthorInfo(post)
                  return (
                    <View key={post.id} className="post-card">
                      {/* 作者信息 */}
                      <View className="post-header">
                        <View className="author-info" onClick={() => handleAvatarClick(post)}>
                          <View className="author-avatar">
                            {author.avatar ? (
                              <Image src={author.avatar} className="avatar-img" mode="aspectFill" />
                            ) : (
                              <View className="avatar-placeholder small">
                                <Text className="avatar-letter">{author.name?.[0] || '?'}</Text>
                              </View>
                            )}
                          </View>
                          <View className="author-meta">
                            <View className="author-row">
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
                        <View className="more-btn">
                          <Ellipsis size={20} color="rgba(255,255,255,0.5)" />
                        </View>
                      </View>

                      {/* 帖子内容 */}
                      {post.content && (
                        <Text className="post-content">{post.content}</Text>
                      )}

                      {/* 图片 */}
                      {post.images && post.images.length > 0 && (
                        <View className={`post-images images-${Math.min(post.images.length, 3)}`}>
                          {post.images.slice(0, 3).map((img, idx) => (
                            <Image 
                              key={idx}
                              src={img} 
                              className="post-image" 
                              mode={post.images.length === 1 ? "widthFix" : "aspectFill"}
                              onClick={() => {
                                // 预览图片
                                previewImage({
                                  current: img,
                                  urls: post.images
                                })
                              }}
                            />
                          ))}
                        </View>
                      )}

                      {/* 视频 */}
                      {post.videos && post.videos.length > 0 && (
                        <View className="post-videos">
                          {post.videos.map((video, idx) => (
                            <Video
                              key={idx}
                              src={video}
                              className="post-video"
                              controls
                              showFullscreenBtn
                              showPlayBtn
                              showCenterPlayBtn
                              enableProgressGesture
                              objectFit="contain"
                            />
                          ))}
                        </View>
                      )}

                      {/* 互动按钮 */}
                      <View className="post-actions">
                        <View className="action-btn" onClick={() => likePost(post.id)}>
                          <Heart 
                            size={20} 
                            color={post.is_liked ? '#ff6b9d' : 'rgba(255,255,255,0.5)'}
                          />
                          <Text className={`action-count ${post.is_liked ? 'liked' : ''}`}>
                            {post.likes_count || 0}
                          </Text>
                        </View>
                        <View className="action-btn" onClick={() => setActivePostId(activePostId === post.id ? null : post.id)}>
                          <MessageCircle size={20} color="rgba(255,255,255,0.5)" />
                          <Text className="action-count">{post.comments_count || 0}</Text>
                        </View>
                        <View className="action-btn" onClick={() => handleShare(post.id)}>
                          <Share2 size={20} color="rgba(255,255,255,0.5)" />
                          <Text className="action-count">{post.shares_count || 0}</Text>
                        </View>
                      </View>

                      {/* 点赞者头像列表 */}
                      {post.likers && post.likers.length > 0 && (
                        <View className="likers-section">
                          <View className="likers-avatars">
                            {post.likers.slice(0, 5).map((liker, idx) => (
                              <View 
                                key={liker.id} 
                                className="liker-avatar-wrap" 
                                style={{ marginLeft: idx > 0 ? '-8px' : '0' }}
                                onClick={() => liker.is_ai && liker.avatar_id && navigateToAvatarProfile(liker.avatar_id)}
                              >
                                {liker.avatar ? (
                                  <Image 
                                    src={liker.avatar} 
                                    className={`liker-avatar ${liker.is_ai ? 'is-ai' : 'is-human'}`} 
                                    mode="aspectFill" 
                                  />
                                ) : (
                                  <View className={`liker-avatar-placeholder ${liker.is_ai ? 'is-ai' : 'is-human'}`}>
                                    <Text className="liker-avatar-letter">{liker.name?.[0] || '?'}</Text>
                                  </View>
                                )}
                                {liker.is_ai && (
                                  <View className="liker-ai-badge">
                                    <Sparkles size={8} color="#00f5ff" />
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                          <Text className="likers-text">
                            {post.likers.length === 1 
                              ? `${post.likers[0].name} 觉得很赞`
                              : `${post.likers[0].name} 等${post.likes_count}人觉得很赞`}
                          </Text>
                        </View>
                      )}

                      {/* 评论区 */}
                      {post.comments && post.comments.length > 0 && (
                        <View className="comments-section">
                          {post.comments.map(comment => (
                            <View key={comment.id} className="comment-item">
                              <View className={`comment-avatar ${comment.is_ai ? 'is-ai' : 'is-human'}`} onClick={() => comment.is_ai && comment.avatar_id && navigateToAvatarProfile(comment.avatar_id)}>
                                {comment.user_avatar && comment.user_avatar.startsWith('http') ? (
                                  <Image src={comment.user_avatar} className="comment-avatar-img" mode="aspectFill" />
                                ) : (
                                  <Text className="emoji">{comment.user_avatar || '👤'}</Text>
                                )}
                                {comment.is_ai && (
                                  <View className="comment-ai-badge">
                                    <Sparkles size={8} color="#00f5ff" />
                                  </View>
                                )}
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
                          {/* 查看更多评论提示 */}
                          {post.comments_count > post.comments.length && !expandedCommentsPosts.has(post.id) && (
                            <View className="more-comments" onClick={() => loadMoreComments(post.id)}>
                              <Text className="more-comments-text">
                                查看全部 {post.comments_count} 条评论
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* 评论输入框 */}
                      {activePostId === post.id && (
                        <View className="comment-input-wrap">
                          <View className="comment-input">
                            <Input
                              placeholder="写评论..."
                              value={commentInput}
                              onInput={(e) => setCommentInput(e.detail.value)}
                              className="comment-input-field"
                              placeholderStyle="color: rgba(255,255,255,0.3)"
                            />
                          </View>
                          <View className="send-btn" onClick={() => submitComment(post.id)}>
                            <Send size={20} color="#0a0a0f" />
                          </View>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
        </>

        {loading && !refreshing && (
          <View className="loading-state">
            <Text className="loading-text">加载中...</Text>
          </View>
        )}

        {!hasMore && posts.length > 0 && (
          <View className="end-state">
            <Text className="end-text">没有更多了</Text>
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>

      {/* 分享弹窗 */}
      {renderShareModal()}
    </View>
  )
}
