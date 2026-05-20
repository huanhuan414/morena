import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Search, Check, X } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import * as Network from '@/network'
import './index.css'

interface Order {
  id: string
  title: string
  budget: number | string
  status: string
  phone?: string
  nickname?: string
  avatar_name?: string
  created_at: string
  completed_at?: string
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders()
    }, 300)
    return () => clearTimeout(timer)
  }, [page, searchKeyword, statusFilter])

  const fetchOrders = async () => {
    try {
      const keyword = searchKeyword.trim()
      const query: Record<string, any> = { page, limit: 20 }
      if (keyword) query.keyword = keyword
      if (statusFilter !== 'all') query.status = statusFilter
      const res = await Network.request({
        url: '/api/admin/orders',
        data: query
      })
      
      if (res.data.code === 200) {
        const list = Array.isArray(res.data.data?.list) ? res.data.data.list : []
        setOrders(list)
        setTotal(Number(res.data.data?.total) || 0)
      }
    } catch (err) {
      console.error('获取订单列表失败:', err)
    }
  }

  const handleUpdateStatus = async (orderId: string, status: string) => {
    const actionText = status === 'completed' ? '完成' : '取消'
    
    Taro.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}该订单吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await Network.request({
              url: '/api/admin/orders/update-status',
              method: 'POST',
              data: { order_id: orderId, status }
            })
            
            if (result.data.code === 200) {
              Taro.showToast({ title: `${actionText}成功`, icon: 'success' })
              fetchOrders()
            }
          } catch (err) {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }

  const statusOptions = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待接单' },
    { key: 'processing', label: '进行中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' }
  ]

  const statusMeta = useMemo(() => {
    const pending = new Set(['pending_payment', 'open', 'pending_dispatch', 'pending_acceptance'])
    const processing = new Set(['in_progress', 'submitted', 'awaiting_acceptance', 'revision_requested'])
    const completed = new Set(['completed'])
    const cancelled = new Set(['cancelled', 'rejected'])

    const getCategory = (status: string) => {
      const value = String(status || '').trim().toLowerCase()
      if (pending.has(value)) return 'pending'
      if (processing.has(value)) return 'processing'
      if (completed.has(value)) return 'completed'
      if (cancelled.has(value)) return 'cancelled'
      return 'processing'
    }

    const getText = (status: string) => {
      const value = String(status || '').trim().toLowerCase()
      const map: Record<string, string> = {
        pending_payment: '待支付',
        open: '待分发',
        pending_dispatch: '待分发',
        pending_acceptance: '待接单',
        in_progress: '进行中',
        submitted: '已提交',
        awaiting_acceptance: '待验收',
        revision_requested: '需返工',
        completed: '已完成',
        cancelled: '已取消',
        rejected: '已拒单',
      }
      return map[value] || status
    }

    return { getCategory, getText }
  }, [])

  const getCustomerText = (order: Order) => {
    const nickname = String(order.nickname || '').trim()
    const phone = String(order.phone || '').trim()
    if (nickname && phone) return `${nickname} / ${phone}`
    return nickname || phone || '-'
  }

  const getPriceText = (budget: number | string) => {
    const value = Number(budget || 0)
    if (Number.isFinite(value)) return `¥${value.toFixed(2)}`
    return `¥${budget}`
  }

  const formatDate = (value: any) => {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <AdminLayout title="订单管理">
      <View className="orders-page">
        <View className="page-header">
          <View className="search-box">
            <Search size={18} color="#9ca3af" />
            <Input
              className="search-input"
              placeholder="搜索订单标题/用户"
              value={searchKeyword}
              onInput={(e: any) => setSearchKeyword(e.detail?.value || '')}
              onConfirm={fetchOrders}
            />
          </View>
          <Text className="stat-text">共 {total} 个订单</Text>
        </View>

        <View className="filter-tabs">
          {statusOptions.map(option => (
            <View 
              key={option.key}
              className={`filter-tab ${statusFilter === option.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(option.key)}
            >
              <Text className="filter-tab-text">{option.label}</Text>
            </View>
          ))}
        </View>

        <View className="data-table">
          <View className="table-header">
            <Text className="th col-order">订单信息</Text>
            <Text className="th col-customer">客户</Text>
            <Text className="th col-avatar">服务分身</Text>
            <Text className="th col-price">金额</Text>
            <Text className="th col-status">状态</Text>
            <Text className="th col-date">创建时间</Text>
            <Text className="th col-action">操作</Text>
          </View>
          
          <ScrollView className="table-body" scrollY>
            {orders.map(order => (
              <View key={order.id} className="table-row">
                <View className="td col-order">
                  <Text className="order-title">{order.title}</Text>
                  <Text className="order-id">ID: {order.id.slice(-8)}</Text>
                </View>
                <Text className="td col-customer">{getCustomerText(order)}</Text>
                <Text className="td col-avatar">{order.avatar_name || '-'}</Text>
                <Text className="td col-price highlight">{getPriceText(order.budget)}</Text>
                <View className="td col-status">
                  <View className={`status-badge ${statusMeta.getCategory(order.status)}`}>
                    <Text className="status-text">{statusMeta.getText(order.status)}</Text>
                  </View>
                </View>
                <Text className="td col-date">{formatDate(order.created_at)}</Text>
                <View className="td col-action">
                  <View className="action-btns">
                    {statusMeta.getCategory(order.status) === 'processing' && (
                      <>
                        <View 
                          className="action-btn complete"
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                        >
                          <Check size={16} color="#10b981" />
                        </View>
                        <View 
                          className="action-btn cancel"
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        >
                          <X size={16} color="#ef4444" />
                        </View>
                      </>
                    )}
                    {statusMeta.getCategory(order.status) === 'pending' && (
                      <View 
                        className="action-btn cancel"
                        onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                      >
                        <X size={16} color="#ef4444" />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </AdminLayout>
  )
}
