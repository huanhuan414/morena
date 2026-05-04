import Taro, { useLoad, useRouter, showToast, navigateTo } from '@tarojs/taro'
import { getSafeArea } from '@/utils/safe-area'
import { useState, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { 
  ArrowLeft, Send, Image as ImageIcon, Sparkles, Loader, Copy, Download, Check
} from 'lucide-react-taro'
import './index.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  timestamp: number
}

interface OrderInfo {
  id: string
  title: string
  requirements: string
  budget: number
  deadline: string
  platforms: string[]
  dispatch_request_status?: string
}

export default function OrderContentCreationPage() {
  const router = useRouter()
  const { requestId, avatarId, orderId } = router.params

  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [generatedImages, setGeneratedImages] = useState<Array<{url: string, prompt: string}>>([])
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitContent, setSubmitContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<any>(null)

  useLoad(() => {
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)

    if (requestId && avatarId && orderId) {
      initPage()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  })

  const initPage = async () => {
    // 获取订单信息
    try {
      const res = await Network.request({
        url: `/api/order/${orderId}`
      })
      if (res.data?.code === 200) {
        setOrderInfo(res.data.data)
      }
    } catch (error) {
      console.error('获取订单信息失败:', error)
    }

    // 添加欢迎消息
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: '您好！我是您的内容创作助手。请问您需要我帮您创作什么内容呢？如果需要生成海报或图片，请告诉我您的需求，我会为您生成精美的图片。',
        timestamp: Date.now()
      }
    ])
  }

  const handleSend = async () => {
    if (!inputText.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setLoading(true)
    scrollToBottom()

    // 检测是否需要生成图片
    const needsImageGeneration = /生成图片|生成海报|画一张|给我画|创作图片|制作图片|生成图像/i.test(inputText)

    if (needsImageGeneration) {
      // 提取图片生成提示词
      const imagePrompt = extractImagePrompt(inputText)
      if (imagePrompt) {
        await generateImage(imagePrompt)
      }
    }

    // 调用 AI 对话接口
    try {
      const res = await Network.request({
        url: `/api/chat/send`,
        method: 'POST',
        data: {
          avatarId,
          content: userMessage.content,
          requestId
        }
      })

      if (res.data?.code === 200) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.data?.content || '抱歉，我无法理解您的问题，请重试。',
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(res.data?.msg || '发送失败')
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `抱歉，发生了错误：${error.message || '请重试'}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  const extractImagePrompt = (text: string): string => {
    // 移除"生成图片"、"画一张"等前缀，提取实际需求
    let prompt = text
      .replace(/生成图片|生成海报|画一张|给我画|创作图片|制作图片|生成图像/gi, '')
      .trim()
    
    // 如果提取的内容太少，使用原始文本
    return prompt.length > 5 ? prompt : text
  }

  const generateImage = async (prompt: string) => {
    setGeneratingImage(true)
    scrollToBottom()

    try {
      // 添加用户图片请求消息
      const requestMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'user',
        content: `请根据以下提示词生成图片：${prompt}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, requestMsg])

      // 调用图片生成接口
      const res = await Network.request({
        url: `/api/v1/images/generations`,
        method: 'POST',
        data: {
          prompt,
          size: '2K',
          style: 'realistic'
        }
      })

      if (res.data?.code === 200 && res.data.data?.url) {
        const imageUrl = res.data.data.url
        
        // 添加生成的图片消息
        const imageMsg: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: '图片已生成！',
          imageUrl,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, imageMsg])
        setGeneratedImages(prev => [...prev, { url: imageUrl, prompt }])
      } else {
        throw new Error(res.data?.msg || '图片生成失败')
      }
    } catch (error: any) {
      const errorMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `图片生成失败：${error.message || '请重试'}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setGeneratingImage(false)
      scrollToBottom()
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // 打开提交内容弹窗
  const openSubmitModal = () => {
    // 汇总所有对话和图片
    const allContent = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n')
    
    // 添加图片链接
    const imageLinks = generatedImages
      .map(img => `![生成图片](${img.url})`)
      .join('\n\n')
    
    setSubmitContent(allContent + (imageLinks ? '\n\n' + imageLinks : ''))
    setShowSubmitModal(true)
  }

  // 提交内容
  const handleSubmitContent = async () => {
    if (!submitContent.trim()) {
      showToast({ title: '请输入提交内容', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      // 提取图片链接
      const imageMatches = submitContent.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []
      const images = imageMatches.map((match: string) => {
        const urlMatch = match.match(/\(([^)]+)\)/)
        return urlMatch ? urlMatch[1] : ''
      }).filter((url: string) => url)

      // 构建提交数据
      const submitData = {
        avatarId,
        content: {
          content: submitContent,
          images: images.length > 0 ? images : undefined
        }
      }

      const res = await Network.request({
        url: `/api/order/${orderId}/submit-content`,
        method: 'POST',
        data: submitData
      })

      if (res.data?.code === 200) {
        showToast({ title: '提交成功，等待验收', icon: 'success' })
        setShowSubmitModal(false)
        
        // 跳转到发布反馈页面
        setTimeout(() => {
          navigateTo({
            url: `/pages/order-publish-feedback/index?requestId=${requestId}&orderId=${orderId}`
          })
        }, 1500)
      } else {
        throw new Error(res.data?.msg || '提交失败')
      }
    } catch (error: any) {
      showToast({ title: error.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateImageDirectly = async () => {
    if (!inputText.trim()) {
      showToast({ title: '请输入图片描述', icon: 'none' })
      return
    }
    await generateImage(inputText)
  }

  const copyImageUrl = (url: string) => {
    Taro.setClipboardData({
      data: url,
      success: () => showToast({ title: '已复制链接', icon: 'success' })
    })
  }

  const downloadImage = async (url: string) => {
    try {
      await Network.downloadFile({ url })
      showToast({ title: '下载成功', icon: 'success' })
    } catch {
      showToast({ title: '下载失败', icon: 'none' })
    }
  }

  const handleImageClick = (imageUrl: string) => {
    Taro.previewImage({ urls: [imageUrl] })
  }

  return (
    <View className="content-creation-page">
      {/* 背景装饰 */}
      <View className="bg-decoration bg-1" />
      <View className="bg-decoration bg-2" />

      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title">内容创作</Text>
        <View className="header-right" style={{ width: `${capsulePlaceholderWidth}rpx` }} />
      </View>

      {/* 订单信息 */}
      {orderInfo && (
        <View className="order-info-bar">
          <Text className="order-title">{orderInfo.title}</Text>
          <View className="order-budget">
            <Text className="budget-text">¥{orderInfo.budget}</Text>
          </View>
        </View>
      )}

      {/* 消息列表 */}
      <ScrollView 
        className="messages-container" 
        scrollY
        ref={scrollRef}
      >
        {messages.map((msg) => (
          <View 
            key={msg.id} 
            className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            {msg.role === 'assistant' && (
              <View className="avatar-icon">
                <Sparkles size={20} color="#3b82f6" />
              </View>
            )}
            <View className="message-content">
              <Text className="message-text">{msg.content}</Text>
              {msg.imageUrl && (
                <View className="image-message">
                  <Image 
                    src={msg.imageUrl} 
                    className="generated-image"
                    mode="aspectFit"
                    onClick={() => handleImageClick(msg.imageUrl!)}
                  />
                  <View className="image-actions">
                    <View className="action-btn" onClick={() => copyImageUrl(msg.imageUrl || '')}>
                      <Copy size={16} color="#64748b" />
                      <Text className="action-text">复制链接</Text>
                    </View>
                    <View className="action-btn" onClick={() => downloadImage(msg.imageUrl || '')}>
                      <Download size={16} color="#64748b" />
                      <Text className="action-text">下载</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
            {msg.role === 'user' && (
              <View className="user-avatar">
                <Text className="user-avatar-text">我</Text>
              </View>
            )}
          </View>
        ))}
        
        {generatingImage && (
          <View className="message assistant-message">
            <View className="avatar-icon">
              <Sparkles size={20} color="#3b82f6" />
            </View>
            <View className="message-content">
              <View className="loading-indicator">
                <Loader size={18} color="#3b82f6" className="spin-icon" />
                <Text className="loading-text">正在生成图片...</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 快捷操作 */}
      {generatedImages.length > 0 && (
        <View className="generated-images-gallery">
          <Text className="gallery-title">已生成的图片</Text>
          <ScrollView className="gallery-scroll" scrollX>
            {generatedImages.map((img, index) => (
              <View key={index} className="gallery-item" onClick={() => handleImageClick(img.url)}>
                <Image src={img.url} className="gallery-image" mode="aspectFill" />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 提交按钮区域 */}
      <View className="submit-action-area">
        <Button 
          className="submit-btn"
          onClick={openSubmitModal}
          disabled={messages.length <= 1}
        >
          <Check size={18} color="#fff" />
          <Text>提交内容</Text>
        </Button>
      </View>

      {/* 输入区域 */}
      <View className="input-area">
        <View className="input-wrapper">
          <View className="input-container">
            <Textarea
              className="input-textarea"
              value={inputText}
              onInput={(e: any) => setInputText(e.detail.value)}
              placeholder="输入您的创作需求..."
              maxlength={500}
              autoHeight
            />
          </View>
          <View className="input-actions">
            <View 
              className="action-icon-btn"
              onClick={handleGenerateImageDirectly}
            >
              <ImageIcon size={20} color={inputText.trim() ? '#3b82f6' : '#94a3b8'} />
            </View>
            <Button 
              className="send-btn"
              onClick={handleSend}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <Loader size={18} color="#fff" className="spin-icon" />
              ) : (
                <Send size={18} color="#fff" />
              )}
            </Button>
          </View>
        </View>
      </View>

      {/* 提交内容弹窗 */}
      {showSubmitModal && (
        <View className="modal-overlay">
          <View className="modal-content">
            <View className="modal-header">
              <Text className="modal-title block">提交内容</Text>
              <View className="modal-close" onClick={() => setShowSubmitModal(false)}>
                <Text>✕</Text>
              </View>
            </View>
            <View className="modal-body">
              <Text className="block text-sm text-gray-600 mb-2">请确认提交的内容：</Text>
              <Textarea
                className="submit-textarea"
                value={submitContent}
                onInput={(e: any) => setSubmitContent(e.detail.value)}
                placeholder="汇总的内容将显示在这里..."
                maxlength={5000}
                autoHeight
              />
            </View>
            <View className="modal-footer">
              <Button variant="outline" onClick={() => setShowSubmitModal(false)} className="modal-btn">
                <Text>取消</Text>
              </Button>
              <Button onClick={handleSubmitContent} disabled={submitting} className="modal-btn primary">
                {submitting ? (
                  <Loader size={16} color="#fff" />
                ) : (
                  <Text>确认提交</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
