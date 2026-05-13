import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ArrowLeft, Sparkles, RefreshCw } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { checkSkillPermission } from '@/utils/permission'
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

  const [skillUseCount, setSkillUseCount] = useState(0)

  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.life

  const handleTry = async () => {
    if (loading) return

    // 调用后端权益校验 — 检查技能使用次数
    const allowed = await checkSkillPermission(skillUseCount)
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
        setSkillUseCount(prev => prev + 1)
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

  const handleExampleClick = (text: string) => {
    setInput(text)
  }

  const handleAgain = () => {
    setResult('')
    setHasResult(false)
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
        </View>
      </View>

      {/* 内容区域 */}
      <View className="skill-try-body">
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
        </View>

        {/* 开始体验按钮 */}
        <View
          className={`try-start-btn ${loading ? 'disabled' : ''}`}
          onClick={handleTry}
        >
          {loading ? 'AI正在生成中...' : '开始体验'}
        </View>

        {/* 加载状态 */}
        {loading && (
          <View className="try-loading">
            <View className="try-loading-dots">
              <View className="try-loading-dot" />
              <View className="try-loading-dot" />
              <View className="try-loading-dot" />
            </View>
            <Text className="block try-loading-text">AI正在为你生成精彩内容...</Text>
          </View>
        )}

        {/* 结果区域 */}
        {hasResult && !loading && (
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
                <Text className="try-result-again" onClick={handleAgain}>再试一次</Text>
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
