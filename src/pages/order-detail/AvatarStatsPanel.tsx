import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Users, Eye, Heart, MessageCircle, Share2, ChevronDown, ChevronUp } from 'lucide-react-taro'

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

const STATUS_COLORS: Record<string, { bg: string, text: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
  accepted: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  generating: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  preview: { bg: 'rgba(139, 92, 246, 0.2)', text: '#8b5cf6' },
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

const StatCard = ({ icon, label, value, color }: any) => (
  <View style={{
    padding: '0.75rem',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '0.5rem',
    flex: 1
  }}
  >
    <View style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
      {icon}
      <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
    </View>
    <Text style={{ fontSize: '1.25rem', fontWeight: 600, color }}>{value}</Text>
  </View>
)

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
      <View className="glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <View className="card-header" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}
        >
          <Users size={20} color="#00f5ff" />
          <Text className="card-title">总数据统计</Text>
        </View>

        {/* 核心数据 */}
        <View style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
        >
          <StatCard
            icon={<Users size={16} color="#00f5ff" />}
            label="参与分身"
            value={stats.totalAvatars}
            color="#00f5ff"
          />
          <StatCard
            icon={<Users size={16} color="#3b82f6" />}
            label="已发布内容"
            value={stats.totalPosts}
            color="#3b82f6"
          />
          <StatCard
            icon={<Eye size={16} color="#22c55e" />}
            label="总浏览量"
            value={formatNumber(stats.totalViews)}
            color="#22c55e"
          />
          <StatCard
            icon={<Heart size={16} color="#f43f5e" />}
            label="总点赞数"
            value={formatNumber(stats.totalLikes)}
            color="#f43f5e"
          />
          <StatCard
            icon={<MessageCircle size={16} color="#f59e0b" />}
            label="总评论数"
            value={formatNumber(stats.totalComments)}
            color="#f59e0b"
          />
          <StatCard
            icon={<Share2 size={16} color="#8b5cf6" />}
            label="总分享数"
            value={formatNumber(stats.totalShares)}
            color="#8b5cf6"
          />
        </View>

        {/* 平台统计 */}
        <View style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: '0.5rem'
        }}
        >
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>已接单</Text>
            <Text style={{ fontSize: '1.125rem', fontWeight: 600, color: '#3b82f6' }}>{stats.acceptedAvatars}</Text>
          </View>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>已提交</Text>
            <Text style={{ fontSize: '1.125rem', fontWeight: 600, color: '#22c55e' }}>{stats.submittedAvatars}</Text>
          </View>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>已发布</Text>
            <Text style={{ fontSize: '1.125rem', fontWeight: 600, color: '#8b5cf6' }}>{stats.totalPublished}</Text>
          </View>
        </View>
      </View>

      {/* 筛选和排序 */}
      <View style={{ marginBottom: '1rem' }}>
        <View style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap'
        }}
        >
          {[
            { key: 'all', label: '全部' },
            { key: 'published', label: '已发布' },
            { key: 'pending', label: '进行中' }
          ].map(filter => (
            <View
              key={filter.key}
              onClick={() => setFilterStatus(filter.key as any)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: filterStatus === filter.key ? 'rgba(0, 245, 255, 0.2)' : 'rgba(255,255,255,0.1)',
                borderWidth: filterStatus === filter.key ? '1px' : '0',
                borderColor: '#00f5ff'
              }}
            >
              <Text style={{
                fontSize: '0.875rem',
                color: filterStatus === filter.key ? '#00f5ff' : 'rgba(255,255,255,0.7)'
              }}
              >{filter.label}</Text>
            </View>
          ))}
        </View>

        <View style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}
        >
          {[
            { key: 'views', label: '按浏览量' },
            { key: 'likes', label: '按点赞' },
            { key: 'comments', label: '按评论' },
            { key: 'posts', label: '按作品数' }
          ].map(sort => (
            <View
              key={sort.key}
              onClick={() => setSortBy(sort.key as any)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: sortBy === sort.key ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.1)',
                borderWidth: sortBy === sort.key ? '1px' : '0',
                borderColor: '#8b5cf6'
              }}
            >
              <Text style={{
                fontSize: '0.875rem',
                color: sortBy === sort.key ? '#8b5cf6' : 'rgba(255,255,255,0.7)'
              }}
              >{sort.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 分身列表 */}
      {getSortedAvatars().map((avatarStat) => (
        <View
          key={avatarStat.avatarId}
          style={{
            marginBottom: '1rem',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '0.75rem',
            overflow: 'hidden'
          }}
        >
          {/* 分身头部 */}
          <View
            onClick={() => toggleAvatarExpand(avatarStat.avatarId)}
            style={{
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Image
              src={avatarStat.avatarUrl || 'https://via.placeholder.com/40'}
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.2)'
              }}
            />
            <View style={{ flex: 1 }}>
              <View style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Text style={{ fontSize: '1rem', fontWeight: 600 }}>{avatarStat.avatarName}</Text>
                <View style={{
                  padding: '0.125rem 0.5rem',
                  borderRadius: '0.25rem',
                  backgroundColor: STATUS_COLORS[avatarStat.status]?.bg || 'rgba(107, 114, 128, 0.2)'
                }}
                >
                  <Text style={{
                    fontSize: '0.75rem',
                    color: STATUS_COLORS[avatarStat.status]?.text || 'rgba(255,255,255,0.7)'
                  }}
                  >
                    {STATUS_LABELS[avatarStat.status] || avatarStat.status}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                {avatarStat.postCount} 个作品 · {formatNumber(avatarStat.totalViews)} 浏览 · {formatNumber(avatarStat.totalLikes)} 点赞
              </Text>
            </View>
            {expandedAvatars.has(avatarStat.avatarId) ? (
              <ChevronUp size={20} color="rgba(255,255,255,0.5)" />
            ) : (
              <ChevronDown size={20} color="rgba(255,255,255,0.5)" />
            )}
          </View>

          {/* 分身数据详情 */}
          {expandedAvatars.has(avatarStat.avatarId) && (
            <View style={{
              padding: '0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}
            >
              {/* 数据指标 */}
              <View style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
                marginBottom: '1rem',
                padding: '0.5rem',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '0.375rem'
              }}
              >
                <View style={{ textAlign: 'center' }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.125rem' }}>
                    <Eye size={14} color="#22c55e" />
                    <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>浏览</Text>
                  </View>
                  <Text style={{ fontSize: '1rem', fontWeight: 600, color: '#22c55e' }}>{formatNumber(avatarStat.totalViews)}</Text>
                </View>
                <View style={{ textAlign: 'center' }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.125rem' }}>
                    <Heart size={14} color="#f43f5e" />
                    <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>点赞</Text>
                  </View>
                  <Text style={{ fontSize: '1rem', fontWeight: 600, color: '#f43f5e' }}>{formatNumber(avatarStat.totalLikes)}</Text>
                </View>
                <View style={{ textAlign: 'center' }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.125rem' }}>
                    <MessageCircle size={14} color="#f59e0b" />
                    <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>评论</Text>
                  </View>
                  <Text style={{ fontSize: '1rem', fontWeight: 600, color: '#f59e0b' }}>{formatNumber(avatarStat.totalComments)}</Text>
                </View>
                <View style={{ textAlign: 'center' }}>
                  <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.125rem' }}>
                    <Share2 size={14} color="#8b5cf6" />
                    <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>分享</Text>
                  </View>
                  <Text style={{ fontSize: '1rem', fontWeight: 600, color: '#8b5cf6' }}>{formatNumber(avatarStat.totalShares)}</Text>
                </View>
              </View>

              {/* 作品列表 */}
              {avatarStat.posts.length > 0 ? (
                <View>
                  <Text style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    作品列表 ({avatarStat.posts.length})
                  </Text>
                  {avatarStat.posts.map((post) => (
                    <View
                      key={post.id}
                      style={{
                        marginBottom: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '0.375rem'
                      }}
                    >
                      <Text style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{post.content}</Text>

                      {/* 图片展示 */}
                      {post.images && post.images.length > 0 && (
                        <View style={{
                          display: 'flex',
                          gap: '0.5rem',
                          marginBottom: '0.5rem',
                          flexWrap: 'wrap'
                        }}
                        >
                          {post.images.map((img, idx) => (
                            <Image
                              key={idx}
                              src={img}
                              style={{
                                width: '6rem',
                                height: '6rem',
                                borderRadius: '0.25rem',
                                objectFit: 'cover'
                              }}
                              mode="aspectFill"
                            />
                          ))}
                        </View>
                      )}

                      {/* 视频展示 */}
                      {post.videoUrl && (
                        <View style={{
                          marginBottom: '0.5rem',
                          padding: '0.5rem',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: '0.25rem',
                          textAlign: 'center'
                        }}
                        >
                          <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                            📹 视频内容
                          </Text>
                        </View>
                      )}

                      {/* 互动数据 */}
                      <View style={{
                        display: 'flex',
                        gap: '1rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255,255,255,0.1)'
                      }}
                      >
                        <View style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Eye size={14} color="rgba(255,255,255,0.5)" />
                          <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                            {formatNumber(post.viewsCount)}
                          </Text>
                        </View>
                        <View style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Heart size={14} color="rgba(255,255,255,0.5)" />
                          <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                            {formatNumber(post.likesCount)}
                          </Text>
                        </View>
                        <View style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MessageCircle size={14} color="rgba(255,255,255,0.5)" />
                          <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                            {formatNumber(post.commentsCount)}
                          </Text>
                        </View>
                        <View style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Share2 size={14} color="rgba(255,255,255,0.5)" />
                          <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                            {formatNumber(post.sharesCount)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
                          {formatDate(post.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{
                  padding: '1rem',
                  textAlign: 'center',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '0.375rem'
                }}
                >
                  <Text style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>
                    暂无作品
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  )
}
