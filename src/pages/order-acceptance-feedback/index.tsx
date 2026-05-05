import { useRouter, showToast, previewImage, navigateBack } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { ChevronLeft, Clock, CircleCheck, ExternalLink } from 'lucide-react-taro'
import './index.css'

export default function OrderAcceptanceFeedbackPage() {
  const router = useRouter()
  const { requestId, orderId } = router.params

  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [processingStatus, setProcessingStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [publishUrls, setPublishUrls] = useState<string[]>([])
  const [publishLink, setPublishLink] = useState('')
  const [publishNote, setPublishNote] = useState('')

  useEffect(() => {
    if (requestId && orderId) {
      fetchData()
    }
  }, [requestId, orderId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')

      // 获取订单信息
      const orderRes = await Network.request({
        url: `/api/order/${orderId}`
      })
      
      if (orderRes.data?.code === 200 || orderRes.data?.success) {
        setOrderInfo(orderRes.data.data)
      }

      // 获取处理状态
      const statusRes = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })
      
      if (statusRes.data?.code === 200 || statusRes.data?.success) {
        const data = statusRes.data.data || statusRes.data
        setProcessingStatus(data)
        
        // 提取图片
        if (data.generatedContent?.images) {
          setImages(data.generatedContent.images)
        }
        
        // 提取已提交的反馈信息
        if (data.publishStatus) {
          if (data.publishStatus.screenshot_urls) {
            setPublishUrls(data.publishStatus.screenshot_urls)
          }
          if (data.publishStatus.link) {
            setPublishLink(data.publishStatus.link)
          }
          if (data.publishStatus.note) {
            setPublishNote(data.publishStatus.note)
          }
        }
      } else {
        setError(statusRes.data?.message || '获取状态失败')
      }
    } catch (err: any) {
      console.error('获取数据失败:', err)
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigateBack()
  }

  const handleUrgeAcceptance = async () => {
    try {
      showToast({ title: '已发送催促通知', icon: 'none' })
    } catch (err) {
      console.error('催促失败:', err)
    }
  }

  const handlePreviewImage = (index: number) => {
    if (images.length > 0) {
      const urls = images.length > 1 ? images : [images[0]]
      previewImage({
        urls: urls,
        current: images[index]
      })
    }
  }

  const handlePreviewPublishImage = (index: number) => {
    if (publishUrls.length > 0) {
      previewImage({
        urls: publishUrls,
        current: publishUrls[index]
      })
    }
  }

  if (loading) {
    return (
      <View className="page-container">
        <View className="loading-state">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="page-container">
        <View className="error-state">
          <CircleCheck size={48} color="#ef4444" />
          <Text className="error-text">{error}</Text>
          <Button className="retry-btn" onClick={fetchData}>重试</Button>
        </View>
      </View>
    )
  }

  const platform = orderInfo?.platform || ''
  const contentType = orderInfo?.contentType || ''
  const platformName = {
    xiaohongshu: '小红书',
    douyin: '抖音',
    wechat_moments: '微信朋友圈',
    wechat_mp: '微信公众号'
  }[platform] || platform

  const contentTypeName = {
    image: '图片',
    video: '视频',
    article: '文章',
    graphic: '图文'
  }[contentType] || contentType

  const isImageContent = contentType === 'image' || contentType === 'graphic'
  const isVideoContent = contentType === 'video'
  const isArticleContent = contentType === 'article'

  return (
    <View className="page-container">
      {/* 顶部导航 */}
      <View className="nav-header">
        <View className="nav-left" onClick={handleBack}>
          <ChevronLeft size={24} color="#333" />
        </View>
        <Text className="nav-title">待验收</Text>
        <View className="nav-right"></View>
      </View>

      <ScrollView scrollY className="content-scroll">
        {/* 订单信息卡片 */}
        <View className="order-info-card">
          <View className="order-header">
            <View className="platform-tag">
              <Text>{platformName}</Text>
            </View>
            <View className="content-type-tag">
              <Text>{contentTypeName}</Text>
            </View>
          </View>
          <Text className="order-title">{orderInfo?.title || '内容创作订单'}</Text>
          <Text className="order-desc">{orderInfo?.description || ''}</Text>
        </View>

        {/* 分身已发布内容 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <CircleCheck size={18} color="#10b981" />
              <Text className="section-title">分身已发布内容</Text>
            </View>
            <View className="status-badge success">
              <CircleCheck size={14} color="#10b981" />
              <Text>已发布</Text>
            </View>
          </View>

          {/* 图片内容展示 */}
          {isImageContent && images.length > 0 && (
            <View className="image-preview-container">
              {/* 小红书风格布局 */}
              <View className="xhs-layout">
                {/* 左侧大图 */}
                <View className="main-image-wrapper" onClick={() => handlePreviewImage(0)}>
                  <Image 
                    className="main-image" 
                    src={images[0]} 
                    mode="aspectFill"
                    showMenuByLongpress
                  />
                </View>
                {/* 右侧缩略图 */}
                {images.length > 1 && (
                  <View className="thumbnail-list">
                    {images.slice(1).map((img, idx) => (
                      <View 
                        key={idx} 
                        className="thumbnail-item"
                        onClick={() => handlePreviewImage(idx + 1)}
                      >
                        <Image 
                          className="thumbnail-img" 
                          src={img} 
                          mode="aspectFill"
                          showMenuByLongpress
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
              {/* 文案内容 */}
              {processingStatus?.generatedContent?.content && (
                <View className="content-text-card">
                  <Text className="content-text">{processingStatus.generatedContent.content}</Text>
                </View>
              )}
            </View>
          )}

          {/* 视频内容展示 */}
          {isVideoContent && (
            <View className="video-preview-container">
              <View className="video-placeholder">
                <Text>视频内容</Text>
              </View>
              {processingStatus?.generatedContent?.content && (
                <View className="content-text-card">
                  <Text className="content-text">{processingStatus.generatedContent.content}</Text>
                </View>
              )}
            </View>
          )}

          {/* 文章内容展示 */}
          {isArticleContent && (
            <View className="article-preview-container">
              <Text className="article-title">{processingStatus?.generatedContent?.title || ''}</Text>
              <Text className="article-content">{processingStatus?.generatedContent?.content || ''}</Text>
            </View>
          )}
        </View>

        {/* 已提交的反馈信息 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-row">
              <Clock size={18} color="#f97316" />
              <Text className="section-title">已提交的反馈</Text>
            </View>
          </View>

          {/* 截图 */}
          {publishUrls.length > 0 && (
            <View className="publish-screenshots">
              <Text className="subsection-label">发布截图</Text>
              <View className="screenshots-grid">
                {publishUrls.map((url, idx) => (
                  <View 
                    key={idx} 
                    className="screenshot-item"
                    onClick={() => handlePreviewPublishImage(idx)}
                  >
                    <Image 
                      className="screenshot-img" 
                      src={url} 
                      mode="aspectFill"
                      showMenuByLongpress
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 链接 */}
          {publishLink && (
            <View className="publish-link">
              <Text className="subsection-label">发布链接</Text>
              <View className="link-card">
                <ExternalLink size={16} color="#3b82f6" />
                <Text className="link-text" numberOfLines={2}>{publishLink}</Text>
              </View>
            </View>
          )}

          {/* 说明 */}
          {publishNote && (
            <View className="publish-note">
              <Text className="subsection-label">备注说明</Text>
              <View className="note-card">
                <Text className="note-text">{publishNote}</Text>
              </View>
            </View>
          )}

          {!publishUrls.length && !publishLink && !publishNote && (
            <View className="empty-feedback">
              <Text>暂无反馈信息</Text>
            </View>
          )}
        </View>

        {/* 催促验收按钮 */}
        <View className="action-section">
          <Button className="urge-btn" onClick={handleUrgeAcceptance}>
            <Text>催促验收</Text>
          </Button>
        </View>

        <View className="bottom-safe"></View>
      </ScrollView>
    </View>
  )
}
