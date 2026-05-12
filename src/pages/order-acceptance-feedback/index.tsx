import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { safeNavigateBack } from '@/utils/navigation'
import './index.css'

export default function OrderAcceptanceFeedback() {
  const router = useRouter()
  const { requestId = '', orderId = '', avatarId = '', role } = router.params

  const [redirectMessage, setRedirectMessage] = useState('正在跳转到统一链路...')

  useLoad(() => {
    void redirectToCanonicalPage()
  })

  const redirectToUrl = async (url: string) => {
    try {
      await Taro.redirectTo({ url })
    } catch {
      await Taro.navigateTo({ url })
    }
  }

  const redirectToCanonicalPage = async () => {
    if (role === 'avatar') {
      const query = [
        orderId ? `orderId=${encodeURIComponent(orderId)}` : '',
        avatarId ? `avatarId=${encodeURIComponent(avatarId)}` : '',
        requestId ? `requestId=${encodeURIComponent(requestId)}` : '',
      ].filter(Boolean).join('&')

      if (!query) {
        setRedirectMessage('缺少必要参数，无法跳转')
        return
      }

      await redirectToUrl(`/pages/order/order-processing/index?${query}`)
      return
    }

    if (orderId) {
      await redirectToUrl(`/pages/order/order-acceptance/index?orderId=${encodeURIComponent(orderId)}`)
      return
    }

    if (requestId) {
      const query = [
        requestId ? `requestId=${encodeURIComponent(requestId)}` : '',
        avatarId ? `avatarId=${encodeURIComponent(avatarId)}` : '',
      ].filter(Boolean).join('&')
      await redirectToUrl(`/pages/order/order-processing/index?${query}`)
      return
    }

    setRedirectMessage('缺少必要参数，无法跳转')
    Taro.showToast({ title: '缺少参数', icon: 'none' })
    setTimeout(() => {
      void safeNavigateBack('/pages/order/order-list/index')
    }, 1200)
  }

  return (
    <View className="page-container">
      <View className="loading-container">
        <Text className="loading-text">{redirectMessage}</Text>
      </View>
    </View>
  )
}
