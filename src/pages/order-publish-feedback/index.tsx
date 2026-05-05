import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Image as ImageIcon, Video, FileText, Eye, CircleCheck, Plus, X } from 'lucide-react-taro'
import './index.css'

const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_channel: '视频号',
  wechat_moments: '朋友圈',
  weibo: '微博',
  xiaohongshu: '小红书',
  douyin: '抖音',
  zhihu: '知乎',
  bilibili: '哔哩哔哩',
  toutiao: '今日头条',
  kuaishou: '快手',
  other: '其他平台'
}

const CONTENT_TYPE_NAMES: Record<string, string> = {
  image: '图片',
  video: '视频',
  article: '文章',
 图文: '图文',
  短视频: '短视频'
}

interface GeneratedContent {
  title?: string
  content?: string
  images?: string[]
  videos?: string[]
  platforms?: string[]
  script?: string
  cover_image?: string
}

interface PublishPlatform {
  platform: string
  status: string
  message?: string
}

export default function OrderPublishFeedback() {
  const router = useRouter()
  const { requestId, orderId } = router.params

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [publishPlatforms, setPublishPlatforms] = useState<PublishPlatform[]>([])
  const [feedback, setFeedback] = useState<Record<string, { images: string[]; link: string }>>({})
  const [contentType, setContentType] = useState<string>('')
  const [currentPlatform, setCurrentPlatform] = useState<string>('')

  useLoad(() => {
    console.log('[OrderPublishFeedback] 页面加载，params:', { requestId, orderId })
    loadOrderData()
  })

  const loadOrderData = async () => {
    try {
      console.log('[OrderPublishFeedback] 开始加载订单数据')
      const response = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderPublishFeedback] 订单数据响应:', response.data)

      if (response.data?.code === 200) {
        const data = response.data.data
        setGeneratedContent(data.generatedContent)
        setContentType(data.contentType || 'image')
        setCurrentPlatform(data.generatedContent?.platforms?.[0] || '')

        // 获取发布结果
        const platforms = data.publishStatus?.platforms || data.publish_status?.platforms || []

        if (platforms.length > 0) {
          setPublishPlatforms(platforms)
        } else {
          // 根据生成内容的平台创建待发布的平台列表
          if (data.generatedContent?.platforms) {
            const pendingPlatforms = data.generatedContent.platforms.map((p: string) => ({
              platform: p,
              status: 'manual',
              message: '需要手动发布'
            }))
            setPublishPlatforms(pendingPlatforms)
          }
        }
      } else {
        Taro.showToast({
          title: response.data?.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderPublishFeedback] 加载订单数据失败:', error)
      Taro.showToast({
        title: '网络异常',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 图片预览（使用 Taro.previewImage API，支持多图切换）
  const handlePreviewImage = (urls: string[], current: string) => {
    Taro.previewImage({
      urls: urls,
      current: current
    })
  }

  const handleChooseImage = async (platform: string) => {
    try {
      const res = await Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      
      console.log('[OrderPublishFeedback] 选择图片:', res.tempFilePaths)
      
      Taro.showLoading({ title: '上传中...', mask: true })
      
      const uploadPromises = res.tempFilePaths.map(filePath => 
        Network.uploadFile({
          url: '/api/upload/image',
          filePath,
          name: 'file'
        })
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
        Taro.showToast({
          title: `上传成功${uploadedUrls.length}张`,
          icon: 'success'
        })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('[OrderPublishFeedback] 上传图片失败:', error)
      Taro.showToast({
        title: '上传失败，请重试',
        icon: 'none'
      })
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
      Taro.showToast({
        title: '请至少为一个平台填写反馈',
        icon: 'none'
      })
      return
    }

    const hasInvalid = platforms.some(platform => {
      const fb = feedback[platform]
      const hasImages = fb.images && fb.images.length > 0
      return !hasImages && !fb.link
    })

    if (hasInvalid) {
      Taro.showToast({
        title: '请填写截图或链接',
        icon: 'none'
      })
      return
    }

    setSubmitting(true)

    try {
      console.log('[OrderPublishFeedback] 开始提交反馈')
      const response = await Network.request({
        url: `/api/order-processing/feedback/${requestId}`,
        method: 'POST',
        data: {
          feedback
        }
      })

      console.log('[OrderPublishFeedback] 提交反馈响应:', response.data)

      if (response.data?.code === 200) {
        Taro.showToast({
          title: '反馈成功',
          icon: 'success',
          duration: 2000
        })

        setTimeout(() => {
          navigateBack()
        }, 2000)
      } else {
        Taro.showToast({
          title: response.data?.message || '提交失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderPublishFeedback] 提交反馈失败:', error)
      Taro.showToast({
        title: '网络异常，请重试',
        icon: 'none'
      })
    } finally {
      setSubmitting(false)
    }
  }

  // 渲染内容类型标签
  const renderContentTypeBadge = (type: string) => {
    const icons: Record<string, any> = {
      image: <ImageIcon size={12} color="#666" />,
      video: <Video size={12} color="#666" />,
      article: <FileText size={12} color="#666" />,
      图文: <ImageIcon size={12} color="#666" />,
      短视频: <Video size={12} color="#666" />
    }
    return (
      <View className="content-type-badge">
        {icons[type] || <FileText size={12} color="#666" />}
        <Text className="block ml-1">{CONTENT_TYPE_NAMES[type] || type}</Text>
      </View>
    )
  }

  // 渲染平台标签
  const renderPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      xiaohongshu: 'platform-xiaohongshu',
      douyin: 'platform-douyin',
      wechat_mp: 'platform-wechat',
      wechat_moments: 'platform-wechat',
      weibo: 'platform-weibo',
      bilibili: 'platform-bilibili',
      zhihu: 'platform-zhihu'
    }
    return (
      <View className={`platform-badge ${colors[platform] || 'platform-default'}`}>
        <Text className="block">{PLATFORM_NAMES[platform] || platform}</Text>
      </View>
    )
  }

  // 渲染图片内容（朋友圈、小红书图文）
  const renderImageContent = () => {
    if (!generatedContent?.images || generatedContent.images.length === 0) {
      return (
        <View className="empty-content">
          <ImageIcon size={48} color="#d1d5db" />
          <Text className="block text-gray-400 mt-2">暂无生成图片</Text>
        </View>
      )
    }

    const images = generatedContent.images || []
    
    // 小红书风格：左侧大图 + 右侧小图列表
    if (currentPlatform === 'xiaohongshu') {
      return (
        <View className="image-gallery">
          <View className="xhs-layout">
            {/* 左侧大图 */}
            <View className="xhs-main-image" onClick={() => {
              if (images[0]) {
                handlePreviewImage(images, images[0])
              }
            }}
            >
              <Image
                src={images[0]}
                className="xhs-main-img"
                mode="aspectFill"
              />
              {images.length > 1 && (
                <View className="xhs-more-badge">
                  <Text className="block text-white text-xs">+{images.length - 1}</Text>
                </View>
              )}
            </View>
            {/* 右侧缩略图列表 */}
            {images.length > 1 && (
              <View className="xhs-thumb-list">
                {images.slice(1, 4).map((img, index) => (
                  <View 
                    key={index}
                    className="xhs-thumb-item"
                    onClick={() => {
                      handlePreviewImage(images, img)
                    }}
                  >
                    <Image
                      src={img}
                      className="xhs-thumb-img"
                      mode="aspectFill"
                    />
                    {images.length > 4 && index === 2 && (
                      <View className="xhs-more-overlay">
                        <Text className="block text-white text-xs font-medium">+{images.length - 4}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
          
          {/* 文案内容 */}
          {generatedContent?.content && (
            <View className="xhs-caption">
              <Text className="block text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                {generatedContent.content}
              </Text>
            </View>
          )}
        </View>
      )
    }

    // 普通图片布局：网格展示
    return (
      <View className="image-gallery">
        <View className="flex justify-between items-center mb-3">
          <Text className="block text-base font-medium text-gray-700">生成图片 ({images.length}张)</Text>
        </View>
        <View className="image-grid">
          {images.map((img, index) => (
            <View 
              key={index} 
              className="image-item"
              onClick={() => {
                handlePreviewImage(images, img)
              }}
            >
              <Image
                src={img}
                className="image-thumbnail"
                mode="aspectFill"
              />
              <View className="image-overlay">
                <Eye size={20} color="#fff" />
              </View>
            </View>
          ))}
        </View>
        {generatedContent?.content && (
          <View className="mt-3 p-3 bg-gray-50 rounded-lg">
            <Text className="block text-gray-700 text-sm whitespace-pre-wrap">
              {generatedContent.content}
            </Text>
          </View>
        )}
        <Text className="block text-xs text-gray-500 mt-2">点击图片可预览大图</Text>
      </View>
    )
  }

  // 渲染视频内容（抖音、B站视频）
  const renderVideoContent = () => {
    return (
      <View className="video-content">
        <View className="flex items-center space-x-2 mb-3">
          <Video size={20} color="#1677ff" />
          <Text className="block text-base font-medium text-gray-700">视频内容</Text>
        </View>
        <View className="video-placeholder">
          <Video size={48} color="#d1d5db" />
          <Text className="block text-gray-400 mt-2">视频预览区域</Text>
        </View>
      </View>
    )
  }

  // 渲染文章内容（公众号、知乎文章）
  const renderArticleContent = () => {
    return (
      <View className="article-content">
        {generatedContent?.title && (
          <Text className="block text-lg font-bold text-gray-900 mb-3">
            {generatedContent.title}
          </Text>
        )}
        <View className="article-text">
          <Text className="block text-gray-700 whitespace-pre-wrap leading-relaxed">
            {generatedContent?.content || ''}
          </Text>
        </View>
      </View>
    )
  }

  // 根据内容类型和平台渲染内容
  const renderContentByType = () => {
    const platform = currentPlatform
    const type = contentType

    // 小红书图文/朋友圈图片
    if (platform === 'xiaohongshu' || platform === 'wechat_moments' || type === 'image' || type === '图文') {
      return renderImageContent()
    }
    
    // 抖音/B站视频
    if (platform === 'douyin' || platform === 'bilibili' || type === 'video' || type === '短视频') {
      return renderVideoContent()
    }
    
    // 公众号/知乎文章
    if (platform === 'wechat_mp' || platform === 'zhihu' || type === 'article') {
      return renderArticleContent()
    }

    // 默认：同时显示图片和文章
    return (
      <View className="content-mixed">
        {generatedContent?.images && generatedContent.images.length > 0 && (
          <View className="mb-4">{renderImageContent()}</View>
        )}
        {renderArticleContent()}
      </View>
    )
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-full bg-gray-50">
        <View className="text-center">
          <View className="loading-spinner" />
          <Text className="block text-gray-500 mt-3">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="order-publish-feedback-page bg-gray-50 min-h-screen pb-24">
      {/* 顶部导航 */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex items-center sticky top-0 z-10">
        <View onClick={() => navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={22} color="#333" />
        </View>
        <Text className="block flex-1 text-center text-lg font-semibold mr-8">
          发布反馈
        </Text>
      </View>

      <View className="p-4 space-y-4">
        {/* 内容概览卡片 */}
        {generatedContent && (
          <Card className="content-overview-card">
            <CardHeader className="pb-3">
              <View className="flex items-center justify-between">
                <CardTitle className="text-base">生成内容概览</CardTitle>
                <View className="flex items-center space-x-2">
                  {currentPlatform && renderPlatformBadge(currentPlatform)}
                  {renderContentTypeBadge(contentType)}
                </View>
              </View>
            </CardHeader>
            <CardContent>
              {renderContentByType()}
            </CardContent>
          </Card>
        )}

        {/* 平台反馈列表 */}
        <View className="space-y-3">
          <Text className="block text-base font-semibold text-gray-900 px-1">
            发布平台反馈
          </Text>

          {publishPlatforms.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Text className="block text-gray-500">暂无发布平台</Text>
              </CardContent>
            </Card>
          ) : (
            publishPlatforms.map((result: PublishPlatform, index: number) => {
              const platform = result.platform
              const platformName = PLATFORM_NAMES[platform] || platform
              const fb = feedback[platform] || { images: [], link: '' }

              return (
                <Card key={index} className="platform-card">
                  <CardContent className="p-4 space-y-4">
                    {/* 平台名称和状态 */}
                    <View className="flex items-center justify-between">
                      <View className="flex items-center space-x-2">
                        {renderPlatformBadge(platform)}
                        <Text className="block text-base font-medium">{platformName}</Text>
                      </View>
                      <View className={`status-badge ${result.status === 'success' ? 'status-success' : 'status-pending'}`}>
                        {result.status === 'success' ? (
                          <>
                            <CircleCheck size={12} color="#10b981" />
                            <Text className="block ml-1">已发布</Text>
                          </>
                        ) : (
                          <Text className="block">待发布</Text>
                        )}
                      </View>
                    </View>

                    {/* 发布说明 */}
                    {result.message && (
                      <View className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <Text className="block text-xs text-amber-800">{result.message}</Text>
                      </View>
                    )}

                    {/* 上传截图 */}
                    <View className="space-y-2">
                      <Label className="text-sm text-gray-700 font-medium">发布截图</Label>
                      <View className="flex flex-wrap gap-2">
                        {/* 已上传的图片列表 */}
                        {fb.images && fb.images.length > 0 && fb.images.map((img: string, idx: number) => (
                          <View key={idx} className="relative" style={{ width: '30%' }}>
                            <Image
                              src={img}
                              className="w-full h-20 rounded-lg object-cover"
                              mode="aspectFill"
                              onClick={() => Taro.previewImage({ urls: fb.images, current: img })}
                            />
                            <View
                              className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center"
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
                              <X size={12} color="#fff" />
                            </View>
                          </View>
                        ))}
                        
                        {/* 添加更多图片按钮 */}
                        {(!fb.images || fb.images.length < 9) && (
                          <View
                            className="upload-area"
                            style={{ width: '30%', height: 80 }}
                            onClick={() => handleChooseImage(platform)}
                          >
                            <Plus size={24} color="#9ca3af" />
                          </View>
                        )}
                      </View>
                      {(!fb.images || fb.images.length === 0) && (
                        <Text className="block text-gray-400 text-xs mt-1">点击上传发布截图，最多9张</Text>
                      )}
                    </View>

                    {/* 填写链接 */}
                    <View className="space-y-2">
                      <Label className="text-sm text-gray-700 font-medium">发布链接</Label>
                      <View className="bg-gray-50 rounded-xl px-4 py-3">
                        <Input
                          className="w-full bg-transparent text-sm"
                          placeholder="请输入发布链接"
                          value={fb.link}
                          onInput={(e) => handleLinkChange(platform, e.detail.value)}
                        />
                      </View>
                    </View>
                  </CardContent>
                </Card>
              )
            })
          )}
        </View>
      </View>

      {/* 固定底部提交按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
        <Button
          className="w-full submit-button"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '提交中...' : '提交反馈'}
        </Button>
      </View>
    </View>
  )
}
