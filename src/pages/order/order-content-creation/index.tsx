import { useState, useEffect, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, CircleCheck, CircleAlert, FileText, Image as ImageIcon, Video, RefreshCw } from 'lucide-react-taro'

// 生成状态类型
type GenStatus = 'loading' | 'generating' | 'completed' | 'failed'

export default function OrderContentCreation() {
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState<GenStatus>('loading')
  const [orderTitle, setOrderTitle] = useState('商单内容')
  const [orderDesc, setOrderDesc] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['xiaohongshu'])
  const [contentType, setContentType] = useState('image_text')
  const [genContent, setGenContent] = useState('')
  const [genImages, setGenImages] = useState<string[]>([])
  const [genVideos, setGenVideos] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const pollTimer = useRef<any>(null)
  const hasInit = useRef(false)

  // 获取路由参数并初始化
  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance?.router?.params?.orderId || ''
    console.log('[内容生成] 路由参数 orderId:', id)
    if (id && !hasInit.current) {
      setOrderId(id)
      hasInit.current = true
      initPage(id)
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [])

  // 初始化页面：查询状态 → 已完成则展示，未生成则开始生成
  const initPage = async (oid: string) => {
    setStatus('loading')
    setErrorMsg('')

    try {
      // 1. 查询是否已有生成记录
      console.log('[内容生成] 查询订单状态, orderId:', oid)
      const statusRes = await Network.request({
        url: '/api/order-processing/status/' + oid
      })
      console.log('[内容生成] 状态查询结果:', JSON.stringify(statusRes.data))

      if (statusRes.data?.code === 200 && statusRes.data?.data) {
        const data = statusRes.data.data
        // 已完成 - 直接展示
        if (data.status === 'completed' && data.generatedContent) {
          showCompletedContent(data)
          return
        }
        // 生成中 - 开始轮询
        if (data.status === 'processing' || data.status === 'pending') {
          setStatus('generating')
          startPolling(oid)
          return
        }
      }

      // 2. 没有生成记录，获取订单信息后开始生成
      await fetchOrderAndGenerate(oid)

    } catch (err: any) {
      console.error('[内容生成] 初始化失败:', err)
      await fetchOrderAndGenerate(oid)
    }
  }

  // 展示已完成的内容
  const showCompletedContent = (data: any) => {
    const content = data.generatedContent?.content || data.generatedContent?.text || ''
    const images = data.generatedContent?.images || []
    const videos = data.generatedContent?.videos || (data.generatedContent?.video_url ? [data.generatedContent.video_url] : [])
    const title = data.orderTitle || data.title || '商单内容'

    setOrderTitle(title)
    setGenContent(content)
    setGenImages(images)
    setGenVideos(videos)
    setStatus('completed')
  }

  // 获取订单信息并开始生成
  const fetchOrderAndGenerate = async (oid: string) => {
    let title = '商单内容'
    let desc = '请根据订单要求生成优质内容'
    let plats = ['xiaohongshu']
    let cType = 'image_text'

    try {
      const orderRes = await Network.request({
        url: '/api/order/' + oid
      })
      console.log('[内容生成] 订单详情:', JSON.stringify(orderRes.data))
      if (orderRes.data?.data) {
        const order = orderRes.data.data
        title = order.title || order.name || '商单内容'
        desc = order.description || order.content || title
        plats = order.platforms || (order.platform ? [order.platform] : ['xiaohongshu'])
        cType = order.contentType || order.content_type || 'image_text'
      }
    } catch (e) {
      console.log('[内容生成] 获取订单详情失败，使用默认值')
    }

    setOrderTitle(title)
    setOrderDesc(desc)
    setPlatforms(plats)
    setContentType(cType)

    // 开始生成
    await doGenerate(oid, title, desc, plats, cType)
  }

  // 调用后端生成接口
  const doGenerate = async (oid: string, title: string, desc: string, plats: string[], cType: string) => {
    setStatus('generating')
    setErrorMsg('')

    try {
      console.log('[内容生成] 开始生成, orderId:', oid, 'title:', title)
      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId: oid,
          avatarId: 'default',
          orderTitle: title,
          orderDescription: desc,
          platforms: plats,
          contentType: cType,
          targetAudience: '年轻用户',
          contentQuantity: 3
        }
      })
      console.log('[内容生成] 生成接口返回:', JSON.stringify(res.data))

      if (res.data?.code === 200 && res.data?.data) {
        const firstItem = res.data.data[0] || res.data.data

        // 如果生成已经完成（同步返回）
        if (firstItem.status === 'completed' && firstItem.content) {
          setGenContent(firstItem.content)
          setGenImages(firstItem.images || [])
          setGenVideos(firstItem.video_url ? [firstItem.video_url] : [])
          setStatus('completed')
          return
        }

        // 开始轮询状态
        startPolling(oid)
      } else {
        setErrorMsg(res.data?.message || '生成请求失败')
        setStatus('failed')
      }
    } catch (err: any) {
      console.error('[内容生成] 生成请求异常:', err)
      setErrorMsg(err.message || '生成请求异常')
      setStatus('failed')
    }
  }

  // 轮询生成状态
  const startPolling = (oid: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current)

    let count = 0
    pollTimer.current = setInterval(async () => {
      count++
      if (count > 60) {
        clearInterval(pollTimer.current)
        setErrorMsg('生成超时，请重试')
        setStatus('failed')
        return
      }

      try {
        const res = await Network.request({
          url: '/api/order-processing/status/' + oid
        })
        console.log('[内容生成] 轮询结果:', JSON.stringify(res.data))

        if (res.data?.code === 200 && res.data?.data) {
          const data = res.data.data
          if (data.status === 'completed') {
            clearInterval(pollTimer.current)
            showCompletedContent(data)
            return
          }
          if (data.status === 'failed') {
            clearInterval(pollTimer.current)
            setErrorMsg(data.errorMessage || '生成失败')
            setStatus('failed')
            return
          }
        }
      } catch (e) {
        console.log('[内容生成] 轮询异常，继续重试')
      }
    }, 3000)
  }

  // 重新生成
  const handleRegenerate = () => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    hasInit.current = false
    setErrorMsg('')
    doGenerate(orderId, orderTitle, orderDesc || orderTitle, platforms, contentType)
  }

  // 获取平台中文名
  const getPlatformName = (p: string) => {
    const map: Record<string, string> = {
      xiaohongshu: '小红书', douyin: '抖音', wechat: '微信',
      wechat_mp: '微信公众号', weibo: '微博', bilibili: 'B站',
      kuaishou: '快手', zhihu: '知乎'
    }
    return map[p] || p
  }

  // 获取内容类型图标
  const getTypeIcon = () => {
    if (contentType === 'video') return <Video size={16} color="#1890ff" />
    if (contentType === 'image') return <ImageIcon size={16} color="#1890ff" />
    return <FileText size={16} color="#1890ff" />
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-6">
      {/* 顶部标题栏 */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <Text className="block text-lg font-bold text-gray-800">{orderTitle}</Text>
        <View className="flex flex-row items-center gap-2 mt-1">
          {getTypeIcon()}
          <Text className="block text-sm text-gray-500">
            {platforms.map(p => getPlatformName(p)).join(' · ')}
          </Text>
        </View>
      </View>

      {/* 加载状态 */}
      {status === 'loading' && (
        <View className="flex flex-col items-center justify-center py-20">
          <Loader size={40} color="#1890ff" className="animate-spin" />
          <Text className="block text-gray-500 mt-4">正在获取订单信息...</Text>
        </View>
      )}

      {/* 生成中状态 */}
      {status === 'generating' && (
        <View className="px-4 mt-6">
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <Loader size={48} color="#1890ff" className="animate-spin" />
              <Text className="block text-lg font-semibold text-gray-800 mt-6">AI正在创作内容</Text>
              <Text className="block text-sm text-gray-500 mt-2">正在为「{orderTitle}」生成{platforms.map(p => getPlatformName(p)).join('、')}内容...</Text>
              <View className="flex flex-row items-center gap-1 mt-4">
                <View className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <View className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <View className="w-2 h-2 rounded-full bg-blue-200 animate-pulse" style={{ animationDelay: '0.4s' }} />
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* 生成失败 */}
      {status === 'failed' && (
        <View className="px-4 mt-6">
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <CircleAlert size={48} color="#ef4444" />
              <Text className="block text-lg font-semibold text-gray-800 mt-4">生成失败</Text>
              <Text className="block text-sm text-red-500 mt-2">{errorMsg}</Text>
              <View className="mt-6">
                <Button onClick={handleRegenerate}>
                  <View className="flex flex-row items-center gap-2">
                    <RefreshCw size={16} color="#fff" />
                    <Text className="text-white">重新生成</Text>
                  </View>
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* 生成完成 - 展示内容 */}
      {status === 'completed' && (
        <View className="px-4 mt-4">
          {/* 成功提示 */}
          <View className="flex flex-row items-center gap-2 mb-4">
            <CircleCheck size={20} color="#22c55e" />
            <Text className="block text-green-600 font-semibold">内容生成完成</Text>
          </View>

          {/* 文案内容 */}
          {genContent && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">生成文案</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="block text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{genContent}</Text>
              </CardContent>
            </Card>
          )}

          {/* 图片内容 */}
          {genImages.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">生成图片 ({genImages.length}张)</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-3 gap-2">
                  {genImages.map((img, idx) => (
                    <View key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <Image src={img} mode="aspectFill" className="w-full h-full" />
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* 视频内容 */}
          {genVideos.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">生成视频</CardTitle>
              </CardHeader>
              <CardContent>
                {genVideos.map((v, idx) => (
                  <View key={idx} className="bg-gray-100 rounded-lg p-4 mb-2">
                    <View className="flex flex-row items-center gap-2">
                      <Video size={20} color="#1890ff" />
                      <Text className="block text-sm text-blue-600 truncate">{v}</Text>
                    </View>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          <View className="flex flex-row gap-3 mt-4">
            <View className="flex-1">
              <Button variant="outline" className="w-full" onClick={handleRegenerate}>
                <View className="flex flex-row items-center gap-2">
                  <RefreshCw size={16} color="#666" />
                  <Text>重新生成</Text>
                </View>
              </Button>
            </View>
            <View className="flex-1">
              <Button
                className="w-full"
                onClick={() => {
                  Taro.setClipboardData({ data: genContent })
                }}
              >
                <Text className="text-white">复制文案</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
