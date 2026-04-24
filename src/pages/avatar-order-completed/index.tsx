import { useLoad, useRouter, navigateBack, showToast, previewImage, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import * as Network from '@/network'
import { ArrowLeft, Check, TrendingUp, ExternalLink, Image as ImageIcon, Award } from 'lucide-react-taro'
import './index.css'

// 订单状态配置
const STATUS_CONFIG: Record<string, any> = {
  accepted: { label: '制作中', color: '#3b82f6', bg: '#dbeafe' },
  generating: { label: '生成中', color: '#8b5cf6', bg: '#ede9fe' },
  preview: { label: '预览中', color: '#f59e0b', bg: '#fef3c7' },
  publishing: { label: '发布中', color: '#06b6d4', bg: '#cffafe' },
  published: { label: '待反馈', color: '#f97316', bg: '#ffedd5' },
  awaiting_acceptance: { label: '等待验收', color: '#ec4899', bg: '#fce7f3' },
  completed: { label: '已完成', color: '#10b981', bg: '#d1fae5' },
  cancelled: { label: '已取消', color: '#ef4444', bg: '#fee2e2' }
}

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
      const [orderRes, dispatchRes] = await Promise.all([
        Network.request({ url: `/api/order/${orderId}` }),
        Network.request({ url: `/api/order-dispatch/request/${requestId}` })
      ])

      if (orderRes.data?.code === 200) {
        setOrder(orderRes.data.data)
      }

      if (dispatchRes.data?.code === 200) {
        setDispatchRequest(dispatchRes.data.data)
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

  const handleImagePreview = (imageUrl: string) => {
    if (!imageUrl) return
    previewImage({
      urls: [imageUrl],
      current: imageUrl
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}w`
    }
    return num.toString()
  }

  if (loading) {
    return (
      <View className="avatar-order-completed-page">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order || !dispatchRequest) {
    return (
      <View className="avatar-order-completed-page">
        <View className="empty-container">
          <Text>订单数据加载失败</Text>
        </View>
      </View>
    )
  }

  const statusConfig = STATUS_CONFIG[dispatchRequest.status] || STATUS_CONFIG.completed
  const publishFeedback = dispatchRequest.publish_status?.feedback || {}
  const rewardAmount = order.budget && order.expected_quantity
    ? order.budget / order.expected_quantity
    : 0

  return (
    <View className="avatar-order-completed-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-btn" onClick={() => navigateBack()}>
          <ArrowLeft size={22} color="#1e293b" />
        </View>
        <Text className="header-title text-base font-semibold">订单完成</Text>
        <View className="header-btn" />
      </View>

      <ScrollView className="content-scroll" scrollY>
        {/* 订单基本信息 */}
        <View className="section-card">
          <View className="section-header">
            <Text className="section-title text-lg font-semibold">订单信息</Text>
          </View>

          <View className="order-info">
            <View className="info-item">
              <Text className="info-label text-sm font-medium">订单标题</Text>
              <Text className="info-value text-base">{order.title}</Text>
            </View>

            <View className="info-item">
              <Text className="info-label text-sm font-medium">订单编号</Text>
              <Text className="info-value text-sm text-gray-500">{order.id.slice(0, 8)}...</Text>
            </View>

            <View className="info-row">
              <View className="info-item-half">
                <Text className="info-label text-sm font-medium">订单状态</Text>
                <View
                  className="status-badge text-sm font-medium"
                  style={{
                    backgroundColor: statusConfig.bg,
                    color: statusConfig.color
                  }}
                >
                  <Check size={14} color={statusConfig.color} />
                  <Text>{statusConfig.label}</Text>
                </View>
              </View>

              <View className="info-item-half">
                <Text className="info-label text-sm font-medium">完成时间</Text>
                <Text className="info-value text-sm text-gray-500">
                  {dispatchRequest.publish_status?.feedbackSubmittedAt
                    ? new Date(dispatchRequest.publish_status.feedbackSubmittedAt).toLocaleDateString('zh-CN')
                    : '-'}
                </Text>
              </View>
            </View>

            <View className="info-item">
              <Text className="info-label text-sm font-medium">订单描述</Text>
              <Text className="info-value text-sm text-gray-600 line-clamp-2">
                {order.description || '暂无描述'}
              </Text>
            </View>
          </View>
        </View>

        {/* 奖励金额 */}
        <View className="reward-card">
          <View className="reward-icon">
            <Award size={24} color="#10b981" />
          </View>
          <View className="reward-content">
            <Text className="reward-label text-sm text-gray-500">获得奖励</Text>
            <Text className="reward-amount text-3xl font-bold">¥{rewardAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* 数据统计 */}
        {(publishFeedback.views !== undefined || publishFeedback.likes !== undefined ||
          publishFeedback.comments !== undefined || publishFeedback.shares !== undefined) && (
          <View className="section-card">
            <View className="section-header">
              <Text className="section-title text-lg font-semibold">发布数据</Text>
            </View>

            <View className="stats-grid">
              {publishFeedback.views !== undefined && (
                <View className="stat-item">
                  <TrendingUp size={20} color="#6366f1" />
                  <View className="stat-content">
                    <Text className="stat-value text-2xl font-bold">{formatNumber(publishFeedback.views)}</Text>
                    <Text className="stat-label text-sm">浏览</Text>
                  </View>
                </View>
              )}

              {publishFeedback.likes !== undefined && (
                <View className="stat-item">
                  <TrendingUp size={20} color="#ef4444" />
                  <View className="stat-content">
                    <Text className="stat-value text-2xl font-bold">{formatNumber(publishFeedback.likes)}</Text>
                    <Text className="stat-label text-sm">点赞</Text>
                  </View>
                </View>
              )}

              {publishFeedback.comments !== undefined && (
                <View className="stat-item">
                  <TrendingUp size={20} color="#f59e0b" />
                  <View className="stat-content">
                    <Text className="stat-value text-2xl font-bold">{formatNumber(publishFeedback.comments)}</Text>
                    <Text className="stat-label text-sm">评论</Text>
                  </View>
                </View>
              )}

              {publishFeedback.shares !== undefined && (
                <View className="stat-item">
                  <TrendingUp size={20} color="#10b981" />
                  <View className="stat-content">
                    <Text className="stat-value text-2xl font-bold">{formatNumber(publishFeedback.shares)}</Text>
                    <Text className="stat-label text-sm">分享</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 发布内容 */}
        {dispatchRequest.publish_status?.platforms && Object.keys(dispatchRequest.publish_status.platforms).length > 0 && (
          <View className="section-card">
            <View className="section-header">
              <Text className="section-title text-lg font-semibold">发布内容</Text>
            </View>

            {Object.entries(dispatchRequest.publish_status.platforms).map(([platform, data]: [string, any]) => (
              <View key={platform} className="platform-item">
                <View className="platform-header">
                  <Text className="platform-name text-base font-semibold">{PLATFORM_NAMES[platform] || platform}</Text>
                </View>

                {data.link && (
                  <View className="content-item" onClick={() => handleLinkClick(data.link)}>
                    <ExternalLink size={18} color="#6366f1" />
                    <View className="content-info">
                      <Text className="content-label text-sm font-medium">发布链接</Text>
                      <Text className="content-value text-sm text-gray-600">{data.link}</Text>
                    </View>
                  </View>
                )}

                {data.image && (
                  <View className="content-item-image">
                    <ImageIcon size={18} color="#6366f1" />
                    <View className="content-info">
                      <Text className="content-label text-sm font-medium">发布截图</Text>
                      <Image
                        src={data.image}
                        className="content-image"
                        mode="widthFix"
                        onClick={() => handleImagePreview(data.image)}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
