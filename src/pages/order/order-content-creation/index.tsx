import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Textarea } from '@/components/ui/textarea'
import Taro from '@tarojs/taro'
import { RefreshCw, Send, Check, CircleAlert, Loader, ChevronLeft, Video } from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信',
  wechat: '微信',
  xiaohongshu: '小红书',
  weibo: '微博',
  tiktok: '抖音',
  bilibili: 'B站',
  zhihu: '知乎',
  kuaishou: '快手',
  moments: '朋友圈'
}

interface GeneratedContent {
  title?: string
  content: string
  images?: string[]
  videos?: string[]
  platforms: string[]
}

interface ProcessingData {
  orderId: string
  orderTitle: string
  orderDescription?: string
  contentType?: string
  expectedQuantity?: number
  platforms: string[]
  status: 'idle' | 'generating' | 'preview' | 'publishing' | 'completed' | 'failed'
  generatedContent?: GeneratedContent
  errorMessage?: string
}

export default function OrderContentCreation() {
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(true)
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance()?.router?.params || {}
    const { orderId: oId } = params
    if (oId) {
      setOrderId(oId)
      fetchOrderAndGenerate(oId)
    } else {
      setError('缺少订单ID')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (processingData?.generatedContent?.content) {
      setEditedContent(processingData.generatedContent.content)
    }
  }, [processingData?.generatedContent?.content])

  const fetchOrderAndGenerate = async (oId: string) => {
    setLoading(true)
    setError('')
    try {
      // 获取订单详情
      const orderRes = await Network.request({
        url: '/api/order/' + oId
      })
      console.log('订单详情:', orderRes.data)
      
      if (orderRes.data.code === 200) {
        const order = orderRes.data.data
        
        // 设置订单信息
        setProcessingData({
          orderId: oId,
          orderTitle: order.title || '商单内容',
          orderDescription: order.description,
          contentType: order.contentType,
          expectedQuantity: order.expectedQuantity || order.avatarCount || 1,
          platforms: order.platforms || [order.platform] || [],
          status: 'generating'
        })
        
        // 获取分身列表，自动选第一个
        const avatarRes = await Network.request({
          url: '/api/avatar'
        })
        
        let avatarId = ''
        if (avatarRes.data.code === 200 && avatarRes.data.data?.length > 0) {
          avatarId = avatarRes.data.data[0].id
        }
        
        // 如果有分身，自动开始生成内容
        if (avatarId) {
          await generateContent(oId, avatarId, order)
        } else {
          setProcessingData(prev => prev ? {
            ...prev,
            status: 'failed',
            errorMessage: '没有可用的分身账号'
          } : null)
        }
      } else {
        setError(orderRes.data.message || '获取订单失败')
      }
    } catch (err: any) {
      console.error('获取订单失败:', err)
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const generateContent = async (oId: string, avatarId: string, order?: any) => {
    setGenerating(true)
    try {
      // 如果没有订单详情，先获取
      if (!order) {
        const orderRes = await Network.request({
          url: '/api/order/' + oId
        })
        if (orderRes.data.code === 200) {
          order = orderRes.data.data
        }
      }

      const platforms = order?.platforms || [order?.platform].filter(Boolean) || []
      const contentType = order?.contentType || 'article'
      const expectedQuantity = order?.expectedQuantity || order?.avatarCount || 1

      console.log('开始生成内容:', { orderId: oId, avatarId, platforms, contentType, expectedQuantity })

      const res = await Network.request({
        url: '/api/content-generation/generate',
        method: 'POST',
        data: {
          orderId: oId,
          avatarId: avatarId,
          orderTitle: order?.title || '商单内容',
          orderDescription: order?.description || '',
          platforms: platforms,
          contentType: contentType,
          targetAudience: order?.targetAudience || '目标用户',
          contentQuantity: expectedQuantity
        }
      })
      
      console.log('生成结果:', res.data)
      
      if (res.data.code === 200) {
        setProcessingData(prev => prev ? {
          ...prev,
          status: 'preview',
          generatedContent: {
            content: res.data.data?.content || res.data.data?.generatedContent?.content || '',
            title: res.data.data?.title || res.data.data?.generatedContent?.title || '',
            images: res.data.data?.images || res.data.data?.generatedContent?.images || [],
            videos: res.data.data?.videos || res.data.data?.generatedContent?.videos || [],
            platforms: platforms
          }
        } : null)
        
        Taro.showToast({ title: '内容生成成功', icon: 'success' })
      } else {
        setProcessingData(prev => prev ? {
          ...prev,
          status: 'failed',
          errorMessage: res.data.message || '生成失败'
        } : null)
        Taro.showToast({ title: res.data.message || '生成失败', icon: 'none' })
      }
    } catch (err: any) {
      console.error('生成失败:', err)
      setProcessingData(prev => prev ? {
        ...prev,
        status: 'failed',
        errorMessage: err.message || '网络请求失败'
      } : null)
      Taro.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    if (!orderId) return
    
    // 获取分身
    try {
      const avatarRes = await Network.request({
        url: '/api/avatar'
      })
      
      if (avatarRes.data.code === 200 && avatarRes.data.data?.length > 0) {
        const avatarId = avatarRes.data.data[0].id
        setProcessingData(prev => prev ? { ...prev, status: 'generating' } : null)
        await generateContent(orderId, avatarId)
      } else {
        Taro.showToast({ title: '没有可用分身', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  const handleConfirmPublish = async () => {
    if (!orderId) return
    try {
      const res = await Network.request({
        url: '/api/order-processing/confirm/' + orderId,
        method: 'POST',
        data: {
          content: editedContent
        }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setShowConfirm(false)
        setProcessingData(prev => prev ? { ...prev, status: 'completed' } : null)
      } else {
        Taro.showToast({ title: res.data.message || '发布失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      idle: { text: '待处理', className: 'status-badge' },
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
          <Text className="loading-text">加载订单信息...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="page-container">
        <View className="header">
          <View className="header-left" onClick={handleBack}>
            <ChevronLeft size={24} color="#1e293b" />
          </View>
          <Text className="header-title">内容创作</Text>
          <View className="header-right" />
        </View>
        <View className="error-state">
          <CircleAlert size={48} color="#ef4444" />
          <Text className="error-text">{error}</Text>
          <View className="retry-btn" onClick={() => orderId && fetchOrderAndGenerate(orderId)}>
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

  const { status, orderTitle, orderDescription, contentType, expectedQuantity, platforms, generatedContent } = processingData
  const hasContent = !!generatedContent?.content || !!generatedContent?.images?.length || !!generatedContent?.videos?.length

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
        {orderDescription && (
          <Text className="order-description">{orderDescription}</Text>
        )}
        <View className="order-card-footer">
          <Text className="platform-label">目标平台：</Text>
          <View className="platform-tags">
            {platforms?.map((p: string) => (
              <Text key={p} className="platform-tag">{PLATFORM_NAMES[p] || p}</Text>
            )) || <Text className="no-platform">未指定</Text>}
          </View>
        </View>
        <View className="order-meta">
          {contentType && (
            <Text className="meta-item">内容类型：{contentType === 'article' ? '图文' : contentType === 'video' ? '视频' : contentType}</Text>
          )}
          {expectedQuantity && (
            <Text className="meta-item">生成数量：{expectedQuantity}</Text>
          )}
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="content-area" scrollY>
        {/* 制作中状态 */}
        {(status === 'generating' || generating) && (
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
                <Text className="content-text">{editedContent || generatedContent.content}</Text>
              )}
            </View>

            {/* 图片预览 */}
            {generatedContent?.images && generatedContent.images?.length > 0 && (
              <View className="content-images-section">
                <Text className="section-label">配图 ({generatedContent.images?.length})</Text>
                <ScrollView className="images-scroll" scrollX>
                  <View className="images-row">
                    {generatedContent.images?.map((img, idx) => (
                      <View key={idx} className="image-item">
                        <Text className="image-index">第{idx + 1}/{generatedContent.images?.length}张</Text>
                        {/* @ts-ignore */}
                        <Image src={img} mode="aspectFill" className="preview-image" />
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* 视频预览 */}
            {generatedContent?.videos && generatedContent.videos?.length > 0 && (
              <View className="content-videos-section">
                <Text className="section-label">视频 ({generatedContent.videos?.length})</Text>
                <View className="videos-list">
                  {generatedContent.videos?.map((video, idx) => (
                    <View key={idx} className="video-item">
                      <Text className="video-index">第{idx + 1}/{generatedContent.videos?.length}个</Text>
                      <Text className="video-placeholder">{video}</Text>
                    </View>
                  ))}
                </View>
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
            <View className="refresh-btn" onClick={() => orderId && fetchOrderAndGenerate(orderId)}>
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
          <View className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <Text className="modal-title">确认发布</Text>
            <Text className="modal-desc">
              确定要发布当前内容到 {platforms?.map((p: string) => PLATFORM_NAMES[p] || p).join('、')} 吗？
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
