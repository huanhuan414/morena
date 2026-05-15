import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { 
  Users, Bot, ShoppingCart, Wallet, TrendingUp, Eye
} from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
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

      setSupplyQueues({
        pending_dispatch: pendingDispatchRes?.data?.data?.list || [],
        dispatch_expired: dispatchExpiredRes?.data?.data?.list || [],
        awaiting_acceptance: awaitingAcceptanceRes?.data?.data?.list || [],
      })
    } catch (err) {
      console.error('获取仪表盘数据失败:', err)
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
