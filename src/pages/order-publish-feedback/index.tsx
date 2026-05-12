import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, ImagePlus, Eye, X, Send, Link, ShieldCheck, ShieldAlert, Loader } from 'lucide-react-taro'
import { canonicalizePlatform, canonicalizePlatforms, getPlatformLabel, getPlatformMeta } from '@/constants/publish-platform'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { safeNavigateBack } from '@/utils/navigation'
import './index.css'

// 文章型平台判断（这些平台内容为 Markdown 格式，需要解析渲染）
const ARTICLE_PLATFORMS = ['wechat_mp', 'wechat_channel', 'toutiao', 'zhihu']
function isArticlePlatform(platform: string): boolean {
  return ARTICLE_PLATFORMS.includes(platform)
}

// 需要发布验证的平台
const VERIFY_REQUIRED_PLATFORMS = ['douyin', 'kuaishou', 'xiaohongshu', 'wechat_mp', 'wechat_channel']

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  image: { name: '图片', color: '#3B82F6' },
  video: { name: '视频', color: '#8B5CF6' },
  article: { name: '文章', color: '#10B981' },
  image_text: { name: '图文', color: '#F59E0B' },
  video_text: { name: '短视频', color: '#EF4444' },
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

interface FeedbackDraft {
  images: string[]
  link: string
  views?: string
  likes?: string
  comments?: string
  shares?: string
}

export default function OrderPublishFeedback() {
  const router = useRouter()
  const { requestId, orderId, contentId } = router.params

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [publishPlatforms, setPublishPlatforms] = useState<PublishPlatform[]>([])
  const [feedback, setFeedback] = useState<Record<string, FeedbackDraft>>({})
  const [contentType, setContentType] = useState<string>('')
  const [currentPlatform, setCurrentPlatform] = useState<string>('')
  const [actualRequestId, setActualRequestId] = useState<string>('')
  const [verifyResults, setVerifyResults] = useState<Record<string, { verified: boolean; message: string; title?: string; verifying?: boolean }>>({})

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
          const existingFeedback = data.publishFeedback || {}
          const feedbackDraft = Object.entries(existingFeedback).reduce<Record<string, FeedbackDraft>>((acc, [platform, value]) => {
            const item = typeof value === 'object' && value ? value as Record<string, any> : {}
            const canonicalPlatform = canonicalizePlatform(platform)
            if (!canonicalPlatform) return acc
            const metrics = typeof item.metrics === 'object' && item.metrics ? item.metrics : item
            acc[canonicalPlatform] = {
              images: Array.isArray(item.images) ? item.images.filter(Boolean) : [],
              link: typeof item.link === 'string' ? item.link : '',
              ...(metrics.views !== undefined ? { views: String(metrics.views) } : {}),
              ...(metrics.likes !== undefined ? { likes: String(metrics.likes) } : {}),
              ...(metrics.comments !== undefined ? { comments: String(metrics.comments) } : {}),
              ...(metrics.shares !== undefined ? { shares: String(metrics.shares) } : {})
            }
            return acc
          }, {})
          const hydratedVerifyResults = Object.entries(existingFeedback).reduce<Record<string, { verified: boolean; message: string; title?: string; verifying?: boolean }>>((acc, [platform, value]) => {
            const item = typeof value === 'object' && value ? value as Record<string, any> : {}
            const canonicalPlatform = canonicalizePlatform(platform)
            if (!canonicalPlatform) return acc
            if (item.verified || item.verifyMessage || item.verifyTitle || platformStatusMap?.[canonicalPlatform]?.status === 'verified') {
              acc[canonicalPlatform] = {
                verified: Boolean(item.verified || platformStatusMap?.[canonicalPlatform]?.status === 'verified'),
                message: item.verifyMessage || platformStatusMap?.[canonicalPlatform]?.message || '',
                title: item.verifyTitle,
                verifying: false
              }
            }
            return acc
          }, {})

          if (Object.keys(feedbackDraft).length > 0) {
            setFeedback(feedbackDraft)
          }
          if (Object.keys(hydratedVerifyResults).length > 0) {
            setVerifyResults(hydratedVerifyResults)
          }

          if (platforms.length > 0) {
            setPublishPlatforms(
              platforms.map((platform: string) => ({
                platform,
                status: platformStatusMap?.[platform]?.status || 'manual',
                message: platformStatusMap?.[platform]?.message
              }))
            )
          } else if (Object.keys(existingFeedback).length > 0) {
            setPublishPlatforms(
              Object.keys(existingFeedback).map((platform: string) => {
                const canonicalPlatform = canonicalizePlatform(platform)
                return {
                  platform: canonicalPlatform,
                  status: platformStatusMap?.[canonicalPlatform]?.status || 'submitted',
                  message: platformStatusMap?.[canonicalPlatform]?.message || '已提交发布反馈'
                }
              })
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
    // 清除该平台的验证结果（链接变了需要重新验证）
    if (verifyResults[platform]) {
      setVerifyResults(prev => {
        const next = { ...prev }
        delete next[platform]
        return next
      })
    }
  }

  const handleMetricChange = (
    platform: string,
    field: 'views' | 'likes' | 'comments' | 'shares',
    value: string
  ) => {
    const normalized = value.replace(/[^\d]/g, '')
    setFeedback(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        images: prev[platform]?.images || [],
        link: prev[platform]?.link || '',
        [field]: normalized
      }
    }))
  }

  // 是否需要验证
  const isVerifyRequired = (platform: string) => VERIFY_REQUIRED_PLATFORMS.includes(platform)

  // 验证发布内容
  const handleVerify = async (platform: string) => {
    const fb = feedback[platform]
    const postUrl = fb?.link
    if (!postUrl) {
      Taro.showToast({ title: '请先填写发布链接', icon: 'none' })
      return
    }

    // 提取关键词：从生成的文案标题和内容中提取
    const keywords: string[] = []
    if (generatedContent?.title) keywords.push(generatedContent.title)
    // 取内容前20字作为关键词
    if (generatedContent?.content) {
      const shortContent = generatedContent.content.replace(/[#*\n]/g, '').substring(0, 30).trim()
      if (shortContent) keywords.push(shortContent)
    }

    setVerifyResults(prev => ({
      ...prev,
      [platform]: { verified: false, message: '验证中...', verifying: true }
    }))

    try {
      const response = await Network.request({
        url: '/api/tikhub/verify-post',
        method: 'POST',
        data: { platform, postUrl, keywords }
      })

      const data = response.data
      if (data?.code === 200 && data?.data) {
        setVerifyResults(prev => ({
          ...prev,
          [platform]: {
            verified: data.data.verified,
            message: data.data.message,
            title: data.data.title,
            verifying: false
          }
        }))
      } else {
        setVerifyResults(prev => ({
          ...prev,
          [platform]: {
            verified: false,
            message: data?.message || '验证失败，请重试',
            verifying: false
          }
        }))
      }
    } catch (error) {
      setVerifyResults(prev => ({
        ...prev,
        [platform]: {
          verified: false,
          message: '网络异常，请重试',
          verifying: false
        }
      }))
    }
  }

  // 检查是否所有需要验证的平台都已通过
  const allVerified = () => {
    const requiredPlatforms = publishPlatforms
      .filter(p => isVerifyRequired(p.platform))
      .map(p => p.platform)
    if (requiredPlatforms.length === 0) return true
    return requiredPlatforms.every(p => verifyResults[p]?.verified)
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

    // 检查需要验证的平台是否都已通过验证
    if (!allVerified()) {
      Taro.showToast({ title: '请先完成发布验证', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const reqId = actualRequestId || requestId
      const payload = Object.entries(feedback).reduce<Record<string, any>>((acc, [platform, value]) => {
        const canonicalPlatform = canonicalizePlatform(platform)
        if (!canonicalPlatform) return acc
        const verifyResult = verifyResults[canonicalPlatform]
        const metrics = {
          ...(value.views ? { views: Number(value.views) } : {}),
          ...(value.likes ? { likes: Number(value.likes) } : {}),
          ...(value.comments ? { comments: Number(value.comments) } : {}),
          ...(value.shares ? { shares: Number(value.shares) } : {})
        }
        acc[canonicalPlatform] = {
          images: value.images || [],
          link: value.link || '',
          submittedAt: new Date().toISOString(),
          status: verifyResult?.verified ? 'verified' : 'submitted',
          verified: Boolean(verifyResult?.verified),
          ...(Object.keys(metrics).length > 0 ? { metrics } : {}),
          ...(verifyResult?.message ? { verifyMessage: verifyResult.message } : {}),
          ...(verifyResult?.title ? { verifyTitle: verifyResult.title } : {})
        }
        return acc
      }, {})
      const response = await Network.request({
        url: `/api/order-processing/feedback/${reqId}`,
        method: 'POST',
        data: { feedback: payload }
      })

      if (response.data?.code === 200) {
        Taro.showToast({ title: '反馈成功', icon: 'success', duration: 2000 })
        setTimeout(() => {
          void safeNavigateBack('/pages/order/order-list/index')
        }, 2000)
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
  const getPlatformColor = (platform: string) => {
    const meta = getPlatformMeta(platform)
    return meta ? { bg: meta.bgColor, text: meta.color } : { bg: '#F3F4F6', text: '#374151' }
  }

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
        {generatedContent.content && (() => {
          const shouldRenderMarkdown = contentType === 'article' || isArticlePlatform(currentPlatform)
          return shouldRenderMarkdown ? (
            <View className="preview-markdown-box">
              <MarkdownRenderer content={generatedContent.content} />
            </View>
          ) : (
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
          )
        })()}

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

    return (
      <View key={index} className="platform-card">
        {/* 卡片头部：平台名称 */}
        <View className="platform-card-header">
          <View className="platform-card-left">
            <View className="platform-dot" style={{ background: pc.text }} />
            <Text className="platform-card-name">{platformName}</Text>
          </View>
        </View>

        <View className="platform-card-body">
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
                  style={{ width: '100%', fontSize: '13px', lineHeight: '1.4', backgroundColor: 'transparent' }}
                  placeholder={isVerifyRequired(platform) ? '请输入发布链接（必填，用于验证）' : '请输入发布链接'}
                  value={fb.link}
                  onInput={(e) => handleLinkChange(platform, e.detail.value)}
                />
              </View>
            </View>
          </View>

          <View className="feedback-section">
            <Text className="feedback-label">互动数据</Text>
            <View className="metrics-grid">
              <View className="metric-input-card">
                <Text className="metric-input-label">浏览</Text>
                <View className="metric-input-shell">
                  <Input
                    style={{ width: '100%', fontSize: '13px', lineHeight: '1.4', backgroundColor: 'transparent' }}
                    type="number"
                    placeholder="0"
                    value={fb.views || ''}
                    onInput={(e) => handleMetricChange(platform, 'views', e.detail.value)}
                  />
                </View>
              </View>
              <View className="metric-input-card">
                <Text className="metric-input-label">点赞</Text>
                <View className="metric-input-shell">
                  <Input
                    style={{ width: '100%', fontSize: '13px', lineHeight: '1.4', backgroundColor: 'transparent' }}
                    type="number"
                    placeholder="0"
                    value={fb.likes || ''}
                    onInput={(e) => handleMetricChange(platform, 'likes', e.detail.value)}
                  />
                </View>
              </View>
              <View className="metric-input-card">
                <Text className="metric-input-label">评论</Text>
                <View className="metric-input-shell">
                  <Input
                    style={{ width: '100%', fontSize: '13px', lineHeight: '1.4', backgroundColor: 'transparent' }}
                    type="number"
                    placeholder="0"
                    value={fb.comments || ''}
                    onInput={(e) => handleMetricChange(platform, 'comments', e.detail.value)}
                  />
                </View>
              </View>
              <View className="metric-input-card">
                <Text className="metric-input-label">分享</Text>
                <View className="metric-input-shell">
                  <Input
                    style={{ width: '100%', fontSize: '13px', lineHeight: '1.4', backgroundColor: 'transparent' }}
                    type="number"
                    placeholder="0"
                    value={fb.shares || ''}
                    onInput={(e) => handleMetricChange(platform, 'shares', e.detail.value)}
                  />
                </View>
              </View>
            </View>
            <Text className="feedback-hint">可选填写，用于验收和统计聚合</Text>
          </View>

          {/* 发布验证（仅需要验证的平台） */}
          {isVerifyRequired(platform) && (
            <View className="feedback-section verify-section">
              <Text className="feedback-label">发布验证</Text>

              {/* 验证按钮 */}
              {!verifyResults[platform]?.verified && !verifyResults[platform]?.verifying && (
                <View
                  className={`verify-btn ${fb.link ? '' : 'disabled'}`}
                  onClick={fb.link ? () => handleVerify(platform) : undefined}
                >
                  <ShieldCheck size={14} color={fb.link ? '#6366F1' : '#9CA3AF'} />
                  <Text className="verify-btn-text" style={{ color: fb.link ? '#6366F1' : '#9CA3AF' }}>
                    验证发布
                  </Text>
                </View>
              )}

              {/* 验证中 */}
              {verifyResults[platform]?.verifying && (
                <View className="verify-status verifying">
                  <Loader size={14} color="#6366F1" />
                  <Text className="verify-status-text verifying-text">正在验证...</Text>
                </View>
              )}

              {/* 验证通过 */}
              {verifyResults[platform]?.verified && !verifyResults[platform]?.verifying && (
                <View className="verify-status verified">
                  <ShieldCheck size={14} color="#10B981" />
                  <Text className="verify-status-text verified-text">验证通过</Text>
                  {verifyResults[platform].title && (
                    <Text className="verify-detail">已识别: {verifyResults[platform].title}</Text>
                  )}
                </View>
              )}

              {/* 验证未通过 */}
              {!verifyResults[platform]?.verified && !verifyResults[platform]?.verifying && verifyResults[platform]?.message && (
                <View className="verify-status failed">
                  <ShieldAlert size={14} color="#EF4444" />
                  <Text className="verify-status-text failed-text">{verifyResults[platform].message}</Text>
                  <View className="verify-retry" onClick={() => handleVerify(platform)}>
                    <Text className="verify-retry-text">重新验证</Text>
                  </View>
                </View>
              )}

              {!verifyResults[platform] && (
                <Text className="verify-hint">需要验证发布内容与订单要求是否匹配</Text>
              )}
            </View>
          )}
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
          <View className="feedback-back-btn" onClick={() => { void safeNavigateBack('/pages/order/order-list/index') }}>
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
        {!allVerified() && publishPlatforms.some(p => isVerifyRequired(p.platform)) && (
          <Text className="feedback-verify-hint">请先完成发布验证再提交</Text>
        )}
        <View
          className={`feedback-submit-btn ${submitting ? 'disabled' : ''} ${!allVerified() ? 'disabled' : ''}`}
          onClick={submitting || !allVerified() ? undefined : handleSubmit}
        >
          <Send size={16} color="#fff" />
          <Text className="feedback-submit-text">{submitting ? '提交中...' : '提交反馈'}</Text>
        </View>
      </View>
    </View>
  )
}
