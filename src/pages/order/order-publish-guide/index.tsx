import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { 
  ChevronLeft, Copy, Check, 
  FileText, Image as ImageIcon, Video,
  Send, Save, ChevronRight,
  MessageSquare, CircleAlert, LayoutPanelLeft
} from 'lucide-react-taro'
import './index.css'

interface AvatarAccount {
  id: string
  platform: string
  account_name: string
  account_url?: string
  appid?: string
}

// 平台配置
const PLATFORM_CONFIG: Record<string, {
  name: string
  icon: string
  color: string
  bgColor: string
  description: string
  contentTips: string[]
  requiresBinding: boolean
}> = {
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    color: '#FF2442',
    bgColor: '#FFF0F0',
    description: '发布图文笔记，吸引年轻用户',
    contentTips: ['封面图要精美，吸引眼球', '标题要有悬念或共鸣', '正文要简洁有条理', '添加相关话题标签'],
    requiresBinding: false
  },
  douyin: {
    name: '抖音',
    icon: '🎵',
    color: '#00F2EA',
    bgColor: '#E0FFFD',
    description: '发布短视频，获取流量曝光',
    contentTips: ['视频前3秒要抓住眼球', '配文要简短有力', '添加热门音乐', '使用热门话题标签'],
    requiresBinding: false
  },
  wechat_moments: {
    name: '朋友圈',
    icon: '💬',
    color: '#07C160',
    bgColor: '#E8FFF0',
    description: '分享生活点滴，增强社交互动',
    contentTips: ['朋友圈建议3-9张图', '文案要生活化、真实', '配图风格要统一', '可以适当添加表情'],
    requiresBinding: false
  },
  wechat_mp: {
    name: '公众号',
    icon: '📧',
    color: '#07C160',
    bgColor: '#E8FFF0',
    description: '发布深度文章，建立专业形象',
    contentTips: ['标题要吸引人', '封面图要高清', '排版要整洁美观', '文章要有价值输出'],
    requiresBinding: true
  },
  weibo: {
    name: '微博',
    icon: '🌐',
    color: '#E6162D',
    bgColor: '#FFE8E8',
    description: '发布短内容，扩大影响力',
    contentTips: ['配图要精美', '话题标签要相关', '文案要简洁', '可以@相关账号'],
    requiresBinding: false
  },
  bilibili: {
    name: 'Bilibili',
    icon: '📺',
    color: '#FB7299',
    bgColor: '#FFF0F5',
    description: '发布视频内容，吸引年轻用户',
    contentTips: ['封面图要吸引人', '标题要有吸引力', '视频质量要清晰', '添加相关标签'],
    requiresBinding: false
  }
}

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, {
  name: string
  icon: React.ReactNode
  tips: string[]
}> = {
  图文: {
    name: '图文',
    icon: <FileText size={16} color="#6366f1" />,
    tips: ['需要精美的封面图', '标题要吸引人', '正文要有价值']
  },
  图片: {
    name: '图片',
    icon: <ImageIcon size={16} color="#f59e0b" />,
    tips: ['图片要有视觉冲击力', '建议3-9张图', '风格要统一']
  },
  视频: {
    name: '视频',
    icon: <Video size={16} color="#ef4444" />,
    tips: ['视频要清晰稳定', '开头要有吸引力', '时长要适中']
  },
  排版: {
    name: '排版',
    icon: <LayoutPanelLeft size={16} color="#10b981" />,
    tips: ['排版要整洁美观', '段落要清晰', '重点要突出']
  }
}

export default function OrderPublishGuide() {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [contentType, setContentType] = useState<string>('图文')
  const [copied, setCopied] = useState(false)
  const [avatarId, setAvatarId] = useState('')
  const [avatarAccounts, setAvatarAccounts] = useState<AvatarAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPlatform, setCurrentPlatform] = useState<string>('')

  // 解析 URL 参数
  useEffect(() => {
    const params = router.params
    if (params.platforms) setPlatforms(params.platforms.split(','))
    if (params.content) setContent(decodeURIComponent(params.content))
    if (params.title) setTitle(decodeURIComponent(params.title))
    if (params.images) setImages(params.images.split(',').filter(Boolean))
    if (params.avatarId) setAvatarId(params.avatarId)
    if (params.contentType) setContentType(decodeURIComponent(params.contentType))
    if (platforms.length > 0) setCurrentPlatform(platforms[0])
  }, [])

  // 获取分身绑定的账号信息
  useEffect(() => {
    const fetchAvatarAccounts = async () => {
      if (!avatarId) {
        setLoading(false)
        return
      }

      try {
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

  // 检查平台是否需要绑定账号
  const getPlatformBindingStatus = (platform: string) => {
    const config = PLATFORM_CONFIG[platform]
    if (!config || !config.requiresBinding) {
      return { required: false, bound: true }
    }
    const account = avatarAccounts.find(a => a.platform === platform)
    return { required: true, bound: !!account, account }
  }

  // 跳转到账号绑定页面
  const handleGoToBinding = (platform: string) => {
    Taro.navigateTo({
      url: `/pages/avatar/avatar-account-config/index?avatarId=${avatarId}&platform=${platform}`
    })
  }

  // 处理打开APP/发布
  const handleOpenApp = (platform: string) => {
    const info = PLATFORM_CONFIG[platform]
    if (!info) return

    const bindingStatus = getPlatformBindingStatus(platform)
    
    if (bindingStatus.required && !bindingStatus.bound) {
      Taro.showModal({
        title: '需要绑定账号',
        content: `发布到${info.name}需要先绑定账号，是否前往绑定？`,
        confirmText: '去绑定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) handleGoToBinding(platform)
        }
      })
      return
    }

    if (platform === 'wechat_moments') {
      handleOpenWechatMoments()
      return
    }

    if (platform === 'wechat_mp') {
      handleOpenWechatMp(bindingStatus.account)
      return
    }

    // 小红书跳转
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
  }

  // 处理微信朋友圈
  const handleOpenWechatMoments = () => {
    Taro.showModal({
      title: '发布到朋友圈',
      content: '请按以下步骤操作：\n\n1. 复制内容（点击上方复制按钮）\n2. 打开微信\n3. 点击「发现」→「朋友圈」\n4. 长按右上角相机图标\n5. 粘贴内容并添加图片\n6. 发布朋友圈',
      confirmText: '我知道了',
      showCancel: false
    })
  }

  // 处理微信公众号
  const handleOpenWechatMp = (account?: AvatarAccount) => {
    if (account?.account_url) {
      Taro.showModal({
        title: '前往公众号后台',
        content: `即将打开：${account.account_name}\n\n请在打开的页面中发布内容`,
        confirmText: '打开',
        cancelText: '取消'
      })
    } else {
      Taro.showModal({
        title: '发布到公众号',
        content: '请前往微信公众平台 (mp.weixin.qq.com) 登录并发布内容',
        confirmText: '知道了',
        showCancel: false
      })
    }
  }

  // 预览图片
  const handlePreviewImage = (urls: string[], current: string) => {
    Taro.previewImage({
      urls: urls,
      current: current
    })
  }

  // 保存图片
  const handleSaveImage = (url: string) => {
    Taro.showLoading({ title: '保存中...' })
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

  // 保存所有图片
  const handleSaveAllImages = () => {
    if (images.length === 0) return
    Taro.showLoading({ title: '保存中...' })
    let savedCount = 0
    
    const saveNext = (index: number) => {
      if (index >= images.length) {
        Taro.hideLoading()
        Taro.showToast({ title: `已保存${savedCount}张图片`, icon: 'success' })
        return
      }
      
      Network.downloadFile({
        url: images[index],
        success: (res) => {
          Taro.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              savedCount++
              saveNext(index + 1)
            },
            fail: () => {
              saveNext(index + 1)
            }
          })
        },
        fail: () => {
          saveNext(index + 1)
        }
      })
    }
    
    saveNext(0)
  }

  if (loading) {
    return (
      <View className="publish-guide-page">
        <View className="loading-container">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="publish-guide-page">
      {/* 顶部导航 */}
      <View className="guide-header">
        <View className="header-back" onClick={handleBack}>
          <ChevronLeft size={24} color="#1e293b" />
        </View>
        <Text className="header-title">发布引导</Text>
        <View className="header-right" />
      </View>

      <ScrollView className="guide-scroll" scrollY>
        {/* 内容类型标签 */}
        <View className="content-type-bar">
          <View className="content-type-icon">
            {CONTENT_TYPE_CONFIG[contentType]?.icon}
          </View>
          <Text className="content-type-name">{contentType}</Text>
        </View>

        {/* 目标平台选择 */}
        <View className="section-container">
          <View className="section-header">
            <Text className="section-title">目标平台</Text>
            <Text className="section-subtitle">选择要发布的平台</Text>
          </View>
          
          <View className="platform-grid">
            {platforms.map((platform) => {
              const config = PLATFORM_CONFIG[platform] || {
                name: platform,
                icon: '📱',
                color: '#6366f1',
                bgColor: '#F0F0FF'
              }
              const bindingStatus = getPlatformBindingStatus(platform)
              const isSelected = currentPlatform === platform

              return (
                <View 
                  key={platform}
                  className={`platform-card ${isSelected ? 'platform-selected' : ''}`}
                  style={{
                    borderColor: isSelected ? config.color : '#E5E7EB',
                    backgroundColor: isSelected ? config.bgColor : '#FFFFFF'
                  }}
                  onClick={() => setCurrentPlatform(platform)}
                >
                  <Text className="platform-icon-lg">{config.icon}</Text>
                  <Text className="platform-name-lg" style={{ color: config.color }}>
                    {config.name}
                  </Text>
                  {bindingStatus.required && (
                    <View className="binding-badge">
                      {bindingStatus.bound ? (
                        <Text className="badge-text bound">已绑定</Text>
                      ) : (
                        <Text className="badge-text unbound">未绑定</Text>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        {/* 当前平台发布指南 */}
        {currentPlatform && PLATFORM_CONFIG[currentPlatform] && (
          <View className="section-container">
            <View className="publish-guide-card"
              style={{ borderLeftColor: PLATFORM_CONFIG[currentPlatform].color }}
            >
              <View className="guide-card-header">
                <Text className="guide-platform-icon">
                  {PLATFORM_CONFIG[currentPlatform].icon}
                </Text>
                <Text className="guide-platform-name">
                  {PLATFORM_CONFIG[currentPlatform].name}
                </Text>
              </View>
              <Text className="guide-platform-desc">
                {PLATFORM_CONFIG[currentPlatform].description}
              </Text>
              
              <View className="guide-tips">
                <Text className="tips-header">发布技巧</Text>
                {PLATFORM_CONFIG[currentPlatform].contentTips.map((tip, index) => (
                  <View key={index} className="tip-row">
                    <Text className="tip-number">{index + 1}</Text>
                    <Text className="tip-content">{tip}</Text>
                  </View>
                ))}
              </View>

              <View 
                className="publish-btn"
                style={{ backgroundColor: PLATFORM_CONFIG[currentPlatform].color }}
                onClick={() => handleOpenApp(currentPlatform)}
              >
                <Send size={18} color="#FFFFFF" />
                <Text className="publish-btn-text">
                  {getPlatformBindingStatus(currentPlatform).required && 
                   !getPlatformBindingStatus(currentPlatform).bound 
                    ? '去绑定账号' 
                    : '开始发布'}
                </Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </View>
            </View>
          </View>
        )}

        {/* 内容预览 */}
        <View className="section-container">
          <View className="section-header">
            <Text className="section-title">生成内容</Text>
            <View className="copy-all-btn" onClick={handleCopyContent}>
              {copied ? (
                <>
                  <Check size={14} color="#10b981" />
                  <Text className="copy-all-text copied">已复制</Text>
                </>
              ) : (
                <>
                  <Copy size={14} color="#3b82f6" />
                  <Text className="copy-all-text">复制全部</Text>
                </>
              )}
            </View>
          </View>

          {/* 标题 */}
          {title && (
            <View className="content-preview-card">
              <View className="preview-label">
                <FileText size={14} color="#6366f1" />
                <Text className="preview-label-text">标题</Text>
              </View>
              <Text className="preview-title">{title}</Text>
            </View>
          )}

          {/* 正文 */}
          {content && (
            <View className="content-preview-card">
              <View className="preview-label">
                <MessageSquare size={14} color="#8b5cf6" />
                <Text className="preview-label-text">正文</Text>
              </View>
              <Text className="preview-content">{content}</Text>
            </View>
          )}

          {/* 图片 */}
          {images.length > 0 && (
            <View className="content-preview-card">
              <View className="preview-label-row">
                <View className="preview-label">
                  <ImageIcon size={14} color="#f59e0b" />
                  <Text className="preview-label-text">配图 ({images.length}张)</Text>
                </View>
                <View className="save-all-btn" onClick={handleSaveAllImages}>
                  <Save size={14} color="#3b82f6" />
                  <Text className="save-all-text">保存全部</Text>
                </View>
              </View>
              
              <View className="image-grid">
                {images.map((url, index) => (
                  <View key={url} className="image-grid-item">
                    <Image
                      className="grid-image"
                      src={url}
                      mode="aspectFill"
                      onClick={() => handlePreviewImage(images, url)}
                    />
                    <View className="image-index">{index + 1}</View>
                    <View 
                      className="image-save-btn"
                      onClick={() => handleSaveImage(url)}
                    >
                      <Save size={12} color="#FFFFFF" />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 发布注意事项 */}
        <View className="section-container">
          <View className="notice-card">
            <View className="notice-header">
              <CircleAlert size={18} color="#f59e0b" />
              <Text className="notice-title">发布须知</Text>
            </View>
            <View className="notice-list">
              <View className="notice-item">
                <Text className="notice-bullet">•</Text>
                <Text className="notice-text">请仔细核对内容后再发布</Text>
              </View>
              <View className="notice-item">
                <Text className="notice-bullet">•</Text>
                <Text className="notice-text">图片需手动保存到相册后上传</Text>
              </View>
              <View className="notice-item">
                <Text className="notice-bullet">•</Text>
                <Text className="notice-text">部分平台需要先绑定账号</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 底部安全区 */}
        <View className="safe-area-bottom" />
      </ScrollView>
    </View>
  )
}
