import { View, Text } from '@tarojs/components'
import AdminLayout from '@/components/admin/Layout'
import './index.css'

export default function ContentManagement() {
  return (
    <AdminLayout title="内容管理">
      <View className="content-page">
        <Text className="placeholder-text">内容管理功能开发中...</Text>
      </View>
    </AdminLayout>
  )
}
