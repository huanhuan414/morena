import * as React from 'react'
import { View, Text } from '@tarojs/components'
import { Sparkles, Zap, Trophy, ChevronUp } from 'lucide-react-taro'
import './index.css'

interface ExpPopupProps {
  exp: number
  onComplete?: () => void
}

export function ExpPopup({ exp, onComplete }: ExpPopupProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <View className="exp-popup-container">
      <View className="exp-popup-content">
        <Zap size={20} color="#22c55e" />
        <Text className="exp-popup-text">+{exp} XP</Text>
      </View>
    </View>
  )
}

interface LevelUpEffectProps {
  oldLevel: number
  newLevel: number
  onComplete?: () => void
}

export function LevelUpEffect({ oldLevel, newLevel, onComplete }: LevelUpEffectProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 3500)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <View className="levelup-overlay">
      <View className="levelup-content">
        {/* 粒子效果 */}
        <View className="levelup-particles">
          {[...Array(12)].map((_, i) => (
            <View 
              key={i} 
              className="levelup-particle"
              style={{
                '--delay': `${i * 0.15}s`,
                '--angle': `${i * 30}deg`,
              } as any}
            />
          ))}
        </View>
        
        {/* 主体 */}
        <View className="levelup-main">
          <View className="levelup-icon-ring">
            <View className="levelup-icon-inner">
              <Sparkles size={40} color="#fff" />
            </View>
          </View>
          
          <Text className="levelup-title">等级提升!</Text>
          
          <View className="levelup-level-change">
            <View className="levelup-old-level">
              <Text className="levelup-level-num">{oldLevel}</Text>
            </View>
            <ChevronUp size={32} color="#22c55e" />
            <View className="levelup-new-level">
              <Text className="levelup-level-num levelup-new-num">{newLevel}</Text>
            </View>
          </View>
          
          <Text className="levelup-subtitle">恭喜! 你的分身已达到 Lv.{newLevel}</Text>
          
          {/* 升级礼包提示 */}
          <View className="levelup-reward">
            <Trophy size={16} color="#eab308" />
            <Text className="levelup-reward-text">解锁新的等级权益</Text>
          </View>
        </View>
        
        {/* 光芒效果 */}
        <View className="levelup-glow" />
      </View>
    </View>
  )
}
