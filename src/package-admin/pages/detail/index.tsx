import { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.css'

export default function UserDetail() {
  useEffect(() => {
    const { id } = Taro.getCurrentInstance().router?.params || {}
    if (id) {
      Taro.redirectTo({ url: `/package-admin/pages/users/detail/index?id=${id}` })
      return
    }
    Taro.redirectTo({ url: '/package-admin/pages/users/index' })
  }, [])

  return (
    <View className="user-detail-page">
      <Text className="loading-text">加载中...</Text>
    </View>
  )
}
