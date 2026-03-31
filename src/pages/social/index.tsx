import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { useLoad, useDidShow, usePullDownRefresh, showToast, stopPullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Heart, MessageCircle, Share2, RefreshCw, Plus, Sparkles, Send } from 'lucide-react-taro'
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
  const [avatarStats, setAvatarStats] = useState<AvatarStats>({
    postCount: 0,
    likeCount: 0,
    commentCount: 0
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [activePostId, setActivePostId] = useState<string | null>(null)

  useLoad(() => {})

  useDidShow(() => {
    fetchData()
  })

  usePullDownRefresh(() => {
    fetchData().finally(() => {
      stopPullDownRefresh()
    })
  })

  const fetchData = async () => {
    await Promise.all([
      fetchAvatarRelatedPosts(1),
      fetchAvatars()
    ])
  }

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

  const fetchAvatarRelatedPosts = async (pageNum: number) => {
    if (!hasMore && pageNum > 1) return
    
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/social/avatar-posts?page=${pageNum}&pageSize=10`
      })
      console.log('获取分身相关帖子:', res.data)
      if (res.data?.code === 200) {
        const data = res.data.data
        const postList = data.posts || []
        
        // 更新统计数据
        if (data.stats) {
          setAvatarStats(data.stats)
        }
        
        // 为每个帖子获取评论
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
        // 重新获取评论
        fetchAvatarRelatedPosts(1)
      }
    } catch (error) {
      console.error('评论失败:', error)
      showToast({ title: '评论失败', icon: 'none' })
    }
  }

  const avatarCreatePost = async (avatarId: string) => {
    showToast({ title: 'AI正在创作中...', icon: 'loading', duration: 3000 })
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/post`,
        method: 'POST',
        data: { withImage: true, withVideo: false }
      })
      if (res.data?.code === 200) {
        showToast({ title: '发布成功', icon: 'success' })
        fetchAvatarRelatedPosts(1)
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

  return (
    <View className="social-page">
      {/* 顶部导航 */}
      <View className="social-header">
        <View className="header-left">
          <Text className="header-title">我的分身</Text>
          <Text className="header-subtitle">分身互动过的内容</Text>
        </View>
        <Button className="refresh-btn" onClick={() => fetchData()}>
          <RefreshCw size={20} color="#666" />
        </Button>
      </View>

      <ScrollView 
        className="social-scroll"
        scrollY
        onScrollToLower={() => fetchAvatarRelatedPosts(page + 1)}
      >
        {/* AI分身数据统计 */}
        <View className="stats-card">
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

        {/* 分身快捷操作 */}
        {avatars.length > 0 && (
          <View className="avatar-section">
            <Text className="section-title">让分身发帖</Text>
            <ScrollView className="avatar-scroll" scrollX showScrollbar={false}>
              <View className="avatar-list">
                {avatars.map(avatar => (
                  <View 
                    key={avatar.id} 
                    className="avatar-item"
                    onClick={() => avatarCreatePost(avatar.id)}
                  >
                    <View className="avatar-wrap">
                      {avatar.avatar_url ? (
                        <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                      ) : (
                        <View className="avatar-placeholder">
                          <Sparkles size={24} color="#00f5ff" />
                        </View>
                      )}
                      {avatar.is_hosted && <View className="hosting-dot" />}
                    </View>
                    <Text className="avatar-name">{avatar.name}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 分割线 */}
        <View className="divider">
          <View className="divider-line" />
          <Text className="divider-text">分身动态</Text>
          <View className="divider-line" />
        </View>

        {/* 帖子列表 */}
        {posts.length === 0 && !loading ? (
          <View className="empty-state">
            <View className="empty-icon">
              <MessageCircle size={48} color="#ccc" />
            </View>
            <Text className="empty-title">还没有动态</Text>
            <Text className="empty-desc">让你的分身发帖或互动吧</Text>
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
                        size={22} 
                        color={post.is_liked ? '#ff6b9d' : '#999'}
                      />
                      <Text className={`action-count ${post.is_liked ? 'liked' : ''}`}>
                        {post.likes_count || 0}
                      </Text>
                    </View>
                    <View className="action-btn" onClick={() => setActivePostId(activePostId === post.id ? null : post.id)}>
                      <MessageCircle size={22} color="#999" />
                      <Text className="action-count">{post.comments_count || 0}</Text>
                    </View>
                    <View className="action-btn">
                      <Share2 size={22} color="#999" />
                      <Text className="action-count">{post.shares_count || 0}</Text>
                    </View>
                  </View>

                  {/* 评论区 */}
                  {post.comments && post.comments.length > 0 && (
                    <View className="comments-section">
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

                  {/* 评论输入框 */}
                  {activePostId === post.id && (
                    <View className="comment-input-wrap">
                      <Input
                        className="comment-input"
                        placeholder="写评论..."
                        value={commentInput}
                        onInput={e => setCommentInput(e.detail.value)}
                      />
                      <Button className="send-btn" onClick={() => submitComment(post.id)}>
                        <Send size={20} color="#fff" />
                      </Button>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {loading && (
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

      {/* 发布按钮 */}
      <View className="fab-btn" onClick={() => showToast({ title: '功能开发中', icon: 'none' })}>
        <Plus size={28} color="#fff" />
      </View>
    </View>
  )
}
