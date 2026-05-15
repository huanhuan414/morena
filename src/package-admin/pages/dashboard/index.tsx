import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { 
  Users, Bot, ShoppingCart, Wallet, TrendingUp, Eye
} from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default function AdminDashboard() {
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

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
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

      const [campaignConfigRes, campaignStatsRes] = await Promise.all([
        Network.request({ url: '/api/admin/activities/campaign' }),
        Network.request({ url: '/api/admin/activities/campaign/stats', data: { days: 7 } }),
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
    } catch (err) {
      console.error('获取仪表盘数据失败:', err)
    }
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
    <AdminLayout title="系统概览">
      <View className="dashboard-page">
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
              <Text className="th col-order">队列</Text>
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
                    <Text className="td col-order">{q.label}</Text>
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
