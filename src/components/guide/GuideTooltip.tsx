import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './GuideTooltip.css'

interface TooltipProps {
  target: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  onComplete?: () => void
}

export default function GuideTooltip({ 
  target, 
  title, 
  content, 
  position = 'bottom',
  onComplete 
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [tooltipStyle] = useState({})

  useEffect(() => {
    // 检查是否已显示过
    const key = `tooltip_${target}`
    const hasShown = Taro.getStorageSync(key)
    
    if (!hasShown) {
      setTimeout(() => {
        setVisible(true)
      }, 1000)
    }
  }, [target])

  const handleClose = () => {
    const key = `tooltip_${target}`
    Taro.setStorageSync(key, true)
    setVisible(false)
    onComplete?.()
  }

  if (!visible) return null

  return (
    <View className="guide-tooltip-overlay" onClick={handleClose}>
      <View 
        className={`guide-tooltip guide-tooltip-${position}`}
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <View className="tooltip-arrow" />
        <Text className="tooltip-title">{title}</Text>
        <Text className="tooltip-content">{content}</Text>
        <View className="tooltip-close" onClick={handleClose}>
          <Text>知道了</Text>
        </View>
      </View>
    </View>
  )
}
