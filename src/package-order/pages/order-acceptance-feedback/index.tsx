import { useState } from 'react'
import { View, Text, Image, ScrollView, Video } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateBack } from '@tarojs/taro'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Bell, ExternalLink, CircleCheck } from 'lucide-react-taro'
import './index.css'

export default function OrderAcceptanceFeedback() {
  const router = useRouter()
  const { requestId, orderId, role } = router.params
  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  // 通过 URL 参数判断角色：role=avatar 表示分身视角（接单者），否则为发单者
  const isIssuer = role !== 'avatar'

  useLoad(() => {
    console.log('[OrderAcceptanceFeedback] 页面加载，params:', { requestId, orderId, role, isIssuer })
    loadData()
  })

  const loadData = async () => {
    try {
      console.log('[OrderAcceptanceFeedback] 开始加载数据')
      const response = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderAcceptanceFeedback] 数据响应:', response.data)

      if (response.data?.code === 200) {
        setData(response.data.data)
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
        setTimeout(() => navigateBack(), 1500)
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
  const publishFeedback = data.publishFeedback || {}
  const screenshotUrls = publishFeedback.screenshot_urls || []
  const link = publishFeedback.link || ''

  // 获取内容类型
  const contentType = data.contentType || generatedContent.type || 'image'

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
      {/* 顶部导航 */}
      <View className="nav-bar">
        <View className="nav-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="#333" />
        </View>
        <Text className="nav-title">待验收</Text>
        <View className="nav-right"></View>
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
          <Text className="section-title">已提交反馈</Text>
          <Card>
            <CardContent className="p-4">
              {/* 截图 */}
              {screenshotUrls.length > 0 && (
                <View className="feedback-item">
                  <Text className="block feedback-label">发布截图</Text>
                  <View className="screenshot-list">
                    {screenshotUrls.map((url: string, idx: number) => (
                      <Image
                        key={idx}
                        src={url}
                        className="screenshot-img"
                        mode="aspectFill"
                        onClick={() => Taro.previewImage({ urls: screenshotUrls, current: url })}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 链接 */}
              {link && (
                <View className="feedback-item">
                  <Text className="block feedback-label">发布链接</Text>
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
                </View>
              )}

              {/* 备注 */}
              {publishFeedback.note && (
                <View className="feedback-item">
                  <Text className="block feedback-label">备注说明</Text>
                  <Text className="block note-text">{publishFeedback.note}</Text>
                </View>
              )}

              {!screenshotUrls.length && !link && !publishFeedback.note && (
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
