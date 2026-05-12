import { useState } from 'react'
import { View, Text, Image, ScrollView, Video } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { getPlatformLabel } from '@/constants/publish-platform'
import { ArrowLeft, CircleCheck, Wallet, Clock, ExternalLink } from 'lucide-react-taro'
import './index.css'

export default function OrderCompletedPage() {
  const router = useRouter()
  const { requestId, orderId } = router.params

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const unwrapObject = (payload: any): Record<string, any> | null => {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        return payload.data
      }
      return payload
    }
    return null
  }

  useLoad(() => {
    console.log('[OrderCompleted] 页面加载，params:', { requestId, orderId })
    loadData()
  })

  const loadData = async () => {
    try {
      console.log('[OrderCompleted] 开始加载数据')
      const response = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderCompleted] 数据响应:', response.data)

      if (response.data?.code === 200) {
        setData(unwrapObject(response.data.data))
      } else {
        Taro.showToast({
          title: response.data?.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderCompleted] 加载失败:', error)
      Taro.showToast({
        title: '网络异常',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className="page-container">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!data) {
    return (
      <View className="page-container">
        <View className="loading-container">
          <Text className="loading-text">数据加载失败</Text>
        </View>
      </View>
    )
  }

  const generatedContent = data.generatedContent || {}
  const publishFeedback = data.publishFeedback || {}
  const feedbackEntries = Object.entries(publishFeedback || {}) as Array<[string, any]>
  const visibleFeedbackEntries = feedbackEntries.filter(([, feedback]) => {
    const screenshots = Array.isArray(feedback?.images)
      ? feedback.images.filter(Boolean)
      : Array.isArray(feedback?.screenshot_urls)
        ? feedback.screenshot_urls.filter(Boolean)
        : (typeof feedback?.image === 'string' && feedback.image ? [feedback.image] : [])
    const link = typeof feedback?.link === 'string' ? feedback.link : ''
    const note = typeof feedback?.note === 'string' ? feedback.note : ''
    const metrics = typeof feedback?.metrics === 'object' && feedback.metrics ? feedback.metrics : {}
    const hasMetrics = ['views', 'likes', 'comments', 'shares'].some((key) => metrics[key] !== undefined)
    return screenshots.length > 0 || Boolean(link) || Boolean(note) || hasMetrics
  })
  const contentType = data.contentType || generatedContent.type || 'image'

  // 收益信息
  const earnings = data.earnings || 0
  const earningsStatus = data.earningsStatus || 'settled' // settled, pending, withdrawn

  // 解析内容文本（支持换行和基本格式）
  const parseContent = (text: string) => {
    if (!text) return []
    const lines = text.split('\n').filter(line => line.trim())
    return lines.map((line, idx) => {
      // 处理图片 ![alt](url)
      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (imgMatch) {
        return { type: 'image', alt: imgMatch[1], url: imgMatch[2], key: idx }
      }
      if (line.startsWith('# ')) {
        return { type: 'h1', text: line.slice(2), key: idx }
      }
      if (line.startsWith('## ')) {
        return { type: 'h2', text: line.slice(3), key: idx }
      }
      if (line.startsWith('### ')) {
        return { type: 'h3', text: line.slice(4), key: idx }
      }
      if (line.match(/^[•\-\*]\s/)) {
        return { type: 'list', text: line.replace(/^[•\-\*]\s/, ''), key: idx }
      }
      if (line.match(/^\d+\.\s/)) {
        return { type: 'ordered-list', text: line.replace(/^\d+\.\s/, ''), key: idx }
      }
      return { type: 'text', text: line, key: idx }
    })
  }

  const parsedContent = parseContent(generatedContent.content || '')
  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

  // 收益状态配置
  const earningsStatusConfig = {
    settled: { label: '已结算', color: '#10b981', bgColor: '#d1fae5' },
    pending: { label: '待结算', color: '#f59e0b', bgColor: '#fef3c7' },
    withdrawn: { label: '已提现', color: '#6366f1', bgColor: '#e0e7ff' }
  }
  const statusInfo = earningsStatusConfig[earningsStatus as keyof typeof earningsStatusConfig] || earningsStatusConfig.settled

  return (
    <View className="page-container">
      {/* 顶部导航 */}
      <View className="nav-bar">
        <View className="nav-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="#333" />
        </View>
        <Text className="nav-title">订单完成</Text>
        <View className="nav-right"></View>
      </View>

      <ScrollView scrollY className="content-scroll">
        {/* 收益展示卡片 */}
        <View className="earnings-card">
          <View className="earnings-header">
            <View className="earnings-icon">
              <Wallet size={24} color="#fff" />
            </View>
            <Text className="earnings-label">本次收益</Text>
          </View>
          <View className="earnings-amount">
            <Text className="currency">¥</Text>
            <Text className="amount">{earnings.toFixed(2)}</Text>
          </View>
          <View className="earnings-status" style={{ backgroundColor: statusInfo.bgColor }}>
            <CircleCheck size={14} color={statusInfo.color} />
            <Text className="status-text" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
          </View>
          <View className="earnings-time">
            <Clock size={14} color="#999" />
            <Text className="time-text">完成时间：{data.completedAt || '刚刚'}</Text>
          </View>
        </View>

        {/* 分身发布内容 */}
        <View className="section">
          <Text className="section-title">发布内容</Text>
          <Card>
            <CardContent className="p-4">
              {/* 图片类型 */}
              {contentType === 'image' && generatedContent.images?.length > 0 && (
                <View className="content-preview">
                  <View className="main-image">
                    <Image
                      src={generatedContent.images[0]}
                      className="main-image-img"
                      mode="aspectFill"
                      onClick={() => Taro.previewImage({ urls: generatedContent.images, current: generatedContent.images[0] })}
                    />
                  </View>
                  {generatedContent.images.length > 1 && (
                    <View className="thumbnail-list">
                      {generatedContent.images.slice(1).map((img: string, idx: number) => (
                        <Image
                          key={idx}
                          src={img}
                          className="thumbnail-img"
                          mode="aspectFill"
                          onClick={() => Taro.previewImage({ urls: generatedContent.images, current: img })}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* 视频类型 */}
              {contentType === 'video' && generatedContent.videos?.length > 0 && (
                <View className="video-preview">
                  {isH5 ? (
                    <View className="video-placeholder">
                      <Text className="video-placeholder-text">视频内容（小程序端可播放）</Text>
                    </View>
                  ) : (
                    <Video
                      src={generatedContent.videos[0]}
                      className="video-player"
                      controls
                      poster={generatedContent.cover_image}
                    />
                  )}
                </View>
              )}

              {/* 文章类型 */}
              {contentType === 'article' && (
                <View className="article-preview">
                  {generatedContent.title && (
                    <Text className="block text-xl font-bold text-gray-800 p-6 bg-white">{generatedContent.title}</Text>
                  )}
                  {generatedContent.content && (
                    <View className="px-6 pb-6 bg-white">
                      {parseContent(generatedContent.content).map((item) => {
                        if (item.type === 'image' && item.url) {
                          return (
                            <Image
                              key={item.key}
                              src={item.url}
                              className="w-full rounded-lg mb-4"
                              mode="widthFix"
                              onClick={() => Taro.previewImage({ urls: [item.url!], current: item.url! })}
                            />
                          )
                        }
                        if (item.type === 'h1') {
                          return <Text key={item.key} className="block text-xl font-bold text-gray-800 mb-4">{item.text}</Text>
                        }
                        if (item.type === 'h2') {
                          return <Text key={item.key} className="block text-lg font-semibold text-gray-700 mt-4 mb-2">{item.text}</Text>
                        }
                        if (item.type === 'h3') {
                          return <Text key={item.key} className="block text-base font-semibold text-gray-600 mt-3 mb-2">{item.text}</Text>
                        }
                        if (item.type === 'list') {
                          return (
                            <View key={item.key} className="flex flex-row items-start mb-2">
                              <Text className="text-red-400 mr-2 font-bold">•</Text>
                              <Text className="flex-1 text-sm text-gray-600 leading-relaxed">{item.text}</Text>
                            </View>
                          )
                        }
                        if (item.type === 'ordered-list') {
                          const allItems = parseContent(generatedContent.content)
                          const orderedItems = allItems.filter((i: any) => i.type === 'ordered-list')
                          const orderIndex = orderedItems.indexOf(item) + 1
                          return (
                            <View key={item.key} className="flex flex-row items-start mb-2">
                              <Text className="text-red-400 mr-2 font-bold">{orderIndex}.</Text>
                              <Text className="flex-1 text-sm text-gray-600 leading-relaxed">{item.text}</Text>
                            </View>
                          )
                        }
                        return <Text key={item.key} className="block text-sm text-gray-600 leading-relaxed mb-2">{item.text}</Text>
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* 文案内容 - 美化展示 */}
              {generatedContent.content && contentType !== 'article' && (
                <View className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-3xl mt-4 border border-orange-100">
                  {parsedContent.map((item) => {
                    if (item.type === 'image' && item.url) {
                      return (
                        <Image
                          key={item.key}
                          src={item.url}
                          className="w-full rounded-lg mb-4"
                          mode="widthFix"
                          onClick={() => Taro.previewImage({ urls: [item.url!], current: item.url! })}
                        />
                      )
                    }
                    if (item.type === 'h1') {
                      return <Text key={item.key} className="block text-xl font-bold text-gray-800 mb-4 leading-relaxed">{item.text}</Text>
                    }
                    if (item.type === 'h2') {
                      return <Text key={item.key} className="block text-lg font-semibold text-gray-700 mt-4 mb-2 leading-relaxed">{item.text}</Text>
                    }
                    if (item.type === 'h3') {
                      return <Text key={item.key} className="block text-base font-semibold text-gray-600 mt-3 mb-2 leading-relaxed">{item.text}</Text>
                    }
                    if (item.type === 'list') {
                      return (
                        <View key={item.key} className="flex flex-row items-start mb-2 pl-2">
                          <Text className="text-red-400 mr-3 font-bold text-base">•</Text>
                          <Text className="flex-1 text-sm text-gray-600 leading-relaxed">{item.text}</Text>
                        </View>
                      )
                    }
                    if (item.type === 'ordered-list') {
                      const orderedItems = parsedContent.filter((i: any) => i.type === 'ordered-list')
                      const orderIndex = orderedItems.indexOf(item) + 1
                      return (
                        <View key={item.key} className="flex flex-row items-start mb-2 pl-2">
                          <Text className="text-red-400 mr-3 font-bold text-base">{orderIndex}.</Text>
                          <Text className="flex-1 text-sm text-gray-600 leading-relaxed">{item.text}</Text>
                        </View>
                      )
                    }
                    return <Text key={item.key} className="block text-sm text-gray-600 leading-relaxed mb-2 pl-2">{item.text}</Text>
                  })}
                </View>
              )}
            </CardContent>
          </Card>
        </View>

        {/* 已提交的反馈信息 */}
        <View className="section">
          <Text className="section-title">发布反馈</Text>
          <Card>
            <CardContent className="p-4">
              {visibleFeedbackEntries.map(([platform, feedback]) => {
                const screenshots = Array.isArray(feedback?.images)
                  ? feedback.images.filter(Boolean)
                  : Array.isArray(feedback?.screenshot_urls)
                    ? feedback.screenshot_urls.filter(Boolean)
                    : (typeof feedback?.image === 'string' && feedback.image ? [feedback.image] : [])
                const link = typeof feedback?.link === 'string' ? feedback.link : ''
                const note = typeof feedback?.note === 'string' ? feedback.note : ''
                const metrics = typeof feedback?.metrics === 'object' && feedback.metrics ? feedback.metrics : {}
                const hasMetrics = ['views', 'likes', 'comments', 'shares'].some((key) => metrics[key] !== undefined)

                return (
                  <View key={platform} className="feedback-item">
                    <Text className="block feedback-label">{getPlatformLabel(platform)}</Text>

                    {screenshots.length > 0 && (
                      <View className="screenshot-list">
                        {screenshots.map((url: string, idx: number) => (
                          <Image
                            key={`${platform}-${idx}`}
                            src={url}
                            className="screenshot-img"
                            mode="aspectFill"
                            onClick={() => Taro.previewImage({ urls: screenshots, current: url })}
                          />
                        ))}
                      </View>
                    )}

                    {link && (
                      <View className="link-box">
                        <ExternalLink size={16} color="#07c160" />
                        <Text
                          className="block link-text"
                          onClick={() => {
                            Taro.setClipboardData({ data: link })
                            Taro.showToast({ title: '链接已复制', icon: 'success' })
                          }}
                        >{link}</Text>
                      </View>
                    )}

                    {hasMetrics && (
                      <Text className="block note-text">
                        {`浏览 ${metrics.views ?? 0} / 点赞 ${metrics.likes ?? 0} / 评论 ${metrics.comments ?? 0} / 分享 ${metrics.shares ?? 0}`}
                      </Text>
                    )}

                    {note && (
                      <Text className="block note-text">{note}</Text>
                    )}
                  </View>
                )
              })}

              {visibleFeedbackEntries.length === 0 && (
                <View className="empty-feedback">
                  <Text className="block empty-text">暂无反馈信息</Text>
                </View>
              )}
            </CardContent>
          </Card>
        </View>

        {/* 底部留白 */}
        <View className="bottom-space"></View>
      </ScrollView>
    </View>
  )
}
