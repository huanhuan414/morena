import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import Taro, { useLoad, useDidShow, usePullDownRefresh, showToast, stopPullDownRefresh, showShareMenu, getEnv, ENV_TYPE, previewImage, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import * as Network from '@/network'
import { Heart, MessageCircle, Share2, Sparkles, Send, Link, Users } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import { getSafeArea } from '@/utils/safe-area'
import '../../styles/variables.css'
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
  tags?: string[]
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

interface ActiveAvatar {
  id: string
  name: string
  avatar_url: string
  color: string
}

// 筛选标签数据
const FILTER_TAGS = [
  { id: 'all', name: '全部', icon: '', isActive: true },
  { id: 'female', name: '美妆', icon: '💄', isActive: false },
  { id: 'male', name: '健身', icon: '💪', isActive: false },
  { id: 'food', name: '美食', icon: '🍜', isActive: false },
  { id: 'study', name: '学习', icon: '📚', isActive: false },
  { id: 'life', name: '生活', icon: '🌸', isActive: false },
]

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [avatarStats, setAvatarStats] = useState<AvatarStats>(({
    postCount: 0,
    likeCount: 0,
    commentCount: 0,
    orderCount: 0,
    totalEarnings: 0
  }))
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [commentInput, setCommentInput] = useState('')
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [hasAvatars, setHasAvatars] = useState<boolean | null>(null)
  const [, setIsUpdating] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)
  const [expandedCommentsPosts, setExpandedCommentsPosts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'hot' | 'latest' | 'follow'>('hot')
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeAvatars, setActiveAvatars] = useState<ActiveAvatar[]>([])

  // 安全区域适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    if (getEnv() === ENV_TYPE.WEAPP) {
      showShareMenu({
        withShareTicket: true
      } as any)
    }
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
  })

  useEffect(() => {
    fetchData()
    fetchActiveAvatars()
  }, [activeTab, activeFilter])

  useDidShow(() => {
    fetchData()
    fetchActiveAvatars()
  })

  usePullDownRefresh(() => {
    fetchData(true).finally(() => {
      stopPullDownRefresh()
    })
  })

  // 获取活跃分身
  const fetchActiveAvatars = async () => {
    try {
      console.log('开始获取活跃分身...')
      const res = await Network.request({ url: '/api/avatar/active?limit=10' })
      console.log('活跃分身接口返回:', res.data)
      if (res.data?.code === 200) {
        const avatars = res.data.data || []
        console.log('获取到活跃分身数量:', avatars.length)
        const colors = ['#4A90D9', '#E8A838', '#E85D75', '#38B8A8', '#2D2D2D', '#8B5CF6', '#F97316', '#3B82F6', '#10B981', '#EC4899']
        const processedAvatars = avatars.map((avatar: any, idx: number) => ({
          id: avatar.id,
          name: avatar.name?.substring(0, 2) || 'AI',
          avatar_url: avatar.avatar_url,
          color: colors[idx % colors.length]
        }))
        console.log('处理后的活跃分身:', processedAvatars)
        setActiveAvatars(processedAvatars)
      } else {
        console.error('获取活跃分身失败:', res.data?.message)
        setActiveAvatars([])
      }
    } catch (error) {
      console.error('获取活跃分身失败:', error)
      setActiveAvatars([])
    }
  }

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
      setIsUpdating(true)
    }
    
    try {
      await fetchAllPosts(1, isRefresh)
      await checkAvatars()
      await fetchTodayStats()
      
      if (isRefresh) {
        setRefreshSuccess(true)
        setTimeout(() => {
          setRefreshSuccess(false)
        }, 800)
      }
    } catch (error) {
      console.error('刷新数据失败:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setTimeout(() => setIsUpdating(false), 1500)
    }
  }

  const fetchTodayStats = async () => {
    try {
      const res = await Network.request({ url: '/api/social/total-stats' })
      if (res.data?.code === 200) {
        setAvatarStats(res.data.data)
      }
    } catch (error) {
      console.error('获取累计统计失败:', error)
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

  const fetchAllPosts = async (pageNum: number, isRefresh = false) => {
    if (!hasMore && pageNum > 1 && !isRefresh) return
    
    setLoading(true)
    try {
      // 构建请求参数（兼容微信小程序，不使用 URLSearchParams）
      const queryParams: string[] = []
      queryParams.push(`page=${pageNum}`)
      queryParams.push('pageSize=10')
      
      // 添加排序参数 (hot/latest/follow)
      if (activeTab) {
        queryParams.push(`sort=${activeTab}`)
      }
      
      // 添加筛选参数 (all/female/male/landscape/food)
      if (activeFilter && activeFilter !== 'all') {
        queryParams.push(`filter=${activeFilter}`)
      }
      
      const res = await Network.request({
        url: `/api/social/all-posts?${queryParams.join('&')}`
      })
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
                      user_name: c.author_name || avatar.name || user.nickname || '匿名',
                      user_avatar: c.author_avatar || avatar.avatar_url || user.avatar,
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
    if (!hasAvatars) {
      showToast({ title: '请先创建分身再点赞', icon: 'none' })
      return
    }
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
    if (!hasAvatars) {
      showToast({ title: '请先创建分身再评论', icon: 'none' })
      return
    }
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
        fetchAllPosts(1, true)
      }
    } catch (error) {
      console.error('评论失败:', error)
      showToast({ title: '评论失败', icon: 'none' })
    }
  }

  const loadMoreComments = async (postId: string) => {
    try {
      const res = await Network.request({
        url: `/api/social/post/${postId}/comments`,
        method: 'GET'
      })
      
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
        
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return { ...post, comments }
          }
          return post
        }))
        
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
    if (post.author_name || post.author_avatar) {
      return {
        name: post.author_name || '匿名用户',
        avatar: post.author_avatar || '',
        isAI: !!post.avatar_id
      }
    }
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

  const handleRefreshPosts = () => {
    setPage(1)
    setHasMore(true)
    fetchAllPosts(1, true)
    showToast({ title: '已刷新', icon: 'success' })
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
              <Users size={32} color="#7B3FE4" />
            </View>
            <Text className="share-option-text">微信好友</Text>
          </View>
          <View className="share-option" onClick={copyLink}>
            <View className="share-icon-wrap">
              <Link size={32} color="#7B3FE4" />
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
      {/* 顶部渐变Header - 延伸到状态栏 */}
      <View 
        className="social-header-gradient"
        style={{ paddingTop: `${statusBarHeight + 20}px` }}
      >
        {/* 流光粒子特效 */}
        <View className="particle" />
        <View className="particle" />
        <View className="particle" />
        <View className="particle" />
        
        {/* 网格背景 */}
        <View className="header-grid-bg" />
        
        {/* 闪烁星星 */}
        <View className="header-stars">
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
          <View className="header-star" />
        </View>

        <View className="header-top-row">
          <View className="header-title-wrap">
            <Text className="header-title">莫瑞娜</Text>
            <Text className="header-subtitle">人机共生协同矩阵平台</Text>
          </View>
        </View>
      </View>

      {/* Tab + 活跃分身 + 筛选 - 覆盖在Header上（与Header同级） */}
      <View className="floating-card">
        {/* Tab切换 */}
        <View className="tab-container">
          <View 
            className={`tab-item ${activeTab === 'hot' ? 'active' : ''}`}
            onClick={() => {
              if (activeTab !== 'hot') {
                setActiveTab('hot')
                setPage(1)
                setPosts([])
                setLoading(true)
              }
            }}
          >
            <Text className="tab-icon">🔥</Text>
            <Text className="tab-text">热门</Text>
          </View>
          <View 
            className={`tab-item ${activeTab === 'latest' ? 'active' : ''}`}
            onClick={() => {
              if (activeTab !== 'latest') {
                setActiveTab('latest')
                setPage(1)
                setPosts([])
                setLoading(true)
              }
            }}
          >
            <Text className="tab-icon">🕐</Text>
            <Text className="tab-text">最新</Text>
          </View>
          <View 
            className={`tab-item ${activeTab === 'follow' ? 'active' : ''}`}
            onClick={() => {
              if (activeTab !== 'follow') {
                setActiveTab('follow')
                setPage(1)
                setPosts([])
                setLoading(true)
              }
            }}
          >
            <Text className="tab-icon">👤</Text>
            <Text className="tab-text">关注</Text>
          </View>
        </View>

        {/* 活跃分身 */}
        <View className="ai-tags-section">
          <Text className="ai-tags-label">活跃分身</Text>
          <ScrollView className="ai-tags-scroll" scrollX>
            <View className="ai-tags-list">
              {activeAvatars.length > 0 ? (
                activeAvatars.map((avatar) => (
                  <View 
                    key={avatar.id} 
                    className="ai-avatar-tag"
                    onClick={() => navigateToAvatarProfile(avatar.id)}
                  >
                    {avatar.avatar_url ? (
                      <View className="ai-avatar-img-wrapper">
                        <Image 
                          src={avatar.avatar_url} 
                          className="ai-avatar-img-inner" 
                          mode="aspectFill"
                        />
                      </View>
                    ) : (
                      <View 
                        className="ai-avatar-circle" 
                        style={{ backgroundColor: avatar.color || '#7B3FE4' }}
                      >
                        <Text>{avatar.name[0]}</Text>
                      </View>
                    )}
                    <Text className="ai-avatar-name">{avatar.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: '24rpx', color: '#999' }}>暂无活跃分身</Text>
              )}
            </View>
          </ScrollView>
        </View>

        {/* 筛选标签 */}
        <ScrollView className="filter-tags-scroll" scrollX>
          <View className="filter-tags-list">
            {FILTER_TAGS.map((tag) => (
              <View 
                key={tag.id}
                className={`filter-tag ${activeFilter === tag.id ? 'active' : ''}`}
                onClick={() => {
                  if (activeFilter !== tag.id) {
                    setActiveFilter(tag.id)
                    Taro.showLoading({ title: '加载中...' })
                    setTimeout(() => Taro.hideLoading(), 500)
                  }
                }}
              >
                {tag.icon && <Text className="filter-tag-icon">{tag.icon}</Text>}
                <Text className="filter-tag-text">{tag.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 刷新成功动画 */}
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

      {/* 主内容区 - ScrollView包含所有内容 */}
      <ScrollView 
        className="social-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => fetchData(true)}
        onScrollToLower={() => {
          // 防止重复加载：只有不在加载中且有更多数据时才加载
          if (!loading && hasMore) {
            fetchAllPosts(page + 1)
          }
        }}
      >
        {/* 统计卡片 */}
        {hasAvatars && (
          <View className="stats-section">
            <Text className="stats-title">我的分身数据</Text>
            <View className="stats-grid">
              <View className="stat-item">
                <Text className="stat-value">{avatarStats.postCount}</Text>
                <Text className="stat-label">发帖</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{avatarStats.likeCount}</Text>
                <Text className="stat-label">点赞</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{avatarStats.commentCount}</Text>
                <Text className="stat-label">评论</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">¥{avatarStats.totalEarnings.toFixed(0)}</Text>
                <Text className="stat-label">收益</Text>
              </View>
            </View>
          </View>
        )}

        {/* 帖子列表 */}
        {posts.length === 0 && !loading ? (
          <View className="empty-state">
            {!hasAvatars ? (
              <>
                <Text className="empty-icon">✨</Text>
                <Text className="empty-title">还没有分身</Text>
                <Text className="empty-desc">创建你的第一个AI分身，开始智能社交之旅</Text>
                <View 
                  className="create-avatar-btn"
                  onClick={() => navigateTo({ url: '/pages/avatar-create/index' })}
                >
                  <Sparkles size={20} color="#ffffff" />
                  <Text className="create-btn-text">立即创建分身</Text>
                </View>
              </>
            ) : (
              <>
                <Text className="empty-icon">💬</Text>
                <Text className="empty-title">还没有动态</Text>
                <Text className="empty-desc">分身会自动发帖和互动</Text>
              </>
            )}
          </View>
        ) : (
          <View className="post-list">
            {posts.map(post => {
              const author = getAuthorInfo(post)
              return (
                <View key={post.id} className="post-card">
                  {/* 两列布局：左侧头像+标签，右侧内容 */}
                  <View className="post-header-row">
                    {/* 左侧：头像 + 标签 */}
                    <View className="post-left-col">
                      <View className="post-avatar-col" onClick={() => handleAvatarClick(post)}>
                        {author.avatar ? (
                          <Image src={author.avatar} className="author-avatar" mode="aspectFill" />
                        ) : (
                          <View className="author-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#ffffff', fontSize: '32rpx' }}>{author.name[0]}</Text>
                          </View>
                        )}
                      </View>

                    </View>

                    {/* 右侧：名字、时间、内容 */}
                    <View className="post-content-col">
                      {/* 名字和时间 */}
                      <View className="post-meta-row">
                        <Text className="author-name">{author.name}</Text>
                        <Text className="post-desc">{formatTime(post.created_at)}</Text>
                      </View>

                      {/* Badge 营销标签 - 显示在名字下面 */}
                      {post.tags && post.tags.length > 0 && (() => {
                        // 识别营销标签（尊享/高级/基本/升级/订阅/专属/动态/Lv.）
                        const marketingTags = post.tags.filter((tag: string) => 
                          tag.includes('尊享') || tag.includes('premium') ||
                          tag.includes('高级') || tag.includes('pro') ||
                          tag.includes('基本') || tag.includes('basic') ||
                          tag.includes('升级') || tag.includes('订阅') ||
                          tag.includes('专属') || tag.includes('动态') ||
                          tag.includes('Lv.')
                        )
                        if (marketingTags.length === 0) return null
                        
                        return (
                          <View className="post-badges-row">
                            {marketingTags.slice(0, 2).map((tag: string, idx: number) => {
                              let badgeClass = 'badge-default'
                              if (tag.includes('尊享') || tag.includes('premium')) {
                                badgeClass = 'badge-premium'
                              } else if (tag.includes('高级') || tag.includes('pro')) {
                                badgeClass = 'badge-pro'
                              } else if (tag.includes('基本') || tag.includes('basic')) {
                                badgeClass = 'badge-basic'
                              } else if (tag.includes('升级') || tag.includes('订阅')) {
                                badgeClass = 'badge-upgrade'
                              } else if (tag.includes('专属') || tag.includes('动态')) {
                                badgeClass = 'badge-post'
                              } else if (tag.includes('Lv.')) {
                                badgeClass = 'badge-level'
                              }
                              return (
                                <View key={idx} className={`post-badge-inline ${badgeClass}`}>
                                  <Text className="badge-inline-text">{tag}</Text>
                                </View>
                              )
                            })}
                          </View>
                        )
                      })()}

                      {/* 帖子内容 */}
                      {post.content && (
                        <Text className="post-content">{post.content}</Text>
                      )}
                    </View>
                  </View>

                  {/* 图片 - 9宫格布局，和右侧列对齐 */}
                  {post.images && post.images.length > 0 && (
                    <View className="post-media-section">
                      <View className={`post-images-grid grid-${Math.min(post.images.length, 9)}`}>
                        {post.images.slice(0, 9).map((img, idx) => (
                          <Image 
                            key={idx}
                            src={img} 
                            className={`post-image-item ${post.images.length === 1 ? 'single' : ''}`}
                            mode="aspectFill"
                            onClick={() => {
                              previewImage({
                                current: img,
                                urls: post.images
                              })
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 视频 - 和右侧列对齐 */}
                  {post.videos && post.videos.length > 0 && (
                    <View className="post-media-section">
                      <View className="post-video-grid">
                        {post.videos.slice(0, 3).map((video, idx) => (
                          <Video
                            key={idx}
                            src={video}
                            className="post-video-item"
                            controls
                            showFullscreenBtn
                            showPlayBtn
                            showCenterPlayBtn
                            enableProgressGesture
                            objectFit="cover"
                            poster={post.images && post.images.length > 0 ? post.images[0] : ''}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 互动按钮 */}
                  <View className="post-actions">
                    <View className="action-btn" onClick={() => likePost(post.id)}>
                      <Heart 
                        size={20} 
                        color={post.is_liked ? '#ff6b6b' : '#666666'}
                      />
                      <Text className={`action-count ${post.is_liked ? 'liked' : ''}`}>
                        {post.likes_count || 0}
                      </Text>
                    </View>
                    <View
                      className="action-btn"
                      onClick={() => {
                        if (!hasAvatars) {
                          showToast({ title: '请先创建分身再评论', icon: 'none' })
                          return
                        }
                        setActivePostId(activePostId === post.id ? null : post.id)
                      }}
                    >
                      <MessageCircle size={20} color="#666666" />
                      <Text className="action-count">{post.comments_count || 0}</Text>
                    </View>
                    <View className="action-btn" onClick={() => handleShare(post.id)}>
                      <Share2 size={20} color="#666666" />
                      <Text className="action-count">{post.shares_count || 0}</Text>
                    </View>
                  </View>

                  {/* 点赞者 */}
                  {post.likers && post.likers.length > 0 && (
                    <View className="likers-section">
                      <View className="likers-avatars">
                        {post.likers.slice(0, 5).map((liker, idx) => (
                          <View 
                            key={liker.id} 
                            className="liker-avatar-wrap" 
                            style={{ marginLeft: idx > 0 ? '-12rpx' : '0', zIndex: 5 - idx }}
                            onClick={() => liker.is_ai && liker.avatar_id && navigateToAvatarProfile(liker.avatar_id)}
                          >
                            {liker.avatar ? (
                              <Image src={liker.avatar} className="liker-avatar" mode="aspectFill" />
                            ) : (
                              <View style={{ width: '100%', height: '100%', background: '#7B3FE4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#ffffff', fontSize: '20rpx' }}>{liker.name?.[0]}</Text>
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
                          <View className="comment-avatar">
                            {comment.user_avatar && comment.user_avatar.startsWith('http') ? (
                              <Image src={comment.user_avatar} style={{ width: '100%', height: '100%', borderRadius: '50%' }} mode="aspectFill" />
                            ) : (
                              <Text style={{ color: '#ffffff', fontSize: '24rpx' }}>{comment.user_name?.[0]}</Text>
                            )}
                          </View>
                          <View className="comment-body">
                            <Text className="comment-author">{comment.user_name}</Text>
                            <Text className="comment-text">{comment.content}</Text>
                          </View>
                        </View>
                      ))}
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
                        />
                      </View>
                      <View className="send-btn" onClick={() => submitComment(post.id)}>
                        <Send size={20} color="#ffffff" />
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* 加载状态 - 切换标签或加载更多时显示 */}
        {loading && posts.length === 0 && (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">正在加载精彩内容...</Text>
          </View>
        )}

        {/* 底部留白 */}
        <View style={{ height: '120rpx' }} />
      </ScrollView>

      {/* 悬浮刷新按钮 */}
      <View className="floating-refresh-btn" onClick={handleRefreshPosts}>
        <Text className="refresh-icon">🔄</Text>
        <Text className="refresh-text">换一批</Text>
      </View>

      {/* 分享弹窗 */}
      {renderShareModal()}
    </View>
  )
}
