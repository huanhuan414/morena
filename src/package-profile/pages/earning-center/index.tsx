import Taro, { useDidShow, showToast, navigateTo, useLoad, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { formatNum, toNumber } from '@/utils/format'
import { ArrowDownToLine, ChevronRight, Gift, Sparkles, ArrowLeft } from 'lucide-react-taro'
import './index.css'

interface EarningOverview {
  balance: number | string
  totalEarnings: number | string
  pendingAmount: number | string
  monthlyAmount: number | string
  totalOrders: number | string
  totalReferrals: number | string
}

interface EarningRecord {
  id: string
  amount: number | string
  type: string
  status: string
  created_at: string
  description: string
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
  const [loading, setLoading] = useState(false)

  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
  })

  useDidShow(() => {
    fetchOverview()
    fetchRecords()
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
        const data = res.data.data
        setRecords(data?.list || data || [])
      }
    } catch (error) {
      console.error('获取收益记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (toNumber(overview.balance) < 100) {
      showToast({ title: '余额不足100元，无法提现', icon: 'none' })
      return
    }
    try {
      const res = await Network.request({
        url: '/api/earnings/withdraw',
        method: 'POST',
        data: {
          amount: toNumber(overview.balance),
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
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={22} color="#fff" />
        </View>
        <View className="header-title-wrap">
          <Text className="header-title">收益中心</Text>
        </View>
        <View className="header-right" />
      </View>

      {/* 收益概览卡片 */}
      <View className="overview-section">
        <View className="overview-card">
          <View className="overview-main">
            <Text className="overview-label">可提现余额</Text>
            <View className="balance-wrap">
              <Text className="currency">¥</Text>
              <Text className="balance-amount">{formatNum(overview.balance)}</Text>
            </View>
          </View>

          <View className="overview-stats">
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.totalEarnings)}</Text>
              <Text className="stat-label">累计收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.monthlyAmount)}</Text>
              <Text className="stat-label">本月收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.pendingAmount)}</Text>
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
        <View className="quick-item" onClick={() => navigateTo({ url: '/package-profile/pages/referral-center/index' })}>
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
                        {record.type === 'withdrawal' ? '-' : '+'}¥{formatNum(record.amount)}
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
