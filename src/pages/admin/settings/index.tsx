import { View, Text } from '@tarojs/components'
import AdminLayout from '@/components/admin/Layout'
import './index.css'

export default function SystemSettings() {
  return (
    <AdminLayout title="系统设置">
      <View className="settings-page">
        <Text className="placeholder-text">系统设置功能开发中...</Text>
      </View>
    </AdminLayout>
  )
}
