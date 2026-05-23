import { View, Text, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import { navigateBack, showToast, useLoad } from '@tarojs/taro'
import { getSafeArea } from '@/utils/safe-area'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Sparkles, Loader } from 'lucide-react-taro'
import './index.css'

export default function SkillTrainingPage() {
  const [experience, setExperience] = useState('')
  const [tips, setTips] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedSkill, setGeneratedSkill] = useState<{
    name: string
    description: string
    category: string
  } | null>(null)
  const [capsulePlaceholderWidth, setCapsulePlaceholderWidth] = useState(120)

  useLoad(() => {
    // 初始化安全区域信息
    const safeArea = getSafeArea()
    setCapsulePlaceholderWidth(safeArea.placeholderWidthRpx)
  })

  // 生成技能
  const handleGenerateSkill = async () => {
    if (!experience.trim()) {
      showToast({ title: '请输入你的经验', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/skill-training/generate',
        method: 'POST',
        data: {
          experience: experience.trim(),
          tips: tips.trim()
        }
      })

      if (res.data?.code === 200) {
        setGeneratedSkill(res.data.data)
        showToast({ title: '技能生成成功', icon: 'success' })
      } else {
        showToast({ title: res.data?.msg || '生成失败', icon: 'none' })
      }
    } catch (error) {
      console.error('生成技能失败:', error)
      showToast({ title: '生成失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 保存技能
  const handleSaveSkill = async () => {
    if (!generatedSkill) return

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/skill-training/save',
        method: 'POST',
        data: generatedSkill
      })

      if (res.data?.code === 200) {
        showToast({ title: '技能保存成功', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: res.data?.msg || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存技能失败:', error)
      showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 重新生成
  const handleRegenerate = () => {
    setGeneratedSkill(null)
  }

  return (
    <View className="skill-training-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={36} color="#7B3FE4" />
        </View>
        <Text className="header-title">训练专属技能</Text>
        <View className="header-right" style={{ width: `${capsulePlaceholderWidth}rpx` }} />
      </View>

      <ScrollView className="content-scroll" scrollY>
        {!generatedSkill ? (
          <>
            {/* 输入表单 */}
            <View className="form-section">
              <View className="form-item">
                <Text className="form-label">
                  <Text className="required">*</Text>
                  你的经验
                </Text>
                <Text className="form-hint">
                  描述你在某个领域的专业经验，例如：&ldquo;我有5年的短视频运营经验，擅长抖音账号孵化和内容策划&rdquo;
                </Text>
                <View className="textarea-wrap">
                  <Textarea
                    className="form-textarea"
                    placeholder="请输入你的经验..."
                    value={experience}
                    onInput={(e) => setExperience(e.detail.value)}
                    maxlength={500}
                  />
                  <Text className="char-count">{experience.length}/500</Text>
                </View>
              </View>

              <View className="form-item">
                <Text className="form-label">技巧心得（可选）</Text>
                <Text className="form-hint">
                  分享你的独门技巧或方法论，帮助AI更好地理解你的技能
                </Text>
                <View className="textarea-wrap">
                  <Textarea
                    className="form-textarea"
                    placeholder="请输入你的技巧心得..."
                    value={tips}
                    onInput={(e) => setTips(e.detail.value)}
                    maxlength={300}
                  />
                  <Text className="char-count">{tips.length}/300</Text>
                </View>
              </View>
            </View>

            {/* 生成按钮 */}
            <View className="action-section">
              <Button
                className="generate-btn"
                onClick={handleGenerateSkill}
                disabled={loading || !experience.trim()}
              >
                {loading ? (
                  <>
                    <Loader size={32} color="#fff" className="spin" />
                    <Text className="btn-text">生成中...</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={32} color="#fff" />
                    <Text className="btn-text">生成专属技能</Text>
                  </>
                )}
              </Button>
            </View>

            {/* 提示信息 */}
            <View className="tips-section">
              <Text className="tips-title">💡 填写建议</Text>
              <View className="tips-list">
                <Text className="tips-item">• 尽量详细描述你的专业背景和擅长领域</Text>
                <Text className="tips-item">• 可以列举具体的案例或成果</Text>
                <Text className="tips-item">• 技巧心得可以包含你的独特方法论</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* 生成的技能展示 */}
            <View className="result-section">
              <View className="result-card">
                <View className="result-header">
                  <View className="result-icon">🎯</View>
                  <Text className="result-badge">AI生成</Text>
                </View>

                <View className="result-content">
                  <Text className="result-label">技能名称</Text>
                  <Text className="result-name">{generatedSkill.name}</Text>

                  <Text className="result-label">技能描述</Text>
                  <Text className="result-desc">{generatedSkill.description}</Text>

                  <Text className="result-label">技能分类</Text>
                  <View className="result-category">
                    <Text className="category-tag">{generatedSkill.category}</Text>
                  </View>
                </View>
              </View>

              {/* 操作按钮 */}
              <View className="result-actions">
                <Button className="save-btn" onClick={handleSaveSkill} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader size={28} color="#fff" className="spin" />
                      <Text>保存中...</Text>
                    </>
                  ) : (
                    <Text>保存技能</Text>
                  )}
                </Button>

                <Button className="regenerate-btn" onClick={handleRegenerate} disabled={loading}>
                  <Text>重新生成</Text>
                </Button>
              </View>
            </View>
          </>
        )}

        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
