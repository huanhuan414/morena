import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import Taro, { useRouter, showToast } from '@tarojs/taro'
import { ArrowLeft, Loader, Sparkles, Check, CircleAlert, RefreshCw, Send } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import './index.css'

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  weibo: '微博',
  tiktok: '抖音',
  bilibili: 'B站',
  zhihu: '知乎',
  wechat_moments: '微信朋友圈',
  wechat_mp: '公众号',
  wechat_video: '视频号',
  douyin: '抖音',
  kuaishou: '快手'
}

interface GeneratedContent {
  title?: string
  content: string
  images?: string[]
  video?: string
  platforms: string[]
}

interface AvatarInfo {
  id: string
  name: string
  avatarUrl: string
  personality?: string
  matchReason?: string
  dispatchId?: string
}

interface ProcessingData {
  orderId: string
  orderTitle: string
  status: 'queuing' | 'generating' | 'preview' | 'publishing' | 'completed' | 'failed' | 'accepted'
  generatedContent?: GeneratedContent
  errorMessage?: string
  platforms?: string[]
}

export default function OrderContentCreation() {
  const router = useRouter()
  const { orderId, avatarId } = router.params

  const [loading, setLoading] = useState(true)
  const [avatars, setAvatars] = useState<AvatarInfo[]>([])
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(avatarId || '')
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)
  const [generatingStep, setGeneratingStep] = useState('')

  useEffect(() => {
    if (orderId) {
      loadData()
    }
  }, [orderId])

  const loadData = async () => {
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
          requirements: data.requirements
        })
      }

      // 获取推荐到此订单的分身
      const avatarsRes = await Network.request({ url: `/api/recommendation/avatar/order/${orderId}` })
      if (avatarsRes.data?.code === 200) {
        const avatarList = avatarsRes.data.data || []
        setAvatars(avatarList)
        // 如果没有指定 avatarId，默认选择第一个
        if (!selectedAvatarId && avatarList.length > 0) {
          setSelectedAvatarId(avatarList[0].id)
        }
      }
    } catch (err) {
      console.error('加载数据失败:', err)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const startGeneration = async () => {
    if (!selectedAvatarId) {
      showToast({ title: '请选择分身', icon: 'none' })
      return
    }

    setGenerating(true)
    setGeneratingProgress(0)
    setGeneratingStep('正在准备...')

    try {
      // 模拟进度
      const steps = [
        '正在分析订单需求...',
        '正在理解目标受众...',
        '正在生成创意内容...'
      ]
      let stepIndex = 0
      const progressInterval = setInterval(() => {
        setGeneratingProgress(prev => {
          if (prev >= 90) return prev
          const increment = Math.random() * 8 + 2
          return Math.min(prev + increment, 90)
        })
        setGeneratingStep(steps[stepIndex % steps.length])
        stepIndex++
      }, 600)

      // 调用内容生成接口
      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId,
          avatarId: selectedAvatarId,
          orderTitle: orderInfo?.title || '商单内容',
          orderDescription: orderInfo?.description || orderInfo?.requirements || '',
          platforms: orderInfo?.platforms || [],
          contentType: orderInfo?.contentType || 'image',
          targetAudience: orderInfo?.requirements || '',
          contentQuantity: orderInfo?.expectedQuantity || 1  // 每个分身需要生成的内容数量
        }
      })

      clearInterval(progressInterval)

      if (res.data?.code === 200) {
        setGeneratingProgress(100)
        setGeneratingStep('内容生成完成！')
        setProcessingData({
          orderId: orderId || '',
          orderTitle: (orderInfo?.title || '商单内容') as string,
          status: 'preview',
          generatedContent: res.data.data?.generatedContent || {
            content: res.data.data?.content || '内容生成成功',
            platforms: orderInfo?.platforms || []
          },
          platforms: orderInfo?.platforms
        })
        setEditedContent(res.data.data?.content || res.data.data?.generatedContent?.content || '内容生成成功')
        showToast({ title: '生成成功', icon: 'success' })
      } else {
        setProcessingData({
          orderId: orderId || '',
          orderTitle: (orderInfo?.title || '商单内容') as string,
          status: 'failed',
          errorMessage: res.data?.message || '生成失败'
        })
        showToast({ title: res.data?.message || '生成失败', icon: 'none' })
      }
    } catch (err: any) {
      console.error('生成失败:', err)
      setProcessingData({
        orderId: orderId || '',
        orderTitle: (orderInfo?.title || '商单内容') as string,
        status: 'failed',
        errorMessage: err.message || '网络请求失败'
      })
      showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async () => {
    showToast({ title: '发布功能开发中', icon: 'none' })
  }

  if (loading) {
    return (
      <View className="content-creation-page">
        <View className="loading-container">
          <Loader size={48} color="#06b6d4" className="animate-spin" />
          <Text className="block loading-text">正在加载...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="content-creation-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#333" />
        </View>
        <Text className="header-title">内容生成</Text>
        <View className="header-right" />
      </View>

      <ScrollView scrollY className="content-scroll">
        {/* 订单信息 */}
        {orderInfo && (
          <View className="order-info-card">
            <Text className="section-title">订单信息</Text>
            <View className="info-item">
              <Text className="info-label">订单标题</Text>
              <Text className="info-value">{orderInfo.title}</Text>
            </View>
            {orderInfo.description && (
              <View className="info-item">
                <Text className="info-label">任务描述</Text>
                <Text className="info-value">{orderInfo.description}</Text>
              </View>
            )}
            <View className="info-item">
              <Text className="info-label">目标平台</Text>
              <View className="platform-tags">
                {(orderInfo.platforms || []).map((p: string) => (
                  <View key={p} className="platform-tag">
                    <Text className="platform-name">{PLATFORM_NAMES[p] || p}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* 分身选择 */}
        {!processingData && avatars.length > 0 && (
          <View className="avatar-select-section">
            <Text className="section-title">选择分身</Text>
            <View className="avatar-list">
              {avatars.map(avatar => (
                <View
                  key={avatar.id}
                  className={`avatar-item ${selectedAvatarId === avatar.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAvatarId(avatar.id)}
                >
                  <View className="avatar-avatar">
                    <Text className="avatar-initial">{avatar.name?.[0] || '分'}</Text>
                  </View>
                  <View className="avatar-info">
                    <Text className="avatar-name">{avatar.name}</Text>
                    {avatar.personality && (
                      <Text className="avatar-personality">{avatar.personality}</Text>
                    )}
                  </View>
                  {selectedAvatarId === avatar.id && (
                    <View className="selected-check">
                      <Check size={16} color="#fff" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 生成进度 */}
        {generating && (
          <View className="generating-section">
            <View className="generating-header">
              <Sparkles size={24} color="#06b6d4" />
              <Text className="generating-title">正在生成内容</Text>
            </View>
            <View className="progress-bar">
              <View className="progress-fill" style={{ width: `${generatingProgress}%` }} />
            </View>
            <Text className="progress-text">{Math.round(generatingProgress)}%</Text>
            <Text className="generating-step">{generatingStep}</Text>
          </View>
        )}

        {/* 生成结果预览 */}
        {processingData && processingData.status === 'preview' && (
          <View className="preview-section">
            <View className="preview-header">
              <Text className="section-title">内容预览</Text>
              <View className="preview-actions">
                <View className="action-btn" onClick={startGeneration}>
                  <RefreshCw size={14} color="#06b6d4" />
                  <Text className="action-text">重新生成</Text>
                </View>
              </View>
            </View>

            <View className="content-preview">
              {/* 图片展示 */}
              {processingData.generatedContent?.images && processingData.generatedContent.images.length > 0 && (
                <View className="images-preview">
                  <Text className="section-title">生成的图片</Text>
                  <ScrollView scrollX className="images-scroll">
                    <View className="images-container">
                      {processingData.generatedContent.images.map((img, idx) => (
                        <Image
                          key={idx}
                          className="preview-image"
                          src={img}
                          mode="aspectFill"
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* 视频展示 */}
              {processingData.generatedContent?.video && (
                <View className="video-preview">
                  <Text className="section-title">生成的视频</Text>
                  <View className="video-container">
                    <Video
                      className="preview-video"
                      src={processingData.generatedContent.video}
                      controls
                      poster={processingData.generatedContent.images?.[0]}
                    />
                  </View>
                </View>
              )}

              {/* 文字内容 */}
              <Text className="content-text">{editedContent || processingData.generatedContent?.content}</Text>
            </View>

            {processingData.platforms && processingData.platforms.length > 0 && (
              <View className="publish-platforms">
                <Text className="platforms-label">发布到：</Text>
                <View className="platform-tags">
                  {processingData.platforms.map((p: string) => (
                    <View key={p} className="platform-tag">
                      <Text className="platform-name">{PLATFORM_NAMES[p] || p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 失败状态 */}
        {processingData && processingData.status === 'failed' && (
          <View className="error-section">
            <CircleAlert size={48} color="#ef4444" />
            <Text className="error-title">生成失败</Text>
            <Text className="error-message">{processingData.errorMessage}</Text>
            <Button className="retry-btn" onClick={startGeneration}>
              <RefreshCw size={16} color="#fff" />
              <Text className="btn-text">重新生成</Text>
            </Button>
          </View>
        )}

        <View className="bottom-placeholder" />
      </ScrollView>

      {/* 底部操作栏 */}
      {!generating && (!processingData || processingData.status === 'preview') && (
        <View className="bottom-bar">
          {!processingData ? (
            <Button
              className="generate-btn"
              onClick={startGeneration}
              disabled={!selectedAvatarId}
            >
              <Sparkles size={18} color="#fff" />
              <Text className="btn-text">开始生成内容</Text>
            </Button>
          ) : (
            <Button className="publish-btn" onClick={handlePublish}>
              <Send size={18} color="#fff" />
              <Text className="btn-text">确认并发布</Text>
            </Button>
          )}
        </View>
      )}
    </View>
  )
}
