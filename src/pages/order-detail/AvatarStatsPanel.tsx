import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Users, Eye, Heart, MessageCircle, Share2, ChevronDown, ChevronUp, Funnel, ArrowUpDown } from 'lucide-react-taro'
import './AvatarStatsPanel.css'

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
  platformCount: number
  publishedCount: number
  manualCount: number
  feedbackCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  posts: Post[]
}

interface SummaryStats {
  totalAvatars: number
  acceptedAvatars: number
  submittedAvatars: number
  totalPosts: number
  totalPlatforms: number
  totalPublished: number
  totalManual: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  avatarStats: AvatarStat[]
}

interface AvatarStatsPanelProps {
  stats: SummaryStats
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  accepted: '已接单',
  generating: '生成中',
  preview: '预览中',
  publishing: '发布中',
  published: '已发布',
  awaiting_acceptance: '待验收',
  feedback_submitted: '已提交'
}

const STATUS_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  accepted: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  generating: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  preview: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  publishing: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  published: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  awaiting_acceptance: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  feedback_submitted: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' }
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

export default function AvatarStatsPanel({ stats }: AvatarStatsPanelProps) {
  const [expandedAvatars, setExpandedAvatars] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'posts'>('views')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'pending'>('all')

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
    let sorted = [...stats.avatarStats]

    // 筛选
    if (filterStatus === 'published') {
      sorted = sorted.filter(a => a.status === 'published' || a.status === 'feedback_submitted')
    } else if (filterStatus === 'pending') {
      sorted = sorted.filter(a => a.status === 'pending' || a.status === 'accepted' || a.status === 'generating')
    }

    // 排序
    sorted.sort((a, b) => {
      if (sortBy === 'views') return b.totalViews - a.totalViews
      if (sortBy === 'likes') return b.totalLikes - a.totalLikes
      if (sortBy === 'comments') return b.totalComments - a.totalComments
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

  return (
    <View style={{ padding: '1rem' }}>
      {/* 总数据统计卡片 */}
      <View className="stats-card">
        <View className="card-header">
          <Users size={20} color="#00f5ff" />
          <Text className="card-header-title">数据概览</Text>
        </View>

        {/* 核心数据 */}
        <View className="stats-grid">
          <View className="stat-item stat-item-primary">
            <View className="stat-icon stat-icon-cyan">
              <Users size={18} color="#00f5ff" />
            </View>
            <Text className="stat-label">参与分身</Text>
            <Text className="stat-value">{stats.totalAvatars}</Text>
          </View>

          <View className="stat-item stat-item-purple">
            <View className="stat-icon stat-icon-purple">
              <Eye size={18} color="#8b5cf6" />
            </View>
            <Text className="stat-label">已发布内容</Text>
            <Text className="stat-value">{stats.totalPosts}</Text>
          </View>

          <View className="stat-item stat-item-green">
            <View className="stat-icon stat-icon-green">
              <Eye size={18} color="#22c55e" />
            </View>
            <Text className="stat-label">总浏览量</Text>
            <Text className="stat-value">{formatNumber(stats.totalViews)}</Text>
          </View>

          <View className="stat-item stat-item-pink">
            <View className="stat-icon stat-icon-pink">
              <Heart size={18} color="#f43f5e" />
            </View>
            <Text className="stat-label">总点赞数</Text>
            <Text className="stat-value">{formatNumber(stats.totalLikes)}</Text>
          </View>

          <View className="stat-item stat-item-yellow">
            <View className="stat-icon stat-icon-yellow">
              <MessageCircle size={18} color="#f59e0b" />
            </View>
            <Text className="stat-label">总评论数</Text>
            <Text className="stat-value">{formatNumber(stats.totalComments)}</Text>
          </View>

          <View className="stat-item stat-item-indigo">
            <View className="stat-icon stat-icon-indigo">
              <Share2 size={18} color="#6366f1" />
            </View>
            <Text className="stat-label">总分享数</Text>
            <Text className="stat-value">{formatNumber(stats.totalShares)}</Text>
          </View>
        </View>

        {/* 平台统计 */}
        <View className="platform-stats">
          <View className="platform-stat-item">
            <Text className="platform-stat-label">已接单</Text>
            <Text className="platform-stat-value platform-stat-value-blue">{stats.acceptedAvatars}</Text>
          </View>
          <View className="platform-stat-divider" />
          <View className="platform-stat-item">
            <Text className="platform-stat-label">已提交</Text>
            <Text className="platform-stat-value platform-stat-value-green">{stats.submittedAvatars}</Text>
          </View>
          <View className="platform-stat-divider" />
          <View className="platform-stat-item">
            <Text className="platform-stat-label">已发布</Text>
            <Text className="platform-stat-value platform-stat-value-purple">{stats.totalPublished}</Text>
          </View>
        </View>
      </View>

      {/* 筛选和排序 */}
      <View className="filter-bar">
        <View className="filter-section">
          <Funnel size={14} color="rgba(255,255,255,0.5)" />
          <Text className="filter-label">筛选</Text>
          {[
            { key: 'all', label: '全部' },
            { key: 'published', label: '已发布' },
            { key: 'pending', label: '进行中' }
          ].map(filter => (
            <View
              key={filter.key}
              onClick={() => setFilterStatus(filter.key as any)}
              className={`filter-chip ${filterStatus === filter.key ? 'filter-chip-active' : ''}`}
            >
              <Text className="filter-chip-text">{filter.label}</Text>
            </View>
          ))}
        </View>

        <View className="filter-section">
          <ArrowUpDown size={14} color="rgba(255,255,255,0.5)" />
          <Text className="filter-label">排序</Text>
          {[
            { key: 'views', label: '浏览量' },
            { key: 'likes', label: '点赞' },
            { key: 'comments', label: '评论' },
            { key: 'posts', label: '作品数' }
          ].map(sort => (
            <View
              key={sort.key}
              onClick={() => setSortBy(sort.key as any)}
              className={`filter-chip ${sortBy === sort.key ? 'filter-chip-active' : ''}`}
            >
              <Text className="filter-chip-text">{sort.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 分身列表 */}
      <View className="avatar-list">
        {getSortedAvatars().map((avatarStat) => {
          const statusColor = STATUS_COLORS[avatarStat.status] || STATUS_COLORS.pending
          const isExpanded = expandedAvatars.has(avatarStat.avatarId)

          return (
            <View key={avatarStat.avatarId} className="avatar-card">
              {/* 分身头部 */}
              <View className="avatar-header" onClick={() => toggleAvatarExpand(avatarStat.avatarId)}>
                <Image
                  src={avatarStat.avatarUrl || 'https://via.placeholder.com/40'}
                  className="avatar-avatar"
                  mode="aspectFill"
                />
                <View className="avatar-info">
                  <View className="avatar-name-row">
                    <Text className="avatar-name">{avatarStat.avatarName}</Text>
                    <View
                      className="avatar-status-badge"
                      style={{
                        backgroundColor: statusColor.bg,
                        borderColor: statusColor.border
                      }}
                    >
                      <Text className="avatar-status-text" style={{ color: statusColor.text }}>
                        {STATUS_LABELS[avatarStat.status] || avatarStat.status}
                      </Text>
                    </View>
                  </View>
                  <Text className="avatar-stats">
                    {avatarStat.postCount} 作品 · {formatNumber(avatarStat.totalViews)} 浏览 · {formatNumber(avatarStat.totalLikes)} 点赞
                  </Text>
                </View>
                <View className="avatar-expand-icon">
                  {isExpanded ? (
                    <ChevronUp size={20} color="rgba(255,255,255,0.4)" />
                  ) : (
                    <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
                  )}
                </View>
              </View>

              {/* 分身数据详情 */}
              {isExpanded && (
                <View className="avatar-detail">
                  {/* 数据指标 */}
                  <View className="avatar-metrics">
                    <View className="avatar-metric">
                      <View className="avatar-metric-icon">
                        <Eye size={16} color="#22c55e" />
                      </View>
                      <Text className="avatar-metric-value">{formatNumber(avatarStat.totalViews)}</Text>
                      <Text className="avatar-metric-label">浏览</Text>
                    </View>
                    <View className="avatar-metric">
                      <View className="avatar-metric-icon">
                        <Heart size={16} color="#f43f5e" />
                      </View>
                      <Text className="avatar-metric-value">{formatNumber(avatarStat.totalLikes)}</Text>
                      <Text className="avatar-metric-label">点赞</Text>
                    </View>
                    <View className="avatar-metric">
                      <View className="avatar-metric-icon">
                        <MessageCircle size={16} color="#f59e0b" />
                      </View>
                      <Text className="avatar-metric-value">{formatNumber(avatarStat.totalComments)}</Text>
                      <Text className="avatar-metric-label">评论</Text>
                    </View>
                    <View className="avatar-metric">
                      <View className="avatar-metric-icon">
                        <Share2 size={16} color="#6366f1" />
                      </View>
                      <Text className="avatar-metric-value">{formatNumber(avatarStat.totalShares)}</Text>
                      <Text className="avatar-metric-label">分享</Text>
                    </View>
                  </View>

                  {/* 作品列表 */}
                  {avatarStat.posts.length > 0 ? (
                    <View className="avatar-posts">
                      <Text className="avatar-posts-title">作品列表 ({avatarStat.posts.length})</Text>
                      {avatarStat.posts.map((post) => (
                        <View key={post.id} className="post-card">
                          <Text className="post-content">{post.content}</Text>

                          {/* 图片展示 */}
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

                          {/* 视频展示 */}
                          {post.videoUrl && (
                            <View className="post-video">
                              <Text className="post-video-text">📹 视频内容</Text>
                            </View>
                          )}

                          {/* 互动数据 */}
                          <View className="post-metrics">
                            <View className="post-metric">
                              <Eye size={14} color="rgba(255,255,255,0.4)" />
                              <Text className="post-metric-value">{formatNumber(post.viewsCount)}</Text>
                            </View>
                            <View className="post-metric">
                              <Heart size={14} color="rgba(255,255,255,0.4)" />
                              <Text className="post-metric-value">{formatNumber(post.likesCount)}</Text>
                            </View>
                            <View className="post-metric">
                              <MessageCircle size={14} color="rgba(255,255,255,0.4)" />
                              <Text className="post-metric-value">{formatNumber(post.commentsCount)}</Text>
                            </View>
                            <View className="post-metric">
                              <Share2 size={14} color="rgba(255,255,255,0.4)" />
                              <Text className="post-metric-value">{formatNumber(post.sharesCount)}</Text>
                            </View>
                            <Text className="post-time">{formatDate(post.createdAt)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="avatar-empty-posts">
                      <Text className="avatar-empty-text">暂无作品</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
