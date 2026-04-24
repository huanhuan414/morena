import Taro, { useLoad, useRouter, navigateBack, showToast, previewImage, navigateTo } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { View, Text, ScrollView, Image, RichText } from '@tarojs/components'
import { marked } from 'marked'
import * as Network from '@/network'
import { 
  ArrowLeft, Check, Award, ExternalLink, 
  Eye, Clock, FileText, Link2,
  ThumbsUp, MessageCircle, Share2, BadgeCheck, ImagePlus
} from 'lucide-react-taro'

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
    
    if (!isMiniApp) {
      window.open(url, '_blank')
      return
    }
    
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
      window.open(imageUrl, '_blank')
    }
  }

  // 解析Markdown为HTML
  const parseMarkdown = (text: string): string => {
    if (!text) return ''
    try {
      const html = marked.parse(text, { async: false }) as string
      return html
    } catch (e) {
      console.error('Markdown解析失败:', e)
      return text
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

  // 获取平台数据
  const platforms = useMemo(() => {
    if (dispatchRequest?.publish_status?.platforms) {
      return dispatchRequest.publish_status.platforms
    }
    if (dispatchRequest?.submission_results) {
      const results = dispatchRequest.submission_results
      if (typeof results === 'object' && !Array.isArray(results)) {
        return results
      }
    }
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
    Object.entries(platforms).forEach(([platform, data]: [string, any]) => {
      if (data?.image) {
        images.push({
          url: data.image,
          platform: PLATFORM_NAMES[platform] || platform
        })
      }
    })
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

  // 计算发布数据总计
  const totalStats = useMemo(() => {
    const total = { views: 0, likes: 0, comments: 0, shares: 0 }
    Object.values(platforms).forEach((data: any) => {
      if (data?.feedback) {
        total.views += data.feedback.views || 0
        total.likes += data.feedback.likes || 0
        total.comments += data.feedback.comments || 0
        total.shares += data.feedback.shares || 0
      }
    })
    if (publishFeedback?.platforms) {
      Object.values(publishFeedback.platforms).forEach((data: any) => {
        total.views += data.views || 0
        total.likes += data.likes || 0
        total.comments += data.comments || 0
        total.shares += data.shares || 0
      })
    }
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
      <View className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <View className="w-10 h-10 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        <Text className="mt-4 text-sm text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!order || !dispatchRequest) {
    return (
      <View className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Text className="text-base text-red-500 mb-4">订单数据加载失败</Text>
        <View className="px-6 py-2 bg-indigo-500 rounded-lg" onClick={fetchData}>
          <Text className="text-sm text-white font-medium">重新加载</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="flex flex-col min-h-screen bg-gray-100">
      {/* 头部 */}
      <View className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200 sticky top-0 z-50">
        <View className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl" onClick={() => navigateBack()}>
          <ArrowLeft size={22} color="#1e293b" />
        </View>
        <Text className="text-lg font-semibold text-gray-800">订单完成</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4 py-4 pb-24" scrollY>
        {/* 奖励卡片 */}
        <View className="mb-4">
          <View className="flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-lg">
            <View className="w-14 h-14 flex items-center justify-center bg-white bg-opacity-20 rounded-xl">
              <Award size={28} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-white text-opacity-90">获得奖励</Text>
              <Text className="text-3xl font-bold text-white">¥{rewardAmount.toFixed(2)}</Text>
            </View>
            <View className="flex items-center gap-1 px-3 py-2 bg-white bg-opacity-20 rounded-full">
              <BadgeCheck size={16} color="#ffffff" />
              <Text className="text-sm text-white font-medium">已完成</Text>
            </View>
          </View>
        </View>

        {/* 订单基本信息 */}
        <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
          <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
            <FileText size={20} color="#6366f1" />
            <Text className="text-lg font-semibold text-gray-800">订单信息</Text>
          </View>
          
          <View className="flex flex-col gap-3">
            <View className="flex justify-between">
              <Text className="text-sm text-gray-500">订单标题</Text>
              <Text className="text-sm text-gray-800 font-medium max-w-56 text-right">{order.title || '-'}</Text>
            </View>
            
            <View className="flex justify-between">
              <Text className="text-sm text-gray-500">订单编号</Text>
              <Text className="text-xs text-gray-400 font-mono">{order.id?.slice(0, 16)}...</Text>
            </View>
            
            <View className="flex justify-between">
              <Text className="text-sm text-gray-500">完成时间</Text>
              <Text className="text-sm text-gray-700">{formatDate(completedTime)}</Text>
            </View>
          </View>
        </View>

        {/* 订单描述 - Markdown解析 */}
        {order.description && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <FileText size={20} color="#8b5cf6" />
              <Text className="text-lg font-semibold text-gray-800">订单描述</Text>
            </View>
            <View className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <RichText className="text-sm text-gray-700 leading-relaxed" nodes={parseMarkdown(order.description)} />
            </View>
          </View>
        )}

        {/* 创作内容 - Markdown解析 */}
        {dispatchRequest.generated_content && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <FileText size={20} color="#10b981" />
              <Text className="text-lg font-semibold text-gray-800">创作内容</Text>
            </View>
            <View className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <RichText className="text-sm text-gray-700 leading-relaxed" nodes={parseMarkdown(dispatchRequest.generated_content)} />
            </View>
          </View>
        )}

        {/* 发布数据统计 */}
        {hasStats && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <Eye size={20} color="#f59e0b" />
              <Text className="text-lg font-semibold text-gray-800">发布数据</Text>
            </View>
            
            <View className="grid grid-cols-2 gap-3">
              <View className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="w-10 h-10 flex items-center justify-center bg-violet-100 rounded-lg">
                  <Eye size={18} color="#6366f1" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-800">{formatNumber(totalStats.views)}</Text>
                  <Text className="text-xs text-gray-500">浏览</Text>
                </View>
              </View>
              
              <View className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-lg">
                  <ThumbsUp size={18} color="#ef4444" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-800">{formatNumber(totalStats.likes)}</Text>
                  <Text className="text-xs text-gray-500">点赞</Text>
                </View>
              </View>
              
              <View className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-lg">
                  <MessageCircle size={18} color="#f59e0b" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-800">{formatNumber(totalStats.comments)}</Text>
                  <Text className="text-xs text-gray-500">评论</Text>
                </View>
              </View>
              
              <View className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="w-10 h-10 flex items-center justify-center bg-emerald-100 rounded-lg">
                  <Share2 size={18} color="#10b981" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-800">{formatNumber(totalStats.shares)}</Text>
                  <Text className="text-xs text-gray-500">分享</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 发布链接 */}
        {submittedLinks.length > 0 && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <Link2 size={20} color="#6366f1" />
              <Text className="text-lg font-semibold text-gray-800">发布链接</Text>
            </View>
            
            {submittedLinks.map((link, index) => (
              <View 
                key={`link-${index}`} 
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2 last:mb-0"
                onClick={() => handleLinkClick(link.url)}
              >
                <View className="w-10 h-10 flex items-center justify-center bg-violet-100 rounded-lg flex-shrink-0">
                  <ExternalLink size={18} color="#6366f1" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-gray-800">{link.platform || '平台链接'}</Text>
                  <Text className="text-xs text-indigo-500 truncate">{link.url}</Text>
                </View>
                <View className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <ExternalLink size={16} color="#9ca3af" />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 发布截图 */}
        {submittedImages.length > 0 && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <ImagePlus size={20} color="#8b5cf6" />
              <Text className="text-lg font-semibold text-gray-800">发布截图</Text>
            </View>
            
            <View className="grid grid-cols-2 gap-3">
              {submittedImages.map((img, index) => (
                <View 
                  key={`img-${index}`}
                  className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square"
                  onClick={() => handleImagePreview(img.url)}
                >
                  <Image 
                    src={img.url}
                    mode="aspectFill"
                    className="w-full h-full"
                  />
                  {img.platform && (
                    <View className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 rounded-md">
                      <Text className="text-xs text-white font-medium">{img.platform}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 提交记录时间线 - 包含截图和链接详情 */}
        {(submittedLinks.length > 0 || submittedImages.length > 0 || dispatchRequest.generated_content) && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <Clock size={20} color="#ec4899" />
              <Text className="text-lg font-semibold text-gray-800">提交记录</Text>
            </View>
            
            <View className="flex flex-col">
              {/* 接受任务 */}
              {dispatchRequest.accepted_at && (
                <View className="flex gap-3 pb-6">
                  <View className="flex flex-col items-center">
                    <View className="w-6 h-6 flex items-center justify-center bg-emerald-500 rounded-full">
                      <Check size={12} color="#ffffff" />
                    </View>
                    <View className="w-1 flex-1 bg-gray-200 mt-2" />
                  </View>
                  <View>
                    <Text className="text-sm font-medium text-gray-800 mb-1">接受任务，开始制作</Text>
                    <Text className="text-xs text-gray-400">{formatDate(dispatchRequest.accepted_at)}</Text>
                  </View>
                </View>
              )}
              
              {/* 创作内容提交 */}
              {dispatchRequest.generated_content && (
                <View className="flex gap-3 pb-6">
                  <View className="flex flex-col items-center">
                    <View className="w-6 h-6 flex items-center justify-center bg-emerald-500 rounded-full">
                      <Check size={12} color="#ffffff" />
                    </View>
                    <View className="w-1 flex-1 bg-gray-200 mt-2" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-800 mb-2">提交创作内容</Text>
                    <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <RichText className="text-xs text-gray-600 leading-relaxed" nodes={parseMarkdown(dispatchRequest.generated_content)} />
                    </View>
                    <Text className="text-xs text-gray-400 mt-2">{formatDate(dispatchRequest.content_generated_at || dispatchRequest.updated_at)}</Text>
                  </View>
                </View>
              )}
              
              {/* 发布链接提交 */}
              {submittedLinks.map((link, index) => (
                <View key={`timeline-link-${index}`} className="flex gap-3 pb-6">
                  <View className="flex flex-col items-center">
                    <View className="w-6 h-6 flex items-center justify-center bg-emerald-500 rounded-full">
                      <Check size={12} color="#ffffff" />
                    </View>
                    {index < submittedLinks.length - 1 || submittedImages.length > 0 && (
                      <View className="w-1 flex-1 bg-gray-200 mt-2" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-800 mb-2">提交{link.platform || '平台'}发布链接</Text>
                    <View 
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100"
                      onClick={() => handleLinkClick(link.url)}
                    >
                      <Link2 size={14} color="#6366f1" />
                      <Text className="flex-1 text-xs text-indigo-500 truncate">{link.url}</Text>
                    </View>
                  </View>
                </View>
              ))}
              
              {/* 发布截图提交 */}
              {submittedImages.map((img, index) => (
                <View key={`timeline-img-${index}`} className="flex gap-3 pb-6 last:pb-0">
                  <View className="flex flex-col items-center">
                    <View className="w-6 h-6 flex items-center justify-center bg-emerald-500 rounded-full">
                      <Check size={12} color="#ffffff" />
                    </View>
                    {index < submittedImages.length - 1 && (
                      <View className="w-1 flex-1 bg-gray-200 mt-2" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-800 mb-2">提交{img.platform || '平台'}发布截图</Text>
                    <View 
                      className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video"
                      onClick={() => handleImagePreview(img.url)}
                    >
                      <Image 
                        src={img.url}
                        mode="aspectFill"
                        className="w-full h-full"
                      />
                    </View>
                  </View>
                </View>
              ))}
              
              {/* 任务完成 */}
              {dispatchRequest.status === 'completed' && (
                <View className="flex gap-3">
                  <View className="flex flex-col items-center">
                    <View className="w-6 h-6 flex items-center justify-center bg-emerald-500 rounded-full">
                      <Check size={12} color="#ffffff" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-sm font-medium text-gray-800 mb-1">任务完成，获得奖励</Text>
                    <Text className="text-xs text-gray-400">{formatDate(dispatchRequest.updated_at)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  )
}
