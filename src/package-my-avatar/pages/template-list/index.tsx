import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  Eye,
  Heart,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Network } from '@/network'

import './index.css'

type TemplateFilter = 'all' | 'pending' | 'enabled'

type TemplateItem = {
  id: number
  avatarId: number | null
  templateName: string
  templateDescription: string
  coverUrl: string
  skillType: string
  tags: string[]
  status: string
  displayStatus: string
  useCount: number
  favoriteCount: number
  creatorIncomePoints: number
  versionNo: number
  testedAt: string | null
  templateSource: string
}

type TemplateListData = {
  summary: {
    total: number
    pendingCount: number
    enabledCount: number
  }
  list: TemplateItem[]
}

type ApiResponse<T> = {
  code?: number
  msg?: string
  data?: T | null
}

const EMPTY_DATA: TemplateListData = {
  summary: { total: 0, pendingCount: 0, enabledCount: 0 },
  list: [],
}

const FILTERS: Array<{ value: TemplateFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待测试' },
  { value: 'enabled', label: '已启用' },
]

const formatCount = (value: number) => {
  const normalized = Number(value || 0)
  if (normalized >= 10000) {
    return `${(normalized / 10000).toFixed(normalized >= 100000 ? 1 : 2).replace(/\.0+$/, '')}w`
  }
  return normalized.toLocaleString('zh-CN')
}

/**
 * 模版列表页
 * 展示指定分身下的所有模版信息
 */
export default function TemplateListPage() {
  const router = useRouter()
  const avatarId = router.params.avatarId || ''
  const avatarName = decodeURIComponent(router.params.avatarName || '')

  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = {
    '--tpl-status-bar': `${statusBarHeight}px`,
  } as CSSProperties

  const [pageData, setPageData] = useState<TemplateListData>(EMPTY_DATA)
  const [selectedFilter, setSelectedFilter] = useState<TemplateFilter>('all')
  const [loading, setLoading] = useState(true)
  const loadRequestIdRef = useRef(0)

  const loadPage = useCallback(async (filter: TemplateFilter) => {
    if (!avatarId) return
    const requestId = ++loadRequestIdRef.current
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/ai-avatar/${encodeURIComponent(avatarId)}/template-list`,
        data: { filter },
      })
      console.log('[TemplateListPage] templates response:', res.data)
      const responseBody = res.data as ApiResponse<TemplateListData>
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '获取模版列表失败')
      }
      if (requestId !== loadRequestIdRef.current) return
      setPageData(responseBody.data)
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return
      console.error('[TemplateListPage] load failed:', error)
      setPageData(EMPTY_DATA)
      void Taro.showToast({
        title: error instanceof Error ? error.message : '获取失败',
        icon: 'none',
      })
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false)
    }
  }, [avatarId])

  useDidShow(() => {
    void loadPage(selectedFilter)
  })

  const changeFilter = (value: string) => {
    const nextFilter = value as TemplateFilter
    setSelectedFilter(nextFilter)
    void loadPage(nextFilter)
  }

  const goToDetail = (template: TemplateItem) => {
    void Taro.navigateTo({
      url: `/package-my-avatar/pages/template-detail/index?templateId=${encodeURIComponent(String(template.id))}&avatarId=${encodeURIComponent(avatarId)}`,
    })
  }

  const goToCertify = (template: TemplateItem) => {
    void Taro.navigateTo({
      url: `/package-my-avatar/pages/skill-certify/index?templateId=${encodeURIComponent(String(template.id))}&avatarId=${encodeURIComponent(avatarId)}`,
    })
  }

  const { summary } = pageData
  const filterCounts: Record<TemplateFilter, number> = {
    all: summary.total,
    pending: summary.pendingCount,
    enabled: summary.enabledCount,
  }

  return (
    <View className="tpl-page" style={pageStyle}>
      <View className="tpl-header">
        <Button variant="ghost" size="icon" className="tpl-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={19} color="#4C3B78" />
        </Button>
        <Text className="tpl-header-title">模版管理</Text>
        <View className="tpl-header-placeholder" />
      </View>

      <ScrollView scrollY className="tpl-scroll">
        <View className="tpl-content">
          <Card className="tpl-stats-card">
            <CardContent className="tpl-stats-grid">
              {[
                { label: '模版总数', value: formatCount(summary.total) },
                { label: '待测试', value: formatCount(summary.pendingCount) },
                { label: '已启用', value: formatCount(summary.enabledCount) },
              ].map(item => (
                <View key={item.label} className="tpl-stat-item">
                  <Text className="tpl-stat-value">{item.value}</Text>
                  <Text className="tpl-stat-label">{item.label}</Text>
                </View>
              ))}
            </CardContent>
          </Card>

          <Tabs value={selectedFilter} onValueChange={changeFilter} className="tpl-tabs">
            <TabsList className="tpl-tabs-list">
              {FILTERS.map(filter => (
                <TabsTrigger
                  key={filter.value}
                  value={filter.value}
                  className={`tpl-tab-trigger${selectedFilter === filter.value ? ' is-active' : ''}`}
                >
                  <Text>{filter.label}（{filterCounts[filter.value]}）</Text>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <View className="tpl-card-stack">
              {[1, 2, 3].map(item => <Skeleton key={item} className="tpl-card-skeleton" />)}
            </View>
          ) : pageData.list.length === 0 ? (
            <Card className="tpl-empty-card">
              <CardContent className="tpl-empty-content">
                <View className="tpl-empty-icon"><Layers size={28} color="#8B5CF6" /></View>
                <Text className="tpl-empty-title">暂无模版</Text>
                <Text className="tpl-empty-text">
                  {selectedFilter === 'all'
                    ? `${avatarName || '该分身'}还没有添加模版`
                    : `没有${FILTERS.find(f => f.value === selectedFilter)?.label || ''}的模版`}
                </Text>
              </CardContent>
            </Card>
          ) : (
            <View className="tpl-card-stack">
              {pageData.list.map(template => (
                <Card
                  key={template.id}
                  className="tpl-card"
                  onClick={() => goToDetail(template)}
                >
                  <CardContent className="tpl-card-content">
                    <View className="tpl-card-main">
                      <View className="tpl-cover-wrap">
                        {template.coverUrl ? (
                          <Image src={template.coverUrl} mode="aspectFill" className="tpl-cover-image" />
                        ) : (
                          <View className="tpl-cover-fallback">
                            {template.skillType === '视频生成' ? (
                              <Play size={28} color="#8B5CF6" />
                            ) : (
                              <Sparkles size={28} color="#8B5CF6" />
                            )}
                          </View>
                        )}
                        <View className="tpl-skill-badge">
                          <Text>{template.skillType}</Text>
                        </View>
                      </View>

                      <View className="tpl-info">
                        <View className="tpl-name-row">
                          <Text className="tpl-name">{template.templateName || '未命名模版'}</Text>
                          <Badge className={`tpl-status${template.status === '已启用' ? ' is-enabled' : ''}`}>
                            <Text>{template.status}</Text>
                          </Badge>
                        </View>

                        <Text className="tpl-desc">
                          {template.templateDescription || '暂无描述'}
                        </Text>

                        <View className="tpl-meta">
                          <View className="tpl-meta-item">
                            <Eye size={13} color="#94A3B8" />
                            <Text>{formatCount(template.useCount)}</Text>
                          </View>
                          <View className="tpl-meta-item">
                            <Heart size={13} color="#EF4444" />
                            <Text>{formatCount(template.favoriteCount)}</Text>
                          </View>
                          <Text className="tpl-income">
                            收益 {formatCount(template.creatorIncomePoints)} 积分
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="tpl-card-footer">
                      <Badge className={`tpl-display-tag${template.displayStatus === '对外展示' ? ' is-public' : ''}`}>
                        <Text>{template.displayStatus}</Text>
                      </Badge>
                      <Badge className="tpl-version-tag">
                        <Text>v{template.versionNo}</Text>
                      </Badge>
                      {template.testedAt && (
                        <Text className="tpl-tested-at">
                          认证于 {template.testedAt}
                        </Text>
                      )}
                    </View>

                    {template.status === '待测试' && (
                      <Button
                        className="tpl-certify-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          goToCertify(template)
                        }}
                      >
                        <Sparkles size={16} color="#FFFFFF" />
                        <Text>去认证测试</Text>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
