import { View, Text } from '@tarojs/components'
import AdminLayout from '@/components/admin/Layout'
import './index.css'

export default function OrderManagement() {
  return (
    <AdminLayout title="订单管理">
      <View className="orders-page">
        <Text className="placeholder-text">订单管理功能开发中...</Text>
      </View>
    </AdminLayout>
  )
}
