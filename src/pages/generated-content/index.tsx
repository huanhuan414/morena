import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ChevronDown, RefreshCw } from 'lucide-react-taro'
import './index.css'

// 内容状态映射 - 与订单状态对应
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待发布', color: '#F59E0B', bg: '#FEF3C7' },
  processing: { label: '生成中', color: '#3B82F6', bg: '#DBEAFE' },
  generating_text: { label: '文案生成中', color: '#3B82F6', bg: '#DBEAFE' },
  generating_images: { label: '配图生成中', color: '#3B82F6', bg: '#DBEAFE' },
  completed: { label: '待发布', color: '#F59E0B', bg: '#FEF3C7' },
  published: { label: '待反馈', color: '#8B5CF6', bg: '#EDE9FE' },
  failed: { label: '生成失败', color: '#EF4444', bg: '#FEE2E2' },
}

// Tab 状态筛选
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'processing', label: '生成中', includes: ['processing', 'generating_text', 'generating_images'] },
  { key: 'completed', label: '待发布', includes: ['completed', 'pending'] },
  { key: 'published', label: '待反馈', includes: ['published'] },
]

interface ContentItem {
  id: string
  orderId: string
  avatarId: string
  avatarName: string
  platform: string
  status: string
  content: string
  images: string[]
  createdAt: string
}

export default function GeneratedContentPage() {
  const [contents, setContents] = useState<ContentItem[]>([])
  const [avatars, setAvatars] = useState<{ id: string; name: string }[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [selectedAvatarId, setSelectedAvatarId] = useState('all')
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContents()
  }, [])

  const loadContents = async () => {
    try {
      setLoading(true)
      const userId = Taro.getStorageSync('userInfo')?.data?.id
      if (!userId || userId === 'guest-user-id') return

      console.log('[已生成内容] 请求API, userId:', userId)
      const res = await Network.request({ url: '/api/user-stats/contents' })
      console.log('[已生成内容] API响应:', res.data?.code, 'contents数量:', res.data?.data?.contents?.length)

      const rawContents = res.data?.data?.contents || []
      const rawAvatars = res.data?.data?.avatars || []

      const parsed: ContentItem[] = rawContents.map((item: any) => {
        let images: string[] = []
        try {
          if (typeof item.images === 'string') images = JSON.parse(item.images)
          else if (Array.isArray(item.images)) images = item.images
        } catch { /* ignore */ }

        return {
          id: item.id,
          orderId: item.orderId || item.order_id,
          avatarId: item.avatarId || item.avatar_id,
          avatarName: item.avatarName || item.avatar_name || '未知分身',
          platform: item.platforms || item.platform || '',
          status: item.status || 'pending',
          content: item.content || '',
          images,
          createdAt: item.createdAt || item.created_at || '',
        }
      })

      const avatarList = rawAvatars.map((a: any) => ({ id: a.id, name: a.name }))
      setContents(parsed)
      setAvatars(avatarList)
    } catch (err) {
      console.error('[已生成内容] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handlePreviewImage = (urls: string[], current: number) => {
    Taro.previewImage({ urls, current: urls[current] })
  }

  const selectedAvatarName = avatars.find(a => a.id === selectedAvatarId)?.name || '全部分身'

  // 筛选逻辑
  const filtered = contents.filter(item => {
    // 分身筛选
    if (selectedAvatarId !== 'all' && item.avatarId !== selectedAvatarId) return false
    // 状态筛选
    if (activeTab !== 'all') {
      const tab = STATUS_TABS.find(t => t.key === activeTab)
      if (tab?.includes && !tab.includes.includes(item.status)) return false
    }
    return true
  })

  return (
    <View className="gc-page">
      {/* 状态筛选 Tab */}
      <View className="gc-status-tabs">
        {STATUS_TABS.map(tab => (
          <View
            key={tab.key}
            className={`gc-status-tab ${activeTab === tab.key ? 'gc-status-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className={`gc-status-tab-text ${activeTab === tab.key ? 'gc-status-tab-text-active' : ''}`}>
              {tab.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 分身筛选下拉 */}
      <View className="gc-avatar-filter">
        <View
          className="gc-avatar-filter-btn"
          onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
        >
          <Text className="gc-avatar-filter-text">{selectedAvatarName}</Text>
          <ChevronDown size={14} color="#9CA3AF" />
        </View>
        {showAvatarDropdown && (
          <View className="gc-avatar-dropdown">
            <View
              className={`gc-avatar-dropdown-item ${selectedAvatarId === 'all' ? 'gc-avatar-dropdown-item-active' : ''}`}
              onClick={() => { setSelectedAvatarId('all'); setShowAvatarDropdown(false) }}
            >
              <Text className="gc-avatar-dropdown-text">全部分身</Text>
            </View>
            {avatars.map(avatar => (
              <View
                key={avatar.id}
                className={`gc-avatar-dropdown-item ${selectedAvatarId === avatar.id ? 'gc-avatar-dropdown-item-active' : ''}`}
                onClick={() => { setSelectedAvatarId(avatar.id); setShowAvatarDropdown(false) }}
              >
                <Text className="gc-avatar-dropdown-text">{avatar.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 内容列表 */}
      <ScrollView scrollY className="gc-content-scroll">
        {loading ? (
          <View className="gc-loading">
            <RefreshCw size={24} color="#8B5CF6" className="gc-spin" />
            <Text className="gc-loading-text">加载中...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="gc-empty">
            <Text className="gc-empty-text">暂无内容</Text>
          </View>
        ) : (
          <View className="gc-card-list">
            {filtered.map(item => {
              const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending
              const isExpanded = expandedId === item.id
              return (
                <View key={item.id} className="gc-card">
                  {/* 卡片头部：状态+分身+内容预览+配图缩略图 */}
                  <View className="gc-card-header" onClick={() => toggleExpand(item.id)}>
                    <View className="gc-card-main">
                      {/* 状态标签 + 分身名 */}
                      <View className="gc-card-top-row">
                        <View className="gc-status-badge" style={{ backgroundColor: statusInfo.bg }}>
                          <Text className="gc-status-label" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
                        </View>
                        <Text className="gc-avatar-name">{item.avatarName}</Text>
                      </View>
                      {/* 内容预览 */}
                      <Text className="gc-card-preview" numberOfLines={2}>
                        {item.content ? item.content.replace(/[#*\[\]!]/g, '').substring(0, 80) + '...' : '暂无内容预览'}
                      </Text>
                      {/* 配图缩略图 */}
                      {item.images.length > 0 && (
                        <View className="gc-card-thumbs">
                          {item.images.slice(0, 3).map((img, idx) => (
                            <Image key={idx} src={img} mode="aspectFill" className="gc-thumb-img" />
                          ))}
                          {item.images.length > 3 && (
                            <View className="gc-thumb-more">
                              <Text className="gc-thumb-more-text">+{item.images.length - 3}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <Text className="gc-expand-btn">{isExpanded ? '收起' : '展开'}</Text>
                  </View>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <View className="gc-card-detail">
                      {item.content && (
                        <View className="gc-detail-content">
                          <MarkdownRenderer content={item.content} />
                        </View>
                      )}
                      {item.images.length > 0 && (
                        <View className="gc-detail-images">
                          <Text className="gc-detail-images-title">配图（{item.images.length}张）</Text>
                          <View className="gc-detail-images-grid">
                            {item.images.map((img, idx) => (
                              <Image
                                key={idx}
                                src={img}
                                mode="aspectFill"
                                className="gc-detail-img"
                                onClick={() => handlePreviewImage(item.images, idx)}
                              />
                            ))}
                          </View>
                        </View>
                      )}
                      {/* 操作按钮 */}
                      <View className="gc-detail-actions">
                        {item.status === 'completed' && (
                          <View
                            className="gc-action-btn gc-action-primary"
                            onClick={() => Taro.navigateTo({ url: `/pages/order/order-publish-guide/index?contentId=${item.id}` })}
                          >
                            <Text className="gc-action-text">查看发布指南</Text>
                          </View>
                        )}
                        {item.status === 'published' && (
                          <View className="gc-action-btn gc-action-secondary">
                            <Text className="gc-action-text-secondary">等待反馈</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
