import { View, Text } from '@tarojs/components'
import './index.css'

export default function OrderProcessing() {
  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <View className="bg-white rounded-lg p-4">
        <Text className="block text-lg font-semibold text-center">处理中订单</Text>
      </View>
    </View>
  )
}
