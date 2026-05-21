import { useState } from 'react'
import { View, Text, WebView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ArrowLeft } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'

const statusBarHeight = getStatusBarHeight()

export default function OauthWebviewPage() {
  const [url, setUrl] = useState('')

  useLoad((options) => {
    if (options.url) {
      setUrl(decodeURIComponent(options.url))
    }
  })

  const handleBack = () => {
    Taro.navigateBack()
  }

  const handleMessage = (e: any) => {
    console.log('[OAuthWebView] 收到消息:', e.detail.data)
  }

  if (!url) {
    return (
      <View className="flex flex-col h-full items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  return (
    <View className="flex flex-col h-full">
      {/* 自定义导航栏 */}
      <View style={{ paddingTop: `${statusBarHeight}px`, backgroundColor: '#fff' }}>
        <View style={{ display: 'flex', alignItems: 'center', height: '44px', padding: '0 12px' }}>
          <View onClick={handleBack} style={{ padding: '8px' }}>
            <ArrowLeft size={24} color="#333" />
          </View>
          <Text style={{ flex: 1, textAlign: 'center', fontWeight: '600', fontSize: '16px' }}>抖音授权</Text>
          <View style={{ width: '40px' }} />
        </View>
      </View>

      {/* WebView */}
      {isWeapp ? (
        <WebView src={url} onMessage={handleMessage} />
      ) : (
        <View className="flex flex-col items-center justify-center h-full p-4">
          <Text className="block text-gray-500 text-center text-sm">
            抖音 OAuth 授权仅支持在小程序环境中使用{'\n'}请在微信小程序中打开体验完整功能
          </Text>
        </View>
      )}
    </View>
  )
}
