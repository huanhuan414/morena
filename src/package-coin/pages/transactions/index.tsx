import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, TrendingUp, Coins, Gift, RefreshCw } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

interface Transaction {
  id: string
  type: string
  amount: number
  balance_before: number
  balance_after: number
  skill_type: string
  description: string
  created_at: string
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'recharge', label: '充值' },
  { key: 'consume', label: '消费' },
  { key: 'gift', label: '赠送' },
]

export default function TransactionsPage() {
  const statusBarHeight = getStatusBarHeight()
  const [activeTab, setActiveTab] = useState('all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 20

  useDidShow(() => {
    loadData(1, true)
  })

  const loadData = async (pageNum: number = page, refresh: boolean = false, filterType?: string) => {
    try {
      setLoading(true)
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const type = filterType || (activeTab === 'all' ? undefined : activeTab)
      const params: any = { userId, page: pageNum, pageSize }
      if (type) {
        params.type = type
      }
      
      const res = await Network.request({
        url: '/api/coin/transactions',
        data: params
      })

      if (res.data?.code === 200) {
        const data = res.data.data
        if (refresh) {
          setTransactions(data.list || [])
        } else {
          setTransactions(prev => [...prev, ...(data.list || [])])
        }
        setTotal(data.total || 0)
        setHasMore((data.list?.length || 0) >= pageSize)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setPage(1)
    const type = tab === 'all' ? undefined : tab
    loadData(1, true, type)
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadData(page + 1, false)
    }
  }

  const handleRefresh = () => {
    loadData(1, true)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'recharge': return <TrendingUp size={18} color="#10B981" />
      case 'consume': return <Coins size={18} color="#EF4444" />
      case 'gift': return <Gift size={18} color="#F59E0B" />
      default: return <Coins size={18} color="#6B7280" />
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

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'recharge': return 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)'
      case 'consume': return 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
      case 'gift': return 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)'
      default: return '#F3F4F6'
    }
  }

  const formatDate = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    if (isYesterday) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <View className="tx-page">
      <View className="tx-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="tx-header-bg" />
        <View className="tx-deco-circle tx-deco-1" />
        <View className="tx-deco-circle tx-deco-2" />
        <View className="tx-header-content">
          <View className="tx-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="tx-header-title">交易记录</Text>
          <View className="tx-header-right" onClick={handleRefresh}>
            <RefreshCw size={18} color="#fff" />
          </View>
        </View>
      </View>

      <View className="tx-tabs">
        {TABS.map((tab) => (
          <View
            key={tab.key}
            className={`tx-tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            <Text className="tx-tab-text">{tab.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        className="tx-body"
        scrollY
        onScrollToLower={handleLoadMore}
      >
        {transactions.length === 0 && !loading ? (
          <View className="tx-empty">
            <Coins size={48} color="#D1D5DB" />
            <Text className="tx-empty-text">暂无交易记录</Text>
          </View>
        ) : (
          <View className="tx-list">
            {transactions.map((item) => (
              <View className="tx-item" key={item.id}>
                <View className="tx-item-icon" style={{ background: getTypeBg(item.type) }}>
                  {getTypeIcon(item.type)}
                </View>
                <View className="tx-item-content">
                  <View className="tx-item-header">
                    <Text className="tx-item-title">
                      {item.description || getTypeLabel(item.type)}
                    </Text>
                    <Text className={`tx-item-amount ${item.amount > 0 ? 'positive' : 'negative'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount}
                    </Text>
                  </View>
                  <View className="tx-item-footer">
                    <Text className="tx-item-time">{formatDate(item.created_at)}</Text>
                    <Text className="tx-item-balance">余额: {item.balance_after}</Text>
                  </View>
                </View>
              </View>
            ))}
            {loading && (
              <View className="tx-loading">
                <Text className="tx-loading-text">加载中...</Text>
              </View>
            )}
            {!hasMore && transactions.length > 0 && (
              <View className="tx-no-more">
                <Text className="tx-no-more-text">没有更多了</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
