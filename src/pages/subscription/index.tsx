import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, navigateBack, showToast, getSystemInfoSync } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { Crown, ArrowLeft, Star, Zap, Shield, Users, Check, Sparkles } from 'lucide-react-taro'
import './index.css'

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  duration_days: number
  max_avatars: number
  can_receive_orders: boolean
  order_priority: number
  features: {
    max_friends: number
    avatar_storage_limit: string
    priority_support?: boolean
    advanced_analytics?: boolean
    personal_manager?: boolean
  }
}

interface UserSubscription {
  id: string
  status: 'active' | 'expired' | 'cancelled'
  plan?: SubscriptionPlan
  start_date: string
  end_date: string
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    // 获取状态栏高度
    const systemInfo = getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    fetchPlans()
    fetchUserSubscription()
  })

  const fetchPlans = async () => {
    try {
      const res = await Network.request({
        url: '/api/subscription/plans'
      })
      if (res.data?.code === 200) {
        setPlans(res.data.data || [])
      }
    } catch (error) {
      console.error('获取订阅计划失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserSubscription = async () => {
    try {
      const res = await Network.request({
        url: '/api/subscription/user'
      })
      if (res.data?.code === 200 && res.data.data) {
        setUserSubscription(res.data.data)
      }
    } catch (error) {
      console.error('获取用户订阅失败:', error)
    }
  }

  const handlePurchase = async (plan: SubscriptionPlan) => {
    if (plan.price === 0) {
      showToast({ title: '免费版无需购买', icon: 'none' })
      return
    }

    setPurchasing(true)
    setSelectedPlan(plan)

    try {
      // 获取用户 openid
      const { code } = await Taro.login()

      const openidRes = await Network.request({
        url: '/api/auth/wechat/get-openid',
        method: 'POST',
        data: { code }
      })

      const openid = openidRes.data?.data?.openid
      if (!openid) {
        showToast({ title: '获取用户信息失败', icon: 'none' })
        return
      }

      // 创建支付订单
      const res = await Network.request({
        url: '/api/subscription/order',
        method: 'POST',
        data: {
          planId: plan.id,
          paymentMethod: 'wechat',
          openid
        }
      })

      console.log('[订阅] 订单创建响应:', res.data)

      if (res.data?.code === 200) {
        const payParams = res.data.data
        const message = res.data.message

        // 检查是否为模拟支付
        if (message && message.includes('模拟支付')) {
          // 模拟支付模式下，订阅已自动激活，直接刷新
          console.log('[订阅] 使用模拟支付模式，订阅已激活')
          showToast({ title: message, icon: 'success' })
          await fetchUserSubscription()
        } else if (payParams.isMock) {
          // 模拟支付模式下直接调用支付成功回调
          console.log('[订阅] 使用模拟支付模式')
          showToast({ title: '支付成功（模拟）', icon: 'success' })
          await fetchUserSubscription()
        } else {
          // 真实支付：调用微信支付
          await Taro.requestPayment({
            timeStamp: payParams.timeStamp,
            nonceStr: payParams.nonceStr,
            package: payParams.package,
            signType: payParams.signType,
            paySign: payParams.paySign,
            success: async () => {
              showToast({ title: '支付成功！', icon: 'success' })
              await fetchUserSubscription()
            },
            fail: (err) => {
              console.error('支付失败:', err)
              showToast({ title: '支付已取消', icon: 'none' })
            }
          })
        }
      } else {
        showToast({ title: res.data?.message || '创建订单失败', icon: 'none' })
      }
    } catch (error) {
      console.error('订阅失败:', error)
      showToast({ title: '订阅失败，请重试', icon: 'none' })
    } finally {
      setPurchasing(false)
      setSelectedPlan(null)
    }
  }

  const renderFeatures = (features: SubscriptionPlan['features'], plan: SubscriptionPlan) => {
    const maxAvatars = plan.max_avatars === -1 ? '无限' : plan.max_avatars
    const maxFriends = features.max_friends === -1 ? '无限' : features.max_friends

    return (
      <View className="sub-features">
        <View className="sub-feature-item">
          <Users size={18} color="#00f5ff" />
          <Text className="sub-feature-text">
            最多 {maxAvatars === -1 ? '无限' : maxAvatars} 个分身
          </Text>
        </View>
        <View className="sub-feature-item">
          <Check size={18} color="#00ff88" />
          <Text className="sub-feature-text">
            最多 {maxFriends === -1 ? '无限' : maxFriends} 个好友
          </Text>
        </View>
        {plan.can_receive_orders ? (
          <View className="sub-feature-item">
            <Zap size={18} color="#ffd700" />
            <Text className="sub-feature-text">🎮 打工赚钱·接单优先级 +{plan.order_priority}</Text>
          </View>
        ) : (
          <View className="sub-feature-item">
            <Shield size={18} color="#64748b" />
            <Text className="sub-feature-text" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>💼 暂不支持打工赚钱</Text>
          </View>
        )}
        {features.priority_support && (
          <View className="sub-feature-item">
            <Shield size={18} color="#ff6b9d" />
            <Text className="sub-feature-text">优先客服支持</Text>
          </View>
        )}
        {features.advanced_analytics && (
          <View className="sub-feature-item">
            <Zap size={18} color="#00f5ff" />
            <Text className="sub-feature-text">高级数据分析</Text>
          </View>
        )}
        {features.personal_manager && (
          <View className="sub-feature-item">
            <Crown size={18} color="#ffd700" />
            <Text className="sub-feature-text">专属客户经理</Text>
          </View>
        )}
      </View>
    )
  }

  const getPlanCardClass = (index: number) => {
    if (index === 3) return 'sub-card sub-card-vip'
    if (index === 2) return 'sub-card sub-card-premium'
    if (index === 1) return 'sub-card sub-card-basic'
    return 'sub-card sub-card-free'
  }

  const getPlanBadge = (index: number) => {
    if (index === 3) return '尊享'
    if (index === 2) return '推荐'
    if (index === 1) return ''
    return '免费'
  }

  const getPlanIcon = (index: number) => {
    if (index === 3) return <Crown size={20} color="#ffd700" />
    if (index === 2) return <Sparkles size={20} color="#00ff88" />
    if (index === 1) return <Star size={20} color="#00f5ff" />
    return <Check size={20} color="#64748b" />
  }

  return (
    <View className="sub-page">
      {/* 动态背景光点 */}
      <View className="sub-bg-glow" />

      {/* 顶部导航 - 适配状态栏 */}
      <View className="sub-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="sub-header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#a855f7" />
        </View>
        <Text className="sub-header-title gradient-text">订阅中心</Text>
        <View className="sub-header-right" />
      </View>

      <ScrollView className="sub-scroll" scrollY>
        <View className="sub-scroll-inner">
        {/* 当前订阅状态 */}
        {!loading && userSubscription && userSubscription.plan && (
          <View className="sub-current">
            <View className="sub-current-header">
              {userSubscription.status === 'active' ? (
                <>
                  <Crown size={28} color="#ffd700" />
                  <Text className="sub-current-title">当前订阅</Text>
                  <Sparkles size={20} color="#ffd700" />
                </>
              ) : (
                <>
                  <Crown size={28} color="#ff6b6b" />
                  <Text className="sub-current-title" style={{ color: '#ff6b6b' }}>
                    {userSubscription.status === 'expired' ? '订阅已过期' : '订阅已取消'}
                  </Text>
                </>
              )}
            </View>
            <View className="sub-current-info">
              <Text className="sub-current-plan">{userSubscription.plan.name}</Text>
              <Text className="sub-current-date">
                {userSubscription.status === 'active'
                  ? `到期时间: ${new Date(userSubscription.end_date).toLocaleDateString('zh-CN')}`
                  : `到期时间: ${new Date(userSubscription.end_date).toLocaleDateString('zh-CN')}`
                }
              </Text>
            </View>
            <View className="sub-current-features">
              {renderFeatures(userSubscription.plan.features, userSubscription.plan)}
            </View>
          </View>
        )}

        {!loading && !userSubscription && (
          <View className="sub-current" style={{ border: '2rpx solid rgba(255, 255, 255, 0.1)' }}>
            <View className="sub-current-header">
              <Crown size={28} color="#ffffff" />
              <Text className="sub-current-title" style={{ color: '#ffffff' }}>暂无订阅</Text>
            </View>
            <View className="sub-current-info">
              <Text className="sub-current-plan" style={{ color: '#ffffff' }}>免费用户</Text>
              <Text className="sub-current-date" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                您可以创建 1 个分身，最多添加 10 个好友
              </Text>
            </View>
            <View className="sub-current-features">
              <View className="sub-features">
                <View className="sub-feature-item">
                  <Users size={18} color="#64748b" />
                  <Text className="sub-feature-text" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>最多 1 个分身</Text>
                </View>
                <View className="sub-feature-item">
                  <Check size={18} color="#64748b" />
                  <Text className="sub-feature-text" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>最多 10 个好友</Text>
                </View>
                <View className="sub-feature-item">
                  <Shield size={18} color="#64748b" />
                  <Text className="sub-feature-text" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>💼 暂不支持打工赚钱</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 订阅计划列表 */}
        <View className="sub-plans">
          <Text className="sub-section-title">
            <Sparkles size={20} color="#00f5ff" />
            选择订阅计划
            <Sparkles size={20} color="#00f5ff" />
          </Text>

          {loading ? (
            <View className="sub-loading">
              <Text className="sub-loading-text">加载中...</Text>
            </View>
          ) : (
            <View className="sub-plans-list">
              {plans.map((plan, index) => {
                const isCurrentPlan = userSubscription?.plan?.id === plan.id
                const isPurchasing = purchasing && selectedPlan?.id === plan.id

                return (
                  <View
                    key={plan.id}
                    className={getPlanCardClass(index)}
                    style={{ '--card-index': index } as any}
                  >
                    {getPlanBadge(index) && (
                      <View className={`sub-badge ${index === 3 ? 'sub-badge-vip' : index === 2 ? 'sub-badge-premium' : ''}`}>
                        <Text className="sub-badge-text">{getPlanBadge(index)}</Text>
                      </View>
                    )}

                    <View className="sub-card-header">
                      <View className="sub-card-name-row">
                        {getPlanIcon(index)}
                        <Text className="sub-card-name">{plan.name}</Text>
                      </View>
                      <View className="sub-card-price">
                        <Text className="sub-card-amount">
                          {plan.price > 0 ? `¥${plan.price}` : '免费'}
                        </Text>
                        <Text className="sub-card-period">/{plan.duration_days}天</Text>
                      </View>
                    </View>

                    <Text className="sub-card-description">{plan.description}</Text>

                    {renderFeatures(plan.features, plan)}

                    <Button
                      className={`sub-card-button ${isCurrentPlan ? 'sub-card-button-disabled' : ''}`}
                      onClick={() => handlePurchase(plan)}
                      disabled={isPurchasing || isCurrentPlan}
                    >
                      <Text>
                        {isPurchasing ? (
                          '购买中...'
                        ) : isCurrentPlan ? (
                          '当前订阅'
                        ) : plan.price === 0 ? (
                          '免费使用'
                        ) : (
                          '立即订阅'
                        )}
                      </Text>
                    </Button>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* 订阅须知 */}
        <View className="sub-notice">
          <Text className="sub-notice-title">订阅须知</Text>
          <Text className="sub-notice-item">✨ 订阅后立即生效，到期自动续费</Text>
          <Text className="sub-notice-item">✨ 订阅期间可随时取消，不退还已支付费用</Text>
          <Text className="sub-notice-item">✨ 升级订阅时，剩余天数按比例折算</Text>
          <Text className="sub-notice-item">✨ 好友数量限制根据订阅等级不同而不同</Text>
          <Text className="sub-notice-item">✨ 订阅等级越高，好友数量越多</Text>
          <Text className="sub-notice-item">✨ 付费分身优先获得订单分配</Text>
          <Text className="sub-notice-item">✨ 订阅等级越高，订单优先级越高</Text>
        </View>

        <View className="sub-bottom-space" />
        </View>
      </ScrollView>
    </View>
  )
}
