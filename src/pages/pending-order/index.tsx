import { useLoad, useRouter, navigateBack, showToast, showModal, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, RichText } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import { Sparkles, Check, X, Calendar, Wallet, Smartphone, Target, Clock, TrendingUp, Zap, User } from 'lucide-react-taro'
import './index.css'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手',
  wechat_moments: '朋友圈',
  wechat_video: '视频号'
}

// 获取平台中文名称
const getPlatformNames = (platforms?: string[]): string => {
  if (!platforms || platforms.length === 0) return '全平台'
  return platforms.map(p => PLATFORM_NAMES[p] || p).join('、')
}

// 简单的 Markdown 解析器
const parseMarkdown = (text: string): string => {
  if (!text) return ''

  let html = text

  // 转义 HTML 特殊字符
  html = html.replace(/&/g, '&amp;')
  html = html.replace(/</g, '&lt;')
  html = html.replace(/>/g, '&gt;')

  // 标题（# H1, ## H2, ### H3）
  html = html.replace(/^### (.+)$/gm, '<text class="md-h3">$1</text>\n')
  html = html.replace(/^## (.+)$/gm, '<text class="md-h2">$1</text>\n')
  html = html.replace(/^# (.+)$/gm, '<text class="md-h1">$1</text>\n')

  // 粗体（**text**）
  html = html.replace(/\*\*(.+?)\*\*/g, '<text class="md-bold">$1</text>')

  // 斜体（*text*）
  html = html.replace(/\*(.+?)\*/g, '<text class="md-italic">$1</text>')

  // 无序列表（- item）
  html = html.replace(/^- (.+)$/gm, '<text class="md-li">• $1</text>')

  // 链接（[text](url)）- 只显示文本
  html = html.replace(/\[([^\]]+)\]\([^)]+\)/g, '<text class="md-link">$1</text>')

  // 换行符
  html = html.replace(/\n\n/g, '\n\n')

  return html
}

interface PendingOrderData {
  id: string
  status?: string
  orders: {
    id: string
    title: string
    description: string
    budget: number
    content_type: string
    platforms: string[]
    target_audience: string
    deadline: string
    created_at: string
  }
  avatars: {
    id: string
    name: string
    avatar_url: string
    level: number
    completion_rate: number
    avg_rating: number
    is_hosted: boolean
  }
  created_at: string
  expires_at: string
}

export default function PendingOrderPage() {
  const router = useRouter()
  const requestId = router.params.requestId

  const [orderData, setOrderData] = useState<PendingOrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [remainingTime, setRemainingTime] = useState('')

  // 执行反馈表单
  const [feedback, setFeedback] = useState({
    content: '',
    impressions: '',
    likes: '',
    comments: '',
    shares: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useLoad(() => {
    if (requestId) {
      fetchOrderDetail()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  // 倒计时实时更新
  useEffect(() => {
    if (!orderData) return

    const updateRemainingTime = () => {
      const now = new Date()
      const expires = new Date(orderData.expires_at)
      const diff = expires.getTime() - now.getTime()

      if (diff <= 0) {
        setRemainingTime('已过期')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setRemainingTime(`${hours}小时${minutes}分${seconds}秒`)
      } else if (minutes > 0) {
        setRemainingTime(`${minutes}分${seconds}秒`)
      } else {
        setRemainingTime(`${seconds}秒`)
      }
    }

    updateRemainingTime()
    const timer = setInterval(updateRemainingTime, 1000)

    return () => clearInterval(timer)
  }, [orderData])

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)

      const res = await Network.request({ url: `/api/order-dispatch/pending-requests` })
      if (res.data?.code === 200) {
        const requests = res.data.data
        const request = requests.find((r: PendingOrderData) => r.id === requestId)
        if (request) {
          console.log('[PendingOrder] 订单数据:', {
            requestId,
            orderId: request.orders?.id,
            title: request.orders?.title,
            titleLength: request.orders?.title?.length,
            descriptionPreview: request.orders?.description?.substring(0, 50)
          })
          setOrderData(request)
          setLoading(false)
          return
        }
      }

      showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '获取失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!orderData) return

    showModal({
      title: '确认接受订单',
      content: `确定接受订单"${orderData.orders.title}"吗？接受后将自动为您生成内容。`,
      success: async (res) => {
        if (res.confirm) {
          setAccepting(true)
          try {
            const result = await Network.request({
              url: `/api/order-dispatch/request/${requestId}/confirm`,
              method: 'PUT',
              data: { avatarId: orderData.avatars.id }
            })

            if (result.data?.code === 200) {
              showToast({ title: '接受成功', icon: 'success' })
              setTimeout(() => {
                navigateTo({
                  url: `/pages/order-processing/index?requestId=${requestId}&avatarId=${orderData.avatars.id}&orderId=${orderData.orders.id}`
                })
              }, 1500)
            } else {
              showToast({ title: result.data?.message || '接受失败', icon: 'none' })
            }
          } catch (error) {
            console.error('接受订单失败:', error)
            showToast({ title: '接受失败', icon: 'none' })
          } finally {
            setAccepting(false)
          }
        }
      }
    })
  }

  const handleReject = async () => {
    if (!orderData) return

    showModal({
      title: '拒绝订单',
      content: `确定拒绝订单"${orderData.orders.title}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          setRejecting(true)
          try {
            const result = await Network.request({
              url: `/api/order-dispatch/request/${requestId}/reject`,
              method: 'PUT',
              data: { avatarId: orderData.avatars.id }
            })

            if (result.data?.code === 200) {
              showToast({ title: '已拒绝订单', icon: 'success' })
              setTimeout(() => navigateBack(), 1500)
            } else {
              showToast({ title: result.data?.message || '拒绝失败', icon: 'none' })
            }
          } catch (error) {
            console.error('拒绝订单失败:', error)
            showToast({ title: '拒绝失败', icon: 'none' })
          } finally {
            setRejecting(false)
          }
        }
      }
    })
  }

  const handleSubmitFeedback = async () => {
    if (!feedback.content) {
      showToast({ title: '请填写执行内容', icon: 'none' })
      return
    }

    showModal({
      title: '确认提交反馈',
      content: '确定提交执行反馈并完成订单吗？',
      success: async (res) => {
        if (res.confirm) {
          setSubmitting(true)
          try {
            const result = await Network.request({
              url: `/api/order-feedback/submit`,
              method: 'POST',
              data: {
                requestId,
                avatarId: orderData?.avatars?.id,
                content: feedback.content,
                metrics: {
                  impressions: parseInt(feedback.impressions) || 0,
                  likes: parseInt(feedback.likes) || 0,
                  comments: parseInt(feedback.comments) || 0,
                  shares: parseInt(feedback.shares) || 0
                }
              }
            })

            if (result.data?.code === 200) {
              showToast({ title: '提交成功', icon: 'success' })
              setTimeout(() => navigateBack(), 1500)
            } else {
              showToast({ title: result.data?.message || '提交失败', icon: 'none' })
            }
          } catch (error) {
            console.error('提交反馈失败:', error)
            showToast({ title: '提交失败', icon: 'none' })
          } finally {
            setSubmitting(false)
          }
        }
      }
    })
  }

  if (loading) {
    return (
      <View className="pending-order-page">
        <View className="loading-wrapper">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!orderData) {
    return null
  }

  return (
    <View className="pending-order-page">
      {/* 背景装饰 */}
      <View className="bg-decoration bg-1" />
      <View className="bg-decoration bg-2" />

      <ScrollView className="page-scroll" scrollY>
        {/* 顶部倒计时 */}
        <View className="countdown-wrapper">
          <View className="countdown-card">
            <Clock size={20} color="#ff6b35" className="countdown-icon pulse" />
            <View className="countdown-content">
              <Text className="countdown-label">剩余时间</Text>
              <Text className={`countdown-value ${remainingTime === '已过期' ? 'expired' : ''}`}>
                {remainingTime}
              </Text>
            </View>
          </View>
        </View>

        {/* 订单标题卡片 */}
        <View className="section-wrapper">
          <View className="order-title-card">
            <View className="title-badge">
              <Sparkles size={14} color="#fff" />
              <Text className="badge-text">优质订单</Text>
            </View>
            <Text className="order-title-text">{orderData.orders.title}</Text>
            <Text className="order-subtitle">智能匹配 · AI辅助 · 自动生成</Text>
          </View>
        </View>

        {/* 预算和收益 */}
        <View className="section-wrapper">
          <View className="budget-card">
            <View className="budget-item">
              <Wallet size={24} color="#10b981" />
              <View className="budget-content">
                <Text className="budget-label">订单预算</Text>
                <Text className="budget-value">¥{orderData.orders.budget}</Text>
              </View>
            </View>
            <View className="budget-divider" />
            <View className="budget-item">
              <TrendingUp size={24} color="#8b5cf6" />
              <View className="budget-content">
                <Text className="budget-label">预估收益</Text>
                <Text className="budget-value">
                  ¥{Math.floor(orderData.orders.budget * 0.8)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 订单详情卡片 */}
        <View className="section-wrapper">
          <View className="detail-card">
            <View className="detail-header">
              <View className="detail-title-wrapper">
                <Target size={20} color="#3b82f6" />
                <Text className="detail-title">订单详情</Text>
              </View>
            </View>

            <View className="detail-content">
              <View className="info-row">
                <Text className="info-label block">发布平台</Text>
                <View className="info-value-wrapper">
                  <Smartphone size={16} color="#6366f1" />
                  <Text className="info-value block">{getPlatformNames(orderData.orders.platforms)}</Text>
                </View>
              </View>

              <View className="info-row">
                <Text className="info-label block">目标受众</Text>
                <View className="info-value-wrapper">
                  <User size={16} color="#f43f5e" />
                  <Text className="info-value block">{orderData.orders.target_audience || '不限'}</Text>
                </View>
              </View>

              <View className="info-row">
                <Text className="info-label block">截止日期</Text>
                <View className="info-value-wrapper">
                  <Calendar size={16} color="#f59e0b" />
                  <Text className="info-value block">
                    {orderData.orders.deadline
                      ? new Date(orderData.orders.deadline).toLocaleDateString()
                      : '不限'}
                  </Text>
                </View>
              </View>

              <View className="description-wrapper">
                <Text className="desc-title block">需求描述</Text>
                <RichText className="desc-text" nodes={parseMarkdown(orderData.orders.description || '暂无详细需求描述')} />
              </View>
            </View>
          </View>
        </View>

        {/* 提示信息 */}
        <View className="section-wrapper">
          <View className="tips-card">
            <Check size={18} color="#f59e0b" className="tips-icon" />
            <Text className="tips-text block">
              接受订单后，系统将自动为您生成适合平台的内容，您可以在完成发布后提交效果数据。
            </Text>
          </View>
        </View>

        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>

      {/* 底部操作按钮 */}
      {orderData.status === 'pending' && (
        <View className="bottom-actions-wrapper">
          <View className="bottom-actions">
            <Button
              className="action-btn reject-btn"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? (
                <Text className="btn-text">处理中...</Text>
              ) : (
                <>
                  <X size={20} color="#fff" />
                  <Text className="btn-text">拒绝订单</Text>
                </>
              )}
            </Button>
            <Button
              className="action-btn accept-btn"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <Text className="btn-text">处理中...</Text>
              ) : (
                <>
                  <Zap size={20} color="#fff" />
                  <Text className="btn-text">立即接受</Text>
                </>
              )}
            </Button>
          </View>
        </View>
      )}

      {/* 进行中订单 - 执行反馈表单 */}
      {orderData.status === 'accepted' && (
        <View className="feedback-wrapper">
          <View className="feedback-card">
            <View className="feedback-header">
              <Check size={24} color="#10b981" />
              <Text className="feedback-title">执行反馈</Text>
            </View>

            <View className="feedback-form">
              <View className="form-group">
                <Text className="form-label block">执行内容 *</Text>
                <Textarea
                  className="form-textarea"
                  placeholder="请详细描述执行过程和结果"
                  value={feedback.content}
                  onInput={(e) => setFeedback({ ...feedback, content: e.detail.value })}
                  maxlength={500}
                />
              </View>

              <View className="form-grid">
                <View className="form-item">
                  <Text className="form-input-label block">曝光量</Text>
                  <Input
                    className="form-input-field"
                    type="number"
                    placeholder="0"
                    value={feedback.impressions}
                    onInput={(e) => setFeedback({ ...feedback, impressions: e.detail.value })}
                  />
                </View>
                <View className="form-item">
                  <Text className="form-input-label block">点赞数</Text>
                  <Input
                    className="form-input-field"
                    type="number"
                    placeholder="0"
                    value={feedback.likes}
                    onInput={(e) => setFeedback({ ...feedback, likes: e.detail.value })}
                  />
                </View>
                <View className="form-item">
                  <Text className="form-input-label block">评论数</Text>
                  <Input
                    className="form-input-field"
                    type="number"
                    placeholder="0"
                    value={feedback.comments}
                    onInput={(e) => setFeedback({ ...feedback, comments: e.detail.value })}
                  />
                </View>
                <View className="form-item">
                  <Text className="form-input-label block">分享数</Text>
                  <Input
                    className="form-input-field"
                    type="number"
                    placeholder="0"
                    value={feedback.shares}
                    onInput={(e) => setFeedback({ ...feedback, shares: e.detail.value })}
                  />
                </View>
              </View>

              <Button
                className="submit-btn"
                onClick={handleSubmitFeedback}
                disabled={submitting}
              >
                {submitting ? (
                  <Text className="btn-text">提交中...</Text>
                ) : (
                  <>
                    <Check size={18} color="#fff" />
                    <Text className="btn-text">提交反馈并完成订单</Text>
                  </>
                )}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
