import { useLoad, useRouter, navigateBack, showToast, showModal, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { ArrowLeft, Loader, Check, Sparkles, Smartphone } from 'lucide-react-taro'
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
  const [publishing, setPublishing] = useState(false)

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

  return (
    <View className="content-creation-page">
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title block">制作内容</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="page-scroll" scrollY>
        {loading && (
          <View className="loading-container">
            <Loader size={32} color="#6366f1" />
            <Text className="loading-text block">加载中...</Text>
          </View>
        )}

        {!loading && contentData && (!contentData.content || contentData.content.length === 0) && (
          <View className="creating-container">
            <View className="creating-icon">
              <Sparkles size={48} color="#6366f1" />
            </View>
            <Text className="creating-title block">AI正在制作内容</Text>
            <Text className="creating-desc block">
              正在为您的订单生成优质内容，请稍候...
            </Text>
            <Loader size={24} color="#6366f1" className="creating-spinner" />
          </View>
        )}

        {!loading && contentData && contentData.content && contentData.content.length > 0 && (
          <View className="content-container">
            <View className="order-info-card">
              <View className="info-header">
                <Sparkles size={20} color="#00f5ff" />
                <Text className="info-title block">订单信息</Text>
              </View>
              <Text className="info-title-text block">{contentData.title}</Text>
              <View className="info-meta">
                <View className="info-meta-item">
                  <Smartphone size={16} color="#6366f1" />
                  <Text className="info-meta-text block">
                    {PLATFORM_NAMES[contentData.platform] || contentData.platform}
                  </Text>
                </View>
              </View>
            </View>

            <View className="content-editor-card">
              <View className="editor-header">
                <Text className="editor-title block">内容预览</Text>
                <Text className="editor-subtitle block">您可以编辑下方内容后发布</Text>
              </View>
              <Textarea
                className="content-textarea"
                placeholder="生成的内容将在这里显示"
                value={editedContent || contentData.content}
                onInput={(e) => setEditedContent(e.detail.value)}
                maxlength={2000}
              />
            </View>

            <View className="action-buttons">
              <Button
                className="publish-btn"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Text className="btn-text block">发布中...</Text>
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text className="btn-text block">确认发布</Text>
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
