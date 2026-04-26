import { View, Text } from '@tarojs/components'
import { navigateBack, getSystemInfoSync } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react-taro'
import './index.css'

interface CustomNavBarProps {
  title: string
  showBack?: boolean
  backgroundColor?: string
  textColor?: string
  onBack?: () => void
}

export function CustomNavBar({
  title,
  showBack = true,
  backgroundColor = 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  textColor = '#fff',
  onBack
}: CustomNavBarProps) {
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleHeight, setCapsuleHeight] = useState(44)

  useEffect(() => {
    const systemInfo = getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    // 胶囊按钮高度一般为 32px，但在不同平台可能不同
    setCapsuleHeight(44)
  }, [])

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigateBack()
    }
  }

  return (
    <View
      className="custom-nav-bar"
      style={{
        paddingTop: `${statusBarHeight}px`,
        background: backgroundColor,
        height: `${capsuleHeight}px`
      }}
    >
      <View className="nav-bar-content" style={{ height: `${capsuleHeight}px` }}>
        {showBack ? (
          <View className="nav-bar-back" onClick={handleBack}>
            <ArrowLeft size={24} color={textColor} />
          </View>
        ) : (
          <View className="nav-bar-left-placeholder" />
        )}
        <Text className="nav-bar-title" style={{ color: textColor }}>
          {title}
        </Text>
        <View className="nav-bar-right-placeholder" />
      </View>
    </View>
  )
}

export default CustomNavBar
