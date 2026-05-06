import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Textarea } from '@/components/ui/textarea'
import Taro from '@tarojs/taro'
import { RefreshCw, Send, Check, CircleAlert, Loader, ChevronLeft, Search } from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  weibo: '微博',
  tiktok: '抖音',
  bilibili: 'B站',
  zhihu: '知乎',
  wechat_moments: '微信朋友圈'
}

interface GeneratedContent {
  title?: string
  content: string
  images?: string[]
  platforms: string[]
}

interface ProcessingData {
  orderId: string
  orderTitle: string
  status: 'generating' | 'preview' | 'publishing' | 'completed' | 'failed' | 'queuing' | 'accepted'
  generatedContent?: GeneratedContent
  errorMessage?: string
  // 存储从后端获取的平台信息（即使 generatedContent 为空也能显示平台）
  platforms?: string[]
}

export default function OrderContentCreation() {
  const [requestId, setRequestId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(true)
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = Taro.getCurrentInstance()?.router?.params || {}
    const { requestId: rId, orderId: oId } = params
    if (rId) setRequestId(rId)
    if (oId) setOrderId(oId)
    if (rId) {
      fetchOrderStatus(rId, true)
    }
  }, [])

  useEffect(() => {
    if (processingData?.generatedContent?.content) {
      setEditedContent(processingData.generatedContent.content)
    }
  }, [processingData?.generatedContent?.content])

  // 轮询获取状态（当状态为生成中或排队中时）
  useEffect(() => {
    if (!requestId) return
    
    const pollingStatus = processingData?.status
    if (pollingStatus === 'generating' || pollingStatus === 'queuing' || pollingStatus === 'accepted') {
      const interval = setInterval(() => {
        console.log('轮询获取订单状态...')
        fetchOrderStatus(requestId, false)
      }, 3000) // 每3秒轮询
      
      return () => clearInterval(interval)
    }
  }, [processingData?.status, requestId])

  const fetchOrderStatus = async (reqId: string, isInitial = false) => {
    if (isInitial) setLoading(true)
    setError('')
    try {
      const res = await Network.request({
        url: '/api/order-processing/status/' + reqId
      })
      console.log('订单状态:', res.data)
      if (res.data.code === 200) {
        const data = res.data.data
        setProcessingData({
          orderId: data.orderId || orderId,
          orderTitle: data.orderTitle || '商单内容',
          status: data.status,
          generatedContent: data.generatedContent,
          errorMessage: data.errorMessage,
          // 从 generatedContent 或 orderDataPlatforms 获取平台信息
          platforms: data.generatedContent?.platforms || data.orderDataPlatforms || []
        })
        if (data.generatedContent?.content) {
          setEditedContent(data.generatedContent.content)
        }
      } else {
        setError(res.data.message || '获取订单状态失败')
      }
    } catch (err: any) {
      console.error('获取订单状态失败:', err)
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!requestId) return
    try {
      const res = await Network.request({
        url: '/api/order-processing/regenerate/' + requestId,
        method: 'POST'
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '已提交重新生成', icon: 'success' })
        fetchOrderStatus(requestId)
      } else {
        Taro.showToast({ title: res.data.message || '重新生成失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  // 图片预览
  const handlePreviewImage = (currentIndex: number) => {
    const images = generatedContent?.images || []
    if (images.length > 0) {
      Taro.previewImage({
        current: images[currentIndex],
        urls: images
      })
    }
  }

  // 跳转到发布引导页面
  const handleGoToPublishGuide = () => {
    const platforms = generatedContent?.platforms || []
    const content = editedContent || generatedContent?.content || ''
    const title = generatedContent?.title || ''
    const images = generatedContent?.images || []

    Taro.navigateTo({
      url: `/pages/order/order-publish-guide/index?platforms=${platforms.join(',')}&content=${encodeURIComponent(content)}&title=${encodeURIComponent(title)}&images=${images.join(',')}&requestId=${requestId || ''}`
    })
  }

  // 确认发布
  const handleConfirmPublish = async () => {
    if (!requestId) return
    setShowConfirm(false)
    
    // 由于没有自动发布接口，跳转到发布引导页面
    handleGoToPublishGuide()
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      generating: { text: '制作中', className: 'status-badge processing' },
      preview: { text: '待发布', className: 'status-badge preview' },
      publishing: { text: '发布中', className: 'status-badge publishing' },
      completed: { text: '已完成', className: 'status-badge completed' },
      failed: { text: '失败', className: 'status-badge failed' }
    }
    const config = statusMap[status] || { text: status, className: 'status-badge' }
    return <Text className={config.className}>{config.text}</Text>
  }

  if (loading) {
    return (
      <View className="page-container">
        <View className="loading-state">
          <Loader size={48} color="#667eea" className="animate-spin" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="page-container">
        <View className="error-state">
          <CircleAlert size={48} color="#ef4444" />
          <Text className="error-text">{error}</Text>
          <View className="retry-btn" onClick={() => requestId && fetchOrderStatus(requestId)}>
            <Text className="retry-text">重新加载</Text>
          </View>
        </View>
      </View>
    )
  }

  if (!processingData) {
    return (
      <View className="page-container">
        <View className="error-state">
          <Text className="error-text">暂无数据</Text>
        </View>
      </View>
    )
  }

  const { status, orderTitle, generatedContent } = processingData
  const hasContent = !!generatedContent?.content

  return (
    <View className="page-container">
      {/* 顶部导航 */}
      <View className="header">
        <View className="header-left" onClick={handleBack}>
          <ChevronLeft size={24} color="#1e293b" />
        </View>
        <Text className="header-title">内容创作</Text>
        <View className="header-right" />
      </View>

      {/* 订单信息卡片 */}
      <View className="order-card">
        <View className="order-card-header">
          <Text className="order-title">{orderTitle}</Text>
          {renderStatusBadge(status)}
        </View>
        <View className="order-card-footer">
          <Text className="platform-label">目标平台：</Text>
          <View className="platform-tags">
            {(processingData?.platforms || generatedContent?.platforms)?.map((p: string) => (
              <Text key={p} className="platform-tag">{PLATFORM_NAMES[p] || p}</Text>
            )) || <Text className="no-platform">未指定</Text>}
          </View>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="content-area" scrollY>
        {/* 制作中状态 */}
        {status === 'generating' && (
          <View className="generating-section">
            <View className="generating-animation">
              <View className="ai-avatar">
                <Text className="ai-icon">🤖</Text>
              </View>
              <Text className="generating-text">AI 分身正在创作中...</Text>
            </View>
            <Text className="generating-tip">请稍候，内容生成中</Text>
          </View>
        )}

        {/* 失败状态 */}
        {status === 'failed' && (
          <View className="error-section">
            <CircleAlert size={48} color="#ef4444" />
            <Text className="error-title">内容生成失败</Text>
            <Text className="error-message">{processingData.errorMessage || '请重试'}</Text>
            <View className="error-actions">
              <Text className="action-btn-error" onClick={handleRegenerate}>重新生成</Text>
            </View>
          </View>
        )}

        {/* 预览/发布中/完成状态 - 显示内容 */}
        {(status === 'preview' || status === 'publishing' || status === 'completed') && hasContent && (
          <View className="preview-section">
            {/* 标题 */}
            {generatedContent?.title && (
              <View className="content-title-section">
                <Text className="section-label">标题</Text>
                <Text className="content-title">{generatedContent.title}</Text>
              </View>
            )}

            {/* 正文 */}
            <View className="content-text-section">
              <Text className="section-label">正文内容</Text>
              {status === 'preview' ? (
                <View className="textarea-wrapper">
                  <Textarea
                    className="content-textarea"
                    value={editedContent}
                    onInput={(e: any) => setEditedContent(e.detail.value)}
                    placeholder="编辑内容..."
                  />
                </View>
              ) : (
                <Text className="content-text">{editedContent}</Text>
              )}
            </View>

            {/* 图片预览 */}
            {generatedContent?.images && generatedContent.images.length > 0 && (
              <View className="content-images-section">
                <Text className="section-label">配图</Text>
                <ScrollView className="images-scroll" scrollX>
                  <View className="images-row">
                    {generatedContent.images.map((img, idx) => (
                      <View key={idx} className="image-item" onClick={() => handlePreviewImage(idx)}>
                        {/* @ts-ignore */}
                        <Image src={img} mode="aspectFill" className="preview-image" />
                        <View className="image-preview-icon">
                          <Search size={14} color="#ffffff" />
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* 发布中提示 */}
            {status === 'publishing' && (
              <View className="publishing-overlay">
                <Loader size={32} color="#3b82f6" className="animate-spin" />
                <Text className="publishing-text">正在发布到各平台...</Text>
              </View>
            )}

            {/* 已完成提示 */}
            {status === 'completed' && (
              <View className="completed-notice">
                <Check size={20} color="#ffffff" />
                <Text className="completed-text">内容已发布成功</Text>
              </View>
            )}
          </View>
        )}

        {/* 预览状态 - 无内容时显示提示 */}
        {status === 'preview' && !hasContent && (
          <View className="empty-section">
            <Text className="empty-text">内容正在准备中...</Text>
            <View className="refresh-btn" onClick={() => requestId && fetchOrderStatus(requestId)}>
              <Text className="refresh-text">刷新</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 底部操作栏 */}
      {status === 'preview' && (
        <View className="action-bar">
          <View className="action-btn-secondary" onClick={handleRegenerate}>
            <RefreshCw size={18} color="#475569" />
            <Text className="btn-text-secondary">重新生成</Text>
          </View>
          <View 
            className="action-btn-primary" 
            onClick={() => setShowConfirm(true)}
          >
            <Send size={18} color="#ffffff" />
            <Text className="btn-text-primary">确认发布</Text>
          </View>
        </View>
      )}

      {/* 确认发布弹窗 */}
      {showConfirm && (
        <View className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">确认发布</Text>
            <Text className="modal-desc">
              确定要发布当前内容到 {generatedContent?.platforms?.map((p: string) => PLATFORM_NAMES[p] || p).join('、')} 吗？
            </Text>
            <View className="modal-actions">
              <View className="modal-btn-cancel" onClick={() => setShowConfirm(false)}>
                <Text className="cancel-text">取消</Text>
              </View>
              <View className="modal-btn-confirm" onClick={handleConfirmPublish}>
                <Text className="confirm-text">确认发布</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
