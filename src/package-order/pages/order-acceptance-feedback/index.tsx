import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { normalizeOrderProcessingStatus } from '@/adapters/core-chain-dto'
import { getPlatformLabel } from '@/constants/publish-platform'
import { ArrowLeft, Bell, ExternalLink, CircleCheck, Play } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

export default function OrderAcceptanceFeedback() {
  const router = useRouter()
  const { requestId, orderId, role } = router.params

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  // 通过 URL 参数判断角色：role=avatar 表示分身视角（接单者），否则为发单者
  const isIssuer = role !== 'avatar'

  useLoad(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      const identifier = requestId || orderId
      if (!identifier) {
        Taro.showToast({ title: '缺少参数', icon: 'none' })
        return
      }
      const response = await Network.request({
        url: `/api/order-processing/status/${identifier}`,
        dedupKey: `order-processing-status:${identifier}:full`,
      })


      if (response.data?.code === 200) {
        setData(normalizeOrderProcessingStatus(response.data.data))
      } else {
        Taro.showToast({
          title: response.data?.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderAcceptanceFeedback] 加载失败:', error)
      Taro.showToast({
        title: '网络异常',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 接单者催促验收
  const handleUrgeAcceptance = async () => {
    try {
      Taro.showLoading({ title: '催促中...' })
      const response = await Network.request({
        url: `/api/order-processing/urge-acceptance/${requestId}`,
        method: 'POST'
      })
      if (response.data?.code === 200 && response.data.data?.success) {
        const name = data?.avatarName || data?.generatedContent?.avatarName || '该分身'
        Taro.showToast({
          title: `已催促发单者验收「${name}」`,
          icon: 'success'
        })
        return
      }
      Taro.showToast({
        title: response.data?.message || '催促失败',
        icon: 'none'
      })
    } catch (error) {
      console.error('[OrderAcceptanceFeedback] 催促验收失败:', error)
      Taro.showToast({
        title: '催促失败',
        icon: 'none'
      })
    } finally {
      Taro.hideLoading()
    }
  }

  // 发单者确认验收
  const handleAccept = async () => {
    try {
      const response = await Network.request({
        url: `/api/order-processing/accept/${requestId}`,
        method: 'PUT'
      })
      if (response.data?.code === 200) {
        const name = data?.avatarName || data?.generatedContent?.avatarName || '该分身'
        Taro.showToast({
          title: `已验收「${name}」`,
          icon: 'success'
        })
        const query = [
          data?.orderId ? `orderId=${encodeURIComponent(String(data.orderId))}` : '',
          requestId ? `requestId=${encodeURIComponent(String(requestId))}` : '',
        ].filter(Boolean).join('&')
        setTimeout(() => {
          Taro.redirectTo({ url: `/package-order/pages/order-processing/index?${query}` })
        }, 200)
      } else {
        Taro.showToast({
          title: response.data?.message || '验收失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderAcceptanceFeedback] 验收失败:', error)
      Taro.showToast({
        title: '验收失败',
        icon: 'none'
      })
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
  const publishFeedback = (data.publishFeedback || {}) as Record<string, any>
  const feedbackEntries = Object.entries(publishFeedback)

  // 获取内容类型
  const contentType = data.contentType || generatedContent.type || 'image'
  const statusBarHeight = getStatusBarHeight()

  // 解析内容文本（支持换行和基本格式）
  const parseContent = (text: string) => {
    if (!text) return []
    // 按换行符分割，支持 \n
    const lines = text.split('\n').filter(line => line.trim())
    return lines.map((line, idx) => {
      // 处理图片 ![alt](url)
      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (imgMatch) {
        return { type: 'image', alt: imgMatch[1], url: imgMatch[2], key: idx }
      }
      // 处理标题 (# 开头)
      if (line.startsWith('# ')) {
        return { type: 'h1', text: line.slice(2), key: idx }
      }
      if (line.startsWith('## ')) {
        return { type: 'h2', text: line.slice(3), key: idx }
      }
      if (line.startsWith('### ')) {
        return { type: 'h3', text: line.slice(4), key: idx }
      }
      // 处理列表项
      if (line.match(/^[•\-\*]\s/)) {
        return { type: 'list', text: line.replace(/^[•\-\*]\s/, ''), key: idx }
      }
      if (line.match(/^\d+\.\s/)) {
        return { type: 'ordered-list', text: line.replace(/^\d+\.\s/, ''), key: idx }
      }
      // 普通文本
      return { type: 'text', text: line, key: idx }
    })
  }

  const parsedContent = parseContent(generatedContent.content || '')

  return (
    <View className="page-container">
      {/* 头部 */}
      <View className="oaf-header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
        <View className="oaf-header-deco">
          <View className="oaf-header-circle circle-a" />
          <View className="oaf-header-circle circle-b" />
        </View>
        <View className="oaf-header-bar">
          <View className="oaf-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="oaf-header-center">
            <Text className="oaf-header-title">待验收</Text>
          </View>
          <View className="oaf-header-placeholder" />
        </View>
      </View>

      <ScrollView scrollY className="content-scroll">
        {/* 状态提示 */}
        <View className="status-banner">
          <Bell size={20} color="#fff" />
          <Text className="status-text">分身已提交发布反馈，请验收</Text>
        </View>

        {/* 分身发布内容 */}
        <View className="section">
          <Text className="section-title">分身发布内容</Text>
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
                  {generatedContent.videos.map((url: string, idx: number) => (
                    <View key={idx} className="gc-video-cover-card" onClick={() => {
                      Taro.previewMedia({
                        sources: [{ url, type: 'video' }],
                        current: 0,
                      }).catch(() => {
                        Taro.setClipboardData({ data: url })
                        Taro.showToast({ title: '视频链接已复制', icon: 'none' })
                      })
                    }}
                    >
                      <View className="gc-video-cover-bg">
                        <View className="gc-video-play-btn">
                          <Play size={32} color="#fff" style={{ marginLeft: 4 }} />
                        </View>
                        <View className="gc-video-cover-label">
                          <Text className="gc-video-cover-text">视频 {idx + 1} · 点击播放</Text>
                        </View>
                      </View>
                    </View>
                  ))}
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
          <Text className="section-title">已提交反馈</Text>
          <Card>
            <CardContent className="p-4">
              {feedbackEntries.map(([platform, item]) => {
                const images = Array.isArray(item?.images) ? item.images : []
                const publishUrl = String(item?.publishUrl || item?.link || '')
                const note = String(item?.note || item?.remark || '')
                const title = getPlatformLabel(platform) || platform
                return (
                  <View key={platform} className="feedback-item">
                    <Text className="block feedback-label">{title}</Text>

                    {images.length > 0 && (
                      <View className="screenshot-list">
                        {images.map((url: string, idx: number) => (
                          <Image
                            key={`${platform}-${idx}`}
                            src={url}
                            className="screenshot-img"
                            mode="aspectFill"
                            onClick={() => Taro.previewImage({ urls: images, current: url })}
                          />
                        ))}
                      </View>
                    )}

                    {publishUrl && (
                      <View className="link-box">
                        <ExternalLink size={16} color="#07c160" />
                        <Text
                          className="block link-text"
                          onClick={() => {
                            Taro.setClipboardData({ data: publishUrl })
                            Taro.showToast({ title: '链接已复制', icon: 'success' })
                          }}
                        >{publishUrl}</Text>
                      </View>
                    )}

                    {note && <Text className="block note-text">{note}</Text>}
                  </View>
                )
              })}

              {feedbackEntries.length === 0 && (
                <View className="empty-feedback">
                  <Text className="block empty-text">暂无反馈信息</Text>
                </View>
              )}
            </CardContent>
          </Card>
        </View>
      </ScrollView>

      {/* 固定底部按钮 - 根据角色显示不同按钮 */}
      <View className="fixed-bottom">
        {isIssuer ? (
          // 发单者 - 确认验收按钮
          <Button
            className="accept-button"
            onClick={handleAccept}
          >
            <CircleCheck size={18} color="#fff" />
            <Text className="button-text">确认验收</Text>
          </Button>
        ) : (
          // 接单者 - 催促验收按钮
          <Button
            className="urge-button"
            onClick={handleUrgeAcceptance}
          >
            <Bell size={18} color="#fff" />
            <Text className="button-text">催促验收</Text>
          </Button>
        )}
      </View>
    </View>
  )
}
