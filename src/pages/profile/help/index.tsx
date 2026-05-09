import { View, Text } from '@tarojs/components'

export default function Help() {
  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <View className="bg-white rounded-2xl p-6 shadow-sm">
        <Text className="block text-2xl font-bold text-center mb-4">帮助中心</Text>
        <Text className="block text-gray-600">常见问题解答</Text>
      </View>
    </View>
  )
}
