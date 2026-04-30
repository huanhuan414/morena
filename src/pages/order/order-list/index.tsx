import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import './index.css'

interface Order {
  id: string
  title: string
  description: string
  status: string
  budget: number
  created_at: string
  platform?: string
}

const STATUS_MAP = {
  open: '待接单',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  pending_payment: '待支付'
}

const TABS = [
  { key: '', label: '全部' },
  { key: 'open', label: '待接单' },
  { key: 'in_progress', label: '进行中' },
  { key: 'completed', label: '已完成' }
]

export default function OrderList() {
  const [activeTab, setActiveTab] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOrders = async (status?: string) => {
    setLoading(true)
    try {
      const url = status ? `/api/order/list?status=${status}` : '/api/order/list'
      const res = await Network.request({ url })
      console.log('订单列表:', res.data)
      if (res.data?.code === 200) {
        setOrders(res.data.data || [])
      }
    } catch (err) {
      console.error('获取订单失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(activeTab || undefined)
  }, [activeTab])

  const handleCreateOrder = () => {
    Taro.navigateTo({ url: '/pages/order/order-create/index' })
  }

  const handleOrderClick = (orderId: string) => {
    Taro.navigateTo({ url: `/pages/order/order-detail/index?id=${orderId}` })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-500',
      pending_payment: 'bg-orange-100 text-orange-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部Tab */}
      <View className="bg-white sticky top-0 z-10">
        <ScrollView scrollX className="flex flex-row">
          {TABS.map(tab => (
            <View
              key={tab.key}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.key
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className="block">{tab.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 订单列表 */}
      <View className="p-4 pb-20">
        {loading ? (
          <View className="flex justify-center items-center py-20">
            <Text className="block text-gray-500">加载中...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Text className="block text-gray-400 text-lg mb-4">暂无订单</Text>
            <View
              className="px-6 py-2 bg-primary text-white rounded-full"
              onClick={handleCreateOrder}
            >
              <Text className="block text-white text-sm">新建订单</Text>
            </View>
          </View>
        ) : (
          orders.map(order => (
            <View
              key={order.id}
              className="bg-white rounded-xl p-4 mb-3 shadow-sm"
              onClick={() => handleOrderClick(order.id)}
            >
              <View className="flex justify-between items-start mb-2">
                <Text className="block text-base font-medium text-gray-900 flex-1">
                  {order.title || '未命名订单'}
                </Text>
                <View className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                  <Text className="block">{STATUS_MAP[order.status] || order.status}</Text>
                </View>
              </View>
              <Text className="block text-sm text-gray-500 mb-2">
                {order.description || '无描述'}
              </Text>
              <View className="flex justify-between items-center">
                <Text className="block text-xs text-gray-400">
                  {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                </Text>
                {order.budget > 0 && (
                  <Text className="block text-sm text-primary font-medium">
                    ¥{order.budget}
                  </Text>
                )}
              </View>
              {order.platform && (
                <View className="mt-2">
                  <Text className="block text-xs text-gray-400">
                    平台: {order.platform}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* 底部新建按钮 */}
      {orders.length > 0 && (
        <View className="fixed bottom-20 left-4 right-4">
          <View
            className="bg-primary text-white text-center py-3 rounded-full shadow-lg"
            onClick={handleCreateOrder}
          >
            <Text className="block text-white font-medium">新建订单</Text>
          </View>
        </View>
      )}
    </View>
  )
}
