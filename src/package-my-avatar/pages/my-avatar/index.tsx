import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  Box,
  ChevronRight,
  Eye,
  Heart,
  Image as ImageIcon,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Network } from '@/network'

import './index.css'

type AvatarFilter = 'all' | 'skilled' | 'pending'

type MyAvatarItem = {
  id: number
  userId: string
  avatarUrl: string
  avatarName: string
  skillType: string
  tags: string[]
  description: string
  status: string
  viewCount: number
  favoriteCount: number
  incomePointsTotal: number
  updatedAt: string
  hasSkill: boolean
  works: MyAvatarWork[]
}

type MyAvatarWork = {
  id: number
  title: string
  description: string
  category: string
  income: number
  updatedAt: string
  favoriteCount: number
  viewCount: number
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
  coverUrl: string
}

type MyAvatarData = {
  summary: {
    avatarCount: number
    totalViewCount: number
    totalFavoriteCount: number
    totalIncomePoints: number
  }
  counts: {
    all: number
    skilled: number
    pending: number
  }
  list: MyAvatarItem[]
}

type ApiResponse<T> = {
  code?: number
  msg?: string
  data?: T | null
}

const EMPTY_DATA: MyAvatarData = {
  summary: {
    avatarCount: 0,
    totalViewCount: 0,
    totalFavoriteCount: 0,
    totalIncomePoints: 0,
  },
  counts: {
    all: 0,
    skilled: 0,
    pending: 0,
  },
  list: [],
}

const FILTERS: Array<{ value: AvatarFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'skilled', label: '有技能' },
  { value: 'pending', label: '待添加技能' },
]

const formatCount = (value: number) => {
  const normalized = Number(value || 0)
  if (normalized >= 10000) {
    return `${(normalized / 10000).toFixed(normalized >= 100000 ? 1 : 2).replace(/\.0+$/, '')}w`
  }
  return normalized.toLocaleString('zh-CN')
}

const formatPoints = (value: number) => Number(value || 0).toLocaleString('zh-CN')

export default function MyAvatarPage() {
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = {
    '--my-avatar-status-bar': `${statusBarHeight}px`,
  } as CSSProperties
  const [pageData, setPageData] = useState<MyAvatarData>(EMPTY_DATA)
  const [selectedFilter, setSelectedFilter] = useState<AvatarFilter>('all')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [previewWork, setPreviewWork] = useState<MyAvatarWork | null>(null)
  const loadRequestIdRef = useRef(0)

  const loadPage = useCallback(async (filter: AvatarFilter) => {
    const requestId = ++loadRequestIdRef.current
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/my-avatars',
        data: { filter },
      })
      // console.log('[MyAvatarPage] avatars response:', res.data)
      const responseBody = res.data as ApiResponse<MyAvatarData>
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '获取我的分身失败')
      }

      if (requestId !== loadRequestIdRef.current) return
      setPageData(responseBody.data)
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return
      console.error('[MyAvatarPage] load page failed:', error)
      setPageData(EMPTY_DATA)
      void Taro.showToast({
        title: error instanceof Error ? error.message : '获取失败',
        icon: 'none',
      })
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void loadPage(selectedFilter)
  })

  const changeFilter = (value: string) => {
    const nextFilter = value as AvatarFilter
    setSelectedFilter(nextFilter)
    void loadPage(nextFilter)
  }

  const createAvatar = async () => {
    try {
      Taro.showLoading({ title: '检查中...' })
      const res = await Network.request({ url: '/api/ai-avatar/quota' })
      Taro.hideLoading()

      const quota = (res.data as ApiResponse<{
        level: number
        levelName: string
        currentCount: number
        maxCount: number
        canCreate: boolean
      }>)?.data

      if (!quota) {
        void Taro.showToast({ title: '获取配额失败', icon: 'none' })
        return
      }

      if (!quota.canCreate) {
        void Taro.showModal({
          title: '分身数量已达上限',
          content: `当前${quota.levelName}最多可创建${quota.maxCount}个分身，您已创建${quota.currentCount}个。升级版本可解锁更多名额。`,
          confirmText: '我知道了',
          showCancel: false,
        })
        return
      }

      void Taro.navigateTo({ url: '/package-my-avatar/pages/avatar-create-step1/index' })
    } catch {
      Taro.hideLoading()
      void Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  const getAvatarStatusText = (status: string) => {
    if (status === '已上线' || status === '已下线' || status === '已封禁') return status
    return '已下线'
  }

  const getAvatarStatusClass = (status: string) => {
    const normalizedStatus = getAvatarStatusText(status)
    if (normalizedStatus === '已上线') return ' is-online'
    if (normalizedStatus === '已封禁') return ' is-banned'
    return ' is-offline'
  }
  const openAvatar = async (avatar: MyAvatarItem) => {
    if (avatar.status === '待测试') {
      try {
        Taro.showLoading({ title: '检查中...' })
        const res = await Network.request({
          url: `/api/ai-avatar/${encodeURIComponent(String(avatar.id))}/pending-templates`,
        })
        Taro.hideLoading()
        const responseBody = res.data as ApiResponse<{ count: number; firstTemplateId: number }>
        const pending = responseBody?.data
        if (pending && pending.count > 0) {
          const confirmRes = await Taro.showModal({
            title: '待测试提醒',
            content: `${avatar.avatarName || '该分身'}有${pending.count}个模版等待测试，是否进入测试？`,
            confirmText: '是',
            cancelText: '否',
          })
          if (confirmRes.confirm) {
            void Taro.navigateTo({
              url: `/package-my-avatar/pages/skill-certify/index?templateId=${encodeURIComponent(String(pending.firstTemplateId))}&avatarId=${encodeURIComponent(String(avatar.id))}`,
            })
          } else {
            void Taro.navigateTo({
              url: `/package-my-avatar/pages/avatar-create-step1/index?avatarId=${encodeURIComponent(String(avatar.id))}`,
            })
          }
          return
        }
      } catch {
        Taro.hideLoading()
      }
      void Taro.navigateTo({
        url: `/package-my-avatar/pages/avatar-create-step1/index?avatarId=${encodeURIComponent(String(avatar.id))}`,
      })
      return
    }

    if (avatar.status === '草稿') {
      void Taro.navigateTo({
        url: `/package-my-avatar/pages/avatar-create-step1/index?avatarId=${encodeURIComponent(String(avatar.id))}`,
      })
    } else {
      void Taro.navigateTo({
        url: `/package-avatar-square/pages/avatar-owner-detail/index?id=${encodeURIComponent(String(avatar.id))}`,
      })
    }
  }

  const openWork1 = (work: MyAvatarWork) => {
    if (work.category === '图片') {
      if (work.images.length === 0) {
        void Taro.showToast({ title: '暂无图片内容', icon: 'none' })
        return
      }
      void Taro.previewImage({ current: work.images[0], urls: work.images })
      return
    }
    if (work.category === '图文') {
      void Taro.navigateTo({
        url: `/package-avatar-square/pages/avatar-work-detail/index?id=${work.id}&scope=internal`,
      })
      return
    }
    if (work.category === '视频') {
      if (!work.videoUrl) {
        void Taro.showToast({ title: '暂无视频内容', icon: 'none' })
        return
      }
      void Taro.previewMedia({
        current: 0,
        sources: [{ url: work.videoUrl, type: 'video' }],
      })
      return
    }
    setPreviewWork(work)
  }

  const openWork = (work: MyAvatarWork) => {
    void Taro.navigateTo({
      url: `/package-avatar-square/pages/work-square-detail/index?id=${work.id}`,
    })
  }

  const copyWorkContent = async () => {
    const title = previewWork?.contentTitle || previewWork?.title || ''
    const content = previewWork?.contentText || ''
    const fullContent = [title, content].filter(Boolean).join('\n\n')
    if (!fullContent) {
      void Taro.showToast({ title: '暂无可复制内容', icon: 'none' })
      return
    }
    await Taro.setClipboardData({ data: fullContent })
  }

  const confirmDelete = async (avatar: MyAvatarItem) => {
    if (deleting) return
    const modal = await Taro.showModal({
      title: '确认删除',
      content: `删除后无法恢复，确定要删除“${avatar.avatarName || '该分身'}”吗？`,
      confirmText: '确定',
      cancelText: '取消',
      confirmColor: '#EF4444',
    })
    if (!modal.confirm) return

    setDeleting(true)
    try {
      const res = await Network.request({
        url: `/api/my-avatars/${encodeURIComponent(String(avatar.id))}`,
        method: 'DELETE',
      })
      const responseBody = res.data as ApiResponse<{ id: number }>
      if (responseBody?.code !== 200) {
        throw new Error(responseBody?.msg || '删除失败')
      }
      void Taro.showToast({ title: '删除成功', icon: 'success' })
      await loadPage(selectedFilter)
    } catch (error) {
      void Taro.showToast({
        title: error instanceof Error ? error.message : '删除失败',
        icon: 'none',
      })
    } finally {
      setDeleting(false)
    }
  }
  return (
    <View className="mya-page" style={pageStyle}>
      <View className="mya-header">
        <Button variant="ghost" size="icon" className="mya-back" onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
          <ArrowLeft size={19} color="#4C3B78" />
        </Button>
        <Text className="mya-header-title">我的分身</Text>
        <View className="mya-header-placeholder" />
      </View>

      <ScrollView scrollY className="mya-scroll">
        <View className="mya-content">
          <Card className="mya-hero">
            <CardContent className="mya-hero-content">
              <View className="mya-hero-copy">
                <View className="mya-hero-title-row">
                  <Text className="mya-hero-title">打造你的{`\n`}专属 AI 分身</Text>
                  <Sparkles size={20} color="#7C3AED" />
                </View>
                <Text className="mya-hero-subtitle">让每一个分身都为你商业多劳</Text>
                <Button className="mya-create-button" onClick={createAvatar}>
                  <Plus size={16} color="#FFFFFF" />
                  <Text>创建新分身</Text>
                </Button>
              </View>
              <View className="mya-hero-visual">
                <View className="mya-hero-glow" />
                {pageData.list[0]?.avatarUrl ? (
                  <Image src={pageData.list[0].avatarUrl} mode="aspectFill" className="mya-hero-image" />
                ) : (
                  <View className="mya-hero-fallback">
                    <Box size={46} color="#FFFFFF" strokeWidth={1.5} />
                  </View>
                )}
              </View>
            </CardContent>
          </Card>

          <View className="mya-section-heading">
            <Text className="mya-section-title">我的分身数据</Text>
          </View>
          <Card className="mya-stats-card">
            <CardContent className="mya-stats-grid">
              {[
                { label: '分身总数', value: formatCount(pageData.summary.avatarCount) },
                { label: '总浏览量', value: formatCount(pageData.summary.totalViewCount) },
                { label: '总收藏量', value: formatCount(pageData.summary.totalFavoriteCount) },
                { label: '累计收益', value: `${formatPoints(pageData.summary.totalIncomePoints)}积分` },
              ].map(item => (
                <View key={item.label} className="mya-stat-item">
                  <Text className="mya-stat-value">{item.value}</Text>
                  <Text className="mya-stat-label">{item.label}</Text>
                </View>
              ))}
            </CardContent>
          </Card>

          <Tabs value={selectedFilter} onValueChange={changeFilter} className="mya-tabs">
            <TabsList className="mya-tabs-list">
              {FILTERS.map(filter => (
                <TabsTrigger
                  key={filter.value}
                  value={filter.value}
                  className={`mya-tab-trigger${selectedFilter === filter.value ? ' is-active' : ''}`}
                >
                  <Text>{filter.label}（{pageData.counts[filter.value]}）</Text>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <View className="mya-card-stack">
              {[1, 2].map(item => <Skeleton key={item} className="mya-card-skeleton" />)}
            </View>
          ) : pageData.list.length === 0 ? (
            <Card className="mya-empty-card">
              <CardContent className="mya-empty-content">
                <View className="mya-empty-icon"><Sparkles size={28} color="#8B5CF6" /></View>
                <Text className="mya-empty-title">暂无符合条件的分身</Text>
                {/* <Text className="mya-empty-text">创建分身并添加技能后，会展示在这里</Text>
                <Button className="mya-empty-button" onClick={createAvatar}>创建分身</Button> */}
              </CardContent>
            </Card>
          ) : (
            <View className="mya-card-stack">
              {pageData.list.map((avatar, index) => {
                const works = avatar.works || []
                return (
                  <Card key={avatar.id} className="mya-avatar-card" onClick={() => openAvatar(avatar)}>
                    <CardContent className="mya-avatar-content">
                      <View className="mya-avatar-main">
                        <View className="mya-avatar-wrap">
                          {avatar.avatarUrl ? (
                            <Image src={avatar.avatarUrl} mode="aspectFill" className="mya-avatar-image" />
                          ) : (
                            <View className="mya-avatar-fallback"><ImageIcon size={24} color="#8B5CF6" /></View>
                          )}
                          <View className="mya-avatar-rank"><Text>{index + 1}</Text></View>
                        </View>
                        <View className="mya-avatar-info">
                          <View className="mya-avatar-name-row">
                            <Text className="mya-avatar-name">{avatar.avatarName || '未命名分身'}</Text>
                            <Badge className={`mya-status${['已上线', '已下线', '已封禁'].includes(avatar.status) ? ' is-online' : ''}`}>
                              <Text>{avatar.status || '待完善'}</Text>
                            </Badge>
                            <ChevronRight size={16} color="#9B8BC5" />
                          </View>
                          <Text className="mya-skill-type">{avatar.skillType || '待添加技能'}</Text>
                          {Array.isArray(avatar.tags) && avatar.tags.length > 0 && (
                            <View className="mya-tags">
                              {avatar.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="mya-tag"><Text>{tag}</Text></Badge>
                              ))}
                            </View>
                          )}
                          <Text className="mya-description">{avatar.description || '暂未填写分身介绍'}</Text>
                          <View className="mya-avatar-metrics">
                            <View className="mya-metric"><Eye size={13} color="#94A3B8" /><Text>{formatCount(avatar.viewCount)}</Text></View>
                            <View className="mya-metric"><Heart size={13} color="#EF4444" /><Text>{formatCount(avatar.favoriteCount)}</Text></View>
                            <Text className="mya-income">累计 {formatPoints(avatar.incomePointsTotal)} 积分</Text>
                            {!['已上线', '已下线', '已封禁'].includes(avatar.status) && (<Button
                              v-if={!['已上线', '已下线', '已封禁'].includes(avatar.status)}
                              variant="ghost"
                              size="icon"
                              className="mya-card-delete"
                              onClick={(event) => {
                                event.stopPropagation()
                                void confirmDelete(avatar)
                              }}
                            >
                              <Trash2 size={13} color="#EF4444" />
                            </Button>)}
                          </View>
                        </View>
                      </View>

                      {works.length > 0 && (<View className="mya-work-row">
                        <ScrollView scrollX className="mya-work-scroll" showScrollbar={false}>
                          <View className="mya-work-track">
                            {works.map(work => (
                              <Button
                                key={work.id}
                                variant="ghost"
                                className="mya-work-preview"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openWork(work)
                                }}
                              >
                                {work.coverUrl ? (
                                  <Image src={work.coverUrl} mode="aspectFill" className="mya-work-image" />
                                ) : (
                                  <View className="mya-work-text-preview">
                                    <Text>{work.contentText || work.description || work.title || '文字作品'}</Text>
                                  </View>
                                )}
                                <Badge className="mya-work-type"><Text>{work.category || '作品'}</Text></Badge>
                                {work.category === '视频' && (
                                  <View className="mya-play"><Play size={14} color="#FFFFFF" /></View>
                                )}
                              </Button>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>



      <Dialog open={Boolean(previewWork)} onOpenChange={open => { if (!open) setPreviewWork(null) }}>
        <DialogContent className="mya-text-dialog" overlayClassName="mya-dialog-overlay">
          <DialogHeader>
            <DialogTitle className="mya-text-dialog-title"><Text>文字详情</Text></DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="mya-text-scroll">
            <View className="mya-copy-content" onClick={() => void copyWorkContent()}>
              <Text className="mya-copy-title">{previewWork?.contentTitle || previewWork?.title || '无标题'}</Text>
              <Text className="mya-copy-text">{previewWork?.contentText || '暂无文字内容'}</Text>
              <Text className="mya-copy-hint">点击复制全部标题和内容</Text>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  )
}

