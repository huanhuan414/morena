import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, Image as ImageIcon, Video, FileText, LayoutGrid,
  ExternalLink, Send, Check, Clock, MessageCircle
} from 'lucide-react-taro'
import './index.css'

// 内容类型映射
const CONTENT_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  image: { label: '图文', icon: ImageIcon, color: 'bg-pink-500' },
  video: { label: '视频', icon: Video, color: 'bg-purple-500' },
  article: { label: '文章', icon: FileText, color: 'bg-blue-500' },
  graphic: { label: '图文帖子', icon: LayoutGrid, color: 'bg-orange-500' }
}

// 平台映射
const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  xiaohongshu: { label: '小红书', color: 'text-red-500' },
  douyin: { label: '抖音', color: 'text-pink-500' },
  wechat_moments: { label: '微信朋友圈', color: 'text-green-500' },
  wechat_official: { label: '微信公众号', color: 'text-blue-500' }
}

interface PublishFeedbackData {
  requestId: string
  orderId: string
  avatarId: string
  avatarName: string
  avatarAvatar: string
  status: string
  issuerId: string
  contentUrl?: string
  contentText?: string
  contentType?: string
  targetPlatform?: string
  feedbackLink?: string
  feedbackScreenshot?: string
  feedbackText?: string
  feedbackSubmittedAt?: string
  publishedAt?: string
}

export default function OrderPublishFeedback() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PublishFeedbackData | null>(null)
  const [issuerId, setIssuerId] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [feedbackLink, setFeedbackLink] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [previewImage, setPreviewImage] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const router = useRouter()
  const requestId = router.params.requestId || ''
  const orderId = router.params.orderId || ''

  useLoad(() => {
    // 获取当前用户ID
    const userInfo = Taro.getStorageSync('userInfo')
    if (userInfo?.id) {
      setCurrentUserId(userInfo.id)
    }
    
    // 获取数据
    fetchData()
  })

  const fetchData = async () => {
    if (!requestId) return
    
    try {
      setLoading(true)
      
      const res = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })
      
      console.log('发布反馈页面数据:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const statusData = res.data.data
        setIssuerId(statusData.issuerId || '')
        
        setData({
          requestId: statusData.requestId,
          orderId: orderId || statusData.orderId,
          avatarId: statusData.avatarId,
          avatarName: statusData.avatarName,
          avatarAvatar: statusData.avatarAvatar,
          status: statusData.status,
          issuerId: statusData.issuerId,
          contentUrl: statusData.contentUrl,
          contentText: statusData.contentText,
          contentType: statusData.contentType,
          targetPlatform: statusData.targetPlatform,
          feedbackLink: statusData.feedbackLink,
          feedbackScreenshot: statusData.feedbackScreenshot,
          feedbackText: statusData.feedbackText,
          feedbackSubmittedAt: statusData.feedbackSubmittedAt,
          publishedAt: statusData.publishedAt
        })
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 判断是否为发单者
  const isIssuer = currentUserId === issuerId

  // 待反馈状态：published
  const isPendingFeedback = data?.status === 'published'
  // 已提交反馈状态：feedback_submitted, awaiting_acceptance
  const isFeedbackSubmitted = ['feedback_submitted', 'awaiting_acceptance'].includes(data?.status || '')
  // 已完成状态
  const isCompleted = data?.status === 'completed'

  // 平台信息
  const platform = data?.targetPlatform ? PLATFORM_MAP[data.targetPlatform] : null
  // 内容类型信息
  const contentType = data?.contentType ? CONTENT_TYPE_MAP[data.contentType] : null

  // 提交反馈
  const handleSubmitFeedback = async () => {
    if (!feedbackLink.trim()) {
      Taro.showToast({ title: '请输入发布链接', icon: 'none' })
      return
    }
    
    try {
      setSubmitting(true)
      const res = await Network.request({
        url: `/api/order-processing/feedback/${requestId}`,
        method: 'POST',
        data: {
          feedbackLink: feedbackLink.trim(),
          feedbackText: feedbackText.trim()
        }
      })
      
      if (res.data?.code === 200) {
        Taro.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '提交失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  // 验收通过
  const handleAccept = async () => {
    try {
      setAccepting(true)
      const res = await Network.request({
        url: `/api/order-processing/accept/${requestId}`,
        method: 'POST'
      })
      
      if (res.data?.code === 200) {
        Taro.showToast({ title: '验收通过', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '验收失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '验收失败', icon: 'none' })
    } finally {
      setAccepting(false)
    }
  }

  // 催促反馈
  const handleUrge = async () => {
    Taro.showToast({ title: '已发送催促', icon: 'success' })
  }

  // 预览图片
  const handlePreviewImage = (url: string) => {
    setPreviewImage(url)
    setPreviewVisible(true)
  }

  if (loading) {
    return (
      <View className="feedback-page">
        <View className="feedback-header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="header-title block">发布反馈</Text>
          <View style={{ width: 40 }} />
        </View>
        <View className="feedback-content">
          <View className="loading-card">
            <Text className="block text-gray-500 text-center py-10">加载中...</Text>
          </View>
        </View>
      </View>
    )
  }

  if (!data) {
    return (
      <View className="feedback-page">
        <View className="feedback-header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="header-title block">发布反馈</Text>
          <View style={{ width: 40 }} />
        </View>
        <View className="feedback-content">
          <View className="feedback-empty">
            <Text className="block text-gray-500">数据加载失败</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="feedback-page">
      {/* 顶部导航 */}
      <View className="feedback-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="#fff" />
        </View>
        <Text className="header-title block">发布反馈</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView scrollY className="feedback-scroll">
        <View className="feedback-content">
          {/* 分身信息卡片 */}
          <Card className="avatar-card">
            <CardContent className="p-4">
              <View className="flex items-center gap-3">
                <Image
                  src={data.avatarAvatar || 'https://via.placeholder.com/80'}
                  className="avatar-image"
                />
                <View className="flex-1">
                  <Text className="block text-base font-medium">{data.avatarName}</Text>
                  <View className="flex items-center gap-2 mt-1">
                    {platform && (
                      <Badge variant="outline" className={`text-xs ${platform.color}`}>
                        {platform.label}
                      </Badge>
                    )}
                    {contentType && (
                      <Badge variant="secondary" className="text-xs">
                        {contentType.label}
                      </Badge>
                    )}
                  </View>
                </View>
                <Badge 
                  variant={isPendingFeedback ? 'warning' : isFeedbackSubmitted ? 'success' : 'default'}
                  className="status-badge"
                >
                  {isPendingFeedback ? '待反馈' : isFeedbackSubmitted ? '已提交' : isCompleted ? '已完成' : data.status}
                </Badge>
              </View>
            </CardContent>
          </Card>

          {/* 发单者视角 - 待反馈 */}
          {isIssuer && isPendingFeedback && (
            <View className="issuer-pending-section">
              <View className="section-title">
                <Clock size={18} color="#eab308" />
                <Text className="block text-sm text-yellow-600 ml-2">等待分身提交反馈</Text>
              </View>
              
              {/* 分身发布的内容 */}
              {data.contentUrl || data.contentText ? (
                <Card className="content-card mt-4">
                  <CardContent className="p-4">
                    <Text className="section-label block text-xs text-gray-500 mb-3">分身已发布的内容</Text>
                    
                    {data.contentUrl && (
                      <View 
                        className="content-preview-image"
                        onClick={() => handlePreviewImage(data.contentUrl!)}
                      >
                        <Image
                          src={data.contentUrl}
                          mode="aspectFill"
                          className="preview-img"
                        />
                        <View className="preview-mask">
                          <Text className="block text-white text-xs">点击预览</Text>
                        </View>
                      </View>
                    )}
                    
                    {data.contentText && (
                      <Text className="block text-sm text-gray-700 mt-3 leading-relaxed">
                        {data.contentText}
                      </Text>
                    )}
                    
                    {data.publishedAt && (
                      <Text className="block text-xs text-gray-400 mt-3">
                        发布时间: {new Date(data.publishedAt).toLocaleString()}
                      </Text>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="content-card mt-4">
                  <CardContent className="p-6 text-center">
                    <Clock size={48} color="#d1d5db" className="mx-auto mb-3" />
                    <Text className="block text-gray-500">分身尚未发布内容</Text>
                  </CardContent>
                </Card>
              )}
              
              {/* 催促按钮 */}
              <View className="action-section mt-4">
                <Button 
                  className="w-full bg-yellow-500 text-white"
                  onClick={handleUrge}
                >
                  <MessageCircle size={16} color="#fff" className="mr-2" />
                  催促分身反馈
                </Button>
              </View>
            </View>
          )}

          {/* 发单者视角 - 已提交反馈 */}
          {isIssuer && isFeedbackSubmitted && (
            <View className="issuer-submitted-section">
              <View className="section-title">
                <Check size={18} color="#22c55e" />
                <Text className="block text-sm text-green-600 ml-2">分身已提交反馈</Text>
              </View>
              
              {/* 分身发布的内容 */}
              {data.contentUrl || data.contentText ? (
                <Card className="content-card mt-4">
                  <CardContent className="p-4">
                    <Text className="section-label block text-xs text-gray-500 mb-3">分身发布的内容</Text>
                    
                    {data.contentUrl && (
                      <View 
                        className="content-preview-image"
                        onClick={() => handlePreviewImage(data.contentUrl!)}
                      >
                        <Image
                          src={data.contentUrl}
                          mode="aspectFill"
                          className="preview-img"
                        />
                        <View className="preview-mask">
                          <Text className="block text-white text-xs">点击预览</Text>
                        </View>
                      </View>
                    )}
                    
                    {data.contentText && (
                      <Text className="block text-sm text-gray-700 mt-3 leading-relaxed">
                        {data.contentText}
                      </Text>
                    )}
                  </CardContent>
                </Card>
              ) : null}
              
              {/* 分身反馈的内容 */}
              <Card className="feedback-card mt-4">
                <CardContent className="p-4">
                  <Text className="section-label block text-xs text-gray-500 mb-3">分身反馈内容</Text>
                  
                  {data.feedbackScreenshot && (
                    <View 
                      className="content-preview-image"
                      onClick={() => handlePreviewImage(data.feedbackScreenshot!)}
                    >
                      <Image
                        src={data.feedbackScreenshot}
                        mode="aspectFill"
                        className="preview-img"
                      />
                      <View className="preview-mask">
                        <Text className="block text-white text-xs">点击预览截图</Text>
                      </View>
                    </View>
                  )}
                  
                  {data.feedbackLink && (
                    <View className="feedback-link-section mt-3">
                      <Text className="block text-xs text-gray-500 mb-1">发布链接</Text>
                      <View className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                        <ExternalLink size={16} color="#3b82f6" className="flex-shrink-0" />
                        <Text className="block text-sm text-blue-500 flex-1 overflow-hidden text-ellipsis">
                          {data.feedbackLink}
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {data.feedbackText && (
                    <View className="feedback-text-section mt-3">
                      <Text className="block text-xs text-gray-500 mb-1">补充说明</Text>
                      <Text className="block text-sm text-gray-700">{data.feedbackText}</Text>
                    </View>
                  )}
                  
                  {data.feedbackSubmittedAt && (
                    <Text className="block text-xs text-gray-400 mt-3">
                      反馈时间: {new Date(data.feedbackSubmittedAt).toLocaleString()}
                    </Text>
                  )}
                </CardContent>
              </Card>
              
              {/* 验收按钮 */}
              <View className="action-section mt-4">
                <Button 
                  className="w-full bg-blue-500 text-white"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  <Check size={16} color="#fff" className="mr-2" />
                  {accepting ? '验收中...' : '验收通过'}
                </Button>
              </View>
            </View>
          )}

          {/* 发单者视角 - 已完成 */}
          {isIssuer && isCompleted && (
            <View className="issuer-completed-section">
              <View className="section-title">
                <Check size={18} color="#22c55e" />
                <Text className="block text-sm text-green-600 ml-2">订单已完成</Text>
              </View>
              
              {/* 已验收的内容展示 */}
              <Card className="content-card mt-4">
                <CardContent className="p-4">
                  {data.contentUrl && (
                    <View 
                      className="content-preview-image"
                      onClick={() => handlePreviewImage(data.contentUrl!)}
                    >
                      <Image
                        src={data.contentUrl}
                        mode="aspectFill"
                        className="preview-img"
                      />
                    </View>
                  )}
                  
                  {data.contentText && (
                    <Text className="block text-sm text-gray-700 mt-3 leading-relaxed">
                      {data.contentText}
                    </Text>
                  )}
                  
                  {data.feedbackLink && (
                    <View className="feedback-link-section mt-3">
                      <Text className="block text-xs text-gray-500 mb-1">发布链接</Text>
                      <View className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                        <ExternalLink size={16} color="#3b82f6" className="flex-shrink-0" />
                        <Text className="block text-sm text-blue-500 flex-1 overflow-hidden text-ellipsis">
                          {data.feedbackLink}
                        </Text>
                      </View>
                    </View>
                  )}
                </CardContent>
              </Card>
            </View>
          )}

          {/* 接单者视角 - 待反馈 */}
          {!isIssuer && isPendingFeedback && (
            <View className="avatar-pending-section">
              <View className="section-title">
                <Send size={18} color="#3b82f6" />
                <Text className="block text-sm text-blue-600 ml-2">请提交发布反馈</Text>
              </View>
              
              {/* 已发布的内容 */}
              {data.contentUrl && (
                <Card className="content-card mt-4">
                  <CardContent className="p-4">
                    <Text className="section-label block text-xs text-gray-500 mb-3">已发布的内容</Text>
                    <View 
                      className="content-preview-image"
                      onClick={() => handlePreviewImage(data.contentUrl!)}
                    >
                      <Image
                        src={data.contentUrl}
                        mode="aspectFill"
                        className="preview-img"
                      />
                      <View className="preview-mask">
                        <Text className="block text-white text-xs">点击预览</Text>
                      </View>
                    </View>
                    {data.contentText && (
                      <Text className="block text-sm text-gray-700 mt-3 leading-relaxed">
                        {data.contentText}
                      </Text>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* 反馈表单 */}
              <Card className="feedback-form-card mt-4">
                <CardContent className="p-4">
                  <Text className="section-label block text-xs text-gray-500 mb-3">提交反馈</Text>
                  
                  <View className="form-item mb-4">
                    <Text className="block text-sm text-gray-700 mb-2">发布链接 *</Text>
                    <View className="input-wrapper">
                      <Input
                        className="form-input"
                        placeholder="请输入发布内容的链接"
                        value={feedbackLink}
                        onInput={(e: any) => setFeedbackLink(e.detail.value)}
                      />
                    </View>
                  </View>
                  
                  <View className="form-item">
                    <Text className="block text-sm text-gray-700 mb-2">补充说明</Text>
                    <View className="input-wrapper">
                      <Textarea
                        style={{ width: "100%", minHeight: 100, backgroundColor: "transparent" }}
                        placeholder="可选，补充发布情况说明"
                        value={feedbackText}
                        onInput={(e: any) => setFeedbackText(e.detail.value)}
                        maxlength={500}
                      />
                    </View>
                  </View>
                </CardContent>
              </Card>
              
              {/* 提交按钮 */}
              <View className="action-section mt-4">
                <Button 
                  className="w-full bg-blue-500 text-white"
                  onClick={handleSubmitFeedback}
                  disabled={submitting}
                >
                  <Send size={16} color="#fff" className="mr-2" />
                  {submitting ? '提交中...' : '提交反馈'}
                </Button>
              </View>
            </View>
          )}

          {/* 接单者视角 - 已提交反馈 */}
          {!isIssuer && isFeedbackSubmitted && (
            <View className="avatar-submitted-section">
              <View className="section-title">
                <Clock size={18} color="#eab308" />
                <Text className="block text-sm text-yellow-600 ml-2">等待发单者验收</Text>
              </View>
              
              {/* 已提交的内容 */}
              <Card className="content-card mt-4">
                <CardContent className="p-4">
                  <Text className="section-label block text-xs text-gray-500 mb-3">已提交的内容</Text>
                  
                  {data.contentUrl && (
                    <View 
                      className="content-preview-image"
                      onClick={() => handlePreviewImage(data.contentUrl!)}
                    >
                      <Image
                        src={data.contentUrl}
                        mode="aspectFill"
                        className="preview-img"
                      />
                      <View className="preview-mask">
                        <Text className="block text-white text-xs">点击预览</Text>
                      </View>
                    </View>
                  )}
                  
                  {data.contentText && (
                    <Text className="block text-sm text-gray-700 mt-3 leading-relaxed">
                      {data.contentText}
                    </Text>
                  )}
                </CardContent>
              </Card>
              
              {/* 已提交的反馈 */}
              <Card className="feedback-card mt-4">
                <CardContent className="p-4">
                  <Text className="section-label block text-xs text-gray-500 mb-3">已提交的反馈</Text>
                  
                  {data.feedbackScreenshot && (
                    <View 
                      className="content-preview-image"
                      onClick={() => handlePreviewImage(data.feedbackScreenshot!)}
                    >
                      <Image
                        src={data.feedbackScreenshot}
                        mode="aspectFill"
                        className="preview-img"
                      />
                    </View>
                  )}
                  
                  {data.feedbackLink && (
                    <View className="feedback-link-section mt-3">
                      <Text className="block text-xs text-gray-500 mb-1">发布链接</Text>
                      <View className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                        <ExternalLink size={16} color="#3b82f6" className="flex-shrink-0" />
                        <Text className="block text-sm text-blue-500 flex-1 overflow-hidden text-ellipsis">
                          {data.feedbackLink}
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {data.feedbackText && (
                    <View className="feedback-text-section mt-3">
                      <Text className="block text-xs text-gray-500 mb-1">补充说明</Text>
                      <Text className="block text-sm text-gray-700">{data.feedbackText}</Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 图片预览弹窗 */}
      {previewVisible && (
        <View className="preview-modal" onClick={() => setPreviewVisible(false)}>
          <View className="preview-modal-content">
            <Image
              src={previewImage}
              mode="widthFix"
              className="preview-modal-image"
              showMenuByLongpress
            />
            <View className="preview-modal-close">
              <Text className="block text-white text-lg">×</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
