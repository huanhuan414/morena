import { useLoad, useRouter, navigateBack, showToast, showModal, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { Sparkles, Check, X, Calendar, Wallet, Smartphone, Target, Clock } from 'lucide-react-taro'
import './index.css'

interface PendingOrderData {
  id: string
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

  useLoad(() => {
    if (requestId) {
      fetchOrderDetail()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: `/api/order-dispatch/pending-requests` })
      if (res.data?.code === 200) {
        const requests = res.data.data
        const request = requests.find((r: PendingOrderData) => r.id === requestId)
        if (request) {
          setOrderData(request)
        } else {
          showToast({ title: '订单不存在', icon: 'none' })
          setTimeout(() => navigateBack(), 1500)
        }
      }
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
              url: `/api/order-dispatch/request/${requestId}/accept`,
              method: 'PUT',
              data: { avatarId: orderData.avatars.id }
            })

            if (result.data?.code === 200) {
              showToast({ title: '接受成功，正在生成内容', icon: 'success' })
              // 延迟后跳转到效果反馈页面
              setTimeout(() => {
                navigateTo({
                  url: `/pages/order-feedback/index?orderId=${orderData.orders.id}&avatarId=${orderData.avatars.id}`
                })
              }, 2000)
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

  const getRemainingTime = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  }

  if (loading) {
    return (
      <View className="pending-order-page">
        <View className="loading-container">
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
      <ScrollView className="page-scroll" scrollY>
        {/* 顶部倒计时 */}
        <View className="countdown-section">
          <Clock size={16} color="#f59e0b" />
          <Text className="countdown-text">
            剩余时间：{getRemainingTime(orderData.expires_at)}
          </Text>
        </View>

        {/* 订单详情卡片 */}
        <View className="order-card">
          <View className="card-header">
            <Text className="card-title">订单信息</Text>
            <Check size={18} color="#00f5ff" />
          </View>

          <View className="order-main">
            <Text className="order-title">{orderData.orders.title}</Text>
            <Text className="order-desc">{orderData.orders.description}</Text>
          </View>

          <View className="order-meta-grid">
            <View className="meta-item">
              <Wallet size={16} color="#22c55e" />
              <Text className="meta-label">预算</Text>
              <Text className="meta-value">¥{orderData.orders.budget}</Text>
            </View>
            <View className="meta-item">
              <Smartphone size={16} color="#3b82f6" />
              <Text className="meta-label">平台</Text>
              <Text className="meta-value">{orderData.orders.platforms?.join('、') || '全平台'}</Text>
            </View>
            <View className="meta-item">
              <Target size={16} color="#8b5cf6" />
              <Text className="meta-label">受众</Text>
              <Text className="meta-value">{orderData.orders.target_audience || '不限'}</Text>
            </View>
            <View className="meta-item">
              <Calendar size={16} color="#f59e0b" />
              <Text className="meta-label">截止</Text>
              <Text className="meta-value">
                {orderData.orders.deadline
                  ? new Date(orderData.orders.deadline).toLocaleDateString()
                  : '不限'}
              </Text>
            </View>
          </View>
        </View>

        {/* 分身信息卡片 */}
        <View className="avatar-card">
          <View className="card-header">
            <Text className="card-title">执行分身</Text>
            <Sparkles size={18} color="#00f5ff" />
          </View>

          <View className="avatar-info">
            <View className="avatar-left">
              <View className="avatar-wrap">
                {orderData.avatars.avatar_url ? (
                  <Image src={orderData.avatars.avatar_url} className="avatar-img" mode="aspectFill" />
                ) : (
                  <View className="avatar-placeholder">
                    <Sparkles size={32} color="#00f5ff" />
                  </View>
                )}
              </View>
              <View className="avatar-details">
                <Text className="avatar-name">{orderData.avatars.name}</Text>
                <View className="avatar-badges">
                  <View className="avatar-badge level">
                    <Text className="badge-text">Lv.{orderData.avatars.level}</Text>
                  </View>
                  {orderData.avatars.is_hosted && (
                    <View className="avatar-badge hosted">
                      <Text className="badge-text">已托管</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View className="avatar-stats">
              <View className="stat-item">
                <Text className="stat-value">{orderData.avatars.completion_rate}%</Text>
                <Text className="stat-label">完成率</Text>
              </View>
              <View className="stat-divider" />
              <View className="stat-item">
                <Text className="stat-value">{orderData.avatars.avg_rating}</Text>
                <Text className="stat-label">评分</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 提示信息 */}
        <View className="tips-section">
          <Check size={16} color="#f59e0b" />
          <Text className="tips-text">
            接受订单后，系统将自动为您生成适合平台的内容，您可以在完成发布后提交效果数据。
          </Text>
        </View>
      </ScrollView>

      {/* 底部操作按钮 */}
      <View className="bottom-actions">
        <Button
          className="reject-btn"
          onClick={handleReject}
          disabled={rejecting || accepting}
        >
          <X size={18} color="rgba(255,255,255,0.6)" />
          <Text className="btn-text">拒绝订单</Text>
        </Button>
        <Button
          className="accept-btn"
          onClick={handleAccept}
          disabled={rejecting || accepting}
        >
          {accepting ? (
            <Text className="btn-text">处理中...</Text>
          ) : (
            <>
              <Check size={18} color="#fff" />
              <Text className="btn-text">接受订单</Text>
            </>
          )}
        </Button>
      </View>
    </View>
  )
}
