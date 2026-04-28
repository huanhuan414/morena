import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getSafeArea } from '@/utils/safe-area'
import './page-header.css'

interface PageHeaderProps {
  title?: string
  subTitle?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  showBack?: boolean
  onBack?: () => void
  background?: string
  showBorder?: boolean
  className?: string
}

export function PageHeader({
  title,
  subTitle,
  leftContent,
  rightContent,
  showBack = false,
  onBack,
  background = 'transparent',
  showBorder = false,
  className = ''
}: PageHeaderProps) {
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useEffect(() => {
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
    setCapsuleWidth(safeArea.placeholderWidth)
  }, [])

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      Taro.navigateBack()
    }
  }

  return (
    <View 
      className={`page-header ${showBorder ? 'page-header--border' : ''} ${className}`}
      style={{
        paddingTop: `${statusBarHeight}px`,
        background,
      }}
    >
      <View className="page-header__content">
        {/* 左侧区域 */}
        <View className="page-header__left">
          {showBack && (
            <View className="page-header__back" onClick={handleBack}>
              <Text className="page-header__back-icon">‹</Text>
            </View>
          )}
          {leftContent}
        </View>

        {/* 中间标题区域 */}
        {(title || subTitle) && (
          <View className="page-header__center">
            {title && <Text className="page-header__title">{title}</Text>}
            {subTitle && <Text className="page-header__subtitle">{subTitle}</Text>}
          </View>
        )}

        {/* 右侧占位区域 - 与胶囊按钮对齐 */}
        <View className="page-header__right" style={{ width: `${capsuleWidth}rpx` }}>
          {rightContent}
        </View>
      </View>
    </View>
  )
}

export default PageHeader
