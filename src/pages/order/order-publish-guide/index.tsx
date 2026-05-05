import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { ChevronLeft, Copy, Check, ExternalLink, Smartphone, CircleAlert, CircleCheck } from 'lucide-react-taro'
import './index.css'

interface AvatarAccount {
  id: string
  platform: string
  account_name: string
  account_url?: string
  appid?: string
}

interface PlatformConfig {
  name: string
  icon: string
  appScheme: string
  downloadUrl: string
  description: string
  requiresBinding: boolean  // 是否需要先绑定账号
}

const PLATFORM_INFO: Record<string, PlatformConfig> = {
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    appScheme: 'xhsdiscover://',
    downloadUrl: 'https://www.xiaohongshu.com',
    description: '打开小红书 App，发布图文笔记',
    requiresBinding: false
  },
  douyin: {
    name: '抖音',
    icon: '🎵',
    appScheme: 'snssdk1128://',
    downloadUrl: 'https://www.douyin.com',
    description: '打开抖音 App，发布短视频',
    requiresBinding: false
  },
  wechat_mp: {
    name: '微信公众号',
    icon: '📧',
    appScheme: '',
    downloadUrl: 'https://mp.weixin.qq.com',
    description: '登录微信公众平台发布文章',
    requiresBinding: true  // 公众号需要绑定 AppID
  },
  wechat_moments: {
    name: '微信朋友圈',
    icon: '💬',
    appScheme: 'weixin://',
    downloadUrl: 'weixin://',
    description: '打开微信，发布朋友圈',
    requiresBinding: false  // 朋友圈不需要绑定账号
  },
  weibo: {
    name: '微博',
    icon: '🌐',
    appScheme: 'sinaweibo://',
    downloadUrl: 'https://weibo.com',
    description: '打开微博 App，发布动态',
    requiresBinding: false
  },
  bilibili: {
    name: 'Bilibili',
    icon: '📺',
    appScheme: 'bilibili://',
    downloadUrl: 'https://www.bilibili.com',
    description: '打开 B 站 App，发布内容',
    requiresBinding: false
  }
}

export default function OrderPublishGuide() {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [avatarId, setAvatarId] = useState('')
  const [avatarAccounts, setAvatarAccounts] = useState<AvatarAccount[]>([])
  const [loading, setLoading] = useState(true)

  // 解析 URL 参数
  const parseParams = () => {
    const params = router.params
    if (params.platforms) setPlatforms(params.platforms.split(','))
    if (params.content) setContent(decodeURIComponent(params.content))
    if (params.title) setTitle(decodeURIComponent(params.title))
    if (params.images) setImages(params.images.split(',').filter(Boolean))
    if (params.avatarId) setAvatarId(params.avatarId)
  }

  // 获取分身绑定的账号信息
  const fetchAvatarAccounts = async () => {
    if (!avatarId) {
      setLoading(false)
      return
    }

    try {
      // 调用订单状态接口获取分身绑定的账号信息
      const res = await Network.request({
        url: '/api/order-processing/status',
        method: 'POST',
        data: { avatarId }
      })
      
      const resData = res.data as any
      if (resData?.code === 200 && resData?.data?.avatarAccounts) {
        setAvatarAccounts(resData.data.avatarAccounts)
      }
    } catch (error) {
      console.error('获取分身账号信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    parseParams()
  }, [])

  useEffect(() => {
    if (avatarId) {
      fetchAvatarAccounts()
    } else {
      setLoading(false)
    }
  }, [avatarId])

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

  // 检查平台是否需要绑定账号，以及是否已绑定
  const getPlatformBindingStatus = (platform: string): { required: boolean; bound: boolean; account?: AvatarAccount } => {
    const config = PLATFORM_INFO[platform]
    if (!config || !config.requiresBinding) {
      return { required: false, bound: true }
    }

    const account = avatarAccounts.find(a => a.platform === platform)
    return {
      required: true,
      bound: !!account,
      account
    }
  }

  // 跳转到账号绑定页面
  const handleGoToBinding = (platform: string) => {
    Taro.navigateTo({
      url: `/pages/avatar/avatar-account-config/index?avatarId=${avatarId}&platform=${platform}`
    })
  }

  // 处理打开APP/发布
  const handleOpenApp = (platform: string) => {
    const info = PLATFORM_INFO[platform]
    if (!info) return

    // 检查绑定状态
    const bindingStatus = getPlatformBindingStatus(platform)
    
    if (bindingStatus.required && !bindingStatus.bound) {
      // 需要绑定账号
      Taro.showModal({
        title: '需要绑定账号',
        content: `发布到${info.name}需要先绑定账号，是否前往绑定？`,
        confirmText: '去绑定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            handleGoToBinding(platform)
          }
        }
      })
      return
    }

    // 处理朋友圈特殊逻辑
    if (platform === 'wechat_moments') {
      handleOpenWechatMoments()
      return
    }

    // 处理微信公众号
    if (platform === 'wechat_mp') {
      handleOpenWechatMp(bindingStatus.account)
      return
    }

    // 处理其他平台
    if (info.appScheme) {
      // 尝试跳转小程序
      if (platform === 'xiaohongshu') {
        Taro.navigateToMiniProgram({
          appId: 'wxffc08ac7df48285e',
          path: '/pages/discover/discover',
          fail: () => {
            Taro.showToast({ title: '请手动打开小红书 App', icon: 'none' })
          }
        })
      } else {
        Taro.showToast({ title: `请手动打开${info.name} App`, icon: 'none' })
      }
    } else {
      Taro.showToast({ title: `请手动打开${info.name}`, icon: 'none' })
    }
  }

  // 处理微信朋友圈
  const handleOpenWechatMoments = () => {
    // 微信朋友圈无法通过 App Scheme 直接跳转到发布页
    // 只能引导用户手动操作
    Taro.showModal({
      title: '发布到朋友圈',
      content: '微信朋友圈无法自动跳转发布页。请按照以下步骤操作：\n\n1. 复制内容\n2. 打开微信\n3. 点击「发现」-「朋友圈」\n4. 长按右上角相机图标\n5. 粘贴内容并添加图片',
      confirmText: '我知道了',
      showCancel: false
    })
  }

  // 处理微信公众号
  const handleOpenWechatMp = (account?: AvatarAccount) => {
    if (account?.account_url) {
      // 有绑定的账号，直接打开公众号后台
      Taro.showLoading({ title: '正在打开...' })
      // 注意：公众号后台可能需要在 PC 端操作
      Taro.showModal({
        title: '前往公众号后台',
        content: `即将打开：${account.account_name}\n\n请在打开的页面中发布内容`,
        confirmText: '打开',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 尝试打开公众号后台
            Taro.showToast({ title: '请手动登录公众号后台', icon: 'none' })
          }
        }
      })
    } else {
      // 没有绑定账号
      Taro.showModal({
        title: '发布到微信公众号',
        content: '请前往微信公众平台 (mp.weixin.qq.com) 登录并发布内容',
        confirmText: '知道了',
        showCancel: false
      })
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

  // 渲染平台卡片
  const renderPlatformCard = (platform: string) => {
    const info = PLATFORM_INFO[platform] || { name: platform, icon: '📱', description: '', requiresBinding: false }
    const bindingStatus = getPlatformBindingStatus(platform)

    return (
      <View key={platform} className="platform-card">
        <View className="platform-header">
          <View className="platform-info">
            <Text className="platform-icon">{info.icon}</Text>
            <View className="platform-text">
              <Text className="platform-name">{info.name}</Text>
              <Text className="platform-desc">{info.description}</Text>
            </View>
          </View>
          {bindingStatus.required && (
            <View className="binding-status">
              {bindingStatus.bound ? (
                <View className="status-bound">
                  <CircleCheck size={14} color="#10b981" />
                  <Text className="status-text">已绑定</Text>
                </View>
              ) : (
                <View className="status-unbound">
                  <CircleAlert size={14} color="#f59e0b" />
                  <Text className="status-text">未绑定</Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        <View 
          className={`platform-action ${bindingStatus.required && !bindingStatus.bound ? 'action-warning' : ''}`}
          onClick={() => handleOpenApp(platform)}
        >
          <Text className="action-text">
            {platform === 'wechat_moments' ? '查看发布指引' : 
             bindingStatus.required && !bindingStatus.bound ? '去绑定账号' : '发布内容'}
          </Text>
          <ExternalLink size={16} color={bindingStatus.required && !bindingStatus.bound ? '#f59e0b' : '#3b82f6'} />
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="publish-guide-page">
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
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
          <Text className="intro-title">内容发布</Text>
          <Text className="intro-desc">
            请按照平台要求发布内容到对应平台{'\n'}
            部分平台需要先绑定账号
          </Text>
        </View>

        {/* 目标平台 */}
        <View className="platform-section">
          <Text className="section-title">目标平台</Text>
          <View className="platform-list">
            {platforms.map(renderPlatformCard)}
          </View>
        </View>

        {/* 提示信息 */}
        <View className="tips-section">
          <Text className="tips-title">发布提示</Text>
          <View className="tips-list">
            <View className="tip-item">
              <Text className="tip-bullet">•</Text>
              <Text className="tip-text">先复制内容，再保存图片，最后发布</Text>
            </View>
            <View className="tip-item">
              <Text className="tip-bullet">•</Text>
              <Text className="tip-text">图片需要逐张保存到相册</Text>
            </View>
            <View className="tip-item">
              <Text className="tip-bullet">•</Text>
              <Text className="tip-text">朋友圈建议发 3-9 张图效果更好</Text>
            </View>
          </View>
        </View>

        {/* 生成的内容 */}
        <View className="content-section">
          <View className="section-header">
            <Text className="section-title">生成内容</Text>
            <View className="copy-btn" onClick={handleCopyContent}>
              {copied ? (
                <>
                  <Check size={14} color="#10b981" />
                  <Text className="copy-text copied">已复制</Text>
                </>
              ) : (
                <>
                  <Copy size={14} color="#3b82f6" />
                  <Text className="copy-text">复制</Text>
                </>
              )}
            </View>
          </View>

          {/* 标题 */}
          {title && (
            <View className="content-item">
              <Text className="content-label">标题</Text>
              <Text className="content-value title">{title}</Text>
            </View>
          )}

          {/* 正文 */}
          <View className="content-item">
            <Text className="content-label">正文</Text>
            <View className="content-body">
              <Text className="content-value">{content}</Text>
            </View>
          </View>

          {/* 图片 */}
          {images.length > 0 && (
            <View className="content-item">
              <Text className="content-label">配图 ({images.length}张)</Text>
              <ScrollView className="image-list" scrollX>
                {images.map((url, index) => (
                  <View key={url} className="image-item">
                    <Image
                      className="preview-image"
                      src={url}
                      mode="aspectFill"
                      onClick={() => {
                        Taro.previewImage({
                          urls: images,
                          current: url
                        })
                      }}
                    />
                    <View 
                      className="save-btn"
                      onClick={() => handleDownloadImage(url, index)}
                    >
                      <Text className="save-btn-text">保存</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 底部安全区 */}
        <View className="safe-area-bottom" />
      </ScrollView>
    </View>
  )
}
