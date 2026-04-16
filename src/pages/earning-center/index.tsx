import Taro, { useDidShow, showToast, navigateTo, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { Wallet, ArrowDownToLine, ChevronRight, Gift, Sparkles, Briefcase, CircleCheck, Clock, DollarSign } from 'lucide-react-taro'
import './index.css'

interface EarningOverview {
  balance: number
  totalEarnings: number
  pendingAmount: number
  monthlyAmount: number
  totalOrders: number
  totalReferrals: number
}

interface EarningRecord {
  id: string
  amount: number
  type: 'order_income' | 'referral_bonus' | 'withdrawal'
  status: 'completed' | 'pending' | 'processing'
  created_at: string
  description: string
}

interface AvatarEarningStats {
  avatarId: string
  avatarName: string
  avatarUrl: string
  totalOrders: number
  completedOrders: number
  pendingOrders: number
  openOrders: number
  totalEarnings: number
  pendingAmount: number
  monthlyAmount: number
}

export default function EarningCenterPage() {
  const [overview, setOverview] = useState<EarningOverview>({
    balance: 0,
    totalEarnings: 0,
    pendingAmount: 0,
    monthlyAmount: 0,
    totalOrders: 0,
    totalReferrals: 0
  })
  const [records, setRecords] = useState<EarningRecord[]>([])
  const [avatarStats, setAvatarStats] = useState<AvatarEarningStats[]>([])
  const [loading, setLoading] = useState(false)

  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)

    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
  })

  useDidShow(() => {
    fetchOverview()
    fetchRecords()
    fetchAvatarStats()
  })

  const fetchOverview = async () => {
    try {
      const res = await Network.request({ url: '/api/earnings/overview' })
      console.log('收益概览返回:', res.data)
      if (res.data?.code === 200) {
        setOverview(res.data.data)
      }
    } catch (error) {
      console.error('获取收益概览失败:', error)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/earnings' })
      console.log('收益记录返回:', res.data)
      if (res.data?.code === 200) {
        // 后端返回 { list, total, page, pageSize }
        const data = res.data.data
        setRecords(data?.list || data || [])
      }
    } catch (error) {
      console.error('获取收益记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvatarStats = async () => {
    try {
      const res = await Network.request({ url: '/api/earnings/avatars-stats' })
      console.log('分身收益统计返回:', res.data)
      if (res.data?.code === 200) {
        setAvatarStats(res.data.data || [])
      }
    } catch (error) {
      console.error('获取分身收益统计失败:', error)
    }
  }

  const handleWithdraw = async () => {
    if (overview.balance < 100) {
      showToast({ title: '余额不足100元，无法提现', icon: 'none' })
      return
    }
    try {
      const res = await Network.request({
        url: '/api/earnings/withdraw',
        method: 'POST',
        data: {
          amount: overview.balance,
          method: 'wechat',
          accountInfo: {}
        }
      })
      if (res.data?.code === 200) {
        showToast({ title: '提现申请已提交', icon: 'success' })
        fetchOverview()
        fetchRecords()
      } else {
        showToast({ title: res.data?.message || '提现失败', icon: 'none' })
      }
    } catch (error) {
      console.error('提现失败:', error)
      showToast({ title: '提现失败', icon: 'none' })
    }
  }

  const getTypeInfo = (type: string) => {
    const typeMap: Record<string, { label: string; icon: string; color: string }> = {
      order_income: { label: '订单收益', icon: '💰', color: '#00ff88' },
      referral_bonus: { label: '邀请奖励', icon: '🎁', color: '#bf00ff' },
      withdrawal: { label: '提现', icon: '💸', color: '#ff6b6b' }
    }
    return typeMap[type] || { label: type, icon: '💵', color: '#fff' }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      completed: { label: '已完成', color: '#00ff88' },
      pending: { label: '待处理', color: '#ffaa00' },
      processing: { label: '处理中', color: '#00f5ff' }
    }
    return statusMap[status] || { label: status, color: '#fff' }
  }

  return (
    <View className="earning-page">
      {/* 顶部导航 */}
      <View className="earning-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-title-wrap">
          <Wallet size={24} color="#00ff88" />
          <Text className="header-title">收益中心</Text>
        </View>
        <View style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      {/* 收益概览卡片 */}
      <View className="overview-section">
        <View className="overview-card">
          <View className="overview-main">
            <Text className="overview-label">可提现余额</Text>
            <View className="balance-wrap">
              <Text className="currency">¥</Text>
              <Text className="balance-amount">{overview.balance.toFixed(2)}</Text>
            </View>
          </View>

          <View className="overview-stats">
            <View className="stat-col">
              <Text className="stat-value">¥{overview.totalEarnings.toFixed(2)}</Text>
              <Text className="stat-label">累计收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{overview.monthlyAmount.toFixed(2)}</Text>
              <Text className="stat-label">本月收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{overview.pendingAmount.toFixed(2)}</Text>
              <Text className="stat-label">待结算</Text>
            </View>
          </View>

          <View className="action-btns">
            <Button className="withdraw-btn" onClick={handleWithdraw}>
              <ArrowDownToLine size={18} color="#fff" />
              <Text className="btn-text">立即提现</Text>
            </Button>
          </View>
        </View>
      </View>

      {/* 快捷入口 */}
      <View className="quick-section">
        <View className="quick-item" onClick={() => navigateTo({ url: '/pages/referral-center/index' })}>
          <View className="quick-icon-wrap" style={{ background: 'rgba(191, 0, 255, 0.15)' }}>
            <Gift size={22} color="#bf00ff" />
          </View>
          <View className="quick-info">
            <Text className="quick-title">邀请返利</Text>
            <Text className="quick-desc">邀请好友注册获得奖励</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
        </View>
      </View>

      {/* 分身收益统计 */}
      {avatarStats.length > 0 && (
        <View className="avatar-stats-section">
          <View className="section-header">
            <Text className="section-title">分身收益统计</Text>
          </View>

          <View className="avatar-stats-list">
            {avatarStats.map(avatar => (
              <View key={avatar.avatarId} className="avatar-stat-card">
                <View className="avatar-header">
                  <View className="avatar-info">
                    <View className="avatar-avatar">
                      {avatar.avatarUrl ? (
                        <Image
                          src={avatar.avatarUrl}
                          className="avatar-avatar-img"
                          mode="aspectFill"
                          onError={() => {
                            console.error('头像加载失败:', avatar.avatarUrl)
                          }}
                        />
                      ) : (
                        <View className="avatar-avatar-fallback">
                          <Text className="avatar-initial">{avatar.avatarName.charAt(0)}</Text>
                        </View>
                      )}
                    </View>
                    <View className="avatar-name-wrap">
                      <Text className="avatar-name">{avatar.avatarName}</Text>
                      <Text className="avatar-meta">共接 {avatar.totalOrders} 单</Text>
                    </View>
                  </View>
                  <View className="avatar-total-earnings">
                    <DollarSign size={16} color="#00ff88" />
                    <Text className="earnings-text">¥{avatar.totalEarnings.toFixed(2)}</Text>
                  </View>
                </View>

                <View className="avatar-stats-grid">
                  <View className="avatar-stat-item">
                    <CircleCheck size={18} color="#00ff88" />
                    <View className="avatar-stat-info">
                      <Text className="avatar-stat-value">{avatar.completedOrders}</Text>
                      <Text className="avatar-stat-label">已完成</Text>
                    </View>
                  </View>
                  <View className="avatar-stat-item">
                    <Clock size={18} color="#ffaa00" />
                    <View className="avatar-stat-info">
                      <Text className="avatar-stat-value">{avatar.pendingOrders}</Text>
                      <Text className="avatar-stat-label">进行中</Text>
                    </View>
                  </View>
                  <View className="avatar-stat-item">
                    <Briefcase size={18} color="#00f5ff" />
                    <View className="avatar-stat-info">
                      <Text className="avatar-stat-value">{avatar.openOrders}</Text>
                      <Text className="avatar-stat-label">可接单</Text>
                    </View>
                  </View>
                </View>

                {avatar.pendingAmount > 0 && (
                  <View className="avatar-pending-info">
                    <Text className="pending-label">待结算：</Text>
                    <Text className="pending-amount">¥{avatar.pendingAmount.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 收益明细 */}
      <View className="records-section">
        <View className="section-header">
          <Text className="section-title">收益明细</Text>
        </View>

        <ScrollView className="records-scroll" scrollY>
          {loading ? (
            <View className="loading-state">
              <Text className="loading-text">加载中...</Text>
            </View>
          ) : records.length === 0 ? (
            <View className="empty-state">
              <Sparkles size={48} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">暂无收益记录</Text>
            </View>
          ) : (
            <View className="records-list">
              {records.map(record => {
                const typeInfo = getTypeInfo(record.type)
                const statusInfo = getStatusInfo(record.status)
                return (
                  <View key={record.id} className="record-item">
                    <View className="record-left">
                      <View className="record-icon">
                        <Text>{typeInfo.icon}</Text>
                      </View>
                      <View className="record-info">
                        <Text className="record-desc">{record.description || typeInfo.label}</Text>
                        <Text className="record-time">{record.created_at}</Text>
                      </View>
                    </View>
                    <View className="record-right">
                      <Text className={`record-amount ${record.type === 'withdrawal' ? 'negative' : 'positive'}`}>
                        {record.type === 'withdrawal' ? '-' : '+'}¥{record.amount.toFixed(2)}
                      </Text>
                      <Text className="record-status" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          <View className="bottom-space" />
        </ScrollView>
      </View>
    </View>
  )
}
