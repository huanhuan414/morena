import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { AlertCircle, ArrowLeft } from 'lucide-react-taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import './index.css'

interface ContentItem {
  type: 'text' | 'image' | 'video'
  content: string
  index?: number
  total?: number
}

export default function OrderContentCreation() {
  const router = useRouter()
  const { orderId } = router.params

  const [loading, setLoading] = useState(true)
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<ContentItem[]>([])
  const [currentStep, setCurrentStep] = useState('')
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (orderId) {
      loadOrderAndGenerate()
    }
  }, [orderId])

  const loadOrderAndGenerate = async () => {
    setLoading(true)
    try {
      // 获取订单信息
      const orderRes = await Network.request({ url: `/api/order/${orderId}` })
      if (orderRes.data?.code === 200 && orderRes.data?.data) {
        const data = orderRes.data.data
        setOrderInfo({
          id: data.id,
          title: data.title,
          description: data.description,
          platforms: data.platforms || [],
          contentType: data.content_type || data.contentType || 'image',
          requirements: data.requirements,
          expectedQuantity: data.expectedQuantity || data.expected_quantity || data.avatarCount || 1
        })
        
        // 自动开始生成内容
        await startGeneration({
          id: data.id,
          title: data.title,
          description: data.description,
          platforms: data.platforms || [],
          contentType: data.content_type || data.contentType || 'image',
          requirements: data.requirements,
          expectedQuantity: data.expectedQuantity || data.expected_quantity || data.avatarCount || 1
        })
      }
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const startGeneration = async (order) => {
    setGenerating(true)
    setGeneratedContent([])
    setShowResult(false)
    setCurrentStep('正在分析订单需求...')

    try {
      const { id, title, description, platforms, contentType, requirements, expectedQuantity } = order

      // 获取当前用户信息
      const userInfo = await Taro.getStorage({ key: 'userInfo' })
      const userId = userInfo.data?.id || userInfo.data?.userId

      if (!userId) {
        Taro.showToast({ title: '用户未登录', icon: 'none' })
        return
      }

      // 获取用户分身
      const avatarRes = await Network.request({ url: '/api/avatar' })
      const avatars = avatarRes.data?.data || []

      if (avatars.length === 0) {
        Taro.showToast({ title: '没有可用分身', icon: 'none' })
        return
      }

      // 使用第一个分身生成内容
      const avatar = avatars[0]
      setCurrentStep(`正在为分身"${avatar.name}"生成内容...`)

      // 调用内容生成接口
      const generateRes = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId: id,
          avatarId: avatar.id,
          orderTitle: title,
          orderDescription: description,
          platforms: platforms,
          contentType: contentType,
          targetAudience: requirements?.targetAudience || '通用用户',
          contentQuantity: expectedQuantity || 1
        }
      })

      if (generateRes.data?.code === 200) {
        const result = generateRes.data.data
        
        // 构建内容列表
        const contents: ContentItem[] = []
        
        // 添加文字内容
        if (result.textContent) {
          contents.push({
            type: 'text',
            content: result.textContent
          })
        }
        
        // 添加图片
        if (result.images && result.images.length > 0) {
          result.images.forEach((img: string, idx: number) => {
            contents.push({
              type: 'image',
              content: img,
              index: idx + 1,
              total: result.images.length
            })
          })
        }
        
        // 添加视频
        if (result.videos && result.videos.length > 0) {
          result.videos.forEach((vid: string, idx: number) => {
            contents.push({
              type: 'video',
              content: vid,
              index: idx + 1,
              total: result.videos.length
            })
          })
        }
        
        setGeneratedContent(contents)
        setShowResult(true)
        setCurrentStep('内容生成完成！')
        Taro.showToast({ title: '生成成功', icon: 'success' })
      } else {
        Taro.showToast({ title: generateRes.data?.message || '生成失败', icon: 'none' })
      }
    } catch (err) {
      console.error('生成失败:', err)
      Taro.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const getPlatformName = (platform: string) => {
    const platformMap: Record<string, string> = {
      'wechat_mp': '微信',
      'wechat': '微信',
      'xiaohongshu': '小红书',
      'douyin': '抖音',
      'weibo': '微博',
      'bilibili': 'B站',
      'kuaishou': '快手',
      'moments': '朋友圈'
    }
    return platformMap[platform] || platform
  }

  const getContentTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      'text': '文字',
      'image': '图文',
      'video': '视频',
      'article': '文章'
    }
    return typeMap[type] || type
  }

  if (loading) {
    return (
      <View className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <View className='text-center'>
          <View className='loading-spinner mb-4' />
          <Text className='block text-gray-500'>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='min-h-screen bg-gray-50 pb-safe'>
      {/* 顶部导航 */}
      <View className='bg-white px-4 py-3 flex items-center shadow-sm safe-top'>
        <View onClick={handleBack} className='p-2 -ml-2'>
          <ArrowLeft size={24} color='#333' />
        </View>
        <Text className='block text-lg font-semibold text-gray-900 flex-1 text-center'>内容生成</Text>
        <View className='w-10' />
      </View>

      {/* 生成中状态 */}
      {generating && (
        <View className='flex flex-col items-center justify-center py-20'>
          <View className='loading-spinner mb-4' style={{ width: 48, height: 48 }} />
          <Text className='block text-lg text-gray-700 mb-2'>正在生成内容...</Text>
          <Text className='block text-gray-500 text-sm'>{currentStep}</Text>
        </View>
      )}

      {/* 生成完成 */}
      {showResult && generatedContent.length > 0 && (
        <ScrollView scrollY className='px-4 py-4' style={{ height: 'calc(100vh - 120px)' }}>
          {/* 订单信息 */}
          <Card className='mb-4'>
            <CardContent className='p-4'>
              <Text className='block text-lg font-semibold text-gray-900 mb-2'>
                {orderInfo?.title}
              </Text>
              <View className='flex flex-wrap gap-2 mb-2'>
                {orderInfo?.platforms?.map((p: string) => (
                  <View key={p} className='px-2 py-1 bg-blue-100 rounded text-xs text-blue-700'>
                    {getPlatformName(p)}
                  </View>
                ))}
                <View className='px-2 py-1 bg-green-100 rounded text-xs text-green-700'>
                  {getContentTypeName(orderInfo?.contentType)}
                </View>
              </View>
              {orderInfo?.description && (
                <Text className='block text-sm text-gray-600 mt-2'>{orderInfo.description}</Text>
              )}
            </CardContent>
          </Card>

          {/* 生成结果标题 */}
          <View className='mb-4'>
            <Text className='block text-lg font-semibold text-gray-900'>生成结果</Text>
            <Text className='block text-sm text-gray-500 mt-1'>
              共 {generatedContent.filter(c => c.type !== 'text').length} 个内容
            </Text>
          </View>

          {/* 内容列表 */}
          {generatedContent.map((item, index) => (
            <Card key={index} className='mb-4'>
              <CardContent className='p-4'>
                {item.type === 'text' && (
                  <View>
                    <Text className='block text-xs text-gray-400 mb-2'>文案内容</Text>
                    <Text className='block text-gray-800 whitespace-pre-wrap leading-relaxed'>
                      {item.content}
                    </Text>
                  </View>
                )}
                
                {item.type === 'image' && (
                  <View>
                    {item.index && item.total && (
                      <Text className='block text-xs text-gray-400 mb-2'>
                        第 {item.index}/{item.total} 张图片
                      </Text>
                    )}
                    <Image
                      src={item.content}
                      className='w-full rounded-lg'
                      mode='widthFix'
                      showMenuByLongpress
                    />
                  </View>
                )}
                
                {item.type === 'video' && (
                  <View>
                    {item.index && item.total && (
                      <Text className='block text-xs text-gray-400 mb-2'>
                        第 {item.index}/{item.total} 个视频
                      </Text>
                    )}
                    <Video
                      src={item.content}
                      className='w-full rounded-lg'
                      controls
                      showCenterPlayBtn
                    />
                  </View>
                )}
              </CardContent>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* 底部返回按钮 */}
      {showResult && (
        <View className='fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200'>
          <Button onClick={handleBack} className='w-full'>
            返回订单列表
          </Button>
        </View>
      )}
    </View>
  )
}
