import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { CreditCard, ArrowUp, ArrowDown, TrendingUp, Check, X } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import './index.css'

interface FinanceStats {
  totalRecharge: number
  totalWithdraw: number
  totalCommission: number
  totalOrderIncome: number
  balance: number
  pendingWithdraw: number
}

interface Transaction {
  id: string
  user_id: string
  nickname: string
  type: 'recharge' | 'withdraw' | 'commission' | 'order'
  amount: number
  status: 'pending' | 'completed' | 'rejected'
  description: string
  created_at: string
}

export default function FinanceManagement() {
  const [stats, setStats] = useState<FinanceStats>({
    totalRecharge: 0,
    totalWithdraw: 0,
    totalCommission: 0,
    totalOrderIncome: 0,
    balance: 0,
    pendingWithdraw: 0
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    fetchStats()
    fetchTransactions()
  }, [typeFilter])

  const toNumber = (value: any) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/finance/stats' })
      if (res.data.code === 200) {
        const raw = res.data.data || {}
        setStats({
          totalRecharge: toNumber(raw.totalRecharge ?? raw.total_recharge ?? raw.totalRevenue ?? raw.total_revenue ?? 0),
          totalWithdraw: toNumber(raw.totalWithdraw ?? raw.total_withdraw ?? raw.totalWithdrawal ?? raw.total_withdrawal ?? 0),
          totalCommission: toNumber(raw.totalCommission ?? raw.total_commission ?? 0),
          totalOrderIncome: toNumber(raw.totalOrderIncome ?? raw.total_order_income ?? 0),
          balance: toNumber(raw.balance ?? 0),
          pendingWithdraw: toNumber(raw.pendingWithdraw ?? raw.pending_withdraw ?? 0)
        })
      }
    } catch (err) {
      console.error('获取财务统计失败:', err)
    }
  }

  const fetchTransactions = async () => {
    try {
      let url = '/api/admin/finance/transactions'
      if (typeFilter !== 'all') {
        url += `?type=${typeFilter}`
      }
      const res = await Network.request({ url })
      if (res.data.code === 200) {
        const list = Array.isArray(res.data.data?.list) ? res.data.data.list : []
        setTransactions(
          list.map((item: any) => ({
            ...item,
            amount: toNumber(item?.amount)
          }))
        )
      }
    } catch (err) {
      console.error('获取交易记录失败:', err)
    }
  }

  const handleWithdrawApprove = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/admin/finance/withdraw/${id}/approve`,
        method: 'POST'
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '已通过', icon: 'success' })
        fetchStats()
        fetchTransactions()
        setShowWithdrawModal(false)
      }
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleWithdrawReject = async () => {
    if (!selectedTransaction) return
    try {
      const res = await Network.request({
        url: `/api/admin/finance/withdraw/${selectedTransaction.id}/reject`,
        method: 'POST',
        data: { reason: rejectReason }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '已驳回', icon: 'success' })
        fetchStats()
        fetchTransactions()
        setShowWithdrawModal(false)
        setRejectReason('')
      }
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      recharge: '充值',
      withdraw: '提现',
      commission: '分佣',
      order: '订单'
    }
    return map[type] || type
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'recharge': return <ArrowDown size={20} color="#10b981" />
      case 'withdraw': return <ArrowUp size={20} color="#ef4444" />
      case 'commission': return <TrendingUp size={20} color="#3b82f6" />
      default: return <CreditCard size={20} color="#6b7280" />
    }
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: '#f59e0b',
      completed: '#10b981',
      rejected: '#ef4444'
    }
    return map[status] || '#999'
  }

  return (
    <AdminLayout title="财务管理">
      <ScrollView className="finance-page" scrollY>
        {/* 统计卡片 */}
        <View className="stats-grid">
          <View className="stat-card recharge">
            <View className="stat-icon">
              <ArrowDown size={24} color="#10b981" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">¥{stats.totalRecharge.toFixed(2)}</Text>
              <Text className="stat-label">钱包充值</Text>
            </View>
          </View>
          
          <View className="stat-card order">
            <View className="stat-icon">
              <CreditCard size={24} color="#8b5cf6" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">¥{stats.totalOrderIncome.toFixed(2)}</Text>
              <Text className="stat-label">订单收入</Text>
            </View>
          </View>

          <View className="stat-card withdraw">
            <View className="stat-icon">
              <ArrowUp size={24} color="#ef4444" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">¥{stats.totalWithdraw.toFixed(2)}</Text>
              <Text className="stat-label">累计提现</Text>
            </View>
          </View>
          
          <View className="stat-card commission">
            <View className="stat-icon">
              <TrendingUp size={24} color="#3b82f6" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">¥{stats.totalCommission.toFixed(2)}</Text>
              <Text className="stat-label">累计分佣</Text>
            </View>
          </View>
          
          <View className="stat-card pending">
            <View className="stat-icon">
              <CreditCard size={24} color="#f59e0b" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">¥{stats.pendingWithdraw.toFixed(2)}</Text>
              <Text className="stat-label">待审核提现</Text>
            </View>
          </View>
        </View>

        {/* 筛选栏 */}
        <View className="filter-bar">
          {[
            { key: 'all', label: '全部' },
            { key: 'recharge', label: '充值' },
            { key: 'withdraw', label: '提现' },
            { key: 'commission', label: '分佣' },
            { key: 'order', label: '订单' }
          ].map(item => (
            <View
              key={item.key}
              className={`filter-item ${typeFilter === item.key ? 'active' : ''}`}
              onClick={() => setTypeFilter(item.key)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* 交易列表 */}
        <View className="transaction-list">
          {transactions.map(tx => (
            <View key={tx.id} className="transaction-card">
              <View className="tx-header">
                <View className="tx-type">
                  {getTypeIcon(tx.type)}
                  <View className="type-info">
                    <Text className="type-name">{getTypeText(tx.type)}</Text>
                    <Text className="tx-user">{tx.nickname}</Text>
                  </View>
                </View>
                <View className="tx-amount">
                  <Text className={`amount-value ${tx.type === 'withdraw' ? 'negative' : 'positive'}`}>
                    {tx.type === 'withdraw' ? '-' : '+'}¥{tx.amount.toFixed(2)}
                  </Text>
                  <View 
                    className="tx-status"
                    style={{ backgroundColor: getStatusColor(tx.status) + '20' }}
                  >
                    <Text style={{ color: getStatusColor(tx.status) }}>
                      {tx.status === 'pending' ? '待处理' : tx.status === 'completed' ? '已完成' : '已驳回'}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View className="tx-body">
                <Text className="tx-desc">{tx.description}</Text>
                <Text className="tx-time">{tx.created_at}</Text>
              </View>
              
              {tx.type === 'withdraw' && tx.status === 'pending' && (
                <View className="tx-actions">
                  <Button 
                    className="btn-approve"
                    onClick={() => handleWithdrawApprove(tx.id)}
                  >
                    <Check size={14} color="#10b981" />
                    <Text>通过</Text>
                  </Button>
                  <Button 
                    className="btn-reject"
                    onClick={() => {
                      setSelectedTransaction(tx)
                      setShowWithdrawModal(true)
                    }}
                  >
                    <X size={14} color="#ef4444" />
                    <Text>驳回</Text>
                  </Button>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* 驳回弹窗 */}
        {showWithdrawModal && (
          <View className="modal-overlay">
            <View className="modal-content">
              <Text className="modal-title">驳回提现申请</Text>
              <Text className="modal-desc">请输入驳回原因</Text>
              <Input
                className="reject-input"
                placeholder="请输入驳回原因..."
                value={rejectReason}
                onInput={(e: any) => setRejectReason(e.detail?.value || '')}
              />
              <View className="modal-actions">
                <Button className="btn-cancel" onClick={() => setShowWithdrawModal(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="btn-confirm" onClick={handleWithdrawReject}>
                  <Text>确认驳回</Text>
                </Button>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </AdminLayout>
  )
}
