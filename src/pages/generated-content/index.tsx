import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { ChevronDown, RefreshCw, Play, FileText, ImagePlus } from 'lucide-react-taro'
import './index.css'

// 内容状态映射 - 与订单状态对应
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待发布', color: '#F59E0B', bg: '#FEF3C7' },
  processing: { label: '生成中', color: '#3B82F6', bg: '#DBEAFE' },
  generating_text: { label: '文案生成中', color: '#3B82F6', bg: '#DBEAFE' },
  generating_images: { label: '配图生成中', color: '#3B82F6', bg: '#DBEAFE' },
  completed: { label: '待发布', color: '#F59E0B', bg: '#FEF3C7' },
  published: { label: '待反馈', color: '#8B5CF6', bg: '#EDE9FE' },
  pending_review: { label: '待验收', color: '#F97316', bg: '#FFF7ED' },
  accepted: { label: '已完成', color: '#10B981', bg: '#D1FAE5' },
  failed: { label: '生成失败', color: '#EF4444', bg: '#FEE2E2' },
}

// 内容类型映射
const CONTENT_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  image_text: { label: '文案+配图', icon: 'image' },
  article: { label: '图文文章', icon: 'article' },
  video_text: { label: '文案+视频', icon: 'video' },
}

// 平台名称映射
const PLATFORM_MAP: Record<string, string> = {
  wechat: '朋友圈', wechat_mp: '微信公众号', wechat_channel: '视频号',
  xiaohongshu: '小红书', douyin: '抖音', tiktok: 'TikTok',
  bilibili: 'B站', weibo: '微博', zhihu: '知乎',
  toutiao: '今日头条', kuaishou: '快手',
}

// 状态 Tab
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'completed', label: '待发布' },
  { key: 'published', label: '待反馈' },
  { key: 'pending_review', label: '待验收' },
  { key: 'accepted', label: '已完成' },
  { key: 'failed', label: '生成失败' },
]

// 安全 JSON 解析
function safeParseJSON(val: any, fallback: any = []) {
  if (!val) return fallback
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : p } catch { return fallback }
  }
  return fallback
}

// 获取内容类型
function getContentType(item: any): string {
  const ct = item.contentType || item.content_type || ''
  if (ct === 'article' || ct === 'image_text_article') return 'article'
  if (ct === 'video_text' || ct === 'video') return 'video_text'
  return 'image_text'
}

// 获取封面
function getCoverImage(item: any): string {
  const images = safeParseJSON(item.images, [])
  if (Array.isArray(images) && images.length > 0) {
    if (typeof images[0] === 'string') return images[0]
    if (images[0]?.url) return images[0].url
  }
  return ''
}

// 获取平台列表
function getPlatforms(item: any): string[] {
  const p = item.platforms || item.platform
  if (Array.isArray(p)) return p
  if (typeof p === 'string') {
    try { const parsed = JSON.parse(p); return Array.isArray(parsed) ? parsed : [p] } catch { return [p] }
  }
  return []
}

export default function GeneratedContent() {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedAvatarId, setSelectedAvatarId] = useState('all')
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false)
  const [avatars, setAvatars] = useState<Array<{ id: string; name: string }>>([])
  const [contents, setContents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContents()
  }, [])

  const loadContents = async () => {
    try {
      setLoading(true)
      const userId = Taro.getStorageSync('userInfo')?.data?.id
      if (!userId || userId === 'guest-user-id') return

      const res = await Network.request({ url: '/api/user-stats/contents' })
      console.log('[已生成内容] API响应:', res.data)
      const data = res.data?.data || {}

      const rawAvatars = data.avatars || []
      const avatarList = rawAvatars.map((a: any) => ({ id: a.id, name: a.name || '未命名分身' }))
      setAvatars(avatarList)

      const rawContents = data.contents || []
      const parsed = rawContents.map((c: any) => ({
        ...c,
        images: safeParseJSON(c.images, []),
        platforms: getPlatforms(c),
        contentType: getContentType(c),
        coverImage: getCoverImage(c),
        videoUrl: c.videoUrl || c.video_url || '',
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
  const filtered = contents.filter((item) => {
    if (activeTab !== 'all') {
      if (activeTab === 'completed' && item.status !== 'completed' && item.status !== 'pending') return false
      if (activeTab === 'published' && item.status !== 'published') return false
      if (activeTab === 'pending_review' && item.status !== 'pending_review') return false
      if (activeTab === 'accepted' && item.status !== 'accepted') return false
      if (activeTab === 'failed' && item.status !== 'failed') return false
    }
    if (selectedAvatarId !== 'all' && item.avatarId !== selectedAvatarId && item.avatar_id !== selectedAvatarId) return false
    return true
  })

  const selectedAvatarName = selectedAvatarId === 'all' ? '全部分身' : avatars.find(a => a.id === selectedAvatarId)?.name || '全部分身'

  // 点击卡片跳转详情
  const handleCardClick = (item: any) => {
    const orderId = item.orderId || item.order_id
    if (orderId) {
      Taro.navigateTo({ url: `/pages/order/order-content-creation/index?orderId=${orderId}` })
    }
  }

  const renderContentTypeIcon = (type: string) => {
    if (type === 'article') return <FileText size={14} color="#8B5CF6" />
    if (type === 'video_text') return <Play size={14} color="#8B5CF6" />
    return <ImagePlus size={14} color="#8B5CF6" />
  }

  const renderContentCard = (item: any, index: number) => {
    const status = STATUS_MAP[item.status] || STATUS_MAP.pending
    const contentType = CONTENT_TYPE_MAP[item.contentType] || CONTENT_TYPE_MAP.image_text
    const platformNames = item.platforms.map((p: string) => PLATFORM_MAP[p] || p)
    const avatarName = item.avatarName || item.avatar_name || ''
    const coverUrl = item.coverImage
    const isArticle = item.contentType === 'article'
    const isVideo = item.contentType === 'video_text'
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const contentText = item.content || ''
    const contentPreview = contentText.length > 80 ? contentText.substring(0, 80) + '...' : contentText
    const createdTime = item.createdAt || item.created_at || ''

    return (
      <View key={item.id || index} className="content-card" onClick={() => handleCardClick(item)}>
        {/* 状态标签 + 类型标签 */}
        <View className="card-header-row">
          <View className="status-tag" style={{ color: status.color, backgroundColor: status.bg }}>
            {status.label}
          </View>
          <View className="type-tag">
            {renderContentTypeIcon(item.contentType)}
            <Text className="type-tag-text">{contentType.label}</Text>
          </View>
        </View>

        {/* 封面 + 信息 */}
        <View className="card-body">
          {/* 左侧封面 */}
          {coverUrl ? (
            <View className="card-cover">
              <Image src={coverUrl} mode="aspectFill" className="cover-image" />
              {isVideo && (
                <View className="video-play-icon">
                  <Play size={20} color="#fff" />
                </View>
              )}
              {!isArticle && !isVideo && imageCount > 1 && (
                <View className="image-count-badge">
                  <Text className="image-count-text">{imageCount}张</Text>
                </View>
              )}
            </View>
          ) : (
            <View className="card-cover-placeholder">
              {isArticle ? <FileText size={24} color="#8B5CF6" /> :
               isVideo ? <Play size={24} color="#8B5CF6" /> :
               <ImagePlus size={24} color="#8B5CF6" />}
            </View>
          )}

          {/* 右侧信息 */}
          <View className="card-info">
            <Text className="card-title">{item.orderTitle || item.title || '未命名内容'}</Text>
            <Text className="card-preview">{contentPreview}</Text>
            <View className="card-meta">
              {platformNames.length > 0 && (
                <View className="platform-tag">
                  <Text className="platform-text">{platformNames[0]}</Text>
                </View>
              )}
              {avatarName && (
                <Text className="avatar-label">{avatarName}</Text>
              )}
            </View>
          </View>
        </View>

        {/* 底部时间 + 操作提示 */}
        <View className="card-footer">
          <Text className="card-time">{createdTime ? new Date(createdTime).toLocaleDateString('zh-CN') : ''}</Text>
          <Text className="card-action-hint">查看详情 ›</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="page-container">
      {/* 顶部渐变头部 */}
      <View className="page-header">
        <Text className="header-title">已生成内容</Text>
        <Text className="header-subtitle">共 {filtered.length} 条内容</Text>
      </View>

      {/* 状态筛选 Tab */}
      <View className="tab-bar">
        <ScrollView scrollX className="tab-scroll">
          {STATUS_TABS.map(tab => (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className={`tab-text ${activeTab === tab.key ? 'active' : ''}`}>{tab.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 分身筛选下拉 */}
      <View className="avatar-filter">
        <View className="avatar-dropdown-trigger" onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}>
          <Text className="avatar-filter-text">{selectedAvatarName}</Text>
          <ChevronDown size={16} color="#64748B" className={showAvatarDropdown ? 'dropdown-icon-open' : ''} />
        </View>
        {showAvatarDropdown && (
          <View className="avatar-dropdown-menu">
            <View
              className={`avatar-dropdown-item ${selectedAvatarId === 'all' ? 'selected' : ''}`}
              onClick={() => { setSelectedAvatarId('all'); setShowAvatarDropdown(false) }}
            >
              <Text className="avatar-dropdown-text">全部分身</Text>
            </View>
            {avatars.map(a => (
              <View
                key={a.id}
                className={`avatar-dropdown-item ${selectedAvatarId === a.id ? 'selected' : ''}`}
                onClick={() => { setSelectedAvatarId(a.id); setShowAvatarDropdown(false) }}
              >
                <Text className="avatar-dropdown-text">{a.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 内容列表 */}
      <ScrollView scrollY className="content-list">
        {loading ? (
          <View className="empty-state">
            <RefreshCw size={32} color="#8B5CF6" className="spin-icon" />
            <Text className="empty-text">加载中...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="empty-state">
            <ImagePlus size={48} color="#CBD5E1" />
            <Text className="empty-text">暂无内容</Text>
            <Text className="empty-hint">生成的内容将在这里展示</Text>
          </View>
        ) : (
          filtered.map((item, i) => renderContentCard(item, i))
        )}
      </ScrollView>
    </View>
  )
}
