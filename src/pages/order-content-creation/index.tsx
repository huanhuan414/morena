import { useLoad, useRouter, navigateBack, showToast, showModal, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { ArrowLeft, Loader, Check, Sparkles, Smartphone, Pencil, Save } from 'lucide-react-taro'
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
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useLoad(() => {
    console.log('[OrderContentCreation] 页面加载，参数:', { requestId, avatarId, orderId })
    if (!requestId || !avatarId || !orderId) {
      showToast({ title: '参数错误', icon: 'none' })
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

      if (res.data?.code === 200 && res.data.data?.generatedContent) {
        const data = res.data.data.generatedContent as ContentData

        if (loading) {
          console.log('[OrderContentCreation] 首次获取内容成功')
          setLoading(false)
        }

        setContentData(data)
        setEditedContent(data.content || '')

        if (data.content && data.content.length > 0) {
          console.log('[OrderContentCreation] 内容已制作完成，停止轮询')
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
        }
      } else {
        console.error('[OrderContentCreation] 获取状态失败:', res.data?.message)
        const errorCount = (contentData as any)?.errorCount || 0
        if (errorCount >= 5) {
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
          showToast({ title: '获取状态失败，请刷新页面', icon: 'none' })
        }
        if (loading) setLoading(false)
        setContentData({ ...(contentData as any), errorCount: errorCount + 1 } as any)
      }
    } catch (error) {
      console.error('[OrderContentCreation] 请求异常:', error)
      const errorCount = (contentData as any)?.errorCount || 0
      if (errorCount >= 5) {
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        showToast({ title: '网络异常，请刷新页面', icon: 'none' })
      }
      if (loading) setLoading(false)
      setContentData({ ...(contentData as any), errorCount: errorCount + 1 } as any)
    }
  }

  const handlePublish = async () => {
    if (!contentData) return

    showModal({
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
              showToast({ title: '发布成功', icon: 'success' })
              setTimeout(() => {
                navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
              }, 1500)
            } else {
              showToast({ title: publishRes.data?.message || '发布失败', icon: 'none' })
            }
          } catch (error) {
            console.error('[OrderContentCreation] 发布异常:', error)
            showToast({ title: '发布失败', icon: 'none' })
          } finally {
            setPublishing(false)
          }
        }
      }
    })
  }

  const handleSaveEdit = () => {
    setIsEditing(false)
    showToast({ title: '保存成功', icon: 'success' })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent(contentData?.content || '')
  }

  const parseMarkdown = (text: string): string => {
    let html = text
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="md-strong">$1</strong>')
    html = html.replace(/\*(.*?)\*/gim, '<em class="md-em">$1</em>')
    html = html.replace(/\n/gim, '<br class="md-br">')
    return html
  }

  return (
    <View className="content-creation-page">
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.9)" />
        </View>
        <Text className="header-title block">制作内容</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="page-scroll" scrollY>
        {loading && (
          <View className="loading-container">
            <View className="loading-icon">
              <Sparkles size={56} color="#00f5ff" />
            </View>
            <Text className="loading-title block">AI正在制作内容</Text>
            <Text className="loading-desc block">正在为您的订单生成优质内容...</Text>
            <Loader size={28} color="#00f5ff" className="loading-spinner" />
          </View>
        )}

        {!loading && contentData && (!contentData.content || contentData.content.length === 0) && (
          <View className="loading-container">
            <View className="loading-icon">
              <Sparkles size={56} color="#00f5ff" />
            </View>
            <Text className="loading-title block">AI正在制作内容</Text>
            <Text className="loading-desc block">正在为您的订单生成优质内容...</Text>
            <Loader size={28} color="#00f5ff" className="loading-spinner" />
          </View>
        )}

        {!loading && contentData && contentData.content && contentData.content.length > 0 && (
          <View className="content-container">
            <View className="card order-info-card">
              <View className="card-header">
                <Sparkles size={18} color="#00f5ff" />
                <Text className="card-title block">订单信息</Text>
              </View>
              <Text className="info-title block">{contentData.title}</Text>
              <View className="info-meta">
                <View className="info-tag">
                  <Smartphone size={14} color="#00f5ff" />
                  <Text className="info-tag-text block">
                    {PLATFORM_NAMES[contentData.platform] || contentData.platform}
                  </Text>
                </View>
              </View>
            </View>

            {contentData.images && contentData.images.length > 0 && (
              <View className="card media-card">
                <View className="card-header">
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
                    <View className="image-indicators">
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
                <View className="card-header">
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
              <View className="card-header">
                <Text className="card-title block">内容预览</Text>
                <View className="card-actions">
                  {isEditing ? (
                    <View className="action-buttons">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil size={14} color="#fff" />
                      <Text className="action-btn-text block">编辑</Text>
                    </Button>
                  )}
                </View>
              </View>

              {isEditing ? (
                <View className="edit-mode">
                  <Textarea
                    className="content-textarea"
                    placeholder="编辑内容..."
                    value={editedContent}
                    onInput={(e) => setEditedContent(e.detail.value)}
                    maxlength={5000}
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
