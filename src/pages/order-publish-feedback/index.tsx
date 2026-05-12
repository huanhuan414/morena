import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, ImagePlus, Eye, CircleCheck, X, Send, Link } from 'lucide-react-taro'
import { canonicalizePlatform, canonicalizePlatforms, getPlatformLabel } from '@/constants/publish-platform'
import './index.css'

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  image: { name: '图片', color: '#3B82F6' },
  video: { name: '视频', color: '#8B5CF6' },
  article: { name: '文章', color: '#10B981' },
  image_text: { name: '图文', color: '#F59E0B' },
  video_text: { name: '短视频', color: '#EF4444' },
}

// 平台配色
const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
  xiaohongshu: { bg: '#FFF0F0', text: '#FE2C55' },
  douyin: { bg: '#F0FCFC', text: '#161823' },
  wechat_mp: { bg: '#F0FFF4', text: '#07C160' },
  wechat_moments: { bg: '#F0FFF4', text: '#07C160' },
  wechat_channel: { bg: '#F0FFF4', text: '#07C160' },
  weibo: { bg: '#FFF7F0', text: '#FF8200' },
  bilibili: { bg: '#FFF0F6', text: '#FB7299' },
  zhihu: { bg: '#F0F4FF', text: '#0066FF' },
  kuaishou: { bg: '#FFF5F0', text: '#FF4906' },
  toutiao: { bg: '#FFF0F0', text: '#E4393C' },
}

interface GeneratedContent {
  title?: string
  content?: string
  images?: string[]
  videos?: string[]
  platforms?: string[]
  script?: string
  cover_image?: string
  contentType?: string
}

interface PublishPlatform {
  platform: string
  status: string
  message?: string
}

export default function OrderPublishFeedback() {
  const router = useRouter()
  const { requestId, orderId, contentId } = router.params

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [publishPlatforms, setPublishPlatforms] = useState<PublishPlatform[]>([])
  const [feedback, setFeedback] = useState<Record<string, { images: string[]; link: string }>>({})
  const [contentType, setContentType] = useState<string>('')
  const [currentPlatform, setCurrentPlatform] = useState<string>('')
  const [actualRequestId, setActualRequestId] = useState<string>('')

  useLoad(() => {
    console.log('[OrderPublishFeedback] 页面加载，params:', { requestId, orderId, contentId })
    loadOrderData()
  })

  const loadOrderData = async () => {
    try {
      let reqId = requestId
      let contentData: any = null

      // 如果传了 contentId，先通过 contentId 获取内容
      if (contentId && !requestId) {
        console.log('[OrderPublishFeedback] 通过 contentId 获取内容:', contentId)
        const contentRes = await Network.request({
          url: `/api/content-generation/content/${contentId}`
        })
        if (contentRes.data?.code === 200) {
          contentData = contentRes.data.data
          reqId = contentData.id || ''
          setActualRequestId(reqId || '')
          setGeneratedContent({
            title: contentData.title || '',
            content: contentData.content || '',
            images: safeParseArray(contentData.images),
            platforms: safeParseArray(contentData.platforms),
            contentType: contentData.contentType || contentData.content_type || 'image_text',
          })
          setContentType(contentData.contentType || contentData.content_type || 'image_text')
          const platform = canonicalizePlatform(safeParseArray(contentData.platforms)[0] || '')
          setCurrentPlatform(platform)
          setPublishPlatforms(
            safeParseArray(contentData.platforms).map((p: string) => ({
              platform: canonicalizePlatform(p),
              status: 'manual',
              message: '需要手动发布'
            }))
          )
        }
      }

      // 如果有 requestId，通过状态接口获取
      if (reqId) {
        console.log('[OrderPublishFeedback] 通过 requestId 获取状态:', reqId)
        const response = await Network.request({
          url: `/api/order-processing/status/${reqId}`
        })

        if (response.data?.code === 200) {
          const data = response.data.data

          if (!contentData) {
            setGeneratedContent(data.generatedContent)
            setContentType(data.contentType || 'image')
            const platform = canonicalizePlatform(data.generatedContent?.platforms?.[0] || '')
            setCurrentPlatform(platform)
          }

          const platforms = canonicalizePlatforms(data.publishStatus?.platforms || data.publish_status?.platforms || [])
          const platformStatusMap = data.publishStatus?.platformStatus || data.publish_status?.platformStatus || {}

          if (platforms.length > 0) {
            setPublishPlatforms(
              platforms.map((platform: string) => ({
                platform,
                status: platformStatusMap?.[platform]?.status || 'manual',
                message: platformStatusMap?.[platform]?.message
              }))
            )
          } else if (!contentData && data.generatedContent?.platforms) {
            setPublishPlatforms(
              canonicalizePlatforms(data.generatedContent.platforms).map((p: string) => ({
                platform: p,
                status: 'manual',
                message: '需要手动发布'
              }))
            )
          }
        }
      }

      if (!contentData && !requestId && !contentId) {
        Taro.showToast({ title: '缺少参数', icon: 'none' })
      }
    } catch (error) {
      console.error('[OrderPublishFeedback] 加载数据失败:', error)
      Taro.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 安全解析数组
  const safeParseArray = (val: any): any[] => {
    if (Array.isArray(val)) return val
    if (typeof val === 'string') {
      try { const r = JSON.parse(val); return Array.isArray(r) ? r : [] }
      catch { return [] }
    }
    return []
  }

  const handlePreviewImage = (urls: string[], current: string) => {
    Taro.previewImage({ urls, current })
  }

  const handleChooseImage = async (platform: string) => {
    try {
      const res = await Taro.chooseImage({ count: 9, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      Taro.showLoading({ title: '上传中...', mask: true })

      const uploadPromises = res.tempFilePaths.map(filePath =>
        Network.uploadFile({ url: '/api/upload/image', filePath, name: 'file' })
      )
      const results = await Promise.all(uploadPromises)
      const uploadedUrls: string[] = []

      results.forEach(result => {
        const uploadData = JSON.parse(result.data)
        if (uploadData.code === 200) {
          uploadedUrls.push(uploadData.data.url)
        }
      })

      Taro.hideLoading()

      if (uploadedUrls.length > 0) {
        setFeedback(prev => ({
          ...prev,
          [platform]: {
            ...prev[platform],
            images: [...(prev[platform]?.images || []), ...uploadedUrls]
          }
        }))
        Taro.showToast({ title: `上传成功${uploadedUrls.length}张`, icon: 'success' })
      }
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' })
    }
  }

  const handleLinkChange = (platform: string, value: string) => {
    setFeedback(prev => ({
      ...prev,
      [platform]: { ...prev[platform], link: value }
    }))
  }

  const handleSubmit = async () => {
    const platforms = Object.keys(feedback)
    if (platforms.length === 0) {
      Taro.showToast({ title: '请至少为一个平台填写反馈', icon: 'none' })
      return
    }

    const hasInvalid = platforms.some(platform => {
      const fb = feedback[platform]
      return !fb.images?.length && !fb.link
    })

    if (hasInvalid) {
      Taro.showToast({ title: '请填写截图或链接', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const reqId = actualRequestId || requestId
      const response = await Network.request({
        url: `/api/order-processing/feedback/${reqId}`,
        method: 'POST',
        data: { feedback }
      })

      if (response.data?.code === 200) {
        Taro.showToast({ title: '反馈成功', icon: 'success', duration: 2000 })
        setTimeout(() => navigateBack(), 2000)
      } else {
        Taro.showToast({ title: response.data?.message || '提交失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  // 获取平台配色
  const getPlatformColor = (platform: string) => PLATFORM_COLORS[platform] || { bg: '#F3F4F6', text: '#374151' }

  // 获取内容类型配置
  const getContentTypeConfig = (type: string) => CONTENT_TYPE_CONFIG[type] || { name: type, color: '#6B7280' }

  // 渲染内容概览
  const renderContentPreview = () => {
    if (!generatedContent) return null
    const typeConfig = getContentTypeConfig(contentType)

    return (
      <View className="content-preview-card">
        {/* 类型标签 */}
        <View className="preview-header">
          <View className="content-type-tag" style={{ background: typeConfig.color + '15', borderLeft: `6rpx solid ${typeConfig.color}` }}>
            <Text className="content-type-tag-text" style={{ color: typeConfig.color }}>{typeConfig.name}</Text>
          </View>
          {currentPlatform && (
            <View className="platform-tag" style={{ background: getPlatformColor(currentPlatform).bg }}>
              <Text className="platform-tag-text" style={{ color: getPlatformColor(currentPlatform).text }}>
                {getPlatformLabel(currentPlatform)}
              </Text>
            </View>
          )}
        </View>

        {/* 标题 */}
        {generatedContent.title && (
          <Text className="preview-title">{generatedContent.title}</Text>
        )}

        {/* 内容文本 */}
        {generatedContent.content && (
          <View className="preview-text-box">
            <Text className="preview-text">
              {generatedContent.content.length > 200
                ? generatedContent.content.substring(0, 200) + '...'
                : generatedContent.content}
            </Text>
            {generatedContent.content.length > 200 && (
              <Text className="preview-text-more">展开全文</Text>
            )}
          </View>
        )}

        {/* 图片预览 */}
        {generatedContent.images && generatedContent.images.length > 0 && (
          <View className="preview-images">
            <Text className="preview-section-label">
              <ImagePlus size={14} color="#6B7280" /> 配图 ({generatedContent.images.length})
            </Text>
            <View className="preview-image-grid">
              {generatedContent.images.slice(0, 6).map((img, index) => (
                <View
                  key={index}
                  className="preview-image-item"
                  onClick={() => handlePreviewImage(generatedContent.images!, img)}
                >
                  <Image src={img} className="preview-image-thumb" mode="aspectFill" />
                  <View className="preview-image-eye">
                    <Eye size={14} color="#fff" />
                  </View>
                </View>
              ))}
              {generatedContent.images.length > 6 && (
                <View className="preview-image-more">
                  <Text className="preview-image-more-text">+{generatedContent.images.length - 6}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    )
  }

  // 渲染平台反馈卡片
  const renderPlatformCard = (result: PublishPlatform, index: number) => {
    const platform = result.platform
    const platformName = getPlatformLabel(platform)
    const pc = getPlatformColor(platform)
    const fb = feedback[platform] || { images: [], link: '' }
    const isSuccess = result.status === 'success'

    return (
      <View key={index} className="platform-card">
        {/* 卡片头部：平台 + 状态 */}
        <View className="platform-card-header">
          <View className="platform-card-left">
            <View className="platform-dot" style={{ background: pc.text }} />
            <Text className="platform-card-name">{platformName}</Text>
          </View>
          <View className={`platform-status ${isSuccess ? 'status-success' : 'status-pending'}`}>
            {isSuccess ? (
              <>
                <CircleCheck size={12} color="#10B981" />
                <Text className="platform-status-text" style={{ color: '#10B981' }}>已发布</Text>
              </>
            ) : (
              <Text className="platform-status-text" style={{ color: '#D97706' }}>待发布</Text>
            )}
          </View>
        </View>

        {/* 发布说明 */}
        {result.message && (
          <View className="platform-notice">
            <Text className="platform-notice-text">{result.message}</Text>
          </View>
        )}

        {/* 上传截图 */}
        <View className="feedback-section">
          <Text className="feedback-label">发布截图</Text>
          <View className="feedback-image-list">
            {fb.images && fb.images.length > 0 && fb.images.map((img: string, idx: number) => (
              <View key={idx} className="feedback-image-wrapper">
                <Image
                  src={img}
                  className="feedback-image"
                  mode="aspectFill"
                  onClick={() => Taro.previewImage({ urls: fb.images, current: img })}
                />
                <View
                  className="feedback-image-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFeedback(prev => ({
                      ...prev,
                      [platform]: {
                        ...prev[platform],
                        images: prev[platform].images.filter((_: string, i: number) => i !== idx)
                      }
                    }))
                  }}
                >
                  <X size={10} color="#fff" />
                </View>
              </View>
            ))}

            {(!fb.images || fb.images.length < 9) && (
              <View className="feedback-image-add" onClick={() => handleChooseImage(platform)}>
                <ImagePlus size={20} color="#9CA3AF" />
                <Text className="feedback-image-add-text">添加</Text>
              </View>
            )}
          </View>
          {(!fb.images || fb.images.length === 0) && (
            <Text className="feedback-hint">点击上传发布截图，最多9张</Text>
          )}
        </View>

        {/* 填写链接 */}
        <View className="feedback-section">
          <Text className="feedback-label">发布链接</Text>
          <View className="feedback-link-input">
            <Link size={14} color="#9CA3AF" />
            <View className="feedback-link-field">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入发布链接"
                value={fb.link}
                onInput={(e) => handleLinkChange(platform, e.detail.value)}
              />
            </View>
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="feedback-page">
        <View className="feedback-loading">
          <View className="feedback-loading-spinner" />
          <Text className="feedback-loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="feedback-page">
      {/* 顶部渐变头部 */}
      <View className="feedback-header">
        <View className="feedback-header-deco">
          <View className="feedback-header-circle circle-a" />
          <View className="feedback-header-circle circle-b" />
        </View>
        <View className="feedback-header-bar">
          <View className="feedback-back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="feedback-header-center">
            <Text className="feedback-header-title">发布反馈</Text>
          </View>
          <View style={{ width: '64rpx' }} />
        </View>
        <Text className="feedback-header-desc">上传发布截图或链接，完成反馈确认</Text>
      </View>

      {/* 内容概览 */}
      {renderContentPreview()}

      {/* 平台反馈列表 */}
      <View className="feedback-section-title">
        <Text className="feedback-section-title-text">各平台反馈</Text>
      </View>

      {publishPlatforms.length === 0 ? (
        <View className="feedback-empty">
          <Text className="feedback-empty-text">暂无发布平台</Text>
        </View>
      ) : (
        publishPlatforms.map((result, index) => renderPlatformCard(result, index))
      )}

      {/* 底部提交按钮 */}
      <View className="feedback-bottom-bar">
        <View
          className={`feedback-submit-btn ${submitting ? 'disabled' : ''}`}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Send size={16} color="#fff" />
          <Text className="feedback-submit-text">{submitting ? '提交中...' : '提交反馈'}</Text>
        </View>
      </View>
    </View>
  )
}
