import React from 'react'
import { View, Text, Image } from '@tarojs/components'

interface AvatarProps {
  src?: string
  name?: string
  size?: number
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

/**
 * 通用头像组件
 * - 自动处理图片加载失败
 * - 图片加载失败时显示渐变背景和首字母
 * - 支持自定义大小和样式
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '用户',
  size = 72,
  className = '',
  style,
  onClick
}) => {
  const [imageError, setImageError] = React.useState(false)
  const defaultAvatar = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

  const handleImageError = () => {
    console.error('头像加载失败:', src)
    setImageError(true)
  }

  // 重置错误状态，当 src 改变时重新尝试加载
  React.useEffect(() => {
    setImageError(false)
  }, [src])

  const avatarStyle: React.CSSProperties = {
    width: `${size}rpx`,
    height: `${size}rpx`,
    borderRadius: '50%',
    background: imageError || !src ? defaultAvatar : 'transparent',
    overflow: 'hidden',
    ...style
  }

  const initial = name ? name.charAt(0).toUpperCase() : 'U'

  return (
    <View
      className={`avatar-component ${className}`}
      style={avatarStyle}
      onClick={onClick}
    >
      {!imageError && src ? (
        <Image
          src={src}
          className="avatar-img"
          mode="aspectFill"
          onError={handleImageError}
        />
      ) : (
        <View className="avatar-fallback">
          <Text className="avatar-initial">{initial}</Text>
        </View>
      )}
    </View>
  )
}
