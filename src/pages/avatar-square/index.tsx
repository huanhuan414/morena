import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Box,
  ChevronDown,
  Crown,
  Eye,
  Heart,
  Sparkles,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'

import './index.css'

type AvatarItem = {
  id: number
  userId: string
  occupation: string
  avatarName: string
  tags: string[]
  description: string
  viewCount: number
  favoriteCount: number
  isFavorited: boolean
  incomePointsTotal: number
  avatarUrl: string
  skillType: string
}
type SortValue = 'recommend' | 'income' | 'views' | 'favorites'

type AvatarSquarePageData = {
  list: AvatarItem[]
  page: number
  pageSize: number
  hasMore: boolean
}

const CATEGORIES = ['全部', '文字生成', '图片生成', '视频生成', '图文生成']
const SORT_OPTIONS: Array<{ label: string; value: SortValue }> = [
  { label: '综合推荐', value: 'recommend' },
  { label: '收益最高', value: 'income' },
  { label: '浏览量最多', value: 'views' },
  { label: '收藏量最多', value: 'favorites' },
]
const formatCount = (value: number) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return value.toLocaleString('zh-CN')
}

const avatarThemeClassNames: Record<number, string> = {
  1: 'is-amber',
  2: 'is-blue',
  3: 'is-orange',
  4: 'is-violet',
  5: 'is-pink',
}

const rankModifierClassNames: Record<number, string> = {
  1: 'is-first',
  2: 'is-second',
  3: 'is-third',
}

export default function AvatarSquarePage() {
  const currentUserId = useUserStore(state => state.userInfo?.id)
  const [avatars, setAvatars] = useState<AvatarItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0])
  const [selectedSort, setSelectedSort] = useState<SortValue>('recommend')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const requestIdRef = useRef(0)
  const skipInitialFilterEffectRef = useRef(true)
  const favoritePendingIdsRef = useRef(new Set<number>())

  const loadAvatars = useCallback(async (targetPage: number, replace: boolean) => {
    if (!replace && loadingRef.current) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    loadingRef.current = true

    try {
      const res = await Network.request({
        url: '/api/avatar-square',
        data: {
          page: targetPage,
          pageSize: 20,
          ...(selectedCategory === '全部' ? {} : { skillType: selectedCategory }),
          sort: selectedSort,
        },
      })
      // console.log('[AvatarSquarePage] avatar square response:', res.data)
      const responseBody = res.data as { data?: AvatarSquarePageData }
      const pageData = responseBody?.data

      if (requestId !== requestIdRef.current || !pageData || !Array.isArray(pageData.list)) {
        return
      }

      setAvatars((current) => {
        if (replace) return pageData.list

        const currentIds = new Set(current.map((avatar) => avatar.id))
        return [...current, ...pageData.list.filter((avatar) => !currentIds.has(avatar.id))]
      })
      setPage(pageData.page)
      setHasMore(pageData.hasMore)
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error('[AvatarSquarePage] load avatar square failed:', error)
        if (replace) {
          setAvatars([])
          setHasMore(false)
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false
      }
    }
  }, [selectedCategory, selectedSort])

  const refreshAvatars = useCallback(() => {
    setAvatars([])
    setPage(1)
    setHasMore(true)
    void loadAvatars(1, true)
  }, [loadAvatars])

  useDidShow(() => {
    refreshAvatars()
  })

  useEffect(() => {
    if (skipInitialFilterEffectRef.current) {
      skipInitialFilterEffectRef.current = false
      return
    }

    refreshAvatars()
  }, [refreshAvatars])
  const handleLoadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return
    void loadAvatars(page + 1, false)
  }, [hasMore, loadAvatars, page])
  const handleViewAvatar = useCallback((avatar: AvatarItem) => {
    const isOwner = Boolean(
      currentUserId
      && avatar.userId
      && String(currentUserId) === String(avatar.userId)
    )
    const preview = encodeURIComponent(JSON.stringify(avatar))
    const url = isOwner
      ? `/package-avatar-square/pages/avatar-owner-detail/index?preview=${preview}`
      : `/package-avatar-square/pages/avatar-public-detail/index?id=${avatar.id}`

    void Taro.navigateTo({ url })
  }, [currentUserId])
  const handleToggleFavorite = useCallback(async (avatar: AvatarItem) => {
    if (!currentUserId) {
      void Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (favoritePendingIdsRef.current.has(avatar.id)) return

    const nextIsFavorited = !avatar.isFavorited
    const previousFavoriteCount = avatar.favoriteCount
    favoritePendingIdsRef.current.add(avatar.id)
    setAvatars(current => current.map(item => item.id === avatar.id
      ? {
          ...item,
          isFavorited: nextIsFavorited,
          favoriteCount: Math.max(0, item.favoriteCount + (nextIsFavorited ? 1 : -1)),
        }
      : item))

    try {
      const res = await Network.request({
        url: `/api/avatar-square/${avatar.id}/favorite`,
        method: nextIsFavorited ? 'POST' : 'DELETE',
        data: { targetType: '分身' },
      })
      const responseBody = res.data as {
        code?: number
        msg?: string
        data?: { isFavorited: boolean; favoriteCount: number } | null
      }
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '收藏操作失败')
      }

      setAvatars(current => current.map(item => item.id === avatar.id
        ? {
            ...item,
            isFavorited: responseBody.data!.isFavorited,
            favoriteCount: responseBody.data!.favoriteCount,
          }
        : item))
    } catch (error) {
      setAvatars(current => current.map(item => item.id === avatar.id
        ? {
            ...item,
            isFavorited: avatar.isFavorited,
            favoriteCount: previousFavoriteCount,
          }
        : item))
      void Taro.showToast({
        title: error instanceof Error ? error.message : '收藏操作失败',
        icon: 'none',
      })
    } finally {
      favoritePendingIdsRef.current.delete(avatar.id)
    }
  }, [currentUserId])

  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight || 20
  const pageStyle = {
    '--as-status-bar-height': `${statusBarHeight}px`,
  } as CSSProperties

  return (
    <View className="as-page" style={pageStyle}>
      <View className="as-header">
        <View className="as-header-bg">
          <View className="as-header-glow is-right" />
          <View className="as-header-glow is-left" />
        </View>

        <View className="as-header-content">
          <Card className="as-banner">
            <View className="as-banner-decor is-large" />
            <View className="as-banner-decor is-small" />
            <CardContent className="as-banner-content">
              <View className="as-banner-copy">
                <View className="as-banner-title-row">
                  <Text className="as-banner-title">发现优秀的AI分身</Text>
                  <Sparkles className="as-banner-title-icon" size={18} color="#7C3AED" />
                </View>
                <Text className="as-banner-subtitle">用 AI 技能，遇见更多可能</Text>
              </View>
              <View className="as-banner-visual">
                <View className="as-banner-visual-glow" />
                <View className="as-banner-orbit is-wide" />
                <View className="as-banner-orbit is-tall" />
                <View className="as-banner-dot is-first" />
                <View className="as-banner-dot is-second" />
                <View className="as-banner-cube">
                  <View className="as-banner-visual-border" />
                  <Box size={36} color="#FFFFFF" strokeWidth={1.6} />
                </View>
                <Sparkles className="as-banner-visual-icon" size={18} color="#8B5CF6" />
              </View>
            </CardContent>
          </Card>

          <ScrollView scrollX className="as-filter-scroll" showScrollbar={false}>
            <View className="as-filter-row">
              {CATEGORIES.map((category) => (
                <Button
                  key={category}
                  size="sm"
                  variant="ghost"
                  className={`as-filter-btn${category === selectedCategory ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  <Text className="as-filter-label">{category}</Text>
                </Button>
              ))}
              <Button
                size="icon"
                variant="ghost"
                className="as-filter-expand"
              >
                <ChevronDown size={16} color="#64748B" />
              </Button>
            </View>
          </ScrollView>

          <ScrollView scrollX className="as-sort-scroll" showScrollbar={false}>
            <View className="as-sort-row">
              {SORT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant="ghost"
                  className={`as-sort-btn${option.value === selectedSort ? ' is-highlighted' : ''}`}
                  onClick={() => setSelectedSort(option.value)}
                >
                  <Text className="as-sort-label">{option.label}</Text>
                </Button>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <ScrollView
        scrollY
        className="as-list"
        lowerThreshold={120}
        onScrollToLower={handleLoadMore}
      >
        <View className="as-list-content">
          <View className="as-card-stack">
            {avatars.map((avatar, index) => (
              <Card key={avatar.id} className="as-card">
                <CardContent className="as-card-content">
                  <View className={`as-avatar ${avatarThemeClassNames[(index % 5) + 1]}`}>
                    <View className="as-avatar-glow is-bottom" />
                    <View className="as-avatar-glow is-top" />
                    <Image src={avatar.avatarUrl} mode="aspectFill" className="as-avatar-image" />
                    <View className={`as-rank ${rankModifierClassNames[index + 1] || 'is-default'}`}>
                      {index === 0
                        ? <Crown size={14} color="#FFFFFF" />
                        : <Text className="as-rank-text">{index + 1}</Text>}
                    </View>
                  </View>

                  <View className="as-card-body">
                    <View className="as-card-header">
                      <View className="as-card-identity">
                        <Text className="as-card-name">{avatar.avatarName}</Text>
                        {/* <BadgeCheck className="as-card-verified" size={15} color="#7C3AED" /> */}
                      </View>
                      <Text className="as-card-price">{avatar.incomePointsTotal} 积分</Text>
                    </View>
                    {avatar.skillType && (
                      <View className="as-card-skill-row">
                        <Badge variant="secondary" className="as-card-tag">
                          <Text className="as-tag-text">{avatar.skillType}</Text>
                        </Badge>
                      </View>
                    )}

                    <Text className="as-card-profile">{avatar.tags.join(' · ')}</Text>



                    <Text className="as-card-description">{avatar.description}</Text>

                    <View className="as-card-footer">
                      <View className="as-card-metrics">
                        <View className="as-card-metric is-spaced">
                          <Eye size={14} color="#94A3B8" />
                          <Text className="as-metric-count">{formatCount(avatar.viewCount)}</Text>
                        </View>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="as-card-metric as-favorite-btn"
                          onClick={() => void handleToggleFavorite(avatar)}
                        >
                          <Heart
                            size={14}
                            color="#EF4444"
                            filled={avatar.isFavorited}
                          />
                          <Text className="as-metric-count">
                            {formatCount(avatar.favoriteCount)}
                          </Text>
                        </Button>
                      </View>
                      <Button
                        variant="link"
                        size="sm"
                        className="as-view-btn"
                        onClick={() => handleViewAvatar(avatar)}
                      >
                        <Text className="as-view-text">查看</Text>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}