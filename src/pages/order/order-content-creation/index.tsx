import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { RefreshCw, Copy, Play } from 'lucide-react-taro'


interface GeneratedContent {
  content: string
  images: string[]
  videos: string[]
  platforms: string[]
}

interface ProcessingData {
  orderId: string
  orderTitle: string
  status: string
  generatedContent: GeneratedContent | null
  errorMessage?: string
}

export default function OrderContentCreation() {
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [editedContent, setEditedContent] = useState('')

  // 获取订单ID
  useEffect(() => {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (currentPage?.options?.orderId) {
      const id = currentPage.options.orderId
      setOrderId(id)
      console.log('获取到订单ID:', id)
    }
  }, [])

  // 当orderId变化时，获取订单信息和状态
  useEffect(() => {
    if (!orderId) return
    fetchData()
  }, [orderId])

  // 获取数据
  const fetchData = async () => {
    setLoading(true)
    setError('')

    try {
      // 1. 先获取订单详情
      const orderRes = await Network.request({
        url: '/api/order/' + orderId
      })
      console.log('订单详情:', orderRes.data)

      // 2. 查询生成状态
      const statusRes = await Network.request({
        url: '/api/order-processing/status/' + orderId
      })
      console.log('生成状态:', statusRes.data)

      if (statusRes.data.code === 200 && statusRes.data.data) {
        const data = statusRes.data.data
        setProcessingData({
          orderId: data.orderId || orderId,
          orderTitle: data.orderTitle || '商单内容',
          status: data.status || 'pending',
          generatedContent: data.generatedContent,
          errorMessage: data.errorMessage
        })

        // 如果有生成内容，设置编辑内容
        if (data.generatedContent?.content) {
          setEditedContent(data.generatedContent.content)
        }
      } else if (statusRes.data.code === 200 && !statusRes.data.data) {
        // 没有生成记录，设置待生成状态
        setProcessingData({
          orderId: orderId,
          orderTitle: orderRes.data.data?.title || '商单内容',
          status: 'not_started',
          generatedContent: null
        })
      } else {
        setError(statusRes.data.message || '获取订单状态失败')
      }
    } catch (err: any) {
      console.error('获取订单信息失败:', err)
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  // 开始生成内容
  const handleGenerate = async () => {
    if (!orderId) {
      setError('订单ID不能为空')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId: orderId,
          avatarId: 'default-avatar',
          orderTitle: processingData?.orderTitle || '商单内容',
          orderDescription: '请根据订单要求生成内容',
          platforms: ['xiaohongshu', 'douyin', 'wechat'],
          contentType: 'image_text',
          targetAudience: '年轻人',
          contentQuantity: 3
        }
      })
      console.log('生成接口响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        const requestId = res.data.data[0]?.requestId
        if (requestId) {
          // 更新状态为生成中
          setProcessingData(prev => prev ? {
            ...prev,
            status: 'processing'
          } : null)

          // 轮询查询状态
          pollStatus(requestId)
        }
      } else {
        setError(res.data.message || '生成失败')
        setGenerating(false)
      }
    } catch (err: any) {
      console.error('生成失败:', err)
      setError(err.message || '生成失败')
      setGenerating(false)
    }
  }

  // 轮询查询生成状态
  const pollStatus = async (requestId: string) => {
    const maxAttempts = 60
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('生成超时，请稍后重试')
        setGenerating(false)
        return
      }

      try {
        const res = await Network.request({
          url: '/api/order-processing/status/' + requestId
        })
        console.log('轮询状态:', res.data)

        if (res.data.code === 200 && res.data.data) {
          const data = res.data.data
          setProcessingData(prev => prev ? {
            ...prev,
            status: data.status,
            generatedContent: data.generatedContent,
            errorMessage: data.errorMessage
          } : null)

          if (data.status === 'completed') {
            if (data.generatedContent?.content) {
              setEditedContent(data.generatedContent.content)
            }
            setGenerating(false)
            return
          } else if (data.status === 'failed') {
            setError(data.errorMessage || '生成失败')
            setGenerating(false)
            return
          }
        }

        attempts++
        setTimeout(poll, 2000)
      } catch (err) {
        attempts++
        setTimeout(poll, 2000)
      }
    }

    poll()
  }

  // 刷新状态
  const handleRefresh = async () => {
    if (!orderId) return
    await fetchData()
  }

  // 复制内容
  const handleCopy = () => {
    Taro.setClipboardData({
      data: editedContent,
      success: () => {
        Taro.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  // 渲染状态
  const renderStatus = () => {
    if (!processingData) return null

    const statusMap: Record<string, { label: string; color: string }> = {
      not_started: { label: '待生成', color: 'bg-gray-100 text-gray-600' },
      pending: { label: '等待中', color: 'bg-yellow-100 text-yellow-600' },
      processing: { label: '生成中', color: 'bg-blue-100 text-blue-600' },
      completed: { label: '已完成', color: 'bg-green-100 text-green-600' },
      failed: { label: '失败', color: 'bg-red-100 text-red-600' }
    }

    const status = statusMap[processingData.status] || statusMap.pending

    return (
      <Badge className={status.color}>
        {status.label}
        {processingData.status === 'processing' && '...'}
      </Badge>
    )
  }

  // 渲染内容
  const renderContent = () => {
    if (!processingData) return null

    const { status, generatedContent } = processingData

    // 未开始状态
    if (status === 'not_started') {
      return (
        <View className="flex flex-col items-center justify-center py-16">
          <Text className="block text-gray-500 mb-4">该订单还未生成内容</Text>
          <Button onClick={handleGenerate} disabled={generating}>
            <Play size={16} color="#fff" className="mr-2" />
            {generating ? '生成中...' : '开始生成'}
          </Button>
        </View>
      )
    }

    // 生成中状态
    if (status === 'processing') {
      return (
        <View className="flex flex-col items-center justify-center py-16">
          <View className="animate-spin mb-4">
            <RefreshCw size={32} color="#1890ff" />
          </View>
          <Text className="block text-gray-600 mb-2">内容生成中...</Text>
          <Text className="block text-gray-400 text-sm">预计需要1-2分钟</Text>
        </View>
      )
    }

    // 失败状态
    if (status === 'failed') {
      return (
        <View className="p-4">
          <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <Text className="block text-red-600">{processingData.errorMessage || '生成失败'}</Text>
          </View>
          <View className="mt-4 flex justify-center">
            <Button onClick={handleGenerate} disabled={generating}>
              重新生成
            </Button>
          </View>
        </View>
      )
    }

    // 已完成状态 - 显示内容
    if (status === 'completed' && generatedContent) {
      return (
        <View className="p-4">
          {/* 平台标签 */}
          <View className="flex flex-wrap gap-2 mb-4">
            {generatedContent.platforms?.map((platform) => (
              <Badge key={platform} variant="outline">
                {platform}
              </Badge>
            ))}
          </View>

          {/* 内容区域 */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="flex items-center justify-between mb-2">
              <Text className="block text-gray-500 text-sm">生成内容</Text>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                <Copy size={14} color="#666" className="mr-1" />
                复制
              </Button>
            </View>

            <Textarea
              className="w-full min-h-48"
              value={editedContent}
              onChange={setEditedContent}
              placeholder="生成的内容将显示在这里..."
            />
          </View>

          {/* 图片区域 */}
          {generatedContent.images && generatedContent.images.length > 0 && (
            <View className="mb-4">
              <Text className="block text-gray-500 text-sm mb-2">
                生成图片 ({generatedContent.images.length})
              </Text>
              <View className="flex flex-wrap gap-2">
                {generatedContent.images.map((_img, idx) => (
                  <View key={idx} className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                    <View className="w-full h-full flex items-center justify-center bg-gray-200">
                      <Text className="block text-gray-400 text-xs">图片 {idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 操作按钮 */}
          <View className="flex gap-3 mt-4">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw size={14} color="#666" className="mr-1" />
              刷新
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              <RefreshCw size={14} color="#fff" className="mr-1" />
              重新生成
            </Button>
          </View>
        </View>
      )
    }

    // 已完成但没有内容
    if (status === 'completed' && !generatedContent) {
      return (
        <View className="flex flex-col items-center justify-center py-16">
          <Text className="block text-gray-500 mb-4">生成完成，但未返回内容</Text>
          <Button onClick={handleGenerate}>
            重新生成
          </Button>
        </View>
      )
    }

    return null
  }

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()} className="p-2">
          <Text className="block text-lg">←</Text>
        </View>
        <Text className="block text-lg font-semibold ml-2">内容生成</Text>
      </View>

      {/* 内容区域 */}
      <View className="p-4">
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <Text className="block text-red-600 text-sm">{error}</Text>
          </View>
        )}

        {/* 状态卡片 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <View>
                <Text className="block text-gray-500 text-sm">订单编号</Text>
                <Text className="block text-gray-900 font-mono text-sm mt-1">{orderId || '-'}</Text>
              </View>
              {renderStatus()}
            </View>
          </CardContent>
        </Card>

        {/* 加载状态 */}
        {loading ? (
          <View className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </View>
        ) : (
          renderContent()
        )}
      </View>
    </View>
  )
}
