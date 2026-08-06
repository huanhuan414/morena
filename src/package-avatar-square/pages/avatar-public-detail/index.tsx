import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  Heart,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'

import './index.css'

type AvatarPreview = {
  id: number
  userId: string
  avatarName: string
  avatarUrl: string
  description: string
  tags: string[]
  skillType: string
  useCount: number
  workCount: number
  viewCount: number
  favoriteCount: number
}

type WorkCategory = '全部' | '图片' | '图文' | '文字' | '视频'

type WorkPreview = {
  id: number
  category: string
  title: string
  description: string
  price: string
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
  favoriteCount: number
  isFavorited: boolean
  templateId: number
}

const WORK_CATEGORIES: WorkCategory[] = ['全部', '图片', '图文', '文字', '视频']

const WORK_BACKGROUNDS = [
  'tone-1',
  'tone-2',
  'tone-3',
  'tone-4',
  'tone-5',
  'tone-6',
]

const parsePreview = (value?: string): AvatarPreview | null => {
  if (!value) return null

  try {
    return JSON.parse(decodeURIComponent(value)) as AvatarPreview
  } catch {
    try {
      return JSON.parse(value) as AvatarPreview
    } catch {
      return null
    }
  }
}

const formatCount = (value: number) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 1 : 2).replace(/\.0+$/, '')}w`
  }
  return value.toLocaleString('zh-CN')
}

export default function AvatarPublicDetailPage() {
  const router = useRouter()
  const currentUserId = useUserStore(state => state.userInfo?.id)
  const preview = parsePreview(router.params.preview)
  const detailId = router.params.id || String(preview?.id || '')
  const [avatar, setAvatar] = useState<AvatarPreview | null>(preview)
  const [loadFailed, setLoadFailed] = useState(!detailId)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [headHeight, setHeadHeight] = useState(0)
  const [selectedWorkCategory, setSelectedWorkCategory] = useState<WorkCategory>('全部')
  const [works, setWorks] = useState<WorkPreview[]>([])
  const [worksLoading, setWorksLoading] = useState(Boolean(detailId))
  const [previewWork, setPreviewWork] = useState<WorkPreview | null>(null)
  const [workPreviewOpen, setWorkPreviewOpen] = useState(false)
  const favoritePendingIdsRef = useRef(new Set<number>())
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight || 20

  useEffect(() => {
    if (!detailId) return

    const loadDetail = async () => {
      setLoadFailed(false)
      try {
        const res = await Network.request({
          url: `/api/avatar-square/${encodeURIComponent(detailId)}`,
        })
        console.log('[AvatarPublicDetailPage] avatar detail response:', res.data)
        const responseBody = res.data as { data?: AvatarPreview | null }
        if (responseBody?.data) {
          setAvatar(responseBody.data)
        } else {
          setLoadFailed(true)
        }
      } catch (error) {
        console.error('[AvatarPublicDetailPage] load avatar detail failed:', error)
        setLoadFailed(true)
      }
    }

    void loadDetail()
  }, [detailId])
  useEffect(() => {
    if (!detailId) {
      setWorks([])
      setWorksLoading(false)
      return
    }

    let active = true
    const loadWorks = async () => {
      setWorksLoading(true)
      try {
        const res = await Network.request({
          url: `/api/avatar-square/${encodeURIComponent(detailId)}/works`,
          ...(selectedWorkCategory === '全部'
            ? {}
            : { data: { category: selectedWorkCategory } }),
        })
        console.log('[AvatarPublicDetailPage] avatar works response:', res.data)
        const responseBody = res.data as { data?: WorkPreview[] }
        if (active) {
          setWorks(Array.isArray(responseBody?.data) ? responseBody.data : [])
        }
      } catch (error) {
        console.error('[AvatarPublicDetailPage] load avatar works failed:', error)
        if (active) setWorks([])
      } finally {
        if (active) setWorksLoading(false)
      }
    }

    void loadWorks()
    return () => {
      active = false
    }
  }, [detailId, selectedWorkCategory])
  useEffect(() => {
    if (!avatar) return

    Taro.nextTick(() => {
      Taro.createSelectorQuery()
        .select('.od-head')
        .boundingClientRect((rect) => {
          const result = Array.isArray(rect) ? rect[0] : rect
          const height = Number(result?.height || 0)
          if (height > 0) setHeadHeight(height)
        })
        .exec()
    })
  }, [avatar])

  const pageStyle = {
    '--avatar-public-status-bar': `${statusBarHeight - 17}px`,
    ...(headHeight > 0
      ? { '--avatar-public-head-height': `${headHeight}px` }
      : {}),
  } as CSSProperties

  const recordWorkView = (workId: number) => {
    void Network.request({
      url: `/api/generated-works/${workId}/view`,
      method: 'POST',
      data: { source: 'avatar_public_detail' },
    }).then((res) => {
      const responseBody = res.data as { code?: number; msg?: string }
      if (responseBody?.code && responseBody.code !== 200) {
        console.warn('[AvatarPublicDetailPage] record work view rejected:', responseBody.msg)
      }
    }).catch((error) => {
      console.warn('[AvatarPublicDetailPage] record work view failed:', error)
    })
  }

  const previewImages = (work: WorkPreview) => {
    if (work.images.length === 0) return
    void Taro.previewImage({
      current: work.images[0],
      urls: work.images,
    }).then(() => recordWorkView(work.id)).catch((error) => {
      console.warn('[AvatarPublicDetailPage] preview image failed:', error)
    })
  }

  const openWorkPreview = (work: WorkPreview) => {
    if (work.category === '图片') {
      previewImages(work)
      return
    }
    if (work.category === '图文') {
      void Taro.navigateTo({
        url: `/package-avatar-square/pages/avatar-work-detail/index?id=${work.id}&scope=public`,
        success: () => recordWorkView(work.id),
      })
      return
    }
    if (work.category === '视频') {
      if (!work.videoUrl) {
        void Taro.showToast({
          title: '暂无视频内容',
          icon: 'none',
        })
        return
      }
      void Taro.previewMedia({
        current: 0,
        sources: [{ url: work.videoUrl, type: 'video' }],
      }).then(() => recordWorkView(work.id)).catch((error) => {
        console.warn('[AvatarPublicDetailPage] preview video failed:', error)
      })
      return
    }
    recordWorkView(work.id)
    setPreviewWork(work)
    setWorkPreviewOpen(true)
  }

  const toggleFavoriteWork = async (work: WorkPreview) => {
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
  const copyPreviewWorkContent = async () => {
    const title = previewWork?.contentTitle || previewWork?.title || ''
    const content = previewWork?.contentText || ''
    const fullContent = [title, content].filter(Boolean).join('\n\n')
    if (!fullContent) {
      void Taro.showToast({ title: '暂无可复制内容', icon: 'none' })
      return
    }

    try {
      await Taro.setClipboardData({ data: fullContent })
      void Taro.showToast({ title: '内容已复制', icon: 'success' })
    } catch (error) {
      console.error('[AvatarPublicDetailPage] copy work content failed:', error)
      void Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  if (!avatar) {
    return (
      <View className="od-page" style={pageStyle}>
        <View className="od-state">
          {loadFailed ? (
            <Text className="od-empty">暂无分身数据</Text>
          ) : (
            <View className="od-skeletons">
              <Skeleton className="od-skel-avatar" />
              <Skeleton className="od-skel-line" />
              <Skeleton className="od-skel-line is-short" />
            </View>
          )}
        </View>
      </View>
    )
  }

  const hasLongDescription = avatar.description.trim().length > 36

  return (
    <View className="od-page" style={pageStyle}>
      <View className="od-head">
        <View className="od-deco" />
        <View className="od-nav">
          <Button
            variant="outline"
            size="icon"
            className="od-icon-btn"
            onClick={() => Taro.navigateBack()}
          >
            <ArrowLeft size={18} color="#6D4CD8" />
          </Button>
        </View>

        <View className="od-hero">
          <View className="od-avatar">
            {avatar.avatarUrl ? (
              <Image src={avatar.avatarUrl} mode="aspectFill" className="od-fill" />
            ) : (
              <View className="od-fallback">
                <Text className="od-fallback-initial">
                  {avatar.avatarName.charAt(0).toUpperCase()}
                </Text>
                <Sparkles className="od-fallback-icon" size={20} color="rgba(155,122,232,0.5)" />
              </View>
            )}
          </View>

          <View className="od-info">
            <View className="od-title-row">
              <View className="od-title-main">
                <Text className="od-name">{avatar.avatarName}</Text>
                {/* <BadgeCheck size={16} color="#6D4CD8" /> */}
              </View>
              <View className="od-actions">
                <Button variant="outline" size="sm" className="od-share">
                  <Share2 size={12} color="#6D4CD8" />
                  <Text>分享</Text>
                </Button>
                {/* <Button variant="outline" size="icon" className="od-more">
                <MoreHorizontal size={14} color="#6D4CD8" />
              </Button> */}
              </View>
            </View>
            {avatar.skillType && (
              <Badge variant="secondary" className="od-tag">
                <Text>{avatar.skillType}</Text>
              </Badge>
            )}
            <View className="od-tags">
              <Text className="od-tags-text">{avatar.tags.join(' · ')}</Text>
            </View>
            <View className="od-desc-wrap">
              <Text
                className="od-desc"
                onClick={hasLongDescription ? () => setDescriptionOpen(true) : undefined}
              >
                {avatar.description}
              </Text>
              {hasLongDescription && (
                <View className="od-desc-foot">
                  <Button
                    variant="link"
                    size="sm"
                    className="od-desc-more"
                    onClick={() => setDescriptionOpen(true)}
                  >
                    <Text>查看全部</Text>
                  </Button>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="od-scroll">
        <View className="od-main">
          <View className="od-stats-wrap">
            <Card className="od-card">
              <CardContent className="od-stats">
                {[
                  { label: '累计调用', value: formatCount(avatar.useCount) },
                  { label: '作品数量', value: formatCount(avatar.workCount) },
                  { label: '浏览量', value: formatCount(avatar.viewCount) },
                  { label: '收藏量', value: formatCount(avatar.favoriteCount) },
                ].map(item => (
                  <View key={item.label} className="od-stat">
                    <Text className="od-stat-value">{item.value}</Text>
                    <Text className="od-stat-label">{item.label}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          </View>

          <View className="od-work-wrap">
            <Card className="od-card">
              <CardContent className="od-pad">
                <Text className="od-heading">精品模版文案</Text>
                {/* <ScrollView scrollX showScrollbar={false} className="od-cat-scroll">
                  <View className="od-cat-row">
                    {WORK_CATEGORIES.map(category => (
                      <Button
                        key={category}
                        size="sm"
                        variant={selectedWorkCategory === category ? 'default' : 'secondary'}
                        className={`od-cat${selectedWorkCategory === category ? ' is-on' : ''}`}
                        onClick={() => setSelectedWorkCategory(category)}
                      >
                        <Text>{category}</Text>
                      </Button>
                    ))}
                  </View>
                </ScrollView> */}

                <View className="od-grid">
                  {worksLoading ? (
                    [0, 1, 2].map(item => (
                      <Skeleton key={item} className="od-cover" />
                    ))
                  ) : works.length > 0 ? (
                    works.map((work, index) => (
                      <Card key={work.id} className="od-work-card">
                        <CardContent className="od-no-pad">
                          <View
                            className={`od-cover ${WORK_BACKGROUNDS[index % WORK_BACKGROUNDS.length]}${work.category === '文字' ? ' is-text' : ''}`}
                            onClick={() => openWorkPreview(work)}
                          >
                            {(work.category === '图片' || work.category === '图文') && work.images[0] ? (
                              <Image src={work.images[0]} mode="aspectFill" className="od-cover-img" />
                            ) : work.category === '视频' && work.videoCoverUrl ? (
                              <>
                                <Image src={work.videoCoverUrl} mode="aspectFill" className="od-cover-img" />
                                <View className="od-play">
                                  <Play size={22} color="#FFFFFF" filled />
                                </View>
                              </>
                            ) : (
                              <View className="od-cover-empty">
                                {work.category === '文字' && work.contentText ? (
                                  <Text className="od-text-preview">{work.contentText}</Text>
                                ) : work.category === '视频' ? (
                                  <View className="od-play">
                                    <Play size={22} color="#FFFFFF" filled />
                                  </View>
                                ) : (
                                  <Sparkles size={24} color="#FFFFFF" />
                                )}
                              </View>
                            )}
                            <Badge className="od-type">
                              <Text>{work.category}</Text>
                            </Badge>
                          </View>
                          <View className="od-work-body">
                            <Text className="od-work-title">{work.title}</Text>
                            <Text className="od-work-desc">{work.description}</Text>
                            <Text className="od-price">{work.price}</Text>
                            <View className="od-work-actions">
                              <Button
                                variant="outline"
                                size="sm"
                                className={`od-work-btn is-favorite${work.isFavorited ? ' is-active' : ''}`}
                                onClick={() => void toggleFavoriteWork(work)}
                              >
                                <Heart size={13} color="#EF4444" filled={work.isFavorited} />
                                <Text>{work.isFavorited ? '已收藏' : '收藏'}</Text>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="od-work-btn"
                                onClick={() => {
                                  if (!work.templateId) {
                                    void Taro.showToast({ title: '该作品暂无关联模版', icon: 'none' })
                                    return
                                  }
                                  void Taro.navigateTo({
                                    url: `/package-my-avatar/pages/template-use/index?templateId=${encodeURIComponent(String(work.templateId))}&avatarId=${encodeURIComponent(detailId)}`,
                                  })
                                }}
                              >
                                <Text>使用模版</Text>
                              </Button>

                            </View>
                          </View>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Text className="od-work-desc">暂无公开作品</Text>
                  )}
                </View>
              </CardContent>
            </Card>
          </View>
        </View>
      </ScrollView>
      <Dialog open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <DialogContent className="od-desc-dialog" overlayClassName="od-desc-overlay">
          <DialogHeader>
            <DialogTitle className="od-dialog-title">
              <Text>分身描述</Text>
            </DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="od-desc-scroll">
            <Text className="od-desc-full">{avatar.description}</Text>
          </ScrollView>
        </DialogContent>
      </Dialog>
      <Dialog open={workPreviewOpen} onOpenChange={setWorkPreviewOpen}>
        <DialogContent className="od-work-dialog" overlayClassName="od-work-overlay">
          <DialogHeader>
            <DialogTitle className="od-dialog-title">
              <Text>文字详情</Text>
            </DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="od-work-scroll">
            <View className="od-copy-content" onClick={() => void copyPreviewWorkContent()}>
              <Text className="od-copy-title">
                {previewWork?.contentTitle || previewWork?.title || '无标题'}
              </Text>
              <Text className="od-text-full">
                {previewWork?.contentText || '暂无文字内容'}
              </Text>
              <Text className="od-copy-hint">点击复制全部标题和内容</Text>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  )
}
