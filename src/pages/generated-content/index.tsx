import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import * as Network from '@/network'
import { FileText, Calendar, Eye, Heart, MessageCircle, Share2, PencilLine, Trash2, Play, DollarSign, ChevronDown, ArrowLeft } from 'lucide-react-taro'
import './index.css'

// 内容状态
type ContentStatus = 'all' | 'pending' | 'feedback' | 'review' | 'completed'

// 内容数据接口
interface GeneratedContent {
  id: string
  title: string
  content: string
  type: 'text-image' | 'image' | 'video' | 'text'
  platform: string
  thumbnail?: string
  images?: string[]
  tags: string[]
  stats: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  earnings?: number
  created_at: string
  status: string
}

// 内容状态配置
const CONTENT_STATUSES = [
  { key: 'all', name: '全部' },
  { key: 'pending', name: '待发布' },
  { key: 'feedback', name: '待反馈' },
  { key: 'review', name: '待验收' },
  { key: 'completed', name: '结算完成' },
]

// 状态配置
const STATUS_CONFIG = {
  pending: { label: '待发布', bg: '#FEF3C7', color: '#D97706' },
  feedback: { label: '待反馈', bg: '#DBEAFE', color: '#2563EB' },
  review: { label: '待验收', bg: '#E0E7FF', color: '#6366F1' },
  completed: { label: '结算完成', bg: '#D1FAE5', color: '#059669' },
}

// 平台配置 - 简洁显示
const PLATFORM_CONFIG: Record<string, { name: string; bg: string; color: string }> = {
  xiaohongshu: { name: '小红书', bg: 'rgba(255, 107, 107, 0.12)', color: '#FF6B6B' },
  douyin: { name: '抖音', bg: 'rgba(0, 200, 83, 0.12)', color: '#00C853' },
  wechat_mp: { name: '公众号', bg: 'rgba(25, 118, 210, 0.12)', color: '#1976D2' },
  weibo: { name: '微博', bg: 'rgba(255, 130, 0, 0.12)', color: '#FF8200' },
  bilibili: { name: 'B站', bg: 'rgba(251, 114, 153, 0.12)', color: '#FB7299' },
  kuaishou: { name: '快手', bg: 'rgba(255, 73, 6, 0.12)', color: '#FF4906' },
}

// 模拟数据
const MOCK_CONTENTS: GeneratedContent[] = [
  {
    id: '1',
    title: '春季美妆护肤种草笔记，这个季节一定要入手的好物分享',
    content: '今天给大家分享一款超级好用的护肤精华，使用后皮肤真的变得超级嫩滑！\n\n## 产品功效\n1. 深层补水\n2. 提亮肤色\n3. 收缩毛孔\n\n坚持使用一个月，皮肤状态明显改善，推荐给大家！',
    type: 'text-image',
    platform: 'xiaohongshu',
    thumbnail: 'https://picsum.photos/400/300?random=1',
    images: [
      'https://picsum.photos/400/400?random=11',
      'https://picsum.photos/400/400?random=12',
      'https://picsum.photos/400/400?random=13',
      'https://picsum.photos/400/400?random=14',
      'https://picsum.photos/400/400?random=15',
    ],
    tags: ['护肤', '种草', '好物分享'],
    stats: { views: 12580, likes: 892, comments: 156, shares: 45 },
    earnings: 128.50,
    created_at: '2024-03-10',
    status: 'pending'
  },
  {
    id: '2',
    title: '科技产品开箱测评，这功能也太强了吧',
    content: '',
    type: 'video',
    platform: 'douyin',
    thumbnail: 'https://picsum.photos/400/300?random=2',
    tags: ['数码', '测评', '开箱'],
    stats: { views: 34520, likes: 2100, comments: 320, shares: 180 },
    earnings: 356.00,
    created_at: '2024-03-08',
    status: 'feedback'
  },
  {
    id: '3',
    title: '美食探店推荐，这家店太绝了',
    content: '',
    type: 'image',
    platform: 'xiaohongshu',
    thumbnail: 'https://picsum.photos/400/300?random=3',
    images: [
      'https://picsum.photos/400/400?random=31',
      'https://picsum.photos/400/400?random=32',
      'https://picsum.photos/400/400?random=33',
    ],
    tags: ['美食', '探店', '推荐'],
    stats: { views: 8960, likes: 560, comments: 89, shares: 32 },
    earnings: 89.00,
    created_at: '2024-03-05',
    status: 'review'
  },
  {
    id: '4',
    title: '职场成长干货分享：如何在一年内实现薪资翻倍',
    content: '# 职场晋升的三大关键要素\n\n作为一名在职场摸爬滚打多年的老司机，今天来给大家分享一些真实的职场经验。\n\n## 一、主动承担更多责任\n很多人觉得做好本职工作就够了，但真正能晋升的人，往往是那些主动承担更多工作的人。\n\n## 二、学会有效沟通\n职场中80%的问题都是沟通问题。学会清晰表达自己的想法，同时也要善于倾听他人的意见。\n\n## 三、持续学习投资自己\n不管是读书、上课还是参加行业会议，保持学习的习惯永远是最重要的投资。\n\n---\n**总结**：职场晋升不是一蹴而就的，需要我们在日常工作中不断积累和提升。希望今天的分享对大家有所帮助！',
    type: 'text-image',
    platform: 'wechat_mp',
    thumbnail: 'https://picsum.photos/400/300?random=4',
    tags: ['职场', '成长', '干货'],
    stats: { views: 4520, likes: 320, comments: 67, shares: 28 },
    earnings: 200.00,
    created_at: '2024-03-03',
    status: 'completed'
  },
  {
    id: '5',
    title: '周末穿搭灵感',
    content: '',
    type: 'image',
    platform: 'weibo',
    thumbnail: 'https://picsum.photos/400/300?random=5',
    images: [
      'https://picsum.photos/400/400?random=51',
      'https://picsum.photos/400/400?random=52',
    ],
    tags: ['穿搭', '时尚', '搭配'],
    stats: { views: 15680, likes: 980, comments: 145, shares: 67 },
    earnings: 150.00,
    created_at: '2024-03-01',
    status: 'completed'
  },
  {
    id: '6',
    title: 'B站原创动画制作教程',
    content: '',
    type: 'video',
    platform: 'bilibili',
    thumbnail: 'https://picsum.photos/400/300?random=6',
    tags: ['动画', '教程', '原创'],
    stats: { views: 45200, likes: 3200, comments: 456, shares: 230 },
    earnings: 500.00,
    created_at: '2024-02-28',
    status: 'completed'
  },
]

export default function GeneratedContentPage() {
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<ContentStatus>('all')
  
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 图片预览
  const handlePreview = (current: string, urls: string[]) => {
    Taro.previewImage({
      current,
      urls
    })
  }

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

  // 切换展开/收起
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  // 筛选内容
  const filteredContents = contents.filter(content => {
    const statusMatch = selectedStatus === 'all' || content.status === selectedStatus
    return statusMatch
  })

  // 获取状态信息
  const getStatusInfo = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || { label: status, bg: '#F1F5F9', color: '#64748B' }
  }

  // 获取平台信息
  const getPlatformInfo = (platform: string) => {
    return PLATFORM_CONFIG[platform] || { name: platform, bg: '#F1F5F9', color: '#64748B' }
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

  // 格式化收益
  const formatEarnings = (num: number) => {
    return num.toFixed(2)
  }

  // 复制内容
  const handleEdit = () => {
    Taro.showToast({ title: '编辑内容', icon: 'none' })
  }

  const handleDelete = () => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条内容吗？此操作不可恢复',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }

  // 渲染媒体预览
  const renderMediaPreview = (content: GeneratedContent) => {
    // 多图展示
    if (content.images && content.images.length > 1) {
      return (
        <View className="media-preview">
          <View className="preview-grid">
            {content.images.slice(0, 5).map((img, idx) => (
              <View key={idx} className="grid-item">
                <Image 
                  className="grid-image" 
                  src={img} 
                  mode="aspectFill"
                  onClick={() => handlePreview(img, content.images!)}
                />
                {idx === 4 && content.images!.length > 5 && (
                  <View className="image-count">
                    <Text style={{ fontSize: '20rpx', color: '#fff' }}>+{content.images!.length - 5}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          {content.type === 'video' && (
            <View className="video-overlay">
              <View className="play-button">
                <Play size={32} color="#666" />
              </View>
            </View>
          )}
        </View>
      )
    }

    // 单图展示
    return (
      <View className="media-preview">
        <View className="preview-single">
          <Image 
            className="preview-image" 
            src={content.thumbnail || 'https://picsum.photos/400/300'} 
            mode="aspectFill"
            onClick={() => {
              const urls = content.images?.length ? content.images : [content.thumbnail || 'https://picsum.photos/400/300']
              handlePreview(content.thumbnail || 'https://picsum.photos/400/300', urls as string[])
            }}
          />
          {content.type === 'video' && (
            <View className="video-overlay">
              <View className="play-button">
                <Play size={32} color="#666" />
              </View>
            </View>
          )}
          {content.type === 'image' && content.images?.length === 1 && (
            <View className="image-count">
              <Text style={{ fontSize: '20rpx', color: '#fff' }}>1/1</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  // 简化Markdown显示
  const simplifyMarkdown = (text: string) => {
    return text
      .replace(/#{1,6}\s*/g, '')  // 移除标题符号
      .replace(/\*\*(.+?)\*\*/g, '$1')  // 移除加粗
      .replace(/\*(.+?)\*/g, '$1')  // 移除斜体
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')  // 移除链接
      .replace(/```[\s\S]*?```/g, '')  // 移除代码块
      .replace(/`(.+?)`/g, '$1')  // 移除行内代码
      .replace(/---/g, '')  // 移除分隔线
      .replace(/\n{2,}/g, '\n')  // 合并多余换行
      .trim()
  }

  return (
    <View className="generated-content-page">
      {/* 顶部背景 */}
      <View className="page-header">
        {/* 返回按钮 */}
        <View className="back-btn-area" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#ffffff" />
        </View>
        {/* 页面标题 */}
        <View className="header-title-area">
          <Text className="header-title">生成内容</Text>
          <Text className="header-subtitle">创作变现，让内容产生价值</Text>
        </View>
      </View>

      {/* 内容状态筛选 */}
      <View className="status-filter">
        <ScrollView className="status-scroll" scrollX>
          {CONTENT_STATUSES.map((status) => (
            <View
              key={status.key}
              className={`status-tag ${selectedStatus === status.key ? 'active' : ''}`}
              onClick={() => setSelectedStatus(status.key as ContentStatus)}
            >
              <Text className="status-tag-text">{status.name}</Text>
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
            const statusInfo = getStatusInfo(content.status)
            const platformInfo = getPlatformInfo(content.platform)
            const isExpanded = expandedIds.has(content.id)
            
            return (
              <View key={content.id} className="content-card">
                {/* 卡片头部信息 */}
                <View className="card-top-info">
                  {/* 平台标签 - 简洁显示 */}
                  <View className="platform-badge" style={{ background: platformInfo.bg }}>
                    <Text className="platform-name" style={{ color: platformInfo.color }}>{platformInfo.name}</Text>
                  </View>
                  
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12rpx' }}>
                    {content.earnings !== undefined && (
                      <View className="earnings-badge">
                        <DollarSign size={12} color="#D97706" />
                        <Text className="earnings-text">预估 {formatEarnings(content.earnings)}</Text>
                      </View>
                    )}
                    <View className="status-badge" style={{
                      background: statusInfo.bg,
                      color: statusInfo.color
                  }}>
                      <Text style={{ fontSize: '22rpx', fontWeight: 500 }}>{statusInfo.label}</Text>
                    </View>
                  </View>
                </View>

                {/* 内容预览 */}
                {content.type === 'image' || content.type === 'video' || content.type === 'text-image' ? (
                  <>
                    {renderMediaPreview(content)}
                    
                    {/* 内容标题 */}
                    {content.title && (
                      <View className="content-title-row">
                        <Text className="content-title">{content.title}</Text>
                      </View>
                    )}
                    
                    {/* 文字内容（公众号等） */}
                    {content.content && (
                      <>
                        <View className="text-preview">
                          <Text className={`preview-content ${isExpanded ? 'expanded' : ''}`}>
                            {isExpanded ? content.content : simplifyMarkdown(content.content)}
                          </Text>
                        </View>
                        {content.content.length > 100 && (
                          <View 
                            className={`expand-btn ${isExpanded ? 'active' : ''}`}
                            onClick={() => toggleExpand(content.id)}
                          >
                            <Text style={{ fontSize: '24rpx', color: '#6366F1' }}>
                              {isExpanded ? '收起' : '展开全文'}
                            </Text>
                            <ChevronDown 
                              size={14} 
                              color="#6366F1"
                              style={{ 
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s'
                              }} 
                            />
                          </View>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <View className="text-preview">
                      <Text className={`preview-content ${isExpanded ? 'expanded' : ''}`}>
                        {isExpanded ? content.content : simplifyMarkdown(content.content)}
                      </Text>
                    </View>
                    {content.content.length > 100 && (
                      <View 
                        className={`expand-btn ${isExpanded ? 'active' : ''}`}
                        onClick={() => toggleExpand(content.id)}
                      >
                        <Text style={{ fontSize: '24rpx', color: '#6366F1' }}>
                          {isExpanded ? '收起' : '展开全文'}
                        </Text>
                        <ChevronDown 
                          size={14} 
                          color="#6366F1"
                          style={{ 
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                          }} 
                        />
                      </View>
                    )}
                  </>
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
                    <View 
                      className="action-btn manage-btn"
                      onClick={() => handleEdit()}
                    >
                      <PencilLine size={16} color="#64748B" />
                    </View>
                    <View 
                      className="action-btn manage-btn"
                      onClick={() => handleDelete()}
                    >
                      <Trash2 size={16} color="#64748B" />
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
