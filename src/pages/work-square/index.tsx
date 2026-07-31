import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Box, Eye, Heart, Play, Search, Sparkles } from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'

import './index.css'

type WorkCategory = '全部' | '图片' | '图文' | '文字' | '视频'
type SortValue = 'recommend' | 'income' | 'views' | 'favorites'

type WorkItem = {
  id: number
  avatarId: number
  avatarName: string
  avatarUrl: string
  category: string
  title: string
  description: string
  generatedPayPoints: number
  viewCount: number
  favoriteCount: number
  isFavorited: boolean
  publishedAt: string | null
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
}

type WorkSquarePageData = {
  list: WorkItem[]
  page: number
  pageSize: number
  hasMore: boolean
}

const CATEGORIES: WorkCategory[] = ['全部', '图片', '图文', '文字', '视频']
const SORT_OPTIONS: Array<{ label: string; value: SortValue }> = [
  { label: '综合推荐', value: 'recommend' },
  { label: '收益最高', value: 'income' },
  { label: '浏览量最多', value: 'views' },
  { label: '收藏量最多', value: 'favorites' },
]

const formatCount = (value: number) => {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`
  return Number(value || 0).toLocaleString('zh-CN')
}

const formatPublishedAt = (value: string | null) => {
  if (!value) return ''
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const diffMinutes = Math.max(0, Math.floor((Date.now() - time) / 60000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}小时前`
  if (diffMinutes < 2880) return '昨天'
  const date = new Date(time)
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}`
}

export default function WorkSquarePage() {
  const currentUserId = useUserStore(state => state.userInfo?.id)
  const [works, setWorks] = useState<WorkItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<WorkCategory>('全部')
  const [selectedSort, setSelectedSort] = useState<SortValue>('recommend')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [previewWork, setPreviewWork] = useState<WorkItem | null>(null)
  const [textPreviewOpen, setTextPreviewOpen] = useState(false)
  const loadingRef = useRef(false)
  const requestIdRef = useRef(0)
  const skipInitialFilterEffectRef = useRef(true)
  const favoritePendingIdsRef = useRef(new Set<number>())

  const loadWorks = useCallback(async (targetPage: number, replace: boolean) => {
    if (!replace && loadingRef.current) return
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    loadingRef.current = true
    if (replace) setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/avatar-square/work-square',
        data: {
          page: targetPage,
          pageSize: 20,
          ...(selectedCategory === '全部' ? {} : { category: selectedCategory }),
          ...(searchKeyword ? { avatarName: searchKeyword } : {}),
          sort: selectedSort,
        },
      })
      const responseBody = res.data as { code?: number; data?: WorkSquarePageData }
      const pageData = responseBody?.data
      if (requestId !== requestIdRef.current || !pageData || !Array.isArray(pageData.list)) return

      setWorks(current => {
        if (replace) return pageData.list
        const currentIds = new Set(current.map(item => item.id))
        return [...current, ...pageData.list.filter(item => !currentIds.has(item.id))]
      })
      setPage(pageData.page)
      setHasMore(pageData.hasMore)
    } catch (error) {
      console.error('[WorkSquarePage] load works failed:', error)
      if (requestId === requestIdRef.current && replace) {
        setWorks([])
        setHasMore(false)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [searchKeyword, selectedCategory, selectedSort])

  const refreshWorks = useCallback(() => {
    setPage(1)
    setHasMore(true)
    void loadWorks(1, true)
  }, [loadWorks])

  useDidShow(() => refreshWorks())

  useEffect(() => {
    if (skipInitialFilterEffectRef.current) {
      skipInitialFilterEffectRef.current = false
      return
    }
    refreshWorks()
  }, [refreshWorks])

  const submitSearch = () => {
    const normalizedKeyword = searchInput.trim()
    if (normalizedKeyword === searchKeyword) refreshWorks()
    else setSearchKeyword(normalizedKeyword)
  }

  const recordWorkView = async (workId: number) => {
    try {
      const res = await Network.request({
        url: `/api/generated-works/${workId}/view`,
        method: 'POST',
        data: { source: 'avatar_square' },
      })
      const responseBody = res.data as { data?: { viewCount?: number } | null }
      const viewCount = responseBody?.data?.viewCount
      if (typeof viewCount === 'number') {
        setWorks(current => current.map(item => item.id === workId
          ? { ...item, viewCount }
          : item))
      }
    } catch (error) {
      console.warn('[WorkSquarePage] record work view failed:', error)
    }
  }

  const openWork = (work: WorkItem) => {
    if (work.category === '图片') {
      if (work.images.length === 0) {
        void Taro.showToast({ title: '暂无图片内容', icon: 'none' })
        return
      }
      void Taro.previewImage({ current: work.images[0], urls: work.images })
        .then(() => recordWorkView(work.id))
      return
    }
    if (work.category === '图文') {
      void Taro.navigateTo({
        url: `/package-avatar-square/pages/avatar-work-detail/index?id=${work.id}&scope=public`,
        success: () => void recordWorkView(work.id),
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
      }).then(() => recordWorkView(work.id))
      return
    }
    setPreviewWork(work)
    setTextPreviewOpen(true)
    void recordWorkView(work.id)
  }

  const toggleFavorite = async (work: WorkItem) => {
    if (!currentUserId) {
      void Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (favoritePendingIdsRef.current.has(work.id)) return

    const nextIsFavorited = !work.isFavorited
    favoritePendingIdsRef.current.add(work.id)
    setWorks(current => current.map(item => item.id === work.id
      ? {
        ...item,
        isFavorited: nextIsFavorited,
        favoriteCount: Math.max(0, item.favoriteCount + (nextIsFavorited ? 1 : -1)),
      }
      : item))

    try {
      const res = await Network.request({
        url: `/api/avatar-square/${work.id}/favorite`,
        method: nextIsFavorited ? 'POST' : 'DELETE',
        data: { targetType: '作品' },
      })
      const responseBody = res.data as {
        code?: number
        msg?: string
        data?: { isFavorited: boolean; favoriteCount: number } | null
      }
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '收藏操作失败')
      }
      setWorks(current => current.map(item => item.id === work.id
        ? {
          ...item,
          isFavorited: responseBody.data!.isFavorited,
          favoriteCount: responseBody.data!.favoriteCount,
        }
        : item))
    } catch (error) {
      setWorks(current => current.map(item => item.id === work.id ? work : item))
      void Taro.showToast({
        title: error instanceof Error ? error.message : '收藏操作失败',
        icon: 'none',
      })
    } finally {
      favoritePendingIdsRef.current.delete(work.id)
    }
  }

  const copyTextContent = async () => {
    const title = previewWork?.contentTitle || previewWork?.title || ''
    const content = previewWork?.contentText || ''
    const value = [title, content].filter(Boolean).join('\n\n')
    if (!value) return
    await Taro.setClipboardData({ data: value })
  }

  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = { '--ws-status-bar-height': `${statusBarHeight}px` } as CSSProperties

  return (
    <View className="ws-page" style={pageStyle}>
      <View className="ws-header">
        <View className="ws-hero">
          <View className="ws-hero-copy">
            <View className="ws-hero-title-row">
              <Text className="ws-hero-title">AI分身创作空间</Text>
              <Sparkles size={18} color="#FFFFFF" />
            </View>
            <Text className="ws-hero-subtitle">分享你的AI作品</Text>
          </View>
          <View className="ws-hero-art">
            <View className="ws-orbit is-outer" />
            <View className="ws-orbit is-inner" />
            <View className="ws-orbit-dot is-first" />
            <View className="ws-orbit-dot is-second" />
            <View className="ws-hero-cube">
              <Box size={30} color="#FFFFFF" strokeWidth={1.8} />
            </View>
          </View>
        </View>
        <View className="ws-search-row">
          <Input
            value={searchInput}
            className="ws-search-input"
            placeholder="搜索分身名称"
            confirmType="search"
            onInput={event => setSearchInput(event.detail.value)}
            onConfirm={submitSearch}
          />
          <Button size="icon" className="ws-search-btn" onClick={submitSearch}>
            <Search size={18} color="#FFFFFF" />
          </Button>
        </View>

        <ScrollView scrollX showScrollbar={false} className="ws-filter-scroll">
          <View className="ws-filter-row">
            {CATEGORIES.map(category => (
              <Button
                key={category}
                size="sm"
                variant="ghost"
                className={`ws-filter-btn${selectedCategory === category ? ' is-active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                <Text>{category}</Text>
              </Button>
            ))}
          </View>
        </ScrollView>

        <ScrollView scrollX showScrollbar={false} className="ws-sort-scroll">
          <View className="ws-sort-row">
            {SORT_OPTIONS.map(option => (
              <Button
                key={option.value}
                size="sm"
                variant="ghost"
                className={`ws-sort-btn${selectedSort === option.value ? ' is-active' : ''}`}
                onClick={() => setSelectedSort(option.value)}
              >
                <Text>{option.label}</Text>
              </Button>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        scrollY
        className="ws-list"
        lowerThreshold={120}
        onScrollToLower={() => {
          if (!loadingRef.current && hasMore) void loadWorks(page + 1, false)
        }}
      >
        <View className="ws-list-content">
          {loading ? (
            [0, 1, 2].map(item => <Skeleton key={item} className="ws-skeleton-card" />)
          ) : works.length > 0 ? (
            works.map(work => (
              <Card key={work.id} className="ws-card">
                <CardContent className="ws-card-content">
                  <View className="ws-card-main">
                    <Button
                      variant="ghost"
                      className="ws-avatar-button"
                      onClick={() => Taro.navigateTo({
                        url: `/package-avatar-square/pages/avatar-public-detail/index?id=${work.avatarId}`,
                      })}
                    >
                      <View className="ws-avatar">
                        {work.avatarUrl ? (
                          <Image src={work.avatarUrl} mode="aspectFill" className="ws-avatar-image" />
                        ) : (
                          <Sparkles size={16} color="#8B5CF6" />
                        )}
                      </View>
                    </Button>

                    <View className="ws-card-body">
                      <View className="ws-author-row">
                        <Button
                          variant="ghost"
                          className="ws-author"
                          onClick={() => Taro.navigateTo({
                            url: `/package-avatar-square/pages/avatar-public-detail/index?id=${work.avatarId}`,
                          })}
                        >
                          <Text className="ws-author-name">{work.avatarName || '匿名分身'}</Text>
                        </Button>
                        <View className="ws-author-meta">
                          <Badge variant="secondary" className="ws-type"><Text>{work.category}</Text></Badge>
                          <Text className="ws-time">{formatPublishedAt(work.publishedAt)}</Text>
                        </View>
                      </View>

                      <View className="ws-work-row">
                        <View className={`ws-media${work.category === '文字' ? ' is-text' : ''}`} onClick={() => openWork(work)}>
                          {(work.category === '图片' || work.category === '图文') && work.images[0] ? (
                            <Image src={work.images[0]} mode="aspectFill" className="ws-media-image" />
                          ) : work.category === '视频' && work.videoCoverUrl ? (
                            <>
                              <Image src={work.videoCoverUrl} mode="aspectFill" className="ws-media-image" />
                              <View className="ws-play"><Play size={22} color="#FFFFFF" filled /></View>
                            </>
                          ) : work.category === '文字' ? (
                            <Text className="ws-text-preview">{work.contentText || work.description || '暂无文字内容'}</Text>
                          ) : (
                            <View className="ws-media-empty"><Sparkles size={24} color="#FFFFFF" /></View>
                          )}
                        </View>

                        <View className="ws-work-info">
                          <Text className="ws-work-title">{work.title || '无标题作品'}</Text>
                          <Text className="ws-work-description">{work.description || work.contentText || '暂无作品描述'}</Text>
                          <Text className="ws-points">{work.generatedPayPoints} 积分</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View className="ws-card-footer">
                    <View className="ws-metrics">
                      <View className="ws-metric">
                        <Eye size={14} color="#94A3B8" />
                        <Text>{formatCount(work.viewCount)}</Text>
                      </View>
                      <View className="ws-metric">
                        <Heart size={14} color="#EF4444" filled={work.isFavorited} />
                        <Text>{formatCount(work.favoriteCount)}</Text>
                      </View>
                    </View>
                    <View className="ws-actions">
                      <Button variant="outline" size="sm" className="ws-action-btn">
                        <Text>使用模板</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`ws-action-btn is-favorite${work.isFavorited ? ' is-active' : ''}`}
                        onClick={() => void toggleFavorite(work)}
                      >
                        <Heart size={13} color="#EF4444" filled={work.isFavorited} />
                        <Text>{work.isFavorited ? '已收藏' : '收藏'}</Text>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          ) : (
            <View className="ws-empty"><Text>暂无符合条件的作品</Text></View>
          )}
        </View>
      </ScrollView>

      <Dialog open={textPreviewOpen} onOpenChange={setTextPreviewOpen}>
        <DialogContent className="ws-dialog" overlayClassName="ws-dialog-overlay">
          <DialogHeader><DialogTitle className="ws-dialog-title"><Text>文字详情</Text></DialogTitle></DialogHeader>
          <ScrollView scrollY className="ws-dialog-scroll">
            <View className="ws-copy-content" onClick={() => void copyTextContent()}>
              <Text className="ws-copy-title">{previewWork?.contentTitle || previewWork?.title || '无标题'}</Text>
              <Text className="ws-copy-text">{previewWork?.contentText || '暂无文字内容'}</Text>
              <Text className="ws-copy-hint">点击复制全部标题和内容</Text>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  )
}