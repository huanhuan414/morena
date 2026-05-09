import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import * as Network from '@/network'
import { Image as ImageIcon, Video, FileText, Calendar, Eye, Heart, MessageCircle, Share2, Copy, Check, Play, Ellipsis } from 'lucide-react-taro'
import './index.css'

// 内容类型
type ContentType = 'all' | 'text-image' | 'image' | 'video'

// 内容数据接口
interface GeneratedContent {
  id: string
  title: string
  content: string
  type: 'text-image' | 'image' | 'video' | 'text'
  platform: string
  thumbnail?: string
  tags: string[]
  stats: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  created_at: string
  status: string
}

// 平台配置
const PLATFORMS = [
  { key: 'xiaohongshu', name: '小红书', color: '#FF2442' },
  { key: 'douyin', name: '抖音', color: '#00F2EA' },
  { key: 'wechat_mp', name: '公众号', color: '#07C160' },
  { key: 'weibo', name: '微博', color: '#FF8200' },
]

// 类型配置
const CONTENT_TYPES = [
  { key: 'all', name: '全部', icon: FileText },
  { key: 'text-image', name: '图文', icon: ImageIcon },
  { key: 'image', name: '纯图', icon: ImageIcon },
  { key: 'video', name: '视频', icon: Video },
]

// 模拟数据
const MOCK_CONTENTS: GeneratedContent[] = [
  {
    id: '1',
    title: '春季美妆护肤种草笔记',
    content: '今天给大家分享一款超级好用的护肤精华...',
    type: 'text-image',
    platform: 'xiaohongshu',
    thumbnail: 'https://picsum.photos/400/300?random=1',
    tags: ['护肤', '种草', '好物分享'],
    stats: { views: 12580, likes: 892, comments: 156, shares: 45 },
    created_at: '2024-03-10',
    status: 'published'
  },
  {
    id: '2',
    title: '科技产品开箱测评',
    content: '',
    type: 'video',
    platform: 'douyin',
    thumbnail: 'https://picsum.photos/400/300?random=2',
    tags: ['数码', '测评', '开箱'],
    stats: { views: 34520, likes: 2100, comments: 320, shares: 180 },
    created_at: '2024-03-08',
    status: 'published'
  },
  {
    id: '3',
    title: '美食探店推荐',
    content: '',
    type: 'image',
    platform: 'xiaohongshu',
    thumbnail: 'https://picsum.photos/400/300?random=3',
    tags: ['美食', '探店', '推荐'],
    stats: { views: 8960, likes: 560, comments: 89, shares: 32 },
    created_at: '2024-03-05',
    status: 'published'
  },
  {
    id: '4',
    title: '职场成长干货分享',
    content: '职场晋升的三大关键要素...',
    type: 'text',
    platform: 'wechat_mp',
    thumbnail: 'https://picsum.photos/400/300?random=4',
    tags: ['职场', '成长', '干货'],
    stats: { views: 4520, likes: 320, comments: 67, shares: 28 },
    created_at: '2024-03-03',
    status: 'published'
  },
  {
    id: '5',
    title: '周末穿搭灵感',
    content: '',
    type: 'image',
    platform: 'weibo',
    thumbnail: 'https://picsum.photos/400/300?random=5',
    tags: ['穿搭', '时尚', '搭配'],
    stats: { views: 15680, likes: 980, comments: 145, shares: 67 },
    created_at: '2024-03-01',
    status: 'published'
  }
]

export default function GeneratedContentPage() {
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<ContentType>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchContents()
  }, [])

  const fetchContents = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/content-generation/my-contents'
      })
      if (res.data?.code === 200) {
        setContents(res.data.data || [])
      } else {
        setContents(MOCK_CONTENTS)
      }
    } catch (error) {
      console.error('获取生成内容失败:', error)
      setContents(MOCK_CONTENTS)
    } finally {
      setLoading(false)
    }
  }

  // 筛选内容
  const filteredContents = contents.filter(content => {
    const typeMatch = selectedType === 'all' || content.type === selectedType
    const platformMatch = !selectedPlatform || content.platform === selectedPlatform
    return typeMatch && platformMatch
  })

  // 获取平台信息
  const getPlatformInfo = (key: string) => {
    return PLATFORMS.find(p => p.key === key) || { name: key, color: '#6366F1' }
  }

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  // 复制内容
  const handleCopy = (content: GeneratedContent) => {
    Taro.setClipboardData({
      data: content.content,
      success: () => {
        setCopiedId(content.id)
        setTimeout(() => setCopiedId(null), 2000)
      }
    })
  }

  return (
    <View className="generated-content-page">
      {/* 顶部背景 */}
      <View className="page-header">
        {/* 装饰圆形 */}
        <View className="header-decoration">
          <View className="decoration-circle circle-1" />
          <View className="decoration-circle circle-2" />
        </View>
        
        {/* 页面标题 */}
        <View className="header-title-area">
          <Text className="header-title">生成内容</Text>
          <Text className="header-subtitle">记录每一次创作 · 图文 · 视频</Text>
        </View>

        {/* 内容统计 */}
        <View className="content-stats">
          <View className="stat-item">
            <Text className="stat-number">{contents.length}</Text>
            <Text className="stat-label">总创作</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Text className="stat-number">{contents.filter(c => c.status === 'published').length}</Text>
            <Text className="stat-label">已发布</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Text className="stat-number">
              {formatNumber(contents.reduce((sum, c) => sum + c.stats.views, 0))}
            </Text>
            <Text className="stat-label">总曝光</Text>
          </View>
        </View>
      </View>

      {/* 类型筛选 */}
      <View className="type-filter">
        <ScrollView className="type-scroll" scrollX>
          {CONTENT_TYPES.map((type) => {
            const IconComponent = type.icon
            return (
              <View
                key={type.key}
                className={`type-tag ${selectedType === type.key ? 'active' : ''}`}
                onClick={() => setSelectedType(type.key as ContentType)}
              >
                <IconComponent size={16} color={selectedType === type.key ? '#6366F1' : '#64748B'} />
                <Text className="type-tag-text">{type.name}</Text>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {/* 平台筛选 */}
      <View className="platform-filter">
        <ScrollView className="platform-scroll" scrollX>
          <View
            className={`platform-tag ${selectedPlatform === null ? 'active' : ''}`}
            onClick={() => setSelectedPlatform(null)}
          >
            <Text className="platform-tag-text">全平台</Text>
          </View>
          {PLATFORMS.map((platform) => (
            <View
              key={platform.key}
              className={`platform-tag ${selectedPlatform === platform.key ? 'active' : ''}`}
              onClick={() => setSelectedPlatform(
                selectedPlatform === platform.key ? null : platform.key
              )}
              style={selectedPlatform === platform.key ? {
                background: `${platform.color}15`,
                borderColor: platform.color
              } : {}}
            >
              <Text 
                className="platform-tag-text" 
                style={selectedPlatform === platform.key ? { color: platform.color } : {}}
              >
                {platform.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 内容列表 */}
      <ScrollView className="content-list" scrollY>
        {loading ? (
          <View className="loading-state">
            <View className="loading-spinner" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredContents.length === 0 ? (
          <View className="empty-state">
            <FileText size={64} color="#CBD5E1" />
            <Text className="empty-title">暂无生成内容</Text>
            <Text className="empty-desc">开始创作你的第一篇内容吧</Text>
          </View>
        ) : (
          filteredContents.map((content) => {
            const platform = getPlatformInfo(content.platform)
            return (
              <View key={content.id} className="content-card">
                {/* 卡片头部 */}
                <View className="card-header">
                  <View className="platform-badge" style={{
                    background: `${platform.color}15`,
                    borderColor: `${platform.color}30`
                  }}
                  >
                    <Text className="platform-badge-text" style={{ color: platform.color }}>
                      {platform.name}
                    </Text>
                  </View>
                  <View className="type-badge">
                    <Text className="type-badge-text">
                      {content.type === 'text-image' ? '图文' : 
                       content.type === 'image' ? '纯图' : 
                       content.type === 'video' ? '视频' : '纯文'}
                    </Text>
                  </View>
                </View>

                {/* 内容预览 */}
                {content.type === 'image' || content.type === 'video' ? (
                  <View className="media-preview">
                    <Image 
                      className="preview-image" 
                      src={content.thumbnail || 'https://picsum.photos/400/300'} 
                      mode="aspectFill"
                    />
                    {content.type === 'video' && (
                      <View className="video-overlay">
                        <View className="play-button">
                          <Play size={32} color="#fff" />
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="text-preview">
                    <Text className="preview-title">{content.title}</Text>
                    <Text className="preview-content">{content.content}</Text>
                  </View>
                )}

                {/* 标签 */}
                {content.tags.length > 0 && (
                  <View className="tags-row">
                    {content.tags.map((tag, index) => (
                      <View key={index} className="tag-item">
                        <Text className="tag-text">#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 数据统计 */}
                <View className="stats-row">
                  <View className="stat-item">
                    <Eye size={14} color="#94A3B8" />
                    <Text className="stat-text">{formatNumber(content.stats.views)}</Text>
                  </View>
                  <View className="stat-item">
                    <Heart size={14} color="#94A3B8" />
                    <Text className="stat-text">{formatNumber(content.stats.likes)}</Text>
                  </View>
                  <View className="stat-item">
                    <MessageCircle size={14} color="#94A3B8" />
                    <Text className="stat-text">{formatNumber(content.stats.comments)}</Text>
                  </View>
                  <View className="stat-item">
                    <Share2 size={14} color="#94A3B8" />
                    <Text className="stat-text">{formatNumber(content.stats.shares)}</Text>
                  </View>
                </View>

                {/* 底部信息 */}
                <View className="card-footer">
                  <View className="date-info">
                    <Calendar size={12} color="#94A3B8" />
                    <Text className="date-text">{content.created_at}</Text>
                  </View>
                  <View className="action-buttons">
                    {content.content && (
                      <View 
                        className="action-btn"
                        onClick={() => handleCopy(content)}
                      >
                        {copiedId === content.id ? (
                          <Check size={16} color="#10B981" />
                        ) : (
                          <Copy size={16} color="#64748B" />
                        )}
                      </View>
                    )}
                    <View className="action-btn">
                      <Ellipsis size={16} color="#64748B" />
                    </View>
                  </View>
                </View>
              </View>
            )
          })
        )}

        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
