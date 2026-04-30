import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { ArrowLeft, Check, Star, Sparkles, Download, Share } from 'lucide-react-taro'
import { getSafeArea } from '@/utils/safe-area'
import './index.css'

interface CompletedOrder {
  id: string
  title: string
  content: string
  platforms: string[]
  avatar: {
    id: string
    name: string
    avatar_url: string
  }
  rating?: number
  feedback?: string
  created_at: string
  completed_at: string
}

const PLATFORM_NAMES: Record<string, string> = {
  'wechat_mp': '微信公众号',
  'xiaohongshu': '小红书',
  'bilibili': 'B站',
  'weibo': '微博',
  'douyin': '抖音',
  'wechat_video': '视频号',
  'wechat_moments': '朋友圈'
}

export default function AvatarOrderCompletedPage() {
  const [order, setOrder] = useState<CompletedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)
    fetchCompletedOrder()
  })

  const fetchCompletedOrder = async () => {
    try {
      setLoading(true)
      // 获取URL参数
      const pages = Taro.getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const options = (currentPage as any)?.options || {}
      
      if (options.orderId) {
        const res = await Network.request({
          url: `/api/order/${options.orderId}`
        })
        
        if (res.data?.code === 200) {
          setOrder(res.data.data)
        }
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (order?.content) {
      Taro.setClipboardData({
        data: order.content,
        success: () => {
          Taro.showToast({ title: '内容已复制', icon: 'success' })
        }
      })
    }
  }

  const handleShare = () => {
    Taro.showShareMenu({
      withShareTicket: true
    })
  }

  return (
    <View className="order-completed-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-top">
          <View 
            className="back-button" 
            style={{ width: `${capsulePlaceholderWidth}rpx` }}
            onClick={() => navigateBack()}
          >
            <ArrowLeft size={24} color="#fff" />
          </View>
          <Text className="page-title">任务完成</Text>
          <View style={{ width: `${capsulePlaceholderWidth}rpx` }} />
        </View>
      </View>

      <ScrollView scrollY className="content-scroll">
        {loading ? (
          <View className="loading-state">
            <Sparkles size={32} color="#00f5ff" className="animate-spin" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : order ? (
          <View className="order-content">
            {/* 完成标识 */}
            <View className="success-banner">
              <Check size={64} color="#22c55e" />
              <Text className="success-title">任务已完成</Text>
              <Text className="success-subtitle">
                感谢使用分身服务，内容已生成
              </Text>
            </View>

            {/* 任务信息 */}
            <View className="task-section">
              <Text className="section-title">任务标题</Text>
              <Text className="task-title">{order.title}</Text>
            </View>

            {/* 分身信息 */}
            <View className="avatar-section">
              <Text className="section-title">执行分身</Text>
              <View className="avatar-row">
                {order.avatar?.avatar_url ? (
                  <Image 
                    src={order.avatar.avatar_url} 
                    className="avatar-img"
                    mode="aspectFill"
                  />
                ) : (
                  <View className="avatar-placeholder">
                    <Sparkles size={24} color="#00f5ff" />
                  </View>
                )}
                <Text className="avatar-name">{order.avatar?.name || 'AI分身'}</Text>
              </View>
            </View>

            {/* 平台 */}
            {order.platforms && order.platforms.length > 0 && (
              <View className="platforms-section">
                <Text className="section-title">发布平台</Text>
                <View className="platforms-list">
                  {order.platforms.map((platform, index) => (
                    <View key={index} className="platform-tag">
                      <Text className="platform-text">
                        {PLATFORM_NAMES[platform] || platform}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 评分 */}
            {order.rating && (
              <View className="rating-section">
                <Text className="section-title">您的评分</Text>
                <View className="stars-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <View key={star} style={{ color: star <= order.rating! ? '#fbbf24' : '#666' }}>
                      <Star size={32} color={star <= order.rating! ? '#fbbf24' : '#666'} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 反馈 */}
            {order.feedback && (
              <View className="feedback-section">
                <Text className="section-title">用户反馈</Text>
                <Text className="feedback-text">{order.feedback}</Text>
              </View>
            )}

            {/* 完成时间 */}
            <View className="time-section">
              <Text className="time-text">
                完成时间: {new Date(order.completed_at).toLocaleString()}
              </Text>
            </View>

            {/* 操作按钮 */}
            <View className="actions-section">
              <View className="action-btn primary" onClick={handleDownload}>
                <Download size={20} color="#fff" />
                <Text className="action-text">复制内容</Text>
              </View>
              <View className="action-btn secondary" onClick={handleShare}>
                <Share size={20} color="#667eea" />
                <Text className="action-text secondary">分享</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="empty-state">
            <Check size={64} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">未找到订单信息</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
