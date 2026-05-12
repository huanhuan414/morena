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
    pendingContent: 0
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
      </View>
    </AdminLayout>
  )
}
