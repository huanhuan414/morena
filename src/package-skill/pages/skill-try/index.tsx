import { useState, useEffect } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ArrowLeft, Sparkles, RefreshCw, ImagePlus, History, Trash2 } from 'lucide-react-taro'
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
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<ImageRecord[]>([])

  const isImageCategory = category === 'image'
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.life

  // 加载图片历史
  const loadHistory = async () => {
    try {
      const res = await Network.request({
        url: '/api/image-gen/history',
        method: 'GET',
        data: { page: 1, pageSize: 20 },
      })
      console.log('[SkillTry] history response:', res.data)
      const data = res.data?.data
      if (res.data?.code === 200 && data?.list) {
        setHistoryList(data.list)
      }
    } catch (err) {
      console.error('[SkillTry] loadHistory error:', err)
    }
  }

  useEffect(() => {
    if (isImageCategory) {
      loadHistory()
    }
  }, [])

  // 文本类技能体验
  const handleTextTry = async () => {
    if (loading) return
    const allowed = await checkSkillPermission(0)
    if (!allowed) return

    setLoading(true)
    setResult('')
    setHasResult(false)

    try {
      console.log('[SkillTry] 请求体验技能:', skillId, input)
      const res = await Network.request({
        url: '/api/skills/' + skillId + '/try',
        method: 'POST',
        data: { input },
      })
      console.log('[SkillTry] 响应:', res.data)

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
    setShowHistory(false)

    try {
      console.log('[SkillTry] 图片生成:', input, 'style:', imageStyle)
      const res = await Network.request({
        url: '/api/image-gen/generate',
        method: 'POST',
        data: { prompt: input.trim(), style: imageStyle, size: '1024x1024' },
      })
      console.log('[SkillTry] 图片生成响应:', res.data)

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

  const handleTry = () => {
    if (isImageCategory) {
      handleImageGenerate()
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
  }

  const handleDeleteImage = async (id: string) => {
    try {
      await Network.request({
        url: `/api/image-gen/${id}`,
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
      {/* 自定义导航头部 */}
      <View className="skill-try-header" style={{ paddingTop: Taro.pxTransform(statusBarHeight + 10) }}>
        <View className="skill-try-nav">
          <View className="skill-try-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="skill-try-title-area">
            <Text className="block skill-try-title">{skillName}</Text>
            <Text className="block skill-try-subtitle">{config.label} · 免费体验</Text>
          </View>
          {isImageCategory && (
            <View className="skill-try-history-btn" onClick={() => { setShowHistory(!showHistory); loadHistory() }}>
              <History size={20} color="#fff" />
            </View>
          )}
        </View>
      </View>

      <View className="skill-try-body">
        {/* 历史记录面板 */}
        {showHistory && isImageCategory && (
          <View className="try-history-card">
            <View className="try-history-header-row">
              <Text className="block try-history-title">生成历史</Text>
              <Text className="block try-history-count">{historyList.length} 张</Text>
            </View>
            {historyList.length === 0 ? (
              <View className="try-history-empty">
                <Text className="block try-history-empty-text">还没有生成过图片</Text>
              </View>
            ) : (
              <View className="try-history-grid">
                {historyList.map((item) => (
                  <View key={item.id} className="try-history-item" onClick={() => handlePreviewImage(item.url)}>
                    <Image className="try-history-img" src={item.url} mode="aspectFill" />
                    <View className="try-history-item-overlay">
                      <View className="try-history-delete" onClick={(e) => { e.stopPropagation(); handleDeleteImage(item.id) }}>
                        <Trash2 size={14} color="#fff" />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 输入卡片 */}
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

          {/* 图片风格选择 */}
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

        {/* 开始体验按钮 */}
        <View
          className={`try-start-btn ${loading ? 'disabled' : ''}`}
          onClick={handleTry}
        >
          {loading ? (isImageCategory ? 'AI正在绘制中...' : 'AI正在生成中...') : (isImageCategory ? '生成图片' : '开始体验')}
        </View>

        {/* 加载状态 */}
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

        {/* 文本结果区域 */}
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

        {/* 图片结果区域 */}
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

        {/* 底部 CTA */}
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
    </View>
  )
}
