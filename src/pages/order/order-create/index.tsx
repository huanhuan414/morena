import { View, Text } from '@tarojs/components'
import './index.css'

export default function OrderCreate() {
  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <View className="bg-white rounded-lg p-4">
        <Text className="block text-lg font-semibold text-center">创建订单</Text>
      </View>
    </View>
  )
}
