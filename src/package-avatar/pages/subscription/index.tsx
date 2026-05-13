import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, navigateBack, showToast, getSystemInfoSync } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import {
  ArrowLeft, Crown, Users, Zap, Sparkles, Check, X,
  Shield, TrendingUp, Palette, Bot, ChartBar, Headphones,
  Rocket, Star, Flame, Gift
} from 'lucide-react-taro'
import './index.css'

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  durationDays: number
  maxAvatars: number
  canReceiveOrders: boolean
  orderPriority: number
  features: any
  isActive: number
}

interface UserSubscription {
  id: string
  status: 'active' | 'expired' | 'cancelled'
  plan?: SubscriptionPlan
  startDate: string
  endDate: string
  maxAvatars: number
  canReceiveOrders: boolean
}

// 权益对比项定义
const COMPARISON_ITEMS = [
  { key: 'maxAvatars', label: 'AI分身数量', icon: Users, freeVal: '1个', basicVal: '3个', proVal: '10个', enterpriseVal: '无限' },
  { key: 'canReceiveOrders', label: '接单赚钱', icon: Zap, freeVal: false, basicVal: false, proVal: true, enterpriseVal: true },
  { key: 'skillUsesPerDay', label: '技能使用次数/天', icon: Sparkles, freeVal: '3次', basicVal: '10次', proVal: '50次', enterpriseVal: '无限' },
  { key: 'skillCategories', label: '技能类目', icon: Bot, freeVal: '生活类', basicVal: '生活+创作', proVal: '4大类目', enterpriseVal: '全类目' },
  { key: 'contentStyles', label: '内容风格', icon: Palette, freeVal: '1种', basicVal: '3种', proVal: '6种', enterpriseVal: '8种+' },
  { key: 'customPersonality', label: '自定义分身性格', icon: Star, freeVal: false, basicVal: true, proVal: true, enterpriseVal: true },
  { key: 'batchPublish', label: '批量发布', icon: Rocket, freeVal: false, basicVal: false, proVal: true, enterpriseVal: true },
  { key: 'analytics', label: '数据分析', icon: ChartBar, freeVal: false, basicVal: false, proVal: true, enterpriseVal: true },
  { key: 'prioritySupport', label: '优先客服', icon: Headphones, freeVal: false, basicVal: false, proVal: true, enterpriseVal: true },
  { key: 'orderPriority', label: '订单优先级', icon: TrendingUp, freeVal: '普通', basicVal: '优先', proVal: '高级', enterpriseVal: '最高' },
  { key: 'storageLimit', label: '存储空间', icon: Shield, freeVal: '100MB', basicVal: '1GB', proVal: '10GB', enterpriseVal: '100GB' },
  { key: 'exclusiveSkills', label: '专属技能', icon: Gift, freeVal: false, basicVal: false, proVal: false, enterpriseVal: true },
]

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    const systemInfo = getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    fetchPlans()
    fetchUserSubscription()
  })

  const fetchPlans = async () => {
    try {
      const res = await Network.request({ url: '/api/subscription/plans' })
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
      const userStr = Taro.getStorageSync('userInfo')
      const userId = userStr ? (typeof userStr === 'string' ? JSON.parse(userStr).id : userStr.id) : ''
      if (!userId) return

      const res = await Network.request({ url: `/api/subscription/status?userId=${userId}` })
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
      const userStr = Taro.getStorageSync('userInfo')
      const userId = userStr ? (typeof userStr === 'string' ? JSON.parse(userStr).id : userStr.id) : ''
      if (!userId) {
        showToast({ title: '请先登录', icon: 'none' })
        return
      }

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

      const res = await Network.request({
        url: '/api/subscription/order',
        method: 'POST',
        data: { planId: plan.id, userId, openid }
      })

      if (res.data?.code === 200) {
        const payParams = res.data.data
        const requestPayParams = {
          timeStamp: String(payParams.timeStamp),
          nonceStr: String(payParams.nonceStr),
          package: payParams.packageValue || `prepay_id=${payParams.prepayId}`,
          signType: 'RSA' as const,
          paySign: String(payParams.paySign),
        }

        try {
          await Taro.requestPayment(requestPayParams)
          showToast({ title: '支付成功！', icon: 'success' })
          await fetchUserSubscription()
        } catch (payErr: any) {
          if (payErr?.errMsg?.includes('cancel')) {
            showToast({ title: '支付已取消', icon: 'none' })
          } else {
            showToast({ title: `支付失败，请重试`, icon: 'none', duration: 3000 })
          }
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

  const getPlanById = (id: string) => plans.find(p => p.id === id)

  const getFeatureVal = (planId: string, item: typeof COMPARISON_ITEMS[0]) => {
    const plan = getPlanById(planId)
    if (!plan) return null
    const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {})

    switch (item.key) {
      case 'maxAvatars':
        return features.max_avatars >= 999 ? '无限' : `${features.max_avatars}个`
      case 'canReceiveOrders':
        return features.can_receive_orders
      case 'skillUsesPerDay':
        return features.skill_uses_per_day >= 999 ? '无限' : `${features.skill_uses_per_day}次`
      case 'skillCategories':
        return features.skill_categories?.length >= 5 ? '全类目' :
               features.skill_categories?.length >= 4 ? '4大类目' :
               features.skill_categories?.length >= 2 ? '生活+创作' : '生活类'
      case 'contentStyles':
        return features.content_styles?.length >= 8 ? '8种+' :
               `${features.content_styles?.length || 0}种`
      case 'customPersonality':
        return features.custom_personality
      case 'batchPublish':
        return features.batch_publish
      case 'analytics':
        return features.analytics
      case 'prioritySupport':
        return features.priority_support
      case 'orderPriority':
        const p = features.order_priority
        return p >= 3 ? '最高' : p >= 2 ? '高级' : p >= 1 ? '优先' : '普通'
      case 'storageLimit':
        return features.storage_limit
      case 'exclusiveSkills':
        return features.exclusive_skills
      default:
        return null
    }
  }

  const renderVal = (val: any) => {
    if (val === true) return <Check size={16} color="#10B981" />
    if (val === false) return <X size={16} color="#94a3b8" />
    return <Text className="sub-compare-val-text">{val}</Text>
  }

  const getCurrentPlanName = () => {
    if (!userSubscription || userSubscription.status !== 'active') return ''
    return userSubscription.plan?.name || ''
  }

  const isCurrentPlan = (planId: string) => {
    return userSubscription?.plan?.id === planId && userSubscription?.status === 'active'
  }

  const getPlanTheme = (planId: string) => {
    switch (planId) {
      case 'plan_pro': return 'pro'
      case 'plan_enterprise': return 'enterprise'
      case 'plan_basic': return 'basic'
      default: return 'free'
    }
  }

  const currentPlanName = getCurrentPlanName()

  return (
    <View className="sub-page">
      {/* 紫蓝渐变自定义导航 */}
      <View className="sub-nav" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="sub-nav-inner">
          <View className="sub-nav-back" onClick={() => navigateBack()}>
            <ArrowLeft size={22} color="#fff" />
          </View>
          <Text className="sub-nav-title">会员订阅</Text>
          <View className="sub-nav-placeholder" />
        </View>
      </View>

      <ScrollView className="sub-scroll" scrollY>
        <View className="sub-content">

          {/* 会员状态卡 */}
          <View className="sub-status-card">
            <View className="sub-status-bg" />
            <View className="sub-status-body">
              {currentPlanName ? (
                <>
                  <View className="sub-status-badge">
                    <Crown size={18} color="#FFD700" />
                    <Text className="sub-status-badge-text">{currentPlanName}会员</Text>
                  </View>
                  <Text className="sub-status-desc">
                    {userSubscription?.status === 'active'
                      ? `有效期至 ${new Date(userSubscription.endDate).toLocaleDateString('zh-CN')}`
                      : '订阅已过期'}
                  </Text>
                </>
              ) : (
                <>
                  <View className="sub-status-badge sub-status-badge-free">
                    <Users size={18} color="#a78bfa" />
                    <Text className="sub-status-badge-text-free">免费用户</Text>
                  </View>
                  <Text className="sub-status-desc">升级会员，解锁AI分身全部能力</Text>
                </>
              )}
            </View>
          </View>

          {/* 核心权益展示 - 横向4宫格 */}
          <View className="sub-benefits-section">
            <Text className="sub-section-label">会员能帮你做什么</Text>
            <View className="sub-benefits-grid">
              <View className="sub-benefit-item">
                <View className="sub-benefit-icon sub-benefit-icon-purple">
                  <Bot size={22} color="#a855f7" />
                </View>
                <Text className="sub-benefit-title">创建AI分身</Text>
                <Text className="sub-benefit-desc">7x24小时自动创作</Text>
              </View>
              <View className="sub-benefit-item">
                <View className="sub-benefit-icon sub-benefit-icon-green">
                  <Zap size={22} color="#10b981" />
                </View>
                <Text className="sub-benefit-title">接单赚钱</Text>
                <Text className="sub-benefit-desc">被动收入持续增长</Text>
              </View>
              <View className="sub-benefit-item">
                <View className="sub-benefit-icon sub-benefit-icon-blue">
                  <Sparkles size={22} color="#3b82f6" />
                </View>
                <Text className="sub-benefit-title">AI技能驱动</Text>
                <Text className="sub-benefit-desc">内容创作一键搞定</Text>
              </View>
              <View className="sub-benefit-item">
                <View className="sub-benefit-icon sub-benefit-icon-orange">
                  <TrendingUp size={22} color="#f97316" />
                </View>
                <Text className="sub-benefit-title">数据驱动增长</Text>
                <Text className="sub-benefit-desc">精准优化内容策略</Text>
              </View>
            </View>
          </View>

          {/* 套餐卡片 */}
          <View className="sub-plans-section">
            <Text className="sub-section-label">选择适合你的套餐</Text>
            <View className="sub-plans-scroll">
              {plans.map((plan) => {
                const theme = getPlanTheme(plan.id)
                const isPro = theme === 'pro'
                const isEnterprise = theme === 'enterprise'
                const current = isCurrentPlan(plan.id)
                const isPurchasing = purchasing && selectedPlan?.id === plan.id

                return (
                  <View key={plan.id} className={`sub-plan-card sub-plan-${theme}`}>
                    {/* 推荐标签 */}
                    {isPro && (
                      <View className="sub-plan-recommend">
                        <Flame size={12} color="#fff" />
                        <Text className="sub-plan-recommend-text">最受欢迎</Text>
                      </View>
                    )}
                    {isEnterprise && (
                      <View className="sub-plan-recommend sub-plan-recommend-gold">
                        <Crown size={12} color="#fff" />
                        <Text className="sub-plan-recommend-text">顶级配置</Text>
                      </View>
                    )}

                    <View className="sub-plan-header">
                      <Text className={`sub-plan-name sub-plan-name-${theme}`}>{plan.name}</Text>
                      <View className="sub-plan-price-row">
                        <Text className="sub-plan-currency">¥</Text>
                        <Text className={`sub-plan-price sub-plan-price-${theme}`}>
                          {plan.price > 0 ? plan.price : '免费'}
                        </Text>
                        {plan.price > 0 && <Text className="sub-plan-period">/月</Text>}
                      </View>
                    </View>

                    <Text className="sub-plan-desc">{plan.description}</Text>

                    {/* 核心权益摘要 */}
                    <View className="sub-plan-highlights">
                      {theme === 'free' && (
                        <>
                          <View className="sub-highlight"><Check size={14} color="#94a3b8" /><Text className="sub-highlight-text">1个AI分身</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#94a3b8" /><Text className="sub-highlight-text">3次技能/天</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#94a3b8" /><Text className="sub-highlight-text">100MB存储</Text></View>
                        </>
                      )}
                      {theme === 'basic' && (
                        <>
                          <View className="sub-highlight"><Check size={14} color="#3b82f6" /><Text className="sub-highlight-text">3个AI分身</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#3b82f6" /><Text className="sub-highlight-text">自定义性格</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#3b82f6" /><Text className="sub-highlight-text">1GB存储</Text></View>
                        </>
                      )}
                      {theme === 'pro' && (
                        <>
                          <View className="sub-highlight"><Check size={14} color="#10b981" /><Text className="sub-highlight-text">10个AI分身</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#10b981" /><Text className="sub-highlight-text">接单赚钱</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#10b981" /><Text className="sub-highlight-text">批量发布+数据分析</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#10b981" /><Text className="sub-highlight-text">10GB存储</Text></View>
                        </>
                      )}
                      {theme === 'enterprise' && (
                        <>
                          <View className="sub-highlight"><Check size={14} color="#f59e0b" /><Text className="sub-highlight-text">无限AI分身</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#f59e0b" /><Text className="sub-highlight-text">全类目技能+专属技能</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#f59e0b" /><Text className="sub-highlight-text">最高订单优先级</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#f59e0b" /><Text className="sub-highlight-text">专属客户经理</Text></View>
                          <View className="sub-highlight"><Check size={14} color="#f59e0b" /><Text className="sub-highlight-text">100GB存储</Text></View>
                        </>
                      )}
                    </View>

                    <Button
                      className={`sub-plan-btn sub-plan-btn-${theme} ${current ? 'sub-plan-btn-current' : ''}`}
                      onClick={() => handlePurchase(plan)}
                      disabled={isPurchasing || current}
                    >
                      <Text className={`sub-plan-btn-text ${current ? 'sub-plan-btn-text-current' : ''}`}>
                        {isPurchasing ? '购买中...' : current ? '当前套餐' : plan.price === 0 ? '免费使用' : '立即订阅'}
                      </Text>
                    </Button>
                  </View>
                )
              })}
            </View>
          </View>

          {/* 权益对比表格 */}
          <View className="sub-compare-section">
            <Text className="sub-section-label">权益对比</Text>
            <View className="sub-compare-table">
              {COMPARISON_ITEMS.map((item) => {
                const IconComp = item.icon
                return (
                  <View key={item.key} className="sub-compare-row">
                    <View className="sub-compare-label">
                      <IconComp size={14} color="#a855f7" />
                      <Text className="sub-compare-label-text">{item.label}</Text>
                    </View>
                    <View className="sub-compare-values">
                      {['plan_free', 'plan_basic', 'plan_pro', 'plan_enterprise'].map(pid => (
                        <View key={pid} className="sub-compare-cell">
                          {renderVal(getFeatureVal(pid, item))}
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })}
            </View>
            {/* 列头 */}
            <View className="sub-compare-header">
              <View className="sub-compare-header-label" />
              <View className="sub-compare-header-values">
                <Text className="sub-compare-header-cell">免费</Text>
                <Text className="sub-compare-header-cell">基础</Text>
                <Text className="sub-compare-header-cell sub-compare-header-cell-pro">专业</Text>
                <Text className="sub-compare-header-cell">企业</Text>
              </View>
            </View>
          </View>

          {/* 订阅须知 */}
          <View className="sub-notice-section">
            <Text className="sub-section-label">常见问题</Text>
            <View className="sub-faq-list">
              <View className="sub-faq-item">
                <Text className="sub-faq-q">订阅后多久生效？</Text>
                <Text className="sub-faq-a">支付成功后立即生效，所有权益即刻可用。</Text>
              </View>
              <View className="sub-faq-item">
                <Text className="sub-faq-q">可以随时取消吗？</Text>
                <Text className="sub-faq-a">可以随时取消，当前订阅期内权益不受影响，到期后不再续费。</Text>
              </View>
              <View className="sub-faq-item">
                <Text className="sub-faq-q">升级套餐会怎样？</Text>
                <Text className="sub-faq-a">升级后立即享受新套餐权益，剩余天数按比例折算差价。</Text>
              </View>
              <View className="sub-faq-item">
                <Text className="sub-faq-q">接单收入怎么提现？</Text>
                <Text className="sub-faq-a">专业版及以上支持接单赚钱，收益可在「收益中心」随时提现。</Text>
              </View>
            </View>
          </View>

          <View className="sub-bottom-space" />
        </View>
      </ScrollView>
    </View>
  )
}
