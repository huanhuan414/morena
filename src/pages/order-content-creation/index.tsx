import Taro, { useLoad, useRouter, navigateBack, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { ArrowLeft, Loader, Check, Sparkles, Smartphone, Pencil, Save, RefreshCw } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import './index.css'

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  wechat_mp: '微信公众号',
  wechat_moments: '朋友圈',
  wechat_video: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
  toutiao: '头条'
}

interface ContentData {
  id: string
  title: string
  content: string
  platform: string
  images: string[]
  videos: string[]
  status: 'creating' | 'ready' | 'published'
  created_at: string
}

export default function OrderContentCreationPage() {
  const router = useRouter()
  const { requestId, avatarId, orderId } = router.params

  const [loading, setLoading] = useState(true)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useLoad(() => {
    console.log('[OrderContentCreation] 页面加载，参数:', { requestId, avatarId, orderId })
    if (!requestId || !avatarId || !orderId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
      return
    }
    startPolling()
  })

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  const startPolling = () => {
    console.log('[OrderContentCreation] 开始轮询内容状态')
    fetchContentStatus()
    const interval = setInterval(fetchContentStatus, 1000)
    setPollInterval(interval)
  }

  const fetchContentStatus = async () => {
    try {
      console.log('[OrderContentCreation] 获取内容状态:', { requestId })
      const res = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderContentCreation] 状态响应:', res.data)

      if (res.data?.code === 200 && res.data.data) {
        const data = res.data.data as any

        // 更新处理状态
        setProcessingStatus(data.status || '')

        if (loading) {
          console.log('[OrderContentCreation] 首次获取状态成功，状态:', data.status)
          setLoading(false)
        }

        // 在 preview 或 completed 状态时展示内容
        // 其他状态（generating, queuing 等）显示加载动画
        if ((data.status === 'preview' || data.status === 'completed') && data.generatedContent) {
          setContentData(data.generatedContent)
          setEditedContent(data.generatedContent.content || '')
          console.log('[OrderContentCreation] 内容已制作完成，停止轮询')
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
        } else {
          // 其他状态（generating, queuing 等）显示加载动画
          console.log('[OrderContentCreation] 内容制作中，当前状态:', data.status)
        }
      } else {
        console.error('[OrderContentCreation] 获取状态失败:', res.data?.message)
        if (loading) setLoading(false)
        if (errorCount >= 5) {
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
          Taro.showToast({ title: '获取状态失败，请刷新页面', icon: 'none' })
        }
        setErrorCount(errorCount + 1)
      }
    } catch (error) {
      console.error('[OrderContentCreation] 请求异常:', error)
      if (loading) setLoading(false)
      if (errorCount >= 5) {
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        Taro.showToast({ title: '网络异常，请刷新页面', icon: 'none' })
      }
      setErrorCount(errorCount + 1)
    }
  }

  const handlePublish = async () => {
    if (!contentData) return

    Taro.showModal({
      title: '确认发布',
      content: `确定发布到${PLATFORM_NAMES[contentData.platform] || '目标平台'}吗？`,
      success: async (res) => {
        if (res.confirm) {
          setPublishing(true)
          try {
            const finalContent = editedContent || contentData.content
            const publishRes = await Network.request({
              url: `/api/order-processing/${requestId}/publish`,
              method: 'POST',
              data: {
                content: finalContent,
                platform: contentData.platform
              }
            })

            console.log('[OrderContentCreation] 发布响应:', publishRes.data)

            if (publishRes.data?.code === 200) {
              Taro.showToast({ title: '发布成功', icon: 'success' })
              setTimeout(() => {
                navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
              }, 1500)
            } else {
              Taro.showToast({ title: publishRes.data?.message || '发布失败', icon: 'none' })
            }
          } catch (error) {
            console.error('[OrderContentCreation] 发布异常:', error)
            Taro.showToast({ title: '发布失败', icon: 'none' })
          } finally {
            setPublishing(false)
          }
        }
      }
    })
  }

  const handleSaveEdit = () => {
    setIsEditing(false)
    Taro.showToast({ title: '保存成功', icon: 'success' })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent(contentData?.content || '')
  }

  const handleRegenerate = async () => {
    Taro.showModal({
      title: '重新生成内容',
      content: '确定要重新生成内容吗？当前内容将被替换。',
      success: async (res) => {
        if (res.confirm) {
          setRegenerating(true)
          try {
            console.log('[OrderContentCreation] 开始重新生成内容')
            const response = await Network.request({
              url: `/api/order-processing/${requestId}/regenerate`,
              method: 'POST'
            })

            console.log('[OrderContentCreation] 重新生成响应:', response.data)

            if (response.data?.code === 200) {
              Taro.showToast({ title: '正在重新生成内容...', icon: 'loading' })
              // 重新开始轮询
              startPolling()
            } else {
              Taro.showToast({ title: response.data?.message || '重新生成失败', icon: 'none' })
            }
          } catch (error) {
            console.error('[OrderContentCreation] 重新生成异常:', error)
            Taro.showToast({ title: '重新生成失败', icon: 'none' })
          } finally {
            setRegenerating(false)
          }
        }
      }
    })
  }

  const parseMarkdown = (text: string): string => {
    let html = text

    // 处理图片：![alt](url)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img class="md-image" src="$2" alt="$1" style="width: 100%; border-radius: 0.75rem; margin: 0.75rem 0;" />')

    // 处理引用块：> text
    html = html.replace(/^> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>')

    // 处理三级标题：### text
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3 block">$1</h3>')

    // 处理二级标题：## text
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2 block">$1</h2>')

    // 处理一级标题：# text
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1 block">$1</h1>')

    // 处理有序列表：1. text
    html = html.replace(/^\d+\.\s+(.*$)/gim, '<div class="md-list-item block"><span class="md-list-number">$&</span> <span class="md-list-text">$1</span></div>')

    // 处理粗体：**text**
    html = html.replace(/\*\*(.*?)\*\*/gim, '<text class="md-strong">$1</text>')

    // 处理换行
    html = html.replace(/\n/gim, '<br class="md-br block" />')

    return html
  }

  return (
    <View className="content-creation-page">
      <View
        className="page-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}
      >
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="#475569" />
        </View>
        <Text className="header-title block">制作内容</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="page-scroll" scrollY enableFlex>
        {loading && (
          <View className="loading-container">
            <View className="loading-icon">
              <Sparkles size={56} color="#3b82f6" />
            </View>
            <Text className="loading-title block">AI正在制作内容</Text>
            <Text className="loading-desc block">正在为您的订单生成优质内容...</Text>
            <Loader size={28} color="#3b82f6" className="loading-spinner" />
          </View>
        )}

        {!loading && (!contentData || !contentData.content || contentData.content.length === 0) && (
          <View className="loading-container">
            <View className="loading-icon">
              <Sparkles size={56} color="#3b82f6" />
            </View>
            <Text className="loading-title block">AI 正在制作内容</Text>
            <Text className="loading-desc block">
              {processingStatus === 'generating' ? '内容正在生成中，请稍候...' : processingStatus === 'preview' ? '内容准备就绪，即将展示...' : processingStatus === 'queuing' ? '正在排队处理中...' : '正在为您的订单生成优质内容...'}
            </Text>
            <Loader size={28} color="#3b82f6" className="loading-spinner" />
          </View>
        )}

        {!loading && contentData && contentData.content && contentData.content.length > 0 && (
          <View className="content-container">
            <View className="card order-info-card">
              <View
                className="card-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
              >
                <View style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} color="#3b82f6" />
                  <Text className="card-title block">订单信息</Text>
                </View>
              </View>
              <Text className="info-title block">{contentData.title}</Text>
              <View
                className="info-meta"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <View
                  className="info-tag"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <Smartphone size={14} color="#3b82f6" />
                  <Text className="info-tag-text block">
                    {PLATFORM_NAMES[contentData.platform] || contentData.platform}
                  </Text>
                </View>
              </View>
            </View>

            {contentData.images && contentData.images.length > 0 && (
              <View className="card media-card">
                <View
                  className="card-header"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
                >
                  <Text className="card-title block">图片展示</Text>
                  <Text className="card-subtitle block">{contentData.images.length}张图片</Text>
                </View>
                <View className="image-slider">
                  <Image
                    className="current-image"
                    src={contentData.images[currentImageIndex]}
                    mode="aspectFill"
                  />
                  {contentData.images.length > 1 && (
                    <View
                      className="image-indicators"
                      style={{ display: 'flex', gap: '0.375rem' }}
                    >
                      {contentData.images.map((_, index) => (
                        <View
                          key={index}
                          className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {contentData.videos && contentData.videos.length > 0 && (
              <View className="card media-card">
                <View
                  className="card-header"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
                >
                  <Text className="card-title block">视频展示</Text>
                  <Text className="card-subtitle block">{contentData.videos.length}个视频</Text>
                </View>
                {contentData.videos.map((videoUrl, index) => (
                  <Video
                    key={index}
                    className="video-player"
                    src={videoUrl}
                    controls
                    autoplay={false}
                  />
                ))}
              </View>
            )}

            <View className="card content-card">
              <View
                className="card-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
              >
                <Text className="card-title block">内容预览</Text>
              </View>

              <View
                className="card-actions"
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'flex-end' }}
              >
                {isEditing ? (
                  <View
                    className="action-buttons"
                    style={{ display: 'flex', gap: '0.5rem' }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      <Text className="action-btn-text block">取消</Text>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                    >
                      <Save size={14} color="#fff" />
                      <Text className="action-btn-text block">保存</Text>
                    </Button>
                  </View>
                ) : (
                  <View
                    className="action-buttons"
                    style={{ display: 'flex', gap: '0.5rem' }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                    >
                      <RefreshCw size={14} color="#1a1a1a" />
                      <Text className="action-btn-text block">重新生成</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil size={14} color="#1a1a1a" />
                      <Text className="action-btn-text block">编辑</Text>
                    </Button>
                  </View>
                )}
              </View>

              {isEditing ? (
                <View className="edit-mode">
                  <Textarea
                    className="content-textarea"
                    placeholder="编辑内容..."
                    value={editedContent}
                    onInput={(e) => setEditedContent(e.detail.value)}
                    maxlength={5000}
                    style={{ minHeight: '20rem' }}
                  />
                </View>
              ) : (
                <View
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(contentData.content) }}
                />
              )}
            </View>

            <View className="publish-section">
              <Button
                className="publish-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <Loader size={18} color="#fff" />
                    <Text className="publish-btn-text block">发布中...</Text>
                  </>
                ) : (
                  <>
                    <Check size={18} color="#fff" />
                    <Text className="publish-btn-text block">确认发布</Text>
                  </>
                )}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
