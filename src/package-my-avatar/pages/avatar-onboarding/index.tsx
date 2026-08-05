import Taro from '@tarojs/taro'
import type { CSSProperties } from 'react'
import { View, Text } from '@tarojs/components'
import { ArrowLeft, ArrowRight, Bot, LockKeyhole, Sparkles } from 'lucide-react-taro'

import { Button } from '@/components/ui/button'

import './index.css'

const CREATE_STEPS = ['基础信息', '选择技能', '配置技能', '测试运行', '基础+技能完成']

export default function AvatarOnboardingPage() {
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = {
    '--ao-status-bar': `${statusBarHeight}px`,
  } as CSSProperties

  return (
    <View className="ao-page" style={pageStyle}>
      <View className="ao-header">
        <Button variant="ghost" size="icon" className="ao-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={19} color="#4C3B78" />
        </Button>
        {/* <Text className="ao-header-title">创建分身</Text> */}
        <View className="ao-header-placeholder" />
      </View>

      <View className="ao-content">
        <View className="ao-top-glow" />
        <View className="ao-copy">
          <View className="ao-copy-title-row">
            <Text className="ao-title">创建分身</Text>
            <Sparkles size={26} color="#7C3AED" />
          </View>
          <Text className="ao-description">创建基础身份 + 配置可用技能</Text>
        </View>

        <View className="ao-steps">
          {CREATE_STEPS.map((step, index) => (
            <View className="ao-step" key={step}>
              {index < CREATE_STEPS.length - 1 && <View className="ao-step-line" />}
              <View className={`ao-step-index ${index === 0 ? 'is-active' : ''}`}>
                <Text>{index + 1}</Text>
              </View>
              <View className={`ao-step-label ${index === 0 ? 'is-active' : ''}`}>
                <Text>{step}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="ao-visual" aria-hidden>
          <View className="ao-orbit ao-orbit-one" />
          <View className="ao-orbit ao-orbit-two" />
          <View className="ao-orbit-card ao-orbit-card-one"><Bot size={24} color="#8B5CF6" /></View>
          <View className="ao-orbit-card ao-orbit-card-two"><Sparkles size={20} color="#A78BFA" /></View>
          <View className="ao-avatar-illustration">
            <View className="ao-avatar-halo" />
            <View className="ao-avatar-head" />
            <View className="ao-avatar-body" />
          </View>
        </View>
      </View>

      <View className="ao-footer">
        <Button className="ao-start-button" onClick={() => Taro.navigateTo({ url: '/package-my-avatar/pages/avatar-create-step1/index' })}>
          <Text>开始创建</Text>
          <ArrowRight size={19} color="#FFFFFF" />
        </Button>
        <View className="ao-security"><LockKeyhole size={16} color="#9A91B7" /><Text>你的数据将被加密保护</Text></View>
      </View>
    </View>
  )
}
