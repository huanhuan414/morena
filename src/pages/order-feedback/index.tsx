import { useLoad, useRouter, navigateBack, showToast, showModal, chooseImage } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import { TrendingUp, Heart, MessageCircle, Share2, Send, Upload, FileText, Image as ImageIcon, Check, Sparkles, X } from 'lucide-react-taro'
import './index.css'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信小程序',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

// 获取平台中文名称
const getPlatformNames = (platforms?: string[]): string => {
  if (!platforms || platforms.length === 0) return '全平台'
  return platforms.map(p => PLATFORM_NAMES[p] || p).join('、')
}

export default function OrderFeedbackPage() {
  const router = useRouter()
  const { orderId, avatarId } = router.params

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)
  const [avatarData, setAvatarData] = useState<any>(null)
  const [generatedContents, setGeneratedContents] = useState<any[]>([])
  const [selectedContent, setSelectedContent] = useState<any>(null)

  // 效果数据
  const [exposure, setExposure] = useState('')
  const [likes, setLikes] = useState('')
  const [comments, setComments] = useState('')
  const [shares, setShares] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [description, setDescription] = useState('')

  // 图片上传
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  useLoad(() => {
    if (orderId && avatarId) {
      fetchOrderData()
      fetchAvatarData()
      fetchGeneratedContent()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchOrderData = async () => {
    try {
      const res = await Network.request({ url: `/api/order/${orderId}` })
      if (res.data?.code === 200) {
        setOrderData(res.data.data)
      }
    } catch (error) {
      console.error('获取订单数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvatarData = async () => {
    try {
      const res = await Network.request({ url: `/api/avatars/${avatarId}` })
      if (res.data?.code === 200) {
        setAvatarData(res.data.data)
      }
    } catch (error) {
      console.error('获取分身数据失败:', error)
    }
  }

  const fetchGeneratedContent = async () => {
    try {
      // 先获取分配请求ID
      const dispatchRes = await Network.request({
        url: `/api/order-dispatch/order/${orderId}/avatar/${avatarId}`
      })

      if (dispatchRes.data?.code === 200 && dispatchRes.data.data?.request_id) {
        const requestId = dispatchRes.data.data.request_id

        // 获取生成内容
        const contentRes = await Network.request({
          url: `/api/content-generation/request/${requestId}/avatar/${avatarId}`
        })

        if (contentRes.data?.code === 200) {
          setGeneratedContents(contentRes.data.data || [])
          if (contentRes.data.data && contentRes.data.data.length > 0) {
            setSelectedContent(contentRes.data.data[0])
          }
        }
      }
    } catch (error) {
      console.error('获取生成内容失败:', error)
    }
  }

  const handleChooseImage = () => {
    chooseImage({
      count: 9 - uploadedImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePaths = res.tempFilePaths
        setUploading(true)

        try {
          for (const filePath of tempFilePaths) {
            await uploadImage(filePath)
          }
          showToast({ title: '上传成功', icon: 'success' })
        } catch (error) {
          console.error('上传失败:', error)
          showToast({ title: '上传失败', icon: 'none' })
        } finally {
          setUploading(false)
        }
      }
    })
  }

  const uploadImage = async (filePath: string) => {
    const res: any = await Network.uploadFile({
      url: '/api/upload/order-screenshot',
      filePath,
      name: 'file'
    })

    const data = typeof res === 'string' ? JSON.parse(res) : res
    if (data?.code === 200) {
      setUploadedImages(prev => [...prev, data.data.url])
    } else {
      throw new Error(data?.message || '上传失败')
    }
  }

  const handleDeleteImage = (index: number) => {
    showModal({
      title: '删除图片',
      content: '确定删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          setUploadedImages(prev => prev.filter((_, i) => i !== index))
        }
      }
    })
  }

  const handleSubmit = async () => {
    // 验证必填字段
    if (!exposure || !likes) {
      showToast({ title: '请填写曝光量和点赞数', icon: 'none' })
      return
    }

    showModal({
      title: '提交效果数据',
      content: '确定提交效果数据吗？提交后订单将标记为已完成。',
      success: async (res) => {
        if (res.confirm) {
          setSubmitting(true)
          try {
            const result = await Network.request({
              url: `/api/order-results`,
              method: 'POST',
              data: {
                order_id: orderId,
                avatar_id: avatarId,
                exposure: parseInt(exposure),
                likes: parseInt(likes),
                comments: parseInt(comments || '0'),
                shares: parseInt(shares || '0'),
                link_url: linkUrl,
                description: description,
                screenshots: uploadedImages // 添加上传的图片URL
              }
            })

            if (result.data?.code === 200) {
              showToast({ title: '提交成功', icon: 'success' })
              // 更新订单状态为已完成
              await updateOrderStatus()
              setTimeout(() => {
                navigateBack()
              }, 1500)
            } else {
              showToast({ title: result.data?.message || '提交失败', icon: 'none' })
            }
          } catch (error) {
            console.error('提交失败:', error)
            showToast({ title: '提交失败', icon: 'none' })
          } finally {
            setSubmitting(false)
          }
        }
      }
    })
  }

  const updateOrderStatus = async () => {
    try {
      await Network.request({
        url: `/api/order/${orderId}/status`,
        method: 'PUT',
        data: { status: 'completed' }
      })
    } catch (error) {
      console.error('更新订单状态失败:', error)
    }
  }

  if (loading) {
    return (
      <View className="order-feedback-page">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="order-feedback-page">
      <ScrollView className="page-scroll" scrollY>
        {/* 订单信息 */}
        {orderData && (
          <View className="info-card">
            <View className="card-header">
              <Text className="card-title">订单信息</Text>
              <FileText size={18} color="#00f5ff" />
            </View>
            <View className="order-info">
              <Text className="order-title">{orderData.title}</Text>
              <Text className="order-platform">
                平台：{getPlatformNames(orderData.platforms)}
              </Text>
            </View>
          </View>
        )}

        {/* AI生成内容 */}
        {generatedContents.length > 0 && (
          <View className="generated-content-card">
            <View className="card-header">
              <Text className="card-title">AI生成内容</Text>
              <Sparkles size={18} color="#f59e0b" />
            </View>

            {/* 平台标签 */}
            <View className="platform-tabs">
              {generatedContents.map((content) => (
                <View
                  key={content.id}
                  className={`platform-tab ${selectedContent?.id === content.id ? 'active' : ''}`}
                  onClick={() => setSelectedContent(content)}
                >
                  <Text className="platform-tab-text">
                    {PLATFORM_NAMES[content.platform] || content.platform}
                  </Text>
                  {content.status === 'approved' && (
                    <Check size={12} color="#22c55e" />
                  )}
                </View>
              ))}
            </View>

            {/* 内容详情 */}
            {selectedContent && (
              <View className="content-detail">
                {selectedContent.title && (
                  <View className="content-title">
                    <Text className="title-text">{selectedContent.title}</Text>
                  </View>
                )}

                <View className="content-body">
                  <Text className="body-text">{selectedContent.content}</Text>
                </View>

                {selectedContent.hashtags && selectedContent.hashtags.length > 0 && (
                  <View className="content-hashtags">
                    {selectedContent.hashtags.map((tag: string, idx: number) => (
                      <Text key={idx} className="hashtag-text">{tag}</Text>
                    ))}
                  </View>
                )}

                {selectedContent.image_suggestions && selectedContent.image_suggestions.length > 0 && (
                  <View className="content-suggestions">
                    <Text className="suggestions-label">图片建议：</Text>
                    {selectedContent.image_suggestions.map((suggestion: string, idx: number) => (
                      <Text key={idx} className="suggestion-text">• {suggestion}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* 分身信息 */}
        {avatarData && (
          <View className="info-card">
            <View className="card-header">
              <Text className="card-title">执行分身</Text>
              <Check size={18} color="#22c55e" />
            </View>
            <View className="avatar-info">
              <Text className="avatar-name">{avatarData.name}</Text>
              <Text className="avatar-level">Lv.{avatarData.level}</Text>
            </View>
          </View>
        )}

        {/* 提示信息 */}
        <View className="tips-card">
          <Check size={16} color="#f59e0b" />
          <Text className="tips-text">
            请填写真实的发布效果数据，这将影响您后续的订单推荐和收益结算。
          </Text>
        </View>

        {/* 效果数据表单 */}
        <View className="form-card">
          <View className="card-header">
            <Text className="card-title">效果数据</Text>
            <TrendingUp size={18} color="#22c55e" />
          </View>

          {/* 图片上传 */}
          <View className="form-group">
            <Text className="form-label">
              <ImageIcon size={16} color="#22c55e" />
              发布截图（选填）
            </Text>
            <View className="image-upload-container">
              {uploadedImages.map((imageUrl, index) => (
                <View key={index} className="uploaded-image">
                  <Image
                    src={imageUrl}
                    className="upload-image"
                    mode="aspectFill"
                  />
                  <View className="delete-image" onClick={() => handleDeleteImage(index)}>
                    <X size={14} color="#fff" />
                  </View>
                </View>
              ))}
              {uploadedImages.length < 9 && (
                <View className="upload-placeholder" onClick={handleChooseImage}>
                  {uploading ? (
                    <Text className="upload-placeholder-text">上传中...</Text>
                  ) : (
                    <>
                      <Upload size={32} color="rgba(255,255,255,0.4)" />
                      <Text className="upload-placeholder-text">上传截图</Text>
                    </>
                  )}
                </View>
              )}
            </View>
            <Text className="upload-tip">最多上传9张图片，支持jpg/png格式</Text>
          </View>

          <View className="form-group">
            <Text className="form-label">
              <TrendingUp size={16} color="#00f5ff" />
              曝光量（必填）
            </Text>
            <Input
              className="form-input"
              type="number"
              placeholder="输入曝光量"
              value={exposure}
              onInput={(e: any) => setExposure(e.detail.value)}
            />
          </View>

          <View className="form-group">
            <Text className="form-label">
              <Heart size={16} color="#ef4444" />
              点赞数（必填）
            </Text>
            <Input
              className="form-input"
              type="number"
              placeholder="输入点赞数"
              value={likes}
              onInput={(e: any) => setLikes(e.detail.value)}
            />
          </View>

          <View className="form-group">
            <Text className="form-label">
              <MessageCircle size={16} color="#3b82f6" />
              评论数（选填）
            </Text>
            <Input
              className="form-input"
              type="number"
              placeholder="输入评论数"
              value={comments}
              onInput={(e: any) => setComments(e.detail.value)}
            />
          </View>

          <View className="form-group">
            <Text className="form-label">
              <Share2 size={16} color="#8b5cf6" />
              分享数（选填）
            </Text>
            <Input
              className="form-input"
              type="number"
              placeholder="输入分享数"
              value={shares}
              onInput={(e: any) => setShares(e.detail.value)}
            />
          </View>

          <View className="form-group">
            <Text className="form-label">
              <Upload size={16} color="#22c55e" />
              发布链接（选填）
            </Text>
            <Input
              className="form-input"
              placeholder="输入发布链接"
              value={linkUrl}
              onInput={(e: any) => setLinkUrl(e.detail.value)}
            />
          </View>

          <View className="form-group">
            <Text className="form-label">
              <FileText size={16} color="#f59e0b" />
              备注说明（选填）
            </Text>
            <Textarea
              className="form-textarea"
              placeholder="输入备注说明"
              value={description}
              onInput={(e: any) => setDescription(e.detail.value)}
              maxlength={500}
            />
          </View>
        </View>

        {/* 上传截图提示 */}
        <View className="upload-hint">
          <ImageIcon size={16} color="#00f5ff" />
          <Text className="hint-text">
            建议上传发布截图作为凭证，系统将优先审核带凭证的数据
          </Text>
        </View>
      </ScrollView>

      {/* 底部提交按钮 */}
      <View className="bottom-actions">
        <Button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <Text className="btn-text">提交中...</Text>
          ) : (
            <>
              <Send size={18} color="#fff" />
              <Text className="btn-text">提交效果数据</Text>
            </>
          )}
        </Button>
      </View>
    </View>
  )
}
