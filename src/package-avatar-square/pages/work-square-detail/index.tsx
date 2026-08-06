import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, Eye, Heart, Play, Sparkles, WandSparkles } from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { WorkContentView } from '../../components/work-content-view'

import './index.css'

type WorkDetail = {
  id: number
  avatarId: number
  avatarName: string
  avatarUrl: string
  avatarSkillType: string
  avatarFavoriteCount: number
  isAvatarFavorited: boolean
  category: string
  title: string
  description: string
  generatedPayPoints: number
  publishedAt: string | null
  viewCount: number
  favoriteCount: number
  successItemCount: number
  isFavorited: boolean
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
}

const SCENES = ['短视频创作', '品牌宣传', '生活记录', '文案营销']

const formatCount = (value: number) => {
  const count = Number(value || 0)
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}w`
  return count.toLocaleString('zh-CN')
}

const formatPublishedAt = (value: string | null) => {
  if (!value) return '暂未发布'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂未发布'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function WorkSquareDetailPage() {
  const router = useRouter()
  const workId = router.params.id || ''
  const currentUserId = useUserStore(state => state.userInfo?.id)
  const [work, setWork] = useState<WorkDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(workId))
  const [loadFailed, setLoadFailed] = useState(!workId)
  const avatarFavoritePendingRef = useRef(false)
  const workFavoritePendingRef = useRef(false)
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = {
    '--wsd-status-height': `${statusBarHeight}px`,
  } as CSSProperties

  useEffect(() => {
    if (!workId) return

    let active = true
    const recordView = async (id: number) => {
      try {
        const res = await Network.request({
          url: `/api/generated-works/${id}/view`,
          method: 'POST',
          data: { source: 'avatar_square' },
        })
        const responseBody = res.data as { data?: { viewCount?: number } | null }
        const viewCount = responseBody?.data?.viewCount
        if (active && typeof viewCount === 'number') {
          setWork(current => current ? { ...current, viewCount } : current)
        }
      } catch (error) {
        console.warn('[WorkSquareDetailPage] record work view failed:', error)
      }
    }

    const loadDetail = async () => {
      setLoading(true)
      setLoadFailed(false)
      try {
        const res = await Network.request({
          url: `/api/avatar-square/work-square/${encodeURIComponent(workId)}`,
        })
        console.log('[WorkSquareDetailPage] detail response:', res.data)
        const responseBody = res.data as { data?: WorkDetail | null }
        if (!active) return
        if (responseBody?.data) {
          setWork(responseBody.data)
          void recordView(responseBody.data.id)
        } else {
          setLoadFailed(true)
        }
      } catch (error) {
        console.error('[WorkSquareDetailPage] load detail failed:', error)
        if (active) setLoadFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [workId])

  const previewImages = (current?: string) => {
    if (!work || work.images.length === 0) {
      void Taro.showToast({ title: '暂无图片内容', icon: 'none' })
      return
    }
    void Taro.previewImage({ current: current || work.images[0], urls: work.images })
  }

  const previewVideo = () => {
    if (!work?.videoUrl) {
      void Taro.showToast({ title: '暂无视频内容', icon: 'none' })
      return
    }
    void Taro.previewMedia({
      current: 0,
      sources: [{ url: work.videoUrl, type: 'video' }],
    })
  }

  const toggleAvatarFavorite = async () => {
    if (!work || avatarFavoritePendingRef.current) return
    if (!currentUserId) {
      void Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const previous = work
    const nextIsFavorited = !work.isAvatarFavorited
    avatarFavoritePendingRef.current = true
    setWork({
      ...work,
      isAvatarFavorited: nextIsFavorited,
      avatarFavoriteCount: Math.max(0, work.avatarFavoriteCount + (nextIsFavorited ? 1 : -1)),
    })

    try {
      const res = await Network.request({
        url: `/api/avatar-square/${work.avatarId}/favorite`,
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
      setWork(current => current ? {
        ...current,
        isAvatarFavorited: responseBody.data!.isFavorited,
        avatarFavoriteCount: responseBody.data!.favoriteCount,
      } : current)
    } catch (error) {
      setWork(previous)
      void Taro.showToast({
        title: error instanceof Error ? error.message : '收藏操作失败',
        icon: 'none',
      })
    } finally {
      avatarFavoritePendingRef.current = false
    }
  }

  const toggleWorkFavorite = async () => {
    if (!work || workFavoritePendingRef.current) return
    if (!currentUserId) {
      void Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const previous = work
    const nextIsFavorited = !work.isFavorited
    workFavoritePendingRef.current = true
    setWork({
      ...work,
      isFavorited: nextIsFavorited,
      favoriteCount: Math.max(0, work.favoriteCount + (nextIsFavorited ? 1 : -1)),
    })

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
      setWork(current => current ? {
        ...current,
        isFavorited: responseBody.data!.isFavorited,
        favoriteCount: responseBody.data!.favoriteCount,
      } : current)
    } catch (error) {
      setWork(previous)
      void Taro.showToast({
        title: error instanceof Error ? error.message : '收藏操作失败',
        icon: 'none',
      })
    } finally {
      workFavoritePendingRef.current = false
    }
  }

  const renderMedia = () => {
    if (!work) return null

    // if (work.category === '文字' || work.category === '图文') {
    //   return (
    //     <View className="wsd-content-preview">
    //       <WorkContentView work={work} mode="preview" onClick={openContentDetail} />
    //     </View>
    //   )
    // }

    if (work.category === '文字') {
      return (
        <View className="wsd-media is-text">
          {/* <Badge variant="secondary" className="wsd-media-type"><Text>文字</Text></Badge> */}
          <Text className="wsd-text-content">{work.contentText || work.description || '暂无文字内容'}</Text>
          {/* <Sparkles className="wsd-text-spark" size={26} color="#C084FC" /> */}
        </View>
      )
    }

    if (work.category === '视频') {
      return (
        <View className="wsd-media is-video">
          {work.videoCoverUrl ? (
            <Image src={work.videoCoverUrl} mode="aspectFill" className="wsd-media-image" />
          ) : (
            <View className="wsd-media-empty"><Sparkles size={38} color="#FFFFFF" /></View>
          )}
          {/* <Badge variant="secondary" className="wsd-media-type"><Text>视频</Text></Badge> */}
          <View className="wsd-play"><Play size={32} color="#FFFFFF" filled /></View>
        </View>
      )
    }

    return (
      <View className="wsd-media">
        {work.images[0] ? (
          <Image src={work.images[0]} mode="aspectFill" className="wsd-media-image" />
        ) : (
          <View className="wsd-media-empty"><Sparkles size={38} color="#FFFFFF" /></View>
        )}
        {/* <Badge variant="secondary" className="wsd-media-type"><Text>{work.category || '作品'}</Text></Badge> */}
        {/* {work.images.length > 1 && work.category === '图片' && (
          <View className="wsd-image-count"><Text>1/{work.images.length}</Text></View>
        )} */}
      </View>
    )
  }

  const openContentDetail = () => {
    if (!work) return
    void Taro.navigateTo({
      url: `/package-avatar-square/pages/work-content-detail/index?id=${work.id}`,
    })
  }

  const renderContentPreview = () => {
    if (!work) return null

    if (work.category === '文字' || work.category === '图文') {
      return (
        <View className="wsd-content-preview">
          <WorkContentView work={work} mode="preview" onClick={openContentDetail} />
        </View>
      )
    }

    if (work.category === '视频') {
      return (
        <View className="wsd-preview is-video" onClick={previewVideo}>
          {work.videoCoverUrl ? (
            <Image src={work.videoCoverUrl} mode="aspectFill" className="wsd-preview-image" />
          ) : (
            <View className="wsd-preview-empty"><Sparkles size={32} color="#FFFFFF" /></View>
          )}
          {/* <Badge variant="secondary" className="wsd-preview-type"><Text>视频</Text></Badge> */}
          <View className="wsd-preview-play"><Play size={24} color="#FFFFFF" filled /></View>
        </View>
      )
    }

    if (work.images.length > 1) {
      return (
        <View className="wsd-preview is-grid">
          {work.images.map((imageUrl, index) => (
            <Image
              key={`${imageUrl}-${index}`}
              src={imageUrl}
              mode="aspectFill"
              className="wsd-preview-grid-image"
              onClick={() => previewImages(imageUrl)}
            />
          ))}
        </View>
      )
    }

    return (
      <View className="wsd-preview" onClick={() => previewImages()}>
        {work.images[0] ? (
          <Image src={work.images[0]} mode="aspectFill" className="wsd-preview-image" />
        ) : (
          <View className="wsd-preview-empty"><Sparkles size={32} color="#8B5CF6" /></View>
        )}
        {/* <Badge variant="secondary" className="wsd-preview-type">
          <Text>{work.category || '作品'}</Text>
        </Badge> */}
        {/* <Text className="wsd-preview-hint">点击预览全部图片</Text> */}
      </View>
    )
  }
  const renderDetail = () => {
    if (!work) return null
    const highlight = work.description.trim()

    return (
      <View className="wsd-detail">
        <View className="wsd-hero">{renderMedia()}</View>
        <Card className="wsd-sheet">
          <CardContent className="wsd-sheet-body">
            <View className="wsd-avatar-row">
              <View className="wsd-author">
                <View className="wsd-avatar">
                  {work.avatarUrl ? (
                    <Image src={work.avatarUrl} mode="aspectFill" className="wsd-avatar-image" />
                  ) : (
                    <Sparkles size={20} color="#8B5CF6" />
                  )}
                </View>
                <View className="wsd-author-info">
                  <Text className="wsd-author-name">{work.avatarName || '匿名分身'}</Text>
                  <Text className="wsd-author-type">{work.avatarSkillType || 'AI分身'}</Text>
                </View>
              </View>
              <Button
                variant="outline"
                size="sm"
                className={`wsd-favorite${work.isAvatarFavorited ? ' is-active' : ''}`}
                onClick={() => void toggleAvatarFavorite()}
              >
                <Heart
                  size={14}
                  color={work.isAvatarFavorited ? '#EF4444' : '#7C3AED'}
                  filled={work.isAvatarFavorited}
                />
                <Text>{work.isAvatarFavorited ? '已收藏' : '收藏'}</Text>
              </Button>
            </View>

            <View className="wsd-summary">
              <View className="wsd-title-row">
                <Text className="wsd-work-title">{work.title || '无标题作品'}</Text>
                <Badge variant="secondary" className="wsd-category"><Text>{work.category || '作品'}</Text></Badge>
              </View>
              <Text className="wsd-description">{work.description || '暂无作品介绍'}</Text>
              <Text className="wsd-published">发布于 {formatPublishedAt(work.publishedAt)}</Text>
            </View>

            <View className="wsd-metrics">
              {[
                { label: '浏览量', value: formatCount(work.viewCount), icon: Eye },
                { label: '收藏量', value: formatCount(work.favoriteCount), icon: Heart },
                { label: '使用次数', value: formatCount(work.successItemCount), icon: WandSparkles },
              ].map(item => {
                const Icon = item.icon
                return (
                  <View key={item.label} className="wsd-metric">
                    <View className="wsd-metric-top">
                      <Icon size={15} color="#8B5CF6" />
                      <Text className="wsd-metric-label">{item.label}</Text>
                    </View>
                    <Text className="wsd-metric-value">{item.value}</Text>
                  </View>
                )
              })}
            </View>

            <View className="wsd-section">
              <Text className="wsd-section-title">作品亮点</Text>
              {highlight ? (
                <Text className="wsd-highlight">{highlight}</Text>
              ) : (
                <Text className="wsd-empty-text">暂无作品亮点</Text>
              )}
              {renderContentPreview()}
            </View>

            <View className="wsd-section">
              <Text className="wsd-section-title">适用场景</Text>
              <View className="wsd-scenes">
                {SCENES.map(scene => <Text key={scene} className="wsd-scene">{scene}</Text>)}
              </View>
            </View>
          </CardContent>
        </Card>
      </View>
    )
  }

  let body
  if (loading) {
    body = (
      <View className="wsd-loading">
        <Skeleton className="wsd-skeleton-media" />
        <Skeleton className="wsd-skeleton-sheet" />
      </View>
    )
  } else if (loadFailed || !work) {
    body = (
      <View className="wsd-empty-page">
        <Sparkles size={42} color="#C4B5FD" />
        <Text className="wsd-empty-title">作品暂时无法查看</Text>
        <Text className="wsd-empty-text">作品可能已下架或未通过审核</Text>
      </View>
    )
  } else {
    body = renderDetail()
  }

  return (
    <View className="wsd-page" style={pageStyle}>
      <View className="wsd-nav">
        <Button variant="outline" size="icon" className="wsd-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={19} color="#6D4CD8" />
        </Button>
      </View>
      <ScrollView scrollY className="wsd-scroll">{body}</ScrollView>
      {work && !loading && (
        <View className="wsd-bottom">
          <View className="wsd-bottom-price">
            <View className="wsd-price-row">
              <Text className="wsd-price-value">{formatCount(work.generatedPayPoints)}</Text>
              <Text className="wsd-price-unit">积分/次</Text>
            </View>
            <Text className="wsd-price-label">付费后可使用该模板</Text>
          </View>
          <Button className="wsd-use"><Text>使用模板</Text></Button>
          <Button variant="ghost" className="wsd-bottom-favorite" onClick={() => void toggleWorkFavorite()}>
            <Heart
              size={22}
              color={work.isFavorited ? '#EF4444' : '#7C3AED'}
              filled={work.isFavorited}
            />
            <Text>{work.isFavorited ? '已收藏' : '收藏'}</Text>
          </Button>
        </View>
      )}
    </View>
  )
}