import { useLoad, useRouter, navigateBack, showToast, previewImage, navigateTo } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { marked } from 'marked'
import * as Network from '@/network'
import { 
  ArrowLeft, Check, Award, ExternalLink, Image as ImageIcon, 
  Video as VideoIcon, Eye, Clock, FileText, Link2,
  ThumbsUp, MessageCircle, Share2, BadgeCheck
} from 'lucide-react-taro'
import './index.css'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_moments: '微信朋友圈',
  wechat_video: '微信视频号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

export default function AvatarOrderCompletedPage() {
  const router = useRouter()
  const orderId = router.params.orderId
  const avatarId = router.params.avatarId
  const requestId = router.params.requestId

  const [order, setOrder] = useState<any>(null)
  const [dispatchRequest, setDispatchRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    if (orderId && avatarId) {
      fetchData()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      console.log('正在获取订单数据...', { orderId, requestId })

      const orderRes = await Network.request({ url: `/api/order/${orderId}` })

      console.log('订单响应:', orderRes.data)

      if (orderRes.data?.code === 200) {
        const orderData = orderRes.data.data
        setOrder(orderData)

        // 从订单的 dispatch_requests 中找到对应的请求
        const request = orderData.dispatch_requests?.find(
          (req: any) => req.id === requestId
        )

        if (request) {
          setDispatchRequest(request)
          console.log('派单请求数据加载成功', request)
        } else {
          console.error('未找到对应的派单请求')
          showToast({ title: '未找到订单数据', icon: 'none' })
        }
      } else {
        console.error('订单数据返回错误:', orderRes.data)
        showToast({ title: '订单数据加载失败', icon: 'none' })
      }
    } catch (error) {
      console.error('获取订单数据失败:', error)
      showToast({ title: '获取数据失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleLinkClick = (url: string) => {
    if (!url) return
    navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(url)}`
    }).catch(() => {
      showToast({ title: '打开链接失败', icon: 'none' })
    })
  }

  const handleImagePreview = (imageUrl: string, allImages: string[] = []) => {
    if (!imageUrl) return
    previewImage({
      urls: allImages.length > 0 ? allImages : [imageUrl],
      current: imageUrl
    })
  }

  const handleVideoPreview = (videoUrl: string) => {
    if (!videoUrl) return
    showToast({ title: '视频预览功能开发中', icon: 'none' })
  }

  // 解析Markdown
  const parseMarkdown = (text: string): string => {
    if (!text) return ''
    try {
      return marked.parse(text, { async: false }) as string
    } catch (e) {
      console.error('Markdown解析失败:', e)
      return text
    }
  }

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (num === undefined || num === null) return '0'
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}w`
    }
    return num.toString()
  }

  // 格式化时间
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 获取发布反馈数据
  const publishFeedback = useMemo(() => {
    return dispatchRequest?.publish_feedback || dispatchRequest?.publishFeedback || {}
  }, [dispatchRequest])

  // 获取平台数据
  const platforms = useMemo(() => {
    return dispatchRequest?.publish_status?.platforms || {}
  }, [dispatchRequest])

  // 获取订单奖励金额
  const rewardAmount = useMemo(() => {
    if (!order) return 0
    const budget = order.budget || 0
    const quantity = order.expected_quantity || 1
    return budget / quantity
  }, [order])

  // 生成提交记录时间线
  const submissionTimeline = useMemo(() => {
    if (!dispatchRequest) return []
    
    const timeline: Array<{time: string, type: string, content: string, status: string}> = []
    
    // 接受任务
    if (dispatchRequest.accepted_at) {
      timeline.push({
        time: dispatchRequest.accepted_at,
        type: 'accepted',
        content: '接受任务，开始制作',
        status: 'completed'
      })
    }
    
    // 创作内容提交
    if (dispatchRequest.generated_content || dispatchRequest.content) {
      timeline.push({
        time: dispatchRequest.content_generated_at || dispatchRequest.updated_at,
        type: 'content_generated',
        content: '提交创作内容',
        status: 'completed'
      })
    }
    
    // 发布链接提交
    Object.entries(platforms).forEach(([platform, data]: [string, any]) => {
      if (data.link) {
        timeline.push({
          time: data.submitted_at || dispatchRequest.updated_at,
          type: 'link_submitted',
          content: `提交${PLATFORM_NAMES[platform] || platform}发布链接`,
          status: 'completed'
        })
      }
    })
    
    // 发布截图提交
    Object.entries(platforms).forEach(([platform, data]: [string, any]) => {
      if (data.image) {
        timeline.push({
          time: data.submitted_at || dispatchRequest.updated_at,
          type: 'image_submitted',
          content: `提交${PLATFORM_NAMES[platform] || platform}发布截图`,
          status: 'completed'
        })
      }
    })
    
    // 任务完成
    if (dispatchRequest.status === 'completed') {
      timeline.push({
        time: dispatchRequest.updated_at,
        type: 'completed',
        content: '任务完成，获得奖励',
        status: 'completed'
      })
    }
    
    // 按时间排序
    return timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [dispatchRequest, platforms])

  // 获取所有图片列表
  const allImages = useMemo(() => {
    const images: string[] = []
    Object.values(platforms).forEach((data: any) => {
      if (data.image) images.push(data.image)
    })
    // 创作内容中的图片
    if (dispatchRequest?.generated_content) {
      const imgRegex = /!\[.*?\]\((.*?)\)/g
      let match
      while ((match = imgRegex.exec(dispatchRequest.generated_content)) !== null) {
        if (!images.includes(match[1])) {
          images.push(match[1])
        }
      }
    }
    return images
  }, [platforms, dispatchRequest])

  if (loading) {
    return (
      <View className="page-container">
        <View className="loading-state">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order || !dispatchRequest) {
    return (
      <View className="page-container">
        <View className="error-state">
          <Text className="error-text">订单数据加载失败</Text>
          <View className="retry-btn" onClick={fetchData}>
            <Text className="retry-text">重新加载</Text>
          </View>
        </View>
      </View>
    )
  }

  const completedTime = dispatchRequest.updated_at || dispatchRequest.created_at

  return (
    <View className="page-container">
      {/* 头部 */}
      <View className="page-header">
        <View className="back-btn" onClick={() => navigateBack()}>
          <ArrowLeft size={22} color="#1e293b" />
        </View>
        <Text className="header-title">订单完成</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="main-content" scrollY>
        {/* 奖励卡片 */}
        <View className="reward-section">
          <View className="reward-card">
            <View className="reward-icon-wrapper">
              <Award size={28} color="#10b981" />
            </View>
            <View className="reward-info">
              <Text className="reward-label">获得奖励</Text>
              <Text className="reward-amount">¥{rewardAmount.toFixed(2)}</Text>
            </View>
            <View className="reward-badge">
              <BadgeCheck size={16} color="#10b981" />
              <Text className="reward-badge-text">已完成</Text>
            </View>
          </View>
        </View>

        {/* 订单基本信息 */}
        <View className="section-card">
          <View className="card-header">
            <FileText size={20} color="#6366f1" />
            <Text className="card-title">订单信息</Text>
          </View>
          
          <View className="info-grid">
            <View className="info-row">
              <Text className="info-label">订单标题</Text>
              <Text className="info-value">{order.title || '-'}</Text>
            </View>
            
            <View className="info-row">
              <Text className="info-label">订单编号</Text>
              <Text className="info-value info-id">{order.id?.slice(0, 16)}...</Text>
            </View>
            
            <View className="info-row">
              <Text className="info-label">完成时间</Text>
              <Text className="info-value">{formatDate(completedTime)}</Text>
            </View>
          </View>
        </View>

        {/* 订单描述 */}
        {(order.description || dispatchRequest.generated_content) && (
          <View className="section-card">
            <View className="card-header">
              <FileText size={20} color="#8b5cf6" />
              <Text className="card-title">内容详情</Text>
            </View>
            
            {/* 订单描述 */}
            {order.description && (
              <View className="content-block">
                <Text className="content-label">订单描述</Text>
                <View className="markdown-content">
                  <Text className="markdown-text">{parseMarkdown(order.description)}</Text>
                </View>
              </View>
            )}
            
            {/* 创作内容 */}
            {dispatchRequest.generated_content && (
              <View className="content-block">
                <Text className="content-label">创作内容</Text>
                <View className="markdown-content">
                  <Text className="markdown-text">{parseMarkdown(dispatchRequest.generated_content)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 发布数据统计 */}
        {(publishFeedback.views !== undefined || publishFeedback.likes !== undefined ||
          publishFeedback.comments !== undefined || publishFeedback.shares !== undefined) && (
          <View className="section-card">
            <View className="card-header">
              <Eye size={20} color="#f59e0b" />
              <Text className="card-title">发布数据</Text>
            </View>
            
            <View className="stats-grid">
              {publishFeedback.views !== undefined && (
                <View className="stat-item">
                  <View className="stat-icon-wrapper views">
                    <Eye size={18} color="#6366f1" />
                  </View>
                  <View className="stat-info">
                    <Text className="stat-value">{formatNumber(publishFeedback.views)}</Text>
                    <Text className="stat-label">浏览</Text>
                  </View>
                </View>
              )}
              
              {publishFeedback.likes !== undefined && (
                <View className="stat-item">
                  <View className="stat-icon-wrapper likes">
                    <ThumbsUp size={18} color="#ef4444" />
                  </View>
                  <View className="stat-info">
                    <Text className="stat-value">{formatNumber(publishFeedback.likes)}</Text>
                    <Text className="stat-label">点赞</Text>
                  </View>
                </View>
              )}
              
              {publishFeedback.comments !== undefined && (
                <View className="stat-item">
                  <View className="stat-icon-wrapper comments">
                    <MessageCircle size={18} color="#f59e0b" />
                  </View>
                  <View className="stat-info">
                    <Text className="stat-value">{formatNumber(publishFeedback.comments)}</Text>
                    <Text className="stat-label">评论</Text>
                  </View>
                </View>
              )}
              
              {publishFeedback.shares !== undefined && (
                <View className="stat-item">
                  <View className="stat-icon-wrapper shares">
                    <Share2 size={18} color="#10b981" />
                  </View>
                  <View className="stat-info">
                    <Text className="stat-value">{formatNumber(publishFeedback.shares)}</Text>
                    <Text className="stat-label">分享</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 发布内容 */}
        {Object.keys(platforms).length > 0 && (
          <View className="section-card">
            <View className="card-header">
              <Link2 size={20} color="#10b981" />
              <Text className="card-title">发布内容</Text>
            </View>
            
            {Object.entries(platforms).map(([platform, data]: [string, any]) => (
              <View key={platform} className="platform-item">
                <View className="platform-header">
                  <Text className="platform-name">{PLATFORM_NAMES[platform] || platform}</Text>
                </View>
                
                {/* 发布链接 */}
                {data.link && (
                  <View className="link-item" onClick={() => handleLinkClick(data.link)}>
                    <View className="link-icon">
                      <ExternalLink size={18} color="#6366f1" />
                    </View>
                    <View className="link-info">
                      <Text className="link-label">发布链接</Text>
                      <Text className="link-url">{data.link}</Text>
                    </View>
                    <View className="link-arrow">
                      <ExternalLink size={16} color="#9ca3af" />
                    </View>
                  </View>
                )}
                
                {/* 发布截图 */}
                {data.image && (
                  <View className="media-item">
                    <View className="media-header">
                      <ImageIcon size={18} color="#8b5cf6" />
                      <Text className="media-label">发布截图</Text>
                    </View>
                    <View 
                      className="media-preview"
                      onClick={() => handleImagePreview(data.image, allImages)}
                    >
                      <Image 
                        src={data.image} 
                        mode="aspectFill"
                        className="preview-image" 
                      />
                      <View className="preview-overlay">
                        <ImageIcon size={24} color="#ffffff" />
                      </View>
                    </View>
                  </View>
                )}
                
                {/* 视频 */}
                {data.video && (
                  <View className="media-item">
                    <View className="media-header">
                      <VideoIcon size={18} color="#ec4899" />
                      <Text className="media-label">发布视频</Text>
                    </View>
                    <View 
                      className="video-preview"
                      onClick={() => handleVideoPreview(data.video)}
                    >
                      <Video
                        src={data.video}
                        className="preview-video"
                        poster={data.video_poster || ''}
                        controls
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 提交记录时间线 */}
        {submissionTimeline.length > 0 && (
          <View className="section-card">
            <View className="card-header">
              <Clock size={20} color="#ec4899" />
              <Text className="card-title">提交记录</Text>
            </View>
            
            <View className="timeline">
              {submissionTimeline.map((item, index) => (
                <View key={index} className="timeline-item">
                  <View className="timeline-marker">
                    <View className="timeline-dot completed">
                      <Check size={12} color="#ffffff" />
                    </View>
                    {index < submissionTimeline.length - 1 && (
                      <View className="timeline-line" />
                    )}
                  </View>
                  <View className="timeline-content">
                    <Text className="timeline-text">{item.content}</Text>
                    <Text className="timeline-time">{formatDate(item.time)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="bottom-safe" />
      </ScrollView>
    </View>
  )
}
