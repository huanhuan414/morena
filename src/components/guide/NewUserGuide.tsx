import { useState, useEffect } from 'react'
import { View, Text, Swiper, SwiperItem, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import './NewUserGuide.css'

interface GuideStep {
  id: number
  title: string
  desc: string
  image: string
  action?: string
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 1,
    title: '创建你的AI分身',
    desc: '只需几步，创建一个拥有独特性格、技能的AI分身，让它成为你的数字代言人',
    image: 'https://placehold.co/300x300/3b82f6/white?text=创建分身',
    action: '去创建'
  },
  {
    id: 2,
    title: '分身托管赚钱',
    desc: '开启托管模式，让分身24小时为你服务其他用户，自动赚取收益',
    image: 'https://placehold.co/300x300/10b981/white?text=托管赚钱',
    action: '开启托管'
  },
  {
    id: 3,
    title: '发布技能订单',
    desc: '将你的专业技能发布为订单，分身帮你完成，你坐享其成',
    image: 'https://placehold.co/300x300/f59e0b/white?text=发布订单',
    action: '发布订单'
  },
  {
    id: 4,
    title: '推广赚佣金',
    desc: '分享邀请码给好友，他们消费你赚佣金，躺着也能赚钱',
    image: 'https://placehold.co/300x300/8b5cf6/white?text=推广赚钱',
    action: '去推广'
  }
]

interface NewUserGuideProps {
  visible: boolean
  onClose: () => void
}

export default function NewUserGuide({ visible, onClose }: NewUserGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showGuide, setShowGuide] = useState(visible)

  useEffect(() => {
    setShowGuide(visible)
  }, [visible])

  const handleSkip = () => {
    // 标记已看过引导
    Taro.setStorageSync('hasSeenGuide', true)
    setShowGuide(false)
    onClose()
  }

  const handleAction = (step: GuideStep) => {
    Taro.setStorageSync('hasSeenGuide', true)
    setShowGuide(false)
    onClose()

    // 根据步骤跳转到对应页面
    switch (step.id) {
      case 1:
        Taro.navigateTo({ url: '/avatar/avatar-create/index' })
        break
      case 2:
        Taro.navigateTo({ url: '/avatar/avatar-settings/index?tab=hosting' })
        break
      case 3:
        Taro.navigateTo({ url: '/order/order-create/index' })
        break
      case 4:
        Taro.navigateTo({ url: '/pages/referral-center/index' })
        break
    }
  }

  const handleGetStarted = () => {
    Taro.setStorageSync('hasSeenGuide', true)
    setShowGuide(false)
    onClose()
  }

  if (!showGuide) return null

  return (
    <View className="new-user-guide">
      <View className="guide-overlay" />
      
      <View className="guide-content">
        {/* 跳过按钮 */}
        <View className="skip-btn" onClick={handleSkip}>
          <Text className="skip-text">跳过</Text>
        </View>

        {/* 引导轮播 */}
        <Swiper
          className="guide-swiper"
          indicatorColor="#e5e7eb"
          indicatorActiveColor="#3b82f6"
          circular={false}
          onChange={(e) => setCurrentStep(e.detail.current)}
        >
          {GUIDE_STEPS.map((step) => (
            <SwiperItem key={step.id} className="guide-item">
              <View className="guide-step">
                <Image
                  className="guide-image"
                  src={step.image}
                  mode="aspectFit"
                />
                <Text className="guide-title">{step.title}</Text>
                <Text className="guide-desc">{step.desc}</Text>
                
                {currentStep === step.id - 1 && (
                  <Button
                    className="guide-action-btn"
                    onClick={() => handleAction(step)}
                  >
                    <Text>{step.action}</Text>
                  </Button>
                )}
              </View>
            </SwiperItem>
          ))}
        </Swiper>

        {/* 指示器和开始按钮 */}
        <View className="guide-footer">
          <View className="guide-dots">
            {GUIDE_STEPS.map((_, index) => (
              <View
                key={index}
                className={`guide-dot ${currentStep === index ? 'active' : ''}`}
              />
            ))}
          </View>
          
          {currentStep === GUIDE_STEPS.length - 1 && (
            <Button className="get-started-btn" onClick={handleGetStarted}>
              <Text>开始使用</Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}
