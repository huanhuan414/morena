import { View, Text } from '@tarojs/components'
import AdminLayout from '@/components/admin/Layout'
import './index.css'

export default function SkillManagement() {
  return (
    <AdminLayout title="技能管理">
      <View className="skills-page">
        <Text className="placeholder-text">技能管理功能开发中...</Text>
      </View>
    </AdminLayout>
  )
}
