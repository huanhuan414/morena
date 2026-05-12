import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image as TaroImage } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Clock, FileText, ImagePlus, Play, Eye, Send, MessageSquare, Bell, Trash2, RefreshCw } from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

// 内容状态映射
const CONTENT_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  completed:    { label: '待发布', color: '#F59E0B', bgColor: '#FEF3C7' },
  published:    { label: '待反馈', color: '#3B82F6', bgColor: '#DBEAFE' },
  reviewing:    { label: '待验收', color: '#8B5CF6', bgColor: '#EDE9FE' },
  settled:      { label: '已完成', color: '#10B981', bgColor: '#D1FAE5' },
  done:         { label: '已完成', color: '#10B981', bgColor: '#D1FAE5' },
  processing:   { label: '生成中', color: '#6366F1', bgColor: '#EEF2FF' },
  pending:      { label: '生成中', color: '#6366F1', bgColor: '#EEF2FF' },
  failed:       { label: '生成失败', color: '#EF4444', bgColor: '#FEE2E2' },
}

// 平台配置
const PLATFORM_MAP: Record<string, { name: string; color: string }> = {
  wechat:       { name: '朋友圈', color: '#07C160' },
  wechat_mp:    { name: '公众号', color: '#07C160' },
  wechat_channel: { name: '视频号', color: '#07C160' },
  xiaohongshu:  { name: '小红书', color: '#FE2C55' },
  douyin:       { name: '抖音', color: '#161823' },
  weibo:        { name: '微博', color: '#FF8200' },
  bilibili:     { name: 'B站', color: '#FB7299' },
  kuaishou:     { name: '快手', color: '#FF4906' },
  toutiao:      { name: '头条', color: '#E4393C' },
  zhihu:        { name: '知乎', color: '#0066FF' },
}

// Tab 状态筛选
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'completed', label: '待发布' },
  { key: 'published', label: '待反馈' },
  { key: 'reviewing', label: '待验收' },
  { key: 'settled', label: '已完成' },
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
    case 'article': return { icon: FileText, name: '图文文章' }
    case 'video_text': return { icon: Play, name: '文案+视频' }
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

  useEffect(() => {
    loadData()
  }, [])

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

        const parsedContents = rawContents.map((c: any) => ({
          ...c,
          images: safeParseJSON(c.images),
          platforms: safeParseJSON(c.platforms),
          tags: safeParseJSON(c.tags),
          platform: c.platform || (safeParseJSON(c.platforms)[0]) || '',
          contentType: c.content_type || c.contentType || 'image_text',
        }))

        setAvatars(parsedAvatars)
        setContents(parsedContents)
        console.log('[已生成内容] 解析后: avatars=', parsedAvatars.length, 'contents=', parsedContents.length)
      }
    } catch (err) {
      console.error('[已生成内容] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 筛选
  const filteredContents = contents.filter(c => {
    const statusMatch = activeTab === 'all' || c.status === activeTab
    const avatarMatch = !selectedAvatarId || c.avatarId === selectedAvatarId
    return statusMatch && avatarMatch
  })

  const getStatusInfo = (status: string) => CONTENT_STATUS_MAP[status] || { label: status, color: '#64748B', bgColor: '#F1F5F9' }
  const getPlatformInfo = (key: string) => PLATFORM_MAP[key] || { name: key, color: '#64748B' }

  const selectedAvatarName = selectedAvatarId
    ? avatars.find(a => a.id === selectedAvatarId)?.name || '未知分身'
    : '全部分身'

  // 查看内容详情
  const handleView = (content: any) => {
    Taro.navigateTo({ url: `/pages/order/order-content-creation/index?orderId=${content.orderId}` })
  }

  // 发布
  const handlePublish = (content: any) => {
    Taro.navigateTo({ url: `/pages/order/order-publish-guide/index?contentId=${encodeURIComponent(content.id)}` })
  }

  // 重新生成
  const handleRegenerate = (content: any) => {
    Taro.navigateTo({ url: `/pages/order/order-content-creation/index?orderId=${content.orderId}` })
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
  const handleUrgeReview = (_content: any) => {
    Taro.showToast({ title: '已发送催验收提醒', icon: 'success' })
  }

  // 反馈
  const handleFeedback = (content: any) => {
    Taro.navigateTo({ url: `/pages/order-publish-feedback/index?requestId=${encodeURIComponent(content.id)}&orderId=${encodeURIComponent(content.orderId || '')}` })
  }

  // 获取卡片底部按钮配置
  const getCardActions = (status: string) => {
    switch (status) {
      case 'completed':
        return [
          { key: 'publish', label: '发布', icon: Send, type: 'primary' },
          { key: 'view', label: '查看', icon: Eye, type: 'default' },
        ]
      case 'published':
        return [
          { key: 'feedback', label: '反馈', icon: MessageSquare, type: 'primary' },
          { key: 'view', label: '查看', icon: Eye, type: 'default' },
        ]
      case 'reviewing':
        return [
          { key: 'urge', label: '催验收', icon: Bell, type: 'primary' },
          { key: 'view', label: '查看', icon: Eye, type: 'default' },
        ]
      case 'settled':
      case 'done':
        return [
          { key: 'view', label: '查看', icon: Eye, type: 'default' },
        ]
      case 'failed':
        return [
          { key: 'delete', label: '删除', icon: Trash2, type: 'danger' },
          { key: 'regenerate', label: '重新生成', icon: RefreshCw, type: 'primary' },
        ]
      default:
        return []
    }
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
      <View className="page-header">
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
            const images = content.images || []
            const videoUrl = content.video_url || content.videoUrl || ''
            const avatarName = content.avatar_name || content.avatarName || '我的分身'
            const actions = getCardActions(content.status)

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

                {/* 内容预览 */}
                <Text className="content-preview">
                  {contentText.length > 120 ? contentText.substring(0, 120) + '...' : contentText}
                </Text>

                {/* 图片预览 */}
                {images.length > 0 && (
                  <View className="image-preview-row">
                    {images.slice(0, 3).map((img: string, idx: number) => (
                      <TaroImage
                        key={idx}
                        src={img}
                        className="preview-image"
                        mode="aspectFill"
                        onClick={() => Taro.previewImage({ urls: images, current: img })}
                      />
                    ))}
                    {images.length > 3 && (
                      <View className="more-images">
                        <Text style={{ fontSize: 12, color: '#64748B' }}>+{images.length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 视频标识 */}
                {videoUrl && (
                  <View className="video-preview">
                    <Play size={24} color="#fff" />
                    <Text style={{ fontSize: 12, color: '#fff', marginLeft: 8 }}>视频内容</Text>
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
