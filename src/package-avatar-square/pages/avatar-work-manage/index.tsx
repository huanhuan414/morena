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
  Trash2,
  WandSparkles,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import logoImage from '@/static/logo.jpg'

import './index.css'

type PublicStatusFilter = 'all' | '公开' | '私有'
type DisplayFilter = 'all' | 'shown' | 'hidden'
type WorkCategory = '全部' | '图片' | '图文' | '文字' | '视频'
type SortField = 'name' | 'publishedAt'
type SortDirection = 'asc' | 'desc'
type SortItem = { field: SortField; direction: SortDirection }
type WorkStatusField = 'publicStatus' | 'avatarAcceptStatus' | 'avatarAuthStatus'

type AvatarOption = {
  id: number
  avatarName: string
}

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
  avatarOptions?: AvatarOption[]
  list: ManagedWork[]
  page: number
  pageSize: number
  hasMore: boolean
}

const PUBLIC_STATUS_FILTERS: Array<{ value: PublicStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: '公开', label: '公开' },
  { value: '私有', label: '私有' },
]
const DISPLAY_FILTERS: Array<{ value: DisplayFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'shown', label: '展示' },
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
  const isProfileWorks = router.params.source === 'profileWorks'
  const [avatar, setAvatar] = useState<AvatarSummary | null>(null)
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([])
  const [avatarFilterId, setAvatarFilterId] = useState('all')
  const [publicStatusFilter, setPublicStatusFilter] = useState<PublicStatusFilter>('all')
  const [profileDisplayFilter, setProfileDisplayFilter] = useState<DisplayFilter>('all')
  const [squareDisplayFilter, setSquareDisplayFilter] = useState<DisplayFilter>('all')
  const [category, setCategory] = useState<WorkCategory>('全部')
  const [sorts, setSorts] = useState<SortItem[]>([{ field: 'name', direction: 'desc' }])
  const [works, setWorks] = useState<ManagedWork[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [textWork, setTextWork] = useState<ManagedWork | null>(null)
  const [statusUpdatingKey, setStatusUpdatingKey] = useState('')

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
      if (isProfileWorks && avatarFilterId !== 'all') data.filterAvatarId = avatarFilterId
      if (publicStatusFilter !== 'all') data.publicStatus = publicStatusFilter
      if (profileDisplayFilter !== 'all') data.profileDisplay = profileDisplayFilter
      if (squareDisplayFilter !== 'all') data.squareDisplay = squareDisplayFilter
      if (isProfileWorks && category !== '全部') data.category = category

      const res = await Network.request({
        url: '/api/avatar-square/manage/works',
        data,
      })
      const body = res.data as { code?: number; msg?: string; data?: ManagedWorksData | null }
      if (body?.code !== 200 || !body.data) {
        throw new Error(body?.msg || '查询失败')
      }

      setAvatar(body.data.avatar)
      setAvatarOptions(body.data.avatarOptions || [])
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
  }, [avatarFilterId, avatarId, category, isProfileWorks, profileDisplayFilter, publicStatusFilter, sorts, squareDisplayFilter])

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

  const openPreview1 = (work: ManagedWork) => {
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

  const openPreview = (work: ManagedWork) => {
    void Taro.navigateTo({
      url: `/package-avatar-square/pages/work-square-detail/index?id=${work.id}`,
    })
  }

  const confirmDeleteWork = async (work: ManagedWork) => {
    const modal = await Taro.showModal({
      title: '确认删除',
      content: `删除后无法恢复，确定要删除“${work.title || '该作品'}”吗？`,
      confirmText: '确定',
      cancelText: '取消',
      confirmColor: '#6D4CD8',
    })
    if (!modal.confirm) return

    try {
      const res = await Network.request({
        url: `/api/avatar-square/manage/works/${work.id}`,
        method: 'DELETE',
      })
      const body = res.data as { code?: number; msg?: string }
      if (body?.code !== 200) throw new Error(body?.msg || '删除失败')
      setWorks(current => current.filter(item => item.id !== work.id))
      void Taro.showToast({ title: '删除成功', icon: 'success' })
    } catch (error) {
      console.error('[AvatarWorkManagePage] delete work failed:', error)
      void Taro.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  }
  const updateWorkStatus = async (work: ManagedWork, field: WorkStatusField, checked: boolean) => {
    const nextValueMap: Record<WorkStatusField, string> = {
      publicStatus: checked ? '公开' : '私有',
      avatarAcceptStatus: checked ? '接受展示' : '拒绝展示',
      avatarAuthStatus: checked ? '展示' : '禁止展示',
    }
    const nextValue = nextValueMap[field]
    const updatingKey = `${work.id}:${field}`
    if (statusUpdatingKey === updatingKey) return

    setStatusUpdatingKey(updatingKey)
    setWorks(current => current.map(item => item.id === work.id ? { ...item, [field]: nextValue } : item))

    try {
      const res = await Network.request({
        url: `/api/avatar-square/manage/works/${work.id}/status`,
        method: 'PUT',
        data: { field, value: nextValue },
      })
      const body = res.data as {
        code?: number
        msg?: string
        data?: Pick<ManagedWork, 'id' | 'publicStatus' | 'avatarAcceptStatus' | 'avatarAuthStatus'> | null
      }
      if (body?.code !== 200 || !body.data) {
        throw new Error(body?.msg || '更新失败')
      }
      setWorks(current => current.map(item => item.id === work.id
        ? {
          ...item,
          publicStatus: body.data!.publicStatus,
          avatarAcceptStatus: body.data!.avatarAcceptStatus,
          avatarAuthStatus: body.data!.avatarAuthStatus,
        }
        : item))
    } catch (error) {
      setWorks(current => current.map(item => item.id === work.id ? work : item))
      void Taro.showToast({
        title: error instanceof Error ? error.message : '更新失败',
        icon: 'none',
      })
    } finally {
      setStatusUpdatingKey('')
    }
  }

  const handleUseTemplate = (work: ManagedWork) => {
    if (!work.templateId) {
      void Taro.showToast({ title: '该作品暂无可用模板', icon: 'none' })
      return
    }
    void Taro.navigateTo({
      url: `/package-my-avatar/pages/template-use/index?templateId=${work.templateId}&avatarId=${work.avatarId}`,
    })
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
    '--wm-toolbar-space': isProfileWorks ? '470rpx' : '410rpx',
  } as CSSProperties

  return (
    <View className="wm-page" style={pageStyle}>
      <View className="wm-fixed-head">
        <View className="wm-head">
          <Button variant="outline" size="icon" className="wm-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#6D4CD8" />
          </Button>
          <Text className="wm-head-title">{isProfileWorks ? '我的作品' : '作品管理'}</Text>
          <View className="wm-nav-space" />
        </View>
        {avatar && (
          <View className="wm-fixed-avatar">
            <Card className="wm-avatar-card">
              <CardContent className="wm-avatar-body">
                <View className="wm-avatar">
                  <Image src={avatar.avatarUrl || logoImage} mode="aspectFill" className="wm-fill" />
                </View>
                <View className="wm-avatar-info">
                  <Text className="wm-avatar-name">{avatar.avatarName}</Text>
                  <Text className="wm-avatar-desc">{isProfileWorks && avatar.description.startsWith('ID:') ? `ID: ${avatar.description.slice(3).slice(-8)}` : avatar.description}</Text>
                </View>
              </CardContent>
            </Card>
          </View>
        )}
        <View className="wm-sticky-tools">
          {isProfileWorks && (
            <View className="wm-cat-filter-row">
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
              <DropdownMenu>
                <DropdownMenuTrigger className={`wm-filter-select wm-avatar-filter${avatarFilterId !== 'all' ? ' is-on' : ''}`}>
                  <Text className="wm-avatar-filter-text">{avatarFilterId === 'all' ? '全部分身' : avatarOptions.find(item => String(item.id) === avatarFilterId)?.avatarName || '全部分身'}</Text>
                  <Text className="wm-filter-arrow">▼</Text>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="wm-filter-menu" align="end" sideOffset={6}>
                  <DropdownMenuItem
                    className={`wm-filter-option${avatarFilterId === 'all' ? ' is-on' : ''}`}
                    onClick={() => setAvatarFilterId('all')}
                  >
                    <Text>全部分身</Text>
                  </DropdownMenuItem>
                  {avatarOptions.map(item => (
                    <DropdownMenuItem
                      key={item.id}
                      className={`wm-filter-option${avatarFilterId === String(item.id) ? ' is-on' : ''}`}
                      onClick={() => setAvatarFilterId(String(item.id))}
                    >
                      <Text>{item.avatarName || '分身' + item.id}</Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </View>
          )}

          <ScrollView scrollX showScrollbar={false} className="wm-filter-scroll">
            <View className="wm-filter-list">
              <DropdownMenu>
                <DropdownMenuTrigger className={`wm-filter-select${publicStatusFilter !== 'all' ? ' is-on' : ''}`}>
                  <Text>公开状态：{PUBLIC_STATUS_FILTERS.find(item => item.value === publicStatusFilter)?.label || '全部'}</Text>
                  <Text className="wm-filter-arrow">▼</Text>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="wm-filter-menu" align="start" sideOffset={6}>
                  {PUBLIC_STATUS_FILTERS.map(item => (
                    <DropdownMenuItem
                      key={item.value}
                      className={`wm-filter-option${publicStatusFilter === item.value ? ' is-on' : ''}`}
                      onClick={() => setPublicStatusFilter(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className={`wm-filter-select${profileDisplayFilter !== 'all' ? ' is-on' : ''}`}>
                  <Text>个人主页：{DISPLAY_FILTERS.find(item => item.value === profileDisplayFilter)?.label || '全部'}</Text>
                  <Text className="wm-filter-arrow">▼</Text>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="wm-filter-menu" align="start" sideOffset={6}>
                  {DISPLAY_FILTERS.map(item => (
                    <DropdownMenuItem
                      key={item.value}
                      className={`wm-filter-option${profileDisplayFilter === item.value ? ' is-on' : ''}`}
                      onClick={() => setProfileDisplayFilter(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className={`wm-filter-select${squareDisplayFilter !== 'all' ? ' is-on' : ''}`}>
                  <Text>动态广场：{DISPLAY_FILTERS.find(item => item.value === squareDisplayFilter)?.label || '全部'}</Text>
                  <Text className="wm-filter-arrow">▼</Text>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="wm-filter-menu" align="start" sideOffset={6}>
                  {DISPLAY_FILTERS.map(item => (
                    <DropdownMenuItem
                      key={item.value}
                      className={`wm-filter-option${squareDisplayFilter === item.value ? ' is-on' : ''}`}
                      onClick={() => setSquareDisplayFilter(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
        </View>

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
              {/* <Text className="wm-note">每个作品可独立设置展示到个人主页和分身动态广场</Text> */}

              <View className="wm-list">
                {works.map(work => {
                  return (
                    <Card key={work.id} className="wm-work-card">
                      <CardContent className="wm-work-body">
                        <View className="wm-work-top">
                          <View className={`wm-cover${work.category === '文字' ? ' is-text' : ''}`} onClick={() => openPreview(work)}>
                            {renderCover(work)}
                            <Badge className="wm-type"><Text>{work.category}</Text></Badge>
                          </View>

                          <View className="wm-work-info" onClick={() => openPreview(work)}>
                            <Text className="wm-work-title">{work.title || `作品 ${work.id}`}</Text>
                            <Text className="wm-category-pill">{work.category}</Text>
                            <View className="wm-stats">
                              <View className="wm-stat"><Eye size={13} color="#94A3B8" /><Text>{formatCount(work.viewCount)}</Text></View>
                              <View className="wm-stat"><Heart size={13} color="#94A3B8" /><Text>{formatCount(work.favoriteCount)}</Text></View>
                              <View className="wm-stat"><Coins size={13} color="#94A3B8" /><Text>{work.generatedPayPoints}积分</Text></View>
                            </View>
                            {/* <Text className="wm-date">发布时间：{work.publishedAt ? formatDate(work.publishedAt) : '未发布'}</Text> */}
                          </View>

                          <View className="wm-statuses">
                            <View className="wm-status-line">
                              <Text>{work.publicStatus || '私有'}</Text>
                              <Switch className="wm-switch" checked={work.publicStatus === '公开'} disabled={statusUpdatingKey === `${work.id}:publicStatus`} onCheckedChange={checked => void updateWorkStatus(work, 'publicStatus', checked)} />
                            </View>
                            <View className="wm-status-line">
                              <Text>个人主页</Text>
                              <Switch className="wm-switch" checked={work.avatarAcceptStatus === '接受展示'} disabled={statusUpdatingKey === `${work.id}:avatarAcceptStatus`} onCheckedChange={checked => void updateWorkStatus(work, 'avatarAcceptStatus', checked)} />
                            </View>
                            <View className="wm-status-line">
                              <Text>动态广场</Text>
                              <Switch className="wm-switch" checked={work.avatarAuthStatus === '展示'} disabled={statusUpdatingKey === `${work.id}:avatarAuthStatus`} onCheckedChange={checked => void updateWorkStatus(work, 'avatarAuthStatus', checked)} />
                            </View>
                          </View>
                        </View>

                        <View className="wm-actions">
                          <Button variant="ghost" size="sm" className="wm-delete" onClick={() => void confirmDeleteWork(work)}>
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


    </View>
  )
}
