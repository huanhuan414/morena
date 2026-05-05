import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { ChevronLeft, Copy, Check, ExternalLink, Smartphone } from 'lucide-react-taro'
import './index.css'

const PLATFORM_INFO: Record<string, {
  name: string
  icon: string
  appScheme: string
  downloadUrl: string
  description: string
}> = {
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    appScheme: 'xhsdiscover://',
    downloadUrl: 'https://www.xiaohongshu.com',
    description: '打开小红书 App，发布图文笔记'
  },
  douyin: {
    name: '抖音',
    icon: '🎵',
    appScheme: 'snssdk1128://',
    downloadUrl: 'https://www.douyin.com',
    description: '打开抖音 App，发布短视频'
  },
  wechat_mp: {
    name: '微信公众号',
    icon: '📧',
    appScheme: '',
    downloadUrl: 'https://mp.weixin.qq.com',
    description: '登录微信公众平台发布文章'
  },
  wechat_moments: {
    name: '微信朋友圈',
    icon: '💬',
    appScheme: 'weixin://',
    downloadUrl: 'weixin://',
    description: '打开微信，发布朋友圈'
  },
  weibo: {
    name: '微博',
    icon: '🌐',
    appScheme: 'sinaweibo://',
    downloadUrl: 'https://weibo.com',
    description: '打开微博 App，发布动态'
  },
  bilibili: {
    name: 'Bilibili',
    icon: '📺',
    appScheme: 'bilibili://',
    downloadUrl: 'https://www.bilibili.com',
    description: '打开 B 站 App，发布内容'
  }
}

export default function OrderPublishGuide() {
  const [platforms, setPlatforms] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const { platforms: p, content: c, title: t, images: imgs } = Taro.getCurrentInstance()?.router?.params || {}
    if (p) setPlatforms(p.split(','))
    if (c) setContent(decodeURIComponent(c))
    if (t) setTitle(decodeURIComponent(t))
    if (imgs) setImages(imgs.split(',').filter(Boolean))
  }, [])

  const handleBack = () => {
    Taro.navigateBack()
  }

  const handleCopyContent = () => {
    const fullContent = title ? `${title}\n\n${content}` : content
    Taro.setClipboardData({
      data: fullContent,
      success: () => {
        setCopied(true)
        Taro.showToast({ title: '已复制到剪贴板', icon: 'success' })
        setTimeout(() => setCopied(false), 2000)
      }
    })
  }

  const handleOpenApp = (platform: string) => {
    const info = PLATFORM_INFO[platform]
    if (!info) return

    if (info.appScheme) {
      // 尝试打开 App
      Taro.navigateToMiniProgram({
        appId: platform === 'xiaohongshu' ? 'wxffc08ac7df48285e' : undefined,
        path: platform === 'xiaohongshu' ? '/pages/discover/discover' : undefined,
        fail: () => {
          // 如果小程序跳转失败，尝试直接打开
          Taro.showToast({ title: `请手动打开${info.name}`, icon: 'none' })
        }
      })
    } else {
      // Web 平台，打开网页
      if (platform === 'wechat_mp') {
        Taro.showModal({
          title: '发布到微信公众号',
          content: '请前往微信公众平台 (mp.weixin.qq.com) 登录并发布内容',
          confirmText: '知道了',
          showCancel: false
        })
      } else {
        Taro.showToast({ title: `请手动打开${info.name}`, icon: 'none' })
      }
    }
  }

  const handleDownloadImage = (url: string, _index: number) => {
    Taro.showLoading({ title: '下载中...' })
    Network.downloadFile({
      url,
      success: (res) => {
        Taro.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '已保存到相册', icon: 'success' })
          },
          fail: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '保存失败', icon: 'none' })
          }
        })
      },
      fail: () => {
        Taro.hideLoading()
        Taro.showToast({ title: '下载失败', icon: 'none' })
      }
    })
  }

  return (
    <View className="publish-guide-page">
      {/* 顶部导航 */}
      <View className="header">
        <View className="header-left" onClick={handleBack}>
          <ChevronLeft size={24} color="#1e293b" />
        </View>
        <Text className="header-title">发布引导</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="guide-content" scrollY>
        {/* 引导说明 */}
        <View className="guide-intro">
          <View className="intro-icon">
            <Smartphone size={32} color="#3b82f6" />
          </View>
          <Text className="intro-title">手动发布内容</Text>
          <Text className="intro-desc">
            由于平台限制，内容需要手动发布到各平台。{'\n'}
            请按照以下步骤操作：
          </Text>
        </View>

        {/* 目标平台 */}
        <View className="platform-section">
          <Text className="section-title">目标平台</Text>
          <View className="platform-list">
            {platforms.map((p) => {
              const info = PLATFORM_INFO[p] || { name: p, icon: '📱', description: '' }
              return (
                <View key={p} className="platform-card" onClick={() => handleOpenApp(p)}>
                  <View className="platform-info">
                    <Text className="platform-icon">{info.icon}</Text>
                    <View className="platform-text">
                      <Text className="platform-name">{info.name}</Text>
                      <Text className="platform-desc">{info.description}</Text>
                    </View>
                  </View>
                  <ExternalLink size={20} color="#94a3b8" />
                </View>
              )
            })}
          </View>
        </View>

        {/* 内容预览 */}
        <View className="content-section">
          <View className="content-header">
            <Text className="section-title">内容预览</Text>
            <View className="copy-btn" onClick={handleCopyContent}>
              {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} color="#3b82f6" />}
              <Text className="copy-text">{copied ? '已复制' : '复制内容'}</Text>
            </View>
          </View>

          {title && (
            <View className="content-title-box">
              <Text className="content-title">{title}</Text>
            </View>
          )}

          <View className="content-text-box">
            <Text className="content-text">{content}</Text>
          </View>
        </View>

        {/* 图片预览 */}
        {images.length > 0 && (
          <View className="images-section">
            <Text className="section-title">配图 ({images.length}张)</Text>
            <Text className="images-tip">点击图片可保存到相册</Text>
            <View className="images-grid">
              {images.map((img, idx) => (
                <View key={idx} className="guide-image-item" onClick={() => handleDownloadImage(img, idx)}>
                  <Image src={img} mode="aspectFill" className="guide-image" />
                  <View className="guide-image-overlay">
                    <Text className="guide-image-tip">点击保存</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 发布步骤 */}
        <View className="steps-section">
          <Text className="section-title">发布步骤</Text>
          <View className="steps-list">
            <View className="step-item">
              <View className="step-num">1</View>
              <View className="step-content">
                <Text className="step-title">打开对应平台 App</Text>
                <Text className="step-desc">点击上方平台卡片，打开对应 App</Text>
              </View>
            </View>
            <View className="step-item">
              <View className="step-num">2</View>
              <View className="step-content">
                <Text className="step-title">复制内容</Text>
                <Text className="step-desc">点击「复制内容」按钮，粘贴到发布框</Text>
              </View>
            </View>
            <View className="step-item">
              <View className="step-num">3</View>
              <View className="step-content">
                <Text className="step-title">保存并上传图片</Text>
                <Text className="step-desc">点击图片保存到相册，然后上传到发布框</Text>
              </View>
            </View>
            <View className="step-item">
              <View className="step-num">4</View>
              <View className="step-content">
                <Text className="step-title">发布内容</Text>
                <Text className="step-desc">确认内容无误后，点击发布</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
