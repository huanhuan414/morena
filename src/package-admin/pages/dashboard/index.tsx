import { useState, useEffect, useRef } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { 
  Users, Bot, ShoppingCart, Wallet, TrendingUp, Eye, RefreshCw
} from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { canUseDOM, isH5 } from '@/lib/platform'
import * as Network from '@/network'
import './index.css'

interface DashboardStats {
  totalUsers: number
  totalAvatars: number
  totalOrders: number
  totalRevenue: number
  todayNewUsers: number
  todayOrders: number
  pendingOrders: number
  pendingContent: number
  acceptanceOverdue: number
  pendingDispatch: number
  dispatchExpiredToday: number
  awaitingAcceptance: number
}

interface CampaignConfig {
  enabled: number
  title: string
  description: string
  startAt: string
  endAt: string
}

interface CampaignStats {
  totalExposures: number
  totalClicks: number
  clickThroughRate: number
  daily: Array<{ day: string; exposures: number; clicks: number }>
}

type TrendMetric = 'newUsers' | 'orders' | 'revenue'

interface DashboardTrends {
  days: number
  totalNewUsers: number
  totalOrders: number
  totalRevenue: number
  daily: Array<{ day: string; newUsers: number; orders: number; revenue: number }>
}

interface MetricsRangeResolved {
  mode: 'days' | 'custom'
  days: number
  startAt: string
  endAt: string
}

interface AdminMetricsOverview {
  range: MetricsRangeResolved
  northStar: {
    verifiedGmv: number
    verifiedOrderCount: number
  }
  kpi: {
    totalOrders: number
    paidOrders: number | null
    totalGmv: number
    newUsers: number
    activeAvatars: number
  }
}

interface FunnelStep {
  key: string
  label: string
  count: number | null
  conversionFromPrev: number | null
}

interface AdminMetricsFunnel {
  range: MetricsRangeResolved
  demand: FunnelStep[]
  supply: FunnelStep[]
  flags: {
    ordersPaidSupported: boolean
    dispatchSettledSupported: boolean
  }
}

interface FailureReasonGroup {
  key: 'dispatch' | 'fulfillment' | 'verification' | 'settlement'
  label: string
  items: Array<{ reason: string; count: number }>
}

interface AdminFailureReasons {
  range: MetricsRangeResolved
  top: number
  groups: FailureReasonGroup[]
}

export default function AdminDashboard() {
  const showFunnel = false
  const showFailureReasons = false
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAvatars: 0,
    totalOrders: 0,
    totalRevenue: 0,
    todayNewUsers: 0,
    todayOrders: 0,
    pendingOrders: 0,
    pendingContent: 0,
    acceptanceOverdue: 0,
    pendingDispatch: 0,
    dispatchExpiredToday: 0,
    awaitingAcceptance: 0
  })
  const [supplyQueues, setSupplyQueues] = useState<{
    pending_dispatch: any[]
    dispatch_expired: any[]
    awaiting_acceptance: any[]
  }>({ pending_dispatch: [], dispatch_expired: [], awaiting_acceptance: [] })
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig>({
    enabled: 0,
    title: '',
    description: '',
    startAt: '',
    endAt: '',
  })
  const [campaignStats, setCampaignStats] = useState<CampaignStats>({
    totalExposures: 0,
    totalClicks: 0,
    clickThroughRate: 0,
    daily: [],
  })
  const [trends, setTrends] = useState<DashboardTrends>({
    days: 7,
    totalNewUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    daily: [],
  })
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('newUsers')
  const trendCanvasIdRef = useRef(`admin-dashboard-trend-canvas`)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [metricsOverview, setMetricsOverview] = useState<AdminMetricsOverview | null>(null)
  const [metricsFunnel, setMetricsFunnel] = useState<AdminMetricsFunnel | null>(null)
  const [failureReasons, setFailureReasons] = useState<AdminFailureReasons | null>(null)
  const [funnelMode, setFunnelMode] = useState<'demand' | 'supply'>('demand')

  const formatInt = (v: number | null | undefined) => (v == null ? '-' : Number(v).toLocaleString())
  const formatMoney = (v: number | null | undefined) => {
    if (v == null) return '-'
    const n = Number(v) || 0
    return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)
  }
  const formatPercent = (v: number | null | undefined) => (v == null ? '-' : `${(Number(v) * 100).toFixed(1)}%`)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (!trends.daily.length) return
    const t = setTimeout(() => {
      drawTrendChart()
    }, 50)
    return () => clearTimeout(t)
  }, [trends.daily, trendMetric])

  const fetchDashboardData = async () => {
    try {
      setMetricsLoading(true)
      setMetricsError('')
      const res = await Network.request({
        url: '/api/admin/dashboard/stats'
      })
      
      if (res.data.code === 200) {
        setStats(res.data.data)
      }

      const [pendingDispatchRes, dispatchExpiredRes, awaitingAcceptanceRes] = await Promise.all([
        Network.request({ url: '/api/admin/queues/supply', data: { queue: 'pending_dispatch', limit: 10 } }),
        Network.request({ url: '/api/admin/queues/supply', data: { queue: 'dispatch_expired', limit: 10 } }),
        Network.request({ url: '/api/admin/queues/supply', data: { queue: 'awaiting_acceptance', limit: 10 } }),
      ])

      const [campaignConfigRes, campaignStatsRes, trendsRes, metricsOverviewRes, metricsFunnelRes, failureReasonsRes] = await Promise.all([
        Network.request({ url: '/api/admin/activities/campaign' }),
        Network.request({ url: '/api/admin/activities/campaign/stats', data: { days: 7 } }),
        Network.request({ url: '/api/admin/dashboard/trends', data: { days: 7 } }),
        Network.request({ url: '/api/admin/metrics/overview', data: { days: 30 } }),
        showFunnel ? Network.request({ url: '/api/admin/metrics/funnel', data: { days: 30 } }) : Promise.resolve(null),
        showFailureReasons
          ? Network.request({ url: '/api/admin/metrics/failure-reasons', data: { days: 30, top: 10 } })
          : Promise.resolve(null),
      ])

      setSupplyQueues({
        pending_dispatch: pendingDispatchRes?.data?.data?.list || [],
        dispatch_expired: dispatchExpiredRes?.data?.data?.list || [],
        awaiting_acceptance: awaitingAcceptanceRes?.data?.data?.list || [],
      })

      if (campaignConfigRes?.data?.code === 200 && campaignConfigRes?.data?.data) {
        const data = campaignConfigRes.data.data
        setCampaignConfig({
          enabled: Number(data.enabled || 0),
          title: data.title || '',
          description: data.description || '',
          startAt: data.startAt || '',
          endAt: data.endAt || '',
        })
      }

      if (campaignStatsRes?.data?.code === 200 && campaignStatsRes?.data?.data) {
        setCampaignStats(campaignStatsRes.data.data)
      }

      if (trendsRes?.data?.code === 200 && trendsRes?.data?.data) {
        setTrends(trendsRes.data.data)
      }

      if (metricsOverviewRes?.data?.code === 200 && metricsOverviewRes?.data?.data) {
        setMetricsOverview(metricsOverviewRes.data.data)
      } else {
        setMetricsOverview(null)
      }

      if (showFunnel && metricsFunnelRes?.data?.code === 200 && metricsFunnelRes?.data?.data) {
        setMetricsFunnel(metricsFunnelRes.data.data)
      } else {
        setMetricsFunnel(null)
      }

      if (showFailureReasons && failureReasonsRes?.data?.code === 200 && failureReasonsRes?.data?.data) {
        setFailureReasons(failureReasonsRes.data.data)
      } else {
        setFailureReasons(null)
      }

      setMetricsLoading(false)
    } catch (err) {
      console.error('获取仪表盘数据失败:', err)
      setMetricsError('获取指标数据失败')
      setMetricsLoading(false)
    }
  }

  const drawTrendChart = () => {
    const canvasId = trendCanvasIdRef.current
    const series = trends.daily.slice().reverse()
    if (!series.length) return

    const values = series.map((d) => {
      if (trendMetric === 'newUsers') return Number(d.newUsers || 0)
      if (trendMetric === 'orders') return Number(d.orders || 0)
      return Number(d.revenue || 0)
    })

    const maxValue = Math.max(...values, 0)
    const safeMax = maxValue > 0 ? maxValue : 1

    const draw = (params: {
      ctx: any
      width: number
      height: number
      dpr: number
      resetScale: boolean
    }) => {
      const { ctx, width, height, dpr, resetScale } = params

      if (resetScale) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      ctx.clearRect(0, 0, width, height)
      ctx.scale(dpr, dpr)

      const paddingLeft = 36
      const paddingRight = 12
      const paddingTop = 12
      const paddingBottom = 24
      const chartW = Math.max(1, width / dpr - paddingLeft - paddingRight)
      const chartH = Math.max(1, height / dpr - paddingTop - paddingBottom)

      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = paddingTop + (chartH * i) / 4
        ctx.beginPath()
        ctx.moveTo(paddingLeft, y)
        ctx.lineTo(paddingLeft + chartW, y)
        ctx.stroke()
      }

      ctx.fillStyle = '#6b7280'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let i = 0; i <= 2; i++) {
        const v = (safeMax * (2 - i)) / 2
        const y = paddingTop + (chartH * i) / 2
        ctx.fillText(trendMetric === 'revenue' ? v.toFixed(0) : String(Math.round(v)), paddingLeft - 6, y)
      }

      const color = trendMetric === 'newUsers' ? '#3b82f6' : trendMetric === 'orders' ? '#f59e0b' : '#10b981'
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      const stepX = values.length <= 1 ? chartW : chartW / (values.length - 1)
      const toY = (v: number) => paddingTop + chartH - (v / safeMax) * chartH

      ctx.beginPath()
      values.forEach((v, idx) => {
        const x = paddingLeft + stepX * idx
        const y = toY(v)
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      ctx.fillStyle = color
      values.forEach((v, idx) => {
        const x = paddingLeft + stepX * idx
        const y = toY(v)
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      })

      const labels = series.map((d) => String(d.day || '').slice(5))
      ctx.fillStyle = '#6b7280'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const labelIdx = values.length <= 3 ? values.map((_, i) => i) : [0, Math.floor((values.length - 1) / 2), values.length - 1]
      labelIdx.forEach((idx) => {
        const x = paddingLeft + stepX * idx
        const y = paddingTop + chartH + 6
        ctx.fillText(labels[idx] || '', x, y)
      })
    }

    if (isH5() && canUseDOM()) {
      const el = document.getElementById(canvasId) as any
      if (!el) return
      const rect = el.getBoundingClientRect?.()
      const width = Number(rect?.width || el.clientWidth || 0)
      const height = Number(rect?.height || el.clientHeight || 0)
      if (!width || !height) return

      const dpr = Number(window.devicePixelRatio || 1)
      el.width = Math.floor(width * dpr)
      el.height = Math.floor(height * dpr)
      const ctx = el.getContext?.('2d')
      if (!ctx) return
      draw({ ctx, width: el.width, height: el.height, dpr, resetScale: true })
      return
    }

    const query = Taro.createSelectorQuery()
    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res: any) => {
        const info = res?.[0]
        const canvas = info?.node
        const width = Number(info?.width || 0)
        const height = Number(info?.height || 0)
        if (!canvas || !width || !height) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = Number(Taro.getSystemInfoSync()?.pixelRatio || 1)
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        draw({ ctx, width: canvas.width, height: canvas.height, dpr, resetScale: false })
      })
  }

  const handleSaveCampaign = async () => {
    try {
      const res = await Network.request({
        url: '/api/admin/activities/campaign',
        method: 'PUT',
        data: campaignConfig,
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '活动已保存', icon: 'success' })
        fetchDashboardData()
        return
      }
      Taro.showToast({ title: res.data?.message || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('保存活动配置失败:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const statCards = [
    { key: 'totalUsers', label: '总用户数', value: stats.totalUsers, icon: Users, color: '#3b82f6' },
    { key: 'totalAvatars', label: '总分身数', value: stats.totalAvatars, icon: Bot, color: '#8b5cf6' },
    { key: 'totalOrders', label: '总订单数', value: stats.totalOrders, icon: ShoppingCart, color: '#f59e0b' },
    { key: 'totalRevenue', label: '总收益(元)', value: stats.totalRevenue, icon: Wallet, color: '#10b981' },
  ]

  const quickStats = [
    { label: '今日新增用户', value: stats.todayNewUsers, trend: '+12%' },
    { label: '今日订单', value: stats.todayOrders, trend: '+8%' },
    { label: '待处理订单', value: stats.pendingOrders, alert: stats.pendingOrders > 0 },
    { label: '待审核内容', value: stats.pendingContent, alert: stats.pendingContent > 0 },
    { label: '待接单派单', value: stats.pendingDispatch, alert: stats.pendingDispatch > 0 },
    { label: '派单超时(今日)', value: stats.dispatchExpiredToday, alert: stats.dispatchExpiredToday > 0 },
    { label: '待验收', value: stats.awaitingAcceptance, alert: stats.awaitingAcceptance > 0 },
    { label: '待验收超时', value: stats.acceptanceOverdue, alert: stats.acceptanceOverdue > 0 },
  ]

  return (
    <AdminLayout title="指标看板">
      <View className="dashboard-page">
        {/* 指标看板 */}
        <View className="quick-stats-section">
          <View className="flex flex-row items-center justify-between">
            <Text className="section-title metrics-title">指标看板（近{metricsOverview?.range?.days || 30}天）</Text>
            <Button variant="outline" size="sm" onClick={fetchDashboardData}>
              <RefreshCw size={16} color="#6b7280" />
              <Text>刷新</Text>
            </Button>
          </View>

          {metricsLoading ? (
            <Text className="block mt-3 text-sm text-gray-500">加载中...</Text>
          ) : metricsError ? (
            <Text className="block mt-3 text-sm text-red-500">{metricsError}</Text>
          ) : (
            <View className="flex flex-col gap-4 mt-3">
              <View className="metrics-grid">
                {[
                  { key: 'verifiedGmv', label: '北极星 GMV(元)', value: formatMoney(metricsOverview?.northStar?.verifiedGmv) },
                  { key: 'verifiedOrderCount', label: '北极星订单数', value: formatInt(metricsOverview?.northStar?.verifiedOrderCount) },
                  { key: 'totalOrders', label: '下单量', value: formatInt(metricsOverview?.kpi?.totalOrders) },
                  { key: 'paidOrders', label: '支付订单', value: formatInt(metricsOverview?.kpi?.paidOrders) },
                  { key: 'totalGmv', label: 'GMV(元)', value: formatMoney(metricsOverview?.kpi?.totalGmv) },
                  { key: 'newUsers', label: '新增用户', value: formatInt(metricsOverview?.kpi?.newUsers) },
                  { key: 'activeAvatars', label: '活跃分身', value: formatInt(metricsOverview?.kpi?.activeAvatars) },
                ].map((item) => (
                  <View key={item.key} className="quick-stat-item metric-item">
                    <Text className="quick-stat-label metric-label">{item.label}</Text>
                    <Text className="quick-stat-value metric-value">{item.value}</Text>
                  </View>
                ))}
              </View>

              {showFunnel && (
                <Card>
                  <CardHeader className="p-4 pb-0">
                    <View className="flex flex-row items-center justify-between">
                      <Text className="block text-sm font-medium text-gray-900">漏斗</Text>
                      <View className="funnel-switch">
                        <Button
                          variant={funnelMode === 'demand' ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => setFunnelMode('demand')}
                        >
                          <Text>需求侧</Text>
                        </Button>
                        <Button
                          variant={funnelMode === 'supply' ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => setFunnelMode('supply')}
                        >
                          <Text>供给侧</Text>
                        </Button>
                      </View>
                    </View>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><Text className="block">步骤</Text></TableHead>
                          <TableHead className="text-right"><Text className="block">数量</Text></TableHead>
                          <TableHead className="text-right"><Text className="block">转化率</Text></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(funnelMode === 'demand' ? (metricsFunnel?.demand || []) : (metricsFunnel?.supply || [])).map((step) => (
                          <TableRow key={step.key}>
                            <TableCell><Text className="block text-sm text-gray-800">{step.label}</Text></TableCell>
                            <TableCell className="text-right"><Text className="block text-sm text-gray-800">{formatInt(step.count)}</Text></TableCell>
                            <TableCell className="text-right">
                              <Text className="block text-sm text-gray-600">{formatPercent(step.conversionFromPrev)}</Text>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!((funnelMode === 'demand' ? metricsFunnel?.demand : metricsFunnel?.supply) || []).length && (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <Text className="block text-sm text-gray-500">暂无数据</Text>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {showFailureReasons && (
                <Card>
                  <CardHeader className="p-4 pb-0">
                    <Text className="block text-sm font-medium text-gray-900">失败原因 Top</Text>
                  </CardHeader>
                  <CardContent className="p-4">
                    <View className="grid grid-cols-2 gap-4">
                      {(failureReasons?.groups || []).map((group) => (
                        <Card key={group.key}>
                          <CardHeader className="p-4 pb-0">
                            <Text className="block text-sm font-medium text-gray-900">{group.label}</Text>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead><Text className="block">原因</Text></TableHead>
                                  <TableHead className="text-right"><Text className="block">次数</Text></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(group.items || []).map((item) => (
                                  <TableRow key={item.reason}>
                                    <TableCell><Text className="block text-sm text-gray-800">{item.reason}</Text></TableCell>
                                    <TableCell className="text-right"><Text className="block text-sm text-gray-800">{formatInt(item.count)}</Text></TableCell>
                                  </TableRow>
                                ))}
                                {!(group.items || []).length && (
                                  <TableRow>
                                    <TableCell colSpan={2}>
                                      <Text className="block text-sm text-gray-500">暂无数据</Text>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ))}
                      {!(failureReasons?.groups || []).length && (
                        <Text className="block text-sm text-gray-500">暂无数据</Text>
                      )}
                    </View>
                  </CardContent>
                </Card>
              )}
            </View>
          )}
        </View>

        {/* 核心数据卡片 */}
        <View className="stat-cards">
          {statCards.map(card => {
            const Icon = card.icon
            return (
              <View key={card.key} className="stat-card">
                <View className="stat-icon" style={{ background: `${card.color}20` }}>
                  <Icon size={28} color={card.color} />
                </View>
                <View className="stat-info">
                  <Text className="stat-value">{card.value.toLocaleString()}</Text>
                  <Text className="stat-label">{card.label}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* 快捷统计 */}
        <View className="quick-stats-section">
          <Text className="section-title">今日动态</Text>
          <View className="quick-stats-grid">
            {quickStats.map((item, idx) => (
              <View key={idx} className={`quick-stat-item ${item.alert ? 'alert' : ''}`}>
                <Text className="quick-stat-value">{item.value}</Text>
                <Text className="quick-stat-label">{item.label}</Text>
                {item.trend && (
                  <View className="trend-badge">
                    <TrendingUp size={12} color="#10b981" />
                    <Text className="trend-text">{item.trend}</Text>
                  </View>
                )}
                {item.alert && (
                  <View className="alert-badge">
                    <Text className="alert-text">需处理</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View className="quick-stats-section">
          <Text className="section-title">趋势（近{trends.days}天）</Text>
          <View className="trend-switch mt-3">
            <Button
              variant={trendMetric === 'newUsers' ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-center"
              onClick={() => setTrendMetric('newUsers')}
            >
              <Text>新增用户</Text>
            </Button>
            <Button
              variant={trendMetric === 'orders' ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-center"
              onClick={() => setTrendMetric('orders')}
            >
              <Text>订单</Text>
            </Button>
            <Button
              variant={trendMetric === 'revenue' ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-center"
              onClick={() => setTrendMetric('revenue')}
            >
              <Text>收入</Text>
            </Button>
          </View>
          <View className="mt-4 rounded-xl bg-white p-3">
            <Canvas
              id={trendCanvasIdRef.current}
              canvasId={trendCanvasIdRef.current}
              type="2d"
              className="trend-canvas"
            />
          </View>
        </View>

        <View className="quick-stats-section">
          <Text className="section-title">增长活动</Text>
          <View className="grid grid-cols-2 gap-4">
            <View className="quick-stat-item">
              <Text className="quick-stat-value">{campaignStats.totalExposures}</Text>
              <Text className="quick-stat-label">近7天曝光</Text>
            </View>
            <View className="quick-stat-item">
              <Text className="quick-stat-value">{campaignStats.totalClicks}</Text>
              <Text className="quick-stat-label">近7天点击</Text>
            </View>
            <View className="quick-stat-item">
              <Text className="quick-stat-value">{(campaignStats.clickThroughRate * 100).toFixed(1)}%</Text>
              <Text className="quick-stat-label">点击率</Text>
            </View>
            <View className={`quick-stat-item ${campaignConfig.enabled ? '' : 'alert'}`}>
              <Text className="quick-stat-value">{campaignConfig.enabled ? '开启' : '关闭'}</Text>
              <Text className="quick-stat-label">活动状态</Text>
            </View>
          </View>

          <View className="mt-4 flex flex-col gap-3">
            <View className="flex items-center gap-3">
              <Text className="w-24 text-sm text-gray-600">启用活动</Text>
              <Button
                variant={campaignConfig.enabled ? 'default' : 'outline'}
                onClick={() => setCampaignConfig((prev) => ({ ...prev, enabled: prev.enabled ? 0 : 1 }))}
              >
                <Text>{campaignConfig.enabled ? '已开启' : '点击开启'}</Text>
              </Button>
            </View>
            <View className="flex items-center gap-3">
              <Text className="w-24 text-sm text-gray-600">活动标题</Text>
              <Input
                value={campaignConfig.title}
                onInput={(e: any) => setCampaignConfig((prev) => ({ ...prev, title: e.detail?.value || '' }))}
                placeholder="例如：邀请好友得奖励"
              />
            </View>
            <View className="flex items-center gap-3">
              <Text className="w-24 text-sm text-gray-600">活动说明</Text>
              <Input
                value={campaignConfig.description}
                onInput={(e: any) => setCampaignConfig((prev) => ({ ...prev, description: e.detail?.value || '' }))}
                placeholder="例如：立即邀请好友注册并领取奖励"
              />
            </View>
            <View className="flex items-center gap-3">
              <Text className="w-24 text-sm text-gray-600">开始时间</Text>
              <Input
                value={campaignConfig.startAt}
                onInput={(e: any) => setCampaignConfig((prev) => ({ ...prev, startAt: e.detail?.value || '' }))}
                placeholder="留空表示立即生效"
              />
            </View>
            <View className="flex items-center gap-3">
              <Text className="w-24 text-sm text-gray-600">结束时间</Text>
              <Input
                value={campaignConfig.endAt}
                onInput={(e: any) => setCampaignConfig((prev) => ({ ...prev, endAt: e.detail?.value || '' }))}
                placeholder="留空表示长期有效"
              />
            </View>
            <Button onClick={handleSaveCampaign}>
              <Text>保存活动配置</Text>
            </Button>
          </View>

          <View className="mt-4 flex flex-col gap-3">
            {campaignStats.daily.map((item) => (
              <View key={item.day} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <Text className="text-sm text-gray-700">{item.day}</Text>
                <Text className="text-sm text-gray-500">曝光 {item.exposures}</Text>
                <Text className="text-sm text-gray-500">点击 {item.clicks}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 快捷入口 */}
        <View className="quick-actions-section">
          <Text className="section-title">快捷操作</Text>
          <View className="quick-actions-grid">
            <View className="quick-action-btn" onClick={() => Taro.navigateTo({ url: '/package-admin/pages/users/index' })}>
              <Users size={24} color="#3b82f6" />
              <Text className="quick-action-text">用户管理</Text>
            </View>
            <View className="quick-action-btn" onClick={() => Taro.navigateTo({ url: '/package-admin/pages/orders/index' })}>
              <ShoppingCart size={24} color="#f59e0b" />
              <Text className="quick-action-text">订单管理</Text>
            </View>
            <View className="quick-action-btn" onClick={() => Taro.navigateTo({ url: '/package-admin/pages/content/index' })}>
              <Eye size={24} color="#8b5cf6" />
              <Text className="quick-action-text">内容审核</Text>
            </View>
            <View className="quick-action-btn" onClick={() => Taro.navigateTo({ url: '/package-admin/pages/finance/index' })}>
              <Wallet size={24} color="#10b981" />
              <Text className="quick-action-text">财务统计</Text>
            </View>
          </View>
        </View>

        <View className="quick-stats-section">
          <Text className="section-title">供给队列</Text>
          <View className="data-table">
            <View className="table-header">
              <Text className="th col-queue">队列</Text>
              <Text className="th col-order">订单</Text>
              <Text className="th col-avatar">分身</Text>
              <Text className="th col-date">时间</Text>
            </View>

            {[
              { key: 'pending_dispatch', label: '待接单派单', list: supplyQueues.pending_dispatch, timeKey: 'created_at' },
              { key: 'dispatch_expired', label: '派单超时', list: supplyQueues.dispatch_expired, timeKey: 'responded_at' },
              { key: 'awaiting_acceptance', label: '待验收', list: supplyQueues.awaiting_acceptance, timeKey: 'updated_at' },
            ].map((q) => (
              <View key={q.key}>
                {(q.list || []).map((row: any) => (
                  <View key={`${q.key}-${row.id || row.order_id || row.orderId}`} className="table-row">
                    <Text className="td col-queue">{q.label}</Text>
                    <View className="td col-order">
                      <Text className="order-title">{row.order_title || row.title || '-'}</Text>
                      <Text className="order-id">ID: {(row.order_id || row.id || '').slice(-8)}</Text>
                    </View>
                    <Text className="td col-avatar">{row.avatar_name || '-'}</Text>
                    <Text className="td col-date">{row[q.timeKey] ? new Date(row[q.timeKey]).toLocaleString('zh-CN') : '-'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </AdminLayout>
  )
}
