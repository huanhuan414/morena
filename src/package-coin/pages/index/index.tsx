import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, Coins, ChevronRight, TrendingUp, Clock, Gift } from 'lucide-react-taro'
import './index.css'

interface Transaction {
  id: string
  type: string
  amount: number
  balance_before: number
  balance_after: number
  description: string
  created_at: string
}

export default function CoinCenter() {
  const [balance, setBalance] = useState<number>(0)
  const [, setLoading] = useState(true)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
  })

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const [balanceRes, transactionsRes] = await Promise.all([
        Network.request({ url: `/api/coin/balance?userId=${userId}` }),
        Network.request({ url: `/api/coin/transactions?userId=${userId}&pageSize=5` })
      ])

      const balanceData = balanceRes.data?.code === 200 ? balanceRes.data.data : {}
      setBalance(balanceData.balance || 0)

      const transactionsData = transactionsRes.data?.code === 200 ? transactionsRes.data.data : {}
      setRecentTransactions(transactionsData.list || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'recharge': return <TrendingUp size={16} color="#10B981" />
      case 'consume': return <Coins size={16} color="#EF4444" />
      case 'gift': return <Gift size={16} color="#F59E0B" />
      default: return <Coins size={16} color="#6B7280" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'recharge': return '充值'
      case 'consume': return '消费'
      case 'gift': return '赠送'
      default: return type
    }
  }

  const formatTime = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString()
  }

  return (
    <View className="coin-page">
      <View className="coin-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="coin-header-bg" />
        <View className="coin-deco-circle coin-deco-1" />
        <View className="coin-deco-circle coin-deco-2" />
        <View className="coin-header-content">
          <View className="coin-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="coin-header-title">币中心</Text>
          <View className="coin-header-right" />
        </View>
      </View>

      <ScrollView className="coin-body" scrollY>
        <View className="coin-balance-card">
          <View className="coin-balance-icon">
            <Coins size={40} color="#F59E0B" />
          </View>
          <View className="coin-balance-info">
            <Text className="coin-balance-label">我的余额</Text>
            <View className="coin-balance-value-row">
              <Text className="coin-balance-value">{balance.toLocaleString()}</Text>
              <Text className="coin-balance-unit">币</Text>
            </View>
          </View>
          <View className="coin-recharge-btn" onClick={() => Taro.navigateTo({ url: '/package-coin/pages/recharge/index' })}>
            <Text className="coin-recharge-btn-text">充值</Text>
          </View>
        </View>

        <View className="coin-menu-section">
          <View className="coin-menu-item" onClick={() => Taro.navigateTo({ url: '/package-coin/pages/recharge/index' })}>
            <View className="coin-menu-icon-wrap" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <TrendingUp size={20} color="#fff" />
            </View>
            <View className="coin-menu-content">
              <Text className="coin-menu-title">充值</Text>
              <Text className="coin-menu-desc">购买币，享受更多服务</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </View>

          <View className="coin-menu-item" onClick={() => Taro.navigateTo({ url: '/package-coin/pages/transactions/index' })}>
            <View className="coin-menu-icon-wrap" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
              <Clock size={20} color="#fff" />
            </View>
            <View className="coin-menu-content">
              <Text className="coin-menu-title">交易记录</Text>
              <Text className="coin-menu-desc">查看所有交易明细</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </View>
        </View>

        {recentTransactions.length > 0 && (
          <View className="coin-recent-section">
            <View className="coin-section-header">
              <View className="coin-section-title-row">
                <View className="coin-title-dot" />
                <Text className="coin-section-title">最近交易</Text>
              </View>
              <View className="coin-section-more" onClick={() => Taro.navigateTo({ url: '/package-coin/pages/transactions/index' })}>
                <Text className="coin-section-more-text">查看全部</Text>
                <ChevronRight size={16} color="#9CA3AF" />
              </View>
            </View>
            <View className="coin-recent-list">
              {recentTransactions.map((item) => (
                <View className="coin-recent-item" key={item.id}>
                  <View className="coin-recent-icon">
                    {getTypeIcon(item.type)}
                  </View>
                  <View className="coin-recent-content">
                    <Text className="coin-recent-title">{item.description || getTypeLabel(item.type)}</Text>
                    <Text className="coin-recent-time">{formatTime(item.created_at)}</Text>
                  </View>
                  <View className="coin-recent-amount">
                    <Text className={`coin-recent-value ${item.amount > 0 ? 'positive' : 'negative'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="coin-tips-section">
          <View className="coin-tips-header">
            <View className="coin-title-dot" />
            <Text className="coin-tips-title">使用说明</Text>
          </View>
          <View className="coin-tips-list">
            <Text className="coin-tips-item">• 币可用于技能广场的所有技能生成</Text>
            <Text className="coin-tips-item">• 不同技能消耗的币数量不同</Text>
            <Text className="coin-tips-item">• 充值越多，赠送越多</Text>
            <Text className="coin-tips-item">• 生成失败会自动退款</Text>
          </View>
        </View>

        <View className="coin-bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
