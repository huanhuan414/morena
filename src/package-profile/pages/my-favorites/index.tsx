import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, Eye, Heart, Play, Sparkles } from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'

import './index.css'

type FavoriteTab = 'avatars' | 'works'
type FavoriteCategory = '全部' | '图片' | '图文' | '文字' | '视频'

type FavoriteAvatar = {
  id: number
  avatarName: string
  avatarUrl: string
  tags: string[]
  description: string
  viewCount: number
  favoriteCount: number
  incomePointsTotal: number
  category: string
}

type FavoriteWork = {
  id: number
  avatarId: number
  templateId: number
  avatarName: string
  avatarUrl: string
  category: string
  title: string
  description: string
  generatedPayPoints: number
  viewCount: number
  favoriteCount: number
  publishedAt: string | null
  images: string[]
  contentText: string
  videoCoverUrl: string
}

type FavoritePageData<T> = {
  list: T[]
  page: number
  pageSize: number
  hasMore: boolean
}

const CATEGORIES: FavoriteCategory[] = ['全部', '图片', '图文', '文字', '视频']

const formatCount = (value: number) => {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`
  return Number(value || 0).toLocaleString('zh-CN')
}

const formatPublishedAt = (value: string | null) => {
  if (!value) return ''
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function MyFavoritesPage() {
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 0
  const [activeTab, setActiveTab] = useState<FavoriteTab>('avatars')
  const [avatarCategory, setAvatarCategory] = useState<FavoriteCategory>('全部')
  const [workCategory, setWorkCategory] = useState<FavoriteCategory>('全部')
  const [avatars, setAvatars] = useState<FavoriteAvatar[]>([])
  const [works, setWorks] = useState<FavoriteWork[]>([])
  const [avatarPage, setAvatarPage] = useState(1)
  const [workPage, setWorkPage] = useState(1)
  const [avatarHasMore, setAvatarHasMore] = useState(true)
  const [workHasMore, setWorkHasMore] = useState(true)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [workLoading, setWorkLoading] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [workFailed, setWorkFailed] = useState(false)
  const avatarLoadingRef = useRef(false)
  const workLoadingRef = useRef(false)
  const avatarRequestIdRef = useRef(0)
  const workRequestIdRef = useRef(0)
  const pendingKeysRef = useRef(new Set<string>())

  const loadAvatars = useCallback(async (
    nextPage: number,
    replace: boolean,
    category: FavoriteCategory = avatarCategory,
  ) => {
    if (!replace && avatarLoadingRef.current) return
    const requestId = avatarRequestIdRef.current + 1
    avatarRequestIdRef.current = requestId
    avatarLoadingRef.current = true
    setAvatarLoading(true)
    setAvatarFailed(false)
    try {
      const res = await Network.request({
        url: '/api/avatar-square/favorites/avatars',
        data: {
          page: nextPage,
          pageSize: 20,
          ...(category === '全部' ? {} : { category }),
        },
      })
      const body = res.data as { code?: number; msg?: string; data?: FavoritePageData<FavoriteAvatar> | null }
      if (body?.code !== 200 || !body.data) throw new Error(body?.msg || '查询失败')
      if (requestId !== avatarRequestIdRef.current) return
      setAvatars(current => {
        if (replace) return body.data!.list
        const ids = new Set(current.map(item => item.id))
        return [...current, ...body.data!.list.filter(item => !ids.has(item.id))]
      })
      setAvatarPage(body.data.page)
      setAvatarHasMore(body.data.hasMore)
    } catch (error) {
      console.error('[MyFavoritesPage] load avatars failed:', error)
      if (requestId === avatarRequestIdRef.current) {
        if (replace) setAvatars([])
        setAvatarFailed(true)
      }
    } finally {
      if (requestId === avatarRequestIdRef.current) {
        setAvatarLoading(false)
        avatarLoadingRef.current = false
      }
    }
  }, [avatarCategory])

  const loadWorks = useCallback(async (
    nextPage: number,
    replace: boolean,
    category: FavoriteCategory = workCategory,
  ) => {
    if (!replace && workLoadingRef.current) return
    const requestId = workRequestIdRef.current + 1
    workRequestIdRef.current = requestId
    workLoadingRef.current = true
    setWorkLoading(true)
    setWorkFailed(false)
    try {
      const res = await Network.request({
        url: '/api/avatar-square/favorites/works',
        data: {
          page: nextPage,
          pageSize: 20,
          ...(category === '全部' ? {} : { category }),
        },
      })
      const body = res.data as { code?: number; msg?: string; data?: FavoritePageData<FavoriteWork> | null }
      if (body?.code !== 200 || !body.data) throw new Error(body?.msg || '查询失败')
      if (requestId !== workRequestIdRef.current) return
      setWorks(current => {
        if (replace) return body.data!.list
        const ids = new Set(current.map(item => item.id))
        return [...current, ...body.data!.list.filter(item => !ids.has(item.id))]
      })
      setWorkPage(body.data.page)
      setWorkHasMore(body.data.hasMore)
    } catch (error) {
      console.error('[MyFavoritesPage] load works failed:', error)
      if (requestId === workRequestIdRef.current) {
        if (replace) setWorks([])
        setWorkFailed(true)
      }
    } finally {
      if (requestId === workRequestIdRef.current) {
        setWorkLoading(false)
        workLoadingRef.current = false
      }
    }
  }, [workCategory])

  useDidShow(() => {
    if (activeTab === 'avatars') void loadAvatars(1, true)
    else void loadWorks(1, true)
  })

  const changeTab = (tab: FavoriteTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    if (tab === 'avatars') void loadAvatars(1, true)
    else void loadWorks(1, true)
  }

  const changeAvatarCategory = (category: FavoriteCategory) => {
    if (category === avatarCategory) return
    setAvatarCategory(category)
    setAvatarHasMore(true)
    void loadAvatars(1, true, category)
  }

  const changeWorkCategory = (category: FavoriteCategory) => {
    if (category === workCategory) return
    setWorkCategory(category)
    setWorkHasMore(true)
    void loadWorks(1, true, category)
  }

  const cancelFavorite = async (
    targetType: '分身' | '作品',
    item: FavoriteAvatar | FavoriteWork,
  ) => {
    const key = `${targetType}:${item.id}`
    if (pendingKeysRef.current.has(key)) return
    pendingKeysRef.current.add(key)
    const currentList = targetType === '分身' ? avatars : works
    const removedIndex = currentList.findIndex(current => current.id === item.id)
    if (targetType === '分身') setAvatars(current => current.filter(value => value.id !== item.id))
    else setWorks(current => current.filter(value => value.id !== item.id))
    try {
      const res = await Network.request({
        url: `/api/avatar-square/${item.id}/favorite`,
        method: 'DELETE',
        data: { targetType },
      })
      const body = res.data as { code?: number; msg?: string }
      if (body?.code !== 200) throw new Error(body?.msg || '取消收藏失败')
    } catch (error) {
      if (targetType === '分身') {
        setAvatars(current => {
          if (current.some(value => value.id === item.id)) return current
          const next = [...current]
          next.splice(Math.max(0, removedIndex), 0, item as FavoriteAvatar)
          return next
        })
      } else {
        setWorks(current => {
          if (current.some(value => value.id === item.id)) return current
          const next = [...current]
          next.splice(Math.max(0, removedIndex), 0, item as FavoriteWork)
          return next
        })
      }
      void Taro.showToast({
        title: error instanceof Error ? error.message : '取消收藏失败',
        icon: 'none',
      })
    } finally {
      pendingKeysRef.current.delete(key)
    }
  }

  const renderCategories = (
    selected: FavoriteCategory,
    onChange: (category: FavoriteCategory) => void,
  ) => (
    <ScrollView scrollX className="mf-cat-scroll" showScrollbar={false}>
      <View className="mf-cats">
        {CATEGORIES.map(category => (
          <Button
            key={category}
            size="sm"
            variant="ghost"
            className={`mf-cat${selected === category ? ' is-on' : ''}`}
            onClick={() => onChange(category)}
          >
            <Text>{category}</Text>
          </Button>
        ))}
      </View>
    </ScrollView>
  )

  const renderAvatarList = () => {
    if (avatarLoading && avatars.length === 0) {
      return [0, 1, 2].map(item => <Skeleton key={item} className="mf-skeleton" />)
    }
    if (avatarFailed && avatars.length === 0) {
      return <View className="mf-empty"><Text>加载失败，请稍后重试</Text></View>
    }
    if (avatars.length === 0) return <View className="mf-empty"><Text>暂无收藏的分身</Text></View>
    return avatars.map(avatar => (
      <Card
        key={avatar.id}
        className="mf-avatar-card"
        onClick={() => void Taro.navigateTo({
          url: `/package-avatar-square/pages/avatar-public-detail/index?id=${avatar.id}`,
        })}
      >
        <CardContent className="mf-avatar-body">
          <View className="mf-avatar-cover">
            {avatar.avatarUrl
              ? <Image src={avatar.avatarUrl} mode="aspectFill" className="mf-fill" />
              : <View className="mf-avatar-empty"><Sparkles size={28} color="#8B5CF6" /></View>}
          </View>
          <View className="mf-avatar-info">
            <View className="mf-name-row">
              <Text className="mf-avatar-name">{avatar.avatarName || '未命名分身'}</Text>
              <Text className="mf-points">{avatar.incomePointsTotal} 积分</Text>
            </View>
            <Badge variant="secondary" className="mf-type"><Text>{avatar.category}</Text></Badge>
            <Text className="mf-profile">{avatar.tags.join(' · ')}</Text>
            <Text className="mf-desc">{avatar.description || '暂无分身描述'}</Text>
            <View className="mf-card-foot">
              <View className="mf-metrics">
                <View className="mf-metric"><Eye size={14} color="#94A3B8" /><Text>{formatCount(avatar.viewCount)}</Text></View>
                <View className="mf-metric"><Heart size={14} color="#EF4444" filled /><Text>{formatCount(avatar.favoriteCount)}</Text></View>
              </View>
              <Button
                size="sm"
                variant="ghost"
                className="mf-unfavorite"
                onClick={(event) => {
                  event.stopPropagation()
                  void cancelFavorite('分身', avatar)
                }}
              >
                <Heart size={14} color="#EF4444" filled />
                <Text>取消收藏</Text>
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>
    ))
  }

  const renderWorkMedia = (work: FavoriteWork) => {
    if ((work.category === '图片' || work.category === '图文') && work.images[0]) {
      return <Image src={work.images[0]} mode="aspectFill" className="mf-fill" />
    }
    if (work.category === '视频') {
      return (
        <>
          {work.videoCoverUrl
            ? <Image src={work.videoCoverUrl} mode="aspectFill" className="mf-fill" />
            : <View className="mf-media-empty"><Sparkles size={24} color="#8B5CF6" /></View>}
          <View className="mf-play"><Play size={22} color="#FFFFFF" filled /></View>
        </>
      )
    }
    if (work.category === '文字' || work.category === '图文') {
      return <Text className="mf-text-preview">{work.contentText || work.description || work.title}</Text>
    }
    return <View className="mf-media-empty"><Sparkles size={24} color="#8B5CF6" /></View>
  }

  const renderWorkList = () => {
    if (workLoading && works.length === 0) {
      return [0, 1, 2].map(item => <Skeleton key={item} className="mf-skeleton" />)
    }
    if (workFailed && works.length === 0) {
      return <View className="mf-empty"><Text>加载失败，请稍后重试</Text></View>
    }
    if (works.length === 0) return <View className="mf-empty"><Text>暂无收藏的作品</Text></View>
    return works.map(work => (
      <Card key={work.id} className="mf-work-card">
        <CardContent className="mf-work-body">
          <View className="mf-author-row">
            <View className="mf-author">
              <View className="mf-author-avatar">
                {work.avatarUrl
                  ? <Image src={work.avatarUrl} mode="aspectFill" className="mf-fill" />
                  : <Sparkles size={16} color="#8B5CF6" />}
              </View>
              <Text className="mf-author-name">{work.avatarName || '匿名分身'}</Text>
            </View>
            <View className="mf-work-meta">
              <Badge variant="secondary" className="mf-type"><Text>{work.category}</Text></Badge>
              <Text className="mf-time">{formatPublishedAt(work.publishedAt)}</Text>
            </View>
          </View>
          <View
            className="mf-work-row"
            onClick={() => void Taro.navigateTo({
              url: `/package-avatar-square/pages/work-square-detail/index?id=${work.id}`,
            })}
          >
            <View className={`mf-media${work.category === '文字' || work.category === '图文' ? ' is-text' : ''}`}>
              {renderWorkMedia(work)}
            </View>
            <View className="mf-work-info">
              <Text className="mf-work-title">{work.title || '无标题作品'}</Text>
              <Text className="mf-work-desc">{work.description || work.contentText || '暂无作品描述'}</Text>
              <Text className="mf-points">{work.generatedPayPoints} 积分</Text>
            </View>
          </View>
          <View className="mf-card-foot">
            <View className="mf-metrics">
              <View className="mf-metric"><Eye size={14} color="#94A3B8" /><Text>{formatCount(work.viewCount)}</Text></View>
              <View className="mf-metric"><Heart size={14} color="#EF4444" filled /><Text>{formatCount(work.favoriteCount)}</Text></View>
            </View>
            <View className="mf-work-actions">
              <Button
                size="sm"
                variant="outline"
                className="mf-template"
                onClick={() => {
                  if (work.templateId > 0) {
                    void Taro.navigateTo({
                      url: `/package-my-avatar/pages/template-use/index?templateId=${work.templateId}&avatarId=${work.avatarId}`,
                    })
                  } else {
                    void Taro.showToast({ title: '该作品暂无关联模板', icon: 'none' })
                  }
                }}
              >
                <Text>使用模板</Text>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="mf-unfavorite"
                onClick={() => void cancelFavorite('作品', work)}
              >
                <Heart size={14} color="#EF4444" filled />
                <Text>取消收藏</Text>
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>
    ))
  }

  const activeLoading = activeTab === 'avatars' ? avatarLoading : workLoading
  const activeHasMore = activeTab === 'avatars' ? avatarHasMore : workHasMore
  const activeCount = activeTab === 'avatars' ? avatars.length : works.length

  return (
    <View
      className="mf-page"
      style={{ '--mf-status-top': `${statusBarHeight}px` } as CSSProperties}
    >
      <View className="mf-fixed-head">
        <View className="mf-head">
          <Button variant="outline" className="mf-back" onClick={() => void Taro.navigateBack()}>
            <ArrowLeft size={22} color="#6D4CD8" />
          </Button>
          <Text className="mf-head-title">我的收藏</Text>
          <View className="mf-nav-space" />
        </View>
        <View className="mf-tabs">
          <Button
            variant="ghost"
            className={`mf-tab${activeTab === 'avatars' ? ' is-on' : ''}`}
            onClick={() => changeTab('avatars')}
          >
            <Text>分身收藏</Text>
          </Button>
          <Button
            variant="ghost"
            className={`mf-tab${activeTab === 'works' ? ' is-on' : ''}`}
            onClick={() => changeTab('works')}
          >
            <Text>作品收藏</Text>
          </Button>
        </View>
      </View>
      <ScrollView
        scrollY
        className="mf-scroll"
        lowerThreshold={120}
        onScrollToLower={() => {
          if (activeLoading || !activeHasMore) return
          if (activeTab === 'avatars') void loadAvatars(avatarPage + 1, false)
          else void loadWorks(workPage + 1, false)
        }}
      >
        <View className="mf-main">
          {activeTab === 'avatars'
            ? renderCategories(avatarCategory, changeAvatarCategory)
            : renderCategories(workCategory, changeWorkCategory)}
          <View className="mf-list">
            {activeTab === 'avatars' ? renderAvatarList() : renderWorkList()}
          </View>
          {activeLoading && activeCount > 0 && <Text className="mf-load-text">加载中...</Text>}
          {!activeLoading && !activeHasMore && activeCount > 0 && <Text className="mf-load-text">已加载全部</Text>}
        </View>
      </ScrollView>
    </View>
  )
}