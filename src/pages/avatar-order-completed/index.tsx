import Taro, { useLoad, useRouter, navigateBack, showToast, previewImage, navigateTo } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import * as Network from '@/network'
import { 
  ArrowLeft, Check, Award, ExternalLink, 
  Eye, Clock, FileText, Link2,
  ThumbsUp, MessageCircle, Share2, BadgeCheck, ImagePlus
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

// 平台检测
const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

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
        console.log('订单数据详情:', JSON.stringify(orderData, null, 2))

        // 从订单的 dispatch_requests 中找到对应的请求
        const request = orderData.dispatch_requests?.find(
          (req: any) => req.id === requestId
        )

        if (request) {
          setDispatchRequest(request)
          console.log('派单请求数据加载成功', JSON.stringify(request, null, 2))
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
    
    // H5环境直接用window.open
    if (!isMiniApp) {
      window.open(url, '_blank')
      return
    }
    
    // 小程序用webview
    navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(url)}`
    }).catch(() => {
      showToast({ title: '打开链接失败', icon: 'none' })
    })
  }

  const handleImagePreview = (imageUrl: string) => {
    if (!imageUrl) return
    
    if (isMiniApp) {
      previewImage({
        urls: allImages.length > 0 ? allImages : [imageUrl],
        current: imageUrl
      })
    } else {
      // H5环境直接打开图片
      window.open(imageUrl, '_blank')
    }
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

  // 获取平台数据 - 从多个可能的路径获取
  const platforms = useMemo(() => {
    // 优先从 publish_status.platforms 获取
    if (dispatchRequest?.publish_status?.platforms) {
      return dispatchRequest.publish_status.platforms
    }
    // 尝试从 submission_results 获取
    if (dispatchRequest?.submission_results) {
      const results = dispatchRequest.submission_results
      if (typeof results === 'object' && !Array.isArray(results)) {
        return results
      }
    }
    // 尝试从 submitted_links 或 submitted_images 获取
    if (dispatchRequest?.submitted_links || dispatchRequest?.submitted_images) {
      const result: any = {}
      if (dispatchRequest.submitted_links) {
        const links = Array.isArray(dispatchRequest.submitted_links) 
          ? dispatchRequest.submitted_links 
          : [dispatchRequest.submitted_links]
        links.forEach((link: any, index: number) => {
          const platformKey = `platform_${index}`
          result[platformKey] = { link: typeof link === 'string' ? link : link.url }
        })
      }
      if (dispatchRequest.submitted_images) {
        const images = Array.isArray(dispatchRequest.submitted_images) 
          ? dispatchRequest.submitted_images 
          : [dispatchRequest.submitted_images]
        images.forEach((img: any, index: number) => {
          const platformKey = `platform_image_${index}`
          result[platformKey] = { image: typeof img === 'string' ? img : img.url }
        })
      }
      return result
    }
    return {}
  }, [dispatchRequest])

  // 获取订单奖励金额
  const rewardAmount = useMemo(() => {
    if (!order) return 0
    const budget = order.budget || 0
    const quantity = order.expected_quantity || 1
    return budget / quantity
  }, [order])

  // 获取所有图片列表
  const allImages = useMemo(() => {
    const images: string[] = []
    Object.values(platforms).forEach((data: any) => {
      if (data?.image && !images.includes(data.image)) {
        images.push(data.image)
      }
    })
    return images
  }, [platforms])

  // 获取已提交的链接列表
  const submittedLinks = useMemo(() => {
    const links: Array<{url: string, platform?: string}> = []
    
    // 从 platforms 中提取
    Object.entries(platforms).forEach(([platform, data]: [string, any]) => {
      if (data?.link) {
        links.push({
          url: data.link,
          platform: PLATFORM_NAMES[platform] || platform
        })
      }
    })
    
    return links
  }, [platforms])

  // 获取已提交的截图列表
  const submittedImages = useMemo(() => {
    const images: Array<{url: string, platform?: string}> = []
    
    // 从 platforms 中提取
    Object.entries(platforms).forEach(([platform, data]: [string, any]) => {
      if (data?.image) {
        images.push({
          url: data.image,
          platform: PLATFORM_NAMES[platform] || platform
        })
      }
    })
    
    // 也直接从 dispatchRequest 中查找图片字段
    if (dispatchRequest?.submitted_images) {
      const imgs = Array.isArray(dispatchRequest.submitted_images) 
        ? dispatchRequest.submitted_images 
        : [dispatchRequest.submitted_images]
      imgs.forEach((img: any) => {
        const url = typeof img === 'string' ? img : img.url
        if (url && !images.find(i => i.url === url)) {
          images.push({ url })
        }
      })
    }
    
    return images
  }, [platforms, dispatchRequest])

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
    if (submittedLinks.length > 0) {
      submittedLinks.forEach(link => {
        timeline.push({
          time: dispatchRequest.updated_at,
          type: 'link_submitted',
          content: `提交${link.platform || '平台'}发布链接`,
          status: 'completed'
        })
      })
    }
    
    // 发布截图提交
    if (submittedImages.length > 0) {
      submittedImages.forEach(img => {
        timeline.push({
          time: dispatchRequest.updated_at,
          type: 'image_submitted',
          content: `提交${img.platform || '平台'}发布截图`,
          status: 'completed'
        })
      })
    }
    
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
  }, [dispatchRequest, submittedLinks, submittedImages])

  // 计算发布数据总计
  const totalStats = useMemo(() => {
    const total = { views: 0, likes: 0, comments: 0, shares: 0 }
    
    // 从 platforms 中汇总
    Object.values(platforms).forEach((data: any) => {
      if (data?.feedback) {
        total.views += data.feedback.views || 0
        total.likes += data.feedback.likes || 0
        total.comments += data.feedback.comments || 0
        total.shares += data.feedback.shares || 0
      }
    })
    
    // 也从 publish_feedback 汇总
    if (publishFeedback?.platforms) {
      Object.values(publishFeedback.platforms).forEach((data: any) => {
        total.views += data.views || 0
        total.likes += data.likes || 0
        total.comments += data.comments || 0
        total.shares += data.shares || 0
      })
    }
    
    // 直接从 publish_feedback 顶层数据
    if (publishFeedback?.views) total.views += publishFeedback.views
    if (publishFeedback?.likes) total.likes += publishFeedback.likes
    if (publishFeedback?.comments) total.comments += publishFeedback.comments
    if (publishFeedback?.shares) total.shares += publishFeedback.shares
    
    return total
  }, [platforms, publishFeedback])

  const hasStats = totalStats.views > 0 || totalStats.likes > 0 || totalStats.comments > 0 || totalStats.shares > 0

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (num === undefined || num === null || num === 0) return '-'
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}w`
    }
    return num.toLocaleString()
  }

  const completedTime = dispatchRequest?.updated_at || dispatchRequest?.created_at

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
        {order.description && (
          <View className="section-card">
            <View className="card-header">
              <FileText size={20} color="#8b5cf6" />
              <Text className="card-title">订单描述</Text>
            </View>
            <View className="description-content">
              <Text className="description-text">{order.description}</Text>
            </View>
          </View>
        )}

        {/* 创作内容 */}
        {dispatchRequest.generated_content && (
          <View className="section-card">
            <View className="card-header">
              <FileText size={20} color="#10b981" />
              <Text className="card-title">创作内容</Text>
            </View>
            <View className="description-content">
              <Text className="description-text">{dispatchRequest.generated_content}</Text>
            </View>
          </View>
        )}

        {/* 发布数据统计 */}
        {hasStats && (
          <View className="section-card">
            <View className="card-header">
              <Eye size={20} color="#f59e0b" />
              <Text className="card-title">发布数据</Text>
            </View>
            
            <View className="stats-grid">
              <View className="stat-item">
                <View className="stat-icon-wrapper views">
                  <Eye size={18} color="#6366f1" />
                </View>
                <View className="stat-info">
                  <Text className="stat-value">{formatNumber(totalStats.views)}</Text>
                  <Text className="stat-label">浏览</Text>
                </View>
              </View>
              
              <View className="stat-item">
                <View className="stat-icon-wrapper likes">
                  <ThumbsUp size={18} color="#ef4444" />
                </View>
                <View className="stat-info">
                  <Text className="stat-value">{formatNumber(totalStats.likes)}</Text>
                  <Text className="stat-label">点赞</Text>
                </View>
              </View>
              
              <View className="stat-item">
                <View className="stat-icon-wrapper comments">
                  <MessageCircle size={18} color="#f59e0b" />
                </View>
                <View className="stat-info">
                  <Text className="stat-value">{formatNumber(totalStats.comments)}</Text>
                  <Text className="stat-label">评论</Text>
                </View>
              </View>
              
              <View className="stat-item">
                <View className="stat-icon-wrapper shares">
                  <Share2 size={18} color="#10b981" />
                </View>
                <View className="stat-info">
                  <Text className="stat-value">{formatNumber(totalStats.shares)}</Text>
                  <Text className="stat-label">分享</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 发布链接 */}
        {submittedLinks.length > 0 && (
          <View className="section-card">
            <View className="card-header">
              <Link2 size={20} color="#6366f1" />
              <Text className="card-title">发布链接</Text>
            </View>
            
            {submittedLinks.map((link, index) => (
              <View 
                key={`link-${index}`} 
                className="link-item"
                onClick={() => handleLinkClick(link.url)}
              >
                <View className="link-icon">
                  <ExternalLink size={18} color="#6366f1" />
                </View>
                <View className="link-info">
                  <Text className="link-platform">{link.platform || '平台链接'}</Text>
                  <Text className="link-url">{link.url}</Text>
                </View>
                <View className="link-arrow">
                  <ExternalLink size={16} color="#9ca3af" />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 发布截图 */}
        {submittedImages.length > 0 && (
          <View className="section-card">
            <View className="card-header">
              <ImagePlus size={20} color="#8b5cf6" />
              <Text className="card-title">发布截图</Text>
            </View>
            
            <View className="images-grid">
              {submittedImages.map((img, index) => (
                <View 
                  key={`img-${index}`}
                  className="image-item"
                  onClick={() => handleImagePreview(img.url)}
                >
                  <Image 
                    src={img.url}
                    mode="aspectFill"
                    className="preview-image"
                  />
                  {img.platform && (
                    <View className="image-platform-tag">
                      <Text className="image-platform-text">{img.platform}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
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
