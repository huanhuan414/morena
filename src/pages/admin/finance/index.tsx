import { View, Text } from '@tarojs/components'
import AdminLayout from '@/components/admin/Layout'
import './index.css'

export default function FinanceManagement() {
  return (
    <AdminLayout title="财务管理">
      <View className="finance-page">
        <Text className="placeholder-text">财务管理功能开发中...</Text>
      </View>
    </AdminLayout>
  )
}
