import { useState } from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { ArrowLeft, Sparkles, RefreshCw, ImagePlus, History, Trash2, Image as ImageIcon, TrendingUp } from 'lucide-react-taro'
import { Network } from '@/network'
import { checkSkillPermission } from '@/utils/permission'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

const CATEGORY_CONFIG: Record<string, { label: string; placeholder: string; examples: string[] }> = {
  life: {
    label: '生活预测',
    placeholder: '告诉我你想了解什么...',
    examples: ['今年运势如何', '感情发展', '事业方向', '财运分析'],
  },
  image: {
    label: 'AI绘画',
    placeholder: '描述你想生成的画面...',
    examples: ['夕阳下的海边', '赛博朋克城市', '水彩风格猫咪', '星空下的城堡'],
  },
  video: {
    label: 'AI视频',
    placeholder: '描述你想生成的视频创意...',
    examples: ['产品宣传片', '美食探店vlog', '旅行风景短片', '品牌故事'],
  },
  content: {
    label: '内容创作',
    placeholder: '描述你想创作的内容...',
    examples: ['小红书种草文案', '抖音爆款脚本', '公众号深度文章', '微博互动话题'],
  },
  social: {
    label: '社交运营',
    placeholder: '描述你的社交运营需求...',
    examples: ['涨粉策略', '互动方案', '活动策划', '社群运营'],
  },
}

const IMAGE_STYLES = [
  { key: 'realistic', label: '写实' },
  { key: 'anime', label: '动漫' },
  { key: 'oil_painting', label: '油画' },
  { key: 'watercolor', label: '水彩' },
  { key: 'sketch', label: '素描' },
  { key: '3d', label: '3D' },
]

interface ImageRecord {
  id: string
  prompt: string
  url: string
  style?: string
  status: string
  createdAt: string
}

export default function SkillTryPage() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()

  const skillId = router.params.skillId || ''
  const skillName = decodeURIComponent(router.params.skillName || '')
  const category = decodeURIComponent(router.params.category || 'life')

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [hasResult, setHasResult] = useState(false)

  // 图片生成专用状态
  const [imageStyle, setImageStyle] = useState('realistic')
  const [generatedImageUrl, setGeneratedImageUrl] = useState('')

  // 视频生成专用状态
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState('')

  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [historyList, setHistoryList] = useState<ImageRecord[]>([])

  const isImageCategory = category === 'image'
  const isVideoCategory = category === 'video'
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.life

  const PRIMARY = '#8B5CF6'
  const PRIMARY_FAINT = '#EDE9FE'
  const PRIMARY_BORDER = '#D4BFFF'

  const loadHistory = async () => {
    try {
      const url = isVideoCategory ? '/api/video-gen/history' : '/api/image-gen/history'
      const res = await Network.request({
        url,
        method: 'GET',
        data: { page: 1, pageSize: 20 },
      })
      const data = res.data?.data
      if (res.data?.code === 200 && data?.list) {
        setHistoryList(data.list)
      }
    } catch (err) {
      console.error('[SkillTry] loadHistory error:', err)
    }
  }

  useDidShow(() => {
    if (isImageCategory || isVideoCategory) {
      loadHistory()
    }
  })

  // 文本类技能体验
  const handleTextTry = async () => {
    if (loading) return
    const allowed = await checkSkillPermission(0)
    if (!allowed) return

    setLoading(true)
    setResult('')
    setHasResult(false)

    try {
      const res = await Network.request({
        url: '/api/skills/' + skillId + '/try',
        method: 'POST',
        data: { input },
      })

      const data = res.data?.data
      if (res.data?.code === 200 && data?.content) {
        setResult(data.content)
        setHasResult(true)
      } else {
        Taro.showToast({ title: res.data?.msg || '体验失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[SkillTry] 错误:', err)
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 图片生成体验
  const handleImageGenerate = async () => {
    if (loading) return
    if (!input.trim()) {
      Taro.showToast({ title: '请输入图片描述', icon: 'none' })
      return
    }

    const allowed = await checkSkillPermission(0)
    if (!allowed) return

    setLoading(true)
    setGeneratedImageUrl('')
    setHasResult(false)

    try {
      const res = await Network.request({
        url: '/api/image-gen/generate',
        method: 'POST',
        data: { prompt: input.trim(), style: imageStyle, size: '1024x1536' },
      })

      const data = res.data?.data
      if (res.data?.code === 200 && data?.url) {
        setGeneratedImageUrl(data.url)

        setHasResult(true)
        // 刷新历史
        loadHistory()
      } else {
        Taro.showToast({ title: res.data?.msg || '图片生成失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[SkillTry] 图片生成错误:', err)
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 视频生成体验
  const handleVideoGenerate = async () => {
    if (loading) return
    if (!input.trim()) {
      Taro.showToast({ title: '请输入视频描述', icon: 'none' })
      return
    }

    const allowed = await checkSkillPermission(0)
    if (!allowed) return

    setLoading(true)
    setGeneratedVideoUrl('')
    setHasResult(false)

    try {
      Taro.showLoading({ title: '视频生成中...', mask: true })
      const res = await Network.request({
        url: '/api/video-gen/generate',
        method: 'POST',
        data: { prompt: input.trim(), duration: 5, ratio: '9:16' },
      })

      Taro.hideLoading()
      const data = res.data?.data
      if (res.data?.code === 200 && data?.url) {
        setGeneratedVideoUrl(data.url)
        setHasResult(true)
        loadHistory()
      } else {
        Taro.showToast({ title: res.data?.msg || '视频生成失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('[SkillTry] 视频生成错误:', err)
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleTry = () => {
    if (isImageCategory) {
      handleImageGenerate()
    } else if (isVideoCategory) {
      handleVideoGenerate()
    } else {
      handleTextTry()
    }
  }

  const handleExampleClick = (text: string) => {
    setInput(text)
  }

  const handleAgain = () => {
    setResult('')
    setHasResult(false)
    setGeneratedImageUrl('')
    setGeneratedVideoUrl('')
  }

  const handleDeleteImage = async (id: string) => {
    try {
      const url = isVideoCategory ? `/api/video-gen/${id}` : `/api/image-gen/${id}`
      await Network.request({
        url,
        method: 'DELETE',
      })
      Taro.showToast({ title: '已删除', icon: 'success' })
      loadHistory()
    } catch (err) {
      console.error('[SkillTry] delete error:', err)
    }
  }

  const handlePreviewImage = (url: string) => {
    Taro.previewImage({
      current: url,
      urls: [url],
    })
  }

  return (
    <View className="skill-try-page">
      <View className="skill-try-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="skill-try-decoration">
          <View className="deco-circle circle-1" />
          <View className="deco-circle circle-2" />
        </View>
        <View className="skill-try-content">
          <View className="skill-try-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="skill-try-center">
            <Text className="skill-try-title">{skillName}</Text>
            <Text className="skill-try-subtitle">{config.label} · 免费体验</Text>
          </View>
        </View>
      </View>

      {(isImageCategory || isVideoCategory) && (
        <View style={{ paddingLeft: '32rpx', paddingRight: '32rpx', marginTop: '-24rpx', position: 'relative', zIndex: 10 }}>
          <View style={{ display: 'flex', flexDirection: 'row', backgroundColor: PRIMARY_FAINT, borderRadius: '24rpx', padding: '6rpx' }}>
            <View
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingTop: '16rpx', paddingBottom: '16rpx',
                borderRadius: '20rpx',
                backgroundColor: activeTab === 'generate' ? '#ffffff' : 'transparent',
                boxShadow: activeTab === 'generate' ? '0 4rpx 16rpx rgba(0,0,0,0.08)' : 'none',
              }}
              onClick={() => setActiveTab('generate')}
            >
              <Sparkles size={14} color={PRIMARY} style={{ marginRight: '8rpx' }} />
              <Text style={{ fontSize: '26rpx', fontWeight: 600, color: activeTab === 'generate' ? PRIMARY : '#666' }}>AI 生成</Text>
            </View>
            <View
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingTop: '16rpx', paddingBottom: '16rpx',
                borderRadius: '20rpx',
                backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
                boxShadow: activeTab === 'history' ? '0 4rpx 16rpx rgba(0,0,0,0.08)' : 'none',
              }}
              onClick={() => { setActiveTab('history'); loadHistory() }}
            >
              <History size={14} color={PRIMARY} style={{ marginRight: '8rpx' }} />
              <Text style={{ fontSize: '26rpx', fontWeight: 600, color: activeTab === 'history' ? PRIMARY : '#666' }}>历史记录</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView scrollY className="skill-try-body" style={{ flex: 1 }}>
        {(!isImageCategory && !isVideoCategory || activeTab === 'generate') && (
          <View>
            <View className="try-input-card">
              <Text className="block try-input-label">输入你的需求</Text>
              <Text className="block try-input-hint">试试以下示例，或自由输入你想体验的内容</Text>
              <View className="try-input-wrapper">
                <Input
                  style={{ width: '100%', fontSize: '28rpx', backgroundColor: 'transparent' }}
                  placeholder={config.placeholder}
                  value={input}
                  onInput={(e) => setInput(e.detail.value)}
                />
              </View>
              <View className="try-examples">
                {config.examples.map((ex, i) => (
                  <Text
                    key={i}
                    className="try-example-tag"
                    onClick={() => handleExampleClick(ex)}
                  >
                    {ex}
                  </Text>
                ))}
              </View>

              {isImageCategory && (
                <View className="try-style-section">
                  <Text className="block try-style-label">选择风格</Text>
                  <View className="try-style-list">
                    {IMAGE_STYLES.map((s) => (
                      <Text
                        key={s.key}
                        className={`try-style-tag ${imageStyle === s.key ? 'active' : ''}`}
                        onClick={() => setImageStyle(s.key)}
                      >
                        {s.label}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View
              className={`try-start-btn ${loading ? 'disabled' : ''}`}
              onClick={handleTry}
            >
              {loading ? (isImageCategory ? 'AI正在绘制中...' : 'AI正在生成中...') : (isImageCategory ? '生成图片' : '开始体验')}
            </View>

            {loading && (
              <View className="try-loading">
                <View className="try-loading-dots">
                  <View className="try-loading-dot" />
                  <View className="try-loading-dot" />
                  <View className="try-loading-dot" />
                </View>
                <Text className="block try-loading-text">
                  {isImageCategory ? 'AI正在为你绘制精彩图片，预计15-30秒...' : 'AI正在为你生成精彩内容...'}
                </Text>
              </View>
            )}

            {hasResult && !loading && !isImageCategory && (
              <View className="try-result-card">
                <View className="try-result-header">
                  <View className="try-result-icon">
                    <Sparkles size={22} color="#fff" />
                  </View>
                  <Text className="try-result-title">体验结果</Text>
                  <Text className="try-result-type">{config.label}</Text>
                </View>
                <Text className="block try-result-content">{result}</Text>
                <View className="try-result-footer">
                  <Text className="block try-result-tip">结果由AI生成，仅供参考</Text>
                  <View className="try-result-again" onClick={handleAgain}>
                    <RefreshCw size={14} color="#8B5CF6" className="mr-1" />
                    <Text className="try-result-again-text">再试一次</Text>
                  </View>
                </View>
              </View>
            )}

            {hasResult && !loading && isImageCategory && generatedImageUrl && (
              <View className="try-result-card">
                <View className="try-result-header">
                  <View className="try-result-icon">
                    <ImagePlus size={22} color="#fff" />
                  </View>
                  <Text className="try-result-title">生成结果</Text>
                  <Text className="try-result-type">{IMAGE_STYLES.find(s => s.key === imageStyle)?.label || 'AI绘画'}</Text>
                </View>
                <View className="try-image-wrapper" onClick={() => handlePreviewImage(generatedImageUrl)}>
                  <Image className="try-generated-image" src={generatedImageUrl} mode="widthFix" />
                </View>
                <View className="try-image-prompt">
                  <Text className="block try-image-prompt-label">你的描述</Text>
                  <Text className="block try-image-prompt-text">{input}</Text>
                </View>
                <View className="try-result-footer">
                  <Text className="block try-result-tip">点击图片可查看大图</Text>
                  <View className="try-result-again" onClick={handleAgain}>
                    <RefreshCw size={14} color="#8B5CF6" className="mr-1" />
                    <Text className="try-result-again-text">再画一张</Text>
                  </View>
                </View>
              </View>
            )}

            {hasResult && !loading && isVideoCategory && generatedVideoUrl && (
              <View className="try-result-card">
                <View className="try-result-header">
                  <View className="try-result-icon">
                    <TrendingUp size={22} color="#fff" />
                  </View>
                  <Text className="try-result-title">生成结果</Text>
                  <Text className="try-result-type">AI视频</Text>
                </View>
                <View className="try-video-wrapper">
                  <video
                    className="try-generated-video"
                    src={generatedVideoUrl}
                    controls
                    style={{ width: '100%', borderRadius: '16rpx' }}
                  />
                </View>
                <View className="try-image-prompt">
                  <Text className="block try-image-prompt-label">你的描述</Text>
                  <Text className="block try-image-prompt-text">{input}</Text>
                </View>
                <View className="try-result-footer">
                  <Text className="block try-result-tip">视频已生成完成</Text>
                  <View className="try-result-again" onClick={handleAgain}>
                    <RefreshCw size={14} color="#8B5CF6" className="mr-1" />
                    <Text className="try-result-again-text">再生成一个</Text>
                  </View>
                </View>
              </View>
            )}

            {hasResult && !loading && (
              <View className="try-cta-card">
                <Text className="block try-cta-title">喜欢这个技能？</Text>
                <Text className="block try-cta-desc">为你的AI分身装配这个技能，自动接单赚钱</Text>
                <View
                  className="try-cta-btn"
                  onClick={() => Taro.navigateBack()}
                >
                  去装配技能
                </View>
              </View>
            )}
          </View>
        )}

        {(isImageCategory || isVideoCategory) && activeTab === 'history' && (
          <View>
            {historyList.length === 0 ? (
              <View className="try-history-empty-card">
                <View className="try-history-empty-icon">
                  <ImageIcon size={28} color={PRIMARY_BORDER} />
                </View>
                <Text className="block try-history-empty-text">暂无生成记录</Text>
                <Text className="block try-history-empty-sub">输入描述开始AI绘画</Text>
                <View className="try-history-empty-btn" onClick={() => setActiveTab('generate')}>
                  <Text style={{ color: '#fff', fontSize: '26rpx', fontWeight: 600 }}>去生成</Text>
                </View>
              </View>
            ) : (
              <View className="try-history-list">
                {historyList.map((item) => (
                  <View key={item.id} className="try-history-record">
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      {item.url ? (
                        <Image
                          src={item.url}
                          style={{ width: '104rpx', height: '104rpx', borderRadius: '16rpx', flexShrink: 0 }}
                          mode="aspectFill"
                        />
                      ) : (
                        <View style={{ width: '104rpx', height: '104rpx', borderRadius: '16rpx', backgroundColor: PRIMARY_FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ImageIcon size={20} color={PRIMARY_BORDER} />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: '24rpx', marginRight: '16rpx', overflow: 'hidden' }}>
                        <Text className="block" style={{ fontSize: '28rpx', fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.prompt || 'AI绘画'}</Text>
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '8rpx' }}>
                          <View
                            style={{
                              width: '12rpx', height: '12rpx', borderRadius: '50%', marginRight: '12rpx', flexShrink: 0,
                              backgroundColor: item.status === 'completed' ? '#10B981' : item.status === 'failed' ? '#EF4444' : '#F59E0B',
                            }}
                          />
                          <Text className="block" style={{ fontSize: '24rpx', color: '#999' }}>
                            {item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '生成中'}
                          </Text>
                        </View>
                        <Text className="block" style={{ fontSize: '22rpx', color: '#ccc', marginTop: '6rpx' }}>{item.createdAt}</Text>
                      </View>
                      <View
                        style={{ width: '64rpx', height: '64rpx', borderRadius: '16rpx', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        onClick={(e) => { e.stopPropagation && e.stopPropagation(); handleDeleteImage(item.id); }}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </View>
                    </View>
                    {item.status === 'completed' && item.url && (
                      <View style={{ marginTop: '20rpx', borderRadius: '16rpx', overflow: 'hidden' }} onClick={() => handlePreviewImage(item.url)}>
                        <Image
                          src={item.url}
                          style={{ width: '100%', height: '320rpx' }}
                          mode="aspectFill"
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
