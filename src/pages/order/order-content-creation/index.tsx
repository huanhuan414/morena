import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Loader, RefreshCw, CircleAlert, Camera, FileText, Play } from 'lucide-react-taro'
import { Network } from '@/network'
import MarkdownRenderer from '@/components/markdown-renderer'
import './index.css'

interface OrderInfo {
  id: string
  title: string
  description: string
  platform: string
  expectedQuantity: number
  quantityPerAvatar: number
  status: string
  brandName?: string
  productInfo?: string
  requirements?: string
  price?: number
}

interface GeneratedContent {
  content: string
  images: string[]
  videos: string[]
  platforms: string[]
}

export default function OrderContentCreation() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'generating' | 'completed' | 'failed'>('loading')
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [progressText, setProgressText] = useState('')
  const [activeTab, setActiveTab] = useState<'content' | 'images' | 'videos'>('content')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    const oid = params?.orderId
    if (oid) {
      initPage(oid)
    } else {
      setStatus('failed')
      setProgressText('缺少订单ID')
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const getPlatformLabel = (p: string) => {
    const map: Record<string, string> = { wechat: '微信', xiaohongshu: '小红书', douyin: '抖音', weibo: '微博', bilibili: 'B站', kuaishou: '快手' }
    return map[p] || p
  }

  const getPlatformColor = (p: string) => {
    const map: Record<string, string> = { wechat: '#07c160', xiaohongshu: '#fe2c55', douyin: '#000000', weibo: '#ff8200', bilibili: '#fb7299', kuaishou: '#ff4906' }
    return map[p] || '#666'
  }

  const initPage = async (oid: string) => {
    try {
      setStatus('loading')
      setProgressText('获取订单信息...')

      // 1. 获取订单详情
      const orderRes = await Network.request({ url: `/api/order/${oid}` })
      console.log('[内容生成] 订单详情:', JSON.stringify(orderRes.data))
      const orderData = orderRes.data?.data
      if (!orderData) {
        setStatus('failed')
        setProgressText('获取订单信息失败')
        return
      }
      setOrderInfo(orderData)

      // 2. 查询是否已有生成内容
      const statusRes = await Network.request({ url: `/api/order-processing/status/${oid}` })
      console.log('[内容生成] 状态查询:', JSON.stringify(statusRes.data))
      const existingData = statusRes.data?.data

      if (existingData?.status === 'completed' && existingData.generatedContent) {
        setGeneratedContent(existingData.generatedContent)
        setStatus('completed')
      } else if (existingData?.status === 'processing') {
        setStatus('generating')
        setProgressText('内容生成中...')
        if (existingData.generatedContent?.content) {
          setGeneratedContent(existingData.generatedContent)
        }
        startPolling(oid)
      } else {
        // 3. 没有生成记录，自动开始生成
        startGeneration(oid, orderData)
      }
    } catch (err: any) {
      console.error('[内容生成] 初始化失败:', err.message)
      setStatus('failed')
      setProgressText('初始化失败: ' + err.message)
    }
  }

  const startGeneration = async (oid: string, order: OrderInfo) => {
    try {
      setStatus('generating')
      setProgressText('正在提交生成请求...')

      const platform = order.platform || 'xiaohongshu'
      const quantity = order.quantityPerAvatar || order.expectedQuantity || 3
      const contentType = (order.description?.includes('视频') || platform === 'douyin') ? 'video' : 'image_text'

      console.log('[内容生成] 生成参数:', { orderId: oid, platform, quantity, contentType, title: order.title, desc: order.description })

      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId: oid,
          avatarId: 'default',
          orderTitle: order.title || '商单内容',
          orderDescription: order.description || order.requirements || '',
          platforms: [platform],
          contentType,
          targetAudience: '目标用户',
          contentQuantity: quantity
        }
      })
      console.log('[内容生成] 生成响应:', JSON.stringify(res.data))

      if (res.data?.code === 200) {
        setProgressText('内容生成中，请稍候...')
        startPolling(oid)
      } else {
        setStatus('failed')
        setProgressText(res.data?.message || '生成请求失败')
      }
    } catch (err: any) {
      console.error('[内容生成] 生成失败:', err.message)
      setStatus('failed')
      setProgressText('生成失败: ' + err.message)
    }
  }

  const startPolling = (oid: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await Network.request({ url: `/api/order-processing/status/${oid}` })
        const data = res.data?.data
        if (!data) return

        if (data.status === 'completed' && data.generatedContent) {
          setGeneratedContent(data.generatedContent)
          setStatus('completed')
          if (pollingRef.current) clearInterval(pollingRef.current)
        } else if (data.status === 'failed') {
          setStatus('failed')
          setProgressText('内容生成失败')
          if (pollingRef.current) clearInterval(pollingRef.current)
        } else if (data.status === 'processing' && data.generatedContent) {
          // 部分内容已生成，先展示
          setGeneratedContent(data.generatedContent)
          setProgressText('图片生成中...')
        }
      } catch (err) {
        console.error('[内容生成] 轮询失败:', err.message)
      }
    }, 3000)
  }

  const handleRetry = () => {
    if (orderInfo) {
      startGeneration(orderInfo.id, orderInfo)
    }
  }

  // ========== 渲染 ==========

  if (status === 'loading') {
    return (
      <View className="ccc-page">
        <View className="ccc-loading-box">
          <Loader size={32} color="#1890ff" className="ccc-spin" />
          <Text className="block text-gray-500 mt-4">{progressText || '加载中...'}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="ccc-page">
      {/* 顶部订单信息卡 */}
      {orderInfo && (
        <View className="ccc-order-card">
          <View className="ccc-order-header">
            <Text className="ccc-order-title">{orderInfo.title}</Text>
            <View className="ccc-platform-tag" style={{ backgroundColor: getPlatformColor(orderInfo.platform) + '15', borderColor: getPlatformColor(orderInfo.platform) }}>
              <Text className="ccc-platform-text" style={{ color: getPlatformColor(orderInfo.platform) }}>{getPlatformLabel(orderInfo.platform)}</Text>
            </View>
          </View>
          {orderInfo.description && (
            <Text className="ccc-order-desc">{orderInfo.description}</Text>
          )}
          <View className="ccc-order-meta">
            <Text className="ccc-meta-item">需生成 {orderInfo.quantityPerAvatar || orderInfo.expectedQuantity || 3} 条内容</Text>
          </View>
        </View>
      )}

      {/* 生成中状态 */}
      {status === 'generating' && (
        <View className="ccc-generating-card">
          <View className="ccc-gen-header">
            <Loader size={20} color="#1890ff" className="ccc-spin" />
            <Text className="ccc-gen-title">{progressText || '内容生成中...'}</Text>
          </View>
          {/* 生成中的文案预览 */}
          {generatedContent?.content && (
            <View className="ccc-content-preview">
              <Text className="ccc-preview-label">文案已生成，图片生成中...</Text>
            </View>
          )}
          <View className="ccc-progress-bar">
            <View className="ccc-progress-fill" style={{ width: generatedContent?.content ? '60%' : '20%' }} />
          </View>
        </View>
      )}

      {/* 生成失败 */}
      {status === 'failed' && (
        <View className="ccc-failed-card">
          <CircleAlert size={32} color="#ff4d4f" />
          <Text className="ccc-failed-title">生成失败</Text>
          <Text className="ccc-failed-desc">{progressText}</Text>
          <Button onClick={handleRetry} className="ccc-retry-btn">
            <View className="ccc-btn-inner">
              <RefreshCw size={14} color="#1890ff" />
              <Text className="ccc-btn-text">重新生成</Text>
            </View>
          </Button>
        </View>
      )}

      {/* 生成完成 - 内容展示 */}
      {status === 'completed' && generatedContent && (
        <View className="ccc-result-section">
          {/* Tab 切换 */}
          <View className="ccc-tabs">
            <View
              className={`ccc-tab ${activeTab === 'content' ? 'ccc-tab-active' : ''}`}
              onClick={() => setActiveTab('content')}
            >
              <FileText size={14} color={activeTab === 'content' ? '#1890ff' : '#999'} />
              <Text className={`ccc-tab-text ${activeTab === 'content' ? 'ccc-tab-text-active' : ''}`}>文案</Text>
            </View>
            <View
              className={`ccc-tab ${activeTab === 'images' ? 'ccc-tab-active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              <Camera size={14} color={activeTab === 'images' ? '#1890ff' : '#999'} />
              <Text className={`ccc-tab-text ${activeTab === 'images' ? 'ccc-tab-text-active' : ''}`}>
                图片 {generatedContent.images?.length > 0 ? `(${generatedContent.images.length})` : ''}
              </Text>
            </View>
            <View
              className={`ccc-tab ${activeTab === 'videos' ? 'ccc-tab-active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              <Play size={14} color={activeTab === 'videos' ? '#1890ff' : '#999'} />
              <Text className={`ccc-tab-text ${activeTab === 'videos' ? 'ccc-tab-text-active' : ''}`}>
                视频 {generatedContent.videos?.length > 0 ? `(${generatedContent.videos.length})` : ''}
              </Text>
            </View>
          </View>

          {/* 文案内容 */}
          {activeTab === 'content' && (
            <View className="ccc-content-card">
              <MarkdownRenderer content={generatedContent.content || ''} />
            </View>
          )}

          {/* 图片内容 */}
          {activeTab === 'images' && (
            <View className="ccc-images-grid">
              {generatedContent.images?.length > 0 ? (
                generatedContent.images.map((img, idx) => (
                  <View key={idx} className="ccc-image-item">
                    <Image src={img} mode="aspectFill" className="ccc-image" />
                  </View>
                ))
              ) : (
                <View className="ccc-empty-box">
                  <Camera size={40} color="#ccc" />
                  <Text className="ccc-empty-text">暂无图片</Text>
                </View>
              )}
            </View>
          )}

          {/* 视频内容 */}
          {activeTab === 'videos' && (
            <View className="ccc-videos-list">
              {generatedContent.videos?.length > 0 ? (
                generatedContent.videos.map((_video, idx) => (
                  <View key={idx} className="ccc-video-item">
                    <Play size={20} color="#1890ff" />
                    <Text className="ccc-video-text">视频 {idx + 1}</Text>
                  </View>
                ))
              ) : (
                <View className="ccc-empty-box">
                  <Play size={40} color="#ccc" />
                  <Text className="ccc-empty-text">暂无视频</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  )
}
