import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import HelpCenter from '@/components/guide/HelpCenter'
import { ChevronLeft } from 'lucide-react-taro'
import './index.css'

export default function HelpPage() {
  const handleBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="help-page">
      {/* 自定义导航栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={handleBack}>
          <ChevronLeft size={24} color="#1f2937" />
        </View>
        <View className="nav-title">帮助中心</View>
        <View className="nav-placeholder" />
      </View>

      {/* 帮助中心内容 */}
      <HelpCenter />
    </View>
  )
}
