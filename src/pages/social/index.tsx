import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { useLoad, useDidShow, usePullDownRefresh, showToast, stopPullDownRefresh, navigateTo, showShareMenu, getEnv, ENV_TYPE } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as Network from '@/network'
import { Heart, MessageCircle, Share2, RefreshCw, Sparkles, Send, UserPlus, Link, Users, TrendingUp, DollarSign, Ellipsis } from 'lucide-react-taro'
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
  is_liked?: boolean
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
  const statsCardRef = useRef<any>(null)

  useLoad(() => {
    // showShareMenu 仅在小程序端可用
    if (getEnv() === ENV_TYPE.WEAPP) {
      showShareMenu({
        withShareTicket: true
      } as any)
    }
  })

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
      await fetchAvatarRelatedPosts(1, isRefresh)
      await checkAvatars()
    } finally {
      setLoading(false)
      setRefreshing(false)
      setTimeout(() => setIsUpdating(false), 1500)
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
      const res = await Network.request({
        url: `/api/social/avatar-posts?page=${pageNum}&pageSize=10`
      })
      console.log('获取分身相关帖子:', res.data)
      if (res.data?.code === 200) {
        const data = res.data.data
        const postList = data.posts || []
        
        if (data.stats) {
          setAvatarStats({
            postCount: data.stats.postCount || 0,
            likeCount: data.stats.likeCount || 0,
            commentCount: data.stats.commentCount || 0,
            orderCount: data.stats.orderCount || 0,
            totalEarnings: data.stats.totalEarnings || 0
          })
        }
        
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

  const goToCreateAvatar = () => {
    navigateTo({ url: '/pages/avatar-create/index' })
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

  const renderNoAvatarGuide = () => (
    <View className="no-avatar-state">
      <View className="no-avatar-icon">
        <UserPlus size={56} color="#00f5ff" />
      </View>
      <Text className="no-avatar-title">创建你的AI分身</Text>
      <Text className="no-avatar-desc">让AI分身帮你自动发帖、评论、互动{'\n'}开启人机共生新时代</Text>
      <View className="create-avatar-btn" onClick={goToCreateAvatar}>
        <Sparkles size={24} color="#0a0a0f" />
        <Text className="create-avatar-btn-text">立即创建</Text>
      </View>
    </View>
  )

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
      {/* 顶部导航 */}
      <View className="social-header">
        <View className="header-left">
          <Text className="header-title">我的分身</Text>
          <Text className="header-subtitle">分身互动过的内容</Text>
        </View>
        <View 
          className={`refresh-btn ${refreshing ? 'rotating' : ''}`} 
          onClick={() => fetchData(true)}
        >
          <RefreshCw size={20} color="#00f5ff" />
        </View>
      </View>

      <ScrollView 
        className="social-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => fetchData(true)}
        onScrollToLower={() => hasAvatars && fetchAvatarRelatedPosts(page + 1)}
      >
        {hasAvatars === false ? (
          renderNoAvatarGuide()
        ) : (
          <>
            {/* 收益统计卡片 - 带跑马灯特效 */}
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

            {/* 分割线 */}
            <View className="divider">
              <View className="divider-line" />
              <Text className="divider-text">以下是你分身点赞、评论过的帖子</Text>
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
                        <View className="author-info">
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
                              mode="aspectFill"
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
                              objectFit="cover"
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

                      {/* 评论区 */}
                      {post.comments && post.comments.length > 0 && (
                        <View className="comments-section">
                          {post.comments.map(comment => (
                            <View key={comment.id} className="comment-item">
                              <View className="comment-avatar">
                                {comment.user_avatar && comment.user_avatar.startsWith('http') ? (
                                  <Image src={comment.user_avatar} className="comment-avatar-img" mode="aspectFill" />
                                ) : (
                                  <Text className="emoji">{comment.user_avatar || '👤'}</Text>
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
                        </View>
                      )}

                      {/* 评论输入框 */}
                      {activePostId === post.id && (
                        <View className="comment-input-wrap">
                          <View className="comment-input">
                            <input
                              placeholder="写评论..."
                              value={commentInput}
                              onInput={(e: any) => setCommentInput(e.detail.value)}
                              style={{ 
                                width: '100%', 
                                height: '44px',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '14px'
                              }}
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
        )}

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
