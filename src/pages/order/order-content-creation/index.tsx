import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, CircleCheck, CircleAlert, RefreshCw } from 'lucide-react-taro'
import { Network } from '@/network'
import MarkdownRenderer from '@/components/markdown-renderer'
import './index.css'

interface GeneratedContent {
  content: string
  images: string[]
  videos: string[]
  platform: string
}

interface ProcessingData {
  id: string
  order_id: string
  status: string
  generatedContent: GeneratedContent | null
}

const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号', xiaohongshu: '小红书', douyin: '抖音',
  weibo: '微博', bilibili: 'B站', kuaishou: '快手', wechat_moments: '朋友圈'
}

export default function OrderContentCreation() {
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState<'loading' | 'generating' | 'completed' | 'error' | 'idle'>('loading')
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance?.router?.params?.orderId || ''
    console.log('[内容生成] 页面初始化, orderId:', id)
    if (id) {
      setOrderId(id)
    } else {
      setStatus('error')
      setErrorMsg('缺少订单ID参数')
    }
  }, [])

  useEffect(() => {
    if (orderId) {
      checkAndGenerate()
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [orderId])

  const checkAndGenerate = async () => {
    console.log('[内容生成] 检查订单状态, orderId:', orderId)
    setStatus('loading')

    try {
      const res = await Network.request({
        url: `/api/order-processing/status/${orderId}`
      })
      console.log('[内容生成] 状态查询结果:', JSON.stringify(res?.data))

      if (res?.data?.code === 200 && res?.data?.data) {
        const data = res.data.data as ProcessingData
        setProcessingData(data)
        if (data.status === 'completed' && data.generatedContent) {
          setStatus('completed')
          return
        }
      }

      // 没有生成记录，开始生成
      startGeneration()
    } catch (err: any) {
      console.log('[内容生成] 状态查询失败，直接开始生成:', err.message)
      startGeneration()
    }
  }

  const startGeneration = async () => {
    console.log('[内容生成] 开始生成内容, orderId:', orderId)
    setStatus('generating')

    try {
      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId,
          avatarId: 'default',
          orderTitle: '商单内容',
          orderDescription: '根据订单要求生成内容',
          platforms: ['xiaohongshu'],
          contentType: 'image_text',
          targetAudience: '年轻人',
          contentQuantity: 3
        }
      })
      console.log('[内容生成] 生成接口返回:', JSON.stringify(res?.data))

      if (res?.data?.code === 200) {
        // 轮询状态
        pollStatus()
      } else {
        setStatus('error')
        setErrorMsg(res?.data?.message || '生成请求失败')
      }
    } catch (err: any) {
      console.error('[内容生成] 生成请求失败:', err)
      setStatus('error')
      setErrorMsg(err.message || '生成请求失败')
    }
  }

  const pollStatus = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)

    pollTimer.current = setTimeout(async () => {
      try {
        const res = await Network.request({
          url: `/api/order-processing/status/${orderId}`
        })
        console.log('[内容生成] 轮询结果:', JSON.stringify(res?.data))

        if (res?.data?.code === 200 && res?.data?.data) {
          const data = res.data.data as ProcessingData
          setProcessingData(data)
          if (data.status === 'completed') {
            setStatus('completed')
            return
          }
          if (data.status === 'failed') {
            setStatus('error')
            setErrorMsg('内容生成失败')
            return
          }
        }
        // 继续轮询
        pollStatus()
      } catch (err) {
        console.error('[内容生成] 轮询失败:', err)
        pollStatus()
      }
    }, 2000)
  }

  const handleRetry = () => {
    setErrorMsg('')
    setProcessingData(null)
    checkAndGenerate()
  }

  const getPlatformName = (p: string) => PLATFORM_NAMES[p] || p || '未知平台'

  return (
    <View className="page-container">
      {/* 加载中 */}
      {status === 'loading' && (
        <View className="status-center">
          <Loader size={32} color="#3b82f6" className="animate-spin" />
          <Text className="block text-gray-600 mt-4 text-base">正在检查订单状态...</Text>
        </View>
      )}

      {/* 生成中 */}
      {status === 'generating' && (
        <View className="status-center">
          <View className="gen-animation">
            <Loader size={48} color="#3b82f6" className="animate-spin" />
          </View>
          <Text className="block text-gray-800 mt-4 text-lg font-semibold">正在生成内容</Text>
          <Text className="block text-gray-500 mt-2 text-sm">AI正在为你创作精彩内容，请稍候...</Text>
        </View>
      )}

      {/* 错误 */}
      {status === 'error' && (
        <View className="status-center">
          <CircleAlert size={48} color="#ef4444" />
          <Text className="block text-gray-800 mt-4 text-lg font-semibold">生成失败</Text>
          <Text className="block text-gray-500 mt-2 text-sm">{errorMsg}</Text>
          <View className="mt-6">
            <Button onClick={handleRetry}>
              <RefreshCw size={14} color="#fff" className="mr-1" />
              <Text className="text-white">重新生成</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 生成完成 - 展示内容 */}
      {status === 'completed' && processingData?.generatedContent && (
        <View className="content-area">
          {/* 成功提示 */}
          <View className="success-bar">
            <CircleCheck size={16} color="#22c55e" />
            <Text className="text-green-700 text-sm ml-2">内容生成完成</Text>
          </View>

          {/* 平台标签 */}
          {processingData.generatedContent.platform && (
            <View className="platform-tag">
              <Text className="text-xs text-blue-700 font-medium">
                {getPlatformName(processingData.generatedContent.platform)}
              </Text>
            </View>
          )}

          {/* 文案内容 - Markdown渲染 */}
          {processingData.generatedContent.content && (
            <Card className="content-card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">生成文案</CardTitle>
              </CardHeader>
              <CardContent className="card-body">
                <MarkdownRenderer content={processingData.generatedContent.content} />
              </CardContent>
            </Card>
          )}

          {/* 图片展示 */}
          {processingData.generatedContent.images?.length > 0 && (
            <Card className="content-card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">生成图片 ({processingData.generatedContent.images.length}张)</CardTitle>
              </CardHeader>
              <CardContent className="card-body">
                <View className="image-grid">
                  {processingData.generatedContent.images.map((img, idx) => (
                    <View key={idx} className="image-item" onClick={() => previewImage(img, processingData.generatedContent!.images)}>
                      <Image src={img} mode="aspectFill" className="image-fill" />
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* 视频展示 */}
          {processingData.generatedContent.videos?.length > 0 && (
            <Card className="content-card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">生成视频 ({processingData.generatedContent.videos.length}个)</CardTitle>
              </CardHeader>
              <CardContent className="card-body">
                {processingData.generatedContent.videos.map((video, idx) => (
                  <View key={idx} className="video-item" onClick={() => Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(video)}` })}>
                    <View className="video-play-icon">
                      <Text className="text-white text-lg">&#9654;</Text>
                    </View>
                    <Text className="block text-sm text-blue-600 mt-2">视频 {idx + 1}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          <View className="action-bar">
            <Button className="action-btn" onClick={handleRetry}>
              <RefreshCw size={14} color="#3b82f6" />
              <Text className="text-blue-600 ml-1">重新生成</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

function previewImage(current: string, urls: string[]) {
  Taro.previewImage({ current, urls })
}
