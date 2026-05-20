import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Bot, ShoppingCart, Wallet, MessageCircle } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import * as Network from '@/network'
import './index.css'

interface UserDetail {
  id: string
  phone: string
  nickname: string
  avatar?: string
  status: 'active' | 'banned'
  banned?: boolean | number
  createdAt?: string
  created_at?: string
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
  follow_count: number
  fan_count: number
}

export default function UserDetail() {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const toNumber = (value: any) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  const getStatus = (value: any): 'active' | 'banned' => {
    if (value?.status === 'active' || value?.status === 'banned') return value.status
    return value?.banned ? 'banned' : 'active'
  }

  const formatDateTime = (value: any) => {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN')
  }

  useEffect(() => {
    const { id } = Taro.getCurrentInstance().router?.params || {}
    if (!id) {
      setLoadError('缺少用户ID')
      setLoading(false)
      return
    }
    reload(id)
  }, [])

  const reload = async (userId: string) => {
    setLoading(true)
    setLoadError('')
    try {
      await Promise.all([fetchUserDetail(userId), fetchUserStats(userId)])
    } catch (e: any) {
      setLoadError(e?.message || '获取用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetail = async (userId: string) => {
    const res = await Network.request({
      url: `/api/admin/users/${userId}`
    })
    if (res.data.code !== 200) {
      throw new Error(res.data.message || '获取用户详情失败')
    }
    const raw = res.data.data || {}
    const avatar = raw.avatar || raw.avatar_url || raw.avatarUrl
    const balance = raw.balance ?? raw.current_balance ?? raw.currentBalance
    setUser({
      ...raw,
      avatar,
      status: getStatus(raw),
      phone: raw.phone || '-',
      nickname: raw.nickname || '',
      balance: toNumber(balance),
      total_earnings: toNumber(raw.total_earnings ?? raw.totalEarnings),
      total_spent: toNumber(raw.total_spent ?? raw.totalSpent),
      avatar_count: toNumber(raw.avatar_count ?? raw.avatarCount),
      order_count: toNumber(raw.order_count ?? raw.orderCount),
      post_count: toNumber(raw.post_count ?? raw.postCount),
      friend_count: toNumber(raw.friend_count ?? raw.friendCount),
      createdAt: raw.createdAt || raw.created_at
    })
  }

  const fetchUserStats = async (userId: string) => {
    const res = await Network.request({
      url: `/api/admin/users/${userId}/stats`
    })
    if (res.data.code !== 200) {
      throw new Error(res.data.message || '获取用户统计失败')
    }
    const raw = res.data.data || {}
    setStats({
      follow_count: toNumber(raw.follow_count ?? raw.followCount),
      fan_count: toNumber(raw.fan_count ?? raw.fanCount)
    })
  }

  const handleGoBack = () => {
    Taro.navigateBack()
  }

  if (loading) {
    return (
      <AdminLayout title="用户详情">
        <View className="user-detail-page">
          <View className="detail-skeleton-card" />
          <View className="detail-skeleton-grid">
            <View className="detail-skeleton-card" />
            <View className="detail-skeleton-card" />
          </View>
        </View>
      </AdminLayout>
    )
  }

  if (!user) {
    return (
      <AdminLayout title="用户详情">
        <View className="user-detail-page">
          <View className="detail-empty">
            <Text className="detail-empty-text">{loadError || '用户不存在'}</Text>
            <View
              className="detail-retry-btn"
              onClick={() => {
                const { id } = Taro.getCurrentInstance().router?.params || {}
                if (id) reload(id)
              }}
            >
              <Text className="detail-retry-text">重试</Text>
            </View>
          </View>
        </View>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="用户详情">
      <View className="user-detail-page">
        <View className="detail-toolbar">
          <View className="detail-back" onClick={handleGoBack}>
            <ArrowLeft size={18} color="#374151" />
            <Text className="detail-back-text">返回列表</Text>
          </View>
          <Text className="detail-id">ID：{user.id}</Text>
        </View>

        <View className="detail-grid">
          <View className="detail-left">
            <View className="detail-card">
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

            <View className="detail-card">
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
                  <Text className="info-value">{formatDateTime(user.createdAt || user.created_at)}</Text>
                </View>
                {user.last_login && (
                  <View className="info-item">
                    <Text className="info-label">最后登录</Text>
                    <Text className="info-value">{formatDateTime(user.last_login)}</Text>
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
          </View>

          <View className="detail-right">
            <View className="detail-card">
              <Text className="section-title">社交数据</Text>
              <View className="mini-stats">
                <View className="mini-stat">
                  <Text className="mini-stat-label">关注</Text>
                  <Text className="mini-stat-value">{stats?.follow_count ?? 0}</Text>
                </View>
                <View className="mini-stat">
                  <Text className="mini-stat-label">粉丝</Text>
                  <Text className="mini-stat-value">{stats?.fan_count ?? 0}</Text>
                </View>
              </View>
            </View>

            <View className="detail-card">
              <Text className="section-title">快捷操作</Text>
              <View className="action-grid">
                <View className="action-card" onClick={() => Taro.navigateTo({ url: `/package-admin/pages/avatars/index?user_id=${user.id}` })}>
                  <Bot size={26} color="#8b5cf6" />
                  <View className="action-card-meta">
                    <Text className="action-card-title">查看分身</Text>
                    <Text className="action-card-desc">{user.avatar_count} 个</Text>
                  </View>
                </View>
                <View className="action-card" onClick={() => Taro.navigateTo({ url: `/package-admin/pages/orders/index?user_id=${user.id}` })}>
                  <ShoppingCart size={26} color="#f59e0b" />
                  <View className="action-card-meta">
                    <Text className="action-card-title">查看订单</Text>
                    <Text className="action-card-desc">{user.order_count} 单</Text>
                  </View>
                </View>
                <View className="action-card" onClick={() => Taro.navigateTo({ url: `/package-admin/pages/finance/index?user_id=${user.id}&type=transactions` })}>
                  <Wallet size={26} color="#10b981" />
                  <View className="action-card-meta">
                    <Text className="action-card-title">交易记录</Text>
                    <Text className="action-card-desc">查看明细</Text>
                  </View>
                </View>
                <View className="action-card" onClick={() => Taro.navigateTo({ url: `/package-admin/pages/content/index?user_id=${user.id}` })}>
                  <MessageCircle size={26} color="#3b82f6" />
                  <View className="action-card-meta">
                    <Text className="action-card-title">发布内容</Text>
                    <Text className="action-card-desc">{user.post_count} 条</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </AdminLayout>
  )
}
