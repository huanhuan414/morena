import { View, Text } from '@tarojs/components'

export default function About() {
  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <View className="bg-white rounded-2xl p-6 shadow-sm">
        <Text className="block text-2xl font-bold text-center mb-4">关于</Text>
        <Text className="block text-gray-600 text-center">我的分身 v1.0.0</Text>
      </View>
    </View>
  )
}
