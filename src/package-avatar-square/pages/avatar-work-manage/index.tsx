import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Coins,
  Eye,
  Heart,
  Image as ImageIcon,
  Play,
  Plus,
  Trash2,
  WandSparkles,
} from 'lucide-react-taro'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { formatDate } from '@/utils/time'

import './index.css'

type DisplayTab = 'all' | 'shown' | 'hidden'
type WorkCategory = '全部' | '图片' | '图文' | '文字' | '视频'
type SortField = 'name' | 'publishedAt'
type SortDirection = 'asc' | 'desc'
type SortItem = { field: SortField; direction: SortDirection }

type AvatarSummary = {
  id: number
  avatarName: string
  avatarUrl: string
  description: string
}

type ManagedWork = {
  id: number
  avatarId: number
  templateId: number
  category: string
  title: string
  description: string
  generatedPayPoints: number
  publishedAt: string | null
  viewCount: number
  favoriteCount: number
  publicStatus: string
  auditStatus: string
  avatarAuthStatus: string
  avatarAcceptStatus: string
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
}

type ManagedWorksData = {
  avatar: AvatarSummary | null
  list: ManagedWork[]
  page: number
  pageSize: number
  hasMore: boolean
}

const DISPLAY_TABS: Array<{ value: DisplayTab; label: string }> = [
  { value: 'all', label: '全部作品' },
  { value: 'shown', label: '已展示' },
  { value: 'hidden', label: '未展示' },
]
const WORK_CATEGORIES: WorkCategory[] = ['全部', '图片', '图文', '文字', '视频']
const SORT_LABELS: Record<SortField, string> = { name: '名称', publishedAt: '发布时间' }

const formatCount = (value: number) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 1 : 2).replace(/\.0+$/, '')}w`
  }
  return value.toLocaleString('zh-CN')
}

export default function AvatarWorkManagePage() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()
  const avatarId = router.params.avatarId || ''
  const [avatar, setAvatar] = useState<AvatarSummary | null>(null)
  const [displayTab, setDisplayTab] = useState<DisplayTab>('all')
  const [category, setCategory] = useState<WorkCategory>('全部')
  const [sorts, setSorts] = useState<SortItem[]>([{ field: 'name', direction: 'desc' }])
  const [works, setWorks] = useState<ManagedWork[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [textWork, setTextWork] = useState<ManagedWork | null>(null)
  const [deleteWork, setDeleteWork] = useState<ManagedWork | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchWorks = useCallback(async (nextPage: number, append: boolean) => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const data: Record<string, string | number> = {
        page: nextPage,
        pageSize: 20,
        sort: sorts.map(item => `${item.field}:${item.direction}`).join(','),
      }
      if (avatarId) data.avatarId = avatarId
      if (displayTab !== 'all') data.display = displayTab
      if (category !== '全部') data.category = category

      const res = await Network.request({
        url: '/api/avatar-square/manage/works',
        data,
      })
      const body = res.data as { code?: number; msg?: string; data?: ManagedWorksData | null }
      if (body?.code !== 200 || !body.data) {
        throw new Error(body?.msg || '查询失败')
      }

      setAvatar(body.data.avatar)
      setWorks(current => append ? [...current, ...body.data!.list] : body.data!.list)
      setPage(body.data.page)
      setHasMore(body.data.hasMore)
    } catch (error) {
      console.error('[AvatarWorkManagePage] load works failed:', error)
      if (!append) setWorks([])
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [avatarId, category, displayTab, sorts])

  useEffect(() => {
    void fetchWorks(1, false)
  }, [fetchWorks])

  const cycleSort = (field: SortField) => {
    setSorts(current => {
      const index = current.findIndex(item => item.field === field)
      if (index < 0) return [...current.slice(-1), { field, direction: 'desc' }]
      if (current[index].direction === 'desc') {
        return current.map(item => item.field === field ? { ...item, direction: 'asc' } : item)
      }
      const next = current.filter(item => item.field !== field)
      return next.length > 0 ? next : [{ field: 'name', direction: 'desc' }]
    })
  }

  const openPreview = (work: ManagedWork) => {
    if (work.category === '图片') {
      if (work.images.length > 0) {
        void Taro.previewImage({ current: work.images[0], urls: work.images })
      }
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
      void Taro.previewMedia({ current: 0, sources: [{ url: work.videoUrl, type: 'video' }] })
      return
    }
    setTextWork(work)
  }

  const confirmDelete = async () => {
    if (!deleteWork || deleting) return
    setDeleting(true)
    try {
      const res = await Network.request({
        url: `/api/avatar-square/manage/works/${deleteWork.id}`,
        method: 'DELETE',
      })
      const body = res.data as { code?: number; msg?: string }
      if (body?.code !== 200) throw new Error(body?.msg || '删除失败')
      setWorks(current => current.filter(item => item.id !== deleteWork.id))
      setDeleteWork(null)
      void Taro.showToast({ title: '删除成功', icon: 'success' })
    } catch (error) {
      console.error('[AvatarWorkManagePage] delete work failed:', error)
      void Taro.showToast({ title: '删除失败，请重试', icon: 'none' })
    } finally {
      setDeleting(false)
    }
  }

  const handleUseTemplate = (work: ManagedWork) => {
    if (!work.templateId) {
      void Taro.showToast({ title: '该作品暂无可用模板', icon: 'none' })
      return
    }
    void Taro.showToast({ title: '模板生成功能待接入', icon: 'none' })
  }
  const handlePublishWork = () => {
    void Taro.showToast({ title: '发布功能待接入', icon: 'none' })
  }

  const renderCover = (work: ManagedWork) => {
    if ((work.category === '图片' || work.category === '图文') && work.images[0]) {
      return <Image src={work.images[0]} mode="aspectFill" className="wm-cover-img" />
    }
    if (work.category === '视频') {
      return (
        <>
          {work.videoCoverUrl ? (
            <Image src={work.videoCoverUrl} mode="aspectFill" className="wm-cover-img" />
          ) : (
            <View className="wm-cover-fallback is-video" />
          )}
          <View className="wm-play"><Play size={26} color="#FFFFFF" filled /></View>
        </>
      )
    }
    if (work.category === '文字') {
      return (
        <View className="wm-text-cover">
          <Text className="wm-text-preview">{work.contentText || work.description || '暂无文字内容'}</Text>
        </View>
      )
    }
    return (
      <View className="wm-cover-fallback">
        <ImageIcon size={34} color="#9B7AE8" />
      </View>
    )
  }

  const pageStyle = {
    '--wm-status-top': `${statusBarHeight + 12}px`,
  } as CSSProperties

  return (
    <View className="wm-page" style={pageStyle}>
      <View className="wm-fixed-head">
        <View className="wm-head">
          <Button variant="outline" size="icon" className="wm-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#6D4CD8" />
          </Button>
          <Text className="wm-head-title">作品管理</Text>
          <View className="wm-nav-space" />
        </View>
        {avatar && (
          <View className="wm-fixed-avatar">
            <Card className="wm-avatar-card">
              <CardContent className="wm-avatar-body">
                <View className="wm-avatar">
                  {avatar.avatarUrl ? (
                    <Image src={avatar.avatarUrl} mode="aspectFill" className="wm-fill" />
                  ) : (
                    <View className="wm-avatar-empty"><ImageIcon size={30} color="#9B7AE8" /></View>
                  )}
                </View>
                <View className="wm-avatar-info">
                  <Text className="wm-avatar-name">{avatar.avatarName}</Text>
                  <Text className="wm-avatar-desc">{avatar.description}</Text>
                </View>
              </CardContent>
            </Card>
          </View>
        )}
      </View>

      <ScrollView
        scrollY
        className="wm-scroll"
        lowerThreshold={160}
        onScrollToLower={() => {
          if (hasMore && !loading) void fetchWorks(page + 1, true)
        }}
      >
        <View className="wm-main">

          <Card className="wm-list-card">
            <CardContent className="wm-list-body">
              <View className="wm-tabs">
                {DISPLAY_TABS.map(tab => (
                  <Button
                    key={tab.value}
                    variant="ghost"
                    className={`wm-tab${displayTab === tab.value ? ' is-on' : ''}`}
                    onClick={() => setDisplayTab(tab.value)}
                  >
                    <Text>{tab.label}</Text>
                  </Button>
                ))}
              </View>

              <ScrollView scrollX showScrollbar={false} className="wm-cat-scroll">
                <View className="wm-cats">
                  {WORK_CATEGORIES.map(item => (
                    <Button
                      key={item}
                      size="sm"
                      variant={category === item ? 'default' : 'secondary'}
                      className={`wm-cat${category === item ? ' is-on' : ''}`}
                      onClick={() => setCategory(item)}
                    >
                      <Text>{item}</Text>
                    </Button>
                  ))}
                </View>
              </ScrollView>

              <View className="wm-sort-row">
                <Text className="wm-sort-label">排序：</Text>
                {(['name', 'publishedAt'] as SortField[]).map(field => {
                  const index = sorts.findIndex(item => item.field === field)
                  const selected = index >= 0 ? sorts[index] : null
                  return (
                    <Button
                      key={field}
                      variant="ghost"
                      size="sm"
                      className={`wm-sort${selected ? ' is-on' : ''}`}
                      onClick={() => cycleSort(field)}
                    >
                      <Text>{SORT_LABELS[field]}</Text>
                      {selected && <Text className="wm-sort-order">{index + 1}</Text>}
                      {selected?.direction === 'asc'
                        ? <ArrowUp size={13} color="#6D4CD8" />
                        : <ArrowDown size={13} color={selected ? '#6D4CD8' : '#94A3B8'} />}
                    </Button>
                  )
                })}
              </View>

              <Text className="wm-note">每个作品可独立设置展示到个人主页和分身动态广场</Text>

              <View className="wm-list">
                {works.map(work => {
                  const isShown = work.publicStatus === '公开' && work.auditStatus === '审核通过'
                  return (
                    <Card key={work.id} className="wm-work-card">
                      <CardContent className="wm-work-body">
                        <View className="wm-work-top">
                          <View className={`wm-cover${work.category === '文字' ? ' is-text' : ''}`} onClick={() => openPreview(work)}>
                            {renderCover(work)}
                            <Badge className="wm-type"><Text>{work.category}</Text></Badge>
                          </View>

                          <View className="wm-work-info">
                            <Text className="wm-work-title">{work.title || `作品 ${work.id}`}</Text>
                            <View className="wm-stats">
                              <View className="wm-stat"><Eye size={13} color="#94A3B8" /><Text>{formatCount(work.viewCount)}</Text></View>
                              <View className="wm-stat"><Heart size={13} color="#94A3B8" /><Text>{formatCount(work.favoriteCount)}</Text></View>
                              <View className="wm-stat"><Coins size={13} color="#94A3B8" /><Text>{work.generatedPayPoints}积分</Text></View>
                            </View>
                            <Text className="wm-date">发布时间：{work.publishedAt ? formatDate(work.publishedAt) : '未发布'}</Text>
                          </View>

                          <View className="wm-statuses">
                            {isShown ? (
                              <>
                                <View className="wm-status-line">
                                  <Text>个人主页</Text>
                                  <Switch className="wm-switch" checked={work.avatarAcceptStatus === '接受展示'} disabled />
                                </View>
                                <View className="wm-status-line">
                                  <Text>分身动态广场</Text>
                                  <Switch className="wm-switch" checked={work.avatarAuthStatus === '展示'} disabled />
                                </View>
                              </>
                            ) : (
                              <>
                                <View className="wm-status-line">
                                  <Text>{work.publicStatus || '私有'}</Text>
                                  <Switch className="wm-switch" checked={work.publicStatus === '公开'} disabled />
                                </View>
                                <View className="wm-status-line">
                                  <Text>{work.auditStatus || '未提交'}</Text>
                                  <Switch className="wm-switch" checked={work.auditStatus === '审核通过'} disabled />
                                </View>
                              </>
                            )}
                          </View>
                        </View>

                        <View className="wm-actions">
                          <Button variant="ghost" size="sm" className="wm-delete" onClick={() => setDeleteWork(work)}>
                            <Trash2 size={14} color="#E85D75" />
                            <Text>删除作品</Text>
                          </Button>
                          <Button variant="secondary" size="sm" className="wm-use" onClick={() => handleUseTemplate(work)}>
                            <WandSparkles size={14} color="#6D4CD8" />
                            <Text>使用模板</Text>
                          </Button>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}

                {loading && works.length === 0 && [0, 1, 2].map(item => (
                  <Skeleton key={item} className="wm-skeleton" />
                ))}
                {!loading && works.length === 0 && (
                  <Text className="wm-empty">{loadFailed ? '作品加载失败，请稍后重试' : '暂无符合条件的作品'}</Text>
                )}
                {loading && works.length > 0 && <Text className="wm-more">正在加载更多...</Text>}
                {!hasMore && works.length > 0 && <Text className="wm-more">已经到底了</Text>}
              </View>
            </CardContent>
          </Card>
        </View>
      </ScrollView>

      <View className="wm-publish-bar">
        <Button className="wm-publish" onClick={handlePublishWork}>
          <View className="wm-publish-icon"><Plus size={24} color="#6D4CD8" /></View>
          <View className="wm-publish-copy">
            <Text className="wm-publish-title">发布新作品</Text>
            <Text className="wm-publish-sub">分享你的创意，让更多人看见</Text>
          </View>
        </Button>
      </View>
      <Dialog open={Boolean(textWork)} onOpenChange={open => { if (!open) setTextWork(null) }}>
        <DialogContent className="wm-text-dialog" overlayClassName="wm-overlay">
          <DialogHeader>
            <DialogTitle className="wm-dialog-title"><Text>{textWork?.title || '文字详情'}</Text></DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="wm-text-scroll">
            <Text className="wm-text-full">{textWork?.contentText || '暂无文字内容'}</Text>
          </ScrollView>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteWork)} onOpenChange={open => { if (!open && !deleting) setDeleteWork(null) }}>
        <AlertDialogContent className="wm-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="wm-delete-title"><Text>删除作品</Text></AlertDialogTitle>
            <AlertDialogDescription className="wm-delete-desc">
              <Text>确定删除“{deleteWork?.title || '该作品'}”吗？删除后将无法恢复。</Text>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="wm-delete-actions">
            <AlertDialogCancel className="wm-cancel"><Text>取消</Text></AlertDialogCancel>
            <AlertDialogAction className="wm-confirm" onClick={() => void confirmDelete()}>
              <Text>{deleting ? '删除中...' : '确认删除'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}