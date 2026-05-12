import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react-taro'
import { Network } from '@/network'
import { MarkdownRenderer } from '@/components/markdown-renderer'

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

interface AvatarItem {
  id: string
  name: string
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: '#F59E0B', bg: '#FEF3C7' },
  processing: { label: '生成中', color: '#3B82F6', bg: '#DBEAFE' },
  completed: { label: '已完成', color: '#10B981', bg: '#D1FAE5' },
  failed: { label: '失败', color: '#EF4444', bg: '#FEE2E2' },
}

const TAB_LIST = [
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'processing', label: '生成中' },
  { key: 'pending', label: '待处理' },
  { key: 'failed', label: '失败' },
]

function parseJSONField(val: any): any {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return [] }
  }
  return []
}

export default function GeneratedContentPage() {
  const [contents, setContents] = useState<ContentItem[]>([])
  const [avatars, setAvatars] = useState<AvatarItem[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [selectedAvatarId, setSelectedAvatarId] = useState('all')
  const [loading, setLoading] = useState(true)
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadContents = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/user-stats/contents' })
      console.log('[已生成内容] API响应:', res.data)
      const data = res.data?.data || {}
      const rawAvatars: any[] = data.avatars || []
      const rawContents: any[] = data.contents || []

      const avatarList: AvatarItem[] = rawAvatars.map((a: any) => ({
        id: a.id,
        name: a.name || '未命名',
      }))
      setAvatars(avatarList)

      const contentList: ContentItem[] = rawContents.map((c: any) => ({
        id: c.id,
        orderId: c.orderId || c.order_id || '',
        avatarId: c.avatarId || c.avatar_id || '',
        avatarName: c.avatarName || c.avatar_name || avatarList.find(a => a.id === (c.avatarId || c.avatar_id))?.name || '未知分身',
        platform: c.platform || c.platforms || 'unknown',
        status: c.status || 'pending',
        content: c.content || '',
        images: parseJSONField(c.images),
        createdAt: c.createdAt || c.created_at || '',
      }))
      setContents(contentList)
    } catch (err) {
      console.error('[已生成内容] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContents() }, [])

  const filteredContents = contents.filter(c => {
    if (activeTab !== 'all' && c.status !== activeTab) return false
    if (selectedAvatarId !== 'all' && c.avatarId !== selectedAvatarId) return false
    return true
  })

  const selectedAvatarName = selectedAvatarId === 'all'
    ? '全部分身'
    : avatars.find(a => a.id === selectedAvatarId)?.name || '未知分身'

  const handlePreviewImage = (urls: string[], index: number) => {
    Taro.previewImage({ urls, current: urls[index] })
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <View style={{ minHeight: '100vh', backgroundColor: '#F5F5F5' }}>
      {/* 顶部导航 */}
      <View style={{
        background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
        padding: '12px 16px',
        paddingTop: '48px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      >
        <View onClick={() => Taro.navigateBack()} style={{ padding: '4px' }}>
          <ArrowLeft size={20} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: '17px', fontWeight: '600' }}>已生成内容</Text>
        <View onClick={loadContents} style={{ padding: '4px' }}>
          <RefreshCw size={18} color="#fff" />
        </View>
      </View>

      {/* 状态 Tab */}
      <View style={{
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: '0 4px',
        borderBottom: '1px solid #E5E7EB',
      }}
      >
        {TAB_LIST.map(tab => (
          <View
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '10px 0',
              borderBottom: activeTab === tab.key ? '2px solid #8B5CF6' : '2px solid transparent',
            }}
          >
            <Text style={{
              fontSize: '13px',
              color: activeTab === tab.key ? '#8B5CF6' : '#6B7280',
              fontWeight: activeTab === tab.key ? '600' : '400',
              textAlign: 'center',
            }}
            >
              {tab.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 分身筛选 - 下拉选择 */}
      <View style={{
        backgroundColor: '#fff',
        padding: '8px 16px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      >
        <Text style={{ fontSize: '13px', color: '#6B7280' }}>分身筛选：</Text>
        <View
          onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F3F4F6',
            borderRadius: '8px',
            padding: '6px 12px',
            minWidth: '100px',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: '13px', color: '#374151' }}>{selectedAvatarName}</Text>
          <Text style={{ fontSize: '10px', color: '#9CA3AF', marginLeft: '4px' }}>
            {avatarDropdownOpen ? '▲' : '▼'}
          </Text>
        </View>
      </View>

      {/* 下拉菜单 */}
      {avatarDropdownOpen && (
        <View style={{
          position: 'absolute',
          right: '16px',
          top: '130px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 200,
          minWidth: '140px',
          overflow: 'hidden',
        }}
        >
          <View
            onClick={() => { setSelectedAvatarId('all'); setAvatarDropdownOpen(false) }}
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #F3F4F6',
              backgroundColor: selectedAvatarId === 'all' ? '#F3F0FF' : '#fff',
            }}
          >
            <Text style={{
              fontSize: '14px',
              color: selectedAvatarId === 'all' ? '#8B5CF6' : '#374151',
            }}
            >
              全部分身
            </Text>
          </View>
          {avatars.map(avatar => (
            <View
              key={avatar.id}
              onClick={() => { setSelectedAvatarId(avatar.id); setAvatarDropdownOpen(false) }}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #F3F4F6',
                backgroundColor: selectedAvatarId === avatar.id ? '#F3F0FF' : '#fff',
              }}
            >
              <Text style={{
                fontSize: '14px',
                color: selectedAvatarId === avatar.id ? '#8B5CF6' : '#374151',
              }}
              >
                {avatar.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 内容列表 */}
      <ScrollView scrollY style={{ height: 'calc(100vh - 180px)' }}>
        {loading ? (
          <View style={{ padding: '60px 0', textAlign: 'center' }}>
            <Text style={{ fontSize: '14px', color: '#9CA3AF' }}>加载中...</Text>
          </View>
        ) : filteredContents.length === 0 ? (
          <View style={{ padding: '60px 0', textAlign: 'center' }}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={{ display: 'block', fontSize: '14px', color: '#9CA3AF', marginTop: '12px' }}>
              暂无内容
            </Text>
          </View>
        ) : (
          <View style={{ padding: '12px 16px' }}>
            {filteredContents.map(item => {
              const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending
              const isExpanded = expandedId === item.id
              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    overflow: 'hidden',
                  }}
                >
                  {/* 卡片头部 */}
                  <View
                    onClick={() => toggleExpand(item.id)}
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: '8px' }}>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '4px' }}>
                        <View style={{
                          backgroundColor: statusInfo.bg,
                          borderRadius: '4px',
                          padding: '2px 6px',
                          marginRight: '8px',
                        }}
                        >
                          <Text style={{ fontSize: '11px', color: statusInfo.color }}>{statusInfo.label}</Text>
                        </View>
                        <Text style={{ fontSize: '12px', color: '#9CA3AF' }}>{item.avatarName}</Text>
                      </View>
                      <Text style={{ fontSize: '13px', color: '#374151', lineHeight: '18px' }} numberOfLines={2}>
                        {item.content ? item.content.substring(0, 80) + '...' : '暂无内容'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: '12px', color: '#D1D5DB' }}>
                      {isExpanded ? '收起' : '展开'}
                    </Text>
                  </View>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <View style={{ padding: '0 14px 14px', borderTop: '1px solid #F3F4F6' }}>
                      {/* 内容文本 */}
                      {item.content && (
                        <View style={{ marginTop: '10px' }}>
                          <MarkdownRenderer content={item.content} />
                        </View>
                      )}

                      {/* 图片列表 */}
                      {item.images && item.images.length > 0 && (
                        <View style={{ marginTop: '10px' }}>
                          <Text style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                            配图（{item.images.length}张）
                          </Text>
                          <View style={{
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                          >
                            {item.images.map((img, idx) => (
                              <Image
                                key={idx}
                                src={img}
                                mode="aspectFill"
                                onClick={() => handlePreviewImage(item.images, idx)}
                                style={{ width: '100px', height: '100px', borderRadius: '8px' }}
                              />
                            ))}
                          </View>
                        </View>
                      )}

                      {/* 底部操作 */}
                      <View style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid #F3F4F6',
                      }}
                      >
                        {item.status === 'completed' && (
                          <View
                            onClick={() => Taro.navigateTo({ url: `/pages/order/order-publish-guide/index?contentId=${item.id}` })}
                            style={{
                              backgroundColor: '#8B5CF6',
                              borderRadius: '8px',
                              padding: '6px 14px',
                            }}
                          >
                            <Text style={{ fontSize: '13px', color: '#fff' }}>查看发布指南</Text>
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
