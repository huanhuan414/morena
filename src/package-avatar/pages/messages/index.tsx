import { View, Text } from '@tarojs/components'
import './index.css'

export default function Messages() {
  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <View className="bg-white rounded-lg p-4">
        <Text className="block text-lg font-semibold text-center">消息中心</Text>
        <Text className="block text-gray-500 text-sm text-center mt-2">暂无消息</Text>
      </View>
    </View>
  )
}
