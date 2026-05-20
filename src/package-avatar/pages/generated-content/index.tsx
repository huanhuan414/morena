import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { ArrowLeft, Clock, FileText, ImagePlus, Play, Eye, Send, MessageSquare, Bell, Trash2, RefreshCw } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { canonicalizePlatform, getPlatformLabel, getPlatformMeta } from '@/constants/publish-platform'
import './index.css'

// 内容状态映射
// 后端原始状态 → 前端展示状态
const BACKEND_STATUS_TO_TAB: Record<string, string> = {
  queuing: 'generating',
  pending: 'generating',
  processing: 'generating',
  generating: 'generating',
  generating_text: 'generating',
  generating_images: 'generating',
  generating_video: 'generating',
  preview: 'preview',
  completed: 'preview',
  revision_requested: 'preview',
  publishing: 'published',
  published: 'published',
  feedback_submitted: 'awaiting_acceptance',
  reviewing: 'awaiting_acceptance',
  awaiting_acceptance: 'awaiting_acceptance',
  settled: 'completed',
  done: 'completed',
  failed: 'failed',
}

// 生成中的子阶段文案映射（用于进度提示）
const GENERATING_PHASE: Record<string, string> = {
  queuing: '排队等待中...',
  pending: '准备生成...',
  processing: '正在处理...',
  generating: '内容生成中...',
  generating_text: '文案生成中...',
  generating_images: '配图生成中...',
  generating_video: '视频生成中（约1-3分钟）...',
}

const CONTENT_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  generating: { label: '生成中', color: '#6366F1', bgColor: '#EEF2FF' },
  preview: { label: '待发布', color: '#F59E0B', bgColor: '#FEF3C7' },
  published: { label: '待反馈', color: '#3B82F6', bgColor: '#DBEAFE' },
  awaiting_acceptance: { label: '待验收', color: '#8B5CF6', bgColor: '#EDE9FE' },
  completed: { label: '已完成', color: '#10B981', bgColor: '#D1FAE5' },
  failed: { label: '生成失败', color: '#EF4444', bgColor: '#FEE2E2' },
}

// Tab 状态筛选
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'generating', label: '生成中' },
  { key: 'preview', label: '待发布' },
  { key: 'published', label: '待反馈' },
  { key: 'awaiting_acceptance', label: '待验收' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '生成失败' },
]

// 安全解析 JSON
function safeParseJSON(val: any): any[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { const r = JSON.parse(val); return Array.isArray(r) ? r : [] }
    catch { return [] }
  }
  return []
}

// 内容类型图标和名称
function getContentTypeInfo(type: string): { icon: any; name: string } {
  switch (type) {
    case 'text': return { icon: FileText, name: '图文文章' }
    case 'video_text': case 'video_script': case 'video': return { icon: Play, name: '视频' }
    default: return { icon: ImagePlus, name: '文案+配图' }
  }
}

export default function GeneratedContentPage() {
  const [contents, setContents] = useState<any[]>([])
  const [avatars, setAvatars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false)

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/user-stats/contents' })
      console.log('[已生成内容] API响应:', res.data?.code, 'avatars:', res.data?.data?.avatars?.length, 'contents:', res.data?.data?.contents?.length)
      if (res.data?.code === 200) {
        const rawAvatars = res.data.data.avatars || []
        const rawContents = res.data.data.contents || []

        const parsedAvatars = rawAvatars.map((a: any) => ({
          id: a.id,
          name: a.name || '未命名',
          avatarUrl: a.avatar_url || a.avatarUrl || '',
        }))

        const parsedContents = rawContents.map((c: any) => {
          const platforms = safeParseJSON(c.platforms)
          return {
            ...c,
            // 确保关键字段存在（兼容 camelCase 和 snake_case）
            id: c.id,
            orderId: c.orderId || c.order_id || '',
            avatarId: c.avatarId || c.avatar_id || '',
            avatarName: c.avatarName || c.avatar_name || '我的分身',
            avatarUrl: c.avatarUrl || c.avatar_url || '',
            images: Array.isArray(c.images) ? c.images.filter((img: string) => typeof img === 'string' && img.startsWith('http')) : [],
            platforms,
            tags: safeParseJSON(c.tags),
            platform: canonicalizePlatform(c.platform || platforms[0] || ''),
            contentType: c.contentType || c.content_type || 'image_text',
            status: c.status,
            createdAt: c.createdAt || c.created_at || '',
          }
        })

        setAvatars(parsedAvatars)
        setContents(parsedContents)
        console.log('[已生成内容] 解析后: avatars=', parsedAvatars.length, 'contents=', parsedContents.length)

        // 对图片为空的记录异步加载（列表API可能未返回images，或base64尚未迁移）
        const needLoadImages = parsedContents.filter((c: any) => !Array.isArray(c.images) || c.images.length === 0)
        if (needLoadImages.length > 0) {
          loadImagesForContents(needLoadImages)
        }
      }
    } catch (err) {
      console.error('[已生成内容] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 异步加载图片：逐条请求，避免一次性传输大量数据
  const loadImagesForContents = async (contentList: any[]) => {
    for (const item of contentList) {
      if (!item.id) continue
      try {
        const res = await Network.request({ url: `/api/content-generation/content-images/${item.id}` })
        const images = res?.data?.data?.images
        if (Array.isArray(images) && images.length > 0) {
          setContents(prev => prev.map(c => c.id === item.id ? { ...c, images } : c))
        }
      } catch {
        // 图片加载失败不影响页面
      }
    }
  }

  // 筛选
  const filteredContents = contents.filter(c => {
    const tabKey = BACKEND_STATUS_TO_TAB[c.status] || c.status
    const statusMatch = activeTab === 'all' || tabKey === activeTab
    const avatarMatch = !selectedAvatarId || c.avatarId === selectedAvatarId
    return statusMatch && avatarMatch
  })

  const getStatusInfo = (status: string) => {
    const tabKey = BACKEND_STATUS_TO_TAB[status] || status
    return CONTENT_STATUS_MAP[tabKey] || CONTENT_STATUS_MAP[status] || { label: status, color: '#64748B', bgColor: '#F1F5F9' }
  }
  const getPlatformInfo = (key: string) => {
    const meta = getPlatformMeta(key)
    return {
      name: getPlatformLabel(key),
      color: meta?.color || '#64748B'
    }
  }

  const selectedAvatarName = selectedAvatarId
    ? avatars.find(a => a.id === selectedAvatarId)?.name || '未知分身'
    : '全部分身'

  // 查看内容详情
  const handleView = (content: any) => {
    const query = `orderId=${encodeURIComponent(content.orderId || '')}&requestId=${encodeURIComponent(content.id || '')}`
    Taro.navigateTo({ url: `/package-order/pages/order-content-creation/index?${query}` })

    // if (normalizedStatus === 'generating') {
    //   const query = `orderId=${encodeURIComponent(content.orderId || '')}&requestId=${encodeURIComponent(content.id || '')}`
    //   Taro.navigateTo({ url: `/package-order/pages/order-content-creation/index?${query}` })
    // } else if (normalizedStatus === 'awaiting_acceptance') {
    //   const query = [
    //     `contentId=${encodeURIComponent(content.id || '')}`,
    //     `orderId=${encodeURIComponent(content.orderId || '')}`,
    //     `readonly=true`,
    //   ].filter(Boolean).join('&')
    //   Taro.navigateTo({ url: `/package-order/pages/order-publish-guide/index?${query}` })
    // } else {
    //   const query = [
    //     `contentId=${encodeURIComponent(content.id || '')}`,
    //     `orderId=${encodeURIComponent(content.orderId || '')}`,
    //   ].filter(Boolean).join('&')
    //   Taro.navigateTo({ url: `/package-order/pages/order-publish-guide/index?${query}` })
    // }
  }

  // 发布
  const handlePublish = (content: any) => {
    Taro.navigateTo({ url: `/package-order/pages/order-publish-guide/index?contentId=${encodeURIComponent(content.id)}` })
  }

  // 重新生成
  const handleRegenerate = (content: any) => {
    Taro.navigateTo({ url: `/package-order/pages/order-content-creation/index?orderId=${content.orderId}` })
  }

  // 删除
  const handleDelete = (content: any) => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条内容吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/content-generation/content/${content.id}`,
              method: 'DELETE',
            })
            Taro.showToast({ title: '已删除', icon: 'success' })
            loadData()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      },
    })
  }

  // 催验收
  const handleUrgeReview = async (content: any) => {
    try {
      const res = await Network.request({
        url: '/api/notifications/urge-review',
        method: 'POST',
        data: { orderId: content.orderId, contentTitle: content.content?.substring(0, 20) || '' }
      })
      if (res?.data?.code === 200) {
        Taro.showToast({ title: '催验收提醒已发送', icon: 'success' })
      } else {
        Taro.showToast({ title: res?.data?.message || '发送失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' })
    }
  }

  // 反馈
  const handleFeedback = (content: any) => {
    Taro.navigateTo({ url: `/package-order/pages/order-publish-feedback/index?requestId=${encodeURIComponent(content.id)}&orderId=${encodeURIComponent(content.orderId || '')}` })
  }

  // 获取卡片底部按钮配置
  const getCardActions = (rawStatus: string, contentType?: string) => {
    const status = BACKEND_STATUS_TO_TAB[rawStatus] || rawStatus
    const isVideo = ['video_text', 'video_script', 'video'].includes(contentType || '')
    switch (status) {
      case 'preview':
        return [
          { key: 'publish', label: '发布', icon: Send, type: 'primary' },
          { key: 'view', label: '查看详情', icon: Eye, type: 'default' },
        ]
      case 'published':
        return [
          { key: 'feedback', label: '反馈', icon: MessageSquare, type: 'primary' },
          { key: 'view', label: '查看详情', icon: Eye, type: 'default' },
        ]
      case 'awaiting_acceptance':
        return [
          { key: 'urge', label: '催验收', icon: Bell, type: 'primary' },
          { key: 'view', label: '查看详情', icon: Eye, type: 'default' },
        ]
      case 'generating':
        return [
          { key: 'view', label: isVideo ? '查看生成进度' : '查看进度', icon: Eye, type: 'default' },
        ]
      case 'completed':
        return [
          { key: 'view', label: '查看详情', icon: Eye, type: 'default' },
        ]
      case 'failed':
        return [
          { key: 'delete', label: '删除', icon: Trash2, type: 'danger' },
          { key: 'regenerate', label: '重新生成', icon: RefreshCw, type: 'primary' },
        ]
      default:
        return [{ key: 'view', label: '查看详情', icon: Eye, type: 'default' }]
    }
  }

  const playVideo = (url: string) => {
    console.log('[generated-content] playVideo url:', url)
    Taro.previewMedia({
      sources: [{ url, type: 'video' }],
      current: 0,
    }).catch(() => {
      Taro.setClipboardData({ data: url })
      Taro.showToast({ title: '视频链接已复制，请在浏览器中打开', icon: 'none' })
    })
  }

  const handleAction = (actionKey: string, content: any) => {
    switch (actionKey) {
      case 'publish': handlePublish(content); break
      case 'view': handleView(content); break
      case 'feedback': handleFeedback(content); break
      case 'urge': handleUrgeReview(content); break
      case 'delete': handleDelete(content); break
      case 'regenerate': handleRegenerate(content); break
    }
  }

  return (
    <View className="generated-content-page">
      {/* 顶部蓝色背景 */}
      <View className="generated-page-header" style={{ paddingTop: `${getStatusBarHeight() + 12}px` }}>
        <View className="header-decoration">
          <View className="decoration-circle circle-1" />
          <View className="decoration-circle circle-2" />
        </View>
        <View className="header-title-row">
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="header-title-area">
            <Text className="header-title">已生成内容</Text>
            <Text className="header-subtitle">AI 智能创作 · 一键发布</Text>
          </View>
          <View style={{ width: '64rpx' }} />
        </View>
      </View>

      {/* 状态 Tab 筛选 */}
      <View className="tab-filter">
        <ScrollView className="tab-scroll" scrollX>
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

      {/* 分身筛选（下拉） */}
      {avatars.length > 0 && (
        <View className="avatar-filter">
          <View
            className="avatar-selector"
            onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
          >
            <Text className="avatar-selector-text">{selectedAvatarName}</Text>
            <View className="avatar-selector-arrow" style={{ transform: avatarDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <Text className="arrow-icon">▼</Text>
            </View>
          </View>
          {avatarDropdownOpen && (
            <View className="avatar-dropdown">
              <View className="avatar-dropdown-mask" onClick={() => setAvatarDropdownOpen(false)} />
              <View className="avatar-dropdown-list">
                <View
                  className={`avatar-dropdown-item ${!selectedAvatarId ? 'active' : ''}`}
                  onClick={() => { setSelectedAvatarId(null); setAvatarDropdownOpen(false) }}
                >
                  <Text className="avatar-dropdown-text">全部分身</Text>
                </View>
                {avatars.map(a => (
                  <View
                    key={a.id}
                    className={`avatar-dropdown-item ${selectedAvatarId === a.id ? 'active' : ''}`}
                    onClick={() => { setSelectedAvatarId(a.id); setAvatarDropdownOpen(false) }}
                  >
                    <View className="dropdown-avatar-dot" style={{ backgroundColor: '#6366F1' }}>
                      <Text style={{ fontSize: 10, color: '#fff' }}>{a.name.charAt(0)}</Text>
                    </View>
                    <Text className="avatar-dropdown-text">{a.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

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
            <Text className="empty-title">暂无内容</Text>
            <Text className="empty-desc">{activeTab === 'all' ? '还没有生成任何内容' : '该状态下暂无内容'}</Text>
          </View>
        ) : (
          filteredContents.map(content => {
            const statusInfo = getStatusInfo(content.status)
            const typeInfo = getContentTypeInfo(content.contentType)
            const TypeIcon = typeInfo.icon
            const platformKey = content.platform || (content.platforms?.[0]) || ''
            const platformInfo = getPlatformInfo(platformKey)
            const contentText = content.content || ''
            let videoUrls: string[] = []
            try {
              const rawVideoUrl = content.video_url || content.videoUrl || ''
              videoUrls = Array.isArray(rawVideoUrl) ? rawVideoUrl : (typeof rawVideoUrl === 'string' && rawVideoUrl.trim() ? (rawVideoUrl.startsWith('[') ? JSON.parse(rawVideoUrl) : [rawVideoUrl]) : [])
            } catch { videoUrls = [] }
            const avatarName = content.avatar_name || content.avatarName || '我的分身'
            const actions = getCardActions(content.status, content.contentType)
            const isVideo = ['video', 'video_text'].includes(content.contentType)

            return (
              <View key={content.id} className="content-card">
                {/* 卡片头部：分身+平台+状态 */}
                <View className="card-header">
                  <View className="avatar-tag">
                    <View className="avatar-dot">
                      <Text style={{ fontSize: 10, color: '#fff' }}>{avatarName.charAt(0)}</Text>
                    </View>
                    <Text className="avatar-name">{avatarName}</Text>
                  </View>
                  <View className="header-right">
                    {platformKey && (
                      <View className="platform-badge" style={{ background: `${platformInfo.color}15`, borderColor: `${platformInfo.color}30` }}>
                        <Text className="platform-badge-text" style={{ color: platformInfo.color }}>{platformInfo.name}</Text>
                      </View>
                    )}
                    <View className="status-badge" style={{ backgroundColor: statusInfo.bgColor }}>
                      <Text className="status-badge-text" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
                    </View>
                  </View>
                </View>

                {/* 内容类型标签 */}
                <View className="type-tag">
                  <TypeIcon size={12} color="#6366F1" />
                  <Text className="type-tag-text">{typeInfo.name}</Text>
                </View>

                {/* 视频生成中状态提示 */}
                {isVideo && videoUrls.length === 0 && BACKEND_STATUS_TO_TAB[content.status] === 'generating' && (
                  <View className="generating-phase-hint">
                    <View className="generating-spinner" />
                    <Text className="generating-phase-text">{GENERATING_PHASE[content.status] || '内容生成中...'}</Text>
                  </View>
                )}

                {/* 视频内容卡片：只显示视频封面+简要文案 */}
                {isVideo ? (
                  <View>
                    {contentText && (
                      <Text className="content-preview">
                        {contentText.length > 80 ? contentText.substring(0, 80) + '...' : contentText}
                      </Text>
                    )}
                    {videoUrls.length > 0 && (
                      <View className="card-video-list">
                        {videoUrls.map((url: string, idx: number) => (
                          <View key={idx} className="gc-video-cover-card" onClick={() => playVideo(url)}>
                            <View className="gc-video-cover-bg">
                              <View className="gc-video-play-btn">
                                <Play size={32} color="#fff" style={{ marginLeft: 4 }} />
                              </View>
                              <View className="gc-video-cover-label">
                                <Text className="gc-video-cover-text">点击播放视频</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View>
                    {/* 图文内容卡片：显示文案+图片缩略图（图片异步加载） */}
                    <Text className="content-preview">
                      {contentText.length > 120 ? contentText.substring(0, 120) + '...' : contentText}
                    </Text>
                    {Array.isArray(content.images) && content.images.length > 0 ? (
                      <View className="image-preview-row">
                        {content.images.slice(0, 3).map((img: string, idx: number) => (
                          <Image
                            key={idx}
                            src={img}
                            className="image-thumb"
                            mode="aspectFill"
                            onClick={() => Taro.previewImage({ current: img, urls: content.images })}
                          />
                        ))}
                        {content.images.length > 3 && (
                          <View className="more-images">
                            <ImagePlus size={12} color="#64748B" />
                            <Text style={{ fontSize: 12, color: '#64748B', marginLeft: 4 }}>+{content.images.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    ) : content.imageCount > 0 ? (
                      <View className="image-preview-row">
                        <View className="more-images">
                          <ImagePlus size={12} color="#64748B" />
                          <Text style={{ fontSize: 12, color: '#64748B', marginLeft: 4 }}>{content.imageCount}张配图</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* 底部信息+操作按钮 */}
                <View className="card-footer">
                  <View className="footer-left">
                    <Clock size={12} color="#94A3B8" />
                    <Text className="footer-time">{content.createdAt ? new Date(content.createdAt).toLocaleDateString() : ''}</Text>
                  </View>
                  <View className="footer-actions">
                    {actions.map(action => {
                      const ActionIcon = action.icon
                      return (
                        <View
                          key={action.key}
                          className={`action-btn ${action.type}`}
                          onClick={() => handleAction(action.key, content)}
                        >
                          <ActionIcon size={12} color={action.type === 'primary' ? '#fff' : action.type === 'danger' ? '#EF4444' : '#64748B'} />
                          <Text className={`action-btn-text ${action.type}`}>{action.label}</Text>
                        </View>
                      )
                    })}
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
