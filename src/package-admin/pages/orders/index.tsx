import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Search } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Network } from '@/network'
import './index.css'

interface Order {
  id: string
  title: string
  price: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  customer_phone: string
  avatar_name: string
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
    fetchOrders()
  }, [page, searchKeyword, statusFilter])

  const fetchOrders = async () => {
    try {
      const res = await Network.request({
        url: '/api/admin/orders',
        data: { 
          page, 
          limit: 20, 
          keyword: searchKeyword,
          status: statusFilter === 'all' ? undefined : statusFilter
        }
      })
      
      if (res.data.code === 200) {
        setOrders(res.data.data.list)
        setTotal(res.data.data.total)
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

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待接单',
      processing: '进行中',
      completed: '已完成',
      cancelled: '已取消'
    }
    return map[status] || status
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
                <Text className="td col-customer">{order.customer_phone || '-'}</Text>
                <Text className="td col-avatar">{order.avatar_name || '-'}</Text>
                <Text className="td col-price highlight">¥{order.price}</Text>
                <View className="td col-status">
                  <View className={`status-badge ${order.status}`}>
                    <Text className="status-text">{getStatusText(order.status)}</Text>
                  </View>
                </View>
                <Text className="td col-date">{new Date(order.created_at).toLocaleDateString('zh-CN')}</Text>
                <View className="td col-action">
                  <View className="action-btns">
                    {order.status === 'processing' && (
                      <>
                        <View 
                          className="action-btn complete"
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                        >
                          <Text style={{ color: '#10b981', fontSize: '24rpx' }}>✓</Text>
                        </View>
                        <View 
                          className="action-btn cancel"
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        >
                          <Text style={{ color: '#ef4444', fontSize: '24rpx' }}>✕</Text>
                        </View>
                      </>
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
