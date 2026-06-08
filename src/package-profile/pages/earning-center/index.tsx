import Taro, { useDidShow, showToast, useLoad, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import {
  normalizeEarningOverview,
  normalizeEarningRecords,
  type EarningOverview,
  type EarningRecord,
} from '@/adapters/core-chain-dto'
import { Network } from '@/network'
import { formatNum, toNumber } from '@/utils/format'
import { ArrowDownToLine, Sparkles, ArrowLeft } from 'lucide-react-taro'
import './index.css'

export default function EarningCenterPage() {
  const [overview, setOverview] = useState<EarningOverview>({
    balance: 0,
    totalEarnings: 0,
    completedAmount: 0,
    settlingAmount: 0,
    pendingAmount: 0,
    processingAmount: 0,
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
      if (res.data?.code === 200) {
        setOverview(normalizeEarningOverview(res.data?.data))
      }
    } catch (error) {
      console.error('获取收益概览失败:', error)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/earnings' })
      if (res.data?.code === 200) {
        setRecords(normalizeEarningRecords(res.data?.data))
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
      order_reward: { label: '订单收益', icon: '💰', color: '#00ff88' },
      // order_income: { label: '订单收益', icon: '💰', color: '#00ff88' },
      referral_bonus: { label: '邀请奖励', icon: '🎁', color: '#a78bfa' },
      // withdrawal: { label: '提现', icon: '💸', color: '#ff6b6b' }
    }
    return typeMap[type] || { label: type, icon: '💵', color: '#fff' }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      settled: { label: '已到账', color: '#00ff88' },
      pending: { label: '结算中', color: '#ffaa00' },
      processing: { label: '结算中', color: '#00f5ff' },
      completed: { label: '已结算', color: '#4ade80' },
      rejected: { label: '已拒绝', color: '#ff6b6b' },
      expired: { label: '已过期', color: '#999999' }
    }
    return statusMap[status] || { label: status, color: '#fff' }
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    try {
      const date = new Date(time)
      if (Number.isNaN(date.getTime())) return time
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}`
    } catch (e) {
      return time
    }
  }

  return (
    <View className="earning-page">
      {/* 顶部导航 */}
      <View className="earning-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="earning-header-bg" />
        {/* 装饰圆 */}
        <View className="earning-deco-circle earning-deco-1" />
        <View className="earning-deco-circle earning-deco-2" />
        <View className="earning-header-content">
          <View className="earning-back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="earning-header-center">
            <Text className="header-title">收益中心</Text>
          </View>
          <View className="earning-header-right" />
        </View>
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
              <Text className="stat-value">¥{formatNum(overview.completedAmount)}</Text>
              <Text className="stat-label">已结算</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.settlingAmount)}</Text>
              <Text className="stat-label">结算中</Text>
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
                        {/* 显示计算式：原始金额 × (1 - 抽成比例) = 实际金额 */}
                        <Text className="record-fee-formula">
                          接单¥{formatNum(record.amount)} × (1-平台{Math.round(record.feeRate * 100)}%) = ¥{formatNum(record.feeAmount)}
                        </Text>
                        <Text className="record-time">{formatTime(record.createdAt)}</Text>
                      </View>
                    </View>
                    <View className="record-right">
                      <Text className={`record-amount ${record.type === 'withdrawal' ? 'negative' : 'positive'}`}>
                        {record.type === 'withdrawal' ? '-' : '+'}¥{formatNum(record.feeAmount)}
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
