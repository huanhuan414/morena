import Taro, { useLoad, useRouter, navigateBack, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { ArrowLeft, Loader, Check, Sparkles, Smartphone, RefreshCw, Clock } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import './index.css'

const PLATFORM_NAMES: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  wechat_mp: '微信公众号',
  wechat_moments: '朋友圈',
  wechat_video: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
  toutiao: '头条'
}

// 步骤定义
const STEPS = [
  { key: 'queuing', label: '排队中', desc: '正在等待处理队列...', icon: '⏳' },
  { key: 'generating', label: '生成中', desc: 'AI 正在为您创作优质内容...', icon: '✨' },
  { key: 'preview', label: '预览中', desc: '内容已生成，准备展示...', icon: '👀' },
  { key: 'completed', label: '已完成', desc: '内容制作完成', icon: '✅' }
]

interface ContentData {
  title: string
  content: string
  platforms: string[]
  images: string[]
  videos: string[]
}

export default function OrderContentCreationPage() {
  const router = useRouter()
  const { requestId, avatarId, orderId } = router.params

  const [loading, setLoading] = useState(true)
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // 进度提示相关状态
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(60) // 预估完成时间（秒）
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0) // 已用时间（秒）
  const [isTimeout, setIsTimeout] = useState(false) // 是否超时
  const [isRefreshing, setIsRefreshing] = useState(false) // 是否正在刷新
  const [elapsedTimeInterval, setElapsedTimeInterval] = useState<NodeJS.Timeout | null>(null)

  useLoad(() => {
    console.log('[OrderContentCreation] 页面加载，参数:', { requestId, avatarId, orderId })
    if (!requestId || !avatarId || !orderId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
      return
    }
    startPolling()
  })

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      if (elapsedTimeInterval) {
        clearInterval(elapsedTimeInterval)
      }
    }
  }, [pollInterval, elapsedTimeInterval])

  // 开始计时
  const startTimer = () => {
    if (elapsedTimeInterval) {
      clearInterval(elapsedTimeInterval)
    }
    setElapsedTime(0)
    setIsTimeout(false)

    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1
        // 超过3分钟提示超时
        if (newTime >= 180) {
          setIsTimeout(true)
        }
        return newTime
      })
    }, 1000)

    setElapsedTimeInterval(interval)
  }

  // 停止计时
  const stopTimer = () => {
    if (elapsedTimeInterval) {
      clearInterval(elapsedTimeInterval)
      setElapsedTimeInterval(null)
    }
  }

  // 手动刷新状态
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchContentStatus()
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }

  // 根据状态获取步骤信息
  const getStepInfo = (status: string) => {
    const stepIndex = STEPS.findIndex(step => step.key === status)
    return {
      step: stepIndex >= 0 ? STEPS[stepIndex] : STEPS[1], // 默认生成中
      stepIndex: stepIndex >= 0 ? stepIndex : 1
    }
  }

  const startPolling = () => {
    console.log('[OrderContentCreation] 开始轮询内容状态')
    fetchContentStatus()
    const interval = setInterval(fetchContentStatus, 1000)
    setPollInterval(interval)
  }

  const fetchContentStatus = async () => {
    try {
      console.log('[OrderContentCreation] 获取内容状态:', { requestId })
      const res = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderContentCreation] 状态响应:', res.data)

      if (res.data?.code === 200 && res.data.data) {
        const data = res.data.data as any

        // 更新步骤信息
        const { stepIndex } = getStepInfo(data.status || '')
        setCurrentStepIndex(stepIndex)

        // 更新队列位置和预估时间
        if (data.queuePosition !== undefined) {
          setQueuePosition(data.queuePosition)
          setEstimatedTime(data.estimatedTime || 60)
        }

        if (loading) {
          console.log('[OrderContentCreation] 首次获取状态成功，状态:', data.status)
          setLoading(false)
          // 开始计时
          startTimer()
        }

        // 在 preview 或 completed 状态时展示内容
        if ((data.status === 'preview' || data.status === 'completed') && data.generatedContent) {
          setContentData(data.generatedContent)
          setEditedContent(data.generatedContent.content || '')
          console.log('[OrderContentCreation] 内容已制作完成，停止轮询')
          stopTimer()
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
        } else {
          // 其他状态（generating, queuing 等）显示加载动画
          console.log('[OrderContentCreation] 内容制作中，当前状态:', data.status)
        }
      } else {
        console.error('[OrderContentCreation] 获取状态失败:', res.data?.message)
        if (loading) setLoading(false)
        if (errorCount >= 5) {
          stopTimer()
          if (pollInterval) {
            clearInterval(pollInterval)
            setPollInterval(null)
          }
          Taro.showToast({ title: '获取状态失败，请刷新页面', icon: 'none' })
        }
        setErrorCount(errorCount + 1)
      }
    } catch (error) {
      console.error('[OrderContentCreation] 请求异常:', error)
      if (loading) setLoading(false)
      if (errorCount >= 5) {
        stopTimer()
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        Taro.showToast({ title: '网络异常，请刷新页面', icon: 'none' })
      }
      setErrorCount(errorCount + 1)
    }
  }

  const handlePublish = async () => {
    if (!contentData) return

    Taro.showModal({
      title: '确认发布',
      content: `确定发布内容吗？将发布到所有要求平台。`,
      success: async (res) => {
        if (res.confirm) {
          setPublishing(true)
          try {
            const finalContent = editedContent || contentData.content
            const publishRes = await Network.request({
              url: `/api/order-processing/publish/${requestId}`,
              method: 'POST',
              data: {
                content: finalContent
              }
            })

            console.log('[OrderContentCreation] 发布响应:', publishRes.data)

            if (publishRes.data?.code === 200) {
              const result = publishRes.data.data

              // 检查是否有需要手动发布的平台
              const manualPlatforms = result.publishResults?.filter(
                (r: any) => r.status === 'manual'
              ) || []

              if (manualPlatforms.length > 0) {
                // 有平台需要手动发布
                const platformNames = manualPlatforms.map((p: any) => {
                  return PLATFORM_NAMES[p.platform] || p.platform
                }).join('、')

                Taro.showModal({
                  title: '发布成功',
                  content: `部分平台已自动发布成功，${platformNames} 需要手动发布。是否查看发布详情？`,
                  confirmText: '查看详情',
                  cancelText: '返回',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      // 显示发布详情
                      showPublishDetails(result)
                    } else {
                      setTimeout(() => {
                        navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
                      }, 500)
                    }
                  }
                })
              } else {
                // 全部自动发布成功
                Taro.showToast({
                  title: '发布成功',
                  icon: 'success',
                  duration: 2000
                })
                setTimeout(() => {
                  navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
                }, 2000)
              }
            } else {
              Taro.showToast({ title: publishRes.data?.message || '发布失败', icon: 'none' })
            }
          } catch (error) {
            console.error('[OrderContentCreation] 发布异常:', error)
            Taro.showToast({ title: '发布失败', icon: 'none' })
          } finally {
            setPublishing(false)
          }
        }
      }
    })
  }

  const showPublishDetails = (result: any) => {
    // 构建发布详情消息
    let message = ''

    if (result.publishResults && result.publishResults.length > 0) {
      result.publishResults.forEach((r: any) => {
        const platformName = PLATFORM_NAMES[r.platform] || r.platform
        message += `\n【${platformName}】\n`
        message += `状态：${r.status === 'success' ? '✓ 自动发布成功' : r.status === 'manual' ? '⚠ 需要手动发布' : '✗ 发布失败'}\n`
        message += `说明：${r.message}\n`
      })
    }

    message += `\n发布内容：\n${result.content?.substring(0, 200)}${result.content?.length > 200 ? '...' : ''}`

    Taro.showModal({
      title: '发布详情',
      content: message,
      showCancel: false,
      confirmText: '确定',
      success: () => {
        setTimeout(() => {
          navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
        }, 500)
      }
    })
  }

  const handleSaveEdit = () => {
    setIsEditing(false)
    Taro.showToast({ title: '保存成功', icon: 'success' })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent(contentData?.content || '')
  }

  const handleRegenerate = async () => {
    Taro.showModal({
      title: '重新生成内容',
      content: '确定要重新生成内容吗？\n\n当前内容将被替换，预计需要 1-2 分钟。',
      confirmText: '确定重新生成',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          setRegenerating(true)
          try {
            console.log('[OrderContentCreation] 开始重新生成内容')
            const response = await Network.request({
              url: `/api/order-processing/regenerate/${requestId}`,
              method: 'POST'
            })

            console.log('[OrderContentCreation] 重新生成响应:', response.data)

            if (response.data?.code === 200) {
              // 显示更详细的提示
              Taro.showToast({
                title: '已重新生成，请稍候...',
                icon: 'loading',
                duration: 3000
              })

              // 清空内容，显示生成状态
              setContentData(null)
              setEditedContent('')
              setIsEditing(false)

              // 重置计时器
              stopTimer()
              startTimer()

              // 重置步骤
              setCurrentStepIndex(1) // 生成中
              setQueuePosition(response.data.data?.position || 0)
              setEstimatedTime(response.data.data?.estimatedTime || 60)
              setIsTimeout(false)

              // 重新开始轮询
              startPolling()
            } else {
              Taro.showToast({
                title: response.data?.message || '重新生成失败',
                icon: 'none',
                duration: 3000
              })
            }
          } catch (error) {
            console.error('[OrderContentCreation] 重新生成异常:', error)
            Taro.showToast({
              title: '网络异常，请重试',
              icon: 'none',
              duration: 3000
            })
          } finally {
            setRegenerating(false)
          }
        }
      }
    })
  }

  const parseMarkdown = (text: string): string => {
    let html = text

    // 处理图片：![alt](url)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img class="md-image" src="$2" alt="$1" style="width: 100%; border-radius: 0.75rem; margin: 0.75rem 0;" />')

    // 处理引用块：> text
    html = html.replace(/^> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>')

    // 处理三级标题：### text
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3 block">$1</h3>')

    // 处理二级标题：## text
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2 block">$1</h2>')

    // 处理一级标题：# text
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1 block">$1</h1>')

    // 处理有序列表：1. text
    html = html.replace(/^\d+\.\s+(.*$)/gim, '<div class="md-list-item block"><span class="md-list-number">$&</span> <span class="md-list-text">$1</span></div>')

    // 处理粗体：**text**
    html = html.replace(/\*\*(.*?)\*\*/gim, '<text class="md-strong">$1</text>')

    // 处理换行
    html = html.replace(/\n/gim, '<br class="md-br block" />')

    return html
  }

  return (
    <View className="content-creation-page">
      <View
        className="page-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}
      >
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="#475569" />
        </View>
        <Text className="header-title block">制作内容</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="page-scroll" scrollY enableFlex>
        {loading && (
          <View className="loading-container">
            <View className="loading-icon">
              <Sparkles size={56} color="#3b82f6" />
            </View>
            <Text className="loading-title block">AI正在制作内容</Text>
            <Text className="loading-desc block">正在为您的订单生成优质内容...</Text>
            <Loader size={28} color="#3b82f6" className="loading-spinner" />
          </View>
        )}

        {!loading && (!contentData || !contentData.content || contentData.content.length === 0) && (
          <View className="loading-container">
            <View className="loading-icon">
              <Sparkles size={56} color="#3b82f6" />
            </View>

            {/* 当前步骤 */}
            <View className="progress-steps">
              {STEPS.map((step, index) => {
                const isCurrentStep = index === currentStepIndex
                const isCompletedStep = index < currentStepIndex

                return (
                  <View
                    key={step.key}
                    className={`step-item ${isCurrentStep ? 'current' : ''} ${isCompletedStep ? 'completed' : ''}`}
                  >
                    <View
                      className="step-icon"
                      style={{
                        backgroundColor: isCompletedStep ? '#22c55e' : isCurrentStep ? '#3b82f6' : '#e5e7eb'
                      }}
                    >
                      <Text style={{ color: isCompletedStep || isCurrentStep ? '#fff' : '#9ca3af' }}>
                        {isCompletedStep ? '✓' : step.icon}
                      </Text>
                    </View>
                    <View className="step-info">
                      <Text className="step-title block">{step.label}</Text>
                      <Text className="step-desc block">{step.desc}</Text>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* 队列位置提示 */}
            {queuePosition !== null && queuePosition > 0 && (
              <View className="queue-info">
                <Text className="queue-title block">排队位置</Text>
                <Text className="queue-value block">前面还有 {queuePosition} 个订单</Text>
              </View>
            )}

            {/* 时间提示 */}
            <View className="time-info">
              <View className="time-item">
                <Clock size={16} color="#3b82f6" />
                <Text className="time-label block">已用时</Text>
                <Text className="time-value block">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</Text>
              </View>
              {estimatedTime > 0 && (
                <View className="time-item">
                  <Text className="time-label block">预计</Text>
                  <Text className="time-value block">{Math.floor(estimatedTime / 60)}:{(estimatedTime % 60).toString().padStart(2, '0')}</Text>
                </View>
              )}
            </View>

            {/* 超时提示 */}
            {isTimeout && (
              <View className="timeout-warning">
                <Text className="timeout-title block">⚠️ 生成时间较长</Text>
                <Text className="timeout-desc block">内容生成时间超过预期，请耐心等待或手动刷新状态</Text>
              </View>
            )}

            {/* 刷新按钮 */}
            <Button
              className="refresh-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={16} color="#3b82f6" className={isRefreshing ? 'spinning' : ''} />
              <Text className="refresh-btn-text block">{isRefreshing ? '刷新中...' : '刷新状态'}</Text>
            </Button>

            {/* 加载动画 */}
            <Loader size={28} color="#3b82f6" className="loading-spinner" />
          </View>
        )}

        {!loading && contentData && contentData.content && contentData.content.length > 0 && (
          <View className="content-container">
            <View className="card order-info-card">
              <View
                className="card-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
              >
                <View style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} color="#3b82f6" />
                  <Text className="card-title block">订单信息</Text>
                </View>
              </View>
              <Text className="info-title block">{contentData.title}</Text>
              <View
                className="info-meta"
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}
              >
                {contentData.platforms && contentData.platforms.length > 0 ? (
                  contentData.platforms.map((platform: string) => (
                    <View
                      key={platform}
                      className="info-tag"
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      <Smartphone size={14} color="#3b82f6" />
                      <Text className="info-tag-text block">
                        {PLATFORM_NAMES[platform] || platform}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View
                    className="info-tag"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <Smartphone size={14} color="#3b82f6" />
                    <Text className="info-tag-text block">
                      未指定平台
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {contentData.images && contentData.images.length > 0 && (
              <View className="card media-card">
                <View
                  className="card-header"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
                >
                  <Text className="card-title block">图片展示</Text>
                  <Text className="card-subtitle block">{contentData.images.length}张图片</Text>
                </View>
                <View className="image-slider">
                  <Image
                    className="current-image"
                    src={contentData.images[currentImageIndex]}
                    mode="aspectFill"
                  />
                  {contentData.images.length > 1 && (
                    <View
                      className="image-indicators"
                      style={{ display: 'flex', gap: '0.375rem' }}
                    >
                      {contentData.images.map((_, index) => (
                        <View
                          key={index}
                          className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {contentData.videos && contentData.videos.length > 0 && (
              <View className="card media-card">
                <View
                  className="card-header"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
                >
                  <Text className="card-title block">视频展示</Text>
                  <Text className="card-subtitle block">{contentData.videos.length}个视频</Text>
                </View>
                {contentData.videos.map((videoUrl, index) => (
                  <Video
                    key={index}
                    className="video-player"
                    src={videoUrl}
                    controls
                    autoplay={false}
                  />
                ))}
              </View>
            )}

            <View className="card content-card">
              <View
                className="card-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}
              >
                <Text className="card-title block">内容预览</Text>
              </View>

              <View
                className="card-actions"
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'flex-end' }}
              >
                {isEditing ? (
                  <View
                    className="action-buttons"
                    style={{ display: 'flex', gap: '0.375rem' }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      style={{ fontSize: '0.75rem', height: '2rem', padding: '0 0.75rem' }}
                    >
                      <Text className="action-btn-text block">取消</Text>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      style={{ fontSize: '0.75rem', height: '2rem', padding: '0 0.75rem' }}
                    >
                      <Text className="action-btn-text block">保存</Text>
                    </Button>
                  </View>
                ) : (
                  <View
                    className="action-buttons"
                    style={{ display: 'flex', gap: '0.375rem' }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      style={{ fontSize: '0.75rem', height: '2rem', padding: '0 0.75rem' }}
                    >
                      <Text className="action-btn-text block">重新生成</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      style={{ fontSize: '0.75rem', height: '2rem', padding: '0 0.75rem' }}
                    >
                      <Text className="action-btn-text block">编辑</Text>
                    </Button>
                  </View>
                )}
              </View>

              {isEditing ? (
                <View className="edit-mode">
                  <Textarea
                    className="content-textarea"
                    placeholder="编辑内容..."
                    defaultValue={editedContent}
                    onBlur={(e) => setEditedContent(e.detail.value)}
                    maxlength={5000}
                    style={{ minHeight: '20rem' }}
                  />
                </View>
              ) : (
                <View
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(contentData.content) }}
                />
              )}
            </View>

            <View className="publish-section">
              {/* 发布提示 */}
              {contentData.platforms && contentData.platforms.length > 0 && (
                <View className="publish-tip">
                  <Text className="publish-tip-title block">发布说明</Text>
                  <View className="publish-tip-content">
                    <Text className="publish-tip-text block">
                      点击发布后，将尝试自动发布到以下平台：
                    </Text>
                    <View style={{ marginTop: '0.5rem' }}>
                      {contentData.platforms.map((platform: string) => {
                        const platformName = PLATFORM_NAMES[platform] || platform
                        const needManual = ['wechat_moments', 'wechat_video'].includes(platform)
                        return (
                          <View key={platform} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <Text style={{ fontSize: '0.875rem', color: needManual ? '#f59e0b' : '#3b82f6' }}>
                              {needManual ? '⚠ ' : '✓ '}{platformName}
                            </Text>
                            {needManual && (
                              <Text style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.25rem' }}>
                                （需手动发布）
                              </Text>
                            )}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                </View>
              )}

              <Button
                className="publish-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <Loader size={18} color="#fff" />
                    <Text className="publish-btn-text block">发布中...</Text>
                  </>
                ) : (
                  <>
                    <Check size={18} color="#fff" />
                    <Text className="publish-btn-text block">确认发布</Text>
                  </>
                )}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
