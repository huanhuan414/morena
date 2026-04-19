import { Image, View } from '@tarojs/components'
import { User } from 'lucide-react-taro'
import { getAvatarStyleClass } from '@/utils/avatar-style'
import './index.css'

interface AvatarAvatarProps {
  /** 头像URL */
  src?: string
  /** 形象风格（real、cartoon、anime等） */
  appearanceStyle?: string
  /** 头像尺寸 */
  size?: number
  /** 头像形状（circle圆形、rounded圆角、square方形） */
  shape?: 'circle' | 'rounded' | 'square'
  /** 点击事件 */
  onClick?: () => void
  /** 自定义类名 */
  className?: string
}

/**
 * 通用头像组件，自动应用风格化滤镜
 */
export default function AvatarAvatar({
  src,
  appearanceStyle,
  size = 48,
  shape = 'circle',
  onClick,
  className = ''
}: AvatarAvatarProps) {
  const styleClass = getAvatarStyleClass(appearanceStyle)
  const shapeClass = `avatar-shape-${shape}`

  return (
    <View
      className={`avatar-container ${shapeClass} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`
      }}
      onClick={onClick}
    >
      {src ? (
        <Image
          src={src}
          className={`avatar-img ${styleClass}`}
          mode="aspectFill"
        />
      ) : (
        <View className="avatar-placeholder">
          <User size={size * 0.5} color="#cbd5e1" />
        </View>
      )}
    </View>
  )
}
