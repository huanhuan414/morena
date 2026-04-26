import { useLoad, useRouter } from '@tarojs/taro'
import { WebView, View } from '@tarojs/components'
import { useState } from 'react'
import './index.css'

export default function WebviewPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')

  useLoad(() => {
    // 从路由参数中获取 URL
    const params = router.params
    if (params.url) {
      setUrl(decodeURIComponent(params.url))
    }
  })

  return (
    <View className="webview-page">
      <WebView src={url} />
    </View>
  )
}
