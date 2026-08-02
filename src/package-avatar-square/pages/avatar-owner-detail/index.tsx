import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CircleCheck,
  Eye,
  Image as ImageIcon,
  PenLine,
  Play,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Network } from '@/network'
import { formatDateTime, formatDate } from '@/utils/time'

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
  status: string
  updatedAt: string
  viewCount: number
  favoriteCount: number
  incomePointsTotal: number
}

type WorkCategory = '全部' | '图片' | '图文' | '文字' | '视频'

type WorkRow = {
  id: number
  title: string
  description: string
  category: string
  income: number
  updatedAt: string
  favoriteCount: number
  viewCount: number
  coverUrl: string
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
}

const WORK_CATEGORIES: WorkCategory[] = ['全部', '图片', '图文', '文字', '视频']

const QUICK_ACTIONS = [
  // { label: '订单管理', icon: Package },
  { label: '作品管理', icon: BookOpen },
  // { label: '数据看板', icon: BarChart3 },
  { label: '数据看板', icon: ShieldCheck },
  // { label: '邀请推广', icon: FileText },
  { label: '收益管理', icon: Wallet },
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

const formatCount = (value?: number) => {
  const normalizedValue = Number(value || 0)
  if (normalizedValue >= 10000) {
    return `${(normalizedValue / 10000).toFixed(normalizedValue >= 100000 ? 1 : 2).replace(/\.0+$/, '')}w`
  }
  return normalizedValue.toLocaleString('zh-CN')
}

export default function AvatarOwnerDetailPage() {
  const router = useRouter()
  const preview = parsePreview(router.params.preview)
  const detailId = router.params.id || String(preview?.id || '')
  const [avatar, setAvatar] = useState<AvatarPreview | null>(preview)
  const [workRows, setWorkRows] = useState<WorkRow[]>([])
  const [selectedWorkCategory, setSelectedWorkCategory] = useState<WorkCategory>('全部')
  const [previewWork, setPreviewWork] = useState<WorkRow | null>(null)
  const [workPreviewOpen, setWorkPreviewOpen] = useState(false)
  const [nameEditorOpen, setNameEditorOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [loadFailed, setLoadFailed] = useState(!detailId)
  const [headHeight, setHeadHeight] = useState(0)
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20

  useDidShow(() => {
    if (!detailId) return

    const loadDetail = async () => {
      setLoadFailed(false)
      try {
        const res = await Network.request({
          url: `/api/avatar-square/${encodeURIComponent(detailId)}/settings`,
        })
        const responseBody = res.data as { data?: AvatarPreview | null }
        const detail = responseBody?.data

        if (detail) {
          setAvatar(current => current ? { ...current, ...detail } : detail)
        } else {
          setLoadFailed(true)
        }
      } catch (error) {
        console.error('[AvatarOwnerDetailPage] load avatar detail failed:', error)
        setLoadFailed(true)
      }
    }

    void loadDetail()
  })

  useEffect(() => {
    if (!detailId) return

    let active = true
    const loadWorks = async () => {
      try {
        const res = await Network.request({
          url: `/api/avatar-square/${encodeURIComponent(detailId)}/owner-works`,
          ...(selectedWorkCategory === '全部'
            ? {}
            : { data: { category: selectedWorkCategory } }),
        })
        // console.log('[AvatarOwnerDetailPage] owner works response:', res.data)
        const responseBody = res.data as { data?: WorkRow[] }
        if (active) {
          setWorkRows(Array.isArray(responseBody?.data) ? responseBody.data : [])
        }
      } catch (error) {
        // console.error('[AvatarOwnerDetailPage] load owner works failed:', error)
        if (active) setWorkRows([])
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
        .select('.pd-head')
        .boundingClientRect((rect) => {
          const result = Array.isArray(rect) ? rect[0] : rect
          const height = Number(result?.height || 0)
          if (height > 0) setHeadHeight(height)
        })
        .exec()
    })
  }, [avatar])

  const navigateToSettings = () => {
    if (!detailId) return
    void Taro.navigateTo({
      url: '/package-avatar-square/pages/avatar-settings/index?id=' + encodeURIComponent(detailId),
    })
  }

  const openNameEditor = () => {
    if (!avatar) return
    setNameDraft(avatar.avatarName)
    setNameEditorOpen(true)
  }

  const saveAvatarName = async () => {
    const nextName = nameDraft.trim()
    if (!detailId || !avatar || savingName) return
    if (!nextName) {
      void Taro.showToast({ title: '请输入分身名称', icon: 'none' })
      return
    }
    if (nextName === avatar.avatarName) {
      setNameEditorOpen(false)
      return
    }

    setSavingName(true)
    try {
      const res = await Network.request({
        url: '/api/avatar-square/' + encodeURIComponent(detailId) + '/settings',
        method: 'PUT',
        data: { avatarName: nextName },
      })
      const responseBody = res.data as { code?: number; msg?: string; data?: AvatarPreview | null }
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '保存失败')
      }

      const updatedAvatar = responseBody.data
      setAvatar(current => current ? { ...current, ...updatedAvatar } : updatedAvatar)
      setNameEditorOpen(false)
      void Taro.showToast({ title: '名称已保存', icon: 'success' })
    } catch (error) {
      void Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
    } finally {
      setSavingName(false)
    }
  }

  const pageStyle = {
    '--avatar-owner-status-bar': `${statusBarHeight}px`,
    ...(headHeight > 0
      ? { '--avatar-owner-head-height': `${headHeight}px` }
      : {}),
  } as CSSProperties

  if (!avatar) {
    return (
      <View className="pd-page flex min-h-screen items-center justify-center" style={pageStyle}>
        <Text className="block text-sm text-slate-400">
          {loadFailed ? '暂无分身数据' : '正在加载分身数据...'}
        </Text>
      </View>
    )
  }

  const handlePreviewPublicPage = () => {
    const encodedPreview = encodeURIComponent(JSON.stringify(avatar))
    void Taro.navigateTo({
      url: `/package-avatar-square/pages/avatar-public-detail/index?preview=${encodedPreview}`,
    })
  }

  const handleViewAllWorks = () => {
    void Taro.navigateTo({
      url: `/package-avatar-square/pages/avatar-work-manage/index?avatarId=${avatar.id}`,
    })
  }

  const previewImages = (work: WorkRow) => {
    if (work.images.length === 0) return
    void Taro.previewImage({
      current: work.images[0],
      urls: work.images,
    })
  }

  const openWorkPreview = (work: WorkRow) => {
    if (work.category === '图片') {
      previewImages(work)
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
    setWorkPreviewOpen(true)
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
      console.error('[AvatarOwnerDetailPage] copy work content failed:', error)
      void Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  return (
    <View className="pd-page" style={pageStyle}>
      <View className="pd-head">
        <View className="pd-nav">
          <Button variant="ghost" size="icon" className="pd-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#4C3B78" />
          </Button>
        </View>

        <View className="pd-hero">
          <View className="pd-avatar">
            {avatar.avatarUrl ? (
              <Image src={avatar.avatarUrl} mode="aspectFill" className="pd-fill" />
            ) : (
              <View className="pd-fallback">
                <ImageIcon size={24} color="#8B6BE5" />
              </View>
            )}
          </View>
          <View className="pd-grow">
            <View className="pd-name-row" onClick={openNameEditor}>
              <Text className="pd-name">{avatar.avatarName}</Text>
              <PenLine size={14} color="#6D4CD8" />
            </View>
            <View className="pd-meta">
              <Badge variant="secondary" className="pd-tag">
                <Text>{avatar.skillType}</Text>
              </Badge>
              <Text className="pd-muted">ID：{avatar.id}</Text>
              <View className="pd-online">
                <CircleCheck size={12} color="#22C55E" />
                <Text className="pd-sub">{avatar.status}</Text>
              </View>
            </View>
            <View className="pd-actions pd-hero-actions">
              <Button variant="outline" size="sm" className="pd-act">
                <Share2 size={12} color="#6D4CD8" />
                <Text>分享分身</Text>
              </Button>
              <Button size="sm" className="pd-act is-primary" onClick={navigateToSettings}>
                <Settings size={12} color="#FFFFFF" />
                <Text>管理分身</Text>
              </Button>
            </View>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="pd-scroll">
        <View className="pd-main">
          <View className="pd-stack">
            <Card className="pd-card">
              <CardContent className="pd-pad">
                <View className="pd-sec-head">
                  <Text className="pd-title">分身数据概览</Text>
                  <Text className="pd-muted">{formatDateTime(avatar.updatedAt)}</Text>
                </View>
                <View className="pd-grid4">
                  {[
                    { label: '累计调用', value: formatCount(avatar.useCount) },
                    { label: '累计收益', value: formatCount(avatar.incomePointsTotal) },
                    { label: '收藏量', value: formatCount(avatar.viewCount) },
                    { label: '浏览量', value: formatCount(avatar.favoriteCount) },
                  ].map(item => (
                    <View key={item.label} className="pd-stat">
                      <Text className="pd-stat-label">{item.label}</Text>
                      <Text className="pd-stat-value">{item.value}</Text>
                      {/* <Text className="pd-stat-up">{item.sub}</Text> */}
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>

            <Card className="pd-card">
              <CardContent className="pd-pad">
                <Text className="pd-title">我的技能（单技能）</Text>
                <View className="pd-skill">
                  <View className="pd-skill-icon">
                    <Sparkles size={23} color="#22C55E" />
                  </View>
                  <View className="pd-grow">
                    <Text className="pd-title">{avatar.skillType}</Text>
                    <Text className="pd-desc">{avatar.description}</Text>
                  </View>
                  <Button variant="outline" size="sm" className="pd-manage">
                    <Text>模板管理</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>

            <Card className="pd-card">
              <CardContent className="pd-pad">
                <View className="pd-sec-head">
                  <Text className="pd-title">数据概览（近 7 天）</Text>
                  <View className="pd-online">
                    <Text className="pd-muted">查看更多</Text>
                    <ChevronRight size={13} color="#94A3B8" />
                  </View>
                </View>
                <View className="pd-grid4">
                  {[
                    { label: '调用次数', value: formatCount(avatar.viewCount) },
                    { label: '作品数量', value: '12.6w' },
                    { label: '收藏量', value: formatCount(avatar.incomePointsTotal) },
                    { label: '浏览量', value: formatCount(avatar.favoriteCount) },
                  ].map(item => (
                    <View key={item.label} className="pd-stat alt">
                      <Text className="pd-stat-label">{item.label}</Text>
                      <Text className="pd-stat-value">{item.value}</Text>
                      {/* <Text className="pd-up">较上月 11.5%</Text> */}
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>

            <Card className="pd-card">
              <CardContent className="pd-pad">
                <View className="pd-row">
                  <Text className="pd-title">作品总览</Text>
                  {/* <View className="pd-actions">
                    <Button variant="outline" size="sm" className="pd-sm-btn"><Text>全部状态</Text></Button>
                    <Button variant="outline" size="sm" className="pd-sm-btn"><Text>最新发布</Text></Button>
                  </View> */}
                </View>
                <View className="pd-cats">
                  {WORK_CATEGORIES.map(category => (
                    <Button
                      key={category}
                      size="sm"
                      variant={selectedWorkCategory === category ? 'default' : 'secondary'}
                      className={`pd-cat${selectedWorkCategory === category ? ' is-on' : ''}`}
                      onClick={() => setSelectedWorkCategory(category)}
                    >
                      <Text>{category}</Text>
                    </Button>
                  ))}
                </View>
                <Table className="pd-table">
                  <TableHeader className="pd-table-section">
                    <TableRow className="pd-table-head">
                      {['作品', '类型', '收益(积分)', '收藏', '浏览', '更新时间'].map(label => (
                        <TableHead key={label} className="pd-table-heading">
                          <Text className="pd-muted">{label}</Text>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="pd-table-section">
                    {workRows.map(work => (
                      <TableRow key={work.id} className="pd-table-row">
                        <TableCell className="pd-table-cell pd-work" onClick={() => openWorkPreview(work)}>
                          <View className={`pd-thumb${work.category === '文字' ? ' is-text' : ''}`}>
                            {(work.category === '图片' || work.category === '图文') && work.images[0] ? (
                              <Image src={work.images[0]} mode="aspectFill" className="pd-thumb-image" />
                            ) : work.category === '视频' && work.videoCoverUrl ? (
                              <>
                                <Image src={work.videoCoverUrl} mode="aspectFill" className="pd-thumb-image" />
                                <View className="pd-thumb-play">
                                  <Play size={10} color="#FFFFFF" filled />
                                </View>
                              </>
                            ) : work.category === '文字' && work.contentText ? (
                              <Text className="pd-thumb-text">{work.contentText}</Text>
                            ) : work.category === '视频' ? (
                              <View className="pd-thumb-play">
                                <Play size={10} color="#FFFFFF" filled />
                              </View>
                            ) : (
                              <Sparkles size={14} color="#FFFFFF" />
                            )}
                          </View>
                          <View className="pd-min">
                            <Text className="pd-work-title">{work.title}</Text>
                            <Text className="pd-stat-label">{work.description}</Text>
                          </View>
                        </TableCell>
                        <TableCell className="pd-table-cell"><Text className="pd-sub">{work.category}</Text></TableCell>
                        <TableCell className="pd-table-cell"><Text className="pd-cell-strong">{work.income}</Text></TableCell>
                        <TableCell className="pd-table-cell"><Text className="pd-sub">{formatCount(work.favoriteCount)}</Text></TableCell>
                        <TableCell className="pd-table-cell"><Text className="pd-sub">{formatCount(work.viewCount)}</Text></TableCell>
                        <TableCell className="pd-table-cell"><Text className="pd-sub">{formatDate(work.updatedAt)}</Text></TableCell>
                        {/* <TableCell className="pd-table-cell">
                          <Button variant="ghost" size="icon" className="pd-more"><MoreHorizontal size={14} color="#6D4CD8" /></Button>
                        </TableCell> */}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button variant="ghost" size="sm" className="pd-all" onClick={handleViewAllWorks}>
                  <Text>查看全部作品</Text>
                  <ChevronRight size={13} color="#6D4CD8" />
                </Button>
              </CardContent>
            </Card>

            <Card className="pd-card">
              <CardContent className="pd-pad">
                <Text className="pd-title">快捷功能</Text>
                <View className="pd-quick">
                  {QUICK_ACTIONS.map((item, index) => {
                    const QuickIcon = item.icon
                    return (
                      <View key={`${item.label}-${index}`} className="pd-quick-item">
                        <View className="pd-quick-icon">
                          <QuickIcon size={19} color="#6D4CD8" />
                        </View>
                        <Text className="pd-quick-label">{item.label}</Text>
                      </View>
                    )
                  })}
                </View>
              </CardContent>
            </Card>
          </View>
        </View>
      </ScrollView>

      <Dialog open={nameEditorOpen} onOpenChange={open => { if (!open && !savingName) setNameEditorOpen(false) }}>
        <DialogContent className="pd-name-dialog" overlayClassName="pd-work-overlay">
          <DialogHeader>
            <DialogTitle className="pd-dialog-title">
              <Text>修改分身名称</Text>
            </DialogTitle>
          </DialogHeader>
          <View className="pd-name-field">
            <Input
              value={nameDraft}
              className="pd-name-input"
              maxlength={50}
              placeholder="请输入分身名称"
              onInput={event => setNameDraft(event.detail.value)}
            />
            <Text className="pd-name-count">{nameDraft.length}/50</Text>
          </View>
          <View className="pd-name-actions">
            <Button
              variant="outline"
              className="pd-name-button"
              disabled={savingName}
              onClick={() => setNameEditorOpen(false)}
            >
              <Text>取消</Text>
            </Button>
            <Button
              className="pd-name-button is-primary"
              disabled={savingName}
              onClick={() => void saveAvatarName()}
            >
              <Text>{savingName ? '保存中...' : '保存'}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={workPreviewOpen} onOpenChange={setWorkPreviewOpen}>
        <DialogContent className="pd-work-dialog" overlayClassName="pd-work-overlay">
          <DialogHeader>
            <DialogTitle className="pd-dialog-title">
              <Text>文字详情</Text>
            </DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="pd-work-scroll">
            <View className="pd-copy-content" onClick={() => void copyPreviewWorkContent()}>
              <Text className="pd-copy-title">
                {previewWork?.contentTitle || previewWork?.title || '无标题'}
              </Text>
              <Text className="pd-text-full">
                {previewWork?.contentText || '暂无文字内容'}
              </Text>
              <Text className="pd-copy-hint">点击复制全部标题和内容</Text>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>

      <View
        className="pd-bar"
      >
        <Button variant="outline" className="pd-bar-btn" onClick={handlePreviewPublicPage}>
          <Eye size={18} color="#6D4CD8" />
          <View className="pd-left">
            <Text className="pd-bar-title">预览对外主页</Text>
            <Text className="pd-muted">查看用户外显展示效果</Text>
          </View>
        </Button>
        <Button className="pd-publish">
          <Plus size={20} color="#FFFFFF" />
          <View className="pd-left">
            <Text className="pd-bar-title">发布新作品</Text>
            <Text className="pd-publish-sub">分享到分身 触达更多人</Text>
          </View>
        </Button>
      </View>
    </View>
  )
}
