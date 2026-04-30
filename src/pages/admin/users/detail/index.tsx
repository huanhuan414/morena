import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Bot, ShoppingCart, Wallet, MessageCircle } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

interface UserDetail {
  id: string
  phone: string
  nickname: string
  avatar?: string
  status: 'active' | 'banned'
  created_at: string
  balance: number
  total_earnings: number
  total_spent: number
  avatar_count: number
  order_count: number
  post_count: number
  friend_count: number
  login_ip?: string
  last_login?: string
}

interface UserStats {
  monthlyOrders: { month: string; count: number }[]
  monthlySpending: { month: string; amount: number }[]
}

export default function UserDetail() {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [, setStats] = useState<UserStats>({ monthlyOrders: [], monthlySpending: [] })

  useEffect(() => {
    const { id } = Taro.getCurrentInstance().router?.params || {}
    if (id) {
      fetchUserDetail(id)
      fetchUserStats(id)
    }
  }, [])

  const fetchUserDetail = async (userId: string) => {
    try {
      const res = await Network.request({
        url: `/api/admin/users/${userId}`
      })
      if (res.data.code === 200) {
        setUser(res.data.data)
      }
    } catch (err) {
      console.error('获取用户详情失败:', err)
    }
  }

  const fetchUserStats = async (userId: string) => {
    try {
      const res = await Network.request({
        url: `/api/admin/users/${userId}/stats`
      })
      if (res.data.code === 200) {
        setStats(res.data.data)
      }
    } catch (err) {
      console.error('获取用户统计失败:', err)
    }
  }

  const handleGoBack = () => {
    Taro.navigateBack()
  }

  if (!user) {
    return (
      <View className="user-detail-page">
        <Text className="loading-text">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="user-detail-page">
      {/* 顶部栏 */}
      <View className="detail-header">
        <View className="back-btn" onClick={handleGoBack}>
          <ArrowLeft size={24} color="#374151" />
        </View>
        <Text className="detail-title">用户详情</Text>
        <View className="header-placeholder" />
      </View>

      <ScrollView className="detail-content" scrollY>
        {/* 用户信息卡片 */}
        <View className="user-info-card">
          <View className="user-basic">
            {user.avatar ? (
              <Image src={user.avatar} className="user-avatar-lg" mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder-lg">
                <Text className="avatar-text-lg">{user.nickname?.[0] || 'U'}</Text>
              </View>
            )}
            <View className="user-meta">
              <Text className="user-name-lg">{user.nickname || '未设置昵称'}</Text>
              <Text className="user-phone">{user.phone}</Text>
              <View className={`status-tag ${user.status}`}>
                <Text className="status-tag-text">{user.status === 'active' ? '正常' : '已禁用'}</Text>
              </View>
            </View>
          </View>

          <View className="user-stats-row">
            <View className="user-stat-item">
              <Text className="stat-item-value">{user.avatar_count}</Text>
              <Text className="stat-item-label">AI分身</Text>
            </View>
            <View className="user-stat-item">
              <Text className="stat-item-value">{user.order_count}</Text>
              <Text className="stat-item-label">订单数</Text>
            </View>
            <View className="user-stat-item">
              <Text className="stat-item-value">{user.post_count}</Text>
              <Text className="stat-item-label">发帖数</Text>
            </View>
            <View className="user-stat-item">
              <Text className="stat-item-value">{user.friend_count}</Text>
              <Text className="stat-item-label">好友数</Text>
            </View>
          </View>
        </View>

        {/* 账户信息 */}
        <View className="info-section">
          <Text className="section-title">账户信息</Text>
          <View className="info-grid">
            <View className="info-item">
              <Text className="info-label">当前余额</Text>
              <Text className="info-value highlight">¥{user.balance.toFixed(2)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">累计收益</Text>
              <Text className="info-value">¥{user.total_earnings.toFixed(2)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">累计消费</Text>
              <Text className="info-value">¥{user.total_spent.toFixed(2)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">注册时间</Text>
              <Text className="info-value">{new Date(user.created_at).toLocaleString('zh-CN')}</Text>
            </View>
            {user.last_login && (
              <View className="info-item">
                <Text className="info-label">最后登录</Text>
                <Text className="info-value">{new Date(user.last_login).toLocaleString('zh-CN')}</Text>
              </View>
            )}
            {user.login_ip && (
              <View className="info-item">
                <Text className="info-label">登录IP</Text>
                <Text className="info-value">{user.login_ip}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 快捷操作 */}
        <View className="quick-actions">
          <Text className="section-title">用户资产</Text>
          <View className="action-grid">
            <View className="action-card" onClick={() => Taro.navigateTo({ url: `/pages/admin/avatars/index?user_id=${user.id}` })}>
              <Bot size={28} color="#8b5cf6" />
              <Text className="action-card-title">查看分身</Text>
              <Text className="action-card-count">{user.avatar_count}个</Text>
            </View>
            <View className="action-card" onClick={() => Taro.navigateTo({ url: `/pages/admin/orders/index?user_id=${user.id}` })}>
              <ShoppingCart size={28} color="#f59e0b" />
              <Text className="action-card-title">查看订单</Text>
              <Text className="action-card-count">{user.order_count}单</Text>
            </View>
            <View className="action-card" onClick={() => Taro.navigateTo({ url: `/pages/admin/finance/index?user_id=${user.id}&type=transactions` })}>
              <Wallet size={28} color="#10b981" />
              <Text className="action-card-title">交易记录</Text>
              <Text className="action-card-desc">查看明细</Text>
            </View>
            <View className="action-card" onClick={() => Taro.navigateTo({ url: `/pages/admin/content/index?user_id=${user.id}` })}>
              <MessageCircle size={28} color="#3b82f6" />
              <Text className="action-card-title">发布内容</Text>
              <Text className="action-card-count">{user.post_count}条</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
