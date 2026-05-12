import { useLoad, useRouter, redirectTo, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import { Loader, ArrowLeft } from 'lucide-react-taro'
import './index.css'

interface OrderProcessingData {
  requestId?: string
  orderId?: string
  avatarId?: string
  status?: string
  generatedContent?: {
    content?: string
    images?: string[]
    videos?: string[]
    platforms?: string[]
  } | null
}

export default function OrderProcessingPage() {
  const router = useRouter()
  const { requestId, avatarId, orderId } = router.params
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    if (!orderId) {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
      return
    }

    bridgeToCanonicalFlow()
  })

  const bridgeToCanonicalFlow = async () => {
    try {
      const identifier = requestId || orderId
      if (!identifier) {
        throw new Error('缺少处理标识')
      }

      const res = await Network.request({
        url: `/api/order-processing/status/${identifier}`
      })

      const data = res.data?.data as OrderProcessingData | undefined
      const normalizedRequestId = data?.requestId || requestId || ''
      const normalizedAvatarId = data?.avatarId || avatarId || ''
      const normalizedOrderId = data?.orderId || orderId || ''
      const query = [
        `orderId=${encodeURIComponent(normalizedOrderId)}`,
        normalizedAvatarId ? `avatarId=${encodeURIComponent(normalizedAvatarId)}` : '',
        normalizedRequestId ? `requestId=${encodeURIComponent(normalizedRequestId)}` : '',
      ].filter(Boolean).join('&')

      if (!data) {
        await redirectTo({
          url: `/package-order/pages/order-content-creation/index?orderId=${encodeURIComponent(orderId || '')}`
        })
        return
      }

      if (['published', 'awaiting_acceptance'].includes(data.status || '')) {
        await redirectTo({
          url: `/package-order/pages/order-publish-feedback/index?${query}`
        })
        return
      }

      await redirectTo({
        url: `/package-order/pages/order-content-creation/index?orderId=${encodeURIComponent(normalizedOrderId)}`
      })
    } catch (error) {
      console.error('[OrderProcessingBridge] 跳转失败:', error)
      showToast({ title: '跳转失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className="order-processing-page">
        <View className="loading-wrapper">
          <Loader size={32} color="#00f5ff" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="order-processing-page">
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title block">订单处理中</Text>
        <View className="header-right" />
      </View>
      <View className="loading-wrapper">
        <Loader size={32} color="#00f5ff" />
        <Text className="loading-text">正在跳转到最新处理链路...</Text>
      </View>
    </View>
  )
}
