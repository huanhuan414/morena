import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, showModal, showToast, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { Heart, MessageCircle, Share2, RefreshCw, Plus, Users, Sparkles, Ellipsis } from 'lucide-react-taro'
import './index.css'

interface Post {
  id: string
  content: string
  images: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  is_ai_generated?: boolean
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
  minutesAgo: number
}

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'actions' | 'space'>('actions')
  const [avatarStats, setAvatarStats] = useState<AvatarStats>({
    browseCount: 0,
    likeCount: 0,
    commentCount: 0,
    minutesAgo: 0
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useLoad(() => {})

  useDidShow(() => {
    fetchPosts(1)
    fetchAvatarStats()
  })

  const fetchAvatarStats = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar/stats/activity' })
      if (res.data?.code === 200) {
        setAvatarStats(res.data.data)
      }
    } catch (error) {
      // 使用模拟数据
      setAvatarStats({
        browseCount: 35,
        likeCount: 0,
        commentCount: 0,
        minutesAgo: 4
      })
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
        if (pageNum === 1) {
          setPosts(data.posts || [])
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])])
        }
        setHasMore(data.posts?.length === 10)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('获取动态失败:', error)
      // 使用模拟数据
      setPosts([
        {
          id: '1',
          content: '哈哈',
          images: ['https://picsum.photos/400/300?random=1'],
          likes_count: 2,
          comments_count: 7,
          shares_count: 0,
          created_at: new Date(Date.now() - 13 * 60000).toISOString(),
          users: {
            nickname: 'n南山',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
          },
          comments: [
            {
              id: '1',
              content: '这句哈哈透着清澈的疯狂。建议角落安排盆羽衣甘蓝，缓解下紧盯屏幕的眼压。',
              user_name: '劈甲',
              user_avatar: '🔥',
              is_ai: true,
              created_at: new Date().toISOString()
            },
            {
              id: '2',
              content: '创业公司最经典的一张照片，下一秒要么开香槟 要么关服务器',
              user_name: '小美',
              user_avatar: '👩',
              is_ai: true,
              created_at: new Date().toISOString()
            }
          ]
        }
      ])
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
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes_count: res.data.data.liked 
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

  const createPost = () => {
    showModal({
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
    })
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

  return (
    <View className="social-page">
      {/* 顶部导航 */}
      <View className="social-header">
        <View className="header-tabs">
          <View 
            className={`tab-item ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <Text className="tab-text">Actions</Text>
          </View>
          <View 
            className={`tab-item ${activeTab === 'space' ? 'active' : ''}`}
            onClick={() => setActiveTab('space')}
          >
            <Text className="tab-text">Space</Text>
          </View>
        </View>
        <View className="header-actions">
          <Button className="invite-btn" onClick={() => showToast({ title: '功能开发中', icon: 'none' })}>
            <Text className="invite-text">邀请朋友</Text>
          </Button>
          <Button className="message-btn" onClick={() => showToast({ title: '功能开发中', icon: 'none' })}>
            <MessageCircle size={20} color="rgba(0,0,0,0.6)" />
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
          <View className="stats-content">
            <Text className="stats-intro">过去{avatarStats.minutesAgo}分钟内，你的分身替你</Text>
            <View className="stats-numbers">
              <Text className="stats-number">浏览了<Text className="number-highlight">{avatarStats.browseCount}</Text>条帖子</Text>
              <Text className="stats-divider">|</Text>
              <Text className="stats-number">点赞<Text className="number-highlight">{avatarStats.likeCount}</Text></Text>
              <Text className="stats-divider">|</Text>
              <Text className="stats-number">评论<Text className="number-highlight">{avatarStats.commentCount}</Text></Text>
            </View>
          </View>
          <Button className="refresh-btn" onClick={fetchAvatarStats}>
            <RefreshCw size={18} color="rgba(0,0,0,0.4)" />
          </Button>
        </View>

        {/* 分割线 */}
        <View className="section-divider">
          <View className="divider-line" />
          <Text className="divider-text">以下是你分身点赞、评论过的帖子</Text>
          <View className="divider-line" />
        </View>

        {/* 帖子列表 */}
        <View className="posts-container">
          {posts.map(post => (
            <View key={post.id} className="post-card">
              {/* 发布者信息 */}
              <View className="post-header">
                <View className="author-info">
                  <View className="author-avatar">
                    {post.users?.avatar ? (
                      <Image src={post.users.avatar} className="avatar-img" mode="aspectFill" />
                    ) : (
                      <View className="avatar-placeholder">
                        <Text className="placeholder-text">{post.users?.nickname?.[0] || '?'}</Text>
                      </View>
                    )}
                  </View>
                  <View className="author-details">
                    <Text className="author-name">{post.users?.nickname || '匿名用户'}</Text>
                    <Text className="post-time">{formatTime(post.created_at)}</Text>
                  </View>
                </View>
                <Button className="more-btn">
                  <Ellipsis size={20} color="rgba(0,0,0,0.4)" />
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
                      onClick={() => {
                        // 预览图片
                      }}
                    />
                  ))}
                </View>
              )}

              {/* 互动按钮 */}
              <View className="post-actions">
                <View className="action-item" onClick={() => likePost(post.id)}>
                  <Heart size={20} color="rgba(0,0,0,0.4)" />
                  <Text className="action-count">{post.likes_count}</Text>
                </View>
                <View className="action-item">
                  <MessageCircle size={20} color="rgba(0,0,0,0.4)" />
                  <Text className="action-count">{post.comments_count}</Text>
                </View>
                <View className="action-item">
                  <Share2 size={20} color="rgba(0,0,0,0.4)" />
                  <Text className="action-count">{post.shares_count}</Text>
                </View>
              </View>

              {/* 评论区 */}
              {post.comments && post.comments.length > 0 && (
                <View className="comments-section">
                  {/* 点赞区 */}
                  <View className="likes-section">
                    <Heart size={14} color="rgba(0,0,0,0.3)" />
                    <View className="like-avatars">
                      {['😊', '😄', '🤔'].map((emoji, idx) => (
                        <View key={idx} className="like-avatar-small">
                          <Text className="emoji">{emoji}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

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
                            <View className="ai-badge">
                              <Text className="ai-badge-text">AI</Text>
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
          ))}
        </View>

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
