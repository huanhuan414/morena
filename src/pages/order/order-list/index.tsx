import { View, Text } from '@tarojs/components'
import './index.css'

export default function OrderList() {
  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <View className="bg-white rounded-lg p-4">
        <Text className="block text-lg font-semibold text-center">订单列表</Text>
        <Text className="block text-gray-500 text-sm text-center mt-2">暂无订单</Text>
      </View>
    </View>
  )
}
