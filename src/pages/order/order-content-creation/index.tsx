import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader, CircleCheck, CircleAlert, RefreshCw, Image as ImageIcon, Film } from 'lucide-react-taro'
import { Network } from '@/network'
import MarkdownRenderer from '@/components/markdown-renderer'
import './index.css'

interface GeneratedContent {
  content: string
  images: string[]
  videos: string[]
  platform: string
}

const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号', xiaohongshu: '小红书', douyin: '抖音',
  weibo: '微博', bilibili: 'B站', kuaishou: '快手', wechat_moments: '朋友圈',
  wechat: '微信'
}

export default function OrderContentCreation() {
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState<'loading' | 'generating' | 'completed' | 'error' | 'idle'>('loading')
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [progressText, setProgressText] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. 获取路由参数
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

  // 2. 订单ID变化时，检查状态
  useEffect(() => {
    if (orderId) {
      checkOrderStatus()
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [orderId])

  // 查询订单的生成状态
  const checkOrderStatus = async () => {
    try {
      console.log('[内容生成] 查询订单状态, orderId:', orderId)
      const res = await Network.request({
        url: `/api/order-processing/status/${orderId}`
      })
      console.log('[内容生成] 状态查询结果:', JSON.stringify(res.data))

      const data = res.data?.data
      if (data && data.status === 'completed' && data.generatedContent) {
        // 已有生成内容，直接展示
        console.log('[内容生成] 已有生成内容，直接展示')
        setGeneratedContent(data.generatedContent)
        setStatus('completed')
      } else if (data && data.status === 'processing') {
        // 正在生成中，开始轮询
        console.log('[内容生成] 正在生成中，开始轮询')
        setStatus('generating')
        setProgressText('内容生成中...')
        if (data.generatedContent?.content) {
          setGeneratedContent(data.generatedContent)
        }
        startPolling()
      } else {
        // 没有生成记录，开始生成
        console.log('[内容生成] 没有生成记录，开始生成')
        startGeneration()
      }
    } catch (err: any) {
      console.log('[内容生成] 查询失败，开始生成:', err.message)
      startGeneration()
    }
  }

  // 调用生成接口
  const startGeneration = async () => {
    try {
      setStatus('generating')
      setProgressText('正在提交生成请求...')

      console.log('[内容生成] 调用生成接口, orderId:', orderId)
      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId,
          avatarId: 'default',
          orderTitle: '商单内容',
          orderDescription: '根据商单要求生成内容',
          platforms: ['xiaohongshu'],
          contentType: 'image_text',
          targetAudience: '年轻人',
          contentQuantity: 3
        }
      })

      console.log('[内容生成] 生成接口返回:', JSON.stringify(res.data))

      if (res.data?.code === 200) {
        setProgressText('生成请求已提交，等待生成...')
        // 开始轮询状态
        startPolling()
      } else {
        setStatus('error')
        setErrorMsg(res.data?.message || '生成请求失败')
      }
    } catch (err: any) {
      console.error('[内容生成] 生成接口失败:', err.message)
      setStatus('error')
      setErrorMsg('生成请求失败: ' + err.message)
    }
  }

  // 轮询生成状态
  const startPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)

    const poll = async () => {
      try {
        const res = await Network.request({
          url: `/api/order-processing/status/${orderId}`
        })
        const data = res.data?.data

        if (data) {
          if (data.status === 'completed' && data.generatedContent) {
            console.log('[内容生成] 生成完成')
            setGeneratedContent(data.generatedContent)
            setStatus('completed')
            return
          } else if (data.status === 'processing') {
            // 更新部分内容
            if (data.generatedContent?.content) {
              setGeneratedContent(data.generatedContent)
              setProgressText('文案已生成，图片生成中...')
            } else {
              setProgressText('内容生成中...')
            }
          } else if (data.status === 'failed') {
            setStatus('error')
            setErrorMsg('内容生成失败')
            return
          }
        }
      } catch (err: any) {
        console.warn('[内容生成] 轮询失败:', err.message)
      }

      // 3秒后继续轮询
      pollTimer.current = setTimeout(poll, 3000)
    }

    // 立即开始第一次轮询
    poll()
  }

  // 重新生成
  const handleRegenerate = () => {
    setGeneratedContent(null)
    setStatus('idle')
    setErrorMsg('')
    startGeneration()
  }

  return (
    <View className="content-creation-page">
      {/* 顶部标题 */}
      <View className="page-header">
        <Text className="block text-lg font-bold">内容生成</Text>
        {orderId && <Text className="block text-xs text-gray-400 mt-1">订单: {orderId.slice(0, 8)}...</Text>}
      </View>

      {/* 加载中 */}
      {status === 'loading' && (
        <View className="flex-1 flex items-center justify-center">
          <Loader size={32} color="#1890ff" className="animate-spin" />
          <Text className="block text-gray-500 mt-4">加载中...</Text>
        </View>
      )}

      {/* 生成中 */}
      {status === 'generating' && (
        <View className="generating-container">
          <View className="generating-card">
            <Loader size={40} color="#1890ff" className="animate-spin" />
            <Text className="block text-base font-semibold mt-4">{progressText || '内容生成中...'}</Text>
            <Text className="block text-sm text-gray-400 mt-2">AI 正在为您创作内容，请耐心等待</Text>

            {/* 如果已有部分内容，实时预览 */}
            {generatedContent?.content && (
              <View className="mt-4 w-full">
                <Text className="block text-sm text-gray-500 mb-2">文案预览：</Text>
                <View className="preview-box">
                  <MarkdownRenderer content={generatedContent.content} />
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 生成完成 */}
      {status === 'completed' && generatedContent && (
        <View className="content-container">
          {/* 文案区域 */}
          {generatedContent.content && (
            <Card className="content-card">
              <View className="card-header">
                <CircleCheck size={18} color="#52c41a" />
                <Text className="block font-semibold text-base ml-2">生成文案</Text>
                {generatedContent.platform && (
                  <Text className="block text-xs text-gray-400 ml-auto">
                    {PLATFORM_NAMES[generatedContent.platform] || generatedContent.platform}
                  </Text>
                )}
              </View>
              <CardContent className="px-4 pb-4">
                <View className="markdown-content">
                  <MarkdownRenderer content={generatedContent.content} />
                </View>
              </CardContent>
            </Card>
          )}

          {/* 图片区域 */}
          {generatedContent.images && generatedContent.images.length > 0 && (
            <Card className="content-card">
              <View className="card-header">
                <ImageIcon size={18} color="#1890ff" />
                <Text className="block font-semibold text-base ml-2">生成图片 ({generatedContent.images.length}张)</Text>
              </View>
              <CardContent className="px-4 pb-4">
                <View className="image-grid">
                  {generatedContent.images.map((img, idx) => (
                    <View key={idx} className="image-item">
                      <Image
                        src={img}
                        mode="aspectFill"
                        className="generated-image"
                        onClick={() => {
                          Taro.previewImage({ current: img, urls: generatedContent.images })
                        }}
                      />
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* 视频区域 */}
          {generatedContent.videos && generatedContent.videos.length > 0 && (
            <Card className="content-card">
              <View className="card-header">
                <Film size={18} color="#722ed1" />
                <Text className="block font-semibold text-base ml-2">生成视频</Text>
              </View>
              <CardContent className="px-4 pb-4">
                {generatedContent.videos.map((video, idx) => (
                  <View key={idx} className="video-item">
                    <Text className="block text-sm text-blue-500">{video}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          <View className="action-bar">
            <Button onClick={handleRegenerate} variant="outline" className="flex-1">
              <RefreshCw size={14} color="#666" className="mr-1" />
              <Text>重新生成</Text>
            </Button>
            <Button
              onClick={() => {
                Taro.setClipboardData({ data: generatedContent?.content || '' })
              }}
              className="flex-1"
            >
              <Text>复制文案</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 生成失败 */}
      {status === 'error' && (
        <View className="error-container">
          <View className="error-card">
            <CircleAlert size={40} color="#ff4d4f" />
            <Text className="block text-base font-semibold mt-4">生成失败</Text>
            <Text className="block text-sm text-gray-500 mt-2">{errorMsg}</Text>
            <Button onClick={handleRegenerate} className="mt-4" variant="outline">
              <RefreshCw size={14} color="#666" className="mr-1" />
              <Text>重新生成</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
