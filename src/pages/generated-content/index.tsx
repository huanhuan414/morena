import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import * as Network from '@/network'
import { Calendar, Eye, ChevronDown, ArrowLeft, RefreshCw, Image as ImageIcon } from 'lucide-react-taro'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import './index.css'

// 内容状态
type ContentStatus = 'all' | 'processing' | 'completed' | 'failed'

// 内容数据接口
interface GeneratedContent {
  id: string
  orderId: string
  orderTitle: string
  content: string
  images: string[]
  platform: string
  status: string
  generationDetail?: string
  avatarId: string
  avatarName: string
  contentType: string
  createdAt: string
}

// 内容状态配置
const CONTENT_STATUSES: { key: ContentStatus; name: string }[] = [
  { key: 'all', name: '全部' },
  { key: 'processing', name: '生成中' },
  { key: 'completed', name: '已完成' },
  { key: 'failed', name: '失败' },
]

// 状态样式
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  processing: { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', label: '生成中' },
  generating_text: { bg: 'rgba(139,92,246,0.1)', color: '#8B5CF6', label: '文案生成中' },
  generating_images: { bg: 'rgba(236,72,153,0.1)', color: '#EC4899', label: '配图生成中' },
  completed: { bg: 'rgba(34,197,94,0.1)', color: '#22C55E', label: '已完成' },
  failed: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', label: '生成失败' },
  pending: { bg: 'rgba(156,163,175,0.1)', color: '#9CA3AF', label: '等待中' },
}

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat: '微信朋友圈',
  wechat_mp: '微信公众号',
  wechat_channel: '微信视频号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  toutiao: '今日头条',
  zhihu: '知乎',
  general: '通用',
}

function safeParseJSON(str: any): any {
  if (!str) return []
  if (Array.isArray(str)) return str
  if (typeof str === 'string') {
    try { return JSON.parse(str) } catch { return [] }
  }
  return []
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

export default function GeneratedContentPage() {
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [avatars, setAvatars] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContentStatus>('all')
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('all')
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false)

  useEffect(() => {
    loadContents()
  }, [])

  const loadContents = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/user-stats/contents' })
      console.log('[已生成内容] API响应:', res.data)
      const data = res.data?.data || {}
      const rawContents = data.contents || []
      const rawAvatars = data.avatars || []

      setAvatars(rawAvatars.map((a: any) => ({ id: a.id, name: a.name })))

      const parsed = rawContents.map((c: any) => ({
        id: c.id || '',
        orderId: c.orderId || c.order_id || '',
        orderTitle: c.orderTitle || c.order_title || c.title || '未命名内容',
        content: c.content || '',
        images: safeParseJSON(c.images),
        platform: c.platform || c.platforms || 'general',
        status: c.status || 'pending',
        generationDetail: c.generationDetail || c.generation_detail || '',
        avatarId: c.avatarId || c.avatar_id || '',
        avatarName: c.avatarName || c.avatar_name || '',
        contentType: c.contentType || c.content_type || 'image_text',
        createdAt: c.createdAt || c.created_at || '',
      }))

      console.log('[已生成内容] 解析后:', parsed.length, '条')
      setContents(parsed)
    } catch (err) {
      console.error('[已生成内容] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 筛选
  const filteredContents = contents.filter(c => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'processing') {
        if (c.status !== 'processing' && c.status !== 'generating_text' && c.status !== 'generating_images' && c.status !== 'pending') return false
      } else if (c.status !== statusFilter) {
        return false
      }
    }
    if (selectedAvatarId !== 'all' && c.avatarId !== selectedAvatarId) return false
    return true
  })

  const getStatusInfo = (status: string) => STATUS_STYLE[status] || STATUS_STYLE.pending

  const selectedAvatarName = selectedAvatarId === 'all'
    ? '全部分身'
    : avatars.find(a => a.id === selectedAvatarId)?.name || '未知分身'

  const handlePreviewImage = (urls: string[], index: number) => {
    Taro.previewImage({ urls, current: urls[index] })
  }

  return (
    <View className="generated-content-page">
      {/* 顶部导航 */}
      <View className="page-header">
        <View className="header-left" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#fff" />
        </View>
        <Text className="header-title">已生成内容</Text>
        <View className="header-right" onClick={loadContents}>
          <RefreshCw size={18} color="#fff" />
        </View>
      </View>

      {/* 状态筛选 Tab */}
      <View className="status-tabs">
        {CONTENT_STATUSES.map(s => (
          <View
            key={s.key}
            className={`status-tab ${statusFilter === s.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(s.key)}
          >
            <Text className="status-tab-text">{s.name}</Text>
          </View>
        ))}
      </View>

      {/* 分身筛选 - 下拉选择器 */}
      <View className="avatar-filter">
        <View className="avatar-dropdown-trigger" onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}>
          <Text className="avatar-dropdown-text">{selectedAvatarName}</Text>
          <ChevronDown
            size={16}
            color="#6366F1"
            style={{ transform: showAvatarDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </View>
        {showAvatarDropdown && (
          <View className="avatar-dropdown-menu">
            <View
              className={`avatar-dropdown-item ${selectedAvatarId === 'all' ? 'active' : ''}`}
              onClick={() => { setSelectedAvatarId('all'); setShowAvatarDropdown(false) }}
            >
              <Text className="avatar-dropdown-item-text">全部分身</Text>
            </View>
            {avatars.map(a => (
              <View
                key={a.id}
                className={`avatar-dropdown-item ${selectedAvatarId === a.id ? 'active' : ''}`}
                onClick={() => { setSelectedAvatarId(a.id); setShowAvatarDropdown(false) }}
              >
                <Text className="avatar-dropdown-item-text">{a.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 内容列表 */}
      <ScrollView scrollY className="content-list">
        {loading ? (
          <View className="loading-state">
            <View className="spinning-icon" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredContents.length === 0 ? (
          <View className="empty-state">
            <ImageIcon size={48} color="#CBD5E1" />
            <Text className="empty-title">暂无生成内容</Text>
            <Text className="empty-desc">接单后内容会自动生成</Text>
          </View>
        ) : (
          filteredContents.map(item => {
            const statusInfo = getStatusInfo(item.status)
            const platformName = PLATFORM_NAMES[item.platform] || item.platform
            const isArticle = item.content && item.content.length > 200

            return (
              <View key={item.id} className="content-card">
                {/* 卡片头部 */}
                <View className="card-header">
                  <View className="card-header-left">
                    {item.avatarName && (
                      <View className="avatar-badge">
                        <View className="avatar-dot" />
                        <Text className="avatar-badge-text">{item.avatarName}</Text>
                      </View>
                    )}
                    <View className="platform-badge" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                      <Text className="platform-badge-text">{platformName}</Text>
                    </View>
                  </View>
                  <View className="status-badge" style={{ backgroundColor: statusInfo.bg }}>
                    <Text className="status-badge-text" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
                  </View>
                </View>

                {/* 订单标题 */}
                <Text className="card-order-title">{item.orderTitle}</Text>

                {/* 生成中状态提示 */}
                {(item.status === 'processing' || item.status === 'generating_text' || item.status === 'generating_images') && (
                  <View className="generating-hint">
                    <View className="mini-spinner" />
                    <Text className="generating-hint-text">
                      {item.status === 'generating_text' ? '正在生成文案...' :
                       item.status === 'generating_images' ? '正在生成配图...' :
                       '正在生成内容...'}
                    </Text>
                  </View>
                )}

                {/* 内容预览 - 图文文章型 */}
                {isArticle && item.status === 'completed' && (
                  <View className="article-preview">
                    <MarkdownRenderer content={item.content.substring(0, 500)} />
                    {item.content.length > 500 && (
                      <View
                        className="read-more-btn"
                        onClick={() => Taro.navigateTo({ url: `/pages/order/order-publish-guide/index?contentId=${item.id}` })}
                      >
                        <Text className="read-more-text">阅读全文</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 内容预览 - 短文案型 */}
                {!isArticle && item.content && item.status === 'completed' && (
                  <View className="short-text-preview">
                    <Text className="short-text-content">{item.content}</Text>
                  </View>
                )}

                {/* 图片预览 */}
                {item.images.length > 0 && item.status === 'completed' && (
                  <View className="images-grid">
                    {item.images.map((img, idx) => (
                      <View key={idx} className="image-item" onClick={() => handlePreviewImage(item.images, idx)}>
                        <Image src={img} mode="aspectFill" className="image-thumb" />
                      </View>
                    ))}
                  </View>
                )}

                {/* 底部信息 */}
                <View className="card-footer">
                  <View className="footer-left">
                    <Calendar size={12} color="#94A3B8" />
                    <Text className="footer-date">{formatDate(item.createdAt)}</Text>
                  </View>
                  <View className="footer-right">
                    <Eye size={14} color="#94A3B8" />
                    <Text className="footer-views">已生成</Text>
                  </View>
                </View>
              </View>
            )
          })
        )}

        <View style={{ height: '40px' }} />
      </ScrollView>
    </View>
  )
}
