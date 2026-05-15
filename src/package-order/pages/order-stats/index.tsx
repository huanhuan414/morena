import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import {
  ArrowLeft, Users, Eye, Heart, MessageCircle, Share2,
  ChevronDown, ChevronUp, TrendingUp, ChartBar
} from 'lucide-react-taro'
import * as Network from '@/network'
import { Avatar } from '@/components/ui/avatar'
import './index.css'

interface Post {
  id: string
  content: string
  images: string[]
  videoUrl?: string
  likesCount: number
  commentsCount: number
  sharesCount: number
  viewsCount: number
  createdAt: string
  platforms: string[]
}

interface AvatarStat {
  avatarId: string
  avatarName: string
  avatarUrl: string
  status: string
  postCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  posts: Post[]
}

interface SummaryStats {
  totalAvatars: number
  totalPosts: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  avatarStats: AvatarStat[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  accepted: '已接单',
  generating: '生成中',
  publishing: '发布中',
  published: '已发布',
  awaiting_acceptance: '待验收',
  feedback_submitted: '已提交'
}

const STATUS_COLORS: Record<string, { bg: string, text: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
  accepted: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  generating: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  publishing: { bg: 'rgba(139, 92, 246, 0.2)', text: '#8b5cf6' },
  published: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
  awaiting_acceptance: { bg: 'rgba(139, 92, 246, 0.2)', text: '#8b5cf6' },
  feedback_submitted: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' }
}

const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

export default function OrderStats() {
  const router = useRouter()
  const { orderId } = router.params
  const [stats, setStats] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedAvatars, setExpandedAvatars] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'posts'>('views')

  useLoad(() => {
    if (orderId) {
      fetchStats()
    }
  })

  const fetchStats = async () => {
    try {
      const res = await Network.request({
        url: `/api/order/${orderId}`
      })

      if (res.data?.code === 200 && res.data.data?.summary_stats) {
        setStats(res.data.data.summary_stats)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const toggleAvatarExpand = (avatarId: string) => {
    setExpandedAvatars(prev => {
      const newSet = new Set(prev)
      if (newSet.has(avatarId)) {
        newSet.delete(avatarId)
      } else {
        newSet.add(avatarId)
      }
      return newSet
    })
  }

  const getSortedAvatars = () => {
    const sorted = [...(stats?.avatarStats || [])]
    sorted.sort((a, b) => {
      if (sortBy === 'views') return b.totalViews - a.totalViews
      if (sortBy === 'likes') return b.totalLikes - a.totalLikes
      if (sortBy === 'posts') return b.postCount - a.postCount
      return 0
    })
    return sorted
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <View className="stats-page">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!stats) {
    return (
      <View className="stats-page">
        <View className="header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#ffffff" />
          </View>
          <Text className="header-title">数据统计</Text>
          <View className="header-right" />
        </View>

        <View className="empty-state">
          <ChartBar size={64} color="rgba(255,255,255,0.2)" />
          <Text className="empty-text">暂无统计数据</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="stats-page">
      {/* 头部 */}
      <View className="header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#ffffff" />
        </View>
        <Text className="header-title">数据统计</Text>
        <View className="header-right" />
      </View>

      {/* 内容 */}
      <ScrollView scrollY className="content-scroll">
        {/* 总数据卡片 */}
        <View className="summary-card">
          <View className="summary-header">
            <TrendingUp size={20} color="#00f5ff" />
            <Text className="summary-title">数据总览</Text>
          </View>

          <View className="stats-grid">
            <View className="stat-card stat-cyan">
              <View className="stat-icon">
                <Users size={24} color="#00f5ff" />
              </View>
              <Text className="stat-value">{stats.totalAvatars}</Text>
              <Text className="stat-label">参与分身</Text>
            </View>

            <View className="stat-card stat-purple">
              <View className="stat-icon">
                <Eye size={24} color="#8b5cf6" />
              </View>
              <Text className="stat-value">{formatNumber(stats.totalViews)}</Text>
              <Text className="stat-label">总浏览量</Text>
            </View>

            <View className="stat-card stat-pink">
              <View className="stat-icon">
                <Heart size={24} color="#f43f5e" />
              </View>
              <Text className="stat-value">{formatNumber(stats.totalLikes)}</Text>
              <Text className="stat-label">总点赞数</Text>
            </View>

            <View className="stat-card stat-green">
              <View className="stat-icon">
                <MessageCircle size={24} color="#22c55e" />
              </View>
              <Text className="stat-value">{formatNumber(stats.totalComments)}</Text>
              <Text className="stat-label">总评论数</Text>
            </View>
          </View>

          <View className="detail-row">
            <View className="detail-item">
              <Text className="detail-label">发布内容</Text>
              <Text className="detail-value">{stats.totalPosts}</Text>
            </View>
            <View className="detail-item">
              <Text className="detail-label">总分享数</Text>
              <Text className="detail-value">{formatNumber(stats.totalShares)}</Text>
            </View>
          </View>
        </View>

        {/* 排序 */}
        <View className="sort-bar">
          <Text className="sort-label">排序方式：</Text>
          {[
            { key: 'views', label: '按浏览量' },
            { key: 'likes', label: '按点赞数' },
            { key: 'posts', label: '按作品数' }
          ].map(sort => (
            <View
              key={sort.key}
              className={`sort-chip ${sortBy === sort.key ? 'sort-chip-active' : ''}`}
              onClick={() => setSortBy(sort.key as any)}
            >
              <Text className="sort-chip-text">{sort.label}</Text>
            </View>
          ))}
        </View>

        {/* 分身列表 */}
        <View className="avatar-list">
          {getSortedAvatars().map((avatar) => {
            const statusColor = STATUS_COLORS[avatar.status] || STATUS_COLORS.pending
            const isExpanded = expandedAvatars.has(avatar.avatarId)

            return (
              <View key={avatar.avatarId} className="avatar-card">
                {/* 头部 */}
                <View className="avatar-header" onClick={() => toggleAvatarExpand(avatar.avatarId)}>
                  <Avatar src={avatar.avatarUrl} name={avatar.avatarName} size={96} className="avatar-avatar" />
                  <View className="avatar-info">
                    <View className="avatar-name-row">
                      <Text className="avatar-name">{avatar.avatarName}</Text>
                      <View
                        className="avatar-status"
                        style={{ backgroundColor: statusColor.bg }}
                      >
                        <Text style={{ color: statusColor.text }}>{STATUS_LABELS[avatar.status]}</Text>
                      </View>
                    </View>
                    <Text className="avatar-summary">
                      {avatar.postCount} 个作品 · {formatNumber(avatar.totalViews)} 浏览 · {formatNumber(avatar.totalLikes)} 点赞
                    </Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={20} color="rgba(255,255,255,0.4)" />
                  ) : (
                    <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
                  )}
                </View>

                {/* 详情 */}
                {isExpanded && (
                  <View className="avatar-detail">
                    {/* 数据指标 */}
                    <View className="metrics-row">
                      <View className="metric-item">
                        <Eye size={16} color="#22c55e" />
                        <Text className="metric-value">{formatNumber(avatar.totalViews)}</Text>
                        <Text className="metric-label">浏览</Text>
                      </View>
                      <View className="metric-item">
                        <Heart size={16} color="#f43f5e" />
                        <Text className="metric-value">{formatNumber(avatar.totalLikes)}</Text>
                        <Text className="metric-label">点赞</Text>
                      </View>
                      <View className="metric-item">
                        <MessageCircle size={16} color="#f59e0b" />
                        <Text className="metric-value">{formatNumber(avatar.totalComments)}</Text>
                        <Text className="metric-label">评论</Text>
                      </View>
                      <View className="metric-item">
                        <Share2 size={16} color="#6366f1" />
                        <Text className="metric-value">{formatNumber(avatar.totalShares)}</Text>
                        <Text className="metric-label">分享</Text>
                      </View>
                    </View>

                    {/* 作品列表 */}
                    {avatar.posts.length > 0 ? (
                      <View className="posts-section">
                        <Text className="posts-title">作品列表 ({avatar.posts.length})</Text>
                        {avatar.posts.map((post) => (
                          <View key={post.id} className="post-card">
                            <Text className="post-content">{post.content}</Text>

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

                            {post.videoUrl && (
                              <View className="post-video">
                                <Text className="post-video-text">📹 视频内容</Text>
                              </View>
                            )}

                            <View className="post-footer">
                              <View className="post-stat">
                                <Eye size={12} color="rgba(255,255,255,0.4)" />
                                <Text className="post-stat-value">{formatNumber(post.viewsCount)}</Text>
                              </View>
                              <View className="post-stat">
                                <Heart size={12} color="rgba(255,255,255,0.4)" />
                                <Text className="post-stat-value">{formatNumber(post.likesCount)}</Text>
                              </View>
                              <View className="post-stat">
                                <MessageCircle size={12} color="rgba(255,255,255,0.4)" />
                                <Text className="post-stat-value">{formatNumber(post.commentsCount)}</Text>
                              </View>
                              <Text className="post-time">{formatDate(post.createdAt)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View className="empty-posts">
                        <Text className="empty-posts-text">暂无作品</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
