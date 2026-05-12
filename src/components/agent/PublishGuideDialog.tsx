/**
 * 发布引导弹窗组件
 * 实现一键发布功能：复制内容 + 引导打开APP
 */

import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { canonicalizePlatform, getPlatformAppConfig, getPlatformLabel } from '@/constants/publish-platform'
import { Copy, Check, ExternalLink, Share2 } from 'lucide-react-taro'

const PLATFORM_ICONS: Record<string, string> = {
  xiaohongshu: '📕',
  douyin: '🎵',
  bilibili: '📺',
  weibo: '🐦',
  wechat_channel: '🎬',
  wechat_video: '🎬',
  wechat_mp: '📧'
}

export interface PublishContent {
  title?: string
  content?: string
  images?: string[]
  tags?: string[]
  videoUrl?: string
}

interface PublishGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: string
  content: PublishContent
}

export function PublishGuideDialog({ open, onOpenChange, platform, content }: PublishGuideDialogProps) {
  const [copied, setCopied] = useState(false)
  const [tryingOpen, setTryingOpen] = useState(false)
  const normalizedPlatform = canonicalizePlatform(platform)
  const platformConfig = getPlatformAppConfig(normalizedPlatform)
  const platformName = getPlatformLabel(normalizedPlatform)
  const platformIcon = PLATFORM_ICONS[normalizedPlatform] || '📱'
  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
  
  // 格式化要复制的内容
  const getCopyContent = () => {
    let text = ''
    if (content.title) {
      text += `【${content.title}】\n\n`
    }
    text += content.content
    if (content.tags?.length) {
      text += `\n\n${content.tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}`
    }
    return text
  }
  
  // 复制内容到剪贴板
  const handleCopy = async () => {
    const text = getCopyContent()
    try {
      await Taro.setClipboardData({
        data: text
      })
      setCopied(true)
      Taro.showToast({
        title: '内容已复制',
        icon: 'success'
      })
      
      // 3秒后重置状态
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      Taro.showToast({
        title: '复制失败',
        icon: 'error'
      })
    }
  }
  
  // 尝试打开 APP（仅 H5 环境）
  const handleOpenApp = async () => {
    if (!isH5 || !platformConfig?.scheme) {
      Taro.showToast({
        title: '请在小程序中复制内容',
        icon: 'none'
      })
      return
    }
    
    setTryingOpen(true)
    
    try {
      // 先复制内容
      await handleCopy()
      
      // 尝试通过 scheme 唤起 APP
      // 注意：大多数浏览器会阻止这种跳转，需要用户交互触发
      const startTime = Date.now()
      
      // 使用 location 跳转
      window.location.href = platformConfig.scheme
      
      // 检测是否成功唤起（如果 3 秒内没有跳转，说明失败）
      setTimeout(() => {
        if (Date.now() - startTime < 3500) {
          // 可能唤起失败，显示提示
          Taro.showModal({
            title: '打开失败',
            content: `未能自动打开${platformName}，请手动打开APP粘贴内容`,
            showCancel: false
          })
        }
        setTryingOpen(false)
      }, 3000)
      
    } catch (err) {
      setTryingOpen(false)
      Taro.showToast({
        title: '打开APP失败',
        icon: 'error'
      })
    }
  }
  
  // 复制图片链接（如果有图片）
  const handleCopyImages = async () => {
    if (!content.images?.length) return
    
    const imageText = content.images.join('\n')
    try {
      await Taro.setClipboardData({
        data: imageText
      })
      Taro.showToast({
        title: '图片链接已复制',
        icon: 'success'
      })
    } catch (err) {
      Taro.showToast({
        title: '复制失败',
        icon: 'error'
      })
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Text className="text-2xl">{platformIcon}</Text>
            <Text>发布到{platformName}</Text>
          </DialogTitle>
        </DialogHeader>
        
        <View className="py-4">
          {/* 说明文字 */}
          <View className="bg-blue-50 rounded-lg p-4 mb-4">
            <Text className="text-blue-700 text-sm">
              {platformConfig?.tips || '请复制内容后打开对应平台完成发布'}
            </Text>
          </View>
          
          {/* 步骤说明 */}
          <View className="space-y-3 mb-4">
            <View className="flex items-start gap-3">
              <View className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs flex-shrink-0">
                <Text className="text-white text-xs">1</Text>
              </View>
              <Text className="text-sm text-gray-700">点击下方按钮复制内容</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs flex-shrink-0">
                <Text className="text-white text-xs">2</Text>
              </View>
              <Text className="text-sm text-gray-700">打开{platformName}APP</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs flex-shrink-0">
                <Text className="text-white text-xs">3</Text>
              </View>
              <Text className="text-sm text-gray-700">粘贴内容并发布</Text>
            </View>
          </View>
          
          {/* 内容预览 */}
          <View className="bg-gray-50 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
            <Text className="text-xs text-gray-500 mb-1">内容预览：</Text>
            <Text className="text-sm text-gray-700 line-clamp-4">
              {getCopyContent().substring(0, 200)}...
            </Text>
          </View>
          
          {/* 图片提示 */}
          {content.images?.length ? (
            <View className="bg-yellow-50 rounded-lg p-3 mb-4">
              <Text className="text-yellow-700 text-xs">
                💡 提示：共{content.images.length}张图片，请长按保存后手动上传
              </Text>
            </View>
          ) : null}
          
          {/* 视频提示 */}
          {content.videoUrl ? (
            <View className="bg-yellow-50 rounded-lg p-3 mb-4">
              <Text className="text-yellow-700 text-xs">
                💡 提示：视频链接已生成，请在APP中上传视频文件
              </Text>
            </View>
          ) : null}
        </View>
        
        <DialogFooter className="flex-col gap-2">
          {/* 复制内容按钮 */}
          <Button
            className="w-full"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check size={16} color="#fff" />
                <Text className="text-white">已复制</Text>
              </>
            ) : (
              <>
                <Copy size={16} color="#fff" />
                <Text className="text-white">复制内容</Text>
              </>
            )}
          </Button>
          
          {/* H5 环境显示打开APP按钮 */}
          {isH5 && platformConfig?.scheme ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleOpenApp}
              disabled={tryingOpen}
            >
              <ExternalLink size={16} color="#1890ff" />
              <Text>{tryingOpen ? '正在打开...' : `打开${platformName}APP`}</Text>
            </Button>
          ) : null}
          
          {/* 小程序环境显示复制图片按钮 */}
          {isWeapp && content.images?.length ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopyImages}
            >
              <Share2 size={16} color="#1890ff" />
              <Text>复制图片链接</Text>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PublishGuideDialog
