/**
 * 一键发布H5中转页面
 * 用于调起对应的APP并传递内容
 */

import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { canonicalizePlatform, getPlatformAppConfig, getPlatformLabel, type CanonicalPlatformKey } from '@/constants/publish-platform'
import { Copy, Check, Download, ArrowLeft } from 'lucide-react-taro'
import './index.css'

const PLATFORM_ICONS: Partial<Record<CanonicalPlatformKey, string>> = {
  xiaohongshu: '📕',
  douyin: '🎵',
  bilibili: '📺',
  weibo: '🐦',
  wechat_channel: '🎬',
  wechat_mp: '📧'
}

export default function PublishRedirectPage() {
  const router = useRouter()
  const [platform, setPlatform] = useState<CanonicalPlatformKey>('xiaohongshu')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [copied, setCopied] = useState(false)
  const [openFailed, setOpenFailed] = useState(false)
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useEffect(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
    
    // 从URL参数获取数据
    const params = router.params
    if (params.platform) {
      const normalized = canonicalizePlatform(params.platform) as CanonicalPlatformKey
      setPlatform(normalized || 'xiaohongshu')
    }
    if (params.content) {
      try {
        const decoded = decodeURIComponent(params.content)
        setContent(decoded)
      } catch {
        setContent(params.content)
      }
    }
    if (params.title) {
      try {
        const decoded = decodeURIComponent(params.title)
        setTitle(decoded)
      } catch {
        setTitle(params.title)
      }
    }
  }, [router.params])

  // 尝试打开APP
  const tryOpenApp = () => {
    const config = getPlatformAppConfig(platform)
    
    if (!config?.scheme) {
      // 视频号等没有scheme的平台
      setOpenFailed(true)
      Taro.showToast({
        title: '请按提示操作',
        icon: 'none'
      })
      return
    }

    // 只在H5环境下使用iframe尝试打开APP
    if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
      // 创建隐藏的iframe尝试打开scheme
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = config.scheme
      document.body.appendChild(iframe)

      // 设置超时检测
      const checkTimeout = setTimeout(() => {
        // 如果页面还在前台，说明打开失败
        if (document.visibilityState !== 'hidden') {
          setOpenFailed(true)
          Taro.showToast({
            title: '未检测到APP，请手动打开',
            icon: 'none'
          })
        }
      }, 2000)

      // 监听页面可见性变化
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          clearTimeout(checkTimeout)
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      // 清理
      setTimeout(() => {
        document.body.removeChild(iframe)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }, 3000)
    } else {
      // 小程序环境下直接显示打开失败，提示用户手动打开
      setOpenFailed(true)
      Taro.showToast({
        title: '请在浏览器中打开',
        icon: 'none'
      })
    }
  }

  // 复制内容
  const handleCopy = async () => {
    try {
      await Taro.setClipboardData({
        data: content
      })
      setCopied(true)
      Taro.showToast({
        title: '内容已复制',
        icon: 'success'
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      Taro.showToast({
        title: '复制失败',
        icon: 'none'
      })
    }
  }

  // 下载APP
  const handleDownload = () => {
    const config = getPlatformAppConfig(platform)
    if (config?.downloadUrl) {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        window.location.href = config.downloadUrl
      } else {
        // 小程序环境下使用Taro的跳转
        Taro.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(config.downloadUrl)}`
        })
      }
    }
  }

  const platformConfig = getPlatformAppConfig(platform)
  const platformName = getPlatformLabel(platform)
  const platformIcon = PLATFORM_ICONS[platform] || '📱'

  return (
    <View className="publish-redirect-page">
      {/* 顶部导航 */}
      <View className="redirect-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="back-btn" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={24} color="#fff" />
        </View>
        <Text className="header-title">一键发布</Text>
        <View className="header-placeholder" style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      {/* 平台信息 */}
      <View className="platform-card">
        <Text className="platform-icon">{platformIcon}</Text>
        <Text className="platform-name">{platformName}</Text>
      </View>

      {/* 内容预览 */}
      <View className="content-card">
        <Text className="content-label">发布内容</Text>
        {title && (
          <View className="content-title">
            <Text className="title-text">{title}</Text>
          </View>
        )}
        <View className="content-body">
          <Text className="content-text">{content}</Text>
        </View>
      </View>

      {/* 操作按钮 */}
      <View className="action-section">
        {!openFailed ? (
          <Button className="primary-btn" onClick={tryOpenApp}>
            <Text className="btn-text">打开{platformName}APP</Text>
          </Button>
        ) : (
          <>
            <View className="tips-card">
              <Text className="tips-title">💡 操作提示</Text>
              <Text className="tips-text">{platformConfig?.tips || '请手动打开对应平台并完成发布'}</Text>
            </View>
            
            <Button className="copy-btn" onClick={handleCopy}>
              {copied ? <Check size={20} color="#00ff88" /> : <Copy size={20} color="#fff" />}
              <Text className="btn-text">{copied ? '已复制' : '复制内容'}</Text>
            </Button>
            
            {platformConfig?.downloadUrl && (
              <Button className="download-btn" onClick={handleDownload}>
                <Download size={20} color="#00f5ff" />
                <Text className="btn-text">下载{platformName}APP</Text>
              </Button>
            )}
          </>
        )}
      </View>

      {/* 底部提示 */}
      <View className="footer-tips">
        <Text className="footer-text">
          内容已为您准备好，{openFailed ? '请按上述步骤操作' : '点击按钮将自动打开APP'}
        </Text>
      </View>
    </View>
  )
}
