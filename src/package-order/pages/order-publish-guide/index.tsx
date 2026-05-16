import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Image, Video as TaroVideo } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import {
  PLATFORM_META_MAP,
  canonicalizePlatform,
  canonicalizePlatforms,
  getPlatformLabel,
  type CanonicalPlatformKey,
  type PlatformMeta
} from '@/constants/publish-platform'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { 
  ArrowLeft, Copy, Check, 
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

const PLATFORM_CONFIG = PLATFORM_META_MAP

const getValidatedPlatformMeta = (platform?: string): PlatformMeta | undefined => {
  const canonicalPlatform = canonicalizePlatform(platform) as CanonicalPlatformKey
  return PLATFORM_CONFIG[canonicalPlatform]
}

const getValidatedPlatforms = (platforms: string[] = []): CanonicalPlatformKey[] => {
  return canonicalizePlatforms(platforms).filter((platform): platform is CanonicalPlatformKey => {
    return Boolean(getValidatedPlatformMeta(platform))
  })
}

export default function OrderPublishGuide() {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<CanonicalPlatformKey[]>([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [videos, setVideos] = useState<string[]>([])
  const [contentType, setContentType] = useState<string>('图文')
  const [copied, setCopied] = useState(false)
  const [avatarId, setAvatarId] = useState('')
  const [avatarAccounts, setAvatarAccounts] = useState<AvatarAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPlatform, setCurrentPlatform] = useState<CanonicalPlatformKey | ''>('')
  const [requestId, setRequestId] = useState<string>('')
  const [publishing, setPublishing] = useState(false)
  const [orderId, setOrderId] = useState<string>('')

  // 解析 URL 参数
  useEffect(() => {
    const params = router.params

    // 如果有 contentId，从后端拉取完整数据
    if (params.contentId) {
      const fetchContentById = async () => {
        try {
          const res = await Network.request({
            url: `/api/content-generation/content/${params.contentId}`
          })
          const resData = res.data as any
          console.log('[发布引导] 通过contentId获取数据:', resData?.code, resData?.data?.id)
          if (resData?.code === 200 && resData?.data) {
            const data = resData.data
            if (data.content) setContent(data.content)
            if (data.images && data.images.length > 0) setImages(data.images)
            // 解析视频：兼容 videos 数组和 videoUrl 字符串
            if (data.videos && data.videos.length > 0) {
              setVideos(data.videos)
            } else if (data.videoUrl) {
              try {
                const parsed = JSON.parse(data.videoUrl)
                setVideos(Array.isArray(parsed) ? parsed : [data.videoUrl])
              } catch {
                setVideos([data.videoUrl])
              }
            }
            if (data.avatarId) setAvatarId(data.avatarId)
            if (data.orderId) setOrderId(data.orderId)
            if (data.platforms && data.platforms.length > 0) {
              const validatedPlatforms = getValidatedPlatforms(data.platforms)
              if (validatedPlatforms.length > 0) {
                setPlatforms(validatedPlatforms)
                setCurrentPlatform(validatedPlatforms[0])
              }
            } else if (data.platform) {
              const validatedPlatforms = getValidatedPlatforms([data.platform])
              if (validatedPlatforms.length > 0) {
                setPlatforms(validatedPlatforms)
                setCurrentPlatform(validatedPlatforms[0])
              }
            }
            if (data.contentType) {
              const typeMap: Record<string, string> = {
                image_text: '图文',
                article: '图文',
                video: '视频',
                video_text: '视频',
              }
              setContentType(typeMap[data.contentType] || '图文')
            }
            setRequestId(params.contentId || '')
          }
        } catch (error) {
          console.error('[发布引导] 获取内容失败:', error)
        }
      }
      fetchContentById()
      return
    }

    // 兼容旧逻辑：从 URL 参数直接取值
    const platformsFromQuery = params.platforms ? getValidatedPlatforms(params.platforms.split(',')) : []
    if (platformsFromQuery.length > 0) {
      setPlatforms(platformsFromQuery)
      setCurrentPlatform(platformsFromQuery[0])
    }
    if (params.content) setContent(decodeURIComponent(params.content))
    if (params.title) setTitle(decodeURIComponent(params.title))
    if (params.images) setImages(params.images.split(',').filter(Boolean))
    if (params.avatarId) setAvatarId(params.avatarId)
    if (params.contentType) setContentType(decodeURIComponent(params.contentType))
    if (params.requestId) setRequestId(params.requestId)
    if (params.orderId) setOrderId(params.orderId)
  }, [])

  const fetchAvatarAccounts = useCallback(async () => {
    if (!avatarId) {
      setLoading(false)
      return
    }

    try {
      const statusIdentifier = requestId || orderId
      if (!statusIdentifier) {
        setLoading(false)
        return
      }
      const res = await Network.request({
        url: `/api/order-processing/status/${statusIdentifier}`
      })
      
      const resData = res.data as any
      if (resData?.code === 200 && resData?.data) {
        if (resData.data.avatarId && !avatarId) {
          setAvatarId(resData.data.avatarId)
        }
        if (Array.isArray(resData.data.avatarAccounts)) {
          setAvatarAccounts(resData.data.avatarAccounts)
        }
      }
    } catch (error) {
      console.error('获取分身账号信息失败:', error)
    } finally {
      setLoading(false)
    }
  }, [avatarId, orderId, requestId])

  // 获取分身绑定的账号信息
  useEffect(() => {
    fetchAvatarAccounts()
  }, [fetchAvatarAccounts])

  useDidShow(() => {
    fetchAvatarAccounts()
  })

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
    const config = getValidatedPlatformMeta(platform)
    if (!config || !config.requiresBinding) {
      return { required: false, bound: true }
    }
    const account = avatarAccounts.find(a => a.platform === platform)
    return { required: true, bound: !!account, account }
  }

  // 跳转到账号绑定页面
  const handleGoToBinding = (platform: string) => {
    Taro.navigateTo({
      url: `/package-avatar/pages/avatar-account-config/index?avatarId=${avatarId}&platform=${platform}`
    })
  }

  // 处理打开APP/发布
  const handleOpenApp = (platform: string) => {
    const info = getValidatedPlatformMeta(platform)
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

  // 完成发布
  const handleCompletePublish = async () => {
    if (!requestId) {
      Taro.showToast({ title: '缺少订单ID', icon: 'none' })
      return
    }

    Taro.showModal({
      title: '确认发布完成',
      content: '请确认您已在对应平台完成内容发布，点击确定后将更新订单状态。',
      confirmText: '确定',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          setPublishing(true)
          try {
            const result = await Network.request({
              url: `/api/order-processing/publish/${requestId}`,
              method: 'POST',
              data: {
                platforms: canonicalizePlatforms(platforms)
              }
            })
            
            if (result.data?.code === 200) {
              Taro.showToast({ title: '发布成功', icon: 'success' })
              // 跳转到发布反馈页面
              setTimeout(() => {
                Taro.redirectTo({
                  url: `/package-order/pages/order-publish-feedback/index?requestId=${requestId}&orderId=${orderId}&avatarId=${avatarId}`
                })
              }, 1000)
            } else {
              Taro.showToast({ title: result.data?.message || '发布失败', icon: 'none' })
            }
          } catch (error: any) {
            Taro.showToast({ title: error.message || '发布失败', icon: 'none' })
          } finally {
            setPublishing(false)
          }
        }
      }
    })
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

  const statusBarHeight = getStatusBarHeight()

  if (loading) {
    return (
      <View className="publish-guide-page">
        <View className="guide-header" style={{ paddingTop: statusBarHeight + 'px' }}>
          <View className="guide-header-deco">
            <View className="guide-header-circle circle-a" />
            <View className="guide-header-circle circle-b" />
          </View>
          <View className="guide-header-bar">
            <View className="guide-back-btn" onClick={handleBack}>
              <ArrowLeft size={20} color="#fff" />
            </View>
            <View className="guide-header-center">
              <Text className="guide-header-title">发布引导</Text>
            </View>
            <View className="guide-header-placeholder" />
          </View>
        </View>
        <View className="loading-container">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="publish-guide-page">
      {/* 顶部自定义导航 */}
      <View className="guide-header" style={{ paddingTop: statusBarHeight + 'px' }}>
        <View className="guide-header-deco">
          <View className="guide-header-circle circle-a" />
          <View className="guide-header-circle circle-b" />
        </View>
        <View className="guide-header-bar">
          <View className="guide-back-btn" onClick={handleBack}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="guide-header-center">
            <Text className="guide-header-title">发布引导</Text>
          </View>
          <View className="guide-header-placeholder" />
        </View>
        <View className="guide-header-desc">
          <Text className="block">按步骤发布内容到目标平台</Text>
        </View>
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
              const config = getValidatedPlatformMeta(platform) || {
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
        {currentPlatform && getValidatedPlatformMeta(currentPlatform) && (
          <View className="section-container">
            <View className="publish-guide-card"
              style={{ borderLeftColor: getValidatedPlatformMeta(currentPlatform)?.color }}
            >
              <View className="guide-card-header">
                <Text className="guide-platform-icon">
                  {getValidatedPlatformMeta(currentPlatform)?.icon}
                </Text>
                <Text className="guide-platform-name">
                  {getPlatformLabel(currentPlatform)}
                </Text>
              </View>
              <Text className="guide-platform-desc">
                {getValidatedPlatformMeta(currentPlatform)?.description}
              </Text>
              
              <View className="guide-tips">
                <Text className="tips-header">发布技巧</Text>
                {(getValidatedPlatformMeta(currentPlatform)?.contentTips || []).map((tip, index) => (
                  <View key={index} className="tip-row">
                    <Text className="tip-number">{index + 1}</Text>
                    <Text className="tip-content">{tip}</Text>
                  </View>
                ))}
              </View>

              <View 
                className="publish-btn"
                style={{ backgroundColor: getValidatedPlatformMeta(currentPlatform)?.color }}
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
              {/* 图文文章型：用 Markdown 渲染，图片嵌入文中 */}
              {content.includes('![') ? (
                <View className="preview-markdown-content">
                  <MarkdownRenderer content={content} />
                </View>
              ) : (
                <Text className="preview-content">{content}</Text>
              )}
            </View>
          )}

          {/* 图片（仅文案+配图分离型时单独显示） */}
          {images.length > 0 && !content.includes('![') && (
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

          {/* 视频 */}
          {videos.length > 0 && (
            <View className="content-preview-card">
              <View className="preview-label-row">
                <View className="preview-label">
                  <Video size={14} color="#ef4444" />
                  <Text className="preview-label-text">视频 ({videos.length}个)</Text>
                </View>
              </View>
              {videos.map((url, index) => (
                <View key={index} style={{ marginBottom: '12px', borderRadius: '12px', overflow: 'hidden' }}>
                  <TaroVideo src={url} style={{ width: '100%' }} controls autoplay={false} />
                </View>
              ))}
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

        {/* 完成发布按钮 */}
        {requestId && (
          <View className="fixed-bottom-bar">
            <View 
              className="complete-publish-btn"
              onClick={handleCompletePublish}
            >
              {publishing ? (
                <Text className="complete-publish-text">处理中...</Text>
              ) : (
                <Text className="complete-publish-text">完成发布</Text>
              )}
            </View>
          </View>
        )}

        {/* 底部安全区 */}
        <View className="safe-area-bottom" />
      </ScrollView>
    </View>
  )
}
